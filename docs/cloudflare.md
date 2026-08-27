# Cloudflare — podpięcie seedinfer.com (Tunnel + DNS)

> Domena **seedinfer.com** kupiona na Cloudflare (dash `8cfc…`), user zalogowany. Next.js dev `:3002` lokalnie, prod `:3000` via Docker/Caddy na Orange Pi. Ten doc opisuje pełne spięcie domeny przez **Cloudflare Tunnel** (bez otwierania portów, działa za NAT).

**Pliki:**
- `infra/cloudflared/config.yml` — prod (Tunnel -> Caddy `:80` -> Next `:3000` + `tailnet -> :8080`)
- `infra/cloudflared/config.dev.yml` — dev lokalnie (Tunnel -> Next `:3002` direct, bez Caddy)
- `scripts/cloudflare-setup.sh` — automatyzuje `tunnel create` + `route dns` + `token`
- `infra/systemd/cloudflared.service` — systemd na Orange Pi
- `Caddyfile` / `infra/Caddyfile` — reverse_proxy `app:3000`

**Architektura:**
```
Internet -> Cloudflare Edge (TLS) -> Cloudflare Tunnel (cfargotunnel.com)
  -> cloudflared na Orange Pi -> Caddy :80 -> Next.js :3000 (prod)
  -> tailnet.seedinfer.com -> http://localhost:8080 (Headscale)
Dev (przed Pi): Tunnel -> http://localhost:3002 (npm run dev)
```

---

## 0. Prerekwizyty

- [ ] Zalogowany na https://dash.cloudflare.com (konto z domeną `seedinfer.com`, dash `8cfc…`)
- [ ] Domena `seedinfer.com` widoczna w **Websites** -> `seedinfer.com` (Active, kupiona na Cloudflare)
- [ ] `cloudflared` zainstalowany lokalnie: `cloudflared --version` -> `2026.5.1` (ok)
- [ ] Next.js działa lokalnie: `npm run dev` -> http://localhost:3002 (package.json: `next dev -p 3002`)
- [ ] Na Pi (później): `cloudflared` ARM64, Caddy, Node 20 — patrz README "Deploy na Orange Pi"

Sprawdź lokalnie:
```bash
cloudflared --version   # 2026.5.1
npm run dev &           # http://localhost:3002
curl -sf http://127.0.0.1:3002/api/stats | head -c 400; echo
```

---

## 1. Wariant A — Dashboard Zero Trust (zalecany, najprostsze, bez `cloudflared tunnel login`)

Nie wymaga `~/.cloudflared/cert.pem` ani CLI `tunnel create`. Wszystko w UI.

### 1.1 Utwórz Tunnel w Zero Trust

1. Otwórz https://dash.cloudflare.com -> zaloguj -> w lewym menu **Zero Trust** (lub https://one.dash.cloudflare.com)
   - Jeśli pierwszy raz: zaakceptuj plan Free, wybierz domenę `seedinfer.com`.
2. **Networks** -> **Tunnels** -> **Create a tunnel** (przycisk niebieski, góra prawej)
3. **Select your connector:** wybierz **Cloudflared** -> **Next**
4. **Name your tunnel:** wpisz `seedinfer` -> **Save tunnel**
5. Na ekranie **Install and run a connector** -> wybierz **Docker** lub **Systemd** (obojętnie, chodzi o token) -> **Copy** token (zaczyna się `eyJh...`, długi JWT)
   - Token jest też w zakładce **Configure** -> **Install connector** -> skopiuj komendę `cloudflared service install ... --token eyJ...`
   - Sam token = wszystko po `--token `
6. **Public Hostnames** -> **Add a public hostname** (dodaj 3 wpisy):
   - **1:** `Hostname: seedinfer.com` -> `Service: http://localhost:80` -> **Save** (prod via Caddy)
   - **2:** `Hostname: www.seedinfer.com` -> `Service: http://localhost:80` -> **Save**
   - **3:** `Hostname: tailnet.seedinfer.com` -> `Service: http://localhost:8080` -> **Save** (Headscale direct, bypass Caddy; alternatywa `http://localhost:80` gdy chcesz via Caddy)
   - Każdy wpis ma `Path: *` (domyślnie), `No TLS Verify: off`
7. **Save tunnel** -> wróć do listy **Tunnels** -> status `Inactive` (normalnie, dopóki nie uruchomisz `cloudflared` na Pi)

