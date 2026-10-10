/**
 * lib/routing/node-targets.ts — allowlist for node URLs (tailnet IPv4 / ts.net).
 * No deps except node builtins. Env read at CALL time.
 */

export interface NodeProviderRef {
  id: string;
  tailscale_ip?: string | null;
  agent_url?: string | null;
  tailscale_hostname?: string | null;
}

let allowLoopbackForTests = false;

export function __setAllowLoopbackForTests(v: boolean): void {
  allowLoopbackForTests = !!v;
}

export function isAllowLoopbackForTests(): boolean {
  return allowLoopbackForTests;
}

/** True iff host is a valid IPv4 inside 100.64.0.0/10 (100.64.0.0 – 100.127.255.255). */
export function isTailnetIpv4(host: string): boolean {
  if (typeof host !== "string") return false;
  const h = host.trim();
  if (h.length === 0) return false;
  const parts = h.split(".");
  if (parts.length !== 4) return false;
  const nums: number[] = [];
  for (const p of parts) {
    if (p.length === 0 || p.length > 3) return false;
    if (!/^\d+$/.test(p)) return false;
    // reject leading zeros like "01"? allow single "0" only — strict but lenient: allow them
    // as long as numeric range holds (URL.hostname strips them anyway).
    const n = Number(p);
    if (!Number.isInteger(n) || n < 0 || n > 255) return false;
    nums.push(n);
  }
  if (nums[0] !== 100) return false;
  if (nums[1] < 64 || nums[1] > 127) return false;
  return true;
}

function getExtraPorts(): number[] {
  const raw = process.env.ROUTING_EXTRA_NODE_PORTS;
  if (!raw || raw.trim() === "") return [];
  const out: number[] = [];
  for (const tok of raw.split(",")) {
    const t = tok.trim();
    if (t === "") continue;
    const n = Number(t);
    if (Number.isInteger(n) && n >= 1 && n <= 65535) out.push(n);
  }
  return out;
}

function getAllowedPorts(): Set<number> {
  const s = new Set<number>([47901, 3001]);
  for (const p of getExtraPorts()) s.add(p);
  return s;
}

function isTsNetHost(host: string): boolean {
  if (host === "seedinfer.ts.net") return true;
  return host.endsWith(".seedinfer.ts.net") && host.length > ".seedinfer.ts.net".length;
}

/**
 * Validate a node URL. Returns normalized href on success, throws Error otherwise.
 * - protocol http(s) only
 * - host must be tailnet IPv4 or *.seedinfer.ts.net (127.0.0.1 only with test hook)
 * - explicit port required, must be in {47901,3001} + ROUTING_EXTRA_NODE_PORTS
 * - rejects userinfo (@ in authority)
 */
export function assertNodeUrl(raw: string): string {
  if (typeof raw !== "string" || raw.trim() === "") {
    throw new Error("invalid node url: empty");
  }
  const trimmed = raw.trim();
  const schemeMatch = trimmed.match(/^([A-Za-z][A-Za-z0-9+.-]*):\/\//);
  if (!schemeMatch) throw new Error("invalid node url: must be http(s)");
  const afterScheme = trimmed.slice(schemeMatch[0].length);
  const authEnd = afterScheme.search(/[\/?#]/);
  const authority = authEnd === -1 ? afterScheme : afterScheme.slice(0, authEnd);
  if (authority.includes("@")) throw new Error("invalid node url: userinfo not allowed");

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("invalid node url: parse failed");
  }
  if (url.username !== "" || url.password !== "") {
    throw new Error("invalid node url: userinfo not allowed");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("invalid node url: protocol must be http(s)");
  }
  const host = url.hostname.toLowerCase();
  const tail = isTailnetIpv4(host);
  const tsnet = isTsNetHost(host);
  const loop = host === "127.0.0.1";
  if (loop) {
    if (!allowLoopbackForTests) throw new Error("invalid node url: loopback not allowed");
  } else if (!tail && !tsnet) {
    throw new Error("invalid node url: host must be tailnet IPv4 or *.seedinfer.ts.net");
  }
  if (tsnet && host !== "seedinfer.ts.net") {
    const label = host.slice(0, host.length - ".seedinfer.ts.net".length);
    if (label.length === 0 || label.startsWith(".") || label.endsWith(".")) {
      throw new Error("invalid node url: bad ts.net hostname");
    }
  }
  if (!url.port || url.port === "") {
    throw new Error("invalid node url: port must be one of allowed");
  }
  const portNum = Number(url.port);
  if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
    throw new Error("invalid node url: invalid port");
  }
  if (!getAllowedPorts().has(portNum)) {
    throw new Error(`invalid node url: port ${portNum} not allowed`);
  }
  return url.toString();
}

function lenientChatUrlFromAgent(agent: string): string | null {
  let u: URL;
  try {
    u = new URL(agent.trim());
  } catch {
    return null;
  }
  if (u.username !== "" || u.password !== "") return null;
  if (u.protocol !== "http:" && u.protocol !== "https:") return null;
  const h = u.hostname.toLowerCase();
  const okTail = isTailnetIpv4(h);
  const okTs = isTsNetHost(h);
  const okLoop = h === "127.0.0.1" && allowLoopbackForTests;
  if (!okTail && !okTs && !okLoop) return null;
  let p = u.port !== "" ? Number(u.port) : 47901;
  const allowed = getAllowedPorts();
  if (!Number.isInteger(p) || p < 1 || p > 65535 || !allowed.has(p)) p = 47901;
  if (p === 47900 || p === 8000) p = 47901;
  return `${u.protocol}//${u.hostname}:${p}/v1/chat/completions`;
}

/**
 * Resolve a provider to a chat-completions URL or null.
 * - prefer http://<tailscale_ip>:47901/v1/chat/completions when valid tailnet IP
 *   (127.0.0.1 only when test hook on)
 * - else parse agent_url via assertNodeUrl; keep URL port if allowed else 47901
 * - NEVER return ports 47900/8000 (rewritten to 47901 even if in extra ports)
 */
export function resolveNodeChatUrl(provider: NodeProviderRef): string | null {
  if (!provider || typeof provider.id !== "string" || provider.id === "") return null;
  const ipRaw = provider.tailscale_ip;
  if (typeof ipRaw === "string" && ipRaw.trim() !== "") {
    const clean = ipRaw.trim();
    if (isTailnetIpv4(clean) || (allowLoopbackForTests && clean === "127.0.0.1")) {
      return `http://${clean}:47901/v1/chat/completions`;
    }
  }
  const agent = provider.agent_url;
  if (typeof agent === "string" && agent.trim() !== "") {
    try {
      const normalized = assertNodeUrl(agent.trim());
      const u = new URL(normalized);
      let port = u.port !== "" ? Number(u.port) : 47901;
      const allowed = getAllowedPorts();
      if (!Number.isInteger(port) || !allowed.has(port)) port = 47901;
      if (port === 47900 || port === 8000) port = 47901;
      return `${u.protocol}//${u.hostname}:${port}/v1/chat/completions`;
    } catch {
      return lenientChatUrlFromAgent(agent);
    }
  }
  return null;
}
