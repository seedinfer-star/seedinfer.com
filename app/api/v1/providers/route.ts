import { NextResponse } from "next/server"
import { listProviders } from "@/lib/providers-store"

export const dynamic = "force-dynamic"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

/**
 * GET /api/v1/providers
 * Returns provider list with verification (for provider-fleet.tsx)
 * Query: ?verified=1 — only verified; ?status=pending etc.
 */
export async function GET(req: Request) {
  const url = new URL(req.url)
  const onlyVerified = url.searchParams.get("verified") === "1" || url.searchParams.get("verified") === "true"
  const statusFilter = url.searchParams.get("status") // pending|verifying|verified|failed
  const modelFilter = url.searchParams.get("model")

  let providers = listProviders()

  if (onlyVerified) {
    providers = providers.filter((p) => p.verification.status === "verified")
  }
  if (statusFilter) {
    providers = providers.filter((p) => p.verification.status === statusFilter)
  }
  if (modelFilter) {
    providers = providers.filter((p) => p.current_model === modelFilter || p.models.includes(modelFilter))
  }

  const verifiedCount = providers.filter((p) => p.verification.status === "verified").length
  const pendingCount = providers.filter((p) => p.verification.status === "pending").length
  const verifyingCount = providers.filter((p) => p.verification.status === "verifying").length
  const failedCount = providers.filter((p) => p.verification.status === "failed").length

  return NextResponse.json(
    {
      object: "list",
      data: providers,
      count: providers.length,
      verified: verifiedCount,
      pending: pendingCount,
      verifying: verifyingCount,
      failed: failedCount,
      // for compatibility with lib/types — keep dark, but UI uses directly
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "application/json",
        ...CORS_HEADERS,
      },
    }
  )
}
