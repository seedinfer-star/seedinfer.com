/**
 * lib/admin-auth.ts — fail-closed admin token guard.
 *
 * Reads ADMIN_TOKEN || SEEDINFER_ADMIN_TOKEN || SEEDINFER_ADMIN_TOKEN_ALT.
 * - None configured -> deny with 503 { ok:false, error, code:"admin_disabled" }.
 * - Otherwise the caller must send the token as `x-admin-token` or as a
 *   Bearer value; compared with crypto.timingSafeEqual over sha256 digests.
 *   Mismatch -> 401 { ok:false, error, code:"unauthorized" }.
 */
import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

export function getConfiguredAdminToken(): string {
  return (
    process.env.ADMIN_TOKEN ||
    process.env.SEEDINFER_ADMIN_TOKEN ||
    process.env.SEEDINFER_ADMIN_TOKEN_ALT ||
    ""
  );
}

function sha256(s: string): Buffer {
  return createHash("sha256").update(s, "utf8").digest();
}

export type AdminCheck = { ok: true } | { ok: false; response: NextResponse };

export function checkAdmin(req: Request): AdminCheck {
  const expected = getConfiguredAdminToken();
  if (!expected) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          ok: false,
          error: "Admin API is disabled — set ADMIN_TOKEN to enable it.",
          code: "admin_disabled",
        },
        { status: 503, headers: NO_STORE }
      ),
    };
  }
  const provided =
    req.headers.get("x-admin-token") ||
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ||
    "";
  const a = sha256(provided);
  const b = sha256(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return {
      ok: false,
      response: NextResponse.json(
        { ok: false, error: "Unauthorized — missing or invalid admin token.", code: "unauthorized" },
        { status: 401, headers: NO_STORE }
      ),
    };
  }
  return { ok: true };
}
