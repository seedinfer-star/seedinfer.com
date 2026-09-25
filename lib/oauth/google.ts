/**
 * lib/oauth/google.ts — Google OAuth 2.0 (OpenID Connect): authorize URL, code exchange, profile fetch.
 * Scopes: `openid email profile`. Identity comes from the OIDC userinfo endpoint with the
 * access token — no signature verification needed, and the `sub` claim is the stable id.
 */
import { pkceChallenge, type OAuthProvider } from "./flow";

export const PROVIDER: OAuthProvider = "google";
const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const FETCH_TIMEOUT_MS = 12_000;

export type OAuthProfile = {
  id: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  avatarUrl?: string | null;
};

function creds(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() || "";
  if (!clientId || !clientSecret) throw new Error("Google sign-in is not available yet");
  return { clientId, clientSecret };
}

export function authorizeUrl(opts: { clientId: string; redirectUri: string; state: string; verifier: string }): string {
  const qs = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state: opts.state,
    code_challenge: pkceChallenge(opts.verifier),
    code_challenge_method: "S256",
    access_type: "online",
    prompt: "select_account",
  });
  return `${AUTHORIZE_URL}?${qs.toString()}`;
}

/** Decode (not verify) an ID token payload — only used as a hint when userinfo fails. */
function decodeIdToken(idToken: string | undefined): { sub?: string; email?: string; emailVerified?: boolean; name?: string; avatarUrl?: string | null } {
  if (!idToken) return {};
  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) return {};
    const p = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    return {
      sub: p?.sub ? String(p.sub) : undefined,
      email: p?.email ? String(p.email).toLowerCase() : undefined,
      emailVerified: !!p?.email_verified,
      name: p?.name ? String(p.name) : undefined,
      avatarUrl: p?.picture ? String(p.picture) : null,
    };
  } catch {
    return {};
  }
}

/** Exchange code -> profile. Throws with a short, user-safe message (no secrets in text). */
export async function exchangeCodeForProfile(code: string, verifier: string, redirectUri: string): Promise<OAuthProfile> {
  const { clientId, clientSecret } = creds();
  let tok: any;
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        code_verifier: verifier,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }).toString(),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`google token exchange failed (${res.status})`);
    tok = await res.json();
  } catch (e: any) {
    throw new Error(e?.message || "google token exchange failed");
  }
  const accessToken: string | undefined = tok?.access_token;
  if (!accessToken) throw new Error("google sign-in failed — no access token");
  const idHint = decodeIdToken(tok?.id_token);

  let ui: any = null;
  try {
    const res = await fetch(USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (res.ok) ui = await res.json();
  } catch {}
  if (!ui && idHint.sub && idHint.email) {
    // Userinfo hiccup — the access token was issued to us by Google, so the id_token it came
    // with is trustworthy enough as a fallback (aud check skipped only on this fallback path).
    ui = { sub: idHint.sub, email: idHint.email, email_verified: idHint.emailVerified, name: idHint.name, picture: idHint.avatarUrl };
  }
  const id = String(ui?.sub || "");
  const email = String(ui?.email || "").toLowerCase();
  if (!id || !email) throw new Error("google sign-in failed — missing id/email");
  return {
    id,
    email,
    emailVerified: ui?.email_verified === true || ui?.email_verified === "true" || (!!idHint.emailVerified && idHint.email === email),
    name: ui?.name ? String(ui.name) : undefined,
    avatarUrl: ui?.picture ? String(ui.picture) : null,
  };
}
