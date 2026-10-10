/**
 * lib/routing/affinity.ts — KV-cache affinity (sticky routing hint).
 * No deps except node builtins. Env read at CALL time.
 */
import { createHash } from "node:crypto";

export interface AffinityRecord {
  nodeId: string;
  snapshot: number;
  lastReqTokens: number;
  lastSeenAt: number;
}

export interface AffinityDecision {
  stick: boolean;
  reason: string;
}

export interface DecideAffinityArgs {
  key: string;
  incomingPromptTokens: number;
  poolP: number;
  processedNow: number;
  activeNow: number;
  record: AffinityRecord | undefined | null;
}

const MAX_RECORDS = 50000;
const DEFAULT_TTL_MS = 1800000;

const store = new Map<string, AffinityRecord>();

function getTtlMs(): number {
  const raw = process.env.AFFINITY_TTL_MS;
  if (raw === undefined || raw === null || String(raw).trim() === "") return DEFAULT_TTL_MS;
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_TTL_MS;
  return Math.floor(n);
}

function getMinTokens(): number {
  const raw = process.env.AFFINITY_MIN_TOKENS;
  if (raw === undefined || raw === null || String(raw).trim() === "") return 8192;
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n <= 0) return 8192;
  return Math.floor(n);
}

function getEvictFrac(): number {
  const raw = process.env.AFFINITY_EVICT_FRAC;
  if (raw === undefined || raw === null || String(raw).trim() === "") return 0.8;
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n <= 0 || n >= 1) return 0.8;
  return n;
}

function sweepExpired(now: number): void {
  const ttl = getTtlMs();
  for (const [k, r] of store) {
    if (now - r.lastSeenAt > ttl) store.delete(k);
  }
}

function evictOldestIfFull(): void {
  if (store.size < MAX_RECORDS) return;
  let oldestKey: string | null = null;
  let oldestSeen = Infinity;
  for (const [k, r] of store) {
    if (r.lastSeenAt < oldestSeen) {
      oldestSeen = r.lastSeenAt;
      oldestKey = k;
    }
  }
  if (oldestKey !== null) store.delete(oldestKey);
}

/** sha256 hex, first 16 chars. */
export function hashPrincipal(s: string): string {
  return createHash("sha256").update(String(s), "utf8").digest("hex").slice(0, 16);
}

export function decideAffinity(args: DecideAffinityArgs): AffinityDecision {
  const { key, incomingPromptTokens, poolP, processedNow, activeNow, record } = args;
  const threshold = Math.min(8192, getMinTokens());
  const incoming = Number(incomingPromptTokens);
  if (!Number.isFinite(incoming) || incoming < threshold) {
    return { stick: false, reason: "below_threshold" };
  }
  if (!record) {
    return { stick: false, reason: "no_record" };
  }
  const p = Number(poolP);
  if (!Number.isFinite(p) || p <= 0) {
    return { stick: false, reason: "overflow" };
  }
  const d = Math.max(0, Number(processedNow) + Number(activeNow) - Number(record.snapshot));
  const frac = getEvictFrac();
  if (d > p * frac) {
    store.delete(String(key));
    return { stick: false, reason: "evicted" };
  }
  if (d + Number(record.lastReqTokens) + incoming >= p) {
    return { stick: false, reason: "overflow" };
  }
  return { stick: true, reason: "hit" };
}

export function recordAffinity(
  key: string,
  nodeId: string,
  snapshot: number,
  lastReqTokens: number,
  now?: number,
): void {
  const t = typeof now === "number" && Number.isFinite(now) ? now : Date.now();
  sweepExpired(t);
  evictOldestIfFull();
  store.set(String(key), {
    nodeId: String(nodeId),
    snapshot: Number(snapshot),
    lastReqTokens: Number(lastReqTokens),
    lastSeenAt: t,
  });
}

export function lookupAffinity(key: string, now?: number): AffinityRecord | undefined {
  const t = typeof now === "number" && Number.isFinite(now) ? now : Date.now();
  sweepExpired(t);
  const r = store.get(String(key));
  if (!r) return undefined;
  if (t - r.lastSeenAt > getTtlMs()) {
    store.delete(String(key));
    return undefined;
  }
  return { ...r };
}

export function resetAffinity(): void {
  store.clear();
}

export function affinitySize(): number {
  sweepExpired(Date.now());
  return store.size;
}

export function __setAffinityRecordForTests(key: string, rec: AffinityRecord): void {
  if (store.size >= MAX_RECORDS && !store.has(String(key))) evictOldestIfFull();
  store.set(String(key), { ...rec });
}
