/**
 * lib/oauth/flow.ts — shared OAuth 2.0 authorization-code helpers (GitHub + Google).
 * State + PKCE verifier live in short-lived HttpOnly cookies; the post-login
 * destination (`next`) and the link-account intent are cookies too, because the
 * provider strips query params on the way back to the callback.
 */
import { randomBytes, createHash } from "crypto";

export type OAuthProvider = "google" | "github";

export function isOAuthProvider(v: string): v is OAuthProvider {
  return v === "google" || v === "github";
}

export function oauthEnabled(): boolean {
  const v = (process.env.OAUTH_ENABLED ?? "true").toLowerCase();
  return v !== "false" && v !== "0";
}

export function providerConfigured(p: OAuthProvider): boolean {
  if (p === "google") return !!(process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim());
  return !!(process.env.GITHUB_CLIENT_ID?.trim() && process.env.GITHUB_CLIENT_SECRET?.trim());
}

export function configuredProviders(): OAuthProvider[] {
  if (!oauthEnabled()) return [];
  return (["google", "github"] as OAuthProvider[]).filter(providerConfigured);
}

/** Base used for redirect_uri — must match the OAuth app registration exactly. */
export function getRedirectBase(req?: Request): string {
  const envBase = process.env.OAUTH_REDIRECT_BASE?.trim().replace(/\/+$/, "");
  if (envBase) return envBase;
  if (req) {
    try {
      const u = new URL(req.url);
      const proto =
        req.headers.get("x-forwarded-proto") ||
        (process.env.NODE_ENV === "production" ? "https" : u.protocol.replace(":", ""));
      const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || u.host;
      return `${proto}://${host}`;
    } catch {}
  }
  return "https://seedinfer.com";
}

export function callbackUrl(provider: OAuthProvider, req?: Request): string {
  return `${getRedirectBase(req)}/api/auth/callback/${provider}`;
}

function b64url(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString("base64url");
}

export function newState(): string {
  return b64url(randomBytes(16));
}

export function newVerifier(): string {
  return b64url(randomBytes(32));
}

export function pkceChallenge(verifier: string): string {
  return b64url(createHash("sha256").update(verifier).digest());
}

/** Only relative in-site paths may be used as post-login destination. */
export function sanitizeNext(v: string | null | undefined, fallback = "/billing"): string {
  if (v && v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") && v.length < 500) return v;
  return fallback;
}

function cookieOpts(maxAgeSec: number): string {
  const isProd = process.env.NODE_ENV === "production";
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${isProd ? "; Secure" : ""}`;
}

export const OAUTH_COOKIES = ["oauth_state", "oauth_verifier", "oauth_provider", "oauth_next", "oauth_link", "oauth_session"] as const;

export function oauthStartCookies(opts: {
  state: string;
  verifier: string;
  provider: OAuthProvider;
  next: string;
  link: boolean;
  linkSessionToken?: string | null;
}): string[] {
  const base = cookieOpts(300);
  const out = [
    `oauth_state=${encodeURIComponent(opts.state)}; ${base}`,
    `oauth_verifier=${encodeURIComponent(opts.verifier)}; ${base}`,
    `oauth_provider=${encodeURIComponent(opts.provider)}; ${base}`,
    `oauth_next=${encodeURIComponent(opts.next)}; ${base}`,
  ];
  if (opts.link) {
    out.push(`oauth_link=1; ${base}`);
    if (opts.linkSessionToken) out.push(`oauth_session=${encodeURIComponent(opts.linkSessionToken)}; ${base}`);
  }
  return out;
}

export function clearOAuthCookies(): string[] {
  const clr = `Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${
    process.env.NODE_ENV === "production" ? "; Secure" : ""
  }`;
  return OAUTH_COOKIES.map((c) => `${c}=; ${clr}`);
}

export { OAUTH_ERROR_MESSAGES, oauthErrorMessage } from "./messages";
