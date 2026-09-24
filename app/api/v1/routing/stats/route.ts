import { NextResponse } from "next/server"
import { listProviders } from "@/lib/providers-store"
import { getAllRoutingStats } from "@/lib/routing/selector"
import { getAllStatuses, getAllProviderStatuses, getStats as getFallbackStats } from "@/lib/fallback-state"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

/**
 * GET /api/v1/routing/stats
 * Zwraca per-provider routing stats (EWMA, weight, concurrent, circuit) do monitoringu
 * Query: ?provider_id=xxx filtr pojedynczego
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const providerId = url.searchParams.get("provider_id") || url.searchParams.get("id") || undefined

  const providers = listProviders()
  const routingStats = getAllRoutingStats()
  const circuits = getAllStatuses()
  const providerCircuits = getAllProviderStatuses()
  const fallbackStats = getFallbackStats()

  // map per provider
  const perProvider = providers.map((p) => {
    const rs = routingStats[p.id] || null
    const pc = providerCircuits[p.id] || circuits[p.id] || null
    // also from provider denormalized fields fallback
    const ewmaTtft = rs?.ewmaTtft ?? (p as any).ewmaTtft ?? null
    const ewmaLatency = rs?.ewmaLatency ?? (p as any).ewmaLatency ?? null
    const concurrent = rs?.concurrentRequests ?? (p as any).concurrentRequests ?? 0
    const total = rs?.totalRequests ?? (p as any).totalRequests ?? 0
    const success = rs?.successCount ?? (p as any).successCount ?? 0
    const weight = rs?.weight ?? (p as any)._routingWeight ?? 0
    const currentWeight = rs?.currentWeight ?? (p as any)._routingCurrentWeight ?? 0
    return {
      id: p.id,
      verification: p.verification.status,
      tailscale_ip: p.tailscale_ip,
      agent_url: p.agent_url,
      last_heartbeat: p.last_heartbeat,
      heartbeat_count: p.heartbeat_count,
      status: p.status,
      // routing metrics
      ewmaTtft,
      ewmaLatency,
      concurrentRequests: concurrent,
      totalRequests: total,
      successCount: success,
      successRate: total > 0 ? Math.round((success / total) * 1000) / 1000 : 1,
      weight,
      currentWeight,
      circuit: pc ? { open: pc.open, cooldownRemainingMs: (pc as any).cooldownRemainingMs ?? 0, fails: pc.fails, consecutiveFails: pc.consecutiveFails, lastError: pc.lastError } : null,
      circuitOpen: pc?.open ?? false,
      lastUpdate: rs?.lastUpdate ?? null,
    }
  })

  let filtered = perProvider
  if (providerId) filtered = perProvider.filter((p) => p.id === providerId)

  // global WRR pool info
  const verified = perProvider.filter((p) => p.verification === "verified")
  const sortedByWeight = [...verified].sort((a, b) => (b.weight || 0) - (a.weight || 0))
  const sortedByTtft = [...verified].sort((a, b) => {
    const at = a.ewmaTtft ?? 99999
    const bt = b.ewmaTtft ?? 99999
    return at - bt
  })

  const body = {
    ok: true,
    timestamp: new Date().toISOString(),
    summary: {
      total_providers: providers.length,
      verified: verified.length,
      total_weight: verified.reduce((acc, p) => acc + (p.weight || 0), 0),
      avg_ttft: verified.length ? Math.round(verified.reduce((acc, p) => acc + (p.ewmaTtft ?? 400), 0) / verified.length) : null,
    },
    providers: filtered,
    sorted_by_weight: sortedByWeight.map((p) => ({ id: p.id, weight: p.weight, ewmaTtft: p.ewmaTtft, concurrent: p.concurrentRequests })),
    sorted_by_ttft: sortedByTtft.map((p) => ({ id: p.id, ewmaTtft: p.ewmaTtft, weight: p.weight })),
    routing_stats: routingStats,
    circuits,
    provider_circuits: providerCircuits,
    fallback_stats: fallbackStats,
    config: {
      ewma_alpha: 0.2,
      base_ttft_ms: 400,
      ttft_threshold_ms: Number(process.env.ROUTING_TTFT_THRESHOLD_MS || 5000),
      concurrent_penalty: 0.5,
      fallback_chain: ["local (WRR EWMA)", "nim", "opencode", "openrouter", "modal"],
      description: "WRR weighted round robin: weight = (BASE_TTFT/EWMA_TTFT) * 1/(1+concurrent*0.5) * successRate; OpenRouter traffic ignor load, tylko TTFT",
    },
  }

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  })
}
