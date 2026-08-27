# SeedInfer.com — Tailnet Headscale (Phase 0)

> **Phase 0** = tylko **Nemotron Lightning** (1M context, 2M KV) na **RTX 5090** providera, bez OpenRouter, bez Qwen/Gemma. Tailnet spina **Orange Pi 4 Pro (RK3588)** jako `tag:gateway` + providera RTX 5090 (`tag:provider`) + przyszłych seederów (`tag:seeder`) przez własny **Headscale** na `https://tailnet.seedinfer.com` z **Cloudflare Tunnel jako backupem** (gdy UDP WireGuard nie przejdzie).

---

## Architektura

```
[Provider RTX 5090]  --WireGuard UDP-->  [Orange Pi 4 Pro RK3588]
  tag:provider (100.64.0.x)                tag:gateway (100.64.0.1)
  Nemotron Lightning :8000                  Next.js :3000, Postgres :5432, Redis :6379
       |                                        |
       | tailscale up --login-server            | headscale: 127.0.0.1:8080 (SQLite /mnt/nvme/headscale/db.sqlite)
       | https://tailnet.seedinfer.com          | Caddy: tailnet.seedinfer.com -> 127.0.0.1:8080
       |                                        | Cloudflared: tailnet.seedinfer.com -> http://localhost:8080 (backup, direct)
       +-----> https://tailnet.seedinfer.com <--+
                (Headscale control plane, DERP disabled, MagicDNS seedinfer.ts.net)
```

- **Headscale** `0.25.1` (ARM64) — SQLite na NVMe (`/mnt/nvme/headscale/db.sqlite`), listen `127.0.0.1:8080`, DERP **disabled** (Phase 0 = direct only), MagicDNS `seedinfer.ts.net`, `baseDomain seedinfer.ts.net`, `server_url https://tailnet.seedinfer.com`.
- **Caddy** — terminuje `tailnet.seedinfer.com` (via Cloudflare Tunnel -> `:80`) i proxy do `127.0.0.1:8080`.
- **Cloudflare Tunnel** — backup HTTP dla Headscale API (gdy UDP zablokowany, klient nadal może handshake przez `https://tailnet.seedinfer.com`).
- **ACL** — `tag:gateway` (Pi) może wszędzie; `tag:provider` może tylko do `tag:gateway:3000,5432,6379,8000`; `tag:seeder` tylko `3000,8000,443,80`.

---

## Pliki (infra/headscale/)

```
infra/headscale/
  config.yaml                     # Headscale server_url, listen 127.0.0.1:8080, DB /mnt/nvme/headscale/db.sqlite, DERP off, DNS seedinfer.ts.net
  acl.json                        # ACL HuJSON — tag:gateway/provider/seeder, autoApprovers, provider -> gateway:3000,5432,6379,8000
  docker-compose.headscale.yml    # headscale:0.25.1 + headscale-ui:0.4.18 (profil ui), ARM64
  Caddy.tailnet.snippet           # Caddy snippet tailnet.seedinfer.com -> 127.0.0.1:8080
infra/cloudflared/config.yml      # + ingress tailnet.seedinfer.com -> http://localhost:8080 (Cloudflare backup)
Caddyfile                         # + blok tailnet.seedinfer.com (root i infra/Caddyfile)
docker-compose.yml                # + extra_hosts host.docker.internal, komentarz include headscale
infra/systemd/headscale.service   # systemd unit (bare-metal alternatywa)
scripts/headscale-setup.sh        # init, create user seedinfer, preauth keys gateway/provider/seeder
docs/tailnet.md                   # ten plik — instrukcja seeder: curl + tailscale up
```

---

## Instrukcja dla seedera / providera — kopiuj-wklej (Phase 0)

> Wymagania: `tailscale` CLI >= 1.82.0 (`curl -fsSL https://tailscale.com/install.sh | sh`), klucz `<KEY>` od admina (Pi: `/tmp/hs-tag-provider.key`).

```bash
# 1. Sprawdź czy Tailnet Headscale żyje (via Cloudflare Tunnel + Caddy)
curl -fsSL https://tailnet.seedinfer.com/health

# 2. Dołącz do Tailnet jako provider (RTX 5090) — Phase 0 tag:provider
tailscale up --login-server https://tailnet.seedinfer.com --authkey <KEY> --advertise-tags tag:provider

# 3. Wariant z hostname (zalecane by rozróżnić nody):
tailscale up --login-server https://tailnet.seedinfer.com --authkey <KEY> --advertise-tags tag:provider --hostname provider-5090

# 4. Weryfikacja
tailscale status
curl -fsSL http://gateway.seedinfer.ts.net:3000/api/stats | head -c 500
```

