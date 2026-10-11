/**
 * tests/routing-node-health.test.ts — per-node circuit-breaker + EWMA health.
 * Run: npx tsx --test tests/routing-node-health.test.ts
 */
import { describe, it, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import {
  resetNodeHealth,
  getNodeSnapshot,
  canAttempt,
  claimTrial,
  releaseTrial,
  recordNodeOutcome,
  addInFlight,
  removeInFlight,
  bumpProcessed,
} from "@/lib/routing/node-health";

const ENV_KEYS = [
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

function clearEnv(): void {
  for (const k of ENV_KEYS) delete process.env[k];
}

beforeEach(() => {
  resetNodeHealth();
  clearEnv();
});

after(() => {
  resetNodeHealth();
  clearEnv();
});

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("open after 5 fails", () => {
  it("opens circuit on 5 consecutive timeouts", () => {
    for (let i = 0; i < 4; i++) {
      recordNodeOutcome("n5", { kind: "timeout", error: `t${i}` });
      assert.equal(getNodeSnapshot("n5").circuit, "closed");
    }
    recordNodeOutcome("n5", { kind: "timeout", error: "t4" });
    const snap = getNodeSnapshot("n5");
    assert.equal(snap.circuit, "open");
    assert.equal(snap.circuitOpen, true);
    assert.equal(snap.available, false);
    assert.equal(snap.consecutiveFails, 5);
    const attempt = canAttempt("n5");
    assert.equal(attempt.ok, false);
    if (!attempt.ok) assert.equal(attempt.reason, "circuit_open");
  });
});

describe("2 consecutive connects open", () => {
  it("opens on 2 connects even below fail threshold", () => {
    recordNodeOutcome("nc", { kind: "connect", error: "refused" });
    assert.equal(getNodeSnapshot("nc").circuit, "closed");
    recordNodeOutcome("nc", { kind: "connect", error: "refused2" });
    const snap = getNodeSnapshot("nc");
    assert.equal(snap.circuit, "open");
    assert.equal(snap.consecutiveConnectFails, 2);
    assert.equal(snap.circuitOpen, true);
  });
});

describe("claimTrial single-flight", () => {
  it("second claim false while live trial", async () => {
    process.env.NODE_COOLDOWN_MS = "50";
    for (let i = 0; i < 5; i++) recordNodeOutcome("nt", { kind: "timeout", error: "x" });
    assert.equal(getNodeSnapshot("nt").circuit, "open");
    await sleep(70);
    const c = canAttempt("nt");
    assert.equal(c.ok, true);
    assert.equal(claimTrial("nt"), true);
    assert.equal(claimTrial("nt"), false);
    const snap = getNodeSnapshot("nt");
    assert.equal(snap.trialInFlight, true);
    assert.equal(snap.available, false);
    const c2 = canAttempt("nt");
    assert.equal(c2.ok, false);
    if (!c2.ok) assert.equal(c2.reason, "trial_in_flight");
  });
});

describe("ok closes+resets+EWMA", () => {
  it("resets counters, closes circuit, feeds EWMA and tokens", () => {
    for (let i = 0; i < 3; i++) recordNodeOutcome("no", { kind: "timeout", error: "e" });
    assert.equal(getNodeSnapshot("no").consecutiveFails, 3);
    recordNodeOutcome("no", {
      kind: "ok",
      ttftMs: 200,
      totalMs: 800,
      promptTokens: 10,
      completionTokens: 20,
    });
    const snap = getNodeSnapshot("no");
    assert.equal(snap.circuit, "closed");
    assert.equal(snap.consecutiveFails, 0);
    assert.equal(snap.consecutiveConnectFails, 0);
    assert.equal(snap.openCount, 0);
    assert.equal(snap.totalRequests, 4);
    assert.equal(snap.successCount, 1);
    assert.equal(snap.ewmaTtft.get(), 200);
    assert.equal(snap.ewmaLatency.get(), 800);
    assert.equal(snap.totalProcessedTokens, 30);
    assert.equal(snap.lastError, null);
    assert.equal(snap.trialInFlight, false);
  });

  it("non-stream ok with only totalMs updates latency only", () => {
    recordNodeOutcome("ns", { kind: "ok", totalMs: 500 });
    const snap = getNodeSnapshot("ns");
    assert.equal(snap.ewmaTtft.get(), null);
    assert.equal(snap.ewmaLatency.get(), 500);
  });
});

describe("saturated pauses w/o fail count and releases trial", () => {
  it("pauses, clears connect counter + trial, no fail/total bumps", async () => {
    process.env.NODE_COOLDOWN_MS = "50";
    for (let i = 0; i < 5; i++) recordNodeOutcome("nsat", { kind: "timeout", error: "e" });
    await sleep(70);
    assert.equal(canAttempt("nsat").ok, true);
    assert.equal(claimTrial("nsat"), true);
    assert.equal(getNodeSnapshot("nsat").trialInFlight, true);
    const before = getNodeSnapshot("nsat");
    recordNodeOutcome("nsat", { kind: "saturated", retryAfterMs: 2000, error: "busy" });
    const afterSnap = getNodeSnapshot("nsat");
    assert.ok(afterSnap.pausedUntil > Date.now());
    assert.equal(afterSnap.consecutiveFails, before.consecutiveFails);
    assert.equal(afterSnap.totalRequests, before.totalRequests);
    assert.equal(afterSnap.consecutiveConnectFails, 0);
    assert.equal(afterSnap.trialInFlight, false);
    assert.equal(afterSnap.lastPauseReason, "busy");
    assert.equal(afterSnap.available, false);
    const c = canAttempt("nsat");
    assert.equal(c.ok, false);
    if (!c.ok) assert.equal(c.reason, "paused");
  });

  it("clamps retryAfterMs to [1000,10000]", () => {
    recordNodeOutcome("ncl", { kind: "saturated", retryAfterMs: 100 });
    const lo = getNodeSnapshot("ncl").pausedUntil - Date.now();
    assert.ok(lo >= 900 && lo <= 1100, `lo=${lo}`);
    resetNodeHealth("ncl");
    recordNodeOutcome("ncl", { kind: "saturated", retryAfterMs: 99999 });
    const hi = getNodeSnapshot("ncl").pausedUntil - Date.now();
    assert.ok(hi >= 9900 && hi <= 10100, `hi=${hi}`);
  });
});

describe("cooldown doubling", () => {
  it("second cooldown is ~2x first with small NODE_COOLDOWN_MS", async () => {
    process.env.NODE_COOLDOWN_MS = "50";
    process.env.NODE_COOLDOWN_MAX_MS = "100000";
    for (let i = 0; i < 5; i++) recordNodeOutcome("nd", { kind: "timeout", error: "e" });
    const first = getNodeSnapshot("nd");
    const firstCd = first.openUntil - Date.now();
    assert.ok(firstCd > 0 && firstCd <= 60, `first=${firstCd}`);
    await sleep(70);
    assert.equal(canAttempt("nd").ok, true);
    assert.equal(claimTrial("nd"), true);
    recordNodeOutcome("nd", { kind: "timeout", error: "again" });
    const second = getNodeSnapshot("nd");
    assert.equal(second.circuit, "open");
    const secondCd = second.openUntil - Date.now();
    assert.ok(secondCd > 60 && secondCd <= 120, `second=${secondCd}`);
    assert.equal(second.openCount, 2);
  });
});

describe("probe_connect increments fails but not totalRequests", () => {
  it("fails++ without totalRequests++", () => {
    recordNodeOutcome("npc", { kind: "probe_connect", error: "refused" });
    const snap = getNodeSnapshot("npc");
    assert.equal(snap.consecutiveFails, 1);
    assert.equal(snap.consecutiveConnectFails, 1);
    assert.equal(snap.totalRequests, 0);
    assert.equal(snap.lastError, "refused");
  });
});

describe("probe_ok seeds null EWMA and closes half-open", () => {
  it("seeds only null EWMA, resets counters, closes circuit", async () => {
    process.env.NODE_COOLDOWN_MS = "50";
    for (let i = 0; i < 5; i++) recordNodeOutcome("np", { kind: "timeout", error: "e" });
    assert.equal(getNodeSnapshot("np").circuit, "open");
    await sleep(70);
    assert.equal(canAttempt("np").ok, true);
    assert.equal(claimTrial("np"), true);
    recordNodeOutcome("np", { kind: "probe_ok", ttftMs: 300, totalMs: 900 });
    const snap = getNodeSnapshot("np");
    assert.equal(snap.circuit, "closed");
    assert.equal(snap.consecutiveFails, 0);
    assert.equal(snap.totalRequests, 5);
    assert.equal(snap.successCount, 0);
    assert.equal(snap.ewmaTtft.get(), 300);
    assert.equal(snap.ewmaLatency.get(), 900);
    assert.ok(typeof snap.lastProbeOk === "number");
    // second probe_ok must NOT overwrite seeded EWMA
    recordNodeOutcome("np", { kind: "probe_ok", ttftMs: 999, totalMs: 9999 });
    const snap2 = getNodeSnapshot("np");
    assert.equal(snap2.ewmaTtft.get(), 300);
    assert.equal(snap2.ewmaLatency.get(), 900);
  });
});

describe("neutral kinds change nothing except trial release", () => {
  it("client_error/aborted/probe_other release trial only", async () => {
    process.env.NODE_COOLDOWN_MS = "50";
    for (let i = 0; i < 5; i++) recordNodeOutcome("nn", { kind: "timeout", error: "e" });
    await sleep(70);
    assert.equal(claimTrial("nn"), true);
    const before = getNodeSnapshot("nn");
    recordNodeOutcome("nn", { kind: "client_error", error: "400" });
    const afterSnap = getNodeSnapshot("nn");
    assert.equal(afterSnap.trialInFlight, false);
    assert.equal(afterSnap.consecutiveFails, before.consecutiveFails);
    assert.equal(afterSnap.totalRequests, before.totalRequests);
    assert.equal(afterSnap.circuit, before.circuit);

    assert.equal(claimTrial("nn"), true);
    recordNodeOutcome("nn", { kind: "aborted" });
    assert.equal(getNodeSnapshot("nn").trialInFlight, false);

    assert.equal(claimTrial("nn"), true);
    recordNodeOutcome("nn", { kind: "probe_other" });
    assert.equal(getNodeSnapshot("nn").trialInFlight, false);
  });
});

describe("helpers + reset + releaseTrial", () => {
  it("add/remove inFlight clamp >= 0", () => {
    addInFlight("nh", 100);
    addInFlight("nh", 50);
    let s = getNodeSnapshot("nh");
    assert.equal(s.inFlight, 2);
    assert.equal(s.activeKvTokens, 150);
    removeInFlight("nh", 60);
    s = getNodeSnapshot("nh");
    assert.equal(s.inFlight, 1);
    assert.equal(s.activeKvTokens, 90);
    removeInFlight("nh", 999);
    removeInFlight("nh", 999);
    s = getNodeSnapshot("nh");
    assert.equal(s.inFlight, 0);
    assert.equal(s.activeKvTokens, 0);
  });

  it("bumpProcessed accumulates", () => {
    bumpProcessed("nb", 10, 20);
    bumpProcessed("nb", 5);
    assert.equal(getNodeSnapshot("nb").totalProcessedTokens, 35);
  });

  it("resetNodeHealth(id) clears single node; releaseTrial clears flag", async () => {
    process.env.NODE_COOLDOWN_MS = "50";
    recordNodeOutcome("r1", { kind: "timeout", error: "e" });
    recordNodeOutcome("r2", { kind: "timeout", error: "e" });
    resetNodeHealth("r1");
    assert.equal(getNodeSnapshot("r1").consecutiveFails, 0);
    assert.equal(getNodeSnapshot("r2").consecutiveFails, 1);

    for (let i = 0; i < 4; i++) recordNodeOutcome("r3", { kind: "timeout", error: "e" });
    await sleep(0);
    // force open then expire
    recordNodeOutcome("r3", { kind: "timeout", error: "e" });
    resetNodeHealth("r3");
    assert.equal(getNodeSnapshot("r3").circuit, "closed");
    releaseTrial("r3");
    assert.equal(getNodeSnapshot("r3").trialInFlight, false);
  });
});
