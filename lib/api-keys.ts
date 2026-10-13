/**
 * lib/api-keys.ts — account-owned inference API keys (`sk_live_…`).
 *
 * Mirrors lib/provider-tokens.ts: the server stores only sha256(key) hex (UNIQUE)
 * + a 12-char prefix; the plaintext is returned exactly once at creation.
 */
import { createHash, randomBytes } from "crypto";
import { getDb, withTransaction } from "./db";
import { recordAccountEvent } from "./account-events";

export const API_KEY_RE = /^sk_live_[A-Za-z0-9_-]{43}$/;
export const MAX_ACTIVE_KEYS = 20;

const LAST_USED_THROTTLE_MS = 5 * 60_000;

export type ApiKeyMeta = {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

function newKeyId(): string {
  return `apk_${randomBytes(8).toString("hex")}`;
}

export function mintApiKeySecret(): string {
  return `sk_live_${randomBytes(32).toString("base64url")}`;
}

export function hashApiKey(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/** Mask for logs: `sk_live_AbC…` (12-char prefix + ellipsis). Never log the full key. */
export function maskApiKey(secret: string): string {
  const s = String(secret || "");
  return s.length > 12 ? `${s.slice(0, 12)}…` : `${s.slice(0, 4)}…`;
}

export function countActiveKeys(userId: string): number {
  const row = getDb()
    .prepare("SELECT count(*) AS c FROM api_keys WHERE user_id = ? AND revoked_at IS NULL")
    .get(String(userId)) as { c: number };
  return Number(row?.c ?? 0);
}

export function createApiKey(
  userId: string,
  name: string,
  opts?: { ip?: string | null; userAgent?: string | null }
): { key: ApiKeyMeta; secret: string } | { error: "key_limit" } {
  const clean = String(name ?? "default").trim().slice(0, 48) || "default";
  return withTransaction((db) => {
    const cnt = db
      .prepare("SELECT count(*) AS c FROM api_keys WHERE user_id = ? AND revoked_at IS NULL")
      .get(String(userId)) as { c: number };
    if (Number(cnt?.c ?? 0) >= MAX_ACTIVE_KEYS) return { error: "key_limit" as const };
    const secret = mintApiKeySecret();
    const id = newKeyId();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO api_keys (id, user_id, name, key_hash, prefix, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, String(userId), clean, hashApiKey(secret), secret.slice(0, 12), now);
    recordAccountEvent(String(userId), "api_key_created", {
      detail: { key_id: id, name: clean },
      ip: opts?.ip ?? null,
      userAgent: opts?.userAgent ?? null,
    });
    return {
      key: { id, name: clean, prefix: secret.slice(0, 12), created_at: now, last_used_at: null, revoked_at: null },
      secret,
    };
  });
}

export function listApiKeys(userId: string): ApiKeyMeta[] {
  return getDb()
    .prepare(
      `SELECT id, name, prefix, created_at, last_used_at, revoked_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC, id DESC`
    )
    .all(String(userId)) as ApiKeyMeta[];
}

/** Idempotent: revoking twice (or a foreign id) still returns ok:true; not caller's -> not_found. */
export function revokeApiKey(
  userId: string,
  id: string,
  opts?: { ip?: string | null; userAgent?: string | null }
): { ok: true } | { ok: false; error: "not_found" } {
  return withTransaction((db) => {
    const row = db.prepare("SELECT id, revoked_at FROM api_keys WHERE id = ? AND user_id = ?").get(String(id), String(userId)) as
      | { id: string; revoked_at: string | null }
      | undefined;
    if (!row) return { ok: false as const, error: "not_found" as const };
    if (!row.revoked_at) {
      db.prepare("UPDATE api_keys SET revoked_at = ? WHERE id = ?").run(new Date().toISOString(), String(id));
      recordAccountEvent(String(userId), "api_key_revoked", {
        detail: { key_id: String(id) },
        ip: opts?.ip ?? null,
        userAgent: opts?.userAgent ?? null,
      });
    }
    return { ok: true as const };
  });
}

/**
 * Verify a bearer secret -> owning key + user. Returns null for malformed,
 * unknown, or revoked keys. last_used_at is updated at most once per 5 min.
 */
export function verifyApiKey(secret: string): { id: string; userId: string } | null {
  const s = String(secret || "").trim();
  if (!API_KEY_RE.test(s)) return null;
  const row = getDb()
    .prepare("SELECT id, user_id, last_used_at FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL")
    .get(hashApiKey(s)) as { id: string; user_id: string; last_used_at: string | null } | undefined;
  if (!row) return null;
  const last = row.last_used_at ? new Date(row.last_used_at).getTime() : 0;
  if (!Number.isFinite(last) || Date.now() - last > LAST_USED_THROTTLE_MS) {
    try {
      getDb().prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?").run(new Date().toISOString(), String(row.id));
    } catch {}
  }
  return { id: String(row.id), userId: String(row.user_id) };
}
