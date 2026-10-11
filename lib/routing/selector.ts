/**
 * lib/routing/selector.ts — selector over a shared candidate filter.
 *
 * Architecture (phase 1 split):
 * - lib/routing/lease.ts is the source of truth for capacity (inFlight / activeKv).
 * - lib/routing/node-health.ts owns provider outcomes (circuit breaker, pauses,
 *   half-open trials, EWMA TTFT/latency, success counters).
 * - This module owns *selection only*: candidate filtering (verification, heartbeat
 *   freshness, vLLM health, node-health canAttempt, lease capacity) plus the
 *   P2C (default) / smooth-WRR (ROUTING_ALGORITHM==='wrr') pick.
 *
 * Trial-claim contract (important):
 * - filterRoutable NEVER claims a half-open trial. It only marks candidates with
 *   trial=true when node-health canAttempt() reports { ok: true, trial: true }.
 * - selectNodeDetailed claims exactly once per attempt, at selection time, via
 *   claimTrial(id) on the chosen candidate. If the claim loses a race, the next
 *   ordered candidate is tried.
 * - The caller MUST record the attempt outcome via node-health recordNodeOutcome(),
 *   which releases (ok / neutral kinds) or re-opens (failure kinds) the trial.
 *
 * Removed vs the old selector (intentional, do not re-add):
 * - opts.openRouter "ignore load" branch (option accepted but ignored).
 * - opts.isSubscription sub-penalty (option accepted but ignored).
 * - fallback-state require() forwarding inside recordLatency.
 * - WRR load factor (load is handled by the capacity filter, not the weight).
 *
 * Weight (WRR path + observability): weight = ttftFactor * successRate * 100,
 *   ttftFactor = BASE_TTFT_MS / clamp(ewmaTtft), null TTFT -> 1 (cold start neutral),
 *   successRate from node-health (0 requests -> 1, floored at SUCCESS_FLOOR).
 */

import { EWMA } from "./ewma"
import { canAttempt, claimTrial, getNodeSnapshot } from "./node-health"
import { getLeaseCounters } from "./lease"
import type { StoredProvider } from "@/lib/providers-store"

type ProviderLike = StoredProvider | import("@/lib/types").Provider

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
export const EWMA_ALPHA = 0.2
export const BASE_TTFT_MS = 400 // ideal RTX 5090 NVFP4 prefill
export const MIN_TTFT_MS = 50
export const MAX_TTFT_MS = 30_000
export const TTFT_THRESHOLD_MS = Number(process.env.ROUTING_TTFT_THRESHOLD_MS || 5000)
export const CONCURRENT_PENALTY = 0.5 // kept for compat; load is now enforced by the capacity filter, not the weight
export const SUCCESS_FLOOR = 0.1

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type ProviderRoutingStat = {
  providerId: string
  ewmaTtft: number | null
  ewmaLatency: number | null
  concurrentRequests: number
  activeTokens: number
  totalRequests: number
  successCount: number
  successRate: number
  weight: number
  currentWeight: number
  circuitOpen: boolean
  lastUpdate: string | null
  circuitState?: string
  pausedUntil?: number
  inFlight?: number
  activeKvTokens?: number
  lastError?: string | null
}

type InternalStat = {
  ewmaTtft: EWMA
  ewmaLatency: EWMA
  concurrentRequests: number
  activeTokens: number
  totalProcessedTokens: number
  totalRequests: number
  successCount: number
  currentWeight: number
  weight: number
  lastUpdate: string | null
}

type GlobalRouting = {
  stats: Map<string, InternalStat>
}

const g = globalThis as unknown as { __seedinferRouting?: GlobalRouting }

function getStore(): GlobalRouting {
  if (!g.__seedinferRouting) {
    g.__seedinferRouting = { stats: new Map() }
  }
  return g.__seedinferRouting!
}

export function ensureStat(id: string): InternalStat {
  const store = getStore()
  let s = store.stats.get(id)
  if (!s) {
    s = {
      ewmaTtft: new EWMA(EWMA_ALPHA),
      ewmaLatency: new EWMA(EWMA_ALPHA),
      concurrentRequests: 0,
      activeTokens: 0,
      totalProcessedTokens: 0,
      totalRequests: 0,
      successCount: 0,
      currentWeight: 0,
      weight: 0,
      lastUpdate: null,
    }
    store.stats.set(id, s)
  }
  return s
}

