/**
 * tests/provider-auth.test.ts — server-side provider auth (account + node token).
 * Run: npx tsx --test tests/provider-auth.test.ts
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { getDb, closeDb } from "@/lib/db";
import { signSession, getPublicOrigin } from "@/lib/auth";
import { exportUserData, deleteAccount } from "@/lib/accounts";
import {
  createNodeToken,
  listNodeTokens,
  revokeNodeToken,
  verifyNodeToken,
  bindNode,
} from "@/lib/provider-tokens";
import { getAccountPayoutWallet, setAccountPayoutWallet } from "@/lib/payout-wallet";
import { sanitizeProvider } from "@/lib/public-sanitize";
import * as store from "@/lib/providers-store";
import { clearAllRateLimits } from "@/lib/rate-limit";
import { selectProvider } from "@/lib/routing/selector";
import { POST as hbPost } from "@/app/api/v1/providers/heartbeat/route";
import { POST as legacyHbPost } from "@/app/api/providers/heartbeat/route";
import * as tokensRoute from "@/app/api/v1/account/node-tokens/route";
import * as tokenDelRoute from "@/app/api/v1/account/node-tokens/[id]/route";
import * as nodesRoute from "@/app/api/v1/account/nodes/route";
import * as walletRoute from "@/app/api/v1/account/payout-wallet/route";
import * as oldWalletRoute from "@/app/api/v1/providers/payout-wallet/route";

// --- isolated env (must be set before getDb() runs in before()) ---
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seedinfer-auth-test-"));
process.env.DATABASE_URL = `file:${path.join(tmpDir, "test.db")}`;
process.env.DB_BACKUPS = "off";
process.env.AUTH_SECRET = "test-only-auth-secret-0123456789abcdef";
process.env.NEXT_PUBLIC_SITE_URL = "https://seedinfer.com";
process.env.OAUTH_REDIRECT_BASE = "https://seedinfer.com";

const ORIGIN = getPublicOrigin();
const SITE = "seedinfer.com";

let userA = "";
let userB = "";
let userC = "";

function makeSession(userId: string) {
  return signSession(userId, { userAgent: "test" });
}

function cookieReq(url: string, jwt: string, opts?: { method?: string; body?: unknown; origin?: boolean }) {
  const headers: Record<string, string> = {
    cookie: `seedinfer_session=${jwt}`,
    "content-type": "application/json",
  };
  if (opts?.origin !== false) {
    headers.origin = ORIGIN;
    headers["sec-fetch-site"] = "same-origin";
    headers.host = SITE;
  }
  return new Request(url, {
    method: opts?.method || "GET",
    headers,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
}

function hbReq(payload: unknown, token?: string | null, raw?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;
  else if (token === null) headers.authorization = "Bearer";
  const body = raw !== undefined ? raw : JSON.stringify(payload);
  return new Request("http://localhost/api/v1/providers/heartbeat", { method: "POST", headers, body });
}

function createUser(email: string): string {
  const id = randomUUID();
  const now = new Date().toISOString();
  getDb()
    .prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)")
    .run(id, email, "test-hash", now);
  return id;
}

before(() => {
  getDb();
  userA = createUser("alice@example.com");
  userB = createUser("bob@example.com");
  userC = createUser("carol@example.com");
});

after(() => {
  closeDb();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("token lifecycle", () => {
  it("plaintext is never stored; only sha256 + prefix", () => {
    const r = createNodeToken(userA, "rig-1");
    assert.ok(!("error" in r));
    const secret = r.secret;
    assert.match(secret, /^sipn_[A-Za-z0-9_-]{43}$/);
    const row = getDb().prepare("SELECT * FROM provider_tokens WHERE id = ?").get(r.token.id) as any;
    assert.ok(!JSON.stringify(row).includes(secret), "plaintext must not be stored");
    assert.equal(row.prefix, secret.slice(0, 12));
    assert.equal(row.token_hash.length, 64);
    assert.equal(row.token_hash, createHash("sha256").update(secret, "utf8").digest("hex"));
    assert.deepEqual(verifyNodeToken(secret), { tokenId: r.token.id, userId: userA });
  });

  it("limit 20 active -> 409 on the 21st", async () => {
    clearAllRateLimits();
    const sess = await makeSession(userA);
    for (let i = 1; i < 20; i++) createNodeToken(userA, `n${i}`);
    assert.equal(listNodeTokens(userA).filter((t) => !t.revoked_at).length, 20);
    const res = await tokensRoute.POST(cookieReq("http://localhost/api/v1/account/node-tokens", sess.jwt, { method: "POST", body: {} }));
    assert.equal(res.status, 409);
    assert.equal((await res.json()).code, "token_limit");
  });

  it("revoke is idempotent; revoked token no longer verifies", () => {
    const target = listNodeTokens(userA)[0];
    assert.deepEqual(revokeNodeToken(userA, target.id), { ok: true });
    assert.deepEqual(revokeNodeToken(userA, target.id), { ok: true });
    assert.deepEqual(revokeNodeToken(userB, target.id), { ok: false, error: "not_found" });
  });
});

describe("heartbeat matrix", () => {
  let tokenA = "";
  let tokenA2 = "";
  let tokenC = "";

  it("setup tokens", () => {
    tokenA = (createNodeToken(userB, "b1") as any).secret as string;
    tokenA2 = (createNodeToken(userB, "b2") as any).secret as string;
    tokenC = (createNodeToken(userC, "c1") as any).secret as string;
  });

  it("missing -> 401 node_token_missing", async () => {
    const res = await hbPost(hbReq({ id: "node-x" }, undefined));
    assert.equal(res.status, 401);
    assert.equal((await res.json()).code, "node_token_missing");
  });

  it("malformed bearer -> 401 node_token_missing", async () => {
    const res = await hbPost(hbReq({ id: "node-x" }, null));
    assert.equal(res.status, 401);
    assert.equal((await res.json()).code, "node_token_missing");
  });

  it("bad -> 401 node_token_invalid", async () => {
    const res = await hbPost(hbReq({ id: "node-x" }, "sipn_" + "A".repeat(43)));
    assert.equal(res.status, 401);
    assert.equal((await res.json()).code, "node_token_invalid");
  });

  it("valid -> 200 + bound + owner_bound", async () => {
    const res = await hbPost(hbReq({ id: "node-1", chip: "Test GPU" }, tokenA));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(body.owner_bound, true);
    assert.equal(store.getProvider("node-1")!.owner_user_id, userB);
  });

  it("same user's second token -> 200 (token_id updated)", async () => {
    const res = await hbPost(hbReq({ id: "node-1" }, tokenA2));
    assert.equal(res.status, 200);
    assert.equal(store.getProvider("node-1")!.owner_user_id, userB);
    const row = getDb().prepare("SELECT token_id FROM provider_nodes WHERE node_id = ?").get("node-1") as any;
    assert.equal(row.token_id, verifyNodeToken(tokenA2)!.tokenId);
  });

  it("another user's token with same id -> 403", async () => {
    const res = await hbPost(hbReq({ id: "node-1" }, tokenC));
    assert.equal(res.status, 403);
    assert.equal((await res.json()).code, "node_owned_by_another_account");
  });

  it("revoked -> 401", async () => {
    const created = createNodeToken(userB, "tmp-revoke") as any;
    const r1 = await hbPost(hbReq({ id: "node-rev" }, created.secret));
    assert.equal(r1.status, 200);
    revokeNodeToken(userB, created.token.id);
    const r2 = await hbPost(hbReq({ id: "node-rev" }, created.secret));
    assert.equal(r2.status, 401);
    assert.equal((await r2.json()).code, "node_token_invalid");
  });

  it("payout_wallet/owner_user_id in body ignored", async () => {
    const res = await hbPost(
      hbReq({ id: "node-evil", payout_wallet: "0x1111111111111111111111111111111111111111", owner_user_id: "hacker", token_id: "x" }, tokenA)
    );
    assert.equal(res.status, 200);
    const st = store.getProvider("node-evil")!;
    assert.equal((st as any).payout_wallet, undefined);
    assert.equal(st.owner_user_id, userB);
  });

  it("invalid id -> 400", async () => {
    const res = await hbPost(hbReq({ id: "bad id!!" }, tokenA));
    assert.equal(res.status, 400);
    assert.equal((await res.json()).code, "invalid_node_id");
    const res2 = await hbPost(hbReq({}, tokenA));
    assert.equal(res2.status, 400);
    assert.equal((await res2.json()).code, "missing_id");
  });

  it(">64KB -> 413", async () => {
    const big = "x".repeat(70 * 1024);
    const res = await hbPost(hbReq(null, tokenA, JSON.stringify({ id: "node-big", blob: big })));
    assert.equal(res.status, 413);
    assert.equal((await res.json()).code, "payload_too_large");
  });

  it("repeated failed auth -> 429", async () => {
    clearAllRateLimits();
    let last: Response | null = null;
    for (let i = 0; i < 31; i++) {
      last = await hbPost(
        new Request("http://localhost/api/v1/providers/heartbeat", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "9.9.9.9", authorization: "Bearer sipn_" + "Z".repeat(43) },
          body: JSON.stringify({ id: "node-rl" }),
        })
      );
    }
    assert.equal(last!.status, 429);
    assert.equal((await last!.json()).code, "rate_limited");
    assert.ok(last!.headers.get("retry-after"));
    clearAllRateLimits();
  });

  it("legacy alias uses the same authenticated handler", async () => {
    const res = await legacyHbPost(hbReq({ id: "node-legacy" }, tokenA));
    assert.equal(res.status, 200);
    assert.equal((await res.json()).owner_bound, true);
    const unauth = await legacyHbPost(hbReq({ id: "node-legacy2" }, undefined));
    assert.equal(unauth.status, 401);
  });
});

describe("payout wallet API", () => {
  const GOOD_LOWER = "0x2eb9104aeef7270fe639bf1965b94bfb8edcf786";
  const GOOD_CHECKSUMMED = "0x2EB9104AEeF7270fe639Bf1965B94Bfb8Edcf786";

  it("401 without session", async () => {
    const res = await walletRoute.GET(new Request("http://localhost/api/v1/account/payout-wallet"));
    assert.equal(res.status, 401);
  });

  it("forbidden_origin on cross-site PUT", async () => {
    const sess = await makeSession(userA);
    const req = cookieReq("http://localhost/api/v1/account/payout-wallet", sess.jwt, {
      method: "PUT",
      body: { wallet: GOOD_LOWER },
      origin: false,
    });
    req.headers.set("origin", "https://evil.com");
    req.headers.set("sec-fetch-site", "cross-site");
    const res = await walletRoute.PUT(req);
    assert.equal(res.status, 403);
    assert.equal((await res.json()).code, "forbidden_origin");
  });

  it("reauth_required when session older than 15 min", async () => {
    const sess = await makeSession(userA);
    getDb().prepare("UPDATE sessions SET created_at = ? WHERE token = ?").run(new Date(Date.now() - 20 * 60_000).toISOString(), sess.token);
    const res = await walletRoute.PUT(cookieReq("http://localhost/api/v1/account/payout-wallet", sess.jwt, { method: "PUT", body: { wallet: GOOD_LOWER } }));
    assert.equal(res.status, 403);
    assert.equal((await res.json()).code, "reauth_required");
  });

  it("invalid / zero / bad-checksum -> 400", async () => {
    const sess = await makeSession(userA);
    for (const w of ["not-an-address", "0x0000000000000000000000000000000000000000", "0x2EB9104AEeF7270fe639Bf1965B94Bfb8Edcf787"]) {
      const res = await walletRoute.PUT(cookieReq("http://localhost/api/v1/account/payout-wallet", sess.jwt, { method: "PUT", body: { wallet: w } }));
      assert.equal(res.status, 400, w);
      assert.equal((await res.json()).code, "invalid_wallet");
    }
  });

  it("valid lowercase -> stored checksummed + event + GET", async () => {
    const sess = await makeSession(userA);
    const res = await walletRoute.PUT(cookieReq("http://localhost/api/v1/account/payout-wallet", sess.jwt, { method: "PUT", body: { wallet: GOOD_LOWER } }));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.wallet, GOOD_CHECKSUMMED);
    assert.equal(body.chain, "Base");
    assert.equal(body.asset, "USDC");
    assert.equal(body.min_payout_usd, 1);
    assert.equal(getAccountPayoutWallet(userA).wallet, GOOD_CHECKSUMMED);
    const ev = getDb().prepare("SELECT type, detail FROM account_events WHERE user_id = ? ORDER BY id DESC LIMIT 1").get(userA) as any;
    assert.equal(ev.type, "payout_wallet_changed");
    assert.deepEqual(JSON.parse(ev.detail), { from: null, to: GOOD_CHECKSUMMED });
    const g = await walletRoute.GET(cookieReq("http://localhost/api/v1/account/payout-wallet", sess.jwt));
    assert.equal((await g.json()).wallet, GOOD_CHECKSUMMED);
  });

  it("lib setter writes event with full {from,to}", () => {
    const s = setAccountPayoutWallet(userA, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", { ip: "1.2.3.4" });
    assert.equal(s.wallet, "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913");
    const ev = getDb().prepare("SELECT type, detail FROM account_events WHERE user_id = ? ORDER BY id DESC LIMIT 1").get(userA) as any;
    assert.deepEqual(JSON.parse(ev.detail), { from: GOOD_CHECKSUMMED, to: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" });
  });
});

describe("sanitize + old endpoint", () => {
  it("sanitizeProvider drops secrets", () => {
    const clean = sanitizeProvider({
      id: "n",
      public_key: "pk",
      payout_wallet: "0xabc",
      owner_user_id: "u",
      user_id: "u",
      token_id: "t",
      node_token: "sipn_x",
      authorization: "Bearer x",
      awaiting_heartbeat: true,
      status: "serving",
      last_heartbeat: new Date().toISOString(),
    } as any);
    for (const k of ["public_key", "payout_wallet", "owner_user_id", "user_id", "token_id", "node_token", "authorization", "awaiting_heartbeat"]) {
      assert.ok(!(k in clean), k);
    }
  });

  it("old endpoint -> 410 moved", async () => {
    const g = await oldWalletRoute.GET(new Request("http://localhost/api/v1/providers/payout-wallet"));
    assert.equal(g.status, 410);
    assert.equal((await g.json()).code, "moved");
    const p = await oldWalletRoute.POST(new Request("http://localhost/api/v1/providers/payout-wallet", { method: "POST" }));
    assert.equal(p.status, 410);
    assert.match((await p.json()).error, /provider\/portal/);
  });
});

describe("persistence + export + delete", () => {
  it("mirror row written; restart hydrates awaiting_heartbeat, not routable until fresh heartbeat", async () => {
    const mirrored = getDb().prepare("SELECT payload FROM providers_mirror WHERE id = ?").get("node-1") as any;
    assert.ok(mirrored, "mirror row written");
    store.clearAll();
    store.__resetHydrationForTests();
    const n = store.hydrateProvidersFromMirror();
    assert.ok(n >= 1);
    const h = store.getProvider("node-1")!;
    assert.equal(h.awaiting_heartbeat, true);
    h.verification.status = "verified";
    assert.equal(selectProvider([h] as any), null);
    const fresh = createNodeToken(userB, "rehydrate") as any;
    const res = await hbPost(hbReq({ id: "node-1" }, fresh.secret));
    assert.equal(res.status, 200);
    assert.equal(store.getProvider("node-1")!.awaiting_heartbeat, false);
  });

  it("bindNode race: second user loses", () => {
    assert.deepEqual(bindNode("node-1", userA, "ntk_deadbeefdeadbeef"), { ok: false, code: "node_owned_by_another_account" });
  });

  it("export has tokens without hashes; delete cascades", () => {
    const exp = exportUserData(userB) as any;
    assert.ok(exp);
    assert.ok(Array.isArray(exp.node_tokens));
    assert.ok(!JSON.stringify(exp.node_tokens).includes("token_hash"));
    assert.ok(exp.user.payout_wallet !== undefined);
    assert.ok(Array.isArray(exp.nodes) && exp.nodes.length > 0);
    assert.ok(Array.isArray(exp.account_events));
    assert.ok(deleteAccount(userC));
    assert.equal((getDb().prepare("SELECT count(*) AS c FROM provider_tokens WHERE user_id = ?").get(userC) as any).c, 0);
    assert.equal((getDb().prepare("SELECT count(*) AS c FROM provider_nodes WHERE user_id = ?").get(userC) as any).c, 0);
    assert.equal((getDb().prepare("SELECT count(*) AS c FROM account_events WHERE user_id = ?").get(userC) as any).c, 0);
  });

  it("account nodes route returns only caller's nodes, no IPs", async () => {
    const sess = await makeSession(userB);
    const res = await nodesRoute.GET(cookieReq("http://localhost/api/v1/account/nodes", sess.jwt));
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(body.nodes.some((n: any) => n.id === "node-1"));
    for (const n of body.nodes) {
      assert.ok(!("ip" in n) && !("agent_url" in n));
      assert.ok("token_prefix" in n);
    }
  });

  it("node-tokens GET never leaks hashes; DELETE idempotent", async () => {
    const sess = await makeSession(userB);
    const list = await tokensRoute.GET(cookieReq("http://localhost/api/v1/account/node-tokens", sess.jwt));
    const body = await list.json();
    assert.ok(!JSON.stringify(body).includes("token_hash"));
    const someId = body.tokens[0]?.id as string;
    const mkDel = () => tokenDelRoute.DELETE(cookieReq("http://localhost/x", sess.jwt, { method: "DELETE" }), { params: Promise.resolve({ id: someId }) });
    assert.equal((await mkDel()).status, 200);
    assert.equal((await mkDel()).status, 200);
    const foreign = await tokenDelRoute.DELETE(cookieReq("http://localhost/x", sess.jwt, { method: "DELETE" }), { params: Promise.resolve({ id: "ntk_ffffffffffffffff" }) });
    assert.equal(foreign.status, 404);
  });
});
