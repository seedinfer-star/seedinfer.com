#!/usr/bin/env bash
# scripts/check-billing-live.sh — SeedInfer billing live health check
# Checks https://seedinfer.com/billing and https://seedinfer.com/api/v1/credits|invoices
# are live (Crypto gateway) vs stale "Coming soon" or 404.
# Usage:
#   ./scripts/check-billing-live.sh               # prod seedinfer.com
#   BASE_URL=http://192.168.1.50:3000 ./scripts/check-billing-live.sh  # LAN Pi
#   BASE_URL=http://127.0.0.1:3000 ./scripts/check-billing-live.sh     # localhost
# Exit 0 = live, 1 = stale/error

set -euo pipefail

BASE_URL="${BASE_URL:-https://seedinfer.com}"
BILLING_URL="${BASE_URL}/billing"
CREDITS_URL="${BASE_URL}/api/v1/credits"
INVOICES_URL="${BASE_URL}/api/v1/invoices"
TIMEOUT="${TIMEOUT:-10}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[1;34m'; NC='\033[0m'
pass=0; fail=0

info() { echo -e "${BLUE}[info]${NC} $*"; }
ok()   { echo -e "${GREEN}[ ok ]${NC} $*"; pass=$((pass+1)); }
warn() { echo -e "${YELLOW}[warn]${NC} $*"; }
fail() { echo -e "${RED}[fail]${NC} $*"; fail=$((fail+1)); }

info "Checking SeedInfer billing live — BASE_URL=$BASE_URL"

# --- 1) /billing HTML contains "Crypto live — pay-as-you-go" and NOT stale amber "Coming soon — proxy" ---
info "1) GET $BILLING_URL ..."
BILLING_HTML="$(curl -sfL --max-time "$TIMEOUT" -H "Cache-Control: no-cache" -H "Pragma: no-cache" "$BILLING_URL" || true)"
if [[ -z "$BILLING_HTML" ]]; then
  fail "billing: empty response or curl failed (network/tunnel?)"
else
  # must contain Crypto live — pay-as-you-go (banner introduced in local fix)
  if echo "$BILLING_HTML" | grep -q "Crypto live"; then
    ok "billing: contains 'Crypto live' ✅ (pay-as-you-go banner live)"
  else
    fail "billing: missing 'Crypto live' — still stale 'Coming soon' build"
    echo "   hint: prod still serves old amber banner 'Coming soon — proxy to docs.seedinfer.com' — needs rsync+npm build+restart"
    # show snippet for debug
    echo "$BILLING_HTML" | grep -o "Coming soon[^<]*" | head -5 | sed 's/^/   debug: /'
  fi
  # confirm new header: Credits · usage · Crypto live · Stripe soon
  if echo "$BILLING_HTML" | grep -q "Credits.*Crypto live.*Stripe soon"; then
    ok "billing: header 'Credits · usage · Crypto live · Stripe soon' present"
  else
    warn "billing: header 'Crypto live · Stripe soon' not found (fallback: check page.tsx:73)"
  fi
  # confirm Stripe soon vs old mock balance
  if echo "$BILLING_HTML" | grep -q "Stripe — Coming soon"; then
    ok "billing: Stripe card still Coming soon (expected — Crypto live + Stripe soon)"
  fi
  # old stale indicator should NOT be dominant
  if echo "$BILLING_HTML" | grep -q "Mock balance — Stripe integration coming soon"; then
    fail "billing: still shows old mock balance 'Mock balance — Stripe integration coming soon' (stale build, not deployed)"
  else
    ok "billing: no stale mock balance (CryptoGateway live)"
  fi
  # confirm green live badge
  if echo "$BILLING_HTML" | grep -q "Live.*7 chains"; then
    ok "billing: badge 'Live · 7 chains' present"
  else
    warn "billing: badge Live · 7 chains missing (check .next/server/app/billing/page.js)"
  fi
  # need fresh cache bypass
  LIVE_COUNT=$(echo "$BILLING_HTML" | grep -o "Crypto live" | wc -l || true)
  info "billing: Crypto live occurrences: $LIVE_COUNT (expected >=2 in live build)"
fi

echo ""

