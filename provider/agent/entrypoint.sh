#!/bin/bash
set -euo pipefail

# SeedInfer provider entrypoint — uruchamia vLLM + agent (NVFP4 plug-and-play, host 1:1 RTX 5090 32GB GB202)
# Host reference (jakub-b550m):
#   -e VLLM_ATTENTION_BACKEND=FLASHINFER -e VLLM_NVFP4_GEMM_BACKEND=flashinfer-cutlass -e VLLM_USE_FLASHINFER_MOE_FP4=1 -e VLLM_USE_FLASHINFER_SAMPLER=1 -e PYTORCH_CUDA_ALLOC_CONF=expandable_segments:False -e VLLM_ALLOW_LONG_MAX_MODEL_LEN=1 -e HF_HUB_OFFLINE=1 -e HF_HOME=/tmp/hf_home
#   --model "$MODEL_CONT" --served-model-name nemotron-3.5-lightning-30b-a3b-nvfp4 --quantization modelopt --dtype bfloat16 --kv-cache-dtype fp8 --max-model-len 1048576 --gpu-memory-utilization 0.93 --max-num-seqs 128 --max-num-batched-tokens 4096 --enable-chunked-prefill --enable-prefix-caching --moe-backend marlin --mamba-backend flashinfer --mamba-cache-mode align --chat-template /mnt/d/qwen_setup/nemotron_lightning_chat_template_nothink2.jinja --enable-auto-tool-choice --tool-call-parser nemotron3 --tool-parser-plugin /mnt/d/qwen_setup/nemotron3_tool_parser_plugin.py --trust-remote-code --language-model-only --host 0.0.0.0 --port $PORT_CONT
# Lean: trap SIGTERM -> graceful shutdown obu procesów.

MODEL="${MODEL:-seedinfer/nemotron-lightning-1m}"
VLLM_MODEL="${VLLM_MODEL:-nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4}"
if [[ -z "$VLLM_MODEL" ]]; then
  VLLM_MODEL="nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4"
fi
# Host mapping domyślnie 47900:8000 i 47901:3001 (wolne, nie kolidują z 3000/3002/8004-8007). Wewnątrz kontenera 8000/3001, można nadpisać env VLLM_PORT/AGENT_PORT.
VLLM_PORT="${VLLM_PORT:-8000}" # wewnętrzny 8000, host 47900 via docker-compose ports (można nadpisać env)
AGENT_PORT="${AGENT_PORT:-3001}" # wewnętrzny 3001, host 47901 via docker-compose ports (można nadpisać env)
# Alternatywnie jeśli chcesz zmienić wewnętrzny port: export VLLM_PORT=47900 AGENT_PORT=47901 i zaktualizuj VLLM_URL oraz compose right-side
VLLM_MAX_MODEL_LEN="${VLLM_MAX_MODEL_LEN:-1048576}"
VLLM_GPU_MEMORY_UTILIZATION="${VLLM_GPU_MEMORY_UTILIZATION:-0.93}"
VLLM_DTYPE="${VLLM_DTYPE:-bfloat16}"
VLLM_ENABLE_PREFIX_CACHING="${VLLM_ENABLE_PREFIX_CACHING:-true}"
VLLM_QUANTIZATION="${VLLM_QUANTIZATION:-modelopt}"
VLLM_KV_CACHE_DTYPE="${VLLM_KV_CACHE_DTYPE:-fp8}"
VLLM_EXTRA_ARGS="${VLLM_EXTRA_ARGS:-}"
VLLM_MOE_BACKEND="${VLLM_MOE_BACKEND:-marlin}"
VLLM_MAMBA_BACKEND="${VLLM_MAMBA_BACKEND:-flashinfer}"
VLLM_MAMBA_CACHE_MODE="${VLLM_MAMBA_CACHE_MODE:-align}"
VLLM_CHAT_TEMPLATE="${VLLM_CHAT_TEMPLATE:-/qwen_setup/nemotron_lightning_chat_template_nothink2.jinja}"
VLLM_TOOL_PARSER_PLUGIN="${VLLM_TOOL_PARSER_PLUGIN:-/qwen_setup/nemotron3_tool_parser_plugin.py}"

