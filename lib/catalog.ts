/**
 * lib/catalog.ts — SINGLE SOURCE OF TRUTH for public product facts:
 * models, pricing, provider economics, payment chains, API base URL, GPU specs.
 *
 * Every page, component and API route must import from here instead of
 * hardcoding numbers. Change a value here → it changes everywhere.
 */

export type ModelStatus = "live" | "coming_soon"

export interface CatalogModel {
  /** Canonical OpenAI-compatible model id */
  id: string
  /** Accepted request aliases (routing only) */
  aliases: string[]
  /** Human-readable name */
  name: string
  /** Short name for tight UI */
  shortName: string
  hfId: string
  family: string
  status: ModelStatus
  contextLength: number
  /** Human-readable context, e.g. "256K" */
  contextLabel: string
  quantization: string
  tokenizer: string
  description: string
  /** USD per 1M tokens */
  pricePer1M: { input: number; output: number; cachedInput: number }
}

export const MODELS: CatalogModel[] = [
  {
    id: "google/gemma-4-26b-a4b-nvfp4",
    aliases: ["seedinfer/gemma-4-26b-a4b", "gemma-4-26b-a4b"],
    name: "Gemma 4 26B A4B NVFP4",
    shortName: "Gemma 4 26B",
    hfId: "nvidia/Gemma-4-26B-A4B-NVFP4",
    family: "Gemma",
    status: "live",
    contextLength: 262_144,
    contextLabel: "256K",
    quantization: "nvfp4",
    tokenizer: "Gemma4",
    description: "Gemma 4 26B A4B mixture-of-experts (NVFP4) served on the SeedInfer GPU network.",
    pricePer1M: { input: 0.03, output: 0.2, cachedInput: 0 },
  },
  {
    id: "seedinfer/nemotron-lightning-1m",
    aliases: [],
    name: "Nemotron 3.5 Lightning 30B A3B NVFP4",
    shortName: "Nemotron 3.5 Lightning",
    hfId: "nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4",
    family: "Nemotron",
    status: "coming_soon",
    contextLength: 1_048_576,
    contextLabel: "1M",
    quantization: "nvfp4",
    tokenizer: "Nemotron",
    description: "Nemotron 3.5 Lightning 30B A3B (NVFP4) with 1M-token context. Coming soon.",
    pricePer1M: { input: 0.02, output: 0.05, cachedInput: 0 },
  },
  {
    id: "qwen/qwen3.6-35b-a3b",
    aliases: [],
    name: "Qwen 3.6 35B A3B NVFP4",
    shortName: "Qwen 3.6 35B",
    hfId: "",
    family: "Qwen",
    status: "coming_soon",
    contextLength: 262_144,
    contextLabel: "256K",
    quantization: "nvfp4",
    tokenizer: "Qwen",
    description: "Qwen 3.6 35B A3B (NVFP4). Coming soon.",
    pricePer1M: { input: 0.06, output: 0.5, cachedInput: 0 },
  },
]

/**
 * Legacy request aliases accepted by the router for backward compatibility
 * only. NEVER display these in public model lists.
 */
export const HIDDEN_ROUTING_ALIASES: Record<string, string> = {
  "gpt-oss-20b": "seedinfer/nemotron-lightning-1m",
}

export const LIVE_MODEL: CatalogModel = MODELS.find((m) => m.status === "live")!
export const LIVE_MODELS: CatalogModel[] = MODELS.filter((m) => m.status === "live")
export const COMING_SOON_MODELS: CatalogModel[] = MODELS.filter((m) => m.status === "coming_soon")

export const CACHE_POLICY = {
  ttlSeconds: 60,
  maxSeconds: 300,
  label: "Cached input is free (60s TTL, max 5 min)",
}

/** Resolve a model id or alias to its catalog entry. */
export function findModel(idOrAlias: string | null | undefined): CatalogModel | undefined {
  if (!idOrAlias) return undefined
  const s = String(idOrAlias).trim().toLowerCase()
  return MODELS.find(
    (m) =>
      m.id.toLowerCase() === s ||
      (m.hfId && m.hfId.toLowerCase() === s) ||
      m.aliases.some((a) => a.toLowerCase() === s),
  )
}

/** True if id (or alias) refers to the live model family. */
export function isLiveModelId(id: string | null | undefined): boolean {
  const m = findModel(id)
  if (m) return m.status === "live"
  const s = String(id || "").toLowerCase()
  return s.includes("gemma-4") || s.includes("gemma4")
}

/**
 * Convert a per-1M-token USD price to a per-token USD string without float
 * artifacts. 0.03 → "0.00000003", 0.2 → "0.0000002", 0 → "0".
 */
export function perTokenUsd(per1M: number): string {
  if (!per1M) return "0"
  const s = (per1M / 1e6).toFixed(12)
  return s.replace(/0+$/, "").replace(/\.$/, "")
}

/** "$0.03" style label for a per-1M price. */
export function usd(n: number, digits = 2): string {
  return `$${n.toFixed(digits)}`
}

/** "$0.03 / $0.20" label for a model */
export function priceLabel(m: CatalogModel): string {
  return `${usd(m.pricePer1M.input)} / ${usd(m.pricePer1M.output)}`
}

