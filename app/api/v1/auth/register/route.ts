import { NextResponse } from "next/server";
import { createUserAndSession, createSessionCookie } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(req: Request) {
  let body: any = {};
  try {
    const t = await req.text();
    if (t) body = JSON.parse(t);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400, headers: CORS_HEADERS });
  }
  const email = String(body.email || body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "invalid email" }, { status: 400, headers: CORS_HEADERS });
  }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: "password too short (min 8 chars)" }, { status: 400, headers: CORS_HEADERS });
  }

  try {
    const sess = await createUserAndSession(email, password, { walletAddress: body.wallet_address || body.walletAddress || null });
    const isProd = process.env.NODE_ENV === "production";
    const cookie = createSessionCookie(sess.jwt, { secure: isProd });
    const res = NextResponse.json(
      { ok: true, user_id: sess.userId, expires_at: sess.expiresAt },
      { status: 201, headers: { "Cache-Control": "no-store, max-age=0", ...CORS_HEADERS } }
    );
    res.headers.set("Set-Cookie", cookie);
    return res;
  } catch (e: any) {
    const msg = String(e?.message || "register failed");
    if (msg.toLowerCase().includes("already registered") || msg.toLowerCase().includes("unique")) {
      return NextResponse.json({ error: "email already registered" }, { status: 409, headers: CORS_HEADERS });
    }
    if (msg.includes("invalid email") || msg.includes("password too short")) {
      return NextResponse.json({ error: msg }, { status: 400, headers: CORS_HEADERS });
    }
    return NextResponse.json({ error: msg }, { status: 500, headers: CORS_HEADERS });
  }
}
