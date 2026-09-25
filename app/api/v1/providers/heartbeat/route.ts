import { NextResponse } from "next/server";
import { handleHeartbeat } from "./handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  return handleHeartbeat(req);
}

export async function GET() {
  return NextResponse.json(
    {
      message: "Use POST /api/v1/providers/heartbeat with Provider payload + Authorization: Bearer sipn_...",
      example: {
        id: "provider-5090-xxx",
        chip: "GeForce RTX 5090",
        current_model: "google/gemma-4-26b-a4b-nvfp4",
        vllm_health: { status: "ok" },
        gpu: { count: 1, devices: [{ name: "NVIDIA GeForce RTX 5090", memory_total_mb: 32768 }] },
      },
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
