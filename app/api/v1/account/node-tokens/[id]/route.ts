import { NextResponse } from "next/server";
import { getRequestSession, isSameOriginRequest } from "@/lib/auth";
import { revokeNodeToken } from "@/lib/provider-tokens";
import { getClientIp } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sess = await getRequestSession(req);
  if (!sess) {
    return NextResponse.json({ error: "unauthorized", code: "unauthorized" }, { status: 401, headers: NO_STORE });
  }
  if (!isSameOriginRequest(req)) {
    return NextResponse.json({ error: "forbidden — same-origin requests only", code: "forbidden_origin" }, { status: 403, headers: NO_STORE });
  }
  const { id } = await params;
  const r = revokeNodeToken(sess.userId, String(id || ""), {
    ip: getClientIp(req),
    userAgent: req.headers.get("user-agent"),
  });
  if (!r.ok) {
    return NextResponse.json({ ok: false, error: "Token not found.", code: "not_found" }, { status: 404, headers: NO_STORE });
  }
  return NextResponse.json({ ok: true }, { headers: NO_STORE });
}
