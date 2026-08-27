# SeedInfer Modal — freezer kontenerów VLLM (Nemotron 3.5 Lightning 30B A3B NVFP4)

Freezer: gotowy obraz **vLLM nightly + flashinfer + humming** na **wszystkie konta Modal** użytkownika (10 profili w `~/.modal.toml`) — po `deploy` każdy workspace ma ciepły kontener `seedinfer-nemotron-vllm` na **A100 80GB (W4A16 via NVFP4 checkpoint)** z flagami Nvidii, expose **OpenAI-compatible `/v1/*`**.

> Host: WSL (bez GPU lokalnie — build remote na Modal). Checkpoint `nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4` ten sam serwuje via **W4A16 kernels na Ampere A100 80GB** (Hopper/Blackwell użyłby FP4, ale W4A16 działa wszędzie).

---

## 0) Wymagania

- `modal` CLI 1.4+ : `pip install modal` + `modal setup` (lub ręcznie `~/.modal.toml` 10 profili)
- `python -m modal --help` działa
- `~/.modal.toml` zawiera profile: `konwsermetaliciezkich` (active), `jasionka-kuba`, `mokraolazpornola`, `modalacc1`, `jakub-jasionka`, `modalacc-credit10`, `xciastoch`, `sublimee-atelier`, `spam-cllctr-09`, `walopatrycja00`

Sprawdź:
```bash
modal profile list
cat ~/.modal.toml | grep "^\["
```

> `mokraolazpornola` obecnie `Unknown (authentication failure)` — zregeneruj token na https://modal.com/settings/tokens i `modal token set` lub edytuj `~/.modal.toml`.

---

## 1) Wgranie na WSZYSTKIE konta (freezer build)

```bash
# z root repo /mnt/d/Desktop/SeedInfer.com
bash infra/modal/setup-all-accounts.sh

# tylko jeden profil:
bash infra/modal/setup-all-accounts.sh --profile jasionka-kuba

# tylko walidacja bez deploy (py_compile + volume ensure):
bash infra/modal/setup-all-accounts.sh --build-only

# ręcznie na active profil:
modal profile activate konwsermetaliciezkich
modal deploy infra/modal/modal_seedinfer_vllm.py
```

Skrypt iteruje po profilach:
1. `modal profile activate <profil>` (fallback `MODAL_PROFILE=<profil>`)
2. `modal volume create seedinfer-hf-cache / seedinfer-model-cache` (idempotent)
3. `modal deploy infra/modal/modal_seedinfer_vllm.py --name seedinfer-nemotron-vllm`

Build ~5-10min pierwszy raz (CUDA base + vLLM ~2GB + flashinfer). Kolejne deploye cache'ują Image (Modal snapshot cache). Cold start po deploy: ~2min ciepły, ~15min pierwszy download wag (~20GB) jeśli Volume pusty.

### .env dla listy profili (opcjonalnie)

```bash
cp infra/modal/.env.example infra/modal/.env
# edytuj MODAL_PROFILES jeśli chcesz subset
```

---

## 2) Odpalanie

Deploy tworzy app `seedinfer-nemotron-vllm` z funkcją `serve` (`@modal.web_server(8000)` + `@modal.concurrent(max_inputs=256)`).

### a) Via `modal deploy` (trwały endpoint, zalecane)

```bash
modal deploy infra/modal/modal_seedinfer_vllm.py
# URL: https://<workspace>--seedinfer-nemotron-vllm-serve.modal.run
modal app list
modal app logs seedinfer-nemotron-vllm
```

### b) Via `modal run` (ephemeral, do testów)

```bash
modal run infra/modal/modal_seedinfer_vllm.py
# lub konkretnie:
modal run infra/modal/modal_seedinfer_vllm.py::serve
modal run infra/modal/modal_seedinfer_vllm.py::download_weights  # pre-fetch ~20GB do Volume
```

### c) Per-profile

```bash
MODAL_PROFILE=modalacc1 modal deploy infra/modal/modal_seedinfer_vllm.py
MODAL_PROFILE=modalacc1 modal app list
```

---

## 3) Sprawdzenie

```bash
# lista appów (na active profil):
modal app list

# na konkretny profil:
MODAL_PROFILE=jasionka-kuba modal app list | grep seedinfer

# wszystkie profile:
for p in $(grep -E '^\[.+\]' ~/.modal.toml | tr -d '[]'); do
  echo "== $p =="; MODAL_PROFILE=$p modal app list 2>&1 | head -n 20
done
```

### Health & OpenAI-compatible

Po deploy Modal zwraca URL, np. `https://konwsermetaliciezkich--seedinfer-nemotron-vllm-serve.modal.run`

