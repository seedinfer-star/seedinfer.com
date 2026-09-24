/**
 * lib/payments/invoice.ts — Invoice helpers
 * createInvoice(userId, chain, token, amountUsdCents) etc.
 *
 * QR assignment model:
 *   invoice.id  →  address_to (PAYMENT_ADDRESS for EVM 0x2EB9104AEeF7270fe639Bf1965B94Bfb8Edcf786 on 6 chains, SOLANA_ADDRESS for Solana)
 *                + exact amount (invoice.amount base units; USDC/USDT 6 decimals, native 18/9) + amount_usd_cents authoritative for credits
 *                + EIP-681 URI (EVM: ethereum:token@chainId/transfer?address=...&uint256=... or ethereum:payment@chainId?value=...) / Solana Pay URI (solana:address?amount=...&reference=...&memo=invoice.id)
 *   Frontend renders QR via lib/payments/qr.ts generateEip681Uri / generateSolanaPayUri; memo/reference = invoice.id ties on-chain tx back to invoice.
 *   Worker verifies tx_hash (submitted via /api/v1/payments/verify or auto-discovery) against address_to + amount tolerance 50 BPS + chainId + receipt status + required confirmations.
 *   See lib/payments/qr.ts for URI specs (no mocks, Element requires refinement where live RPC key needed).
 */

import { randomUUID } from "crypto";
import { getDb } from "../db";
import { CHAIN_CONFIG, isValidChain, getAddressForChain, type ChainKey } from "./chains";
import { isTokenAllowed, getTokenAddress, isNative } from "./tokens";

export type InvoiceRow = {
  id: string;
  user_id: string;
  chain: string;
  chain_id: number | string;
  token: string;
  token_address: string | null;
  amount: string;
  amount_usd_cents: number;
  address_to: string;
  tx_hash: string | null;
  status: "pending" | "confirming" | "confirmed" | "expired" | "failed";
  created_at: string;
  confirmed_at: string | null;
  expires_at: string;
  block_number: number | null;
  block_hash: string | null;
};