Dla seederów zamień `tag:provider` na `tag:seeder`:

```bash
tailscale up --login-server https://tailnet.seedinfer.com --authkey <KEY> --advertise-tags tag:seeder
```

---

## Setup na Orange Pi 4 Pro (gateway)

### 0. Wymagania na Pi

- Armbian Jammy / Ubuntu 22.04, NVMe zamontowane jako `/mnt/nvme`, 8GB RAM, 1Gbps sym
- Docker + plugin: `curl -fsSL https://get.docker.com | sh && sudo apt install -y docker-compose-plugin`
- Caddy 2.8 (jeśli bare-metal) + cloudflared (`cloudflared --version`)
- DNS: `tailnet.seedinfer.com` → `CNAME <tunnel>.cfargotunnel.com` ☁️ Proxied (tworzone automatycznie gdy dodasz Public Hostname w Tunnel)

### 1. Sklonuj i przygotuj NVMe

```bash
ssh seedinfer@192.168.1.50   # lub PI_HOST z .env
sudo mkdir -p /mnt/nvme/headscale /opt/seedinfer
sudo chown -R $USER:$USER /mnt/nvme/headscale /opt/seedinfer
# Sklonuj jeśli brak:
# git clone https://github.com/<user>/seedinfer.com.git /opt/seedinfer
cd /opt/seedinfer
git pull
```

### 2. Cloudflare Tunnel — dodaj hostname tailnet

Dashboard → **Zero Trust** → **Networks** → **Tunnels** → `seedinfer` → **Public Hostnames** → **Add**:

- `tailnet.seedinfer.com` → `http://localhost:8080` (Phase 0 spec: direct do Headscale, bypass Caddy; alternatywa via Caddy: `http://localhost:80` + `httpHostHeader: tailnet.seedinfer.com`)
- `seedinfer.com` / `www` już istnieją → `http://localhost:80`

Alternatywa `config.yml` (jeśli używasz credentials-file zamiast tokena):

```bash
sudo cp infra/cloudflared/config.yml /etc/cloudflared/config.yml
cat /etc/cloudflared/config.yml  # sprawdź tailnet.seedinfer.com ingress
sudo systemctl restart cloudflared
sudo journalctl -u cloudflared -f
```

Jeśli używasz tokena, **dodaj hostname w Dashboard** — token automatycznie pobierze nowy ingress (restart `cloudflared` nie potrzebny, ale zrób `sudo systemctl restart cloudflared`).

### 3. Caddy — przeładuj z nowym blokiem tailnet

```bash
# Bare-metal:
sudo cp Caddyfile /etc/caddy/Caddyfile          # lub infra/Caddyfile -> /etc/caddy/Caddyfile
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
curl -sf http://127.0.0.1:80/health && echo "Caddy OK"
# Sprawdź czy tailnet proxy działa lokalnie:
curl -sf http://127.0.0.1:8080/health || echo "Headscale jeszcze nie działa — ok, uruchom w kroku 4"
curl -H "Host: tailnet.seedinfer.com" -sf http://127.0.0.1:80/health && echo "Caddy tailnet vhost OK"

# Docker:
docker compose up -d caddy
docker compose ps && docker compose logs --tail 50 caddy
```

### 4. Headscale — uruchom (Docker, zalecane)