// ---------------------------------------------------------------------------
// Env helpers (read at call time)
// ---------------------------------------------------------------------------
function numEnv(key: string, def: number): number {
  const raw = process.env[key]
  if (raw === undefined || raw === null || String(raw).trim() === "") return def
  const n = Number(String(raw).trim())
  if (!Number.isFinite(n) || n <= 0) return def
  return Math.floor(n)
}

// ---------------------------------------------------------------------------
// Weight computation (no load factor, no subscription penalty)
// ---------------------------------------------------------------------------
function successRateOf(totalRequests: number, successCount: number): number {
  if (totalRequests <= 0) return 1
  return Math.max(SUCCESS_FLOOR, successCount / totalRequests)
}

function ttftFactorOf(ttft: number | null): number {
  if (ttft === null || !Number.isFinite(ttft)) return 1
  return BASE_TTFT_MS / Math.max(Math.min(ttft, MAX_TTFT_MS), MIN_TTFT_MS)
}

function computeWeight(ttft: number | null, successRate: number): number {
  const w = ttftFactorOf(ttft) * successRate * 100
  return Math.max(1, Math.round(w * 10) / 10) // min 1 to avoid starvation, 1 decimal
}

// ---------------------------------------------------------------------------
// Candidate filter (shared by selection, sorting and saturation checks)
// ---------------------------------------------------------------------------
export type RoutableCandidate = {
  provider: ProviderLike
  stat: InternalStat
  inFlight: number
  activeKv: number
  safeMax: number
  safeKv: number
  ttft: number | null
  successRate: number
  trial: boolean
}

export type FilterRoutableOpts = {
  incomingTokens?: number
  exclude?: Set<string>
  /** Bound expensive per-node work on big fleets. undefined = no cap. */
  maxCandidates?: number
}

type Assessment = {
  verdict: "routable" | "unhealthy" | "saturated"
  trial: boolean
  inFlight: number
  activeKv: number
  ttft: number | null
  successRate: number
}

function isHeartbeatFresh(p: any, maxAgeMs: number, now: number): boolean {
  const hb = p?.last_heartbeat
  const hasVerification = !!p?.verification
  if (hb === undefined || hb === null || hb === "") {
    // Skip the check for legacy objects (no verification field, no heartbeat).
    // Verified objects without a heartbeat fail closed — never route blind.
    return !hasVerification
  }
  const t = Date.parse(String(hb))
  if (!Number.isFinite(t)) return !hasVerification
  return now - t <= maxAgeMs
}

/** Single-node assessment. Never throws (callers still guard). */
function assessProvider(p: any, incomingTokens: number, maxAgeMs: number, now: number): Assessment {
  const unhealthy = (): Assessment => ({
    verdict: "unhealthy",
    trial: false,
    inFlight: 0,
    activeKv: 0,
    ttft: null,
    successRate: 1,
  })
  const id = String(p?.id ?? "")
  if (!id) return unhealthy()

  // verification.status === 'verified' OR legacy objects without a verification field
  const v = p?.verification
  if (v && v.status !== "verified") return unhealthy()

  // boot-hydrated nodes have no live connection — never routable
  if (p?.awaiting_heartbeat) return unhealthy()

  if (!isHeartbeatFresh(p, maxAgeMs, now)) return unhealthy()

  // vllm_health absent OR explicitly ok; any explicit non-ok excludes
  const vh = p?.vllm_health
  if (vh !== undefined && vh !== null && (vh as any).status !== "ok") return unhealthy()

  // node-health gate (circuit / pause / trial-in-flight). Note: canAttempt may
  // transition an expired-open circuit to half-open; the trial itself is claimed
  // later, once, at selection time — never here.
  let trial = false
  try {
    const att = canAttempt(id)
    if (!att.ok) return unhealthy()
    trial = att.trial === true
  } catch {
    return unhealthy()
  }

  // capacity from lease.ts (source of truth — NOT selector-local counters)
  let inFlight = 0
  let activeKv = 0
  try {
    const c = getLeaseCounters(id)
    inFlight = c.inFlight
    activeKv = c.activeKv
  } catch {
    inFlight = 0
    activeKv = 0
  }
  const safeMax = getSafeMaxConcurrency(p)
  const safeKv = getSafeMaxKvTokens(p)
  if (inFlight >= safeMax || activeKv + incomingTokens >= safeKv) {
    return { verdict: "saturated", trial: false, inFlight, activeKv, ttft: null, successRate: 1 }
  }

  // TTFT + success rate from node-health snapshot (null TTFT -> BASE baseline at use sites)
  let ttft: number | null = null
  let successRate = 1
  try {
    const snap = getNodeSnapshot(id)
    ttft = snap.ewmaTtft.get()
    successRate = successRateOf(snap.totalRequests, snap.successCount)
  } catch {
    ttft = null
    successRate = 1
  }
  return { verdict: "routable", trial, inFlight, activeKv, ttft, successRate }
}

