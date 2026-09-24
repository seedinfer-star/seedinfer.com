import { NextResponse } from "next/server"

export const revalidate = 15 // live 15s — SeedInfer Network Stats
export const dynamic = "force-dynamic"

// Primary upstream — SeedInfer Network Statistics (configurable via env).
// Legacy fallback is kept for backward compatibility but not exposed in UI or docs.
const UPSTREAM = process.env.SEEDINFER_STATS_UPSTREAM || process.env.STATS_UPSTREAM_URL || "https://api.seedinfer.com/v1/stats"
const FAZA0_ID = "seedinfer/nemotron-lightning-1m"

function isFaza0Model(id: string): boolean {
  if (!id) return false
  const lower = id.toLowerCase()
  return lower.includes("nemotron") || lower.includes("gpt-oss") || id === FAZA0_ID
}

function isFaza0EnabledFromRequest(request: Request): boolean {
  try {
    const url = new URL(request.url)
    const v = url.searchParams.get("faza0")
    if (v === "1" || v === "true") return true
    if (v === "0" || v === "false") return false
  } catch {}
  const env = process.env.NEXT_PUBLIC_FAZA0_ENABLED
  return env === "true" || env === "1"
}

function filterToFaza0(data: any): any {
  if (!data || typeof data !== "object") return data
  try {
    if (Array.isArray(data.models)) {
      const faza0 = data.models.filter((m: any) => isFaza0Model(m?.id))
      if (faza0.length === 0 && data.models.length > 0) {
        data.models = [{ id: FAZA0_ID, providers: data.active_providers ?? 0 }]
      } else if (faza0.length > 0) {
        const mergedProviders = faza0.reduce((sum: number, m: any) => sum + (Number(m.providers) || 0), 0)
        const hasCanonical = faza0.some((m: any) => m.id === FAZA0_ID)
        if (hasCanonical) {
          const canonical = faza0.find((m: any) => m.id === FAZA0_ID)
          const aliasSum = faza0.filter((m: any) => m.id !== FAZA0_ID).reduce((s: number, m: any) => s + (Number(m.providers) || 0), 0)
          data.models = [{ id: FAZA0_ID, providers: (Number(canonical.providers) || 0) + aliasSum }]
        } else {
          data.models = [{ id: FAZA0_ID, providers: mergedProviders }]
        }
      }
    }
    if (data.network_utilization && typeof data.network_utilization.bottleneck_model === "string") {
      if (!isFaza0Model(data.network_utilization.bottleneck_model)) {
        data.network_utilization.bottleneck_model = FAZA0_ID
      }
    }
    if (Array.isArray(data.providers)) {
      data.providers = data.providers.map((p: any) => {
        if (!p || typeof p !== "object") return p
        if (Array.isArray(p.models)) {
          if (p.models.length > 0) p.models = [FAZA0_ID]
        }
        if (typeof p.current_model === "string" && p.current_model !== "" && !isFaza0Model(p.current_model)) {
          p.current_model = FAZA0_ID
        } else if (typeof p.current_model === "string" && p.current_model !== "" && isFaza0Model(p.current_model)) {
          if (p.current_model.toLowerCase().includes("gpt-oss")) p.current_model = FAZA0_ID
        }
        return p
      })
    }
  } catch {}
  return data
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

function shouldForceZero(request: Request): boolean {
  // Explicit override ?forceZero=0 / ?zero=0 => force false even if global flag set (debug)
  try {
    const url = new URL(request.url)
    const fz = url.searchParams.get("forceZero")
    const zero = url.searchParams.get("zero")
    const clear = url.searchParams.get("clear")
    // Debug override: explicit 0/false disables zero regardless of global flag
    if (fz === "0" || fz === "false" || zero === "0" || zero === "false") return false
    if (fz === "1" || fz === "true" || zero === "1" || zero === "true" || clear === "1" || clear === "true") return true
  } catch {}
  // global flag set by POST /api/v1/providers/clear
  try {
    const g = globalThis as unknown as { __seedinferForceZero?: boolean }
    if (g.__seedinferForceZero) return true
  } catch {}
  if (process.env.SEEDINFER_FORCE_ZERO === "1" || process.env.FORCE_ZERO_STATS === "1") return true
  return false
}

function zeroStats(): any {
  const now = new Date().toISOString()
  return {
    active_power_watts: 0,
    active_providers: 0,
    avg_tokens_per_request: 0,
    code_attestation_enforced: false,
    code_attested_providers: 0,
    last_24h_completion_tokens: 0,
    last_24h_prompt_tokens: 0,
    last_24h_requests: 0,
    last_24h_total_tokens: 0,
    models: [{ id: FAZA0_ID, providers: 0 }],
    network_capacity_tps: 0,
    network_utilization: {
      utilization: 0,
      warm_utilization: 0,
      token_budget_utilization: 0,
      bottleneck_utilization: 0,
      bottleneck_model: FAZA0_ID,
      capacity_tps: 0,
      active_requests: 0,
      queued_requests: 0,
    },
    provider_locations: [],
    provider_regions: [],
    providers: [],
    time_series: Array.from({ length: 30 }, (_, i) => ({
      timestamp: new Date(Date.now() - (29 - i) * 60_000).toISOString(),
      requests: 0,
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    })),
    total_bandwidth_gbs: 0,
    total_completion_tokens: 0,
    total_cpu_cores: 0,
    total_gpu_cores: 0,
    total_memory_gb: 0,
    total_prompt_tokens: 0,
    total_requests: 0,
    total_tokens: 0,
    unknown_location_providers: 0,
    _seedinfer_zero: true,
    _seedinfer_forced_at: now,
  }
}

import { listProviders } from "@/lib/providers-store"
import { listTelemetry } from "@/lib/telemetry-store"

function buildLocalStats(): any {
  const providers = listProviders()
  const activeProviders = providers.filter((p) => p.verification?.status === "verified" || p.status === "serving" || p.status === "online")
  const totalGpuCores = providers.reduce((sum, p) => sum + (p.gpu_cores || 0), 0)
  const totalMemoryGb = providers.reduce((sum, p) => sum + (p.memory_gb || 0), 0)
  const totalCpuCores = providers.reduce((sum, p) => sum + ((p.cpu_cores as any)?.total || 0), 0)
  const totalBandwidthGbs = providers.reduce((sum, p) => sum + (p.memory_bandwidth_gbs || 0), 0)
  const totalRequests = providers.reduce((sum, p) => sum + (p.requests_served || p.totalRequests || 0), 0)
  const totalTokens = providers.reduce((sum, p) => sum + (p.tokens_generated || 0), 0)
  const activeRequests = providers.reduce((sum, p) => sum + (p.concurrentRequests || 0), 0)

  const modelsMap = new Map<string, number>()
  providers.forEach((p) => {
    const m = p.current_model || FAZA0_ID
    modelsMap.set(m, (modelsMap.get(m) || 0) + 1)
  })
  const modelsList = Array.from(modelsMap.entries()).map(([id, count]) => ({ id, providers: count }))
  if (modelsList.length === 0) {
    modelsList.push({ id: FAZA0_ID, providers: activeProviders.length })
  }

  // Build real 30-minute time series from telemetry events
  const nowMs = Date.now()
  const thirtyMinAgo = new Date(nowMs - 30 * 60_000).toISOString()
  const events = listTelemetry({ since: thirtyMinAgo })

  const timeSeries = Array.from({ length: 30 }, (_, i) => {
    const bucketStart = nowMs - (29 - i) * 60_000
    const bucketEnd = bucketStart + 60_000
    const bucketEvents = events.filter((e) => {
      const ts = new Date(e.timestamp).getTime()
      return ts >= bucketStart && ts < bucketEnd
    })
    const reqs = bucketEvents.reduce((s, e) => s + (e.requests || (e.upstream === "chat" ? 1 : 0)), 0)
    const toks = bucketEvents.reduce((s, e) => s + (e.tokens || 0), 0)
    return {
      timestamp: new Date(bucketStart).toISOString(),
      requests: reqs,
      prompt_tokens: Math.round(toks * 0.3),
      completion_tokens: Math.round(toks * 0.7),
      total_tokens: toks,
    }
  })

  return {
    active_power_watts: activeProviders.length * 450,
    active_providers: activeProviders.length,
    avg_tokens_per_request: totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0,
    code_attestation_enforced: false,
    code_attested_providers: activeProviders.length,
    last_24h_completion_tokens: Math.round(totalTokens * 0.7),
    last_24h_prompt_tokens: Math.round(totalTokens * 0.3),
    last_24h_requests: totalRequests,
    last_24h_total_tokens: totalTokens,
    models: modelsList,
    network_capacity_tps: activeProviders.length * 128.5,
    network_utilization: {
      utilization: activeProviders.length > 0 ? Math.min(100, Math.round((activeRequests / (activeProviders.length * 8)) * 100)) : 0,
      warm_utilization: activeProviders.length > 0 ? 100 : 0,
      token_budget_utilization: 0,
      bottleneck_utilization: 0,
      bottleneck_model: FAZA0_ID,
      capacity_tps: activeProviders.length * 128.5,
      active_requests: activeRequests,
      queued_requests: 0,
    },
    provider_locations: Array.from(new Set(providers.map((p) => p.region || "eu-central"))),
    provider_regions: Array.from(new Set(providers.map((p) => p.region || "eu-central"))),
    providers: providers,
    time_series: timeSeries,
    total_bandwidth_gbs: totalBandwidthGbs,
    total_completion_tokens: Math.round(totalTokens * 0.7),
    total_cpu_cores: totalCpuCores,
    total_gpu_cores: totalGpuCores,
    total_memory_gb: totalMemoryGb,
    total_prompt_tokens: Math.round(totalTokens * 0.3),
    total_requests: totalRequests,
    total_tokens: totalTokens,
    unknown_location_providers: 0,
    _seedinfer_local: true,
  }
}

export async function GET(request: Request) {
  const useFaza0 = isFaza0EnabledFromRequest(request)
  const forceZero = shouldForceZero(request)
  if (forceZero) {
    const payload = zeroStats()
    console.log(`[api/stats] forceZero=true -> zeroStats active_providers=0 url=${request.url}`)
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "CDN-Cache-Control": "no-store",
        "Cloudflare-CDN-Cache-Control": "no-store",
        "X-SeedInfer-Faza": useFaza0 ? "0-nemotron-only" : "parity",
        "X-SeedInfer-Zero": "1",
        "X-SeedInfer-ForceZero": "1",
        ...CORS_HEADERS,
      },
    })
  }

  // 1. If local providers exist in memory, serve live local stats
  const localProviders = listProviders()
  if (localProviders.length > 0) {
    const localStats = buildLocalStats()
    const payload = useFaza0 ? filterToFaza0(localStats) : localStats
    return NextResponse.json(payload, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "X-SeedInfer-Faza": useFaza0 ? "0-nemotron-only" : "parity",
        "X-SeedInfer-LocalStore": "1",
        ...CORS_HEADERS,
      },
    })
  }

  // 2. Only try custom upstream IF explicitly configured and NOT pointing to legacy darkbloom/api.seedinfer.com
  const customUpstream = process.env.SEEDINFER_STATS_UPSTREAM || process.env.STATS_UPSTREAM_URL
  if (customUpstream && !customUpstream.includes("darkbloom") && !customUpstream.includes("api.seedinfer.com")) {
    try {
      const r = await fetch(customUpstream, { next: { revalidate: 15 } as any } as any)
      if (r.ok) {
        const data = await r.json()
        const payload = useFaza0 ? filterToFaza0(data) : data
        return NextResponse.json(payload, {
          headers: {
            "Cache-Control": "no-store, max-age=0",
            "X-SeedInfer-Faza": useFaza0 ? "0-nemotron-only" : "parity",
            ...CORS_HEADERS,
          },
        })
      }
    } catch (e: any) {
      console.warn(`[api/stats] Custom upstream ${customUpstream} failed: ${e?.message}`)
    }
  }

  // 3. Clean Zero State: When 0 local nodes are connected, return zeroStats() (0 nodes, 0 tokens, 0 GPUs)
  const payload = zeroStats()
  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Cloudflare-CDN-Cache-Control": "no-store",
      "X-SeedInfer-Faza": useFaza0 ? "0-nemotron-only" : "parity",
      "X-SeedInfer-Zero": "1",
      ...CORS_HEADERS,
    },
  })
}
