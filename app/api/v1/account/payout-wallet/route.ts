import { NextResponse } from "next/server";
import { getRequestSession, isSameOriginRequest } from "@/lib/auth";
import { REAUTH_REQUIRED, isFreshSession } from "@/lib/accounts";
import { getAccountPayoutWallet, normalizePayoutWallet, setAccountPayoutWallet } from "@/lib/payout-wallet";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { PROVIDER_ECONOMICS } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

function shape(wallet: string | null, updated_at: string | null) {
  return {
    wallet,
    updated_at,
    chain: PROVIDER_ECONOMICS.payoutChain,
    asset: PROVIDER_ECONOMICS.payoutAsset,
    min_payout_usd: PROVIDER_ECONOMICS.minPayoutUsd,
  };
}

export async function GET(req: Request) {
  const sess = await getRequestSession(req);
  if (!sess) {
    return NextResponse.json({ error: "unauthorized", code: "unauthorized" }, { status: 401, headers: NO_STORE });
  }
  const s = getAccountPayoutWallet(sess.userId);
  return NextResponse.json(shape(s.wallet, s.updated_at), { headers: NO_STORE });
}

export async function PUT(req: Request) {
  const sess = await getRequestSession(req);
  if (!sess) {
    return NextResponse.json({ error: "unauthorized", code: "unauthorized" }, { status: 401, headers: NO_STORE });
  }
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "forbidden — same-origin requests only", code: "forbidden_origin" }, { status: 403, headers: NO_STORE });
  }
  // Sudo mode: session must be fresher than 15 min.
  if (!isFreshSession(sess.token, 15)) {
    return NextResponse.json(REAUTH_REQUIRED, { status: 403, headers: NO_STORE });
  }
  // 10 writes per hour per user.
  const rl = checkRateLimit(`payout-wallet:${sess.userId}`, 10, 3600_000);
  if (!rl.ok) {
    return NextResponse.json({ ok: false, error: "Rate limited — slow down and retry.", code: "rate_limited" }, {
      status: 429,
      headers: { ...NO_STORE, "Retry-After": String(rl.retryAfterSec) },
    });
  }

  let body: any = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "Request body is not valid JSON.", code: "invalid_json" }, { status: 400, headers: NO_STORE });
  }
  const wallet = String(body?.wallet ?? "");
  if (!normalizePayoutWallet(wallet)) {
    return NextResponse.json(
      { ok: false, error: `Enter a valid EVM address on ${PROVIDER_ECONOMICS.payoutChain} (0x + 40 hex; mixed-case must be EIP-55 checksummed; zero address rejected).`, code: "invalid_wallet" },
      { status: 400, headers: NO_STORE }
    );
  }
  const s = setAccountPayoutWallet(sess.userId, wallet, {
    ip: getClientIp(req),
    userAgent: req.headers.get("user-agent"),
  });
  return NextResponse.json(shape(s.wallet, s.updated_at), { headers: NO_STORE });
}
