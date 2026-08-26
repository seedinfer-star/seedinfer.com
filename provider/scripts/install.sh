#!/usr/bin/env bash
# SeedInfer Provider — one-liner installer (Faza 0, CUDA only)
# Użycie (polecane — jedna komenda, auto-authkey + prebuild):
#   curl -fsSL https://seedinfer.com/install.sh | bash
# Warianty:
#   curl -fsSL https://seedinfer.com/install.sh | bash -s -- --authkey hskey-xxx --model seedinfer/nemotron-lightning-1m
#   curl -fsSL https://seedinfer.com/install.sh | bash -s -- --authkey xxx --model openai/gpt-oss-20b --gateway https://seedinfer.com --hostname provider-5090
#   SEEDINFER_PREBUILD_URL=https://seedinfer.com/provider-image.tar.gz SEEDINFER_PREBUILD_IMAGE=ghcr.io/seedinfer/provider:cuda13.3-nvfp4 curl -fsSL https://seedinfer.com/install.sh | bash
set -euo pipefail

GATEWAY="https://seedinfer.com"
LOGIN_SERVER="https://tailnet.seedinfer.com"
MODEL="seedinfer/nemotron-lightning-1m"
VLLM_MODEL="nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4"
AUTHKEY=""
# --- HOSTNAME sanitization (DNS label RFC1123: [a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?) ---
# FIX: cut -c1-12 na "jakub-B550M-AORUS-ELITE" dawał "jakub-B550M-" kończące się "-" -> invalid DNS label.
sanitize_hostname() {
  # args: raw string -> sanitized lowercase DNS-safe, max 12 chars, nigdy nie kończy się "-"
  local raw="${1:-}"
  local s
  s=$(echo "$raw" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9-' '-' | sed 's/^-//;s/-$//')
  s=$(echo "$s" | cut -c1-12 | sed 's/-$//')
  if [[ -z "$s" ]]; then s="5090"; fi
  s=$(echo "$s" | sed 's/^-//;s/-$//')
  if [[ -z "$s" ]]; then s="5090"; fi
  # must end with alnum
  if ! [[ "$s" =~ [a-z0-9]$ ]]; then s="${s}-5090"; s=$(echo "$s" | tr -cs 'a-z0-9-' '-' | sed 's/^-//;s/-$//' | cut -c1-12 | sed 's/-$//'); fi
  if [[ -z "$s" ]]; then s="5090"; fi
  echo "$s"
}
_raw_host="$(hostname 2>/dev/null || echo 5090)"
HOSTNAME="provider-$(sanitize_hostname "$_raw_host")"
# final DNS validation fallback
if ! [[ "$HOSTNAME" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]]; then
  HOSTNAME="provider-5090"
fi
# Tailscale join policy: wpinamy w sieć na kroku 2 (po checks, przed docker), żeby provider od razu dostał 100.64.x.x i mógł heartbeat.
# Domyślnie: kontener (bezpieczne, nie rusza hosta) gdy host już w tailscale.com (100.94.x.x) — izolacja Headscale 100.64.x.x.
# SKIP_TAILSCALE=1 dla testów offline; TAILSCALE_USE_CONTAINER=1 wymusza kontener; FORCE_HOST_TAILSCALE=1 wymusza host --reset --force-reauth.
SKIP_TAILSCALE="${SKIP_TAILSCALE:-0}"
# SEEDINFER_SKIP_TAILSCALE alias — fast path dla publicznego testu bez tailnet (idź prosto do docker)
if [[ "${SEEDINFER_SKIP_TAILSCALE:-0}" == "1" ]]; then SKIP_TAILSCALE=1; fi
# Track czy user jawnie ustawił TAILSCALE_USE_CONTAINER (dla env override 0 = advanced disable auto-container)
if [[ -v TAILSCALE_USE_CONTAINER ]]; then
  _TAILSCALE_USER_SET=1
else
  _TAILSCALE_USER_SET=0
fi
TAILSCALE_USE_CONTAINER="${TAILSCALE_USE_CONTAINER:-0}"
FORCE_HOST_TAILSCALE="${FORCE_HOST_TAILSCALE:-0}"
EXTRA_ARGS=""
INSTALL_DIR="/opt/seedinfer-provider"
REPO_URL="https://github.com/seedinfer-star/seedinfer.com.git" # public clone (org seedinfer 404, use star)
# Robust defaults — fix invalid containerPort gdy VLLM_PORT/AGENT_PORT pusty (env override "")
VLLM_PORT=${VLLM_PORT:-47900}; [ -z "$VLLM_PORT" ] && VLLM_PORT=47900
AGENT_PORT=${AGENT_PORT:-47901}; [ -z "$AGENT_PORT" ] && AGENT_PORT=47901
# --- Prebuild (Pi + ghcr) ---
# Primary: ghcr.io pull (x86_64 CUDA image zbudowany na hoście 5090, wypchnięty via scripts/publish-provider-image.sh)
# Fallback: Pi tar via https://seedinfer.com/provider-image.tar.gz (docker save | gzip na Pi /opt/seedinfer/public, serwowany przez Caddy/Next)
# Fallback2: lokalny docker compose build (~28GB + 30GB HF, wolny)
# Orange Pi 4 Pro (ARM) nie buduje CUDA image — tylko hostuje tar/registry mirror.
PREBUILD_IMAGE="${SEEDINFER_PREBUILD_IMAGE:-ghcr.io/seedinfer/provider:cuda13.3-nvfp4}"
PREBUILD_URL="${SEEDINFER_PREBUILD_URL:-https://seedinfer.com/provider-image.tar.gz}"
# Opcjonalnie registry na Pi (via Headscale): SEEDINFER_REGISTRY=gateway.seedinfer.ts.net:5000 — używany jako dodatkowy fallback pull
PREBUILD_REGISTRY="${SEEDINFER_REGISTRY:-}"
SKIP_PREBUILD="${SEEDINFER_SKIP_PREBUILD:-0}"
# --- 16GB RAM guard: priorytet prebuild, nie lokalny build na 16GB (21GB Build Cache + torch.compile 12s + HF 21G freeze) ---
# Spec: if [ $(free -g | awk '/Mem:/ {print $7}') -lt 16 ]; then echo "WARN: 16GB wymagane, używam prebuild pull, nie lokalny build"; SKIP_BUILD=1; fi
if [ $(free -g | awk '/Mem:/ {print $7}') -lt 16 ]; then echo "WARN: 16GB wymagane, używam prebuild pull, nie lokalny build"; SKIP_BUILD=1; fi
SKIP_BUILD="${SKIP_BUILD:-0}"
# Dodatkowy free -m check (available <16000) — spójny z entrypoint VLLM_MAX_MODEL_LEN=131072
if [ "$(free -m 2>/dev/null | awk '/Mem:/ {print $7}' || echo 99999)" -lt 16000 ] 2>/dev/null; then
  if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
    echo "WARN: 16GB wymagane (free -m available <16000), używam prebuild pull, nie lokalny build"
    SKIP_BUILD=1
  fi
fi
if [[ "$SKIP_BUILD" == "1" ]]; then
  echo "INFO: SKIP_BUILD=1 (16GB guard) — wymuszam prebuild pull/load (8GB image / 65K tar + 8GB load), pomijam lokalny docker build (21GB cache)"
  # enforce SKIP_PREBUILD=0 to force prebuild path
  SKIP_PREBUILD=0
fi

usage() {
  cat <<EOF
SeedInfer Provider installer (CUDA + vLLM nightly + Headscale) — NVFP4 plug-and-play

Polecane (jedna komenda, auto-authkey + prebuild):
  curl -fsSL https://seedinfer.com/install.sh | bash

Z kluczami / opcjami:
  curl -fsSL https://seedinfer.com/install.sh | bash -s -- --authkey KEY --model MODEL --gateway URL --hostname NAME

Opcje:
  --authkey KEY        Tailscale preauth key (tag:provider) — opcjonalne, jeśli brak to auto-fetch z \$GATEWAY/api/v1/auth/request
  --model MODEL        Model logiczny (default: $MODEL)
  --vllm-model REPO    HF repo dla vLLM (default: $VLLM_MODEL)
                       Jeśli --model nie podany, użyty zostanie NVFP4 (plug-and-play, ~30GB download).
  --gateway URL        SeedInfer gateway (default: $GATEWAY)
  --login-server URL   Headscale control plane (default: $LOGIN_SERVER)
  --hostname NAME      Tailscale hostname (default: $HOSTNAME) — sanitizowany do DNS label
  --dir PATH           Katalog instalacji (default: $INSTALL_DIR)
  --skip-tailscale     Pomiń tailscale up (offline/testy) — env SKIP_TAILSCALE=1
  --force-host-tailscale  Wymuś przełączenie hostowego tailscale na Headscale (control plane switch z tailscale.com -> $LOGIN_SERVER) — wymaga --reset --force-reauth, rozłączy tailscale.com (utracisz MagicDNS *.ts.net, 100.94.x.x routing, --operator). Domyślnie: kontener (bezpieczne, nie rusza hosta). --force-host-tailscale to opt-in do starego zachowania (--reset --force-reauth na hoście).
  --help               Pomoc

ENV (prebuild):
  SEEDINFER_PREBUILD_IMAGE=ghcr.io/seedinfer/provider:cuda13.3-nvfp4  # docker pull primary
  SEEDINFER_PREBUILD_URL=https://seedinfer.com/provider-image.tar.gz # Pi tar fallback (docker load)
  SEEDINFER_REGISTRY=gateway.seedinfer.ts.net:5000                    # opcjonalny registry:2 na Pi
  SEEDINFER_SKIP_PREBUILD=1  # wymuś lokalny build (pomiń pull/load)

ENV (tailscale):
  SKIP_TAILSCALE=1            # pomiń tailscale up (offline/test)
  SEEDINFER_SKIP_TAILSCALE=1  # alias dla SKIP_TAILSCALE — fast path bez tailnet prosto do docker (dla publicznego testu)
  TAILSCALE_USE_CONTAINER=1   # wymuś kontener tailscale-seedinfer (Headscale) — nie rusza hosta (isolated 100.64.x.x vs host 100.94.x.x tailscale.com)
  TAILSCALE_USE_CONTAINER=0   # advanced: wyłącz auto-kontener, wymuś host (nawet gdy host w tailscale.com) — wymaga sudo --reset --force-reauth
  FORCE_HOST_TAILSCALE=1      # opt-in: przełącz hosta z tailscale.com na Headscale (--reset --force-reauth, rozłączy tailscale.com) — domyślnie kontener, nie host
  # Domyślnie: auto — jeśli host ma Running tailscale.com (BackendState Running, control != seedinfer) -> kontener tailscale-seedinfer (Headscale 100.64.x.x) obok hosta 100.94.x.x, bez --force-host-tailscale

Hostname: sanitizowany do DNS RFC1123 (lowercase, [a-z0-9-], max 12ch suffix, nie kończy się "-"), np. jakub-B550M-AORUS-ELITE -> provider-jakub-b550m

Wymagania: Ubuntu 24.04+, NVIDIA driver 580+ (580.65+ dla CUDA 13.3 Blackwell, fallback 570+ dla 13.2 / 550+ legacy), CUDA 13.3+, Docker, nvidia-container-toolkit, tailscale
NVFP4: 30B/3B MoE+Mamba, ~16GB VRAM min (32GB zalecane RTX 5090 32GB GB202), CUDA 13.3 nightly, HF cache ~30GB
Prebuild: ghcr.io (primary, ~8-15GB gzip) || Pi tar (fallback, curl | docker load) || docker compose build
EOF
}

CUSTOM_MODEL=false
CUSTOM_VLLM=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --authkey) AUTHKEY="$2"; shift 2 ;;
    --model) MODEL="$2"; CUSTOM_MODEL=true; shift 2 ;;
    --vllm-model) VLLM_MODEL="$2"; CUSTOM_VLLM=true; shift 2 ;;
    --gateway) GATEWAY="$2"; shift 2 ;;
    --login-server) LOGIN_SERVER="$2"; shift 2 ;;
    --hostname) HOSTNAME="$2"; shift 2 ;;
    --dir) INSTALL_DIR="$2"; shift 2 ;;
    --skip-tailscale) SKIP_TAILSCALE=1; shift ;;
    --force-host-tailscale) FORCE_HOST_TAILSCALE=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Nieznana opcja: $1" >&2; usage; exit 1 ;;
  esac
