import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import {
  clearSessionCookie,
  getRequestSession,
  hashPassword,
  isSameOriginRequest,
  revokeUserSessions,
  verifyPassword,
} from "@/lib/auth";
import {
  deleteAccount,
  exportUserData,
  getAccountSnapshot,
  isFreshSession,
  isOAuthOnlyAccount,
  unlinkIdentity,
} from "@/lib/accounts";

const REAUTH = { error: "For security, sign in again (less than 15 minutes ago) to do this.", code: "reauth_required" };
import { isOAuthProvider } from "@/lib/oauth/flow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

function unauth() {
  return NextResponse.json({ error: "unauthorized" }, { status: 401, headers: NO_STORE });
}

function forbidden() {
  return NextResponse.json({ error: "forbidden — same-origin requests only" }, { status: 403, headers: NO_STORE });
}

/** GET: account snapshot (profile, links, sessions, balance) or ?export=1 for the full data export. */
export async function GET(req: Request) {
  const sess = await getRequestSession(req);
  if (!sess) return unauth();
  const url = new URL(req.url);
  if (url.searchParams.get("export") === "1") {
    const data = exportUserData(sess.userId);
    if (!data) return NextResponse.json({ error: "user not found" }, { status: 404, headers: NO_STORE });
    return NextResponse.json({ ok: true, ...data }, { headers: NO_STORE });
  }
  const snap = getAccountSnapshot(sess.userId, sess.token);
  if (!snap) return NextResponse.json({ error: "user not found" }, { status: 404, headers: NO_STORE });
  return NextResponse.json({ ok: true, ...snap }, { headers: NO_STORE });
}

/**
 * PATCH actions (JSON body { action, ... }):
 * - display_name { name } — set/change display name (1..60 chars) or clear with "".
 * - set_password { password, current? } — set the first password (OAuth-only accounts) or change it
 *   (requires the current one). Revokes all other sessions.
 * - unlink { provider } — detach a provider (blocked for the last sign-in method).
 * - signout_others — revoke every session except the current one.
 */
export async function PATCH(req: Request) {
  const sess = await getRequestSession(req);
  if (!sess) return unauth();
  if (!isSameOriginRequest(req)) return forbidden();
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400, headers: NO_STORE });
  }
  const action = String(body.action || "");

  if (action === "display_name") {
    const name = String(body.name ?? "").trim().slice(0, 60);
    getDb()
      .prepare("UPDATE users SET display_name = ?, updated_at = ? WHERE id = ?")
      .run(name || null, new Date().toISOString(), sess.userId);
    return NextResponse.json({ ok: true, display_name: name || null }, { headers: NO_STORE });
  }

  if (action === "set_password") {
    const password = String(body.password || "");
    if (password.length < 8) {
      return NextResponse.json({ error: "password too short (min 8 chars)" }, { status: 400, headers: NO_STORE });
    }
    const db = getDb();
    const row = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(sess.userId) as
      | { password_hash: string }
      | undefined;
    if (!row) return NextResponse.json({ error: "user not found" }, { status: 404, headers: NO_STORE });
    if (!isOAuthOnlyAccount(row.password_hash)) {
      const ok = await verifyPassword(String(body.current || ""), row.password_hash);
      if (!ok) return NextResponse.json({ error: "current password is incorrect" }, { status: 403, headers: NO_STORE });
    } else if (!isFreshSession(sess.token)) {
      // First password on an OAuth-only account: no old password to check, so require a fresh sign-in.
      return NextResponse.json(REAUTH, { status: 403, headers: NO_STORE });
    }
    const hash = await hashPassword(password);
    db.prepare("UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?").run(hash, new Date().toISOString(), sess.userId);
    const revoked = revokeUserSessions(sess.userId, sess.token);
    return NextResponse.json({ ok: true, other_sessions_revoked: revoked }, { headers: NO_STORE });
  }

  if (action === "unlink") {
    const provider = String(body.provider || "").toLowerCase();
    if (!isOAuthProvider(provider)) {
      return NextResponse.json({ error: "unsupported provider" }, { status: 400, headers: NO_STORE });
    }
    const r = unlinkIdentity(sess.userId, provider);
    if (!r.ok) {
      const msg = r.error === "last_method" ? "refusing: this is your only sign-in method — set a password first" : "provider not linked";
      return NextResponse.json({ error: msg }, { status: 400, headers: NO_STORE });
    }
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  }

  if (action === "signout_others") {
    const revoked = revokeUserSessions(sess.userId, sess.token);
    return NextResponse.json({ ok: true, revoked }, { headers: NO_STORE });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400, headers: NO_STORE });
}

/**
 * DELETE: delete the whole account. Requires { confirm_email } matching the account email.
 * Removes profile, links, sessions, credits and invoices; usage rows are anonymized.
 */
export async function DELETE(req: Request) {
  const sess = await getRequestSession(req);
  if (!sess) return unauth();
  if (!isSameOriginRequest(req)) return forbidden();
  let body: any = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400, headers: NO_STORE });
  }
  const db = getDb();
  const row = db.prepare("SELECT email FROM users WHERE id = ?").get(sess.userId) as { email: string } | undefined;
  if (!row) return NextResponse.json({ error: "user not found" }, { status: 404, headers: NO_STORE });
  if (String(body.confirm_email || "").trim().toLowerCase() !== String(row.email).toLowerCase()) {
    return NextResponse.json({ error: "email confirmation does not match" }, { status: 400, headers: NO_STORE });
  }
  if (!isFreshSession(sess.token)) return NextResponse.json(REAUTH, { status: 403, headers: NO_STORE });
  const ok = deleteAccount(sess.userId);
  const res = NextResponse.json(ok ? { ok: true } : { error: "delete failed" }, { status: ok ? 200 : 500, headers: NO_STORE });
  if (ok) res.headers.append("Set-Cookie", clearSessionCookie());
  return res;
}
