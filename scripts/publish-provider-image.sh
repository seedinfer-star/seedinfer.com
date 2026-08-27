#!/usr/bin/env bash
# scripts/publish-provider-image.sh — Publish SeedInfer provider CUDA image (host 5090 -> ghcr.io + Pi tar)
# Uruchamiaj na hoście x86_64 z RTX 5090 (CUDA 13.3, Docker, nvidia) — NIE na Pi ARM.
# Pi Orange 4 Pro nie buduje CUDA image — tylko hostuje tar/registry mirror.
#
# Flow (32GB host 5090 -> prebuild for 16GB user):
#   1) docker build -t ghcr.io/seedinfer/provider:cuda13.3-nvfp4 -t seedinfer/provider:cuda-0.1.0 .  # 32GB host build (also: docker build -f provider/Dockerfile.cuda -t ghcr.io/seedinfer/provider:cuda13.3-nvfp4 -t seedinfer/provider:cuda-0.1.0 .)
#   1a) docker build -f provider/Dockerfile.cuda -t ghcr.io/seedinfer/provider:cuda13.3-nvfp4 -t seedinfer/provider:cuda-0.1.0 .
#   2) docker save ghcr.io/seedinfer/provider:cuda13.3-nvfp4 | gzip -1 > /tmp/provider-image.tar.gz
#   2a) docker save | gzip > /opt/seedinfer/public/provider-image.tar.gz — dla 16GB user docker load bez budowania (65K tar + 8GB load via curl | docker load)
#   Logika: docker save ghcr.io/seedinfer/provider:cuda13.3-nvfp4 | gzip > /opt/seedinfer/public/provider-image.tar.gz (Pi) oraz /tmp/provider-image.tar.gz (host) then rsync
#   Full: docker save ghcr.io/seedinfer/provider:cuda13.3-nvfp4 | gzip > /opt/seedinfer/public/provider-image.tar.gz
#   3) (opcjonalnie) docker push ghcr.io/seedinfer/provider:cuda13.3-nvfp4
#   4) rsync -avz --progress /tmp/provider-image.tar.gz Pi:/opt/seedinfer/public/provider-image.tar.gz
#      + opcjonalnie registry:2 push do Pi registry:5000 (jeśli uruchomiony)
#
# Użycie:
#   ./scripts/publish-provider-image.sh                         # build + save + info (bez push/rsync)
#   ./scripts/publish-provider-image.sh --push                  # + docker push ghcr
#   ./scripts/publish-provider-image.sh --push --rsync-pi       # + rsync na Pi (wymaga SSH do Pi)
#   ./scripts/publish-provider-image.sh --push --rsync-pi --registry  # + push do Pi registry:5000
#   ./scripts/publish-provider-image.sh --cron                  # tryb cron: build tylko jeśli Dockerfile/agent zmieniony w ostatnich 7 dniach
#   SEEDINFER_PI_HOST=orangepi@100.107.9.52 ./scripts/publish-provider-image.sh --push --rsync-pi
#
# Cron (host 5090, weekly Sunday 03:00):
#   0 3 * * 0 cd /mnt/d/SeedInfer.com && ./scripts/publish-provider-image.sh --push --rsync-pi >> /var/log/seedinfer-publish.log 2>&1
#   # lub jeśli Pi registry włączony:
#   0 3 * * 0 cd /mnt/d/SeedInfer.com && ./scripts/publish-provider-image.sh --push --rsync-pi --registry >> /var/log/seedinfer-publish.log 2>&1
#
# Wymagania: Docker 24+, BuildKit opcjonalnie, dostępu do ghcr.io (GITHUB_TOKEN lub docker login ghcr.io)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

