/**
 * lib/node-auth.ts — shared Bearer extraction for node-token authed routes.
 * (Same pattern as the heartbeat handler: `Authorization: Bearer sipn_...`.)
 */

/** Extract the raw Bearer secret, or null when the header is missing/malformed. */
export function extractBearerToken(req: Request): string | null {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const token = (m?.[1] || "").trim();
  return token || null;
}
