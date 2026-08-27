# SeedInfer Provider Agent — Phase 0 (CUDA only)

Kontener **Linux (x86_64)** dla dostawcy GPU (node). Serwuje **OpenAI-compatible `/v1/chat/completions`** przez **vLLM nightly (CUDA 13.3)** + rejestruje noda w **Headscale** i heartbeat do **SeedInfer gateway**.

> Phase 0: tylko `seedinfer/nemotron-lightning-1m` (1M context, 2M KV, alias `gpt-oss-20b`), `runtime: nvidia`, expose `47900:8000` (vLLM) + `47901:3001` (agent) — host 47900/47901 wolne (nie kolidują z 3000/3002/8004-8007), can be overridden via env.

---

## Szybki start — one-liner (zalecane)

```bash
curl -fsSL https://seedinfer.com/install.sh | bash -s -- --authkey YOUR_AUTHKEY --model seedinfer/nemotron-lightning-1m
# opcjonalnie: --gateway https://seedinfer.com --hostname provider-5090 --login-server https://tailnet.seedinfer.com
```

Skrypt:
1. Sprawdza `nvidia-smi` (CUDA 13.3+, driver 580+ Blackwell), instaluje Docker + `nvidia-container-toolkit` + `tailscale` jeśli brak
2. `tailscale up --login-server https://tailnet.seedinfer.com --authkey <KEY> --advertise-tags tag:provider`
3. Klonuje `provider/` do `/opt/seedinfer-provider`, tworzy `.env`, `docker compose up -d --build`

Verification:
```bash
tailscale status
curl -fsS http://127.0.0.1:47901/health | jq
curl -fsS http://127.0.0.1:47900/v1/models | jq
curl http://127.0.0.1:47901/v1/chat/completions -H "Content-Type: application/json" \
  -d '{"model":"seedinfer/nemotron-lightning-1m","messages":[{"role":"user","content":"Hello"}],"max_tokens":32}'
ping -c2 gateway.seedinfer.ts.net
```

---

## Ręcznie (dev)

```bash
git clone https://github.com/seedinfer/seedinfer.com.git
cd seedinfer.com
cp provider/.env.example provider/.env
# edytuj provider/.env: TAILSCALE_AUTHKEY, MODEL, SEEDINFER_GATEWAY_URL
docker compose -f provider/docker-compose.yml up -d --build
docker compose -f provider/docker-compose.yml logs -f
curl -fsS http://127.0.0.1:47901/health | jq
```

### Bezpośredni docker build

```bash
docker build -f provider/Dockerfile.cuda -t seedinfer/provider:cuda-0.1.0 .
docker run --gpus all --runtime nvidia -p 47900:8000 -p 47901:3001 \
  -e MODEL=seedinfer/nemotron-lightning-1m -e TAILSCALE_AUTHKEY=YOUR_AUTHKEY \
  -v ./models/cache:/root/.cache/huggingface \
  seedinfer/provider:cuda-0.1.0
```

---

## Architektura

```
[Host: nvidia-smi + tailscaled] --WireGuard UDP--> [Control plane: Headscale] (tailnet.seedinfer.com)
        |                                                    |
  docker provider (runtime nvidia)                    Next.js :3000 + /api/v1/providers/heartbeat
   ├─ vLLM nightly :8000 (host 47900:8000) (CUDA 13.3, --max-model-len 1M, prefix caching, chunked prefill)
   └─ agent :3001 (host 47901:3001) (FastAPI) ──heartbeat 30s──> https://seedinfer.com/api/v1/providers/heartbeat
        ├─ GET  /health, /metrics, /v1/models (proxy + fallback static)
        └─ POST /v1/chat/completions, /v1/completions (httpx stream proxy -> vLLM, SSE)
        + GPU via pynvml, graceful shutdown, CORS *
```