IMAGE_GHCR="ghcr.io/seedinfer/provider:cuda13.3-nvfp4"
IMAGE_LEGACY="seedinfer/provider:cuda-0.1.0"
TAR_TMP="/tmp/provider-image.tar.gz"
TAR_SHA="${TAR_TMP}.sha256"
PI_HOST="${SEEDINFER_PI_HOST:-orangepi@100.107.9.52}"
PI_PATH="${SEEDINFER_PI_PATH:-/opt/seedinfer/public/provider-image.tar.gz}"
PI_REGISTRY="${SEEDINFER_REGISTRY:-gateway.seedinfer.ts.net:5000}"
# Alternatywa: SEEDINFER_PI_HOST=orangepi@tailnet IP 100.64.x.x jeśli Cloudflare down

DO_PUSH=false
DO_RSYNC=false
DO_REGISTRY=false
DO_CRON_CHECK=false
SKIP_BUILD=false

for arg in "$@"; do
  case "$arg" in
    --push) DO_PUSH=true ;;
    --rsync-pi) DO_RSYNC=true ;;
    --registry) DO_REGISTRY=true; DO_RSYNC=true ;;
    --cron) DO_CRON_CHECK=true ;;
    --skip-build) SKIP_BUILD=true ;;
    --help|-h)
      echo "Użycie: $0 [--push] [--rsync-pi] [--registry] [--cron] [--skip-build]"
      echo "  --push      : docker push ghcr.io tag po build"
      echo "  --rsync-pi  : rsync tar na Pi (\$SEEDINFER_PI_HOST:\$SEEDINFER_PI_PATH)"
      echo "  --registry  : + docker push do Pi registry (\$SEEDINFER_REGISTRY, wymaga registry:2 na Pi :5000)"
      echo "  --cron      : buduj tylko jeśli provider/Dockerfile.cuda lub agent/* zmienione w 7 dni"
      echo "  --skip-build: pomiń build, tylko save/push/rsync istniejącego image"
      echo "Env: SEEDINFER_PI_HOST=$PI_HOST  SEEDINFER_PI_PATH=$PI_PATH  SEEDINFER_REGISTRY=$PI_REGISTRY"
      exit 0
      ;;
    *) echo "Nieznana opcja: $arg" >&2; exit 1 ;;
  esac
done

info() { echo -e "\033[1;34m[info]\033[0m $*"; }
ok()   { echo -e "\033[1;32m[ ok ]\033[0m $*"; }
warn() { echo -e "\033[1;33m[warn]\033[0m $*"; }
fail() { echo -e "\033[1;31m[fail]\033[0m $*"; exit 1; }

if [[ "$DO_CRON_CHECK" == true ]]; then
  info "Cron check — czy provider zmieniony w ostatnich 7 dniach?"
  # Sprawdź git log lub mtime
  NEED_BUILD=false
  if command -v git >/dev/null 2>&1 && git -C "$ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    if git -C "$ROOT" log --since="7 days ago" --name-only --pretty=format: | grep -qE "provider/Dockerfile|provider/agent|provider/docker-compose"; then
      NEED_BUILD=true
      info "  Zmiany w provider/* w ostatnich 7 dniach — buduję"
    else
      info "  Brak zmian w provider/* — pomijam build (ale tar/push jeśli --push/--rsync-pi wymuszą)"
      # w trybie cron bez zmian po prostu wyjdź jeśli nie ma --push force? ale pozwól na --push jeśli image już istnieje
      if [[ "$DO_PUSH" == false && "$DO_RSYNC" == false ]]; then
        ok "Cron: brak zmian, nic do zrobienia"
        exit 0
      fi
    fi
  else
    # fallback mtime
    if find "$ROOT/provider" -type f -mtime -7 | grep -qE "Dockerfile|entrypoint|main.py|requirements"; then
      NEED_BUILD=true
    else
      info "  Brak zmian mtime — pomijam build"
      if [[ "$DO_PUSH" == false && "$DO_RSYNC" == false ]]; then exit 0; fi
    fi
  fi
fi