# --- 2) GET /api/v1/credits should return 401 when unauth (not 404) ---
info "2) GET $CREDITS_URL (expect 401 unauth, not 404) ..."
CREDITS_CODE="$(curl -s -o /tmp/seedinfer-credits.json --max-time "$TIMEOUT" -w "%{http_code}" -H "Accept: application/json" -H "Cache-Control: no-cache" "$CREDITS_URL" 2>/dev/null || echo "000")"
CREDITS_BODY="$(cat /tmp/seedinfer-credits.json 2>/dev/null | head -c 800 || true)"
echo "   HTTP $CREDITS_CODE — body: ${CREDITS_BODY:0:500}"
if [[ "$CREDITS_CODE" == "401" ]]; then
  ok "credits: 401 unauth ✅ (live behavior — payments require JWT cookie/Bearer, not broken)"
  if echo "$CREDITS_BODY" | grep -q "unauthorized"; then
    ok "credits: body contains 'unauthorized' (lib/auth.ts verify)"
  fi
elif [[ "$CREDITS_CODE" == "404" ]]; then
  fail "credits: 404 not found — route NOT DEPLOYED (prod is stale build before app/api/v1/credits/route.ts existed)"
  echo "   hint: stale .next on Pi — run npm ci && npm run build && systemctl restart seedinfer"
elif [[ "$CREDITS_CODE" == "200" ]]; then
  warn "credits: 200 without auth — unexpected (should be 401 unless cookie present). Check auth middleware."
  fail="fail+1" # don't count as pass
else
  fail "credits: unexpected HTTP $CREDITS_CODE (expected 401 live, 404 stale)"
fi

echo ""

# --- 3) POST /api/v1/invoices should require JWT (401 unauth) not 404 ---
info "3) POST $INVOICES_URL {} (expect 401 unauth) ..."
INVOICES_CODE="$(curl -s -o /tmp/seedinfer-invoices.json --max-time "$TIMEOUT" -w "%{http_code}" -X POST -H "Content-Type: application/json" -H "Accept: application/json" -d '{}' "$INVOICES_URL" 2>/dev/null || echo "000")"
INVOICES_BODY="$(cat /tmp/seedinfer-invoices.json 2>/dev/null | head -c 800 || true)"
echo "   HTTP $INVOICES_CODE — body: ${INVOICES_BODY:0:500}"
if [[ "$INVOICES_CODE" == "401" ]]; then
  ok "invoices POST: 401 unauth ✅ (live — must login, then create invoice)"
elif [[ "$INVOICES_CODE" == "404" ]]; then
  fail "invoices POST: 404 — route NOT DEPLOYED (prod stale)"
elif [[ "$INVOICES_CODE" == "400" ]]; then
  warn "invoices POST: 400 without auth but reached handler — check JWT extraction (should be 401)"
else
  fail "invoices POST: unexpected HTTP $INVOICES_CODE (expected 401)"
fi

echo ""

# --- 4) GET /api/v1/invoices (list) also 401 live vs 404 stale ---
info "4) GET $INVOICES_URL (expect 401) ..."
LIST_CODE="$(curl -s -o /dev/null --max-time "$TIMEOUT" -w "%{http_code}" -H "Accept: application/json" "$INVOICES_URL" 2>/dev/null || echo "000")"
echo "   HTTP $LIST_CODE"
if [[ "$LIST_CODE" == "401" ]]; then
  ok "invoices GET: 401 ✅ (live)"
elif [[ "$LIST_CODE" == "404" ]]; then
  fail "invoices GET: 404 stale"
else
  warn "invoices GET: $LIST_CODE (expected 401)"
fi

echo ""
echo "==================== SUMMARY ===================="
echo "PASS: $pass   FAIL: $fail"
if [[ $fail -eq 0 ]]; then
  echo -e "${GREEN}BILLING LIVE ✅ — Crypto gateway deployed and working (401 is expected live, not error)${NC}"
  exit 0
else
  echo -e "${RED}BILLING STALE ❌ — prod is old build (Coming soon / 404). Run deploy on Pi.${NC}"
  echo -e "${YELLOW}Deploy: ./scripts/deploy-orange-pi.sh  OR  see deploy command block below${NC}"
  exit 1
fi
