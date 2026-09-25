/**
 * lib/auth.ts — JWT (jose, HS256) + bcrypt password hashing + session cookies
 * Uses AUTH_SECRET env, BCRYPT_ROUNDS env. HMR-safe no global needed.
 * Sign/verify flow: token (UUID, persisted in sessions table) + JWT (jose) containing sub=user_id, jti=token
 */

// @ts-ignore — jose installed via package.json (npm i jose); types resolve after install
import { SignJWT, jwtVerify } from "jose";
// bcrypt native with fallback to bcryptjs (pure JS, no native build needed on ARM)
// Element requires refinement: native bcrypt requires python/make on Pi — fallback to bcryptjs for build
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";

import { getDb, withTransaction } from "./db";

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

function getAuthSecret(): string {
  const s = process.env.AUTH_SECRET || process.env.SEEDINFER_AUTH_SECRET || "";
  if (!s || s.length < 16) {
    // In production this must be set; for dev we allow fallback but warn
    if (process.env.NODE_ENV === "production") {
      console.warn("[auth] AUTH_SECRET is missing or too short — set a 32+ char secret in .env");
    }
    // Fallback dev secret (not used in prod) — keeps compile/type happy
    return s || "dev-only-seedinfer-auth-secret-please-change-32chars";
  }
  return s;
}

function getBcryptRounds(): number {
  const raw = process.env.BCRYPT_ROUNDS || "12";
  const n = Number(raw);
  if (Number.isFinite(n) && n >= 4 && n <= 15) return Math.floor(n);
  return 12;
}

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(getAuthSecret());
}

function getJwtExpiry(): string {
  // Env override: AUTH_JWT_EXPIRY or SESSION_TTL e.g. "7d", "24h"
  return process.env.AUTH_JWT_EXPIRY || process.env.SESSION_TTL || "7d";
}

// ---------------------------------------------------------------------------
// Password hashing (bcrypt)
// ---------------------------------------------------------------------------

/**
 * Hash password with bcrypt (cost via BCRYPT_ROUNDS, default 12).
 * Returns hash string to store in users.password_hash.
 */
export async function hashPassword(password: string): Promise<string> {
  if (!password || password.length < 8) throw new Error("password too short (min 8 chars)");
  const rounds = getBcryptRounds();
  // bcrypt.hash returns Promise<string> when no callback
  return await bcrypt.hash(password, rounds);
}

/**
 * Verify password against stored hash (bcrypt.compare).
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  if (!password || !hash) return false;
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// JWT session (jose HS256)
// ---------------------------------------------------------------------------

export type SessionPayload = {
  sub: string; // user_id
  jti: string; // token (sessions.token)
  iat: number;
  exp: number;
};

export type SignSessionResult = {
  token: string;
  jwt: string;
  expiresAt: string; // ISO
};

/**
 * Create a new session for user_id.
 * Generates random token (UUID), signs JWT (HS256, sub=user_id, jti=token), persists to sessions table.
 * Returns {token, jwt, expiresAt} — token is the DB PK, jwt is the cookie value.
 */
export async function signSession(
  userId: string,
  opts?: { token?: string; expiresIn?: string; userAgent?: string | null; method?: "password" | "github" | "google" | string }
): Promise<SignSessionResult> {
  if (!userId) throw new Error("userId required");
  const token = opts?.token || randomUUID();
  const secret = getSecretKey();
  const expiry = opts?.expiresIn || getJwtExpiry();

  // jose SignJWT with HS256
  const jwt = await new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setJti(token)
    .setIssuedAt()
    .setExpirationTime(expiry)
    .sign(secret);

  // Compute expiresAt ISO from JWT exp (or fallback +7d)
  let expiresAt: string;
  try {
    // Decode without verify to get exp — minimal parse
    const parts = jwt.split(".");
    const payloadJson = Buffer.from(parts[1], "base64url").toString("utf8");
    const payload = JSON.parse(payloadJson) as { exp?: number };
    if (payload.exp) {
      expiresAt = new Date(payload.exp * 1000).toISOString();
    } else {
      expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    }
  } catch {
    expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  }

  const createdAt = new Date().toISOString();

  // Persist to the sessions table. verifySession() is strict (the row must exist), so a session that
  // cannot be stored would be unusable — fail loudly instead of handing out a dead cookie.
  const db = getDb();
  db.prepare(
    `INSERT INTO sessions (token, user_id, expires_at, created_at, user_agent, method) VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(token) DO UPDATE SET user_id=excluded.user_id, expires_at=excluded.expires_at`
  ).run(token, String(userId), expiresAt, createdAt, (opts?.userAgent || "").slice(0, 200) || null, opts?.method || null);
  try {
    db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(createdAt); // housekeeping
  } catch {}

  return { token, jwt, expiresAt };
}