# --- Host env exports (1:1 z docker run -d hosta) ---
export VLLM_ATTENTION_BACKEND="${VLLM_ATTENTION_BACKEND:-FLASHINFER}"
export VLLM_NVFP4_GEMM_BACKEND="${VLLM_NVFP4_GEMM_BACKEND:-flashinfer-cutlass}"
export VLLM_USE_FLASHINFER_MOE_FP4="${VLLM_USE_FLASHINFER_MOE_FP4:-1}"
export VLLM_USE_FLASHINFER_SAMPLER="${VLLM_USE_FLASHINFER_SAMPLER:-1}"
export PYTORCH_CUDA_ALLOC_CONF="${PYTORCH_CUDA_ALLOC_CONF:-expandable_segments:False}"
export VLLM_ALLOW_LONG_MAX_MODEL_LEN="${VLLM_ALLOW_LONG_MAX_MODEL_LEN:-1}"
# HF: provider online (HF_HUB_OFFLINE=0, /root/.cache/huggingface) vs host offline (1, /tmp/hf_home)
export HF_HUB_OFFLINE="${HF_HUB_OFFLINE:-0}"
export HF_HOME="${HF_HOME:-/root/.cache/huggingface}"
export HF_HOME
if [[ -n "${HF_TOKEN:-}" ]]; then
  export HUGGING_FACE_HUB_TOKEN="$HF_TOKEN"
  export HF_TOKEN
  echo "[entrypoint] HF_TOKEN set (len ${#HF_TOKEN}), will be used for gated HF downloads"
else
  echo "[entrypoint] HF_TOKEN not set — public model nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4 is public, no token needed"
fi
echo "[entrypoint] ENV VLLM_ATTENTION_BACKEND=$VLLM_ATTENTION_BACKEND VLLM_NVFP4_GEMM_BACKEND=$VLLM_NVFP4_GEMM_BACKEND VLLM_USE_FLASHINFER_MOE_FP4=$VLLM_USE_FLASHINFER_MOE_FP4 VLLM_USE_FLASHINFER_SAMPLER=$VLLM_USE_FLASHINFER_SAMPLER PYTORCH_CUDA_ALLOC_CONF=$PYTORCH_CUDA_ALLOC_CONF VLLM_ALLOW_LONG_MAX_MODEL_LEN=$VLLM_ALLOW_LONG_MAX_MODEL_LEN HF_HUB_OFFLINE=$HF_HUB_OFFLINE HF_HOME=$HF_HOME"
echo "[entrypoint] MODEL=$MODEL  VLLM_MODEL=$VLLM_MODEL"
mkdir -p "$HF_HOME" 2>/dev/null || true

# 1) Tailscale rejestracja (opcjonalna — preferowany host tailscaled)
if [[ -n "${TAILSCALE_AUTHKEY:-}" ]]; then
  echo "[entrypoint] TAILSCALE_AUTHKEY set — attempting tailscale up..."
  if command -v tailscale >/dev/null 2>&1; then
    if pgrep -x tailscaled >/dev/null 2>&1; then
      tailscale up --login-server "${TAILSCALE_LOGIN_SERVER:-https://tailnet.seedinfer.com}" \
        --authkey "${TAILSCALE_AUTHKEY}" \
        --advertise-tags tag:provider \
        --hostname "${TAILSCALE_HOSTNAME:-provider-5090}" \
        ${TAILSCALE_EXTRA_ARGS:-} || echo "[entrypoint] tailscale up failed (continuing)"
    else
      echo "[entrypoint] tailscaled not running in container — expected host tailscaled. Skipping container tailscale up."
      echo "[entrypoint] Run on host: tailscale up --login-server ${TAILSCALE_LOGIN_SERVER:-https://tailnet.seedinfer.com} --authkey *** --advertise-tags tag:provider"
    fi
  fi
fi