- **Headscale rejestracja** — preferowany **host `tailscaled`** (`tailscale up` w `install.sh`). Kontener ma `tailscale` CLI ale nie uruchamia demona — `entrypoint.sh` wykrywa `pgrep tailscaled` i robi `tailscale up` tylko gdy daemon w kontenerze (np. `--privileged` + `network_mode: host`).
- **vLLM** — `FROM nvidia/cuda:13.3.0-cudnn-devel-ubuntu24.04` (fallback 13.3.1/13.2.1, legacy 12.4.1) + `pip install --pre vllm --extra-index-url https://wheels.vllm.ai/nightly` (cu12 wheels via PTX JIT na CUDA 13, native cu13 gdy dostępne), args host 1:1 RTX 5090: `--quantization modelopt --dtype bfloat16 --kv-cache-dtype fp8 --max-model-len 1048576 --gpu-memory-utilization 0.93 --max-num-seqs 128 --max-num-batched-tokens 4096 --enable-chunked-prefill --enable-prefix-caching --moe-backend marlin --mamba-backend flashinfer --mamba-cache-mode align --chat-template /qwen_setup/... --enable-auto-tool-choice --tool-call-parser nemotron3 --tool-parser-plugin /qwen_setup/... --trust-remote-code --language-model-only` + env `VLLM_ATTENTION_BACKEND=FLASHINFER VLLM_NVFP4_GEMM_BACKEND=flashinfer-cutlass VLLM_USE_FLASHINFER_MOE_FP4=1 VLLM_USE_FLASHINFER_SAMPLER=1 PYTORCH_CUDA_ALLOC_CONF=expandable_segments:False VLLM_ALLOW_LONG_MAX_MODEL_LEN=1` + `ipc: host`.
- **Agent** — Python 3.12, FastAPI, `httpx` streaming (SSE `text/event-stream`), `pynvml` + `psutil`, heartbeat payload kompatybilny z `lib/types.ts:Provider` (provider-fleet).
- **Modele** — volume `${HF_CACHE_HOST}:/root/.cache/huggingface` i `${MODELS_HOST}:/models`. Ustaw `VLLM_MODEL` jeśli HF repo różni się od `MODEL`.

---

## Model NVFP4 — plug-and-play (Phase 0)

**Default:** `VLLM_MODEL=nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4` + `MODEL=seedinfer/nemotron-lightning-1m` (logiczny alias via `--served-model-name`).

- **Wagi:** 30B total / 3B active (MoE+Mamba2+Attention hybrid, 1M ctx, 2M KV). NVFP4 (W4A16 + FP8 KV + ModelOpt) → **~16-22GB VRAM** (+ ~6GB KV dla 1M ctx = ~22-28GB) vs 66GB BF16. On-disk ~20-30GB (HF download). Wymaga **CUDA 13.3 + driver 580+ (Blackwell GB202)**, fallback **CUDA 13.2 + 570+** lub **12.4 + 550+ legacy**, **vLLM nightly** (`pip install --pre vllm --extra-index-url https://wheels.vllm.ai/nightly` — cu12 wheels działa na 13.3 via PTX JIT).
- **Plug-and-play:** vLLM **pobiera automatycznie** z HF do `/root/.cache/huggingface` przy pierwszym `docker compose up` (HF cache w `./models/cache`). Ustaw `HF_TOKEN` tylko dla gated modeli (NVFP4 jest publiczny, nie wymaga). Progress: `docker logs -f seedinfer-provider | grep -i download` + `du -sh ./models/cache`.
- **Jinja template:** `chat_template` jest w HF repo `tokenizer_config.json` (jinja od nvidia) — **vLLM użyje automatycznie**, nie nadpisuj. Agent forwarduje `chat_template` w `GET /v1/models` jeśli vLLM zwróci oraz expose `GET /v1/chat/template` (proxy do vLLM lub fetch HF raw `https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4/raw/main/tokenizer_config.json`).
- **vLLM args (entrypoint.sh) — host 1:1 RTX 5090 32GB GB202:**
  ```bash
  --model nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4 \
  --served-model-name seedinfer/nemotron-lightning-1m \
  --quantization modelopt --dtype bfloat16 --kv-cache-dtype fp8 \
  --max-model-len 1048576 --gpu-memory-utilization 0.93 \
  --max-num-seqs 128 --max-num-batched-tokens 4096 \
  --enable-chunked-prefill --enable-prefix-caching \
  --moe-backend marlin --mamba-backend flashinfer --mamba-cache-mode align \
  --chat-template /qwen_setup/nemotron_lightning_chat_template_nothink2.jinja \
  --enable-auto-tool-choice --tool-call-parser nemotron3 \
  --tool-parser-plugin /qwen_setup/nemotron3_tool_parser_plugin.py \
  --trust-remote-code --language-model-only
  # env: VLLM_ATTENTION_BACKEND=FLASHINFER VLLM_NVFP4_GEMM_BACKEND=flashinfer-cutlass VLLM_USE_FLASHINFER_MOE_FP4=1 VLLM_USE_FLASHINFER_SAMPLER=1 PYTORCH_CUDA_ALLOC_CONF=expandable_segments:False VLLM_ALLOW_LONG_MAX_MODEL_LEN=1 HF_HUB_OFFLINE=0 (host: 1 /tmp/hf_home)
  ```
  Zob. `provider/agent/entrypoint.sh`. `VLLM_QUANTIZATION=modelopt` + `VLLM_KV_CACHE_DTYPE=fp8` jak host (nie auto). Chat-template/plugin z `/qwen_setup:ro` (fallback `./provider/assets` jeśli brak mount hosta `/opt/models/qwen_setup`). `--moe-backend marlin` to Blackwell native FP4 (host 5090) — `flashinfer-cutlass` NVFP4 GEMM backend; `humming` to Hopper/Ampere W4A16 emulation fallback.