```bash
URL="https://konwsermetaliciezkich--seedinfer-nemotron-vllm-serve.modal.run"

# health (vLLM):
curl -fsS $URL/health | jq
curl -fsS $URL/v1/models | jq

# chat completions (OpenAI-compatible):
curl -s $URL/v1/chat/completions -H "Content-Type: application/json" \
  -d '{"model":"seedinfer/nemotron-lightning-1m","messages":[{"role":"user","content":"Hello, who are you?"}],"max_tokens":64,"temperature":1.0,"top_p":0.95}' | jq

# z reasoning + tool use (flagi w vLLM):
curl -s $URL/v1/chat/completions -H "Content-Type: application/json" \
  -d '{"model":"seedinfer/nemotron-lightning-1m","messages":[{"role":"user","content":"Write a python function to sort a list"}],"stream":false}' | jq
```

Gateway SeedInfer (`app/api/v1/chat/completions`) używa tego jako `MODAL_BASE_URL` fallback (env `MODAL_BASE_URL=https://...modal.run`, `MODAL_API_KEY` jeśli proxy auth).

---

## 4) Pliki

| Plik | Opis |
|------|------|
| `infra/modal/modal_seedinfer_vllm.py` | Modal app `seedinfer-nemotron-vllm` — Image `nvidia/cuda:13.3.0-devel-ubuntu24.04` (fallback 13.3.1/13.2.1, legacy 12.4.1), py3.12, `vllm nightly + flashinfer-python 0.6.14` (cu12 wheels via PTX JIT na CUDA 13), flags NVFP4 W4A16, GPU A100-80GB fallback A100-40GB, memory 64GB, timeout 3600, concurrent 256, Volume HF cache, keep_warm 1 |
| `infra/modal/setup-all-accounts.sh` | Iteruje po `~/.modal.toml` profilach → `modal volume create` + `modal deploy` (lub `--build-only`). Obsługa `--profile NAME` |
| `infra/modal/.env.example` | Przykład env z listą profili |
| `infra/modal/README.md` | Ten plik |

---

## 5) Image & flagi — szczegóły techniczne

**Base**: `nvidia/cuda:13.3.0-devel-ubuntu24.04` (fallback `13.3.1-devel-ubuntu24.04` / `13.2.1-devel-ubuntu24.04` dla driver 570+, legacy `12.4.1-devel-ubuntu22.04` dla 550+). `add_python="3.12"`. CUDA 13.3 wymaga driver 580.65+ (Blackwell GB202); starsze wheels cu12 działają via PTX JIT.

**Pip**:
- `huggingface_hub[hf_transfer]==0.34.3` + `hf_transfer==0.1.9` → `HF_HUB_ENABLE_HF_TRANSFER=1` (download 5x)
- `flashinfer-python==0.6.14` → `--mamba-backend flashinfer` (hybrid Mamba2; bez tego fallback pytorch triton wolniej) + `VLLM_NVFP4_GEMM_BACKEND=flashinfer-cutlass VLLM_USE_FLASHINFER_MOE_FP4=1`
- `vllm` `--pre --extra-index-url https://wheels.vllm.ai/nightly` → zawiera marlin FP4 kernels dla `--moe-backend marlin` (Blackwell native, host 1:1) oraz humming fallback dla A100. Marlin + `flashinfer-cutlass` to natywny Blackwell FP4 path; humming to Hopper W4A16 emulation.
- `compressed-tensors==0.11.0` → zależność dla `--quantization modelopt` (ModelOpt NVFP4, host używa `modelopt` nie `modelopt_fp4`)

**Flags — host 1:1 RTX 5090 32GB GB202** (jakub-b550m, `docker run --ipc=host`):

```
vllm serve --model nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4
  --served-model-name seedinfer/nemotron-lightning-1m
  --quantization modelopt --dtype bfloat16 --kv-cache-dtype fp8
  --max-model-len 1048576 --gpu-memory-utilization 0.93
  --max-num-seqs 128 --max-num-batched-tokens 4096
  --enable-chunked-prefill --enable-prefix-caching
  --moe-backend marlin --mamba-backend flashinfer --mamba-cache-mode align
  --chat-template /qwen_setup/nemotron_lightning_chat_template_nothink2.jinja
  --enable-auto-tool-choice --tool-call-parser nemotron3 --tool-parser-plugin /qwen_setup/nemotron3_tool_parser_plugin.py
  --trust-remote-code --language-model-only
  --host 0.0.0.0 --port 8000  # modal wewnętrzny 8000; provider host 47900:8000 (można nadpisać env)
# env: VLLM_ATTENTION_BACKEND=FLASHINFER VLLM_NVFP4_GEMM_BACKEND=flashinfer-cutlass VLLM_USE_FLASHINFER_MOE_FP4=1 VLLM_USE_FLASHINFER_SAMPLER=1 PYTORCH_CUDA_ALLOC_CONF=expandable_segments:False VLLM_ALLOW_LONG_MAX_MODEL_LEN=1 HF_HUB_OFFLINE=0
```

