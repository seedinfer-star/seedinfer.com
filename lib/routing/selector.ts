/**
 * lib/routing/selector.ts — inteligentny selector WRR+EWMA dla SeedInfer
 *
 * Algorytm:
 * - Per-provider EWMA TTFT (alpha 0.2) + EWMA total latency + concurrent + successRate
 * - Waga = (BASE_TTFT / EWMA_TTFT) * (1 / (1 + concurrent*0.5)) * successRate
 *   Inverse TTFT → niższy TTFT = wyższa waga, load penalty → mniej conn = wyższa waga.
 *   SuccessRate 0..1 (floor 0.1) karze failing nodes bez głodzenia.
 * - OpenRouter traffic (header x-openrouter-* / referer openrouter.ai) → deterministycznie najniższy TTFT (ignor load)
 * - Smooth WRR (Nginx) → currentWeight += weight, pick max, selected.currentWeight -= totalWeight. Eliminuje thundering herd vs pure random.
 * - Fallback: jeśli wszystkie circuit open → najszybszy verified (sort EWMA TTFT asc)
 * - Cold start: brak EWMA → weight neutral (ttftFactor=1, 400ms baseline) + success 1.0, aby nowe węzły dostały ruch i zbudowały EWMA.
 * - Jitter: przy równych wagach, sort stabilny + heartbeat recency jako tie-breaker.
 *
 * Prior art: vllm-project/router (least-loaded + prefix-aware), vllm-project/semantic-router, thushan/olla (weighted least conn),
 * Finagle EWMA, Nginx smooth WRR. Dla LLM TTFT krytyczny jest prefill (KV cache) → TTFT najlepszy sygnał zdrowia.
 */

import { EWMA } from "./ewma"
import type { StoredProvider } from "@/lib/providers-store"

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
export const EWMA_ALPHA = 0.2
export const BASE_TTFT_MS = 400 // ideal RTX 5090 NVFP4 prefill
export const MIN_TTFT_MS = 50
export const MAX_TTFT_MS = 30_000
export const TTFT_THRESHOLD_MS = Number(process.env.ROUTING_TTFT_THRESHOLD_MS || 5000)
export const CONCURRENT_PENALTY = 0.5 // 1/(1+conc*0.5) → 2 conc = 0.5 weight
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
// Weight computation
// ---------------------------------------------------------------------------
function computeWeight(stat: InternalStat, opts?: { ignoreLoad?: boolean; isSubscription?: boolean }): number {
  const ttft = stat.ewmaTtft.get()
  const ttftFactor = ttft === null ? 1 : BASE_TTFT_MS / Math.max(Math.min(ttft, MAX_TTFT_MS), MIN_TTFT_MS)
  const baseLoadFactor = opts?.ignoreLoad ? 1 : 1 / (1 + stat.concurrentRequests * CONCURRENT_PENALTY)
  // Subscription traffic gets background priority (lower load weight) to protect Pay-As-You-Go SLAs
  const subPenalty = opts?.isSubscription ? 0.3 : 1.0
  const loadFactor = baseLoadFactor * subPenalty
  const successRate = stat.totalRequests === 0 ? 1 : Math.max(SUCCESS_FLOOR, stat.successCount / stat.totalRequests)
  // scale to readable 0..100
  const w = ttftFactor * loadFactor * successRate * 100
  return Math.max(1, Math.round(w * 10) / 10) // min 1 to avoid starvation, 1 decimal
}

