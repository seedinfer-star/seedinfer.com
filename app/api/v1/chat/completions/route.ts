import { NextResponse } from "next/server"
import { API_BASE_URL, LIVE_MODEL } from "@/lib/catalog"
import { listProviders, type StoredProvider } from "@/lib/providers-store"
import { getUpstreamConfigs, mapModelForUpstream, buildUpstreamUrl, triggerModalWarmup } from "@/lib/fallback-clients"
import {
  filterRoutable,
  getStats,
  getMaxKvTokens,
  getSafeMaxConcurrency,
  type RoutableCandidate,
} from "@/lib/routing/selector"
import {
  recordNodeOutcome,
  getNodeSnapshot,
} from "@/lib/routing/node-health"
import { acquireLease, leaseCount } from "@/lib/routing/lease"
import { resolveNodeChatUrl } from "@/lib/routing/node-targets"
import {
  hashPrincipal,
  lookupAffinity,
  recordAffinity,
  decideAffinity,
} from "@/lib/routing/affinity"
import { postToNode } from "@/lib/routing/upstream-http"
import { scanUsageFromText } from "@/lib/routing/sse"
import { getClientIp } from "@/lib/rate-limit"
import { scrubString } from "@/lib/public-sanitize"

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

const CURL_EXAMPLE = `curl ${API_BASE_URL}/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $SEEDINFER_API_KEY" \\
  -d '{
    "model": "${LIVE_MODEL.id}",
    "messages": [{"role": "user", "content": "Explain P2P inference on RTX 5090 in one paragraph."}],
    "stream": false,
    "max_tokens": 512
  }'`

const MAX_BODY_BYTES = 8 * 1024 * 1024
const ROUTING_MAX_LOCAL_ATTEMPTS = 2

function numEnv(key: string, def: number): number {
  const raw = process.env[key]
  if (raw === undefined || raw === null || String(raw).trim() === "") return def
  const n = Number(String(raw).trim())
  if (!Number.isFinite(n) || n <= 0) return def
  return Math.floor(n)
}

function affinityMinTokens(): number {
  return numEnv("AFFINITY_MIN_TOKENS", 8192)
}

function estimatePromptTokens(body: any): number {
  try {
    let chars = 0
    const messages = Array.isArray(body?.messages) ? body.messages : null
    if (messages) {
      for (const m of messages) {
        const c = (m as any)?.content
        if (typeof c === "string") {
          chars += c.length
        } else if (Array.isArray(c)) {
          for (const part of c) {
            if (typeof part === "string") chars += part.length
            else if (part && typeof part === "object" && part.type === "text" && typeof part.text === "string") {
              chars += part.text.length
            }
          }
        } else if (c !== undefined && c !== null) {
          try { chars += JSON.stringify(c).length } catch {}
        }
        const tcs = (m as any)?.tool_calls
        if (Array.isArray(tcs)) {
          for (const tc of tcs) {
            try {
              const args = (tc as any)?.function?.arguments
              if (typeof args === "string") chars += args.length
              else if (args !== undefined) chars += JSON.stringify(args).length
            } catch {}
          }
        }
      }
      try { chars += JSON.stringify(body?.tools || []).length } catch {}
      return Math.ceil(chars / 3.6) + 8 * messages.length
    }
    if (typeof body?.prompt === "string") {
      chars = body.prompt.length
      try { chars += JSON.stringify(body?.tools || []).length } catch {}
      return Math.ceil(chars / 3.6) + 8
    }
    try { chars += JSON.stringify(body?.tools || []).length } catch {}
    return Math.ceil(chars / 3.6) + 8
  } catch {
    return 1000
  }
}

function pickP2C(cands: RoutableCandidate[]): RoutableCandidate {
  if (cands.length === 1) return cands[0]
  const n = cands.length
  const i1 = Math.floor(Math.random() * n) % n
  let i2 = Math.floor(Math.random() * n) % n
  if (i2 === i1) i2 = (i1 + 1) % n
  const a = cands[i1]
  const b = cands[i2]
  const ra = a.inFlight / Math.max(1, a.safeMax)
  const rb = b.inFlight / Math.max(1, b.safeMax)
  if (ra < rb) return a
  if (rb < ra) return b
  const ta = a.ttft ?? 400
  const tb = b.ttft ?? 400
  if (ta < tb) return a
  if (tb < ta) return b
  return Math.random() < 0.5 ? a : b
}