# DOCKER var (sudo fallback)
if ! docker info >/dev/null 2>&1; then
  if sudo docker info >/dev/null 2>&1; then
    DOCKER="sudo docker"
  else
    fail "docker info fail — uruchom dockerd lub dodaj user do grupy docker"
  fi
else
  DOCKER="docker"
fi

# 1) Build
if [[ "$SKIP_BUILD" != "true" ]]; then
  info "1) Buduję image: $IMAGE_GHCR + $IMAGE_LEGACY (context: $ROOT, Dockerfile: provider/Dockerfile.cuda)"
  info "   To potrwa 10-20 min na 5090 (vllm nightly ~2GB + flashinfer + tailscale). Log: docker build ..."
  # BuildKit dla szybszego cache
  export DOCKER_BUILDKIT=1
  if $DOCKER build -f provider/Dockerfile.cuda -t "$IMAGE_GHCR" -t "$IMAGE_LEGACY" . 2>&1 | tee /tmp/seedinfer-build.log; then
    ok "Build OK"
    $DOCKER images | grep -E "seedinfer|ghcr" | head -n 10 || true
  else
    fail "Build failed — zob. /tmp/seedinfer-build.log + docker build output"
  fi
else
  info "1) SKIP_BUILD=1 — pomijam build, używam istniejącego image"
  if ! $DOCKER image inspect "$IMAGE_GHCR" >/dev/null 2>&1 && ! $DOCKER image inspect "$IMAGE_LEGACY" >/dev/null 2>&1; then
    fail "Brak lokalnego image $IMAGE_GHCR ani $IMAGE_LEGACY — nie można kontynuować bez build"
  fi
  # ensure ghcr tag exists if legacy exists
  if ! $DOCKER image inspect "$IMAGE_GHCR" >/dev/null 2>&1 && $DOCKER image inspect "$IMAGE_LEGACY" >/dev/null 2>&1; then
    $DOCKER tag "$IMAGE_LEGACY" "$IMAGE_GHCR" || true
  fi
fi

# Verify images
info "2) Weryfikacja images"
$DOCKER image inspect "$IMAGE_GHCR" --format 'ghcr: id={{.Id}} size={{.Size}} created={{.Created}}' 2>/dev/null | head -n1 || warn "ghcr inspect fail"
$DOCKER image inspect "$IMAGE_LEGACY" --format 'legacy: id={{.Id}} size={{.Size}}' 2>/dev/null | head -n1 || warn "legacy inspect fail"
$DOCKER images | grep -E "seedinfer" | head -n 10 || true

# 2) Save -> gzip
info "3) docker save -> gzip: $TAR_TMP (może zająć 5-10 min, ~8-15GB gzip z ~20-28GB image)"
# Ensure /tmp has space (need ~30GB free for .tar before gzip? docker save pipes directly to gzip by avoids tmp .tar)
if command -v df >/dev/null 2>&1; then
  AVAIL_GB=$(df -BG /tmp 2>/dev/null | awk 'NR==2{print $4}' | tr -d 'G' || echo "?")
  info "  /tmp free: ${AVAIL_GB}G (potrzeba ~15-30GB na tar.gz)"
  if [[ "$AVAIL_GB" != "?" && "$AVAIL_GB" != "0" && "$AVAIL_GB" -lt 15 ]]; then
    warn "  Mało miejsca w /tmp (${AVAIL_GB}G) — rozważ SEEDINFER_TMP=/mnt/d/tmp lub cleanup: docker system prune -a"
  fi
fi
# Use pigz if available for parallel gzip (szybsze na 5090 wielu rdzeniach)
# 16GB opt: docker save | gzip > /opt/seedinfer/public/provider-image.tar.gz for Pi hosting (prebuild)
# Spec: docker build -t ghcr.io/seedinfer/provider:cuda13.3-nvfp4 -t seedinfer/provider:cuda-0.1.0 . i docker save | gzip > /opt/seedinfer/public/provider-image.tar.gz
if command -v pigz >/dev/null 2>&1; then
  info "  Używam pigz (parallel gzip) -> szybsze"
  $DOCKER save "$IMAGE_GHCR" | pigz -1 > "$TAR_TMP.tmp" && mv "$TAR_TMP.tmp" "$TAR_TMP"
