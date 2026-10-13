import { NextResponse } from "next/server";
import { getRequestSession, isSameOriginRequest } from "@/lib/auth";
import { createApiKey, listApiKeys, revokeApiKey } from "@/lib/api-keys";
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
  const keys = listApiKeys(sess.userId);
  return NextResponse.json({ keys }, { headers: NO_STORE });
}

export async function POST(req: Request) {
  const sess = await getRequestSession(req);
  if (!sess) return unauth();
  if (!isSameOriginRequest(req)) return forbiddenOrigin();

  // 10 creations per hour per user.
  const rl = checkRateLimit(`api-keys:create:${sess.userId}`, 10, 3600_000);
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
  const rawName = body?.name === undefined ? "default" : String(body.name);
  const name = rawName.trim();
  if (name.length < 1 || name.length > 48) {
    return NextResponse.json({ ok: false, error: "Name must be 1..48 characters.", code: "invalid_name" }, { status: 400, headers: NO_STORE });
  }

  const created = createApiKey(sess.userId, name, {
    ip: getClientIp(req),
    userAgent: req.headers.get("user-agent"),
  });
  if ("error" in created) {
    return NextResponse.json(
      { ok: false, error: "Key limit reached (max 20 active keys) — revoke an old one first.", code: "key_limit" },
      { status: 409, headers: NO_STORE }
    );
  }
  return NextResponse.json(
    { key: { ...created.key }, secret: created.secret },
    { status: 201, headers: NO_STORE }
  );
}

export async function DELETE(req: Request) {
  const sess = await getRequestSession(req);
  if (!sess) return unauth();
  if (!isSameOriginRequest(req)) return forbiddenOrigin();

  let body: any = {};
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ ok: false, error: "Request body is not valid JSON.", code: "invalid_json" }, { status: 400, headers: NO_STORE });
  }
  const id = String(body?.id || "");
  if (!id) {
    return NextResponse.json({ ok: false, error: "Missing key id.", code: "invalid_id" }, { status: 400, headers: NO_STORE });
  }
  const res = revokeApiKey(sess.userId, id, { ip: getClientIp(req), userAgent: req.headers.get("user-agent") });
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: "Key not found.", code: "not_found" }, { status: 404, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
