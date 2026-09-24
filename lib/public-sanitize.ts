/**
 * lib/public-sanitize.ts — strip infrastructure details from PUBLIC API responses.
 *
 * Apply ONLY at response time (NextResponse.json(sanitizePublic(x))). Internal
 * routing keeps using the raw store objects (agent_url, tailscale_ip, …).
 */

import { PROVIDER_ECONOMICS } from "./catalog"

/** Keys that are never returned publicly (matched case-insensitively). */
const DROP_KEYS = new Set(
  [
    "tailscale_ip",
    "tailscaleIp",
    "agent_url",
    "agentUrl",
    "last_heartbeat_ip",
    "ip",
    "public_ip",
    "local_ip",
    "hostname",
    "tailscale_hostname",
    "host_name",
    "raw",
    "hw_fingerprint",
    "vllm_url",
    "baseUrl",
    "base_url",
    "hf_cache",
    "hf_home",
    "model_path",
    "cache_dir",
    "apiKey",
    "apiKeyEnv",
    "apiKeyPreview",
    "env_hint",
  ].map((k) => k.toLowerCase()),
)

const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g
const FS_PATH = /(?:^|(?<=[\s"'(=:]))\/(?:mnt|home|root|opt|srv|data|var|tmp|Users|media)\/[^\s"',)]*/g
const WIN_PATH = /\b[A-Za-z]:\\[^\s"',)]*/g
const TS_NET = /\b[\w.-]+\.ts\.net(?::\d+)?\b/g
const INTERNAL_URL = /https?:\/\/(?:\[redacted\]|localhost|127\.0\.0\.1|[\w.-]+\.(?:local|lan|internal|ts\.net))(?::\d+)?[^\s"']*/g

/** Scrub IPs, private hostnames and local filesystem paths from a string. */
export function scrubString(s: string): string {
  if (!s) return s
  let out = s
  out = out.replace(TS_NET, "[redacted]")
  out = out.replace(IPV4, "[redacted]")
  out = out.replace(INTERNAL_URL, "[redacted]")
  out = out.replace(FS_PATH, "[path]")
  out = out.replace(WIN_PATH, "[path]")
  return out
}

/** Deep-clone `value` with infra-sensitive keys removed and strings scrubbed. */
export function sanitizePublic<T>(value: T, depth = 0): T {
  if (depth > 12) return value
  if (value === null || value === undefined) return value
  if (typeof value === "string") return scrubString(value) as unknown as T
  if (Array.isArray(value)) return value.map((v) => sanitizePublic(v, depth + 1)) as unknown as T
  if (typeof value === "object") {
    if (value instanceof Date) return value
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (DROP_KEYS.has(k.toLowerCase())) continue
      if (k.startsWith("_routing")) continue
      out[k] = sanitizePublic(v, depth + 1)
    }
    return out as T
  }
  return value
}

/** True if the provider's last heartbeat is older than the staleness window (5 min). */
export function isStale(p: { last_heartbeat?: string | null } | null | undefined, nowMs = Date.now()): boolean {
  const hb = p?.last_heartbeat
  if (!hb) return true
  const t = new Date(hb).getTime()
  if (!Number.isFinite(t)) return true
  return nowMs - t > PROVIDER_ECONOMICS.staleAfterSec * 1000
}

/** Public status: stale providers are always reported as "offline". */
export function publicStatus<P extends { status?: string; last_heartbeat?: string | null }>(p: P): string {
  if (isStale(p)) return "offline"
  return String(p.status ?? "offline")
}

/** True if provider should be counted as online/active in public stats. */
export function isPubliclyOnline(p: {
  status?: string
  last_heartbeat?: string | null
  verification?: { status?: string } | null
}): boolean {
  if (isStale(p)) return false
  return p.verification?.status === "verified" || p.status === "serving" || p.status === "online"
}

/** Sanitize a provider object for public output (strip infra + apply staleness). */
export function sanitizeProvider<P extends Record<string, any>>(p: P): Record<string, any> {
  const stale = isStale(p)
  const clean = sanitizePublic(p) as Record<string, any>
  if (stale) {
    clean.status = "offline"
    clean.stale = true
  }
  // vllm_model / current_model may be a local filesystem path → hide
  for (const k of ["vllm_model", "current_model"]) {
    if (typeof clean[k] === "string" && (clean[k].startsWith("/") || clean[k].includes("[path]"))) clean[k] = "custom"
  }
  if (Array.isArray(clean.models)) {
    clean.models = clean.models.map((m: unknown) => (typeof m === "string" && (m.startsWith("/") || m.includes("[path]")) ? "custom" : m))
  }
  return clean
}