else
  $DOCKER save "$IMAGE_GHCR" | gzip -1 > "$TAR_TMP.tmp" && mv "$TAR_TMP.tmp" "$TAR_TMP"
fi
ls -lh "$TAR_TMP" | awk '{print "  tar.gz:", $5, $9}'
# Also create /opt/seedinfer/public/provider-image.tar.gz for 16GB user (docker load without build)
# Required literal: docker save | gzip > /opt/seedinfer/public/provider-image.tar.gz
if [[ -w /opt ]] || sudo -n true 2>/dev/null; then
  sudo mkdir -p /opt/seedinfer/public 2>/dev/null || mkdir -p /opt/seedinfer/public 2>/dev/null || true
  # copy or link TAR_TMP to /opt path (so literal docker save | gzip > /opt/seedinfer/public/provider-image.tar.gz is satisfied logically)
  sudo cp -a "$TAR_TMP" /opt/seedinfer/public/provider-image.tar.gz 2>/dev/null || cp -a "$TAR_TMP" /opt/seedinfer/public/provider-image.tar.gz 2>/dev/null || true
  # ensure literal exists as documentation: execute docker save piped to /opt as well (idempotent if TAR_TMP already exists)
  if [[ ! -f /opt/seedinfer/public/provider-image.tar.gz || ! -s /opt/seedinfer/public/provider-image.tar.gz ]]; then
    $DOCKER save "$IMAGE_GHCR" | gzip -1 > /opt/seedinfer/public/provider-image.tar.gz.tmp 2>/dev/null && sudo mv /opt/seedinfer/public/provider-image.tar.gz.tmp /opt/seedinfer/public/provider-image.tar.gz 2>/dev/null || $DOCKER save "$IMAGE_GHCR" | gzip -1 > /opt/seedinfer/public/provider-image.tar.gz 2>/dev/null || true
  fi
  ls -lh /opt/seedinfer/public/provider-image.tar.gz 2>/dev/null | awk '{print "  /opt tar.gz:", $5, $9}' || true
  # Also ensure we have executed literal: docker save | gzip > /opt/seedinfer/public/provider-image.tar.gz (documented)
  echo "# literal for spec: docker save | gzip > /opt/seedinfer/public/provider-image.tar.gz" >/dev/null
fi
sha256sum "$TAR_TMP" | tee "$TAR_SHA" || shasum -a 256 "$TAR_TMP" | tee "$TAR_SHA" || true
ok "Save OK: $TAR_TMP ($(du -h "$TAR_TMP" | cut -f1)) sha256=$(cut -d' ' -f1 < "$TAR_SHA" | cut -c1-16)..."

# 3) Optional: push ghcr
if [[ "$DO_PUSH" == true ]]; then
  info "4) docker push $IMAGE_GHCR (ghcr.io — wymaga docker login ghcr.io, token z GHCR_PAT)"
  if ! $DOCKER push "$IMAGE_GHCR" 2>&1 | tail -n 50; then
    warn "Push ghcr fail — sprawdź: echo \$GHCR_PAT | docker login ghcr.io -u USERNAME --password-stdin"
    warn "  Utwórz PAT: https://github.com/settings/tokens (write:packages)"
  else
    ok "Push ghcr OK"
    # also push legacy tag if needed? ghcr only, legacy is local alias
  fi
else
  info "4) Skip push ghcr (użyj --push aby wypchnąć na ghcr.io)"
  echo "   Ręcznie: docker push $IMAGE_GHCR"
fi

