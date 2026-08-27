# Telemetry Plan — Orange Pi (aarch64, ext4 NVMe 476GB, Next.js :3002)

## 1. Kontekst & Decyzja SQLite vs JSONL (Qwen)

**Wymagania Pi:** `/mnt/nvme/telemetry` na NVMe 476GB ext4, SQLite `/mnt/nvme/telemetry/telemetry.sqlite` lub JSONL, schema timestamp/provider_id/gpu/requests/tokens/latency/upstream/fallback_chain/ttft/rpm/verified, persystencja Map+SQLite/JSONL auto-flush 30s survives restart, API GET/POST ingest, retention 30d rotacja backup /mnt/nvme, systemd timer/cron.

**Qwen lean advice (podsumowanie):**
- **Phase 0 → JSONL append.** Brak natywnych deps, `better-sqlite3` wymaga kompilacji na aarch64 (python3, make, g++, node-gyp), ryzyko długiego build i break na Armbian. JSONL to czysty `fs.appendFileSync`, ext4 NVMe bardzo szybki dla sequential append, daily files łatwe do `logrotate`, `grep`/`jq`, `rsync` backup, działa na Next.js bez rebuild. Wystarcza dla `heartbeat` + `ingest` (append-only, rzadkie query).
- **Phase 1 → SQLite (WAL) gdy potrzeba analityki.** `better-sqlite3@9` w trybie WAL + `CREATE INDEX` daje szybkie `WHERE timestamp > now()-30d GROUP BY provider_id`, ale dopiero gdy fleet >10 providerów i potrzebne `rpm`/`ttft` percentiles. Alternatywa bez natywnej: `sql.js` (wasm) lub `node:sqlite` (Node 22 experimental) — lżejsze ale wolniejsze. Qwen rekomenduje start JSONL, migracja do SQLite gdy retencja + query > grep.

**Decyzja:** **Phase 0 = JSONL (zaimplementowane w `lib/telemetry-store.ts`), Phase 1 = SQLite jako opt-in** (schema i migracja przygotowana, nie blokuje `npm run build`).

---

## 2. Ścieżki & Mount

| Path | Opis | Perm |
|---|---|---|
| `/mnt/nvme/telemetry/` | primary, 476GB NVMe ext4, `noatime` | `seedinfer:seedinfer 755` |
| `/opt/seedinfer/telemetry/` | fallback gdy NVMe nie zamontowany | `seedinfer:seedinfer` |
| `/mnt/nvme/telemetry/telemetry.jsonl` | append-only ndjson, Phase 0 | `644` |
| `/mnt/nvme/telemetry/telemetry.sqlite` | Phase 1 WAL | `644` |
| `/mnt/nvme/telemetry/telemetry.jsonl.YYYY-MM-DD.gz` | rotated daily | `644` |
| `/mnt/nvme/telemetry/backup/` | rsync / sqlite .backup | `755` |

`/etc/fstab` (Pi):
```
# NVMe 476GB ext4
UUID=xxxx-xxxx /mnt/nvme ext4 defaults,noatime,nodiratime 0 2
```

`infra/systemd/seedinfer.service`:
```ini
ReadWritePaths=/opt/seedinfer /mnt/nvme/telemetry
Environment=TELEMETRY_DIR=/mnt/nvme/telemetry
EnvironmentFile=-/opt/seedinfer/.env
```

Fallback w kodzie: `telemetryDir()` → `process.env.TELEMETRY_DIR` → `/mnt/nvme/telemetry` → jeśli `ENOENT` to `mkdir -p` else `/tmp`.

---

## 3. Schema (kanoniczna)

```typescript
type TelemetryEvent = {
  timestamp: string          // ISO, primary time
  provider_id: string        // FK -> providers-store id
  gpu?: string | null        // "NVIDIA GeForce RTX 5090"
  requests?: number          // cumulative or delta
  tokens?: number            // cumulative or delta
  latency?: number           // ms, p50 or last
  upstream?: string | null   // local|nim|opencode|openrouter|modal|heartbeat
  fallback_chain?: string[] | null // ["local","nim","modal"]
  ttft?: number | null       // ms
  rpm?: number | null        // requests per minute
  verified?: boolean | null  // true if provider verified
  agent_url?: string | null
  tailscale_ip?: string | null
  vllm_model?: string | null // seedinfer/nemotron-lightning-1m
  region?: string | null     // pl-central
  raw?: Record<string, any>  // full heartbeat payload for debug
}
```

