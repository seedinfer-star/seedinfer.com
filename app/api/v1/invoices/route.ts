import { NextResponse } from "next/server";
import { extractJwtFromRequest, verifySession } from "@/lib/auth";
import { createInvoice, listInvoicesForUser } from "@/lib/payments/invoice";
import { isValidChain } from "@/lib/payments/chains";
import { isTokenAllowed } from "@/lib/payments/tokens";
import { CHAIN_CONFIG } from "@/lib/payments/chains";
import { getTokenAddress, TOKEN_DECIMALS, isNative } from "@/lib/payments/tokens";
import { generateEip681Uri, generateSolanaPayUri } from "@/lib/payments/qr";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Rate limit stub — in-memory (Element requires refinement: use Redis / Upstash for multi-instance rate limiting)
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 30;
const rateMap = new Map<string, { count: number; resetMs: number }>();

function isRateLimited(key: string): boolean {
  const now = Date.now();
  const entry = rateMap.get(key);
  if (!entry || now > entry.resetMs) {
    rateMap.set(key, { count: 1, resetMs: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  if (entry.count >= RATE_LIMIT_MAX) return true;
  entry.count++;
  return false;
}

function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "unknown";
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// POST /api/v1/invoices — create invoice (auth required)
export async function POST(req: Request) {
  const ip = getClientIp(req);
  if (isRateLimited(`POST:invoices:${ip}`)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429, headers: CORS_HEADERS });
  }

  const jwt = extractJwtFromRequest(req as any);
  if (!jwt) {
    return NextResponse.json({ error: "unauthorized — missing JWT (cookie or Bearer)" }, { status: 401, headers: CORS_HEADERS });
  }
  const sess = await verifySession(jwt);
  if (!sess) {
    return NextResponse.json({ error: "unauthorized — invalid or expired session" }, { status: 401, headers: CORS_HEADERS });
  }

  let body: any = {};
  try {
    const t = await req.text();
    if (t) body = JSON.parse(t);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400, headers: CORS_HEADERS });
  }

  const chainRaw = body.chain || body.chainId || "";
  const tokenRaw = body.token || body.token_address || "";
  const amountRaw = body.amount_usd_cents ?? body.amountUsdCents ?? body.amount ?? body.usd_cents;

  const chain = String(chainRaw).toLowerCase().trim();
  const token = String(tokenRaw).trim();
  const amountUsdCents = Number(amountRaw);

  if (!chain || !isValidChain(chain)) {
    return NextResponse.json(
      { error: `invalid chain (allowed: eth, arbitrum, polygon, base, bnb, hyperevm, solana)` },
      { status: 400, headers: CORS_HEADERS }
    );
  }
  if (!token) {
    return NextResponse.json({ error: "token required (e.g., USDC, USDT, native)" }, { status: 400, headers: CORS_HEADERS });
  }
  if (!isTokenAllowed(chain, token)) {
    return NextResponse.json({ error: `token not allowed for chain ${chain}: ${token}` }, { status: 400, headers: CORS_HEADERS });
  }
  if (!Number.isFinite(amountUsdCents) || amountUsdCents <= 0) {
    return NextResponse.json({ error: "amount_usd_cents must be positive integer (USD cents)" }, { status: 400, headers: CORS_HEADERS });
  }
  if (amountUsdCents < 10) {
    return NextResponse.json({ error: "minimum invoice is 10 cents" }, { status: 400, headers: CORS_HEADERS });
  }

  try {
    const invoice: any = await createInvoice(sess.userId, chain, token, Math.floor(amountUsdCents));
    // Build QR uri assignment: single address + invoice id as memo/reference (like OpenRouter pl_xxx)
    let qr_uri: string | null = null;
    let qr_type: string | null = null;
    try {
      const cfg: any = (CHAIN_CONFIG as any)[chain];
      if (chain === "solana") {
        const recipient = invoice.address_to || process.env.SOLANA_ADDRESS || "";
        const splToken = getTokenAddress(chain, token) || "";
        const ref = invoice.id;
        // amount in UI units approx usd cents -> dollars string; Element requires refinement for exact decimals per token
        const amountUi = (amountUsdCents / 100).toFixed(2);
        qr_uri = generateSolanaPayUri(recipient, amountUi, splToken, ref, ref);
        qr_type = "solana_pay";
      } else {
        const chainId = cfg?.chainId || cfg?.id || 1;
        const tokenAddr = getTokenAddress(chain, token) || token;
        const toAddr = invoice.address_to || process.env.PAYMENT_ADDRESS || "0x2EB9104AEeF7270fe639Bf1965B94Bfb8Edcf786";
        // amount in base units: convert USD cents -> token base units (USDC 6 dec: $10 = 10_000000). For native assume 1 token=$1 placeholder.
        let amountWei: string;
        try {
          const sym = String(token).toUpperCase();
          const dec = (TOKEN_DECIMALS[sym] ?? (isNative(chain, token) ? 18 : 6)) as number;
          // cents -> baseUnits = cents * 10^dec / 100
          const base = (BigInt(Math.floor(amountUsdCents)) * (BigInt(10) ** BigInt(dec))) / BigInt(100);
          amountWei = base.toString();
        } catch {
          amountWei = invoice.amount || String(amountUsdCents);
        }
        qr_uri = generateEip681Uri(chainId, tokenAddr, toAddr, amountWei, invoice.id);
        qr_type = "eip681";
      }
    } catch {}
    return NextResponse.json({ ok: true, invoice, qr_uri, qr_type }, { status: 201, headers: CORS_HEADERS });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "createInvoice failed" }, { status: 400, headers: CORS_HEADERS });
  }
}

// GET /api/v1/invoices — list invoices for user (auth required)
export async function GET(req: Request) {
  const ip = getClientIp(req);
  if (isRateLimited(`GET:invoices:${ip}`)) {
    return NextResponse.json({ error: "rate limited" }, { status: 429, headers: CORS_HEADERS });
  }

  const jwt = extractJwtFromRequest(req as any);
  if (!jwt) {
    return NextResponse.json({ error: "unauthorized — missing JWT" }, { status: 401, headers: CORS_HEADERS });
  }
  const sess = await verifySession(jwt);
  if (!sess) {
    return NextResponse.json({ error: "unauthorized — invalid session" }, { status: 401, headers: CORS_HEADERS });
  }

  const url = new URL(req.url);
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Number(limitRaw) : 50;

  const invoices = listInvoicesForUser(sess.userId, limit);
  return NextResponse.json({ ok: true, user_id: sess.userId, count: invoices.length, invoices }, { status: 200, headers: CORS_HEADERS });
}
