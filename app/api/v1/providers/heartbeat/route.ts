import { NextResponse } from "next/server"
import { upsertProvider, getProvider } from "@/lib/providers-store"
import { getProviderStat } from "@/lib/routing/selector"
import { getProviderCircuitState } from "@/lib/fallback-state"

export const dynamic = "force-dynamic"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

// helper to extract IP
function extractIp(req: Request): string | null {
  const h = (name: string) => req.headers.get(name)
  const xff = h("x-forwarded-for")
  if (xff) return xff.split(",")[0].trim()
  const real = h("x-real-ip")
  if (real) return real.trim()
  const cf = h("cf-connecting-ip")
  if (cf) return cf.trim()
  const t = h("x-tailscale-ip")
  if (t) return t.trim()
  return null
}

export async function POST(req: Request) {
  let payload: any
  try {
    payload = await req.json()
  } catch {
    return NextResponse.json(
      { error: { message: "Invalid JSON", type: "invalid_request_error", code: "invalid_json" } },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  if (!payload || typeof payload !== "object") {
    return NextResponse.json(
      { error: { message: "Missing payload", type: "invalid_request_error", code: "missing_payload" } },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  // Basic validation: require id
  if (!payload.id) {
    return NextResponse.json(
      { error: { message: "Missing provider id", type: "invalid_request_error", code: "missing_id" } },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  const ip = extractIp(req)

  // Use store helper — it handles pending->auto-verify after 2 heartbeats non-blocking
  const stored = upsertProvider(payload, { ip })

  // telemetry persist (non-blocking, lean JSONL)
  try {
    const { appendTelemetry, logHeartbeatTelemetry } = await import("@/lib/telemetry-store")
    // clear forceZero only when at least one verified provider exists (live data returns)
    // pending/failed heartbeats should keep zero-mode for demo (so /api/stats stays 0 after clear until verified)
    try {
      const { setForceZero, listProviders } = await import("@/lib/providers-store")
      const providers = listProviders()
      const verifiedCount = providers.filter((p) => p.verification.status === "verified").length
      if (verifiedCount > 0) {
        setForceZero(false)
        console.log(`[heartbeat] forceZero cleared — verified providers=${verifiedCount}`)
      } else {
        console.log(`[heartbeat] forceZero keep — no verified providers yet (pending/failed)`)
      }
    } catch {}
    logHeartbeatTelemetry(payload, { ip })
  } catch (e: any) {
    console.warn(`[heartbeat] telemetry log skip: ${e?.message || e}`)
  }

  const provider = getProvider(String(payload.id))

  // --- TTFT probe for verified providers (heartbeat-triggered, fire-and-forget) ---
  // Dla verified providerów mierzymy TTFT via streaming POST /v1/chat/completions ping
  // aby zaktualizować EWMA i wagę WRR. Nie blokuj odpowiedzi heartbeat.
  if (provider && provider.verification.status === "verified") {
    const pid = String(provider.id)
    // debounce: nie probe co heartbeat jeśli ostatni probe <30s
    const lastProbe = (globalThis as any).__seedinferLastProbe?.[pid]
    const now = Date.now()
    if (!lastProbe || now - lastProbe > 30_000) {
      if (!(globalThis as any).__seedinferLastProbe) (globalThis as any).__seedinferLastProbe = {}
      ;(globalThis as any).__seedinferLastProbe[pid] = now
      // fire-and-forget
      setTimeout(async () => {
        try {
          const urls: string[] = []
          if (provider.tailscale_ip) urls.push(`http://${provider.tailscale_ip}:47901/v1/chat/completions`)
          if (provider.agent_url) {
            let u = provider.agent_url.replace(/\/$/, "")
            if (!u.startsWith("http")) u = `http://${u}`
            if (u.endsWith("/v1/chat/completions")) urls.push(u)
            else if (u.includes(":47901") || u.includes(":3001")) urls.push(`${u}/v1/chat/completions`)
            else urls.push(`${u}/v1/chat/completions`)
          }
          const hn = (provider as any).tailscale_hostname || provider.host?.tailscale_hostname
          if (hn) urls.push(`http://${hn}.seedinfer.ts.net:47901/v1/chat/completions`)
          const uniq = [...new Set(urls)]
          if (uniq.length === 0) return
          const probeUrl = uniq[0]
          const modelId = "seedinfer/nemotron-lightning-1m"
          const start = Date.now()
          const ctrl = new AbortController()
          const t = setTimeout(() => ctrl.abort(), 6000)
          const res = await fetch(probeUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ model: modelId, messages: [{ role: "user", content: "ping" }], max_tokens: 5, temperature: 0, stream: true }),
            signal: ctrl.signal as any,
          }).catch(() => null as any)
          clearTimeout(t)
          if (!res || !res.ok || !res.body) {
            // fallback non-stream
            const lat = Date.now() - start
            const { recordLatency } = await import("@/lib/routing/selector")
            const { recordProviderLatency } = await import("@/lib/fallback-state")
            recordLatency(pid, lat, lat, false)
            recordProviderLatency(pid, lat, false)
            console.log(`[heartbeat-probe] ${pid} fail no body lat=${lat}ms url=${probeUrl}`)
            return
          }
          const reader = (res.body as ReadableStream<Uint8Array>).getReader()
          const ttft = await Promise.race([
            (async () => {
              const first = await reader.read()
              if (first.done) throw new Error("empty")
              return Date.now() - start
            })(),
            new Promise<number>((_, rej) => setTimeout(() => rej(new Error("ttft probe timeout")), 5000)),
          ]).catch(() => Date.now() - start) as number
          try { await reader.cancel() } catch {}
          const { recordLatency } = await import("@/lib/routing/selector")
          const { recordProviderLatency } = await import("@/lib/fallback-state")
          recordLatency(pid, ttft, ttft, true)
          recordProviderLatency(pid, ttft, true)
          // also update provider store EWMA denormalized
          try {
            const { updateProviderRoutingStats } = await import("@/lib/providers-store")
            updateProviderRoutingStats(pid, ttft, ttft, true)
          } catch {}
          console.log(`[heartbeat-probe] ${pid} TTFT ${ttft}ms via ${probeUrl}`)
        } catch (e: any) {
          console.warn(`[heartbeat-probe] ${pid} probe error: ${e?.message}`)
        }
      }, 10)
    }
  }

  const routingStat = getProviderStat(String(payload.id))
  const circuit = getProviderCircuitState(String(payload.id))

  return NextResponse.json(
    {
      ok: true,
      provider_id: stored.id,
      status: stored.status,
      verification: stored.verification,
      last_heartbeat: stored.last_heartbeat,
      heartbeat_count: stored.heartbeat_count,
      // hint for provider: should poll verify status
      next: stored.verification.status === "pending" ? "gateway will auto-verify after 2 heartbeats (~60s); or POST /api/v1/providers/verify" : undefined,
      received_ip: ip,
      routing: routingStat || { ewmaTtft: (stored as any).ewmaTtft ?? null, ewmaLatency: (stored as any).ewmaLatency ?? null, concurrentRequests: (stored as any).concurrentRequests ?? 0 },
      circuit,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        "Content-Type": "application/json",
        "X-SeedInfer-Provider": String(payload.id),
        ...CORS_HEADERS,
      },
    }
  )
}

export async function GET() {
  // Allow GET for debug: return usage
  return NextResponse.json(
    {
      message: "Use POST /api/v1/providers/heartbeat with Provider payload",
      example: {
        id: "provider-5090-xxx",
        chip: "GeForce RTX 5090",
        current_model: "seedinfer/nemotron-lightning-1m",
        vllm_health: { status: "ok" },
        gpu: { count: 1, devices: [{ name: "NVIDIA GeForce RTX 5090", memory_total_mb: 24576 }] },
      },
    },
    { headers: CORS_HEADERS }
  )
}
