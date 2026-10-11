/**
 * lib/routing/upstream-http.ts — Node:http POST client for tailnet nodes.
 * Fresh Agent per request ({keepAlive:false}); no pooled keep-alive across
 * calls to avoid dead WireGuard sockets. Env read at CALL time.
 */

import * as http from "node:http";
import * as https from "node:https";

export interface PostToNodeOpts {
  url: string;
  body: string | Buffer | Uint8Array;
  headers?: Record<string, string>;
  signal?: AbortSignal;
  connectTimeoutMs?: number;
  ttftBudgetMs?: number;
  idleTimeoutMs?: number;
  totalTimeoutMs?: number;
  expectStream?: boolean;
  maxBodyBytes?: number;
}

export interface UpstreamOk {
  ok: true;
  status: number;
  headers: Record<string, string | string[] | undefined>;
  stream: AsyncIterable<Buffer>;
  ttftMs: number | null;
  abort(): void;
}

export interface UpstreamErr {
  ok: false;
  kind: "connect" | "timeout_ttft" | "timeout_idle" | "timeout_total" | "http" | "aborted";
  status?: number;
  bodyText?: string;
  error?: string;
}

export type UpstreamResult = UpstreamOk | UpstreamErr;

type Timer = ReturnType<typeof setTimeout>;

function envNum(name: string, fb: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === "") return fb;
  const n = Number(raw.trim());
  return Number.isFinite(n) && n > 0 ? n : fb;
}

function codeOf(e: unknown): string {
  if (typeof e === "object" && e !== null && "code" in e) {
    const c = (e as Record<string, unknown>)["code"];
    if (typeof c === "string") return c;
  }
  return "";
}

/** Numeric vLLM-style error code from a JSON body, if present. */
function errorCode(bodyText: string | null): number | null {
  if (!bodyText) return null;
  try {
    const p = JSON.parse(bodyText) as { error?: { code?: unknown }; code?: unknown };
    const c = p?.error?.code ?? p?.code;
    if (typeof c === "number" && Number.isInteger(c)) return c;
    if (typeof c === "string" && /^\d+$/.test(c.trim())) return Number(c.trim());
  } catch {
    /* not JSON */
  }
  return null;
}

export function classifyNodeHttp(
  status: number | null,
  bodyText: string | null,
): "client_error" | "saturated" | "node_error" {
  if (status === 429) return "saturated";
  if (status === 400 || status === 413 || status === 422) return "client_error";
  if (typeof status === "number") {
    // vLLM sometimes wraps a specific code inside a generic shell status.
    const inner = errorCode(bodyText);
    if (inner === 429) return "saturated";
    if (inner === 400 || inner === 413 || inner === 422) return "client_error";
    return "node_error";
  }
  return "node_error";
}

const snap = (chunks: Buffer[]): string => Buffer.concat(chunks).toString("utf8").slice(0, 2048);
const idleErr = (): Error => Object.assign(new Error("timeout_idle"), { kind: "timeout_idle" });
const totalErr = (): Error => Object.assign(new Error("timeout_total"), { kind: "timeout_total" });

function single(full: Buffer): AsyncIterable<Buffer> {
  return {
    [Symbol.asyncIterator]() {
      let done = false;
      return {
        next: () => {
          if (done) return Promise.resolve({ done: true as const, value: undefined });
          done = true;
          return Promise.resolve({ done: false as const, value: full });
        },
      };
    },
  };
}