function parseRetryAfterMs(v: string | null): number | null {
  if (!v) return null
  const s = String(v).trim()
  if (/^\d+$/.test(s)) return Number(s) * 1000
  const t = Date.parse(s)
  if (Number.isFinite(t)) return Math.max(0, t - Date.now())
  return null
}

function innerErrorCode(parsed: any): number | null {
  try {
    const c = parsed?.error?.code ?? parsed?.code
    if (typeof c === "number" && Number.isInteger(c)) return c
    if (typeof c === "string" && /^\d+$/.test(c.trim())) return Number(c.trim())
  } catch {}
  return null
}

function localEnvChatUrl(): string | null {
  const envUrl = process.env.VLLM_URL || process.env.LOCAL_VLLM_URL || process.env.SEEDINFER_VLLM_URL
  if (!envUrl) return null
  const base = envUrl.replace(/\/$/, "")
  if (base.endsWith("/chat/completions")) return base
  if (base.endsWith("/v1")) return `${base}/chat/completions`
  if (base.includes("/v1/chat")) return base
  if (base.includes(":") && !base.includes("/v1")) return `${base}/v1/chat/completions`
  return `${base}/v1/chat/completions`
}

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal } as any)
    return res
  } finally {
    clearTimeout(t)
  }
}

export async function GET() {
  const configs = getUpstreamConfigs()
  const avail = configs.filter((c) => c.hasKey && c.baseUrl).map((c) => c.id)
  return openAIError(
    `Use POST ${API_BASE_URL}/chat/completions with an OpenAI-compatible payload (model "${LIVE_MODEL.id}").`,
    "invalid_request_error",
    "method_not_allowed",
    405,
    {
      hint: `POST ${API_BASE_URL}/chat/completions`,
      curl_example: CURL_EXAMPLE,
      fallback_chain: ["local"],
      paid_fallback: "off by default — set ROUTING_PAID_FALLBACK=1 to enable remote chain (nim, opencode, openrouter, modal)",
      remote_chain_off_by_default: true,
      fallback_available: avail,
      docs: "GET /api/v1/fallback/status for circuit state; GET /api/v1/routing/stats for WRR EWMA stats",
    }
  )
}