```bash
cd /opt/seedinfer

# 1) Uruchom stack Headscale (ARM64)
docker compose -f infra/headscale/docker-compose.headscale.yml up -d
docker ps --filter name=seedinfer-headscale
docker logs --tail 100 seedinfer-headscale

# 2) Weryfikacja — Headscale powinien odpowiadać na 127.0.0.1:8080 i via Caddy/Tunnel
curl -fsSL http://127.0.0.1:8080/health
curl -fsSL -H "Host: tailnet.seedinfer.com" http://127.0.0.1:80/health
curl -fsSL https://tailnet.seedinfer.com/health   # via Cloudflare Tunnel (może zająć 10s po dodaniu hostname)

# 3) Init + klucze (tworzy user seedinfer + 3 preauth keys)
chmod +x scripts/headscale-setup.sh
./scripts/headscale-setup.sh
# Logi zawierają klucze — skopiuj je do 1Password/env:
cat /tmp/hs-keys.env
cat /tmp/hs-tag-gateway.key
cat /tmp/hs-tag-provider.key
cat /tmp/hs-tag-seeder.key

# 4) Status
./scripts/headscale-setup.sh --status
docker exec seedinfer-headscale headscale users list
docker exec seedinfer-headscale headscale nodes list
docker exec seedinfer-headscale headscale preauthkeys list --user seedinfer

# Opcjonalnie: Headscale-UI (podgląd nodes/keys w przeglądarce, tylko localhost :3001)
docker compose -f infra/headscale/docker-compose.headscale.yml --profile ui up -d
# Dostęp: ssh -L 3001:127.0.0.1:3001 seedinfer@192.168.1.50  -> http://127.0.0.1:3001
```

**Bare-metal alternatywa** (gdy Headscale jako binary, nie Docker):

```bash
# Instalacja ARM64 (na Pi):
HEADSCALE_VER=0.25.1
curl -fsSL https://github.com/juanfont/headscale/releases/download/v${HEADSCALE_VER}/headscale_${HEADSCALE_VER}_linux_arm64 -o /tmp/headscale
sudo install /tmp/headscale /usr/bin/headscale
headscale --version

sudo mkdir -p /etc/headscale /mnt/nvme/headscale
sudo cp infra/headscale/config.yaml /etc/headscale/config.yaml
sudo cp infra/headscale/acl.json /etc/headscale/acl.json
# Opcjonalnie systemd unit — patrz infra/systemd/headscale.service (utwórz jeśli brak)
sudo systemctl daemon-reload
sudo systemctl enable --now headscale
./scripts/headscale-setup.sh --bare-metal
```

### 5. Weryfikacja końcowa na Pi

```bash
# Headscale direct
curl -fsSL http://127.0.0.1:8080/health && echo "headscale direct OK"
# Via Caddy
curl -fsSL -H "Host: tailnet.seedinfer.com" http://127.0.0.1:80/health && echo "caddy->headscale OK"
# Via Tunnel (public)
curl -fsSL https://tailnet.seedinfer.com/health && echo "public tailnet OK"
# Policy check
docker exec seedinfer-headscale headscale policy check || cat infra/headscale/acl.json | head -n 50
# DNS MagicDNS — po podłączeniu pierwszego noda: ping gateway.seedinfer.ts.net
```

---

## Podłączenie providera / seedera (RTX 5090 i przyszli)

### Wymagania na kliencie

- `tailscale` CLI >= `1.82.0` ( `tailscale version` )
- Linux: `curl -fsSL https://tailscale.com/install.sh | sh`
- Windows/macOS: pobierz z `https://tailscale.com/download`
- Klucz `authkey` z Pi (`/tmp/hs-tag-provider.key` lub `/tmp/hs-tag-seeder.key`) — **one-time reusable**, ważny 24h (provider) / 30d (gateway). Jeśli wygasł, wygeneruj nowy: `ssh pi './scripts/headscale-setup.sh --create-keys'`.

### Krok 1 — sprawdź czy Tailnet żyje

```bash
curl -fsSL https://tailnet.seedinfer.com/health
# oczekiwano: ok lub {"healthy":true} lub 200
# jeśli nie działa — sprawdź czy Pi i Tunnel żyją, ale możesz też spróbować direct:
# curl -k https://<PI_PUBLIC_IP>:8080/health  (tylko gdy Pi expose 8080 — domyślnie nie)
```

### Krok 2 — dołącz do Tailnet

**Provider (RTX 5090, Nemotron Lightning):**

```bash
# Podmień <KEY> na realny klucz providera (tag:provider)
sudo tailscale up \
  --login-server https://tailnet.seedinfer.com \
  --authkey <KEY> \
  --advertise-tags tag:provider \
  --hostname provider-5090 \
  --accept-routes

# Weryfikacja:
tailscale status
tailscale ip -4                    # pokazuje 100.64.0.x
ping -c 2 gateway.seedinfer.ts.net # MagicDNS gateway (100.64.0.1)
curl -fsSL http://gateway.seedinfer.ts.net:3000/api/stats | head -c 500  # via Tailnet, nie public!
# Jeśli gateway ma Postgres/Redis via Tailnet (ACL pozwala: 5432,6379):
# psql -h gateway.seedinfer.ts.net -p 5432 -U seedinfer -c "select 1"
# redis-cli -h gateway.seedinfer.ts.net -p 6379 ping
```

