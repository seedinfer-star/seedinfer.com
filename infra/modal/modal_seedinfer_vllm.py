"""
SeedInfer Modal — freezer kontenerów VLLM dla NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4
App: seedinfer-nemotron-vllm  |  GPU: A100-80GB (W4A16 via NVFP4 checkpoint)
Gives OpenAI-compatible /v1/* via vLLM serve proxied through modal.web_server :8000
Cold-start opt: Volume pre-download + keep_warm=1, HF_TRANSFER enabled
Ref: vLLM 0.27.1+ recipe W4A16 Ampere https://huggingface.co/nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4
Note: Provider host ports obecnie 47900:8000 (vLLM) i 47901:3001 (agent) — zakres 479xx wolny (nie koliduje z 3000/3002/8004-8007), można nadpisać env VLLM_PORT/AGENT_PORT. Modal wewnętrzny :8000 pozostaje (nie host mapping).
"""

import modal
import os
import subprocess

APP_NAME = "seedinfer-nemotron-vllm"
MODEL_ID = "nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4"
SERVED_NAME = "seedinfer/nemotron-lightning-1m"

# ---- Volumes: HF cache + model weights (persist across cold starts) ----
hf_cache_vol = modal.Volume.from_name("seedinfer-hf-cache", create_if_missing=True)
model_vol = modal.Volume.from_name("seedinfer-model-cache", create_if_missing=True)

# ---- Image: CUDA 13.3 + py3.12 + vLLM nightly + flashinfer + hf_transfer ----
# Base: nvidia/cuda:13.3.0-devel-ubuntu24.04 — Blackwell native (GB202 / sm_120) + PTX JIT dla starszych wheels
# Fallback tags: 13.3.1-devel-ubuntu24.04, 13.2.1-devel-ubuntu24.04 (driver 570+), lub legacy 12.4.1-devel-ubuntu22.04 (driver 550+)
# CUDA 13.3 wymaga driver >=580.65 (575+ dla 13.2, 550+ dla 12.4). Modal GPU driver compat — wybierz image zgodnie z host driver.
# vLLM nightly wheels są wciąż cu12 (cu121/cu128) — działa na CUDA 13 via forward-compat PTX JIT. Native cu13 wheels gdy dostępne.
# flashinfer-python dokłada --mamba-backend flashinfer; mamba SSM używany w hybrid Nemotron — bez flashinfer fallback pytorch (wolniej).
image = (
    modal.Image.from_registry("nvidia/cuda:13.3.0-devel-ubuntu24.04", add_python="3.12")
    # system deps minimalne (curl dla health check, git dla hf)
    .apt_install("curl", "git")
    # HF transfer przyspiesza download ~5x vs vanilla; musi być przed vllm dla env propagacji
    .pip_install("huggingface_hub[hf_transfer]==0.34.3", "hf_transfer==0.1.9")
    # flashinfer — CUDA 13 preferuj cu13 nightly, fallback cu12 PTX JIT gdy cu13 niedostępny. Pin 0.6.x (API stabilne od 0.5)
    .pip_install("flashinfer-python==0.6.14")
    # vLLM nightly — zawiera humming MoE/linear backend ( --moe-backend humming --linear-backend humming )
    # oraz mamba flashinfer backend, modelopt_fp4 quantization (W4A16 na Ampere). CUDA 12.4 wheels ~2GB, działa na 13.3 via PTX JIT.
    .pip_install("vllm", pre=True, extra_index_url="https://wheels.vllm.ai/nightly")
    # dopisz compressed-tensors jeśli quantization modelopt_fp4 fallback wymaga (vllm zwykle już zależność)
    .pip_install("compressed-tensors==0.11.0")
    .env(
        {
            "HF_HUB_ENABLE_HF_TRANSFER": "1",
            "HF_HOME": "/root/.cache/huggingface",
            "VLLM_USE_V1": "1",
            # HuggingFace cache w Volume — nie /tmp
            "PYTHONUNBUFFERED": "1",
            # Host 1:1 RTX 5090 32GB (GB202) — FLASHINFER NVFP4 GEMM
            "VLLM_ATTENTION_BACKEND": "FLASHINFER",
            "VLLM_NVFP4_GEMM_BACKEND": "flashinfer-cutlass",
            "VLLM_USE_FLASHINFER_MOE_FP4": "1",
            "VLLM_USE_FLASHINFER_SAMPLER": "1",
            "PYTORCH_CUDA_ALLOC_CONF": "expandable_segments:False",
            "VLLM_ALLOW_LONG_MAX_MODEL_LEN": "1",
            "HF_HUB_OFFLINE": "0",
        }
    )
)

