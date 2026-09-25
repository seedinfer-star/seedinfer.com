/**
 * lib/provider-tokens.ts — account-owned node tokens + node bindings.
 *
 * Token format: `sipn_` + base64url(32 random bytes, no padding).
 * The server stores only sha256(token) hex (UNIQUE) + a 12-char prefix;
 * the plaintext is returned exactly once at creation.
 */
import { createHash, randomBytes } from "crypto";
import { getDb, withTransaction } from "./db";
import { recordAccountEvent } from "./account-events";

export const NODE_TOKEN_RE = /^sipn_[A-Za-z0-9_-]{43}$/;
export const NODE_ID_RE = /^[A-Za-z0-9._-]{1,64}$/;
export const MAX_ACTIVE_TOKENS = 20;

const THROTTLE_MS = 5 * 60_000;

export type NodeTokenMeta = {
  id: string;
  name: string;
  prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
};

function newTokenId(): string {
  return `ntk_${randomBytes(8).toString("hex")}`;
}

export function mintNodeTokenSecret(): string {
  return `sipn_${randomBytes(32).toString("base64url")}`;
}

export function hashNodeToken(secret: string): string {
  return createHash("sha256").update(secret, "utf8").digest("hex");
}

/** Mask for logs: `sipn_AbCdEfG…` (12-char prefix + ellipsis). Never log the full token. */
export function maskNodeToken(secret: string): string {
  const s = String(secret || "");
  return s.length > 12 ? `${s.slice(0, 12)}…` : `${s.slice(0, 4)}…`;
}

export function countActiveTokens(userId: string): number {
  const row = getDb()
    .prepare("SELECT count(*) AS c FROM provider_tokens WHERE user_id = ? AND revoked_at IS NULL")
    .get(String(userId)) as { c: number };
  return Number(row?.c ?? 0);
}