**Seeder (przyszły, lekki node):**

```bash
sudo tailscale up \
  --login-server https://tailnet.seedinfer.com \
  --authkey <KEY_SEEDER> \
  --advertise-tags tag:seeder \
  --hostname seeder-$(hostname | cut -c1-8) \
  --accept-routes

tailscale status
curl -fsSL http://gateway.seedinfer.ts.net:3000/api/stats | head
```

**Opcje dodatkowe:**

```bash
# Ephemeral (auto-usuwany gdy offline 30m) — dla testowych providerów:
sudo tailscale up --login-server https://tailnet.seedinfer.com --authkey <KEY> --advertise-tags tag:provider --ephemeral

# Exit node via gateway (jeśli gateway ogłasza 0.0.0.0/0):
sudo tailscale up --login-server https://tailnet.seedinfer.com --authkey <KEY> --advertise-tags tag:provider --exit-node 100.64.0.1 --exit-node-allow-lan-access

# Force re-auth (gdy klucz rotowany):
sudo tailscale up --login-server https://tailnet.seedinfer.com --authkey <NEW_KEY> --advertise-tags tag:provider --force-reauth
```

### Krok 3 — sprawdź ACL (czy provider widzi tylko gateway)

Z providera:

```bash
# DOZWOLONE (ACL: tag:provider -> tag:gateway:3000,5432,6379,8000)
curl -v http://gateway.seedinfer.ts.net:3000/api/stats   # 200
nc -zv gateway.seedinfer.ts.net 5432                     # open (jeśli Postgres w Tailnecie)
nc -zv gateway.seedinfer.ts.net 6379                     # open
curl http://gateway.seedinfer.ts.net:8000/health         # 200 (jeśli API na 8000)

# ZABLOKOWANE (ACL deny) — provider NIE powinien dotrzeć do innego providera/seeder na :3000
# tailscale status  # znajdź IP innego providera 100.64.0.x
# curl --connect-timeout 2 http://100.64.0.5:3000/  # powinno timeout / denied
```

Z Pi (gateway), sprawdź logi ACL deny:

```bash
docker logs seedinfer-headscale --tail 50 | grep -i acl
# lub: journalctl -u headscale | grep acl
```

---

## Rotacja kluczy i zarządzanie

```bash
# Na Pi — wygeneruj nowe klucze (stare unieważnij ręcznie jeśli potrzeba)
./scripts/headscale-setup.sh --create-keys
cat /tmp/hs-keys.env

# Lista i unieważnienie:
docker exec seedinfer-headscale headscale preauthkeys list --user seedinfer
docker exec seedinfer-headscale headscale preauthkeys expire --user seedinfer --key <KEY_ID>

# Lista nodes + approve routes:
docker exec seedinfer-headscale headscale nodes list
docker exec seedinfer-headscale headscale nodes approve-routes --identifier <NODE_ID> --routes 100.64.0.0/10  # jeśli manual

# Policy reload po edycji ACL:
vim infra/headscale/acl.json
docker exec seedinfer-headscale headscale policy check
docker restart seedinfer-headscale
# lub bare-metal: sudo systemctl restart headscale
```

---

## Troubleshooting

| Objaw | Diagnoza | Fix |
|-------|----------|-----|
| `curl https://tailnet.seedinfer.com/health` → 404 / 521 | Tunnel nie ma ingress tailnet | Dashboard → Tunnels → Public Hostnames → dodaj `tailnet.seedinfer.com -> http://localhost:80`; `sudo systemctl restart cloudflared` |
| `curl http://127.0.0.1:8080/health` → refused | Headscale nie działa | `docker ps \| grep headscale`; `docker logs seedinfer-headscale`; `docker compose -f infra/headscale/docker-compose.headscale.yml up -d` |
| `tailscale up` → `invalid authkey` | Klucz wygasł / zły tag | Na Pi: `./scripts/headscale-setup.sh --create-keys` → skopiuj nowy `KEY`; upewnij się `--advertise-tags` zgadza się z tagiem klucza |
| `tailscale up` → `tag not permitted` | `tagOwners` nie pozwala | Sprawdź `acl.json` → `tagOwners: tag:provider -> ["seedinfer","autogroup:member"]`; `docker restart seedinfer-headscale` |
| `ping gateway.seedinfer.ts.net` → unknown host | MagicDNS off / node nie w Tailnet | `tailscale status` czy oba nody `active`; `cat /etc/headscale/config.yaml` → `dns_config.magic_dns: true`, `base_domain: seedinfer.ts.net` |
| `curl gateway:5432` → timeout (a powinno działać) | ACL deny lub Postgres nie słucha na Tailnet IP | Na Pi: `tailscale ip -4` → sprawdź czy Postgres `listen_addresses = '*,100.64.0.1'` lub `0.0.0.0`; `docker exec headscale headscale policy check` |
| Headscale UI nie działa | Profil `ui` nie uruchomiony | `docker compose -f infra/headscale/docker-compose.headscale.yml --profile ui up -d`; `curl http://127.0.0.1:3001` |

