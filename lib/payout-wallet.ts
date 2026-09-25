/**
 * lib/payout-wallet.ts — account-level payout wallet (USDC on Base).
 * Stored checksummed (viem getAddress) on users.payout_wallet; every change writes an
 * account_events row with the full {from, to} and fires a non-blocking security email.
 */
import { getAddress, isAddress } from "viem";
import { getDb } from "./db";
import { recordAccountEvent } from "./account-events";
import { notifySecurityChange } from "./notify";

export const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Normalize per contract: trimmed EVM address; reject the zero address;
 * lowercase/all-uppercase accepted (checksummed on store); mixed-case must pass EIP-55.
 * Returns the checksummed address or null.
 */
export function normalizePayoutWallet(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!isAddress(t)) return null;
  let checksummed: string;
  try {
    checksummed = getAddress(t);
  } catch {
    return null;
  }
  if (checksummed === ZERO_ADDRESS) return null;
  // Mixed-case input claims a checksum — it must match exactly.
  const isLower = t === t.toLowerCase();
  const isUpper = t === t.toUpperCase();
  if (!isLower && !isUpper && t !== checksummed) return null;
  return checksummed;
}

/** Mask for display/logs: 0x1234…abcd. */
export function maskWallet(w: string | null | undefined): string | null {
  const s = String(w || "");
  if (!s) return null;
  return s.length > 10 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}

export type PayoutWalletState = { wallet: string | null; updated_at: string | null };

export function getAccountPayoutWallet(userId: string): PayoutWalletState {
  const row = getDb()
    .prepare("SELECT payout_wallet, payout_wallet_updated_at FROM users WHERE id = ?")
    .get(String(userId)) as { payout_wallet: string | null; payout_wallet_updated_at: string | null } | undefined;
  return { wallet: row?.payout_wallet ?? null, updated_at: row?.payout_wallet_updated_at ?? null };
}

export function setAccountPayoutWallet(
  userId: string,
  wallet: string,
  opts?: { ip?: string | null; userAgent?: string | null }
): PayoutWalletState {
  const normalized = normalizePayoutWallet(wallet);
  if (!normalized) throw new Error("invalid_wallet");
  const db = getDb();
  const prev = db.prepare("SELECT payout_wallet, email FROM users WHERE id = ?").get(String(userId)) as
    | { payout_wallet: string | null; email: string | null }
    | undefined;
  const now = new Date().toISOString();
  db.prepare("UPDATE users SET payout_wallet = ?, payout_wallet_updated_at = ? WHERE id = ?").run(normalized, now, String(userId));
  recordAccountEvent(String(userId), "payout_wallet_changed", {
    detail: { from: prev?.payout_wallet ?? null, to: normalized },
    ip: opts?.ip ?? null,
    userAgent: opts?.userAgent ?? null,
  });
  if (prev?.payout_wallet !== normalized) {
    notifySecurityChange(
      prev?.email,
      "SeedInfer: payout wallet changed",
      `Your SeedInfer payout wallet was changed from ${maskWallet(prev?.payout_wallet) ?? "none"} to ${maskWallet(normalized)}. If this was not you, contact support immediately.`
    );
  }
  return { wallet: normalized, updated_at: now };
}
