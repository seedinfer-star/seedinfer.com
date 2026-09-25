/**
 * lib/db.ts — SQLite singleton for SeedInfer account data
 * (users, sessions, OAuth links, credits, invoices, usage).
 *
 * Storage modes
 *  - Persistent (recommended): DATABASE_URL=file:/var/lib/seedinfer/seedinfer.db on a real disk.
 *    WAL + synchronous=FULL, so every committed write survives a crash or power loss. The Next.js
 *    server process also writes rotating backups with `VACUUM INTO` (DB_BACKUP_DIR, default
 *    "<db dir>/backups", every DB_BACKUP_INTERVAL_MS = 6h, keeping DB_BACKUP_KEEP = 28 files).
 *  - Volatile (legacy RAM-first): DATABASE_URL under /dev/shm (tmpfs). The data lives in RAM and is
 *    copied to SNAPSHOT_PATH every SNAPSHOT_INTERVAL_MS and on SIGTERM; anything written after the
 *    last snapshot is lost on reboot. Kept only for backwards compatibility.
 *
 * Keep the database OUTSIDE the deploy directory — deployments swap /opt/seedinfer as a whole.
 * Drivers: better-sqlite3 (if installed) -> node:sqlite (Node >= 22). No silent :memory: fallback:
 * losing account data quietly is worse than failing loudly.
 * HMR-safe via globalThis.__seedinferDb.
 */

import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const DEFAULT_DB_PATH = path.join(process.cwd(), "data", "seedinfer.db");
const DEFAULT_SNAPSHOT_PATH = "/mnt/nvme/seedinfer/snapshot.db";
const BACKUP_FILE_RE = /^seedinfer-\d{8}-\d{6}\.db$/;

function stripFileUrl(raw: string): string {
  let p = (raw || "").trim();
  if (p.startsWith("file:")) p = p.slice(5);
  const q = p.indexOf("?");
  if (q !== -1) p = p.slice(0, q);
  return p;
}

export function getDbPath(): string {
  return stripFileUrl(process.env.DATABASE_URL || "") || DEFAULT_DB_PATH;
}

/** true when the primary database lives in RAM (tmpfs) and therefore needs snapshots. */
export function isVolatileDb(dbPath: string = getDbPath()): boolean {
  const flag = (process.env.DB_SNAPSHOT || "").toLowerCase();
  if (flag === "on") return true;
  if (flag === "off") return false;
  return /^\/(dev|run)\/shm\//.test(dbPath);
}

export function getSnapshotPath(): string {
  return stripFileUrl(process.env.SNAPSHOT_PATH || "") || DEFAULT_SNAPSHOT_PATH;
}

export function getSnapshotIntervalMs(): number {
  const v = Number(process.env.SNAPSHOT_INTERVAL_MS || "30000");
  return Number.isFinite(v) && v >= 1000 ? v : 30000;
}

export function getBackupDir(dbPath: string = getDbPath()): string {
  return (process.env.DB_BACKUP_DIR || "").trim() || path.join(path.dirname(dbPath), "backups");
}

function getBackupIntervalMs(): number {
  const v = Number(process.env.DB_BACKUP_INTERVAL_MS || String(6 * 3600 * 1000));
  return Number.isFinite(v) && v >= 60_000 ? v : 6 * 3600 * 1000;
}

function getBackupKeep(): number {
  const v = Number(process.env.DB_BACKUP_KEEP || "28");
  return Number.isFinite(v) && v >= 1 ? Math.floor(v) : 28;
}

/** Backups run in the web server only by default (the payments worker opens the same file). */
function backupsEnabled(): boolean {
  const flag = (process.env.DB_BACKUPS || "").toLowerCase();
  if (["off", "0", "false"].includes(flag)) return false;
  if (["on", "1", "true"].includes(flag)) return true;
  return process.env.NEXT_RUNTIME === "nodejs";
}

// ---------------------------------------------------------------------------
// Global singleton shape (HMR-safe)
// ---------------------------------------------------------------------------

