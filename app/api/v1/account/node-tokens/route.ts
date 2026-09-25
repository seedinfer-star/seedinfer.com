import { NextResponse } from "next/server";
import { getRequestSession, isSameOriginRequest } from "@/lib/auth";
import { createNodeToken, listNodeTokens } from "@/lib/provider-tokens";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

function unauth() {
  return NextResponse.json({ error: "unauthorized", code: "unauthorized" }, { status: 401, headers: NO_STORE });
}

function forbiddenOrigin() {
  return NextResponse.json({ error: "forbidden — same-origin requests only", code: "forbidden_origin" }, { status: 403, headers: NO_STORE });
}

export async function GET(req: Request) {
  const sess = await getRequestSession(req);
  if (!sess) return unauth();
  const tokens = listNodeTokens(sess.userId);
  return NextResponse.json({ tokens }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  const sess = await getRequestSession(req);
  if (!sess) return unauth();
  if (!isSameOriginRequest(req)) return forbiddenOrigin();

  // 10 creations per hour per user.
  const rl = checkRateLimit(`node-tokens:create:${sess.userId}`, 10, 3600_000);
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
  const rawName = body?.name === undefined ? "node" : String(body.name);
  const name = rawName.trim();
  if (name.length < 1 || name.length > 48) {
    return NextResponse.json({ ok: false, error: "Name must be 1..48 characters.", code: "invalid_name" }, { status: 400, headers: NO_STORE });
  }

  const created = createNodeToken(sess.userId, name, {
    ip: getClientIp(req),
    userAgent: req.headers.get("user-agent"),
  });
  if ("error" in created) {
    return NextResponse.json(
      { ok: false, error: "Token limit reached (max 20 active tokens) — revoke an old one first.", code: "token_limit" },
      { status: 409, headers: NO_STORE }
    );
  }
  return NextResponse.json(
    { token: { ...created.token }, secret: created.secret },
    { status: 201, headers: NO_STORE }
  );
}