# Alt images (fallback gdy driver <580 lub tag niedostępny):
# image_cu13_2 = modal.Image.from_registry("nvidia/cuda:13.3.1-devel-ubuntu24.04", add_python="3.12") ...
# image_cu13_legacy = modal.Image.from_registry("nvidia/cuda:13.2.1-devel-ubuntu24.04", add_python="3.12") ... # driver 570+
# image_cu12 = modal.Image.from_registry("nvidia/cuda:12.4.1-devel-ubuntu22.04", add_python="3.12") ... # driver 550+ legacy

# ---- Build-time pre-download (cold-start opt) ----
# Opcjonalne: pre-populuj volume przy build — nie blokuje pierwszego run, ale pozwala wstępnie ściągnąć ~20GB.
# Użyj `modal run infra/modal/modal_seedinfer_vllm.py::download_weights` lokalnie raz, lub odkomentuj run_function:
#
# def _download_weights():
#     from huggingface_hub import snapshot_download
#     snapshot_download(repo_id=MODEL_ID, local_dir="/root/.cache/huggingface/hub", max_workers=8)
#
# image = image.run_function(_download_weights, volumes={"/root/.cache/huggingface": hf_cache_vol}, timeout=3600)

app = modal.App(name=APP_NAME, image=image)

# vLLM flags — host 1:1 RTX 5090 32GB GB202 (marlin + fp8, 0.93, 128/4096, flashinfer)
# Host docker run (jakub-b550m):
#   --model nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4 --served-model-name nemotron-3.5-lightning-30b-a3b-nvfp4 --quantization modelopt --dtype bfloat16 --kv-cache-dtype fp8 --max-model-len 1048576 --gpu-memory-utilization 0.93 --max-num-seqs 128 --max-num-batched-tokens 4096 --enable-chunked-prefill --enable-prefix-caching --moe-backend marlin --mamba-backend flashinfer --mamba-cache-mode align --chat-template /mnt/d/qwen_setup/nemotron_lightning_chat_template_nothink2.jinja --enable-auto-tool-choice --tool-call-parser nemotron3 --tool-parser-plugin /mnt/d/qwen_setup/nemotron3_tool_parser_plugin.py --trust-remote-code --language-model-only
# Modal A100-80GB fallback: te same flagi marlin+fp8 0.93 128/4096 + FLASHINFER envs (nie humming). Host nie ma --async-scheduling, --linear-backend, --mamba-ssu-algorithm, --reasoning-parser — usunięte.
# NOTE: marlin na Blackwell ma native FP4 tensor cores; na A100 humming W4A16 emuluje FP4 — dla A100 można nadpisać env VLLM_MOE_BACKEND=humming jeśli potrzeba, ale default host marlin dla spójności 32GB.
VLLM_CMD = [
    "vllm",
    "serve",
    MODEL_ID,
    "--host",
    "0.0.0.0",
    "--port",
    "8000",
    "--served-model-name",
    SERVED_NAME,
    "--quantization",
    "modelopt",
    "--dtype",
    "bfloat16",
    "--kv-cache-dtype",
    "fp8",
    "--max-model-len",
    "1048576",
    "--gpu-memory-utilization",
    "0.93",
    "--max-num-seqs",
    "128",
    "--max-num-batched-tokens",
    "4096",
    "--enable-chunked-prefill",
    "--enable-prefix-caching",
    "--moe-backend",
    "marlin",
    "--mamba-backend",
    "flashinfer",
    "--mamba-cache-mode",
    "align",
    "--enable-auto-tool-choice",
    "--tool-call-parser",
    "nemotron3",
    "--trust-remote-code",
    "--language-model-only",
    # chat-template / plugin z hosta — na Modal HF tokenizer_config.json fallback (nie mount /mnt/d), opcjonalnie odkomentuj jeśli zbundlujesz assets:
    # "--chat-template", "/qwen_setup/nemotron_lightning_chat_template_nothink2.jinja",
    # "--tool-parser-plugin", "/qwen_setup/nemotron3_tool_parser_plugin.py",
    # Jeśli A100 40GB fallback: zmniejsz --gpu-memory-utilization 0.85, ewentualnie --max-model-len 262144
]


