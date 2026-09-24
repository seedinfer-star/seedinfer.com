# SeedInfer.com — Frontend & Gateway

Next.js 15 (App Router) + Tailwind 3.4 + shadcn/ui + Recharts + MapLibre GL. Public site, OpenAI-compatible gateway (`https://seedinfer.com/v1`) and provider registry for the SeedInfer NVIDIA GPU inference network.

> **Single source of truth:** all models, prices, provider economics, payment chains and GPU specs live in **`lib/catalog.ts`**. Pages, components and API routes import from it — do not hardcode numbers elsewhere.

## Current status (Phase 0 · Q3 2026)

| Model | API id | Context | Input / 1M | Output / 1M | Status |
|---|---|---|---|---|---|
| Gemma 4 26B A4B NVFP4 | `google/gemma-4-26b-a4b-nvfp4` (aliases `seedinfer/gemma-4-26b-a4b`, `gemma-4-26b-a4b`) | 262,144 (256K) | $0.03 | $0.20 | **live** |
| Nemotron 3.5 Lightning 30B A3B NVFP4 | `seedinfer/nemotron-lightning-1m` | 1,048,576 (1M) | $0.02 | $0.05 | coming soon |
| Qwen 3.6 35B A3B NVFP4 | `qwen/qwen3.6-35b-a3b` | 262,144 | $0.06 | $0.50 | coming soon |

Cached input is free (60s TTL, max 5 min). Per-token prices in `/api/v1/models` and `/api/v1/pricing` are `per1M / 1e6` (e.g. `0.00000003` / `0.0000002` for Gemma).

**Provider economics:** 99% of token revenue to providers (1% protocol fee) · standby retainer $0.40/day per node for each day with ≥50% uptime · payouts in **USDC on Base only**, monthly, minimum $1.00 · fiat payouts not available.
**Hardware:** NVIDIA GPUs with ≥32GB VRAM (reference node RTX 5090 32GB: 21,760 CUDA cores, 575 W TDP, 1,792 GB/s). 24GB cards are not supported yet.
**Client deposits:** USDC/native on Ethereum, Arbitrum, Polygon, Base, BNB Chain, HyperEVM; Solana when `NEXT_PUBLIC_SOLANA_ADDRESS` is set. Subscription plans GO $1 → $3 usage, GOAT $5 → $20, PRO $10 → $50. Minimum invoice 10¢.

## Requirements
- Node.js 20+ · npm 10+
- Linux ARM64/x64 host (e.g. Orange Pi 4 Pro / RK3588) · Cloudflare in front of `seedinfer.com`

## Quick start (dev)

```bash
npm install
npm run dev
# → http://localhost:3000
#   Stats:  /api/stats (local provider registry; zero state when no nodes)
#   OpenAI: /v1/models  /v1/chat/completions  /api/v1/pricing
```

## Production build

```bash
npm run build
npm run start
```

## Structure (key files)

```
lib/catalog.ts          # models, prices, economics, chains, GPU specs, API_BASE_URL, pageMetadata()
lib/public-sanitize.ts  # strips IPs / tailnet addresses / agent URLs / hostnames / local paths from public responses; 5-min staleness
lib/public-stats.ts     # shared GET /api/stats + /api/v1/stats implementation
lib/stats-normalize.ts  # client-safe model-id normalization (aliases → catalog ids, hidden routing aliases)
app/api/v1/models       # OpenAI-compatible model list built from the catalog
app/api/v1/pricing      # per-token + per-1M pricing from the catalog
app/api/v1/chat/completions  # gateway: verified providers (WRR/EWMA) → fallbacks
components/calculator.tsx    # provider earnings — every number from one formula (99% share + retainer − power)
```

## Wallet configuration

```bash
NEXT_PUBLIC_PAYMENT_ADDRESS=0x...        # EVM deposit address (same on all 6 EVM chains)
NEXT_PUBLIC_SOLANA_ADDRESS=...           # optional; if unset, Solana deposits show "coming soon" and are disabled
SOLANA_ADDRESS=...                       # server-side equivalent used by the invoice API
```

## Infra — Orange Pi 4 Pro + Cloudflare

```
.
├── Dockerfile                         # multi-stage ARM64 (node:20-alpine)
├── docker-compose.yml                 # Next.js :3000 + Caddy :80/:443 (bridge, ARM64)
├── Caddyfile                          # reverse_proxy app:3000 + cache header /api/stats 60s
├── .env.example                       # NEXT_PUBLIC_API_URL, CLOUDFLARE_TUNNEL_TOKEN, PI_HOST...
├── infra/
│   ├── Caddyfile                      # kopia Caddyfile (źródło)
│   ├── nginx.conf                     # alternatywa dla Caddy — proxy_cache 60s dla /api/stats
│   ├── docker-compose.yml             # kopia compose
│   ├── Dockerfile                     # kopia Dockerfile
│   ├── cloudflared/config.yml         # Tunnel seedinfer.com -> localhost:80
│   └── systemd/
│       ├── seedinfer.service          # bare-metal (bez Dockera) — /opt/seedinfer
│       └── cloudflared.service        # Tunnel jako systemd
└── scripts/
    └── deploy-orange-pi.sh            # build + rsync + restart (systemd/docker)
```