/** Hydrate selector EWMA from StoredProvider mirror fields (compat; EWMA only). */
function hydrateFromProvider(p: StoredProvider): void {
  const s = ensureStat(p.id)
  if ((p as any).ewmaTtft !== undefined && (p as any).ewmaTtft !== null && s.ewmaTtft.get() === null) {
    s.ewmaTtft.set((p as any).ewmaTtft)
  }
  if ((p as any).ewmaLatency !== undefined && (p as any).ewmaLatency !== null && s.ewmaLatency.get() === null) {
    s.ewmaLatency.set((p as any).ewmaLatency)
  }
}

export function filterRoutable(
  providers: (StoredProvider | import("@/lib/types").Provider)[],
  opts?: FilterRoutableOpts
): RoutableCandidate[] {
  const list = Array.isArray(providers) ? providers : []
  const incomingTokens = opts?.incomingTokens ?? 1000
  const exclude = opts?.exclude
  const maxCandidates = opts?.maxCandidates
  const maxAgeMs = numEnv("ROUTING_HEARTBEAT_MAX_AGE_MS", 90000)
  const now = Date.now()
  const out: RoutableCandidate[] = []
  for (const p of list) {
    if (!p) continue
    try {
      const id = String((p as any)?.id ?? "")
      if (exclude && exclude.has(id)) continue
      const a = assessProvider(p as any, incomingTokens, maxAgeMs, now)
      if (a.verdict !== "routable") continue
      try {
        hydrateFromProvider(p as StoredProvider)
      } catch {}
      const stat = ensureStat(id)
      stat.weight = computeWeight(a.ttft, a.successRate)
      out.push({
        provider: p,
        stat,
        inFlight: a.inFlight,
        activeKv: a.activeKv,
        safeMax: getSafeMaxConcurrency(p as any),
        safeKv: getSafeMaxKvTokens(p as any),
        ttft: a.ttft,
        successRate: a.successRate,
        trial: a.trial,
      })
      if (maxCandidates !== undefined && out.length >= maxCandidates) break
    } catch {
      continue
    }
  }
  return out
}

// ---------------------------------------------------------------------------
// Detailed selection
// ---------------------------------------------------------------------------
export type SelectNodeDetailedOpts = {
  incomingTokens?: number
  exclude?: Set<string>
  rng?: () => number
}

export type SelectNodeDetailedResult =
  | { node: StoredProvider | import("@/lib/types").Provider }
  | { none: true; reason: "no_nodes" | "all_saturated" | "all_unhealthy"; retryAfterMs?: number }

function classifyFailure(
  considered: (StoredProvider | import("@/lib/types").Provider)[],
  incomingTokens: number
): "all_saturated" | "all_unhealthy" {
  const maxAgeMs = numEnv("ROUTING_HEARTBEAT_MAX_AGE_MS", 90000)
  const now = Date.now()
  let saturated = 0
  for (const p of considered) {
    try {
      const a = assessProvider(p as any, incomingTokens, maxAgeMs, now)
      if (a.verdict === "saturated") saturated += 1
    } catch {}
  }
  // Any healthy-but-full node means capacity may free soon -> saturated.
  // Otherwise everything failed a health gate -> unhealthy.
  return saturated > 0 ? "all_saturated" : "all_unhealthy"
}

