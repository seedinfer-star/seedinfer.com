import { NextResponse } from "next/server"
import { sanitizePublic } from "@/lib/public-sanitize"
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
  const showAll = url.searchParams.get("all") === "1" || url.searchParams.get("all") === "true"
  const sinceParam = url.searchParams.get("since")

  // Default to the last hour unless ?all=1 or ?since=... is explicitly set
  const defaultSince = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const since = sinceParam || (showAll ? undefined : defaultSince)

  const data = listTelemetry({ limit, provider_id, since })
  const stats = getTelemetryStats()

  return NextResponse.json(
    {
      object: "list",
      data: sanitizePublic(data),
      count: data.length,
      window: sinceParam ? `since:${sinceParam}` : showAll ? "all-time" : "last-1-hour",
      total: stats.count,
      pending: stats.pending,
      storage: { jsonl: !!stats.jsonl, sqlite: !!stats.sqlite },
      hint: "POST /api/v1/telemetry/ingest to append; pass ?all=1 for the full historical log or ?since=ISO_TIMESTAMP",
    },
    { headers: { "Cache-Control": "no-store, max-age=0", ...CORS_HEADERS } }
  )
}
