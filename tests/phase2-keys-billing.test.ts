/**
 * tests/phase2-keys-billing.test.ts — API keys (sk_live_) + micro-USD billing.
 * Run: npx tsx --test tests/phase2-keys-billing.test.ts
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seedinfer-phase2-"));
process.env.DATABASE_URL = `file:${path.join(tmpDir, "test.db")}`;
process.env.DB_BACKUPS = "off";
process.env.AUTH_SECRET = "test-only-auth-secret-0123456789abcdef";

import { getDb, closeDb } from "@/lib/db";
import {
  createApiKey,
  verifyApiKey,
  revokeApiKey,
  listApiKeys,
  countActiveKeys,
  API_KEY_RE,
  MAX_ACTIVE_KEYS,
} from "@/lib/api-keys";
import {
  getBalanceMicro,
  preauthCheck,
  settleUsage,
  creditBalanceMicro,
  estimateRequestCostMicro,
  usageCostMicro,
  MICRO_PER_CENT,
} from "@/lib/billing";
import { LIVE_MODEL } from "@/lib/catalog";

function mkUser(): string {
  const id = randomUUID();
  getDb()
    .prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)")
    .run(id, `${id}@test.local`, "x", new Date().toISOString());
  return id;
}

after(() => {
  try { closeDb(); } catch {}
});

describe("api keys", () => {
  it("create -> verify -> revoke lifecycle", () => {
    const uid = mkUser();
    const r = createApiKey(uid, "ci");
    assert.ok(!("error" in r));
    if ("error" in r) return;
    assert.match(r.secret, API_KEY_RE);
    assert.equal(r.key.prefix, r.secret.slice(0, 12));
    const v = verifyApiKey(r.secret);
    assert.ok(v);
    assert.equal(v!.userId, uid);
    assert.equal(v!.id, r.key.id);
    // listed without hash
    const listed = listApiKeys(uid);
    assert.equal(listed.length, 1);
    assert.equal((listed[0] as any).key_hash, undefined);
    // revoke
    const rv = revokeApiKey(uid, r.key.id);
    assert.ok(rv.ok);
    assert.equal(verifyApiKey(r.secret), null);
    // idempotent
    assert.ok(revokeApiKey(uid, r.key.id).ok);
  });

  it("rejects malformed / unknown secrets", () => {
    assert.equal(verifyApiKey("sk_live_short"), null);
    assert.equal(verifyApiKey("sipn_" + "a".repeat(43)), null);
    assert.equal(verifyApiKey("sk_live_" + "a".repeat(43)), null); // unknown
    assert.equal(verifyApiKey(""), null);
  });

  it("enforces the active-key limit", () => {
    const uid = mkUser();
    for (let i = 0; i < MAX_ACTIVE_KEYS; i++) {
      const r = createApiKey(uid, `k${i}`);
      assert.ok(!("error" in r), `key ${i} should be created`);
    }
    assert.equal(countActiveKeys(uid), MAX_ACTIVE_KEYS);
    const over = createApiKey(uid, "over");
    assert.ok("error" in over && over.error === "key_limit");
    // revoke one -> can create again
    const listed = listApiKeys(uid);
    revokeApiKey(uid, listed[0].id);
    assert.ok(!("error" in createApiKey(uid, "again")));
  });

  it("foreign user cannot revoke someone else's key", () => {
    const a = mkUser();
    const b = mkUser();
    const r = createApiKey(a, "mine");
    if ("error" in r) throw new Error("create failed");
    const res = revokeApiKey(b, r.key.id);
    assert.deepEqual(res, { ok: false, error: "not_found" });
    assert.ok(verifyApiKey(r.secret));
  });
});

describe("billing (micro-USD)", () => {
  it("migrates legacy cents balance to micro on first touch", () => {
    const uid = mkUser();
    getDb()
      .prepare("INSERT INTO credits (user_id, balance_usd_cents, balance_micro, updated_at) VALUES (?, 250, -1, ?)")
      .run(uid, new Date().toISOString());
    assert.equal(getBalanceMicro(uid), 250 * MICRO_PER_CENT);
    const row = getDb().prepare("SELECT balance_micro FROM credits WHERE user_id = ?").get(uid) as any;
    assert.equal(row.balance_micro, 2_500_000);
  });

  it("creates a zero balance row for new users", () => {
    const uid = mkUser();
    assert.equal(getBalanceMicro(uid), 0);
  });

  it("preauth passes/fails on estimate", () => {
    const uid = mkUser();
    creditBalanceMicro(uid, 1000);
    assert.equal(preauthCheck(uid, 1000).ok, true);
    assert.equal(preauthCheck(uid, 1001).ok, false);
    assert.equal(preauthCheck(uid, 1).balanceMicro, 1000);
  });

  it("settle charges exact micro cost and keeps the cents mirror", () => {
    const uid = mkUser();
    creditBalanceMicro(uid, 1_000_000); // $1
    const key = createApiKey(uid, "billing");
    if ("error" in key) throw new Error("create failed");
    // live model: $0.03/1M in, $0.20/1M out -> 1M+1M tokens = 0.23 USD = 230_000 micro
    const r = settleUsage({
      userId: uid,
      apiKeyId: key.key.id,
      model: LIVE_MODEL.id,
      promptTokens: 1_000_000,
      completionTokens: 1_000_000,
    });
    assert.ok(r);
    assert.equal(r!.costMicro, 230_000);
    assert.equal(r!.balanceMicro, 770_000);
    const c = getDb().prepare("SELECT balance_usd_cents FROM credits WHERE user_id = ?").get(uid) as any;
    assert.equal(c.balance_usd_cents, 77);
    const u = getDb().prepare("SELECT * FROM usage WHERE user_id = ?").get(uid) as any;
    assert.equal(u.api_key_id, key.key.id);
    assert.equal(u.cost_usd_micro, 230_000);
    assert.equal(u.model, LIVE_MODEL.id);
  });

  it("settle may push balance negative; next preauth fails", () => {
    const uid = mkUser();
    creditBalanceMicro(uid, 10);
    const r = settleUsage({ userId: uid, model: LIVE_MODEL.id, promptTokens: 1_000_000, completionTokens: 0 });
    assert.ok(r);
    assert.ok(r!.balanceMicro < 0);
    assert.equal(preauthCheck(uid, 1).ok, false);
  });

  it("estimate uses prompt + max output; usageCost matches pricePer1M", () => {
    const est = estimateRequestCostMicro(LIVE_MODEL.id, 1000, 500);
    // 1000*0.03 + 500*0.20 = 30 + 100 = 130 micro
    assert.equal(est, 130);
    assert.equal(usageCostMicro(LIVE_MODEL.id, 0, 0), 0);
  });

  it("settle returns null for a vanished user", () => {
    assert.equal(settleUsage({ userId: randomUUID(), model: LIVE_MODEL.id, promptTokens: 1, completionTokens: 1 }), null);
  });
});
