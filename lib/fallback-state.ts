/**
 * lib/fallback-state.ts — circuit breaker + stats dla fallback proxy chain + per-provider TTFT routing
 * In-memory, survives HMR via globalThis. Per-upstream cooldown.
 * 5 fails → 60s open. Lean, terse.
 * Rozszerzenie routing: per-provider latency tracking (EWMA TTFT) + circuit degrade gdy TTFT >5s.
 */

export type UpstreamId = "local" | "nim" | "opencode" | "openrouter" | "modal"

export type CircuitState = {
  fails: number
  successes: number
  failUntil: number | null // epoch ms
  lastError: string | null
  lastFailAt: string | null
  lastSuccessAt: string | null
  consecutiveFails: number
  // routing extension: per-provider TTFT tracking
  ewmaTtft?: number | null
  lastTtftMs?: number | null
  consecutiveSlow?: number // consecutive TTFT > threshold
}

type Store = {
  circuits: Map<string, CircuitState> // key: UpstreamId | providerId (Headscale 100.64.0.0/10)
  stats: {
    totalRequests: number
    fallbackCount: number
    perUpstream: Record<string, { requests: number; fails: number; successes: number }>
  }
  providerLatencies: Map<string, { ewmaTtft: number | null; lastTtft: number | null; samples: number }>
}

const FAIL_THRESHOLD = Number(process.env.FALLBACK_FAIL_THRESHOLD || 5)
const COOLDOWN_MS = Number(process.env.FALLBACK_COOLDOWN_MS || 60_000)
const TTFT_THRESHOLD_MS = Number(process.env.ROUTING_TTFT_THRESHOLD_MS || 5000)
const TTFT_SLOW_THRESHOLD = Number(process.env.ROUTING_TTFT_SLOW_FAILS || 3) // 3 consecutive >5s → degrade circuit 60s

const g = globalThis as unknown as { __seedinferFallback?: Store }

function getStore(): Store {
  if (!g.__seedinferFallback) {
    g.__seedinferFallback = {
      circuits: new Map(),
      stats: { totalRequests: 0, fallbackCount: 0, perUpstream: {} },
      providerLatencies: new Map(),
    }
    const ids: UpstreamId[] = ["local", "nim", "opencode", "openrouter", "modal"]
    for (const id of ids) {
      g.__seedinferFallback.circuits.set(id, {
        fails: 0,
        successes: 0,
        failUntil: null,
        lastError: null,
        lastFailAt: null,
        lastSuccessAt: null,
        consecutiveFails: 0,
        ewmaTtft: null,
        lastTtftMs: null,
        consecutiveSlow: 0,
      })
      g.__seedinferFallback.stats.perUpstream[id] = { requests: 0, fails: 0, successes: 0 }
    }
  }
  // backward compat: ensure providerLatencies map exists
  if (!(g.__seedinferFallback as any).providerLatencies) {
    ;(g.__seedinferFallback as any).providerLatencies = new Map()
  }
  return g.__seedinferFallback!
}

function ensureCircuit(id: string): CircuitState {
  const store = getStore()
  let c = store.circuits.get(id)
  if (!c) {
    c = { fails: 0, successes: 0, failUntil: null, lastError: null, lastFailAt: null, lastSuccessAt: null, consecutiveFails: 0 }
    store.circuits.set(id, c)
    if (!store.stats.perUpstream[id]) store.stats.perUpstream[id] = { requests: 0, fails: 0, successes: 0 }
  }
  return c
}

export function isCircuitOpen(id: string): boolean {
  const c = ensureCircuit(id)
  if (c.failUntil && Date.now() < c.failUntil) return true
  if (c.failUntil && Date.now() >= c.failUntil) {
    // cooldown expired — half-open, allow one probe
    c.failUntil = null
    c.consecutiveFails = 0
    if (c.consecutiveSlow) c.consecutiveSlow = 0
    console.log(`[fallback-state] circuit half-open ${id}`)
  }
  return false
}

export function isProviderCircuitOpen(providerId: string): boolean {
  return isCircuitOpen(providerId)
}