type GlobalDb = {
  db?: any;
  isBetter?: boolean;
  dbPath?: string;
  volatile?: boolean;
  timers?: NodeJS.Timeout[];
  initialized?: boolean;
  shutdownInstalled?: boolean;
};

const GLOBAL_KEY = "__seedinferDb";

function getStore(): GlobalDb {
  const g = globalThis as unknown as Record<string, GlobalDb | undefined>;
  if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = {};
  return g[GLOBAL_KEY] as GlobalDb;
}

// ---------------------------------------------------------------------------
// FS helpers
// ---------------------------------------------------------------------------

function ensureDirForFile(filePath: string): void {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

function isNonEmptyFile(filePath: string): boolean {
  try {
    const st = fs.statSync(filePath);
    return st.isFile() && st.size > 0;
  } catch {
    return false;
  }
}

function fsyncPath(p: string, flags: "r" | "r+"): void {
  try {
    const fd = fs.openSync(p, flags);
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  } catch {}
}

/**
 * Transactionally consistent online copy of the live database: `VACUUM INTO` reads a snapshot
 * (does not block writers in WAL mode, safe with a second process writing), the result is written
 * to a temp file, fsynced and atomically renamed — a crash mid-copy can never leave a torn file.
 */
function writeConsistentCopy(db: any, dest: string): void {
  ensureDirForFile(dest);
  const tmp = `${dest}.tmp-${process.pid}`;
  fs.rmSync(tmp, { force: true });
  db.exec(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`);
  try {
    fs.chmodSync(tmp, 0o600); // account data: owner-only (VACUUM INTO inherits the umask default)
  } catch {}
  fsyncPath(tmp, "r+");
  fs.renameSync(tmp, dest);
  fsyncPath(path.dirname(dest), "r");
}

function listBackups(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => BACKUP_FILE_RE.test(f))
      .sort()
      .map((f) => path.join(dir, f));
  } catch {
    return [];
  }
}

function backupFileName(d = new Date()): string {
  // 2026-09-25T15:04:05.123Z -> seedinfer-20260925-150405.db
  const ts = d.toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
  return `seedinfer-${ts}.db`;
}

/** Write a rotating backup now; returns its path. */
function writeBackup(db: any, dbPath: string): string {
  const dir = getBackupDir(dbPath);
  const dest = path.join(dir, backupFileName());
  writeConsistentCopy(db, dest);
  const all = listBackups(dir);
  for (const old of all.slice(0, Math.max(0, all.length - getBackupKeep()))) {
    try {
      fs.rmSync(old, { force: true });
    } catch {}
  }
  return dest;
}

/**
 * Seed an empty/missing database from the newest backup (persistent mode) or the tmpfs snapshot.
 * Never touches a database that already holds data (also checks the -wal file).
 */
function restoreIfEmpty(dbPath: string, volatile: boolean): void {
  ensureDirForFile(dbPath);
  if (isNonEmptyFile(dbPath) || isNonEmptyFile(`${dbPath}-wal`)) return;
  const newestBackup = volatile ? [] : listBackups(getBackupDir(dbPath)).slice(-1);
  const source = [...newestBackup, getSnapshotPath()].find((p) => p !== dbPath && isNonEmptyFile(p));
  if (!source) {
    console.log(`[db] no existing data for ${dbPath} — starting with an empty database`);
    return;
  }
  try {
    for (const s of ["-wal", "-shm"]) fs.rmSync(`${dbPath}${s}`, { force: true }); // stale sidecars would corrupt the copy
    fs.copyFileSync(source, dbPath);
    fsyncPath(dbPath, "r+");
    console.log(`[db] restored ${dbPath} from ${source} (${fs.statSync(source).size} bytes)`);
  } catch (e: any) {
    console.error(`[db] restore ${source} -> ${dbPath} failed:`, e?.message || e);
  }
}

// ---------------------------------------------------------------------------
// PRAGMAs
// ---------------------------------------------------------------------------

function applyPragmas(db: any, volatile: boolean): void {
  const pragmas = [
    "busy_timeout=5000", // first: the other process may hold a lock while we switch to WAL
    "journal_mode=WAL",
    `synchronous=${volatile ? "NORMAL" : "FULL"}`,
    "foreign_keys=ON",
    "cache_size=-64000",
    "temp_store=MEMORY",
    "wal_autocheckpoint=1000",
  ];
  for (const p of pragmas) {
    try {
      db.exec(`PRAGMA ${p};`);
    } catch (e: any) {
      console.warn(`[db] PRAGMA ${p} failed:`, e?.message || e);
    }
  }
}

// ---------------------------------------------------------------------------
// Schema — keep in sync with lib/schema.sql
// ---------------------------------------------------------------------------

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  wallet_address TEXT,
  email_verified INTEGER DEFAULT 0,
  avatar_url TEXT,
  display_name TEXT,
  created_at TEXT,
  updated_at TEXT,
  last_login_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT,
  created_at TEXT,
  user_agent TEXT,
  method TEXT
);
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google','github')),
  provider_account_id TEXT NOT NULL,
  email TEXT,
  username TEXT,
  avatar_url TEXT,
  created_at TEXT NOT NULL,
  last_login_at TEXT,
  UNIQUE(provider, provider_account_id)
);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON oauth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider ON oauth_accounts(provider);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_email ON oauth_accounts(email);
CREATE TABLE IF NOT EXISTS credits (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance_usd_cents INTEGER,
  updated_at TEXT
);
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  chain TEXT,
  chain_id INTEGER,
  token TEXT,
  token_address TEXT,
  amount TEXT,
  amount_usd_cents INTEGER,
  address_to TEXT,
  tx_hash TEXT UNIQUE,
  status TEXT CHECK (status IN ('pending','confirming','confirmed','expired','failed')),
  created_at TEXT,
  confirmed_at TEXT,
  expires_at TEXT,
  block_number INTEGER,
  block_hash TEXT
);
CREATE TABLE IF NOT EXISTS usage (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  invoice_id TEXT REFERENCES invoices(id) ON DELETE SET NULL,
  model TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  cost_usd_cents INTEGER,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS providers_mirror (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_credits_updated_at ON credits(updated_at);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_chain ON invoices(chain);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_expires_at ON invoices(expires_at);
CREATE INDEX IF NOT EXISTS idx_invoices_tx_hash ON invoices(tx_hash);
CREATE INDEX IF NOT EXISTS idx_usage_user_id ON usage(user_id);
CREATE INDEX IF NOT EXISTS idx_usage_invoice_id ON usage(invoice_id);
CREATE INDEX IF NOT EXISTS idx_usage_model ON usage(model);
CREATE INDEX IF NOT EXISTS idx_usage_created_at ON usage(created_at);
CREATE INDEX IF NOT EXISTS idx_providers_mirror_updated_at ON providers_mirror(updated_at);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_wallet ON users(wallet_address);
`;

/** Additive migrations for databases created with an older schema (idempotent). */
const ADDED_COLUMNS: Array<[table: string, column: string, decl: string]> = [
  ["users", "email_verified", "INTEGER DEFAULT 0"],
  ["users", "avatar_url", "TEXT"],
  ["users", "display_name", "TEXT"],
  ["users", "updated_at", "TEXT"],
  ["users", "last_login_at", "TEXT"],
  ["sessions", "user_agent", "TEXT"],
  ["sessions", "method", "TEXT"],
  ["oauth_accounts", "username", "TEXT"],
  ["oauth_accounts", "avatar_url", "TEXT"],
  ["oauth_accounts", "last_login_at", "TEXT"],
];

function ensureColumn(db: any, table: string, column: string, decl: string): void {
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
    if (!cols.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
  } catch (e: any) {
    console.warn(`[db] add column ${table}.${column} failed:`, e?.message || e);
  }
}

function createSchema(db: any): void {
  db.exec(SCHEMA_SQL);
  for (const [t, c, d] of ADDED_COLUMNS) ensureColumn(db, t, c, d);
}

// ---------------------------------------------------------------------------
// Snapshots (volatile mode) and backups (persistent mode)
// ---------------------------------------------------------------------------

function startMaintenance(db: any, dbPath: string, volatile: boolean): NodeJS.Timeout[] {
  const timers: NodeJS.Timeout[] = [];
  if (dbPath === ":memory:") return timers;

  if (volatile) {
    const snapshotPath = getSnapshotPath();
    const t = setInterval(() => {
      try {
        writeConsistentCopy(db, snapshotPath);
      } catch (e: any) {
        console.warn("[db] periodic snapshot failed:", e?.message || e);
      }
    }, getSnapshotIntervalMs());
    t.unref?.();
    timers.push(t);
    installSnapshotOnShutdown(db, snapshotPath);
    return timers;
  }

  if (!backupsEnabled()) return timers;
  const run = () => {
    try {
      console.log(`[db] backup written: ${writeBackup(db, dbPath)}`);
    } catch (e: any) {
      console.warn("[db] backup failed:", e?.message || e);
    }
  };
  const first = setTimeout(run, 60_000);
  first.unref?.();
  const t = setInterval(run, getBackupIntervalMs());
  t.unref?.();
  timers.push(first, t);
  return timers;
}

function installSnapshotOnShutdown(db: any, snapshotPath: string): void {
  const store = getStore();
  if (store.shutdownInstalled) return;
  store.shutdownInstalled = true;
  const handler = (sig: string) => {
    console.log(`[db] ${sig} received, flushing snapshot...`);
    try {
      writeConsistentCopy(db, snapshotPath);
    } catch (e: any) {
      console.error("[db] final snapshot failed:", e?.message || e);
    }
    try {
      db.close?.();
    } catch {}
    setTimeout(() => process.exit(0), 120);
  };
  try {
    process.once("SIGTERM", () => handler("SIGTERM"));
    process.once("SIGINT", () => handler("SIGINT"));
  } catch {}
}

// ---------------------------------------------------------------------------
// Driver loading (better-sqlite3 with fallback to node:sqlite)
// ---------------------------------------------------------------------------

function loadModule(name: string): any {
  try {
    // eval("require") keeps the Next.js bundler from tracing optional native modules
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const _require = eval("require") as NodeRequire;
    const mod: any = _require(name);
    return mod?.default && name === "better-sqlite3" ? mod.default : mod;
  } catch {
    return null;
  }
}

function openDatabase(dbPath: string): { db: any; isBetter: boolean } {
  const BetterSqlite3 = loadModule("better-sqlite3");
  if (BetterSqlite3) {
    try {
      const db = new BetterSqlite3(dbPath);
      console.log(`[db] opened better-sqlite3 at ${dbPath}`);
      return { db, isBetter: true };
    } catch (e: any) {
      console.warn("[db] better-sqlite3 open failed, trying node:sqlite:", e?.message || e);
    }
  }
  const NodeSqlite = loadModule("node:sqlite");
  if (NodeSqlite?.DatabaseSync) {
    const db = new NodeSqlite.DatabaseSync(dbPath);
    console.log(`[db] opened node:sqlite at ${dbPath}`);
    return { db, isBetter: false };
  }
  throw new Error("No SQLite driver available: install better-sqlite3 or run Node >= 22 (node:sqlite)");
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Initialize the DB singleton — idempotent, HMR-safe. */
export function initDb(): any {
  const store = getStore();
  if (store.initialized && store.db) return store.db;

  const dbPath = getDbPath();
  const volatile = isVolatileDb(dbPath);
  if (dbPath !== ":memory:") restoreIfEmpty(dbPath, volatile);

  const { db, isBetter } = openDatabase(dbPath);
  if (dbPath !== ":memory:") {
    try {
      fs.chmodSync(dbPath, 0o600); // account data: owner-only
    } catch {}
  }
  applyPragmas(db, volatile);
  try {
    createSchema(db);
    console.log(`[db] schema ready (${volatile ? "volatile tmpfs + snapshots" : "persistent"})`);
  } catch (e: any) {
    console.error("[db] schema creation failed:", e?.message || e);
    throw e;
  }

  store.db = db;
  store.isBetter = isBetter;
  store.dbPath = dbPath;
  store.volatile = volatile;
  store.timers = startMaintenance(db, dbPath, volatile);
  store.initialized = true;
  return db;
}

/** Get singleton handle — lazy init if needed (HMR-safe). */
export function getDb(): any {
  const store = getStore();
  if (store.initialized && store.db) return store.db;
  return initDb();
}

/** Run fn inside a write transaction (works with both drivers). */
export function withTransaction<T>(fn: (db: any) => T): T {
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn(db);
    db.exec("COMMIT");
    return out;
  } catch (e) {
    try {
      db.exec("ROLLBACK");
    } catch {}
    throw e;
  }
}

/** Close DB and clear timers (tests / graceful shutdown). */
export function closeDb(): void {
  const store = getStore();
  for (const t of store.timers || []) clearInterval(t);
  store.timers = [];
  if (store.db) {
    try {
      store.db.close?.();
    } catch {}
    store.db = undefined;
    store.initialized = false;
  }
}

/** Force a snapshot (volatile mode) or a rotating backup (persistent mode); returns the file written. */
export async function snapshotNow(): Promise<string> {
  const db = getDb();
  const store = getStore();
  const dbPath = store.dbPath || getDbPath();
  if (store.volatile) {
    const snapshotPath = getSnapshotPath();
    writeConsistentCopy(db, snapshotPath);
    return snapshotPath;
  }
  return writeBackup(db, dbPath);
}

/** Where the data lives — for the admin CLI / diagnostics (no secrets). */
export function describeStorage(): { dbPath: string; volatile: boolean; snapshotPath: string | null; backupDir: string | null; backups: string[] } {
  const dbPath = getStore().dbPath || getDbPath();
  const volatile = isVolatileDb(dbPath);
  const backupDir = volatile ? null : getBackupDir(dbPath);
  return {
    dbPath,
    volatile,
    snapshotPath: volatile ? getSnapshotPath() : null,
    backupDir,
    backups: backupDir ? listBackups(backupDir).map((p) => path.basename(p)) : [],
  };
}

// ---------------------------------------------------------------------------
// Providers mirror (durable mirror of the in-memory providers-store)
// ---------------------------------------------------------------------------

/** Persist a provider payload into providers_mirror (JSON blob). No-op if the DB is not initialized. */
export function mirrorProvider(id: string, payload: Record<string, any>): void {
  try {
    const db = getStore().db;
    if (!db) return;
    db.prepare(
      `INSERT INTO providers_mirror (id, payload, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at`
    ).run(String(id), JSON.stringify(payload), new Date().toISOString());
  } catch (e: any) {
    console.warn(`[db] mirrorProvider ${id} failed:`, e?.message || e);
  }
}

export function getMirroredProvider(id: string): Record<string, any> | null {
  try {
    const db = getStore().db;
    if (!db) return null;
    const row = db.prepare("SELECT payload FROM providers_mirror WHERE id = ?").get(String(id)) as any;
    if (!row) return null;
    try {
      return JSON.parse(row.payload);
    } catch {
      return row.payload as any;
    }
  } catch {
    return null;
  }
}

export function listMirroredProviders(): Array<{ id: string; payload: Record<string, any>; updated_at: string }> {
  try {
    const db = getStore().db;
    if (!db) return [];
    const rows = db.prepare("SELECT id, payload, updated_at FROM providers_mirror ORDER BY updated_at DESC").all() as any[];
    return rows.map((r: any) => {
      let p: any = r.payload;
      try {
        p = JSON.parse(r.payload);
      } catch {}
      return { id: r.id, payload: p, updated_at: r.updated_at };
    });
  } catch {
    return [];
  }
}

/**
 * On-chain invoice confirmation lives in lib/payments/worker.ts (seedinfer-payments service).
 * Kept as a no-op for backwards compatibility with older imports.
 */
export function confirmInvoiceStub(_invoiceId: string): void {}
