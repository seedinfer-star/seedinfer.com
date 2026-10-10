/**
 * tests/routing-phase1-leaf.test.ts — leaf modules: node-targets, affinity, lease.
 * Run: npx tsx --test tests/routing-phase1-leaf.test.ts
 */
import { describe, it, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  __setAllowLoopbackForTests,
  isAllowLoopbackForTests,
  isTailnetIpv4,
  assertNodeUrl,
  resolveNodeChatUrl,
} from "@/lib/routing/node-targets";
import {
  decideAffinity,
  recordAffinity,
  lookupAffinity,
  resetAffinity,
  affinitySize,
  hashPrincipal,
  __setAffinityRecordForTests,
} from "@/lib/routing/affinity";
import {
  acquireLease,
  getLeaseCounters,
  listLeases,
  leaseCount,
  resetLeases,
} from "@/lib/routing/lease";

const ENV_KEYS = [
  "ROUTING_EXTRA_NODE_PORTS",
  "AFFINITY_TTL_MS",
  "AFFINITY_MIN_TOKENS",
  "AFFINITY_EVICT_FRAC",
] as const;

function snapshotEnv(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const k of ENV_KEYS) out[k] = process.env[k];
  return out;
}

function restoreEnv(saved: Record<string, string | undefined>): void {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
}

beforeEach(() => {
  resetAffinity();
  resetLeases();
});

after(() => {
  for (const k of ENV_KEYS) delete process.env[k];
  __setAllowLoopbackForTests(false);
  resetAffinity();
  resetLeases();
});

describe("node-targets: isTailnetIpv4", () => {
  it("accepts 100.64.0.0/10 boundaries and interior", () => {
    assert.equal(isTailnetIpv4("100.64.0.0"), true);
    assert.equal(isTailnetIpv4("100.64.1.2"), true);
    assert.equal(isTailnetIpv4("100.100.5.5"), true);
    assert.equal(isTailnetIpv4("100.127.255.255"), true);
  });

  it("rejects outside the /10 range and non-IPv4", () => {
    assert.equal(isTailnetIpv4("8.8.8.8"), false);
    assert.equal(isTailnetIpv4("100.63.255.255"), false);
    assert.equal(isTailnetIpv4("100.128.0.1"), false);
    assert.equal(isTailnetIpv4("101.64.0.1"), false);
    assert.equal(isTailnetIpv4("127.0.0.1"), false);
    assert.equal(isTailnetIpv4("not-a-host"), false);
    assert.equal(isTailnetIpv4("100.64.0"), false);
    assert.equal(isTailnetIpv4("999.999.999.999"), false);
  });
});

