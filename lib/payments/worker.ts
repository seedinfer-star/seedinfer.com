/**
 * lib/payments/worker.ts — Watch-only multi-chain payments worker
 * Poll 15s per chain, concurrency 3, viem + @solana/web3.js, SQLite atomic updates
 * No PRIVATE_KEY — watch only.
 * Run via: node --loader tsx lib/payments/worker.ts  or  npx tsx lib/payments/worker.ts
 * Systemd: /opt/seedinfer/lib/payments/worker.ts
 */

// ---------------------------------------------------------------------------
// Imports — viem & solana with HTTP fallback
// ---------------------------------------------------------------------------
// Element requires refinement: these imports require live viem@^2 and @solana/web3.js installed with real RPC keys.
// If RPC_URL_* missing, worker logs and skips chain polling but keeps health reporting.
import { getDb } from "../db";
import {
  CHAIN_CONFIG,
  EVM_CHAIN_KEYS,
  getRpcUrl,
  getRpcUrls,
  getConfirmationsRequired,
  getWorkerPollMs,
  getPaymentAddress,
  getSolanaAddress,
  type ChainKey,
  type EvmChainKey,
} from "./chains";
import { isNative, TOKEN_DECIMALS } from "./tokens";

// viem dynamic — fallback if not installed
// @ts-ignore — viem optional at compile time; added to package.json but not yet installed in dev
import { createPublicClient as _viemCreatePublicClient, http as _viemHttp, fallback as _viemFallback } from "viem";
// @ts-ignore
import { mainnet as _mainnet, arbitrum as _arbitrum, polygon as _polygon, base as _base, bsc as _bsc } from "viem/chains";

// solana dynamic
// @ts-ignore — @solana/web3.js optional
import { Connection as _SolConnection, PublicKey as _SolPublicKey } from "@solana/web3.js";

// ---------------------------------------------------------------------------
// Env & constants
// ---------------------------------------------------------------------------
const PAYMENT_ADDRESS = getPaymentAddress();
const SOLANA_ADDRESS = getSolanaAddress();

const INVOICE_AMOUNT_TOLERANCE_BPS = (() => {
  const raw = process.env.INVOICE_AMOUNT_TOLERANCE_BPS || "50";
  const v = Number(raw);
  if (Number.isFinite(v) && v >= 0 && v <= 10000) return Math.floor(v);
  return 50;
})();

const WORKER_POLL_MS = getWorkerPollMs();
const CONCURRENCY = (() => {
  const raw = process.env.WORKER_CONCURRENCY || "3";
  const v = Number(raw);
  if (Number.isFinite(v) && v >= 1 && v <= 10) return Math.floor(v);
  return 3;
})();

// ---------------------------------------------------------------------------
// In-memory state
// ---------------------------------------------------------------------------
export type WorkerHealth = {
  uptimeSec: number;
  startedAt: string;
  lastPollAt: string | null;
  pollMs: number;
  concurrency: number;
  paymentAddress: string;
  solanaAddress: string;
  pendingInvoices: number;
  confirmingInvoices: number;
  lastPollPerChain: Record<string, string | null>;
  errorsPerChain: Record<string, string | null>;
  lastExpireSweepAt: string | null;
  lastExpireCount: number;
};

const pendingInvoicesCache = new Map<string, any>();
let startedAt = new Date().toISOString();
let lastPollAt: string | null = null;
let lastExpireSweepAt: string | null = null;
let lastExpireCount = 0;
const lastPollPerChain: Record<string, string | null> = {};
const errorsPerChain: Record<string, string | null> = {};
for (const k of [...EVM_CHAIN_KEYS, "solana"]) {
  lastPollPerChain[k] = null;
  errorsPerChain[k] = null;
}

const startTimeMs = Date.now();

export function getWorkerHealth(): WorkerHealth {
  const db = (() => {
    try {
      return getDb();
    } catch {
      return null;
    }
  })();
  let pending = 0;
  let confirming = 0;
  if (db) {
    try {
      const row = db
        .prepare(`SELECT COUNT(*) as c FROM invoices WHERE status='pending'`)
        .get() as any;
      pending = row?.c ?? 0;
      const row2 = db
        .prepare(`SELECT COUNT(*) as c FROM invoices WHERE status='confirming'`)
        .get() as any;
      confirming = row2?.c ?? 0;
    } catch {}
  }
  return {
    uptimeSec: Math.floor((Date.now() - startTimeMs) / 1000),
    startedAt,
    lastPollAt,
    pollMs: WORKER_POLL_MS,
    concurrency: CONCURRENCY,
    paymentAddress: PAYMENT_ADDRESS,
    solanaAddress: SOLANA_ADDRESS,
    pendingInvoices: pending,
    confirmingInvoices: confirming,
    lastPollPerChain: { ...lastPollPerChain },
    errorsPerChain: { ...errorsPerChain },
    lastExpireSweepAt,
    lastExpireCount,
  };
}

// ---------------------------------------------------------------------------
// Concurrency limiter (p-limit alike, concurrency 3)
// ---------------------------------------------------------------------------
function createLimiter(limit: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    if (queue.length === 0) return;
    if (active >= limit) return;
    active++;
    const fn = queue.shift();
    if (fn) fn();
  };
  return <T>(fn: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      const run = () => {
        fn()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            active--;
            next();
          });
      };
      queue.push(run);
      next();
    });
}
const limit = createLimiter(CONCURRENCY);

// ---------------------------------------------------------------------------
// JSON-RPC fetch fallback (when viem not available or fallback RPC needed)
// ---------------------------------------------------------------------------
async function jsonRpcFetch(rpcUrl: string, method: string, params: any[]): Promise<any> {
  // Element requires refinement: timeout + retry for RPC_URL_* fetch — add AbortController with 10s timeout and exponential backoff
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!res.ok) throw new Error(`RPC ${method} HTTP ${res.status}`);
  const j: any = await res.json();
  if (j.error) throw new Error(`RPC ${method} error: ${JSON.stringify(j.error)}`);
  return j.result;
}

async function jsonRpcWithFallback(chain: EvmChainKey | "solana", method: string, params: any[]): Promise<any> {
  const urls = getRpcUrls(chain as ChainKey);
  if (urls.length === 0) throw new Error(`no RPC URL for ${chain}`);
  let lastErr: any = null;
  for (const url of urls) {
    try {
      const r = await jsonRpcFetch(url, method, params);
      return r;
    } catch (e: any) {
      lastErr = e;
      console.warn(`[worker] RPC ${chain} ${method} fail on ${url.slice(0, 32)}...: ${e?.message}`);
      // try next fallback URL
    }
  }
  throw lastErr || new Error(`all RPCs failed for ${chain} ${method}`);
}

// ---------------------------------------------------------------------------
// viem client factory (with fallback transport + HTTP JSON-RPC shim)
// ---------------------------------------------------------------------------
type ViemClient = any;

function getViemChainObject(chain: EvmChainKey): any {
  const cfg = CHAIN_CONFIG[chain];
  if (!cfg) return null;
  // Try to map to real viem chain if installed
  const map: Record<string, any> = {
    eth: _mainnet,
    arbitrum: _arbitrum,
    polygon: _polygon,
    base: _base,
    bnb: _bsc,
  };
  if (chain === "hyperevm") {
    // Element requires refinement: HyperEVM viem chain — defineChain({id:999,...}) needs verification with official HyperEVM chain metadata
    return cfg.viemChain;
  }
  return map[chain] || cfg.viemChain;
}

