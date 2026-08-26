# SeedInfer.com — Frontend (1:1 SeedInfer Network Stats clone) · Orange Pi ready

> 1:1 replica of `seedinfer.com/stats` (originally `seedinfer.com/stats`) built with **Next.js 15 App Router + Tailwind 3.4 + shadcn/ui + Recharts + MapLibre GL**. Optimized for deployment on **Orange Pi** (ARM64).

> ### 🧭 Phase 0 — current status (2026-08-25) — Nemotron Lightning only
> Frontend in **Phase 0**: runs on **1 model** — `seedinfer/nemotron-lightning-1m` (**1M context, 2M KV**, alias `gpt-oss-20b` for compatibility). **Provider tailnet under construction** (Headscale on Orange Pi `tag:gateway` + provider RTX 5090 `tag:provider`). Qwen/Gemma hidden until Phase 1.
>
> | Phase 0 — available ✅ | Phase 1 — soon ⏳ |
> |---|---|
> | `seedinfer/nemotron-lightning-1m` · 1M ctx · 2M KV · **$0.02 / 1M input · $0.05 / 1M output** · cache **60s free / 5min max** (prefix caching) | `qwen3.6-35b-a3b` · 35B A3B · $0.06 / $0.50 — *is coming* |
> | `components/models-catalog.tsx` filtruje i pokazuje tylko Nemotron + banner *„Faza 0: tylko Nemotron, tailnet seederów w budowie”* · Qwen 3.6 35B A3B / Gemma 4 26B A4B jako disabled karty *is coming* / *coming soon* | `gemma-4-26b-a4b` / `qwen3.6-35b-a3b` on Modal — *is coming* |
> | `app/api/v1/models` + `app/api/v1/pricing` → OpenAI-compatible list z pricingiem Nemotrona (`prompt $0.02/1M`, `completion $0.05/1M`, `cache_read $0.00`) · `lib/mock.json` + `lib/mock-faza0.json` pozostają na dysku ale **nie są używane** jako fallback | Rozszerzenie fleet o wielu providerów, routing Modal |
> | `app/api/stats/route.ts` + `lib/api.ts` → **filter upstream** `api.seedinfer.com/v1/stats` do tylko Nemotron (merge `gpt-oss-20b` → `seedinfer/nemotron-lightning-1m`, bottleneck → Nemotron) · **brak mock fallback — przy błędzie upstream zwraca 502 z error JSON (OpenAI shape), UI pokazuje loading/error** | Własne API agregujące więcej modeli, publiczne stats bez filtra |
> | `docs/tailnet.md` · Headscale 0.25.1 na Orange Pi (DERP off, direct only), MagicDNS `seedinfer.ts.net`, Caddy + Cloudflare Tunnel backup | DERP enabled, OIDC, autoApprovers, exit-node, seeding P2P |
> | KPI / map / fleet działają na przefiltrowanych danych (Models=1) | Pełna multi-model analityka, real-time seeding status |
>
> Szczegóły zadaniowe: `components/models-catalog.tsx:1`, `lib/mock-faza0.json:1`, `app/api/stats/route.ts:1`, `lib/api.ts:1`, `docs/tailnet.md:1` · Po wdrożeniu Fazy 1 usuń filtr `isFaza0Model` i odkomentuj PRICING dla Qwen/Gemma.

---

## Requirements
- Node.js 20+ · npm 10+
- Orange Pi **4 Pro** (RK3588, 8GB RAM, 1Gbps sym, 200GB NVMe, 5TB NextCloud) — Armbian Jammy / Ubuntu 22.04 lub dowolny linux ARM64/x64
- Cloudflare (domena `seedinfer.com`) + opcjonalnie `cloudflared` dla Tunnel

## Quick start (dev)

```bash
npm install
npm run dev
# → http://localhost:3000
#   API: http://localhost:3000/api/stats  (proxy → https://api.seedinfer.com/v1/stats, cache 15s, 502 on error — no mock)
#   OpenAI compat: http://localhost:3000/api/v1/models  http://localhost:3000/api/v1/chat/completions  http://localhost:3000/api/v1/pricing
```

## Production build

```bash
npm run build
npm run start
# start nasłuchuje na 0.0.0.0:3000 (Orange Pi w LAN)
```

## Structure

