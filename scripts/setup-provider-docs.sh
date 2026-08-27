#!/usr/bin/env bash
# scripts/setup-provider-docs.sh — SeedInfer Provider pack packaging
# Generuje provider.tar.gz + sync README do Pi /opt/seedinfer/public/provider/README.md
# Użycie:
#   ./scripts/setup-provider-docs.sh                  # build + checks
#   ./scripts/setup-provider-docs.sh --check          # tylko walidacja
#   ./scripts/setup-provider-docs.sh --pi             # tryb Pi: kopiuje do /opt/seedinfer/public/provider
#   ./scripts/setup-provider-docs.sh --pi --sync      # + rsync do docs/provider.md
# Hosting: https://seedinfer.com/provider.tar.gz (via Next /api/provider-archive + public/provider.tar.gz)
#          https://seedinfer.com/install.sh           (via Next /install.sh route)
#          https://seedinfer.com/provider             (landing page)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

MODE="build"
PI_MODE=false
SYNC=false

for arg in "$@"; do
  case "$arg" in
    --check) MODE="check" ;;
    --pi) PI_MODE=true ;;
    --sync) SYNC=true; PI_MODE=true ;;
    --help|-h)
      echo "Użycie: $0 [--check|--pi|--sync]"
      echo "  --check : tylko walidacja (npm build, bash -n, curl)"
      echo "  --pi    : tryb Pi — kopiuje do /opt/seedinfer/public/provider"
      echo "  --sync  : + sync docs/provider.md"
      exit 0
      ;;
  esac
done

info() { echo -e "\033[1;34m[info]\033[0m $*"; }
ok()   { echo -e "\033[1;32m[ ok ]\033[0m $*"; }
warn() { echo -e "\033[1;33m[warn]\033[0m $*"; }
fail() { echo -e "\033[1;31m[fail]\033[0m $*"; exit 1; }

# --- Paths ---
PROVIDER_DIR="$ROOT/provider"
PROVIDER_TAR="$ROOT/provider.tar.gz"
PUBLIC_DIR="$ROOT/public"
PUBLIC_PROVIDER_DIR="$PUBLIC_DIR/provider"
PUBLIC_TAR="$PUBLIC_PROVIDER_DIR/provider.tar.gz"
PUBLIC_INSTALL="$PUBLIC_DIR/install.sh"
DOC_PROVIDER="$ROOT/docs/provider.md"
PI_PUBLIC="/opt/seedinfer/public/provider"
PI_DOC="/opt/seedinfer/docs/provider.md"
PI_TAR="/opt/seedinfer/public/provider.tar.gz"

# Ensure dirs
mkdir -p "$PUBLIC_PROVIDER_DIR" 2>/dev/null || true
mkdir -p "$(dirname "$DOC_PROVIDER")" 2>/dev/null || true

if [[ "$MODE" == "check" ]]; then
  info "Check mode — walidacja provider pack"
fi

# 1) Validate install.sh syntax
info "1) bash -n provider/scripts/install.sh"
if bash -n "$PROVIDER_DIR/scripts/install.sh"; then
  ok "bash -n OK"
else
  fail "bash -n FAILED"
fi

# 2) Validate provider files exist
info "2) provider/* existence"
for f in "$PROVIDER_DIR/Dockerfile.cuda" "$PROVIDER_DIR/docker-compose.yml" "$PROVIDER_DIR/.env.example" "$PROVIDER_DIR/README.md" "$PROVIDER_DIR/agent/main.py" "$PROVIDER_DIR/agent/entrypoint.sh" "$PROVIDER_DIR/agent/requirements.txt"; do
  if [[ -f "$f" ]]; then
    ok "  $f"
  else
    warn "  MISSING $f"
  fi
done

# 3) docker compose config (if docker available)
if command -v docker >/dev/null 2>&1; then
  info "3) docker compose config"
  if docker compose -f "$PROVIDER_DIR/docker-compose.yml" config >/dev/null 2>&1; then
    ok "docker compose config OK"
  else
    warn "docker compose config FAILED (sprawdź .env)"
    docker compose -f "$PROVIDER_DIR/docker-compose.yml" config 2>&1 | head -n 20 || true
  fi
else
  warn "3) docker not found — skip compose config"
fi

