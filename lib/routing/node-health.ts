/**
 * lib/routing/node-health.ts — per-node circuit-breaker + EWMA health.
 * Standalone in-memory store on globalThis. All env read at CALL time.
 * Does NOT depend on lease.ts (stays standalone for now).
 */
import { EWMA } from "./ewma";

export type CircuitState = "closed" | "open" | "half-open";

export type NodeOutcomeKind =
  | "ok"
  | "saturated"
  | "connect"
  | "timeout"
  | "http5xx"
  | "stream_fail"
  | "bad_response"
  | "client_error"
  | "aborted"
  | "probe_ok"
  | "probe_connect"
  | "probe_other";

export interface NodeOutcomeOptions {
  kind: NodeOutcomeKind;
  ttftMs?: number | null;
  totalMs?: number | null;
  retryAfterMs?: number | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  error?: string | null;
}

export interface NodeHealthState {
  id: string;
  consecutiveFails: number;
  consecutiveConnectFails: number;
  circuit: CircuitState;
  openUntil: number;
  openCount: number;
  trialInFlight: boolean;
  trialExpiresAt: number;
  pausedUntil: number;
  lastPauseReason: string | null;
  ewmaTtft: EWMA;
  ewmaLatency: EWMA;
  totalRequests: number;
  successCount: number;
  inFlight: number;
  activeKvTokens: number;
  totalProcessedTokens: number;
  lastProbeOk: number | null;
  lastError: string | null;
}

export type NodeSnapshot = NodeHealthState & {
  circuitOpen: boolean;
  available: boolean;
};

export type CanAttemptResult =
  | { ok: true; trial?: boolean }
  | { ok: false; reason: "paused" | "circuit_open" | "trial_in_flight"; retryAfterMs: number };

type HealthStore = {
  nodes: Map<string, NodeHealthState>;
};

const g = globalThis as unknown as { __seedinferNodeHealth?: HealthStore };

function getStore(): HealthStore {
  if (!g.__seedinferNodeHealth) {
    g.__seedinferNodeHealth = { nodes: new Map() };
  }
  return g.__seedinferNodeHealth!;
}

function ensureNode(id: string): NodeHealthState {
  const store = getStore();
  const key = String(id);
  let s = store.nodes.get(key);
  if (!s) {
    s = {
      id: key,
      consecutiveFails: 0,
      consecutiveConnectFails: 0,
      circuit: "closed",
      openUntil: 0,
      openCount: 0,
      trialInFlight: false,
      trialExpiresAt: 0,
      pausedUntil: 0,
      lastPauseReason: null,
      ewmaTtft: new EWMA(0.2),
      ewmaLatency: new EWMA(0.2),
      totalRequests: 0,
      successCount: 0,
      inFlight: 0,
      activeKvTokens: 0,
      totalProcessedTokens: 0,
      lastProbeOk: null,
      lastError: null,
    };
    store.nodes.set(key, s);
  }
  return s;
}

function numEnv(key: string, def: number): number {
  const raw = process.env[key];
  if (raw === undefined || raw === null || String(raw).trim() === "") return def;
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n <= 0) return def;
  return Math.floor(n);
}

function getFailThreshold(): number {
  return numEnv("NODE_FAIL_THRESHOLD", 5);
}

function getConnectThreshold(): number {
  return numEnv("NODE_CONNECT_THRESHOLD", 2);
}

function getCooldownMs(): number {
  return numEnv("NODE_COOLDOWN_MS", 60000);
}

function getCooldownMaxMs(): number {
  return numEnv("NODE_COOLDOWN_MAX_MS", 600000);
}

const TRIAL_TTL_MS = 30_000;

function clearExpiredTrial(s: NodeHealthState, now: number): void {
  if (s.trialInFlight && now >= s.trialExpiresAt) {
    s.trialInFlight = false;
    s.trialExpiresAt = 0;
  }
}

export function resetNodeHealth(id?: string): void {
  const store = getStore();
  if (id !== undefined && id !== null) {
    store.nodes.delete(String(id));
  } else {
    store.nodes.clear();
  }
}

export function getNodeSnapshot(id: string): NodeSnapshot {
  const s = ensureNode(id);
  const now = Date.now();
  clearExpiredTrial(s, now);
  const paused = s.pausedUntil > now;
  const openUnexpired = s.circuit === "open" && now < s.openUntil;
  const circuitOpen = openUnexpired;
  let available: boolean;
  if (paused) {
    available = false;
  } else if (openUnexpired) {
    available = false;
  } else {
    if (s.trialInFlight && now < s.trialExpiresAt) {
      available = false;
    } else {
      available = true;
    }
  }
  return { ...s, circuitOpen, available };
}

export function canAttempt(id: string): CanAttemptResult {
  const s = ensureNode(id);
  const now = Date.now();
  clearExpiredTrial(s, now);
  if (s.pausedUntil > now) {
    return { ok: false, reason: "paused", retryAfterMs: s.pausedUntil - now };
  }
  if (s.circuit === "open") {
    if (now < s.openUntil) {
      return { ok: false, reason: "circuit_open", retryAfterMs: s.openUntil - now };
    }
    s.circuit = "half-open";
  }
  if (s.circuit === "half-open") {
    if (s.trialInFlight && now < s.trialExpiresAt) {
      return { ok: false, reason: "trial_in_flight", retryAfterMs: Math.max(0, s.trialExpiresAt - now) };
    }
    return { ok: true, trial: true };
  }
  return { ok: true };
}