```
app/
  layout.tsx          # dark theme (#0f0f14), Inter + JetBrains Mono
  page.tsx            # dashboard 1:1 SeedInfer — KPI, charts, map, fleet
  globals.css         # CSS vars :root / .dark (seed-infer style)
  api/stats/route.ts  # GET /api/stats → fetch https://api.seedinfer.com/v1/stats, revalidate 15s, 502 + error JSON on failure — NO mock fallback
  api/v1/models/route.ts # GET /api/v1/models → OpenAI shape {object:"list", data:[{id:"seedinfer/nemotron-lightning-1m", pricing:{prompt:"0.00002", completion:"0.00005"}}]}
  api/v1/chat/completions/route.ts # POST /api/v1/chat/completions → proxy to local vLLM if available else 503 OpenAI error + curl example (Tailnet RTX 5090)
  api/v1/pricing/route.ts # GET /api/v1/pricing → pricing per model (Nemotron active, Qwen/Gemma is coming)
components/
  sidebar.tsx         # 224px sidebar: Use the network / Provide / Build
  kpi-grid.tsx        # 10 kart: Tokens, Requests, Nodes, Bandwidth, Power, Utilization+bottleneck, GPU/CPU, RAM, Avg tok/req, Models — shows skeleton/loading when brak danych
  network-traffic.tsx # 3 wykresy Recharts: Requests/min area, Tokens/min stacked, Token Distribution donut + toggles 30m/24h/7d/30d & Per minute/Cumulative — no mock, pokazuje loading/error
  live-network-flow.tsx + map.tsx  # MapLibre GL placeholder + kafelki regionów (provider_locations) — loading/error gdy brak danych
  provider-fleet.tsx  # tabela/fleet: filtry model/trust/status + sort, chip/gpu/mem/tokens — no mock
  models-catalog.tsx  # Faza 0: tylko Nemotron Lightning 1M (2M KV) $0.02/$0.05 cache 60s free/5min max + banner "tailnet w budowie"; Qwen 3.6 35B A3B + Gemma 4 26B A4B jako disabled "is coming" / "coming soon"
    transparency-footer.tsx # wallet placeholders for 7 chains (6 EVM + Solana)
   ui/*                # shadcn/ui: card, button, badge, tabs, select, input
 lib/
   types.ts            # StatsResponse mirroring SeedInfer payload
   api.ts              # fetchStats() z cache 15s, candidates /api/stats → upstream + filtr Faza0 isFaza0Model — NO mock fallback, throws on 502
   format.ts           # format helpers
   mock.json           # POZOSTAJE na dysku ale nieużywany (no import) — legacy fallback usunięty per spec
   mock-faza0.json     # POZOSTAJE na dysku ale nieużywany — legacy fallback usunięty
```

## Data — Phase 0 filtering + OpenAI compat

- **Live source:** `https://api.seedinfer.com/v1/stats` (CORS open) — upstream previously returned 7 models (gpt-oss, qwen, gemma...), now filtered to SeedInfer Network Statistics.
- **Własne API:** `GET /api/stats` — Next Route Handler, `export const revalidate = 15`, `Cache-Control: public, s-maxage=15, stale-while-revalidate=30` + **filtr Faza 0** (`isFaza0Model` → tylko `seedinfer/nemotron-lightning-1m`, merge `gpt-oss-20b` → canonical, `bottleneck_model` → Nemotron, `providers[]` map → Nemotron). Nagłówek `X-SeedInfer-Faza: 0-nemotron-only`. **Gdy upstream padnie → zwraca 502 z OpenAI-compatible error JSON `{error:{message,type,code}}` + `upstream` — bez mock fallback (pliki `lib/mock.json` / `lib/mock-faza0.json` pozostają na dysku ale nie są importowane). CORS + Cache-Control: no-store on error.
- **Frontend fetch:** `lib/api.ts: fetchStats()` — in-memory TTL 15s + poll `setInterval 15_000` w `app/page.tsx` + drugi poziom filtra `filterToFaza0`. Przy 502 rzuca wyjątek — UI pokazuje loading/error (skeleton + banner 502), nie udaje danych.
- **OpenAI compat:** `GET /api/v1/models` → `{object:"list", data:[{id:"seedinfer/nemotron-lightning-1m", object:"model", owned_by:"seedinfer", pricing:{prompt:"0.00002",completion:"0.00005",cache_read:"0.0"}, context_length:1048576, max_output:1048576, description:"Nemotron Lightning 1M (2M KV) - $0.02/1M in $0.05/1M out cache 60s free"}]}` + alias `gpt-oss-20b`. CORS + `Cache-Control: public, s-maxage=3600`. `GET /api/v1/pricing` → per-model pricing (Nemotron active, Qwen/Gemma *is coming*).
- **Chat completions:** `POST /api/v1/chat/completions` → proxy do lokalnego vLLM (`VLLM_URL` / `http://127.0.0.1:8000/v1/chat/completions`) jeśli dostępny (stream + non-stream). Jeśli nie — `503` z OpenAI error shape: `Faza 0 - Nemotron na RTX 5090 via Tailnet, use https://tailnet.seedinfer.com, coming soon public endpoint` + `curl` example i pricing. CORS + no-store.

> Aby przełączyć na własne API, ustaw `NEXT_PUBLIC_API_URL` lub podmień `UPSTREAM` w `app/api/stats/route.ts`. Lokalne vLLM ustaw `VLLM_URL` env.

## Wallet configuration (Transparency footer)

Placeholders in `components/transparency-footer.tsx`. Replace with real addresses:

```ts
// components/transparency-footer.tsx — 7 chains share same EVM address + Solana
const WALLETS = [
  { chain: "ETH", address: "0x2EB9104AEeF7270fe639Bf1965B94Bfb8Edcf786" },
  { chain: "Base", address: "0x2EB9104AEeF7270fe639Bf1965B94Bfb8Edcf786" },
  { chain: "Solana", address: "So111..." },
]
```

or via env:

```bash
NEXT_PUBLIC_PAYMENT_ADDRESS=0x2EB9104AEeF7270fe639Bf1965B94Bfb8Edcf786
NEXT_PUBLIC_SOL_ADDRESS=So11111111111111111111111111111111111111112
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