- **Fallback A100/H100 (Ampere/Hopper bez FP4):** entrypoint auto-detect GPU via `nvidia-smi` — jeśli `a100|h100` → fallback profil `--moe-backend humming --linear-backend humming` + `VLLM_QUANTIZATION=modelopt` (lub `modelopt_fp4` jeśli wymagane na starszej vLLM). Default dla 32GB GPUs (5090, Blackwell, L40S, 6000 Ada etc) = `marlin + fp8 0.93` jak host.
- **VRAM check:** `install.sh` i `entrypoint.sh` weryfikują `nvidia-smi` ≥32GB dla 1M ctx komfortowo (≥16GB hard minimum, <16GB error). `entrypoint.sh` loguje VRAM i ostrzega o OOM — przy OOM zmniejsz `VLLM_MAX_MODEL_LEN=131072`/`32768` i `VLLM_GPU_MEMORY_UTILIZATION=0.80-0.85`. CUDA driver check: <580 warn (13.3 wymagane), <570 warn (13.2), <550 error.
- **HF cache:** `HF_HOME=/root/.cache/huggingface` mount `HF_CACHE_HOST=./models/cache`. `install.sh` sprawdza `hf_api` HEAD na `nvidia/...` oraz VRAM przed startem.

---

## Zmienne ENV (provider/.env.example)

| ENV | Default | Opis |
|-----|---------|------|
| `SEEDINFER_GATEWAY_URL` | `https://seedinfer.com` | Gateway do heartbeat |
| `PROVIDER_API_KEY` | — | Bearer dla heartbeat (opcjonalnie) |
| `TAILSCALE_AUTHKEY` | — | preauth key `tag:provider` (Headscale) |
| `TAILSCALE_LOGIN_SERVER` | `https://tailnet.seedinfer.com` | Headscale control plane |
| `TAILSCALE_HOSTNAME` | `provider-5090` | hostname w Tailnecie |
| `MODEL` | `seedinfer/nemotron-lightning-1m` | model logiczny (fleet + API) |
| `VLLM_MODEL` | `nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4` | **NVFP4 HF repo** dla vLLM (auto-download, jinja template od nvidia) |
| `VLLM_QUANTIZATION` | `modelopt` | Host 1:1 `modelopt` (compressed-tensors ModelOpt NVFP4), nie `modelopt_fp4`/`auto` |
| `VLLM_KV_CACHE_DTYPE` | `fp8` | Host 1:1 `fp8` (nie `auto`) |
| `VLLM_MOE_BACKEND` | `marlin` | Host 1:1 `marlin` (Blackwell FP4), fallback A100/H100 `humming` |
| `VLLM_MAMBA_BACKEND` | `flashinfer` | Host 1:1 `flashinfer` |
| `VLLM_MAMBA_CACHE_MODE` | `align` | Host 1:1 `align` |
| `VLLM_CHAT_TEMPLATE` | `/qwen_setup/nemotron_lightning_chat_template_nothink2.jinja` | Host mount `/opt/models/qwen_setup`, provider fallback `./provider/assets:/qwen_setup:ro` |
| `VLLM_TOOL_PARSER_PLUGIN` | `/qwen_setup/nemotron3_tool_parser_plugin.py` | Host plugin `nemotron3`, nie `qwen3_coder` |
| `VLLM_ATTENTION_BACKEND` | `FLASHINFER` | Host 1:1 |
| `VLLM_NVFP4_GEMM_BACKEND` | `flashinfer-cutlass` | Host 1:1 |
| `VLLM_USE_FLASHINFER_MOE_FP4` | `1` | Host 1:1 |
| `VLLM_USE_FLASHINFER_SAMPLER` | `1` | Host 1:1 |
| `PYTORCH_CUDA_ALLOC_CONF` | `expandable_segments:False` | Host 1:1 (nie `True` jak patch_and_run.sh) |
| `VLLM_ALLOW_LONG_MAX_MODEL_LEN` | `1` | Host 1:1 |
| `HF_HUB_OFFLINE` | `0` | Provider online 0 (`/root/.cache/huggingface`), host offline 1 (`/tmp/hf_home`) |
| `HF_TOKEN` | — | HF token (NVFP4 public → nie wymagane; cache w `/root/.cache/huggingface`) |
| `VLLM_PORT` / `AGENT_PORT` | `47900` / `47901` | porty host -> container 8000/3001, can be overridden via env (zakres 479xx wolny) |
| `VLLM_MAX_MODEL_LEN` | `1048576` | 1M context (2M KV) |
| `VLLM_GPU_MEMORY_UTILIZATION` | `0.93` | Host 1:1 dla 32GB (nie 0.90) — 1M KV + marlin GEMM |