export function getCircuitState(id: string): CircuitState & { open: boolean; cooldownRemainingMs: number } {
  const c = ensureCircuit(id)
  const open = !!(c.failUntil && Date.now() < c.failUntil)
  const remaining = open && c.failUntil ? c.failUntil - Date.now() : 0
  return { ...c, open, cooldownRemainingMs: Math.max(0, remaining) }
}

export function getProviderCircuitState(providerId: string) {
  return getCircuitState(providerId)
}

export function recordSuccess(id: string): void {
  const c = ensureCircuit(id)
  const store = getStore()
  c.successes += 1
  c.consecutiveFails = 0
  c.fails = 0
  c.failUntil = null
  c.lastSuccessAt = new Date().toISOString()
  // keep lastError for history but not cleared
  store.stats.perUpstream[id].successes += 1
  store.stats.perUpstream[id].requests += 1
  // console.log(`[fallback-state] success ${id}`)
}

export function recordFailure(id: string, error: string): void {
  const c = ensureCircuit(id)
  const store = getStore()
  c.fails += 1
  c.consecutiveFails += 1
  c.lastError = String(error).slice(0, 500)
  c.lastFailAt = new Date().toISOString()
  store.stats.perUpstream[id].fails += 1
  store.stats.perUpstream[id].requests += 1

  if (c.consecutiveFails >= FAIL_THRESHOLD) {
    c.failUntil = Date.now() + COOLDOWN_MS
    console.warn(`[fallback-state] circuit OPEN ${id} fails=${c.consecutiveFails} cooldown=${COOLDOWN_MS}ms err=${error.slice(0, 120)}`)
  } else {
    console.warn(`[fallback-state] fail ${id} (${c.consecutiveFails}/${FAIL_THRESHOLD}) err=${error.slice(0, 120)}`)
  }
}

export function getAllStatuses(): Record<string, ReturnType<typeof getCircuitState>> {
  const ids: UpstreamId[] = ["local", "nim", "opencode", "openrouter", "modal"]
  const out: any = {}
  for (const id of ids) out[id] = getCircuitState(id)
  // also include provider circuits (100.64.0.0/10 nodes)
  const store = getStore()
  for (const [k, v] of store.circuits.entries()) {
    if (!(k in out)) {
      out[k] = getCircuitState(k)
    }
  }
  return out
}

export function getAllProviderStatuses(): Record<string, ReturnType<typeof getCircuitState>> {
  const store = getStore()
  const out: Record<string, ReturnType<typeof getCircuitState>> = {}
  for (const [k] of store.circuits.entries()) {
    if (!["local", "nim", "opencode", "openrouter", "modal"].includes(k)) {
      out[k] = getCircuitState(k)
    }
  }
  // also from providerLatencies not yet circuit but have latency
  for (const [k] of store.providerLatencies.entries()) {
    if (!(k in out)) out[k] = getCircuitState(k)
  }
  return out
}

export function getStats() {
  const store = getStore()
  return {
    ...store.stats,
    circuits: getAllStatuses(),
    providerCircuits: getAllProviderStatuses(),
    providerLatencies: Object.fromEntries(store.providerLatencies.entries()),
    config: { failThreshold: FAIL_THRESHOLD, cooldownMs: COOLDOWN_MS, ttftThresholdMs: TTFT_THRESHOLD_MS, ttftSlowThreshold: TTFT_SLOW_THRESHOLD },
  }
}

export function incrementTotalRequests() {
  getStore().stats.totalRequests += 1
}

export function incrementFallback() {
  getStore().stats.fallbackCount += 1
}

export function resetCircuit(id?: string) {
  const store = getStore()
  if (id) {
    const c = ensureCircuit(id)
    c.fails = 0
    c.consecutiveFails = 0
    c.failUntil = null
    c.lastError = null
    c.consecutiveSlow = 0
    console.log(`[fallback-state] reset ${id}`)
  } else {
    for (const [k, v] of store.circuits.entries()) {
      v.fails = 0
      v.consecutiveFails = 0
      v.failUntil = null
      v.lastError = null
      v.consecutiveSlow = 0
    }
    console.log(`[fallback-state] reset all`)
  }
}

