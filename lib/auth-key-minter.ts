import { execSync } from "child_process";

/** Single-use key, 1h expiry. This command is a constant: no request data is interpolated. */
export const HEADSCALE_CREATE_CMD =
  "docker exec seedinfer-headscale headscale preauthkeys create --user seedinfer --tags tag:provider --expiration 1h 2>&1";

export const KEY_EXPIRY = "1h";

/**
 * Replaceable key minter. Production default tries the local headscale
 * container, then the HEADSCALE_PROXY_URL / HEADSCALE_API_URL proxy.
 * Tests inject a mock via setAuthKeyMinter() so no docker is needed.
 */
export type MintAuthKeyFn = () => Promise<string | null>;

let testMinter: MintAuthKeyFn | null = null;

/** Test hook: replace (or restore with null) the key minter. */
export function setAuthKeyMinter(fn: MintAuthKeyFn | null): void {
  testMinter = fn;
}

/** Alias kept for readability in tests. */
export const __setMintAuthKeyForTests = setAuthKeyMinter;

function tryHeadscale(): string | null {
  try {
    execSync("which docker", { stdio: "ignore", timeout: 2000 });
  } catch {
    return null;
  }
  try {
    const out = execSync(HEADSCALE_CREATE_CMD, { encoding: "utf-8", timeout: 8000, maxBuffer: 1024 * 1024 });
    const lines = out.trim().split("\n");
    for (const line of lines.reverse()) {
      const m1 = line.match(/nodekey:[a-f0-9]+/i);
      if (m1) return m1[0];
      const m2 = line.match(/[a-f0-9]{48,}/i);
      if (m2) return m2[0];
      const m3 = line.match(/hskey-[a-z0-9\-_]+/i);
      if (m3) return m3[0];
    }
    const tokens = out.trim().split(/\s+/).filter(Boolean);
    if (tokens.length > 0) {
      const last = tokens[tokens.length - 1];
      if (last.length >= 20) return last;
    }
    return null;
  } catch (e: any) {
    console.warn(`[auth/request] headscale exec failed: ${e?.message?.slice(0, 300) || e}`);
    return null;
  }
}

async function tryHeadscaleViaProxy(): Promise<string | null> {
  const proxyUrl = process.env.HEADSCALE_PROXY_URL || process.env.HEADSCALE_API_URL || "";
  if (!proxyUrl) return null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 5000);
    const res = await fetch(`${proxyUrl.replace(/\/$/, "")}/preauthkeys/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: "seedinfer", tags: ["tag:provider"], reusable: false, expiration: KEY_EXPIRY }),
      signal: ctrl.signal as any,
    } as any);
    clearTimeout(t);
    if (!res.ok) return null;
    const j: any = await res.json().catch(() => ({}));
    return j.authkey || j.key || j.preAuthKey || null;
  } catch {
    return null;
  }
}

export async function mintAuthKey(): Promise<string | null> {
  if (testMinter) return testMinter();
  // Proxy first when configured, then the local headscale container.
  const viaProxy = await tryHeadscaleViaProxy();
  if (viaProxy) return viaProxy;
  return tryHeadscale();
}
