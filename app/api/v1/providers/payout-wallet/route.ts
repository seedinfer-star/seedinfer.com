import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const GONE = {
  ok: false,
  error: "Payout wallets are now managed in your account: https://seedinfer.com/provider/portal",
  code: "moved",
};

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

/** Removed: payout wallets are account-level (PUT /api/v1/account/payout-wallet). */
export async function GET(_req: Request) {
  return NextResponse.json(GONE, { status: 410, headers: NO_STORE });
}

export async function POST(_req: Request) {
  return NextResponse.json(GONE, { status: 410, headers: NO_STORE });
}

export async function PUT(_req: Request) {
  return NextResponse.json(GONE, { status: 410, headers: NO_STORE });
}

export async function DELETE(_req: Request) {
  return NextResponse.json(GONE, { status: 410, headers: NO_STORE });
}