export function resetStats(): void {
  const store = getStore()
  store.stats.totalRequests = 0
  store.stats.fallbackCount = 0
  for (const k of Object.keys(store.stats.perUpstream)) {
    store.stats.perUpstream[k] = { requests: 0, fails: 0, successes: 0 }
  }
  console.log(`[fallback-state] reset stats`)
}

// ---------------------------------------------------------------------------
// Per-provider TTFT latency tracking + degrade circuit (>5s threshold)
// ---------------------------------------------------------------------------
export function recordProviderLatency(providerId: string, ttftMs: number | null, success: boolean): void {
  const store = getStore()
  const c = ensureCircuit(providerId)
  const alpha = 0.2
  if (ttftMs !== null && Number.isFinite(ttftMs) && ttftMs > 0) {
    const clamped = Math.min(ttftMs, 30_000)
    if (c.ewmaTtft === null || c.ewmaTtft === undefined) c.ewmaTtft = clamped
    else c.ewmaTtft = alpha * clamped + (1 - alpha) * c.ewmaTtft
    c.lastTtftMs = clamped
    // update providerLatencies mirror
    const pl = store.providerLatencies.get(providerId) || { ewmaTtft: null, lastTtft: null, samples: 0 }
    pl.lastTtft = clamped
    pl.ewmaTtft = c.ewmaTtft
    pl.samples += 1
    store.providerLatencies.set(providerId, pl)

    // TTFT threshold degrade: >5s jest slow → consecutiveSlow++
    if (clamped > TTFT_THRESHOLD_MS) {
      c.consecutiveSlow = (c.consecutiveSlow ?? 0) + 1
      console.warn(`[fallback-state] slow TTFT ${providerId} ${clamped}ms >${TTFT_THRESHOLD_MS}ms consecutiveSlow=${c.consecutiveSlow}/${TTFT_SLOW_THRESHOLD}`)
      if ((c.consecutiveSlow ?? 0) >= TTFT_SLOW_THRESHOLD) {
        // degrade circuit 60s (jak fail threshold) ale z osobnym powodem
        c.failUntil = Date.now() + COOLDOWN_MS
        c.lastError = `degraded: TTFT ${clamped}ms >${TTFT_THRESHOLD_MS}ms x${c.consecutiveSlow}`
        c.lastFailAt = new Date().toISOString()
        console.warn(`[fallback-state] circuit DEGRADE ${providerId} TTFT ${clamped}ms cooldown=${COOLDOWN_MS}ms`)
      }
    } else {
      // reset slow counter on fast TTFT, but keep EWMA
      if (c.consecutiveSlow) c.consecutiveSlow = 0
      // if previously degraded but TTFT now ok, allow half-open on next isCircuitOpen check? keep failUntil until expiry
    }
  }
  // if success false, also count as fail for circuit
  if (!success) {
    recordFailure(providerId, `ttft probe failure ttft=${ttftMs}`)
  } else {
    // on success with good TTFT, count as success for stats (but don't fully reset consecutiveFails yet — recordSuccess resets)
    // We call recordSuccess only if TTFT good? Keep conservative: success resets fails only if TTFT < threshold
    if ((ttftMs ?? 0) <= TTFT_THRESHOLD_MS) {
      // treat as healthy success → reset consecutiveFails but keep EWMA
      // don't fully reset failUntil if still in cooldown; let it expire
      if (!c.failUntil || Date.now() >= c.failUntil) {
        c.consecutiveFails = 0
        c.fails = 0
        c.lastSuccessAt = new Date().toISOString()
      }
    }
  }
}

export function getProviderLatency(providerId: string): { ewmaTtft: number | null; lastTtft: number | null; samples: number } | null {
  const store = getStore()
  return store.providerLatencies.get(providerId) || null
}

export function clearAllFallback(): void {
  resetCircuit()
  resetStats()
  // also reset wormup? handled via fallback-clients resetModalWarmup caller
  console.log(`[fallback-state] clearAllFallback done`)
}
