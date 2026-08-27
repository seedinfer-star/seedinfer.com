#!/usr/bin/env bash
# SeedInfer.com — Cloudflare Tunnel setup — seedinfer.com + www + tailnet.seedinfer.com
# Domena kupiona na Cloudflare (dash 8cfc...), user zalogowany.
# Tunnel: seedinfer (prod na Pi: Caddy :80 -> Next :3000), dev lokalnie: :3002
# cloudflared 2026.5.1 — nie uruchamia tunelu automatycznie (wymaga auth), tylko przygotowuje.
#
# Użycie:
#   ./scripts/cloudflare-setup.sh              # pełny setup (create + DNS + token)
#   ./scripts/cloudflare-setup.sh --check      # tylko sprawdź status
#   ./scripts/cloudflare-setup.sh --token-only # tylko wygeneruj token
#   ./scripts/cloudflare-setup.sh --dev        # pokaż komendy dev (localhost:3002)
#
# Wymaga: cloudflared >=2024, zalogowany via `cloudflared tunnel login` LUB token z Dashboard Zero Trust
# Docs: docs/cloudflare.md , infra/cloudflared/config.yml
set -euo pipefail

TUNNEL_NAME="${TUNNEL_NAME:-seedinfer}"
DOMAINS=("seedinfer.com" "www.seedinfer.com" "tailnet.seedinfer.com")
CERT_FILE="${HOME}/.cloudflared/cert.pem"

# Kolory
if [[ -t 1 ]]; then
  B="\033[1m"; G="\033[1;32m"; Y="\033[1;33m"; R="\033[1;31m"; C="\033[1;36m"; D="\033[0m"
else
  B=""; G=""; Y=""; R=""; C=""; D=""
fi
info() { echo -e "${C}[info]${D} $*"; }
ok()   { echo -e "${G}[ ok ]${D} $*"; }
warn() { echo -e "${Y}[warn]${D} $*"; }
fail() { echo -e "${R}[fail]${D} $*"; exit 1; }
step() { echo -e "\n${B}== $* ==${D}"; }

usage() {
  cat <<EOF
SeedInfer — Cloudflare Tunnel setup

Użycie:
  $0                    pełny setup (create + route dns + token)
  $0 --check            sprawdź login + czy tunnel istnieje
  $0 --token-only       tylko wypisz token (cloudflared tunnel token $TUNNEL_NAME)
  $0 --dev              pokaż komendy uruchomienia w trybie dev (localhost:3002)
  $0 --help             pomoc

Zmienne:
  TUNNEL_NAME=seedinfer  nazwa tunelu (domyślnie seedinfer)
  DOMAINS="seedinfer.com www.seedinfer.com tailnet.seedinfer.com"

Wymagania:
  - cloudflared 2026.5.1+ (cloudflared --version)
  - Zalogowany user: dash.cloudflare.com (domena seedinfer.com kupiona na CF)
  - Jedna z dwóch auth:
    a) CLI:  cloudflared tunnel login  (otwiera browser -> wybierz seedinfer.com -> tworzy ~/.cloudflared/cert.pem)
    b) Dashboard: Zero Trust -> Networks -> Tunnels -> Create tunnel -> Copy token (nie wymaga cert.pem)

Po setupie: skopiuj token na Orange Pi do /etc/cloudflared/env — patrz docs/cloudflare.md
EOF
}

MODE="full"
for arg in "$@"; do
  case "$arg" in
    --check) MODE="check" ;;
    --token-only) MODE="token" ;;
    --dev) MODE="dev" ;;
    --help|-h) usage; exit 0 ;;
    *) warn "Nieznany arg: $arg"; usage; exit 1 ;;
  esac
done

# --- 0. Preflight ---
step "0/5 Preflight — cloudflared"
command -v cloudflared >/dev/null 2>&1 || fail "Brak cloudflared. Zainstaluj: https://developers.cloudflare.com/cloudflare-one/connections/connect/networks/downloads/  lub  curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg ..."
cloudflared --version
echo "Tunnel: $TUNNEL_NAME"
echo "Domains: ${DOMAINS[*]}"
echo "Cert: $CERT_FILE ($( [[ -f "$CERT_FILE" ]] && echo "istnieje" || echo "BRAK - wymagany dla CLI; dla Dashboard token nie jest potrzebny" ))"
echo "Config prod: infra/cloudflared/config.yml  (Caddy :80 -> Next :3000)"
echo "Config dev:  infra/cloudflared/config.dev.yml (direct :3002)"

