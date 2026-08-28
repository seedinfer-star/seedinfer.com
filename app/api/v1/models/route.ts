import { NextResponse } from "next/server"
import { listProviders } from "@/lib/providers-store"

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
}) {
  const contextLen = opts.contextLength || 1048576
  const maxOut = opts.maxOutput || 1048576
  const slug = opts.slug || opts.id

  return {
    // OpenRouter Provider Schema v2.4 Specification
    schema_version: "2.4",

    // Identity (required)
    id: opts.id,
    name: opts.name,
    hugging_face_id: opts.hugging_face_id || "nvidia/Nemotron-4-34B-Instruct",
    created: 1735689600, // 2025-01-01 00:00 UTC — stable
    quantization: opts.quantization || "nvfp4",
    tokenizer: opts.tokenizer || "Nemotron",
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
          { type: "cached_prompt", unit: "token", cost_usd: "0.00000" },
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
    is_free: opts.isFree ?? false,
    discount_to_user: 0,
    openrouter: {
      slug,
    },
    datacenters: [
      { country_code: "PL", region: "eu-central-1" },
      { country_code: "US", region: "us-east-1" },
    ],
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
      cache_read: "0.0",
    },
  }
}

// Gemma 4 Flagship Model
const GEMMA4_SPEC = buildOpenRouterModelSpec({
  id: "google/gemma-4-26b-a4b-nvfp4",
  name: "SeedInfer: Gemma 4 26B A4B NVFP4",
  hugging_face_id: "nvidia/Gemma-4-26B-A4B-NVFP4",
  quantization: "nvfp4",
  tokenizer: "Gemma4",
  description: "SeedInfer P2P Gemma 4 26B A4B MoE (NVFP4) optimized for low TTFT P99 (<50ms) & high throughput.",
  promptCostUsd: "0.00002",
  completionCostUsd: "0.00005",
  contextLength: 262144,
  maxOutput: 262144,
  isReady: true,
  isFree: false,
})

const GEMMA4_ALIAS_SPEC = buildOpenRouterModelSpec({
  id: "seedinfer/gemma-4-26b-a4b",
  name: "SeedInfer: Gemma 4 26B A4B Alias",
  hugging_face_id: "nvidia/Gemma-4-26B-A4B-NVFP4",
  quantization: "nvfp4",
  tokenizer: "Gemma4",
  description: "Alias for google/gemma-4-26b-a4b-nvfp4",
  promptCostUsd: "0.00002",
  completionCostUsd: "0.00005",
  contextLength: 262144,
  maxOutput: 262144,
  isReady: true,
  isFree: false,
  slug: "google/gemma-4-26b-a4b-nvfp4",
})

const NEMOTRON_SPEC = buildOpenRouterModelSpec({
  id: "seedinfer/nemotron-lightning-1m",
  name: "SeedInfer: Nemotron 3.5 Lightning 30B 1M (NVFP4)",
  hugging_face_id: "nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4",
  quantization: "nvfp4",
  tokenizer: "Nemotron",
  description: "Legacy Nemotron 3.5 Lightning 30B A3B NVFP4 model.",
  promptCostUsd: "0.00002",
  completionCostUsd: "0.00005",
  contextLength: 1048576,
  maxOutput: 1048576,
  isReady: true,
  isFree: false,
})

const ALIAS_SPEC = buildOpenRouterModelSpec({
  id: "gpt-oss-20b",
  name: "SeedInfer: gpt-oss-20b Alias",
  hugging_face_id: "nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4",
  quantization: "nvfp4",
  tokenizer: "Nemotron",
  description: "Alias for seedinfer/nemotron-lightning-1m",
  promptCostUsd: "0.00002",
  completionCostUsd: "0.00005",
  contextLength: 1048576,
  maxOutput: 1048576,
  isReady: true,
  isFree: false,
  slug: "seedinfer/nemotron-lightning-1m",
})

export async function GET() {
  // Collect dynamic models from connected verified providers
  const activeProviders = listProviders().filter((p) => p.verification?.status === "verified")
  const dynamicModelsMap = new Map<string, any>()

  for (const prov of activeProviders) {
    const modelName = prov.current_model || prov.vllm_model
    if (
      modelName &&
      modelName !== GEMMA4_SPEC.id &&
      modelName !== GEMMA4_ALIAS_SPEC.id &&
      modelName !== NEMOTRON_SPEC.id &&
      modelName !== ALIAS_SPEC.id
    ) {
      if (!dynamicModelsMap.has(modelName)) {
        dynamicModelsMap.set(
          modelName,
          buildOpenRouterModelSpec({
            id: modelName,
            name: `SeedInfer: ${modelName.split("/").pop() || modelName}`,
            description: `Dynamic provider-hosted model ${modelName} on SeedInfer P2P network.`,
            promptCostUsd: "0.00002",
            completionCostUsd: "0.00005",
            isReady: true,
            isFree: false,
          })
        )
      }
    }
  }

  const allModels = [GEMMA4_SPEC, GEMMA4_ALIAS_SPEC, NEMOTRON_SPEC, ALIAS_SPEC, ...Array.from(dynamicModelsMap.values())]

  const body = {
    object: "list",
    data: allModels,
  }

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  })
}

