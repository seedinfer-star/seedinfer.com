/**
 * lib/routing/sse.ts — incremental SSE parser + usage helpers. No deps.
 */

export interface SseEvent {
  raw: string;
  data: string;
  isDone: boolean;
  isError: boolean;
  errorJson?: unknown;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  truncated?: boolean;
}

export interface UsageTotals {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

const MAX_EVENT_BYTES = 64 * 1024;

export function scanUsageFromText(text: string): UsageTotals | null {
  if (!text) return null;
  const re = /"usage"\s*:\s*\{([^}]*)\}/g;
  let m: RegExpExecArray | null = null;
  let last: UsageTotals | null = null;
  while ((m = re.exec(text)) !== null) {
    const inner = m[1];
    const num = (key: string): number | null => {
      const r = new RegExp(`"${key}"\\s*:\\s*(\\d+)`);
      const mm = r.exec(inner);
      if (!mm) return null;
      const n = Number(mm[1]);
      return Number.isFinite(n) ? n : null;
    };
    const p = num("prompt_tokens");
    const c = num("completion_tokens");
    const t = num("total_tokens");
    if (p === null || c === null || t === null) continue;
    last = { prompt_tokens: p, completion_tokens: c, total_tokens: t };
  }
  return last;
}

function parseEvent(raw: string): SseEvent {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const dataParts: string[] = [];
  for (const line of lines) {
    if (line.startsWith("data:")) {
      let v = line.slice(5);
      if (v.startsWith(" ")) v = v.slice(1);
      dataParts.push(v);
    }
  }
  const data = dataParts.join("\n");
  const isDone = data.trim() === "[DONE]";
  let isError = false;
  let errorJson: unknown;
  const trimmed = data.trim();
  if (!isDone && trimmed !== "" && (trimmed.startsWith("{") || trimmed.startsWith("["))) {
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === "object" && parsed !== null && "error" in parsed) {
        isError = true;
        errorJson = (parsed as Record<string, unknown>)["error"];
      }
    } catch {
      /* not JSON — fine */
    }
  }
  const usage = scanUsageFromText(data) ?? undefined;
  return { raw, data, isDone, isError, errorJson, usage };
}

export class SseSniffer {
  private buf = "";
  private pendingCR = false;
  private oversized = false;
  private rawLen = 0;

  push(chunk: Buffer | string): SseEvent[] {
    const text = typeof chunk === "string" ? chunk : chunk.toString("utf8");
    // Key detail: a lone '\r' at the end of a previous push plus a leading
    // '\n' here completes a CRLF. If pendingCR is set and the new text starts
    // with '\n', the CRLF completes a blank-line boundary together with the
    // previously buffered line.
    let t = text;
    if (this.pendingCR) {
      this.pendingCR = false;
      if (t.startsWith("\n")) {
        this.buf += "\r\n";
        t = t.slice(1);
      }
      // else: the lone '\r' was just a line ending on its own; normalize
      // lazily at parse time (parseEvent handles bare '\r').
    }
    if (t.endsWith("\r")) {
      this.pendingCR = true;
      t = t.slice(0, -1);
    }
    this.buf += t;
    if (this.buf.length > MAX_EVENT_BYTES) this.oversized = true;
    const out: SseEvent[] = [];
    for (;;) {
      const idx = this.findBoundary(this.buf);
      if (idx < 0) break;
      const raw = this.buf.slice(0, idx);
      this.buf = this.buf.slice(idx + this.boundaryLenAt(this.buf, idx));
      const ev = parseEvent(raw);
      if (this.oversized) {
        ev.truncated = true;
        this.oversized = false;
      }
      this.rawLen = 0;
      void this.rawLen;
      out.push(ev);
    }
    if (this.buf.length > MAX_EVENT_BYTES) this.oversized = true;
    return out;
  }

  flush(): SseEvent[] {
    let tail = this.buf;
    this.buf = "";
    if (this.pendingCR) {
      this.pendingCR = false;
      tail += "\r";
    }
    if (tail === "") return [];
    // A trailing event without a terminating blank line still counts.
    if (tail.trim() === "") return [];
    const ev = parseEvent(tail);
    if (this.oversized || tail.length > MAX_EVENT_BYTES) ev.truncated = true;
    this.oversized = false;
    return [ev];
  }

  /** Index of next blank-line boundary, or -1. Handles \n\n, \r\n\r\n, and mixed splits. */
  private findBoundary(s: string): number {
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c !== "\n" && c !== "\r") continue;
      let j = i;
      // consume first line break
      if (s[j] === "\r" && s[j + 1] === "\n") j += 2;
      else j += 1;
      // blank line = immediately another line break
      if (s[j] === "\n" || s[j] === "\r") return i;
    }
    return -1;
  }

  private boundaryLenAt(s: string, idx: number): number {
    let j = idx;
    let n = 0;
    for (let k = 0; k < 2; k++) {
      if (s[j] === "\r" && s[j + 1] === "\n") {
        j += 2;
        n += 2;
      } else if (s[j] === "\n" || s[j] === "\r") {
        j += 1;
        n += 1;
      } else {
        break;
      }
    }
    return n;
  }
}

function hasEmptyChoices(data: string): boolean {
  const t = data.trim();
  if (t === "" || t === "[DONE]") return true;
  try {
    const p = JSON.parse(t) as unknown;
    if (typeof p !== "object" || p === null) return false;
    const o = p as Record<string, unknown>;
    const ch = o["choices"];
    if (!Array.isArray(ch)) return false;
    if (ch.length === 0) return true;
    return false;
  } catch {
    return false;
  }
}

/**
 * Drop heartbeat/usage-only events (empty choices + usage) when the client
 * did not request usage. Keeps real content and [DONE] always.
 */
export function stripUnsolicitedUsage(events: SseEvent[], clientWantsUsage: boolean): SseEvent[] {
  if (clientWantsUsage) return events;
  return events.filter((e) => {
    if (e.isDone) return true;
    if (!e.usage) return true;
    if (!hasEmptyChoices(e.data)) return true;
    return false;
  });
}
