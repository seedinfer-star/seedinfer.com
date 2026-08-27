#!/usr/bin/env bash
# SeedInfer.com — deploy na Orange Pi 4 Pro (RK3588, Armbian) + Cloudflare
# Obsługuje dwa tryby:
#   ./scripts/deploy-orange-pi.sh            # bare-metal systemd (npm run build + rsync + systemctl restart)
#   ./scripts/deploy-orange-pi.sh --docker   # docker compose (build + rsync Caddyfile + compose up)
#   ./scripts/deploy-orange-pi.sh --check    # sprawdź SSH + health
#
# Wymaga: ssh, rsync, npm (lokalnie), na Pi: node 20, (opcjonalnie docker + caddy/cloudflared)
# Konfiguracja via env lub .env: PI_HOST, PI_USER, REMOTE_DIR, SSH_KEY
set -euo pipefail

# --- Konfig ---
PI_HOST="${PI_HOST:-192.168.1.15}"
PI_USER="${PI_USER:-root}"
REMOTE_DIR="${REMOTE_DIR:-/opt/seedinfer}"
SSH_KEY="${SSH_KEY:-}"  # np. ~/.ssh/orange_pi
MODE="systemd"

for arg in "$@"; do
  case "$arg" in
    --docker) MODE="docker" ;;
    --systemd) MODE="systemd" ;;
    --check) MODE="check" ;;
    --help|-h)
      echo "Użycie: $0 [--docker|--systemd|--check]"
      echo "  Env: PI_HOST=$PI_HOST PI_USER=$PI_USER REMOTE_DIR=$REMOTE_DIR SSH_KEY=$SSH_KEY"
      exit 0
      ;;
  esac
done

SSH_OPTS="-o ConnectTimeout=10 -o StrictHostKeyChecking=accept-new"
if [[ -n "$SSH_KEY" ]]; then
  SSH_OPTS="$SSH_OPTS -i $SSH_KEY"
fi
SSH="ssh $SSH_OPTS $PI_USER@$PI_HOST"
RSYNC_SSH="ssh $SSH_OPTS"

# Kolory
info()  { echo -e "\033[1;34m[info]\033[0m $*"; }
ok()    { echo -e "\033[1;32m[ ok ]\033[0m $*"; }
warn()  { echo -e "\033[1;33m[warn]\033[0m $*"; }
fail()  { echo -e "\033[1;31m[fail]\033[0m $*"; exit 1; }

# --- Preflight ---
if [[ "$MODE" == "check" ]]; then
  info "Sprawdzam SSH $PI_USER@$PI_HOST ..."
  $SSH "uname -a && echo '---' && free -h && echo '---' && df -h / /mnt/nvme 2>/dev/null || df -h / && echo '---' && node -v 2>/dev/null || echo 'node: brak' && docker --version 2>/dev/null || echo 'docker: brak' && caddy version 2>/dev/null || echo 'caddy: brak' && cloudflared --version 2>/dev/null || echo 'cloudflared: brak'"
  info "Healthcheck HTTP ..."
  $SSH "curl -sf http://127.0.0.1:3000/api/stats | head -c 500; echo; curl -sf http://127.0.0.1:80/health || echo 'Caddy :80 brak odpowiedzi'"
  ok "check done"
  exit 0
fi

# Weryfikuj lokalnie
[[ -f package.json ]] || fail "Uruchom z katalogu projektu (brak package.json)"
command -v rsync >/dev/null || fail "Brak rsync — zainstaluj: sudo apt install rsync"
command -v npm >/dev/null || fail "Brak npm"

# --- Build ---
if [[ "$MODE" == "docker" ]]; then
  info "Tryb DOCKER — buduję lokalnie (opcjonalnie) i sync na Pi..."
  # Lokalny build nie jest wymagany — Pi zbuduje obraz via compose. Ale weryfikujemy że projekt się buduje:
  if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
    info "npm ci && npm run build (lokalna weryfikacja) ..."
    npm ci
    npm run build
    ok "build lokalny OK"
  else
    warn "SKIP_BUILD=1 — pomijam lokalny build"
  fi
else
  if [[ "${SKIP_BUILD:-0}" != "1" ]]; then
    info "Tryb SYSTEMD — npm ci && npm run build ..."
    npm ci
    npm run build
    ok "build OK"
  else
    warn "SKIP_BUILD=1 — pomijam lokalny build"
  fi
fi

# --- Rsync ---
info "Rsync -> $PI_USER@$PI_HOST:$REMOTE_DIR (mode=$MODE) ..."