export function postToNode(opts: PostToNodeOpts): Promise<UpstreamResult> {
  const connectTimeoutMs = opts.connectTimeoutMs ?? envNum("ROUTING_CONNECT_TIMEOUT_MS", 3000);
  const ttftBudgetMs = opts.ttftBudgetMs ?? envNum("ROUTING_TTFT_BUDGET_MS", 8000);
  const idleTimeoutMs = opts.idleTimeoutMs ?? envNum("ROUTING_STREAM_IDLE_MS", 60000);
  const totalTimeoutMs = opts.totalTimeoutMs ?? envNum("ROUTING_TOTAL_TIMEOUT_MS", 90000);
  const maxBodyBytes = opts.maxBodyBytes ?? envNum("ROUTING_MAX_BODY_BYTES", 16 * 1024 * 1024);
  const expectStream = opts.expectStream ?? false;
  const signal = opts.signal;
  const t0 = Date.now();
  if (signal?.aborted) return Promise.resolve({ ok: false, kind: "aborted" } as UpstreamErr);

  return new Promise<UpstreamResult>((resolve) => {
    let settled = false;
    let phase: "connect" | "headers" | "body" = "connect";
    let req: http.ClientRequest | null = null;
    let res: http.IncomingMessage | null = null;
    const timers: Timer[] = [];
    const arm = (ms: number, fn: () => void): Timer => {
      const t = setTimeout(() => {
        if (!settled) fn();
      }, Math.max(1, ms));
      if (t.unref) t.unref();
      timers.push(t);
      return t;
    };
    const disarm = (t: Timer): void => {
      clearTimeout(t);
      const i = timers.indexOf(t);
      if (i >= 0) timers.splice(i, 1);
    };
    const clearAll = (): void => {
      for (const t of timers) clearTimeout(t);
      timers.length = 0;
    };
    const finish = (r: UpstreamResult): void => {
      if (settled) return;
      settled = true;
      clearAll();
      signal?.removeEventListener("abort", onAbort);
      resolve(r);
    };
    const kill = (): void => {
      try {
        res?.destroy();
      } catch {
        /* noop */
      }
      try {
        req?.destroy();
      } catch {
        /* noop */
      }
    };
    const onAbort = (): void => {
      if (!settled) {
        kill();
        finish({ ok: false, kind: "aborted" });
      } else kill();
    };
    const failConnect = (error: string): void => {
      kill();
      finish({ ok: false, kind: "connect", error });
    };
    signal?.addEventListener("abort", onAbort, { once: true });

    let url: URL;
    try {
      url = new URL(opts.url);
    } catch (e) {
      finish({ ok: false, kind: "connect", error: String(e) });
      return;
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      finish({ ok: false, kind: "connect", error: "protocol must be http(s)" });
      return;
    }
    const bodyBuf =
      typeof opts.body === "string"
        ? Buffer.from(opts.body, "utf8")
        : Buffer.isBuffer(opts.body)
          ? opts.body
          : Buffer.from(opts.body);
    const mod = url.protocol === "https:" ? https : http;
    const agent =
      url.protocol === "https:" ? new https.Agent({ keepAlive: false }) : new http.Agent({ keepAlive: false });

    const onConnected = (): void => {
      if (settled || phase !== "connect") return;
      phase = "headers";
      arm(Math.min(connectTimeoutMs + 5000, ttftBudgetMs), () => {
        kill();
        finish({ ok: false, kind: "timeout_ttft", error: "headers timeout" });
      });
    };

    let request: http.ClientRequest;
    try {
      request = mod.request(
        url,
        {
          method: "POST",
          agent,
          path: url.pathname + url.search,
          headers: {
            "content-type": "application/json",
            "content-length": String(bodyBuf.length),
            ...(opts.headers ?? {}),
          },
        },
        (r) => {
          res = r;
          phase = "body";
          onResponse(r);
        },
      );
    } catch (e) {
      finish({ ok: false, kind: "connect", error: String(e) });
      return;
    }
    req = request;

    // Connect phase: arm only while the socket is still connecting.
    request.on("socket", (sock: import("node:net").Socket) => {
      const s = sock as unknown as { connecting?: boolean };
      if (s.connecting === false) {
        onConnected(); // already connected — skip connect timer
        return;
      }
      const t = arm(connectTimeoutMs, () => failConnect("connect timeout"));
      const done = (): void => {
        disarm(t);
        onConnected();
      };
      sock.once("connect", done);
      sock.once("secureConnect", done);
    });
    request.on("error", (e: Error) => {
      if (settled || phase === "body") return;
      if (e.name === "AbortError") {
        kill();
        finish({ ok: false, kind: "aborted" });
        return;
      }
      const code = codeOf(e);
      failConnect(`${code ? code + ": " : ""}${e.message}`);
    });
    try {
      request.end(bodyBuf);
    } catch (e) {
      failConnect(String(e));
    }

    function onResponse(r: http.IncomingMessage): void {
      const status = r.statusCode ?? 0;
      const headers = r.headers as Record<string, string | string[] | undefined>;
      const elapsed = Date.now() - t0;
      if (status < 200 || status >= 300) {
        collectErr(r, status);
        return;
      }
      if (!expectStream) collectOk(r, status, headers, ttftBudgetMs - elapsed, totalTimeoutMs - elapsed);
      else streamResp(r, status, headers, ttftBudgetMs - elapsed);
    }

    function collectErr(r: http.IncomingMessage, status: number): void {
      const chunks: Buffer[] = [];
      let n = 0;
      arm(10000, () => {
        try {
          r.destroy();
        } catch {
          /* noop */
        }
        finish({ ok: false, kind: "http", status, bodyText: snap(chunks) });
      });
      r.on("data", (c: Buffer) => {
        chunks.push(c);
        n += c.length;
        if (n > maxBodyBytes) {
          try {
            r.destroy();
          } catch {
            /* noop */
          }
          finish({ ok: false, kind: "http", status, bodyText: snap(chunks) });
        }
      });
      r.on("end", () => finish({ ok: false, kind: "http", status, bodyText: snap(chunks) }));
      r.on("error", () => finish({ ok: false, kind: "http", status, bodyText: snap(chunks) }));
    }

    function collectOk(
      r: http.IncomingMessage,
      status: number,
      headers: Record<string, string | string[] | undefined>,
      ttftLeft: number,
      totalLeft: number,
    ): void {
      const chunks: Buffer[] = [];
      let n = 0;
      let firstAt = 0;
      const ttftT = arm(Math.max(1, ttftLeft), () => {
        kill();
        finish({ ok: false, kind: "timeout_ttft", error: "ttft timeout" });
      });
      arm(Math.max(1, totalLeft), () => {
        try {
          r.destroy();
        } catch {
          /* noop */
        }
        finish({ ok: false, kind: "timeout_total", status, bodyText: snap(chunks), error: "total timeout" });
      });
      r.on("data", (c: Buffer) => {
        if (settled) return;
        if (!firstAt) {
          firstAt = Date.now();
          disarm(ttftT);
        }
        chunks.push(c);
        n += c.length;
        if (n > maxBodyBytes) {
          try {
            r.destroy();
          } catch {
            /* noop */
          }
          finish({ ok: false, kind: "timeout_total", status, bodyText: snap(chunks), error: "body too large" });
        }
      });
      r.on("end", () => {
        if (settled) return;
        finish({
          ok: true,
          status,
          headers,
          stream: single(Buffer.concat(chunks)),
          ttftMs: firstAt ? firstAt - t0 : null,
          abort: () => kill(),
        });
      });
      r.on("error", (e: Error) => {
        if (settled) return;
        if (!firstAt) finish({ ok: false, kind: "timeout_ttft", error: e.message });
        else finish({ ok: false, kind: "timeout_total", status, bodyText: snap(chunks), error: e.message });
      });
    }

    // Streaming body: queue chunks; first chunk defines ttft, each chunk
    // rearms the idle timer, total timer bounds the whole transfer.
    function streamResp(
      r: http.IncomingMessage,
      status: number,
      headers: Record<string, string | string[] | undefined>,
      ttftLeft: number,
    ): void {
      const queue: Buffer[] = [];
      const waiters: Array<{ res: (v: Buffer | null) => void; rej: (e: Error) => void }> = [];
      let ended = false;
      let failed: Error | null = null;
      let firstAt = 0;
      let emitted = false; // ok:true delivered exactly once
      let idleT: Timer | null = null;
      const wake = (): void => {
        while (waiters.length > 0 && queue.length > 0) {
          const w = waiters.shift() as { res: (v: Buffer | null) => void };
          const v = queue.shift() as Buffer;
          w.res(v);
        }
        if (ended) {
          while (waiters.length > 0) (waiters.shift() as { res: (v: null) => void }).res(null);
        }
        if (failed) {
          while (waiters.length > 0) (waiters.shift() as { rej: (e: Error) => void }).rej(failed as Error);
        }
      };
      const rearmIdle = (): void => {
        if (idleT) disarm(idleT);
        idleT = arm(idleTimeoutMs, () => {
          idleT = null;
          failed = idleErr();
          kill();
          wake();
          if (!emitted) {
            emitted = true;
            finish({ ok: false, kind: "timeout_ttft", error: "ttft timeout" });
          }
        });
      };
      // TTFT = first chunk within remaining ttft budget.
      const ttftT = arm(Math.max(1, ttftLeft), () => {
        kill();
        finish({ ok: false, kind: "timeout_ttft", error: "ttft timeout" });
      });
      arm(totalTimeoutMs, () => {
        failed = totalErr();
        kill();
        wake();
      });
      const emitOk = (): void => {
        if (emitted || settled) return;
        emitted = true;
        const curReq = req;
        const curRes = r;
        const iterable: AsyncIterable<Buffer> = {
          [Symbol.asyncIterator]() {
            return {
              next: (): Promise<IteratorResult<Buffer>> => {
                if (queue.length > 0) {
                  return Promise.resolve({ done: false as const, value: queue.shift() as Buffer });
                }
                if (ended) return Promise.resolve({ done: true as const, value: undefined });
                if (failed) return Promise.reject(failed);
                if (Date.now() - t0 > totalTimeoutMs) {
                  kill();
                  return Promise.reject(totalErr());
                }
                return new Promise<IteratorResult<Buffer>>((resNext, rejNext) => {
                  // Per-next() idle guard: survives finish() (which clears
                  // shared timers), so a stalled stream rejects here.
                  const to = setTimeout(() => {
                    const i = waiters.findIndex((w) => w.rej === onRej);
                    if (i >= 0) waiters.splice(i, 1);
                    failed = idleErr();
                    kill();
                    rejNext(failed);
                  }, Math.max(1, idleTimeoutMs));
                  if (to.unref) to.unref();
                  const entry = {
                    res: (v: Buffer | null) => {
                      clearTimeout(to);
                      return v === null
                        ? resNext({ done: true as const, value: undefined })
                        : resNext({ done: false as const, value: v });
                    },
                    rej: (e: Error) => {
                      clearTimeout(to);
                      rejNext(e);
                    },
                  };
                  const onRej = entry.rej;
                  waiters.push(entry);
                });
              },
            };
          },
        };
        finish({
          ok: true,
          status,
          headers,
          stream: iterable,
          ttftMs: firstAt ? firstAt - t0 : null,
          abort: () => {
            try {
              curRes.destroy();
            } catch {
              /* noop */
            }
            try {
              curReq?.destroy();
            } catch {
              /* noop */
            }
          },
        });
      };
      r.on("data", (c: Buffer) => {
        if (settled && emitted) {
          // still queue so an in-flight iterator can drain Buffered chunks
        }
        if (!firstAt) {
          firstAt = Date.now();
          disarm(ttftT);
          rearmIdle();
          queue.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
          wake();
          emitOk();
        } else {
          queue.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
          rearmIdle(); // after EACH chunk arm idleTimeoutMs
          wake();
        }
      });
      r.on("end", () => {
        ended = true;
        if (idleT) {
          disarm(idleT);
          idleT = null;
        }
        if (!firstAt) {
          disarm(ttftT);
          emitted = true;
          finish({ ok: true, status, headers, stream: single(Buffer.alloc(0)), ttftMs: null, abort: () => kill() });
          return;
        }
        wake();
      });
      r.on("error", (e: Error) => {
        if (!firstAt && !emitted) {
          emitted = true;
          disarm(ttftT);
          finish({ ok: false, kind: "timeout_ttft", error: e.message });
          return;
        }
        failed = e;
        wake();
      });
      r.on("aborted", () => {
        if (!firstAt && !emitted) {
          emitted = true;
          disarm(ttftT);
          finish({ ok: false, kind: "timeout_ttft", error: "response aborted" });
          return;
        }
        failed = failed ?? new Error("response aborted");
        wake();
      });
      signal?.addEventListener(
        "abort",
        () => {
          failed = new Error("aborted");
          kill();
          wake();
        },
        { once: true },
      );
    }
  });
}
