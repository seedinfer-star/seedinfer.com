/**
 * lib/billing.ts — micro-USD billing for inference.
 *
 * Canonical balance: credits.balance_micro (1 micro = 1/1,000,000 USD).
 * credits.balance_usd_cents is a maintained floor(micro/10000) mirror for the
 * legacy UI/invoices. Per-token prices from the catalog: pricePer1M in USD per
 * 1M tokens is numerically equal to micro-USD per single token
 * ($0.03 / 1M tokens = 0.03 micro/token).
 *
 * Flow: estimateRequestCostMicro -> preauthCheck -> (request runs) -> settleUsage.
 * Settle may push the balance negative (actual > estimate); the next preauth fails.
 */
import { getDb, withTransaction } from "./db";
import { LIVE_MODEL, MODELS } from "./catalog";

export const MICRO_PER_CENT = 10_000;

type Price = { input: number; output: number };

function priceForModel(model: string): Price {
  const m = MODELS.find((x) => x.id === model) || LIVE_MODEL;
  return { input: m.pricePer1M.input, output: m.pricePer1M.output };
}

/** Ensure the credits row exists and balance_micro is migrated (never -1). */
function ensureBalanceRow(db: any, userId: string): { balance_micro: number } {
  let row = db.prepare("SELECT balance_micro, balance_usd_cents FROM credits WHERE user_id = ?").get(String(userId)) as
    | { balance_micro: number | null; balance_usd_cents: number | null }
    | undefined;
  if (!row) {
    const now = new Date().toISOString();
    db.prepare("INSERT INTO credits (user_id, balance_usd_cents, balance_micro, updated_at) VALUES (?, 0, 0, ?)").run(String(userId), now);
    return { balance_micro: 0 };
  }
  let micro = typeof row.balance_micro === "number" ? row.balance_micro : -1;
  if (micro === -1) {
    micro = Math.max(0, Math.round(Number(row.balance_usd_cents ?? 0) * MICRO_PER_CENT));
    db.prepare("UPDATE credits SET balance_micro = ? WHERE user_id = ?").run(micro, String(userId));
  }
  return { balance_micro: micro };
}

export function getBalanceMicro(userId: string): number {
  return ensureBalanceRow(getDb(), userId).balance_micro;
}

/** Estimated worst-case cost in micro-USD (prompt estimate + max output). */
export function estimateRequestCostMicro(model: string, promptTokens: number, maxOutputTokens: number): number {
  const p = priceForModel(model);
  const cost = Math.max(0, promptTokens) * p.input + Math.max(0, maxOutputTokens) * p.output;
  return Math.ceil(cost);
}

/** Actual cost in micro-USD from real usage numbers. */
export function usageCostMicro(model: string, promptTokens: number, completionTokens: number): number {
  const p = priceForModel(model);
  return Math.ceil(Math.max(0, promptTokens) * p.input + Math.max(0, completionTokens) * p.output);
}

export function preauthCheck(
  userId: string,
  estMicro: number
): { ok: true; balanceMicro: number } | { ok: false; balanceMicro: number } {
  const { balance_micro } = ensureBalanceRow(getDb(), userId);
  return balance_micro >= estMicro
    ? { ok: true as const, balanceMicro: balance_micro }
    : { ok: false as const, balanceMicro: balance_micro };
}

/**
 * Charge real usage: decrement balance (may go negative), keep the cents mirror
 * in sync, and append a usage ledger row. Returns null when the user vanished.
 */
export function settleUsage(args: {
  userId: string;
  apiKeyId?: string | null;
  model: string;
  promptTokens: number;
  completionTokens: number;
}): { costMicro: number; balanceMicro: number } | null {
  const cost = usageCostMicro(args.model, args.promptTokens, args.completionTokens);
  const now = new Date().toISOString();
  return withTransaction((db) => {
    const u = db.prepare("SELECT id FROM users WHERE id = ?").get(String(args.userId));
    if (!u) return null;
    ensureBalanceRow(db, args.userId);
    db.prepare(
      `UPDATE credits SET balance_micro = balance_micro - ?, balance_usd_cents = CAST((balance_micro - ?) / 10000 AS INTEGER), updated_at = ? WHERE user_id = ?`
    ).run(cost, cost, now, String(args.userId));
    db.prepare(
      `INSERT INTO usage (user_id, api_key_id, model, prompt_tokens, completion_tokens, cost_usd_micro, cost_usd_cents, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      String(args.userId),
      args.apiKeyId ? String(args.apiKeyId) : null,
      String(args.model),
      Math.max(0, Math.round(args.promptTokens)),
      Math.max(0, Math.round(args.completionTokens)),
      cost,
      Math.round(cost / MICRO_PER_CENT),
      now
    );
    const row = db.prepare("SELECT balance_micro FROM credits WHERE user_id = ?").get(String(args.userId)) as { balance_micro: number };
    return { costMicro: cost, balanceMicro: Number(row.balance_micro) };
  });
}

/** Top-up helper (payments worker / tests / admin). Keeps the cents mirror in sync. */
export function creditBalanceMicro(userId: string, micro: number): { balanceMicro: number } {
  const delta = Math.round(micro);
  const now = new Date().toISOString();
  return withTransaction((db) => {
    ensureBalanceRow(db, userId);
    db.prepare(
      `UPDATE credits SET balance_micro = balance_micro + ?, balance_usd_cents = CAST((balance_micro + ?) / 10000 AS INTEGER), updated_at = ? WHERE user_id = ?`
    ).run(delta, delta, now, String(userId));
    const row = db.prepare("SELECT balance_micro FROM credits WHERE user_id = ?").get(String(userId)) as { balance_micro: number };
    return { balanceMicro: Number(row.balance_micro) };
  });
}