export async function POST(req: Request) {
  // ---- body parse with 8MB cap ----
  const clRaw = req.headers.get("content-length")
  if (clRaw !== null && clRaw.trim() !== "") {
    const cl = Number(clRaw.trim())
    if (Number.isFinite(cl) && cl > MAX_BODY_BYTES) {
      return openAIError("Request body too large (max 8MB)", "invalid_request_error", "body_too_large", 413)
    }
  }
  let rawText: string
  try {
    rawText = await req.text()
  } catch {
    return openAIError("Invalid JSON body", "invalid_request_error", "invalid_json", 400)
  }
  try {
    if (Buffer.byteLength(rawText || "", "utf8") > MAX_BODY_BYTES) {
      return openAIError("Request body too large (max 8MB)", "invalid_request_error", "body_too_large", 413)
    }
  } catch {}
  let body: any
  try {
    body = JSON.parse(rawText)
  } catch {
    return openAIError("Invalid JSON body", "invalid_request_error", "invalid_json", 400)
  }

  if (!body || typeof body !== "object") {
    return openAIError("Missing request body", "invalid_request_error", "missing_body", 400)
  }
  if (!body.model) {
    return openAIError("Missing 'model' in request body", "invalid_request_error", "missing_model", 400, {
      hint: `Use model "${LIVE_MODEL.id}". Example: ${CURL_EXAMPLE}`,
    })
  }
  if (!Array.isArray(body.messages) && typeof body.prompt !== "string") {
    return openAIError("Missing 'messages' array or 'prompt' string", "invalid_request_error", "missing_messages", 400)
  }

  const isStream = body.stream === true
  const incomingAuth = req.headers.get("authorization") || ""
  const rawToken = incomingAuth.replace(/^Bearer\s+/i, "").trim()

  // ---- sanitize forward body ----
  const forwardBody: any = { ...body }
  delete forwardBody.priority
  delete forwardBody.kv_transfer_params
  delete forwardBody.vllm_xargs
  const forwardText = JSON.stringify(forwardBody)

  const est = estimatePromptTokens(body)

  // ---- affinity ----
  let principal: string
  try {
    principal = rawToken ? hashPrincipal(rawToken) : `ip:${getClientIp(req)}`
  } catch {
    principal = rawToken ? hashPrincipal(rawToken) : "ip:unknown"
  }
  const sessionId =
    req.headers.get("x-session-id") ||
    req.headers.get("x-conversation-id") ||
    (body as any).session_id ||
    (body as any).conversation_id ||
    null
  const affinityKey = `${principal}:${sessionId || "nosess"}`
  let affinityReason = "below_threshold"
  let stickPid: string | null = null
  if (est >= affinityMinTokens()) {
    try {
      const rec = lookupAffinity(affinityKey)
      if (!rec) {
        affinityReason = "no_record"
      } else {
        const prov = listProviders().find((p) => p.id === rec.nodeId) as StoredProvider | undefined
        if (!prov) {
          affinityReason = "no_record"
        } else {
          const P = getMaxKvTokens(prov as any)
          let processedNow = 0
          try { processedNow = getNodeSnapshot(rec.nodeId).totalProcessedTokens || 0 } catch { processedNow = 0 }
          let activeNow = 0
          try {
            const st = (getStats() as Record<string, any>)[rec.nodeId]
            activeNow = Number(st?.activeKvTokens ?? st?.activeTokens ?? 0) || 0
          } catch { activeNow = 0 }
          const dec = decideAffinity({
            key: affinityKey,
            incomingPromptTokens: est,
            poolP: P,
            processedNow,
            activeNow,
            record: rec,
          })
          affinityReason = dec.reason
          if (dec.stick) stickPid = rec.nodeId
        }
      }
    } catch {
      affinityReason = "no_record"
      stickPid = null
    }
  }
  const affinityHeader = stickPid ? "hit" : `miss:${affinityReason}`

  // ---- timeouts ----
  const ttftBudgetMs = Math.min(120000, 8000 + est / 2000)
  const idleTimeoutMs = numEnv("ROUTING_STREAM_IDLE_MS", 60000)
  const totalTimeoutMs = numEnv("ROUTING_TOTAL_TIMEOUT_MS", 90000)

  const tried = new Set<string>()
  let attemptsMade = 0
  let lastError = ""
  let fallbackReason: string | null = null
  let lastRetryAfterSec = 2

  const baseHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: isStream ? "text/event-stream" : "application/json",
  }

  for (let attemptIdx = 0; attemptIdx < ROUTING_MAX_LOCAL_ATTEMPTS; attemptIdx++) {
    let cands: RoutableCandidate[] = []
    try {
      cands = filterRoutable(listProviders() as any, { incomingTokens: est, exclude: tried })
    } catch { cands = [] }
    // minus tried (filterRoutable already excludes, double-guard)
    cands = cands.filter((c) => !tried.has(String((c.provider as any).id)))
    if (cands.length === 0) break

    let chosen: RoutableCandidate | null = null
    if (stickPid && attemptIdx === 0) {
      const hit = cands.find((c) => String((c.provider as any).id) === stickPid)
      if (hit) chosen = hit
    }
    if (!chosen) chosen = pickP2C(cands)
    if (!chosen) break

    const provider = chosen.provider as StoredProvider
    const pid = String((provider as any).id)
    tried.add(pid)

    let url: string | null = null
    try {
      url = resolveNodeChatUrl(provider as any)
    } catch { url = null }
    if (!url) {
      lastError = `${pid} no routable url`
      fallbackReason = lastError
      continue
    }

    const lease = acquireLease(pid, est)
    const upstreamCtrl = new AbortController()
    const onClientAbortPre = () => { try { upstreamCtrl.abort() } catch {} }
    let preAborted = false
    try {
      if (req.signal) {
        if (req.signal.aborted) { preAborted = true; upstreamCtrl.abort() }
        else req.signal.addEventListener("abort", onClientAbortPre, { once: true })
      }
    } catch {}
    const start = Date.now()
    attemptsMade += 1

    let result: Awaited<ReturnType<typeof postToNode>>
    try {
      result = await postToNode({
        url,
        body: forwardText,
        headers: { ...baseHeaders },
        signal: upstreamCtrl.signal,
        expectStream: isStream,
        ttftBudgetMs,
        idleTimeoutMs,
        totalTimeoutMs,
      })
    } catch (e: any) {
      try { req.signal?.removeEventListener("abort", onClientAbortPre) } catch {}
      try { lease.release() } catch {}
      const msg = String(e?.message || e).slice(0, 200)
      lastError = `${pid} ${msg}`
      fallbackReason = lastError
      try { recordNodeOutcome(pid, { kind: "connect", error: msg }) } catch {}
      continue
    }
    try { req.signal?.removeEventListener("abort", onClientAbortPre) } catch {}

    if (preAborted || upstreamCtrl.signal.aborted) {
      try { lease.release() } catch {}
      try { recordNodeOutcome(pid, { kind: "aborted" }) } catch {}
      return openAIError("Client closed request", "service_unavailable", "client_aborted", 499, {}, {
        "X-SeedInfer-Upstream": pid,
        "X-SeedInfer-Attempts": String(attemptsMade),
        "X-SeedInfer-Affinity": affinityHeader,
      })
    }

    if (!result.ok) {
      const kind = (result as any).kind as string
      if (kind === "aborted") {
        try { lease.release() } catch {}
        try { recordNodeOutcome(pid, { kind: "aborted" }) } catch {}
        if (req.signal?.aborted) {
          return openAIError("Client closed request", "service_unavailable", "client_aborted", 499, {}, {
            "X-SeedInfer-Upstream": pid,
            "X-SeedInfer-Attempts": String(attemptsMade),
            "X-SeedInfer-Affinity": affinityHeader,
          })
        }
        lastError = `${pid} aborted`
        fallbackReason = lastError
        continue
      }
      if (kind === "connect") {
        const msg = String((result as any).error || "connect failed").slice(0, 200)
        try { lease.release() } catch {}
        try { recordNodeOutcome(pid, { kind: "connect", error: msg }) } catch {}
        lastError = `${pid} ${msg}`
        fallbackReason = lastError
        continue
      }
      if (kind === "timeout_ttft" || kind === "timeout_idle" || kind === "timeout_total") {
        const msg = String((result as any).error || kind).slice(0, 200)
        try { lease.release() } catch {}
        try { recordNodeOutcome(pid, { kind: "timeout", error: msg }) } catch {}
        lastError = `${pid} ${msg}`
        fallbackReason = lastError
        continue
      }
      if (kind === "http") {
        const status = Number((result as any).status || 0)
        const bodyText = String((result as any).bodyText || "")
        if (status === 429) {
          try { lease.release() } catch {}
          try { recordNodeOutcome(pid, { kind: "saturated", retryAfterMs: 2000, error: bodyText.slice(0, 200) }) } catch {}
          lastError = `${pid} HTTP 429 saturated`
          fallbackReason = lastError
          continue
        }
        if (status === 400 || status === 413 || status === 422) {
          const reason = scrubString(bodyText.slice(0, 500) || `HTTP ${status}`)
          try { lease.release() } catch {}
          try { recordNodeOutcome(pid, { kind: "client_error", error: reason }) } catch {}
          let parsed: any = null
          try { parsed = JSON.parse(bodyText) } catch { parsed = null }
          if (parsed && typeof parsed === "object" && (parsed as any).error) {
            return NextResponse.json(parsed, {
              status,
              headers: {
                "Cache-Control": "no-store, max-age=0",
                ...CORS_HEADERS,
                "X-SeedInfer-Upstream": pid,
                "X-SeedInfer-Provider": pid,
                "X-SeedInfer-Attempts": String(attemptsMade),
                "X-SeedInfer-Affinity": affinityHeader,
                "X-SeedInfer-Fallback-Reason": scrubString(fallbackReason || "local_ok"),
              },
            })
          }
          return new NextResponse(bodyText || JSON.stringify({ error: { message: reason, type: "invalid_request_error", code: status } }), {
            status,
            headers: {
              "Content-Type": "application/json",
              "Cache-Control": "no-store, max-age=0",
              ...CORS_HEADERS,
              "X-SeedInfer-Upstream": pid,
              "X-SeedInfer-Provider": pid,
              "X-SeedInfer-Attempts": String(attemptsMade),
              "X-SeedInfer-Affinity": affinityHeader,
              "X-SeedInfer-Fallback-Reason": scrubString(fallbackReason || "local_ok"),
            },
          })
        }
        const msg = scrubString(bodyText.slice(0, 200) || `HTTP ${status}`)
        try { lease.release() } catch {}
        try {
          if (status >= 500) recordNodeOutcome(pid, { kind: "http5xx", error: msg })
          else recordNodeOutcome(pid, { kind: "bad_response", error: msg })
        } catch {}
        lastError = `${pid} HTTP ${status} ${msg}`
        fallbackReason = lastError
        continue
      }
      const msg = String((result as any).error || kind || "upstream failed").slice(0, 200)
      try { lease.release() } catch {}
      try { recordNodeOutcome(pid, { kind: "bad_response", error: msg }) } catch {}
      lastError = `${pid} ${msg}`
      fallbackReason = lastError
      continue
    }

    // ---- ok ----
    const ttftMs = typeof result.ttftMs === "number" && Number.isFinite(result.ttftMs) ? result.ttftMs : Date.now() - start

    if (isStream) {
      const iter = result.stream[Symbol.asyncIterator]()
      let first: IteratorResult<Buffer>
      try {
        first = await iter.next()
      } catch (e: any) {
        try { result.abort() } catch {}
        try { lease.release() } catch {}
        const msg = String(e?.message || "stream first chunk failed").slice(0, 200)
        try { recordNodeOutcome(pid, { kind: "stream_fail", error: msg }) } catch {}
        lastError = `${pid} ${msg}`
        fallbackReason = lastError
        continue
      }
      if (first.done) {
        try { result.abort() } catch {}
        try { lease.release() } catch {}
        try { recordNodeOutcome(pid, { kind: "bad_response", error: "empty stream" }) } catch {}
        lastError = `${pid} empty stream`
        fallbackReason = lastError
        continue
      }
      const firstBuf = Buffer.isBuffer(first.value) ? first.value : Buffer.from(first.value as any)
      const firstText = firstBuf.toString("utf8")
      const trimmed = firstText.trim()
      if (trimmed.startsWith("{")) {
        let parsed: any = null
        try { parsed = JSON.parse(trimmed) } catch { parsed = null }
        if (parsed && typeof parsed === "object" && (parsed as any).error) {
          const codeNum = innerErrorCode(parsed)
          if (codeNum === 400 || codeNum === 413 || codeNum === 422) {
            const reason = scrubString(String((parsed as any).error?.message || "bad request").slice(0, 500))
            try { result.abort() } catch {}
            try { lease.release() } catch {}
            try { recordNodeOutcome(pid, { kind: "client_error", error: reason }) } catch {}
            const outBody = { error: { message: reason, type: "invalid_request_error", param: null, code: codeNum } }
            return NextResponse.json(outBody, {
              status: codeNum,
              headers: {
                "Cache-Control": "no-store, max-age=0",
                ...CORS_HEADERS,
                "X-SeedInfer-Upstream": pid,
                "X-SeedInfer-Provider": pid,
                "X-SeedInfer-Attempts": String(attemptsMade),
                "X-SeedInfer-Affinity": affinityHeader,
                "X-SeedInfer-Fallback-Reason": scrubString(fallbackReason || "local_ok"),
              },
            })
          }
          try { result.abort() } catch {}
          try { lease.release() } catch {}
          try { recordNodeOutcome(pid, { kind: "bad_response", error: scrubString(trimmed.slice(0, 200)) }) } catch {}
          lastError = `${pid} upstream error json`
          fallbackReason = lastError
          continue
        }
      }

      // pull-based forward
      let seenText = firstText
      let finalized = false
      const doFinalizeOk = () => {
        if (finalized) return
        finalized = true
        try { req.signal?.removeEventListener("abort", onAbortStream) } catch {}
        const totalMs = Date.now() - start
        const usage = scanUsageFromText(seenText)
        const promptToks = usage?.prompt_tokens ?? est
        const compToks = usage?.completion_tokens ?? 0
        try { lease.release() } catch {}
        try { recordNodeOutcome(pid, { kind: "ok", ttftMs, totalMs, promptTokens: promptToks, completionTokens: compToks }) } catch {}
        let processedAfter = 0
        try { processedAfter = getNodeSnapshot(pid).totalProcessedTokens || 0 } catch {}
        try { recordAffinity(affinityKey, pid, processedAfter, promptToks + compToks) } catch {}
      }
      const doFinalizeFail = (msg: string) => {
        if (finalized) return
        finalized = true
        try { req.signal?.removeEventListener("abort", onAbortStream) } catch {}
        try { lease.release() } catch {}
        try { recordNodeOutcome(pid, { kind: "stream_fail", error: msg.slice(0, 200) }) } catch {}
      }
      const doFinalizeAbort = () => {
        if (finalized) return
        finalized = true
        try { lease.release() } catch {}
        try { recordNodeOutcome(pid, { kind: "aborted" }) } catch {}
      }
      const onAbortStream = () => {
        try { result.abort() } catch {}
        try { upstreamCtrl.abort() } catch {}
        doFinalizeAbort()
      }
      try {
        if (req.signal) {
          if (req.signal.aborted) onAbortStream()
          else req.signal.addEventListener("abort", onAbortStream, { once: true })
        }
      } catch {}

      const upstreamHeaders: Record<string, string> = {
        "X-SeedInfer-Upstream": pid,
        "X-SeedInfer-Provider": pid,
        "X-SeedInfer-TTFT": String(ttftMs),
        "Server-Timing": `ttft;dur=${ttftMs}`,
        "X-SeedInfer-Fallback-Reason": scrubString(fallbackReason || "local_ok"),
        "X-SeedInfer-Attempts": String(attemptsMade),
        "X-SeedInfer-Affinity": affinityHeader,
      }

      const wrapped = new ReadableStream<Uint8Array>({
        start(controller) {
          try { controller.enqueue(new Uint8Array(firstBuf)) } catch {}
        },
        async pull(controller) {
          if ((finalized as boolean)) return
          try {
            const nxt = await iter.next()
            if (nxt.done) {
              doFinalizeOk()
              try { controller.close() } catch {}
              return
            }
            const buf = Buffer.isBuffer(nxt.value) ? nxt.value : Buffer.from(nxt.value as any)
            try { seenText += buf.toString("utf8") } catch {}
            try { controller.enqueue(new Uint8Array(buf)) } catch {}
          } catch (e: any) {
            const msg = String(e?.message || "stream failed").slice(0, 200)
            doFinalizeFail(msg)
            try { controller.error(e) } catch { try { controller.close() } catch {} }
          }
        },
        cancel() {
          try { result.abort() } catch {}
          doFinalizeAbort()
        },
      })

      return new NextResponse(wrapped as any, {
        status: result.status || 200,
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

    // ---- non-stream ok: collect full body ----
    const chunks: Buffer[] = []
    try {
      for await (const c of result.stream) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c as any))
    } catch (e: any) {
      try { result.abort() } catch {}
      try { lease.release() } catch {}
      const msg = String(e?.message || "body read failed").slice(0, 200)
      try { recordNodeOutcome(pid, { kind: "stream_fail", error: msg }) } catch {}
      lastError = `${pid} ${msg}`
      fallbackReason = lastError
      continue
    }
    const totalMs = Date.now() - start
    const text = Buffer.concat(chunks).toString("utf8")
    let json: any = null
    try { json = JSON.parse(text) } catch { json = null }
    if (json === null) {
      try { lease.release() } catch {}
      try { recordNodeOutcome(pid, { kind: "bad_response", error: "invalid json" }) } catch {}
      lastError = `${pid} invalid json`
      fallbackReason = lastError
      continue
    }
    if (json && typeof json === "object" && (json as any).error) {
      const codeNum = innerErrorCode(json)
      if (codeNum === 400 || codeNum === 413 || codeNum === 422) {
        const reason = scrubString(String((json as any).error?.message || "bad request").slice(0, 500))
        try { lease.release() } catch {}
        try { recordNodeOutcome(pid, { kind: "client_error", error: reason }) } catch {}
        return NextResponse.json(json, {
          status: codeNum,
          headers: {
            "Cache-Control": "no-store, max-age=0",
            ...CORS_HEADERS,
            "X-SeedInfer-Upstream": pid,
            "X-SeedInfer-Provider": pid,
            "X-SeedInfer-Attempts": String(attemptsMade),
            "X-SeedInfer-Affinity": affinityHeader,
            "X-SeedInfer-Fallback-Reason": scrubString(fallbackReason || "local_ok"),
          },
        })
      }
      if (codeNum === 429) {
        try { lease.release() } catch {}
        try { recordNodeOutcome(pid, { kind: "saturated", retryAfterMs: 2000, error: "saturated" }) } catch {}
        lastError = `${pid} HTTP 429 saturated`
        fallbackReason = lastError
        continue
      }
      try { lease.release() } catch {}
      try { recordNodeOutcome(pid, { kind: "bad_response", error: scrubString(JSON.stringify((json as any).error).slice(0, 200)) }) } catch {}
      lastError = `${pid} upstream error json`
      fallbackReason = lastError
      continue
    }
    const usage = (json as any)?.usage
    const promptToks = Number(usage?.prompt_tokens) || est
    const compToks = Number(usage?.completion_tokens) || 0
    try { lease.release() } catch {}
    try { recordNodeOutcome(pid, { kind: "ok", totalMs, promptTokens: promptToks, completionTokens: compToks }) } catch {}
    let processedAfter = 0
    try { processedAfter = getNodeSnapshot(pid).totalProcessedTokens || 0 } catch {}
    try { recordAffinity(affinityKey, pid, processedAfter, promptToks + compToks) } catch {}
    try { req.signal?.removeEventListener("abort", onClientAbortPre) } catch {}

    return NextResponse.json(json, {
      status: result.status || 200,
      headers: {
        "Cache-Control": "no-store, max-age=0",
        ...CORS_HEADERS,
        "X-SeedInfer-Upstream": pid,
        "X-SeedInfer-Provider": pid,
        "X-SeedInfer-TTFT": String(totalMs),
        "Server-Timing": `total;dur=${totalMs}`,
        "X-SeedInfer-Fallback-Reason": scrubString(fallbackReason || "local_ok"),
        "X-SeedInfer-Attempts": String(attemptsMade),
        "X-SeedInfer-Affinity": affinityHeader,
      },
    })
  }

  // ---- dev env pseudo-node (no lease) when no providers AND env set ----
  try {
    if (listProviders().length === 0) {
      const envUrl = localEnvChatUrl()
      if (envUrl) {
        const upstreamCtrl = new AbortController()
        try {
          if (req.signal) {
            if (req.signal.aborted) upstreamCtrl.abort()
            else req.signal.addEventListener("abort", () => { try { upstreamCtrl.abort() } catch {} }, { once: true })
          }
        } catch {}
        const start = Date.now()
        try {
          const r = await postToNode({
            url: envUrl,
            body: forwardText,
            headers: { ...baseHeaders },
            signal: upstreamCtrl.signal,
            expectStream: isStream,
            ttftBudgetMs,
            idleTimeoutMs,
            totalTimeoutMs,
          })
          if (r.ok) {
            if (isStream) {
              const iter = r.stream[Symbol.asyncIterator]()
              const first = await iter.next()
              if (!first.done) {
                const firstBuf = Buffer.isBuffer(first.value) ? first.value : Buffer.from(first.value as any)
                const s = new ReadableStream<Uint8Array>({
                  start(c) { try { c.enqueue(new Uint8Array(firstBuf)) } catch {} },
                  async pull(c) {
                    try {
                      const n = await iter.next()
                      if (n.done) { try { c.close() } catch {} return }
                      const b = Buffer.isBuffer(n.value) ? n.value : Buffer.from(n.value as any)
                      try { c.enqueue(new Uint8Array(b)) } catch {}
                    } catch (e) { try { c.error(e) } catch {} }
                  },
                  cancel() { try { r.abort() } catch {} },
                })
                return new NextResponse(s as any, {
                  status: r.status || 200,
                  headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", ...CORS_HEADERS, "X-SeedInfer-Upstream": "local-env", "X-SeedInfer-Provider": "local-env", "X-SeedInfer-TTFT": String(r.ttftMs ?? Date.now() - start), "X-SeedInfer-Attempts": "1", "X-SeedInfer-Affinity": affinityHeader },
                })
              }
            } else {
              const parts: Buffer[] = []
              for await (const c of r.stream) parts.push(Buffer.isBuffer(c) ? c : Buffer.from(c as any))
              const t = Buffer.concat(parts).toString("utf8")
              try {
                const j = JSON.parse(t)
                return NextResponse.json(j, { status: r.status || 200, headers: { "Cache-Control": "no-store, max-age=0", ...CORS_HEADERS, "X-SeedInfer-Upstream": "local-env", "X-SeedInfer-Attempts": "1", "X-SeedInfer-Affinity": affinityHeader } })
              } catch {
                return new NextResponse(t, { status: r.status || 200, headers: { "Content-Type": "application/json", ...CORS_HEADERS, "X-SeedInfer-Upstream": "local-env", "X-SeedInfer-Attempts": "1", "X-SeedInfer-Affinity": affinityHeader } })
              }
            }
          }
        } catch {}
      }
    }
  } catch {}

  // ---- paid remote chain ONLY when explicitly enabled ----
  if (process.env.ROUTING_PAID_FALLBACK === "1") {
    try { triggerModalWarmup() } catch {}
    try {
      const upstreamConfigs = getUpstreamConfigs()
      const order: Array<"nim" | "opencode" | "openrouter" | "modal"> = ["nim", "opencode", "openrouter", "modal"]
      for (const oid of order) {
        const cfg = upstreamConfigs.find((c) => c.id === oid)
        if (!cfg || !cfg.baseUrl) continue
        if (!cfg.hasKey && oid !== "modal") continue
        const chatUrl = buildUpstreamUrl(cfg.baseUrl!, cfg.chatPath)
        const mappedBody = { ...forwardBody, model: cfg.model || mapModelForUpstream(String(body.model), oid) }
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Accept: isStream ? "text/event-stream" : "application/json",
        }
        if (cfg.apiKey) headers["Authorization"] = `Bearer ${cfg.apiKey}`
        if ((cfg as any).headers) Object.assign(headers, (cfg as any).headers)
        try {
          const res = await fetchWithTimeout(chatUrl, { method: "POST", headers, body: JSON.stringify(mappedBody) }, cfg.timeoutMs)
          if (!res.ok) continue
          const ct = res.headers.get("content-type") || ""
          if (ct.includes("text/event-stream") || isStream) {
            const buf = Buffer.from(await res.arrayBuffer())
            const s = new ReadableStream<Uint8Array>({
              start(c) { try { c.enqueue(new Uint8Array(buf)) } catch {}; try { c.close() } catch {} },
            })
            return new NextResponse(s as any, {
              status: res.status,
              headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive", ...CORS_HEADERS, "X-SeedInfer-Upstream": oid, "X-SeedInfer-Provider": oid, "X-SeedInfer-Attempts": String(attemptsMade + 1), "X-SeedInfer-Affinity": affinityHeader, "X-SeedInfer-Fallback-Reason": scrubString(fallbackReason || `paid_fallback:${oid}`) },
            })
          }
          const j = await res.json().catch(() => null)
          if (j) {
            return NextResponse.json(j, {
              status: res.status,
              headers: { "Cache-Control": "no-store, max-age=0", ...CORS_HEADERS, "X-SeedInfer-Upstream": oid, "X-SeedInfer-Provider": oid, "X-SeedInfer-Attempts": String(attemptsMade + 1), "X-SeedInfer-Affinity": affinityHeader, "X-SeedInfer-Fallback-Reason": scrubString(fallbackReason || `paid_fallback:${oid}`) },
            })
          }
        } catch { continue }
      }
    } catch {}
  }

  if (attemptsMade === 0) {
    return openAIError(
      "No providers available.",
      "service_unavailable",
      "no_providers",
      503,
      { hint: "No verified local provider routable right now." },
      {
        "X-SeedInfer-Upstream": "none",
        "X-SeedInfer-Attempts": "0",
        "X-SeedInfer-Affinity": affinityHeader,
        "X-SeedInfer-Fallback-Reason": scrubString(fallbackReason || "no_providers"),
      }
    )
  }

  // exhausted: min node pause or 2s
  let retryAfterSec = 2
  try {
    let bestMs: number | null = null
    for (const pid of tried) {
      try {
        const snap = getNodeSnapshot(pid)
        if (snap.pausedUntil > Date.now()) {
          const ms = snap.pausedUntil - Date.now()
          bestMs = bestMs === null ? ms : Math.min(bestMs, ms)
        }
      } catch {}
    }
    if (bestMs !== null && Number.isFinite(bestMs) && bestMs > 0) {
      retryAfterSec = Math.max(1, Math.ceil(bestMs / 1000))
    } else if (lastRetryAfterSec > 0) {
      retryAfterSec = lastRetryAfterSec
    }
  } catch {}
  void lastError
  void leaseCount
  void getSafeMaxConcurrency

  return openAIError(
    "All provider attempts failed or saturated. Retry shortly.",
    "tokens_exceeded",
    "attempts_exceeded",
    429,
    { hint: "Retry after the Retry-After interval.", retry_after: retryAfterSec, tried: [...tried] },
    {
      "Retry-After": String(retryAfterSec),
      "X-SeedInfer-Upstream": "none",
      "X-SeedInfer-Attempts": String(attemptsMade),
      "X-SeedInfer-Affinity": affinityHeader,
      "X-SeedInfer-Fallback-Reason": scrubString(fallbackReason || "attempts_exceeded"),
    }
  )
}
