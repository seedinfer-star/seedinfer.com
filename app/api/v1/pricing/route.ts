import { NextResponse } from "next/server"
import { MODELS, CACHE_POLICY, perTokenUsd, usd } from "@/lib/catalog"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET() {
  const body = {
    object: "pricing",
    data: MODELS.map((m) => ({
      id: m.id,
      object: "model" as const,
      name: m.name,
      hugging_face_id: m.hfId || undefined,
      // per-token USD (per-1M / 1e6)
      pricing: {
        prompt: perTokenUsd(m.pricePer1M.input),
        completion: perTokenUsd(m.pricePer1M.output),
        cache_read: perTokenUsd(m.pricePer1M.cachedInput),
      },
      // human readable, per 1M tokens
      per_1m: {
        input: usd(m.pricePer1M.input),
        output: usd(m.pricePer1M.output),
        cache_read: usd(m.pricePer1M.cachedInput),
      },
      context_length: m.contextLength,
      max_output: m.contextLength,
      description: m.description,
      status: m.status,
      aliases: m.status === "live" ? m.aliases : [],
    })),
    currency: "USD",
    unit: "pricing = USD per token; per_1m = USD per 1M tokens",
    cache_policy: CACHE_POLICY.label,
  }

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  })
}
