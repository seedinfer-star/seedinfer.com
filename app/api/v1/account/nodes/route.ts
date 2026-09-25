import { NextResponse } from "next/server";
import { getRequestSession } from "@/lib/auth";
import { listUserNodes } from "@/lib/provider-tokens";
import { getProvider } from "@/lib/providers-store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };
const ONLINE_WINDOW_MS = 90_000;

export async function GET(req: Request) {
  const sess = await getRequestSession(req);
  if (!sess) {
    return NextResponse.json({ error: "unauthorized", code: "unauthorized" }, { status: 401, headers: NO_STORE });
  }
  const rows = listUserNodes(sess.userId);
  const now = Date.now();
  const nodes = rows.map((r) => {
    const live = getProvider(r.node_id);
    const hb = live?.last_heartbeat ?? r.last_seen_at ?? null;
    const t = hb ? new Date(hb).getTime() : NaN;
    return {
      id: r.node_id,
      status: live?.status ?? (Number.isFinite(t) ? "offline" : "offline"),
      online: Number.isFinite(t) && now - t <= ONLINE_WINDOW_MS && !live?.awaiting_heartbeat,
      last_heartbeat: hb,
      bound_at: r.bound_at,
      token_prefix: r.token_prefix,
      // Telemetry mirrors only — never IPs / agent_url / hostnames.
      model: (live as any)?.current_model ?? null,
      gpu: live?.gpu ?? null,
      region: live?.region ?? null,
      country_code: live?.country_code ?? null,
      agent_version: live?.agent_version ?? null,
      heartbeat_count: live?.heartbeat_count ?? 0,
      total_requests: (live as any)?.totalRequests ?? 0,
    };
  });
  return NextResponse.json({ nodes }, { headers: NO_STORE });
}