---

## Endpoints agenta (:47901 host -> :3001 container)

- `GET /health` — status, `provider_id`, `vllm_health`, `gpu` (pynvml), `requests_served`, `uptime_s`
- `GET /v1/models` — proxy `GET http://localhost:8000/v1/models` (wewnętrzny 8000, host 47900), fallback static z pricingiem Nemotrona (kompatybilny z `app/api/v1/models`)
- `POST /v1/chat/completions` — proxy stream/non-stream do vLLM, liczy `requests_served`/`tokens_generated`
- `GET /metrics` — `gpu` + `host` + `vllm_health`
- CORS `*`, graceful shutdown (SIGTERM ubija vLLM + agent)

Heartbeat:
```
POST https://seedinfer.com/api/v1/providers/heartbeat (fallback /api/providers/heartbeat)
Headers: Authorization: Bearer $PROVIDER_API_KEY (jeśli ustawiony)
Body: Provider (lib/types.ts) + {gpu, host, uptime_s, vllm_model, region, vllm_health}
Interval: 30s, timeout 10s, log warn on fail
```

---

## Host requirements

- Ubuntu 24.04+ (noble), kernel 6.8+, NVIDIA driver **580.65+** (CUDA 13.3 Blackwell), fallback 570.86+ (CUDA 13.2) / 550.90+ (CUDA 12.4 legacy), `nvidia-container-toolkit`, Docker 24+ + compose plugin, `tailscale` 1.82+
- GPU: **RTX 5090 32GB (GB202, minimum)** lub welcome A100 40/80, H100 80, L40S 48, RTX 6000 Ada 48, RTX 6000 Pro Blackwell, RTX 4500 Blackwell 32GB, RTX 5000 Blackwell — zob. macierz GPU poniżej. VRAM <32GB warn, <16GB error; dla 1M ctx komfortowo 32GB+. `nvidia-smi` musi widzieć GPU. VRAM <24GB wymaga `VLLM_GPU_MEMORY_UTILIZATION=0.80` i mniejszego `VLLM_MAX_MODEL_LEN`.
- Disk: 50GB+ na `/root/.cache/huggingface` (model ~40GB) — host provider host: ``./models/cache` 60GB+ total  **60GB+ free** wystarczy na provider (`vllm nightly 28.8GB + NVFP4 ~30GB + cache ~60GB`, zostanie ~108G). Sprawdź `df -h `./models/cache`. Jeśli mało miejsca: `docker system prune -a` + `rm -rf ./models/cache/.../snapshots` lub `./models/cache`. Can be overridden via env: `VLLM_PORT=47900 AGENT_PORT=47901`
- Network: UDP do `tailnet.seedinfer.com:41641` (WireGuard) lub fallback HTTPS via Cloudflare Tunnel


---

## GPU Matrix — minimum RTX 5090 32GB, mile widziane A100/H100/L40S/Blackwell