describe("node-targets: assertNodeUrl", () => {
  it("rejects public IP and loopback by default", () => {
    __setAllowLoopbackForTests(false);
    assert.throws(() => assertNodeUrl("http://8.8.8.8:47901/v1"), /invalid node url/);
    assert.throws(() => assertNodeUrl("https://example.com:47901/"), /invalid node url/);
    assert.throws(() => assertNodeUrl("http://127.0.0.1:47901/"), /loopback/);
  });

  it("allows tailnet IPv4 on 47901 and ts.net hosts", () => {
    __setAllowLoopbackForTests(false);
    const ok = assertNodeUrl("http://100.90.5.5:47901/v1/chat");
    assert.ok(ok.includes("100.90.5.5"));
    const ts = assertNodeUrl("http://gpu-1.seedinfer.ts.net:3001/openai");
    assert.ok(ts.includes("seedinfer.ts.net"));
  });

  it("rejects userinfo URLs", () => {
    assert.throws(() => assertNodeUrl("http://user:pass@100.64.0.1:47901/v1"), /userinfo/);
    assert.throws(() => assertNodeUrl("http://user@100.64.0.1:47901/"), /userinfo/);
  });

  it("rejects missing/disallowed ports and non-http protocols", () => {
    assert.throws(() => assertNodeUrl("http://100.64.0.1/v1"), /port/);
    assert.throws(() => assertNodeUrl("http://100.64.0.1:9999/"), /port/);
    assert.throws(() => assertNodeUrl("ftp://100.64.0.1:47901/"), /protocol/);
  });

  it("honours ROUTING_EXTRA_NODE_PORTS read at call time", () => {
    const saved = snapshotEnv();
    try {
      delete process.env.ROUTING_EXTRA_NODE_PORTS;
      assert.throws(() => assertNodeUrl("http://100.64.0.1:48000/"), /port/);
      process.env.ROUTING_EXTRA_NODE_PORTS = "48000";
      const ok = assertNodeUrl("http://100.64.0.1:48000/");
      assert.ok(ok.includes(":48000"));
    } finally {
      restoreEnv(saved);
    }
  });

  it("allows loopback only via __setAllowLoopbackForTests", () => {
    try {
      __setAllowLoopbackForTests(true);
      assert.equal(isAllowLoopbackForTests(), true);
      const ok = assertNodeUrl("http://127.0.0.1:47901/");
      assert.ok(ok.includes("127.0.0.1"));
    } finally {
      __setAllowLoopbackForTests(false);
    }
    assert.equal(isAllowLoopbackForTests(), false);
    assert.throws(() => assertNodeUrl("http://127.0.0.1:47901/"), /loopback/);
  });
});

describe("node-targets: resolveNodeChatUrl", () => {
  it("prefers tailscale_ip over agent_url", () => {
    const url = resolveNodeChatUrl({
      id: "n1",
      tailscale_ip: "100.64.1.2",
      agent_url: "http://node9.seedinfer.ts.net:47901/",
    });
    assert.equal(url, "http://100.64.1.2:47901/v1/chat/completions");
  });

  it("never returns ports 47900/8000", () => {
    const saved = snapshotEnv();
    try {
      process.env.ROUTING_EXTRA_NODE_PORTS = "47900,8000";
      const a = resolveNodeChatUrl({ id: "n2a", agent_url: "http://100.64.0.5:47900/v1" });
      assert.ok(a !== null && a.includes(":47901"), `got ${a}`);
      assert.ok(!a!.includes(":47900"));
      const b = resolveNodeChatUrl({ id: "n2b", agent_url: "http://100.64.0.6:8000/v1" });
      assert.ok(b !== null && b.includes(":47901"), `got ${b}`);
      assert.ok(!b!.includes(":8000"));
    } finally {
      restoreEnv(saved);
    }
  });

  it("uses agent_url ts.net host and keeps allowed port", () => {
    const url = resolveNodeChatUrl({
      id: "n3",
      agent_url: "http://gpu-1.seedinfer.ts.net:3001/openai",
    });
    assert.equal(url, "http://gpu-1.seedinfer.ts.net:3001/v1/chat/completions");
  });

  it("falls back to agent_url when tailscale_ip is a public IP", () => {
    const url = resolveNodeChatUrl({
      id: "n4",
      tailscale_ip: "8.8.8.8",
      agent_url: "http://gpu-2.seedinfer.ts.net:47901/",
    });
    assert.equal(url, "http://gpu-2.seedinfer.ts.net:47901/v1/chat/completions");
  });

  it("returns null when nothing usable is present", () => {
    assert.equal(resolveNodeChatUrl({ id: "" }), null);
    assert.equal(resolveNodeChatUrl({ id: "n5", agent_url: "http://8.8.8.8:47901/" }), null);
    assert.equal(resolveNodeChatUrl({ id: "n6" }), null);
  });

  it("resolves loopback tailscale_ip only with the test hook on", () => {
    try {
      __setAllowLoopbackForTests(false);
      assert.equal(resolveNodeChatUrl({ id: "n7", tailscale_ip: "127.0.0.1" }), null);
      __setAllowLoopbackForTests(true);
      assert.equal(
        resolveNodeChatUrl({ id: "n7", tailscale_ip: "127.0.0.1" }),
        "http://127.0.0.1:47901/v1/chat/completions",
      );
    } finally {
      __setAllowLoopbackForTests(false);
    }
  });
});

