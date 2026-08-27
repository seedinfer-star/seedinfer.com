import { NextResponse } from "next/server"

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

// Alias for /install.sh — redirect or same content
// GET /api/install -> 308 to /install.sh for curl -fsSL compatibility, also serves content on follow
export async function GET(req: Request) {
  const url = new URL(req.url)
  // If client follows redirect, serve same as /install.sh via internal fetch
  // For direct curl without -L, provide 308; but curl -fsSL follows, so redirect is fine.
  // To support both, check Accept: if shell/script prefer content; default redirect.
  const accept = req.headers.get("accept") || ""
  const userAgent = req.headers.get("user-agent") || ""
  const isCurl = userAgent.includes("curl") || accept.includes("shell") || url.searchParams.has("raw")

  if (!isCurl) {
    // Browser -> redirect to /install.sh for canonical
    return NextResponse.redirect(new URL("/install.sh", url.origin), 308)
  }

  // For curl, proxy to /install.sh handler internally
  try {
    const origin = url.origin
    const r = await fetch(new URL("/install.sh", origin).toString(), { cache: "no-store" } as any)
    const text = await r.text()
    return new NextResponse(text, {
      status: 200,
      headers: {
        "Content-Type": "text/x-shellscript; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        "Content-Disposition": 'inline; filename="install.sh"',
        ...CORS_HEADERS,
      },
    })
  } catch {
    return NextResponse.redirect(new URL("/install.sh", url.origin), 307)
  }
}

export async function HEAD(req: Request) {
  return GET(req)
}
