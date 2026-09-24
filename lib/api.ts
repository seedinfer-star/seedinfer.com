import type { StatsResponse, Provider } from "./types"
import { normalizeStats } from "./stats-normalize"

// SeedInfer Network Statistics — frontend only talks to our own /api/stats proxy.
// Direct upstream URL is handled server-side (with hidden legacy fallback), never exposed in client UI.
let cache: { data: StatsResponse | null; ts: number; liveOnly: boolean | null } = { data: null, ts: 0, liveOnly: null }
const TTL_MS = 15_000

/** "?live=1" (or legacy "?faza0=1") limits the stats payload to live catalog models. */
function liveOnlyParam(): string | null {
  if (typeof window === "undefined") return null
  try {
    const sp = new URLSearchParams(window.location.search)
    return sp.get("live") ?? sp.get("faza0")
  } catch {
    return null
  }
}

function isLiveOnly(): boolean {
  const v = liveOnlyParam()
  if (v === "1" || v === "true") return true
  if (v === "0" || v === "false") return false
  const env = process.env.NEXT_PUBLIC_LIVE_ONLY ?? process.env.NEXT_PUBLIC_FAZA0_ENABLED
  return env === "true" || env === "1"
}

export async function fetchStats(force = false): Promise<StatsResponse> {
  const now = Date.now()
  const liveOnly = isLiveOnly()
  if (!force && cache.data && now - cache.ts < TTL_MS && cache.liveOnly === liveOnly) return cache.data

  const candidates = [liveOnly ? "/api/stats?live=1" : "/api/stats"]

  let lastError: string | null = null
  for (const url of candidates) {
    try {
      const r = await fetch(url, { next: { revalidate: 15 } as any, cache: "no-store" } as any)
      if (!r.ok) {
        let body: any = null
        try { body = await r.json() } catch {}
        const msg = body?.error?.message ?? body?.error ?? `HTTP ${r.status}`
        lastError = `${url} -> ${msg}`
        continue
      }
      const j = (await r.json()) as StatsResponse
      if (j && (j as any).total_tokens != null) {
        const out = normalizeStats(j, liveOnly) as StatsResponse
        cache = { data: out, ts: now, liveOnly }
        return out
      }
      lastError = `${url} -> invalid payload`
    } catch (e: any) {
      lastError = `${url} -> ${e?.message ?? String(e)}`
    }
  }
  // Caller must show error UI
  throw new Error(lastError ? `Network statistics unavailable (${lastError}). Retrying shortly.` : "Network statistics unavailable. Retrying shortly.")
}

export function getCachedStats(): StatsResponse {
  // Return cached data if present, otherwise throw
  if (cache.data) return cache.data
  throw new Error("Network statistics unavailable. Retrying shortly.")
}

// --- SeedInfer gateway providers (verified) ---

export type GatewayProvider = Provider & {
  verification?: { status: string; checks?: any[]; last_check?: string | null; failure_reason?: string; heartbeat_count?: number }
  last_heartbeat?: string
  stale?: boolean
}

export type GatewayProvidersResponse = {
  object: "list"
  data: GatewayProvider[]
  count: number
  verified: number
  pending: number
  verifying: number
  failed: number
}

let providersCache: { data: GatewayProvider[] | null; ts: number } = { data: null, ts: 0 }
const PROVIDERS_TTL_MS = 5000

export async function fetchGatewayProviders(force = false): Promise<GatewayProvider[]> {
  const now = Date.now()
  if (!force && providersCache.data && now - providersCache.ts < PROVIDERS_TTL_MS) return providersCache.data
  try {
    const r = await fetch("/api/v1/providers", { cache: "no-store" } as any)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const j = (await r.json()) as GatewayProvidersResponse
    const data = Array.isArray(j.data) ? j.data : []
    providersCache = { data, ts: now }
    return data
  } catch (e: any) {
    // fallback to cached or empty
    if (providersCache.data) return providersCache.data
    throw e
  }
}

export async function fetchProvidersMerged(force = false): Promise<GatewayProvider[]> {
  // Try gateway providers first (real local fleet); if empty, fallback to network stats providers
  // Network stats providers are from /api/stats (SeedInfer Network), gateway is local SeedInfer nodes
  // For UI fleet we prefer gateway but show both merged if needed
  try {
    const gateway = await fetchGatewayProviders(force)
    if (gateway.length > 0) return gateway
  } catch {
    // ignore
  }
  // fallback: stats
  try {
    const stats = await fetchStats(force)
    return (stats.providers as GatewayProvider[]) || []
  } catch {
    return providersCache.data || []
  }
}