> **DNS:** Po dodaniu Public Hostnames Cloudflare automatycznie tworzy `CNAME` w **Websites -> seedinfer.com -> DNS**:
> - `seedinfer.com` -> `<tunnel-id>.cfargotunnel.com` ☁️ Proxied (pomarańczowa chmura)
> - `www` -> `<tunnel-id>.cfargotunnel.com` ☁️ Proxied
> - `tailnet` -> `<tunnel-id>.cfargotunnel.com` ☁️ Proxied
> Nie twórz ręcznie `A` — Tunnel zarządza CNAME. Jeśli wcześniej był `A` do IP Pi, usuń go.

### 1.2 Skopiuj token na Orange Pi

```bash
# Na Pi (SSH):
sudo mkdir -p /etc/cloudflared
echo "CLOUDFLARE_TUNNEL_TOKEN=eyJh..." | sudo tee /etc/cloudflared/env
sudo chmod 600 /etc/cloudflared/env
sudo cp infra/cloudflared/config.yml /etc/cloudflared/config.yml
# Edytuj jeśli potrzeba: tunnel: seedinfer, ingress jak w repo

# Systemd (zalecane):
sudo cp infra/systemd/cloudflared.service /etc/systemd/system/cloudflared.service
sudo systemctl daemon-reload
sudo systemctl enable --now cloudflared
sudo journalctl -u cloudflared -f
# Powinno pokazać: "Registered tunnel connection" + "Updated to new configuration"

# Jednorazowo (test bez systemd):
sudo cloudflared tunnel --no-autoupdate run --token $CLOUDFLARE_TUNNEL_TOKEN
```

### 1.3 SSL/TLS

- **Websites -> seedinfer.com -> SSL/TLS -> Overview** -> ustaw **Full (strict)** (Tunnel terminuje TLS na Edge, Caddy na :80 nie potrzebuje certu)
- **SSL/TLS -> Edge Certificates** -> włącz **Always Use HTTPS**, **Automatic HTTPS Rewrites** (opcjonalnie)
- Caddy nie potrzebuje Let's Encrypt gdy używasz Tunnel. Blok `:443` w `Caddyfile` zakomentowany.

---

## 2. Wariant B — CLI lokalnie (`cloudflared tunnel login` + `create`)

Użyj gdy wolisz CLI zamiast Dashboard, lub gdy automatyzujesz przez `scripts/cloudflare-setup.sh`.

### 2.1 Login (otwiera browser)

```bash
cloudflared tunnel login
# -> otworzy https://dash.cloudflare.com/argotunnel?callback=...
# -> zaloguj -> wybierz domenę seedinfer.com -> autoryzuj
# -> utworzy ~/.cloudflared/cert.pem
ls -lh ~/.cloudflared/cert.pem
cloudflared tunnel list   # powinno działać
```

### 2.2 Utwórz tunnel + DNS + token (automatycznie)

```bash
./scripts/cloudflare-setup.sh
# lub krok po kroku:
cloudflared tunnel create seedinfer
cloudflared tunnel route dns seedinfer seedinfer.com
cloudflared tunnel route dns seedinfer www.seedinfer.com
cloudflared tunnel route dns seedinfer tailnet.seedinfer.com
cloudflared tunnel token seedinfer   # skopiuj
cloudflared tunnel list
cloudflared tunnel info seedinfer
```

Skrypt jest idempotentny — można uruchamiać wielokrotnie. Z `--overwrite-dns` nadpisuje istniejące CNAME.

**Co robi `route dns`:**
- Tworzy `CNAME seedinfer.com -> <tunnel-id>.cfargotunnel.com` (Proxied)
- To samo dla `www` i `tailnet`
- Weryfikacja: `dig CNAME seedinfer.com +short` -> `*.cfargotunnel.com`

### 2.3 Alternatywy CLI

```bash
./scripts/cloudflare-setup.sh --check      # tylko sprawdź status
./scripts/cloudflare-setup.sh --token-only # tylko token
./scripts/cloudflare-setup.sh --dev        # komendy dev (localhost:3002)
cloudflared tunnel delete -f seedinfer     # usuń tunnel (ostrożnie, kasuje DNS)
```

---

## 3. Orange Pi — wklejenie tokena i uruchomienie

Pełny przepis (prod: Caddy :80 -> Next :3000):