# 2) Sprawdź CUDA + VRAM (NVFP4 wymaga >=16GB, minimum RTX 5090 32GB dla 1M ctx, 1M KV ~6GB)
GPU_NAME=""
VRAM_MB="0"
if command -v nvidia-smi >/dev/null 2>&1; then
  echo "[entrypoint] nvidia-smi:"
  nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv || true
  VRAM_MB=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | head -n1 | tr -d ' ' || echo "0")
  GPU_NAME=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -n1 || echo "")
  GPU_NAME_LC=$(echo "$GPU_NAME" | tr '[:upper:]' '[:lower:]')
  echo "[entrypoint] GPU detected: $GPU_NAME VRAM=${VRAM_MB}MB"
  if [[ "$VRAM_MB" != "0" && "$VRAM_MB" -lt 16000 ]]; then
    echo "[entrypoint] ERROR: GPU VRAM ${VRAM_MB}MB < 16GB — NVFP4 model nvidia/... requires >=16GB (minimum RTX 5090 32GB zalecane dla 1M ctx). Zmniejsz VLLM_GPU_MEMORY_UTILIZATION lub użyj mniejszego modelu." >&2
    echo "[entrypoint] Hint: nvidia-smi; try VLLM_MAX_MODEL_LEN=32768 VLLM_GPU_MEMORY_UTILIZATION=0.80 lub 0.85" >&2
  elif [[ "$VRAM_MB" != "0" && "$VRAM_MB" -lt 32000 ]]; then
    echo "[entrypoint] WARN: GPU VRAM ${VRAM_MB}MB < 32GB — NVFP4 działa (~16-22GB + ~6GB KV dla 1M ctx), ale minimum 32GB zalecane (RTX 5090 32GB). Jeśli OOM, zmniejsz VLLM_MAX_MODEL_LEN=131072 i VLLM_GPU_MEMORY_UTILIZATION=0.85." >&2
    if [[ "$VRAM_MB" -lt 24000 ]]; then
      echo "[entrypoint] WARN: VRAM <24GB — dla 1M ctx konieczne VLLM_GPU_MEMORY_UTILIZATION=0.80 i VLLM_MAX_MODEL_LEN=131072 lub 32768." >&2
    fi
  else
    echo "[entrypoint] VRAM OK >=32GB — NVFP4 1M ctx komfortowo (RTX 5090 32GB, A100/H100 etc)"
  fi
  VER=$(nvidia-smi | grep -oP 'Driver Version: \K[0-9.]+' || echo "")
  if [[ -n "$VER" ]]; then
    MAJ=$(echo "$VER" | cut -d. -f1)
    if [[ "$MAJ" -lt 580 ]]; then
      if [[ "$MAJ" -lt 550 ]]; then
        echo "[entrypoint] WARN: NVIDIA driver $VER < 550 — CUDA 12.4 wymaga 550+, CUDA 13.3 wymaga 580+. Zaktualizuj driver do 580+." >&2
      elif [[ "$MAJ" -lt 570 ]]; then
        echo "[entrypoint] WARN: NVIDIA driver $VER < 570 — CUDA 13.2+ wymaga 570+, CUDA 13.3 wymaga 580+. Działa na 12.4 ale dla Blackwell użyj 580+." >&2
      else
        echo "[entrypoint] WARN: NVIDIA driver $VER < 580 — CUDA 13.3 wymaga 580.65+ (Blackwell GB202). Masz $VER — użyj image 13.2.1 (570+) lub zaktualizuj do 580+." >&2
      fi
    else
      echo "[entrypoint] Driver $VER OK for CUDA 13.3 (580+)"
    fi
    CUDA_VER=$(nvidia-smi | grep -oP 'CUDA Version: \K[0-9.]+' || echo "unknown")
    echo "[entrypoint] CUDA runtime driver reports: $CUDA_VER (need 13.3+ for Blackwell native, 12.4+ min)"
  fi
else
  echo "[entrypoint] WARN: nvidia-smi not found — GPU monitoring will be degraded"
  GPU_NAME_LC=""
fi

# 2b) Sprawdź dostępność HF modelu (bez download — info only)
if command -v python3 >/dev/null 2>&1; then
  python3 - <<PY || true