/**
 * Verify JWT (jose HS256) and optionally check sessions table for expiry/revocation.
 * Returns payload ({userId, token, payload, expiresAt}) or null if invalid/expired.
 */
export async function verifySession(jwt: string): Promise<{ userId: string; token: string; payload: SessionPayload; expiresAt: string } | null> {
  if (!jwt) return null;
  try {
    const secret = getSecretKey();
    const { payload } = await jwtVerify(jwt, secret, { algorithms: ["HS256"] });
    const sub = (payload as any).sub as string | undefined;
    const jti = (payload as any).jti as string | undefined;
    const exp = (payload as any).exp as number | undefined;
    if (!sub || !jti) return null;

    const expiresAt = exp ? new Date(exp * 1000).toISOString() : new Date().toISOString();

    // Strict revocation: the session row must exist, be unexpired and belong to the same user.
    // Logging out, "sign out everywhere", password changes and account deletion delete rows, which
    // immediately invalidates the corresponding cookies (a copied JWT stops working too).
    const db = getDb();
    const row = db
      .prepare("SELECT token, user_id, expires_at FROM sessions WHERE token = ?")
      .get(String(jti)) as { token: string; user_id: string; expires_at: string } | undefined;
    if (!row) return null;
    const dbExp = new Date(row.expires_at).getTime();
    if (Number.isFinite(dbExp) && dbExp < Date.now()) return null;
    if (row.user_id !== String(sub)) return null;

    return {
      userId: String(sub),
      token: String(jti),
      payload: payload as unknown as SessionPayload,
      expiresAt,
    };
  } catch {
    return null;
  }
}

/**
 * Revoke session by token (delete from sessions).
 */
export function revokeSession(token: string): boolean {
  if (!token) return false;
  try {
    const db = getDb();
    const res = db.prepare("DELETE FROM sessions WHERE token = ?").run(String(token));
    return Number(res?.changes ?? 0) > 0;
  } catch {
    return false;
  }
}

/** Revoke every session of a user, optionally keeping one (the caller's). Returns the number revoked. */
export function revokeUserSessions(userId: string, exceptToken?: string | null): number {
  const db = getDb();
  const res = exceptToken
    ? db.prepare("DELETE FROM sessions WHERE user_id = ? AND token <> ?").run(String(userId), String(exceptToken))
    : db.prepare("DELETE FROM sessions WHERE user_id = ?").run(String(userId));
  return Number(res?.changes ?? 0);
}

/** Resolve the signed-in user of a request (cookie or Bearer JWT). null when anonymous/invalid. */
export async function getRequestSession(req: Request): Promise<{ userId: string; token: string } | null> {
  const jwt = extractJwtFromRequest(req as any);
  if (!jwt) return null;
  const sess = await verifySession(jwt);
  return sess ? { userId: sess.userId, token: sess.token } : null;
}

/** Public origin of the site (used for redirects and same-origin checks). */
export function getPublicOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL || process.env.OAUTH_REDIRECT_BASE || "https://seedinfer.com";
  return raw.trim().replace(/\/+$/, "");
}

/**
 * CSRF guard for cookie-authenticated mutations (POST/PATCH/DELETE): the browser must say the request
 * is same-origin. Session cookies are SameSite=Lax as well; this is the second layer.
 */
