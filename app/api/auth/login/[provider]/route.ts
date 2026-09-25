import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth";
import {
  callbackUrl,
  isOAuthProvider,
  newState,
  newVerifier,
  oauthEnabled,
  oauthStartCookies,
  providerConfigured,
  sanitizeNext,
} from "@/lib/oauth/flow";
import { authorizeUrl as githubAuthorizeUrl } from "@/lib/oauth/github";
import { authorizeUrl as googleAuthorizeUrl } from "@/lib/oauth/google";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function loginRedirect(error: string): NextResponse {
  const base = (process.env.OAUTH_REDIRECT_BASE || process.env.NEXT_PUBLIC_SITE_URL || "https://seedinfer.com").replace(/\/+$/, "");
  return NextResponse.redirect(`${base}/login?error=${encodeURIComponent(error)}`, 302);
}

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: raw } = await ctx.params;
  const provider = String(raw || "").toLowerCase();
  if (!isOAuthProvider(provider)) {
    return NextResponse.json({ error: "unsupported provider, use google or github" }, { status: 400 });
  }
  if (!oauthEnabled()) return loginRedirect("oauth_disabled");
  if (!providerConfigured(provider)) return loginRedirect("provider_unavailable");

  // ?link=1 from Settings: bind the intent to the current session so the callback can only
  // attach the new identity to the account that started the flow.
  const url = new URL(req.url);
  const link = url.searchParams.get("link") === "1";
  let linkSessionToken: string | null = null;
  if (link) {
    const sess = await getRequestSession(req);
    if (!sess) return loginRedirect("link_needs_login");
    linkSessionToken = sess.token;
  }

  const state = newState();
  const verifier = newVerifier();
  const next = sanitizeNext(url.searchParams.get("next"));
  const redirectUri = callbackUrl(provider, req);
  const clientId = (provider === "google" ? process.env.GOOGLE_CLIENT_ID : process.env.GITHUB_CLIENT_ID)?.trim() || "";
  const location =
    provider === "google"
      ? googleAuthorizeUrl({ clientId, redirectUri, state, verifier })
      : githubAuthorizeUrl({ clientId, redirectUri, state, verifier });

  const res = NextResponse.redirect(location, 302);
  for (const c of oauthStartCookies({ state, verifier, provider, next, link, linkSessionToken })) {
    res.headers.append("Set-Cookie", c);
  }
  return res;
}