```bash
# SSH na Pi
ssh seedinfer@192.168.1.50   # lub orangepi@...

# 1. Token z Dashboard lub z `cloudflared tunnel token seedinfer`
sudo mkdir -p /etc/cloudflared
echo "CLOUDFLARE_TUNNEL_TOKEN=eyJh..." | sudo tee /etc/cloudflared/env
sudo chmod 600 /etc/cloudflared/env
cat /etc/cloudflared/env   # sprawdź (bez wycieku w logach)

# 2. Config (prod — Caddy)
sudo cp infra/cloudflared/config.yml /etc/cloudflared/config.yml
# Sprawdź:
cat /etc/cloudflared/config.yml
# Ma zawierać:
#   tunnel: seedinfer
#   ingress:
#     - hostname: seedinfer.com -> http://localhost:80
#     - hostname: www.seedinfer.com -> http://localhost:80
#     - hostname: tailnet.seedinfer.com -> http://localhost:8080

# 3. Systemd
sudo cp infra/systemd/cloudflared.service /etc/systemd/system/cloudflared.service
# Sprawdź service: ExecStart=/usr/bin/cloudflared tunnel --no-autoupdate run --config /etc/cloudflared/config.yml
# Jeśli używasz tokena, service czyta /etc/cloudflared/env (EnvironmentFile=-/etc/cloudflared/env)
sudo systemctl daemon-reload
sudo systemctl enable --now cloudflared
sudo systemctl status cloudflared --no-pager -l
sudo journalctl -u cloudflared -n 50 --no-pager
# Oczekiwane logi: "Starting tunnel" "Registered tunnel connection" "Updated to new configuration"

# 4. Weryfikacja prod
curl -sf http://127.0.0.1:3000/api/stats | head -c 400; echo  # Next direct
curl -sf http://127.0.0.1:80/health                  # Caddy -> Next
curl -sf http://127.0.0.1:8080/health 2>&1 | head     # Headscale (jeśli uruchomiony)
curl -I https://seedinfer.com                         # powinno 200 via Tunnel
curl -sf https://seedinfer.com/api/stats | head -c 500; echo
curl -sf https://www.seedinfer.com/health
curl -sf https://tailnet.seedinfer.com/health 2>&1 | head

# 5. Docker alternatywa (zamiast systemd):
# Odkomentuj serwis cloudflared w docker-compose.yml i:
#   echo "CLOUDFLARE_TUNNEL_TOKEN=eyJh..." >> .env
#   docker compose up -d cloudflared
#   docker compose logs -f cloudflared
```

**Pliki na Pi — podsumowanie:**
- `/etc/cloudflared/env` — `CLOUDFLARE_TUNNEL_TOKEN=eyJ...` (chmod 600, root:root)
- `/etc/cloudflared/config.yml` — kopia `infra/cloudflared/config.yml` (prod)
- `/etc/systemd/system/cloudflared.service` — kopia `infra/systemd/cloudflared.service`
- `/etc/cloudflared/credentials.json` — alternatywa dla tokena (gdy używasz `tunnel create` + JSON)

---

## 4. Test lokalnie w trybie DEV (przed Pi) — Tunnel -> localhost:3002

Gdy Pi nie jest jeszcze gotowe, przetestuj DNS/TLS lokalnie na laptopie/WSL.

### 4.1 Uruchom Next na :3002

```bash
npm install
npm run dev
# -> http://localhost:3002
# Sprawdź:
curl -sf http://127.0.0.1:3002/api/stats | head -c 400; echo
curl -sf http://127.0.0.1:3002/ | head -c 200; echo
```

### 4.2 Uruchom Tunnel w dev (3 opcje)

```bash
# Opcja A — Named tunnel (seedinfer) z dev ingress -> :3002 (zalecane, testuje prawdziwy DNS seedinfer.com):
cloudflared tunnel --config infra/cloudflared/config.dev.yml run
# lub z tokenem:
CLOUDFLARE_TUNNEL_TOKEN=eyJh... cloudflared tunnel --config infra/cloudflared/config.dev.yml run --token $CLOUDFLARE_TUNNEL_TOKEN
# ingress w config.dev.yml: seedinfer.com/www/tailnet -> http://localhost:3002

# Opcja B — Quick tunnel (bez dotykania DNS seedinfer.com, losowy URL):
cloudflared tunnel --url http://localhost:3002
# -> wypisze https://xxxx-yyyy-zzzz.trycloudflare.com — otwórz w browserze
# Test bez ryzyka nadpisania DNS prod

# Opcja C — Dashboard-managed ingress tymczasowo na :3002:
# W Zero Trust -> Tunnels -> seedinfer -> Public Hostnames -> Edit:
#   seedinfer.com -> http://localhost:3002 (zmień z :80 na :3002)
#   www.seedinfer.com -> http://localhost:3002
# Zapisz, uruchom: cloudflared tunnel run --token $TOKEN
# Po teście wróć na :80 dla prod
```

### 4.3 Weryfikacja dev

```bash
# Po 5-10s od startu cloudflared:
curl -I https://seedinfer.com
# HTTP/2 200 + cf-cache-status + server: cloudflare
curl -sf https://seedinfer.com/api/stats | head -c 500; echo
curl -sf https://www.seedinfer.com/ | head -c 300; echo
# Jeśli używasz quick tunnel:
curl -I https://xxxx-yyyy.trycloudflare.com
```

