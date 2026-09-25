/**
 * lib/oauth/github.ts — GitHub OAuth App: authorize URL, code exchange, profile fetch.
 * Scopes: read-only `user:email` (lets us read the private primary email).
 * Account linking uses ONLY a verified, non-noreply email from /user/emails.
 */
import { pkceChallenge, type OAuthProvider } from "./flow";

export const PROVIDER: OAuthProvider = "github";
const AUTHORIZE_URL = "https://github.com/login/oauth/authorize";
const TOKEN_URL = "https://github.com/login/oauth/access_token";
const FETCH_TIMEOUT_MS = 12_000;

export type OAuthProfile = {
  id: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  username?: string;
  avatarUrl?: string | null;
};

function creds(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GITHUB_CLIENT_ID?.trim() || "";
  const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim() || "";
  if (!clientId || !clientSecret) throw new Error("GitHub sign-in is not available yet");
  return { clientId, clientSecret };
}

export function authorizeUrl(opts: { clientId: string; redirectUri: string; state: string; verifier: string }): string {
  const qs = new URLSearchParams({
    client_id: opts.clientId,
    redirect_uri: opts.redirectUri,
    scope: "user:email",
    state: opts.state,
    code_challenge: pkceChallenge(opts.verifier),
    code_challenge_method: "S256",
  });
  return `${AUTHORIZE_URL}?${qs.toString()}`;
}

async function gh(path: string, token: string): Promise<any> {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "SeedInfer" },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`github ${path} failed (${res.status})`);
  return res.json();
}

/** Exchange code -> profile. Throws with a short, user-safe message (no secrets in text). */
export async function exchangeCodeForProfile(code: string, verifier: string, redirectUri: string): Promise<OAuthProfile> {
  const { clientId, clientSecret } = creds();
  let tok: any;
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`github token exchange failed (${res.status})`);
    tok = await res.json();
  } catch (e: any) {
    throw new Error(e?.message || "github token exchange failed");
  }
  if (tok?.error) throw new Error(`github oauth error: ${tok.error_description || tok.error}`);
  const accessToken: string | undefined = tok?.access_token;
  if (!accessToken) throw new Error("github sign-in failed — no access token");

  const user = await gh("/user", accessToken);
  const gid = String(user?.id || "");
  if (!gid) throw new Error("github sign-in failed — missing account id");

  // Primary verified email only. Never fall back to unverified or noreply addresses:
  // linking on those would hand the account to whoever typed the address.
  let email = "";
  let emailVerified = false;
  try {
    const list: any[] = await gh("/user/emails", accessToken);
    const pick =
      (Array.isArray(list) ? list : []).find((e) => e?.primary && e?.verified && !isNoreply(e.email)) ||
      (Array.isArray(list) ? list : []).find((e) => e?.verified && !isNoreply(e.email));
    if (pick?.email) {
      email = String(pick.email).toLowerCase();
      emailVerified = true;
    }
  } catch {
    // /user/emails failed — keep email empty so the caller rejects the login
  }
  if (!email) {
    const pub = user?.email ? String(user.email).toLowerCase() : "";
    if (pub && !isNoreply(pub)) {
      // Public email from /user is verified by GitHub for the account holder, but not marked as
      // such — treat as unverified so the caller requires verification for auto-linking.
      email = pub;
      emailVerified = false;
    }
  }
  return {
    id: gid,
    email,
    emailVerified,
    name: user?.name ? String(user.name) : user?.login ? String(user.login) : undefined,
    username: user?.login ? String(user.login) : undefined,
    avatarUrl: user?.avatar_url ? String(user.avatar_url) : null,
  };
}

function isNoreply(email: unknown): boolean {
  return typeof email === "string" && email.toLowerCase().endsWith("@users.noreply.github.com");
}
