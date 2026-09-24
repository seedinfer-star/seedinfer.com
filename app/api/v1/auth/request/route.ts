import { NextResponse } from "next/server"
import { execSync } from "child_process"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

type AuthResponse = {
  authkey: string
  expires: string
  tag: string
  login_server: string
  gateway: string
  mode: "headscale"
  hint: string
  dashboard?: string
  created_at: string
  ephemeral: boolean
  reusable: boolean
}

function tryHeadscale(): string | null {
  try {
    execSync("which docker", { stdio: "ignore", timeout: 2000 })
  } catch {
    return null
  }
  try {
    const out = execSync(
      `docker exec seedinfer-headscale headscale preauthkeys create --user seedinfer --tags tag:provider --reusable --expiration 24h 2>&1`,
      { encoding: "utf-8", timeout: 8000, maxBuffer: 1024 * 1024 }
    )
    const lines = out.trim().split("\n")
    for (const line of lines.reverse()) {
      const m1 = line.match(/nodekey:[a-f0-9]+/i)
      if (m1) return m1[0]
      const m2 = line.match(/[a-f0-9]{48,}/i)
      if (m2) return m2[0]
      const m3 = line.match(/hskey-[a-z0-9\-_]+/i)
      if (m3) return m3[0]
    }
    const tokens = out.trim().split(/\s+/).filter(Boolean)
    if (tokens.length > 0) {
      const last = tokens[tokens.length - 1]
      if (last.length >= 20) return last
    }
    return null
  } catch (e: any) {
    console.warn(`[auth/request] headscale exec failed: ${e?.message?.slice(0, 300) || e}`)
    return null
  }
}

async function tryHeadscaleViaProxy(tag: string): Promise<string | null> {
  const proxyUrl = process.env.HEADSCALE_PROXY_URL || process.env.HEADSCALE_API_URL || ""
  if (!proxyUrl) return null
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 5000)
    const res = await fetch(`${proxyUrl.replace(/\/$/, "")}/preauthkeys/create`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user: "seedinfer", tags: [tag], reusable: true, expiration: "24h" }),
      signal: ctrl.signal as any,
    } as any)
    clearTimeout(t)
    if (!res.ok) return null
    const j: any = await res.json().catch(() => ({}))
    return j.authkey || j.key || j.preAuthKey || null
  } catch {
    return null
  }
}

function errorResponse(message: string, status = 503) {
  return NextResponse.json(
    {
      error: message,
      hint: "Headscale control plane unavailable. Retry: curl -fsSL https://seedinfer.com/api/v1/auth/request | jq — or contact support via dashboard.seedinfer.com / docs.seedinfer.com",
      login_server: "https://tailnet.seedinfer.com",
      gateway: "https://seedinfer.com",
      retry_after: 30,
    },
    { status, headers: { "Cache-Control": "no-store, max-age=0", ...CORS_HEADERS } }
  )
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const tag = url.searchParams.get("tag") || "tag:provider"

  // Try proxy first if configured
  const viaProxy = await tryHeadscaleViaProxy(tag)
  if (viaProxy) {
    const now = new Date()
    return NextResponse.json(
      {
        authkey: viaProxy,
        expires: "24h",
        tag,
        login_server: "https://tailnet.seedinfer.com",
        gateway: "https://seedinfer.com",
        mode: "headscale",
        hint: `Preauth key via Headscale (tag:${tag}). Use: tailscale up --login-server https://tailnet.seedinfer.com --authkey ${viaProxy} --advertise-tags ${tag}`,
        dashboard: "https://dashboard.seedinfer.com",
        created_at: now.toISOString(),
        ephemeral: false,
        reusable: true,
      } as AuthResponse,
      { headers: { "Cache-Control": "no-store, max-age=0", ...CORS_HEADERS } }
    )
  }

  const real = tryHeadscale()
  if (real) {
    const now = new Date()
    return NextResponse.json(
      {
        authkey: real,
        expires: "24h",
        tag,
        login_server: "https://tailnet.seedinfer.com",
        gateway: "https://seedinfer.com",
        mode: "headscale",
        hint: `Preauth key via Headscale (tag:${tag}). Use: tailscale up --login-server https://tailnet.seedinfer.com --authkey ${real} --advertise-tags ${tag}`,
        dashboard: "https://dashboard.seedinfer.com",
        created_at: now.toISOString(),
        ephemeral: false,
        reusable: true,
      } as AuthResponse,
      { headers: { "Cache-Control": "no-store, max-age=0", ...CORS_HEADERS } }
    )
  }

  return errorResponse("Failed to generate Headscale preauth key — control plane unavailable")
}

export async function POST(req: Request) {
  let body: any = {}
  try {
    const t = await req.text()
    if (t) body = JSON.parse(t)
  } catch {}
  const url = new URL(req.url)
  const tag = body.tag || url.searchParams.get("tag") || "tag:provider"
  const email = body.email || url.searchParams.get("email") || ""

  const viaProxy = await tryHeadscaleViaProxy(tag)
  if (viaProxy) {
    const now = new Date()
    return NextResponse.json(
      {
        authkey: viaProxy,
        expires: "24h",
        tag,
        login_server: "https://tailnet.seedinfer.com",
        gateway: "https://seedinfer.com",
        mode: "headscale",
        hint: `Preauth key${email ? ` for ${email}` : ""} (tag:${tag}).`,
        dashboard: "https://dashboard.seedinfer.com",
        created_at: now.toISOString(),
        ephemeral: false,
        reusable: true,
        ...(email ? { email } : {}),
      } as AuthResponse,
      { headers: { "Cache-Control": "no-store, max-age=0", ...CORS_HEADERS } }
    )
  }

  const key = tryHeadscale()
  if (key) {
    const now = new Date()
    return NextResponse.json(
      {
        authkey: key,
        expires: "24h",
        tag,
        login_server: "https://tailnet.seedinfer.com",
        gateway: "https://seedinfer.com",
        mode: "headscale",
        hint: `Preauth key${email ? ` for ${email}` : ""} (tag:${tag}).`,
        dashboard: "https://dashboard.seedinfer.com",
        created_at: now.toISOString(),
        ephemeral: false,
        reusable: true,
        ...(email ? { email } : {}),
      } as AuthResponse,
      { headers: { "Cache-Control": "no-store, max-age=0", ...CORS_HEADERS } }
    )
  }

  return errorResponse("Failed to generate Headscale preauth key — control plane unavailable")
}
