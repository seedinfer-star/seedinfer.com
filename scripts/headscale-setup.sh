#!/usr/bin/env bash
# SeedInfer.com — Headscale setup — Orange Pi 4 Pro (RK3588, ARM64)
# Faza 0: Nemotron Lightning only, Tailnet seedinfer.ts.net, server https://tailnet.seedinfer.com
# Tworzy: user seedinfer, preauth keys dla gateway/provider/seeder, tagi, enable routes
# Uruchom NA PI (Orange Pi 4 Pro) jako user seedinfer lub root:
#   chmod +x scripts/headscale-setup.sh
#   ./scripts/headscale-setup.sh                  # docker mode (domyślnie)
#   ./scripts/headscale-setup.sh --bare-metal     # gdy headscale zainstalowany via apt/binary
#   ./scripts/headscale-setup.sh --create-keys    # tylko wygeneruj nowe klucze (bez init)
#   ./scripts/headscale-setup.sh --status         # sprawdź nodes/keys/policy
#
# Wymaga: docker compose (dla trybu docker) LUB headscale binary w PATH (bare-metal)
# Po setup: skopiuj wygenerowane klucze do providera: tailscale up --login-server https://tailnet.seedinfer.com --authkey <KEY> --advertise-tags tag:provider

set -euo pipefail

# --- Konfig ---
MODE="docker"  # docker | bare-metal
DO_KEYS=1
DO_INIT=1
DO_STATUS=0
HEADSCALE_USER="seedinfer"
HEADSCALE_DATA_DIR="/mnt/nvme/headscale"
HEADSCALE_CONFIG="/opt/seedinfer/infra/headscale/config.yaml"
HEADSCALE_ACL="/opt/seedinfer/infra/headscale/acl.json"
COMPOSE_FILE="/opt/seedinfer/infra/headscale/docker-compose.headscale.yml"
# Fallback gdy uruchamiasz z repo root (dev/laptop):
if [[ -f "./infra/headscale/config.yaml" ]]; then
  HEADSCALE_CONFIG="./infra/headscale/config.yaml"
  HEADSCALE_ACL="./infra/headscale/acl.json"
  COMPOSE_FILE="./infra/headscale/docker-compose.headscale.yml"
fi

# Parse args
for arg in "$@"; do
  case "$arg" in
    --bare-metal) MODE="bare-metal" ;;
    --docker) MODE="docker" ;;
    --create-keys) DO_INIT=0; DO_KEYS=1 ;;
    --init-only) DO_KEYS=0; DO_INIT=1 ;;
    --status) DO_STATUS=1; DO_INIT=0; DO_KEYS=0 ;;
    --help|-h)
      echo "Użycie: $0 [--docker|--bare-metal] [--create-keys|--init-only|--status]"
      echo "  --docker       : headscale w Dockerze (domyślnie)"
      echo "  --bare-metal   : headscale binary na hoście"
      echo "  --create-keys  : tylko nowe preauth keys"
      echo "  --status       : pokaż users/nodes/keys/policy"
      exit 0
      ;;
  esac
done

# Ops
if [[ "$DO_STATUS" == "1" ]]; then
  :
else
  :
fi

# Kolory
info() { echo -e "\033[1;34m[info]\033[0m $*"; }
ok()   { echo -e "\033[1;32m[ ok ]\033[0m $*"; }
warn() { echo -e "\033[1;33m[warn]\033[0m $*"; }
fail() { echo -e "\033[1;31m[fail]\033[0m $*"; exit 1; }

# Helpers — wykonaj headscale CLI (docker vs bare-metal)
hs() {
  if [[ "$MODE" == "docker" ]]; then
    # docker exec — headscale musi być uruchomiony
    docker exec seedinfer-headscale headscale "$@" 2>&1
  else
    headscale "$@" 2>&1
  fi
}

hs_or_fail() {
  hs "$@" || fail "headscale $* failed — sprawdź logi: docker logs seedinfer-headscale  lub journalctl -u headscale"
}

# --- Preflight ---
if [[ "$MODE" == "docker" ]]; then
  command -v docker >/dev/null 2>&1 || fail "Brak docker — zainstaluj: curl -fsSL https://get.docker.com | sh"
  docker compose version >/dev/null 2>&1 || fail "Brak docker compose plugin"
else
  command -v headscale >/dev/null 2>&1 || fail "Brak headscale binary — zainstaluj: https://github.com/juanfont/headscale/releases"
fi