import os
mid=os.getenv("VLLM_MODEL","nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4")
print(f"[entrypoint] HF model to auto-download: {mid}")
print(f"[entrypoint] HF cache: {os.getenv('HF_HOME','/root/.cache/huggingface')} — vLLM pobierze automatycznie przy pierwszym starcie (~20-30GB)")
try:
 import urllib.request
 tok=os.getenv("HF_TOKEN","")
 headers={}
 if tok: headers["Authorization"]=f"Bearer {tok}"
 req=urllib.request.Request(f"https://huggingface.co/api/models/{mid}", headers=headers, method="HEAD")
 urllib.request.urlopen(req, timeout=5)
 print("[entrypoint] HF model exists on hub: OK")
except Exception as e:
 print(f"[entrypoint] HF model check skip/failed (offline?): {e}")
PY
fi

# 3) Profil detekcja: RTX 5090 / Blackwell 32GB (host) vs A100/H100 fallback (humming)
# Host flags: marlin + fp8 + 0.93 + 128/4096 + flashinfer — dla 32GB GPUs (5090, Blackwell, L40S, 6000 Ada etc)
# Fallback: A100/H100 (Ampere/Hopper) bez native FP4 → humming W4A16 emulation
IS_32GB_HOST_PROFILE="true"
if [[ -n "${GPU_NAME_LC:-}" ]]; then
  if echo "$GPU_NAME_LC" | grep -qE "a100|h100|a800|h800"; then
    IS_32GB_HOST_PROFILE="false"
    echo "[entrypoint] GPU $GPU_NAME detected as A100/H100 Ampere/Hopper → fallback profile (humming)"
  elif echo "$GPU_NAME_LC" | grep -qE "5090|blackwell|gb202|gb203|gb100|l40|rtx.*6000|rtx.*5000|rtx.*4500"; then
    IS_32GB_HOST_PROFILE="true"
    echo "[entrypoint] GPU $GPU_NAME detected as Blackwell/5090/L40/6000 → host profile (marlin + fp8 0.93)"
  elif [[ "$VRAM_MB" != "0" && "$VRAM_MB" -lt 30000 ]]; then
    # <30GB (np. RTX 4090 24GB) — host 1M ctx tight, ale nadal host flags jeśli nie A100/H100
    IS_32GB_HOST_PROFILE="true"
    echo "[entrypoint] VRAM ${VRAM_MB}MB <30GB but non-A100/H100 → keeping host marlin profile (may need --max-model-len downscale on OOM)"
  else
    echo "[entrypoint] GPU $GPU_NAME VRAM ${VRAM_MB}MB → host marlin profile (default dla 32GB)"
  fi
else
  echo "[entrypoint] GPU name unknown → default host marlin profile (32GB)"
fi
# Allow explicit override via env VLLM_MOE_BACKEND=humming etc
if [[ "$VLLM_MOE_BACKEND" == "humming" ]]; then
  IS_32GB_HOST_PROFILE="false"
  echo "[entrypoint] VLLM_MOE_BACKEND=humming override → fallback humming profile"
fi
echo "[entrypoint] Selected profile: $([ "$IS_32GB_HOST_PROFILE" == "true" ] && echo "HOST (marlin fp8 0.93 128/4096)" || echo "FALLBACK (humming)")"

# 3b) Zbuduj vLLM args — host 1:1 dla 32GB path
VLLM_ARGS=(
  --model "$VLLM_MODEL"
  --host 0.0.0.0
  --port "$VLLM_PORT"
  --served-model-name "$MODEL"
  --quantization "$VLLM_QUANTIZATION"
  --dtype "$VLLM_DTYPE"
  --kv-cache-dtype "$VLLM_KV_CACHE_DTYPE"
  --max-model-len "$VLLM_MAX_MODEL_LEN"
  --gpu-memory-utilization "$VLLM_GPU_MEMORY_UTILIZATION"
)