**Minimum:** **RTX 5090 32GB** (GB202, Blackwell, sm_120) — 21760 CUDA cores, 680 Tensor (5th gen), 32GB GDDR7, ~1.0-1.8 TB/s, ~400W. NVFP4 30B (16-22GB + ~6GB KV dla 1M ctx = ~22-28GB) mieści się komfortowo z `gpu-memory-util 0.93` i `--max-model-len 1048576 --max-num-seqs 128 --max-num-batched-tokens 4096 --moe-backend marlin` (host 1:1).

**Welcome (każda konfiguracja):**

| GPU | Arch | VRAM | SM | BW | TDP | NVFP4 1M ctx | Est. tput* | Status |
|-----|------|------|----|----|-----|--------------|------------|--------|
| **RTX 5090 32GB** | Blackwell GB202 (sm_120) | 32GB GDDR7 | 170 | ~1.8 TB/s | 575W | ✅ 22-28GB | ~120-180 tok/s | **Minimum — zalecane** |
| **A100 40GB** | Ampere GA100 (sm_80) | 40GB HBM2e | 108 | 1.6 TB/s | 400W | ✅ W4A16 emul. | ~60-90 tok/s | Welcome |
| **A100 80GB** | Ampere GA100 | 80GB HBM2e | 108 | 2.0 TB/s | 400W | ✅ | ~70-100 tok/s | Welcome |
| **H100 80GB** | Hopper H100 (sm_90) | 80GB HBM3 | 144 | 3.0 TB/s | 700W | ✅ FP8/KV | ~150-220 tok/s | Welcome — top |
| **L40S 48GB** | Ada Lovelace AD102 | 48GB GDDR6 | 142 | 864 GB/s | 350W | ✅ | ~80-120 tok/s | Welcome |
| **RTX 6000 Ada 48GB** | Ada AD102 | 48GB GDDR6/ECC | 142 | 960 GB/s | 300W | ✅ | ~80-120 tok/s | Welcome |
| **RTX 6000 Pro Blackwell** | Blackwell GB202 | 96GB GDDR7 | 170+ | ~1.8 TB/s+ | 600W | ✅ 96GB | ~130-190 tok/s | Welcome — max VRAM |
| **RTX 4500 Blackwell 32GB** | Blackwell GB203 | 32GB GDDR7 | ~120 | ~1.0 TB/s | 300W | ✅ | ~90-130 tok/s | Welcome |
| **RTX 5000 Blackwell** | Blackwell GB203 | 32-48GB GDDR7 | ~140 | ~1.2 TB/s | 400W | ✅ | ~110-160 tok/s | Welcome |
| **RTX 5090 (mobile/workstation) 32GB** | Blackwell | 32GB | 170 | ~1.2 TB/s | 150-250W | ✅ | ~100-150 tok/s | Welcome |

*Est. tput: single-user prefill + decode dla Nemotron 30B NVFP4 (W4A16+FP8 KV, BF16), batch 1, 1k in / 256 out, bez prefix cache. Real tput zależy od vLLM marlin (Blackwell FP4 + flashinfer-cutlass) / humming (A100 W4A16) + mamba flashinfer + KV cache hit. Host 5090: ~120-180 tok/s (marlin fp8).

**Docelowo (plan):** RTX 3090 24GB (GA102, 82 SM, 936 GB/s) i RTX 4090 24GB (AD102, 128 SM, 1.0 TB/s) — obecnie działają ale wymagają `VLLM_MAX_MODEL_LEN=131072` i `VLLM_GPU_MEMORY_UTILIZATION=0.85-0.90` dla 1M ctx (24GB tight → OOM przy 0.90). Zostaną dodane jako tier “community / 24GB” z auto-downscale ctx. Nie zalecane na start, ale mile widziane do testów.

**NVFP4 notes:** Model ~16-22GB (weights quantized W4A16 + FP8 KV via ModelOpt). 1M ctx KV cache ~6GB dodatkowo (FP8). Total ~22-28GB → 32GB daje headroom dla `max-num-batched-tokens 4096` i `gpu-util 0.93` (host 1:1). Na 24GB działa ale wymagane `--max-model-len 262144` lub `131072` dla stabilności. Host 5090: marlin + `VLLM_NVFP4_GEMM_BACKEND=flashinfer-cutlass` + `VLLM_USE_FLASHINFER_MOE_FP4=1` dla natywnego Blackwell FP4; na Ampere/Hopper `humming` W4A16 emuluje FP4 GEMM via humming kernels — działa wszędzie, natywny FP4 tensor core tylko na Blackwell (GB100/GB202). `PYTORCH_CUDA_ALLOC_CONF=expandable_segments:False` + `VLLM_ATTENTION_BACKEND=FLASHINFER` jak host.

