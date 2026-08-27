#!/usr/bin/env bash
# scripts/verify-provider.sh — ręczna weryfikacja providera via gateway
# Użycie:
#   ./scripts/verify-provider.sh --provider-id provider-5090-xxx
#   ./scripts/verify-provider.sh --provider-id provider-5090-xxx --gateway https://seedinfer.com --agent-url http://100.64.0.10:3001
#   ./scripts/verify-provider.sh --list          # lista providerów
#   ./scripts/verify-provider.sh --list --verified # tylko verified
set -euo pipefail

GATEWAY="https://seedinfer.com"
PROVIDER_ID=""
AGENT_URL=""
LIST=false
VERIFIED_ONLY=false

usage() {
  cat <<EOF
SeedInfer provider verification helper

Opcje:
  --provider-id ID   Provider ID do weryfikacji (wymagane dla verify)
  --agent-url URL    Opcjonalny agent_url override (np. http://100.64.0.10:3001)
  --gateway URL      Gateway (default: $GATEWAY)
  --list             Lista providerów z /api/v1/providers
  --verified         Z --list: tylko verified
  --help             Pomoc

Przykłady:
  $0 --list
  $0 --provider-id provider-5090-xxx
  $0 --provider-id provider-5090-xxx --agent-url http://100.64.0.10:3001 --gateway http://localhost:3002
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --provider-id) PROVIDER_ID="$2"; shift 2 ;;
    --agent-url) AGENT_URL="$2"; shift 2 ;;
    --gateway) GATEWAY="$2"; shift 2 ;;
    --list) LIST=true; shift ;;
    --verified) VERIFIED_ONLY=true; shift ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Nieznana opcja: $1" >&2; usage; exit 1 ;;
  esac
done

GATEWAY="${GATEWAY%/}"

if [[ "$LIST" == true ]]; then
  URL="$GATEWAY/api/v1/providers"
  if [[ "$VERIFIED_ONLY" == true ]]; then URL="$URL?verified=1"; fi
  echo "GET $URL"
  curl -fsS "$URL" | jq
  exit 0
fi

if [[ -z "$PROVIDER_ID" ]]; then
  echo "BŁĄD: --provider-id wymagane (lub --list)" >&2
  usage
  exit 1
fi

# Build payload
PAYLOAD=$(jq -n --arg id "$PROVIDER_ID" --arg url "$AGENT_URL" '{
  provider_id: $id
} + (if $url != "" then {agent_url: $url} else {} end)')

echo "POST $GATEWAY/api/v1/providers/verify"
echo "Payload: $PAYLOAD" | jq .

curl -fsS -X POST "$GATEWAY/api/v1/providers/verify" \
  -H "Content-Type: application/json" \
  -d "$PAYLOAD" | jq

echo ""
echo "Sprawdź fleet: curl -fsS $GATEWAY/api/v1/providers | jq '.data[] | {id, status, verification}'"
