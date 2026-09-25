import { NextResponse } from "next/server"
import { clearAll, listProviders, setForceZero } from "@/lib/providers-store"
import { clearAllFallback, resetStats as resetFallbackStats } from "@/lib/fallback-state"
import { resetModalWarmup } from "@/lib/fallback-clients"
import { checkAdmin } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const NO_STORE = { "Cache-Control": "no-store, max-age=0" }

export async function POST(req: Request) {
  const admin = checkAdmin(req)
  if (!admin.ok) return admin.response

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
    { headers: NO_STORE }
  )
}

export async function GET(req: Request) {
  const admin = checkAdmin(req)
  if (!admin.ok) return admin.response
  // allow GET for convenience + verify counts (admin-gated: counts leak capacity info)
  const providers = listProviders()
  return NextResponse.json(
    {
      message: "Use POST /api/v1/providers/clear with header X-Admin-Token",
      auth: "X-Admin-Token: $ADMIN_TOKEN (or SEEDINFER_ADMIN_TOKEN)",
      current: {
        count: providers.length,
        verified: providers.filter((p) => p.verification.status === "verified").length,
        pending: providers.filter((p) => p.verification.status === "pending").length,
      },
    },
    { headers: NO_STORE }
  )
}