export function claimTrial(id: string): boolean {
  const s = ensureNode(id);
  const now = Date.now();
  if (s.pausedUntil > now) return false;
  if (s.trialInFlight) {
    if (now < s.trialExpiresAt) return false;
    s.trialInFlight = false;
    s.trialExpiresAt = 0;
  }
  if (s.circuit === "open") {
    if (now < s.openUntil) return false;
    s.circuit = "half-open";
  }
  if (s.circuit !== "half-open") return false;
  s.trialInFlight = true;
  s.trialExpiresAt = now + TRIAL_TTL_MS;
  return true;
}

export function releaseTrial(id: string): void {
  const s = ensureNode(id);
  s.trialInFlight = false;
  s.trialExpiresAt = 0;
}

function asErrorString(v: unknown, fallback: string): string {
  if (typeof v === "string" && v.length > 0) return v;
  if (v !== null && v !== undefined) {
    try {
      const str = String(v);
      if (str.length > 0 && str !== "[object Object]") return str;
    } catch {
      /* ignore */
    }
  }
  return fallback;
}

export function recordNodeOutcome(id: string, o: NodeOutcomeOptions): void {
  const s = ensureNode(id);
  const now = Date.now();
  const kind = o.kind;
  const trialLive = s.trialInFlight && now < s.trialExpiresAt;
  clearExpiredTrial(s, now);

  if (kind === "ok") {
    s.consecutiveFails = 0;
    s.consecutiveConnectFails = 0;
    s.circuit = "closed";
    s.openUntil = 0;
    s.openCount = 0;
    s.trialInFlight = false;
    s.trialExpiresAt = 0;
    s.totalRequests += 1;
    s.successCount += 1;
    if (typeof o.ttftMs === "number" && Number.isFinite(o.ttftMs) && o.ttftMs > 0) {
      s.ewmaTtft.update(o.ttftMs);
    }
    if (typeof o.totalMs === "number" && Number.isFinite(o.totalMs) && o.totalMs > 0) {
      s.ewmaLatency.update(o.totalMs);
    }
    const p = Number(o.promptTokens) || 0;
    const c = Number(o.completionTokens) || 0;
    if (p + c > 0) s.totalProcessedTokens += Math.floor(p + c);
    s.lastError = null;
    return;
  }

  if (kind === "probe_ok") {
    s.consecutiveFails = 0;
    s.consecutiveConnectFails = 0;
    s.circuit = "closed";
    s.openUntil = 0;
    s.openCount = 0;
    s.trialInFlight = false;
    s.trialExpiresAt = 0;
    if (
      typeof o.ttftMs === "number" &&
      Number.isFinite(o.ttftMs) &&
      o.ttftMs > 0 &&
      s.ewmaTtft.get() === null
    ) {
      s.ewmaTtft.update(o.ttftMs);
    }
    if (
      typeof o.totalMs === "number" &&
      Number.isFinite(o.totalMs) &&
      o.totalMs > 0 &&
      s.ewmaLatency.get() === null
    ) {
      s.ewmaLatency.update(o.totalMs);
    }
    const p = Number(o.promptTokens) || 0;
    const c = Number(o.completionTokens) || 0;
    if (p + c > 0) s.totalProcessedTokens += Math.floor(p + c);
    s.lastProbeOk = now;
    s.lastError = null;
    return;
  }

  if (kind === "saturated") {
    const raw = o.retryAfterMs;
    const base =
      typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : 2000;
    const clamped = Math.min(10000, Math.max(1000, base));
    s.pausedUntil = now + clamped;
    s.lastPauseReason =
      typeof o.error === "string" && o.error.length > 0 ? o.error : "saturated";
    s.consecutiveConnectFails = 0;
    s.trialInFlight = false;
    s.trialExpiresAt = 0;
    return;
  }

  if (kind === "client_error" || kind === "aborted" || kind === "probe_other") {
    s.trialInFlight = false;
    s.trialExpiresAt = 0;
    return;
  }

  if (
    kind === "connect" ||
    kind === "timeout" ||
    kind === "http5xx" ||
    kind === "stream_fail" ||
    kind === "bad_response" ||
    kind === "probe_connect"
  ) {
    s.consecutiveFails += 1;
    if (kind === "connect" || kind === "probe_connect") {
      s.consecutiveConnectFails += 1;
    }
    if (kind !== "probe_connect") {
      s.totalRequests += 1;
    }
    s.lastError = asErrorString(o.error, kind);
    const failTh = getFailThreshold();
    const connTh = getConnectThreshold();
    const halfOpenLiveTrial = s.circuit === "half-open" && trialLive;
    const shouldOpen =
      halfOpenLiveTrial ||
      s.consecutiveFails >= failTh ||
      s.consecutiveConnectFails >= connTh;
    if (shouldOpen) {
      const base = getCooldownMs();
      const max = getCooldownMaxMs();
      const backoff = base * Math.pow(2, s.openCount);
      const cooldown = Math.min(max, backoff);
      s.circuit = "open";
      s.openUntil = now + cooldown;
      s.openCount += 1;
      s.trialInFlight = false;
      s.trialExpiresAt = 0;
    }
    return;
  }
}

export function addInFlight(id: string, tokens?: number): void {
  const s = ensureNode(id);
  s.inFlight += 1;
  const t = Number(tokens) || 0;
  if (t > 0) s.activeKvTokens += Math.floor(t);
}

export function removeInFlight(id: string, tokens?: number): void {
  const s = ensureNode(id);
  s.inFlight = Math.max(0, s.inFlight - 1);
  const t = Number(tokens) || 0;
  if (t > 0) s.activeKvTokens = Math.max(0, s.activeKvTokens - Math.floor(t));
}

export function bumpProcessed(id: string, p?: number, c?: number): void {
  const s = ensureNode(id);
  const pp = Number(p) || 0;
  const cc = Number(c) || 0;
  const sum = pp + cc;
  if (sum > 0) s.totalProcessedTokens += Math.floor(sum);
}