/** Earliest node-health hint (pause / circuit / trial), clamped to 1000..30000. */
function computeRetryAfterMs(considered: (StoredProvider | import("@/lib/types").Provider)[]): number {
  const now = Date.now()
  let best: number | null = null
  const take = (ms: number): void => {
    if (!Number.isFinite(ms) || ms <= 0) return
    best = best === null ? ms : Math.min(best, ms)
  }
  for (const p of considered) {
    try {
      const id = String((p as any)?.id ?? "")
      if (!id) continue
      const att = canAttempt(id)
      if (!att.ok && Number.isFinite(att.retryAfterMs)) take(att.retryAfterMs)
      const snap = getNodeSnapshot(id)
      if (snap.pausedUntil > now) take(snap.pausedUntil - now)
    } catch {}
  }
  const ms = best ?? 1000
  return Math.min(30000, Math.max(1000, Math.floor(ms)))
}

function randIndex(n: number, rng: () => number): number {
  let r: number
  try {
    r = rng()
  } catch {
    r = Math.random()
  }
  if (!Number.isFinite(r) || r < 0) r = 0
  if (r >= 1) r = 0.999999999
  return Math.min(n - 1, Math.floor(r * n))
}

/** P2C: 2 distinct random indices; lower inFlight/safeMax wins, then lower TTFT, then random. */
function pickP2C(cands: RoutableCandidate[], rng: () => number): RoutableCandidate[] {
  if (cands.length === 1) return [cands[0]]
  const n = cands.length
  const i1 = randIndex(n, rng)
  let i2 = randIndex(n, rng)
  if (i2 === i1) i2 = (i1 + 1) % n
  const a = cands[i1]
  const b = cands[i2]
  const ra = a.inFlight / Math.max(1, a.safeMax)
  const rb = b.inFlight / Math.max(1, b.safeMax)
  if (ra < rb) return [a, b]
  if (rb < ra) return [b, a]
  const ta = a.ttft ?? BASE_TTFT_MS
  const tb = b.ttft ?? BASE_TTFT_MS
  if (ta < tb) return [a, b]
  if (tb < ta) return [b, a]
  let coin = 0.5
  try {
    coin = rng()
  } catch {
    coin = Math.random()
  }
  if (!Number.isFinite(coin)) coin = 0.5
  return coin < 0.5 ? [a, b] : [b, a]
}

function mirrorPool(cands: RoutableCandidate[]): void {
  try {
    const g2 = globalThis as unknown as { __seedinferProviders?: { providers: Map<string, any> } }
    const m = g2.__seedinferProviders?.providers
    if (!m) return
    for (const c of cands) {
      const p = m.get(String((c.provider as any).id))
      if (p) {
        p._routingWeight = c.stat.weight
        p._routingCurrentWeight = c.stat.currentWeight
        p.ewmaTtft = c.stat.ewmaTtft.get()
        p.ewmaLatency = c.stat.ewmaLatency.get()
      }
    }
  } catch {}
}

/** Smooth weighted round-robin (Nginx style) over the filtered pool. */
function pickWRR(cands: RoutableCandidate[]): RoutableCandidate {
  let total = 0
  for (const c of cands) {
    const w = computeWeight(c.ttft, c.successRate)
    c.stat.weight = w
    total += w
  }
  if (!(total > 0)) {
    let best = cands[0]
    for (const c of cands) {
      const ct = c.ttft ?? Number.POSITIVE_INFINITY
      const bt = best.ttft ?? Number.POSITIVE_INFINITY
      if (ct < bt) best = c
    }
    mirrorPool(cands)
    return best
  }
  let best: RoutableCandidate | null = null
  let bestCur = -Infinity
  for (const c of cands) {
    c.stat.currentWeight += c.stat.weight
    if (c.stat.currentWeight > bestCur) {
      bestCur = c.stat.currentWeight
      best = c
    }
  }
  const winner = best ?? cands[0]
  winner.stat.currentWeight -= total
  mirrorPool(cands)
  return winner
}

function pickOrdered(cands: RoutableCandidate[], rng: () => number): RoutableCandidate[] {
  if (cands.length === 1) return [cands[0]]
  if (process.env.ROUTING_ALGORITHM === "wrr") return [pickWRR(cands)]
  return pickP2C(cands, rng)
}

