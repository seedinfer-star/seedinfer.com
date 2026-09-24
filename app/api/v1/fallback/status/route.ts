import { NextResponse } from "next/server"
import { sanitizePublic, publicStatus, isStale } from "@/lib/public-sanitize"
import { getUpstreamConfigs, getUpstreamForStatus, getModalWarmupStatus } from "@/lib/fallback-clients"
import { getAllStatuses, getStats, resetCircuit } from "@/lib/fallback-state"
import { listProviders } from "@/lib/providers-store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const reset = url.searchParams.get("reset") // ?reset=nim or ?reset=all
  if (reset) {
    // simple auth via header? For now allow reset if query present — lean
    if (reset === "all") resetCircuit()
    else if (["local", "nim", "opencode", "openrouter", "modal"].includes(reset)) {
      resetCircuit(reset as any)
    }
  }
  // debug forceZero flag
  let forceZero = false
  try {
    const g = globalThis as unknown as { __seedinferForceZero?: boolean }
    forceZero = !!g.__seedinferForceZero || process.env.SEEDINFER_FORCE_ZERO === "1" || process.env.FORCE_ZERO_STATS === "1"
  } catch {}

  const providers = listProviders()
  const verified = providers.filter((p) => p.verification.status === "verified" && !isStale(p))
  const pending = providers.filter((p) => p.verification.status === "pending")
  const failed = providers.filter((p) => p.verification.status === "failed")

  const upstreams = getUpstreamForStatus()
  const circuits = getAllStatuses()
  const stats = getStats()
  const modalWarmup = getModalWarmupStatus()

  // Local detail
  const localProvider = verified[0] || providers[0] || null
  const localDetail = localProvider
    ? {
        id: localProvider.id,
        verification: localProvider.verification.status,
        status: publicStatus(localProvider),
        last_heartbeat: localProvider.last_heartbeat,
        model: localProvider.current_model,
        vllm_health: (localProvider as any).vllm_health,
      }
    : null

  // Enrich upstreams with circuit
  const enriched = upstreams.map((u) => {
    const c = circuits[u.id as keyof typeof circuits]
    const configured = u.id === "local" ? verified.length > 0 || !!u.baseUrl : u.hasKey && !!u.baseUrl
    // Unhealthy if circuit open, not configured, or it has only ever failed (no successes yet).
    const onlyFailures = !!c && (c.successes ?? 0) === 0 && (c.fails ?? 0) + (c.consecutiveFails ?? 0) > 0
    return {
      ...u,
      circuit: c,
      healthy: !c?.open && configured && !onlyFailures,
    }
  })

  const body = {
    ok: true,
    timestamp: new Date().toISOString(),
    forceZero,
    zero: forceZero,
    seediNfer_forceZero_header: forceZero ? "1" : "0",
    local: {
      verified_count: verified.length,
      pending_count: pending.length,
      failed_count: failed.length,
      provider: localDetail,
      health: verified.length > 0 ? "healthy" : pending.length > 0 ? "pending" : "unavailable",
    },
    upstreams: enriched,
    circuits,
    stats,
    // Modal warmup: triggered in parallel when local fails (no verified node, timeout, 5xx or 429)
    modal_warmup: modalWarmup.state, // "triggered" | "idle"
    modal_warmup_detail: modalWarmup, // { state, lastWarmupAt }
    config: {
      order: ["local", "nim", "opencode", "openrouter", "modal"],
      description: "local fail → parallel warmup Modal (fire-and-forget) → sequential NIM→opencode→openrouter (30s) → await Modal (120s) if all fail",
      timeouts: {
        local: upstreams.find((u) => u.id === "local")?.timeoutMs,
        nim: upstreams.find((u) => u.id === "nim")?.timeoutMs,
        opencode: upstreams.find((u) => u.id === "opencode")?.timeoutMs,
        openrouter: upstreams.find((u) => u.id === "openrouter")?.timeoutMs,
        modal: upstreams.find((u) => u.id === "modal")?.timeoutMs,
      },
      models: Object.fromEntries(upstreams.map((u) => [u.id, u.model])),
    },
    hint: "X-SeedInfer-Upstream + X-SeedInfer-Fallback-Reason headers on /api/v1/chat/completions indicate which fallback served the request; modal_warmup shows parallel warmup state",
  }

  return NextResponse.json(sanitizePublic(body), {
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/json",
      "X-SeedInfer-ForceZero": forceZero ? "1" : "0",
      "X-SeedInfer-Zero": forceZero ? "1" : "0",
      ...CORS_HEADERS,
    },
  })
}

export async function POST(req: Request) {
  // Allow POST reset via body {reset: "nim"|"all"}
  let body: any = {}
  try {
    body = await req.json()
  } catch {}
  const target = body.reset || new URL(req.url).searchParams.get("reset")
  if (target) {
    if (target === "all") resetCircuit()
    else if (["local", "nim", "opencode", "openrouter", "modal"].includes(target)) resetCircuit(target as any)
    return NextResponse.json({ ok: true, reset: target }, { headers: CORS_HEADERS })
  }
  return GET(req)
}