export const PROVIDER_ECONOMICS = {
  revenueShare: 0.99,
  protocolFee: 0.01,
  standbyPerDayUsd: 0.4,
  standbyMinUptime: 0.5,
  minPayoutUsd: 1,
  payoutAsset: "USDC",
  payoutChain: "Base",
  payoutCadence: "monthly",
  heartbeatIntervalSec: 30,
  staleAfterSec: 300,
} as const

export const REVENUE_SHARE_PCT = Math.round(PROVIDER_ECONOMICS.revenueShare * 100) // 99
export const PROTOCOL_FEE_PCT = Math.round(PROVIDER_ECONOMICS.protocolFee * 100) // 1

export const STANDBY_LABEL = `$${PROVIDER_ECONOMICS.standbyPerDayUsd.toFixed(2)}/day per node with ≥${Math.round(
  PROVIDER_ECONOMICS.standbyMinUptime * 100,
)}% uptime that day`

export const PAYOUT_LABEL = `${PROVIDER_ECONOMICS.payoutAsset} on ${PROVIDER_ECONOMICS.payoutChain}, ${PROVIDER_ECONOMICS.payoutCadence}, minimum $${PROVIDER_ECONOMICS.minPayoutUsd.toFixed(2)}`

export interface PaymentChain {
  key: string
  name: string
  assets: string[]
}

/** Client deposit chains (NOT provider payouts — those are USDC on Base only). */
export const PAYMENT_CHAINS: PaymentChain[] = [
  { key: "eth", name: "Ethereum", assets: ["USDC", "ETH"] },
  { key: "arbitrum", name: "Arbitrum", assets: ["USDC", "ETH"] },
  { key: "polygon", name: "Polygon", assets: ["USDC"] },
  { key: "base", name: "Base", assets: ["USDC", "ETH"] },
  { key: "bnb", name: "BNB Chain", assets: ["USDC", "BNB"] },
  { key: "hyperevm", name: "HyperEVM", assets: ["USDC"] },
  { key: "solana", name: "Solana", assets: ["USDC", "SOL"] },
]

export const MIN_INVOICE_CENTS = 10

/** Solana deposit address — only from env; never fall back to a mint address. */
export const SOLANA_DEPOSIT_ADDRESS: string | null = (() => {
  const v = (process.env.NEXT_PUBLIC_SOLANA_ADDRESS || "").trim()
  if (!v || v === "So11111111111111111111111111111111111111112") return null
  return v
})()

export const SITE_URL = "https://seedinfer.com"
export const API_BASE_URL = "https://seedinfer.com/v1"
export const GITHUB_URL = "https://github.com/seedinfer-star/seedinfer.com"
export const LAST_UPDATED = "2026-09-24"

export interface GpuSpec {
  key: string
  name: string
  vramGb: number
  tdpW: number
  cudaCores?: number
  memBandwidthGBs?: number
  supported: boolean
  note?: string
}

export const GPU_SPECS: GpuSpec[] = [
  { key: "rtx5090", name: "RTX 5090 32GB", vramGb: 32, tdpW: 575, cudaCores: 21_760, memBandwidthGBs: 1_792, supported: true, note: "Reference node" },
  { key: "rtx6000ada", name: "RTX 6000 Ada 48GB", vramGb: 48, tdpW: 300, supported: true },
  { key: "2xl40s", name: "2× L40S 48GB", vramGb: 96, tdpW: 700, supported: true },
  { key: "a100", name: "A100 80GB", vramGb: 80, tdpW: 400, supported: true },
  { key: "h100", name: "H100 80GB", vramGb: 80, tdpW: 700, supported: true },
  { key: "24gb", name: "24GB cards (RTX 4090 / 3090)", vramGb: 24, tdpW: 450, supported: false, note: "Not supported yet — on the roadmap" },
]

export const MIN_VRAM_GB = 32
export const REFERENCE_GPU = GPU_SPECS[0]

export const SITE_METADATA_SUFFIX = "SeedInfer"

/**
 * Helper for per-route metadata. The root layout applies the "%s · SeedInfer"
 * title template, so `title` is the bare page name; OG title is the full string.
 */
export function pageMetadata(page: string, description: string, path: string) {
  const title = `${page} · ${SITE_METADATA_SUFFIX}`
  return {
    title: page,
    description,
    alternates: { canonical: path },
    openGraph: { title, description, url: `${SITE_URL}${path}`, siteName: "SeedInfer", type: "website" as const },
  }
}

export interface SubscriptionPlan {
  key: "GO" | "GOAT" | "PRO"
  priceCents: number
  multiplier: number
  usageCents: number
  /** max share of monthly usage per rolling 5h / 7d window */
  limit5h: number
  limit7d: number
  note: string
}

/** Canonical subscription plans (production values: 2x / 3x / 4x usage multipliers). */
export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  { key: "GO", priceCents: 100, multiplier: 2, usageCents: 200, limit5h: 0.4, limit7d: 0.7, note: "For hobbyists and lightweight bots" },
  { key: "GOAT", priceCents: 500, multiplier: 3, usageCents: 1500, limit5h: 0.2, limit7d: 0.5, note: "For developers and micro-SaaS apps" },
  { key: "PRO", priceCents: 1000, multiplier: 4, usageCents: 4000, limit5h: 0.125, limit7d: 0.4, note: "For professionals and high-volume use" },
]

export const centsToUsd = (c: number) => `$${(c / 100).toFixed(2)}`
