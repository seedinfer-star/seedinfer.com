/**
 * lib/db.ts — RAM-first SQLite singleton (tmpfs + NVMe snapshot)
 * Primary: /dev/shm/seedinfer.db (tmpfs, via DATABASE_URL)
 * Snapshot: /mnt/nvme/seedinfer/snapshot.db (via SNAPSHOT_PATH) — periodic every 30s via db.backup() + fsync + on SIGTERM
 * Fallback driver: better-sqlite3 (preferred, WAL) -> node:sqlite (Node >=22 DatabaseSync) -> :memory: shim
 * HMR-safe via globalThis.__seedinferDb (mirrors lib/providers-store.ts pattern)
 * Schema: users, sessions, credits, invoices, usage + providers_mirror stub + indexes (see lib/schema.sql)
 */

// Node built-ins — keep static imports for tsc
import fs from "fs";
import path from "path";

// ---------------------------------------------------------------------------
// Env helpers
// ---------------------------------------------------------------------------

export function getDbPath(): string {
  const raw = process.env.DATABASE_URL || "file:/dev/shm/seedinfer.db";
  let p = raw.trim();
  if (p.startsWith("file:")) p = p.slice(5);
  const qIdx = p.indexOf("?");
  if (qIdx !== -1) p = p.slice(0, qIdx);
  if (!p) p = "/dev/shm/seedinfer.db";
  return p;
}

export function getSnapshotPath(): string {
  const raw = process.env.SNAPSHOT_PATH || "/mnt/nvme/seedinfer/snapshot.db";
  let p = raw.trim();
  if (p.startsWith("file:")) p = p.slice(5);
  const qIdx = p.indexOf("?");
  if (qIdx !== -1) p = p.slice(0, qIdx);
  if (!p) p = "/mnt/nvme/seedinfer/snapshot.db";
  return p;
}

export function getSnapshotIntervalMs(): number {
  const raw = process.env.SNAPSHOT_INTERVAL_MS || "30000";
  const v = Number(raw);
  return Number.isFinite(v) && v >= 1000 ? v : 30000;
}

// ---------------------------------------------------------------------------
// Global singleton shape (HMR-safe)
// ---------------------------------------------------------------------------

type GlobalDb = {
  db?: any;
  isBetter?: boolean;
  dbPath?: string;
  snapshotPath?: string;
  snapshotTimer?: NodeJS.Timeout | null;
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
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function isNonEmptyFile(filePath: string): boolean {
  try {
    const st = fs.statSync(filePath);
    return st.isFile() && st.size > 0;
  } catch {
    return false;
  }
}

function restoreFromSnapshotIfNeeded(dbPath: string, snapshotPath: string): boolean {
  if (isNonEmptyFile(dbPath)) return false;

  if (!isNonEmptyFile(snapshotPath)) {
    // No snapshot to restore — ensure dir and start fresh
    try {
      ensureDirForFile(dbPath);
    } catch {}
    console.log(`[db] no snapshot at ${snapshotPath}, starting fresh at ${dbPath}`);
    return false;
  }

  try {
    ensureDirForFile(dbPath);
    // At startup DB is not open, plain copy is safe and fast (tmpfs -> NVMe and back)
    // Spec also mentions sqlite3 .backup — periodic path uses db.backup(); restore uses copy for simplicity.
    // scripts/seedinfer-restore.sh uses sqlite3 .backup when available.
    fs.copyFileSync(snapshotPath, dbPath);
    try {
      const fd = fs.openSync(dbPath, "r+");
      fs.fsyncSync(fd);
      fs.closeSync(fd);
    } catch {}
    // Also restore -wal/-shm sidecars if present (WAL snapshot)
    for (const suffix of ["-wal", "-shm"]) {
      const src = snapshotPath + suffix;
      const dst = dbPath + suffix;
      if (isNonEmptyFile(src)) {
        try {
          fs.copyFileSync(src, dst);
        } catch {}
      }
    }
    try {
      const sz = fs.statSync(snapshotPath).size;
      console.log(`[db] restored ${dbPath} from snapshot ${snapshotPath} (${sz} bytes)`);
    } catch {
      console.log(`[db] restored ${dbPath} from snapshot ${snapshotPath}`);
    }
    return true;
  } catch (e: any) {
    console.error(`[db] restore failed ${snapshotPath} -> ${dbPath}:`, e?.message || e);
    return false;
  }
}

// ---------------------------------------------------------------------------
// PRAGMAs (WAL + tmpfs tuned)
// ---------------------------------------------------------------------------

function applyPragmas(db: any): void {
  try {
    // WAL allows readers+writer concurrency even on tmpfs; synchronous=NORMAL is safe with WAL
    db.exec("PRAGMA journal_mode=WAL;");
    db.exec("PRAGMA synchronous=NORMAL;");
    db.exec("PRAGMA foreign_keys=ON;");
    db.exec("PRAGMA cache_size=-64000;"); // 64MB negative = KB
    db.exec("PRAGMA mmap_size=268435456;"); // 256MB
    db.exec("PRAGMA temp_store=MEMORY;");
    db.exec("PRAGMA busy_timeout=5000;");
    db.exec("PRAGMA wal_autocheckpoint=1000;");
  } catch (e: any) {
    console.warn("[db] pragma failed:", e?.message || e);
  }
}

// ---------------------------------------------------------------------------
// Schema (exact as spec) — keep in sync with lib/schema.sql
// ---------------------------------------------------------------------------

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  wallet_address TEXT,
  email_verified INTEGER DEFAULT 0,
  avatar_url TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT,
  created_at TEXT
);
CREATE TABLE IF NOT EXISTS oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('google','github')),
  provider_account_id TEXT NOT NULL,
  email TEXT,
  created_at TEXT NOT NULL,
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

