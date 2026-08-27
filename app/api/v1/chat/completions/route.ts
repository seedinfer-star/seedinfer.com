import { NextResponse } from "next/server"
import { listProviders, type StoredProvider } from "@/lib/providers-store"
import {
  isCircuitOpen,
  isProviderCircuitOpen,
  recordSuccess,
  recordFailure,
  recordProviderLatency,
  incrementTotalRequests,
  incrementFallback,
} from "@/lib/fallback-state"
import { getUpstreamConfigs, mapModelForUpstream, buildUpstreamUrl, triggerModalWarmup } from "@/lib/fallback-clients"
import { selectProvider, getSortedProviders, recordLatency as recordRoutingLatency, incrementConcurrent, decrementConcurrent } from "@/lib/routing/selector"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS, GET",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-OpenRouter-Api-Key, X-OpenRouter-Key, HTTP-Referer, Referer, X-Title, X-OpenRouter-Title",
  "Access-Control-Max-Age": "86400",
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

function openAIError(
  message: string,
  type: string,
  code: string,
  status: number,
  extra?: Record<string, any>,
  upstreamHeaders?: Record<string, string>
) {
  const body: any = {
    error: {
      message,
      type,
      param: null,
      code,
      ...(extra ?? {}),
    },
  }
  return NextResponse.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/json",
      ...CORS_HEADERS,
      ...(upstreamHeaders ?? {}),
    },
  })
}

const CURL_EXAMPLE = `curl https://seedinfer.com/api/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $SEEDINFER_API_KEY" \\
  -d '{
    "model": "seedinfer/nemotron-lightning-1m",
    "messages": [{"role": "user", "content": "Explain private inference on RTX 5090 in one paragraph."}],
    "stream": false,
    "max_tokens": 512
  }'`

const TAILNET_EXAMPLE = `curl https://tailnet.seedinfer.com/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $SEEDINFER_API_KEY" \\
  -d '{
    "model": "seedinfer/nemotron-lightning-1m",
    "messages": [{"role": "user", "content": "Hello via Tailnet"}]
  }'`

// ---------------------------------------------------------------------------
// Provider URL helpers (Headscale 100.64.0.0/10)
// ---------------------------------------------------------------------------
function getProviderChatUrls(p: StoredProvider): string[] {
  const candidates: string[] = []
  if (p.tailscale_ip) { candidates.push(`http://${p.tailscale_ip}:47901/v1/chat/completions`); candidates.push(`http://${p.tailscale_ip}:3001/v1/chat/completions`); }
  if (p.agent_url) {
    let u = p.agent_url.replace(/\/$/, "")
    if (!u.startsWith("http")) u = `http://${u}`
    if (u.endsWith("/v1/chat/completions")) candidates.push(u)
    else if (u.endsWith(":47901") || u.endsWith(":3001")) candidates.push(`${u}/v1/chat/completions`)
    else if (u.includes(":47901")) candidates.push(u.replace(/\/$/, "") + "/v1/chat/completions")
    else if (u.includes(":3001")) candidates.push(u.replace(/\/$/, "") + "/v1/chat/completions")
    else candidates.push(`${u}/v1/chat/completions`)
  }
  const hn = (p as any).tailscale_hostname || p.host?.tailscale_hostname
  if (hn) { candidates.push(`http://${hn}.seedinfer.ts.net:47901/v1/chat/completions`); candidates.push(`http://${hn}.seedinfer.ts.net:3001/v1/chat/completions`); }
  return [...new Set(candidates)]
}

function getLocalChatUrl(): string | null {
  // env override takes precedence for dev
  const envUrl = process.env.VLLM_URL || process.env.LOCAL_VLLM_URL || process.env.SEEDINFER_VLLM_URL
  if (envUrl) {
    const base = envUrl.replace(/\/$/, "")
    if (base.endsWith("/chat/completions")) return base
    if (base.endsWith("/v1")) return `${base}/chat/completions`
    if (base.includes("/v1/chat")) return base
    if (base.includes(":") && !base.includes("/v1")) {
      return `${base}/v1/chat/completions`
    }
    return `${base}/v1/chat/completions`
  }
  // Use WRR selector instead of find verified-first
  const verified = listProviders().filter((p) => p.verification.status === "verified")
  if (verified.length === 0) return null
  const selected = selectProvider(verified)
  if (!selected) return null
  const urls = getProviderChatUrls(selected as StoredProvider)
  return urls[0] || null
}

