/**
 * lib/fallback-clients.ts — upstream configuration for fallback chain
 * Order: local → NIM → Opencode → OpenRouter → Modal
 *   Logika: local fail → fire-and-forget warmup Modal (parallel),
 *   then sequential NIM → opencode → openrouter (30s), only if all fail → await Modal (120s).
 * Env-driven, nie leakuje kluczy w odpowiedzi status.
 */

export type UpstreamId = "local" | "nim" | "opencode" | "openrouter" | "modal"

export type UpstreamConfig = {
  id: UpstreamId
  label: string
  baseUrl: string | null
  chatPath: string // e.g. /v1/chat/completions
  model: string // mapped model id dla tego providera
  apiKey: string | null
  apiKeyEnv: string // nazwa env dla diagnostyki
  hasKey: boolean
  timeoutMs: number
  headers?: Record<string, string>
}

// ---------------------------------------------------------------------------
// Modal warmup state (fire-and-forget parallel)
// ---------------------------------------------------------------------------
export type ModalWarmupState = "idle" | "triggered"
let modalWarmupState: ModalWarmupState = "idle"
let lastWarmupAt: string | null = null

export function getModalWarmupStatus(): { state: ModalWarmupState; lastWarmupAt: string | null } {
  return { state: modalWarmupState, lastWarmupAt }
}

export function resetModalWarmup(): void {
  modalWarmupState = "idle"
  lastWarmupAt = null
}

/**
 * triggerModalWarmup — fire-and-forget warmup Modal A100.
 * Warunki: MODAL_WARMUP !== false/0 (default true), MODAL_BASE_URL ustawiony.
 * Executes GET {MODAL_BASE_URL}/health (fallback /v1/models) with MODAL_API_KEY if set,
 * bez blokowania requestu, timeout 5s, log "[chat] modal warmup triggered" lub skip.
 */
export function triggerModalWarmup(): void {
  const warmupRaw = process.env.MODAL_WARMUP
  const warmupEnabled =
    warmupRaw === undefined || warmupRaw === null || String(warmupRaw).trim() === ""
      ? true
      : String(warmupRaw).toLowerCase() !== "false" && String(warmupRaw) !== "0" && String(warmupRaw).toLowerCase() !== "off"
  if (!warmupEnabled) {
    console.log("[chat] modal warmup skipped (MODAL_WARMUP=false)")
    return
  }
  const baseUrl = envAny("MODAL_BASE_URL", "MODAL_URL")
  if (!baseUrl) {
    console.log("[chat] modal warmup skipped (no MODAL_BASE_URL)")
    return
  }
  const modalKey = envAny("MODAL_API_KEY", "MODAL_KEY")
  const cleanBase = baseUrl.replace(/\/$/, "")
  // Primary endpoint: /health per spec; fallback /v1/models if 404
  const healthUrl = `${cleanBase}/health`
  const modelsUrl = `${cleanBase}/v1/models`

  modalWarmupState = "triggered"
  lastWarmupAt = new Date().toISOString()
  console.log("[chat] modal warmup triggered")

  const doFetch = (url: string, timeoutMs: number, headers: Record<string, string>) => {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), timeoutMs)
    return fetch(url, { method: "GET", headers, signal: ctrl.signal } as any).finally(() => clearTimeout(t))
  }

  const headers: Record<string, string> = { Accept: "application/json" }
  if (modalKey) headers["Authorization"] = `Bearer ${modalKey}`

  // Fire-and-forget: nie blokuj, 5s timeout per endpoint
  doFetch(healthUrl, 5000, headers)
    .then(async (res) => {
      console.log(`[chat] modal warmup response ${res.status} from ${healthUrl}`)
      if (res.status === 404) {
        // fallback to /v1/models
        try {
          const res2 = await doFetch(modelsUrl, 5000, headers)
          console.log(`[chat] modal warmup fallback response ${res2.status} from ${modelsUrl}`)
        } catch (e: any) {
          console.log(`[chat] modal warmup fallback fail ${String(e?.message || e).slice(0, 120)}`)
        }
      }
    })
    .catch((e: any) => {
      const msg = String(e?.message || e).slice(0, 120)
      console.log(`[chat] modal warmup fail ${msg}`)
      // If health does not respond (e.g. ECONNREFUSED), try fallback /v1/models in background
      if (msg.toLowerCase().includes("fetch") || msg.toLowerCase().includes("abort") || msg.toLowerCase().includes("econnrefused")) {
        doFetch(modelsUrl, 5000, headers)
          .then((r) => console.log(`[chat] modal warmup fallback response ${r.status} from ${modelsUrl}`))
          .catch((e2: any) => console.log(`[chat] modal warmup fallback fail ${String(e2?.message || e2).slice(0, 120)}`))
      }
    })
}