SQLite DDL:
```sql
CREATE TABLE IF NOT EXISTS telemetry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  gpu TEXT, requests INTEGER, tokens INTEGER, latency INTEGER,
  upstream TEXT, fallback_chain TEXT, ttft INTEGER, rpm REAL, verified INTEGER,
  agent_url TEXT, tailscale_ip TEXT, vllm_model TEXT, region TEXT, raw TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_ts ON telemetry(timestamp);
CREATE INDEX idx_provider ON telemetry(provider_id);
CREATE INDEX idx_upstream ON telemetry(upstream);
PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
```

JSONL: jedna linia = `JSON.stringify(TelemetryEvent)` (ndjson), łatwe `jq -s`, `grep provider_id`.

---

## 4. Persystencja — Hybryda Map + JSONL/SQLite

```
lib/providers-store.ts            lib/telemetry-store.ts
 Map<string,StoredProvider>       Map + pending[] + JSONL
   │ upsert/verify/clearAll         │ append/list/flush/clear
   ▼                                ▼
 POST /heartbeat ──► logHeartbeatTelemetry() ──► pending[] ──30s──► /mnt/nvme/telemetry/telemetry.jsonl
 POST /ingest    ──► appendTelemetry() ──────────┘                  (or telemetry.sqlite in Phase 1)
 GET /providers  ──► listProviders()
 GET /telemetry  ──► listTelemetry()
 POST /clear     ──► clearAll()+clearTelemetry()+clearFallback()
```

- **In-memory:** `globalThis.__seedinferTelemetry.events` (max 5k, LRU), `pending[]` (batch 50 → immediate flush).
- **Auto-flush:** `setInterval 30_000` (unref), `fs.appendFileSync` w Next.js nodejs runtime (nie edge). Nie blokuje requestu, requeue on fail.
- **Survive restart:** `tryLoadJsonl()` on first `getStore()` → reads last 10k lines → keeps 5k in RAM. NVMe mount persystentny, więc po `systemctl restart seedinfer` dane wracają. `seedinfer.service` `Restart=always`.
- **Heartbeat integracja:** `app/api/v1/providers/heartbeat/route.ts` po `upsertProvider` woła `logHeartbeatTelemetry(payload)` + `setForceZero(false)` (clear wipes forceZero, nowy heartbeat przywraca live).

**Phase 1 SQLite swap (TODO, nie blokuje build):**
```ts
// lib/telemetry-store.ts TODO block
import Database from 'better-sqlite3' // npm i better-sqlite3 @types/better-sqlite3 --build-from-source na Pi
const db = new Database(sqlitePath())
db.prepare('INSERT INTO telemetry (...) VALUES (...)').run(...)
setInterval(() => db.prepare("DELETE FROM telemetry WHERE timestamp < datetime('now','-30 days')").run(), 24*3600*1000)
```
Build Pi: `sudo apt install python3 make g++ && npm rebuild better-sqlite3 --build-from-source`.

---

## 5. API

| Route | File | Auth | Opis |
|---|---|---|---|
| `POST /api/v1/providers/clear` | `app/api/v1/providers/clear/route.ts` | `X-Admin-Token` | clear providers + fallback + telemetry, setForceZero true |
| `POST /api/admin/reset` | `app/api/admin/reset/route.ts` | same | alias |
| `GET /api/v1/providers` | existing | — | po clear `{"count":0,"verified":0,"pending":0}` |
| `GET /api/stats?forceZero=1` | `app/api/stats/route.ts` | — | zero payload (po clear `X-SeedInfer-Zero:1`), bez param → upstream SeedInfer Network |
| `GET /api/v1/fallback/status` | existing | — | circuits reset, stats 0 |
| `GET /api/v1/telemetry` | `app/api/v1/telemetry/route.ts` | — | `?limit=100&provider_id=x&since=ISO` |
| `POST /api/v1/telemetry/ingest` | `app/api/v1/telemetry/ingest/route.ts` | — | batch or single, appends to JSONL/SQLite |

**Auth clear:** `ADMIN_TOKEN` > `SEEDINFER_ADMIN_TOKEN` > `SEEDINFER_ADMIN_TOKEN_ALT` > allow in dev (`NODE_ENV !== production`). In prod without env → warn and allow (lean) — set `ADMIN_TOKEN` to lock.

---

## 6. Retention, Rotacja, Backup

**JSONL (Phase 0):**
```bash
# /etc/logrotate.d/seedinfer-telemetry
/mnt/nvme/telemetry/telemetry.jsonl {
  daily
  rotate 30
  compress
  delaycompress
  missingok
  notifempty
  create 644 seedinfer seedinfer
  postrotate
    systemctl reload seedinfer 2>/dev/null || true
  endscript
}
# lub prosty cron:
0 2 * * * mv /mnt/nvme/telemetry/telemetry.jsonl /mnt/nvme/telemetry/telemetry.jsonl.$(date +\%F) && truncate -s 0 /mnt/nvme/telemetry/telemetry.jsonl && gzip /mnt/nvme/telemetry/telemetry.jsonl.$(date +\%F)
30 2 * * * find /mnt/nvme/telemetry -name "telemetry.jsonl.*.gz" -mtime +30 -delete
```

