import { NextResponse } from "next/server"
import { sanitizePublic, sanitizeProvider } from "@/lib/public-sanitize"
import { verifyProvider, getProvider } from "@/lib/providers-store"
import { getProviderStat } from "@/lib/routing/selector"
import { getProviderCircuitState } from "@/lib/fallback-state"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { checkVerifyAuth } from "@/lib/verify-auth"

export const dynamic = "force-dynamic"

const NO_STORE = { "Cache-Control": "no-store, max-age=0" }

/**
 * POST /api/v1/providers/verify
 * Body: { provider_id: string, timeoutMs?: number }
 * (any request-supplied agent_url/URL is ALWAYS ignored — probes use only
 * the stored node data, so callers cannot steer probes at arbitrary hosts.)
 *
 * Auth: a valid node token (`Authorization: Bearer sipn_…`) whose user owns
 * the requested provider_id per provider_nodes, OR admin via checkAdmin.
 *
 * Gateway runs health checks:
 *  fetch http://<tailscale_ip>:47901/health oraz test POST <provider>/v1/chat/completions
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
  // NOTE: agent_url / URL from the request is deliberately ignored (SSRF).
  // Probing uses only the stored node data (tailscale_ip / agent_url on record).
  const timeoutMs = body.timeoutMs ? Number(body.timeoutMs) : undefined

  if (!provider_id) {
    return NextResponse.json(
      { error: { message: "Missing provider_id", type: "invalid_request_error", code: "missing_provider_id" }, hint: "POST {provider_id}" },
      { status: 400, headers: NO_STORE }
    )
  }

  const nodeId = String(provider_id)

  // Rate limits: 10/min per client IP, plus 1 per 30 s per node id (probes are expensive).
  const byIp = checkRateLimit(`verify:ip:${getClientIp(req)}`, 10, 60_000)
  if (!byIp.ok) {
    return NextResponse.json(
      { ok: false, error: "Rate limited — slow down and retry.", code: "rate_limited" },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(byIp.retryAfterSec) } }
    )
  }
  const byNode = checkRateLimit(`verify:node:${nodeId}`, 1, 30_000)
  if (!byNode.ok) {
    return NextResponse.json(
      { ok: false, error: "Rate limited — slow down and retry.", code: "rate_limited" },
      { status: 429, headers: { ...NO_STORE, "Retry-After": String(byNode.retryAfterSec) } }
    )
  }

  // Auth: owner node token OR admin. (After rate limits so probes stay throttled
  // even for unauthenticated callers; before the existence check so anonymous
  // callers cannot probe which node ids exist.)
  const auth = checkVerifyAuth(req, nodeId)
  if (!auth.ok) return auth.response

  const existing = getProvider(nodeId)
  if (!existing) {
    return NextResponse.json(
      { ok: false, error: `Provider ${provider_id} not found — awaiting heartbeat`, code: "provider_not_found" },
      { status: 404, headers: NO_STORE }
    )
  }

  console.log(`[verify-route] manual verify request for ${provider_id} via=${auth.via} timeout=${timeoutMs || 30000}`)

  try {
    const result = await verifyProvider(String(provider_id), { timeoutMs: timeoutMs || 30000 })
    // TTFT probe already measured and saved via verifyProvider (EWMA + circuit). Expose routing stats + Server-Timing
    const routingStat = getProviderStat(String(provider_id))
    const circuit = getProviderCircuitState(String(provider_id))
    const ttft = routingStat?.ewmaTtft ?? (result.provider as any).ewmaTtft ?? (result.provider.verification as any).latencyMs ?? null
    const ttftHeader = ttft !== null ? String(Math.round(ttft)) : "unknown"
    return NextResponse.json(
      {
        ok: true,
        provider_id: result.provider.id,
        verification: sanitizePublic(result.provider.verification),
        passed: result.passed,
        checks: sanitizePublic(result.checks),
        provider: sanitizeProvider(result.provider),
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
      { status: 500, headers: NO_STORE }
    )
  }
}

export async function GET() {
  // Usage message only — no probe, no state change, no auth required.
  return NextResponse.json(
    {
      message: "Use POST /api/v1/providers/verify {provider_id}",
      example: { provider_id: "provider-5090-xxx" },
      auth: "Authorization: Bearer $SEEDINFER_NODE_TOKEN (node owner) or admin token",
      hint: "Gateway runs health checks against the stored node data: GET /health oraz POST /v1/chat/completions {model:'google/gemma-4-26b-a4b-nvfp4',messages:[{role:'user',content:'ping'}],max_tokens:5}",
    },
    { headers: NO_STORE }
  )
}
