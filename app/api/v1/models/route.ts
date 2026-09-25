import { NextResponse } from "next/server"
import { listRoutableProviders } from "@/lib/providers-store"
import { MODELS, HIDDEN_ROUTING_ALIASES, LIVE_MODEL, perTokenUsd, type CatalogModel } from "@/lib/catalog"

export const dynamic = "force-dynamic"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-OpenRouter-Title, HTTP-Referer",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

/**
 * OpenRouter Provider Integration Schema v2.4 Specification Model Descriptor Builder
 */
function buildOpenRouterModelSpec(opts: {
  id: string
  name: string
  hugging_face_id?: string
  quantization?: string
  tokenizer?: string
  description: string
  promptCostUsd: string
  completionCostUsd: string
  contextLength?: number
  maxOutput?: number
  isReady?: boolean
  isFree?: boolean
  slug?: string
  cachedPromptCostUsd?: string
  status?: string
}) {
  const contextLen = opts.contextLength || LIVE_MODEL.contextLength
  const maxOut = opts.maxOutput || contextLen
  const slug = opts.slug || opts.id

  return {
    // OpenRouter Provider Schema v2.4 Specification
    schema_version: "2.4",

    // Identity (required)
    id: opts.id,
    name: opts.name,
    hugging_face_id: opts.hugging_face_id || "",
    created: 1735689600, // 2025-01-01 00:00 UTC — stable
    quantization: opts.quantization || "nvfp4",
    tokenizer: opts.tokenizer || "",
    description: opts.description,

    // Input modalities: text with context constraints, pricing, capacity
    input_modalities: [
      {
        type: "text",
        supported_inputs: {
          max_context_length: { value: contextLen, unit: "token" },
          max_prompt_length: { value: contextLen, unit: "token" },
        },
        pricing: [
          { type: "prompt", unit: "token", cost_usd: opts.promptCostUsd },
          { type: "cached_prompt", unit: "token", cost_usd: opts.cachedPromptCostUsd ?? "0" },
          { type: "cache_write", unit: "token", ttl_seconds: 60, implicit: true, cost_usd: "0" },
        ],
        capacity: [
          { type: "prompt", unit: "token", per: "minute", value: 10000000 },
          { type: "cached_prompt", unit: "token", per: "minute", value: 20000000 },
        ],
      },
    ],

    // Output modalities: text with parameters, streaming, pricing, capacity
    output_modalities: [
      {
        type: "text",
        max_length: { value: maxOut, unit: "token" },
        streaming: true,
        supported_parameters: {
          temperature: { type: "range", min: 0, max: 2 },
          top_p: { type: "range", min: 0, max: 1 },
          max_tokens: { type: "integer", min: 1, max: maxOut, unit: "token" },
          stop: { type: "array", max_items: 4 },
          tools: { type: "boolean" },
          structured_outputs: { type: "boolean" },
          reasoning: { type: "boolean" },
        },
        pricing: [
          { type: "completion", unit: "token", cost_usd: opts.completionCostUsd },
        ],
        capacity: [
          { type: "completion", unit: "token", per: "minute", value: 2000000 },
        ],
      },
    ],

    // Root pricing and capacity (request-scoped)
    pricing: [],
    capacity: [
      { type: "request", unit: "request", per: "minute", value: 10000 },
    ],

    // Request-scoped passthrough parameters
    passthrough_parameters: {},

    // Operational fields
    is_ready: opts.isReady ?? true,
    status: opts.status ?? "live",
    is_free: opts.isFree ?? false,
    discount_to_user: 0,
    openrouter: {
      slug,
    },
    deployment_region: "global",
    compliance: {
      zdr: true, // Zero Data Retention
      hipaa: false,
    },

    // OpenAI API Backward Compatibility Fields
    object: "model" as const,
    owned_by: "seedinfer",
    permission: [],
    context_length: contextLen,
    max_output: maxOut,
    // Flat pricing for legacy OpenAI clients
    pricing_legacy: {
      prompt: opts.promptCostUsd,
      completion: opts.completionCostUsd,
      cache_read: opts.cachedPromptCostUsd ?? "0",
    },
  }
}

function specFromCatalog(m: CatalogModel, idOverride?: string) {
  return buildOpenRouterModelSpec({
    id: idOverride || m.id,
    name: `SeedInfer: ${m.name}${idOverride ? " (alias)" : ""}`,
    hugging_face_id: m.hfId,
    quantization: m.quantization,
    tokenizer: m.tokenizer,
    description: idOverride ? `Alias for ${m.id}` : m.description,
    promptCostUsd: perTokenUsd(m.pricePer1M.input),
    completionCostUsd: perTokenUsd(m.pricePer1M.output),
    cachedPromptCostUsd: perTokenUsd(m.pricePer1M.cachedInput),
    contextLength: m.contextLength,
    maxOutput: m.contextLength,
    isReady: m.status === "live",
    isFree: false,
    slug: m.id,
    status: m.status,
  })
}

// Live models (+ their public aliases) are ready; coming-soon models are listed with is_ready=false.
const CATALOG_SPECS = MODELS.flatMap((m) =>
  m.status === "live" ? [specFromCatalog(m), ...m.aliases.map((a) => specFromCatalog(m, a))] : [specFromCatalog(m)],
)
const KNOWN_IDS = new Set<string>([
  ...MODELS.flatMap((m) => [m.id, m.hfId, ...m.aliases].filter(Boolean)),
  ...Object.keys(HIDDEN_ROUTING_ALIASES),
])

export async function GET() {
  // Collect dynamic models from connected verified providers.
  // Boot-hydrated nodes (awaiting_heartbeat) are excluded until a fresh heartbeat — never advertised.
  const activeProviders = listRoutableProviders()
  const dynamicModelsMap = new Map<string, any>()

  for (const prov of activeProviders) {
    const modelName = prov.current_model || prov.vllm_model
    if (modelName && !KNOWN_IDS.has(modelName) && !modelName.startsWith("/")) {
      if (!dynamicModelsMap.has(modelName)) {
        dynamicModelsMap.set(
          modelName,
          buildOpenRouterModelSpec({
            id: modelName,
            name: `SeedInfer: ${modelName.split("/").pop() || modelName}`,
            description: `Dynamic provider-hosted model ${modelName} on SeedInfer P2P network.`,
            promptCostUsd: perTokenUsd(LIVE_MODEL.pricePer1M.input),
            completionCostUsd: perTokenUsd(LIVE_MODEL.pricePer1M.output),
            isReady: true,
            isFree: false,
          })
        )
      }
    }
  }

  const allModels = [...CATALOG_SPECS, ...Array.from(dynamicModelsMap.values())]

  const body = {
    object: "list",
    data: allModels,
  }

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=300",
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  })
}

