#!/usr/bin/env bash
# scripts/verify-provider.sh — ręczna weryfikacja providera via gateway
# Użycie (provider_id to PROVIDER_ID z seedinfer.env; wymagany token właściciela):
#   SEEDINFER_NODE_TOKEN=... ./scripts/verify-provider.sh --provider-id provider-5090-xxx
#   SEEDINFER_NODE_TOKEN=... ./scripts/verify-provider.sh --provider-id provider-5090-xxx --gateway https://seedinfer.com
#   ./scripts/verify-provider.sh --list          # lista providerów
#   ./scripts/verify-provider.sh --list --verified # tylko verified
set -euo pipefail

GATEWAY="https://seedinfer.com"
PROVIDER_ID=""
LIST=false
VERIFIED_ONLY=false

usage() {
  cat <<EOF
SeedInfer provider verification helper

Opcje:
  --provider-id ID   Provider ID do weryfikacji (PROVIDER_ID z seedinfer.env, wymagane dla verify)
  --gateway URL      Gateway (default: $GATEWAY)
  --list             Lista providerów z /api/v1/providers
  --verified         Z --list: tylko verified
  --help             Pomoc

Auth: verify wymaga tokenu właściciela noda (SEEDINFER_NODE_TOKEN z seedinfer.env)
  lub tokenu admina. Gateway sonduje wyłącznie dane zapisane noda —
  opcjonalny agent_url override został usunięty (SSRF).

Przykłady:
  $0 --list
  SEEDINFER_NODE_TOKEN=\$SEEDINFER_NODE_TOKEN $0 --provider-id provider-5090-xxx
  SEEDINFER_NODE_TOKEN=\$SEEDINFER_NODE_TOKEN $0 --provider-id provider-5090-xxx --gateway http://localhost:3002
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --provider-id) PROVIDER_ID="$2"; shift 2 ;;
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

# Build payload (provider_id only — the gateway probes stored node data;
# any agent_url override is ignored server-side)
PAYLOAD=$(jq -n --arg id "$PROVIDER_ID" '{provider_id: $id}')

if [[ -z "${SEEDINFER_NODE_TOKEN:-}" ]]; then
  echo "BŁĄD: ustaw SEEDINFER_NODE_TOKEN (token właściciela noda z seedinfer.env)" >&2
  exit 1
fi

echo "POST $GATEWAY/api/v1/providers/verify"
echo "Payload: $PAYLOAD" | jq .

curl -fsS -X POST "$GATEWAY/api/v1/providers/verify" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SEEDINFER_NODE_TOKEN" \
  -d "$PAYLOAD" | jq

echo ""
echo "Sprawdź fleet: curl -fsS $GATEWAY/api/v1/providers | jq '.data[] | {id, status, verification}'"
