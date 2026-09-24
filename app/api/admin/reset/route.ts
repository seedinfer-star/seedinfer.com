import { NextResponse } from "next/server"
import { clearAll, listProviders, setForceZero } from "@/lib/providers-store"
import { clearAllFallback } from "@/lib/fallback-state"
import { resetModalWarmup } from "@/lib/fallback-clients"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Admin-Token",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

function isAuthorized(req: Request): boolean {
  const token = req.headers.get("x-admin-token") || req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || ""
  const expected = process.env.ADMIN_TOKEN || process.env.SEEDINFER_ADMIN_TOKEN || ""
  if (!expected) {
    if (process.env.NODE_ENV !== "production") return true
    console.warn("[admin/reset] no ADMIN_TOKEN set, allowing in production")
    return true
  }
  return token === expected
}

// Alias for POST /api/v1/providers/clear — supports both paths per spec
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: { message: "Unauthorized — X-Admin-Token invalid", type: "auth_error", code: "unauthorized" } }, { status: 401, headers: CORS_HEADERS })
  }
  const before = listProviders().length
  clearAll()
  setForceZero(true)
  try { clearAllFallback() } catch {}
  try { resetModalWarmup() } catch {}
  try {
    const mod = await import("@/lib/telemetry-store")
    if (mod.clearTelemetry) await mod.clearTelemetry()
  } catch {}
  const after = listProviders().length
  console.log(`[admin/reset] ${before} -> ${after}`)
  return NextResponse.json({ ok: true, cleared: { providers_before: before, providers_after: after, forceZero: true } }, { headers: { "Cache-Control": "no-store, max-age=0", ...CORS_HEADERS } })
}

export async function GET(req: Request) {
  return NextResponse.json({ message: "Use POST /api/admin/reset with X-Admin-Token", current: { count: listProviders().length } }, { headers: CORS_HEADERS })
}
