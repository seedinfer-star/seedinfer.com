/**
 * Authenticated heartbeat handler (shared by /api/v1/providers/heartbeat and the
 * legacy alias /api/providers/heartbeat).
 *
 * Auth: Authorization: Bearer <node token> (sipn_...). Body limit 64 KB.
 * Binding via provider_nodes: first valid heartbeat binds the node id to the
 * token's user; same user + another of his tokens -> OK; another user -> 403.
 */
import { NextResponse } from "next/server";
import { sanitizePublic } from "@/lib/public-sanitize";
import { upsertProvider, getProvider } from "@/lib/providers-store";
import { bindNode, NODE_ID_RE, verifyNodeToken } from "@/lib/provider-tokens";
import { checkRateLimit, getClientIp, getClientIpFromHeaders } from "@/lib/rate-limit";
import { normalizeCountryCode } from "@/lib/geo-centroids";
import { getProviderStat } from "@/lib/routing/selector";
import { getProviderCircuitState } from "@/lib/fallback-state";

export const HEARTBEAT_MAX_BYTES = 64 * 1024;
export const NODE_ID_PATTERN = NODE_ID_RE;

const NO_STORE = { "Cache-Control": "no-store, max-age=0" };

function err(code: string, message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ ok: false, error: message, code, ...extra }, { status, headers: NO_STORE });
}

function extractIp(req: Request): string | null {
  return getClientIpFromHeaders(req.headers);
}