function syncWeight(stat: InternalStat, ignoreLoad?: boolean, isSubscription?: boolean): void {
  stat.weight = computeWeight(stat, { ignoreLoad, isSubscription })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Zarejestruj latency dla providera (TTFT + total). Wywoływane po każdym request + po verify probe */
export function recordLatency(providerId: string, ttftMs: number | null, totalMs: number | null, success: boolean): void {
  const s = ensureStat(providerId)
  const now = new Date().toISOString()
  if (ttftMs !== null && Number.isFinite(ttftMs) && ttftMs > 0) {
    s.ewmaTtft.update(ttftMs)
  }
  if (totalMs !== null && Number.isFinite(totalMs) && totalMs > 0) {
    s.ewmaLatency.update(totalMs)
  }
  s.totalRequests += 1
  if (success) s.successCount += 1
  s.lastUpdate = now
  syncWeight(s, false)

  // mirror to providers-store StoredProvider for persistence / observability (best effort, avoid circular via globalThis)
  try {
    const g2 = globalThis as unknown as { __seedinferProviders?: { providers: Map<string, any> } }
    const p = g2.__seedinferProviders?.providers.get(providerId)
    if (p) {
      p.ewmaTtft = s.ewmaTtft.get()
      p.ewmaLatency = s.ewmaLatency.get()
      p.concurrentRequests = s.concurrentRequests
      p.totalRequests = s.totalRequests
      p.successCount = s.successCount
      // also sync weight for listProviders sorting without importing selector (denormalized)
      p._routingWeight = s.weight
      p._routingCurrentWeight = s.currentWeight
    }
  } catch {}

  // also feed fallback-state per-provider latency for TTFT degrade circuit
  try {
    // dynamic to avoid circular at import time; fallback-state will be imported lazily if available
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fb = require("@/lib/fallback-state") as typeof import("@/lib/fallback-state")
    if (fb && typeof (fb as any).recordProviderLatency === "function") {
      ;(fb as any).recordProviderLatency(providerId, ttftMs, success)
    }
  } catch {}
}

export function incrementConcurrent(providerId: string): void {
  const s = ensureStat(providerId)
  s.concurrentRequests += 1
  syncWeight(s, false)
  try {
    const g2 = globalThis as unknown as { __seedinferProviders?: { providers: Map<string, any> } }
    const p = g2.__seedinferProviders?.providers.get(providerId)
    if (p) p.concurrentRequests = s.concurrentRequests
  } catch {}
}

export function decrementConcurrent(providerId: string): void {
  const s = ensureStat(providerId)
  s.concurrentRequests = Math.max(0, s.concurrentRequests - 1)
  syncWeight(s, false)
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

/** Zwróć routing stats per provider (dla /api/v1/routing/stats) */
export function getStats(): Record<string, ProviderRoutingStat> {
  const store = getStore()
  const out: Record<string, ProviderRoutingStat> = {}
  // lazy import isCircuitOpen per provider
  let isProviderCircuitOpen: ((id: string) => boolean) | null = null
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fb = require("@/lib/fallback-state") as typeof import("@/lib/fallback-state")
    isProviderCircuitOpen = (fb as any).isProviderCircuitOpen || (fb as any).isCircuitOpen || null
  } catch {}
  for (const [id, s] of store.stats.entries()) {
    syncWeight(s, false)
    let circuitOpen = false
    try {
      if (isProviderCircuitOpen) circuitOpen = isProviderCircuitOpen(id)
      if (!circuitOpen) {
        const fb = require("@/lib/fallback-state") as typeof import("@/lib/fallback-state")
        if ((fb as any).isCircuitOpen) {
        }
      }
    } catch {}
    const successRate = s.totalRequests === 0 ? 1 : s.successCount / s.totalRequests
    out[id] = {
      providerId: id,
      ewmaTtft: s.ewmaTtft.get(),
      ewmaLatency: s.ewmaLatency.get(),
      concurrentRequests: s.concurrentRequests,
      activeTokens: s.activeTokens,
      totalRequests: s.totalRequests,
      successCount: s.successCount,
      successRate: Math.round(successRate * 1000) / 1000,
      weight: s.weight,
      currentWeight: Math.round(s.currentWeight * 10) / 10,
      circuitOpen,
      lastUpdate: s.lastUpdate,
    }
  }
  return out
}

export function getProviderStat(providerId: string): ProviderRoutingStat | null {
  const all = getStats()
  return all[providerId] || null
}

function isCircuitOpenSafe(providerId: string): boolean {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fb = require("@/lib/fallback-state") as typeof import("@/lib/fallback-state")
    if (typeof (fb as any).isProviderCircuitOpen === "function") {
      if ((fb as any).isProviderCircuitOpen(providerId)) return true
    }
    if (typeof (fb as any).isCircuitOpen === "function") {
      try {
        if ((fb as any).isCircuitOpen(providerId)) return true
      } catch {}
    }
    return false
  } catch {
    return false
  }
}

