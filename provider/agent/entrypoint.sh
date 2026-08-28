#!/bin/bash
set -euo pipefail

# SeedInfer provider entrypoint — Gemma 4 26B A4B NVFP4 (1:1 z DiffusionGemma Studio)
# Host reference (jakub-b550m RTX 5090 32GB GB202)

MODEL="${MODEL:-google/gemma-4-26b-a4b-nvfp4}"
VLLM_MODEL="${VLLM_MODEL:-/models/Gemma-4-26B-A4B-NVFP4}"

# Auto-detect local snapshot if /models/Gemma-4-26B-A4B-NVFP4 is not present
if [[ ! -d "$VLLM_MODEL" && ! -f "$VLLM_MODEL/config.json" ]]; then
  _SNAP_FOUND=false
  for _cache_root in "/mnt/d/models/hf/Gemma-4-26B-A4B-NVFP4" "/models/Gemma-4-26B-A4B-NVFP4" "/mnt/d/hf_cache" "/root/.cache/huggingface" "/tmp/hf_home"; do
    if [[ -f "${_cache_root}/model.safetensors.index.json" || -f "${_cache_root}/config.json" ]]; then
      echo "[entrypoint] Found direct model directory: $_cache_root"
      VLLM_MODEL="$_cache_root"
      export HF_HUB_OFFLINE=1
      _SNAP_FOUND=true
      break
    fi
    _snap_parent="${_cache_root}/hub/models--nvidia--Gemma-4-26B-A4B-NVFP4/snapshots"
    if [[ -d "$_snap_parent" ]]; then
      _snap=$(find "$_snap_parent" -maxdepth 1 -mindepth 1 -type d 2>/dev/null | head -n1)
      if [[ -n "$_snap" && -d "$_snap" ]]; then
        echo "[entrypoint] Found local Gemma 4 snapshot: $_snap — using mmap zero-copy"
        VLLM_MODEL="$_snap"
        export HF_HUB_OFFLINE=1
        _SNAP_FOUND=true
        break
      fi
    fi
  done
  if [[ "$_SNAP_FOUND" != "true" ]]; then
    VLLM_MODEL="nvidia/Gemma-4-26B-A4B-NVFP4"
  fi
fi

VLLM_PORT="${VLLM_PORT:-8000}"
AGENT_PORT="${AGENT_PORT:-3001}"
VLLM_MAX_MODEL_LEN="${VLLM_MAX_MODEL_LEN:-262144}"
VLLM_GPU_MEMORY_UTILIZATION="${VLLM_GPU_MEMORY_UTILIZATION:-0.94}"
VLLM_MAX_NUM_SEQS="${VLLM_MAX_NUM_SEQS:-32}"
VLLM_MAX_BATCHED_TOKENS="${VLLM_MAX_BATCHED_TOKENS:-4096}"
VLLM_BLOCK_SIZE="${VLLM_BLOCK_SIZE:-16}"
VLLM_MAX_CUDAGRAPH_CAPTURE_SIZE="${VLLM_MAX_CUDAGRAPH_CAPTURE_SIZE:-32}"
VLLM_CUDAGRAPH_CAPTURE_SIZES="${VLLM_CUDAGRAPH_CAPTURE_SIZES:-1 2 4 8 16 32}"
VLLM_CPU_OFFLOAD_GB="${VLLM_CPU_OFFLOAD_GB:-0}"
VLLM_SWAP_SPACE="${VLLM_SWAP_SPACE:-0}"
VLLM_DTYPE="${VLLM_DTYPE:-bfloat16}"
VLLM_ENABLE_PREFIX_CACHING="${VLLM_ENABLE_PREFIX_CACHING:-true}"
VLLM_ENABLE_CHUNKED_PREFILL="${VLLM_ENABLE_CHUNKED_PREFILL:-true}"
VLLM_SCHEDULING_POLICY="${VLLM_SCHEDULING_POLICY:-priority}"
VLLM_QUANTIZATION="${VLLM_QUANTIZATION:-modelopt}"
VLLM_KV_CACHE_DTYPE="${VLLM_KV_CACHE_DTYPE:-fp8}"
VLLM_EXTRA_ARGS="${VLLM_EXTRA_ARGS:-}"
VLLM_CHAT_TEMPLATE="${VLLM_CHAT_TEMPLATE:-/qwen_setup/gemma4_chat_template.jinja}"