/**
 * Map incoming model → upstream model
 * seedinfer/nemotron-lightning-1m (nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4, 30B A3B, 1M ctx)
 * → NIM: nvidia/nemotron-3-nano-30b-a3b (decyzja: 30B A3B najbardziej kompatybilny)
 *   Alternatywa nvidia/nvidia-nemotron-nano-9b-v2 to 9B Hybrid Mamba, mniejszy, 128k ctx — niezgodny z Lightning 1M.
 *   Docs: build.nvidia.com — nano-30b has 1000k ctx, 31.6B/3.6B active, reasoning, closer to Lightning than 9B.
 * → Opencode Zen: deepseek-v4-flash (env OPENCODE_MODEL) — see comment below
 * → OpenRouter: nvidia/nemotron-3-nano-30b-a3b:free (env OPENROUTER_MODEL)
 * → Modal: seedinfer/nemotron-lightning-1m (env MODAL_MODEL)
 * → local: keep original (seedinfer/nemotron-lightning-1m)
 *
 * Model selection for Opencode (Zen):
 *   - Task wymaga aliasu OPENCODE_ZEN_KEY → OPENCODE_API_KEY oraz base https://opencode.ai/zen/v1 (alt https://opencode.ai/api/v1).
 *     Badanie: proxy_aggregator.py tiers — zen free = deepseek-v4-flash, openrouter = nvidia/nemotron-3-ultra / nvidia/nemotron-3-nano-30b-a3b:free.
 *     Zen nie gwarantuje nvidia/nemotron-3-nano-30b-a3b w free tier, eksponuje deepseek-v4-flash jako stabilny darmowy model.
 *   - Options considered for SeedInfer fallback opencode:
 *       a) nvidia/nemotron-3-nano-30b-a3b — closest to Lightning 1M (30B A3B, 1M ctx), ideal if Zen offered it; no free guarantee.
 *       b) nemotron-3-lightning-free — previous default, semantically closest to Lightning, but not listed in Zen tiers.
 *       c) deepseek-v4-flash — listed in tiers as Zen free tier, guaranteed, although different family (DeepSeek V4 Flash).
 *   - Decision: for OPENCODE_ZEN_KEY (sk-...) default = deepseek-v4-flash (guaranteed on zen/v1, compliant with tiers), override via OPENCODE_MODEL allows forcing nvidia/nemotron-3-nano-30b-a3b or nemotron-3-lightning-free if Zen adds Nemotron.
 *     Dla non-zen (brak OPENCODE_ZEN_KEY) fallback = nvidia/nemotron-3-nano-30b-a3b (kompatybilny z NIM/OpenRouter).
 *     Users can set OPENCODE_MODEL=nvidia/nemotron-3-nano-30b-a3b or nemotron-3-lightning-free to restore the previous model without code changes.
 */
