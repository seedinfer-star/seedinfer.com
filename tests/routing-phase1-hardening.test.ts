/**
 * tests/routing-phase1-hardening.test.ts — Phase 1 hardening:
 * 1. fallback/status reset gated by admin (401 without token, plain GET stays public)
 * 2. heartbeat TTFT probe uses LIVE_MODEL.id
 * 3. verifyProvider rejects non-tailnet agent_url
 * 4. telemetry fallback OFF by default (valid telemetry alone must NOT verify)
 * 5. routing/stats enriched with node-health snapshot + lease counters
 * Run: npx tsx --test tests/routing-phase1-hardening.test.ts
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { getDb, closeDb } from "@/lib/db";
import { createNodeToken } from "@/lib/provider-tokens";
import { clearAllRateLimits } from "@/lib/rate-limit";
import {
  upsertProvider,
  getProvider,
  verifyProvider,
  clearAll,
} from "@/lib/providers-store";
import { LIVE_MODEL } from "@/lib/catalog";
import { GET as statusGet, POST as statusPost } from "@/app/api/v1/fallback/status/route";
import { POST as hbPost } from "@/app/api/v1/providers/heartbeat/route";
import { GET as routingStatsGet } from "@/app/api/v1/routing/stats/route";

// --- isolated env (must be set before getDb() runs in before()) ---
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "seedinfer-phase1-hardening-"));
process.env.DATABASE_URL = `file:${path.join(tmpDir, "test.db")}`;
process.env.DB_BACKUPS = "off";
process.env.AUTH_SECRET = "test-only-auth-secret-0123456789abcdef";

let nodeSecret = "";

const ENV_KEYS = [
  "ADMIN_TOKEN",
  "SEEDINFER_ADMIN_TOKEN",
  "SEEDINFER_ADMIN_TOKEN_ALT",
  "ROUTING_ALLOW_LOOPBACK",
  "ROUTING_TELEMETRY_VERIFY",
] as const;

function saveEnv(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const k of ENV_KEYS) out[k] = process.env[k];
  return out;
}

function restoreEnv(saved: Record<string, string | undefined>): void {
  for (const k of ENV_KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(saved)) {
    if (v !== undefined) process.env[k] = v;
  }
}

before(() => {
  getDb();
  const userId = randomUUID();
  getDb()
    .prepare("INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)")
    .run(userId, "phase1@example.com", "test-hash", new Date().toISOString());
  const t = createNodeToken(userId, "phase1-rig");
  if ("error" in t) throw new Error("createNodeToken failed");
  nodeSecret = t.secret;
  clearAll();
  clearAllRateLimits();
});

after(() => {
  clearAll();
  clearAllRateLimits();
  try {
    (globalThis as any).__seedinferLastProbe = {};
  } catch {}
  closeDb();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe("fallback/status reset admin gate", () => {
  it("GET ?reset= without admin -> 401 (ADMIN_TOKEN set)", async () => {
    const saved = saveEnv();
    process.env.ADMIN_TOKEN = `adm-${randomUUID()}`;
    try {
      const res = await statusGet(new Request("http://localhost/api/v1/fallback/status?reset=all"));
      assert.equal(res.status, 401);
      const body = await res.json();
      assert.equal(body.ok, false);
    } finally {
      restoreEnv(saved);
    }
  });

  it("POST {reset} without admin -> 401 (ADMIN_TOKEN set)", async () => {
    const saved = saveEnv();
    process.env.ADMIN_TOKEN = `adm-${randomUUID()}`;
    try {
      const res = await statusPost(
        new Request("http://localhost/api/v1/fallback/status", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reset: "all" }),
        })
      );
      assert.equal(res.status, 401);
    } finally {
      restoreEnv(saved);
    }
  });

  it("plain GET stays public -> 200", async () => {
    const saved = saveEnv();
    process.env.ADMIN_TOKEN = `adm-${randomUUID()}`;
    try {
      const res = await statusGet(new Request("http://localhost/api/v1/fallback/status"));
      assert.equal(res.status, 200);
    } finally {
      restoreEnv(saved);
    }
  });

  it("GET ?reset=all with valid admin token -> 200", async () => {
    const saved = saveEnv();
    const secret = `adm-${randomUUID()}`;
    process.env.ADMIN_TOKEN = secret;
    try {
      const res = await statusGet(
        new Request("http://localhost/api/v1/fallback/status?reset=all", {
          headers: { "x-admin-token": secret },
        })
      );
      assert.equal(res.status, 200);
    } finally {
      restoreEnv(saved);
    }
  });
});

describe("heartbeat probe uses LIVE_MODEL", () => {
  it("probe POST body model === LIVE_MODEL.id", async () => {
    const saved = saveEnv();
    delete process.env.ROUTING_ALLOW_LOOPBACK;
    delete process.env.ROUTING_TELEMETRY_VERIFY;
    clearAllRateLimits();
    const nodeId = `phase1-probe-${randomUUID().slice(0, 8)}`;
    // Seed a verified node with a tailnet IP so the probe has a URL to hit.
    upsertProvider({
      id: nodeId,
      chip: "Test GPU",
      current_model: LIVE_MODEL.id,
      tailscale_ip: "100.64.0.1",
      gpu: { count: 1, devices: [{ name: "NVIDIA GeForce RTX 5090" }] },
      vllm_health: { status: "ok" },
    });
    getProvider(nodeId)!.verification.status = "verified";

    const origFetch = globalThis.fetch;
    let capturedModel: string | null = null;
    (globalThis as any).fetch = async (_url: any, init: any) => {
      try {
        const body = JSON.parse(String(init?.body || "{}"));
        if (body && typeof body.model === "string") capturedModel = body.model;
      } catch {}
      const stream = new ReadableStream({
        start(c) {
          c.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"pong"}}]}\n\n'));
          c.close();
        },
      });
      return { ok: true, status: 200, body: stream } as any;
    };
    try {
      const res = await hbPost(
        new Request("http://localhost/api/v1/providers/heartbeat", {
          method: "POST",
          headers: { "content-type": "application/json", authorization: `Bearer ${nodeSecret}` },
          body: JSON.stringify({
            id: nodeId,
            chip: "Test GPU",
            current_model: LIVE_MODEL.id,
            tailscale_ip: "100.64.0.1",
          }),
        })
      );
      assert.equal(res.status, 200);
      // Probe is fire-and-forget (setTimeout 10ms) — poll for the capture.
      const deadline = Date.now() + 5000;
      while (capturedModel === null && Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 50));
      }
      assert.equal(capturedModel, LIVE_MODEL.id);
    } finally {
      globalThis.fetch = origFetch;
      restoreEnv(saved);
    }
  });
});

describe("verifyProvider tailnet-only + telemetry gate", () => {
  it("rejects non-tailnet agent_url (no verified)", async () => {
    const saved = saveEnv();
    delete process.env.ROUTING_ALLOW_LOOPBACK;
    delete process.env.ROUTING_TELEMETRY_VERIFY;
    try {
      const id = `phase1-nontailnet-${randomUUID().slice(0, 8)}`;
      upsertProvider({
        id,
        chip: "Test GPU",
        current_model: LIVE_MODEL.id,
        agent_url: "http://127.0.0.1:9999",
        gpu: { count: 1, devices: [{ name: "NVIDIA GeForce RTX 5090" }] },
        vllm_health: { status: "ok" },
      });
      const res = await verifyProvider(id);
      assert.equal(res.passed, false);
      assert.notEqual(getProvider(id)!.verification.status, "verified");
    } finally {
      restoreEnv(saved);
    }
  });

  it("telemetry fallback OFF by default (vllm ok + unreachable agent -> NOT verified)", async () => {
    const saved = saveEnv();
    delete process.env.ROUTING_ALLOW_LOOPBACK;
    delete process.env.ROUTING_TELEMETRY_VERIFY;
    const origFetch = globalThis.fetch;
    (globalThis as any).fetch = async () => {
      throw new Error("connect ECONNREFUSED (test)");
    };
    try {
      const id = `phase1-telemetry-${randomUUID().slice(0, 8)}`;
      upsertProvider({
        id,
        chip: "Test GPU",
        current_model: LIVE_MODEL.id,
        agent_url: "http://100.99.99.99:47901",
        gpu: { count: 1, devices: [{ name: "NVIDIA GeForce RTX 5090" }] },
        vllm_health: { status: "ok" },
      });
      const res = await verifyProvider(id);
      assert.equal(res.passed, false);
      assert.notEqual(getProvider(id)!.verification.status, "verified");
    } finally {
      globalThis.fetch = origFetch;
      restoreEnv(saved);
    }
  });
});

describe("routing/stats node-health enrichment", () => {
  it("per-provider entries carry circuitState/pausedUntil/lastError/inFlight/activeKvTokens", async () => {
    const saved = saveEnv();
    try {
      const id = `phase1-stats-${randomUUID().slice(0, 8)}`;
      upsertProvider({ id, chip: "Test GPU", current_model: LIVE_MODEL.id });
      const res = await routingStatsGet(new Request("http://localhost/api/v1/routing/stats"));
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(Array.isArray(body.providers));
      assert.ok(body.providers.length > 0);
      for (const p of body.providers as any[]) {
        assert.ok("circuitState" in p, `missing circuitState for ${p.id}`);
        assert.ok("pausedUntil" in p, `missing pausedUntil for ${p.id}`);
        assert.ok("lastError" in p, `missing lastError for ${p.id}`);
        assert.ok("inFlight" in p, `missing inFlight for ${p.id}`);
        assert.ok("activeKvTokens" in p, `missing activeKvTokens for ${p.id}`);
      }
    } finally {
      restoreEnv(saved);
    }
  });
});
