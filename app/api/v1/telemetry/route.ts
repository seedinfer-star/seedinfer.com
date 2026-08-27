import { NextResponse } from "next/server"
import { listTelemetry, getTelemetryStats } from "@/lib/telemetry-store"

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

export async function GET(req: Request) {
  const url = new URL(req.url)
  const limit = Math.min(1000, Math.max(1, Number(url.searchParams.get("limit") || 100)))
  const provider_id = url.searchParams.get("provider_id") || undefined
  const since = url.searchParams.get("since") || undefined

  const data = listTelemetry({ limit, provider_id, since })
  const stats = getTelemetryStats()

  return NextResponse.json(
    {
      object: "list",
      data,
      count: data.length,
      total: stats.count,
      pending: stats.pending,
      storage: { dir: stats.dir, jsonl: stats.jsonl, sqlite: stats.sqlite },
      hint: "POST /api/v1/telemetry/ingest to append; heartbeat auto-logs to this store",
    },
    { headers: { "Cache-Control": "no-store, max-age=0", ...CORS_HEADERS } }
  )
}
