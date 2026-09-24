-- lib/schema.sql — SeedInfer RAM-first SQLite schema (reference)
-- tmpfs primary: /dev/shm/seedinfer.db  -> snapshot: /mnt/nvme/seedinfer/snapshot.db
-- WAL, synchronous=NORMAL, foreign_keys=ON, cache_size=-64000, mmap_size=268435456
-- Keep in sync with lib/db.ts initDb()

PRAGMA journal_mode=WAL;
PRAGMA synchronous=NORMAL;
PRAGMA foreign_keys=ON;
PRAGMA cache_size=-64000;
PRAGMA mmap_size=268435456;
PRAGMA temp_store=MEMORY;
PRAGMA busy_timeout=5000;
PRAGMA wal_autocheckpoint=1000;

-- users
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  wallet_address TEXT,
  created_at TEXT
);

-- sessions
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT,
  created_at TEXT
);

-- credits (per user)
CREATE TABLE IF NOT EXISTS credits (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  balance_usd_cents INTEGER,
  updated_at TEXT
);

-- invoices (crypto payments)
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

-- usage (token accounting)
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

-- providers mirror stub (HMR-safe cache -> durable)
CREATE TABLE IF NOT EXISTS providers_mirror (
  id TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- oauth_accounts (Google/GitHub link)
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

-- users delta: email_verified + avatar_url (nullable) — ALTER handled in lib/db.ts initDb try/catch

-- indexes
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