export function createNodeToken(
  userId: string,
  name: string,
  opts?: { ip?: string | null; userAgent?: string | null }
): { token: NodeTokenMeta; secret: string } | { error: "token_limit" } {
  const clean = String(name ?? "node").trim().slice(0, 48) || "node";
  if (clean.length < 1 || clean.length > 48) {
    throw new Error("invalid name");
  }
  return withTransaction((db) => {
    const cnt = db
      .prepare("SELECT count(*) AS c FROM provider_tokens WHERE user_id = ? AND revoked_at IS NULL")
      .get(String(userId)) as { c: number };
    if (Number(cnt?.c ?? 0) >= MAX_ACTIVE_TOKENS) return { error: "token_limit" as const };
    const secret = mintNodeTokenSecret();
    const id = newTokenId();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO provider_tokens (id, user_id, name, token_hash, prefix, created_at) VALUES (?, ?, ?, ?, ?, ?)`
    ).run(id, String(userId), clean, hashNodeToken(secret), secret.slice(0, 12), now);
    recordAccountEvent(String(userId), "node_token_created", {
      detail: { token_id: id, name: clean },
      ip: opts?.ip ?? null,
      userAgent: opts?.userAgent ?? null,
    });
    return {
      token: { id, name: clean, prefix: secret.slice(0, 12), created_at: now, last_used_at: null, revoked_at: null },
      secret,
    };
  });
}

export function listNodeTokens(userId: string): NodeTokenMeta[] {
  return getDb()
    .prepare(
      `SELECT id, name, prefix, created_at, last_used_at, revoked_at FROM provider_tokens WHERE user_id = ? ORDER BY created_at DESC, id DESC`
    )
    .all(String(userId)) as NodeTokenMeta[];
}

/** Idempotent: revoking twice (or a foreign id) still returns ok:true; not caller's -> not_found. */
export function revokeNodeToken(
  userId: string,
  id: string,
  opts?: { ip?: string | null; userAgent?: string | null }
): { ok: true } | { ok: false; error: "not_found" } {
  return withTransaction((db) => {
    const row = db.prepare("SELECT id, revoked_at FROM provider_tokens WHERE id = ? AND user_id = ?").get(String(id), String(userId)) as
      | { id: string; revoked_at: string | null }
      | undefined;
    if (!row) return { ok: false as const, error: "not_found" as const };
    if (!row.revoked_at) {
      db.prepare("UPDATE provider_tokens SET revoked_at = ? WHERE id = ?").run(new Date().toISOString(), String(id));
      recordAccountEvent(String(userId), "node_token_revoked", {
        detail: { token_id: String(id) },
        ip: opts?.ip ?? null,
        userAgent: opts?.userAgent ?? null,
      });
    }
    return { ok: true as const };
  });
}

export function adminRevokeTokenById(
  tokenId: string,
  opts?: { ip?: string | null; userAgent?: string | null }
): { ok: true; userId: string } | { ok: false; error: "not_found" } {
  return withTransaction((db) => {
    const row = db.prepare("SELECT id, user_id, revoked_at FROM provider_tokens WHERE id = ?").get(String(tokenId)) as
      | { id: string; user_id: string; revoked_at: string | null }
      | undefined;
    if (!row) return { ok: false as const, error: "not_found" as const };
    if (!row.revoked_at) {
      db.prepare("UPDATE provider_tokens SET revoked_at = ? WHERE id = ?").run(new Date().toISOString(), String(tokenId));
      recordAccountEvent(row.user_id, "node_token_revoked", {
        detail: { token_id: String(tokenId), by: "admin" },
        ip: opts?.ip ?? null,
        userAgent: opts?.userAgent ?? null,
      });
    }
    return { ok: true as const, userId: row.user_id };
  });
}

/**
 * Verify a presented node secret. Regex first (cheap reject), then sha256 lookup of
 * non-revoked rows; throttles last_used_at to once per 5 min. Returns null when
 * unknown or revoked (binding is kept on revoke — heartbeat just stops working).
 */
export function verifyNodeToken(secret: string): { tokenId: string; userId: string } | null {
  const s = String(secret || "");
  if (!NODE_TOKEN_RE.test(s)) return null;
  const hash = hashNodeToken(s);
  const db = getDb();
  const row = db
    .prepare("SELECT id, user_id, last_used_at FROM provider_tokens WHERE token_hash = ? AND revoked_at IS NULL")
    .get(hash) as { id: string; user_id: string; last_used_at: string | null } | undefined;
  if (!row) return null;
  try {
    const last = row.last_used_at ? new Date(row.last_used_at).getTime() : 0;
    if (!Number.isFinite(last) || Date.now() - last > THROTTLE_MS) {
      db.prepare("UPDATE provider_tokens SET last_used_at = ? WHERE id = ?").run(new Date().toISOString(), row.id);
    }
  } catch {}
  return { tokenId: row.id, userId: row.user_id };
}

export type BindResult = { ok: true; newlyBound: boolean } | { ok: false; code: "node_owned_by_another_account" };

/**
 * First valid heartbeat binds node_id to the token's user (race-safe:
 * INSERT ... ON CONFLICT DO NOTHING, then SELECT). Same user with another of
 * his tokens -> OK (token_id updated). Bound to a different user -> 403.
 */
export function bindNode(nodeId: string, userId: string, tokenId: string): BindResult {
  const now = new Date().toISOString();
  return withTransaction((db) => {
    const ins = db
      .prepare(`INSERT INTO provider_nodes (node_id, user_id, token_id, bound_at, last_seen_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(node_id) DO NOTHING`)
      .run(String(nodeId), String(userId), String(tokenId), now, now);
    if (Number(ins?.changes ?? 0) > 0) {
      recordAccountEvent(String(userId), "node_bound", {
        detail: { node_id: String(nodeId), token_id: String(tokenId) },
      });
      return { ok: true as const, newlyBound: true };
    }
    const row = db.prepare("SELECT user_id FROM provider_nodes WHERE node_id = ?").get(String(nodeId)) as
      | { user_id: string }
      | undefined;
    if (!row) return { ok: true as const, newlyBound: true };
    if (String(row.user_id) !== String(userId)) {
      return { ok: false as const, code: "node_owned_by_another_account" as const };
    }
    try {
      const prev = db.prepare("SELECT token_id, last_seen_at FROM provider_nodes WHERE node_id = ?").get(String(nodeId)) as
        | { token_id: string | null; last_seen_at: string | null }
        | undefined;
      const last = prev?.last_seen_at ? new Date(prev.last_seen_at).getTime() : 0;
      if (prev?.token_id !== String(tokenId) || !Number.isFinite(last) || Date.now() - last > THROTTLE_MS) {
        db.prepare("UPDATE provider_nodes SET token_id = ?, last_seen_at = ? WHERE node_id = ?").run(String(tokenId), now, String(nodeId));
      }
    } catch {}
    return { ok: true as const, newlyBound: false };
  });
}

export type UserNodeRow = {
  node_id: string;
  bound_at: string;
  last_seen_at: string | null;
  token_id: string | null;
  token_prefix: string | null;
};

export function listUserNodes(userId: string): UserNodeRow[] {
  return getDb()
    .prepare(
      `SELECT n.node_id, n.bound_at, n.last_seen_at, n.token_id, t.prefix AS token_prefix
         FROM provider_nodes n LEFT JOIN provider_tokens t ON t.id = n.token_id
        WHERE n.user_id = ? ORDER BY n.bound_at DESC`
    )
    .all(String(userId)) as UserNodeRow[];
}

/** Admin: remove a binding (the node re-binds on its next valid heartbeat). */
export function unbindNode(nodeId: string): boolean {
  try {
    const res = getDb().prepare("DELETE FROM provider_nodes WHERE node_id = ?").run(String(nodeId));
    return Number(res?.changes ?? 0) > 0;
  } catch {
    return false;
  }
}

export function getNodeOwner(nodeId: string): { userId: string; tokenId: string | null } | null {
  const row = getDb().prepare("SELECT user_id, token_id FROM provider_nodes WHERE node_id = ?").get(String(nodeId)) as
    | { user_id: string; token_id: string | null }
    | undefined;
  return row ? { userId: row.user_id, tokenId: row.token_id } : null;
}