function isOpenRouterTraffic(req: Request): boolean {
  const referer = req.headers.get("referer") || req.headers.get("http-referer") || req.headers.get("HTTP-Referer") || ""
  if (referer.toLowerCase().includes("openrouter.ai")) return true
  const origin = req.headers.get("origin") || ""
  if (origin.toLowerCase().includes("openrouter.ai")) return true
  // X-OpenRouter-* headers
  for (const [k] of (req.headers as any).entries()) {
    const lk = String(k).toLowerCase()
    if (lk.startsWith("x-openrouter-") || lk === "http-referer" || lk === "x-title") {
      if (lk.startsWith("x-openrouter-")) return true
    }
  }
  // also check authorization style? OpenRouter uses Bearer but not distinct
  // Check X-Title header containing openrouter? already
  // Fallback: check user-agent or custom header?
  const httpReferer = req.headers.get("http-referer") || req.headers.get("x-openrouter-referer")
  if (httpReferer && httpReferer.toLowerCase().includes("openrouter")) return true
  return false
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal } as any)
    return res
  } finally {
    clearTimeout(t)
  }
}

function isRetryableStatus(status: number): boolean {
  return status >= 500 || status === 429 || status === 502 || status === 503 || status === 504
}

export async function GET() {
  const localUrl = getLocalChatUrl()
  const configs = getUpstreamConfigs()
  const avail = configs.filter((c) => c.hasKey && c.baseUrl).map((c) => c.id)
  return openAIError(
    "Faza 0 - Nemotron na RTX 5090 via Tailnet, use https://tailnet.seedinfer.com, coming soon public endpoint. Use POST /api/v1/chat/completions with OpenAI-compatible payload.",
    "service_unavailable",
    "service_unavailable",
    503,
    {
      hint: "Faza 0 - Nemotron na RTX 5090 via Tailnet",
      tailnet_url: "https://tailnet.seedinfer.com",
      public_endpoint: "coming soon public endpoint",
      curl_example: CURL_EXAMPLE,
      local_provider: localUrl ? "available" : "unavailable",
      fallback_chain: ["local", "nim", "opencode", "openrouter", "modal"],
      fallback_available: avail,
      docs: "GET /api/v1/fallback/status for circuit state; GET /api/v1/routing/stats for WRR EWMA stats",
    }
  )
}

