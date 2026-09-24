import { NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Provider = "google" | "github";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GITHUB_AUTH = "https://github.com/login/oauth/authorize";

function b64url(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString("base64url");
}

function pkceChallenge(verifier: string): string {
  return b64url(createHash("sha256").update(verifier).digest());
}

function getRedirectBase(req: Request): string {
  // OAUTH_REDIRECT_BASE=https://seedinfer.com (task) else derive from request host
  const envBase = process.env.OAUTH_REDIRECT_BASE?.trim().replace(/\/$/, "");
  if (envBase) return envBase;
  try {
    const u = new URL(req.url);
    const proto = req.headers.get("x-forwarded-proto") || (process.env.NODE_ENV === "production" ? "https" : u.protocol.replace(":", ""));
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || u.host;
    return `${proto}://${host}`;
  } catch {
    return "https://seedinfer.com";
  }
}

function cookieOpts(maxAgeSec: number) {
  const isProd = process.env.NODE_ENV === "production";
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSec}${isProd ? "; Secure" : ""}`;
}

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: raw } = await ctx.params;
  const provider = String(raw || "").toLowerCase() as Provider;
  if (provider !== "google" && provider !== "github") {
    return NextResponse.json({ error: "unsupported provider, use google or github" }, { status: 400 });
  }

  // Element requires refinement — set GOOGLE_CLIENT_ID etc
  const googleId = process.env.GOOGLE_CLIENT_ID?.trim();
  const githubId = process.env.GITHUB_CLIENT_ID?.trim();
  const oauthEnabled = process.env.OAUTH_ENABLED ?? "true"; // default enabled if IDs present
  if (oauthEnabled === "false" || oauthEnabled === "0") {
    return NextResponse.json({ error: "OAuth disabled — set OAUTH_ENABLED=true and GOOGLE_CLIENT_ID/GITHUB_CLIENT_ID" }, { status: 503 });
  }

  if (provider === "google" && !googleId) {
    return NextResponse.json(
      { error: "Element requires refinement — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env (Google Cloud Console OAuth client)" },
      { status: 503 }
    );
  }
  if (provider === "github" && !githubId) {
    return NextResponse.json(
      { error: "Element requires refinement — set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env (GitHub OAuth App)" },
      { status: 503 }
    );
  }

  const state = b64url(randomBytes(16));
  const verifier = b64url(randomBytes(32));
  const challenge = pkceChallenge(verifier);

  const redirectBase = getRedirectBase(req);
  const redirectUri = `${redirectBase}/api/auth/callback/${provider}`;

  let location: string;
  if (provider === "google") {
    const qs = new URLSearchParams({
      client_id: googleId!,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      state,
      code_challenge: challenge,
      code_challenge_method: "S256",
      access_type: "offline",
      prompt: "consent",
    });
    location = `${GOOGLE_AUTH}?${qs.toString()}`;
  } else {
    const qs = new URLSearchParams({
      client_id: githubId!,
      redirect_uri: redirectUri,
      scope: "user:email",
      state,
    });
    // GitHub PKCE optional but we send verifier later; challenge not standardized for GitHub, we still store verifier
    // Include code_challenge if GitHub supports? Keep simple: not include, verifier will be sent on exchange.
    location = `${GITHUB_AUTH}?${qs.toString()}`;
  }

  const res = NextResponse.redirect(location, 302);
  // oauth_state + oauth_verifier 5min httpOnly
  const baseCookie = cookieOpts(300);
  res.headers.append("Set-Cookie", `oauth_state=${encodeURIComponent(state)}; ${baseCookie}`);
  res.headers.append("Set-Cookie", `oauth_verifier=${encodeURIComponent(verifier)}; ${baseCookie}`);
  // store provider to bind state to provider (defense)
  res.headers.append("Set-Cookie", `oauth_provider=${encodeURIComponent(provider)}; ${baseCookie}`);
  return res;
}