**Logi:**

```bash
# Pi — Headscale (docker)
docker logs -f seedinfer-headscale
# Pi — Headscale (bare-metal)
sudo journalctl -u headscale -f
# Pi — Caddy
docker logs -f seedinfer-caddy  # lub sudo journalctl -u caddy -f
# Pi — Cloudflared
sudo journalctl -u cloudflared -f
# Klient
sudo tailscale status
sudo tailscale debug --help
tailscale netcheck
```

---

## Phase 0 — ograniczenia i next steps

- **DERP disabled** — Tailnet działa tylko gdy oba końce mają bezpośredni UDP (hole punching). Za NAT symetrycznym może nie przejść — wtedy HTTP do Headscale idzie przez Cloudflare Tunnel (backup), ale WireGuard data plane nie. Phase 1 włączy embedded DERP lub public DERP.
- **Bez OIDC** — auth via preauth keys. Phase 1: OIDC (Authelia/Keycloak) + autoApprovers via grupy.
- **Bez exit node / subnet router** — gateway nie ogłasza `0.0.0.0/0` domyślnie. Włącz w `tailscale up --advertise-routes` na Pi jeśli potrzebny.
- **Provider porty** — otwarte tylko `3000,5432,6379,8000` do gateway. Nie otwieraj `22` via Tailnet ACL — używaj Tailscale SSH lub normalnego SSH przez Tailnet IP (`ssh seedinfer@100.64.0.1` gdy Pi w Tailnecie).
- **Backup** — `/mnt/nvme/headscale/db.sqlite` → NextCloud 5TB (cron `rsync`); logi Headscale na Pi (json-file 10m).
- **Frontend Phase 0** — UI pokazuje tylko `seedinfer/nemotron-lightning-1m` (1M ctx · 2M KV · $0.02/$0.05 · cache 60s free/5min max). `components/models-catalog.tsx` filtruje modele, `app/api/stats/route.ts` + `lib/api.ts` map upstream SeedInfer Network (7 modeli) → 1 model, `lib/mock-faza0.json` as canonical fallback. Qwen/Gemma widoczne jako disabled *Phase 1 — soon*. After Phase 1 remove `isFaza0Model` filtr.

---

## Komendy setup — skrót dla Pi

```bash
# Na Orange Pi 4 Pro (gateway) — pełny setup od zera:
cd /opt/seedinfer
docker compose -f infra/headscale/docker-compose.headscale.yml up -d
curl -fsSL http://127.0.0.1:8080/health && echo "headscale OK"
./scripts/headscale-setup.sh
cat /tmp/hs-keys.env   # skopiuj klucze

# Na laptopie/WSL — sync po zmianach Caddy/Tailnet:
./scripts/deploy-orange-pi.sh
./scripts/deploy-orange-pi.sh --check
ssh seedinfer@192.168.1.50 'curl -fsSL https://tailnet.seedinfer.com/health && docker exec seedinfer-headscale headscale nodes list'

# Na RTX 5090 providerze:
curl -fsSL https://tailnet.seedinfer.com/health
sudo tailscale up --login-server https://tailnet.seedinfer.com --authkey <KEY_PROVIDER> --advertise-tags tag:provider --hostname provider-5090
tailscale status
curl -fsSL http://gateway.seedinfer.ts.net:3000/api/stats | head -c 500
```

---

## Linki

- Headscale docs: https://headscale.net/
- Tailscale KB: https://tailscale.com/kb/1151/what-is-tailscale
- Cloudflare Tunnel: https://developers.cloudflare.com/cloudflare-one/connections/connect/networks/
