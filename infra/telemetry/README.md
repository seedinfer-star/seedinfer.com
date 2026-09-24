# SeedInfer Telemetry — Orange Pi (aarch64) — Phase 0/1

> **Cel:** persistent telemetria na Pi (nie tylko in-memory Map), survives restart, 30d retention, backup NVMe.

## Ścieżki na Pi (NVMe 476GB, ext4)

- **Primary:** `/mnt/nvme/telemetry/` — 476GB NVMe, ext4, fast append, survives reboot.
- **Fallback:** `/opt/seedinfer/telemetry/` — gdy NVMe nie zamontowany (bare-metal mount).
- **SQLite (future):** `/mnt/nvme/telemetry/telemetry.sqlite` (WAL mode).
- **JSONL (Phase 0):** `/mnt/nvme/telemetry/telemetry.jsonl` — daily rotation via logrotate / systemd timer.
- **Backup:** `/mnt/nvme/telemetry/backup/` + `/mnt/nvme/backup/telemetry-YYYY-MM-DD.sqlite`

```bash
sudo mkdir -p /mnt/nvme/telemetry/backup
sudo chown seedinfer:seedinfer /mnt/nvme/telemetry
lsblk -o NAME,SIZE,MOUNTPOINT,FSTYPE | grep nvme
df -h /mnt/nvme
```

Env override:
```bash
TELEMETRY_DIR=/mnt/nvme/telemetry
# or
SEEDINFER_TELEMETRY_DIR=/opt/seedinfer/telemetry
TELEMETRY_FILE=telemetry.jsonl
```

## Architektura

```
provider (RTX 5090, :3001) --heartbeat--> Next.js :3002 (/api/v1/providers/heartbeat)
                                           │
                                           ├─► lib/providers-store.ts (Map via globalThis, sort verified>pending)
                                           ├─► lib/telemetry-store.ts (Map + JSONL append, flush 30s)
                                           │      └─► /mnt/nvme/telemetry/telemetry.jsonl (append-only, 30d)
                                           │      └─► (Phase 1) /mnt/nvme/telemetry/telemetry.sqlite (WAL)
                                           └─► /api/v1/telemetry (GET list) + /api/v1/telemetry/ingest (POST)
```

## Persystencja — hybryda Map + JSONL (+ SQLite TODO)

**Phase 0 — JSONL (lean, wybrane po konsultacji Qwen):**
- Dlaczego JSONL > SQLite na start: `better-sqlite3` wymaga natywnej kompilacji na aarch64 (python3, make, g++), heavy dla Pi, ryzyko break build. JSONL to `fs.appendFileSync`, brak deps, ext4 NVMe szybki append, łatwa rotacja.
- Flow: `appendTelemetry()` → `globalThis.__seedinferTelemetry.events` (cap 5k) + `pending[]` → `setInterval 30s` → `fs.appendFileSync jsonl` → `fs.mkdirSync dir recursive`.
- Flush burst: gdy `pending >= 50` → immediate flush (nie blokuje requestu).
- Load on boot: `tryLoadJsonl()` czyta ostatnie 10k linii, trzyma 5k w RAM (nie blokuje build, best-effort).
- Survive restart: NVMe mount persystentny via `/etc/fstab` lub `ReadWritePaths=/mnt/nvme` w `seedinfer.service`.

**Phase 1 — SQLite (optional, gdy potrzeba query):**
- `better-sqlite3@9` (WAL) lub `sql.js` (wasm, bez natywnej). Schema poniżej.
- `auto-flush` via `better-sqlite3` transaction co 30s + `DELETE WHERE timestamp < datetime('now','-30 days')`.
- Backup: `sqlite3 telemetry.sqlite ".backup /mnt/nvme/telemetry/backup.sqlite"` via systemd timer.

## Schema

```sql
-- telemetry.sqlite (Phase 1, WAL)
CREATE TABLE IF NOT EXISTS telemetry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,          -- ISO
  provider_id TEXT NOT NULL,
  gpu TEXT,                         -- chip name
  requests INTEGER DEFAULT 0,
  tokens INTEGER DEFAULT 0,
  latency INTEGER,                  -- ms
  upstream TEXT,                    -- local|nim|opencode|openrouter|modal|heartbeat
  fallback_chain TEXT,              -- JSON array
  ttft INTEGER,                     -- ms
  rpm REAL,
  verified INTEGER,                 -- 0/1
  agent_url TEXT,
  tailscale_ip TEXT,
  vllm_model TEXT,
  region TEXT,
  raw TEXT                          -- JSON payload
);
CREATE INDEX IF NOT EXISTS idx_telemetry_ts ON telemetry(timestamp);
CREATE INDEX IF NOT EXISTS idx_telemetry_provider ON telemetry(provider_id);
```