export function selectNodeDetailed(
  providers: (StoredProvider | import("@/lib/types").Provider)[],
  opts?: SelectNodeDetailedOpts
): SelectNodeDetailedResult {
  if (!providers || providers.length === 0) return { none: true, reason: "no_nodes" }
  const incomingTokens = opts?.incomingTokens ?? 1000
  const rng = typeof opts?.rng === "function" ? opts.rng : Math.random
  const exclude = opts?.exclude
  let considered = providers
  if (exclude && exclude.size > 0) {
    considered = providers.filter((pp) => {
      try {
        return !exclude.has(String((pp as any)?.id))
      } catch {
        return false
      }
    })
    if (considered.length === 0) return { none: true, reason: "no_nodes" }
  }
  // Bound per-node work on big fleets.
  const cap = numEnv("ROUTING_MAX_CANDIDATES", 32)
  const candidates = filterRoutable(considered, { incomingTokens, exclude, maxCandidates: cap })
  if (candidates.length === 0) {
    return {
      none: true,
      reason: classifyFailure(considered, incomingTokens),
      retryAfterMs: computeRetryAfterMs(considered),
    }
  }
  const ordered = pickOrdered(candidates, rng)
  for (const cand of ordered) {
    const id = String((cand.provider as any).id)
    if (cand.trial) {
      let claimed = false
      try {
        claimed = claimTrial(id)
      } catch {
        claimed = false
      }
      if (!claimed) continue
    }
    return { node: cand.provider }
  }
  return { none: true, reason: "all_unhealthy", retryAfterMs: 1000 }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Selector EWMA update + providers-store mirror. Outcome recording is node-health's job. */
export function recordLatency(providerId: string, ttftMs: number | null, totalMs: number | null, success: boolean): void {
  void success
  const s = ensureStat(providerId)
  const now = new Date().toISOString()
  if (ttftMs !== null && Number.isFinite(ttftMs) && ttftMs > 0) {
    s.ewmaTtft.update(ttftMs)
  }
  if (totalMs !== null && Number.isFinite(totalMs) && totalMs > 0) {
    s.ewmaLatency.update(totalMs)
  }
  s.lastUpdate = now

  // refresh weight from merged TTFT + node-health success rate (observability)
  try {
    const snap = getNodeSnapshot(providerId)
    const ttft = s.ewmaTtft.get() ?? snap.ewmaTtft.get()
    s.weight = computeWeight(ttft, successRateOf(snap.totalRequests, snap.successCount))
  } catch {}

  // mirror to providers-store StoredProvider for persistence / observability (best effort, avoid circular via globalThis)
  try {
    const g2 = globalThis as unknown as { __seedinferProviders?: { providers: Map<string, any> } }
    const p = g2.__seedinferProviders?.providers.get(providerId)
    if (p) {
      p.ewmaTtft = s.ewmaTtft.get()
      p.ewmaLatency = s.ewmaLatency.get()
      p._routingWeight = s.weight
      p._routingCurrentWeight = s.currentWeight
    }
  } catch {}
}

export function incrementConcurrent(providerId: string): void {
  const s = ensureStat(providerId)
  s.concurrentRequests += 1
  try {
    const g2 = globalThis as unknown as { __seedinferProviders?: { providers: Map<string, any> } }
    const p = g2.__seedinferProviders?.providers.get(providerId)
    if (p) p.concurrentRequests = s.concurrentRequests
  } catch {}
}

export function decrementConcurrent(providerId: string): void {
  const s = ensureStat(providerId)
  s.concurrentRequests = Math.max(0, s.concurrentRequests - 1)
  try {
    const g2 = globalThis as unknown as { __seedinferProviders?: { providers: Map<string, any> } }
    const p = g2.__seedinferProviders?.providers.get(providerId)
    if (p) p.concurrentRequests = s.concurrentRequests
  } catch {}
}

export function addActiveTokens(providerId: string, tokens: number): void {
  if (tokens <= 0) return
  const s = ensureStat(providerId)
  s.activeTokens += tokens
}

export function removeActiveTokens(providerId: string, tokens: number): void {
  if (tokens <= 0) return
  const s = ensureStat(providerId)
  s.activeTokens = Math.max(0, s.activeTokens - tokens)
}

/** Routing stats: selector EWMA merged with the node-health snapshot; capacity from lease counters. */
export function getStats(): Record<string, ProviderRoutingStat> {
  const store = getStore()
  const out: Record<string, ProviderRoutingStat> = {}
  for (const [id, s] of store.stats.entries()) {
    let snap: ReturnType<typeof getNodeSnapshot> | null = null
    try {
      snap = getNodeSnapshot(id)
    } catch {
      snap = null
    }
    const ewmaTtft = s.ewmaTtft.get() ?? snap?.ewmaTtft.get() ?? null
    const ewmaLatency = s.ewmaLatency.get() ?? snap?.ewmaLatency.get() ?? null
    const totalRequests = snap?.totalRequests ?? s.totalRequests ?? 0
    const successCount = snap?.successCount ?? s.successCount ?? 0
    const rawRate = totalRequests === 0 ? 1 : successCount / totalRequests
    const successRate = Math.round(rawRate * 1000) / 1000
    const weight = computeWeight(ewmaTtft, successRateOf(totalRequests, successCount))
    s.weight = weight
    let inFlight = s.concurrentRequests
    let activeKv = s.activeTokens
    try {
      const c = getLeaseCounters(id)
      inFlight = c.inFlight
      activeKv = c.activeKv
    } catch {}
    const circuitOpen = snap?.circuitOpen ?? false
    out[id] = {
      providerId: id,
      ewmaTtft,
      ewmaLatency,
      concurrentRequests: inFlight,
      activeTokens: activeKv,
      totalRequests,
      successCount,
      successRate,
      weight,
      currentWeight: Math.round(s.currentWeight * 10) / 10,
      circuitOpen,
      lastUpdate: s.lastUpdate,
      circuitState: snap?.circuit,
      pausedUntil: snap?.pausedUntil ?? 0,
      inFlight,
      activeKvTokens: activeKv,
      lastError: snap?.lastError ?? null,
    }
  }
  return out
}

export function getProviderStat(providerId: string): ProviderRoutingStat | null {
  const all = getStats()
  return all[providerId] || null
}

/** Dynamic per-node max concurrency limit based on GPU profile, vLLM max_num_seqs & model specs */
export function getMaxConcurrency(p: any): number {
  if (typeof p?.maxConcurrency === "number" && p.maxConcurrency > 0) return p.maxConcurrency
  if (typeof p?.max_concurrency === "number" && p.max_concurrency > 0) return p.max_concurrency
  if (typeof p?.raw?.max_concurrency === "number" && p.raw.max_concurrency > 0) return p.raw.max_concurrency
  if (typeof p?.raw?.max_num_seqs === "number" && p.raw.max_num_seqs > 0) return p.raw.max_num_seqs

  const name = String(p?.gpu?.name || p?.raw?.gpu?.name || "").toUpperCase()
  const vram = Number(p?.gpu?.vram_gb || p?.raw?.gpu?.vram_gb || 24)
  const count = Number(p?.gpu?.count || p?.raw?.gpu?.count || 1)

  if (name.includes("A100") || name.includes("H100") || name.includes("H200") || name.includes("B200")) {
    return Math.max(16, count * 16)
  }
  if (name.includes("5090")) {
    return Math.max(32, count * 32)
  }
  if (name.includes("4090") || name.includes("3090")) {
    return Math.max(8, count * 8)
  }
  return Math.max(4, Math.floor(vram / 4))
}

/** 10% Safety Buffer Capacity Guard: Effective Max Concurrency = max(1, Math.floor(getMaxConcurrency(p) * 0.90)) */
export function getSafeMaxConcurrency(p: any): number {
  const max = getMaxConcurrency(p)
  return Math.max(1, Math.floor(max * 0.90))
}

/** Dynamic per-node total KV cache token capacity based on GPU VRAM & vLLM FP8 cache profile */
export function getMaxKvTokens(p: any): number {
  if (typeof p?.maxKvTokens === "number" && p.maxKvTokens > 0) return p.maxKvTokens
  if (typeof p?.max_kv_tokens === "number" && p.max_kv_tokens > 0) return p.max_kv_tokens
  if (typeof p?.raw?.max_kv_tokens === "number" && p.raw.max_kv_tokens > 0) return p.raw.max_kv_tokens

  const name = String(p?.gpu?.name || p?.raw?.gpu?.name || "").toUpperCase()
  const vram = Number(p?.gpu?.vram_gb || p?.raw?.gpu?.vram_gb || 24)
  const count = Number(p?.gpu?.count || p?.raw?.gpu?.count || 1)

  // RTX 5090 (32GB VRAM, NVFP4 + FP8 KV cache): ~1.5M tokens capacity
  if (name.includes("5090")) {
    return Math.max(1_500_000, count * 1_500_000)
  }
  // A100 / H100 / H200 / B200 (80GB VRAM): ~4M tokens capacity
  if (name.includes("A100") || name.includes("H100") || name.includes("H200") || name.includes("B200")) {
    return Math.max(4_000_000, count * 4_000_000)
  }
  // RTX 4090 / 3090 (24GB VRAM): ~800k tokens capacity
  if (name.includes("4090") || name.includes("3090")) {
    return Math.max(800_000, count * 800_000)
  }
  return Math.max(300_000, Math.floor(vram * 35_000))
}

/** 10% Safety Buffer KV Cache Guard: Safe Max KV Tokens = max(100k, Math.floor(getMaxKvTokens(p) * 0.90)) */
export function getSafeMaxKvTokens(p: any): number {
  const max = getMaxKvTokens(p)
  return Math.max(100_000, Math.floor(max * 0.90))
}

/** True when every health-eligible provider is at the 90% safety buffer (slots or KV tokens, from lease counters). */
export function isNetworkSaturated(
  providers: (StoredProvider | import("@/lib/types").Provider)[],
  incomingTokens: number = 1000
): boolean {
  if (!providers || providers.length === 0) return false
  const maxAgeMs = numEnv("ROUTING_HEARTBEAT_MAX_AGE_MS", 90000)
  const now = Date.now()
  const eligible: any[] = []
  for (const p of providers as any[]) {
    try {
      if (!p) continue
      const v = (p as any).verification
      if (v && v.status !== "verified") continue
      if ((p as any).awaiting_heartbeat) continue
      if (!isHeartbeatFresh(p as any, maxAgeMs, now)) continue
      const vh = (p as any).vllm_health
      if (vh !== undefined && vh !== null && vh.status !== "ok") continue
      const att = canAttempt(String((p as any).id))
      if (!att.ok) continue
      eligible.push(p)
    } catch {
      continue
    }
  }
  if (eligible.length === 0) return false
  return eligible.every((p: any) => {
    let inFlight = 0
    let activeKv = 0
    try {
      const c = getLeaseCounters(String(p.id))
      inFlight = c.inFlight
      activeKv = c.activeKv
    } catch {}
    const slotSaturated = inFlight >= getSafeMaxConcurrency(p)
    const kvSaturated = activeKv + incomingTokens >= getSafeMaxKvTokens(p)
    return slotSaturated || kvSaturated
  })
}

/** Main selector. opts.openRouter / opts.isSubscription are accepted but ignored (compat). */
export function selectProvider(
  providers: (StoredProvider | import("@/lib/types").Provider)[],
  opts?: { openRouter?: boolean; isSubscription?: boolean; incomingTokens?: number; rng?: () => number }
): (StoredProvider | import("@/lib/types").Provider) | null {
  const res = selectNodeDetailed(providers, { incomingTokens: opts?.incomingTokens, rng: opts?.rng })
  if ("node" in res) return res.node
  return null
}

/** P2C (Power of Two Random Choices) + Least Outstanding Requests explicit export */
export function selectProviderP2C(
  providers: (StoredProvider | import("@/lib/types").Provider)[],
  opts?: { openRouter?: boolean; isSubscription?: boolean; incomingTokens?: number; rng?: () => number }
): (StoredProvider | import("@/lib/types").Provider) | null {
  return selectProvider(providers, opts)
}

/** Sorted candidates from the shared filter: inFlight asc, then TTFT asc. */
export function getSortedProviders(
  providers: (StoredProvider | import("@/lib/types").Provider)[],
  opts?: { openRouter?: boolean; isSubscription?: boolean; incomingTokens?: number; exclude?: Set<string> }
): (StoredProvider | import("@/lib/types").Provider)[] {
  if (!providers || providers.length === 0) return []
  const cands = filterRoutable(providers, { incomingTokens: opts?.incomingTokens ?? 1000, exclude: opts?.exclude })
  return [...cands]
    .sort((a, b) => {
      if (a.inFlight !== b.inFlight) return a.inFlight - b.inFlight
      return (a.ttft ?? BASE_TTFT_MS) - (b.ttft ?? BASE_TTFT_MS)
    })
    .map((c) => c.provider)
}

export function resetRouting(providerId?: string): void {
  const store = getStore()
  if (providerId) store.stats.delete(providerId)
  else store.stats.clear()
}

export function getAllRoutingStats(): Record<string, ProviderRoutingStat> {
  return getStats()
}

// ---------------------------------------------------------------------------
// Session Affinity & KV Cache Eviction Tracking
// ---------------------------------------------------------------------------
export type SessionRecord = {
  providerId: string
  lastProcessedTokenSnapshot: number
  lastSeenAt: number
}

const gSessions = globalThis as unknown as { __seedinferSessions?: Map<string, SessionRecord> }

function getSessionStore(): Map<string, SessionRecord> {
  if (!gSessions.__seedinferSessions) {
    gSessions.__seedinferSessions = new Map<string, SessionRecord>()
  }
  return gSessions.__seedinferSessions!
}

export function recordTokensProcessed(providerId: string, tokensCount: number): void {
  if (!providerId || tokensCount <= 0) return
  const s = ensureStat(providerId)
  s.totalProcessedTokens += tokensCount
}

/**
 * Evaluates Session Affinity for KV Cache reuse based on exact 3-step rules:
 * 1) Prompt < 8192 tokens? -> Return null (Always Weighted Random)
 * 2) Delta Tokens processed on assigned node since last request > 60% of KV cache capacity? -> Return null (Evicted)
 * 3) Node active load >= 90% capacity (slots or KV tokens)? -> Return null (Hard 90% Guard)
 */
export function getAffinityProvider(
  sessionId: string | null | undefined,
  incomingPromptTokens: number,
  providers: (StoredProvider | import("@/lib/types").Provider)[]
): (StoredProvider | import("@/lib/types").Provider) | null {
  if (!sessionId || incomingPromptTokens < 8192 || !providers || providers.length === 0) {
    return null
  }

  const rec = getSessionStore().get(sessionId)
  if (!rec) return null

  // Check TTL (15 mins)
  if (Date.now() - rec.lastSeenAt > 15 * 60 * 1000) {
    getSessionStore().delete(sessionId)
    return null
  }

  const provider = (providers as any).find((p: any) => p.id === rec.providerId)
  if (!provider) return null

  // Ensure node is verified if verification status exists; boot-hydrated nodes have no live connection.
  if (provider.verification?.status && provider.verification.status !== "verified") {
    return null
  }
  if ((provider as any).awaiting_heartbeat) {
    return null
  }

  const s = ensureStat(rec.providerId)
  const maxKv = getMaxKvTokens(provider)
  const deltaTokens = s.totalProcessedTokens - rec.lastProcessedTokenSnapshot

  // 60% Eviction Window Check: If more than 60% of KV cache tokens have flowed through this node since last request, KV cache is evicted
  if (deltaTokens > Math.floor(maxKv * 0.60)) {
    getSessionStore().delete(sessionId)
    return null
  }

  // 90% Hard Guard Check: If active load is saturated, bypass session affinity
  if (s.concurrentRequests >= getSafeMaxConcurrency(provider) || (s.activeTokens + incomingPromptTokens) >= getSafeMaxKvTokens(provider)) {
    return null
  }

  return provider
}

export function touchSession(sessionId: string | null | undefined, providerId: string): void {
  if (!sessionId || !providerId) return
  const s = ensureStat(providerId)
  getSessionStore().set(sessionId, {
    providerId,
    lastProcessedTokenSnapshot: s.totalProcessedTokens,
    lastSeenAt: Date.now(),
  })
}
