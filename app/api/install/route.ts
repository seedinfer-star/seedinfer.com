import { NextResponse } from "next/server"
import { GET as serveInstallScript } from "@/app/install.sh/route"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

// Public origin for redirects. Behind the Cloudflare tunnel req.url is the bind
// address (e.g. http://0.0.0.0:3002), which must never leak into a Location header.
const PUBLIC_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL || "https://seedinfer.com").replace(/\/+$/, "")

// Alias for /install.sh
// Browsers get a 308 to the canonical public URL; curl / shell clients get the script body
// directly (served by the same handler as /install.sh, no loopback HTTP round-trip).
export async function GET(req: Request) {
  const url = new URL(req.url)
  const accept = req.headers.get("accept") || ""
  const userAgent = req.headers.get("user-agent") || ""
  const isCurl = userAgent.includes("curl") || accept.includes("shell") || url.searchParams.has("raw")

  if (!isCurl) {
    return NextResponse.redirect(`${PUBLIC_ORIGIN}/install.sh`, 308)
  }

  try {
    return await serveInstallScript()
  } catch {
    return NextResponse.redirect(`${PUBLIC_ORIGIN}/install.sh`, 307)
  }
}

export async function HEAD(req: Request) {
  return GET(req)
}