function createViemClient(chain: EvmChainKey): ViemClient | null {
  const rpcUrls = getRpcUrls(chain);
  const rpcUrl = rpcUrls[0] || getRpcUrl(chain);
  if (!rpcUrl) {
    // Element requires refinement: RPC URL missing for chain — set RPC_URL_* env to enable live polling
    return null;
  }
  try {
    // Element requires refinement: viem createPublicClient requires live viem@^2 installed; HTTP RPC fallback if viem unavailable
    if (typeof _viemCreatePublicClient === "function" && typeof _viemHttp === "function") {
      const viemChain = getViemChainObject(chain);
      // Use viem fallback transport if multiple URLs configured
      let transport: any;
      if (rpcUrls.length > 1 && typeof _viemFallback === "function") {
        transport = _viemFallback(rpcUrls.map((u) => _viemHttp(u)));
      } else {
        transport = _viemHttp(rpcUrl);
      }
      return _viemCreatePublicClient({
        chain: viemChain,
        transport,
      });
    }
    // viem not available — HTTP JSON-RPC shim implementing subset of viem public client
    console.warn(`[worker] viem not available for ${chain}, using HTTP JSON-RPC fallback`);
    return {
      _fallbackRpcUrl: rpcUrl,
      _fallbackRpcUrls: rpcUrls,
      _chain: chain,
      // Implement viem-like methods via fetch fallback
      getTransactionReceipt: async ({ hash }: { hash: string }) => {
        // Element requires refinement: eth_getTransactionReceipt via HTTP fallback — needs real RPC keys
        const r = await jsonRpcWithFallback(chain, "eth_getTransactionReceipt", [hash]);
        if (!r) return null;
        // Normalize status to viem shape
        return {
          status: r.status === "0x1" ? "success" : r.status === "0x0" ? "reverted" : r.status,
          blockNumber: r.blockNumber ? BigInt(r.blockNumber) : null,
          blockHash: r.blockHash || null,
          logs: r.logs || [],
          transactionHash: r.transactionHash,
          chainId: r.chainId ? Number(r.chainId) : undefined,
        };
      },
      getTransaction: async ({ hash }: { hash: string }) => {
        const r = await jsonRpcWithFallback(chain, "eth_getTransactionByHash", [hash]);
        if (!r) return null;
        return {
          hash: r.hash,
          to: r.to,
          from: r.from,
          value: r.value ? BigInt(r.value) : BigInt(0),
          chainId: r.chainId ? Number(r.chainId) : undefined,
          blockNumber: r.blockNumber ? BigInt(r.blockNumber) : null,
        };
      },
      getBlockNumber: async () => {
        const r: string = await jsonRpcWithFallback(chain, "eth_blockNumber", []);
        return BigInt(r);
      },
      getLogs: async (args: any) => {
        // Element requires refinement: eth_getLogs with fromBlock/toBlock via HTTP fallback — needs indexed RPC
        const params: any = [{ address: args.address, topics: args.topics, fromBlock: args.fromBlock, toBlock: args.toBlock }];
        const r = await jsonRpcWithFallback(chain, "eth_getLogs", params);
        return r || [];
      },
    };
  } catch (e: any) {
    console.error(`[worker] createViemClient ${chain} failed: ${e?.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// Solana connection factory (with HTTP fallback shim)
// ---------------------------------------------------------------------------
type SolanaConnection = any;

function createSolanaConnection(): SolanaConnection | null {
  const rpcUrl = getRpcUrl("solana");
  if (!rpcUrl) {
    // Element requires refinement: RPC_URL_SOLANA missing — set to enable Solana polling
    return null;
  }
  try {
    if (typeof _SolConnection === "function") {
      // Element requires refinement: Connection uses RPC_URL_SOLANA — ensure commitment "confirmed" + ws endpoint if needed
      return new _SolConnection(rpcUrl, "confirmed");
    }
    console.warn("[worker] @solana/web3.js Connection not available — HTTP JSON-RPC fallback");
    return {
      _fallbackRpcUrl: rpcUrl,
      _chain: "solana" as const,
      getTransaction: async (sig: string, _opts?: any) => {
        // Element requires refinement: Solana getTransaction via HTTP JSON-RPC requires real RPC keys — commitment confirmed
        const r = await jsonRpcWithFallback("solana", "getTransaction", [sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0, encoding: "json" }]);
        return r;
      },
      getSlot: async (_commitment?: string) => {
        const r = await jsonRpcWithFallback("solana", "getSlot", [{ commitment: "confirmed" }]);
        return Number(r);
      },
      getSignaturesForAddress: async (addr: any, _opts?: any) => {
        const key = typeof addr === "string" ? addr : addr?.toBase58?.() || String(addr);
        const r = await jsonRpcWithFallback("solana", "getSignaturesForAddress", [key, { limit: 50 }]);
        return r || [];
      },
    };
  } catch (e: any) {
    console.error(`[worker] createSolanaConnection failed: ${e?.message}`);
    return null;
  }
}

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------
type InvoiceRow = {
  id: string;
  user_id: string;
  chain: string;
  chain_id: number;
  token: string;
  token_address: string | null;
  amount: string; // placeholder base units or usd cents string
  amount_usd_cents: number;
  address_to: string;
  tx_hash: string | null;
  status: string;
  created_at: string;
  confirmed_at: string | null;
  expires_at: string;
  block_number: number | null;
  block_hash: string | null;
};

function fetchPendingInvoices(): InvoiceRow[] {
  const db = getDb();
  try {
    const rows = db
      .prepare(
        `SELECT * FROM invoices WHERE status IN ('pending','confirming') ORDER BY created_at ASC LIMIT 200`
      )
      .all() as InvoiceRow[];
    // update cache
    for (const r of rows) pendingInvoicesCache.set(r.id, r);
    // cleanup expired cache entries not in DB
    const ids = new Set(rows.map((r) => r.id));
    for (const k of [...pendingInvoicesCache.keys()]) if (!ids.has(k)) pendingInvoicesCache.delete(k);
    return rows;
  } catch (e: any) {
    console.warn(`[worker] fetchPendingInvoices failed: ${e?.message}`);
    return [];
  }
}

function expireSweep(): number {
  const db = getDb();
  const now = new Date().toISOString();
  try {
    const res = db
      .prepare(`UPDATE invoices SET status='expired' WHERE status IN ('pending','confirming') AND tx_hash IS NULL AND expires_at < ?`)
      .run(now);
    const n = (res as any)?.changes ?? 0;
    if (n > 0) console.log(`[worker] expireSweep expired ${n} invoices`);
    lastExpireSweepAt = new Date().toISOString();
    lastExpireCount = n;
    return n;
  } catch (e: any) {
    console.warn(`[worker] expireSweep failed: ${e?.message}`);
    return 0;
  }
}

/**
 * Atomically update invoice status + credits
 * BEGIN IMMEDIATE; UPDATE invoices; UPDATE credits (balance_usd_cents); COMMIT
 * Uses db.transaction if available, else serial exec with BEGIN IMMEDIATE / COMMIT
 * tx_hash UNIQUE enforced at DB level; idempotency via status + tx_hash checks
 */
function confirmInvoiceAtomic(
  invoice: InvoiceRow,
  txHash: string,
  blockNumber: number | null,
  blockHash: string | null,
  confirmStatus: "confirming" | "confirmed",
  observedCentsInput?: bigint
): boolean {
  const db = getDb();
  const now = new Date().toISOString();
  const invoiceCents = BigInt(Number(invoice.amount_usd_cents) || 0);
  // P1-4: credit only what was observed, capped at invoice amount (prevent full-credit on 0.5% underpay)
  let creditCents: bigint = invoiceCents;
  if (observedCentsInput !== undefined && observedCentsInput !== null) {
    try {
      const obs = BigInt(observedCentsInput as any);
      creditCents = obs < invoiceCents ? obs : invoiceCents;
    } catch {}
  }
  if (creditCents < BigInt(0)) creditCents = BigInt(0);
  const creditCentsNum = Number(creditCents);

  try {
    // @ts-ignore — db.transaction exists on better-sqlite3
    const hasTransaction = typeof (db as any).transaction === "function";

    if (hasTransaction) {
      // Branch using db.transaction wrapper — all idempotency checks INSIDE transaction (P0-3)
      let earlyReturn: boolean | null = null;
      let shouldFailCommit = false;
      const inner = () => {
        const existing = db.prepare(`SELECT status, tx_hash FROM invoices WHERE id=?`).get(invoice.id) as any;
        if (existing && existing.status === "confirmed") {
          console.log(`[worker] invoice ${invoice.id} already confirmed (inside tx), skip atomic`);
          earlyReturn = true;
          return;
        }
        if (txHash) {
          const dup = db.prepare(`SELECT id FROM invoices WHERE tx_hash=? AND id != ?`).get(txHash, invoice.id) as any;
          if (dup) {
            console.warn(`[worker] tx_hash ${txHash} already used by invoice ${dup.id} — duplicate rejected for ${invoice.id} (inside tx)`);
            try {
              db.prepare(`UPDATE invoices SET status='failed' WHERE id=?`).run(invoice.id);
            } catch {}
            earlyReturn = false;
            shouldFailCommit = true;
            return;
          }
        }
        if (existing && existing.tx_hash && existing.tx_hash !== txHash) {
          console.warn(`[worker] invoice ${invoice.id} tx_hash mismatch existing=${existing.tx_hash} new=${txHash} (inside tx)`);
          earlyReturn = false;
          return;
        }

        if (confirmStatus === "confirmed") {
          const upd: any = db
            .prepare(
              `UPDATE invoices SET tx_hash=?, status='confirmed', confirmed_at=?, block_number=COALESCE(?, block_number), block_hash=COALESCE(?, block_hash) WHERE id=? AND status IN ('pending','confirming')`
            )
            .run(txHash, now, blockNumber, blockHash, invoice.id);
          if ((upd as any)?.changes === 0) {
            console.log(`[worker] invoice ${invoice.id} atomic update no-op (changes 0) — not in pending/confirming`);
            earlyReturn = true;
            return;
          }
          // Upsert credits — atomic with invoice update, using capped creditCents (P1-4)
          const existingCredit = db.prepare(`SELECT balance_usd_cents FROM credits WHERE user_id=?`).get(invoice.user_id) as any;
          if (existingCredit) {
            db.prepare(`UPDATE credits SET balance_usd_cents = balance_usd_cents + ?, updated_at=? WHERE user_id=?`).run(
              creditCentsNum,
              now,
              invoice.user_id
            );
          } else {
            db.prepare(`INSERT INTO credits (user_id, balance_usd_cents, updated_at) VALUES (?, ?, ?)`).run(
              invoice.user_id,
              creditCentsNum,
              now
            );
          }
        } else {
          const upd: any = db
            .prepare(
              `UPDATE invoices SET tx_hash=?, status='confirming', block_number=COALESCE(?, block_number), block_hash=COALESCE(?, block_hash) WHERE id=? AND status IN ('pending','confirming')`
            )
            .run(txHash, blockNumber, blockHash, invoice.id);
          if ((upd as any)?.changes === 0) {
            console.log(`[worker] invoice ${invoice.id} confirming no-op (changes 0)`);
            earlyReturn = true;
            return;
          }
        }
      };

      // Execute inside better-sqlite3 transaction; throw to rollback on failure signal
      const tx = (db as any).transaction(() => {
        inner();
        if (earlyReturn === false && !shouldFailCommit) {
          // tx_hash mismatch idempotency — rollback via throw
          throw new Error("__ROLLBACK_IDEMPOTENCY__");
        }
      });
      try {
        tx();
      } catch (e: any) {
        if (String(e?.message) === "__ROLLBACK_IDEMPOTENCY__") {
          return false;
        }
        // For shouldFailCommit we already updated to failed and want to commit that, so don't rethrow
        if (shouldFailCommit && earlyReturn === false) {
          // tx already committed the failed status (since we didn't throw), return false
          return false;
        }
        throw e;
      }
      if (earlyReturn === true) return true;
      if (earlyReturn === false) return false;
      console.log(`[worker] atomic update ${invoice.id} -> ${confirmStatus} tx=${txHash} cents=${creditCentsNum} (tx wrapper, inside checks)`);
      return true;
    } else {
      // Fallback raw BEGIN IMMEDIATE for node:sqlite — also all checks INSIDE
      db.exec("BEGIN IMMEDIATE;");
      try {
        const existing = db.prepare(`SELECT status, tx_hash FROM invoices WHERE id=?`).get(invoice.id) as any;
        if (existing && existing.status === "confirmed") {
          console.log(`[worker] invoice ${invoice.id} already confirmed (inside BEGIN), skip atomic`);
          db.exec("ROLLBACK;");
          return true;
        }
        if (txHash) {
          const dup = db.prepare(`SELECT id FROM invoices WHERE tx_hash=? AND id != ?`).get(txHash, invoice.id) as any;
          if (dup) {
            console.warn(`[worker] tx_hash ${txHash} already used by invoice ${dup.id} — duplicate rejected for ${invoice.id} (inside BEGIN)`);
            try {
              db.prepare(`UPDATE invoices SET status='failed' WHERE id=?`).run(invoice.id);
            } catch {}
            db.exec("COMMIT;");
            return false;
          }
        }
        if (existing && existing.tx_hash && existing.tx_hash !== txHash) {
          console.warn(`[worker] invoice ${invoice.id} tx_hash mismatch existing=${existing.tx_hash} new=${txHash} (inside BEGIN)`);
          db.exec("ROLLBACK;");
          return false;
        }

        if (confirmStatus === "confirmed") {
          const upd: any = db
            .prepare(
              `UPDATE invoices SET tx_hash=?, status='confirmed', confirmed_at=?, block_number=COALESCE(?, block_number), block_hash=COALESCE(?, block_hash) WHERE id=? AND status IN ('pending','confirming')`
            )
            .run(txHash, now, blockNumber, blockHash, invoice.id);
          if ((upd as any)?.changes === 0) {
            console.log(`[worker] invoice ${invoice.id} atomic update no-op (changes 0) fallback`);
            db.exec("ROLLBACK;");
            return true;
          }
          const existingCredit = db.prepare(`SELECT balance_usd_cents FROM credits WHERE user_id=?`).get(invoice.user_id) as any;
          if (existingCredit) {
            db.prepare(`UPDATE credits SET balance_usd_cents = balance_usd_cents + ?, updated_at=? WHERE user_id=?`).run(
              creditCentsNum,
              now,
              invoice.user_id
            );
          } else {
            db.prepare(`INSERT INTO credits (user_id, balance_usd_cents, updated_at) VALUES (?, ?, ?)`).run(
              invoice.user_id,
              creditCentsNum,
              now
            );
          }
        } else {
          const upd: any = db
            .prepare(
              `UPDATE invoices SET tx_hash=?, status='confirming', block_number=COALESCE(?, block_number), block_hash=COALESCE(?, block_hash) WHERE id=? AND status IN ('pending','confirming')`
            )
            .run(txHash, blockNumber, blockHash, invoice.id);
          if ((upd as any)?.changes === 0) {
            console.log(`[worker] invoice ${invoice.id} confirming no-op fallback`);
            db.exec("ROLLBACK;");
            return true;
          }
        }
        db.exec("COMMIT;");
        console.log(`[worker] atomic update ${invoice.id} -> ${confirmStatus} tx=${txHash} cents=${creditCentsNum} (fallback BEGIN, inside checks)`);
        return true;
      } catch (e) {
        try {
          db.exec("ROLLBACK;");
        } catch {}
        throw e;
      }
    }
  } catch (e: any) {
    const msg = String(e?.message || "");
    if (msg === "__ROLLBACK_IDEMPOTENCY__") return false;
    if (msg.includes("UNIQUE") || msg.includes("unique") || msg.includes("constraint")) {
      console.error(`[worker] confirmInvoiceAtomic ${invoice.id} UNIQUE violation tx=${txHash}: ${msg}`);
    } else {
      console.error(`[worker] confirmInvoiceAtomic ${invoice.id} failed: ${msg}`);
    }
    try {
      db.exec("ROLLBACK;");
    } catch {}
    return false;
  }
}

// ---------------------------------------------------------------------------
// Decimals / unit helper (P0-2 fix) — convert base units to USD cents
// ---------------------------------------------------------------------------
function baseUnitsToCents(chain: string, token: string, baseUnits: bigint): bigint {
  // TOKEN_DECIMALS from lib/payments/tokens.ts
  // For stablecoins USDC/USDT: $1 = 1 token, so cents = baseUnits * 100 / 10^decimals
  // For native (ETH/BNB/SOL etc): no oracle yet — treat similarly 1 native = $1 placeholder to at least prevent wei bypass
  // TODO: replace native conversion with price oracle (Chainlink / Pyth) before enabling native payments for production
  let decimals: number | undefined;
  const nativeSym = (CHAIN_CONFIG as any)[chain]?.nativeSymbol as string | undefined;
  if (isNative(chain, token)) {
    if (nativeSym) decimals = (TOKEN_DECIMALS as any)[nativeSym.toUpperCase()];
    if (decimals === undefined) decimals = (TOKEN_DECIMALS as any)[String(token).toUpperCase()];
    console.warn(`[worker] baseUnitsToCents native ${chain}/${token} using 1 token = $1 placeholder — TODO oracle (decimals=${decimals})`);
  } else {
    // token may be symbol like "USDC" or address — map symbol; if address default to 6 for stable
    const sym = String(token).toUpperCase();
    decimals = (TOKEN_DECIMALS as any)[sym];
    if (decimals === undefined) {
      // Try to infer from token_address? fallback 6
      decimals = 6;
      console.warn(`[worker] baseUnitsToCents unknown decimals for ${chain}/${token}, default 6`);
    }
  }
  if (decimals === undefined || decimals === null) decimals = 6;
  try {
    const pow = BigInt(10) ** BigInt(decimals);
    return (baseUnits * BigInt(100)) / pow;
  } catch {
    return BigInt(0);
  }
}

// ---------------------------------------------------------------------------
// Amount tolerance helper
// ---------------------------------------------------------------------------
function isAmountWithinTolerance(invoiceAmountStr: string | bigint, observedAmountStr: string | bigint): boolean {
  try {
    // Both amounts as bigint string (base units or cents placeholder)
    // Element requires refinement: when token decimals differ, need to normalize both to same units via price oracle
    const inv = BigInt(String(invoiceAmountStr));
    const obs = BigInt(String(observedAmountStr));
    if (inv === BigInt(0)) return false;
    const diff = inv > obs ? inv - obs : obs - inv;
    // tolerance = inv * BPS / 10000
    const tolerance = (inv * BigInt(INVOICE_AMOUNT_TOLERANCE_BPS)) / BigInt(10000);
    // Allow diff <= tolerance (or if tolerance==0 require exact)
    return diff <= tolerance;
  } catch {
    // Fallback numeric
    const inv = Number(invoiceAmountStr);
    const obs = Number(observedAmountStr);
    if (!Number.isFinite(inv) || inv === 0) return false;
    const diff = Math.abs(inv - obs);
    return diff <= (inv * INVOICE_AMOUNT_TOLERANCE_BPS) / 10000;
  }
}

// ---------------------------------------------------------------------------
// EVM helpers: ERC20 Transfer and native
// ---------------------------------------------------------------------------
const ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const ERC20_TRANSFER_ABI = [
  { type: "event", name: "Transfer", inputs: [{ name: "from", type: "address", indexed: true }, { name: "to", type: "address", indexed: true }, { name: "value", type: "uint256" }] },
] as const;

function toChecksumAddress(addr: string): string {
  return addr ? addr.toLowerCase() : "";
}

async function pollEvmChain(chain: EvmChainKey): Promise<void> {
  const client = createViemClient(chain);
  if (!client) {
    // Element requires refinement: RPC URL or viem client missing — cannot poll chain without live RPC keys
    errorsPerChain[chain] = "missing RPC_URL or viem client";
    return;
  }
  errorsPerChain[chain] = null;
  const invoices = fetchPendingInvoices().filter((inv) => inv.chain === chain);
  if (invoices.length === 0) {
    lastPollPerChain[chain] = new Date().toISOString();
    return;
  }
  console.log(`[worker] poll ${chain} invoices=${invoices.length} confirmationsRequired=${getConfirmationsRequired(chain)}`);

  for (const inv of invoices) {
    // Use limiter per invoice
    await limit(async () => {
      try {
        await processEvmInvoice(client, chain, inv);
      } catch (e: any) {
        console.warn(`[worker] processEvmInvoice ${chain} ${inv.id} error: ${e?.message}`);
      }
    });
  }
  lastPollPerChain[chain] = new Date().toISOString();
}

async function processEvmInvoice(client: any, chain: EvmChainKey, invoice: InvoiceRow): Promise<void> {
  // P1-1 expired immortal fix: expire both pending and confirming without tx_hash
  if ((invoice.status === "pending" || invoice.status === "confirming") && !invoice.tx_hash && new Date(invoice.expires_at).getTime() < Date.now()) {
    try {
      const db = getDb();
      db.prepare(`UPDATE invoices SET status='expired' WHERE id=? AND status IN ('pending','confirming') AND tx_hash IS NULL`).run(invoice.id);
    } catch {}
    console.log(`[worker] ${chain} ${invoice.id} expired (inline sweep)`);
    return;
  }

  const confirmationsRequired = getConfirmationsRequired(chain);
  const paymentAddr = PAYMENT_ADDRESS.toLowerCase();
  const expectedChainId = Number(CHAIN_CONFIG[chain]?.chainId);

  // If invoice already has tx_hash — verify receipt + confirmations
  if (invoice.tx_hash) {
    const hash = invoice.tx_hash as `0x${string}`;
    // Element requires refinement: live getTransactionReceipt + getBlockNumber via RPC_URL_* — requires real RPC keys
    try {
      let receipt: any = null;
      let currentBlock: bigint | number | null = null;
      let txForChainId: any = null;
      if (typeof client.getTransactionReceipt === "function") {
        receipt = await client.getTransactionReceipt({ hash }).catch(() => null);
        // also fetch current block for confirmations
        try {
          currentBlock = await client.getBlockNumber();
        } catch {
          // fallback to jsonRpcWithFallback if viem getBlockNumber fails
          try {
            const bn: string = await jsonRpcWithFallback(chain, "eth_blockNumber", []);
            currentBlock = BigInt(bn);
          } catch {
            currentBlock = null;
          }
        }
        // Also fetch transaction for chainId check (covers both native and ERC20 paths)
        if (typeof client.getTransaction === "function") {
          txForChainId = await client.getTransaction({ hash }).catch(() => null);
        }
        if (!txForChainId) {
          try {
            txForChainId = await jsonRpcWithFallback(chain, "eth_getTransactionByHash", [hash]);
            if (txForChainId && txForChainId.value) txForChainId.value = BigInt(txForChainId.value);
            if (txForChainId && txForChainId.chainId) txForChainId.chainId = Number(txForChainId.chainId);
          } catch {}
        }
      } else {
        console.warn(`[worker] ${chain} client lacks getTransactionReceipt — tx ${hash}`);
        return;
      }

      if (!receipt) {
        console.log(`[worker] ${chain} ${invoice.id} receipt not found yet for ${hash}`);
        // Keep confirming if already confirming, else pending
        return;
      }
      // receipt status check: viem returns "success"/"reverted" string, raw RPC returns 0x1/0x0, number 1/0
      const statusOk = receipt.status === "success" || receipt.status === 1 || receipt.status === "0x1" || receipt.status === "1";
      if (!statusOk) {
        // failed tx — mark failed with block info if present
        const db = getDb();
        db.prepare(`UPDATE invoices SET status='failed', block_number=?, block_hash=? WHERE id=?`).run(
          receipt.blockNumber ? Number(receipt.blockNumber) : null,
          receipt.blockHash || null,
          invoice.id
        );
        console.warn(`[worker] ${chain} ${invoice.id} tx ${hash} receipt status failed: ${receipt.status}`);
        return;
      }
      // ChainId verification — compare transaction chainId to expected per CHAIN_CONFIG
      if (txForChainId && txForChainId.chainId != null) {
        const gotChainId = Number(txForChainId.chainId);
        if (Number.isFinite(expectedChainId) && Number.isFinite(gotChainId) && gotChainId !== expectedChainId) {
          console.warn(`[worker] ${chain} ${invoice.id} chainId mismatch tx=${gotChainId} expected=${expectedChainId} hash=${hash}`);
          // Do not confirm — wrong chain
          return;
        }
      } else {
        // Element requires refinement: chainId not present in receipt/tx — fallback to eth_chainId RPC check vs expected
        try {
          const chainIdHex: string = await jsonRpcWithFallback(chain, "eth_chainId", []);
          if (chainIdHex) {
            const rpcChainId = Number(chainIdHex);
            if (rpcChainId !== expectedChainId) {
              console.warn(`[worker] ${chain} ${invoice.id} rpc chainId ${rpcChainId} != expected ${expectedChainId}`);
              return;
            }
          }
        } catch {}
      }
      // Confirmations gating: confirming -> confirmed after required blocks
      const hasBlockInfo = receipt.blockNumber != null && currentBlock != null;
      if (hasBlockInfo) {
        const blockNum = Number(receipt.blockNumber);
        const cur = Number(currentBlock);
        const confs = cur - blockNum;
        if (confs < 0) {
          console.warn(`[worker] ${chain} ${invoice.id} negative confs ${confs} (reorg?) — treating as confirming`);
          if (invoice.status !== "confirming") confirmInvoiceAtomic(invoice, hash, blockNum, receipt.blockHash, "confirming");
          return;
        }
        if (confs < confirmationsRequired) {
          // Not enough confirmations — mark confirming
          if (invoice.status !== "confirming") {
            confirmInvoiceAtomic(invoice, hash, blockNum, receipt.blockHash, "confirming");
          }
          console.log(`[worker] ${chain} ${invoice.id} confs ${confs}/${confirmationsRequired} — confirming`);
          return;
        }
      } else if (receipt.blockNumber != null) {
        // We have receipt but not current block — cannot verify confirmations, treat as confirming until next poll
        // Element requires refinement: eth_blockNumber RPC returned null — retry on next poll before confirming
        console.log(`[worker] ${chain} ${invoice.id} blockNumber=${receipt.blockNumber} but currentBlock unavailable — confirming until next poll`);
        if (invoice.status !== "confirming") {
          confirmInvoiceAtomic(invoice, hash, Number(receipt.blockNumber), receipt.blockHash, "confirming");
        }
        return;
      } else {
        // No blockNumber yet (pending) — keep pending
        console.log(`[worker] ${chain} ${invoice.id} receipt has no blockNumber yet — pending`);
        return;
      }

      // P0-1 memo hijack mitigation: ensure block timestamp within invoice lifetime (prevent claiming old tx)
      // Fetch block timestamp via client.getBlock or eth_getBlockByNumber and validate against invoice window
      try {
        let blockTimestamp: Date | null = null;
        if (receipt.blockNumber != null) {
          try {
            let block: any = null;
            if (typeof client.getBlock === "function") {
              block = await client.getBlock({ blockNumber: receipt.blockNumber }).catch(() => null);
            }
            if (!block) {
              const hex = `0x${Number(receipt.blockNumber).toString(16)}`;
              const raw: any = await jsonRpcWithFallback(chain, "eth_getBlockByNumber", [hex, false]).catch(() => null);
              block = raw;
            }
            if (block) {
              let ts: number | bigint | string | null = (block as any).timestamp ?? null;
              if (typeof ts === "string" && ts.startsWith("0x")) ts = Number(ts);
              if (typeof ts === "bigint") ts = Number(ts);
              if (typeof ts === "number" && Number.isFinite(ts)) {
                // timestamp is seconds since epoch
                blockTimestamp = new Date(ts * 1000);
              }
            }
          } catch {}
        }
        if (blockTimestamp) {
          const created = new Date(invoice.created_at);
          const expires = new Date(invoice.expires_at);
          if (blockTimestamp < created || blockTimestamp > expires) {
            console.warn(
              `[worker] ${chain} ${invoice.id} block timestamp ${blockTimestamp.toISOString()} outside invoice window ${created.toISOString()} - ${expires.toISOString()} — potential hijack, reject`
            );
            return;
          }
        } else {
          console.warn(`[worker] ${chain} ${invoice.id} could not fetch block timestamp for hijack check — continuing with caution`);
        }
        // For native, additionally check tx.input contains invoice.id hex when data present (memo mitigation for single address)
        if (isNative(chain, invoice.token) && txForChainId) {
          const input = (txForChainId as any).input || (txForChainId as any).data || "";
          if (input && input !== "0x" && input !== "0x0" && typeof input === "string" && input.length > 2) {
            const idHex = invoice.id.replace(/-/g, "").toLowerCase();
            // ERC20 via native path shouldn't have memo, but for native transfers we warn if memo missing
            if (!input.toLowerCase().includes(idHex)) {
              console.warn(
                `[worker] ${chain} ${invoice.id} native tx.input does not contain invoice.id hex ${idHex} — memo hijack risk (single address for 6 chains). Allowing but flagged.`
              );
              // Note: not hard-rejecting to avoid breaking wallets that don't support memo, but log for monitoring.
              // To enforce strict memo, uncomment next line: return;
            }
          } else if (!input || input === "0x") {
            console.warn(`[worker] ${chain} ${invoice.id} native tx has empty input — no memo (invoice.id as memo not enforced, single address vulnerability).`);
          }
        } else if (!isNative(chain, invoice.token)) {
          // ERC20: single address vulnerability warning — ERC20 Transfer has no memo field, unique amount suffix recommended
          // Mitigated via block timestamp window above; consider adding unique amount suffix (e.g., cents + invoice suffix) for HD wallet alternative
        }
      } catch (e: any) {
        console.warn(`[worker] ${chain} ${invoice.id} hijack mitigation check error: ${e?.message}`);
      }

      // Validate amount + destination
      // For native we already have txForChainId; for ERC20 we use logs
      const isNat = isNative(chain, invoice.token);
      if (isNat) {
        // Native transfer: need getTransaction value and to==PAYMENT_ADDRESS
        let tx: any = txForChainId;
        if (!tx && typeof client.getTransaction === "function") {
          // Element requires refinement: live getTransaction via RPC_URL_* to validate value and to==PAYMENT_ADDRESS
          tx = await client.getTransaction({ hash }).catch(() => null);
        }
        if (!tx) {
          // Final fallback via raw RPC
          try {
            tx = await jsonRpcWithFallback(chain, "eth_getTransactionByHash", [hash]);
            if (tx && tx.value) tx.value = BigInt(tx.value);
          } catch {}
        }
        if (!tx) {
          console.warn(`[worker] ${chain} ${invoice.id} native tx not found ${hash}`);
          return;
        }
        const toOk = toChecksumAddress(tx.to || "") === paymentAddr;
        if (!toOk) {
          console.warn(`[worker] ${chain} ${invoice.id} native to mismatch ${tx.to} vs ${PAYMENT_ADDRESS}`);
          // Don't mark failed immediately — maybe ERC20? but log
          return;
        }
        const valueStr = String(tx.value ?? "0");
        // P0-2: convert observed base units (wei 18 decimals) to cents before tolerance check
        let observedCentsNative: bigint;
        try {
          observedCentsNative = baseUnitsToCents(chain, invoice.token, BigInt(valueStr));
        } catch {
          observedCentsNative = BigInt(0);
        }
        if (!isAmountWithinTolerance(BigInt(invoice.amount_usd_cents), observedCentsNative)) {
          console.warn(
            `[worker] ${chain} ${invoice.id} native amount mismatch inv=${invoice.amount_usd_cents} obs=${valueStr} cents=${String(observedCentsNative)} bps=${INVOICE_AMOUNT_TOLERANCE_BPS}`
          );
          return;
        }
        // All good — confirm (have met confirmations above), pass observedCents for capped credit (P1-4)
        confirmInvoiceAtomic(invoice, hash, receipt.blockNumber ? Number(receipt.blockNumber) : null, receipt.blockHash, "confirmed", observedCentsNative);
      } else {
        // ERC20: verify Transfer log to PAYMENT_ADDRESS with correct amount and token address
        // Uses receipt.logs topic 0xddf252... + amount tolerance INVOICE_AMOUNT_TOLERANCE_BPS=50
        const tokenAddr = (invoice.token_address || "").toLowerCase();
        if (!tokenAddr || tokenAddr === "native") {
          console.warn(`[worker] ${chain} ${invoice.id} missing token_address for ERC20`);
          return;
        }
        const logs = receipt.logs || [];
        let matched = false;
        let matchedAmount: string | null = null;
        for (const log of logs) {
          const addr = (log.address || "").toLowerCase();
          if (addr !== tokenAddr) continue;
          // topics[0] is Transfer sig, topics[1]=from, topics[2]=to
          const topics = log.topics || [];
          if (topics.length < 3) continue;
          if (topics[0]?.toLowerCase() !== ERC20_TRANSFER_TOPIC) continue;
          // topic2 is to address padded
          const toTopic = topics[2]?.toLowerCase() || "";
          // Extract last 40 chars for address
          const toAddr = "0x" + toTopic.slice(-40);
          if (toAddr.toLowerCase() !== paymentAddr) continue;
          // data is value hex
          const data = log.data as string;
          try {
            const val = BigInt(data);
            const valStr = String(val);
            // P0-2: convert ERC20 base units (6 decimals) to cents
            let observedCentsErc: bigint;
            try {
              observedCentsErc = baseUnitsToCents(chain, invoice.token, val);
            } catch {
              observedCentsErc = BigInt(0);
            }
            if (isAmountWithinTolerance(BigInt(invoice.amount_usd_cents), observedCentsErc)) {
              matched = true;
              matchedAmount = valStr;
              // store observed cents for later capped credit
              (invoice as any).__observedCents = observedCentsErc;
              break;
            } else {
              console.warn(
                `[worker] ${chain} ${invoice.id} erc20 amount mismatch inv=${invoice.amount_usd_cents} logVal=${valStr} cents=${String(observedCentsErc)}`
              );
            }
          } catch {}
        }
        if (!matched) {
          console.warn(`[worker] ${chain} ${invoice.id} no matching Transfer log to ${PAYMENT_ADDRESS} for token ${tokenAddr}`);
          return;
        }
        const ercObserved: bigint | undefined = (invoice as any).__observedCents;
        confirmInvoiceAtomic(invoice, hash, receipt.blockNumber ? Number(receipt.blockNumber) : null, receipt.blockHash, "confirmed", ercObserved);
        try { delete (invoice as any).__observedCents; } catch {}
        console.log(`[worker] ${chain} ${invoice.id} erc20 confirmed amount=${matchedAmount}`);
      }
    } catch (e: any) {
      console.warn(`[worker] ${chain} ${invoice.id} tx_hash verification error: ${e?.message}`);
    }
    return;
  }

  // No tx_hash yet — try auto-discovery via getLogs scanning
  // Element requires refinement: auto-discovery without tx_hash requires indexed RPC scanning (getLogs fromBlock..toBlock) — needs real RPC keys and block range logic
  // Current stub: attempt to search logs for token Transfer to PAYMENT_ADDRESS with invoice amount tolerance
  // For native auto-discovery, would need trace_block or eth_getLogs for native? native not event — need to scan blocks for transactions to address
  // Leave as pending until manual verify pushes tx_hash

  // Example placeholder for getLogs auto-discovery (commented, not executed without live RPC):
  // if (!isNative(chain, invoice.token) && typeof client.getLogs === "function") {
  //   const tokenAddr = invoice.token_address as `0x${string}`;
  //   const logs = await client.getLogs({ address: tokenAddr, event: { type:"event", name:"Transfer", inputs:[...] }, args:{to:PAYMENT_ADDRESS}, fromBlock: latest-5000n, toBlock:"latest" });
  //   // Match amount tolerance, take newest log, extraction of transactionHash -> confirmInvoiceAtomic(...)
  // }

  // For now, just leave pending — worker will re-poll
  console.log(`[worker] ${chain} ${invoice.id} no tx_hash yet — awaiting manual verify or auto-discovery (Element requires refinement)`);
}

// ---------------------------------------------------------------------------
// Solana helpers
// ---------------------------------------------------------------------------
async function pollSolana(): Promise<void> {
  const chain: ChainKey = "solana";
  const connection = createSolanaConnection();
  if (!connection) {
    errorsPerChain[chain] = "missing RPC_URL_SOLANA or @solana/web3.js";
    return;
  }
  errorsPerChain[chain] = null;
  const invoices = fetchPendingInvoices().filter((inv) => inv.chain === "solana");
  if (invoices.length === 0) {
    lastPollPerChain[chain] = new Date().toISOString();
    return;
  }
  console.log(`[worker] poll solana invoices=${invoices.length}`);

  for (const inv of invoices) {
    await limit(async () => {
      try {
        await processSolanaInvoice(connection, inv);
      } catch (e: any) {
        console.warn(`[worker] solana ${inv.id} error: ${e?.message}`);
      }
    });
  }
  lastPollPerChain[chain] = new Date().toISOString();
}

async function processSolanaInvoice(connection: any, invoice: InvoiceRow): Promise<void> {
  // P1-1 expired immortal fix for Solana
  if ((invoice.status === "pending" || invoice.status === "confirming") && !invoice.tx_hash && new Date(invoice.expires_at).getTime() < Date.now()) {
    try {
      const db = getDb();
      db.prepare(`UPDATE invoices SET status='expired' WHERE id=? AND status IN ('pending','confirming') AND tx_hash IS NULL`).run(invoice.id);
    } catch {}
    console.log(`[worker] solana ${invoice.id} expired (inline sweep)`);
    return;
  }

  const confirmationsRequired = getConfirmationsRequired("solana"); // 32 slots per spec
  const solAddr = SOLANA_ADDRESS;

  if (invoice.tx_hash) {
    const sig = invoice.tx_hash;
    // Element requires refinement: live Solana getTransaction + getSlot via RPC_URL_SOLANA — requires real RPC keys
    try {
      let tx: any = null;
      let currentSlot: number | null = null;
      if (typeof connection.getTransaction === "function") {
        // @ts-ignore — commitment param; Element requires refinement: ensure commitment "confirmed" + maxSupportedTransactionVersion:0
        tx = await connection.getTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 }).catch(() => null);
        try {
          currentSlot = await connection.getSlot("confirmed");
        } catch {
          // Fallback via raw RPC if getSlot fails
          try {
            const r = await jsonRpcWithFallback("solana", "getSlot", [{ commitment: "confirmed" }]);
            currentSlot = Number(r);
          } catch {}
        }
      } else {
        console.warn(`[worker] solana connection lacks getTransaction — sig ${sig}`);
        return;
      }
      if (!tx) {
        console.log(`[worker] solana ${invoice.id} tx not found ${sig}`);
        return;
      }
      if (tx.meta?.err) {
        const db = getDb();
        db.prepare(`UPDATE invoices SET status='failed' WHERE id=?`).run(invoice.id);
        console.warn(`[worker] solana ${invoice.id} tx err ${JSON.stringify(tx.meta.err)}`);
        return;
      }
      // Validate confirmations via slot (32 conf slots required)
      if (tx.slot && currentSlot !== null) {
        const confs = currentSlot - tx.slot;
        if (confs < 0) {
          console.warn(`[worker] solana ${invoice.id} negative confs ${confs} — confirming`);
          if (invoice.status !== "confirming") confirmInvoiceAtomic(invoice, sig, tx.slot, null, "confirming");
          return;
        }
        if (confs < confirmationsRequired) {
          if (invoice.status !== "confirming") confirmInvoiceAtomic(invoice, sig, tx.slot, null, "confirming");
          console.log(`[worker] solana ${invoice.id} confs ${confs}/${confirmationsRequired} confirming`);
          return;
        }
      } else if (tx.slot && currentSlot === null) {
        // Element requires refinement: cannot fetch currentSlot without live RPC — treat as confirming until next poll
        console.log(`[worker] solana ${invoice.id} slot=${tx.slot} but currentSlot unavailable — confirming`);
        if (invoice.status !== "confirming") confirmInvoiceAtomic(invoice, sig, tx.slot, null, "confirming");
        return;
      }
      // ---- Amount + destination validation ----
      const isNatSol = isNative("solana", invoice.token);
      let observedAmountStr: string | null = null;
      if (isNatSol) {
        // Native SOL: parse preBalances/postBalances delta for SOLANA_ADDRESS
        // Element requires refinement: accountKeys may be versioned (v0) with addressTableLookups; ensure proper index resolution with live RPC
        try {
          const msg: any = tx.transaction?.message;
          // Try both legacy and v0 shapes
          let accountKeys: string[] = [];
          if (msg?.accountKeys) accountKeys = msg.accountKeys.map((k: any) => (typeof k === "string" ? k : k?.toBase58?.() || String(k)));
          else if (msg?.getAccountKeys) {
            const ak = msg.getAccountKeys();
            accountKeys = (ak?.staticAccountKeys || []).map((k: any) => k?.toBase58?.() || String(k));
          }
          // Fallback: try meta pre/post balances without keys — assume first key is solAddr if not found?
          const idx = accountKeys.findIndex((k) => k === solAddr);
          if (idx >= 0 && Array.isArray(tx.meta?.preBalances) && Array.isArray(tx.meta?.postBalances)) {
            const pre = Number(tx.meta.preBalances[idx] || 0);
            const post = Number(tx.meta.postBalances[idx] || 0);
            const delta = post - pre; // lamports credited to SOLANA_ADDRESS
            if (delta > 0) observedAmountStr = String(delta);
            else {
              console.warn(`[worker] solana ${invoice.id} native delta non-positive pre=${pre} post=${post} idx=${idx}`);
            }
          } else {
            // Element requires refinement: unable to locate SOLANA_ADDRESS in accountKeys — try preBalances length fallback or fetch ATA
            console.warn(`[worker] solana ${invoice.id} cannot resolve native SOL amount — accountKeys missing SOLANA_ADDRESS (idx=${idx})`);
            // Fallback: attempt to use dummy? Instead require real keys — mark confirming and retry next poll? For now try meta without index:
            if (Array.isArray(tx.meta?.preBalances) && Array.isArray(tx.meta?.postBalances) && accountKeys.length === 0) {
              // Element requires refinement: legacy transaction without accountKeys — use raw JSON RPC accountKeys from getTransaction with encoding jsonParsed
              // Try jsonParsed variant via fallback RPC
              try {
                const parsed: any = await jsonRpcWithFallback("solana", "getTransaction", [sig, { commitment: "confirmed", encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
                const pKeys: string[] = parsed?.transaction?.message?.accountKeys || [];
                const pIdx = pKeys.findIndex((k) => String(k) === solAddr);
                if (pIdx >= 0) {
                  const pre = Number(parsed?.meta?.preBalances?.[pIdx] || 0);
                  const post = Number(parsed?.meta?.postBalances?.[pIdx] || 0);
                  observedAmountStr = String(post - pre);
                }
              } catch {}
            }
          }
        } catch (e: any) {
          console.warn(`[worker] solana ${invoice.id} native pre/post parse error: ${e?.message}`);
        }
      } else {
        // SPL token: need to parse token transfer to ATA of SOLANA_ADDRESS
        // Element requires refinement: SPL parsing requires ATA derivation (getAssociatedTokenAddress) + mint decimals via RPC_URL_SOLANA + token account lookup
        // Strategy: check preTokenBalances/postTokenBalances delta for mint == invoice.token_address and owner == SOLANA_ADDRESS
        try {
          const mint = (invoice.token_address || "").trim();
          // Try preTokenBalances / postTokenBalances if present (jsonParsed encoding may provide token balances)
          const preTokens: any[] = tx.meta?.preTokenBalances || [];
          const postTokens: any[] = tx.meta?.postTokenBalances || [];
          // Find balances where mint matches and owner matches SOLANA_ADDRESS (when available) or accountIndex matches destination ATA
          // Collect deltas per accountIndex
          const deltas = new Map<number, number>();
          for (const pt of postTokens) {
            if (mint && String(pt.mint) !== mint) continue;
            // pt.owner may be undefined in some RPCs — compare via accountIndex
            const idx = Number(pt.accountIndex);
            const pre = preTokens.find((p: any) => Number(p.accountIndex) === idx);
            const preAmt = pre ? Number(pre.uiTokenAmount?.amount || 0) : 0;
            const postAmt = Number(pt.uiTokenAmount?.amount || 0);
            const delta = postAmt - preAmt;
            if (delta > 0) {
              // P0-4 strict owner check: require owner exists and equals SOLANA_ADDRESS (prevent ATA of attacker)
              if (!pt.owner || String(pt.owner) !== solAddr) continue;
              deltas.set(idx, (deltas.get(idx) || 0) + delta);
            }
          }
          if (deltas.size > 0) {
            // Take largest delta as observed amount (single transfer expected)
            const maxDelta = Math.max(...deltas.values());
            observedAmountStr = String(maxDelta);
          } else {
            // Fallback: parse innerInstructions for TransferChecked where destination is ATA
            // Element requires refinement: innerInstructions parsing requires live RPC with jsonParsed + ATA map — implement getAssociatedTokenAddress(mint, SOLANA_ADDRESS) via @solana/spl-token
            console.warn(`[worker] solana ${invoice.id} SPL no pre/post delta found for mint ${mint} — need innerInstructions parsing`);
            // For now leave observedAmountStr null to block confirmation until real parsing is wired
          }
        } catch (e: any) {
          console.warn(`[worker] solana ${invoice.id} SPL parse error: ${e?.message}`);
        }
      }

      if (observedAmountStr === null) {
        // Element requires refinement: observed amount could not be parsed without live RPC + ATA derivation — skip confirm until parse succeeds
        console.warn(`[worker] solana ${invoice.id} amount not parsed (observed null) — awaiting Element requires refinement parse; tx slot=${tx.slot}`);
        // Keep confirming if already confirming, else pending — don't falsely confirm
        if (invoice.status !== "confirming") {
          // Don't mark confirming yet if no proof? Keep pending. But if tx exists, mark confirming to avoid duplicate pending scan
          // Element requires refinement: decide whether to mark confirming on unparsable amount
        }
        return;
      }

      // P0-2: convert observed base units to cents before tolerance check
      let observedCentsSol: bigint;
      try {
        observedCentsSol = baseUnitsToCents("solana", invoice.token, BigInt(observedAmountStr));
      } catch {
        observedCentsSol = BigInt(0);
      }
      // Optional hijack mitigation for Solana: blockTime within invoice window
      try {
        const btRaw: any = (tx as any).blockTime ?? (tx as any).block_time ?? null;
        if (btRaw !== null && btRaw !== undefined) {
          const bt = new Date(Number(btRaw) * 1000);
          const created = new Date(invoice.created_at);
          const expires = new Date(invoice.expires_at);
          if (bt < created || bt > expires) {
            console.warn(`[worker] solana ${invoice.id} blockTime ${bt.toISOString()} outside invoice window ${created.toISOString()} - ${expires.toISOString()} — reject`);
            return;
          }
        }
      } catch {}

      if (!isAmountWithinTolerance(BigInt(invoice.amount_usd_cents), observedCentsSol)) {
        console.warn(`[worker] solana ${invoice.id} amount mismatch inv=${invoice.amount_usd_cents} obs=${observedAmountStr} cents=${String(observedCentsSol)} bps=${INVOICE_AMOUNT_TOLERANCE_BPS}`);
        return;
      }

      confirmInvoiceAtomic(invoice, sig, tx.slot ?? null, null, "confirmed", observedCentsSol);
      console.log(`[worker] solana ${invoice.id} confirmed slot=${tx.slot} observed=${observedAmountStr}`);
    } catch (e: any) {
      console.warn(`[worker] solana ${invoice.id} verify error: ${e?.message}`);
    }
    return;
  }

  // No tx_hash: auto-discovery via getSignaturesForAddress
  // Element requires refinement: auto-discovery without tx_hash via getSignaturesForAddress + getTransaction scanning requires live RPC keys and ATA derivation
  try {
    if (typeof connection.getSignaturesForAddress === "function") {
      // Example: const sigs = await connection.getSignaturesForAddress(new PublicKey(SOLANA_ADDRESS), { limit: 50 });
      // Filter by blockTime > invoice.createdAt and not already used, then getTransaction for each, match amount & token, then confirmInvoiceAtomic
      // Leave as Element requires refinement — do not fake sigs
      console.log(`[worker] solana ${invoice.id} no tx_hash — awaiting manual verify (Element requires refinement for auto-discovery)`);
    }
  } catch (e: any) {
    console.warn(`[worker] solana ${invoice.id} auto-discovery error: ${e?.message}`);
  }
}

// ---------------------------------------------------------------------------
// Main poll loop
// ---------------------------------------------------------------------------
let polling = false;
let timer: NodeJS.Timeout | null = null;

async function pollOnce(): Promise<void> {
  if (polling) {
    console.log("[worker] pollOnce skip — already polling");
    return;
  }
  polling = true;
  lastPollAt = new Date().toISOString();
  try {
    expireSweep();
    const chainsToPoll = [...EVM_CHAIN_KEYS, "solana" as const];
    // Use limiter across chains as well (concurrency 3)
    const tasks = chainsToPoll.map((c) =>
      limit(async () => {
        if (c === "solana") await pollSolana();
        else await pollEvmChain(c as EvmChainKey);
      })
    );
    await Promise.allSettled(tasks);
  } catch (e: any) {
    console.error(`[worker] pollOnce error: ${e?.message}`);
  } finally {
    polling = false;
  }
}

export function startWorker(): void {
  if (timer) return;
  console.log(
    `[worker] starting seedinfer payments worker pollMs=${WORKER_POLL_MS} concurrency=${CONCURRENCY} payment=${PAYMENT_ADDRESS} solana=${SOLANA_ADDRESS} toleranceBps=${INVOICE_AMOUNT_TOLERANCE_BPS}`
  );
  // Element requires refinement: ensure all RPC_URL_* env are set with live keys before production — worker will skip chains where missing
  for (const k of [...EVM_CHAIN_KEYS, "solana"]) {
    const url = getRpcUrl(k as ChainKey);
    if (!url) console.warn(`[worker] chain ${k} missing RPC URL env ${CHAIN_CONFIG[k as ChainKey].rpcEnvVar} — Element requires refinement`);
  }

  startedAt = new Date().toISOString();
  // Immediate first poll
  void pollOnce();
  timer = setInterval(() => {
    void pollOnce();
  }, WORKER_POLL_MS);
  // keep process alive for systemd — do not unref (was unref causing exit after 5s)

  // Graceful shutdown
  const stop = () => {
    console.log("[worker] shutdown");
    if (timer) clearInterval(timer);
    timer = null;
  };
  try {
    process.once("SIGTERM", stop);
    process.once("SIGINT", stop);
  } catch {}
}

export function stopWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
  polling = false;
}

// Auto-start when run directly via tsx / node --loader tsx
// Element requires refinement: direct execution detection for ESM — check process argv
const isDirectRun =
  (process.argv[1] && process.argv[1].includes("worker.ts")) ||
  (process.argv[1] && process.argv[1].includes("worker.js")) ||
  process.env.SEEDINFER_WORKER_AUTOSTART === "1";

if (isDirectRun) {
  // Delay to allow DB init
  setTimeout(() => {
    try {
      startWorker();
    } catch (e: any) {
      console.error(`[worker] autostart failed: ${e?.message}`);
      process.exit(1);
    }
  }, 500);
}

// Also export for programmatic use / health endpoint in Next API if imported