/** Hydrate selector stats from StoredProvider fields (po restarcie lub gdy provider ma już EWMA w store) */
function hydrateFromProvider(p: StoredProvider): void {
  const s = ensureStat(p.id)
  if ((p as any).ewmaTtft !== undefined && (p as any).ewmaTtft !== null && s.ewmaTtft.get() === null) {
    s.ewmaTtft.set((p as any).ewmaTtft)
  }
  if ((p as any).ewmaLatency !== undefined && (p as any).ewmaLatency !== null && s.ewmaLatency.get() === null) {
    s.ewmaLatency.set((p as any).ewmaLatency)
  }
  if (typeof (p as any).concurrentRequests === "number") s.concurrentRequests = (p as any).concurrentRequests
  if (typeof (p as any).totalRequests === "number") s.totalRequests = (p as any).totalRequests
  if (typeof (p as any).successCount === "number") s.successCount = (p as any).successCount
  syncWeight(s, false)
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

/** Sprawdź czy cała sieć zweryfikowanych dostawców osiągnęła bufor bezpieczeństwa 90% (sloty lub KV cache tokeny) */
export function isNetworkSaturated(
  providers: (StoredProvider | import("@/lib/types").Provider)[],
  incomingTokens: number = 1000
): boolean {
  if (!providers || providers.length === 0) return false
  const verified = (providers as any).filter((p: any) => p.verification?.status === "verified" || !p.verification)
  if (verified.length === 0) return false
  return verified.every((p: any) => {
    const s = ensureStat(p.id)
    const slotSaturated = s.concurrentRequests >= getSafeMaxConcurrency(p)
    const kvSaturated = (s.activeTokens + incomingTokens) >= getSafeMaxKvTokens(p)
    return slotSaturated || kvSaturated
  })
}

/** Główny selector: wybiera best provider via WRR ważony odwrotnie do TTFT i load
 * Akceptuje Provider[] (spec) lub StoredProvider[] — jeśli brak verification field, traktuje wszystkich jako selectable (cold start test)
 */
export function selectProvider(
  providers: (StoredProvider | import("@/lib/types").Provider)[],
  opts?: { openRouter?: boolean; isSubscription?: boolean; incomingTokens?: number }
): (StoredProvider | import("@/lib/types").Provider) | null {
  if (!providers || providers.length === 0) return null

  const incomingTokens = opts?.incomingTokens ?? 1000

  // hydrate for StoredProvider paths
  for (const p of providers as StoredProvider[]) {
    try { hydrateFromProvider(p as StoredProvider) } catch {}
  }

  let candidates = (providers as any).filter((p: any) => p.verification?.status === "verified")
  if (candidates.length === 0) {
    candidates = (providers as any).filter((p: any) => p.verification?.status === "verifying")
    if (candidates.length === 0) {
      const anyVerifiable = (providers as any).some((p: any) => p.verification)
      if (!anyVerifiable && providers.length > 0) {
        candidates = providers as any
      } else {
        return null
      }
    }
  }

  const isOpenRouter = !!opts?.openRouter
  const isSubscription = !!opts?.isSubscription

  // Oblicz wagi i filtruj circuit open oraz twarde nasycenie 90% (sloty + KV cache)
  type Cand = { provider: StoredProvider; stat: InternalStat }
  const cands: Cand[] = []
  const circuitFiltered: Cand[] = []

  for (const p of candidates) {
    const stat = ensureStat(p.id)
    syncWeight(stat, isOpenRouter, isSubscription)
    const open = isCircuitOpenSafe(p.id)

    // Hard 90% Saturation Guard: Check slot capacity AND incoming KV cache token headroom
    const slotSaturated = stat.concurrentRequests >= getSafeMaxConcurrency(p)
    const kvSaturated = (stat.activeTokens + incomingTokens) >= getSafeMaxKvTokens(p)
    if (slotSaturated || kvSaturated) {
      continue // Odrzuć nasycony węzeł przed jakimkolwiek losowaniem
    }

    const entry: Cand = { provider: p, stat }
    cands.push(entry)
    if (!open) circuitFiltered.push(entry)
  }

  // Jeśli wszyscy w pętli zostali odrzuceni (brak węzłów <90%), zwróć null -> Router wyemituje HTTP 429
  const pool = circuitFiltered.length > 0 ? circuitFiltered : cands.length > 0 ? cands : []

  if (pool.length === 0) return null
  if (pool.length === 1) return pool[0].provider

  // OpenRouter: deterministycznie najniższy TTFT (ignor load)
  if (isOpenRouter) {
    // sort by EWMA TTFT asc, nulls last (cold start → środek)
    const sorted = [...pool].sort((a, b) => {
      const aTtft = a.stat.ewmaTtft.get()
      const bTtft = b.stat.ewmaTtft.get()
      if (aTtft === null && bTtft === null) return 0
      if (aTtft === null) return 1
      if (bTtft === null) return -1
      if (aTtft !== bTtft) return aTtft - bTtft
      // tie: success rate desc
      const aSucc = a.stat.totalRequests ? a.stat.successCount / a.stat.totalRequests : 1
      const bSucc = b.stat.totalRequests ? b.stat.successCount / b.stat.totalRequests : 1
      if (aSucc !== bSucc) return bSucc - aSucc
      return new Date(b.provider.last_heartbeat).getTime() - new Date(a.provider.last_heartbeat).getTime()
    })
    return sorted[0].provider
  }

  // Power of Two Random Choices (P2C) + Least Outstanding Requests (LOR)
  // Eliminates thundering herd behavior & avoids active polling overhead at 1000s of nodes
  const useP2C = process.env.ROUTING_ALGORITHM !== "wrr"
  if (useP2C) {
    for (let retry = 0; retry < 3; retry++) {
      const idx1 = Math.floor(Math.random() * pool.length)
      let idx2 = Math.floor(Math.random() * pool.length)
      if (pool.length > 1 && idx1 === idx2) {
        idx2 = (idx1 + 1) % pool.length
      }
      const candA = pool[idx1]
      const candB = pool[idx2]

    // 1. Compare in-memory concurrent active requests (Least Outstanding Requests)
    let winner = candA
    if (candA.stat.concurrentRequests > candB.stat.concurrentRequests) {
      winner = candB
    } else if (candA.stat.concurrentRequests === candB.stat.concurrentRequests) {
      const ttftA = candA.stat.ewmaTtft.get() ?? 9999
      const ttftB = candB.stat.ewmaTtft.get() ?? 9999
      if (ttftB < ttftA) winner = candB
    }

    const winSlotSat = winner.stat.concurrentRequests >= getSafeMaxConcurrency(winner.provider)
    const winKvSat = (winner.stat.activeTokens + incomingTokens) >= getSafeMaxKvTokens(winner.provider)
    if (!winSlotSat && !winKvSat) {
      return winner.provider
    }
  }
  return null
}

  // Standard WRR: smooth weighted round robin (Nginx)
  let totalWeight = 0
  for (const c of pool) totalWeight += c.stat.weight

  if (totalWeight <= 0) {
    const sorted = [...pool].sort((a, b) => {
      const av = a.stat.ewmaTtft.get() ?? 9999
      const bv = b.stat.ewmaTtft.get() ?? 9999
      return av - bv
    })
    return sorted[0].provider
  }

  let best: Cand | null = null
  for (const c of pool) {
    c.stat.currentWeight += c.stat.weight
    if (!best || c.stat.currentWeight > best.stat.currentWeight) best = c
  }
  if (best) {
    best.stat.currentWeight -= totalWeight
    try {
      const g2 = globalThis as unknown as { __seedinferProviders?: { providers: Map<string, any> } }
      for (const c of pool) {
        const p = g2.__seedinferProviders?.providers.get(c.provider.id)
        if (p) {
          p._routingWeight = c.stat.weight
          p._routingCurrentWeight = c.stat.currentWeight
          p.ewmaTtft = c.stat.ewmaTtft.get()
          p.ewmaLatency = c.stat.ewmaLatency.get()
        }
      }
    } catch {}
    return best.provider
  }

  return pool[0].provider
}

/** P2C (Power of Two Random Choices) + Least Outstanding Requests explicit export */
export function selectProviderP2C(
  providers: (StoredProvider | import("@/lib/types").Provider)[],
  opts?: { openRouter?: boolean; isSubscription?: boolean }
): (StoredProvider | import("@/lib/types").Provider) | null {
  return selectProvider(providers, opts)
}

/** Zwróć posortowaną listę providerów wg wagi (dla sekwencyjnego fallback prób) */
export function getSortedProviders(
  providers: (StoredProvider | import("@/lib/types").Provider)[],
  opts?: { openRouter?: boolean; isSubscription?: boolean }
): (StoredProvider | import("@/lib/types").Provider)[] {
  if (!providers || providers.length === 0) return []
  for (const p of providers as StoredProvider[]) { try { hydrateFromProvider(p as StoredProvider) } catch {} }
  let cands = (providers as any).filter((p: any) => p.verification?.status === "verified")
  if (cands.length === 0) {
    cands = (providers as any).filter((p: any) => p.verification?.status === "verifying")
    if (cands.length === 0) {
      const anyVerifiable = (providers as any).some((p: any) => p.verification)
      if (!anyVerifiable && providers.length > 0) cands = providers as any
    }
  }
  const isOpenRouter = !!opts?.openRouter
  const isSubscription = !!opts?.isSubscription
  for (const p of cands) syncWeight(ensureStat(p.id), isOpenRouter, isSubscription)

  const filtered = cands.filter((p: any) => !isCircuitOpenSafe((p as any).id))
  const pool = filtered.length > 0 ? filtered : cands

  // Prefer unsaturated nodes with 10% safety buffer guard (90% max concurrency cap)
  const unsaturatedPool = pool.filter((p: any) => {
    const s = ensureStat(p.id)
    return s.concurrentRequests < getSafeMaxConcurrency(p)
  })
  const effectivePool = unsaturatedPool.length > 0 ? unsaturatedPool : pool

  if (isOpenRouter) {
    return [...effectivePool].sort((a: any, b: any) => {
      const sa = ensureStat(a.id)
      const sb = ensureStat(b.id)
      const aTtft = sa.ewmaTtft.get() ?? 9999
      const bTtft = sb.ewmaTtft.get() ?? 9999
      if (aTtft !== bTtft) return aTtft - bTtft
      return sb.weight - sa.weight
    })
  }
  // sort by weight desc, then TTFT asc
  return [...effectivePool].sort((a: any, b: any) => {
    const sa = ensureStat(a.id)
    const sb = ensureStat(b.id)
    if (sa.weight !== sb.weight) return sb.weight - sa.weight
    const aTtft = sa.ewmaTtft.get() ?? 9999
    const bTtft = sb.ewmaTtft.get() ?? 9999
    return aTtft - bTtft
  })
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

  // Ensure node is verified if verification status exists
  if (provider.verification?.status && provider.verification.status !== "verified") {
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
