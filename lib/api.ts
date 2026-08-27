import type { StatsResponse, Provider } from "./types"

// SeedInfer Network Statistics — frontend only talks to our own /api/stats proxy.
// Direct upstream URL is handled server-side (with hidden legacy fallback), never exposed in client UI.
let cache: { data: StatsResponse | null; ts: number; faza0: boolean | null } = { data: null, ts: 0, faza0: null }
const TTL_MS = 15_000

const FAZA0_ID = "seedinfer/nemotron-lightning-1m"

function isFaza0Model(id: string): boolean {
  if (!id) return false
  const lower = id.toLowerCase()
  return lower.includes("nemotron") || lower.includes("gpt-oss") || id === FAZA0_ID
}

function isFaza0Enabled(): boolean {
  if (typeof window !== "undefined") {
    try {
      const sp = new URLSearchParams(window.location.search)
      const v = sp.get("faza0")
      if (v === "1" || v === "true") return true
      if (v === "0" || v === "false") return false
    } catch {}
  }
  const env = process.env.NEXT_PUBLIC_FAZA0_ENABLED
  return env === "true" || env === "1"
}

function filterToFaza0(data: StatsResponse): StatsResponse {
  if (!data || typeof data !== "object") return data
  try {
    if (Array.isArray((data as any).models)) {
      const models = (data as any).models as Array<{ id: string; providers: number }>
      const faza0 = models.filter((m) => isFaza0Model(m.id))
      if (faza0.length === 0 && models.length > 0) {
        ;(data as any).models = [{ id: FAZA0_ID, providers: (data as any).active_providers ?? 0 }]
      } else if (faza0.length > 0) {
        const mergedProviders = faza0.reduce((sum, m) => sum + (Number(m.providers) || 0), 0)
        const hasCanonical = faza0.some((m) => m.id === FAZA0_ID)
        if (hasCanonical) {
          const canonical = faza0.find((m) => m.id === FAZA0_ID)!
          const aliasSum = faza0.filter((m) => m.id !== FAZA0_ID).reduce((s, m) => s + (Number(m.providers) || 0), 0)
          ;(data as any).models = [{ id: FAZA0_ID, providers: (Number(canonical.providers) || 0) + aliasSum }]
        } else {
          ;(data as any).models = [{ id: FAZA0_ID, providers: mergedProviders }]
        }
      }
    }
    if ((data as any).network_utilization?.bottleneck_model && !isFaza0Model((data as any).network_utilization.bottleneck_model)) {
      ;(data as any).network_utilization.bottleneck_model = FAZA0_ID
    }
    if (Array.isArray((data as any).providers)) {
      ;(data as any).providers = (data as any).providers.map((p: any) => {
        if (!p || typeof p !== "object") return p
        if (Array.isArray(p.models) && p.models.length > 0) p.models = [FAZA0_ID]
        if (typeof p.current_model === "string" && p.current_model !== "" && !isFaza0Model(p.current_model)) {
          p.current_model = FAZA0_ID
        } else if (typeof p.current_model === "string" && p.current_model.toLowerCase().includes("gpt-oss")) {
          p.current_model = FAZA0_ID
        }
        return p
      })
    }
  } catch {}
  return data
}

function maybeFilter(data: StatsResponse): StatsResponse {
  return isFaza0Enabled() ? filterToFaza0(data) : data
}

export async function fetchStats(force = false): Promise<StatsResponse> {
  const now = Date.now()
  const faza0 = isFaza0Enabled()
  if (!force && cache.data && now - cache.ts < TTL_MS && cache.faza0 === faza0) return cache.data

  let own: string | null = null
  if (typeof window !== "undefined") {
    try {
      const sp = new URLSearchParams(window.location.search)
      own = sp.get("faza0") === "1" ? "/api/stats?faza0=1" : "/api/stats"
      if (sp.get("faza0") === "0") own = "/api/stats?faza0=0"
    } catch {
      own = "/api/stats"
    }
  }
  const candidates = own ? [own] : ["/api/stats"]

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
        const out = maybeFilter(j)
        cache = { data: out, ts: now, faza0 }
        return out
      }
      lastError = `${url} -> invalid payload`
    } catch (e: any) {
      lastError = `${url} -> ${e?.message ?? String(e)}`
    }
  }
  // No mock fallback — throw with upstream details; caller must show error UI
  throw new Error(lastError ? `Failed to fetch stats: ${lastError}` : "Failed to fetch stats: SeedInfer Network Statistics unavailable. Retry after 15s.")
}

export function getMockStats(): StatsResponse {
  // No mock fallback per spec — return cached data if present, otherwise throw
  if (cache.data) return cache.data
  throw new Error("No stats available — SeedInfer Network Statistics unavailable, no mock fallback. Retry after 15s.")
}

// --- SeedInfer gateway providers (verified) ---

export type GatewayProvider = Provider & {
  verification?: { status: string; checks?: any[]; last_check?: string | null; failure_reason?: string; heartbeat_count?: number }
  tailscale_ip?: string | null
  agent_url?: string | null
  last_heartbeat?: string
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