if [[ "$MODE" == "dev" ]]; then
  step "Tryb DEV — komendy do natychmiastowego uruchomienia tunelu na localhost:3002"
  cat <<'DEV'
# 1) Upewnij się że Next działa na :3002:
  npm run dev
  # lub prod build:
  # npm run build && npm run start   # start nasłuchuje na :3002 (package.json)

# 2) Sprawdź że odpowiada lokalnie:
  curl -sf http://127.0.0.1:3002/api/stats | head -c 400; echo
  curl -sf http://127.0.0.1:3002/ | head -c 200; echo

# --- Wariant A: Named tunnel (seedinfer) -> :3002 — wymaga że tunnel już istnieje (create + route dns) ---
# CLI token (jeśli masz token z `cloudflared tunnel token seedinfer` lub z Dashboard):
  cloudflared tunnel run --token $CLOUDFLARE_TUNNEL_TOKEN
  # ale ingress jest z Dashboard (Public Hostnames) LUB z infra/cloudflared/config.dev.yml
  # więc uruchom z config.dev.yml (nadpisuje ingress na :3002):

  cloudflared tunnel --config infra/cloudflared/config.dev.yml run
  # lub z tokenem + config (token ma wyższy priorytet, ale config.dev.yml definiuje ingress):
  # cloudflared tunnel --config infra/cloudflared/config.dev.yml run --token $CLOUDFLARE_TUNNEL_TOKEN

# Config.dev ingress:
#   seedinfer.com         -> http://localhost:3002
#   www.seedinfer.com     -> http://localhost:3002
#   tailnet.seedinfer.com -> http://localhost:3002  (w dev tailnet niepotrzebny, ale zmapowany)

# --- Wariant B: Quick tunnel (bez rejestracji, bez DNS) — natychmiastowy test bez dotykania DNS seedinfer.com ---
# Tworzy losowy *.trycloudflare.com -> :3002, działa 2h, nie wymaga żadnego loginu:
  cloudflared tunnel --url http://localhost:3002
  # → wypisze URL typu https://random-words-1234.trycloudflare.com
  # Użyj do testu zanim podepniesz seedinfer.com

# --- Wariant C: Dashboard-managed tunnel — najprostsze dla dev ---
# Jeśli tunnel utworzyłeś przez Dashboard (Zero Trust -> Tunnels -> seedinfer):
#   Dashboard -> Public Hostnames -> Add:
#     seedinfer.com         -> http://localhost:3002
#     www.seedinfer.com     -> http://localhost:3002
#   Skopiuj Token i uruchom:
  CLOUDFLARE_TUNNEL_TOKEN=eyJh... cloudflared tunnel run --token $CLOUDFLARE_TUNNEL_TOKEN
  # (Dashboard ingress nadpisuje config.yml, więc możesz tymczasowo przestawić na :3002 w UI)

# Weryfikacja:
  curl -I https://seedinfer.com
  curl -sf https://seedinfer.com/api/stats | head -c 500; echo
  curl -sf https://www.seedinfer.com/health || curl -sf https://seedinfer.com/health

# Logi:
  cloudflared tunnel info seedinfer
  cloudflared tunnel route dns --help

DEV
  echo ""
  info "Plik dev config: infra/cloudflared/config.dev.yml"
  cat infra/cloudflared/config.dev.yml 2>/dev/null || warn "Brak infra/cloudflared/config.dev.yml — utwórz go (patrz docs/cloudflare.md)"
  exit 0
fi

if [[ "$MODE" == "token" ]]; then
  step "Token only"
  info "Generuję token dla tunelu $TUNNEL_NAME ..."
  if cloudflared tunnel token "$TUNNEL_NAME" 2>&1; then
    ok "Token powyżej — skopiuj do /etc/cloudflared/env na Orange Pi"
    echo ""
    echo "Na Pi:"
    echo "  echo 'CLOUDFLARE_TUNNEL_TOKEN=<token>' | sudo tee /etc/cloudflared/env"
    echo "  sudo systemctl restart cloudflared && sudo journalctl -u cloudflared -f"
  else
    fail "Nie udało się pobrać tokena. Czy tunnel '$TUNNEL_NAME' istnieje? Sprawdź: cloudflared tunnel list"
  fi
  exit 0
fi

