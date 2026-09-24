import { NextResponse } from "next/server"
import { verifyProvider, getProvider } from "@/lib/providers-store"
import { getProviderStat } from "@/lib/routing/selector"
import { getProviderCircuitState } from "@/lib/fallback-state"

export const dynamic = "force-dynamic"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

/**
 * POST /api/v1/providers/verify
 * Body: { provider_id: string, agent_url?: string, timeoutMs?: number }
 * lub query ?provider_id=xxx&agent_url=http://...
 * Gateway wykonuje health check:
 *  fetch http://<tailscale_ip>:3001/health oraz test POST <provider>/v1/chat/completions
 *  Checks 6 conditions, 30s timeout, logs.
 * If pass -> verified & serving else failed.
 * Called automatically after 2 pending heartbeats (non-blocking) or manually.
 */
export async function POST(req: Request) {
  let body: any = {}
  try {
    const text = await req.text()
    if (text) body = JSON.parse(text)
  } catch {
    // ignore
  }
  const url = new URL(req.url)
  const provider_id = body.provider_id || body.id || body.providerId || url.searchParams.get("provider_id") || url.searchParams.get("id")
  const agent_url = body.agent_url || url.searchParams.get("agent_url") || undefined
  const timeoutMs = body.timeoutMs ? Number(body.timeoutMs) : undefined

  if (!provider_id) {
    return NextResponse.json(
      { error: { message: "Missing provider_id", type: "invalid_request_error", code: "missing_provider_id" }, hint: "POST {provider_id, agent_url?}" },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  const existing = getProvider(String(provider_id))
  if (!existing) {
    return NextResponse.json(
      { error: { message: `Provider ${provider_id} not found — awaiting heartbeat`, type: "not_found", code: "provider_not_found" } },
      { status: 404, headers: CORS_HEADERS }
    )
  }

  console.log(`[verify-route] manual verify request for ${provider_id} agent_url=${agent_url || "(store candidates)"} timeout=${timeoutMs || 30000}`)

  try {
    const result = await verifyProvider(String(provider_id), { agent_url, timeoutMs: timeoutMs || 30000 })
    // TTFT probe already measured and saved via verifyProvider (EWMA + circuit). Expose routing stats + Server-Timing
    const routingStat = getProviderStat(String(provider_id))
    const circuit = getProviderCircuitState(String(provider_id))
    const ttft = routingStat?.ewmaTtft ?? (result.provider as any).ewmaTtft ?? (result.provider.verification as any).latencyMs ?? null
    const ttftHeader = ttft !== null ? String(Math.round(ttft)) : "unknown"
    return NextResponse.json(
      {
        ok: true,
        provider_id: result.provider.id,
        verification: result.provider.verification,
        passed: result.passed,
        checks: result.checks,
        provider: result.provider,
        routing: routingStat,
        circuit,
        ttft_probe_ms: ttft,
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "Server-Timing": ttft !== null ? `ttft;dur=${Math.round(ttft)}` : "ttft;dur=0",
          "X-SeedInfer-TTFT": ttftHeader,
          "X-SeedInfer-Provider": String(provider_id),
          ...CORS_HEADERS,
        },
      }
    )
  } catch (e: any) {
    console.error(`[verify-route] verify ${provider_id} error:`, e)
    return NextResponse.json(
      {
        error: {
          message: e?.message || String(e),
          type: "verification_error",
          code: "verify_failed",
        },
        provider_id,
      },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}

export async function GET(req: Request) {
  // Allow GET for convenience: /api/v1/providers/verify?provider_id=xxx
  const url = new URL(req.url)
  const provider_id = url.searchParams.get("provider_id") || url.searchParams.get("id")
  if (provider_id) {
    // proxy to POST logic
    const fakeReq = new Request(req.url, { method: "POST", headers: req.headers } as any)
    // inject body via cloning? Instead just call same logic via POST handler style:
    // Reuse POST by constructing new Request with body
    const body = { provider_id, agent_url: url.searchParams.get("agent_url") || undefined }
    const newReq = new Request(req.url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
    return POST(newReq)
  }
  return NextResponse.json(
    {
      message: "Use POST /api/v1/providers/verify {provider_id, agent_url?}",
      example: { provider_id: "provider-5090-xxx", agent_url: "http://100.64.0.10:3001" },
      hint: "Gateway wykonuje health check na providerze: GET /health oraz POST /v1/chat/completions {model:'seedinfer/nemotron-lightning-1m',messages:[{role:'user',content:'ping'}],max_tokens:5}",
    },
    { headers: CORS_HEADERS }
  )
}
