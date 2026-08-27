import { NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getDb } from "@/lib/db";
import { signSession, createSessionCookie, SESSION_COOKIE_NAME } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Provider = "google" | "github";

// minimal cookie parser reuse — duplicate from lib/auth to avoid coupling
function parseCookies(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i === -1) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

function getRedirectBase(req: Request): string {
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

function badRedirect(base: string, error: string): NextResponse {
  const url = new URL(`${base}/login`);
  url.searchParams.set("error", error);
  const res = NextResponse.redirect(url.toString(), 302);
  // clear oauth cookies
  const clr = `Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  res.headers.append("Set-Cookie", `oauth_state=; ${clr}`);
  res.headers.append("Set-Cookie", `oauth_verifier=; ${clr}`);
  res.headers.append("Set-Cookie", `oauth_provider=; ${clr}`);
  return res;
}

export async function GET(req: Request, ctx: { params: Promise<{ provider: string }> }) {
  const { provider: raw } = await ctx.params;
  const provider = String(raw || "").toLowerCase() as Provider;
  if (provider !== "google" && provider !== "github") {
    return NextResponse.json({ error: "unsupported provider" }, { status: 400 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");

  const redirectBase = getRedirectBase(req);

  if (err) {
    return badRedirect(redirectBase, err);
  }
  if (!code || !state) {
    return badRedirect(redirectBase, "missing_code_or_state");
  }

  const cookies = parseCookies(req.headers.get("cookie"));
  const expectedState = cookies["oauth_state"];
  const verifier = cookies["oauth_verifier"];
  const cookieProvider = cookies["oauth_provider"];

  if (!expectedState || expectedState !== state) {
    return badRedirect(redirectBase, "invalid_state");
  }
  if (cookieProvider && cookieProvider !== provider) {
    return badRedirect(redirectBase, "provider_mismatch");
  }

  const redirectUri = `${redirectBase}/api/auth/callback/${provider}`;

  let profile: { id: string; email: string; email_verified?: boolean; name?: string; avatar_url?: string | null } | null = null;

  try {
    if (provider === "google") {
      // Element requires refinement — set GOOGLE_CLIENT_ID etc
      const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
      if (!clientId || !clientSecret) throw new Error("Element requires refinement — set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET");
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          code_verifier: verifier || "",
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        }).toString(),
      });
      if (!tokenRes.ok) {
        const t = await tokenRes.text().catch(() => "");
        throw new Error(`google token exchange failed ${tokenRes.status}: ${t.slice(0, 400)}`);
      }
      const tok: any = await tokenRes.json();
      const accessToken: string | undefined = tok.access_token;
      const idToken: string | undefined = tok.id_token;
      // Try userinfo with access_token (RK3588 light — no JWKS verification, use userinfo endpoint)
      if (!accessToken) throw new Error("google missing access_token");
      // Prefer decoding id_token if present for email_verified, but verify via userinfo
      let emailViaIdToken: string | null = null;
      let emailVerifiedViaId = false;
      let avatarViaId: string | null = null;
      let nameViaId: string | null = null;
      let subViaId: string | null = null;
      if (idToken) {
        try {
          const parts = idToken.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
            if (payload?.email) emailViaIdToken = String(payload.email);
            if (payload?.email_verified) emailVerifiedViaId = !!payload.email_verified;
            if (payload?.picture) avatarViaId = String(payload.picture);
            if (payload?.name) nameViaId = String(payload.name);
            if (payload?.sub) subViaId = String(payload.sub);
          }
        } catch {}
      }
      const uiRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!uiRes.ok) {
        const t = await uiRes.text().catch(() => "");
        // fallback to id_token payload if userinfo fails but we have id_token email
        if (emailViaIdToken && subViaId) {
          profile = { id: subViaId, email: emailViaIdToken.toLowerCase(), email_verified: emailVerifiedViaId, name: nameViaId || undefined, avatar_url: avatarViaId || null };
        } else {
          throw new Error(`google userinfo failed ${uiRes.status}: ${t.slice(0, 400)}`);
        }
      } else {
        const u: any = await uiRes.json();
        const pid = String(u.id || subViaId || "");
        if (!pid || !u.email) throw new Error("google profile missing id/email");
        profile = {
          id: pid,
          email: String(u.email).toLowerCase(),
          email_verified: typeof u.verified_email === "boolean" ? !!u.verified_email : emailVerifiedViaId,
          name: u.name ? String(u.name) : nameViaId || undefined,
          avatar_url: u.picture ? String(u.picture) : avatarViaId || null,
        };
      }
    } else {
      // github
      const clientId = process.env.GITHUB_CLIENT_ID?.trim();
      const clientSecret = process.env.GITHUB_CLIENT_SECRET?.trim();
      if (!clientId || !clientSecret) throw new Error("Element requires refinement — set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET");
      const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          redirect_uri: redirectUri,
          code_verifier: verifier || undefined,
        }),
      });
      if (!tokenRes.ok) {
        const t = await tokenRes.text().catch(() => "");
        throw new Error(`github token exchange failed ${tokenRes.status}: ${t.slice(0, 400)}`);
      }
      const tok: any = await tokenRes.json();
      if (tok.error) throw new Error(`github oauth error: ${tok.error_description || tok.error}`);
      const accessToken: string | undefined = tok.access_token;
      if (!accessToken) throw new Error("github missing access_token");
      const userRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json", "User-Agent": "SeedInfer" },
      });
      if (!userRes.ok) {
        const t = await userRes.text().catch(() => "");
        throw new Error(`github /user failed ${userRes.status}: ${t.slice(0, 400)}`);
      }
      const gu: any = await userRes.json();
      const gid = String(gu.id || "");
      let email = gu.email ? String(gu.email).toLowerCase() : "";
      let emailVerified = false;
      // emails endpoint for primary verified
      try {
        const emRes = await fetch("https://api.github.com/user/emails", {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/vnd.github+json", "User-Agent": "SeedInfer" },
        });
        if (emRes.ok) {
          const list: any[] = await emRes.json();
          const primary = list.find((e: any) => e.primary && e.verified) || list.find((e: any) => e.verified) || list[0];
          if (primary?.email) {
            email = String(primary.email).toLowerCase();
            emailVerified = !!primary.verified;
          }
        }
      } catch {}
      if (!gid) throw new Error("github missing id");
      if (!email) {
        // Fallback: gh noreply e.g. 123+login@users.noreply.github.com — still allow but mark unverified; user may be created with noreply
        if (gu.login) email = `${gu.login}@users.noreply.github.com`.toLowerCase();
        else throw new Error("github email not available — grant user:email scope");
      }
      profile = {
        id: gid,
        email,
        email_verified: emailVerified,
        name: gu.name ? String(gu.name) : gu.login ? String(gu.login) : undefined,
        avatar_url: gu.avatar_url ? String(gu.avatar_url) : null,
      };
    }
  } catch (e: any) {
    console.error(`[oauth callback ${provider}]`, e?.message || e);
    return badRedirect(redirectBase, `oauth_failed_${provider}`);
  }

  if (!profile || !profile.email) {
    return badRedirect(redirectBase, "oauth_no_email");
  }

  // Upsert users + oauth_accounts + credits
  const db = getDb();
  const now = new Date().toISOString();
  let userId: string;
  try {
    // Check existing oauth link
    const linked = db
      .prepare("SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_account_id = ?")
      .get(provider, String(profile.id)) as { user_id: string } | undefined;
    if (linked?.user_id) {
      userId = String(linked.user_id);
      // refresh oauth email/avatar if needed
      try {
        db.prepare("UPDATE oauth_accounts SET email = ?, created_at = COALESCE(created_at, ?) WHERE provider = ? AND provider_account_id = ?")
          .run(profile.email, now, provider, String(profile.id));
      } catch {}
      // update users avatar/email_verified if provided
      try {
        if (profile.avatar_url) {
          db.prepare("UPDATE users SET avatar_url = COALESCE(?, avatar_url), email_verified = COALESCE(?, email_verified) WHERE id = ?").run(
            profile.avatar_url,
            profile.email_verified ? 1 : null,
            userId
          );
        } else if (profile.email_verified) {
          db.prepare("UPDATE users SET email_verified = 1 WHERE id = ?").run(userId);
        }
      } catch {}
      // Ensure credits row exists
      try {
        const c = db.prepare("SELECT user_id FROM credits WHERE user_id = ?").get(userId) as any;
        if (!c) db.prepare("INSERT INTO credits (user_id, balance_usd_cents, updated_at) VALUES (?, 0, ?)").run(userId, now);
      } catch {}
    } else {
      // Find by email
      const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(profile.email) as { id: string } | undefined;
      if (existing?.id) {
        userId = String(existing.id);
        try {
          db.prepare(
            "INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id, email, created_at) VALUES (?, ?, ?, ?, ?, ?)"
          ).run(randomUUID(), userId, provider, String(profile.id), profile.email, now);
        } catch (e: any) {
          // race if unique violation — re-read link
          const again = db
            .prepare("SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_account_id = ?")
            .get(provider, String(profile.id)) as { user_id: string } | undefined;
          if (again?.user_id) userId = String(again.user_id);
          else throw e;
        }
        try {
          db.prepare("UPDATE users SET avatar_url = COALESCE(?, avatar_url), email_verified = CASE WHEN ? = 1 THEN 1 ELSE email_verified END WHERE id = ?").run(
            profile.avatar_url || null,
            profile.email_verified ? 1 : 0,
            userId
          );
        } catch {}
        try {
          const c = db.prepare("SELECT user_id FROM credits WHERE user_id = ?").get(userId) as any;
          if (!c) db.prepare("INSERT INTO credits (user_id, balance_usd_cents, updated_at) VALUES (?, 0, ?)").run(userId, now);
        } catch {}
      } else {
        userId = randomUUID();
        // create user with random password_hash placeholder (bcrypt 10 rounds fake hash still satisfies NOT NULL, won't verify)
        // Use placeholder $2b$10$... for oauth-only; password login will fail until user sets password via reset flow
        const placeholderHash = "$2b$10$oauthplaceholderhash0000000000000000000000000000000000";
        // Insert inside transaction if available
        const insertUser = () => {
          db.prepare(
            `INSERT INTO users (id, email, password_hash, wallet_address, email_verified, avatar_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
          ).run(userId, profile!.email, placeholderHash, null, profile!.email_verified ? 1 : 0, profile!.avatar_url || null, now);
          db.prepare(`INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id, email, created_at) VALUES (?, ?, ?, ?, ?, ?)`).run(
            randomUUID(),
            userId,
            provider,
            String(profile!.id),
            profile!.email,
            now
          );
          db.prepare(`INSERT INTO credits (user_id, balance_usd_cents, updated_at) VALUES (?, 0, ?)`).run(userId, now);
        };
        // Try transaction helper if db.transaction exists (better-sqlite3) — must keep `this`
        try {
          const txFn: any = (db as any).transaction;
          if (typeof txFn === "function") {
            const t = txFn.bind(db)(() => insertUser());
            t();
          } else {
            insertUser();
          }
        } catch (e: any) {
          // If UNIQUE on email raced, link to existing
          if (String(e?.message || "").toLowerCase().includes("unique")) {
            const again = db.prepare("SELECT id FROM users WHERE email = ?").get(profile.email) as { id: string } | undefined;
            if (again?.id) {
              userId = String(again.id);
              // ensure oauth_accounts inserted
              try {
                db.prepare(
                  "INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id, email, created_at) VALUES (?, ?, ?, ?, ?, ?)"
                ).run(randomUUID(), userId, provider, String(profile.id), profile.email, now);
              } catch {}
              try {
                const c = db.prepare("SELECT user_id FROM credits WHERE user_id = ?").get(userId) as any;
                if (!c) db.prepare("INSERT INTO credits (user_id, balance_usd_cents, updated_at) VALUES (?, 0, ?)").run(userId, now);
              } catch {}
            } else throw e;
          } else throw e;
        }
      }
    }
  } catch (e: any) {
    console.error("[oauth upsert]", e?.message || e);
    return badRedirect(redirectBase, "db_upsert_failed");
  }

  // Sign session (jose HS256)
  let jwt: string;
  try {
    const sess = await signSession(String(userId));
    jwt = sess.jwt;
  } catch (e: any) {
    console.error("[oauth signSession]", e?.message || e);
    return badRedirect(redirectBase, "session_failed");
  }

  // Success: set session cookie + clear oauth cookies, redirect to /billing or /
  const nextUrl = url.searchParams.get("next") || "/billing";
  // safety: only allow relative next
  const safeNext = nextUrl.startsWith("/") && !nextUrl.startsWith("//") ? nextUrl : "/billing";
  const dest = new URL(safeNext, redirectBase).toString();
  const res = NextResponse.redirect(dest, 302);
  const isProd = process.env.NODE_ENV === "production";
  const maxAge = 7 * 24 * 3600;
  const sessCookie = createSessionCookie(jwt, { maxAgeSec: maxAge, secure: isProd });
  // createSessionCookie returns "seedinfer_session=..."; ensure Path/HttpOnly etc already included
  res.headers.set("Set-Cookie", sessCookie);
  // Append clears for oauth cookies (multiple Set-Cookie)
  const clr = `Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${isProd ? "; Secure" : ""}`;
  res.headers.append("Set-Cookie", `oauth_state=; ${clr}`);
  res.headers.append("Set-Cookie", `oauth_verifier=; ${clr}`);
  res.headers.append("Set-Cookie", `oauth_provider=; ${clr}`);
  return res;
}