# --- 1. Sprawdź login ---
step "1/5 Auth check"
if [[ -f "$CERT_FILE" ]]; then
  ok "cert.pem istnieje: $CERT_FILE"
else
  warn "Brak $CERT_FILE"
  echo "  Opcja A (CLI): uruchom:  cloudflared tunnel login"
  echo "    -> otworzy browser -> zaloguj do Cloudflare -> wybierz domenę seedinfer.com"
  echo "    -> utworzy ~/.cloudflared/cert.pem (wymagane dla 'tunnel create' via CLI)"
  echo ""
  echo "  Opcja B (zalecana jeśli masz dash 8cfc...): użyj Dashboard Zero Trust"
  echo "    -> https://dash.cloudflare.com -> Zero Trust -> Networks -> Tunnels -> Create tunnel"
  echo "    -> nazwij 'seedinfer' -> Cloudflared -> Copy Token"
  echo "    -> wtedy NIE potrzebujesz 'tunnel login' ani 'tunnel create' — Dashboard robi to za Ciebie"
  echo "    -> ten skrypt i tak spróbuje 'tunnel list' — jeśli masz token z Dashboard, możesz zignorować brak cert.pem"
  echo ""
  if [[ "$MODE" == "check" ]]; then
    info "Tryb --check: kontynuuję mimo braku cert.pem (sprawdzę tunnel list)..."
  else
    warn "Kontynuuję — jeśli 'tunnel list/create' zawiedzie, użyj Opcji B (Dashboard) lub najpierw 'cloudflared tunnel login'"
  fi
fi

# Sprawdź czy tunnel list działa (wymaga cert.pem lub TUNNEL_TOKEN?)
if cloudflared tunnel list >/dev/null 2>&1; then
  ok "cloudflared tunnel list — OK"
else
  warn "cloudflared tunnel list — nie działa (brak cert.pem lub brak loginu). To normalne jeśli używasz Dashboard token."
  if [[ "$MODE" == "check" ]]; then
    echo ""
    echo "Dla CLI auth: uruchom  cloudflared tunnel login"
    echo "Dla Dashboard token: przejdź do docs/cloudflare.md -> Wariant A"
    exit 1
  fi
fi

if [[ "$MODE" == "check" ]]; then
  step "Check — lista tuneli"
  cloudflared tunnel list 2>&1 || true
  echo ""
  info "Sprawdź czy widzisz tunnel '$TUNNEL_NAME'. Jeśli nie — uruchom bez --check by go utworzyć."
  echo ""
  info "DNS check (jeśli masz dig):"
  for d in "${DOMAINS[@]}"; do
    if command -v dig >/dev/null 2>&1; then
      dig +short CNAME "$d" 2>&1 | head -n 3 | sed "s/^/  $d -> /" || echo "  $d -> (brak dig wyniku)"
    else
      echo "  $d -> (zainstaluj dnsutils dla dig, lub: nslookup $d)"
    fi
  done
  exit 0
fi

# --- 2. Tunnel create ---
step "2/5 Tunnel create — $TUNNEL_NAME"
TUNNEL_EXISTS=false
TUNNEL_ID=""
if cloudflared tunnel list 2>/dev/null | grep -qw "$TUNNEL_NAME"; then
  TUNNEL_EXISTS=true
  # Spróbuj wyciągnąć ID (kolumna 1 w `tunnel list`)
  TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | awk -v n="$TUNNEL_NAME" '$2==n {print $1; exit} $1==n {print $1; exit}')
  # Fallback: json jeśli jq dostępne
  if [[ -z "$TUNNEL_ID" ]] && command -v jq >/dev/null 2>&1; then
    TUNNEL_ID=$(cloudflared tunnel list --output json 2>/dev/null | jq -r --arg n "$TUNNEL_NAME" '.[] | select(.name==$n) | .id' | head -n1 || true)
  fi
  ok "Tunnel '$TUNNEL_NAME' już istnieje (ID: ${TUNNEL_ID:-nieznane}) — pomijam create"