Infra verification after deploy:

```bash
./scripts/deploy-orange-pi.sh --check
# lub ręcznie na Pi:
curl -sf http://127.0.0.1:3000/api/stats | head -c 500
curl -sf http://127.0.0.1:80/health
sudo systemctl status seedinfer cloudflared
docker compose ps && docker compose logs --tail 50 caddy
```

### Cloudflare DNS + Tunnel — configuration

> Pełna instrukcja krok po kroku: [`docs/cloudflare.md`](docs/cloudflare.md) + skrypt [`scripts/cloudflare-setup.sh`](scripts/cloudflare-setup.sh). Poniżej skrót.

**Option A — recommended: Cloudflare Tunnel (no open ports, works behind NAT)**

1. Cloudflare Dashboard → **Zero Trust** → **Networks** → **Tunnels** → **Create a tunnel** → nazwij `seedinfer` → skopiuj **Token**.
2. **Public Hostnames** w tunelu dodaj:
   - `seedinfer.com` → `http://localhost:80`
   - `www.seedinfer.com` → `http://localhost:80`
   - (opcjonalnie) `cloud.seedinfer.com` → `http://localhost:8080` (NextCloud 5TB)
3. Cloudflare **DNS** → rekordy zostaną utworzone automatycznie przez Tunnel jako `CNAME`:
   - `seedinfer.com` → `xxxxxxxx.cfargotunnel.com` ☁️ **Proxied (orange cloud)**
   - `www` → `xxxxxxxx.cfargotunnel.com` ☁️ **Proxied**
   - Nie twórz ręcznie A — Tunnel zarządza CNAME. Jeśli wcześniej był A, usuń go.
4. **SSL/TLS** → **Overview** → ustaw **Full (strict)** (Tunnel + Caddy na :80, CF terminuje TLS; Caddy nie potrzebuje certu. Jeśli Caddy terminuje TLS, też Full Strict).
5. **SSL/TLS** → **Edge Certificates** → włącz **Always Use HTTPS**, **Automatic HTTPS Rewrites**, **Authenticated Origin Pulls** (opcjonalnie).

**Option B — classic Proxy + Caddy/Nginx (requires public IP and open 80/443)**

- DNS → **A** `seedinfer.com` → `PUBLIC_IP_OPI` ☁️ Proxied, **A** `www` → `PUBLIC_IP_OPI` ☁️ Proxied
- Caddy automatycznie wystawi Let's Encrypt (odkomentuj blok TLS w `Caddyfile`) lub użyj `nginx.conf`.
- Cloudflare SSL → **Full (strict)**.

> Dla Orange Pi 4 Pro z 1Gbps sym zalecany **Wariant A (Tunnel)** — brak NAT/port-forward, automatyczne CNAME, mniejsze obciążenie, działa z NextCloud na tym samym Pi.

> **Quick Tunnel CLI start:** `./scripts/cloudflare-setup.sh` (tworzy `seedinfer` + `route dns` + `token`), dev test: `npm run dev` + `cloudflared tunnel --config infra/cloudflared/config.dev.yml run` (Next `:3002` direct). Szczegóły w [`docs/cloudflare.md`](docs/cloudflare.md).

**Cache:** `/api/stats` ma `Cache-Control: public, s-maxage=15, stale-while-revalidate=30` z Next (`app/api/stats/route.ts:3`) + `CDN-Cache-Control: max-age=15` z Caddy/Nginx. Cloudflare Edge cache'uje 15s — odciąża RK3588 i upstream `api.seedinfer.dev`. `/api/v1/models` i `/api/v1/pricing` mają `s-maxage=3600`, `/api/v1/chat/completions` to `no-store`. Wszystkie mają `Access-Control-Allow-Origin: *`.

### Deploy na Orange Pi 4 Pro — krok po kroku

#### 0. Przygotuj Pi (Armbian Jammy, NVMe 200GB)

```bash
# SSH na Pi
ssh orangepi@192.168.1.50   # lub użytkownik seedinfer

# System + NVMe (jeśli NVMe pod /mnt/nvme)
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git htop nvme-cli
lsblk -e7 && df -h
# opcjonalnie: przenieś /opt na NVMe
sudo mkdir -p /mnt/nvme/opt && sudo ln -s /mnt/nvme/opt /opt/seedinfer 2>/dev/null || true

# Node 20 (nodesource — ARM64)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
node -v && npm -v

# Docker (opcjonalnie, jeśli wolisz compose zamiast systemd)
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
sudo apt install -y docker-compose-plugin
docker --version && docker compose version

# Caddy (tylko dla bare-metal bez Dockera)
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

# cloudflared (ARM64)
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared jammy main' | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install -y cloudflared
cloudflared --version
```

#### 1. Pierwszy klon + systemd (zalecane bare-metal)

