/**
 * lib/accounts.ts — user account logic shared by the OAuth callback and the account API.
 * SQLite driver here is node:sqlite on the Pi (no db.transaction), so all multi-row
 * writes below use explicit BEGIN IMMEDIATE/COMMIT via withTransaction().
 */
import { randomUUID } from "crypto";
import { getDb, withTransaction } from "./db";
import { revokeUserSessions } from "./auth";
import type { OAuthProvider } from "./oauth/flow";

/** Password hash stored for OAuth-only users — bcrypt.compare can never match it. */
export const OAUTH_ONLY_PASSWORD_HASH = "$2b$10$oauthplaceholderhash0000000000000000000000000000000000";

export function isOAuthOnlyAccount(hash: string | null | undefined): boolean {
  return typeof hash === "string" && hash.startsWith("$2b$10$oauthplaceholder");
}

export type OAuthProfile = {
  id: string;
  email: string;
  emailVerified: boolean;
  name?: string;
  username?: string;
  avatarUrl?: string | null;
};

export type SignInOutcome =
  | { ok: true; userId: string; created: boolean; linked: boolean }
  | { ok: false; error: "oauth_no_verified_email" | "email_taken_unverified" | "db_upsert_failed" };

function touchIdentity(db: any, userId: string, provider: OAuthProvider, profile: OAuthProfile, now: string): void {
  db.prepare(
    `UPDATE oauth_accounts SET email = ?, username = COALESCE(?, username), avatar_url = COALESCE(?, avatar_url), last_login_at = ? WHERE user_id = ? AND provider = ?`
  ).run(profile.email, profile.username || null, profile.avatarUrl || null, now, String(userId), provider);
  // Fill avatar/name only when empty (never overwrite what the user chose), and mark the account
  // email verified only when the provider verified THIS address.
  db.prepare(
    `UPDATE users SET avatar_url = COALESCE(avatar_url, ?), display_name = COALESCE(display_name, ?),
       email_verified = CASE WHEN ? = 1 AND lower(email) = lower(?) THEN 1 ELSE email_verified END,
       last_login_at = ? WHERE id = ?`
  ).run(profile.avatarUrl || null, profile.name || profile.username || null, profile.emailVerified ? 1 : 0, profile.email || "", now, String(userId));
  const credit = db.prepare("SELECT user_id FROM credits WHERE user_id = ?").get(String(userId));
  if (!credit) db.prepare("INSERT INTO credits (user_id, balance_usd_cents, updated_at) VALUES (?, 0, ?)").run(String(userId), now);
}

/**
 * Sign in (or create) a user from a verified OAuth profile.
 *
 * Linking policy:
 * - Identity already linked -> sign in.
 * - New identity + provider email VERIFIED:
 *   - an account with that email EXISTS and its email was never verified (pre-hijack case:
 *     someone pre-registered this address with a password) -> link, then WIPE the password
 *     and revoke all its sessions. The provider just proved ownership of this address, so the
 *     previous password holder cannot have been the owner. This also fixes the "locked out"
 *     case without a password-reset flow.
 *   - otherwise (no account, or email already verified) -> link or create.
 * - New identity + provider email UNVERIFIED -> refuse with email_taken_unverified when an
 *   account with that email exists; otherwise refuse with oauth_no_verified_email.
 */
