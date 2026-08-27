#!/usr/bin/env bash
# scripts/seedinfer-restore.sh — RAM-first SQLite restore on boot (tmpfs -> NVMe snapshot)
# Primary DB: /dev/shm/seedinfer.db (tmpfs, fast)
# Snapshot:  /mnt/nvme/seedinfer/snapshot.db (NVMe, durable, WAL)
# Logic: if /dev/shm/seedinfer.db exists and non-empty -> skip; else restore from snapshot via sqlite3 .backup (hot, consistent) with fallback to cp
# Used by: systemd ExecStartPre= /opt/seedinfer/scripts/seedinfer-restore.sh  and Docker entrypoint
# Env: DATABASE_URL (file:/dev/shm/seedinfer.db), SNAPSHOT_PATH (/mnt/nvme/seedinfer/snapshot.db)

set -euo pipefail

# --- resolve paths (support DATABASE_URL=file:... ) ---
RAW_DB="${DATABASE_URL:-file:/dev/shm/seedinfer.db}"
DB_PATH="${RAW_DB#file:}"
# strip query string like ?cache=shared
DB_PATH="${DB_PATH%%\?*}"
if [ -z "$DB_PATH" ]; then
  DB_PATH="/dev/shm/seedinfer.db"
fi

RAW_SNAP="${SNAPSHOT_PATH:-/mnt/nvme/seedinfer/snapshot.db}"
SNAPSHOT_PATH_RESOLVED="${RAW_SNAP#file:}"
SNAPSHOT_PATH_RESOLVED="${SNAPSHOT_PATH_RESOLVED%%\?*}"
if [ -z "$SNAPSHOT_PATH_RESOLVED" ]; then
  SNAPSHOT_PATH_RESOLVED="/mnt/nvme/seedinfer/snapshot.db"
fi

# Also ensure legacy alias SEEDINFER_SNAPSHOT_PATH is honoured
if [ -n "${SEEDINFER_SNAPSHOT_PATH:-}" ] && [ "$SNAPSHOT_PATH_RESOLVED" = "/mnt/nvme/seedinfer/snapshot.db" ]; then
  SNAPSHOT_PATH_RESOLVED="$SEEDINFER_SNAPSHOT_PATH"
fi

echo "[seedinfer-restore] DB_PATH=$DB_PATH"
echo "[seedinfer-restore] SNAPSHOT_PATH=$SNAPSHOT_PATH_RESOLVED"

# --- ensure dirs exist ---
mkdir -p "$(dirname "$DB_PATH")"
mkdir -p "$(dirname "$SNAPSHOT_PATH_RESOLVED")"

# --- check tmpfs availability (warn if not tmpfs) ---
if mount | grep -q "on $(dirname "$DB_PATH") type tmpfs" 2>/dev/null; then
  echo "[seedinfer-restore] tmpfs OK at $(dirname "$DB_PATH")"
else
  echo "[seedinfer-restore] WARN: $(dirname "$DB_PATH") is not tmpfs (expected tmpfs for RAM-first). Continuing."
  # try to ensure /dev/shm exists
  if [ ! -d "/dev/shm" ]; then
    echo "[seedinfer-restore] WARN: /dev/shm missing"
  fi
fi

# --- if DB already exists and non-empty -> skip restore ---
if [ -s "$DB_PATH" ]; then
  SZ=$(stat -c%s "$DB_PATH" 2>/dev/null || stat -f%z "$DB_PATH" 2>/dev/null || echo "?")
  echo "[seedinfer-restore] DB exists at $DB_PATH (${SZ} bytes), skipping restore"
  # ensure WAL mode already? leave to app
  exit 0
fi

# --- no snapshot -> start fresh (app will init schema) ---
if [ ! -s "$SNAPSHOT_PATH_RESOLVED" ]; then
  echo "[seedinfer-restore] No snapshot at $SNAPSHOT_PATH_RESOLVED, starting fresh (schema will be created by lib/db.ts)"
  exit 0
fi

SNAP_SZ=$(stat -c%s "$SNAPSHOT_PATH_RESOLVED" 2>/dev/null || stat -f%z "$SNAPSHOT_PATH_RESOLVED" 2>/dev/null || echo "?")
echo "[seedinfer-restore] Restoring $DB_PATH from snapshot $SNAPSHOT_PATH_RESOLVED (${SNAP_SZ} bytes)..."

# Prefer sqlite3 .backup for consistent hot backup (handles WAL)
if command -v sqlite3 >/dev/null 2>&1; then
  echo "[seedinfer-restore] Using sqlite3 .backup for restore"
  # sqlite3 <snapshot> ".backup <db>"
  # Need to handle that snapshot is source, DB is dest — sqlite3 backup is FROM current DB TO dest, so we open snapshot as DB
  if sqlite3 "$SNAPSHOT_PATH_RESOLVED" ".backup '$DB_PATH'"; then
    echo "[seedinfer-restore] sqlite3 .backup succeeded"
  else
    echo "[seedinfer-restore] WARN: sqlite3 .backup failed, falling back to cp"
    cp -f "$SNAPSHOT_PATH_RESOLVED" "$DB_PATH"
  fi
else
  echo "[seedinfer-restore] sqlite3 not found, using cp"
  cp -f "$SNAPSHOT_PATH_RESOLVED" "$DB_PATH"
fi

# Also restore -wal/-shm sidecars if present (snapshot was taken mid-WAL)
for suffix in "-wal" "-shm"; do
  SRC="${SNAPSHOT_PATH_RESOLVED}${suffix}"
  DST="${DB_PATH}${suffix}"
  if [ -s "$SRC" ]; then
    echo "[seedinfer-restore] Restoring sidecar $SRC -> $DST"
    cp -f "$SRC" "$DST" || true
  fi
done

# fsync for durability (tmpfs fsync is cheap, but ensures NVMe->tmpfs copy is visible)
if command -v sync >/dev/null 2>&1; then
  sync || true
fi
# per-file fsync via python or dd if available
if [ -s "$DB_PATH" ]; then
  # try to fsync file explicitly (bash can't, use python)
  python3 -c "import os; fd=os.open('$DB_PATH', os.O_RDWR); os.fsync(fd); os.close(fd); print('[seedinfer-restore] fsync done')" 2>/dev/null || true
  FINAL_SZ=$(stat -c%s "$DB_PATH" 2>/dev/null || stat -f%z "$DB_PATH" 2>/dev/null || echo "?")
  echo "[seedinfer-restore] Restore complete: $DB_PATH (${FINAL_SZ} bytes)"
else
  echo "[seedinfer-restore] ERROR: restore produced empty DB at $DB_PATH" >&2
  exit 1
fi

# Ensure perms for nextjs user (when run as root in container/systemd)
chown "$(id -u):$(id -g)" "$DB_PATH" 2>/dev/null || true
chmod 640 "$DB_PATH" 2>/dev/null || true

echo "[seedinfer-restore] Done"
