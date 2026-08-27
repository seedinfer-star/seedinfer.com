/**
 * lib/telemetry-store.ts — persistent telemetry stub (Faza 0)
 * Hybryda: in-memory Map + JSONL append (SQLite TODO dla Fazy 1)
 * Pi paths: /mnt/nvme/telemetry/telemetry.jsonl or /opt/seedinfer/telemetry/telemetry.jsonl
 *            oraz SQLite /mnt/nvme/telemetry/telemetry.sqlite (future)
 *
 * Schema: timestamp, provider_id, gpu, requests, tokens, latency, upstream, fallback_chain, ttft, rpm, verified
 * Persystencja: append JSONL, auto-flush co 30s, survive restart, retention 30d, rotacja, backup /mnt/nvme
 * API: GET /api/v1/telemetry + POST /api/v1/telemetry/ingest (heartbeat already logs, add persistence)
 *
 * Lean: Faza 0 = in-memory + JSONL (no native deps). Faza 1 = better-sqlite3 (wymaga kompilacji aarch64).
 * Qwen consult: JSONL wybrany jako lean — brak kompilacji natywnej, ext4 NVMe 476GB szybki append, daily rotacja via cron/systemd.
 */

export type TelemetryEvent = {
  timestamp: string // ISO
  provider_id: string
  gpu?: string | null
  requests?: number
  tokens?: number
  latency?: number // ms
  upstream?: string | null // local|nim|opencode|openrouter|modal
  fallback_chain?: string[] | null
  ttft?: number | null // ms time to first token
  rpm?: number | null // requests per minute
  verified?: boolean | null
  // raw extras
  agent_url?: string | null
  tailscale_ip?: string | null
  vllm_model?: string | null
  region?: string | null
  raw?: Record<string, any>
}

type GlobalTelemetry = {
  events: TelemetryEvent[]
  // pending buffer for JSONL flush
  pending: TelemetryEvent[]
  flushTimer?: NodeJS.Timeout | null
}

// survives HMR via globalThis
const g = globalThis as unknown as { __seedinferTelemetry?: GlobalTelemetry }

function getStore(): GlobalTelemetry {
  if (!g.__seedinferTelemetry) {
    g.__seedinferTelemetry = { events: [], pending: [], flushTimer: null }
    // try load from JSONL on first init (if exists) — best effort, non-blocking
    tryLoadJsonl()
    // schedule auto-flush co 30s
    scheduleFlush()
  }
  return g.__seedinferTelemetry!
}

function isNode(): boolean {
  return typeof process !== "undefined" && !!process.versions?.node
}

function telemetryDir(): string {
  // Pi: /mnt/nvme/telemetry (476GB NVMe, ext4) fallback /opt/seedinfer/telemetry
  const envDir = process.env.TELEMETRY_DIR || process.env.SEEDINFER_TELEMETRY_DIR
  if (envDir) return envDir.replace(/\/$/, "")
  // try NVMe first, fallback to /tmp for dev
  return "/mnt/nvme/telemetry"
}

function jsonlPath(): string {
  const dir = telemetryDir()
  const file = process.env.TELEMETRY_FILE || "telemetry.jsonl"
  return `${dir}/${file}`
}

function sqlitePath(): string {
  const dir = telemetryDir()
  return `${dir}/telemetry.sqlite`
}

async function tryLoadJsonl(): Promise<void> {
  if (!isNode()) return
  try {
    const fs = await import("fs")
    const path = jsonlPath()
    if (!fs.existsSync(path)) return
    const text = fs.readFileSync(path, "utf8")
    const lines = text.trim().split("\n").filter(Boolean).slice(-10000) // cap 10k last
    const parsed: TelemetryEvent[] = []
    for (const l of lines) {
      try {
        const j = JSON.parse(l)
        if (j && j.timestamp && j.provider_id) parsed.push(j)
      } catch {}
    }
    const store = g.__seedinferTelemetry
    if (store) {
      store.events = parsed.slice(-5000) // keep last 5k in memory
      console.log(`[telemetry-store] loaded ${parsed.length} events from ${path}, kept ${store.events.length}`)
    }
  } catch (e: any) {
    console.warn(`[telemetry-store] tryLoadJsonl skip: ${e?.message || e}`)
  }
}

function scheduleFlush(): void {
  if (!isNode()) return
  const store = getStore()
  if (store.flushTimer) return
  store.flushTimer = setInterval(() => {
    flushPending().catch((e) => console.warn(`[telemetry-store] auto-flush fail: ${e?.message || e}`))
  }, 30_000)
  // don't block exit
  if (store.flushTimer && typeof (store.flushTimer as any).unref === "function") (store.flushTimer as any).unref()
}

async function flushPending(): Promise<void> {
  if (!isNode()) return
  const store = getStore()
  if (store.pending.length === 0) return
  const batch = [...store.pending]
  store.pending = []
  try {
    const fs = await import("fs")
    const pathMod = await import("path")
    const p = jsonlPath()
    const dir = pathMod.dirname(p)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
      console.log(`[telemetry-store] mkdir ${dir}`)
    }
    const lines = batch.map((e) => JSON.stringify(e)).join("\n") + "\n"
    fs.appendFileSync(p, lines, "utf8")
    // console.log(`[telemetry-store] flushed ${batch.length} -> ${p}`)
  } catch (e: any) {
    console.warn(`[telemetry-store] flush fail, requeue ${batch.length}: ${e?.message || e}`)
    // requeue
    store.pending.unshift(...batch)
  }
}

// Public API