function extractBearer(req: Request): string | null {
  const auth = req.headers.get("authorization") || req.headers.get("Authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  const token = (m?.[1] || "").trim();
  return token || null;
}

export async function handleHeartbeat(req: Request): Promise<Response> {
  const ip = extractIp(req);
  const ipKey = getClientIp(req);

  // Overall per-IP throttle: 600 req/min.
  const overall = checkRateLimit(`heartbeat:ip:${ipKey}`, 600, 60_000);
  if (!overall.ok) {
    return NextResponse.json({ ok: false, error: "Rate limited — slow down and retry.", code: "rate_limited" }, {
      status: 429,
      headers: { ...NO_STORE, "Retry-After": String(overall.retryAfterSec) },
    });
  }

  // 64 KB body limit: Content-Length fast path + actual-length enforcement.
  const contentLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(contentLength) && contentLength > HEARTBEAT_MAX_BYTES) {
    return err("payload_too_large", "Heartbeat body exceeds 64 KB.", 413);
  }
  let raw: string;
  try {
    raw = await req.text();
  } catch {
    return err("invalid_json", "Request body is not valid JSON.", 400);
  }
  if (Buffer.byteLength(raw, "utf8") > HEARTBEAT_MAX_BYTES) {
    return err("payload_too_large", "Heartbeat body exceeds 64 KB.", 413);
  }
  let payload: any;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    return err("invalid_json", "Request body is not valid JSON.", 400);
  }
  if (!payload || typeof payload !== "object") {
    return err("invalid_json", "Request body is not valid JSON.", 400);
  }
  const nodeId = String(payload.id || payload.provider_id || payload.providerId || "");
  if (!nodeId) {
    return err("missing_id", "Missing provider id.", 400);
  }
  if (!NODE_ID_RE.test(nodeId)) {
    return err("invalid_node_id", "Provider id must match ^[A-Za-z0-9._-]{1,64}$.", 400);
  }
  payload.id = nodeId;

  // Bearer token verification.
  const bearer = extractBearer(req);
  if (!bearer) {
    const rl = checkRateLimit(`heartbeat:fail:${ipKey}`, 30, 10 * 60_000);
    const res = err("node_token_missing", "Missing node token — send Authorization: Bearer sipn_... (SEEDINFER_NODE_TOKEN).", 401);
    if (!rl.ok) {
      res.headers.set("Retry-After", String(rl.retryAfterSec));
      return NextResponse.json({ ok: false, error: "Too many failed heartbeat attempts — slow down and retry.", code: "rate_limited" }, {
        status: 429,
        headers: { ...NO_STORE, "Retry-After": String(rl.retryAfterSec) },
      });
    }
    return res;
  }
  const verified = verifyNodeToken(bearer);
  if (!verified) {
    const rl = checkRateLimit(`heartbeat:fail:${ipKey}`, 30, 10 * 60_000);
    if (!rl.ok) {
      return NextResponse.json({ ok: false, error: "Too many failed heartbeat attempts — slow down and retry.", code: "rate_limited" }, {
        status: 429,
        headers: { ...NO_STORE, "Retry-After": String(rl.retryAfterSec) },
      });
    }
    return err("node_token_invalid", "Unknown or revoked node token — create a new one in /provider/portal.", 401);
  }

  // Binding (race-safe). Revoked tokens never reach here (verify rejects them); binding is kept.
  const bind = bindNode(nodeId, verified.userId, verified.tokenId);
  if (!bind.ok) {
    return err(
      "node_owned_by_another_account",
      "This node id is already bound to a different SeedInfer account.",
      403
    );
  }

  // Coarse public location: Cloudflare's country preferred over self-reported.
  const cfCountry = normalizeCountryCode(req.headers.get("cf-ipcountry"));
  const selfCountry = normalizeCountryCode(payload.country_code);
  if (cfCountry || selfCountry) payload.country_code = cfCountry || selfCountry;
  else delete payload.country_code;

  // Owner fields come ONLY from the verified token, never from the payload
  // (upsertProvider strips ignored body fields as defense in depth).
  const stored = upsertProvider(payload, { ip, ownerUserId: verified.userId, tokenId: verified.tokenId });

  try {
    const { logHeartbeatTelemetry } = await import("@/lib/telemetry-store");
    try {
      const { setForceZero, listRoutableProviders } = await import("@/lib/providers-store");
      // Awaiting-heartbeat nodes are boot-hydrated without a live connection — they must not clear forceZero.
      const verifiedCount = listRoutableProviders().length;
      if (verifiedCount > 0) {
        setForceZero(false);
      }
    } catch {}
    logHeartbeatTelemetry(payload, { ip });
  } catch (e: any) {
    console.warn(`[heartbeat] telemetry log skip: ${e?.message || e}`);
  }

  const provider = getProvider(nodeId);

  // --- TTFT probe for verified providers (heartbeat-triggered, fire-and-forget) ---
  if (provider && provider.verification.status === "verified") {
    const pid = String(provider.id);
    const lastProbe = (globalThis as any).__seedinferLastProbe?.[pid];
    const now = Date.now();
    if (!lastProbe || now - lastProbe > 30_000) {
      if (!(globalThis as any).__seedinferLastProbe) (globalThis as any).__seedinferLastProbe = {};
      (globalThis as any).__seedinferLastProbe[pid] = now;
      setTimeout(async () => {
        try {
          const urls: string[] = [];
          if (provider.tailscale_ip) urls.push(`http://${provider.tailscale_ip}:47901/v1/chat/completions`);
          if (provider.agent_url) {
            let u = provider.agent_url.replace(/\/$/, "");
            if (!u.startsWith("http")) u = `http://${u}`;
            if (u.endsWith("/v1/chat/completions")) urls.push(u);
            else if (u.includes(":47901") || u.includes(":3001")) urls.push(`${u}/v1/chat/completions`);
            else urls.push(`${u}/v1/chat/completions`);
          }
          const hn = (provider as any).tailscale_hostname || (provider as any).host?.tailscale_hostname;
          if (hn) urls.push(`http://${hn}.seedinfer.ts.net:47901/v1/chat/completions`);
          const uniq = [...new Set(urls)];
          if (uniq.length === 0) return;
          const probeUrl = uniq[0];
          const modelId = "seedinfer/nemotron-lightning-1m";
          const start = Date.now();
          const ctrl = new AbortController();
          const t = setTimeout(() => ctrl.abort(), 6000);
          const res = await fetch(probeUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: modelId, messages: [{ role: "user", content: "ping" }], max_tokens: 5, temperature: 0, stream: true }),
            signal: ctrl.signal as any,
          }).catch(() => null as any);
          clearTimeout(t);
          if (!res || !res.ok || !res.body) {
            const lat = Date.now() - start;
            const { recordLatency } = await import("@/lib/routing/selector");
            const { recordProviderLatency } = await import("@/lib/fallback-state");
            recordLatency(pid, lat, lat, false);
            recordProviderLatency(pid, lat, false);
            return;
          }
          const reader = (res.body as ReadableStream<Uint8Array>).getReader();
          const ttft = await Promise.race([
            (async () => {
              const first = await reader.read();
              if (first.done) throw new Error("empty");
              return Date.now() - start;
            })(),
            new Promise<number>((_, rej) => setTimeout(() => rej(new Error("ttft probe timeout")), 5000)),
          ]).catch(() => Date.now() - start) as number;
          try {
            await reader.cancel();
          } catch {}
          const { recordLatency } = await import("@/lib/routing/selector");
          const { recordProviderLatency } = await import("@/lib/fallback-state");
          recordLatency(pid, ttft, ttft, true);
          recordProviderLatency(pid, ttft, true);
          try {
            const { updateProviderRoutingStats } = await import("@/lib/providers-store");
            updateProviderRoutingStats(pid, ttft, ttft, true);
          } catch {}
        } catch (e: any) {
          console.warn(`[heartbeat-probe] ${pid} probe error: ${e?.message}`);
        }
      }, 10);
    }
  }

  const routingStat = getProviderStat(nodeId);
  const circuit = getProviderCircuitState(nodeId);

  return NextResponse.json(
    {
      ok: true,
      provider_id: stored.id,
      status: stored.status,
      verification: sanitizePublic(stored.verification),
      last_heartbeat: stored.last_heartbeat,
      heartbeat_count: stored.heartbeat_count,
      owner_bound: true,
      next: stored.verification.status === "pending" ? "gateway will auto-verify after 2 heartbeats (~60s); or POST /api/v1/providers/verify" : undefined,
      received_ip: ip,
      routing: routingStat || {
        ewmaTtft: (stored as any).ewmaTtft ?? null,
        ewmaLatency: (stored as any).ewmaLatency ?? null,
        concurrentRequests: (stored as any).concurrentRequests ?? 0,
      },
      circuit,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "application/json",
        "X-SeedInfer-Provider": nodeId,
      },
    }
  );
}
