/**
 * tests/verify-auth.test.ts — auth gate + SSRF guard for POST /api/v1/providers/verify.
 * Run: npx tsx --test tests/verify-auth.test.ts
 *
 *  - anonymous -> 401 node_token_missing
 *  - unknown/revoked token -> 401 node_token_invalid
 *  - another user's token -> 403 node_not_owned
 *  - owner's token -> 200, and a request-supplied agent_url is ignored
 *    (a local HTTP server stands in for the "evil" URL: it must see zero hits,
 *    and the stored agent_url must be unchanged)
 *  - admin (x-admin-token) -> 200
 *  - no Access-Control-Allow-Origin: * on any verify response
 *  - GET returns a usage message only: no probe, no state change
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getDb, closeDb } from "@/lib/db";
import { createNodeToken, bindNode } from "@/lib/provider-tokens";
import { clearAllRateLimits } from "@/lib/rate-limit";
import {
  upsertProvider,
  getProvider,
  deleteProvider,
  clearAll,
} from "@/lib/providers-store";
import { POST as verifyPost, GET as verifyGet } from "@/app/api/v1/providers/verify/route";

// --- isolated env (must be set before getDb() runs in before()) ---
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seedinfer-verify-auth-test-"));
process.env.DATABASE_URL = `file:${path.join(tmpDir, "test.db")}`;
process.env.DB_BACKUPS = "off";
process.env.AUTH_SECRET = "test-only-auth-secret-0123456789abcdef";

const VERIFY_URL = "http://localhost/api/v1/providers/verify";

let userOwner = "";
let userOther = "";
let ipSeq = 0;

function freshIp(): string {
  ipSeq += 1;
  return `10.221.0.${ipSeq}`;
}

function nid(prefix: string): string {
  return `${prefix}-${randomUUID().slice(0, 8)}`;
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

/** Register a node in the store AND bind it to the owner's token in provider_nodes. */
function registerNode(nodeId: string, ownerId: string, tokenId: string, extra?: Record<string, unknown>): void {
  upsertProvider({ id: nodeId, chip: "Test GPU", agent_url: "http://127.0.0.1:9", ...extra });
  const bind = bindNode(nodeId, ownerId, tokenId);
  assert.deepEqual(bind.ok, true, "bindNode must succeed in test setup");
}

function postVerify(
  nodeId: string,
  opts?: { token?: string; admin?: string; body?: unknown; ip?: string }
): Request {
  const headers: Record<string, string> = {
    "content-type": "application/json",
    "x-forwarded-for": opts?.ip ?? freshIp(),
  };
  if (opts?.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts?.admin) headers["x-admin-token"] = opts.admin;
  return new Request(VERIFY_URL, {
    method: "POST",
    headers,
    body: JSON.stringify(opts?.body ?? { provider_id: nodeId }),
  });
}

function saveAdminEnv(): Record<string, string | undefined> {
  return {
    ADMIN_TOKEN: process.env.ADMIN_TOKEN,
    SEEDINFER_ADMIN_TOKEN: process.env.SEEDINFER_ADMIN_TOKEN,
    SEEDINFER_ADMIN_TOKEN_ALT: process.env.SEEDINFER_ADMIN_TOKEN_ALT,
  };
}

function restoreAdminEnv(saved: Record<string, string | undefined>): void {
  delete process.env.ADMIN_TOKEN;
  delete process.env.SEEDINFER_ADMIN_TOKEN;
  delete process.env.SEEDINFER_ADMIN_TOKEN_ALT;
  for (const [k, v] of Object.entries(saved)) {
    if (v !== undefined) process.env[k] = v;
  }
}

before(() => {
  getDb();
  userOwner = createUser("verify-owner@example.com");
  userOther = createUser("verify-other@example.com");
});