```bash
sudo mkdir -p /opt/seedinfer && sudo chown $USER:$USER /opt/seedinfer
git clone https://github.com/<user>/seedinfer.com.git /opt/seedinfer
cd /opt/seedinfer
cp .env.example .env   # uzupełnij NEXT_PUBLIC_API_URL jeśli potrzebujesz
npm ci
npm run build

# systemd — skopiuj z infra/
sudo cp infra/systemd/seedinfer.service /etc/systemd/system/seedinfer.service
# edytuj WorkingDirectory/User jeśli inny niż seedinfer
sudo systemctl daemon-reload
sudo systemctl enable --now seedinfer
sudo systemctl status seedinfer --no-pager -l
curl -sf http://127.0.0.1:3000/api/stats | head -c 500

# Caddy bare-metal (jeśli nie używasz Dockera)
sudo cp Caddyfile /etc/caddy/Caddyfile   # lub infra/Caddyfile
# W Caddyfile zamień 'reverse_proxy app:3000' na 'reverse_proxy 127.0.0.1:3000' gdy poza Dockerem
sudo systemctl reload caddy
curl -sf http://127.0.0.1:80/health
```

#### 2. Cloudflare Tunnel — podłącz Pi

Szczegóły + dashboard klik-po-kliku: [`docs/cloudflare.md`](docs/cloudflare.md). Skrót:

```bash
# Lokalnie (raz) — utwórz tunnel + DNS + token (wymaga cloudflared tunnel login lub Dashboard):
./scripts/cloudflare-setup.sh
# lub ręcznie: cloudflared tunnel create seedinfer && cloudflared tunnel route dns seedinfer seedinfer.com ...

# Wariant token (najprostszy) — wklej token z Dashboard Zero Trust lub z `cloudflared tunnel token seedinfer`
echo "CLOUDFLARE_TUNNEL_TOKEN=eyJh..." | sudo tee /etc/cloudflared/env
sudo mkdir -p /etc/cloudflared
sudo cp infra/cloudflared/config.yml /etc/cloudflared/config.yml
# Edytuj /etc/cloudflared/config.yml — upewnij się że tunnel/hostname się zgadzają

# Opcja A — systemd (zalecane)
sudo cp infra/systemd/cloudflared.service /etc/systemd/system/cloudflared.service
sudo systemctl daemon-reload
sudo systemctl enable --now cloudflared
sudo journalctl -u cloudflared -f

# Opcja B — jednorazowe uruchomienie (test)
sudo cloudflared tunnel --no-autoupdate run --token $CLOUDFLARE_TUNNEL_TOKEN

# Weryfikacja: https://seedinfer.com powinna odpowiadać przez Tunnel -> Caddy :80 -> Next :3000
curl -I https://seedinfer.com
```

#### 3. Docker (ARM64) — alternatywa

```bash
cd /opt/seedinfer
cp .env.example .env   # ustaw CLOUDFLARE_TUNNEL_TOKEN jeśli używasz cloudflared w compose
docker compose up -d --build
docker compose ps
docker compose logs -f caddy
curl -sf http://127.0.0.1:3000/api/stats | head
curl -sf http://127.0.0.1:80/health

# Jeśli chcesz Tunnel w Dockerze — odkomentuj serwis cloudflared w docker-compose.yml
# i: docker compose up -d cloudflared
```

#### 4. Deploy z laptopa (automatyczny)

```bash
# na laptopie/WSL w katalogu projektu
cp .env.example .env
# edytuj .env: PI_HOST=192.168.1.50 PI_USER=seedinfer REMOTE_DIR=/opt/seedinfer

# bare-metal
./scripts/deploy-orange-pi.sh
# docker
./scripts/deploy-orange-pi.sh --docker
# sprawdź
./scripts/deploy-orange-pi.sh --check

# Ręczny rsync (bez skryptu)
npm run build
rsync -avz --delete --exclude='.git' --exclude='node_modules' -e ssh ./ seedinfer@192.168.1.50:/opt/seedinfer/
ssh seedinfer@192.168.1.50 'cd /opt/seedinfer && npm ci --omit=dev && sudo systemctl restart seedinfer'
```

#### 5. Nginx zamiast Caddy (opcjonalnie)

```bash
# bare-metal
sudo apt install -y nginx
sudo cp infra/nginx.conf /etc/nginx/sites-available/seedinfer
sudo ln -sf /etc/nginx/sites-available/seedinfer /etc/nginx/sites-enabled/seedinfer
sudo nginx -t && sudo systemctl reload nginx

# Docker — zamień serwis caddy na nginx w docker-compose.yml:
#   nginx:
#     image: nginx:1.27-alpine
#     volumes: [./infra/nginx.conf:/etc/nginx/conf.d/default.conf:ro]
#     ports: ["80:80"]
```

## MapLibre

- `components/map.tsx` używa `https://basemaps.cartocdn.com/gl/positron-gl-style/style.json` jako tło (free). Na Orange Pi podmień na własny tileserver (Martin + `tiles.pmtiles`) ustawiając `style` na `http://127.0.0.1:3000/style.json`.

## Licencja

MIT · SeedInfer.com
