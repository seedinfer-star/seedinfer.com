/**
 * lib/account-events.ts — audit trail for security-sensitive account actions.
 * Types: payout_wallet_changed | node_token_created | node_token_revoked | node_bound
 *   | tailnet_key_issued
 */
import { getDb } from "./db";

export type AccountEventType =
  | "payout_wallet_changed"
  | "node_token_created"
  | "node_token_revoked"
  | "node_bound"
  | "tailnet_key_issued";

export type AccountEvent = {
  id: number;
  user_id: string;
  type: string;
  detail: Record<string, unknown> | null;
  ip: string | null;
  user_agent: string | null;
  created_at: string;
};

export function recordAccountEvent(
  userId: string,
  type: AccountEventType | string,
  opts?: { detail?: Record<string, unknown>; ip?: string | null; userAgent?: string | null }
): void {
  try {
    getDb()
      .prepare(
        `INSERT INTO account_events (user_id, type, detail, ip, user_agent, created_at) VALUES (?, ?, ?, ?, ?, ?)`
      )
      .run(
        String(userId),
        String(type),
        opts?.detail ? JSON.stringify(opts.detail) : null,
        opts?.ip ?? null,
        opts?.userAgent ? String(opts.userAgent).slice(0, 200) : null,
        new Date().toISOString()
      );
  } catch (e: any) {
    console.warn(`[account-events] record ${type} failed:`, e?.message || e);
  }
}

export function listAccountEvents(userId: string, limit = 100): AccountEvent[] {
  const rows = getDb()
    .prepare(
      `SELECT id, user_id, type, detail, ip, user_agent, created_at FROM account_events WHERE user_id = ? ORDER BY id DESC LIMIT ?`
    )
    .all(String(userId), Math.max(1, Math.min(1000, limit))) as any[];
  return rows.map((r) => {
    let detail: Record<string, unknown> | null = null;
    if (r.detail) {
      try {
        detail = JSON.parse(r.detail);
      } catch {
        detail = { raw: String(r.detail) };
      }
    }
    return { ...r, detail };
  });
}
