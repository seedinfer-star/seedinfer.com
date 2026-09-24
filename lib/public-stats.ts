/**
 * lib/public-stats.ts — shared implementation for GET /api/stats and GET /api/v1/stats.
 *
 * - Model ids are normalized to the catalog (lib/catalog.ts); hidden routing
 *   aliases (e.g. gpt-oss-20b) are never shown.
 * - Providers whose last heartbeat is older than 5 minutes are reported as
 *   "offline" and are not counted as active.
 * - All provider objects are sanitized (no IPs, agent URLs, hostnames, paths).
 */

import { NextResponse } from "next/server"
import { listProviders } from "@/lib/providers-store"
import { listTelemetry } from "@/lib/telemetry-store"
import { LIVE_MODEL, GPU_SPECS } from "@/lib/catalog"
import { publicModelId, normalizeStats } from "@/lib/stats-normalize"
import { isPubliclyOnline, sanitizePublic, sanitizeProvider } from "@/lib/public-sanitize"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export function statsOptions() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

function liveOnlyFromRequest(request: Request): boolean {
  try {
    const url = new URL(request.url)
    const v = url.searchParams.get("live") ?? url.searchParams.get("faza0")
    if (v === "1" || v === "true") return true
    if (v === "0" || v === "false") return false
  } catch {}
  const env = process.env.NEXT_PUBLIC_LIVE_ONLY ?? process.env.NEXT_PUBLIC_FAZA0_ENABLED
  return env === "true" || env === "1"
}

function shouldForceZero(request: Request): boolean {
  try {
    const url = new URL(request.url)
    const fz = url.searchParams.get("forceZero")
    const zero = url.searchParams.get("zero")
    const clear = url.searchParams.get("clear")
    if (fz === "0" || fz === "false" || zero === "0" || zero === "false") return false
    if (fz === "1" || fz === "true" || zero === "1" || zero === "true" || clear === "1" || clear === "true") return true
  } catch {}
  try {
    const g = globalThis as unknown as { __seedinferForceZero?: boolean }
    if (g.__seedinferForceZero) return true
  } catch {}
  if (process.env.SEEDINFER_FORCE_ZERO === "1" || process.env.FORCE_ZERO_STATS === "1") return true
  return false
}

export function zeroStats(): any {
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
    models: [{ id: LIVE_MODEL.id, providers: 0 }],
    network_capacity_tps: 0,
    network_utilization: {
      utilization: 0,
      warm_utilization: 0,
      token_budget_utilization: 0,
      bottleneck_utilization: 0,
      bottleneck_model: LIVE_MODEL.id,
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
  }
}

/** Approximate TDP of a provider's GPU from the catalog (falls back to RTX 5090 reference). */
function providerTdpW(p: any): number {
  const chip = String(p?.chip || "").toLowerCase()
  const key = chip.includes("h100")
    ? "h100"
    : chip.includes("a100")
      ? "a100"
      : chip.includes("l40s")
        ? "2xl40s"
        : chip.includes("6000")
          ? "rtx6000ada"
          : "rtx5090"
  const count = Math.max(1, Number(p?.gpu?.count) || 1)
  const spec = GPU_SPECS.find((g) => g.key === key)!
  return key === "2xl40s" ? spec.tdpW : spec.tdpW * count
}

