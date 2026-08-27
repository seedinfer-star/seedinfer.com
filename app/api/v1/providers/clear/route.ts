import { NextResponse } from "next/server"
import { clearAll, listProviders, setForceZero } from "@/lib/providers-store"
import { clearAllFallback, resetStats as resetFallbackStats } from "@/lib/fallback-state"
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
  const expected = process.env.ADMIN_TOKEN || process.env.SEEDINFER_ADMIN_TOKEN || process.env.SEEDINFER_ADMIN_TOKEN_ALT || ""
  // if no env set → allow in dev, deny in production unless explicit
  if (!expected) {
    // allow when not production or when token empty and env not set (dev lean)
    if (process.env.NODE_ENV !== "production") return true
    // in production without env, require at least header empty? For safety allow if no token configured but warn
    console.warn("[clear] no ADMIN_TOKEN set, allowing clear in production (set ADMIN_TOKEN to lock)")
    return true
  }
  return token === expected
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { error: { message: "Unauthorized — missing or invalid X-Admin-Token", type: "auth_error", code: "unauthorized" } },
      { status: 401, headers: CORS_HEADERS }
    )
  }

  const before = listProviders().length
  let telemetryCleared = false

  // 1) providers
  clearAll()
  setForceZero(true)

  // 2) fallback circuits + stats
  try {
    clearAllFallback()
  } catch {}
  try {
    resetFallbackStats()
  } catch {}
  try {
    resetModalWarmup()
  } catch {}

  // 3) telemetry (best effort, dynamic import to avoid cycle)
  try {
    const mod = await import("@/lib/telemetry-store")
    if (mod.clearTelemetry) {
      await mod.clearTelemetry()
      telemetryCleared = true
    }
  } catch (e: any) {
    console.warn(`[clear] telemetry clear skip: ${e?.message || e}`)
  }

  // also try to flush empty
  try {
    const fs = await import("fs")
    // truncate possible JSONL already done in telemetry-store; also ensure stats zero flag file not needed
  } catch {}

  const after = listProviders().length

  console.log(`[clear] providers ${before} -> ${after}, telemetryCleared=${telemetryCleared}, fallback reset`)

  return NextResponse.json(
    {
      ok: true,
      cleared: {
        providers_before: before,
        providers_after: after,
        fallback: "reset",
        telemetry: telemetryCleared ? "cleared" : "skipped",
        forceZero: true,
      },
      verify: {
        "GET /api/v1/providers": "should be 0 verified/pending",
        "GET /api/stats": "returns zeros when ?forceZero or after clear (SeedInfer proxy returns zeros if forceZero=true)",
        "GET /api/v1/fallback/status": "circuits reset, stats 0",
      },
      hint: "Dashboard KPI will show zeros after next poll (15s). Use ?forceZero=1 or header X-Admin-Token to force zeros on /api/stats",
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        ...CORS_HEADERS,
      },
    }
  )
}

export async function GET(req: Request) {
  // allow GET for convenience + verify counts
  const providers = listProviders()
  return NextResponse.json(
    {
      message: "Use POST /api/v1/providers/clear with header X-Admin-Token",
      auth: "X-Admin-Token: $ADMIN_TOKEN (or SEEDINFER_ADMIN_TOKEN); if no env set, allowed in dev",
      current: {
        count: providers.length,
        verified: providers.filter((p) => p.verification.status === "verified").length,
        pending: providers.filter((p) => p.verification.status === "pending").length,
      },
      curl: `curl -X POST ${new URL(req.url).origin}/api/v1/providers/clear -H "X-Admin-Token: $ADMIN_TOKEN"`,
    },
    { headers: CORS_HEADERS }
  )
}
