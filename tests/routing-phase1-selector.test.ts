/**
 * tests/routing-phase1-selector.test.ts — selector over shared filter + lease + node-health.
 * Run: npx tsx --test tests/routing-phase1-selector.test.ts
 */
import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import {
  selectProvider,
  getSortedProviders,
  selectNodeDetailed,
  resetRouting,
  getSafeMaxConcurrency,
} from "@/lib/routing/selector";
import {
  resetNodeHealth,
  getNodeSnapshot,
  recordNodeOutcome,
} from "@/lib/routing/node-health";
import { acquireLease, resetLeases } from "@/lib/routing/lease";

const ENV_KEYS = [
  "ROUTING_HEARTBEAT_MAX_AGE_MS",
  "ROUTING_MAX_CANDIDATES",
  "ROUTING_ALGORITHM",
  "NODE_FAIL_THRESHOLD",
  "NODE_CONNECT_THRESHOLD",
  "NODE_COOLDOWN_MS",
  "NODE_COOLDOWN_MAX_MS",
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

const savedEnv = snapshotEnv();

function mkNode(id: string, overrides: Record<string, any> = {}): any {
  return {
    id,
    verification: { status: "verified" },
    awaiting_heartbeat: false,
    last_heartbeat: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  resetRouting();
  resetNodeHealth();
  resetLeases();
  for (const k of ENV_KEYS) delete process.env[k];
});

after(() => {
  resetRouting();
  resetNodeHealth();
  resetLeases();
  restoreEnv(savedEnv);
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("selector: stale heartbeat excluded", () => {
  it("last_heartbeat older than max age is unroutable", () => {
    const stale = mkNode("stale-1", {
      last_heartbeat: new Date(Date.now() - 200_000).toISOString(),
    });
    assert.equal(selectProvider([stale] as any), null);
    assert.deepEqual(getSortedProviders([stale] as any), []);
    const d = selectNodeDetailed([stale] as any);
    assert.ok("none" in d);
    if ("none" in d) assert.equal(d.reason, "all_unhealthy");
  });

  it("fresh heartbeat is routable", () => {
    const fresh = mkNode("fresh-1");
    const sel = selectProvider([fresh] as any) as any;
    assert.equal(sel?.id, "fresh-1");
  });
});

describe("selector: saturated nodes excluded (lease counters)", () => {
  it("inFlight >= safeMax excludes the node", () => {
    const n = mkNode("sat-1");
    const safeMax = getSafeMaxConcurrency(n);
    const leases = [];
    for (let i = 0; i < safeMax; i++) leases.push(acquireLease("sat-1", 10));
    try {
      assert.equal(selectProvider([n] as any), null);
      assert.deepEqual(getSortedProviders([n] as any), []);
      const d = selectNodeDetailed([n] as any);
      assert.ok("none" in d);
      if ("none" in d) assert.equal(d.reason, "all_saturated");
    } finally {
      for (const l of leases) l.release();
    }
  });

  it("saturated node loses to a free node", () => {
    const full = mkNode("sat-2");
    const free = mkNode("free-2");
    const safeMax = getSafeMaxConcurrency(full);
    const leases = [];
    for (let i = 0; i < safeMax; i++) leases.push(acquireLease("sat-2", 10));
    try {
      const sel = selectProvider([full, free] as any) as any;
      assert.equal(sel?.id, "free-2");
      assert.deepEqual(
        getSortedProviders([full, free] as any).map((p: any) => p.id),
        ["free-2"],
      );
    } finally {
      for (const l of leases) l.release();
    }
  });
});

describe("selector: node-health paused excluded", () => {
  it("saturated outcome pauses the node out of routing", () => {
    const n = mkNode("paused-1");
    assert.equal((selectProvider([n] as any) as any)?.id, "paused-1");
    recordNodeOutcome("paused-1", { kind: "saturated", retryAfterMs: 5000, error: "busy" });
    assert.equal(selectProvider([n] as any), null);
    assert.deepEqual(getSortedProviders([n] as any), []);
    const d = selectNodeDetailed([n] as any);
    assert.ok("none" in d);
    if ("none" in d) {
      assert.equal(d.reason, "all_unhealthy");
      assert.ok(
        typeof d.retryAfterMs === "number" && d.retryAfterMs >= 1000 && d.retryAfterMs <= 30000,
        `retryAfterMs=${d.retryAfterMs}`,
      );
    }
  });
});

describe("selector: half-open trial claimable", () => {
  it("expired circuit is selected once and trial claimed", async () => {
    process.env.NODE_COOLDOWN_MS = "50";
    const n = mkNode("half-1");
    for (let i = 0; i < 5; i++) recordNodeOutcome("half-1", { kind: "timeout", error: "e" });
    assert.equal(getNodeSnapshot("half-1").circuit, "open");
    assert.equal(selectProvider([n] as any), null);
    await sleep(80);
    const d = selectNodeDetailed([n] as any);
    assert.ok("node" in d, `expected node, got ${JSON.stringify(d)}`);
    if ("node" in d) assert.equal((d.node as any).id, "half-1");
    assert.equal(getNodeSnapshot("half-1").trialInFlight, true);
  });
});

describe("selector: exclude set", () => {
  it("exclude skips the node", () => {
    const a = mkNode("ex-a");
    const b = mkNode("ex-b");
    const sel = selectProvider([a, b] as any) as any;
    assert.ok(sel && (sel.id === "ex-a" || sel.id === "ex-b"));
    const onlyB = selectNodeDetailed([a, b] as any, { exclude: new Set(["ex-a"]) });
    assert.ok("node" in onlyB);
    if ("node" in onlyB) assert.equal((onlyB.node as any).id, "ex-b");
    const sorted = getSortedProviders([a, b] as any, { exclude: new Set(["ex-b"]) }).map(
      (p: any) => p.id,
    );
    assert.deepEqual(sorted, ["ex-a"]);
  });
});

describe("selector: selectNodeDetailed reasons", () => {
  it("no_nodes when zero providers", () => {
    const d = selectNodeDetailed([]);
    assert.ok("none" in d);
    if ("none" in d) assert.equal(d.reason, "no_nodes");
  });

  it("all_unhealthy when all circuit-open", () => {
    const a = mkNode("unh-a");
    const b = mkNode("unh-b");
    for (const id of ["unh-a", "unh-b"]) {
      for (let i = 0; i < 5; i++) recordNodeOutcome(id, { kind: "timeout", error: "e" });
    }
    const d = selectNodeDetailed([a, b] as any);
    assert.ok("none" in d);
    if ("none" in d) {
      assert.equal(d.reason, "all_unhealthy");
      assert.ok(
        typeof d.retryAfterMs === "number" && d.retryAfterMs >= 1000 && d.retryAfterMs <= 30000,
        `retryAfterMs=${d.retryAfterMs}`,
      );
    }
  });

  it("all_saturated when all full", () => {
    const a = mkNode("full-a");
    const b = mkNode("full-b");
    const leases = [];
    for (const id of ["full-a", "full-b"]) {
      const safeMax = getSafeMaxConcurrency(mkNode(id));
      for (let i = 0; i < safeMax; i++) leases.push(acquireLease(id, 10));
    }
    try {
      const d = selectNodeDetailed([a, b] as any);
      assert.ok("none" in d);
      if ("none" in d) assert.equal(d.reason, "all_saturated");
    } finally {
      for (const l of leases) l.release();
    }
  });
});

describe("selector: legacy compat", () => {
  it("awaiting_heartbeat never routes (routing-hardening contract)", () => {
    const legacy = [{ id: "legacy-no-verification", awaiting_heartbeat: true } as any];
    assert.equal(selectProvider(legacy), null);
    assert.deepEqual(getSortedProviders(legacy), []);
    const verifiedAwaiting = mkNode("legacy-verified", { awaiting_heartbeat: true });
    assert.equal(selectProvider([verifiedAwaiting] as any), null);
  });

  it("explicit non-ok vllm_health excludes", () => {
    const bad = mkNode("vllm-bad", { vllm_health: { status: "error" } });
    assert.equal(selectProvider([bad] as any), null);
    const ok = mkNode("vllm-ok", { vllm_health: { status: "ok" } });
    assert.equal((selectProvider([ok] as any) as any)?.id, "vllm-ok");
  });
});
