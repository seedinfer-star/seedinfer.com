import { NextResponse } from "next/server"
import { verifyNodeToken } from "@/lib/provider-tokens"
import { checkRateLimit, getClientIp } from "@/lib/rate-limit"
import { recordAccountEvent } from "@/lib/account-events"
import { extractBearerToken } from "@/lib/node-auth"
import { mintAuthKey } from "@/lib/auth-key-minter"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

// No CORS headers on this route: callers are server-side installers/agents, not browsers.
const NO_STORE = { "Cache-Control": "no-store, max-age=0" }

const KEY_EXPIRY = "1h"

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

function errBody(code: string, message: string) {
  return { ok: false as const, error: message, code }
}

function rateLimited(retryAfterSec: number) {
  return NextResponse.json(errBody("rate_limited", "Rate limited — slow down and retry."), {
    status: 429,
    headers: { ...NO_STORE, "Retry-After": String(retryAfterSec) },
  })
}

function errorResponse(message: string, status = 503) {
  return NextResponse.json(
    {
      error: message,
      hint: "Provider onboarding is temporarily unavailable. Retry in 30s or see https://seedinfer.com/docs",
      login_server: "https://tailnet.seedinfer.com",
      gateway: "https://seedinfer.com",
      retry_after: 30,
    },
    { status, headers: NO_STORE }
  )
}

function successResponse(key: string) {
  const now = new Date()
  return NextResponse.json(
    {
      authkey: key,
      expires: KEY_EXPIRY,
      tag: "tag:provider",
      login_server: "https://tailnet.seedinfer.com",
      gateway: "https://seedinfer.com",
      mode: "headscale",
      hint: `Preauth key via Headscale (tag:tag:provider). Use: tailscale up --login-server https://tailnet.seedinfer.com --authkey ${key} --advertise-tags tag:provider`,
      dashboard: "https://dashboard.seedinfer.com",
      created_at: now.toISOString(),
      ephemeral: false,
      reusable: false,
    } as AuthResponse,
    { headers: NO_STORE }
  )
}

type Gate = { ok: true; userId: string; tokenId: string; bearer: string } | { ok: false; response: NextResponse }

/**
 * Shared gate for GET and POST: node-token auth, per-token + per-IP rate
 * limits, and provider-tag allowlist. Never echoes request data back.
 */
function gate(req: Request, rawTag: string | null): Gate {
  const bearer = extractBearerToken(req)
  if (!bearer) {
    return {
      ok: false,
      response: NextResponse.json(
        errBody("node_token_missing", "Missing node token — send Authorization: Bearer sipn_... (SEEDINFER_NODE_TOKEN)."),
        { status: 401, headers: NO_STORE }
      ),
    }
  }
  const verified = verifyNodeToken(bearer)
  if (!verified) {
    return {
      ok: false,
      response: NextResponse.json(
        errBody("node_token_invalid", "Unknown or revoked node token — create a new one in /provider/portal."),
        { status: 401, headers: NO_STORE }
      ),
    }
  }

  const ip = getClientIp(req)
  const byToken = checkRateLimit(`authkey:token:${verified.tokenId}`, 5, 60 * 60_000)
  if (!byToken.ok) return { ok: false, response: rateLimited(byToken.retryAfterSec) }
  const byIp = checkRateLimit(`authkey:ip:${ip}`, 10, 60 * 60_000)
  if (!byIp.ok) return { ok: false, response: rateLimited(byIp.retryAfterSec) }

  const t = String(rawTag || "tag:provider").trim()
  if (t !== "provider" && t !== "tag:provider") {
    return {
      ok: false,
      response: NextResponse.json(errBody("invalid_tag", "Only the provider tag is allowed."), {
        status: 400,
        headers: NO_STORE,
      }),
    }
  }

  return { ok: true, userId: verified.userId, tokenId: verified.tokenId, bearer }
}

async function issue(req: Request, rawTag: string | null) {
  const g = gate(req, rawTag)
  if (!g.ok) return g.response

  // The key itself is never stored or logged; only the response carries it.
  const key = await mintAuthKey()
  if (!key) {
    return errorResponse("Failed to generate Headscale preauth key — control plane unavailable")
  }

  recordAccountEvent(g.userId, "tailnet_key_issued", {
    // Prefix = first 12 chars of the secret (same value stored as provider_tokens.prefix).
    detail: { node_token_prefix: g.bearer.slice(0, 12) },
    ip: getClientIp(req),
    userAgent: req.headers.get("user-agent"),
  })

  return successResponse(key)
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  return issue(req, url.searchParams.get("tag"))
}

export async function POST(req: Request) {
  let body: any = {}
  try {
    const t = await req.text()
    if (t) body = JSON.parse(t)
  } catch {}
  const url = new URL(req.url)
  // NOTE: the `email` param is intentionally dropped (never read, never echoed).
  const rawTag =
    (body && typeof body.tag === "string" ? body.tag : null) || url.searchParams.get("tag")
  return issue(req, rawTag)
}
