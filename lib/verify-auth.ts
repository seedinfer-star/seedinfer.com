/**
 * lib/verify-auth.ts — auth gate for POST /api/v1/providers/verify.
 *
 * A verify call is allowed when the caller EITHER:
 *  (a) presents a valid node token (`Authorization: Bearer sipn_…`) whose
 *      user owns the requested provider_id per the provider_nodes table, OR
 *  (b) passes the admin guard (checkAdmin: x-admin-token or Bearer admin token).
 *
 * Ordering matters: a `sipn_…` bearer always takes the node path (so node
 * callers never see the admin guard's 401/503), an explicit `x-admin-token`
 * header always takes the admin path, any other bearer is treated as an
 * admin-token attempt, and no credentials at all is node_token_missing.
 *
 * Denials use the shared `{ ok:false, error, code }` body shape:
 *  401 node_token_missing / node_token_invalid, 403 node_not_owned.
 */
import { NextResponse } from "next/server";
import { checkAdmin } from "./admin-auth";
import { verifyNodeToken, getNodeOwner } from "./provider-tokens";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

function deny(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ ok: false, error: message, code }, { status, headers: NO_STORE });
}

function extractBearer(req: Request): string | null {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const token = (m?.[1] || "").trim();
  return token || null;
}

export type VerifyAuth = { ok: true; via: "node" | "admin" } | { ok: false; response: NextResponse };

export function checkVerifyAuth(req: Request, nodeId: string): VerifyAuth {
  // Explicit admin header always takes the admin path.
  if (req.headers.get("x-admin-token")) {
    const admin = checkAdmin(req);
    if (admin.ok) return { ok: true, via: "admin" };
    return { ok: false, response: admin.response };
  }
  const bearer = extractBearer(req);
  if (bearer && bearer.startsWith("sipn_")) {
    const verified = verifyNodeToken(bearer);
    if (!verified) {
      return {
        ok: false,
        response: deny(
          "node_token_invalid",
          "Unknown or revoked node token — create a new one in /provider/portal.",
          401
        ),
      };
    }
    const owner = getNodeOwner(nodeId);
    if (!owner || String(owner.userId) !== String(verified.userId)) {
      return {
        ok: false,
        response: deny("node_not_owned", "This node id is not bound to your account.", 403),
      };
    }
    return { ok: true, via: "node" };
  }
  if (bearer) {
    // Non-sipn bearer: admin-token attempt.
    const admin = checkAdmin(req);
    if (admin.ok) return { ok: true, via: "admin" };
    return { ok: false, response: admin.response };
  }
  return {
    ok: false,
    response: deny(
      "node_token_missing",
      "Missing node token — send Authorization: Bearer sipn_... (SEEDINFER_NODE_TOKEN).",
      401
    ),
  };
}