else
  info "Tworzę tunnel '$TUNNEL_NAME' ..."
  if cloudflared tunnel create "$TUNNEL_NAME" 2>&1; then
    ok "Tunnel '$TUNNEL_NAME' utworzony"
    # Pobierz ID po utworzeniu
    TUNNEL_ID=$(cloudflared tunnel list 2>/dev/null | awk -v n="$TUNNEL_NAME" '$2==n {print $1; exit} $1==n {print $1; exit}')
    # Creds file powinien być w ~/.cloudflared/<ID>.json
    if [[ -n "$TUNNEL_ID" && -f "$HOME/.cloudflared/${TUNNEL_ID}.json" ]]; then
      info "Credentials: $HOME/.cloudflared/${TUNNEL_ID}.json"
      info "Skopiuj na Pi jako /etc/cloudflared/${TUNNEL_ID}.json lub /etc/cloudflared/credentials.json"
    fi
  else
    warn "cloudflared tunnel create zwrócił błąd — możliwe że tunnel już istnieje w Dashboard (utworzony przez UI)"
    warn "Sprawdź: cloudflared tunnel list  lub  https://one.dash.cloudflare.com -> Networks -> Tunnels"
    echo "Kontynuuję do route dns / token — jeśli tunnel jest w Dashboard, te kroki zadziałają po zalogowaniu via cert.pem"
  fi
fi

# --- 3. DNS route ---
step "3/5 DNS — route dla ${DOMAINS[*]}"
echo "Tworzę CNAME: <domain> -> <tunnel>.cfargotunnel.com (Proxied, auto przez Cloudflare)"
for domain in "${DOMAINS[@]}"; do
  info "Route: $TUNNEL_NAME -> $domain"
  # --overwrite-dns nadpisuje jeśli już istnieje (idempotent)
  if cloudflared tunnel route dns --overwrite-dns "$TUNNEL_NAME" "$domain" 2>&1; then
    ok "DNS OK: $domain"
  else
    # Fallback bez --overwrite-dns (starsze cloudflared)
    if cloudflared tunnel route dns "$TUNNEL_NAME" "$domain" 2>&1; then
      ok "DNS OK (bez overwrite): $domain"
    else
      warn "DNS route dla $domain nie powiódł się — możliwe że rekord już istnieje (sprawdź dash.cloudflare.com -> DNS)"
      warn "Jeśli używasz Dashboard-managed tunnel, dodaj Public Hostnames w UI zamiast CLI:"
      warn "  Zero Trust -> Networks -> Tunnels -> $TUNNEL_NAME -> Public Hostnames -> Add: $domain -> http://localhost:80"
    fi
  fi
done

echo ""
info "Weryfikacja DNS (może potrzebować 10-60s na propagację):"
for d in "${DOMAINS[@]}"; do
  if command -v dig >/dev/null 2>&1; then
    out=$(dig +short CNAME "$d" 2>&1 | head -n1 || true)
    if [[ -n "$out" ]]; then
      echo "  $d CNAME -> $out"
    else
      # Sprawdź A jeśli nie CNAME
      out2=$(dig +short "$d" 2>&1 | head -n1 || true)
      echo "  $d -> ${out2:-brak wyniku (jeszcze nie propagowane lub dig timeout)}"
    fi
  else
    echo "  $d -> (brak dig, sprawdź ręcznie: https://dash.cloudflare.com -> DNS)"
  fi
done

