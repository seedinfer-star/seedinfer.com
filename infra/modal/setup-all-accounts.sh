#!/usr/bin/env bash
set -euo pipefail
# SeedInfer — freezer kontenerów VLLM na wszystkie profile Modal (~/.modal.toml)
# Build+puch Image + deploy app `seedinfer-nemotron-vllm` na każdy profil z Flagami Nvidii (NVFP4 W4A16)
# WSL host — nie wymaga GPU lokalnie, buduje remote na Modal infra.
# Usage: bash infra/modal/setup-all-accounts.sh [--deploy|--build-only] [--profile NAME]

APP_FILE="infra/modal/modal_seedinfer_vllm.py"
APP_NAME="seedinfer-nemotron-vllm"
VOL_HF="seedinfer-hf-cache"
VOL_MODEL="seedinfer-model-cache"

MODE="deploy"  # deploy | build-only
FILTER_PROFILE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --deploy) MODE="deploy"; shift ;;
    --build-only) MODE="build-only"; shift ;;
    --profile) FILTER_PROFILE="$2"; shift 2 ;;
    -h|--help)
      echo "Usage: bash $0 [--deploy|--build-only] [--profile NAME]"
      echo "  --deploy      modal deploy na każdy profil (default)"
      echo "  --build-only  tylko zbuduj image (modal app logs / volume create), bez deploy"
      echo "  --profile X   tylko profil X"
      exit 0
      ;;
    *) echo "Unknown arg $1"; exit 1 ;;
  esac
done

if [[ ! -f "$APP_FILE" ]]; then
  echo "[err] Brak $APP_FILE — uruchom z root repo: bash infra/modal/setup-all-accounts.sh" >&2
  exit 1
fi

if ! command -v modal >/dev/null 2>&1; then
  echo "[err] 'modal' CLI not found — pip install modal && modal setup" >&2
  exit 1
fi

# Wyciągnij profile z ~/.modal.toml — format [profile_name] na początku linii
TOML="${HOME}/.modal.toml"
if [[ ! -f "$TOML" ]]; then
  TOML="${HOME}/.config/modal.toml"
fi
if [[ ! -f "$TOML" ]]; then
  echo "[err] Brak ~/.modal.toml ani ~/.config/modal.toml" >&2
  exit 1
fi

PROFILES=$(grep -E '^\[.+\]' "$TOML" | tr -d '[]' | awk '{print $1}' | sort -u)
if [[ -z "$PROFILES" ]]; then
  echo "[err] Nie znaleziono profili w $TOML" >&2
  exit 1
fi

if [[ -n "$FILTER_PROFILE" ]]; then
  if ! echo "$PROFILES" | grep -qx "$FILTER_PROFILE"; then
    echo "[err] Profil '$FILTER_PROFILE' nie istnieje. Dostępne: $PROFILES" >&2
    exit 1
  fi
  PROFILES="$FILTER_PROFILE"
fi

echo "[info] Znalezione profile ($(echo "$PROFILES" | wc -w)):"
echo "$PROFILES" | sed 's/^/  - /'
echo "[info] Tryb: $MODE  App: $APP_NAME  Plik: $APP_FILE"
echo ""

TOTAL=0; OK=0; FAIL=0
FAILED_LIST=""

for PROFILE in $PROFILES; do
  TOTAL=$((TOTAL+1))
  echo "============================================================"
  echo "[${TOTAL}] Profil: $PROFILE"
  echo "============================================================"

  # Aktywuj profil (modal profile activate)
  if ! modal profile activate "$PROFILE" 2>&1 | sed 's/^/  [profile] /'; then
    echo "[warn] modal profile activate $PROFILE failed — próbuję dalej z MODAL_PROFILE env"
  fi
  # Weryfikacja active workspace (nie fail jeśli Unknown — ale log)
  modal profile list 2>&1 | sed 's/^/  [profile list] /' || true

  # Upewnij się, że Volumes istnieją (lazy create — app zrobi create_if_missing, ale pre-create szybsze)
  echo "  [volume] ensure $VOL_HF / $VOL_MODEL"
  MODAL_PROFILE="$PROFILE" modal volume create "$VOL_HF" 2>&1 | sed 's/^/    /' || echo "    (volume $VOL_HF already exists or create skipped)"
  MODAL_PROFILE="$PROFILE" modal volume create "$VOL_MODEL" 2>&1 | sed 's/^/    /' || echo "    (volume $VOL_MODEL already exists or create skipped)"

  if [[ "$MODE" == "build-only" ]]; then
    echo "  [build] walidacja składni + image build dry-run (bez deploy)"
    python3 -m py_compile "$APP_FILE" && echo "    py_compile OK" || { echo "    py_compile FAIL"; FAIL=$((FAIL+1)); FAILED_LIST="$FAILED_LIST $PROFILE"; continue; }
    # Opcjonalnie: modal run dry (nie wymaga GPU — tylko sprawdza import)
    MODAL_PROFILE="$PROFILE" modal run "$APP_FILE" --help 2>&1 | head -n 20 | sed 's/^/    /' || true
    OK=$((OK+1))
    continue
  fi

  echo "  [deploy] modal deploy $APP_FILE (timeout ~600s build)"
  set +e
  MODAL_PROFILE="$PROFILE" modal deploy "$APP_FILE" --name "$APP_NAME" 2>&1 | sed 's/^/    /'
  RC=${PIPESTATUS[0]}
  set -e
  if [[ $RC -eq 0 ]]; then
    echo "  [ok] $PROFILE -> $APP_NAME deployed"
    OK=$((OK+1))
    # Pokaż app list dla weryfikacji
    MODAL_PROFILE="$PROFILE" modal app list 2>&1 | grep -E "$APP_NAME|App" | head -n 20 | sed 's/^/    [app list] /' || true
    # Opcjonalny pre-download wag (odkomentuj jeśli chcesz wypełnić Volume od razu ~20GB):
    # echo "  [prefetch] download_weights w tle"
    # MODAL_PROFILE="$PROFILE" modal run "${APP_FILE}::download_weights" --detach 2>&1 | sed 's/^/    /' || true
  else
    echo "  [FAIL] $PROFILE deploy exit $RC" >&2
    FAIL=$((FAIL+1))
    FAILED_LIST="$FAILED_LIST $PROFILE"
  fi
  echo ""
done

echo "============================================================"
echo "[done] Total: $TOTAL  OK: $OK  FAIL: $FAIL"
if [[ -n "$FAILED_LIST" ]]; then
  echo "[failed profiles]:$FAILED_LIST" >&2
fi
if [[ $FAIL -gt 0 ]]; then
  echo "[hint] Sprawdź: modal app list, modal app logs $APP_NAME, oraz ~/.modal.toml tokeny"
  echo "[hint] Dla Unknown (authentication failure) — zregeneruj token na modal.com/settings/tokens"
  exit 1
fi
echo "[hint] Odpalanie: MODAL_PROFILE=<profil> modal run $APP_FILE  lub  curl https://<workspace>--seedinfer-nemotron-vllm-serve.modal.run/v1/models"
