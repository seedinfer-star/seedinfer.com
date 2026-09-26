#!/usr/bin/env bash
# scripts/clear-seedinfer.sh — wyczyść SeedInfer do 0 przed rygorystycznymi testami
# Woła POST /api/v1/providers/clear (or /api/admin/reset) + verify GET /api/v1/providers i GET /api/stats
# UWAGA: operacja destrukcyjna na wskazanym gateway (czyści providerów i telemetrię, ustawia forceZero) —
#   wymaga potwierdzenia ('yes') albo flagi --yes.
# Token admina (nagłówek X-Admin-Token): --token, env ADMIN_TOKEN / SEEDINFER_ADMIN_TOKEN, a na serwerze
#   automatycznie ADMIN_TOKEN z /opt/seedinfer/.env (inna ścieżka: SEEDINFER_ENV_FILE=...).
#   Serwer bez ADMIN_TOKEN w swoim .env odpowiada 503 (admin API wyłączone), zły token -> 401.
# Użycie:
#   sudo ./scripts/clear-seedinfer.sh --gateway http://127.0.0.1:3002   # na Pi (token z /opt/seedinfer/.env)
#   ADMIN_TOKEN=xxx ./scripts/clear-seedinfer.sh --gateway https://seedinfer.com
#   ./scripts/clear-seedinfer.sh --gateway http://localhost:3002 --token xxx --yes
set -euo pipefail

GATEWAY="https://seedinfer.com"
TOKEN="${ADMIN_TOKEN:-${SEEDINFER_ADMIN_TOKEN:-}}"
TOKEN_SOURCE="${TOKEN:+env}"
ENV_FILE="${SEEDINFER_ENV_FILE:-/opt/seedinfer/.env}"
ASSUME_YES=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --gateway) GATEWAY="$2"; shift 2 ;;
    --token) TOKEN="$2"; TOKEN_SOURCE="--token"; shift 2 ;;
    --yes|-y) ASSUME_YES=1; shift ;;
    --help|-h)
      echo "Usage: $0 [--gateway URL] [--token TOKEN] [--yes]"
      echo "  Token: --token, env ADMIN_TOKEN / SEEDINFER_ADMIN_TOKEN, or ADMIN_TOKEN read from $ENV_FILE (on the server)"
      echo "  Default gateway: https://seedinfer.com   (on the Pi: --gateway http://127.0.0.1:3002)"
      echo "  --yes  skip the confirmation prompt (required when not running in a terminal)"
      exit 0
      ;;
    *) echo "Unknown arg: $1" >&2; exit 1 ;;
  esac
done

GATEWAY="${GATEWAY%/}"
# On the server: read only the admin token line from the app env file (the file is never sourced)
if [[ -z "$TOKEN" && -r "$ENV_FILE" ]]; then
  TOKEN=$({ grep -E '^(ADMIN_TOKEN|SEEDINFER_ADMIN_TOKEN)=' "$ENV_FILE" || true; } | head -n1 | cut -d= -f2- | tr -d "\"'")
  [[ -n "$TOKEN" ]] && TOKEN_SOURCE="$ENV_FILE"
fi
if [[ -z "$TOKEN" ]]; then
  echo "ERROR: no admin token — use --token, set ADMIN_TOKEN, or run on the server as root/orangepi (reads $ENV_FILE)." >&2
  exit 2
fi

if [[ "$ASSUME_YES" != 1 ]]; then
  if [[ -t 0 ]]; then
    read -r -p "This CLEARS providers and telemetry on $GATEWAY. Type 'yes' to continue: " answer
    [[ "$answer" == "yes" ]] || { echo "Aborted."; exit 1; }
  else
    echo "ERROR: not running in a terminal — pass --yes to confirm clearing $GATEWAY." >&2
    exit 2
  fi
fi

# helper curl with token
auth_header=()
if [[ -n "$TOKEN" ]]; then
  auth_header=(-H "X-Admin-Token: $TOKEN")
fi

echo "=== SeedInfer clear ==="
echo "Gateway: $GATEWAY"
echo "Token: ***set*** (len ${#TOKEN}, source: ${TOKEN_SOURCE:-env})"
echo ""