# --- Status only ---
if [[ "$DO_STATUS" == "1" ]]; then
  info "Headscale status — MODE=$MODE"
  if [[ "$MODE" == "docker" ]]; then
    docker ps --filter name=seedinfer-headscale --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo "---"
    docker logs --tail 50 seedinfer-headscale 2>&1 || true
    echo "---"
  else
    systemctl status headscale --no-pager -l 2>&1 || true
  fi
  echo "=== users ==="
  hs users list || true
  echo "=== nodes ==="
  hs nodes list || true
  echo "=== preauthkeys ==="
  hs preauthkeys list --user "$HEADSCALE_USER" || true
  echo "=== apikeys ==="
  hs apikeys list || true
  echo "=== policy check ==="
  hs policy check 2>&1 || cat "$HEADSCALE_ACL" | head -n 100
  ok "status done"
  exit 0
fi

# --- Init: katalogi NVMe + permissions ---
if [[ "$DO_INIT" == "1" ]]; then
  info "Init — MODE=$MODE, user=$HEADSCALE_USER, data=$HEADSCALE_DATA_DIR"

  # NVMe check
  if [[ ! -d /mnt/nvme ]]; then
    warn "/mnt/nvme nie istnieje — tworzę katalog lokalny (dev fallback)"
    HEADSCALE_DATA_DIR="./data/headscale"
  fi
  sudo mkdir -p "$HEADSCALE_DATA_DIR" 2>/dev/null || mkdir -p "$HEADSCALE_DATA_DIR"
  # Docker headscale uruchamia się jako root w kontenerze, ale pliki na hoście powinny być dostępne
  # Bare-metal headscale user to zazwyczaj 'headscale' lub 'seedinfer' — ustaw 755
  if id -u headscale >/dev/null 2>&1; then
    sudo chown headscale:headscale "$HEADSCALE_DATA_DIR" 2>/dev/null || true
  fi
  sudo chmod 755 "$HEADSCALE_DATA_DIR" 2>/dev/null || chmod 755 "$HEADSCALE_DATA_DIR"
  ok "data dir: $HEADSCALE_DATA_DIR"

  # Upewnij się że config i ACL istnieją
  if [[ ! -f "$HEADSCALE_CONFIG" ]]; then
    fail "Brak $HEADSCALE_CONFIG — skopiuj repo na Pi: rsync -avz ./ seedinfer@pi:/opt/seedinfer/"
  fi
  if [[ ! -f "$HEADSCALE_ACL" ]]; then
    fail "Brak $HEADSCALE_ACL"
  fi

  # Docker: zbuduj i uruchom headscale
  if [[ "$MODE" == "docker" ]]; then
    info "Uruchamiam Headscale (docker compose)..."
    # Na Pi repo jest w /opt/seedinfer — compose file używa relative volumes
    # Jeśli uruchamiasz z /opt/seedinfer:
    if [[ -f "$COMPOSE_FILE" ]]; then
      # Utwórz .env jeśli brak (opcjonalnie)
      touch .env 2>/dev/null || true
      docker compose -f "$COMPOSE_FILE" up -d
      info "Czekam na health Headscale (max 30s)..."
      for i in {1..30}; do
        if curl -s --max-time 2 http://127.0.0.1:8080/health >/dev/null 2>&1; then
          ok "Headscale healthy na 127.0.0.1:8080 (próba $i)"
          break
        fi
        if [[ $i -eq 30 ]]; then
          warn "Headscale nie odpowiada na 127.0.0.1:8080 po 30s — sprawdź: docker logs seedinfer-headscale"
          docker logs --tail 50 seedinfer-headscale 2>&1 || true
        fi
        sleep 1
      done
    else
      fail "Brak $COMPOSE_FILE"
    fi
  else
    # Bare-metal: systemd
    info "Bare-metal — restart headscale service"
    if [[ -f /etc/headscale/config.yaml ]]; then
      sudo cp "$HEADSCALE_CONFIG" /etc/headscale/config.yaml
      sudo cp "$HEADSCALE_ACL" /etc/headscale/acl.json
      sudo systemctl restart headscale
      sleep 2
      curl -s http://127.0.0.1:8080/health && ok "bare-metal headscale healthy" || warn "brak odpowiedzi 127.0.0.1:8080"
    else
      warn "/etc/headscale/config.yaml nie istnieje — instalujesz pierwszy raz? Zobacz docs/tailnet.md"
      sudo mkdir -p /etc/headscale
      sudo cp "$HEADSCALE_CONFIG" /etc/headscale/config.yaml
      sudo cp "$HEADSCALE_ACL" /etc/headscale/acl.json
      warn "Uruchom: sudo systemctl enable --now headscale"
    fi
  fi

  # Caddy reload (jeśli Caddy działa)
  if systemctl is-active --quiet caddy 2>/dev/null; then
    info "Reload Caddy (tailnet.seedinfer.com)..."
    sudo systemctl reload caddy 2>/dev/null || sudo caddy reload --config /etc/caddy/Caddyfile 2>&1 | head -n 20 || warn "Caddy reload failed — sprawdź Caddyfile"
  elif docker ps --filter name=seedinfer-caddy --format "{{.Names}}" 2>/dev/null | grep -q caddy; then
    info "Reload Caddy (docker)..."
    docker exec seedinfer-caddy caddy reload --config /etc/caddy/Caddyfile 2>&1 | head -n 20 || warn "docker caddy reload failed"
  fi

  # Cloudflared reload
  if systemctl is-active --quiet cloudflared 2>/dev/null; then
    info "Restart cloudflared (nowy ingress tailnet.seedinfer.com)..."
    sudo cp infra/cloudflared/config.yml /etc/cloudflared/config.yml 2>/dev/null || cp infra/cloudflared/config.yml /tmp/cloudflared-config.yml
    sudo systemctl restart cloudflared 2>/dev/null || warn "cloudflared restart failed — sprawdź /etc/cloudflared/config.yml"
  fi

  # Utwórz user seedinfer (idempotentnie)
  info "Tworzę user: $HEADSCALE_USER (jeśli nie istnieje)..."
  if hs users list 2>&1 | grep -qw "$HEADSCALE_USER"; then
    ok "user $HEADSCALE_USER już istnieje"
  else
    hs users create "$HEADSCALE_USER" 2>&1 | tee /tmp/hs-user-create.log
    # Weryfikacja
    if hs users list 2>&1 | grep -qw "$HEADSCALE_USER"; then
      ok "user $HEADSCALE_USER utworzony"
    else
      warn "users create nie potwierdził — sprawdź: $(cat /tmp/hs-user-create.log)"
    fi
  fi

  # API key (opcjonalnie, dla automatyzacji)
  if [[ "${CREATE_APIKEY:-0}" == "1" ]]; then
    info "Tworzę API key..."
    hs apikeys create 2>&1 | tee /tmp/hs-apikey.log
    ok "API key: $(cat /tmp/hs-apikey.log)"
  fi