**Driver / CUDA:** CUDA 13.3 + driver 580+ wymagany dla Blackwell native (sm_120 PTX). Starsze wheels vLLM cu12 działają na CUDA 13 via PTX JIT (forward compat) bez rebuild.

---

## Troubleshooting

| Objaw | Fix |
|-------|-----|
| `nvidia-smi` brak | zainstaluj driver 580+ (CUDA 13.3); `sudo apt update && sudo apt install nvidia-driver-580 && sudo reboot` lub `ubuntu-drivers autoinstall` + reboot. Fallback 570+ dla 13.2, 550+ legacy |
| `docker: no nvidia runtime` | `sudo apt install nvidia-container-toolkit && sudo nvidia-ctk runtime configure --runtime=docker && sudo systemctl restart docker` |
| `vLLM down` w `/health` | `docker logs seedinfer-provider --tail 100`; sprawdź `HF_TOKEN` dla gated modeli; `VLLM_MODEL` musi istnieć na HF |
| `tailscale up: invalid authkey` | klucz wygasł — na Pi: `./scripts/headscale-setup.sh --create-keys` + nowy `--authkey` |
| heartbeat 401/404 | gateway nie ma `/api/v1/providers/heartbeat` w Phase 0 — agent fallback na `/api/providers/heartbeat` i loguje warn (nie krytyczne) |
| OOM CUDA | zmniejsz `VLLM_GPU_MEMORY_UTILIZATION=0.80` i `VLLM_MAX_MODEL_LEN=32768` tymczasowo |

Logi: `docker compose -f provider/docker-compose.yml logs -f` · `tailscale status` · `curl -fsS http://127.0.0.1:47901/metrics | jq`

---

## Plug-and-play flow (NVFP4)

```bash
# 1) Provider — jedna komenda (plug-and-play)
curl -fsSL https://seedinfer.com/install.sh | bash -s -- --authkey YOUR_AUTHKEY
# opcjonalnie: --vllm-model nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4 (default) --hostname provider-5090 --gateway https://seedinfer.com

# Co robi install.sh:
#  - sprawdza nvidia-smi (>=32GB VRAM, CUDA 13.3+ driver 580+, fallback 12.4) + HF model exists
#  - instaluje Docker + nvidia-container-toolkit + tailscale jeśli brak
#  - tailscale up --login-server https://tailnet.seedinfer.com --authkey XXX --advertise-tags tag:provider
#  - klonuje provider/ do /opt/seedinfer-provider, tworzy .env z VLLM_MODEL=nvidia/... (NVFP4)
#  - docker compose up -d --build
#     -> vLLM nightly auto-download wag NVFP4 (~20-30GB) do /root/.cache/huggingface (HOST ./models/cache)
#        progress: docker logs -f seedinfer-provider | grep -i download
#        dmesg / du -sh ./models/cache — rośnie w czasie download
#     -> vLLM start: --model nvidia/... --served-model-name seedinfer/nemotron-lightning-1m --max-model-len 1048576 --enable-prefix-caching ...

# 2) Local verification
curl -fsS http://127.0.0.1:47901/health | jq
# oczekiwano: {"status":"ok","provider_id":"...","vllm_health":{"status":"ok"},"gpu":{"count":1,...}}

curl -fsS http://127.0.0.1:3001/v1/models | jq
# forwarded z vLLM + ensure seedinfer id; chat_template z HF auto (zob. /v1/chat/template)
curl -fsS http://127.0.0.1:47901/v1/chat/template | jq .chat_template

# 3) Heartbeat -> gateway (co 30s, non-blocking)
# agent/main.py build_provider_payload() + vllm_health + tailscale_ip/agent_url
# POST https://seedinfer.com/api/v1/providers/heartbeat
# Gateway: lib/providers-store.ts upsert -> status pending, last_heartbeat, verification:{status:pending, checks:[], ...}
# UI: provider-fleet.tsx pokaże kartę z badge "pending" + opacity 60 (nie oficjalny węzeł)

# 4) Gateway auto-verify (po 2 heartbeat ~60s, w tle, nie blokuje heartbeat response)
# lib/providers-store.ts verifyProvider(): gateway fetch http://<tailscale_ip>:47901/health + test inference
# POST <provider>/v1/chat/completions {"model":"seedinfer/nemotron-lightning-1m","messages":[{"role":"user","content":"ping"}],"max_tokens":5}
# checks: 1)/health ok 2)vllm_health ok 3)GPU>0 4)choices 5)latency<10s 6)model id
# timeout 30s, log do gateway console
# Jeśli pass -> verification.status=verified, provider.status=serving
# Jeśli fail -> failed + failure_reason

# 5) Fleet pokazuje Verified (zielony)
# GET https://seedinfer.com/api/v1/providers -> dane + verification
# provider-fleet.tsx badge "verified" zielony, karta opacity 100 (oficjalny węzeł)
# Ręczna weryfikacja:
# curl -X POST https://seedinfer.com/api/v1/providers/verify -H "Content-Type: application/json" -d '{"provider_id":"provider-5090-xxx"}' | jq
# lub ./scripts/verify-provider.sh --provider-id xxx --gateway https://seedinfer.com
```

