import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { appendTelemetry, getTelemetryStats } from "@/lib/telemetry-store"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

/**
 * Ingest is authenticated: events feed the public network statistics, so anonymous writes would let
 * anyone inflate them. Set TELEMETRY_INGEST_TOKEN and send `Authorization: Bearer <token>`.
 * No provider agent uses this endpoint today (nodes report via /api/v1/providers/heartbeat).
 */
function authorized(req: Request): boolean {
  const expected = (process.env.TELEMETRY_INGEST_TOKEN || "").trim()
  if (expected.length < 16) return false
  const got = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim()
  const a = Buffer.from(got)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export async function POST(req: Request) {
  if (!authorized(req)) {
    return NextResponse.json(
      { error: { message: "Telemetry ingest requires a valid bearer token", type: "authentication_error" } },
      { status: 401, headers: CORS_HEADERS }
    )
  }
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON", type: "invalid_request_error" } }, { status: 400, headers: CORS_HEADERS })
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: { message: "Missing body", type: "invalid_request_error" } }, { status: 400, headers: CORS_HEADERS })
  }
  // support single or batch
  const events = Array.isArray(body) ? body : Array.isArray(body.events) ? body.events : [body]
  let appended = 0
  for (const ev of events) {
    if (!ev || typeof ev !== "object") continue
    if (!ev.provider_id && !ev.providerId && !ev.id) continue
    appendTelemetry({
      timestamp: ev.timestamp || new Date().toISOString(),
      provider_id: String(ev.provider_id || ev.providerId || ev.id),
      gpu: ev.gpu ?? ev.chip ?? null,
      requests: ev.requests ?? ev.requests_served ?? 0,
      tokens: ev.tokens ?? ev.tokens_generated ?? 0,
      latency: ev.latency ?? ev.latencyMs ?? undefined,
      // "heartbeat" is reserved for /api/v1/providers/heartbeat — network stats are derived from it.
      upstream: ev.upstream && ev.upstream !== "heartbeat" ? String(ev.upstream) : "ingest",
      fallback_chain: ev.fallback_chain ?? null,
      ttft: ev.ttft ?? null,
      rpm: ev.rpm ?? null,
      verified: ev.verified ?? null,
      agent_url: ev.agent_url ?? null,
      tailscale_ip: ev.tailscale_ip ?? null,
      vllm_model: ev.vllm_model ?? ev.current_model ?? null,
      region: ev.region ?? null,
      raw: ev.raw || ev,
    })
    appended++
  }

  const stats = getTelemetryStats()
  return NextResponse.json({ ok: true, appended, total: stats.count, pending: stats.pending }, { headers: { "Cache-Control": "no-store, max-age=0", ...CORS_HEADERS } })
}

export async function GET() {
  return NextResponse.json({ message: "Use POST /api/v1/telemetry/ingest {provider_id, gpu, requests, tokens, latency, upstream, fallback_chain, ttft, rpm, verified}" }, { headers: CORS_HEADERS })
}
