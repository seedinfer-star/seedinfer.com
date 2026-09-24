import { NextResponse } from "next/server"
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
  const verified = providers.filter((p) => p.verification.status === "verified")
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
        tailscale_ip: localProvider.tailscale_ip,
        agent_url: localProvider.agent_url,
        last_heartbeat: localProvider.last_heartbeat,
        vllm_model: (localProvider as any).vllm_model,
        vllm_health: (localProvider as any).vllm_health,
      }
    : null

  // Enrich upstreams with circuit
  const enriched = upstreams.map((u) => ({
    ...u,
    circuit: circuits[u.id as keyof typeof circuits],
    healthy: !circuits[u.id as keyof typeof circuits]?.open && (u.hasKey || u.id === "local"),
  }))

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
    // Modal warmup parallel: triggered gdy local fail (brak verified lub timeout/5xx/429) → fire-and-forget GET {MODAL_BASE_URL}/health lub /v1/models
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
      env_hint: {
        nim: "NIM_API_KEY or NVAPI_KEY (alias NVIDIA_API_KEY), NIM_BASE_URL, NIM_MODEL",
        opencode: "OPENCODE_API_KEY (alias OPENCODE_ZEN_KEY), OPENCODE_BASE_URL (default https://opencode.ai/zen/v1 gdy OPENCODE_ZEN_KEY lub https://opencode.ai/api/v1), OPENCODE_MODEL (default deepseek-v4-flash dla Zen, override nvidia/nemotron-3-nano-30b-a3b)",
        openrouter: "OPENROUTER_API_KEY, OPENROUTER_MODEL (default nvidia/nemotron-3-nano-30b-a3b:free)",
        modal: "MODAL_BASE_URL (required), MODAL_API_KEY, MODAL_MODEL, MODAL_TIMEOUT_MS, MODAL_WARMUP=true (default true, fire-and-forget GET /health lub /v1/models gdy local fail)",
        local: "VLLM_URL or verified provider tailscale_ip:3001",
        thresholds: "FALLBACK_LATENCY_THRESHOLD_MS, FALLBACK_FAIL_THRESHOLD, FALLBACK_COOLDOWN_MS",
      },
    },
    hint: "X-SeedInfer-Upstream + X-SeedInfer-Fallback-Reason headers on /api/v1/chat/completions indicate which fallback served the request; modal_warmup shows parallel warmup state",
  }

  return NextResponse.json(body, {
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
