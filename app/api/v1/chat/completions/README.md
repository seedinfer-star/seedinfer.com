# Fallback Proxy Chain — `POST /api/v1/chat/completions`

Gateway Next.js na Orange Pi `:3002` (tunnel `seedinfer.com`) → lokalny provider RTX 5090 NVFP4 (`seedinfer/nemotron-lightning-1m` = `nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4`, Tailnet `:3001`) → kaskada gdy lokalny nie wyrabia.

## Kolejność fallback

1. **local** — `listProviders().find verified` → `http://<tailscale_ip>:3001/v1/chat/completions` (timeout 60s total, intent 8s connect, streaming passthrough). Jeśli brak verified → skip. Env override `VLLM_URL` ma priorytet.
   - Trigger fallback: timeout, `ECONNREFUSED`, 5xx, `429 queue`, `latency > threshold`.
2. **Nvidia NIM** — `https://integrate.api.nvidia.com/v1` (`NIM_API_KEY`/`NVAPI_KEY`), model `nvidia/nemotron-3-nano-30b-a3b` (domyślnie). Alternatywa `nvidia/nvidia-nemotron-nano-9b-v2` via `NIM_MODEL`.
3. **Opencode free** — `OPENCODE_BASE_URL` (domyślnie `https://opencode.ai/api/v1`, alt `https://api.opencode.ai/v1`) + `OPENCODE_API_KEY`, model `nemotron-3-lightning-free` (`OPENCODE_MODEL`).
4. **OpenRouter free** — `https://openrouter.ai/api/v1` (`OPENROUTER_API_KEY`), model `nvidia/nemotron-3-nano-30b-a3b:free` (alt `nidia/nemotron-nano-9b-v2:free` via `OPENROUTER_MODEL`).
5. **Modal A100 on-demand** — `MODAL_BASE_URL` (np. `https://modal-seedinfer--app.modal.run`) + `MODAL_API_KEY`, `MODAL_TIMEOUT_MS=120000` (cold start ~2min). Jeśli timeout → `503 all_upstreams_down` + hint.

## Decyzje dot. modeli NIM / OpenRouter

- **NIM**: wybrano `nvidia/nemotron-3-nano-30b-a3b` jako najbardziej kompatybilny z `seedinfer/nemotron-lightning-1m` (oba 30B A3B, 3.5-3.6B active, MoE, ~1M ctx). `nvidia-nemotron-nano-9b-v2` to 9B Hybrid Mamba (128k ctx, non-MoE) — mniejszy, niezgodny z Lightning 1M, zachowany jako env `NIM_MODEL`/`OPENROUTER_MODEL` alternatywa. Źródła: `build.nvidia.com` modelcard + `pricepertoken`/`artificialanalysis` porównania (30B > 9B inteligencja, speed, ctx).
- **Opencode**: model `nemotron-3-lightning-free` (env `OPENCODE_MODEL`) — free tier Opencode odpowiadający Lightning; base URL `https://opencode.ai/api/v1` (task) z fallback `https://api.opencode.ai/v1` via env.
- **OpenRouter**: `nvidia/nemotron-3-nano-30b-a3b:free` — free tier OpenRouter najbliższy Lightning; alt `nvidia/nemotron-nano-9b-v2:free`.

Mapowanie: `lib/fallback-clients.ts:mapModelForUpstream()` — `seedinfer/nemotron-lightning-1m` → upstream model; nie-nemotron przepuszczane as-is.

## Architektura

- `lib/fallback-state.ts` — circuit breaker in-memory (`globalThis.__seedinferFallback`), `5 fails → 60s cooldown` (`FALLBACK_FAIL_THRESHOLD`, `FALLBACK_COOLDOWN_MS`). `isCircuitOpen()`, `recordSuccess()`, `recordFailure()`, `getAllStatuses()`. Stats per upstream.
- `lib/fallback-clients.ts` — konfiguracja upstreamów z env, `mapModelForUpstream()`, `buildUpstreamUrl()`, `getUpstreamConfigs()`. Env `*_BASE_URL` + `*_API_KEY` + `*_MODEL`. Nie leakuje kluczy — `GET /api/v1/fallback/status` zwraca `hasKey` + preview.
- `app/api/v1/chat/completions/route.ts` — pętla fallback sekwencyjnie, `fetchWithTimeout` (AbortController), streaming SSE passthrough (`text/event-stream` gdy `stream:true`), forward `Authorization: Bearer` (local → incoming, remote → upstream key), headers `X-SeedInfer-Upstream` + `X-SeedInfer-Fallback-Reason`, lean logs ` [chat] try …`.
- `app/api/v1/fallback/status/route.ts` — `GET /api/v1/fallback/status` diagnostyka: local verified/pending, upstreams + circuit + healthy, timeouts/models, `?reset=nim|all`.

## Headers

- Success: `X-SeedInfer-Upstream: nim|opencode|openrouter|modal|local`, `X-SeedInfer-Fallback-Reason: <reason or local_ok>`
- Fallback → next gdy `timeout`, `5xx`, `429`, `ECONNREFUSED`, `queue`.
- All fail → `503 { error: { message: "All upstreams unavailable …", type: "service_unavailable", code: "all_upstreams_down", hint: "Try again or contact support" } }`

## Timeouts & tuning (env)

- `LOCAL_TIMEOUT_MS=60000` (intent 8s connect + 60s total)
- `FALLBACK_TIMEOUT_MS=30000` (NIM/Opencode/OpenRouter)
- `MODAL_TIMEOUT_MS=120000` (cold start)
- `FALLBACK_LATENCY_THRESHOLD_MS=10000` (log warn gdy > threshold, fallback tylko dla retryable)
- `FALLBACK_FAIL_THRESHOLD=5`, `FALLBACK_COOLDOWN_MS=60000`

## Streaming

Gdy `body.stream===true` i upstream zwraca `text/event-stream` → `NextResponse(stream)` passthrough bez buforowania, headers `Cache-Control: no-cache`, `Connection: keep-alive`, `X-Accel-Buffering: no`.

## Env

Zobacz `.env.example` — wszystkie `*_API_KEY` jako placeholder (nie leakuj `nvapi-BVU33…` w repo, użyj `NIM_API_KEY=`). Dla dev skopiuj do `.env.local`.

## Test

```bash
curl https://seedinfer.com/api/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SEEDINFER_API_KEY" \
  -d '{"model":"seedinfer/nemotron-lightning-1m","messages":[{"role":"user","content":"Hello"}],"stream":false}'

# diagnostyka
curl https://seedinfer.com/api/v1/fallback/status | jq
curl https://seedinfer.com/api/v1/fallback/status?reset=nim  # reset circuit
```
