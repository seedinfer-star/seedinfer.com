/**
 * tests/routing-phase1-route.test.ts — POST /api/v1/chat/completions attempt engine.
 * Run: npx tsx --test tests/routing-phase1-route.test.ts
 */
import { describe, it, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { POST } from "@/app/api/v1/chat/completions/route";
import { upsertProvider, getProvider, clearAll } from "@/lib/providers-store";
import { resetRouting, getStats as getSelectorStats } from "@/lib/routing/selector";
import {
  resetNodeHealth,
  getNodeSnapshot,
  recordNodeOutcome,
} from "@/lib/routing/node-health";
import { resetAffinity } from "@/lib/routing/affinity";
import { resetLeases, leaseCount, getLeaseCounters } from "@/lib/routing/lease";
import { __setAllowLoopbackForTests } from "@/lib/routing/node-targets";
import { clearAllRateLimits } from "@/lib/rate-limit";
import { startMockNode, type MockNode } from "./helpers/mock-node.js";

const ENV_KEYS = [
  "ROUTING_CONNECT_TIMEOUT_MS",
  "ROUTING_STREAM_IDLE_MS",
  "ROUTING_TOTAL_TIMEOUT_MS",
  "ROUTING_TTFT_BUDGET_MS",
  "ROUTING_EXTRA_NODE_PORTS",
  "ROUTING_PAID_FALLBACK",
  "ROUTING_HEARTBEAT_MAX_AGE_MS",
  "VLLM_URL",
  "LOCAL_VLLM_URL",
  "SEEDINFER_VLLM_URL",
  "AFFINITY_MIN_TOKENS",
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

let nodeA: MockNode;
let nodeB: MockNode;

function resetAll(): void {
  resetRouting();
  resetNodeHealth();
  resetAffinity();
  resetLeases();
  clearAll();
  clearAllRateLimits();
}

function addNode(id: string, url: string): void {
  upsertProvider({ id, agent_url: url });
  getProvider(id)!.verification.status = "verified";
}

/** Force P2C to prefer `first` on the opening attempt (lower EWMA TTFT wins ties). */
function seedFaster(first: string): void {
  recordNodeOutcome(first, { kind: "ok", ttftMs: 50, totalMs: 100 });
}

function chatReq(body: any, headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

const BASE_BODY = {
  model: "mock-model",
  stream: false,
  messages: [{ role: "user", content: "hi" }],
};

before(async () => {
  nodeA = await startMockNode("ok-json");
  nodeB = await startMockNode("ok-json");
  __setAllowLoopbackForTests(true);
  process.env.ROUTING_CONNECT_TIMEOUT_MS = "1000";
  process.env.ROUTING_STREAM_IDLE_MS = "400";
  process.env.ROUTING_TOTAL_TIMEOUT_MS = "8000";
  process.env.ROUTING_EXTRA_NODE_PORTS = `${nodeA.port},${nodeB.port}`;
  delete process.env.ROUTING_PAID_FALLBACK;
  delete process.env.VLLM_URL;
  delete process.env.LOCAL_VLLM_URL;
  delete process.env.SEEDINFER_VLLM_URL;
  delete process.env.AFFINITY_MIN_TOKENS;
});

after(async () => {
  await nodeA.close().catch(() => {});
  await nodeB.close().catch(() => {});
  resetAll();
  __setAllowLoopbackForTests(false);
  restoreEnv(savedEnv);
});

beforeEach(() => {
  resetAll();
});

describe("chat route: failover", () => {
  it("429 on node1 fails over to node2 (X-SeedInfer-Upstream=node2)", async () => {
    nodeA.setBehavior("saturate");
    nodeB.setBehavior("ok-json");
    addNode("node1", nodeA.url);
    addNode("node2", nodeB.url);
    seedFaster("node1");
    const baseA = nodeA.stats.requests;
    const baseB = nodeB.stats.requests;

    const res = await POST(chatReq({ ...BASE_BODY }));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("x-seedinfer-upstream"), "node2");
    assert.equal(res.headers.get("x-seedinfer-attempts"), "2");
    const body = (await res.json()) as any;
    assert.equal(body.choices[0].message.content, "Hello");
    assert.equal(nodeA.stats.requests, baseA + 1);
    assert.equal(nodeB.stats.requests, baseB + 1);
  });

  it("connection-refused node1 fails over to node2", async () => {
    const dead = await startMockNode("ok-json");
    const deadUrl = dead.url;
    const deadPort = dead.port;
    await dead.close();
    process.env.ROUTING_EXTRA_NODE_PORTS = `${nodeA.port},${nodeB.port},${deadPort}`;
    try {
      nodeB.setBehavior("ok-json");
      addNode("n-dead", deadUrl);
      addNode("n2", nodeB.url);
      seedFaster("n-dead");
      const baseB = nodeB.stats.requests;

      const res = await POST(chatReq({ ...BASE_BODY }));
      assert.equal(res.status, 200);
      assert.equal(res.headers.get("x-seedinfer-upstream"), "n2");
      assert.equal(nodeB.stats.requests, baseB + 1);
      assert.equal(getNodeSnapshot("n-dead").consecutiveFails, 1);
    } finally {
      process.env.ROUTING_EXTRA_NODE_PORTS = `${nodeA.port},${nodeB.port}`;
    }
  });

  it("both nodes down -> 429 attempts_exceeded + Retry-After", async () => {
    nodeA.setBehavior("saturate");
    nodeB.setBehavior("saturate");
    addNode("node1", nodeA.url);
    addNode("node2", nodeB.url);

    const res = await POST(chatReq({ ...BASE_BODY }));
    assert.equal(res.status, 429);
    const ra = res.headers.get("retry-after");
    assert.ok(ra === "1" || ra === "2", `Retry-After should be 1 or 2, got ${ra}`);
    assert.equal(res.headers.get("x-seedinfer-attempts"), "2");
    const body = (await res.json()) as any;
    assert.equal(body.error.code, "attempts_exceeded");
    assert.deepEqual(new Set(body.error.tried as string[]), new Set(["node1", "node2"]));
  });

  it("no nodes -> 503 no_providers", async () => {
    const res = await POST(chatReq({ ...BASE_BODY }));
    assert.equal(res.status, 503);
    const body = (await res.json()) as any;
    assert.equal(body.error.code, "no_providers");
  });
});

describe("chat route: streams and outcomes", () => {
  it("stall terminates the stream and releases lease + inFlight", async () => {
    nodeA.setBehavior("stall");
    addNode("n1", nodeA.url);

    const res = await POST(
      chatReq({ ...BASE_BODY, stream: true }),
    );
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/event-stream/);

    const reader = res.body!.getReader();
    const deadline = Date.now() + 10000;
    let settled = false;
    try {
      for (;;) {
        if (Date.now() > deadline) throw new Error("stream did not terminate in time");
        const r = await reader.read();
        if (r.done) break;
      }
    } catch {
      // error termination also counts — the client must stop hanging
    } finally {
      settled = true;
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
    }
    assert.equal(settled, true);
    // give finalize a tick to run
    const end = Date.now() + 2000;
    while (leaseCount() !== 0 && Date.now() < end) {
      await new Promise((r) => setTimeout(r, 25));
    }
    assert.equal(leaseCount(), 0);
    assert.deepEqual(getLeaseCounters("n1"), { inFlight: 0, activeKv: 0 });
    assert.equal(getSelectorStats()["n1"]?.inFlight ?? 0, 0);
  });

  it("single node failure records consecutiveFails exactly 1", async () => {
    nodeA.setBehavior("fail500");
    addNode("n1", nodeA.url);

    const res = await POST(chatReq({ ...BASE_BODY }));
    assert.equal(res.status, 429);
    assert.equal(getNodeSnapshot("n1").consecutiveFails, 1);
  });

  it("error-json-200 with code 400 passes through 400 with no retry", async () => {
    nodeA.setBehavior("error-json-200");
    nodeB.setBehavior("ok-json");
    addNode("node1", nodeA.url);
    addNode("node2", nodeB.url);
    seedFaster("node1");
    const baseB = nodeB.stats.requests;

    const res = await POST(chatReq({ ...BASE_BODY }));
    assert.equal(res.status, 400);
    const body = (await res.json()) as any;
    assert.ok(body.error);
    assert.equal(nodeB.stats.requests, baseB, "node2 must not be tried after client_error");
    assert.equal(getNodeSnapshot("node1").consecutiveFails, 0);
  });
});

describe("chat route: forwarding hygiene", () => {
  it("strips priority / kv_transfer_params / vllm_xargs from the forwarded body", async () => {
    nodeA.setBehavior("ok-json");
    addNode("n1", nodeA.url);

    const res = await POST(
      chatReq({
        ...BASE_BODY,
        priority: "high",
        kv_transfer_params: { foo: 1 },
        vllm_xargs: "--foo",
      }),
    );
    assert.equal(res.status, 200);
    const lastBody = nodeA.received.bodies[nodeA.received.bodies.length - 1];
    assert.ok(!("priority" in lastBody), "priority must be stripped");
    assert.ok(!("kv_transfer_params" in lastBody), "kv_transfer_params must be stripped");
    assert.ok(!("vllm_xargs" in lastBody), "vllm_xargs must be stripped");
    assert.equal(lastBody.model, "mock-model");
  });

  it("never forwards client Authorization to the node", async () => {
    nodeA.setBehavior("ok-json");
    addNode("n1", nodeA.url);

    const res = await POST(
      chatReq({ ...BASE_BODY }, { authorization: "Bearer sk_live_test123" }),
    );
    assert.equal(res.status, 200);
    const lastHeaders = nodeA.received.headers[nodeA.received.headers.length - 1];
    assert.equal(lastHeaders.get("authorization"), null);
  });
});

describe("chat route: affinity", () => {
  it("two >=8192-token requests with the same principal stick to one node", async () => {
    nodeA.setBehavior("ok-json");
    nodeB.setBehavior("ok-json");
    addNode("node1", nodeA.url);
    addNode("node2", nodeB.url);

    const big = { ...BASE_BODY, messages: [{ role: "user", content: "x".repeat(30000) }] };
    const headers = { authorization: "Bearer affinity-test-key" };

    const r1 = await POST(chatReq(big, headers));
    assert.equal(r1.status, 200);
    await r1.json();
    const up1 = r1.headers.get("x-seedinfer-upstream");
    assert.ok(up1 === "node1" || up1 === "node2");

    const r2 = await POST(chatReq(big, headers));
    assert.equal(r2.status, 200);
    await r2.json();
    const up2 = r2.headers.get("x-seedinfer-upstream");
    assert.equal(up2, up1);
    assert.equal(r2.headers.get("x-seedinfer-affinity"), "hit");
  });
});