**Powrót na prod:** zatrzymaj dev tunnel (`Ctrl+C`), w Dashboard przywróć `http://localhost:80` jeśli zmieniałeś.

---

## 5. Weryfikacja i Troubleshooting

### Weryfikacja prod (Pi):

```bash
# Pi health:
curl -sf http://127.0.0.1:3000/api/stats | head -c 500; echo
curl -sf http://127.0.0.1:80/health && echo "Caddy OK"
sudo systemctl status seedinfer cloudflared --no-pager -l | head -n 60
sudo journalctl -u cloudflared -n 30 --no-pager | tail -n 30
docker compose ps && docker compose logs --tail 20 caddy  # jeśli Docker

# Publicznie:
curl -I https://seedinfer.com
curl -sf https://seedinfer.com/api/stats | head -c 500; echo
curl -sf https://seedinfer.com/api/v1/models | head -c 500; echo
curl -sf https://tailnet.seedinfer.com/health || echo "Headscale nie działa (to OK w dev)"

# DNS:
dig CNAME seedinfer.com +short
dig CNAME www.seedinfer.com +short
dig CNAME tailnet.seedinfer.com +short
# Oczekiwane: <uuid>.cfargotunnel.com
```

### Najczęstsze problemy:

| Objaw | Przyczyna | Fix |
|-------|-----------|-----|
| `cloudflared tunnel list` -> `failed to fetch cert` | Brak `cert.pem` | `cloudflared tunnel login` lub użyj Dashboard token (Wariant A) |
| `tunnel create` -> `already exists` | Tunnel już w Dashboard | `cloudflared tunnel list` lub usuń z Dashboard -> Tunnels |
| `route dns` -> `record already exists` | CNAME już jest | Dodaj `--overwrite-dns` lub usuń ręcznie w DNS i spróbuj ponownie |
| `curl https://seedinfer.com` -> `404` | Ingress `http_status:404` catch-all | Sprawdź `config.yml` ingress hostname, `cloudflared tunnel info seedinfer`, logi `journalctl -u cloudflared` |
| `502 Bad Gateway` | Caddy/Next nie odpowiada na `:80`/`:3000` | `curl http://127.0.0.1:3000`, `curl http://127.0.0.1:80/health`, `systemctl status caddy seedinfer` |
| `530` od Cloudflare | Tunnel nie połączony | `systemctl status cloudflared`, sprawdź token w `/etc/cloudflared/env`, `cloudflared tunnel run --token ...` ręcznie |
| `tailnet.seedinfer.com` -> `404` | Headscale nie działa na `:8080` | `curl http://127.0.0.1:8080/health`, `docker compose -f infra/headscale/docker-compose.headscale.yml ps` |

---

## 6. Checklist — co zrobić teraz

- [ ] Wybierz Wariant A (Dashboard) lub B (CLI + `scripts/cloudflare-setup.sh`)
- [ ] Wariant A: Zero Trust -> Tunnels -> Create `seedinfer` -> Copy token -> Public Hostnames (seedinfer.com, www, tailnet)
- [ ] Wariant B: `cloudflared tunnel login` -> `./scripts/cloudflare-setup.sh` -> `route dns` -> `token`
- [ ] Skopiuj token na Pi do `/etc/cloudflared/env` + `config.yml` + `systemd` (rozdz. 3)
- [ ] Lokalny test dev (opcjonalnie przed Pi): `npm run dev` + `cloudflared tunnel --config infra/cloudflared/config.dev.yml run` (rozdz. 4)
- [ ] Weryfikacja: `curl -I https://seedinfer.com` + `curl https://seedinfer.com/api/stats` (rozdz. 5)
- [ ] SSL: Full (strict) + Always Use HTTPS w Cloudflare

---

## 7. Komendy — ściąga

```bash
# Setup (raz):
./scripts/cloudflare-setup.sh              # create + dns + token
./scripts/cloudflare-setup.sh --check      # status
./scripts/cloudflare-setup.sh --token-only # token
./scripts/cloudflare-setup.sh --dev        # dev help

# Dev lokalnie (Next :3002):
npm run dev
cloudflared tunnel --config infra/cloudflared/config.dev.yml run
cloudflared tunnel --url http://localhost:3002   # quick, bez DNS

# Prod Pi:
echo "CLOUDFLARE_TUNNEL_TOKEN=eyJ..." | sudo tee /etc/cloudflared/env
sudo systemctl enable --now cloudflared
sudo journalctl -u cloudflared -f
curl -I https://seedinfer.com
```

**Nie commituj tokena!** `.env` i `~/.cloudflared/*.json` są w `.gitignore`.