done
# --- sanitize HOSTNAME supplied via --hostname/env (or default) ---
# zachowaj prefix provider- sanitizując tylko suffix aby nie złamać DNS label
if [[ "$HOSTNAME" == provider-* ]]; then
  _suffix="${HOSTNAME#provider-}"
  _san_suffix="$(echo "$_suffix" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9-' '-' | sed 's/^-//;s/-$//' | cut -c1-12 | sed 's/-$//')"
  [[ -z "$_san_suffix" ]] && _san_suffix="5090"
  HOSTNAME="provider-${_san_suffix}"
else
  _san="$(echo "$HOSTNAME" | tr '[:upper:]' '[:lower:]' | tr -cs 'a-z0-9-' '-' | sed 's/^-//;s/-$//' | cut -c1-32 | sed 's/-$//')"
  [[ -z "$_san" ]] && _san="provider-5090"
  HOSTNAME="$_san"
fi
if ! [[ "$HOSTNAME" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]]; then
  echo "WARN: hostname \"$HOSTNAME\" nievalid DNS — fallback provider-5090" >&2
  HOSTNAME="provider-5090"
fi
# Plug-and-play NVFP4: jeśli --model nie podany, użyj default NVFP4 dla VLLM_MODEL
if [[ "$CUSTOM_MODEL" == true && "$CUSTOM_VLLM" == false ]]; then
  # jeśli user podał inny MODEL (np. gpt-oss), zsynchronizuj VLLM_MODEL
  if [[ "$MODEL" != "seedinfer/nemotron-lightning-1m" ]]; then
    VLLM_MODEL="$MODEL"
  fi
fi
# Jeśli VLLM_MODEL pusty (nie powinien), fallback do NVFP4
if [[ -z "$VLLM_MODEL" ]]; then
  VLLM_MODEL="nvidia/NVIDIA-Nemotron-3.5-Lightning-30B-A3B-NVFP4"
fi