function createSchema(db: any): void {
  // exec may be single statement or batch; better-sqlite3 and node:sqlite both support batch via exec
  db.exec(SCHEMA_SQL);
  // Graceful ALTER for users columns if DB was created with old schema (RK3588 tmpfs restore)
  try {
    db.exec("ALTER TABLE users ADD COLUMN email_verified INTEGER DEFAULT 0");
  } catch {}
  try {
    db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT");
  } catch {}
  // Ensure oauth_accounts exists even if snapshot predates delta (idempotent)
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS oauth_accounts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        provider TEXT NOT NULL CHECK (provider IN ('google','github')),
        provider_account_id TEXT NOT NULL,
        email TEXT,
        created_at TEXT NOT NULL,
        UNIQUE(provider, provider_account_id)
      );
      CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user_id ON oauth_accounts(user_id);
      CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider ON oauth_accounts(provider);
      CREATE INDEX IF NOT EXISTS idx_oauth_accounts_email ON oauth_accounts(email);
    `);
  } catch {}
}

// ---------------------------------------------------------------------------
// Snapshot (periodic + SIGTERM)
// ---------------------------------------------------------------------------

async function doSnapshot(db: any, dbPath: string, snapshotPath: string, isBetter: boolean): Promise<void> {
  try {
    ensureDirForFile(snapshotPath);

    if (isBetter && typeof db.backup === "function") {
      // better-sqlite3: await db.backup(dest) — uses SQLite backup API (hot backup, consistent)
      await db.backup(snapshotPath);
      // fsync snapshot file + directory for durability on NVMe
      try {
        const fd = fs.openSync(snapshotPath, "r+");
        fs.fsyncSync(fd);
        fs.closeSync(fd);
      } catch {}
      try {
        const dirFd = fs.openSync(path.dirname(snapshotPath), "r");
        fs.fsyncSync(dirFd);
        fs.closeSync(dirFd);
      } catch {}
      // console.log(`[db] snapshot via db.backup -> ${snapshotPath}`);
    } else {
      // Fallback: checkpoint WAL then copy file (consistent point)
      try {
        db.exec("PRAGMA wal_checkpoint(TRUNCATE);");
      } catch {}
      // Ensure source is flushed before copy
      fs.copyFileSync(dbPath, snapshotPath);
      try {
        const fd = fs.openSync(snapshotPath, "r+");
        fs.fsyncSync(fd);
        fs.closeSync(fd);
      } catch {}
      try {
        const dirFd = fs.openSync(path.dirname(snapshotPath), "r");
        fs.fsyncSync(dirFd);
        fs.closeSync(dirFd);
      } catch {}
      // console.log(`[db] snapshot via copy -> ${snapshotPath}`);
    }
  } catch (e: any) {
    console.error("[db] snapshot failed:", e?.message || e);
    throw e;
  }
}

function schedulePeriodicSnapshot(
  db: any,
  dbPath: string,
  snapshotPath: string,
  isBetter: boolean
): NodeJS.Timeout {
  const intervalMs = getSnapshotIntervalMs();
  const timer = setInterval(() => {
    doSnapshot(db, dbPath, snapshotPath, isBetter).catch((e) => {
      console.warn("[db] periodic snapshot error:", e?.message || e);
    });
  }, intervalMs);
  if (typeof (timer as any).unref === "function") (timer as any).unref();
  return timer;
}

function installShutdownHandlers(
  db: any,
  dbPath: string,
  snapshotPath: string,
  isBetter: boolean,
  timer: NodeJS.Timeout | null
): void {
  const store = getStore();
  if (store.shutdownInstalled) return;
  store.shutdownInstalled = true;

  const handler = async (sig: string) => {
    console.log(`[db] ${sig} received, flushing snapshot...`);
    try {
      if (timer) clearInterval(timer);
      await doSnapshot(db, dbPath, snapshotPath, isBetter);
    } catch {}
    try {
      if (typeof db.close === "function") db.close();
    } catch {}
    if (sig === "SIGTERM" || sig === "SIGINT") {
      // Small delay to let logs flush on systemd/docker
      setTimeout(() => process.exit(0), 120);
    }
  };

  try {
    process.once("SIGTERM", () => {
      void handler("SIGTERM");
    });
    process.once("SIGINT", () => {
      void handler("SIGINT");
    });
    // beforeExit for non-signal termination (e.g. Next dev reload)
    process.once("beforeExit", () => {
      void doSnapshot(db, dbPath, snapshotPath, isBetter).catch(() => {});
    });
  } catch {}
}

// ---------------------------------------------------------------------------
// Driver loading (better-sqlite3 with fallback to node:sqlite)
// ---------------------------------------------------------------------------

function loadBetterSqlite3(): any {
  try {
    // Use dynamic eval to avoid Next.js bundler tracing static require at build time
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const _require = eval("require") as NodeRequire;
    let mod: any = _require("better-sqlite3");
    if (mod && mod.default) mod = mod.default;
    return mod;
  } catch {
    return null;
  }
}

function loadNodeSqlite(): any {
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const _require = eval("require") as NodeRequire;
    const mod: any = _require("node:sqlite");
    return mod;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Initialize DB singleton — idempotent, HMR-safe.
 * Restores from SNAPSHOT_PATH if /dev/shm empty, applies pragmas, creates schema,
 * schedules periodic snapshot and SIGTERM handler.
 */
export function initDb(): any {
  const store = getStore();
  if (store.initialized && store.db) return store.db;

  const dbPath = getDbPath();
  const snapshotPath = getSnapshotPath();

  // Restore before opening (cold boot from NVMe snapshot)
  restoreFromSnapshotIfNeeded(dbPath, snapshotPath);
  ensureDirForFile(dbPath);

  let BetterSqlite3: any = loadBetterSqlite3();
  let db: any = null;
  let isBetter = false;

  if (BetterSqlite3) {
    try {
      db = new BetterSqlite3(dbPath);
      isBetter = true;
      console.log(`[db] opened better-sqlite3 at ${dbPath}`);
    } catch (e: any) {
      console.warn(`[db] better-sqlite3 open failed, trying node:sqlite:`, e?.message || e);
      BetterSqlite3 = null;
    }
  }

  if (!db) {
    const NodeSqlite: any = loadNodeSqlite();
    if (NodeSqlite && NodeSqlite.DatabaseSync) {
      try {
        db = new NodeSqlite.DatabaseSync(dbPath);
        isBetter = false;
        console.log(`[db] opened node:sqlite at ${dbPath}`);
      } catch (e: any) {
        console.error(`[db] node:sqlite open failed:`, e?.message || e);
        throw e;
      }
    } else {
      // Last resort: in-memory fallback if BetterSqlite3 still available but path was :memory: earlier failed
      if (BetterSqlite3) {
        try {
          db = new BetterSqlite3(":memory:");
          isBetter = true;
          console.warn(`[db] fallback to :memory: (no persistent storage) — install better-sqlite3 or use Node >=22`);
        } catch (e: any) {
          throw new Error(
            "No sqlite driver available: install better-sqlite3 (npm i better-sqlite3) or use Node >=22 with node:sqlite"
          );
        }
      } else {
        throw new Error(
          "No sqlite driver available: install better-sqlite3 (npm i better-sqlite3) or use Node >=22 with node:sqlite"
        );
      }
    }
  }

  applyPragmas(db);

  try {
    createSchema(db);
    console.log("[db] schema ready");
  } catch (e: any) {
    console.error("[db] schema creation failed:", e?.message || e);
    throw e;
  }

  let timer: NodeJS.Timeout | null = null;
  if (dbPath !== ":memory:") {
    timer = schedulePeriodicSnapshot(db, dbPath, snapshotPath, isBetter);
    installShutdownHandlers(db, dbPath, snapshotPath, isBetter, timer);
  }

  store.db = db;
  store.isBetter = isBetter;
  store.dbPath = dbPath;
  store.snapshotPath = snapshotPath;
  store.snapshotTimer = timer;
  store.initialized = true;

  return db;
}

/** Get singleton handle — lazy init if needed (HMR-safe). */
export function getDb(): any {
  const store = getStore();
  if (store.initialized && store.db) return store.db;
  return initDb();
}

/** Close DB and clear periodic timer (for tests / graceful shutdown). */
export function closeDb(): void {
  const store = getStore();
  if (store.snapshotTimer) {
    clearInterval(store.snapshotTimer);
    store.snapshotTimer = null;
  }
  if (store.db) {
    try {
      if (typeof store.db.close === "function") store.db.close();
    } catch {}
    store.db = undefined;
    store.initialized = false;
  }
}

/** Force a snapshot now (e.g. before deploy or in API handler). */
export async function snapshotNow(): Promise<void> {
  const store = getStore();
  if (!store.db || !store.dbPath || !store.snapshotPath) {
    throw new Error("DB not initialized");
  }
  await doSnapshot(store.db, store.dbPath, store.snapshotPath, !!store.isBetter);
}

// ---------------------------------------------------------------------------
// Providers mirror stub (durable mirror of in-memory providers-store)
// Element requires refinement: full sync logic (heartbeat -> SQLite mirror) will be wired once lib/db.ts snapshot is stable.
// ---------------------------------------------------------------------------

/**
 * Persist a provider payload into providers_mirror (JSON blob).
 * Intended to be called from lib/providers-store.ts upsertProvider after DB is ready.
 * Safe to call even if DB not initialized — no-op with warn.
 */
export function mirrorProvider(id: string, payload: Record<string, any>): void {
  try {
    const db = getStore().db;
    if (!db) return;
    const now = new Date().toISOString();
    const stmt = db.prepare(
      `INSERT INTO providers_mirror (id, payload, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET payload=excluded.payload, updated_at=excluded.updated_at`
    );
    stmt.run(String(id), JSON.stringify(payload), now);
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

// ---------------------------------------------------------------------------
// Chain RPC placeholder — not mocked, just stub with refinement comment
// ---------------------------------------------------------------------------

/**
 * Element requires refinement: on-chain invoice confirmation (RPC polling + block confirmations)
 * should live here (or in lib/payments) and use RPC_URL_* envs + block_number/block_hash persistence.
 * Current stub leaves invoices.status as 'pending' until external confirmer updates via db.
 * Do not return mock confirmed status — real RPC requires refinement per chain.
 */
export function confirmInvoiceStub(_invoiceId: string): void {
  // Element requires refinement — chain RPC verification not yet implemented.
  // Intended flow: fetch tx via RPC_URL_* , wait CONFIRMATIONS_* , update invoices set status='confirmed', confirmed_at, block_number, block_hash.
}
