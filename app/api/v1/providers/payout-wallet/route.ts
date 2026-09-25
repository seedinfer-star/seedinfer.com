import { NextResponse } from "next/server"
import { getProviderByPublicKey, getProvider, setPayoutWallet } from "@/lib/providers-store"
import { sanitizeProvider } from "@/lib/public-sanitize"
import { PROVIDER_ECONOMICS } from "@/lib/catalog"

export const dynamic = "force-dynamic"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}
const NO_STORE = { "Cache-Control": "no-store, max-age=0" }

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

const ERRORS: Record<string, { status: number; message: string }> = {
  provider_not_found: { status: 404, message: "No node with this public key has sent a heartbeat yet. Start the agent and retry in a minute." },
  key_mismatch: { status: 403, message: "This public key does not belong to that node. Use the SEEDINFER_PUBLIC_KEY from your node's seedinfer.env." },
  invalid_wallet: { status: 400, message: `Enter a valid EVM address on ${PROVIDER_ECONOMICS.payoutChain} (0x followed by 40 hex characters).` },
}

/**
 * POST /api/v1/providers/payout-wallet { public_key, provider_id?, wallet }
 * Registers the provider's own Base payout wallet (USDC destination). The public key proves the
 * caller operates the node — no site account needed, private key never leaves the machine.
 * GET ?public_key=xxx returns the currently registered wallet (so the portal can display it).
 */
export async function POST(req: Request) {
  let body: any = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: { message: "Invalid JSON", code: "invalid_json" } }, { status: 400, headers: CORS_HEADERS })
  }
  const publicKey = String(body.public_key || body.publicKey || "").trim()
  const wallet = String(body.wallet || body.payout_wallet || "")
  if (!publicKey) {
    return NextResponse.json(
      { error: { message: "Missing public_key (SEEDINFER_PUBLIC_KEY from your node's seedinfer.env).", code: "missing_public_key" } },
      { status: 400, headers: CORS_HEADERS }
    )
  }
  const target = body.provider_id ? getProvider(String(body.provider_id)) : getProviderByPublicKey(publicKey)
  if (!target) {
    const e = ERRORS.provider_not_found
    return NextResponse.json({ error: { message: e.message, code: "provider_not_found" } }, { status: e.status, headers: CORS_HEADERS })
  }
  const r = setPayoutWallet(target.id, publicKey, wallet)
  if (!r.ok) {
    const e = ERRORS[r.error]
    return NextResponse.json({ error: { message: e.message, code: r.error } }, { status: e.status, headers: CORS_HEADERS })
  }
  return NextResponse.json(
    { ok: true, provider_id: target.id, payout_wallet: r.wallet, chain: PROVIDER_ECONOMICS.payoutChain, asset: PROVIDER_ECONOMICS.payoutAsset },
    { headers: { ...NO_STORE, ...CORS_HEADERS } }
  )
}

export async function GET(req: Request) {
  const publicKey = new URL(req.url).searchParams.get("public_key") || ""
  const p = getProviderByPublicKey(publicKey)
  if (!p) {
    return NextResponse.json({ ok: false, payout_wallet: null, code: "provider_not_found" }, { headers: { ...NO_STORE, ...CORS_HEADERS } })
  }
  const clean = sanitizeProvider({ ...p })
  return NextResponse.json(
    {
      ok: true,
      provider_id: p.id,
      payout_wallet: clean.payout_wallet ?? null,
      payout_wallet_updated_at: clean.payout_wallet_updated_at ?? null,
      chain: PROVIDER_ECONOMICS.payoutChain,
      asset: PROVIDER_ECONOMICS.payoutAsset,
    },
    { headers: { ...NO_STORE, ...CORS_HEADERS } }
  )
}