# --- Host env exports (1:1 z DiffusionGemma Studio) ---
export VLLM_USE_V2_MODEL_RUNNER="${VLLM_USE_V2_MODEL_RUNNER:-1}"
export VLLM_USE_V1="${VLLM_USE_V1:-0}"
export VLLM_ATTENTION_BACKEND="${VLLM_ATTENTION_BACKEND:-FLASHINFER}"
export VLLM_NVFP4_GEMM_BACKEND="${VLLM_NVFP4_GEMM_BACKEND:-flashinfer-cutlass}"
export VLLM_USE_FLASHINFER_MOE_FP4="${VLLM_USE_FLASHINFER_MOE_FP4:-1}"
export VLLM_USE_FLASHINFER_SAMPLER="${VLLM_USE_FLASHINFER_SAMPLER:-1}"
export VLLM_USE_TRITON_FLASH_ATTN="${VLLM_USE_TRITON_FLASH_ATTN:-0}"
export PYTORCH_CUDA_ALLOC_CONF="${PYTORCH_CUDA_ALLOC_CONF:-expandable_segments:True}"
export VLLM_ALLOW_LONG_MAX_MODEL_LEN="${VLLM_ALLOW_LONG_MAX_MODEL_LEN:-1}"
export OMP_NUM_THREADS="${OMP_NUM_THREADS:-4}"
export TORCHINDUCTOR_NUM_THREADS="${TORCHINDUCTOR_NUM_THREADS:-4}"
export MKL_NUM_THREADS="${MKL_NUM_THREADS:-4}"
export HF_HUB_OFFLINE="${HF_HUB_OFFLINE:-0}"
export HF_HOME="${HF_HOME:-/root/.cache/huggingface}"
export HF_HOME

if [[ -n "${HF_TOKEN:-}" ]]; then
  export HUGGING_FACE_HUB_TOKEN="$HF_TOKEN"
  export HF_TOKEN
fi

echo "[entrypoint] ENV VLLM_USE_V2_MODEL_RUNNER=$VLLM_USE_V2_MODEL_RUNNER VLLM_ATTENTION_BACKEND=$VLLM_ATTENTION_BACKEND PYTORCH_CUDA_ALLOC_CONF=$PYTORCH_CUDA_ALLOC_CONF"
echo "[entrypoint] MODEL=$MODEL VLLM_MODEL=$VLLM_MODEL"
mkdir -p "$HF_HOME" 2>/dev/null || true

# Tailscale IP export
export HOST_AGENT_PORT="${HOST_AGENT_PORT:-47901}"
if [[ -z "${TAILSCALE_IP:-}" ]]; then
  _ts_ip=""
  if command -v tailscale >/dev/null 2>&1; then
    _ts_ip=$(tailscale ip -4 2>/dev/null | head -n1 || true)
  fi
  if [[ -z "$_ts_ip" ]] && command -v ip >/dev/null 2>&1; then
    _ts_ip=$(ip -4 addr show tailscale0 2>/dev/null | grep -oP 'inet \K[0-9.]+' | head -n1 || true)
  fi
  if [[ -n "$_ts_ip" && "$_ts_ip" =~ ^100\. ]]; then
    export TAILSCALE_IP="$_ts_ip"
    echo "[entrypoint] Detected TAILSCALE_IP=$_ts_ip"
  fi
fi

if [[ -n "${TAILSCALE_AUTHKEY:-}" ]]; then
  echo "[entrypoint] TAILSCALE_AUTHKEY set — attempting tailscale up..."
  if command -v tailscale >/dev/null 2>&1; then
    if pgrep -x tailscaled >/dev/null 2>&1; then
      tailscale up --login-server "${TAILSCALE_LOGIN_SERVER:-https://tailnet.seedinfer.com}" \
        --authkey "${TAILSCALE_AUTHKEY}" \
        --advertise-tags tag:provider \
        --hostname "${TAILSCALE_HOSTNAME:-provider-5090}" \
        ${TAILSCALE_EXTRA_ARGS:-} || echo "[entrypoint] tailscale up failed (continuing)"
    fi
  fi
fi

