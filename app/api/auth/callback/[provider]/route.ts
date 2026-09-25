import { NextResponse } from "next/server";
import { createSessionCookie, getRequestSession, parseCookies, signSession } from "@/lib/auth";
import { linkIdentityToUser, signInWithOAuth } from "@/lib/accounts";
import {
  callbackUrl,
  clearOAuthCookies,
  isOAuthProvider,
  sanitizeNext,
  type OAuthProvider,
} from "@/lib/oauth/flow";
import { exchangeCodeForProfile as githubProfile } from "@/lib/oauth/github";
import { exchangeCodeForProfile as googleProfile } from "@/lib/oauth/google";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function loginRedirect(base: string, error: string): NextResponse {
  const res = NextResponse.redirect(`${base}/login?error=${encodeURIComponent(error)}`, 302);
  for (const c of clearOAuthCookies()) res.headers.append("Set-Cookie", c);
  return res;
}

function errorMessage(provider: OAuthProvider, err: unknown): string {
  const msg = (err as any)?.message ? String((err as any).message) : "";
  console.error(`[oauth callback ${provider}]`, msg.slice(0, 200));
  if (/not available yet/i.test(msg)) return "provider_unavailable";
  if (/token exchange failed \(\d+\)|oauth error|userinfo|missing id\/email|missing account id|no access token/i.test(msg)) {
    return `oauth_failed_${provider}`;
  }
  return `oauth_failed_${provider}`;
}

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: raw } = await ctx.params;
  const provider = String(raw || "").toLowerCase();
  if (!isOAuthProvider(provider)) {
    return NextResponse.json({ error: "unsupported provider" }, { status: 400 });
  }
  const base = (process.env.OAUTH_REDIRECT_BASE || process.env.NEXT_PUBLIC_SITE_URL || "https://seedinfer.com").replace(/\/+$/, "");

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  if (err) return loginRedirect(base, err === "access_denied" ? "access_denied" : err);
  if (!code || !state) return loginRedirect(base, "missing_code_or_state");

  const cookies = parseCookies(req.headers.get("cookie"));
  const next = sanitizeNext(cookies["oauth_next"]);
  const linkIntent = cookies["oauth_link"] === "1";
  const linkSession = cookies["oauth_session"] || null;

  if (!cookies["oauth_state"] || cookies["oauth_state"] !== state) return loginRedirect(base, "invalid_state");
  if (cookies["oauth_provider"] && cookies["oauth_provider"] !== provider) return loginRedirect(base, "provider_mismatch");
  const verifier = cookies["oauth_verifier"] || "";
  if (!verifier) return loginRedirect(base, "invalid_state");

  const redirectUri = callbackUrl(provider, req);
  let profile;
  try {
    profile = provider === "google" ? await googleProfile(code, verifier, redirectUri) : await githubProfile(code, verifier, redirectUri);
  } catch (e) {
    return loginRedirect(base, errorMessage(provider, e));
  }
  if (!profile.email) return loginRedirect(base, "oauth_no_email");

  // Explicit link flow (started from Settings with ?link=1): the current session must be the one
  // that started the flow, otherwise someone could attach their identity to a victim's account.
  if (linkIntent) {
    const sess = await getRequestSession(req);
    if (!sess || (linkSession && sess.token !== linkSession)) return loginRedirect(base, "link_needs_login");
    const r = linkIdentityToUser(sess.userId, provider, profile);
    if (!r.ok) {
      const res = NextResponse.redirect(`${base}/settings?error=${encodeURIComponent(r.error)}`, 302);
      for (const c of clearOAuthCookies()) res.headers.append("Set-Cookie", c);
      return res;
    }
    const res = NextResponse.redirect(`${base}/settings?linked=${provider}`, 302);
    for (const c of clearOAuthCookies()) res.headers.append("Set-Cookie", c);
    return res;
  }

  const outcome = signInWithOAuth(provider, profile);
  if (!outcome.ok) return loginRedirect(base, outcome.error);

  let jwt: string;
  try {
    const ua = req.headers.get("user-agent");
    const sess = await signSession(outcome.userId, { userAgent: ua, method: provider });
    jwt = sess.jwt;
  } catch (e: any) {
    console.error("[oauth signSession]", e?.message || e);
    return loginRedirect(base, "session_failed");
  }

  const res = NextResponse.redirect(new URL(next, base).toString(), 302);
  const maxAge = 7 * 24 * 3600;
  res.headers.set("Set-Cookie", createSessionCookie(jwt, { maxAgeSec: maxAge, secure: process.env.NODE_ENV === "production" }));
  for (const c of clearOAuthCookies()) res.headers.append("Set-Cookie", c);
  return res;
}