export function appendTelemetry(ev: TelemetryEvent): void {
  const store = getStore()
  // normalize
  const norm: TelemetryEvent = {
    timestamp: ev.timestamp || new Date().toISOString(),
    provider_id: String(ev.provider_id || "unknown"),
    gpu: ev.gpu ?? null,
    requests: ev.requests ?? 0,
    tokens: ev.tokens ?? 0,
    latency: ev.latency ?? undefined,
    upstream: ev.upstream ?? null,
    fallback_chain: ev.fallback_chain ?? null,
    ttft: ev.ttft ?? null,
    rpm: ev.rpm ?? null,
    verified: ev.verified ?? null,
    agent_url: ev.agent_url ?? null,
    tailscale_ip: ev.tailscale_ip ?? null,
    vllm_model: ev.vllm_model ?? null,
    region: ev.region ?? null,
    raw: ev.raw,
  }
  store.events.push(norm)
  store.pending.push(norm)
  // cap in-memory 5000
  if (store.events.length > 5000) store.events = store.events.slice(-5000)
  // immediate flush if pending > 50 (burst)
  if (store.pending.length >= 50) {
    flushPending().catch(() => {})
  }
}

export function listTelemetry(opts?: { limit?: number; provider_id?: string; since?: string }): TelemetryEvent[] {
  const store = getStore()
  let arr = store.events
  if (opts?.provider_id) arr = arr.filter((e) => e.provider_id === opts.provider_id)
  if (opts?.since) {
    const sinceTs = new Date(opts.since).getTime()
    if (!Number.isNaN(sinceTs)) arr = arr.filter((e) => new Date(e.timestamp).getTime() >= sinceTs)
  }
  // sort newest first
  arr = [...arr].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
  if (opts?.limit) arr = arr.slice(0, opts.limit)
  return arr
}

export function getTelemetryStats(): { count: number; pending: number; dir: string; jsonl: string; sqlite: string } {
  const store = getStore()
  return {
    count: store.events.length,
    pending: store.pending.length,
    dir: telemetryDir(),
    jsonl: jsonlPath(),
    sqlite: sqlitePath(),
  }
}

export async function flushTelemetry(): Promise<void> {
  await flushPending()
}

export async function clearTelemetry(): Promise<void> {
  const store = getStore()
  store.events = []
  store.pending = []
  if (!isNode()) return
  try {
    const fs = await import("fs")
    const p = jsonlPath()
    if (fs.existsSync(p)) {
      // truncate, keep backup with timestamp
      const bak = `${p}.bak.${new Date().toISOString().slice(0, 10)}`
      try { fs.copyFileSync(p, bak) } catch {}
      fs.truncateSync(p, 0)
      console.log(`[telemetry-store] cleared ${p} (backup ${bak})`)
    }
  } catch (e: any) {
    console.warn(`[telemetry-store] clear fail: ${e?.message || e}`)
  }
  // TODO SQLite: DELETE FROM telemetry; VACUUM; when better-sqlite3 integrated
}

// For heartbeat integration: helper to log provider heartbeat as telemetry
export function logHeartbeatTelemetry(payload: Record<string, any>, opts?: { ip?: string | null }): void {
  try {
    const id = String(payload.id || payload.provider_id || "unknown")
    appendTelemetry({
      timestamp: new Date().toISOString(),
      provider_id: id,
      gpu: payload.chip || payload.gpu?.devices?.[0]?.name || null,
      requests: payload.requests_served ?? 0,
      tokens: payload.tokens_generated ?? 0,
      latency: payload.latencyMs ?? undefined,
      upstream: "heartbeat",
      fallback_chain: null,
      verified: payload.verification?.status === "verified" ? true : false,
      agent_url: payload.agent_url || null,
      tailscale_ip: payload.tailscale_ip || null,
      vllm_model: payload.vllm_model || payload.current_model || null,
      region: payload.region || null,
      raw: payload,
    })
  } catch (e: any) {
    console.warn(`[telemetry-store] logHeartbeat fail: ${e?.message || e}`)
  }
}

// SQLite TODO interface (not blocking build)
/**
 * TODO Faza 1 (SQLite):
 *  import Database from 'better-sqlite3' // needs native compile on aarch64 (python3, make, g++)
 *  const db = new Database(sqlitePath())
 *  db.exec(`CREATE TABLE IF NOT EXISTS telemetry (
 *    id INTEGER PRIMARY KEY AUTOINCREMENT,
 *    timestamp TEXT NOT NULL,
 *    provider_id TEXT NOT NULL,
 *    gpu TEXT, requests INTEGER, tokens INTEGER, latency INTEGER,
 *    upstream TEXT, fallback_chain TEXT, ttft INTEGER, rpm REAL, verified INTEGER,
 *    raw TEXT
 *  ); CREATE INDEX IF NOT EXISTS idx_telemetry_ts ON telemetry(timestamp);
 *       CREATE INDEX IF NOT EXISTS idx_telemetry_provider ON telemetry(provider_id);`)
 *  // on append: db.prepare('INSERT INTO telemetry (...) VALUES (...)').run(...)
 *  // auto-flush co 30s via WAL, retention: DELETE FROM telemetry WHERE timestamp < datetime('now','-30 days')
 *  // backup: sqlite3 telemetry.sqlite ".backup /mnt/nvme/telemetry/backup.sqlite"
 *  // systemd timer: seedinfer-telemetry-aggregate.service + .timer (daily 02:00)
 *
 *  Lean alternative without native: `sql.js` (wasm) or stay with JSONL + daily rotation via logrotate.
 */
