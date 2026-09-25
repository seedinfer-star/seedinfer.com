/**
 * tests/security-hardening.test.ts — fail-closed auth/admin guards + rate limits.
 * Run: npx tsx --test tests/security-hardening.test.ts
 *
 * Covers (without touching non-test code):
 *  a) app/api/v1/auth/request/route.ts (GET + POST)
 *  b) lib/admin-auth.ts via POST /api/v1/providers/clear and /api/admin/reset
 *  c) app/api/v1/providers/verify/route.ts POST per-node rate limit
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getDb, closeDb } from "@/lib/db";
import { createNodeToken, revokeNodeToken, bindNode } from "@/lib/provider-tokens";
import { clearAllRateLimits } from "@/lib/rate-limit";
import {
  upsertProvider,
  getProvider,
  listProviders,
  deleteProvider,
  clearAll,
  setForceZero,
} from "@/lib/providers-store";
import * as authRoute from "@/app/api/v1/auth/request/route";
import { HEADSCALE_CREATE_CMD, setAuthKeyMinter } from "@/lib/auth-key-minter";
import { POST as clearPost } from "@/app/api/v1/providers/clear/route";
import { POST as resetPost } from "@/app/api/admin/reset/route";
import { POST as verifyPost } from "@/app/api/v1/providers/verify/route";

// --- isolated env (must be set before getDb() runs in before()) ---
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seedinfer-hardening-test-"));
process.env.DATABASE_URL = `file:${path.join(tmpDir, "test.db")}`;
process.env.DB_BACKUPS = "off";
process.env.AUTH_SECRET = "test-only-auth-secret-0123456789abcdef";

const AUTH_URL = "http://localhost/api/v1/auth/request";
const CLEAR_URL = "http://localhost/api/v1/providers/clear";
const RESET_URL = "http://localhost/api/admin/reset";
const VERIFY_URL = "http://localhost/api/v1/providers/verify";

let userA = "";
let userB = "";
let ipSeq = 0;

function freshIp(): string {
  ipSeq += 1;
  return `10.220.0.${ipSeq}`;
}

function createUser(email: string): string {
  const id = randomUUID();
  getDb()
    .prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)")
    .run(id, email, "test-hash", new Date().toISOString());
  return id;
}

function mintToken(userId: string, name: string): { secret: string; tokenId: string } {
  const r = createNodeToken(userId, name);
  if ("error" in r) throw new Error(`createNodeToken failed: ${r.error}`);
  return { secret: r.secret, tokenId: r.token.id };
}

function authReq(url: string, opts: { method?: string; token?: string; body?: unknown; ip: string }): Request {
  const headers: Record<string, string> = { "x-forwarded-for": opts.ip };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.body !== undefined) headers["content-type"] = "application/json";
  return new Request(url, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

function saveAdminEnv(): Record<string, string | undefined> {
  return {
    ADMIN_TOKEN: process.env.ADMIN_TOKEN,
    SEEDINFER_ADMIN_TOKEN: process.env.SEEDINFER_ADMIN_TOKEN,
    SEEDINFER_ADMIN_TOKEN_ALT: process.env.SEEDINFER_ADMIN_TOKEN_ALT,
  };
}

function clearAdminEnv(): void {
  delete process.env.ADMIN_TOKEN;
  delete process.env.SEEDINFER_ADMIN_TOKEN;
  delete process.env.SEEDINFER_ADMIN_TOKEN_ALT;
}

function restoreAdminEnv(saved: Record<string, string | undefined>): void {
  clearAdminEnv();
  for (const [k, v] of Object.entries(saved)) {
    if (v !== undefined) process.env[k] = v;
  }
}

before(() => {
  getDb();
  userA = createUser("hardening-alice@example.com");
  userB = createUser("hardening-bob@example.com");
});

after(() => {
  setAuthKeyMinter(null);
  setForceZero(false);
  clearAll();
  clearAllRateLimits();
  closeDb();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("auth/request node-token gate + tag allowlist", () => {
  it("GET without Authorization -> 401 node_token_missing", async () => {
    clearAllRateLimits();
    const res = await authRoute.GET(authReq(AUTH_URL, { ip: freshIp() }));
    assert.equal(res.status, 401);
    assert.equal((await res.json()).code, "node_token_missing");
  });

  it("POST without Authorization -> 401 node_token_missing", async () => {
    clearAllRateLimits();
    const res = await authRoute.POST(authReq(AUTH_URL, { method: "POST", body: {}, ip: freshIp() }));
    assert.equal(res.status, 401);
    assert.equal((await res.json()).code, "node_token_missing");
  });

  it("GET with revoked token -> 401 node_token_invalid", async () => {
    clearAllRateLimits();
    const t = mintToken(userA, `rev-get-${randomUUID().slice(0, 8)}`);
    revokeNodeToken(userA, t.tokenId);
    const res = await authRoute.GET(authReq(AUTH_URL, { token: t.secret, ip: freshIp() }));
    assert.equal(res.status, 401);
    assert.equal((await res.json()).code, "node_token_invalid");
  });

  it("POST with revoked token -> 401 node_token_invalid", async () => {
    clearAllRateLimits();
    const t = mintToken(userA, `rev-post-${randomUUID().slice(0, 8)}`);
    revokeNodeToken(userA, t.tokenId);
    const res = await authRoute.POST(authReq(AUTH_URL, { method: "POST", token: t.secret, body: {}, ip: freshIp() }));
    assert.equal(res.status, 401);
    assert.equal((await res.json()).code, "node_token_invalid");
  });

  it("GET ?tag=foo -> 400 invalid_tag", async () => {
    clearAllRateLimits();
    const t = mintToken(userA, `tag-get-${randomUUID().slice(0, 8)}`);
    const res = await authRoute.GET(authReq(`${AUTH_URL}?tag=foo`, { token: t.secret, ip: freshIp() }));
    assert.equal(res.status, 400);
    assert.equal((await res.json()).code, "invalid_tag");
  });

  it("POST {tag:foo} -> 400 invalid_tag", async () => {
    clearAllRateLimits();
    const t = mintToken(userA, `tag-post-${randomUUID().slice(0, 8)}`);
    const res = await authRoute.POST(
      authReq(AUTH_URL, { method: "POST", token: t.secret, body: { tag: "foo" }, ip: freshIp() })
    );
    assert.equal(res.status, 400);
    assert.equal((await res.json()).code, "invalid_tag");
  });

  it("GET success via test-double minter: single-use key, no leak, no CORS wildcard", async () => {
    clearAllRateLimits();
    const t = mintToken(userA, `ok-get-${randomUUID().slice(0, 8)}`);
    const minted = `hskey-test-${randomUUID().replace(/-/g, "")}`;
    setAuthKeyMinter(async () => minted);
    try {
      const res = await authRoute.GET(authReq(AUTH_URL, { token: t.secret, ip: freshIp() }));
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.authkey, minted);
      assert.equal(body.reusable, false);
      // The key command is a constant: single-use (--expiration, never --reusable).
      assert.ok(HEADSCALE_CREATE_CMD.includes("--expiration 1h"));
      assert.ok(!HEADSCALE_CREATE_CMD.includes("--reusable"));
      // Audit row exists but never contains the key itself.
      const ev = getDb()
        .prepare("SELECT type, detail FROM account_events WHERE user_id = ? AND type = ? ORDER BY id DESC LIMIT 1")
        .get(userA, "tailnet_key_issued") as { type: string; detail: string } | undefined;
      assert.ok(ev, "tailnet_key_issued event recorded");
      assert.equal(JSON.parse(ev.detail).node_token_prefix, t.secret.slice(0, 12));
      assert.ok(!ev.detail.includes(minted), "event must not contain the key");
      assert.equal(res.headers.get("access-control-allow-origin"), null);
    } finally {
      setAuthKeyMinter(null);
    }
  });

  it("POST success via test-double minter", async () => {
    clearAllRateLimits();
    const t = mintToken(userA, `ok-post-${randomUUID().slice(0, 8)}`);
    const minted = `hskey-test-${randomUUID().replace(/-/g, "")}`;
    setAuthKeyMinter(async () => minted);
    try {
      const res = await authRoute.POST(authReq(AUTH_URL, { method: "POST", token: t.secret, body: {}, ip: freshIp() }));
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.authkey, minted);
      assert.equal(body.reusable, false);
      assert.equal(res.headers.get("access-control-allow-origin"), null);
    } finally {
      setAuthKeyMinter(null);
    }
  });

  it("6th request within an hour per token -> 429 rate_limited with Retry-After", async () => {
    clearAllRateLimits();
    const t = mintToken(userB, `rl-${randomUUID().slice(0, 8)}`);
    const ip = freshIp();
    setAuthKeyMinter(async () => `hskey-test-${randomUUID().replace(/-/g, "")}`);
    try {
      for (let i = 0; i < 5; i++) {
        const r = await authRoute.GET(authReq(AUTH_URL, { token: t.secret, ip }));
        assert.equal(r.status, 200, `request ${i + 1} should succeed`);
        await r.text();
      }
      const limited = await authRoute.GET(authReq(AUTH_URL, { token: t.secret, ip }));
      assert.equal(limited.status, 429);
      assert.equal((await limited.json()).code, "rate_limited");
      assert.ok(limited.headers.get("retry-after"), "Retry-After required");
    } finally {
      setAuthKeyMinter(null);
      clearAllRateLimits();
    }
  });
});

describe("admin guard via providers/clear", () => {
  it("no admin token configured -> 503 admin_disabled and store NOT cleared", async () => {
    const saved = saveAdminEnv();
    const id = `admin-guard-${randomUUID().slice(0, 8)}`;
    upsertProvider({ id, chip: "Test GPU" });
    clearAdminEnv();
    try {
      const res = await clearPost(new Request(CLEAR_URL, { method: "POST" }));
      assert.equal(res.status, 503);
      assert.equal((await res.json()).code, "admin_disabled");
      assert.ok(getProvider(id), "provider store must survive a disabled-admin call");
    } finally {
      restoreAdminEnv(saved);
      deleteProvider(id);
    }
  });

  it("wrong token -> 401", async () => {
    const saved = saveAdminEnv();
    process.env.ADMIN_TOKEN = `real-${randomUUID()}`;
    try {
      const res = await clearPost(new Request(CLEAR_URL, { method: "POST", headers: { "x-admin-token": "wrong" } }));
      assert.equal(res.status, 401);
    } finally {
      restoreAdminEnv(saved);
    }
  });

  it("correct token via x-admin-token -> success", async () => {
    const saved = saveAdminEnv();
    const secret = `adm-${randomUUID()}`;
    process.env.ADMIN_TOKEN = secret;
    const id = `admin-ok-hdr-${randomUUID().slice(0, 8)}`;
    upsertProvider({ id, chip: "Test GPU" });
    try {
      const res = await clearPost(new Request(CLEAR_URL, { method: "POST", headers: { "x-admin-token": secret } }));
      assert.equal(res.status, 200);
      assert.equal((await res.json()).ok, true);
      assert.equal(getProvider(id), undefined);
      assert.equal(listProviders().length, 0);
    } finally {
      restoreAdminEnv(saved);
      setForceZero(false);
      deleteProvider(id);
    }
  });

  it("correct token via Bearer -> success", async () => {
    const saved = saveAdminEnv();
    const secret = `adm-${randomUUID()}`;
    process.env.ADMIN_TOKEN = secret;
    const id = `admin-ok-bearer-${randomUUID().slice(0, 8)}`;
    upsertProvider({ id, chip: "Test GPU" });
    try {
      const res = await clearPost(
        new Request(CLEAR_URL, { method: "POST", headers: { authorization: `Bearer ${secret}` } })
      );
      assert.equal(res.status, 200);
      assert.equal((await res.json()).ok, true);
      assert.equal(getProvider(id), undefined);
    } finally {
      restoreAdminEnv(saved);
      setForceZero(false);
      deleteProvider(id);
    }
  });
});

describe("admin guard via admin/reset", () => {
  it("no admin token configured -> 503 admin_disabled and store NOT cleared", async () => {
    const saved = saveAdminEnv();
    const id = `reset-guard-${randomUUID().slice(0, 8)}`;
    upsertProvider({ id, chip: "Test GPU" });
    clearAdminEnv();
    try {
      const res = await resetPost(new Request(RESET_URL, { method: "POST" }));
      assert.equal(res.status, 503);
      assert.equal((await res.json()).code, "admin_disabled");
      assert.ok(getProvider(id), "provider store must survive a disabled-admin call");
    } finally {
      restoreAdminEnv(saved);
      deleteProvider(id);
    }
  });

  it("wrong token -> 401", async () => {
    const saved = saveAdminEnv();
    process.env.SEEDINFER_ADMIN_TOKEN = `real-${randomUUID()}`;
    try {
      const res = await resetPost(
        new Request(RESET_URL, { method: "POST", headers: { authorization: "Bearer wrong" } })
      );
      assert.equal(res.status, 401);
    } finally {
      restoreAdminEnv(saved);
    }
  });

  it("SEEDINFER_ADMIN_TOKEN_ALT via x-admin-token -> success", async () => {
    const saved = saveAdminEnv();
    const secret = `alt-${randomUUID()}`;
    clearAdminEnv();
    process.env.SEEDINFER_ADMIN_TOKEN_ALT = secret;
    const id = `reset-ok-alt-${randomUUID().slice(0, 8)}`;
    upsertProvider({ id, chip: "Test GPU" });
    try {
      const res = await resetPost(new Request(RESET_URL, { method: "POST", headers: { "x-admin-token": secret } }));
      assert.equal(res.status, 200);
      assert.equal((await res.json()).ok, true);
      assert.equal(getProvider(id), undefined);
    } finally {
      restoreAdminEnv(saved);
      setForceZero(false);
      deleteProvider(id);
    }
  });

  it("correct token via Bearer -> success", async () => {
    const saved = saveAdminEnv();
    const secret = `adm-${randomUUID()}`;
    clearAdminEnv();
    process.env.ADMIN_TOKEN = secret;
    const id = `reset-ok-bearer-${randomUUID().slice(0, 8)}`;
    upsertProvider({ id, chip: "Test GPU" });
    try {
      const res = await resetPost(
        new Request(RESET_URL, { method: "POST", headers: { authorization: `Bearer ${secret}` } })
      );
      assert.equal(res.status, 200);
      assert.equal((await res.json()).ok, true);
      assert.equal(getProvider(id), undefined);
    } finally {
      restoreAdminEnv(saved);
      setForceZero(false);
      deleteProvider(id);
    }
  });
});

describe("verify per-node rate limit", () => {
  it("second probe of the same node id within 30s -> 429 with Retry-After", async () => {
    clearAllRateLimits();
    // Discard-port URL: connection refused immediately, so the first (real)
    // probe fails fast and the test measures the rate limit, not the network.
    // Verify now requires the owner node token (or admin): bind the node to a test user.
    const nodeOwner = createUser(`verify-rl-owner-${randomUUID().slice(0, 8)}@example.com`);
    const t = mintToken(nodeOwner, `verify-rl-${randomUUID().slice(0, 8)}`);
    const nodeId = `verify-rl-${randomUUID().slice(0, 8)}`;
    upsertProvider({ id: nodeId, chip: "Test GPU", agent_url: "http://127.0.0.1:9" });
    bindNode(nodeId, nodeOwner, t.tokenId);
    const ip = freshIp();
    const probe = () =>
      verifyPost(
        new Request(VERIFY_URL, {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": ip, authorization: `Bearer ${t.secret}` },
          body: JSON.stringify({ provider_id: nodeId }),
        })
      );
    try {
      const first = await probe();
      assert.equal(first.status, 200);
      await first.text();
      const second = await probe();
      assert.equal(second.status, 429);
      assert.equal((await second.json()).code, "rate_limited");
      assert.ok(second.headers.get("retry-after"), "Retry-After required");
    } finally {
      deleteProvider(nodeId);
      clearAllRateLimits();
    }
  });
});