# 4) Next.js build check (if --check)
if [[ "$MODE" == "check" ]]; then
  info "4) npm run build (Next.js 16/16)"
  if command -v npm >/dev/null 2>&1; then
    if npm run build 2>&1 | tail -n 30; then
      ok "npm run build done"
    else
      warn "npm run build FAILED"
    fi
  else
    warn "npm not found"
  fi
  # curl /install.sh check if dev running
  info "5) curl install.sh (if Next dev running on :3002)"
  if curl -fsS --max-time 3 http://127.0.0.1:3002/install.sh >/dev/null 2>&1; then
    ok "curl http://127.0.0.1:3002/install.sh OK"
    curl -fsS http://127.0.0.1:3002/install.sh 2>/dev/null | head -n 5
  else
    warn "curl http://127.0.0.1:3002/install.sh FAILED — uruchom npm run dev"
  fi
  if curl -fsS --max-time 3 http://127.0.0.1:3002/api/provider-archive >/dev/null 2>&1; then
    ok "curl /api/provider-archive OK"
  else
    warn "curl /api/provider-archive not reachable"
  fi
  # bash -n Next routes? skip
  ok "Check done"
  exit 0
fi

# 5) Generate provider.tar.gz
info "5) Generuję provider.tar.gz"
# Use tar -czf with -C ROOT to include provider/ prefix
if command -v tar >/dev/null 2>&1; then
  # Exclude .env (real key) but keep .env.example; exclude cache
  tar --exclude='provider/.env' --exclude='provider/models/cache' --exclude='__pycache__' --exclude='.git' -czf "$PROVIDER_TAR" -C "$ROOT" provider 2>/dev/null || tar -czf "$PROVIDER_TAR" -C "$ROOT" provider
  ok "provider.tar.gz -> $PROVIDER_TAR ($(du -h "$PROVIDER_TAR" 2>/dev/null | cut -f1 || echo "?"))"
else
  warn "tar not found — cannot generate provider.tar.gz"
fi

# 6) Copy to public/provider.tar.gz (for Next static serving)
info "6) Kopiuję do public/provider.tar.gz"
if [[ -f "$PROVIDER_TAR" ]]; then
  cp -f "$PROVIDER_TAR" "$PUBLIC_TAR"
  cp -f "$PROVIDER_TAR" "$PUBLIC_DIR/provider.tar.gz" 2>/dev/null || true
  # Also copy to root provider.tar.gz alias for Caddy direct
  cp -f "$PROVIDER_TAR" "$ROOT/public-provider.tar.gz" 2>/dev/null || true
  ok "  $PUBLIC_TAR"
  ls -lh "$PUBLIC_TAR" 2>/dev/null | awk '{print "  size:", $5, $9}'
fi

# 7) Copy install.sh to public/install.sh
info "7) Kopiuję provider/scripts/install.sh -> public/install.sh"
if [[ -f "$PROVIDER_DIR/scripts/install.sh" ]]; then
  cp -f "$PROVIDER_DIR/scripts/install.sh" "$PUBLIC_INSTALL"
  # also public/provider/install.sh for Pi Caddy fallback
  cp -f "$PROVIDER_DIR/scripts/install.sh" "$PUBLIC_PROVIDER_DIR/install.sh" 2>/dev/null || true
  ok "  $PUBLIC_INSTALL"
fi

# 8) Sync README.md -> docs/provider.md + public/provider/README.md
info "8) Sync provider/README.md -> public/provider/README.md + docs/provider.md"
if [[ -f "$PROVIDER_DIR/README.md" ]]; then
  cp -f "$PROVIDER_DIR/README.md" "$PUBLIC_PROVIDER_DIR/README.md"
  cp -f "$PROVIDER_DIR/README.md" "$DOC_PROVIDER"
  ok "  $PUBLIC_PROVIDER_DIR/README.md"
  ok "  $DOC_PROVIDER"
  # Also generate minimal /opt/seedinfer-style README if on dev
  mkdir -p "$ROOT/.tmp-pi" 2>/dev/null || true
  cat > "$ROOT/.tmp-pi/README.pi.md" <<EOF
# SeedInfer Provider — Pi gateway sync
# Generated: $(date -Iseconds) via scripts/setup-provider-docs.sh
# Source: provider/README.md (synced to /opt/seedinfer/public/provider/README.md on Pi)
# Access: https://seedinfer.com/provider  +  https://seedinfer.com/install.sh  +  https://seedinfer.com/provider.tar.gz
# Pi paths: /opt/seedinfer/public/provider/README.md  |  /opt/seedinfer/docs/provider.md  |  /opt/seedinfer/public/provider.tar.gz
EOF
fi

