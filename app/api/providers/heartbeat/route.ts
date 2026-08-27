import { NextResponse } from "next/server"
import { upsertProvider, getProvider } from "@/lib/providers-store"

export const dynamic = "force-dynamic"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

function extractIp(req: Request): string | null {
  const h = (n: string) => req.headers.get(n)
  const xff = h("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  const real = h("x-real-ip")
  if (real) return real.trim()
  const cf = h("cf-connecting-ip")
  if (cf) return cf.trim()
  return null
}

export async function POST(req: Request) {
  let payload: any
  try { payload = await req.json() } catch { return NextResponse.json({ error: { message: "Invalid JSON" } }, { status: 400, headers: CORS_HEADERS }) }
  if (!payload?.id) return NextResponse.json({ error: { message: "Missing provider id" } }, { status: 400, headers: CORS_HEADERS })
  const ip = extractIp(req)
  const stored = upsertProvider(payload, { ip })
  return NextResponse.json({ ok: true, provider_id: stored.id, status: stored.status, verification: stored.verification, note: "legacy alias /api/providers/heartbeat -> use /api/v1/providers/heartbeat" }, { headers: { "Cache-Control": "no-store, max-age=0", ...CORS_HEADERS } })
}

export async function GET() {
  return NextResponse.json({ message: "Use POST /api/v1/providers/heartbeat" }, { headers: CORS_HEADERS })
}