Headscale/tunnel nie ruszane — gateway decyduje `verified` (nie Headscale ACL).

---

## Pliki

```
provider/
  Dockerfile.cuda        # nvidia/cuda:13.3.0 (fallback 13.3.1/13.2.1, legacy 12.4.1) + Python 3.12 + vLLM nightly + healthcheck
  docker-compose.yml     # runtime nvidia, volumes modeli, env NVFP4 (VLLM_MODEL=nvidia/...), ports 47900:8000+47901:3001
  .env.example           # wszystkie ENV z NVFP4 (VLLM_QUANTIZATION modelopt, KV dtype fp8, FLASHINFER envs, 0.93, marlin)
  agent/
    main.py              # FastAPI: /health, /v1/models + /v1/chat/template, /v1/chat/completions, heartbeat 30s + tailscale_ip/agent_url
    requirements.txt     # fastapi, uvicorn, httpx, pynvml, psutil
    entrypoint.sh        # start vLLM (NVFP4 args: --max-model-len 1048576 --enable-prefix-caching --enable-chunked-prefill ...) + agent, HF cache wait + progress
  scripts/
    install.sh           # one-liner plug-and-play NVFP4 (VRAM + HF check, default VLLM_MODEL)
  README.md              # ten plik
lib/
  providers-store.ts     # gateway singleton Map + verifyProvider (6 checks, 30s timeout)
app/api/v1/providers/
  heartbeat/route.ts     # POST heartbeat -> upsert pending, auto-verify po 2 heartbeat
  verify/route.ts        # POST verify -> health + inference test
  route.ts               # GET list providers z verification (dla fleet)
components/provider-fleet.tsx # badge pending/verifying/verified + opacity 60 dla nie-verified
scripts/verify-provider.sh    # helper: curl /api/v1/providers/verify
```

Nie buduje obrazu w Phase 0 — tylko pliki + walidacja (`python -m py_compile`, `shellcheck`, `tsc --noEmit`, `docker compose config`).

> Decyzje NVFP4 (host 1:1 RTX 5090 GB202): `VLLM_MODEL=nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4` (30B/3B MoE+Mamba, W4A16+FP8 KV via ModelOpt, ~22GB on-disk, ~16GB VRAM), `--quantization modelopt --kv-cache-dtype fp8 --gpu-memory-utilization 0.93 --max-num-seqs 128 --max-num-batched-tokens 4096 --moe-backend marlin --mamba-backend flashinfer --mamba-cache-mode align --enable-chunked-prefill --enable-prefix-caching --enable-auto-tool-choice --tool-call-parser nemotron3 --tool-parser-plugin /qwen_setup/... --chat-template /qwen_setup/... --trust-remote-code --language-model-only` + env `VLLM_ATTENTION_BACKEND=FLASHINFER VLLM_NVFP4_GEMM_BACKEND=flashinfer-cutlass VLLM_USE_FLASHINFER_MOE_FP4=1 VLLM_USE_FLASHINFER_SAMPLER=1 PYTORCH_CUDA_ALLOC_CONF=expandable_segments:False VLLM_ALLOW_LONG_MAX_MODEL_LEN=1` + `ipc: host`, `HY HUB OFFLINE 0→1 dla offline hosta`, fallback A100/H100 auto-detect `humming` jeśli GPU !=5090, weryfikacja gateway-side przed `verified`.