describe("affinity", () => {
  it("below_threshold wins even with a record present", () => {
    const saved = snapshotEnv();
    try {
      delete process.env.AFFINITY_MIN_TOKENS;
      const d = decideAffinity({
        key: "k-below",
        incomingPromptTokens: 10,
        poolP: 100000,
        processedNow: 0,
        activeNow: 0,
        record: { nodeId: "n", snapshot: 0, lastReqTokens: 1, lastSeenAt: Date.now() },
      });
      assert.deepEqual(d, { stick: false, reason: "below_threshold" });
    } finally {
      restoreEnv(saved);
    }
  });

  it("no_record when incoming is above threshold but no record exists", () => {
    const d = decideAffinity({
      key: "k-missing",
      incomingPromptTokens: 9000,
      poolP: 100000,
      processedNow: 0,
      activeNow: 0,
      record: undefined,
    });
    assert.deepEqual(d, { stick: false, reason: "no_record" });
  });

  it("evicted deletes the record from the store", () => {
    const saved = snapshotEnv();
    try {
      delete process.env.AFFINITY_EVICT_FRAC;
      __setAffinityRecordForTests("k-evict", {
        nodeId: "n",
        snapshot: 0,
        lastReqTokens: 10,
        lastSeenAt: Date.now(),
      });
      const d = decideAffinity({
        key: "k-evict",
        incomingPromptTokens: 9000,
        poolP: 10000,
        processedNow: 9000,
        activeNow: 0,
        record: lookupAffinity("k-evict"),
      });
      assert.deepEqual(d, { stick: false, reason: "evicted" });
      assert.equal(lookupAffinity("k-evict"), undefined);
    } finally {
      restoreEnv(saved);
    }
  });

  it("overflow keeps the record in the store", () => {
    __setAffinityRecordForTests("k-over", {
      nodeId: "n",
      snapshot: 0,
      lastReqTokens: 1000,
      lastSeenAt: Date.now(),
    });
    const d = decideAffinity({
      key: "k-over",
      incomingPromptTokens: 9000,
      poolP: 10000,
      processedNow: 1000,
      activeNow: 0,
      record: lookupAffinity("k-over"),
    });
    assert.deepEqual(d, { stick: false, reason: "overflow" });
    assert.notEqual(lookupAffinity("k-over"), undefined);
  });

  it("hit when drift + history + incoming fits in the pool", () => {
    __setAffinityRecordForTests("k-hit", {
      nodeId: "n",
      snapshot: 0,
      lastReqTokens: 500,
      lastSeenAt: Date.now(),
    });
    const d = decideAffinity({
      key: "k-hit",
      incomingPromptTokens: 9000,
      poolP: 100000,
      processedNow: 1000,
      activeNow: 0,
      record: lookupAffinity("k-hit"),
    });
    assert.deepEqual(d, { stick: true, reason: "hit" });
  });

  it("clamps D at zero when snapshot is ahead of processed+active", () => {
    __setAffinityRecordForTests("k-clamp", {
      nodeId: "n",
      snapshot: 5000,
      lastReqTokens: 100,
      lastSeenAt: Date.now(),
    });
    const d = decideAffinity({
      key: "k-clamp",
      incomingPromptTokens: 9000,
      poolP: 100000,
      processedNow: 100,
      activeNow: 100,
      record: lookupAffinity("k-clamp"),
    });
    assert.deepEqual(d, { stick: true, reason: "hit" });
  });

  it("hashPrincipal returns 16 lowercase hex chars, deterministic and distinct", () => {
    const a = hashPrincipal("user-1");
    const b = hashPrincipal("user-1");
    const c = hashPrincipal("user-2");
    assert.match(a, /^[0-9a-f]{16}$/);
    assert.equal(a, b);
    assert.notEqual(a, c);
  });

  it("TTL expiry lazily sweeps stale records without sleeping", () => {
    const saved = snapshotEnv();
    try {
      process.env.AFFINITY_TTL_MS = "100";
      recordAffinity("k-ttl", "n", 0, 0, Date.now() - 1000);
      assert.equal(lookupAffinity("k-ttl"), undefined);
      assert.equal(affinitySize(), 0);
    } finally {
      restoreEnv(saved);
      resetAffinity();
    }
  });

  it("AFFINITY_MIN_TOKENS is read at call time (capped by 8192)", () => {
    const saved = snapshotEnv();
    try {
      process.env.AFFINITY_MIN_TOKENS = "100";
      const below = decideAffinity({
        key: "k-min",
        incomingPromptTokens: 50,
        poolP: 100000,
        processedNow: 0,
        activeNow: 0,
        record: undefined,
      });
      assert.deepEqual(below, { stick: false, reason: "below_threshold" });
      const above = decideAffinity({
        key: "k-min",
        incomingPromptTokens: 150,
        poolP: 100000,
        processedNow: 0,
        activeNow: 0,
        record: undefined,
      });
      assert.deepEqual(above, { stick: false, reason: "no_record" });
    } finally {
      restoreEnv(saved);
    }
  });

  it("recordAffinity/lookupAffinity roundtrip, size and reset", () => {
    assert.equal(affinitySize(), 0);
    recordAffinity("k-rt", "node-9", 42, 7);
    const rec = lookupAffinity("k-rt");
    assert.equal(rec?.nodeId, "node-9");
    assert.equal(rec?.snapshot, 42);
    assert.equal(rec?.lastReqTokens, 7);
    assert.equal(affinitySize(), 1);
    resetAffinity();
    assert.equal(affinitySize(), 0);
  });
});