# Lista plików do wysyłki — wykluczamy node_modules, .next/cache itp. by nie zapychać 1Gbps
RSYNC_EXCLUDES=(
  --exclude='.git'
  --exclude='node_modules'
  --exclude='.next/cache'
  --exclude='.turbo'
  --exclude='*.log'
  --exclude='.env.local'
  --exclude='.env.*.local'
)

if [[ "$MODE" == "docker" ]]; then
  rsync -avz --delete "${RSYNC_EXCLUDES[@]}" \
    -e "$RSYNC_SSH" \
    ./ "$PI_USER@$PI_HOST:$REMOTE_DIR/"
  # Upewnij się że Caddyfile jest też w root na Pi (compose go montuje jako ./Caddyfile)
  $SSH "ln -sf $REMOTE_DIR/infra/Caddyfile $REMOTE_DIR/Caddyfile 2>/dev/null || cp $REMOTE_DIR/infra/Caddyfile $REMOTE_DIR/Caddyfile; ls -lh $REMOTE_DIR/Caddyfile $REMOTE_DIR/docker-compose.yml"
else
  # systemd — wysyłamy zbudowany .next + public + pakiet
  rsync -avz --delete "${RSYNC_EXCLUDES[@]}" -e "$RSYNC_SSH" ./ "$PI_USER@$PI_HOST:$REMOTE_DIR/" 2>/dev/null || \
  rsync -avz --delete --exclude='.git' --exclude='node_modules' --exclude='.next/cache' -e "$RSYNC_SSH" ./ "$PI_USER@$PI_HOST:$REMOTE_DIR/"
  # Doinstaluj deps na Pi i zrestartuj
fi

ok "rsync done"

# --- Remote restart ---
if [[ "$MODE" == "docker" ]]; then
  info "Remote: docker compose up -d --build ..."
  $SSH "
    set -e
    cd $REMOTE_DIR
    # .env — jeśli brak, utwórz z .env.example
    if [[ ! -f .env && -f .env.example ]]; then cp .env.example .env; echo '[warn] Utworzono .env z .env.example — uzupełnij CLOUDFLARE_TUNNEL_TOKEN!'; fi
    docker compose version 2>/dev/null || docker-compose version
    docker compose up -d --build
    echo '--- compose ps ---'
    docker compose ps
    echo '--- caddy logs (tail) ---'
    docker compose logs --tail 30 caddy || true
    echo '--- app health ---'
    for i in 1 2 3 4 5; do curl -sf http://127.0.0.1:3000/api/stats >/dev/null && echo \"app OK (próba \$i)\" && break || sleep 3; done
    curl -sf http://127.0.0.1:80/health && echo 'caddy :80 OK' || echo 'caddy :80 brak odpowiedzi (sprawdź Caddyfile -> app:3000)'
  "
else
  info "Remote: npm ci --omit=dev && systemctl restart seedinfer ..."
  $SSH "
    set -e
    cd $REMOTE_DIR
    if [[ ! -f .env && -f .env.example ]]; then cp .env.example .env; echo '[warn] Utworzono .env z .env.example'; fi
    npm ci --omit=dev || npm ci
    # systemd
    if systemctl is-active --quiet seedinfer 2>/dev/null; then
      sudo systemctl restart seedinfer
    else
      sudo systemctl daemon-reload
      sudo systemctl enable --now seedinfer
    fi
    echo '--- systemctl status ---'
    sudo systemctl status seedinfer --no-pager -l | head -n 40
    echo '--- journal tail ---'
    sudo journalctl -u seedinfer -n 30 --no-pager || true
    echo '--- health ---'
    for i in 1 2 3 4 5; do curl -sf http://127.0.0.1:3000/api/stats >/dev/null && echo \"app OK (próba \$i)\" && break || sleep 3; done
    # Caddy / cloudflared jeśli są
    sudo systemctl status caddy --no-pager -l 2>/dev/null | head -n 20 || echo 'caddy.service: brak (używasz Caddy w Dockerze lub nie zainstalowano)'
    sudo systemctl status cloudflared --no-pager -l 2>/dev/null | head -n 20 || echo 'cloudflared.service: brak'
  "
fi

ok "Deploy done — sprawdź: https://seedinfer.com  oraz  http://$PI_HOST:3000 (LAN)"
info "Przydatne:"
info "  ssh $PI_USER@$PI_HOST 'sudo journalctl -u seedinfer -f'"
info "  ssh $PI_USER@$PI_HOST 'docker compose -f $REMOTE_DIR/docker-compose.yml logs -f'"
info "  ./scripts/deploy-orange-pi.sh --check"
