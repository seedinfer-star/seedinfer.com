import { NextResponse } from "next/server";
import { parseCookies, extractJwtFromRequest, verifySession, revokeSession, clearSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

async function doLogout(req: Request): Promise<NextResponse> {
  const jwt = extractJwtFromRequest(req as any);
  if (jwt) {
    try {
      const sess = await verifySession(jwt);
      if (sess?.token) revokeSession(sess.token);
      else {
        // fallback: decode jti without verify to attempt revoke
        try {
          const parts = jwt.split(".");
          const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
          if (payload?.jti) revokeSession(String(payload.jti));
        } catch {}
      }
    } catch {}
  } else {
    // also try cookie manual parse if extract failed due to header casing
    const cookies = parseCookies(req.headers.get("cookie"));
    const raw = cookies[SESSION_COOKIE_NAME];
    if (raw) {
      try {
        const sess = await verifySession(raw);
        if (sess?.token) revokeSession(sess.token);
      } catch {}
    }
  }
  const res = NextResponse.json({ ok: true }, { status: 200, headers: { "Cache-Control": "no-store, max-age=0", ...CORS_HEADERS } });
  res.headers.set("Set-Cookie", clearSessionCookie());
  // redirect support: if GET with Accept html, redirect to /
  const accept = req.headers.get("accept") || "";
  const url = new URL(req.url);
  const wantRedirect = url.searchParams.get("redirect") === "1" || accept.includes("text/html");
  if (wantRedirect) {
    const r2 = NextResponse.redirect(new URL("/login", url.origin).toString(), 302);
    r2.headers.set("Set-Cookie", clearSessionCookie());
    // also clear oauth cookies
    const clr = `Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    r2.headers.append("Set-Cookie", `oauth_state=; ${clr}`);
    r2.headers.append("Set-Cookie", `oauth_verifier=; ${clr}`);
    r2.headers.append("Set-Cookie", `oauth_provider=; ${clr}`);
    return r2;
  }
  return res;
}

export async function POST(req: Request) {
  return doLogout(req);
}
export async function GET(req: Request) {
  return doLogout(req);
}