# 9) Pi mode: copy to /opt/seedinfer
if [[ "$PI_MODE" == true ]]; then
  info "9) Pi mode — kopiuję do /opt/seedinfer"
  if [[ -d "/opt/seedinfer" ]]; then
    sudo mkdir -p "$PI_PUBLIC" 2>/dev/null || mkdir -p "$PI_PUBLIC" || true
    sudo mkdir -p "$(dirname "$PI_DOC")" 2>/dev/null || mkdir -p "$(dirname "$PI_DOC")" || true
    # Requires sudo on Pi; try with sudo, fallback without
    if sudo cp -f "$PROVIDER_DIR/README.md" "$PI_PUBLIC/README.md" 2>/dev/null; then
      ok "  $PI_PUBLIC/README.md"
    else
      cp -f "$PROVIDER_DIR/README.md" "$PI_PUBLIC/README.md" 2>/dev/null || warn "  fail $PI_PUBLIC/README.md"
    fi
    if sudo cp -f "$DOC_PROVIDER" "$PI_DOC" 2>/dev/null; then
      ok "  $PI_DOC"
    else
      cp -f "$DOC_PROVIDER" "$PI_DOC" 2>/dev/null || true
    fi
    if [[ -f "$PROVIDER_TAR" ]]; then
      if sudo cp -f "$PROVIDER_TAR" "$PI_TAR" 2>/dev/null; then
        ok "  $PI_TAR"
      else
        cp -f "$PROVIDER_TAR" "$PI_TAR" 2>/dev/null || true
      fi
      # Also ensure Caddy can serve via /opt/seedinfer/public/provider.tar.gz
      if sudo cp -f "$PROVIDER_TAR" "$PI_PUBLIC/provider.tar.gz" 2>/dev/null; then ok "  $PI_PUBLIC/provider.tar.gz"; fi
    fi
    if [[ -f "$PROVIDER_DIR/scripts/install.sh" ]]; then
      if sudo cp -f "$PROVIDER_DIR/scripts/install.sh" "$PI_PUBLIC/install.sh" 2>/dev/null; then ok "  $PI_PUBLIC/install.sh"; fi
    fi
    # Fix perms
    sudo chown -R "$(whoami)":"$(whoami)" "/opt/seedinfer/public" 2>/dev/null || true
    sudo chmod -R 755 "/opt/seedinfer/public" 2>/dev/null || true
  else
    warn "  /opt/seedinfer nie istnieje — skip Pi copy (uruchom na Pi lub sudo mkdir -p /opt/seedinfer)"
    info "  Dev fallback: $ROOT/.tmp-pi/ zawiera preview Pi structure"
    mkdir -p "$ROOT/.tmp-pi/public/provider" 2>/dev/null || true
    cp -f "$PROVIDER_DIR/README.md" "$ROOT/.tmp-pi/public/provider/README.md" 2>/dev/null || true
    cp -f "$PROVIDER_TAR" "$ROOT/.tmp-pi/public/provider.tar.gz" 2>/dev/null || true
  fi
fi

# 10) Summary
echo ""
ok "Done — provider pack ready"
echo "  https://seedinfer.com/install.sh           -> app/install.sh/route.ts (text/x-shellscript, no-store)"
echo "  https://seedinfer.com/api/install          -> alias (308 -> /install.sh, curl ok)"
echo "  https://seedinfer.com/provider             -> app/provider/page.tsx (landing Become a Provider)"
echo "  https://seedinfer.com/provider.tar.gz      -> /api/provider-archive (tar czf provider) + public/provider.tar.gz"
echo "  https://seedinfer.com/api/v1/auth/request  -> stub mock hskey-demo-xxx / headscale"
echo "  https://seedinfer.com/api/v1/providers     -> fleet heartbeat verified"
echo "  Pi: /opt/seedinfer/public/provider/README.md + /opt/seedinfer/public/provider.tar.gz (via --pi)"
echo ""
info "Walidacja:"
echo "  bash -n provider/scripts/install.sh && echo OK"
bash -n "$PROVIDER_DIR/scripts/install.sh" && echo "  bash -n OK" || echo "  bash -n FAIL"
echo "  curl http://localhost:3002/install.sh | head -n 5  (wymaga npm run dev)"
echo "  npm run build  # oczekiwano 16/16"
echo ""
if [[ -f "$PROVIDER_TAR" ]]; then
  echo "  ls -lh provider.tar.gz public/provider.tar.gz:"
  ls -lh "$PROVIDER_TAR" "$PUBLIC_TAR" 2>/dev/null | awk '{print "   ", $5, $9}'
fi
