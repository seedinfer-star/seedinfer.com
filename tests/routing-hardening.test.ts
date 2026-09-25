/**
 * tests/routing-hardening.test.ts — awaiting_heartbeat nodes stay dark until a fresh heartbeat.
 * Run: npx tsx --test tests/routing-hardening.test.ts
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getDb, closeDb } from "@/lib/db";
import { createNodeToken } from "@/lib/provider-tokens";
import { clearAllRateLimits, getClientIpFromHeaders } from "@/lib/rate-limit";
import {
  upsertProvider,
  getProvider,
  listRoutableProviders,
  clearAll,
  setForceZero,
  isForceZero,
} from "@/lib/providers-store";
import { selectProvider, getSortedProviders, resetRouting } from "@/lib/routing/selector";
import { GET as modelsGet } from "@/app/api/v1/models/route";
import { POST as hbPost } from "@/app/api/v1/providers/heartbeat/route";
import { GET as clearGet } from "@/app/api/v1/providers/clear/route";
import { GET as resetGet } from "@/app/api/admin/reset/route";

// --- isolated env (must be set before getDb() runs in before()) ---
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seedinfer-routing-hardening-"));
process.env.DATABASE_URL = `file:${path.join(tmpDir, "test.db")}`;
process.env.DB_BACKUPS = "off";
process.env.AUTH_SECRET = "test-only-auth-secret-0123456789abcdef";

const CUSTOM_MODEL = "custom-test/awaiting-model-xyz";
const NODE_ID = `awaiting-node-${randomUUID().slice(0, 8)}`;

let userId = "";
let nodeSecret = "";

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

function seedAwaitingNode(): void {
  upsertProvider({ id: NODE_ID, chip: "Test GPU", current_model: CUSTOM_MODEL });
  const p = getProvider(NODE_ID)!;
  p.verification.status = "verified";
  p.awaiting_heartbeat = true;
}

before(() => {
  getDb();
  userId = randomUUID();
  getDb()
    .prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)")
    .run(userId, "hardening@example.com", "test-hash", new Date().toISOString());
  const t = createNodeToken(userId, "hardening-rig");
  if ("error" in t) throw new Error("createNodeToken failed");
  nodeSecret = t.secret;
  clearAll();
  resetRouting();
  clearAllRateLimits();
  setForceZero(true);
  seedAwaitingNode();
});

after(() => {
  setForceZero(false);
  clearAll();
  resetRouting();
  clearAllRateLimits();
  closeDb();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("awaiting_heartbeat nodes stay dark", () => {
  it("absent from GET /api/v1/models output", async () => {
    const res = await modelsGet();
    assert.equal(res.status, 200);
    const body = await res.json();
    const ids = (body.data as any[]).map((m) => m.id);
    assert.ok(!ids.includes(CUSTOM_MODEL), "awaiting model must not be advertised");
  });

  it("never picked by the selector primary path", () => {
    const node = getProvider(NODE_ID)!;
    assert.equal(selectProvider([node] as any), null);
    assert.deepEqual(getSortedProviders([node] as any), []);
  });

  it("never picked by the selector legacy-fallback path", () => {
    const legacy = [{ id: "legacy-no-verification", awaiting_heartbeat: true } as any];
    assert.equal(selectProvider(legacy), null);
    assert.deepEqual(getSortedProviders(legacy), []);
  });

  it("does not clear forceZero", () => {
    assert.equal(listRoutableProviders().length, 0);
    assert.equal(isForceZero(), true);
  });

  it("fresh authenticated heartbeat makes the node routable", async () => {
    clearAllRateLimits();
    const res = await hbPost(
      new Request("http://localhost/api/v1/providers/heartbeat", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${nodeSecret}` },
        body: JSON.stringify({ id: NODE_ID, chip: "Test GPU", current_model: CUSTOM_MODEL }),
      })
    );
    assert.equal(res.status, 200);
    const stored = getProvider(NODE_ID)!;
    assert.equal(stored.awaiting_heartbeat, false);
    assert.equal(listRoutableProviders().length, 1);
    assert.equal(isForceZero(), false);
    assert.equal((selectProvider(listRoutableProviders() as any) as any)?.id, NODE_ID);
    const models = await modelsGet();
    const ids = ((await models.json()).data as any[]).map((m) => m.id);
    assert.ok(ids.includes(CUSTOM_MODEL), "live model advertised after heartbeat");
  });

  it("getClientIpFromHeaders prefers cf-connecting-ip over spoofed x-forwarded-for", () => {
    const h = new Headers({ "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9" });
    assert.equal(getClientIpFromHeaders(h), "1.2.3.4");
  });
});

describe("clear GET admin gate", () => {
  it("no admin token -> 503", async () => {
    const saved = saveAdminEnv();
    clearAdminEnv();
    try {
      const res = await clearGet(new Request("http://localhost/api/v1/providers/clear"));
      assert.equal(res.status, 503);
    } finally {
      restoreAdminEnv(saved);
    }
  });

  it("wrong token -> 401", async () => {
    const saved = saveAdminEnv();
    process.env.ADMIN_TOKEN = `real-${randomUUID()}`;
    try {
      const res = await clearGet(
        new Request("http://localhost/api/v1/providers/clear", { headers: { "x-admin-token": "wrong" } })
      );
      assert.equal(res.status, 401);
    } finally {
      restoreAdminEnv(saved);
    }
  });

  it("right token -> 200", async () => {
    const saved = saveAdminEnv();
    const secret = `adm-${randomUUID()}`;
    process.env.ADMIN_TOKEN = secret;
    try {
      const res = await clearGet(
        new Request("http://localhost/api/v1/providers/clear", { headers: { "x-admin-token": secret } })
      );
      assert.equal(res.status, 200);
    } finally {
      restoreAdminEnv(saved);
    }
  });
});

describe("reset GET admin gate", () => {
  it("no admin token -> 503", async () => {
    const saved = saveAdminEnv();
    clearAdminEnv();
    try {
      const res = await resetGet(new Request("http://localhost/api/admin/reset"));
      assert.equal(res.status, 503);
    } finally {
      restoreAdminEnv(saved);
    }
  });

  it("wrong token -> 401", async () => {
    const saved = saveAdminEnv();
    process.env.ADMIN_TOKEN = `real-${randomUUID()}`;
    try {
      const res = await resetGet(
        new Request("http://localhost/api/admin/reset", { headers: { "x-admin-token": "wrong" } })
      );
      assert.equal(res.status, 401);
    } finally {
      restoreAdminEnv(saved);
    }
  });

  it("right token -> 200", async () => {
    const saved = saveAdminEnv();
    const secret = `adm-${randomUUID()}`;
    process.env.ADMIN_TOKEN = secret;
    try {
      const res = await resetGet(
        new Request("http://localhost/api/admin/reset", { headers: { "x-admin-token": secret } })
      );
      assert.equal(res.status, 200);
    } finally {
      restoreAdminEnv(saved);
    }
  });
});