export function signInWithOAuth(provider: OAuthProvider, profile: OAuthProfile): SignInOutcome {
  if (!profile.id || !profile.email) return { ok: false, error: "oauth_no_verified_email" };
  const email = profile.email.toLowerCase();
  const emailVerified = !!profile.emailVerified;
  const now = new Date().toISOString();
  try {
    return withTransaction((db) => {
      const linked = db
        .prepare("SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_account_id = ?")
        .get(provider, String(profile.id)) as { user_id: string } | undefined;
      if (linked?.user_id) {
        touchIdentity(db, linked.user_id, provider, { ...profile, email }, now);
        return { ok: true as const, userId: String(linked.user_id), created: false, linked: false };
      }

      const existing = db.prepare("SELECT id, email_verified FROM users WHERE email = ?").get(email) as
        | { id: string; email_verified: number | null }
        | undefined;

      if (existing?.id) {
        if (!emailVerified) {
          // An unverified claim about somebody else's address must never gain access.
          return { ok: false as const, error: "email_taken_unverified" as const };
        }
        if (!existing.email_verified) {
          // Pre-hijack cleanup: the provider verified this address, so the old password/session
          // holder was an impostor. Remove the password and kill every session — the OAuth
          // session we are about to create is the only way in.
          db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(OAUTH_ONLY_PASSWORD_HASH, existing.id);
          revokeUserSessions(existing.id);
        }
        db.prepare(
          `INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id, email, username, avatar_url, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(randomUUID(), existing.id, provider, String(profile.id), email, profile.username || null, profile.avatarUrl || null, now, now);
        touchIdentity(db, existing.id, provider, { ...profile, email }, now);
        return { ok: true as const, userId: String(existing.id), created: false, linked: true };
      }

      if (!emailVerified) return { ok: false as const, error: "oauth_no_verified_email" as const };
      const userId = randomUUID();
      db.prepare(
        `INSERT INTO users (id, email, password_hash, wallet_address, email_verified, avatar_url, display_name, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(userId, email, OAUTH_ONLY_PASSWORD_HASH, null, 1, profile.avatarUrl || null, profile.name || profile.username || null, now, now);
      db.prepare(
        `INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id, email, username, avatar_url, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(randomUUID(), userId, provider, String(profile.id), email, profile.username || null, profile.avatarUrl || null, now, now);
      db.prepare("INSERT INTO credits (user_id, balance_usd_cents, updated_at) VALUES (?, 0, ?)").run(userId, now);
      return { ok: true as const, userId, created: true, linked: true };
    });
  } catch (e: any) {
    console.error("[accounts signInWithOAuth]", e?.message || e);
    return { ok: false, error: "db_upsert_failed" };
  }
}

/**
 * Attach a new provider identity to the signed-in user (explicit link from Settings).
 * No email matching here: the user proved control of both the session and the provider account.
 * The account email is never changed by linking.
 */
export function linkIdentityToUser(
  userId: string,
  provider: OAuthProvider,
  profile: OAuthProfile
): { ok: true } | { ok: false; error: "identity_taken" | "already_linked" | "provider_already_linked" | "db_upsert_failed" } {
  const now = new Date().toISOString();
  try {
    return withTransaction((db) => {
      const taken = db
        .prepare("SELECT user_id FROM oauth_accounts WHERE provider = ? AND provider_account_id = ?")
        .get(provider, String(profile.id)) as { user_id: string } | undefined;
      if (taken) {
        return { ok: false as const, error: String(taken.user_id) === String(userId) ? ("already_linked" as const) : ("identity_taken" as const) };
      }
      const same = db.prepare("SELECT 1 FROM oauth_accounts WHERE user_id = ? AND provider = ?").get(String(userId), provider);
      if (same) return { ok: false as const, error: "provider_already_linked" as const };
      db.prepare(
        `INSERT INTO oauth_accounts (id, user_id, provider, provider_account_id, email, username, avatar_url, created_at, last_login_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(randomUUID(), String(userId), provider, String(profile.id), (profile.email || "").toLowerCase() || null, profile.username || null, profile.avatarUrl || null, now, now);
      touchIdentity(db, userId, provider, profile, now);
      return { ok: true as const };
    });
  } catch (e: any) {
    console.error("[accounts linkIdentityToUser]", e?.message || e);
    return { ok: false, error: "db_upsert_failed" };
  }
}

/**
 * "Sudo mode": sensitive actions (first password on an OAuth-only account, account deletion)
 * need a session created in the last `maxAgeMin` minutes, so a stolen long-lived cookie cannot
 * be turned into permanent access or used to wipe the account.
 */
export function isFreshSession(token: string, maxAgeMin = 15): boolean {
  const row = getDb().prepare("SELECT created_at FROM sessions WHERE token = ?").get(String(token)) as { created_at: string } | undefined;
  const t = row?.created_at ? new Date(row.created_at).getTime() : NaN;
  return Number.isFinite(t) && Date.now() - t <= maxAgeMin * 60_000;
}

/** Detach a provider. Refuses when it is the only remaining sign-in method. */
export function unlinkIdentity(userId: string, provider: OAuthProvider): { ok: true } | { ok: false; error: "not_linked" | "last_method" } {
  const db = getDb();
  const links = db.prepare("SELECT provider FROM oauth_accounts WHERE user_id = ?").all(String(userId)) as Array<{ provider: string }>;
  if (!links.some((l) => l.provider === provider)) return { ok: false, error: "not_linked" };
  const user = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(String(userId)) as { password_hash: string } | undefined;
  const hasPassword = !!user && !isOAuthOnlyAccount(user.password_hash);
  if (links.length <= 1 && !hasPassword) return { ok: false, error: "last_method" };
  db.prepare("DELETE FROM oauth_accounts WHERE user_id = ? AND provider = ?").run(String(userId), provider);
  return { ok: true };
}

export type AccountSnapshot = {
  user: { id: string; email: string; email_verified: boolean; display_name: string | null; avatar_url: string | null; created_at: string | null; has_password: boolean };
  links: Array<{ provider: string; email: string | null; username: string | null; avatar_url: string | null; created_at: string; last_login_at: string | null }>;
  sessions: Array<{ token: string; current: boolean; method: string | null; user_agent: string | null; created_at: string | null; expires_at: string | null }>;
  balance_usd_cents: number;
};

/** Everything the Settings page needs about the signed-in account (no secrets). */
export function getAccountSnapshot(userId: string, currentToken: string): AccountSnapshot | null {
  const db = getDb();
  const u = db
    .prepare("SELECT id, email, email_verified, display_name, avatar_url, created_at, password_hash FROM users WHERE id = ?")
    .get(String(userId)) as any;
  if (!u) return null;
  const links = db
    .prepare("SELECT provider, email, username, avatar_url, created_at, last_login_at FROM oauth_accounts WHERE user_id = ? ORDER BY created_at")
    .all(String(userId)) as any[];
  const sessions = db
    .prepare("SELECT token, method, user_agent, created_at, expires_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC")
    .all(String(userId)) as any[];
  const credit = db.prepare("SELECT balance_usd_cents FROM credits WHERE user_id = ?").get(String(userId)) as any;
  return {
    user: {
      id: u.id,
      email: u.email,
      email_verified: u.email_verified === 1,
      display_name: u.display_name || null,
      avatar_url: u.avatar_url || null,
      created_at: u.created_at || null,
      has_password: !isOAuthOnlyAccount(u.password_hash),
    },
    links,
    sessions: sessions.map((s) => ({
      token: String(s.token).slice(0, 8),
      current: String(s.token) === String(currentToken),
      method: s.method || null,
      user_agent: s.user_agent || null,
      created_at: s.created_at || null,
      expires_at: s.expires_at || null,
    })),
    balance_usd_cents: typeof credit?.balance_usd_cents === "number" ? credit.balance_usd_cents : 0,
  };
}

/** GDPR-style export: profile, links, sessions (metadata only), credits, invoices, usage. */
export function exportUserData(userId: string): Record<string, unknown> | null {
  const db = getDb();
  const u = db
    .prepare("SELECT id, email, email_verified, display_name, avatar_url, wallet_address, created_at, last_login_at FROM users WHERE id = ?")
    .get(String(userId)) as any;
  if (!u) return null;
  const q = (sql: string) => db.prepare(sql).all(String(userId));
  return {
    exported_at: new Date().toISOString(),
    user: u,
    oauth_accounts: q("SELECT provider, email, username, created_at, last_login_at FROM oauth_accounts WHERE user_id = ?"),
    sessions: q("SELECT method, user_agent, created_at, expires_at FROM sessions WHERE user_id = ?"),
    credits: q("SELECT balance_usd_cents, updated_at FROM credits WHERE user_id = ?"),
    invoices: q("SELECT id, chain, chain_id, token, token_address, amount, amount_usd_cents, address_to, tx_hash, status, created_at, confirmed_at, expires_at, block_number, block_hash FROM invoices WHERE user_id = ?"),
    usage: q("SELECT id, invoice_id, model, prompt_tokens, completion_tokens, cost_usd_cents, created_at FROM usage WHERE user_id = ?"),
  };
}

/**
 * Delete the account and all personal data. Usage rows are anonymized (user_id -> NULL) so
 * aggregate network statistics survive without identifying anyone. Invoices are deleted with the
 * account — stated in the privacy policy. Returns false when the user does not exist.
 */
export function deleteAccount(userId: string): boolean {
  try {
    return withTransaction((db) => {
      const u = db.prepare("SELECT id FROM users WHERE id = ?").get(String(userId)) as any;
      if (!u) return false;
      db.prepare("UPDATE usage SET user_id = NULL WHERE user_id = ?").run(String(userId));
      db.prepare("DELETE FROM users WHERE id = ?").run(String(userId)); // cascades: sessions, oauth_accounts, credits, invoices
      return true;
    });
  } catch (e: any) {
    console.error("[accounts deleteAccount]", e?.message || e);
    return false;
  }
}