export function mapModelForUpstream(incomingModel: string, upstreamId: UpstreamId): string {
  const m = (incomingModel || "").toLowerCase()
  const isNemotron = m.includes("nemotron") || m.includes("gpt-oss") || m.includes("lightning")
  // If not nemotron, pass through as-is (validation in route will hint)
  if (!isNemotron) return incomingModel

  switch (upstreamId) {
    case "local":
      return incomingModel // keep canonical
    case "nim":
      return process.env.NIM_MODEL || process.env.NVIDIA_MODEL || "nvidia/nemotron-3-nano-30b-a3b"
    case "opencode": {
      if (process.env.OPENCODE_MODEL) return process.env.OPENCODE_MODEL
      // Detect Zen key alias — sk-... wskazuje na Zen (OPENCODE_ZEN_KEY)
      const zenKey = envAny("OPENCODE_ZEN_KEY", "OPENCODE_ZEN_API_KEY", "OPENCODE_API_KEY", "OPENCODE_KEY")
      const isZen = !!envAny("OPENCODE_ZEN_KEY", "OPENCODE_ZEN_API_KEY") || (zenKey ? zenKey.trim().startsWith("sk-") : false)
      // Decyzja: deepseek-v4-flash dla Zen (tiers zen model deepseek-v4-flash), nvidia/nemotron-3-nano-30b-a3b dla non-zen
      if (isZen) return "deepseek-v4-flash"
      return "nvidia/nemotron-3-nano-30b-a3b"
    }
    case "openrouter":
      return process.env.OPENROUTER_MODEL || "nvidia/nemotron-3-nano-30b-a3b:free"
    case "modal":
      return process.env.MODAL_MODEL || "seedinfer/nemotron-lightning-1m"
    default:
      return incomingModel
  }
}

function envAny(...keys: string[]): string | null {
  for (const k of keys) {
    const v = process.env[k]
    if (v && String(v).trim() !== "") return String(v).trim()
  }
  return null
}