# 3) Build complete 1:1 vLLM arguments for Gemma 4 26B A4B NVFP4
VLLM_ARGS=(
  --model "$VLLM_MODEL"
  --host 0.0.0.0
  --port "$VLLM_PORT"
  --served-model-name "$MODEL"
  --hf-overrides '{"architectures": ["Gemma4ForCausalLM"]}'
  --quantization "$VLLM_QUANTIZATION"
  --dtype "$VLLM_DTYPE"
  --kv-cache-dtype "$VLLM_KV_CACHE_DTYPE"
  --gpu-memory-utilization "$VLLM_GPU_MEMORY_UTILIZATION"
  --block-size "$VLLM_BLOCK_SIZE"
  --max-model-len "$VLLM_MAX_MODEL_LEN"
  --max-num-seqs "$VLLM_MAX_NUM_SEQS"
  --max-cudagraph-capture-size "$VLLM_MAX_CUDAGRAPH_CAPTURE_SIZE"
  --disable-custom-all-reduce
  --enable-chunked-prefill
  --max-num-batched-tokens "$VLLM_MAX_BATCHED_TOKENS"
  --scheduling-policy "$VLLM_SCHEDULING_POLICY"
  --enable-auto-tool-choice
  --tool-call-parser gemma4
  --reasoning-parser gemma4
  --override-generation-config '{"max_new_tokens": null, "max_denoising_steps": 32}'
  --default-chat-template-kwargs '{"enable_thinking":true}'
  --trust-remote-code
  --language-model-only
)

# Convert space-separated capture sizes to array if set
if [[ -n "$VLLM_CUDAGRAPH_CAPTURE_SIZES" ]]; then
  VLLM_ARGS+=(--cudagraph-capture-sizes $VLLM_CUDAGRAPH_CAPTURE_SIZES)
fi

if [[ "$VLLM_ENABLE_PREFIX_CACHING" == "true" ]]; then
  VLLM_ARGS+=(--enable-prefix-caching)
fi

# Chat template lookup for Gemma 4
CHAT_TEMPLATE_FOUND=""
for cand in "$VLLM_CHAT_TEMPLATE" "/qwen_setup/gemma4_chat_template.jinja" "/tmp/gemma4_chat_template.jinja" "/app/assets/gemma4_chat_template.jinja" "/app/provider/assets/gemma4_chat_template.jinja" "./provider/assets/gemma4_chat_template.jinja"; do
  if [[ -f "$cand" ]]; then
    CHAT_TEMPLATE_FOUND="$cand"
    break
  fi
done
if [[ -n "$CHAT_TEMPLATE_FOUND" ]]; then
  echo "[entrypoint] Gemma 4 chat-template found: $CHAT_TEMPLATE_FOUND"
  VLLM_ARGS+=(--chat-template "$CHAT_TEMPLATE_FOUND")
fi

if [[ -n "$VLLM_EXTRA_ARGS" ]]; then
  # shellcheck disable=SC2206
  EXTRA=($VLLM_EXTRA_ARGS)
  echo "[entrypoint] VLLM_EXTRA_ARGS: ${EXTRA[*]}"
  VLLM_ARGS+=("${EXTRA[@]}")
fi

# compressed-tensors check
if python3 -c "from compressed_tensors.compressors.pack_quantized.helpers import pack_to_int32" >/dev/null 2>&1; then
  echo "[entrypoint] compressed-tensors OK"
else
  echo "[entrypoint] Installing compressed-tensors==0.17.0..."
  pip install --break-system-packages --no-cache-dir "compressed-tensors==0.17.0" >/dev/null 2>&1 || true
fi

# Auto-apply patches
for patch_dir in "/qwen_setup" "/studio" "/app/assets" "/mnt/d/qwen_setup"; do
  if [[ -f "$patch_dir/patch_kv_cache.py" ]]; then
    echo "[entrypoint] Applying patches from $patch_dir..."
    for script in "patch_trtllm.py" "patch_vllm.py" "patch_fix_nightly_0825.py" "patch_kv_cache.py" "patch_cutlass.py"; do
      if [[ -f "$patch_dir/$script" ]]; then
        python3 "$patch_dir/$script" 2>&1 || echo "[entrypoint] WARN: $script failed"
      fi
    done
    break
  fi
done

if [[ -f "/qwen_setup/patch_and_run.sh" ]]; then
  echo "[entrypoint] Executing via /qwen_setup/patch_and_run.sh: ${VLLM_ARGS[*]}"
  chmod +x /qwen_setup/patch_and_run.sh 2>/dev/null || true
  /qwen_setup/patch_and_run.sh "${VLLM_ARGS[@]}" &
  VLLM_PID=$!
else
  echo "[entrypoint] Starting vLLM directly: python3 -m vllm.entrypoints.openai.api_server ${VLLM_ARGS[*]}"
  python3 -m vllm.entrypoints.openai.api_server "${VLLM_ARGS[@]}" &
  VLLM_PID=$!
fi

echo "[entrypoint] waiting for vLLM on :$VLLM_PORT (timeout 900s) ..."
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
  sleep 5
done

echo "[entrypoint] starting agent on :$AGENT_PORT"
cleanup() {
  echo "[entrypoint] SIGTERM/SIGINT received — shutting down..."
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
