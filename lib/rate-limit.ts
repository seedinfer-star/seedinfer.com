/**
 * lib/rate-limit.ts — shared in-memory fixed-window rate limiter.
 * Single-process only (same scope as the previous per-route Map stubs);
 * for multi-instance deployments use Redis/Upstash.
 * State lives on globalThis so Next.js HMR/dev reloads share counters.
 */

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

type Entry = { count: number; resetMs: number };

const MAX_KEYS = 10_000;

function getStore(): Map<string, Entry> {
  const g = globalThis as unknown as { __seedinferRateLimit?: Map<string, Entry> };
  if (!g.__seedinferRateLimit) g.__seedinferRateLimit = new Map<string, Entry>();
  return g.__seedinferRateLimit;
}

/**
 * Fixed-window check. When the window expired the counter resets.
 * Returns { ok:true } or { ok:false, retryAfterSec } (ceil seconds until reset).
 * The map is bounded: when full, the oldest entries are evicted first.
 */
export function checkRateLimit(key: string, max: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const store = getStore();
  const entry = store.get(key);
  if (!entry || now >= entry.resetMs) {
    store.set(key, { count: 1, resetMs: now + windowMs });
    if (store.size > MAX_KEYS) {
      // Evict oldest-reset entries first (Map preserves insertion order).
      const sorted = [...store.entries()].sort((a, b) => a[1].resetMs - b[1].resetMs);
      for (const [k] of sorted.slice(0, store.size - MAX_KEYS)) store.delete(k);
    }
    return { ok: true };
  }
  if (entry.count >= max) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((entry.resetMs - now) / 1000)) };
  }
  entry.count++;
  return { ok: true };
}

/** Reset one key (tests / admin). */
export function resetRateLimit(key: string): void {
  getStore().delete(key);
}

/** Clear all counters (tests). */
export function clearAllRateLimits(): void {
  getStore().clear();
}

/** First hop of X-Forwarded-For (the original client appended by the first proxy). */
function firstForwardedHop(xff: string | null): string | null {
  if (!xff) return null;
  const first = xff.split(",")[0]?.trim();
  return first || null;
}

/**
 * Shared client-IP extraction. The app runs behind Cloudflare Tunnel and
 * Cloudflare overwrites `cf-connecting-ip`, so it is trusted first; the
 * client-controlled `x-forwarded-for` comes only after `x-real-ip`, and only
 * its first hop is used. `x-tailscale-ip` is last.
 */
export function getClientIpFromHeaders(h: { get(name: string): string | null }): string | null {
  const pick = (v: string | null | undefined): string | null => {
    const t = (v || "").trim();
    return t || null;
  };
  return (
    pick(h.get("cf-connecting-ip")) ||
    pick(h.get("x-real-ip")) ||
    firstForwardedHop(h.get("x-forwarded-for")) ||
    pick(h.get("x-tailscale-ip"))
  );
}

export function getClientIp(req: Request): string {
  return getClientIpFromHeaders(req.headers) || "unknown";
}