export async function POST(req: Request) {
  incrementTotalRequests()
  let body: any
  try {
    body = await req.json()
  } catch {
    return openAIError("Invalid JSON body", "invalid_request_error", "invalid_json", 400)
  }

  if (!body || typeof body !== "object") {
    return openAIError("Missing request body", "invalid_request_error", "missing_body", 400)
  }
  if (!body.model) {
    return openAIError("Missing 'model' in request body", "invalid_request_error", "missing_model", 400, {
      hint: `Use model "seedinfer/nemotron-lightning-1m". Example: ${CURL_EXAMPLE}`,
    })
  }

  const isStream = body.stream === true
  const incomingAuth = req.headers.get("authorization") || ""
  const isOpenRouter = isOpenRouterTraffic(req)

  // Thresholds
  const latencyThresholdMs = Number(process.env.FALLBACK_LATENCY_THRESHOLD_MS || 10_000)
  const upstreamConfigs = getUpstreamConfigs()

  // Build ordered attempt list with WRR for local providers
  type Attempt = {
    id: "local" | "nim" | "opencode" | "openrouter" | "modal"
    url: string
    apiKey: string | null
    timeoutMs: number
    model: string
    label: string
    headersExtra?: Record<string, string>
    providerId?: string
    provider?: StoredProvider
  }

  const attempts: Attempt[] = []

  // 1) local — WRR over verified providers (EWMA TTFT + load)
  const verifiedProviders = listProviders().filter((p) => p.verification.status === "verified")
  if (verifiedProviders.length > 0) {
     // getSortedProviders respects openRouter flag (ignor load)
    const sorted = getSortedProviders(verifiedProviders as any, { openRouter: isOpenRouter }) as StoredProvider[]
    const localCfg = upstreamConfigs.find((c) => c.id === "local")!
    for (const prov of sorted as StoredProvider[]) {
      if (isProviderCircuitOpen(prov.id)) {
        console.warn(`[chat] skip provider ${prov.id} circuit open (TTFT degrade or fails)`)
        continue
      }
      const urls = getProviderChatUrls(prov)
      const url = urls[0]
      if (!url) continue
      attempts.push({
        id: "local",
        providerId: prov.id,
        provider: prov,
        url,
        apiKey: null,
        timeoutMs: localCfg.timeoutMs,
        model: mapModelForUpstream(String(body.model), "local"),
        label: `${localCfg.label} ${prov.id}`,
      })
    }
    // If all local providers circuit open, fallback to fastest verified (ignore circuit) — najszybszy verified fallback
    if (attempts.length === 0 && verifiedProviders.length > 0) {
      // all circuit open → fallback na najszybszy verified (sort by EWMA TTFT)
      const fallbackSorted = [...verifiedProviders].sort((a, b) => {
        const at = (a as any).ewmaTtft ?? 99999
        const bt = (b as any).ewmaTtft ?? 99999
        return at - bt
      })
      const prov = fallbackSorted[0]
      const urls = getProviderChatUrls(prov)
      if (urls[0]) {
        console.warn(`[chat] all local providers circuit open, fallback to fastest verified ${prov.id} ttft=${(prov as any).ewmaTtft}`)
        attempts.push({
          id: "local",
          providerId: prov.id,
          provider: prov,
          url: urls[0],
          apiKey: null,
          timeoutMs: localCfg.timeoutMs,
          model: mapModelForUpstream(String(body.model), "local"),
          label: `${localCfg.label} ${prov.id} (fallback fastest)`,
        })
      }
    }
    // env VLLM_URL fallback if no provider but env set (dev)
    if (attempts.length === 0) {
      const envUrl = process.env.VLLM_URL || process.env.LOCAL_VLLM_URL || process.env.SEEDINFER_VLLM_URL
      if (envUrl) {
        const base = envUrl.replace(/\/$/, "")
        let chatUrl: string
        if (base.endsWith("/chat/completions")) chatUrl = base
        else if (base.endsWith("/v1")) chatUrl = `${base}/chat/completions`
        else if (base.includes("/v1/chat")) chatUrl = base
        else if (base.includes(":") && !base.includes("/v1")) chatUrl = `${base}/v1/chat/completions`
        else chatUrl = `${base}/v1/chat/completions`
        if (!isCircuitOpen("local")) {
          attempts.push({
            id: "local",
            url: chatUrl,
            apiKey: null,
            timeoutMs: localCfg.timeoutMs,
            model: mapModelForUpstream(String(body.model), "local"),
            label: localCfg.label + " (env)",
          })
        }
      }
    }
  } else {
    // No verified local providers — check env VLLM_URL as fallback local (legacy)
    const envUrl = process.env.VLLM_URL || process.env.LOCAL_VLLM_URL || process.env.SEEDINFER_VLLM_URL
    if (envUrl && !isCircuitOpen("local")) {
      const base = envUrl.replace(/\/$/, "")
      let chatUrl: string
      if (base.endsWith("/chat/completions")) chatUrl = base
      else if (base.endsWith("/v1")) chatUrl = `${base}/chat/completions`
      else if (base.includes("/v1/chat")) chatUrl = base
      else if (base.includes(":") && !base.includes("/v1")) chatUrl = `${base}/v1/chat/completions`
      else chatUrl = `${base}/v1/chat/completions`
      const localCfg = upstreamConfigs.find((c) => c.id === "local")!
      attempts.push({
        id: "local",
        url: chatUrl,
        apiKey: null,
        timeoutMs: localCfg.timeoutMs,
        model: mapModelForUpstream(String(body.model), "local"),
        label: localCfg.label + " (env)",
      })
    } else {
      console.log(`[chat] no verified local provider — skip to fallback (verified=${verifiedProviders.length}, openRouter=${isOpenRouter})`)
    }
  }

  // 2-5) remotes in order if hasKey and not circuit open and baseUrl present
  const order: Array<"nim" | "opencode" | "openrouter" | "modal"> = ["nim", "opencode", "openrouter", "modal"]
  for (const oid of order) {
    const cfg = upstreamConfigs.find((c) => c.id === oid)!
    if (!cfg.baseUrl) {
      console.log(`[chat] skip ${oid} no baseUrl`)
      continue
    }
    if (!cfg.hasKey && oid !== "modal") {
      console.log(`[chat] skip ${oid} no apiKey (${cfg.apiKeyEnv})`)
      continue
    }
    if (isCircuitOpen(oid)) {
      console.warn(`[chat] skip ${oid} circuit open`)
      continue
    }
    const chatUrl = buildUpstreamUrl(cfg.baseUrl!, cfg.chatPath)
    attempts.push({
      id: oid,
      url: chatUrl,
      apiKey: cfg.apiKey,
      timeoutMs: cfg.timeoutMs,
      model: cfg.model,
      label: cfg.label,
      headersExtra: cfg.headers,
    })
  }

  if (attempts.length === 0) {
    return openAIError(
      "All upstreams unavailable — no verified local provider and no fallback configured (missing API keys / base URLs).",
      "service_unavailable",
      "all_upstreams_down",
      503,
      { hint: "Try again or contact support. Check /api/v1/fallback/status and env NIM_API_KEY, OPENCODE_API_KEY, OPENROUTER_API_KEY, MODAL_BASE_URL." },
      {
        "X-SeedInfer-Upstream": "none",
        "X-SeedInfer-Fallback-Reason": "no_upstreams_configured",
      }
    )
  }

  // Modal warmup handling: fire-and-forget parallel gdy local fail (brak verified lub timeout/5xx/429)
  let modalWarmupTriggered = false
  const ensureModalWarmup = () => {
    if (modalWarmupTriggered) return
    modalWarmupTriggered = true
    triggerModalWarmup()
  }

  if (attempts.length > 0 && attempts[0].id !== "local") {
    ensureModalWarmup()
  }

  let lastError = ""
  let fallbackReason: string | null = null

  for (let idx = 0; idx < attempts.length; idx++) {
    const at = attempts[idx]
    const isFallback = idx > 0
    if (isFallback) incrementFallback()

    const mappedModel = at.model || mapModelForUpstream(String(body.model), at.id)
    const mappedBody = { ...body, model: mappedModel }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: isStream ? "text/event-stream" : "application/json",
    }
    if (at.id === "local") {
      if (incomingAuth) headers["Authorization"] = incomingAuth
    } else {
      if (at.apiKey) headers["Authorization"] = `Bearer ${at.apiKey}`
      if (at.headersExtra) Object.assign(headers, at.headersExtra)
    }

    const start = Date.now()
    const providerLog = at.providerId ? `local:${at.providerId}` : at.id
    console.log(`[chat] try ${providerLog} -> ${at.url} model=${mappedModel} stream=${isStream} timeout=${at.timeoutMs}ms openRouter=${isOpenRouter}`)

    // Track concurrent for local provider
    if (at.providerId) {
      try { incrementConcurrent(at.providerId) } catch {}
    }

    let ttft: number | null = null
    let totalLatency: number | null = null
    let shouldDecrementConcurrent = !!at.providerId

    try {
      const res = await fetchWithTimeout(at.url, {
        method: "POST",
        headers,
        body: JSON.stringify(mappedBody),
      }, at.timeoutMs)

      const afterHeaders = Date.now()
      const latency = afterHeaders - start
      console.log(`[chat] ${providerLog} responded ${res.status} latency=${latency}ms ct=${res.headers.get("content-type")}`)

      if (latency > latencyThresholdMs && isRetryableStatus(res.status) === false) {
        if (latency > latencyThresholdMs * 1.5) {
          console.warn(`[chat] ${providerLog} slow latency=${latency}ms > threshold=${latencyThresholdMs}ms`)
        }
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "")
        let json: any = null
        try { json = JSON.parse(text) } catch { json = null }
        const errMsg = json?.error?.message || text.slice(0, 300) || `HTTP ${res.status}`
        lastError = `${providerLog} HTTP ${res.status} ${errMsg.slice(0, 200)}`
        fallbackReason = lastError

        // record failure + TTFT degrade track
        if (at.providerId) {
          try {
            recordRoutingLatency(at.providerId, null, latency, false)
            recordProviderLatency(at.providerId, latency, false)
            recordFailure(at.providerId, lastError)
          } catch {}
          try { if (shouldDecrementConcurrent) { decrementConcurrent(at.providerId); shouldDecrementConcurrent = false } } catch {}
        }
        // also record for upstream id (for fallback stats)
        recordFailure(at.id, lastError)

        if (isRetryableStatus(res.status) || res.status === 401 || res.status === 403) {
          console.warn(`[chat] ${providerLog} retryable ${res.status} → fallback next (${errMsg.slice(0, 120)})`)
          if (at.id === "local") {
            ensureModalWarmup()
          }
          continue
        } else {
          const upstreamHeaders: Record<string, string> = {
            "X-SeedInfer-Upstream": at.providerId || at.id,
            "X-SeedInfer-Provider": at.providerId || at.id,
            "X-SeedInfer-Fallback-Reason": fallbackReason || "",
          }
          if (json && typeof json === "object" && (json as any).error) {
            return NextResponse.json(json, {
              status: res.status,
              headers: { "Cache-Control": "no-store, max-age=0", ...CORS_HEADERS, ...upstreamHeaders },
            })
          }
          return new NextResponse(text || JSON.stringify({ error: { message: errMsg, type: "upstream_error", code: String(res.status) } }), {
            status: res.status,
            headers: { "Content-Type": res.headers.get("content-type") || "application/json", "Cache-Control": "no-store, max-age=0", ...CORS_HEADERS, ...upstreamHeaders },
          })
        }
      }

      // Success path — measure TTFT
      const contentType = res.headers.get("content-type") || ""
      const isSSE = contentType.includes("text/event-stream") || isStream

      if (isSSE) {
        const stream = res.body
        if (!stream) {
          if (at.providerId && shouldDecrementConcurrent) { try { decrementConcurrent(at.providerId); shouldDecrementConcurrent = false } catch {} }
          throw new Error("empty stream from upstream")
        }
        // For SSE streaming: measure TTFT as time to first chunk (first token)
        // We need to read first chunk before sending headers so we can set X-SeedInfer-TTFT
        const reader = stream.getReader()
        let firstChunk: Uint8Array | null = null
        let firstChunkDone = false
        const ttftStart = start
        // Race with timeout for first token
        let firstReadError: any = null
        try {
          const race = await Promise.race([
            reader.read(),
            new Promise<ReadableStreamReadResult<Uint8Array>>((_, reject) => setTimeout(() => reject(new Error("TTFT timeout 30s")), 30_000)),
          ]) as ReadableStreamReadResult<Uint8Array>
          if (!race.done && race.value) {
            firstChunk = race.value
            ttft = Date.now() - ttftStart
          } else {
            firstChunkDone = !!race.done
            ttft = Date.now() - ttftStart
          }
        } catch (e: any) {
          firstReadError = e
          ttft = Date.now() - ttftStart
          console.warn(`[chat] ${providerLog} TTFT read fail: ${e?.message}`)
        }

        // If first chunk is empty/done, treat as error and fallback
        if (firstReadError || (firstChunkDone && !firstChunk)) {
          const errMsg = firstReadError?.message || "empty stream first chunk"
          lastError = `${providerLog} stream TTFT fail ${errMsg}`
          fallbackReason = lastError
          if (at.providerId) {
            try {
              recordRoutingLatency(at.providerId, ttft, ttft, false)
              recordProviderLatency(at.providerId, ttft, false)
              recordFailure(at.providerId, lastError)
              recordFailure(at.id, lastError)
            } catch {}
            try { if (shouldDecrementConcurrent) { decrementConcurrent(at.providerId); shouldDecrementConcurrent = false } } catch {}
          } else {
            recordFailure(at.id, lastError)
          }
          try { reader.cancel() } catch {}
          if (at.id === "local") ensureModalWarmup()
          continue
        }

        // ttft may be null if race timeout? use latency
        if (ttft === null) ttft = Date.now() - start
        totalLatency = ttft // initial, will be updated after stream ends; for header we use ttft

        // Record success routing latency (TTFT)
        if (at.providerId) {
          try {
            recordRoutingLatency(at.providerId, ttft, null, true)
            recordProviderLatency(at.providerId, ttft, true)
          } catch {}
        }
        recordSuccess(at.id)
        if (at.providerId) {
          try { recordSuccess(at.providerId) } catch {}
        }

        const upstreamHeaders: Record<string, string> = {
          "X-SeedInfer-Upstream": at.providerId || at.id,
          "X-SeedInfer-Provider": at.providerId || at.id,
          "X-SeedInfer-TTFT": String(ttft),
          "Server-Timing": `ttft;dur=${ttft}`,
          "X-SeedInfer-Fallback-Reason": fallbackReason || (isFallback ? `fallback from ${attempts[idx - 1]?.id}` : "local_ok"),
        }

        // Wrap stream to forward first chunk + rest, and track total latency + decrement concurrent on close
        const providerIdForStream = at.providerId
        let totalRecorded = false
        let streamClosed = false
        const wrappedStream = new ReadableStream<Uint8Array>({
          async start(controller) {
            try {
              if (firstChunk) controller.enqueue(firstChunk)
              while (true) {
                const { done, value } = await reader.read()
                if (done) break
                if (value) controller.enqueue(value)
              }
              controller.close()
            } catch (e: any) {
              console.warn(`[chat] ${providerLog} stream forward error: ${e?.message}`)
              try { controller.error(e) } catch {}
            } finally {
              streamClosed = true
              const totalMs = Date.now() - start
              totalLatency = totalMs
              if (providerIdForStream && !totalRecorded) {
                totalRecorded = true
                shouldDecrementConcurrent = false
                try {
                  // record total latency as second sample for EWMA latency (TTFT already recorded)
                  recordRoutingLatency(providerIdForStream, null, totalMs, true)
                  decrementConcurrent(providerIdForStream)
                  console.log(`[chat] stream complete ${providerIdForStream} ttft=${ttft}ms total=${totalMs}ms`)
                } catch {}
              }
            }
          },
          cancel() {
            try { reader.cancel() } catch {}
            if (providerIdForStream && !totalRecorded && !streamClosed) {
              totalRecorded = true
              shouldDecrementConcurrent = false
              try { decrementConcurrent(providerIdForStream) } catch {}
              try {
                const totalMs = Date.now() - start
                recordRoutingLatency(providerIdForStream, null, totalMs, true)
              } catch {}
            }
          },
        })

        console.log(`[chat] streaming via ${providerLog} ttft=${ttft}ms`)
        // prevent finally from decrementing — stream will decrement on close/cancel
        shouldDecrementConcurrent = false
        return new NextResponse(wrappedStream as any, {
          status: res.status,
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
            ...CORS_HEADERS,
            ...upstreamHeaders,
          },
        })
      }

      // Non-stream JSON passthrough
      const text = await res.text()
      totalLatency = Date.now() - start
      ttft = totalLatency // for non-stream TTFT == total
      let json: any
      try {
        json = JSON.parse(text)
      } catch {
        json = text
      }

      // record routing latency for both TTFT and total
      if (at.providerId) {
        try {
          recordRoutingLatency(at.providerId, ttft, totalLatency, true)
          recordProviderLatency(at.providerId, ttft, true)
          decrementConcurrent(at.providerId)
          shouldDecrementConcurrent = false
        } catch {}
      }
      recordSuccess(at.id)
      if (at.providerId) {
        try { recordSuccess(at.providerId) } catch {}
      }

      const upstreamHeaders: Record<string, string> = {
        "X-SeedInfer-Upstream": at.providerId || at.id,
        "X-SeedInfer-Provider": at.providerId || at.id,
        "X-SeedInfer-TTFT": String(ttft),
        "Server-Timing": `ttft;dur=${ttft};desc="ttft", total;dur=${totalLatency}`,
        "X-SeedInfer-Fallback-Reason": fallbackReason || (isFallback ? `fallback from ${attempts[idx - 1]?.id}` : "local_ok"),
      }

      if (typeof json === "object" && json !== null) {
        return NextResponse.json(json, {
          status: res.status,
          headers: { "Cache-Control": "no-store, max-age=0", ...CORS_HEADERS, ...upstreamHeaders },
        })
      }
      return new NextResponse(text, {
        status: res.status,
        headers: { "Content-Type": contentType || "application/json", "Cache-Control": "no-store, max-age=0", ...CORS_HEADERS, ...upstreamHeaders },
      })
    } catch (e: any) {
      const isAbort = e?.name === "AbortError" || String(e?.message || "").includes("abort") || String(e?.message || "").includes("timeout")
      const msg = isAbort ? `timeout after ${at.timeoutMs}ms` : String(e?.message || e).slice(0, 300)
      lastError = `${providerLog} ${msg}`
      fallbackReason = lastError
      // record failure
      if (at.providerId) {
        try {
          const failTtft = Date.now() - start
          recordRoutingLatency(at.providerId, failTtft, failTtft, false)
          recordProviderLatency(at.providerId, failTtft, false)
          recordFailure(at.providerId, lastError)
        } catch {}
        try { if (shouldDecrementConcurrent) { decrementConcurrent(at.providerId); shouldDecrementConcurrent = false } } catch {}
      }
      recordFailure(at.id, lastError)
      console.warn(`[chat] ${providerLog} fetch fail: ${msg} → fallback next`)

      if (at.id === "local") {
        ensureModalWarmup()
      }

      if (at.id === "modal" && isAbort) {
        console.warn(`[chat] modal cold start 2min, timeout ${at.timeoutMs}ms exceeded`)
      }

      continue
    } finally {
      // safety decrement if not already done and not streaming (streaming decremented on close)
      // For non-stream we already decremented; for error we decremented; for stream we will decrement on close, so skip here if stream path already handled?
      // We set shouldDecrementConcurrent false after handling. If still true (e.g., early error before stream), decrement.
      if (at.providerId && shouldDecrementConcurrent) {
        // Check if attempt was stream and we returned response — then not in finally of loop? Actually we returned already, so finally here not for stream return? For stream return we still have finally? But we already set shouldDecrementConcurrent false for stream? For non-stream we set false, so this is for unexpected path.
        // No-op to avoid double decrement for streaming (which decrements on stream close)
        const idxStillPending = !isStream // only decrement immediately for non-stream that didn't already
        if (idxStillPending) {
          try { decrementConcurrent(at.providerId) } catch {}
        }
      }
    }
  }

  const hint =
    lastError.includes("modal") && lastError.includes("timeout")
      ? "Modal A100 cold start ~2min — try again shortly or use NIM/OpenRouter"
      : "Try again or contact support"

  console.error(`[chat] all upstreams down lastError=${lastError}`)

  return openAIError(
    `All upstreams unavailable (${lastError || "no upstream succeeded"}).`,
    "service_unavailable",
    "all_upstreams_down",
    503,
    { hint, last_error: lastError, tried: attempts.map((a) => a.providerId || a.id) },
    {
      "X-SeedInfer-Upstream": "none",
      "X-SeedInfer-Fallback-Reason": fallbackReason || lastError || "all_failed",
    }
  )
}
