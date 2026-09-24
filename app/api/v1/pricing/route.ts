import { NextResponse } from "next/server"

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
    data: [
      {
        id: "seedinfer/nemotron-lightning-1m",
        object: "model" as const,
        pricing: {
          prompt: "0.00002",
          completion: "0.00005",
          cache_read: "0.0",
        },
        // human readable
        per_1m: {
          input: "$0.02",
          output: "$0.05",
          cache_read: "$0.00",
        },
        context_length: 1048576,
        max_output: 1048576,
        cache: "60s free / 5min max (prefix caching)",
        description: "Nemotron Lightning 1M (2M KV) - $0.02/1M in $0.05/1M out cache 60s free",
        status: "active",
        aliases: ["gpt-oss-20b"],
      },
      {
        id: "qwen3.6-35b-a3b",
        object: "model" as const,
        pricing: {
          prompt: "0.00006",
          completion: "0.0005",
        },
        per_1m: { input: "$0.06", output: "$0.50" },
        context_length: 131072,
        description: "Qwen 3.6 35B A3B — is coming",
        status: "is coming",
      },
      {
        id: "gemma-4-26b-a4b",
        object: "model" as const,
        pricing: {
          prompt: "modal",
          completion: "modal",
        },
        per_1m: { input: "on Modal", output: "on Modal" },
        description: "Gemma 4 26B A4B — is coming · on Modal",
        status: "is coming",
      },
    ],
    currency: "USD",
    unit: "per 1M tokens",
    cache_policy: "prefix caching 60s free, 5min max",
  }

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  })
}