describe("lease", () => {
  it("acquire then release is idempotent", () => {
    const l = acquireLease("node-A", 100);
    assert.ok(typeof l.id === "string" && l.id.length > 0);
    assert.equal(l.nodeId, "node-A");
    assert.equal(l.tokens, 100);
    assert.equal(leaseCount(), 1);
    l.release();
    assert.equal(leaseCount(), 0);
    l.release();
    assert.equal(leaseCount(), 0);
  });

  it("tracks per-node counters separately", () => {
    const a1 = acquireLease("node-A", 100);
    const a2 = acquireLease("node-A", 200);
    const b1 = acquireLease("node-B", 50);
    assert.deepEqual(getLeaseCounters("node-A"), { inFlight: 2, activeKv: 300 });
    assert.deepEqual(getLeaseCounters("node-B"), { inFlight: 1, activeKv: 50 });
    assert.deepEqual(getLeaseCounters("node-unknown"), { inFlight: 0, activeKv: 0 });
    a1.release();
    assert.deepEqual(getLeaseCounters("node-A"), { inFlight: 1, activeKv: 200 });
    a2.release();
    b1.release();
    assert.deepEqual(getLeaseCounters("node-A"), { inFlight: 0, activeKv: 0 });
  });

  it("list/count/reset behave consistently", () => {
    assert.equal(leaseCount(), 0);
    assert.deepEqual(listLeases(), []);
    const l1 = acquireLease("node-X", 10);
    const l2 = acquireLease("node-Y", 20);
    assert.equal(leaseCount(), 2);
    const listed = listLeases();
    assert.equal(listed.length, 2);
    assert.deepEqual(
      listed.map((l) => l.id).sort(),
      [l1.id, l2.id].sort(),
    );
    resetLeases();
    assert.equal(leaseCount(), 0);
    assert.deepEqual(listLeases(), []);
    assert.deepEqual(getLeaseCounters("node-X"), { inFlight: 0, activeKv: 0 });
  });
});
