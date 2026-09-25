import { NextResponse } from "next/server"
import { clearAll, listProviders, setForceZero } from "@/lib/providers-store"
import { clearAllFallback } from "@/lib/fallback-state"
import { resetModalWarmup } from "@/lib/fallback-clients"
import { checkAdmin } from "@/lib/admin-auth"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const NO_STORE = { "Cache-Control": "no-store, max-age=0" }

// Alias for POST /api/v1/providers/clear — supports both paths per spec
export async function POST(req: Request) {
  const admin = checkAdmin(req)
  if (!admin.ok) return admin.response
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
  return NextResponse.json({ ok: true, cleared: { providers_before: before, providers_after: after, forceZero: true } }, { headers: NO_STORE })
}

export async function GET(req: Request) {
  const admin = checkAdmin(req)
  if (!admin.ok) return admin.response
  return NextResponse.json({ message: "Use POST /api/admin/reset with X-Admin-Token", current: { count: listProviders().length } }, { headers: NO_STORE })
}