function getInvoiceTtlMin(): number {
  const raw = process.env.INVOICE_TTL_MIN || "30";
  const v = Number(raw);
  if (Number.isFinite(v) && v >= 1 && v <= 1440) return Math.floor(v);
  return 30;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Create pending invoice
 * Validates chain/token, sets address_to per chain (EVM same addr, Solana separate)
 * amount TEXT = placeholder for token base units; amount_usd_cents = USD cents authoritative for credit
 * Element requires refinement: amount base units should be computed via price oracle (e.g., USD->token conversion with decimals) — current sets amount=String(amountUsdCents) as placeholder
 */
export async function createInvoice(
  userId: string,
  chain: string,
  token: string,
  amountUsdCents: number
): Promise<InvoiceRow> {
  if (!userId) throw new Error("userId required");
  if (!chain || !isValidChain(chain)) throw new Error(`invalid chain: ${chain}`);
  if (!token) throw new Error("token required");
  if (!isTokenAllowed(chain, token)) throw new Error(`token not allowed for chain ${chain}: ${token}`);
  if (!Number.isFinite(amountUsdCents) || amountUsdCents <= 0) throw new Error("amountUsdCents must be >0");
  if (amountUsdCents > 100_000_00) throw new Error("amount too large"); // $100k cap

  const c = chain.toLowerCase() as ChainKey;
  const cfg = CHAIN_CONFIG[c];
  if (!cfg) throw new Error(`chain config missing for ${chain}`);

  const tokenAddrRaw = isNative(c, token) ? "native" : (getTokenAddress(c, token) || token);
  // token param may be address already — if isTokenAllowed passed, use normalized form
  let tokenAddress: string | null = null;
  if (isNative(c, token)) tokenAddress = "native";
  else {
    // if token is symbol, resolve to address ; if address, keep
    const asAddr = getTokenAddress(c, token);
    if (asAddr) tokenAddress = asAddr;
    else if (token.startsWith("0x") || token.length >= 32) tokenAddress = token;
    else tokenAddress = tokenAddrRaw;
  }

  const id = randomUUID();
  const createdAt = nowIso();
  const ttl = getInvoiceTtlMin();
  const expiresAt = new Date(Date.now() + ttl * 60_000).toISOString();
  const addressTo = getAddressForChain(c);
  const chainId = cfg.chainId as any;
  // Element requires refinement: amount base units conversion from USD cents via live price feed
  const amount = String(amountUsdCents);

  const invoice: InvoiceRow = {
    id,
    user_id: String(userId),
    chain: c,
    chain_id: typeof chainId === "number" ? chainId : 0,
    token: isNative(c, token) ? "native" : token,
    token_address: tokenAddress,
    amount,
    amount_usd_cents: Math.floor(amountUsdCents),
    address_to: addressTo,
    tx_hash: null,
    status: "pending",
    created_at: createdAt,
    confirmed_at: null,
    expires_at: expiresAt,
    block_number: null,
    block_hash: null,
  };

  // Insert into DB
  const db = getDb();
  try {
    db.prepare(
      `INSERT INTO invoices (id, user_id, chain, chain_id, token, token_address, amount, amount_usd_cents, address_to, tx_hash, status, created_at, confirmed_at, expires_at, block_number, block_hash)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      invoice.id,
      invoice.user_id,
      invoice.chain,
      invoice.chain_id,
      invoice.token,
      invoice.token_address,
      invoice.amount,
      invoice.amount_usd_cents,
      invoice.address_to,
      invoice.tx_hash,
      invoice.status,
      invoice.created_at,
      invoice.confirmed_at,
      invoice.expires_at,
      invoice.block_number,
      invoice.block_hash
    );
  } catch (e: any) {
    // Element requires refinement: handle SQLITE_CONSTRAINT etc with monitoring
    throw new Error(`createInvoice DB failed: ${e?.message || e}`);
  }

  return invoice;
}

/**
 * Confirm invoice — not atomic vs credits; worker uses atomic helper.
 * For manual use only.
 */
export function confirmInvoice(invoiceId: string, txHash: string, blockNumber?: number, blockHash?: string): void {
  if (!invoiceId) throw new Error("invoiceId required");
  if (!txHash) throw new Error("txHash required");
  const db = getDb();
  const now = nowIso();
  db.prepare(
    `UPDATE invoices SET tx_hash = ?, status = 'confirmed', confirmed_at = ?, block_number = COALESCE(?, block_number), block_hash = COALESCE(?, block_hash) WHERE id = ?`
  ).run(String(txHash), now, blockNumber ?? null, blockHash ?? null, String(invoiceId));
}

/**
 * Expire invoices where expires_at < now and still pending
 * Returns count expired.
 */
export function expireInvoices(): number {
  const db = getDb();
  const now = nowIso();
  try {
    const res = db
      .prepare(`UPDATE invoices SET status = 'expired' WHERE status IN ('pending','confirming') AND tx_hash IS NULL AND expires_at < ?`)
      .run(now);
    return (res as any)?.changes ?? 0;
  } catch (e: any) {
    console.warn(`[invoice] expireInvoices failed: ${e?.message || e}`);
    return 0;
  }
}

/**
 * Fetch invoice by id (owner check optional)
 */
export function getInvoiceById(invoiceId: string): InvoiceRow | null {
  if (!invoiceId) return null;
  const db = getDb();
  try {
    const row = db.prepare(`SELECT * FROM invoices WHERE id = ?`).get(String(invoiceId)) as InvoiceRow | undefined;
    return row || null;
  } catch {
    return null;
  }
}

/**
 * List invoices for user
 */
export function listInvoicesForUser(userId: string, limit = 50): InvoiceRow[] {
  if (!userId) return [];
  const db = getDb();
  const lim = Math.min(Math.max(Number(limit) || 50, 1), 100);
  try {
    const rows = db
      .prepare(`SELECT * FROM invoices WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`)
      .all(String(userId), lim) as InvoiceRow[];
    return rows;
  } catch {
    return [];
  }
}

/**
 * Set tx_hash for invoice (manual verify submission)
 * Validates ownership? Caller should check.
 */
export function setInvoiceTxHash(invoiceId: string, txHash: string, chain?: string): void {
  if (!invoiceId || !txHash) throw new Error("invoiceId and txHash required");
  const db = getDb();
  // If already has tx_hash different, error? For now allow overwrite only if null
  const existing = db.prepare(`SELECT tx_hash, chain FROM invoices WHERE id = ?`).get(String(invoiceId)) as any;
  if (!existing) throw new Error("invoice not found");
  if (existing.tx_hash && existing.tx_hash !== String(txHash)) {
    // Element requires refinement: duplicate submission handling — currently reject second hash
    throw new Error("invoice already has tx_hash");
  }
  if (chain && existing.chain && existing.chain !== String(chain).toLowerCase()) {
    throw new Error(`chain mismatch: invoice chain=${existing.chain} vs submitted ${chain}`);
  }
  db.prepare(`UPDATE invoices SET tx_hash = ?, status = 'confirming' WHERE id = ?`).run(String(txHash), String(invoiceId));
}
