import { NextResponse } from "next/server";
import { handleHeartbeat } from "@/app/api/v1/providers/heartbeat/handler";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Legacy alias — same authenticated handler as /api/v1/providers/heartbeat. */
export async function POST(req: Request) {
  return handleHeartbeat(req);
}

export async function GET() {
  return NextResponse.json(
    { message: "Use POST /api/v1/providers/heartbeat" },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