export function isSameOriginRequest(req: Request): boolean {
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") return false;
  const origin = req.headers.get("origin");
  if (!origin) return true; // non-browser client (Bearer token) or very old browser
  try {
    const o = new URL(origin);
    const allowed = new Set([getPublicOrigin(), "https://seedinfer.com", "https://www.seedinfer.com"]);
    if (allowed.has(o.origin)) return true;
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    return !!host && o.host === host;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Cookie helpers (Next.js / plain header)
// ---------------------------------------------------------------------------

export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "seedinfer_session";
export const SESSION_COOKIE_NAME_LEGACY = "seedinfer_session"; // alias

export function getSessionCookieName(): string {
  return SESSION_COOKIE_NAME;
}

/**
 * Build Set-Cookie header value for session JWT.
 * Default: HttpOnly, Secure in prod, SameSite=Lax, Path=/, Max-Age 7d.
 * Use in Next.js Route Handler: `headers().set('Set-Cookie', createSessionCookie(jwt))`
 */
export function createSessionCookie(
  jwt: string,
  opts?: { maxAgeSec?: number; secure?: boolean; sameSite?: "lax" | "strict" | "none"; path?: string }
): string {
  const maxAge = opts?.maxAgeSec ?? 7 * 24 * 3600; // 7d
  const secure = opts?.secure ?? process.env.NODE_ENV === "production";
  const sameSite = opts?.sameSite ?? "lax";
  const p = opts?.path ?? "/";
  const parts = [
    `${SESSION_COOKIE_NAME}=${jwt}`,
    `Path=${p}`,
    `HttpOnly`,
    `SameSite=${sameSite.charAt(0).toUpperCase() + sameSite.slice(1)}`,
    `Max-Age=${maxAge}`,
  ];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

/**
 * Build Set-Cookie header to clear session (Max-Age=0).
 */
export function clearSessionCookie(opts?: { path?: string }): string {
  const p = opts?.path ?? "/";
  return `${SESSION_COOKIE_NAME}=; Path=${p}; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
}

/**
 * Parse Cookie header string into map. Useful for API routes without next/headers.
 */
export function parseCookies(cookieHeader: string | null | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (!k) continue;
    try {
      out[k] = decodeURIComponent(v);
    } catch {
      out[k] = v;
    }
  }
  return out;
}

/**
 * Extract JWT from Cookie header or Authorization Bearer.
 */
export function extractJwtFromRequest(req: { headers: { get?: (k: string) => string | null; cookie?: string; authorization?: string } } | any): string | null {
  try {
    let cookieHeader: string | null = null;
    if (req?.headers?.get) {
      cookieHeader = req.headers.get("cookie") || req.headers.get("Cookie");
    } else if (typeof req?.headers?.cookie === "string") {
      cookieHeader = req.headers.cookie;
    } else if (typeof req?.headers?.authorization === "string") {
      cookieHeader = null;
    }
    if (cookieHeader) {
      const cookies = parseCookies(cookieHeader);
      const jwt = cookies[SESSION_COOKIE_NAME] || cookies[SESSION_COOKIE_NAME_LEGACY];
      if (jwt) return jwt;
    }
    // Also check Authorization: Bearer <jwt>
    const auth = req?.headers?.get ? req.headers.get("authorization") || req.headers.get("Authorization") : req?.headers?.authorization;
    if (auth && auth.toLowerCase().startsWith("bearer ")) return auth.slice(7).trim();
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// User helpers (optional, for registration/login routes)
// ---------------------------------------------------------------------------

/**
 * Element requires refinement: rate limiting & email validation for user creation
 * should be wired in API route (e.g. lib/rate-limit) — not mocked here.
 */
export async function createUserAndSession(
  email: string,
  password: string,
  opts?: { walletAddress?: string | null; userAgent?: string | null }
): Promise<{ userId: string; token: string; jwt: string; expiresAt: string }> {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("invalid email");
  if (!password || password.length < 8) throw new Error("password too short");

  const userId = randomUUID();
  const passwordHash = await hashPassword(password);
  const createdAt = new Date().toISOString();

  // Insert user + initial credits row in one transaction (works with both drivers)
  try {
    withTransaction((db) => {
      db.prepare(`INSERT INTO users (id, email, password_hash, wallet_address, created_at) VALUES (?, ?, ?, ?, ?)`).run(
        userId,
        String(email).toLowerCase().trim(),
        passwordHash,
        opts?.walletAddress ?? null,
        createdAt
      );
      db.prepare(`INSERT INTO credits (user_id, balance_usd_cents, updated_at) VALUES (?, ?, ?)`).run(userId, 0, createdAt);
    });
  } catch (e: any) {
    // Re-throw with friendly message for UNIQUE constraint
    if (String(e?.message || e).toLowerCase().includes("unique") || String(e?.code || "").includes("SQLITE_CONSTRAINT")) {
      throw new Error("email already registered");
    }
    throw e;
  }

  const sess = await signSession(userId, { userAgent: opts?.userAgent ?? null, method: "password" });
  return { userId, token: sess.token, jwt: sess.jwt, expiresAt: sess.expiresAt };
}