@app.function(
    image=image,
    # GPU: A100-80GB primary; fallback A100-40GB gdy 80GB niedostępny — zmień na "A100" lub "A100-40GB"
    gpu="A100-80GB",
    # memory: 64GB RAM container (Modal expects MB? docs: memory=65536 == 64GB)
    memory=65536,
    # timeout całości kontenera (cold start + request) — 3600s wg spec
    timeout=3600,
    # startup_timeout: czas na wgranie wag + kompilacja (900s = 15min dla ~20GB download)
    startup_timeout=900,
    # keep_warm=1 → Modal próbuje trzymać 1 kontener ciepły (min_containers)
    min_containers=1,
    scaledown_window=600,
    # Volumes: HF cache mount + opcjonalny model volume (dzielony cache)
    volumes={
        "/root/.cache/huggingface": hf_cache_vol,
        "/models": model_vol,
    },
    # env dla runtime (host 1:1 FLASHINFER + NVFP4 GEMM)
    env={
        "HF_HUB_ENABLE_HF_TRANSFER": "1",
        "VLLM_USE_V1": "1",
        "VLLM_ATTENTION_BACKEND": "FLASHINFER",
        "VLLM_NVFP4_GEMM_BACKEND": "flashinfer-cutlass",
        "VLLM_USE_FLASHINFER_MOE_FP4": "1",
        "VLLM_USE_FLASHINFER_SAMPLER": "1",
        "PYTORCH_CUDA_ALLOC_CONF": "expandable_segments:False",
        "VLLM_ALLOW_LONG_MAX_MODEL_LEN": "1",
        "HF_HUB_OFFLINE": "0",
    },
)
@modal.concurrent(max_inputs=128)  # host 128 seq (nie 256), 4096 batched — async-scheduling usunięte jak host
@modal.web_server(8000, startup_timeout=900)
def serve():
    """
    Freezer: uruchamia `vllm serve` w kontenerze i expose przez Modal web_server :8000
    OpenAI-compatible: /v1/chat/completions, /v1/completions, /v1/models, /health
    Modal public URL: https://<workspace>--seedinfer-nemotron-vllm-serve.modal.run
    """
    # Popen nie czeka — modal web_server proxy czeka aż :8000 wstanie (wait_for_web_server)
    # Logi vLLM idą do stdout kontenera → modal app logs
    print(f"[seedinfer] starting: {' '.join(VLLM_CMD)}", flush=True)
    proc = subprocess.Popen(VLLM_CMD)
    try:
        proc.wait()
    finally:
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=10)
            except subprocess.TimeoutExpired:
                proc.kill()


# ---- Opcjonalne helpers (lokalne) ----

@app.function(
    image=image,
    volumes={"/root/.cache/huggingface": hf_cache_vol},
    timeout=3600,
    memory=8192,
)
def download_weights():
    """Pre-download wag do Volume (uruchom raz: modal run infra/modal/modal_seedinfer_vllm.py::download_weights)."""
    from huggingface_hub import snapshot_download

    print(f"[download] {MODEL_ID} -> /root/.cache/huggingface", flush=True)
    path = snapshot_download(
        repo_id=MODEL_ID,
        max_workers=8,
        # hf_transfer auto gdy HF_HUB_ENABLE_HF_TRANSFER=1
    )
    print(f"[download] done: {path}", flush=True)
    hf_cache_vol.commit()
    return path


@app.local_entrypoint()
def main():
    """Lokalny smoke: wypisz deploy info, nie deployuje faktycznie w WSL bez GPU."""
    print(f"App: {APP_NAME}")
    print(f"Model: {MODEL_ID} (served as {SERVED_NAME})")
    print(f"Image: nvidia/cuda:13.3.0-devel-ubuntu24.04 (fallback 13.3.1/13.2.1, legacy 12.4.1) + vllm nightly + flashinfer-python 0.6.14 + FLASHINFER envs")
    print("Flags: --quantization modelopt --kv-cache-dtype fp8 --moe-backend marlin --mamba-backend flashinfer --max-num-seqs 128 --max-num-batched-tokens 4096 --gpu-memory-utilization 0.93 --enable-chunked-prefill --enable-prefix-caching --tool-call-parser nemotron3 (host 1:1)")
    print("Driver: >=580.65 for CUDA 13.3 Blackwell (570+ for 13.2, 550+ for 12.4 legacy)")
    print("GPU: A100-80GB  memory: 64GB  timeout: 3600  concurrent: 128  keep_warm: 1  env: FLASHINFER+NVFP4 GEMM flashinfer-cutlass")
    print("Volumes: seedinfer-hf-cache -> /root/.cache/huggingface , seedinfer-model-cache -> /models")
    print("\nDeploy per profile:")
    print("  modal deploy infra/modal/modal_seedinfer_vllm.py")
    print("  # lub na wszystkie: bash infra/modal/setup-all-accounts.sh")
    print("\nTest after deploy:")
    print("  curl https://<workspace>--seedinfer-nemotron-vllm-serve.modal.run/v1/models | jq")
    print('  curl https://<url>/v1/chat/completions -H "Content-Type: application/json" \\')
    print('    -d \'{"model":"seedinfer/nemotron-lightning-1m","messages":[{"role":"user","content":"Hello"}],"max_tokens":32}\'')