# 1) Try primary endpoint
CLEAR_URL="$GATEWAY/api/v1/providers/clear"
echo "[1/3] POST $CLEAR_URL"
set +e
RESP=$(curl -sS -X POST "$CLEAR_URL" -H "Content-Type: application/json" "${auth_header[@]}" -w "\n%{http_code}")
CURL_EXIT=$?
set -e
HTTP_CODE=$(echo "$RESP" | tail -n1)
BODY=$(echo "$RESP" | sed '$d')

if [[ $CURL_EXIT -ne 0 ]]; then
  echo "curl failed exit=$CURL_EXIT" >&2
  echo "$BODY" | head -c 500
  echo ""
else
  echo "HTTP $HTTP_CODE"
  echo "$BODY" | jq . 2>/dev/null || echo "$BODY" | head -c 1000
  echo ""
  if [[ "$HTTP_CODE" == "503" ]]; then
    echo "Admin API is disabled on the server: ADMIN_TOKEN is not configured in its .env." >&2
  fi
  if [[ "$HTTP_CODE" == "401" || "$HTTP_CODE" == "403" ]]; then
    echo "Auth failed — wrong admin token (compare with ADMIN_TOKEN in the server .env)" >&2
    # try fallback endpoint
    echo "Trying fallback POST $GATEWAY/api/admin/reset ..."
    RESP2=$(curl -sS -X POST "$GATEWAY/api/admin/reset" -H "Content-Type: application/json" "${auth_header[@]}" -w "\n%{http_code}" || true)
    HTTP_CODE2=$(echo "$RESP2" | tail -n1)
    BODY2=$(echo "$RESP2" | sed '$d')
    echo "HTTP $HTTP_CODE2"
    echo "$BODY2" | jq . 2>/dev/null || echo "$BODY2" | head -c 1000
  fi
  if [[ "$HTTP_CODE" != "200" && "$HTTP_CODE" != "201" && "$HTTP_CODE" != "204" ]]; then
    # also try admin/reset as alias per spec
    if [[ "$CLEAR_URL" != "$GATEWAY/api/admin/reset" ]]; then
      echo "Trying alias POST $GATEWAY/api/admin/reset ..."
      RESP3=$(curl -sS -X POST "$GATEWAY/api/admin/reset" -H "Content-Type: application/json" "${auth_header[@]}" -w "\n%{http_code}" || true)
      HTTP_CODE3=$(echo "$RESP3" | tail -n1)
      BODY3=$(echo "$RESP3" | sed '$d')
      echo "HTTP $HTTP_CODE3"
      echo "$BODY3" | jq . 2>/dev/null || echo "$BODY3" | head -c 1000
    fi
  fi
fi

echo ""
echo "[2/3] Verify GET $GATEWAY/api/v1/providers"
curl -sS "$GATEWAY/api/v1/providers" -H "Cache-Control: no-cache" | jq '{count, verified, pending, verifying, failed, data: (.data | length)}' 2>/dev/null || curl -sS "$GATEWAY/api/v1/providers" | head -c 1000
echo ""

echo "[3/3] Verify GET $GATEWAY/api/stats?forceZero=1 (zeros) and GET $GATEWAY/api/stats (upstream)"
echo "-- with forceZero:"
curl -sS "$GATEWAY/api/stats?forceZero=1" | jq '{active_providers, total_tokens, total_requests, providers: (.providers | length), models, _seedinfer_zero}' 2>/dev/null || curl -sS "$GATEWAY/api/stats?forceZero=1" | head -c 1000
echo ""
echo "-- without forceZero (live upstream):"
curl -sS "$GATEWAY/api/stats" | jq '{active_providers, total_tokens, total_requests, providers: (.providers | length)}' 2>/dev/null || curl -sS "$GATEWAY/api/stats" | head -c 1000
echo ""

echo "Fallback status:"
curl -sS "$GATEWAY/api/v1/fallback/status" | jq '{local, stats: .stats}' 2>/dev/null || curl -sS "$GATEWAY/api/v1/fallback/status" | head -c 1000
echo ""
echo "Telemetry:"
curl -sS "$GATEWAY/api/v1/telemetry?limit=3" | jq '{count, total, pending, data: (.data | length)}' 2>/dev/null || curl -sS "$GATEWAY/api/v1/telemetry?limit=3" | head -c 500
echo ""
echo "=== Done ==="
echo "Dashboard should now show 0 verified/pending fleet and KPI zeros (if forceZero). Heartbeat will clear forceZero and restore live data."
