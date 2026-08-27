import { NextResponse } from "next/server";
import { extractJwtFromRequest, verifySession } from "@/lib/auth";
import { getInvoiceById, setInvoiceTxHash } from "@/lib/payments/invoice";
import { isValidChain } from "@/lib/payments/chains";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Rate limit stub — Element requires refinement: use Redis for distributed rate limit
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 20;
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

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// POST /api/v1/payments/verify — manual submit {tx_hash, chain, invoice_id}
export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (isRateLimited(`verify:${ip}`)) {
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

  let body: any = {};
  try {
    const t = await req.text();
    if (t) body = JSON.parse(t);
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400, headers: CORS_HEADERS });
  }

  const txHashRaw = body.tx_hash || body.txHash || body.hash || "";
  const chainRaw = body.chain || "";
  const invoiceIdRaw = body.invoice_id || body.invoiceId || body.id || "";

  const tx_hash = String(txHashRaw).trim();
  const chain = String(chainRaw).toLowerCase().trim();
  const invoice_id = String(invoiceIdRaw).trim();

  if (!tx_hash) return NextResponse.json({ error: "tx_hash required" }, { status: 400, headers: CORS_HEADERS });
  if (!invoice_id) return NextResponse.json({ error: "invoice_id required" }, { status: 400, headers: CORS_HEADERS });
  if (!chain || !isValidChain(chain)) {
    return NextResponse.json({ error: "valid chain required (eth, arbitrum, polygon, base, bnb, hyperevm, solana)" }, { status: 400, headers: CORS_HEADERS });
  }

  // Basic tx hash format validation — do not fake verification
  if (chain === "solana") {
    // Solana base58 sig typically 87-88 chars, but check not empty and not 0x
    if (tx_hash.startsWith("0x")) {
      return NextResponse.json({ error: "solana tx_hash should be base58 signature, not 0x" }, { status: 400, headers: CORS_HEADERS });
    }
    if (tx_hash.length < 32 || tx_hash.length > 128) {
      return NextResponse.json({ error: "solana tx_hash length invalid" }, { status: 400, headers: CORS_HEADERS });
    }
  } else {
    // EVM 0x + 64 hex
    if (!/^0x[0-9a-fA-F]{64}$/.test(tx_hash)) {
      return NextResponse.json({ error: "evm tx_hash must be 0x + 64 hex chars" }, { status: 400, headers: CORS_HEADERS });
    }
  }

  const invoice = getInvoiceById(invoice_id);
  if (!invoice) {
    return NextResponse.json({ error: "invoice not found" }, { status: 404, headers: CORS_HEADERS });
  }
  if (invoice.user_id !== sess.userId) {
    return NextResponse.json({ error: "forbidden — invoice belongs to different user" }, { status: 403, headers: CORS_HEADERS });
  }
  if (invoice.chain !== chain) {
    return NextResponse.json({ error: `chain mismatch: invoice chain=${invoice.chain} vs submitted ${chain}` }, { status: 400, headers: CORS_HEADERS });
  }
  if (invoice.status === "expired") {
    return NextResponse.json({ error: "invoice expired" }, { status: 400, headers: CORS_HEADERS });
  }
  // P1-1: also reject expired by time even if status still pending/confirming (worker sweep may be delayed)
  if (new Date(invoice.expires_at).getTime() < Date.now() && !invoice.tx_hash) {
    // Optionally mark expired in DB here? but at least reject verify
    return NextResponse.json({ error: "invoice expired" }, { status: 400, headers: CORS_HEADERS });
  }
  if (new Date(invoice.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "invoice expired" }, { status: 400, headers: CORS_HEADERS });
  }
  if (invoice.status === "confirmed") {
    return NextResponse.json({ error: "invoice already confirmed", invoice }, { status: 400, headers: CORS_HEADERS });
  }
  if (invoice.tx_hash && invoice.tx_hash !== tx_hash) {
    return NextResponse.json({ error: "invoice already has different tx_hash — duplicate submission rejected" }, { status: 409, headers: CORS_HEADERS });
  }

  // Element requires refinement: tx_hash is stored but not yet verified — worker will verify chainId, receipt status, confirmations, amount tolerance
  try {
    setInvoiceTxHash(invoice_id, tx_hash, chain);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "set tx_hash failed" }, { status: 400, headers: CORS_HEADERS });
  }

  const updated = getInvoiceById(invoice_id);
  return NextResponse.json(
    {
      ok: true,
      message: "tx_hash submitted — worker will verify on next poll (15s). Do not fake confirmation — real RPC verification required.",
      invoice: updated,
      hint: "Poll GET /api/v1/invoices/:id for status -> confirming -> confirmed after required confirmations",
    },
    { status: 200, headers: CORS_HEADERS }
  );
}