**SQLite (Phase 1):**
```sql
-- daily 02:00 via systemd timer
DELETE FROM telemetry WHERE timestamp < datetime('now','-30 days');
VACUUM;
-- backup
sqlite3 /mnt/nvme/telemetry/telemetry.sqlite ".backup /mnt/nvme/telemetry/backup/telemetry-$(date +%F).sqlite"
find /mnt/nvme/telemetry/backup -mtime +30 -delete
```

**Backup NVMe → NextCloud (5TB):**
```bash
rsync -a --delete /mnt/nvme/telemetry/ /mnt/nextcloud/telemetry-backup/  # if mounted
# lub rclone to S3
```

**Monitoring:**
```bash
du -sh /mnt/nvme/telemetry/*
wc -l /mnt/nvme/telemetry/telemetry.jsonl
curl -s http://127.0.0.1:3002/api/v1/telemetry?limit=1 | jq
journalctl -u seedinfer | grep telemetry
```

---

## 7. systemd Timers

`infra/telemetry/seedinfer-telemetry-aggregate.service`:
```ini
[Unit]
Description=SeedInfer telemetry aggregate (daily 02:00)
After=network.target
[Service]
Type=oneshot
User=seedinfer
WorkingDirectory=/opt/seedinfer
ExecStart=/opt/seedinfer/scripts/telemetry-aggregate.sh
```

`infra/telemetry/seedinfer-telemetry-aggregate.timer`:
```ini
[Unit]
Description=Daily telemetry aggregate
[Timer]
OnCalendar=daily 02:00
Persistent=true
[Install]
WantedBy=timers.target
```

`scripts/telemetry-aggregate.sh`:
```bash
#!/usr/bin/env bash
set -euo pipefail
DIR=/mnt/nvme/telemetry
# aggregate JSONL to daily stats
cat "$DIR/telemetry.jsonl" | jq -s 'group_by(.provider_id) | map({provider_id: .[0].provider_id, count: length})'
# retention handled by logrotate / cron above
```

Enable:
```bash
sudo cp infra/telemetry/*.service infra/telemetry/*.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now seedinfer-telemetry-aggregate.timer
systemctl list-timers | grep telemetry
```

---

## 8. Walidacja (przed rygorystycznymi testami)

```bash
# 1) clear do 0
ADMIN_TOKEN=xxx ./scripts/clear-seedinfer.sh --gateway https://seedinfer.com
# or Pi direct
ADMIN_TOKEN=xxx ./scripts/clear-seedinfer.sh --gateway http://100.107.9.52:3002

# 2) verify
curl -s https://seedinfer.com/api/v1/providers | jq '{count,verified,pending}'
# expect {"count":0,"verified":0,"pending":0}

curl -s "https://seedinfer.com/api/stats?forceZero=1" | jq '{active_providers, providers: (.providers|length), _seedinfer_zero}'
# expect {"active_providers":0,"providers":0,"_seedinfer_zero":true}

curl -s https://seedinfer.com/api/v1/fallback/status | jq '.stats'
# expect totalRequests 0, fallbackCount 0

curl -s "https://seedinfer.com/api/v1/telemetry?limit=5" | jq
# expect count 0 after clear

# 3) Pi storage
ssh orangepi@100.107.9.52 "ls -lh /mnt/nvme/telemetry/ && cat /mnt/nvme/telemetry/telemetry.jsonl | wc -l"

# 4) build
npx tsc --noEmit && npm run build # expect 18/18
bash -n scripts/clear-seedinfer.sh
```

---

## 9. Lean Checklist

- [x] `lib/telemetry-store.ts` stub bez `better-sqlite3` dep (nie blokuje build, TODO w komentarzu)
- [x] `lib/providers-store.ts` clearAll + forceZero flag
- [x] `lib/fallback-state.ts` clearAllFallback + resetStats
- [x] `app/api/v1/providers/clear` + `app/api/admin/reset` z `X-Admin-Token`
- [x] `app/api/stats?forceZero=1` → zeros
- [x] `app/api/v1/telemetry` + `ingest` + heartbeat auto-log
- [x] `scripts/clear-seedinfer.sh` + verify
- [x] `infra/telemetry/README.md` + `telemetry.md` + Pi paths `/mnt/nvme/telemetry`
- [ ] Phase 1: `npm i better-sqlite3` + `WAL` + `systemd timer` (po testach Phase 0)
```