fi

# --- Keys: preauth keys dla gateway/provider/seeder ---
if [[ "$DO_KEYS" == "1" ]]; then
  info "Generuję preauth keys (user=$HEADSCALE_USER)..."

  # Sprawdź user istnieje
  if ! hs users list 2>&1 | grep -qw "$HEADSCALE_USER"; then
    fail "user $HEADSCALE_USER nie istnieje — uruchom najpierw: $0  (bez --create-keys)"
  fi

  gen_key() {
    local TAG="$1"      # tag:gateway | tag:provider | tag:seeder
    local EXPIRY="$2"   # np. 24h, 720h (30d), 8760h (1y), lub --expiration 2026-12-31T00:00:00Z
    local REUSABLE="$3" # true/false
    local EPHEMERAL="$4" # true/false
    local OUT="/tmp/hs-key-${TAG//:/-}.log"

    info "  -> key $TAG (expiry=$EXPIRY reusable=$REUSABLE ephemeral=$EPHEMERAL)"

    # Headscale CLI: preauthkeys create --user <user> --reusable --expiration <dur> --tags tag:xxx
    # Flagi różnią się między wersjami — próbujemy kompatybilnie
    local CMD_ARGS=(preauthkeys create --user "$HEADSCALE_USER" --tags "$TAG")
    if [[ "$REUSABLE" == "true" ]]; then
      CMD_ARGS+=(--reusable)
    fi
    if [[ "$EPHEMERAL" == "true" ]]; then
      CMD_ARGS+=(--ephemeral)
    fi
    # expiration jako duration (headscale 0.25.x: --expiration 24h)
    CMD_ARGS+=(--expiration "$EXPIRY")

    # Uruchom
    if hs "${CMD_ARGS[@]}" >"$OUT" 2>&1; then
      local KEY
      KEY=$(grep -oE 'nodekey:[a-f0-9]+' "$OUT" | head -n1 || grep -oE '[a-f0-9]{48,}' "$OUT" | head -n1 || cat "$OUT")
      # Headscale 0.25 wypisuje tabelę — wyciągnij kolumnę key
      if [[ -z "$KEY" ]]; then
        KEY=$(cat "$OUT")
      fi
      echo "      key $TAG: $KEY"
      echo "$KEY" > "/tmp/hs-${TAG//:/-}.key"
      # Zapisz też env-friendly
      local ENV_NAME
      ENV_NAME=$(echo "$TAG" | tr '[:lower:]' '[:upper:]' | tr ':' '_') # TAG_GATEWAY
      echo "HEADSCALE_${ENV_NAME}_KEY=$KEY" >> /tmp/hs-keys.env
      ok "    $TAG -> /tmp/hs-${TAG//:/-}.key"
    else
      warn "    nie udało się utworzyć $TAG — log: $(cat "$OUT")"
      # Fallback: spróbuj bez --expiration (użyje default 1h)
      info "    retry bez --expiration..."
      if hs preauthkeys create --user "$HEADSCALE_USER" --reusable --tags "$TAG" >"$OUT" 2>&1; then
        cat "$OUT"
        ok "    $TAG (retry) OK"
      else
        warn "    retry też failed: $(cat "$OUT")"
      fi
    fi
  }

  # Wyczyść poprzednie env
  rm -f /tmp/hs-keys.env /tmp/hs-tag-*.key 2>/dev/null || true

  # Gateway — długi expiry (Pi jest stały), reusable, nie-ephemeral
  gen_key "tag:gateway" "720h" "true" "false"   # 30 dni

  # Provider — reusable, 24h (Faza 0: krótkie klucze, rotacja ręczna; w prod 720h)
  # --advertise-tags tag:provider wymaga reusable key z tagiem
  gen_key "tag:provider" "24h" "true" "false"

  # Seeder — przyszli seederzy, reusable 24h
  gen_key "tag:seeder" "24h" "true" "false"

  # Alternatywnie: ephemeral dla providerów testowych (auto-clean po offline)
  # gen_key "tag:provider" "24h" "true" "true"

  echo ""
  ok "Klucze zapisane w /tmp/hs-*.key oraz /tmp/hs-keys.env"
  if [[ -f /tmp/hs-keys.env ]]; then
    echo "--- /tmp/hs-keys.env ---"
    cat /tmp/hs-keys.env
    echo "------------------------"
  fi

  # Pokaż listę
  echo ""
  info "Aktualne preauthkeys (user=$HEADSCALE_USER):"
  hs preauthkeys list --user "$HEADSCALE_USER" 2>&1 || true

  echo ""
  echo "================================================================================"
  echo " UŻYCIE NA PROVIDERZE (RTX 5090):"
  echo "================================================================================"
  if [[ -f /tmp/hs-tag-provider.key ]]; then
    PROVIDER_KEY=$(cat /tmp/hs-tag-provider.key 2>/dev/null | tr -d '\n' | xargs)
    echo "  tailscale up --login-server https://tailnet.seedinfer.com --authkey $PROVIDER_KEY --advertise-tags tag:provider --hostname provider-5090"
  else
    echo "  tailscale up --login-server https://tailnet.seedinfer.com --authkey <KEY_PROVIDER> --advertise-tags tag:provider --hostname provider-5090"
  fi
  echo ""
  echo " UŻYCIE NA GATEWAY (Orange Pi, jeśli Pi sam ma być w Tailnecie):"
  if [[ -f /tmp/hs-tag-gateway.key ]]; then
    GATEWAY_KEY=$(cat /tmp/hs-tag-gateway.key 2>/dev/null | tr -d '\n' | xargs)
    echo "  tailscale up --login-server https://tailnet.seedinfer.com --authkey $GATEWAY_KEY --advertise-tags tag:gateway --hostname gateway --advertise-routes 100.64.0.0/10 --accept-routes"
  else
    echo "  tailscale up --login-server https://tailnet.seedinfer.com --authkey <KEY_GATEWAY> --advertise-tags tag:gateway --hostname gateway"
  fi
  echo ""
  echo " WERYFIKACJA:"
  echo "  curl -fsSL https://tailnet.seedinfer.com/health   # via Cloudflare Tunnel+Caddy"
  echo "  curl -fsSL http://127.0.0.1:8080/health            # lokalnie na Pi"
  echo "  headscale nodes list"
  echo "  tailscale status"
  echo "================================================================================"
  echo ""
  warn "SKOPIUJ klucze z /tmp/hs-*.key do bezpiecznego miejsca (1Password/env) i usuń /tmp/hs-*.key po użyciu!"
fi

ok "Done — MODE=$MODE"

# --- Hint: enable IP forwarding jeśli Pi ma być subnet router ---
# sudo sysctl -w net.ipv4.ip_forward=1
# sudo sysctl -w net.ipv6.conf.all.forwarding=1
# echo 'net.ipv4.ip_forward=1' | sudo tee -a /etc/sysctl.conf