after(() => {
  clearAll();
  clearAllRateLimits();
  closeDb();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("verify auth gate", () => {
  it("anonymous POST -> 401 node_token_missing, no CORS wildcard", async () => {
    clearAllRateLimits();
    const owner = mintToken(userOwner, `anon-${randomUUID().slice(0, 8)}`);
    const nodeId = nid("verify-anon");
    registerNode(nodeId, userOwner, owner.tokenId);
    try {
      const res = await verifyPost(postVerify(nodeId));
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.ok, false);
      assert.equal(body.code, "node_token_missing");
      assert.equal(res.headers.get("access-control-allow-origin"), null);
    } finally {
      deleteProvider(nodeId);
      clearAllRateLimits();
    }
  });

  it("unknown token -> 401 node_token_invalid", async () => {
    clearAllRateLimits();
    const owner = mintToken(userOwner, `bad-${randomUUID().slice(0, 8)}`);
    const nodeId = nid("verify-bad");
    registerNode(nodeId, userOwner, owner.tokenId);
    try {
      const res = await verifyPost(postVerify(nodeId, { token: `sipn_${"A".repeat(43)}` }));
      assert.equal(res.status, 401);
      assert.equal((await res.json()).code, "node_token_invalid");
    } finally {
      deleteProvider(nodeId);
      clearAllRateLimits();
    }
  });

  it("another user's token -> 403 node_not_owned", async () => {
    clearAllRateLimits();
    const owner = mintToken(userOwner, `own-${randomUUID().slice(0, 8)}`);
    const other = mintToken(userOther, `oth-${randomUUID().slice(0, 8)}`);
    const nodeId = nid("verify-owned");
    registerNode(nodeId, userOwner, owner.tokenId);
    try {
      const res = await verifyPost(postVerify(nodeId, { token: other.secret }));
      assert.equal(res.status, 403);
      const body = await res.json();
      assert.equal(body.ok, false);
      assert.equal(body.code, "node_not_owned");
      assert.equal(res.headers.get("access-control-allow-origin"), null);
    } finally {
      deleteProvider(nodeId);
      clearAllRateLimits();
    }
  });

  it("owner token -> 200; request-supplied agent_url is ignored (no SSRF)", async () => {
    clearAllRateLimits();
    const owner = mintToken(userOwner, `ssrf-${randomUUID().slice(0, 8)}`);
    const nodeId = nid("verify-ssrf");
    const storedUrl = "http://127.0.0.1:9"; // discard port: stored probe fails fast
    registerNode(nodeId, userOwner, owner.tokenId, { agent_url: storedUrl });

    // Stand-in for an attacker-controlled URL: any probe of it counts as SSRF.
    const hits: string[] = [];
    const server = http.createServer((req, res) => {
      hits.push(`${req.method} ${req.url}`);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const evilUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      const res = await verifyPost(
        postVerify(nodeId, { token: owner.secret, body: { provider_id: nodeId, agent_url: evilUrl } })
      );
      assert.equal(res.status, 200);
      assert.equal((await res.json()).ok, true);
      assert.equal(res.headers.get("access-control-allow-origin"), null);
      assert.deepEqual(hits, [], "request-supplied agent_url must never be probed");
      assert.equal(getProvider(nodeId)?.agent_url, storedUrl, "stored agent_url must be unchanged");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
      deleteProvider(nodeId);
      clearAllRateLimits();
    }
  });

  it("admin via x-admin-token -> 200 (ownership bypassed), no CORS wildcard", async () => {
    const saved = saveAdminEnv();
    const secret = `adm-${randomUUID()}`;
    process.env.ADMIN_TOKEN = secret;
    clearAllRateLimits();
    const owner = mintToken(userOwner, `adm-${randomUUID().slice(0, 8)}`);
    const nodeId = nid("verify-admin");
    registerNode(nodeId, userOwner, owner.tokenId);
    try {
      const res = await verifyPost(postVerify(nodeId, { admin: secret }));
      assert.equal(res.status, 200);
      assert.equal((await res.json()).ok, true);
      assert.equal(res.headers.get("access-control-allow-origin"), null);
    } finally {
      restoreAdminEnv(saved);
      deleteProvider(nodeId);
      clearAllRateLimits();
    }
  });

  it("unknown provider_id with valid owner token -> 404 provider_not_found", async () => {
    clearAllRateLimits();
    const owner = mintToken(userOwner, `nf-${randomUUID().slice(0, 8)}`);
    // Bind the ghost id so auth passes, but no provider record exists in the store.
    const nodeId = nid("verify-ghost");
    const bind = bindNode(nodeId, userOwner, owner.tokenId);
    assert.equal(bind.ok, true);
    try {
      const res = await verifyPost(postVerify(nodeId, { token: owner.secret }));
      assert.equal(res.status, 404);
      assert.equal((await res.json()).code, "provider_not_found");
    } finally {
      deleteProvider(nodeId);
      clearAllRateLimits();
    }
  });
});

describe("verify GET is usage-only", () => {
  it("GET with provider_id does not probe and does not change state", async () => {
    clearAllRateLimits();
    const owner = mintToken(userOwner, `get-${randomUUID().slice(0, 8)}`);
    const nodeId = nid("verify-get");
    registerNode(nodeId, userOwner, owner.tokenId);
    try {
      const before = getProvider(nodeId)!;
      assert.equal(before.verification.status, "pending");
      const res = await verifyGet();
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.match(body.message, /Use POST/);
      assert.equal(body.ok, undefined, "GET must not return a probe result");
      assert.equal(body.verification, undefined, "GET must not return verification state");
      assert.equal(res.headers.get("access-control-allow-origin"), null);
      const after = getProvider(nodeId)!;
      assert.equal(after.verification.status, "pending");
      assert.equal(after.verification.last_check, null);
    } finally {
      deleteProvider(nodeId);
      clearAllRateLimits();
    }
  });
});