JSONL line = JSON.stringify(TelemetryEvent) per line (same fields, ndjson).

## API

| Endpoint | Method | Opis |
|---|---|---|
| `/api/v1/providers/clear` | POST | clear providers + fallback + telemetry, auth `X-Admin-Token: $ADMIN_TOKEN` (allow in dev if no env) |
| `/api/admin/reset` | POST | alias dla powyższego |
| `/api/v1/providers` | GET | `?verified=1` → fleet, po clear `0` |
| `/api/stats?forceZero=1` | GET | zero stats (po clear `forceZero` flag), bez param → upstream SeedInfer Network |
| `/api/v1/fallback/status` | GET | circuits + stats, po clear `0` |
| `/api/v1/telemetry` | GET | `?limit=100&provider_id=xxx&since=ISO` list + storage paths |
| `/api/v1/telemetry/ingest` | POST | `{provider_id, gpu, requests, tokens, latency, upstream, fallback_chain, ttft, rpm, verified}` lub `{events: [...]}` |

Heartbeat już loguje: `POST /api/v1/providers/heartbeat` → `logHeartbeatTelemetry()` → JSONL.

## Retention & Rotacja

- **30 dni:** `find /mnt/nvme/telemetry -name "telemetry.jsonl.*" -mtime +30 -delete` via cron.
- **Daily rotation:** `logrotate` lub `systemd timer` 02:00:
  ```bash
  mv /mnt/nvme/telemetry/telemetry.jsonl /mnt/nvme/telemetry/telemetry.jsonl.$(date +%Y-%m-%d)
  truncate -s 0 /mnt/nvme/telemetry/telemetry.jsonl
  gzip /mnt/nvme/telemetry/telemetry.jsonl.$(date +%Y-%m-%d)
  ```
- **SQLite (Phase 1):** `DELETE FROM telemetry WHERE timestamp < datetime('now','-30 days'); VACUUM;`
- **Backup:** `rsync -a /mnt/nvme/telemetry/ /mnt/nvme/backup/telemetry-$(date +%F)/` lub `sqlite3 .backup`.

## systemd

`infra/telemetry/seedinfer-telemetry.timer` + `.service` (daily 02:00) → `scripts/telemetry-aggregate.sh` (agregacja 24h → stats).

`seedinfer.service`:
```ini
ReadWritePaths=/opt/seedinfer /mnt/nvme/telemetry
Environment=TELEMETRY_DIR=/mnt/nvme/telemetry
```

## Quick check na Pi

```bash
# clear do 0
ADMIN_TOKEN=xxx curl -X POST https://seedinfer.com/api/v1/providers/clear -H "X-Admin-Token: $ADMIN_TOKEN" | jq
curl -s https://seedinfer.com/api/v1/providers | jq '{count,verified,pending}'
curl -s "https://seedinfer.com/api/stats?forceZero=1" | jq '{active_providers, providers: (.providers|length)}'
curl -s https://seedinfer.com/api/v1/fallback/status | jq .stats
curl -s "https://seedinfer.com/api/v1/telemetry?limit=5" | jq

# direct Pi
ssh orangepi@100.107.9.52
ls -lh /mnt/nvme/telemetry/
cat /mnt/nvme/telemetry/telemetry.jsonl | wc -l
journalctl -u seedinfer -f | grep telemetry
```

## Pliki w repo

- `lib/telemetry-store.ts` — stub + JSONL (Phase 0) + TODO SQLite
- `app/api/v1/telemetry/route.ts` — GET list
- `app/api/v1/telemetry/ingest/route.ts` — POST ingest
- `app/api/v1/providers/clear/route.ts` — clear all + auth
- `app/api/admin/reset/route.ts` — alias
- `scripts/clear-seedinfer.sh` — curl clear + verify
- `infra/telemetry/README.md` (ten plik) + `telemetry.md` (plan szczegółowy)