if [[ "$IS_32GB_HOST_PROFILE" == "true" ]]; then
  # Host dokładnie: 128 seq, 4096 batched, chunked, prefix, marlin, mamba flashinfer align
  VLLM_ARGS+=(
    --max-num-seqs 128
    --max-num-batched-tokens 4096
    --enable-chunked-prefill
  )
  if [[ "$VLLM_ENABLE_PREFIX_CACHING" == "true" ]]; then
    VLLM_ARGS+=(--enable-prefix-caching)
  fi
  VLLM_ARGS+=(
    --moe-backend marlin
    --mamba-backend "$VLLM_MAMBA_BACKEND"
    --mamba-cache-mode "$VLLM_MAMBA_CACHE_MODE"
  )
else
  # Fallback A100/H100 — humming (W4A16) zachowany jako alternatywny profil
  # max-num-seqs 128 zachowany jak host (można nadpisać env), batched 4096 jak host dla spójności; humming kernels emulują W4A16 na Ampere
  # Opcjonalnie jeśli VLLM_MOE_BACKEND=humming nadpisuj:
  VLLM_ARGS+=(
    --max-num-seqs 128
    --max-num-batched-tokens 4096
    --enable-chunked-prefill
  )
  if [[ "$VLLM_ENABLE_PREFIX_CACHING" == "true" ]]; then
    VLLM_ARGS+=(--enable-prefix-caching)
  fi
  # fallback humming: jeśli VLLM_QUANTIZATION == modelopt (host), na A100 lepiej modelopt_fp4 — ale zachowaj env override
  if [[ "$VLLM_QUANTIZATION" == "modelopt" ]]; then
    echo "[entrypoint] Fallback humming: VLLM_QUANTIZATION=$VLLM_QUANTIZATION (host) → dla A100/H100 może być modelopt_fp4; użyj modelopt (humming W4A16 emuluje) lub ustaw VLLM_QUANTIZATION=modelopt_fp4 ręcznie jeśli potrzeba"
  fi
  VLLM_ARGS+=(
    --moe-backend humming
    --mamba-backend "$VLLM_MAMBA_BACKEND"
    --mamba-cache-mode "$VLLM_MAMBA_CACHE_MODE"
  )
  # humming optional linear-backend na A100/H100 (nie na Blackwell host)
  # jeśli vLLM nightly humming wymaga --linear-backend humming, dodaj:
  if [[ "$VLLM_MOE_BACKEND" == "humming" ]]; then
    echo "[entrypoint] fallback humming: dodaję --linear-backend humming dla spójności z modal recipe (opcjonalne na A100)"
    VLLM_ARGS+=(--linear-backend humming)
  fi
fi

# Chat template — jeśli plik istnieje (host 1:1), dodaj --chat-template, else fallback do HF tokenizer_config.json
CHAT_TEMPLATE_FOUND=""
for cand in "$VLLM_CHAT_TEMPLATE" "/qwen_setup/nemotron_lightning_chat_template_nothink2.jinja" "/app/assets/nemotron_lightning_chat_template_nothink2.jinja" "/app/provider/assets/nemotron_lightning_chat_template_nothink2.jinja" "./provider/assets/nemotron_lightning_chat_template_nothink2.jinja"; do
  if [[ -f "$cand" ]]; then
    CHAT_TEMPLATE_FOUND="$cand"
    break
  fi
done
if [[ -n "$CHAT_TEMPLATE_FOUND" ]]; then
  echo "[entrypoint] chat-template found: $CHAT_TEMPLATE_FOUND → --chat-template $CHAT_TEMPLATE_FOUND"
  VLLM_ARGS+=(--chat-template "$CHAT_TEMPLATE_FOUND")
else
  echo "[entrypoint] chat-template not found (fallback do HF tokenizer_config.json) — pomijam --chat-template"
fi

# Tool parser — host 1:1 nemotron3 + plugin
VLLM_ARGS+=(--enable-auto-tool-choice --tool-call-parser nemotron3)
TOOL_PLUGIN_FOUND=""
for cand in "$VLLM_TOOL_PARSER_PLUGIN" "/qwen_setup/nemotron3_tool_parser_plugin.py" "/app/assets/nemotron3_tool_parser_plugin.py" "/app/provider/assets/nemotron3_tool_parser_plugin.py" "./provider/assets/nemotron3_tool_parser_plugin.py"; do
  if [[ -f "$cand" ]]; then
    TOOL_PLUGIN_FOUND="$cand"
    break
  fi
