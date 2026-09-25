-- lib/schema.sql — SeedInfer account database schema (reference)
-- Primary: DATABASE_URL (recommended /var/lib/seedinfer/seedinfer.db on disk), rotating VACUUM INTO backups
-- WAL, synchronous=FULL (NORMAL only in legacy tmpfs mode), foreign_keys=ON
-- Keep in sync with lib/db.ts initDb()

PRAGMA journal_mode=WAL;
PRAGMA synchronous=FULL;
PRAGMA foreign_keys=ON;
PRAGMA cache_size=-64000;
PRAGMA temp_store=MEMORY;
PRAGMA busy_timeout=5000;
PRAGMA wal_autocheckpoint=1000;

-- users
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
  last_login_at TEXT,
  payout_wallet TEXT,
  payout_wallet_updated_at TEXT
);

-- sessions
CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT,
  created_at TEXT,
  user_agent TEXT,
  method TEXT
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

-- users payout wallet (account-level USDC destination, sudo-mode gated)
-- ALTER handled in lib/db.ts ADDED_COLUMNS (payout_wallet, payout_wallet_updated_at)

-- provider node tokens (sha256(token) in token_hash; plaintext returned once at creation)
CREATE TABLE IF NOT EXISTS provider_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  prefix TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_used_at TEXT,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_provider_tokens_user ON provider_tokens(user_id);

-- provider node bindings (node_id bound to owning user; survives token revocation)
CREATE TABLE IF NOT EXISTS provider_nodes (
  node_id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_id TEXT REFERENCES provider_tokens(id) ON DELETE SET NULL,
  bound_at TEXT NOT NULL,
  last_seen_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_provider_nodes_user ON provider_nodes(user_id);

-- account audit trail (payout_wallet_changed | node_token_created | node_token_revoked | node_bound)
CREATE TABLE IF NOT EXISTS account_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  detail TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_account_events_user ON account_events(user_id, created_at);

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