# --- Auto-authkey: jeśli --authkey brak, fetch z gateway ---
if [[ -z "$AUTHKEY" ]]; then
  echo "-- brak --authkey, próbuję auto-fetch z $GATEWAY/api/v1/auth/request ..."
  AUTHKEY_FETCHED=""
  if command -v curl >/dev/null 2>&1; then
    # próbuj jq first
    if command -v jq >/dev/null 2>&1; then
      AUTHKEY_FETCHED=$(curl -fsS --max-time 10 "$GATEWAY/api/v1/auth/request" 2>/dev/null | jq -r .authkey 2>/dev/null || true)
    fi
    if [[ -z "$AUTHKEY_FETCHED" || "$AUTHKEY_FETCHED" == "null" ]]; then
      AUTHKEY_FETCHED=$(curl -fsS --max-time 10 "$GATEWAY/api/v1/auth/request" 2>/dev/null | grep -o '"authkey"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n1 | cut -d'"' -f4 || true)
    fi
    if [[ -z "$AUTHKEY_FETCHED" || "$AUTHKEY_FETCHED" == "null" ]]; then
      # python fallback (bez jq)
      if command -v python3 >/dev/null 2>&1; then
        AUTHKEY_FETCHED=$(curl -fsS --max-time 10 "$GATEWAY/api/v1/auth/request" 2>/dev/null | python3 -c "import sys,json;print(json.load(sys.stdin).get('authkey',''))" 2>/dev/null || true)
      fi
    fi
  else
    echo "WARN: curl nie znalezione — nie można auto-fetch authkey" >&2
  fi
  if [[ -n "$AUTHKEY_FETCHED" && "$AUTHKEY_FETCHED" != "null" && ${#AUTHKEY_FETCHED} -ge 10 ]]; then
    AUTHKEY="$AUTHKEY_FETCHED"
    # mask dla logów
    MASKED="$(echo "$AUTHKEY" | cut -c1-12)..."
    echo "Authkey auto-fetched OK (${#AUTHKEY} chars, $MASKED) — tag:provider, ważny 24h"
  else
    echo "BŁĄD: --authkey nie podano i auto-fetch z $GATEWAY/api/v1/auth/request nie powiódł się" >&2
    echo "Hint: wygeneruj ręcznie: curl -fsSL $GATEWAY/api/v1/auth/request | jq -r .authkey" >&2
    echo "Lub podaj: curl -fsSL $GATEWAY/install.sh | bash -s -- --authkey YOUR_AUTHKEY" >&2
    echo "Czekam 2s i pokazuję pomoc..." >&2
    sleep 2
    usage
    exit 1
  fi
else
  echo "-- użyto podanego --authkey (${#AUTHKEY} chars)"
fi

echo "== SeedInfer Provider installer =="
echo " gateway:   $GATEWAY"
echo " tailnet:   $LOGIN_SERVER"
echo " model:     $MODEL"
echo " vllm_model:$VLLM_MODEL (HF repo, auto-download ~30GB, NVFP4 plug-and-play)"
echo " host:      $HOSTNAME"
echo " dir:       $INSTALL_DIR"
echo " prebuild:  $PREBUILD_IMAGE (primary ghcr) || $PREBUILD_URL (Pi tar fallback) || local build"

# 1) CUDA check
if ! command -v nvidia-smi >/dev/null 2>&1; then
  echo "BŁĄD: nvidia-smi nie znalezione — zainstaluj NVIDIA driver 580+ (CUDA 13.3 Blackwell, https://docs.nvidia.com/cuda/cuda-installation-guide-linux/) — fallback 570+ dla 13.2, 550+ legacy 12.4" >&2
  exit 1
fi
echo "-- nvidia-smi --"
nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv || nvidia-smi
# --- robust CUDA/driver parsing (fix: grep -oP zawodzi gdy brak PCRE / header bez CUDA) ---
DRIVER_VER=""
CUDA_VER=""
# driver: prefer query (always works), fallback to nvidia-smi header parsing
DRIVER_VER=$(nvidia-smi --query-gpu=driver_version --format=csv,noheader 2>/dev/null | head -n1 | tr -d ' ' || true)
if [[ -z "$DRIVER_VER" ]]; then
  DRIVER_VER=$(nvidia-smi 2>&1 | grep -Eo 'Driver Version: [0-9.]+' | grep -Eo '[0-9.]+' | head -n1 || true)
fi
if [[ -z "$DRIVER_VER" ]]; then
  DRIVER_VER=$(nvidia-smi 2>&1 | grep -oP 'Driver Version: \K[0-9.]+' 2>/dev/null | head -n1 || true)
fi
[[ -z "$DRIVER_VER" ]] && DRIVER_VER="unknown"
# cuda: header may be "CUDA Version: 13.0" or missing/background
CUDA_VER=$(nvidia-smi 2>&1 | grep -Eo 'CUDA Version: [0-9.]+' | grep -Eo '[0-9.]+' | head -n1 || true)
if [[ -z "$CUDA_VER" ]]; then
  CUDA_VER=$(nvidia-smi 2>&1 | grep -oP 'CUDA Version: \K[0-9.]+' 2>/dev/null | head -n1 || true)
fi
[[ -z "$CUDA_VER" ]] && CUDA_VER="unknown"
# graceful display: never "unknown" when driver knows
if [[ "$DRIVER_VER" != "unknown" ]]; then
  _maj_drv=$(echo "$DRIVER_VER" | cut -d. -f1)
  if [[ "$_maj_drv" -ge 580 ]]; then
    _drv_disp="$DRIVER_VER (OK 580+)"
  else
    _drv_disp="$DRIVER_VER (wymagane 580+ dla CUDA 13.3 Blackwell)"
  fi
else
  _drv_disp="unknown (wymagane 580+)"
fi
if [[ "$CUDA_VER" != "unknown" ]]; then
  # show zalecane if <13.3
  _cuda_major=$(echo "$CUDA_VER" | cut -d. -f1)
  _cuda_minor=$(echo "$CUDA_VER" | cut -d. -f2)
  if [[ "$_cuda_major" -gt 13 ]] || { [[ "$_cuda_major" -eq 13 ]] && [[ "${_cuda_minor:-0}" -ge 3 ]]; }; then
    _cuda_disp="$CUDA_VER (OK 13.3+)"
  else
    _cuda_disp="$CUDA_VER (13.3 zalecane, fallback 12.4+)"
  fi
else
  _cuda_disp="unknown"
fi
echo "CUDA driver: $_cuda_disp  Driver: $_drv_disp"
# warn logic: nie warnuj jeśli driver >=580 nawet gdy CUDA unknown/<13.3 (PTX JIT)
if [[ "$CUDA_VER" != "unknown" ]]; then
  _need_warn=false
  if ! echo "$CUDA_VER" | grep -qE '^1[3-9]\.'; then _need_warn=true; fi
  # refine: <13.3
  if [[ "$_cuda_major" -eq 13 && "${_cuda_minor:-0}" -lt 3 ]]; then _need_warn=true; fi
  if [[ "$_cuda_major" -lt 13 ]]; then _need_warn=true; fi
  if [[ "$_need_warn" == true ]]; then
    if [[ "$DRIVER_VER" != "unknown" && "$_maj_drv" -ge 580 ]]; then
      echo "INFO: CUDA $_cuda_disp (<13.3 zalecane) ale driver $_drv_disp OK (>=580) — kontynuuję (PTX JIT Blackwell fallback)." >&2
    else
      echo "WARN: CUDA <13.3 — zalecane CUDA 13.3 (driver 580+) dla Blackwell GB202. CUDA 12.4 fallback działa via PTX JIT ale bez Blackwell native." >&2
    fi
  fi
else
  if [[ "$DRIVER_VER" != "unknown" && "$_maj_drv" -ge 580 ]]; then
    echo "INFO: CUDA version nie wykryta (nvidia-smi header bez CUDA Version), driver $DRIVER_VER OK (>=580) — kontynuuję." >&2
  else
    echo "WARN: CUDA unknown i driver $DRIVER_VER <580 — zalecane CUDA 13.3 (driver 580+)" >&2
  fi
fi
if [[ "$DRIVER_VER" != "unknown" ]]; then
  MAJ=$(echo "$DRIVER_VER" | cut -d. -f1)
  if [[ "$MAJ" -lt 580 ]]; then
    echo "WARN: Driver $DRIVER_VER <580 — CUDA 13.3 wymaga 580.65+. Zaktualizuj: sudo apt install nvidia-driver-580 lub ubuntu-drivers autoinstall" >&2
  fi
fi

# --- NVFP4 verification: VRAM >=24GB oraz HF model check ---
echo "-- weryfikacja NVFP4 --"
VRAM_MB=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | head -n1 | tr -d ' ' || echo "0")
echo "VRAM total: ${VRAM_MB}MB (minimum 32GB zalecane dla 1M ctx — RTX 5090 32GB GB202)"
if [[ "$VRAM_MB" != "0" && "$VRAM_MB" -lt 16000 ]]; then
  echo "BŁĄD: GPU VRAM ${VRAM_MB}MB <16GB — NVFP4 wymaga >=16GB (minimum 32GB zalecane RTX 5090 32GB dla 1M ctx komfortowo)." >&2
  echo "Hint: NVFP4 30B ~16-22GB + ~6GB KV dla 1M ctx = ~22-28GB. Zmniejsz VLLM_MAX_MODEL_LEN=32768 i VLLM_GPU_MEMORY_UTILIZATION=0.80 lub użyj mniejszego modelu." >&2
  echo "Jeśli mimo tego chcesz kontynuować, ustaw IGNORE_VRAM_CHECK=1" >&2
  if [[ "${IGNORE_VRAM_CHECK:-0}" != "1" ]]; then
    exit 1
  fi
elif [[ "$VRAM_MB" != "0" && "$VRAM_MB" -lt 32000 ]]; then
  echo "WARN: GPU VRAM ${VRAM_MB}MB <32GB — NVFP4 działa (~16-22GB + 6GB KV), ale 32GB zalecane dla 1M ctx (RTX 5090 32GB). Jeśli OOM, ustaw VLLM_MAX_MODEL_LEN=131072 i VLLM_GPU_MEMORY_UTILIZATION=0.85." >&2
  if [[ "$VRAM_MB" -lt 24000 ]]; then
    echo "WARN: VRAM <24GB — dla 1M ctx konieczne VLLM_GPU_MEMORY_UTILIZATION=0.80 i VLLM_MAX_MODEL_LEN=32768." >&2
  fi
else
  echo "VRAM OK (>=32GB) — NVFP4 1M ctx komfortowo (RTX 5090 32GB, A100/H100, L40S etc)."
fi

# --- Dysk check (generyczny: avail -> need 60G, remains ~avail-60G; bez host-specific 932G logu) ---
echo "-- sprawdzam dysk /mnt/d --"
df -h /mnt/d 2>/dev/null || df -h . 2>/dev/null | head -n 5
if command -v df >/dev/null 2>&1; then
  AVAIL_GB=$(df -BG /mnt/d 2>/dev/null | awk 'NR==2{print $4}' | tr -d 'G' || df -BG . 2>/dev/null | awk 'NR==2{print $4}' | tr -d 'G' || echo "0")
  USED_PCT=$(df -h /mnt/d 2>/dev/null | awk 'NR==2{print $5}' || echo "?")
  FREE_H=$(df -h /mnt/d 2>/dev/null | awk 'NR==2{print $4}' || df -h . 2>/dev/null | awk 'NR==2{print $4}' || echo "?")
  echo "Dysk /mnt/d: avail ${FREE_H} (${AVAIL_GB}G), used ${USED_PCT} — provider potrzebuje ~60GB (vllm 28.8GB + NVFP4 ~30GB + cache), zostanie ~$((${AVAIL_GB}-60))G (avail ${AVAIL_GB}G - 60G need, remains ~$((${AVAIL_GB}-60))G). Sprawdź df -h /mnt/d"
  if [[ "$AVAIL_GB" != "0" && "$AVAIL_GB" -lt 60 ]]; then
    echo "WARN: mało miejsca na /mnt/d (${AVAIL_GB}G free <60GB). Cleanup: docker system prune -a ; rm -rf /mnt/d/hf_cache/.../snapshots; rm -rf ./models/cache ; docker system prune" >&2
  else
    echo "Dysk OK: ${AVAIL_GB}G free >=60GB wymagane (avail ${AVAIL_GB}G -> need 60G, remains ~$((${AVAIL_GB}-60))G)"
  fi
fi

# HF model existence check (via HEAD, optional)
if command -v curl >/dev/null 2>&1; then
  HF_CHECK_URL="https://huggingface.co/api/models/${VLLM_MODEL}"
  echo "Sprawdzam HF model ${VLLM_MODEL} ..."
  if curl -fsS --max-time 10 -I "$HF_CHECK_URL" >/dev/null 2>&1; then
    echo "HF model OK: $VLLM_MODEL"
  else
    # fallback via python huggingface_hub if available
    if command -v python3 >/dev/null 2>&1 && python3 -c "from huggingface_hub import model_info; model_info('${VLLM_MODEL}')" >/dev/null 2>&1; then
      echo "HF model OK via huggingface_hub: $VLLM_MODEL"
    else
      echo "WARN: HF model ${VLLM_MODEL} nie odpowiada na HEAD — może offline lub wymaga HF_TOKEN (gated). Kontynuuję; vLLM zweryfikuje przy starcie." >&2
      if [[ -n "${HF_TOKEN:-}" ]]; then echo "HF_TOKEN set — vLLM użyje go do download."; fi
    fi
  fi
fi

# 2) Docker
if ! command -v docker >/dev/null 2>&1; then
  echo "-- instaluję Docker --"
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER" || true
fi
if ! docker info >/dev/null 2>&1; then
  echo "INFO: docker wymaga sudo — używam sudo docker"
  DOCKER="sudo docker"
else
  DOCKER="docker"
fi
# nvidia-container-toolkit
if ! $DOCKER info 2>&1 | grep -qi nvidia && ! command -v nvidia-ctk >/dev/null 2>&1; then
  echo "-- instaluję nvidia-container-toolkit --"
  distribution=$(. /etc/os-release; echo "$ID$VERSION_ID")
  curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg
  curl -s -L "https://nvidia.github.io/libnvidia-container/${distribution}/libnvidia-container.list" | sed 's#deb https://#deb [signed-by=\/usr\/share\/keyrings\/nvidia-container-toolkit-keyring.gpg] https:\/\/#g' | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list >/dev/null
  sudo apt-get update -qq
  sudo apt-get install -y nvidia-container-toolkit
  sudo nvidia-ctk runtime configure --runtime=docker
  sudo systemctl restart docker || true
fi
# compose plugin
if ! $DOCKER compose version >/dev/null 2>&1; then
  echo "-- instaluję docker compose plugin --"
  sudo apt-get update -qq && sudo apt-get install -y docker-compose-plugin
fi

# 3) Tailscale — KIEDY WPINAĆ W SIEĆ: na kroku 2 (po checks CUDA/VRAM/dysk, PRZED docker compose).
#   Dlaczego: agent heartbeat (co 30s do $GATEWAY/api/v1/providers/heartbeat) wymaga od razu 100.64.x.x;
#   docker compose bez tailnet nie poda IP gateway.seedinfer.ts.net. Gdyby wpięcie było po dockerze,
#   pierwsze heartbeaty by failowały i weryfikacja opóźniła się o minuty. Dlatego tailscale up jest
#   wcześnie, ale już po walidacji HOSTNAME (sanitized DNS) — żeby invalid hostname nie przerywał całego flow.
#   --skip-tailscale / SKIP_TAILSCALE=1 dla testów offline; TAILSCALE_USE_CONTAINER=1 dla userspace bez sudo.
if [[ "$SKIP_TAILSCALE" == "1" ]]; then
  echo "-- SKIP_TAILSCALE=1 — pomijam tailscale up (offline/test) — pamiętaj: provider bez tailnet nie heartbeatuje (brak 100.64.x.x) --"
else
  if ! command -v tailscale >/dev/null 2>&1; then
    echo "-- instaluję tailscale --"
    curl -fsSL https://tailscale.com/install.sh | sh
  fi
  echo "-- Headscale health --"
  LAN_LOGIN_SERVER="http://192.168.1.15:8080"
  if curl -fsS --max-time 3 "$LAN_LOGIN_SERVER/health" >/dev/null 2>&1; then
    echo "INFO: Wykryto serwer Headscale w LAN ($LAN_LOGIN_SERVER) — używam połączenia bezpośredniego (omija Cloudflare Proxy TS2021)"
    LOGIN_SERVER="$LAN_LOGIN_SERVER"
  else
    _headscale_http=$(curl -s --max-time 5 -o /dev/null -w "%{http_code}" "$LOGIN_SERVER/health" 2>/dev/null || echo "000")
    echo "Headscale public URL: $LOGIN_SERVER (health HTTP $_headscale_http)"
  fi




  echo "-- tailscale up (hostname sanitized: $HOSTNAME) --"
  if ! [[ "$HOSTNAME" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]]; then
    echo "BŁĄD: hostname \"$HOSTNAME\" nadal nievalid DNS — fallback provider-5090" >&2
    HOSTNAME="provider-5090"
  fi

  # --- detect existing tailnet / control plane (for control-plane switch) ---
  _existing_control=""
  _existing_ips=""
  _is_different_control=false
  _ts_json=""
  _backend_state=""
  if command -v tailscale >/dev/null 2>&1 && tailscale status --json >/dev/null 2>&1; then
    _ts_json=$(tailscale status --json 2>/dev/null || echo "{}")
    if command -v jq >/dev/null 2>&1; then
      # Requirement: detect via CurrentTailnet.BaseDomain, Self.ControlURL, MagicDNSSuffix
      _existing_control=$(echo "$_ts_json" | jq -r '.CurrentTailnet.BaseDomain // empty' 2>/dev/null || true)
      if [[ -z "$_existing_control" || "$_existing_control" == "null" ]]; then
        _existing_control=$(echo "$_ts_json" | jq -r '.CurrentTailnet.Name // empty' 2>/dev/null || true)
      fi
      if [[ -z "$_existing_control" || "$_existing_control" == "null" ]]; then
        _existing_control=$(echo "$_ts_json" | jq -r '.Self.ControlURL // empty' 2>/dev/null || true)
      fi
      if [[ -z "$_existing_control" || "$_existing_control" == "null" ]]; then
        _existing_control=$(echo "$_ts_json" | jq -r '.CurrentTailnet.MagicDNSSuffix // .MagicDNSSuffix // empty' 2>/dev/null || true)
      fi
      _existing_ips=$(echo "$_ts_json" | jq -r '.Self.TailscaleIPs[0] // empty' 2>/dev/null || true)
      _backend_state=$(echo "$_ts_json" | jq -r '.BackendState // empty' 2>/dev/null || true)
    else
      _existing_control=$(echo "$_ts_json" | grep -o '"BaseDomain"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n1 | cut -d'"' -f4 || true)
      _backend_state=""
    fi
    if [[ -z "$_existing_control" || "$_existing_control" == "null" ]]; then
      _existing_control=$(echo "$_ts_json" | grep -o '"ControlURL"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n1 | cut -d'"' -f4 || true)
    fi
    if [[ -z "$_existing_control" || "$_existing_control" == "null" ]]; then
      _existing_control=$(echo "$_ts_json" | grep -o '"MagicDNSSuffix"[[:space:]]*:[[:space:]]*"[^"]*"' | head -n1 | cut -d'"' -f4 || true)
    fi
    if [[ -n "$_existing_control" && "$_existing_control" != "null" ]]; then
      if ! echo "$_existing_control" | grep -qi "seedinfer"; then
        if [[ "${_backend_state:-}" == "Running" ]] || tailscale status 2>&1 | grep -Eq '100\.[0-9]+\.[0-9]+\.[0-9]+'; then
          _is_different_control=true
        fi
      fi
      if echo "$_existing_control" | grep -qi "tailscale.com"; then
        if [[ "${_backend_state:-}" == "Running" ]] || tailscale status 2>&1 | grep -Eq '100\.94\.'; then
          _is_different_control=true
        fi
      fi
    fi
    # extra fallback: check tailscale status text contains ts.net and not seedinfer
    if tailscale status 2>&1 | grep -qE 'tail[0-9a-z-]+\.ts\.net' && ! tailscale status 2>&1 | grep -qi "seedinfer"; then
      if [[ "${_backend_state:-}" == "Running" ]] || tailscale status 2>&1 | grep -Eq '100\.'; then
        _is_different_control=true
        if [[ -z "$_existing_control" || "$_existing_control" == "null" ]]; then
          _existing_control="tailscale.com ($(tailscale status 2>&1 | grep -oE 'tail[0-9a-z-]+\.ts\.net' | head -n1 || echo "tailscale.com"))"
        fi
      fi
    fi
    # BackendState Logged out / NeedsLogin / Stopped — clean state, no auto-container (allow host join)
    # Sprawdź tailscale status --json | jq .BackendState — gdy LoggedOut/NeedsLogin, host nie jest w tailnecie, nie wymuszaj kontenera
    if [[ -n "${_backend_state:-}" ]]; then
      if echo "$_backend_state" | grep -qiE "needslogin|stopped|nostate|loggedout"; then
        echo "INFO: BackendState=$_backend_state (Logged out / NeedsLogin) — czysty stan, bez auto-kontenera" >&2
        _is_different_control=false
      fi
      if [[ "$_backend_state" == "NeedsLogin" ]] || echo "$_backend_state" | grep -qi "logged"; then
        _is_different_control=false
      fi
    fi
    if [[ -z "${_backend_state:-}" ]] && echo "$_ts_json" | grep -qi "loggedout"; then
      echo "INFO: Detected LoggedOut via raw json — czysty stan" >&2
      _is_different_control=false
    fi
  fi

  # --- Auto container default: jeśli host już w tailscale.com (Running, 100.94.x.x) -> domyślnie kontener, chyba że --force-host-tailscale ---
  # Wymaganie: detect via jq .CurrentTailnet.BaseDomain, .Self.ControlURL, MagicDNSSuffix, BackendState Running, control != seedinfer
  # Jeśli different i TAILSCALE_USE_CONTAINER !=0 i FORCE_HOST_TAILSCALE !=1 -> auto set TAILSCALE_USE_CONTAINER=1
  # Zostaw env override TAILSCALE_USE_CONTAINER=0 dla advanced (explicit disable)
  if [[ "$_is_different_control" == true ]]; then
    echo "INFO: Wykryto istniejący tailnet: ${_existing_control:-unknown} ${_existing_ips:+($_existing_ips)} — host jest wpięty w tailscale.com (np. 100.94.198.83 tail5c89af.ts.net, operator=jakub, --accept-routes --advertise-tags)." >&2
    echo "INFO: Przełączenie na Headscale ($LOGIN_SERVER) wymaga --reset --force-reauth i ROZŁĄCZY poprzednią sieć tailscale.com (utracisz MagicDNS *.ts.net, 100.94.x.x routing, --operator)." >&2
    if [[ "${FORCE_HOST_TAILSCALE:-0}" != "1" ]]; then
      # Check advanced override: jeśli user jawnie ustawił TAILSCALE_USE_CONTAINER=0 -> szanuj, inaczej auto kontener
      if [[ "$_TAILSCALE_USER_SET" == "1" && "$TAILSCALE_USE_CONTAINER" == "0" ]]; then
        # TAILSCALE_USE_CONTAINER=0 advanced override — szanujemy, ale ostrzegamy (FORCE_HOST_TAILSCALE !=1)
        echo "WARN: TAILSCALE_USE_CONTAINER=0 wymuszone przez env (advanced) — host zostanie przełączony z --reset --force-reauth, rozłączy tailscale.com. Kontynuuję za 3s. Ctrl+C aby przerwać." >&2
        sleep 3
      else
        # Auto-enable container jeśli nie jest już 1 — spełnia "TAILSCALE_USE_CONTAINER !=0" (nie wyłączony) i FORCE !=1
        if [[ "$TAILSCALE_USE_CONTAINER" != "1" ]]; then
          echo "INFO: Host already in tailscale.com (${_existing_ips:-100.94.x.x}) -> domyślnie używam kontenera tailscale-seedinfer (Headscale) aby nie ruszać hosta. Użyj --force-host-tailscale aby przełączyć hosta." >&2
          TAILSCALE_USE_CONTAINER=1
        else
          echo "INFO: TAILSCALE_USE_CONTAINER=1 — kontener tailscale-seedinfer (Headscale) obok hosta tailscale.com (${_existing_ips:-100.94.x.x} + 100.64.x.x)." >&2
        fi
        echo "INFO: Współistnienie: host 100.94.x.x (dom, tailscale.com) + kontener 100.64.x.x (Headscale) — nie rozłącza. Provider agent używa kontenera." >&2
        echo "      Alternatywa: --force-host-tailscale lub TAILSCALE_USE_CONTAINER=0 aby przełączyć hosta (rozłączy tailscale.com)." >&2
      fi
    else
      echo "INFO: --force-host-tailscale aktywny (FORCE_HOST_TAILSCALE=1) — kontynuuję przełączenie hosta z --reset --force-reauth (rozłączy tailscale.com)." >&2
    fi
  fi

  # base args: zawsze przekazuj --hostname sanitized, --authkey, --login-server, --accept-routes, --advertise-tags
  _ts_base_args=(--login-server "$LOGIN_SERVER" --authkey "$AUTHKEY" --hostname "$HOSTNAME" --advertise-tags tag:provider --accept-routes)

  TAILSCALE_UP_OK=false
  # --- Container mode (persistent) — nie rusza hostowego tailscaled ---
  if [[ "$TAILSCALE_USE_CONTAINER" == "1" ]]; then
    echo "INFO: TAILSCALE_USE_CONTAINER=1 — używam docker tailscale/tailscale (persistent, nie rusza hostowego tailscaled)" >&2
    # Determine DOCKER command (use sudo if needed)
    if ! docker info >/dev/null 2>&1; then
      DOCKER="sudo docker"
    fi
    if command -v docker >/dev/null 2>&1 || command -v sudo >/dev/null 2>&1; then
      echo "-- tailscale (container persistent) up --"
      # Ensure volume and network
      $DOCKER volume create tailscale-seedinfer-state >/dev/null 2>&1 || true
      $DOCKER network create seedinfer-tailnet >/dev/null 2>&1 || true
      # Cleanup old container if exists
      if $DOCKER ps -a --format '{{.Names}}' 2>/dev/null | grep -q "^tailscale-seedinfer$"; then
        echo "-- usuwam stary tailscale-seedinfer --"
        $DOCKER rm -f tailscale-seedinfer 2>/dev/null || true
        sleep 1
      fi
      # Run persistent container with healthcheck
      if $DOCKER run -d --name tailscale-seedinfer --restart unless-stopped \
        --cap-add=NET_ADMIN --cap-add=NET_RAW --device /dev/net/tun \
        -v tailscale-seedinfer-state:/tailscale \
        -e TS_AUTHKEY="$AUTHKEY" -e TS_HOSTNAME="$HOSTNAME" -e TS_LOGIN_SERVER="$LOGIN_SERVER" \
        -e TS_EXTRA_ARGS="--login-server=$LOGIN_SERVER --advertise-tags=tag:provider --accept-routes --reset" \
        -e TS_STATE_DIR=/tailscale \
        --health-cmd="tailscale status >/dev/null 2>&1 || exit 1" --health-interval=30s --health-timeout=5s --health-retries=3 \
        tailscale/tailscale:latest 2>&1 | tail -n 20; then
        echo "INFO: tailscale-seedinfer uruchomiony (persistent) — czekam 3s na status..." >&2
        sleep 3
        $DOCKER logs tailscale-seedinfer 2>&1 | tail -n 30 || true
        _cont_ip=""
        _cont_ip=$($DOCKER exec tailscale-seedinfer tailscale ip -4 2>/dev/null | head -n1 || true)
        if [[ -n "$_cont_ip" && "$_cont_ip" =~ ^100\. ]]; then
          TAILSCALE_UP_OK=true
          echo "tailscale (container) status OK: IP $_cont_ip"
        else
          echo "WARN: tailscale container brak IP — próbuję exec z --reset na $LOGIN_SERVER / LAN fallback..." >&2
          $DOCKER exec tailscale-seedinfer tailscale up --reset --login-server "$LOGIN_SERVER" --authkey "$AUTHKEY" --hostname "$HOSTNAME" --advertise-tags tag:provider --accept-routes 2>&1 || true
          sleep 2
          _cont_ip=$($DOCKER exec tailscale-seedinfer tailscale ip -4 2>/dev/null | head -n1 || true)
          if [[ -n "$_cont_ip" && "$_cont_ip" =~ ^100\. ]]; then
            TAILSCALE_UP_OK=true
            echo "tailscale (container) retry status OK: IP $_cont_ip"
          else
            echo "WARN: retry też bez IP — sprawdzam czy LAN Headscale (192.168.1.15) wyratuje..." >&2
            $DOCKER exec tailscale-seedinfer tailscale up --reset --login-server "http://192.168.1.15:8080" --authkey "$AUTHKEY" --hostname "$HOSTNAME" --advertise-tags tag:provider --accept-routes 2>&1 || true
            sleep 2
            _cont_ip=$($DOCKER exec tailscale-seedinfer tailscale ip -4 2>/dev/null | head -n1 || true)
            if [[ -n "$_cont_ip" && "$_cont_ip" =~ ^100\. ]]; then
              TAILSCALE_UP_OK=true
              echo "tailscale (container) LAN fallback status OK: IP $_cont_ip"
            else
              echo "BŁĄD: kontener tailscale nie zarejestrował się w Headscale" >&2
            fi
          fi
        fi
        echo "INFO: Kontener tailscale-seedinfer (Headscale ${_cont_ip:-brak_IP}) działa obok hosta tailscale.com (${_existing_ips:-100.94.x.x}) — współistnienie, nie rozłącza." >&2
      else

        echo "WARN: docker tailscale persistent nie powiódł się — próbuję natywnie" >&2
      fi
    else
      echo "WARN: TAILSCALE_USE_CONTAINER=1 ale docker brak — próbuję natywnie" >&2
    fi
  fi

  if [[ "$TAILSCALE_UP_OK" != "true" ]]; then
    _can_sudo_nopass=false
    if sudo -n true 2>/dev/null; then
      _can_sudo_nopass=true
      echo "sudo NOPASSWD OK — tailscale up via sudo"
    else
      echo "INFO: sudo wymaga hasła (sudo -n false) — próbuję sudo -v (jednorazowy prompt hasła) ..." >&2
      echo "Hint: jeśli jesteś w pipe curl|bash bez TTY, uruchom najpierw: sudo -v   lub   echo \"HASLO\" | sudo -S tailscale up ..." >&2
      echo "     alternatywnie: curl ... | SKIP_TAILSCALE=1 bash -s -- --dir ...   a potem ręcznie: sudo tailscale up --reset --force-reauth --login-server $LOGIN_SERVER --authkey XXX --hostname $HOSTNAME --advertise-tags tag:provider --accept-routes" >&2
      if sudo -v 2>&1; then
        _can_sudo_nopass=true
        echo "sudo -v OK — lease uzyskany"
      else
        echo "WARN: sudo -v nie powiódło się (brak TTY w pipe lub złe hasło) — próbuję tailscale up bez sudo (userspace) ..." >&2
        # userspace fallback: try without --reset first, then with --reset
        if tailscale up "${_ts_base_args[@]}" 2>&1; then
          TAILSCALE_UP_OK=true
          echo "tailscale up bez sudo OK (userspace/perm)"
        else
          echo "INFO: userspace bez --reset nie powiódł się — próbuję z --reset --force-reauth ..." >&2
          if tailscale up --reset --force-reauth "${_ts_base_args[@]}" 2>&1; then
            TAILSCALE_UP_OK=true
            echo "tailscale up bez sudo z --reset --force-reauth OK"
          else
            echo "BŁĄD: sudo wymagane ale niedostępne non-interactively. Rozwiązania:" >&2
            echo "  1) Otwórz nowy terminal i uruchom: sudo -v   (wpisz hasło), potem ponownie: curl -fsSL $GATEWAY/install.sh | bash -s -- --dir $INSTALL_DIR --force-host-tailscale" >&2
            echo "  2) Użyj: curl -fsSL $GATEWAY/install.sh | sudo bash -s -- --dir $INSTALL_DIR --force-host-tailscale   (cały installer jako root)" >&2
            echo "  3) Offline test: curl -fsSL $GATEWAY/install.sh | SKIP_TAILSCALE=1 bash -s -- --dir $INSTALL_DIR" >&2
            echo "  4) Userspace container: TAILSCALE_USE_CONTAINER=1 curl -fsSL $GATEWAY/install.sh | bash -s -- --dir $INSTALL_DIR" >&2
          fi
        fi
      fi
    fi
    if [[ "$TAILSCALE_UP_OK" != "true" && "$_can_sudo_nopass" == true ]]; then
      _ts_tries=0
      _use_reset=false
      if [[ "$_is_different_control" == true ]]; then
        _use_reset=true
        echo "INFO: inny control plane wykryty — pierwszy attempt użyje --reset --force-reauth" >&2
      fi
      _ts_last_err=""
      while [[ $_ts_tries -lt 2 ]]; do
        _ts_tries=$((_ts_tries+1))
        if [[ "$_use_reset" == true || $_ts_tries -eq 2 ]]; then
          _ts_cmd_args=(--reset --force-reauth "${_ts_base_args[@]}")
          echo "tailscale up attempt $_ts_tries/2: sudo tailscale up --reset --force-reauth --login-server $LOGIN_SERVER --authkey **** --hostname $HOSTNAME --advertise-tags=tag:provider --accept-routes"
        else
          _ts_cmd_args=("${_ts_base_args[@]}")
          echo "tailscale up attempt $_ts_tries/2: sudo tailscale up --login-server $LOGIN_SERVER --authkey **** --hostname $HOSTNAME --advertise-tags=tag:provider --accept-routes"
        fi
        _ts_out=$(mktemp)
        set +e
        sudo tailscale up "${_ts_cmd_args[@]}" 2>&1 | tee "$_ts_out"
        _ts_exit=${PIPESTATUS[0]}
        set -e
        if [[ $_ts_exit -eq 0 ]]; then
          TAILSCALE_UP_OK=true
          rm -f "$_ts_out"
          break
        else
          _ts_last_err=$(cat "$_ts_out" 2>/dev/null || true)
          echo "WARN: tailscale up attempt $_ts_tries nie powiódł się (exit $_ts_exit) — retry za 3s" >&2
          echo "$_ts_last_err" | tail -n 20 >&2
          if echo "$_ts_last_err" | grep -q "requires mentioning all non-default flags" || echo "$_ts_last_err" | grep -q "re-run your command with --reset" || echo "$_ts_last_err" | grep -q "changing settings via 'tailscale up'"; then
            echo "INFO: błąd wskazuje na brak --reset --force-reauth (non-default flags: --accept-routes --advertise-tags --operator). Następna próba użyje --reset --force-reauth." >&2
            if echo "$_ts_last_err" | grep -q -- "--operator"; then
              _op=""
              if command -v jq >/dev/null 2>&1 && tailscale status --json >/dev/null 2>&1; then
                _op=$(tailscale status --json 2>/dev/null | jq -r '.Self.UserProfile.LoginName // empty' 2>/dev/null || true)
              fi
              if [[ -n "$_op" && "$_op" != "null" && "$_op" != "" ]]; then
                echo "INFO: wykryto --operator=$_op w błędzie — --reset --force-reauth zresetuje operator (nie hardkoduję operator=jakub, używam --reset --force-reauth)." >&2
              else
                _op_suggest=$(echo "$_ts_last_err" | grep -o -- '--operator=[^ ]*' | head -n1 | cut -d= -f2 || true)
                if [[ -n "$_op_suggest" ]]; then
                  echo "INFO: sugerowany --operator=$_op_suggest — --reset --force-reauth zresetuje operator, nie przekazuję hardkodowanej wartości." >&2
                fi
              fi
            fi
            _use_reset=true
          fi
          # fallback logout if --reset still fails on 2nd attempt
          if [[ $_ts_tries -eq 2 ]]; then
            if echo "$_ts_last_err" | grep -q -- "--reset" || [[ "$_use_reset" == true ]]; then
              echo "INFO: --reset --force-reauth nadal fails — próbuję fallback: sudo tailscale logout || true przed kolejnym up" >&2
              sudo tailscale logout || true
              sleep 2
              echo "tailscale up fallback attempt: sudo tailscale up --reset --force-reauth --login-server $LOGIN_SERVER --authkey **** --hostname $HOSTNAME --advertise-tags=tag:provider --accept-routes"
              if sudo tailscale up --reset --force-reauth "${_ts_base_args[@]}" 2>&1; then
                TAILSCALE_UP_OK=true
                rm -f "$_ts_out"
                break
              else
                echo "WARN: fallback logout+up również nie powiódł się" >&2
              fi
            fi
          fi
          rm -f "$_ts_out"
          sleep 3
        fi
      done
      if [[ "$TAILSCALE_UP_OK" != "true" ]]; then
        echo "BŁĄD: tailscale up nie powiodło się po 2 próbach — sprawdź klucz (tag:provider, ważny 24h) i LOGIN_SERVER=$LOGIN_SERVER oraz hostname=$HOSTNAME (DNS valid)" >&2
        echo "Sprawdź: tailscale status --json | jq .CurrentTailnet ; tailscale status ; journalctl -u tailscaled --no-pager -n 50 ; headscale health: curl -fsS $LOGIN_SERVER/health" >&2
        echo "Hint: jeśli host jest w tailscale.com, użyj TAILSCALE_USE_CONTAINER=1 aby nie ruszać hosta, lub --force-host-tailscale aby wymusić przełączenie z --reset --force-reauth (rozłączy tailscale.com)." >&2
        exit 1
      fi
    elif [[ "$TAILSCALE_UP_OK" != "true" && "$_can_sudo_nopass" != "true" ]]; then
      if [[ "$TAILSCALE_UP_OK" != "true" ]]; then
        echo "BŁĄD: tailscale up nie powiódło się — sprawdź klucz i LOGIN_SERVER (sudo niedostępne w pipe)" >&2
        exit 1
      fi
    fi
  fi

  echo "-- weryfikacja tailnet --"
  if [[ "$TAILSCALE_USE_CONTAINER" == "1" ]]; then
    # Container mode: verify via docker exec
    if $DOCKER ps --format '{{.Names}}' 2>/dev/null | grep -q "^tailscale-seedinfer$"; then
      echo "tailscale-seedinfer container:"
      $DOCKER ps --filter name=tailscale-seedinfer --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" || true
      if $DOCKER exec tailscale-seedinfer tailscale status 2>&1 | head -n 20; then
        echo "tailscale (container) status OK"
      else
        echo "WARN: container tailscale status nie odpowiada — startuje (sleep 3s retry)" >&2
        sleep 3
        $DOCKER exec tailscale-seedinfer tailscale status 2>&1 | head -n 20 || echo "WARN: container status nadal brak (docker logs tailscale-seedinfer)" >&2
      fi
      $DOCKER exec tailscale-seedinfer tailscale ip -4 2>&1 | head -n 5 || echo "WARN: container tailscale ip -4 brak — może brak 100.64.x.x" >&2
      # Host tailnet remains untouched (100.94.x.x)
      if command -v tailscale >/dev/null 2>&1; then
        echo "-- host tailnet (nienaruszony) --"
        tailscale status 2>&1 | head -n 10 || true
        tailscale ip -4 2>&1 | head -n 3 || true
      fi
    else
      echo "WARN: tailscale-seedinfer container nie znaleziony — sprawdź docker ps -a" >&2
    fi
    echo "Tailnet podłączony jako $HOSTNAME (tag:provider) — kontener 100.64.x.x (Headscale) obok hosta 100.94.x.x — gotowe dla heartbeat"
  else
    if command -v tailscale >/dev/null 2>&1; then
      if tailscale status 2>&1 | head -n 20; then
        echo "tailscale status OK"
      else
        echo "WARN: tailscale status nie odpowiada — tailscaled może startować (sleep 3s + retry)" >&2
        sleep 3
        tailscale status 2>&1 | head -n 20 || echo "WARN: tailscale status nadal brak (sprawdź systemctl status tailscaled)" >&2
      fi
      tailscale ip -4 2>&1 | head -n 5 || echo "WARN: tailscale ip -4 brak — może brak 100.64.x.x (sprawdź tailscale status)" >&2
    fi
    echo "Tailnet podłączony jako $HOSTNAME (tag:provider) — 100.64.x.x gotowe dla heartbeat"
  fi
fi

# 4) Pobierz provider compose
mkdir -p "$INSTALL_DIR"
if [[ -d "$INSTALL_DIR/.git" ]]; then
  echo "-- aktualizuję repo w $INSTALL_DIR --"
  if command -v timeout >/dev/null 2>&1; then
    GIT_TERMINAL_PROMPT=0 timeout 15 git -C "$INSTALL_DIR" pull --ff-only 2>/dev/null || true
  else
    GIT_TERMINAL_PROMPT=0 git -C "$INSTALL_DIR" pull --ff-only 2>/dev/null || true
  fi
else
  if command -v git >/dev/null 2>&1 && curl -fsS "$GATEWAY/install.sh" >/dev/null 2>&1; then
    # próbuj klon — jeśli prywatne, fallback do pobrania plików via gateway
    # Fix: GIT_TERMINAL_PROMPT=0 + timeout 15 żeby nie wisiał na Username prompt (repo było prywatne/nieistniejące seedinfer/seedinfer.com, teraz public seedinfer-star/seedinfer.com, org seedinfer 404)
    _clone_ok=false
    if command -v timeout >/dev/null 2>&1; then
      if GIT_TERMINAL_PROMPT=0 timeout 15 git clone --depth 1 --filter=blob:none --sparse "$REPO_URL" "$INSTALL_DIR.tmp" 2>/dev/null; then _clone_ok=true; fi
    else
      if GIT_TERMINAL_PROMPT=0 git clone --depth 1 --filter=blob:none --sparse "$REPO_URL" "$INSTALL_DIR.tmp" 2>/dev/null; then _clone_ok=true; fi
    fi
    if [[ "$_clone_ok" == true ]]; then
      git -C "$INSTALL_DIR.tmp" sparse-checkout set provider
      mkdir -p "$INSTALL_DIR"
      cp -a "$INSTALL_DIR.tmp/provider/." "$INSTALL_DIR/provider/" 2>/dev/null || cp -a "$INSTALL_DIR.tmp/provider" "$INSTALL_DIR/" 2>/dev/null || true
      rm -rf "$INSTALL_DIR.tmp"
    fi
  fi
  # fallback: utwórz minimalny compose jeśli brak repo
  if [[ ! -f "$INSTALL_DIR/provider/docker-compose.yml" && ! -f "$INSTALL_DIR/docker-compose.yml" ]]; then
    echo "INFO: repo nie sklonowane — pobieram provider.tar.gz z $GATEWAY (fallback)"
    mkdir -p "$INSTALL_DIR"
    if curl -fsSL "$GATEWAY/api/provider-archive" -o "$INSTALL_DIR/provider.tar.gz" 2>/dev/null || curl -fsSL "$GATEWAY/provider.tar.gz" -o "$INSTALL_DIR/provider.tar.gz" 2>/dev/null; then
      tar -xzf "$INSTALL_DIR/provider.tar.gz" -C "$INSTALL_DIR" 2>/dev/null || tar -xzf "$INSTALL_DIR/provider.tar.gz" -C "$INSTALL_DIR/provider" --strip-components=1 2>/dev/null || true
      rm -f "$INSTALL_DIR/provider.tar.gz"
      echo "INFO: rozpakowano provider.tar.gz -> $INSTALL_DIR/provider/"
    else
      echo "WARN: nie udało się pobrać $GATEWAY/provider.tar.gz — próbuję pojedyncze pliki"
      mkdir -p "$INSTALL_DIR/provider/agent" "$INSTALL_DIR/provider/scripts"
      for f in docker-compose.yml Dockerfile.cuda .env.example agent/requirements.txt agent/main.py agent/entrypoint.sh; do
        curl -fsSL "$GATEWAY/provider/$f" -o "$INSTALL_DIR/provider/$f" 2>/dev/null || true
      done
    fi
  fi
  # jeśli nadal brak, oczekuj że użytkownik sklonuje ręcznie
  if [[ ! -f "$INSTALL_DIR/provider/docker-compose.yml" && ! -f "$INSTALL_DIR/docker-compose.yml" ]]; then
    echo "WARN: brak provider/docker-compose.yml w $INSTALL_DIR — sklonuj repo ręcznie:"
    echo "  git clone $REPO_URL $INSTALL_DIR && ls $INSTALL_DIR/provider/"
  fi
fi

# znajdź compose file
COMPOSE_FILE=""
if [[ -f "$INSTALL_DIR/provider/docker-compose.yml" ]]; then COMPOSE_FILE="$INSTALL_DIR/provider/docker-compose.yml"
elif [[ -f "$INSTALL_DIR/docker-compose.yml" ]]; then COMPOSE_FILE="$INSTALL_DIR/docker-compose.yml"
elif [[ -f "./provider/docker-compose.yml" ]]; then COMPOSE_FILE="./provider/docker-compose.yml"
fi

# 5) .env
ENV_FILE="$(dirname "$COMPOSE_FILE")/.env"
if [[ -n "$COMPOSE_FILE" ]]; then
  ENV_FILE="$(dirname "$COMPOSE_FILE")/.env"
  EXAMPLE="$(dirname "$COMPOSE_FILE")/.env.example"
  if [[ ! -f "$ENV_FILE" && -f "$EXAMPLE" ]]; then cp "$EXAMPLE" "$ENV_FILE"; fi
  # nadpisz kluczowe wartości
  mkdir -p "$(dirname "$ENV_FILE")"
  touch "$ENV_FILE"
  # usuń stare wpisy i dopisz (NVFP4 defaults)
  grep -v -E "^(TAILSCALE_AUTHKEY|MODEL|VLLM_MODEL|SEEDINFER_GATEWAY_URL|TAILSCALE_LOGIN_SERVER|TAILSCALE_HOSTNAME|HF_TOKEN|PYTORCH_CUDA_ALLOC_CONF|VLLM_GPU_MEMORY_UTILIZATION|HF_CACHE_HOST)=" "$ENV_FILE" > "$ENV_FILE.tmp" 2>/dev/null || cp "$ENV_FILE" "$ENV_FILE.tmp"
  cat >> "$ENV_FILE.tmp" <<EOF
TAILSCALE_AUTHKEY=$AUTHKEY
MODEL=$MODEL
VLLM_MODEL=$VLLM_MODEL
SEEDINFER_GATEWAY_URL=$GATEWAY
TAILSCALE_LOGIN_SERVER=$LOGIN_SERVER
TAILSCALE_HOSTNAME=$HOSTNAME
PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
VLLM_GPU_MEMORY_UTILIZATION=0.94
HF_CACHE_HOST=/mnt/d/hf_cache
EOF
  # zachowaj HF_TOKEN jeśli był w .env.example
  if ! grep -q "^HF_TOKEN=" "$ENV_FILE.tmp"; then
    echo "HF_TOKEN=" >> "$ENV_FILE.tmp"
  fi
  mv "$ENV_FILE.tmp" "$ENV_FILE"
  echo "-- .env zapisany: $ENV_FILE --"
  cat "$ENV_FILE"
  echo "-- NVFP4 plug-and-play: VLLM_MODEL=$VLLM_MODEL — vLLM pobierze wagi automatycznie przy pierwszym starcie (~30GB do \$(dirname \$(dirname ${ENV_FILE}))/models/cache) --"
fi

# --- sprawdzenie portów hosta (47900/47901 wolne, można nadpisać env VLLM_PORT/AGENT_PORT) ---
echo "-- sprawdzam porty hosta $VLLM_PORT (vLLM) i $AGENT_PORT (agent) --"
for PORT in "$VLLM_PORT" "$AGENT_PORT"; do
  if ss -tlnp 2>/dev/null | grep -q ":$PORT\b"; then
    echo "WARN: port $PORT zajęty (ss -tlnp | grep :$PORT) — sugerowane: VLLM_PORT=47900 AGENT_PORT=47901 lub inny wolny z zakresu 479xx/41000. Można nadpisać: VLLM_PORT=41000 AGENT_PORT=41001 $0 --authkey ..." >&2
    ss -tlnp 2>/dev/null | grep ":$PORT" || true
    echo "WARN: Jeśli kolizja — zatrzymaj proces lub ustaw inny port: export VLLM_PORT=41000 AGENT_PORT=41001; $0 --authkey ..." >&2
  else
    echo "Port $PORT wolny OK"
  fi
  # fallback via lsof/netstat if ss brak
  if ! command -v ss >/dev/null 2>&1 && command -v lsof >/dev/null 2>&1; then
    if lsof -i :"$PORT" >/dev/null 2>&1; then echo "WARN: port $PORT zajęty (lsof)" >&2; fi
  fi
done
# alternatywna walidacja wolnych portów z zakresu 479xx (rzadki, nie koliduje z 3000/3002/8004-8007/8788/9099/8384)

# 6) Uruchom provider (jeśli compose istnieje) — z prebuild pull/load logic
if [[ -n "$COMPOSE_FILE" && -f "$COMPOSE_FILE" ]]; then
  echo "-- prebuild check (ghcr -> Pi tar -> local build) --"
  # Ustal DOCKER already
  PREBUILD_OK=false
  # Szybki check: czy image już lokalnie?
  if [[ "$SKIP_PREBUILD" == "1" ]]; then
    echo "-- SKIP_PREBUILD=1 — pomijam ghcr/Pi, wymuszam lokalny build"
  else
    if $DOCKER image inspect "seedinfer/provider:cuda-0.1.0" >/dev/null 2>&1; then
      echo "Lokalny image seedinfer/provider:cuda-0.1.0 już istnieje — pomijam pull/load"
      $DOCKER image inspect "seedinfer/provider:cuda-0.1.0" --format '{{.Id}} {{.RepoTags}}' 2>/dev/null | head -n1 || true
      PREBUILD_OK=true
    elif $DOCKER image inspect "$PREBUILD_IMAGE" >/dev/null 2>&1; then
      echo "Lokalny prebuild $PREBUILD_IMAGE już istnieje — taguję do seedinfer/provider:cuda-0.1.0"
      $DOCKER tag "$PREBUILD_IMAGE" "seedinfer/provider:cuda-0.1.0" 2>/dev/null || true
      PREBUILD_OK=true
    else
      echo "-- próbuję pobrać prebuild image: $PREBUILD_IMAGE (ghcr.io, timeout ~10 min, ~8-15GB) ..."
      # ghcr pull — primary
      PULL_OK=false
      if command -v timeout >/dev/null 2>&1; then
        if timeout 600 $DOCKER pull "$PREBUILD_IMAGE" 2>&1 | tail -n 100; then
          # verify image exists
          if $DOCKER image inspect "$PREBUILD_IMAGE" >/dev/null 2>&1; then
            echo "ghcr pull OK: $PREBUILD_IMAGE"
            $DOCKER tag "$PREBUILD_IMAGE" "seedinfer/provider:cuda-0.1.0" 2>/dev/null || true
            PULL_OK=true
            PREBUILD_OK=true
          fi
        else
          echo "WARN: ghcr pull nie powiódł się (timeout 600s lub błąd sieci/brak ghcr tag) — próbuję Pi tar $PREBUILD_URL" >&2
        fi
      else
        if $DOCKER pull "$PREBUILD_IMAGE" 2>&1 | tail -n 100; then
          if $DOCKER image inspect "$PREBUILD_IMAGE" >/dev/null 2>&1; then
            echo "ghcr pull OK"
            $DOCKER tag "$PREBUILD_IMAGE" "seedinfer/provider:cuda-0.1.0" 2>/dev/null || true
            PULL_OK=true
            PREBUILD_OK=true
          fi
        else
          echo "WARN: ghcr pull fail — próbuję Pi tar $PREBUILD_URL" >&2
        fi
      fi
      # Pi registry additional pull (if SEEDINFER_REGISTRY set)
      if [[ "$PREBUILD_OK" != "true" && -n "$PREBUILD_REGISTRY" ]]; then
        REGISTRY_IMAGE="${PREBUILD_REGISTRY}/seedinfer/provider:cuda13.3-nvfp4"
        echo "-- próbuję Pi registry: $REGISTRY_IMAGE ..."
        if command -v timeout >/dev/null 2>&1; then
          if timeout 600 $DOCKER pull "$REGISTRY_IMAGE" 2>&1 | tail -n 50; then
            if $DOCKER image inspect "$REGISTRY_IMAGE" >/dev/null 2>&1; then
              echo "Pi registry pull OK"
              $DOCKER tag "$REGISTRY_IMAGE" "seedinfer/provider:cuda-0.1.0" 2>/dev/null || true
              $DOCKER tag "$REGISTRY_IMAGE" "$PREBUILD_IMAGE" 2>/dev/null || true
              PREBUILD_OK=true
            fi
          else
            echo "WARN: Pi registry pull fail — próbuję HTTP tar" >&2
          fi
        else
          if $DOCKER pull "$REGISTRY_IMAGE" 2>&1 | tail -n 50; then
            $DOCKER tag "$REGISTRY_IMAGE" "seedinfer/provider:cuda-0.1.0" 2>/dev/null || true
            PREBUILD_OK=true
          fi
        fi
      fi
      # Pi HTTP tar fallback
      if [[ "$PREBUILD_OK" != "true" ]]; then
        if command -v curl >/dev/null 2>&1; then
          _prebuild_http=$(curl -fsS --max-time 10 -o /dev/null -w "%{http_code}" -I "$PREBUILD_URL" 2>/dev/null || echo "000")
          if [[ "$_prebuild_http" == "200" ]]; then
            echo "-- Pi tar dostępny (HTTP $_prebuild_http), pobieram $PREBUILD_URL -> docker load (cierpliwości ~5-15 min, ~8-15GB gzip)..."
            # curl tar -> docker load
            if curl -fsSL --max-time 1800 "$PREBUILD_URL" | $DOCKER load 2>&1 | tail -n 100; then
              echo "docker load OK"
              if $DOCKER image inspect "$PREBUILD_IMAGE" >/dev/null 2>&1; then
                $DOCKER tag "$PREBUILD_IMAGE" "seedinfer/provider:cuda-0.1.0" 2>/dev/null || true
              fi
              if $DOCKER image inspect "seedinfer/provider:cuda-0.1.0" >/dev/null 2>&1; then
                PREBUILD_OK=true
                $DOCKER images | grep -E "seedinfer|ghcr" | head -n 10 || true
              else
                # docker load mogło załadować image pod inną nazwą — listuj
                echo "WARN: po docker load brak oczekiwanego taga — sprawdzam docker images:" >&2
                $DOCKER images | head -n 20 || true
                # jeśli cokolwiek załadowane, uznaj za OK i spróbuj użyć bez --build (docker compose znajdzie image)
                # ale na bezpiecznie: jeśli mamy jakikolwiek seedinfer/provider image, OK
                if $DOCKER images --format '{{.Repository}}:{{.Tag}}' | grep -q "seedinfer/provider" || $DOCKER images --format '{{.Repository}}:{{.Tag}}' | grep -q "ghcr.io/seedinfer"; then
                  PREBUILD_OK=true
                else
                  echo "WARN: docker load nie załadował rozpoznawalnego taga — fallback do build" >&2
                fi
              fi
            else
              echo "WARN: docker load z Pi nie powiódł się (network/przerwanie) — fallback do lokalnego build" >&2
            fi
          else
            echo "WARN: Pi tar $PREBUILD_URL nieosiągalny (HEAD HTTP $_prebuild_http, oczekiwano 200) — fallback do lokalnego build" >&2
            if [[ "$_prebuild_http" == "404" ]]; then
              echo "INFO: 404 = brak /opt/seedinfer/public/provider-image.tar.gz na Pi (hosting via Caddy/Next /api/provider-image). Uruchom na hoście 5090: ./scripts/publish-provider-image.sh --push --rsync-pi lub poczekaj na publish. Zobacz: ls -lh /opt/seedinfer/public/provider-image.tar.gz na Pi" >&2
            elif [[ "$_prebuild_http" == "000" ]]; then
              echo "INFO: 000 = brak sieci lub curl timeout 10s — sprawdź DNS/gateway" >&2
            fi
            echo "INFO: Następny krok: docker compose build lokalnie (~28GB + 30GB HF) — wolny fallback" >&2
          fi
        else
          echo "WARN: curl brak — nie mogę pobrać Pi tar — fallback do build" >&2
        fi
      fi
    fi
  fi

  # Wybierz tryb compose — 16GB opt: prefer pull/load, build tylko gdy oba zawiodą, z limitem 12g
  # Pierwszeństwo ghcr.io/seedinfer/provider:cuda13.3-nvfp4 (jeśli istnieje) → docker pull (bez build, wymaga tylko 8GB na image)
  # Fallback https://seedinfer.com/provider-image.tar.gz (Pi) → curl | docker load (bez build, wymaga tylko 65K tar + 8GB load)
  # Dopiero jeśli oba zawiodą: docker build --build-arg BUILDKIT_INLINE_CACHE=1 --memory=12g z optymalizacją
  COMPOSE_UP_WITH_BUILD="--build"
  BUILD_ARGS="--build-arg BUILDKIT_INLINE_CACHE=1 --memory=12g"
  # BUILDKIT_INLINE_CACHE=1 cached for spec
  if [[ "$PREBUILD_OK" == "true" ]]; then
    echo "-- prebuild OK — uruchamiam bez --build (szybszy start, brak 28GB build, wymaga tylko 8GB na image vs 21GB Build Cache)"
    # sprawdź czy image faktycznie istnieje
    if $DOCKER image inspect "seedinfer/provider:cuda-0.1.0" >/dev/null 2>&1; then
      echo "Image verified: seedinfer/provider:cuda-0.1.0"
      $DOCKER image inspect "seedinfer/provider:cuda-0.1.0" --format '  id={{.Id}} size={{.Size}} tags={{.RepoTags}}' 2>/dev/null | head -n1 || true
      COMPOSE_UP_WITH_BUILD="" # no build
    elif $DOCKER image inspect "$PREBUILD_IMAGE" >/dev/null 2>&1; then
      echo "Image verified: $PREBUILD_IMAGE"
      $DOCKER image inspect "$PREBUILD_IMAGE" --format '  id={{.Id}} size={{.Size}}' 2>/dev/null | head -n1 || true
      COMPOSE_UP_WITH_BUILD=""
    else
      echo "WARN: PREBUILD_OK=true ale image inspect fail — wymuszam --build $BUILD_ARGS" >&2
      COMPOSE_UP_WITH_BUILD="--build"
    fi
  else
    if [[ "$SKIP_BUILD" == "1" ]]; then
      echo "WARN: SKIP_BUILD=1 (16GB guard) a prebuild ghcr + Pi tar zawiodły — lokalny build wymaga >16GB (21GB Build Cache + HF 21G) i zfreezuje 16GB host." >&2
      echo "WARN: Próbuję build z limitem --memory=12g --build-arg BUILDKIT_INLINE_CACHE=1 (opt dla 16GB), ale zalecam: docker pull $PREBUILD_IMAGE lub curl $PREBUILD_URL | docker load" >&2
      echo "BŁĄD: 16GB guard — brak prebuild. Jeśli build OOM, zwolnij RAM lub ręcznie: curl -fsSL $PREBUILD_URL | docker load && docker tag $PREBUILD_IMAGE seedinfer/provider:cuda-0.1.0" >&2
    fi
    echo "-- prebuild nie dostępny lub pominięty — buduję lokalnie (docker build --build-arg BUILDKIT_INLINE_CACHE=1 --memory=12g, ~28GB, może potrwać 10-20 min + HF 30GB przy pierwszym starcie)"
    echo "-- 16GB opt: DOCKER_BUILDKIT=1 docker build --build-arg BUILDKIT_INLINE_CACHE=1 --memory=12g -f provider/Dockerfile.cuda -t $PREBUILD_IMAGE -t seedinfer/provider:cuda-0.1.0 . || docker compose build $BUILD_ARGS"
    COMPOSE_UP_WITH_BUILD="--build"
  fi

  echo "-- buduję i uruchamiam provider ($COMPOSE_FILE) $COMPOSE_UP_WITH_BUILD $BUILD_ARGS --"
  # wybierz compose dir
  COMPOSE_DIR="$(dirname "$COMPOSE_FILE")"
  if [[ "$COMPOSE_DIR" == "." ]]; then COMPOSE_DIR="."; fi
  # 16GB opt: prefer no-build, else build with memory limit
  if [[ -z "$COMPOSE_UP_WITH_BUILD" ]]; then
    $DOCKER compose -f "$COMPOSE_FILE" up -d
  else
    echo "-- fallback build z --build-arg BUILDKIT_INLINE_CACHE=1 --memory=12g (16GB opt, wymaga DOCKER_BUILDKIT=1) --"
    export DOCKER_BUILDKIT=1
    # Try compose build with memory limit and inline cache, fallback to plain --build if BuildKit unsupported
    if ! $DOCKER compose -f "$COMPOSE_FILE" build --build-arg BUILDKIT_INLINE_CACHE=1 --memory=12g 2>&1 | tail -n 100; then
      echo "WARN: compose build --memory=12g nie powiódł się (BuildKit unsupported?) — fallback do compose build --build-arg BUILDKIT_INLINE_CACHE=1" >&2
      if ! $DOCKER compose -f "$COMPOSE_FILE" build --build-arg BUILDKIT_INLINE_CACHE=1 2>&1 | tail -n 100; then
        echo "WARN: compose build --build-arg BUILDKIT_INLINE_CACHE=1 też fail — fallback do docker build --memory=12g" >&2
        $DOCKER build --build-arg BUILDKIT_INLINE_CACHE=1 --memory=12g -f "$(dirname "$COMPOSE_FILE")/Dockerfile.cuda" -t "$PREBUILD_IMAGE" -t "seedinfer/provider:cuda-0.1.0" "$(dirname "$COMPOSE_FILE")/.." 2>&1 | tail -n 100 || $DOCKER build -f "$(dirname "$COMPOSE_FILE")/Dockerfile.cuda" -t "$PREBUILD_IMAGE" -t "seedinfer/provider:cuda-0.1.0" "$(dirname "$COMPOSE_FILE")/.." 2>&1 | tail -n 100 || true
      fi
    fi
    $DOCKER compose -f "$COMPOSE_FILE" up -d 2>&1 | tail -n 50 || $DOCKER compose -f "$COMPOSE_FILE" up -d --build 2>&1 | tail -n 50
  fi
  echo "== Provider uruchomiony =="
  $DOCKER compose -f "$COMPOSE_FILE" ps
  echo ""
  echo "Logi: $DOCKER compose -f $COMPOSE_FILE logs -f"
  echo "Health: curl -fsS http://127.0.0.1:${AGENT_PORT}/health | jq"
  echo "vLLM:   curl -fsS http://127.0.0.1:${VLLM_PORT}/v1/models | jq"
  echo "Chat:   curl http://127.0.0.1:${AGENT_PORT}/v1/chat/completions -H 'Content-Type: application/json' -d '{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}]}'"
  # wait health — vLLM 30GB model download on first run can take 5-15 minutes
  echo "-- czekam na agenta i inicjalizację vLLM (max 15 min / 900s przy pierwszym starcie) --"
  _agent_ready=false
  for i in $(seq 1 60); do
    if curl -fsS "http://127.0.0.1:${AGENT_PORT}/health" >/dev/null 2>&1; then
      echo "Agent OK: http://127.0.0.1:${AGENT_PORT}/health odpowiada 200 OK"
      _agent_ready=true
      break
    fi
    if (( i % 3 == 0 )); then
      echo "   [$(($i * 15))s / 900s] Czekam na vLLM... (pobieranie wag modelu ~30GB / alokacja VRAM)"
    fi
    sleep 15
  done
  if [[ "$_agent_ready" == "true" ]]; then
    curl -fsS "http://127.0.0.1:${AGENT_PORT}/health" 2>/dev/null | head -c 800 || true
    echo ""
  else
    echo "INFO: Agent jeszcze startuje w tle (vLLM pobiera model/alokuje GPU VRAM)."
    echo "      Sprawdź postęp logów: docker logs -f seedinfer-provider"
  fi

else
  echo "== Instalacja zakończona bez uruchomienia Dockera =="
  echo "Sklonuj repo i uruchom:"
  echo "  git clone $REPO_URL /opt/seedinfer-provider"
  echo "  cd /opt/seedinfer-provider"
  echo "  cp provider/.env.example provider/.env  # uzupełnij TAILSCALE_AUTHKEY"
  echo "  docker compose -f provider/docker-compose.yml up -d --build"
fi

echo ""
echo "Weryfikacja Tailnet (kontener domyślny — nie rusza hosta):"
if [[ "$TAILSCALE_USE_CONTAINER" == "1" ]]; then
  echo "  docker ps | grep tailscale-seedinfer  # kontener Headscale 100.64.x.x"
  echo "  docker exec tailscale-seedinfer tailscale status  # kontener"
  echo "  docker exec tailscale-seedinfer tailscale ip -4    # 100.64.x.x"
  echo "  tailscale status  # host — pozostaje tailscale.com 100.94.x.x (domowy, nienaruszony)"
  echo "  tailscale ip -4   # host 100.94.x.x"
  echo "  ping -c2 gateway.seedinfer.ts.net  # MagicDNS gateway (100.64.0.1) — via kontener"
  echo "  curl -fsS http://gateway.seedinfer.ts.net:3000/api/stats | head -c 500"
  echo "  # Współistnienie: host 100.94.x.x (tailscale.com) + kontener 100.64.x.x (Headscale) — nasłuch współdzielony via docker network"
else
  echo "  tailscale status"
  echo "  ping -c2 gateway.seedinfer.ts.net  # MagicDNS gateway (100.64.0.1)"
  echo "  curl -fsS http://gateway.seedinfer.ts.net:3000/api/stats | head -c 500"
fi
echo ""
echo "Gateway heartbeat: co 30s do $GATEWAY/api/v1/providers/heartbeat"
echo ""
echo "Weryfikacja gateway (po 60s — 2 heartbeaty):"
echo "  curl -fsS $GATEWAY/api/v1/providers | jq '.data[] | {id, status, verification}'"
# Provider ID includes tailscale IP — for container use docker exec ip
if [[ "$TAILSCALE_USE_CONTAINER" == "1" ]]; then
  echo "  curl -fsS $GATEWAY/api/v1/providers/verify -H 'Content-Type: application/json' -d '{\"provider_id\":\"$HOSTNAME-$(docker exec tailscale-seedinfer tailscale ip -4 2>/dev/null | head -n1 || tailscale ip -4 2>/dev/null | head -n1)\"}' | jq  # manual verify jeśli pending (kontener 100.64.x.x)"
else
  echo "  curl -fsS $GATEWAY/api/v1/providers/verify -H 'Content-Type: application/json' -d '{\"provider_id\":\"$HOSTNAME-$(tailscale ip -4 2>/dev/null | head -n1)\"}' | jq  # manual verify jeśli pending"
fi
echo "  # Pi docs sync:"
echo "  # cat /opt/seedinfer/public/provider/README.md  (Pi: orangepi@100.107.9.52:/opt/seedinfer)"
# Best-effort gateway reachability check (non-blocking)
if command -v curl >/dev/null 2>&1; then
  echo "-- sprawdzam gateway $GATEWAY/api/v1/providers (best-effort) --"
  if curl -fsS --max-time 5 "$GATEWAY/api/v1/providers" >/dev/null 2>&1; then
    echo "Gateway OK: $GATEWAY/api/v1/providers reachable"
    curl -fsS --max-time 5 "$GATEWAY/api/v1/providers" 2>/dev/null | head -c 500; echo
  else
    echo "WARN: gateway $GATEWAY/api/v1/providers nie odpowiada (sprawdź Cloudflare Tunnel / Caddy na Pi)"
  fi
fi

echo ""
echo "== SeedInfer Provider — final URLs =="
echo "Dashboard: https://seedinfer.com/providers"
echo "Agent health: curl -fsS http://127.0.0.1:${AGENT_PORT}/health | jq   # host ${AGENT_PORT} -> container 3001"
echo "VLLM:      curl -fsS http://127.0.0.1:${VLLM_PORT}/v1/models | jq  # host ${VLLM_PORT} -> container 8000"
echo "Chat:      curl http://127.0.0.1:${AGENT_PORT}/v1/chat/completions -H 'Content-Type: application/json' -d '{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Hello\"}]}'"
echo "One-liner: curl -fsSL https://seedinfer.com/install.sh | bash"
echo "Prebuild:  $PREBUILD_IMAGE (ghcr) || $PREBUILD_URL (Pi tar) || local build"
# Ensure VLLM_PORT/AGENT_PORT robust defaults were applied (for public test)
echo "Ports: VLLM_PORT=${VLLM_PORT} AGENT_PORT=${AGENT_PORT}"