# --- 4. Token ---
step "4/5 Token — generowanie"
echo "Token zawiera ID + secret i jest używany do 'cloudflared tunnel run --token ...'"
echo "Na Pi token trafia do /etc/cloudflared/env i jest używany przez systemd (infra/systemd/cloudflared.service)"
echo ""
TOKEN=""
if TOKEN=$(cloudflared tunnel token "$TUNNEL_NAME" 2>&1); then
  # token komenda wypisuje sam token na stdout, ale czasem z logami — weź ostatnią linię
  TOKEN_CLEAN=$(echo "$TOKEN" | tail -n1 | tr -d '[:space:]')
  # Heurystyka: token to JWT (eyJ...) lub długi base64 — jeśli tail nie wygląda jak token, użyj całości
  if [[ "$TOKEN_CLEAN" == eyJ* ]] || [[ ${#TOKEN_CLEAN} -gt 100 ]]; then
    TOKEN="$TOKEN_CLEAN"
  fi
  ok "Token wygenerowany (pierwsze 20 znaków: ${TOKEN:0:20}...)"
  echo ""
  echo "Skopiuj TEN token na Orange Pi:"
  echo "  ${C}${TOKEN}${D}"
  echo ""
  echo "Zapisz lokalnie do .env (nie commituj!):"
  echo "  echo \"CLOUDFLARE_TUNNEL_TOKEN=$TOKEN\" >> .env.local"
  # Zapisz do pliku tymczasowego jeśli user chce
  TMP_TOKEN_FILE="./.cloudflared-token.tmp"
  echo "$TOKEN" > "$TMP_TOKEN_FILE"
  chmod 600 "$TMP_TOKEN_FILE" 2>/dev/null || true
  info "Token zapisano też do $TMP_TOKEN_FILE (chmod 600, nie commituj, usuń po skopiowaniu na Pi)"
else
  warn "Nie udało się pobrać tokena via 'cloudflared tunnel token'"
  warn "Alternatywa Dashboard:"
  warn "  https://one.dash.cloudflare.com -> Networks -> Tunnels -> $TUNNEL_NAME -> Configure -> Install connector -> Copy token"
  TOKEN="<TOKEN_Z_DASHBOARD>"
fi

# --- 5. Uruchomienie ---
step "5/5 Jak uruchomić tunnel"

cat <<EOF
# ── Prod (Orange Pi, Caddy :80 -> Next :3000) ──
# Token jest w Dashboard lub wygenerowany powyżej.
# Na Orange Pi (Armbian):

  sudo mkdir -p /etc/cloudflared
  # Wariant 1 — Token (zalecany, najprostsze):
  echo "CLOUDFLARE_TUNNEL_TOKEN=$TOKEN" | sudo tee /etc/cloudflared/env
  sudo chmod 600 /etc/cloudflared/env
  sudo cp infra/cloudflared/config.yml /etc/cloudflared/config.yml
  # W config.yml upewnij się że:
  #   tunnel: $TUNNEL_NAME
  #   ingress: seedinfer.com -> http://localhost:80 (Caddy)
  sudo cp infra/systemd/cloudflared.service /etc/systemd/system/cloudflared.service
  sudo systemctl daemon-reload
  sudo systemctl enable --now cloudflared
  sudo journalctl -u cloudflared -f
  # alternatywnie jednorazowo:
  # sudo cloudflared tunnel --no-autoupdate run --token \$CLOUDFLARE_TUNNEL_TOKEN

  # Wariant 2 — Credentials file (jeśli wolisz JSON zamiast tokena):
  # Po 'cloudflared tunnel create' masz ~/.cloudflared/<ID>.json
  # Skopiuj:
  #   scp ~/.cloudflared/\${TUNNEL_ID}.json seedinfer@\${PI_HOST}:/tmp/creds.json
  #   ssh seedinfer@\${PI_HOST} "sudo mkdir -p /etc/cloudflared && sudo mv /tmp/creds.json /etc/cloudflared/credentials.json && sudo chmod 600 /etc/cloudflared/credentials.json"
  #   # w /etc/cloudflared/config.yml odkomentuj credentials-file: /etc/cloudflared/credentials.json
  #   sudo systemctl restart cloudflared

# ── Dev lokalnie (przed Pi, Next na :3002) — test bez Orange Pi ──
# Ten laptop/WSL: Next działa na :3002 (npm run dev), chcesz wystawić seedinfer.com przez Tunnel:

  npm run dev
  # w drugim terminalu:
  # Opcja A — named tunnel z dev ingress (:3002):
  cloudflared tunnel --config infra/cloudflared/config.dev.yml run
  # Opcja B — token (jeśli wolisz):
  # CLOUDFLARE_TUNNEL_TOKEN=$TOKEN cloudflared tunnel --config infra/cloudflared/config.dev.yml run --token \$CLOUDFLARE_TUNNEL_TOKEN
  # Opcja C — quick tunnel (bez DNS, losowy URL):
  # cloudflared tunnel --url http://localhost:3002

  # Weryfikacja (po 5-10s od startu tunelu):
  curl -I https://seedinfer.com
  curl -sf https://seedinfer.com/api/stats | head -c 500; echo
  curl -sf https://www.seedinfer.com/health
  curl -sf https://tailnet.seedinfer.com/health  # jeśli Headscale działa

# ── Przydatne komendy ──
  cloudflared tunnel list
  cloudflared tunnel info $TUNNEL_NAME
  cloudflared tunnel route dns --help
  sudo journalctl -u cloudflared -n 50 --no-pager  # na Pi
  ./scripts/deploy-orange-pi.sh --check             # healthcheck Pi

EOF

ok "Setup zakończony. Dalsze kroki: patrz docs/cloudflare.md"
info "Następny krok: skopiuj token na Pi (patrz wyżej) lub przetestuj dev: npm run dev + cloudflared tunnel --config infra/cloudflared/config.dev.yml run"
