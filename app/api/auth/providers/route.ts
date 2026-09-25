import { NextResponse } from "next/server";
import { configuredProviders, providerConfigured } from "@/lib/oauth/flow";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Public: which social sign-in buttons should be shown. No secrets. */
export async function GET() {
  const all = ["google", "github"] as const;
  return NextResponse.json(
    {
      ok: true,
      providers: all.map((p) => ({ id: p, enabled: providerConfigured(p) })),
      any: configuredProviders().length > 0,
    },
    { headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