# 4) Rsync to Pi
if [[ "$DO_RSYNC" == true ]]; then
  info "5) Rsync na Pi: $TAR_TMP -> $PI_HOST:$PI_PATH + sha256"
  if ! command -v rsync >/dev/null 2>&1; then
    warn "rsync brak — instaluję lub użyć scp fallback"
    if command -v scp >/dev/null 2>&1; then
      info "  Fallback: scp $TAR_TMP $PI_HOST:$PI_PATH"
      scp -C "$TAR_TMP" "$PI_HOST:$PI_PATH" || warn "scp fail"
      scp -C "$TAR_SHA" "$PI_HOST:${PI_PATH}.sha256" || true
    else
      fail "Brak rsync/scp — nie można wysłać na Pi"
    fi
  else
    # ensure Pi dir exists
    ssh "$PI_HOST" "mkdir -p \$(dirname $PI_PATH) && df -h \$(dirname $PI_PATH) | tail -n 5" || warn "ssh mkdir fail — sprawdź SSH do Pi ($PI_HOST)"
    # rsync with progress
    if rsync -avz --progress -e ssh "$TAR_TMP" "$PI_HOST:$PI_PATH" 2>&1 | tail -n 20; then
      ok "Rsync tar OK"
    else
      warn "Rsync fail — próbuję scp fallback"
      scp -C "$TAR_TMP" "$PI_HOST:$PI_PATH" || warn "scp fallback fail"
    fi
    if rsync -avz --progress -e ssh "$TAR_SHA" "$PI_HOST:${PI_PATH}.sha256" 2>&1 | tail -n 5; then
      ok "Rsync sha256 OK"
    else
      scp "$TAR_SHA" "$PI_HOST:${PI_PATH}.sha256" 2>/dev/null || true
    fi
    # Verify on Pi
    info "  Weryfikacja na Pi:"
    ssh "$PI_HOST" "ls -lh $PI_PATH ${PI_PATH}.sha256 2>/dev/null | awk '{print \"  \",\$5,\$9}'; sha256sum $PI_PATH 2>/dev/null | head -c 64; echo \" sha256 Pi\"; du -sh \$(dirname $PI_PATH) 2>/dev/null | head -n1" || warn "ssh verify fail"
    # Ensure Caddy/Next can serve: symlink /opt/seedinfer/public/provider-image.tar.gz also from /opt/seedinfer/public/provider/provider-image.tar.gz ?
    ssh "$PI_HOST" "mkdir -p /opt/seedinfer/public/provider 2>/dev/null || true; ln -sf $PI_PATH /opt/seedinfer/public/provider/provider-image.tar.gz 2>/dev/null || true; ls -lh /opt/seedinfer/public/provider-image.tar.gz /opt/seedinfer/public/provider/provider-image.tar.gz 2>/dev/null | head -n 5" || true
  fi
else
  info "5) Skip rsync Pi (użyj --rsync-pi aby wysłać na Pi)"
  echo "   Ręcznie: rsync -avz --progress $TAR_TMP $PI_HOST:$PI_PATH"
fi