export function getUpstreamConfigs(): UpstreamConfig[] {
  // Timeouts: local 60s total (8s connect intent), fallbacks 30s, modal 120s (cold start)
  const localTimeout = Number(process.env.LOCAL_TIMEOUT_MS || process.env.FALLBACK_LOCAL_TIMEOUT_MS || 60_000)
  const fallbackTimeout = Number(process.env.FALLBACK_TIMEOUT_MS || 30_000)
  const modalTimeout = Number(process.env.MODAL_TIMEOUT_MS || 120_000)

  const nimKey = envAny("NIM_API_KEY", "NVAPI_KEY", "NVIDIA_API_KEY", "NVAPI__KEY")
  // Alias: OPENCODE_ZEN_KEY jako OPENCODE_API_KEY (user Pi ma zen key na host PC, nie w /opt/seedinfer/.env)
  const opencodeKey = envAny("OPENCODE_API_KEY", "OPENCODE_ZEN_KEY", "OPENCODE_ZEN_API_KEY", "OPENCODE_KEY")
  const openrouterKey = envAny("OPENROUTER_API_KEY", "OPENROUTER_KEY")
  const modalKey = envAny("MODAL_API_KEY", "MODAL_KEY")

  const nimBase = envAny("NIM_BASE_URL", "NVIDIA_BASE_URL", "NIM_URL") || "https://integrate.api.nvidia.com/v1"
  // Opencode: task requires base https://opencode.ai/zen/v1 (zen) or https://opencode.ai/api/v1 — we pick the working one:
  //   - when OPENCODE_ZEN_KEY present → default zen/v1 (Zen gateway), else api/v1 (legacy)
  //   - env OPENCODE_BASE_URL/OPENCODE_URL has priority if set
  //   - alt https://api.opencode.ai/v1 wspierany via env
  const hasZenKey = !!envAny("OPENCODE_ZEN_KEY", "OPENCODE_ZEN_API_KEY") || (opencodeKey ? opencodeKey.trim().startsWith("sk-") : false)
  const opencodeDefaultBase = hasZenKey ? "https://opencode.ai/zen/v1" : "https://opencode.ai/api/v1"
  const opencodeBase = envAny("OPENCODE_BASE_URL", "OPENCODE_URL") || opencodeDefaultBase
  const openrouterBase = envAny("OPENROUTER_BASE_URL", "OPENROUTER_URL") || "https://openrouter.ai/api/v1"
  const modalBase = envAny("MODAL_BASE_URL", "MODAL_URL") || null

  const configs: UpstreamConfig[] = [
    // local jest dynamiczny — baseUrl ustalany z providers-store, tu placeholder
    {
      id: "local",
      label: "RTX 5090 NVFP4 (Tailnet :3001)",
      baseUrl: envAny("VLLM_URL", "LOCAL_VLLM_URL", "SEEDINFER_VLLM_URL") || null,
      chatPath: "/v1/chat/completions",
      model: "seedinfer/nemotron-lightning-1m",
      apiKey: null,
      apiKeyEnv: "TAILNET (no key, forward Authorization)",
      hasKey: true, // local does not need key
      timeoutMs: localTimeout,
    },
    {
      id: "nim",
      label: "Nvidia NIM Nemotron",
      baseUrl: nimBase,
      chatPath: "/chat/completions",
      model: mapModelForUpstream("seedinfer/nemotron-lightning-1m", "nim"),
      apiKey: nimKey,
      apiKeyEnv: "NIM_API_KEY (or NVAPI_KEY)",
      hasKey: !!nimKey,
      timeoutMs: fallbackTimeout,
    },
    {
      id: "opencode",
      label: "Opencode Free Nemotron",
      baseUrl: opencodeBase,
      chatPath: "/chat/completions",
      model: mapModelForUpstream("seedinfer/nemotron-lightning-1m", "opencode"),
      apiKey: opencodeKey,
      apiKeyEnv: "OPENCODE_API_KEY",
      hasKey: !!opencodeKey,
      timeoutMs: fallbackTimeout,
    },
    {
      id: "openrouter",
      label: "OpenRouter Free Nemotron",
      baseUrl: openrouterBase,
      chatPath: "/chat/completions",
      model: mapModelForUpstream("seedinfer/nemotron-lightning-1m", "openrouter"),
      apiKey: openrouterKey,
      apiKeyEnv: "OPENROUTER_API_KEY",
      hasKey: !!openrouterKey,
      timeoutMs: fallbackTimeout,
      headers: {
        // OpenRouter recommends Referer + Title
        "HTTP-Referer": process.env.OPENROUTER_REFERER || "https://seedinfer.com",
        "X-Title": process.env.OPENROUTER_TITLE || "SeedInfer Gateway",
      },
    },
    {
      id: "modal",
      label: "Modal A100 On-Demand",
      baseUrl: modalBase,
      chatPath: "/v1/chat/completions",
      model: mapModelForUpstream("seedinfer/nemotron-lightning-1m", "modal"),
      apiKey: modalKey,
      apiKeyEnv: "MODAL_API_KEY",
      hasKey: !!modalBase, // modal needs baseUrl, key optional if public
      timeoutMs: modalTimeout,
    },
  ]

  return configs
}

export function getUpstreamForStatus(): Array<Omit<UpstreamConfig, "apiKey"> & { hasKey: boolean; apiKeyPreview: string | null }> {
  return getUpstreamConfigs().map((c) => {
    const preview = c.apiKey ? `${c.apiKey.slice(0, 6)}...${c.apiKey.slice(-4)}` : null
    const { apiKey: _k, ...rest } = c
    return { ...rest, apiKeyPreview: preview }
  })
}

/** Zwraca URL do POST na danym upstreamie (baseUrl + chatPath handling slash) */
export function upstreamChatUrl(cfg: UpstreamConfig): string | null {
  if (!cfg.baseUrl) return null
  return buildUpstreamUrl(cfg.baseUrl, cfg.chatPath)
}

// Helper to deduplicate logic cleanly
export function buildUpstreamUrl(baseUrl: string, chatPath: string): string {
  const base = baseUrl.replace(/\/$/, "")
  const path = chatPath.startsWith("/") ? chatPath : `/${chatPath}`
  if (base.endsWith("/v1") && path.startsWith("/v1/")) {
    return `${base}${path.slice(3)}`
  }
  return `${base}${path}`
}