- `--quantization modelopt` + `--kv-cache-dtype fp8` → host 1:1 NVFP4 stored precision via ModelOpt (nie `modelopt_fp4`/`auto`). Na A100 fallback `humming` emuluje W4A16 jeśli `modelopt` nie ma native FP4.
- `--moe-backend marlin` (Blackwell native FP4 + `flashinfer-cutlass` GEMM) vs `humming` (Hopper/Ampere W4A16). Host 5090 GB202 sm_120 używa marlin + `VLLM_USE_FLASHINFER_MOE_FP4=1` — bench na hoście: `flashinfer-cutlass` > `marlin` > `triton` dla MoE FP4.
- `--enable-prefix-caching --enable-chunked-prefill` + `@modal.concurrent(128)` → 128 konk. seq, 4096 batched tokens, chunked prefill dla 1M ctx. Host nie ma `--async-scheduling` → usunięte z Modal (było 256/32768 + async).

**GPU**:
- `gpu="A100-80GB"` primary (Modal `GPUConfig` `A100-80GB`). Fallback `A100` / `A100-40GB` jeśli 80GB quota brak — zmień w py lub `gpu=["A100-80GB","A100"]` (Modal akceptuje listę w niektórych wersjach). Memory `65536` (64GB RAM), `timeout=3600`, `startup_timeout=900`, `scaledown_window=600`, `min_containers=1` (keep_warm).
- `volumes={"/root/.cache/huggingface": seedinfer-hf-cache, "/models": seedinfer-model-cache}` — HF cache + model. Pre-download: `modal run ...::download_weights` ( `snapshot_download` + `volume.commit()` ), lub automatycznie przy pierwszym `vllm serve` + HF_TRANSFER.

**Expose**:
- `@modal.web_server(8000)` → `subprocess.Popen(VLLM_CMD)` i Modal proxy port 8000. Public URL `https://<workspace>--seedinfer-nemotron-vllm-serve.modal.run`Forwarduje wszystkie `/v1/*`, `/health`, `/metrics`.
- Alt: `@modal.asgi_app()` + FastAPI proxy (gdyby potrzeba custom auth/rate limit) — obecnie nie potrzebny, bo vLLM jest już OpenAI-compatible.

---

## 6) Validacja bez GPU (WSL)

```bash
python3 -m py_compile infra/modal/modal_seedinfer_vllm.py && echo "py_compile OK"
bash -n infra/modal/setup-all-accounts.sh && echo "bash -n OK"
modal --help | head
python3 -c "import modal; print(modal.__version__)"
```

Deploy faktyczny pominięty w WSL (brak GPU, build remote i tak wymaga konta). Uruchom na maszynie z `modal` zalogowanym.

---

## 7) Troubleshooting

| Objaw | Fix |
|-------|-----|
| `Unknown (authentication failure)` w `modal profile list` | Token nieważny — `modal token set` lub edytuj `~/.modal.toml` (weź z https://modal.com/settings/tokens) |
| `GPU quota exceeded` / `No available A100-80GB` | Zmień `gpu="A100"` lub `"A100-40GB"` w `modal_seedinfer_vllm.py:77`, dodaj `memory=32768` |
| `Out of memory` / `CUDA OOM` na A100 40GB | Zmniejsz `--max-num-batched-tokens 16384`, `--gpu-memory-utilization 0.85`, `--max-model-len 262144` |
| `Volume not found` | Skrypt tworzy automatycznie; ręcznie: `modal volume create seedinfer-hf-cache` |
| Download wolny / timeout 900s | Upewnij się `HF_HUB_ENABLE_HF_TRANSFER=1` + `hf_transfer` pip; zwiększ `startup_timeout=1200` |
| `/health` 503 | `modal app logs seedinfer-nemotron-vllm --follow` — sprawdź czy vLLM wystartował (HuggingFace rate limit, brak HF_TOKEN dla gated nie dotyczy — NVFP4 public) |
| `humming backend not found` | Upewnij się `vllm` nightly (`pip install --pre vllm --extra-index-url https://wheels.vllm.ai/nightly`) — stable `pip install vllm` nie ma humming. Na CUDA 13 cu12 wheels działa via PTX JIT |

---

## 8) Koszty (szacunek Modal)

A100 80GB ~ $1.5-2.0/h na Modal. `min_containers=1` keep_warm → 1× $/h cały czas. Ustaw `min_containers=0` jeśli chcesz scale-to-zero (cold start ~2min). `scaledown_window=600` → 10min po ostatnim request zanim zejdzie do min.

---

Licencja: użycie modelu wymaga akceptacji `nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4` na HuggingFace (OpenMDW 1.1).