done
if [[ -n "$TOOL_PLUGIN_FOUND" ]]; then
  echo "[entrypoint] tool-parser-plugin found: $TOOL_PLUGIN_FOUND → --tool-parser-plugin $TOOL_PLUGIN_FOUND"
  VLLM_ARGS+=(--tool-parser-plugin "$TOOL_PLUGIN_FOUND")
else
  echo "[entrypoint] tool-parser-plugin not found — pomijam --tool-parser-plugin (użyj HF default lub mount /qwen_setup)"
fi

# Stałe host flags
VLLM_ARGS+=(--trust-remote-code --language-model-only)

# VLLM_EXTRA_ARGS — dodatkowe override z env (jeśli ustawione, dopisuj na koniec)
if [[ -n "$VLLM_EXTRA_ARGS" ]]; then
  # shellcheck disable=SC2206
  EXTRA=($VLLM_EXTRA_ARGS)
  echo "[entrypoint] VLLM_EXTRA_ARGS extra: ${EXTRA[*]}"
  VLLM_ARGS+=("${EXTRA[@]}")
fi

echo "[entrypoint] HF_HOME=$HF_HOME (vLLM auto-download if missing)"
echo "[entrypoint] starting vLLM: python -m vllm.entrypoints.openai.api_server ${VLLM_ARGS[*]}"
echo "[entrypoint] To monitor HF download progress: docker exec seedinfer-provider du -sh $HF_HOME  ;  docker logs -f seedinfer-provider | grep -i download"

python3 -m vllm.entrypoints.openai.api_server "${VLLM_ARGS[@]}" &
VLLM_PID=$!

# czekaj aż vLLM wstanie (max 900s — model duży + download ~30GB)
echo "[entrypoint] waiting for vLLM on :$VLLM_PORT (timeout 900s, download ~30GB if first run) ..."
for i in $(seq 1 180); do
  if curl -fsS "http://127.0.0.1:${VLLM_PORT}/health" >/dev/null 2>&1 || curl -fsS "http://127.0.0.1:${VLLM_PORT}/v1/models" >/dev/null 2>&1; then
    echo "[entrypoint] vLLM ready after $((i*5))s"
    break
  fi
  if ! kill -0 "$VLLM_PID" 2>/dev/null; then
    echo "[entrypoint] vLLM exited early — check logs"
    wait "$VLLM_PID" || true
    exit 1
  fi
  if (( i % 6 == 0 )); then
    CACHE_SZ=$(du -sh "$HF_HOME" 2>/dev/null | cut -f1 || echo "?")
    echo "[entrypoint] still waiting ($((i*5))s) — HF cache size: $CACHE_SZ  (download in progress if growing)"
  fi
  sleep 5
  if (( i == 180 )); then
    echo "[entrypoint] timeout 900s waiting for vLLM — logs tail:"
    ps -o pid,cmd 2>/dev/null | head || true
  fi
done

# 4) Uruchom agenta (foreground)
echo "[entrypoint] starting agent on :$AGENT_PORT"
cleanup() {
  echo "[entrypoint] SIGTERM/SIGINT — shutting down..."
  kill -TERM "$VLLM_PID" 2>/dev/null || true
  kill -TERM "$AGENT_PID" 2>/dev/null || true
  wait "$VLLM_PID" 2>/dev/null || true
  wait "$AGENT_PID" 2>/dev/null || true
  exit 0
}
trap cleanup SIGTERM SIGINT

python3 -m uvicorn agent.main:app --host 0.0.0.0 --port "$AGENT_PORT" --log-level "${AGENT_LOG_LEVEL:-info}" &
AGENT_PID=$!

wait "$AGENT_PID"
kill -TERM "$VLLM_PID" 2>/dev/null || true
wait "$VLLM_PID" 2>/dev/null || true