export function buildLocalStats(): any {
  const providers = listProviders()
  const online = providers.filter((p) => isPubliclyOnline(p))
  const sum = (arr: any[], f: (p: any) => number) => arr.reduce((s, p) => s + (Number(f(p)) || 0), 0)

  const totalRequests = sum(providers, (p) => p.requests_served || p.totalRequests || 0)
  const totalTokens = sum(providers, (p) => p.tokens_generated || 0)
  const activeRequests = sum(online, (p) => p.concurrentRequests || 0)

  const modelsMap = new Map<string, number>()
  online.forEach((p) => {
    const m = publicModelId(p.current_model) || LIVE_MODEL.id
    modelsMap.set(m, (modelsMap.get(m) || 0) + 1)
  })
  const modelsList = Array.from(modelsMap.entries()).map(([id, count]) => ({ id, providers: count }))
  if (modelsList.length === 0) modelsList.push({ id: LIVE_MODEL.id, providers: 0 })

  const nowMs = Date.now()
  const events = listTelemetry({ since: new Date(nowMs - 30 * 60_000).toISOString() })
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

  const regions = Array.from(new Set(online.map((p) => p.region || "eu-central")))

  return {
    active_power_watts: sum(online, providerTdpW),
    active_providers: online.length,
    avg_tokens_per_request: totalRequests > 0 ? Math.round(totalTokens / totalRequests) : 0,
    code_attestation_enforced: false,
    code_attested_providers: online.length,
    last_24h_completion_tokens: Math.round(totalTokens * 0.7),
    last_24h_prompt_tokens: Math.round(totalTokens * 0.3),
    last_24h_requests: totalRequests,
    last_24h_total_tokens: totalTokens,
    models: modelsList,
    network_capacity_tps: online.length * 128.5,
    network_utilization: {
      utilization: online.length > 0 ? Math.min(100, Math.round((activeRequests / (online.length * 8)) * 100)) : 0,
      warm_utilization: online.length > 0 ? 100 : 0,
      token_budget_utilization: 0,
      bottleneck_utilization: 0,
      bottleneck_model: LIVE_MODEL.id,
      capacity_tps: online.length * 128.5,
      active_requests: activeRequests,
      queued_requests: 0,
    },
    provider_locations: regions,
    provider_regions: regions,
    // Hardware totals only count nodes that are currently online
    providers: providers.map((p) => sanitizeProvider(p)),
    time_series: timeSeries,
    total_bandwidth_gbs: sum(online, (p) => p.memory_bandwidth_gbs || 0),
    total_completion_tokens: Math.round(totalTokens * 0.7),
    total_cpu_cores: sum(online, (p) => (p.cpu_cores as any)?.total || 0),
    total_gpu_cores: sum(online, (p) => p.gpu_cores || 0),
    total_memory_gb: sum(online, (p) => p.memory_gb || 0),
    total_prompt_tokens: Math.round(totalTokens * 0.3),
    total_requests: totalRequests,
    total_tokens: totalTokens,
    unknown_location_providers: 0,
    _seedinfer_local: true,
  }
}

const NO_STORE = {
  "Cache-Control": "no-store, max-age=0",
  "CDN-Cache-Control": "no-store",
  "Cloudflare-CDN-Cache-Control": "no-store",
}

export async function statsGet(request: Request, tag = "api/stats") {
  const liveOnly = liveOnlyFromRequest(request)
  const modeHeader = { "X-SeedInfer-Models": liveOnly ? "live-only" : "all" }

  if (shouldForceZero(request)) {
    return NextResponse.json(zeroStats(), {
      headers: { ...NO_STORE, ...modeHeader, "X-SeedInfer-Zero": "1", ...CORS_HEADERS },
    })
  }

  // 1. Local provider registry
  if (listProviders().length > 0) {
    const payload = normalizeStats(buildLocalStats(), liveOnly)
    return NextResponse.json(sanitizePublic(payload), {
      headers: { ...NO_STORE, ...modeHeader, "X-SeedInfer-LocalStore": "1", ...CORS_HEADERS },
    })
  }

  // 2. Optional custom upstream (explicitly configured only)
  const customUpstream = process.env.SEEDINFER_STATS_UPSTREAM || process.env.STATS_UPSTREAM_URL
  if (customUpstream && !customUpstream.includes("darkbloom") && !customUpstream.includes("api.seedinfer.com")) {
    try {
      const r = await fetch(customUpstream, { next: { revalidate: 15 } as any } as any)
      if (r.ok) {
        const data = await r.json()
        if (Array.isArray(data?.providers)) data.providers = data.providers.map((p: any) => sanitizeProvider(p))
        const payload = normalizeStats(data, liveOnly)
        return NextResponse.json(sanitizePublic(payload), { headers: { ...NO_STORE, ...modeHeader, ...CORS_HEADERS } })
      }
    } catch (e: any) {
      console.warn(`[${tag}] custom upstream failed: ${e?.message}`)
    }
  }

  // 3. Clean zero state
  return NextResponse.json(zeroStats(), {
    headers: { ...NO_STORE, ...modeHeader, "X-SeedInfer-Zero": "1", ...CORS_HEADERS },
  })
}