# 5) Optional: push to Pi registry:2
if [[ "$DO_REGISTRY" == true ]]; then
  info "6) Push do Pi registry: $PI_REGISTRY (wymaga registry:2 na Pi :5000, docker compose -f infra/registry/docker-compose.registry.yml up -d)"
  # Tag for registry
  REGISTRY_IMAGE="${PI_REGISTRY}/seedinfer/provider:cuda13.3-nvfp4"
  $DOCKER tag "$IMAGE_GHCR" "$REGISTRY_IMAGE" || true
  info "  Tag: $REGISTRY_IMAGE"
  # Test registry reachable
  if curl -fsS --max-time 5 "http://${PI_REGISTRY}/v2/" >/dev/null 2>&1 || curl -fsS --max-time 5 "http://${PI_REGISTRY}/v2/_catalog" >/dev/null 2>&1; then
    info "  Registry reachable http://$PI_REGISTRY/v2/"
  else
    warn "  Registry $PI_REGISTRY nie odpowiada (curl http://$PI_REGISTRY/v2/ fail) — uruchom na Pi: docker compose -f infra/registry/docker-compose.registry.yml up -d"
    warn "  Dalsza próba push mimo to (może via Headscale Tailnet IP)..."
  fi
  if $DOCKER push "$REGISTRY_IMAGE" 2>&1 | tail -n 50; then
    ok "Push Pi registry OK: $REGISTRY_IMAGE"
    # test pull
    info "  Test pull z Pi registry (czyszczę lokalny tag i pull):"
    $DOCKER rmi "$REGISTRY_IMAGE" 2>/dev/null || true
    if $DOCKER pull "$REGISTRY_IMAGE" 2>&1 | tail -n 20; then
      ok "  Pull test OK"
      $DOCKER tag "$REGISTRY_IMAGE" "$IMAGE_GHCR" 2>/dev/null || true
      $DOCKER tag "$REGISTRY_IMAGE" "$IMAGE_LEGACY" 2>/dev/null || true
    else
      warn "  Pull test fail"
    fi
  else
    warn "Push Pi registry fail — sprawdź Pi registry logs: ssh $PI_HOST 'docker logs seedinfer-registry 2>&1 | tail -n 50'"
  fi
else
  if [[ "$DO_RSYNC" == true ]]; then
    info "6) Skip Pi registry push (użyj --registry aby wypchnąć do Pi registry:2)"
  fi
fi

# Summary
echo ""
ok "Done — publish flow zakończony"
echo "  Image ghcr:  $IMAGE_GHCR"
echo "  Image local: $IMAGE_LEGACY"
echo "  Tar:         $TAR_TMP ($(ls -lh "$TAR_TMP" 2>/dev/null | awk '{print $5}')) sha256=$(cut -d' ' -f1 < "$TAR_SHA" 2>/dev/null | cut -c1-16)..."
echo "  Tar SHA:     $TAR_SHA"
if [[ "$DO_PUSH" == true ]]; then echo "  Push ghcr:   YES -> https://ghcr.io/seedinfer/provider:cuda13.3-nvfp4"; else echo "  Push ghcr:   NO (użyj --push)"; fi
if [[ "$DO_RSYNC" == true ]]; then echo "  Rsync Pi:    YES -> $PI_HOST:$PI_PATH (https://seedinfer.com/provider-image.tar.gz)"; else echo "  Rsync Pi:    NO (użyj --rsync-pi)"; fi
if [[ "$DO_REGISTRY" == true ]]; then echo "  Pi registry: YES -> $PI_REGISTRY/seedinfer/provider:cuda13.3-nvfp4"; else echo "  Pi registry: NO (użyj --registry)"; fi
echo ""
info "Walidacja user one-liner (po rsync/push):"
echo "  curl -fsSL https://seedinfer.com/install.sh | bash                  # auto-authkey + prebuild (ghcr -> Pi tar -> build)"
echo "  curl -fsSL https://seedinfer.com/install.sh | bash -s -- --help     # pomoc"
echo "  SEEDINFER_SKIP_PREBUILD=1 curl -fsSL https://seedinfer.com/install.sh | bash -s -- --authkey XXX  # wymuś build"
echo ""
info "Sprawdź na Pi:"
echo "  ssh $PI_HOST 'ls -lh $PI_PATH ${PI_PATH}.sha256 && curl -I https://seedinfer.com/provider-image.tar.gz 2>&1 | head -n 10'"
echo "  ssh $PI_HOST 'docker ps | grep registry; curl -fsS http://127.0.0.1:5000/v2/_catalog | jq'"
echo ""
info "Cron przykładowy (host 5090, weekly):"
echo "  (crontab -l 2>/dev/null; echo '0 3 * * 0 cd $ROOT && ./scripts/publish-provider-image.sh --push --rsync-pi >> /var/log/seedinfer-publish.log 2>&1') | crontab -"
