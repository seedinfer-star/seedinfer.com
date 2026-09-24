import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { verifyPassword, signSession, createSessionCookie } from "@/lib/auth";

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
  if (!email || !password) {
    return NextResponse.json({ error: "email and password required" }, { status: 400, headers: CORS_HEADERS });
  }

  try {
    const db = getDb();
    const row = db.prepare("SELECT id, email, password_hash FROM users WHERE email = ?").get(email) as
      | { id: string; email: string; password_hash: string }
      | undefined;
    if (!row || !row.password_hash) {
      return NextResponse.json({ error: "invalid credentials" }, { status: 401, headers: CORS_HEADERS });
    }
    // placeholder oauth hash starts with $2b$10$oauthplaceholder — will never verify (bcrypt compare false)
    const ok = await verifyPassword(password, row.password_hash);
    if (!ok) {
      return NextResponse.json({ error: "invalid credentials" }, { status: 401, headers: CORS_HEADERS });
    }
    const sess = await signSession(row.id);
    const isProd = process.env.NODE_ENV === "production";
    const cookie = createSessionCookie(sess.jwt, { secure: isProd });
    const res = NextResponse.json(
      { ok: true, user_id: row.id, expires_at: sess.expiresAt },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0", ...CORS_HEADERS } }
    );
    res.headers.set("Set-Cookie", cookie);
    return res;
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "login failed" }, { status: 500, headers: CORS_HEADERS });
  }
}
