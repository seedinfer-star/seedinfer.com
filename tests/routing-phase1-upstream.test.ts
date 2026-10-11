/**
 * tests/routing-phase1-upstream.test.ts — sse.ts + upstream-http.ts.
 * Run: npx tsx --test tests/routing-phase1-upstream.test.ts
 */
import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as http from "node:http";
import type { AddressInfo } from "node:net";
import { SseSniffer, scanUsageFromText, stripUnsolicitedUsage } from "@/lib/routing/sse";
import { postToNode, classifyNodeHttp } from "@/lib/routing/upstream-http";

const ENV_KEYS = [
  "ROUTING_CONNECT_TIMEOUT_MS",
  "ROUTING_TTFT_BUDGET_MS",
  "ROUTING_STREAM_IDLE_MS",
  "ROUTING_TOTAL_TIMEOUT_MS",
  "ROUTING_MAX_BODY_BYTES",
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

let savedEnv: Record<string, string | undefined>;
beforeEach(() => {
  savedEnv = snapshotEnv();
});
afterEach(() => {
  restoreEnv(savedEnv);
});

async function collect(stream: AsyncIterable<Buffer>): Promise<Buffer> {
  const parts: Buffer[] = [];
  for await (const c of stream) parts.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(parts);
}

function listen(handler: (req: http.IncomingMessage, res: http.ServerResponse) => void) {
  const srv = http.createServer(handler);
  return {
    srv,
    async url(): Promise<string> {
      await new Promise<void>((res) => srv.listen(0, "127.0.0.1", res));
      const a = srv.address() as AddressInfo;
      return `http://127.0.0.1:${a.port}/v1/chat/completions`;
    },
    async close(): Promise<void> {
      await new Promise<void>((res, rej) => srv.close((e) => (e ? rej(e) : res())));
    },
  };
}

async function freePort(): Promise<number> {
  const s = http.createServer();
  await new Promise<void>((r) => s.listen(0, "127.0.0.1", r));
  const p = (s.address() as AddressInfo).port;
  await new Promise<void>((r, j) => s.close((e) => (e ? j(e) : r())));
  return p;
}

describe("sse parser", () => {
  it("CRLF split across pushes: lone CR then LF completes boundary", () => {
    const s = new SseSniffer();
    const a = s.push('data: {"a":1}\r');
    assert.equal(a.length, 0);
    const b = s.push('\n\r\ndata: [DONE]\r\n\r\n');
    assert.equal(b.length, 2);
    assert.equal(b[0].data, '{"a":1}');
    assert.equal(b[1].isDone, true);
  });

  it("LF boundaries + split data line", () => {
    const s = new SseSniffer();
    const a = s.push('data: {"cho');
    assert.equal(a.length, 0);
    const b = s.push('ices": []}\n\ndata: [DONE]\n\n');
    assert.equal(b.length, 2);
    assert.equal(b[0].data, '{"choices": []}');
    assert.equal(b[1].isDone, true);
  });

  it("usage extract picks last occurrence", () => {
    const text =
      `data: {"usage":{"prompt_tokens":1,"completion_tokens":2,"total_tokens":3}}\n\n` +
      `data: {"usage": {"prompt_tokens": 10, "completion_tokens": 20, "total_tokens": 30}}\n\n`;
    const u = scanUsageFromText(text);
    assert.deepEqual(u, { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 });
    assert.equal(scanUsageFromText("no usage here"), null);
  });

  it("stripUnsolicitedUsage drops usage-only heartbeats unless asked", () => {
    const s = new SseSniffer();
    const evs = s.push(
      'data: {"choices":[],"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}\n\n' +
        'data: {"choices":[{"delta":{"content":"hi"}}]}\n\n' +
        "data: [DONE]\n\n",
    );
    assert.equal(evs.length, 3);
    const stripped = stripUnsolicitedUsage(evs, false);
    assert.equal(stripped.length, 2);
    assert.ok(stripped[0].data.includes("hi"));
    assert.equal(stripped[1].isDone, true);
    assert.equal(stripUnsolicitedUsage(evs, true).length, 3);
  });

  it("error event detected, usage attached", () => {
    const s = new SseSniffer();
    const evs = s.push(
      'data: {"error":{"message":"boom","code":500},"usage":{"prompt_tokens":1,"completion_tokens":1,"total_tokens":2}}\n\n',
    );
    assert.equal(evs.length, 1);
    assert.equal(evs[0].isError, true);
    assert.deepEqual(evs[0].errorJson, { message: "boom", code: 500 });
    assert.deepEqual(evs[0].usage, { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 });
  });

  it("oversized event flagged truncated", () => {
    const s = new SseSniffer();
    const big = "x".repeat(70 * 1024);
    const evs = s.push(`data: ${big}\n\n`);
    assert.equal(evs.length, 1);
    assert.equal(evs[0].truncated, true);
  });

  it("flush returns trailing partial event", () => {
    const s = new SseSniffer();
    assert.equal(s.push("data: [DONE]").length, 0);
    const f = s.flush();
    assert.equal(f.length, 1);
    assert.equal(f[0].isDone, true);
  });
});

describe("upstream-http", () => {
  it("hang -> timeout_ttft with tiny budget", async () => {
    process.env.ROUTING_TTFT_BUDGET_MS = "60";
    process.env.ROUTING_CONNECT_TIMEOUT_MS = "500";
    const h = listen((_req, _res) => {
      /* never respond */
    });
    const url = await h.url();
    try {
      const r = await postToNode({ url, body: "{}", expectStream: true });
      assert.equal(r.ok, false);
      assert.equal(r.ok ? "" : r.kind, "timeout_ttft");
    } finally {
      await h.close();
    }
  });

  it("ECONNREFUSED -> connect", async () => {
    process.env.ROUTING_CONNECT_TIMEOUT_MS = "300";
    process.env.ROUTING_TTFT_BUDGET_MS = "300";
    const port = await freePort();
    const r = await postToNode({
      url: `http://127.0.0.1:${port}/v1/chat/completions`,
      body: "{}",
      connectTimeoutMs: 300,
      ttftBudgetMs: 300,
    });
    assert.equal(r.ok, false);
    assert.equal(r.ok ? "" : r.kind, "connect");
  });

  it("immediate 200 SSE stream -> ok with ttftMs", async () => {
    const h = listen((_req, res) => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write('data: {"choices":[{"delta":{"content":"hi"}}]}\n\n');
      res.end("data: [DONE]\n\n");
    });
    const url = await h.url();
    try {
      const r = await postToNode({ url, body: "{}", expectStream: true });
      assert.equal(r.ok, true);
      if (!r.ok) return;
      assert.ok(typeof r.ttftMs === "number" && (r.ttftMs as number) >= 0);
      const body = (await collect(r.stream)).toString("utf8");
      assert.ok(body.includes("[DONE]"));
      r.abort();
    } finally {
      await h.close();
    }
  });

  it("400 with error JSON -> http + classify client_error", async () => {
    const h = listen((_req, res) => {
      res.writeHead(400, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: { message: "bad", code: 400 } }));
    });
    const url = await h.url();
    try {
      const r = await postToNode({ url, body: "{}", expectStream: false });
      assert.equal(r.ok, false);
      if (r.ok) return;
      assert.equal(r.kind, "http");
      assert.equal(r.status, 400);
      assert.equal(classifyNodeHttp(r.status ?? null, r.bodyText ?? null), "client_error");
    } finally {
      await h.close();
    }
  });

  it("429 -> saturated; 5xx -> node_error; null -> node_error", () => {
    assert.equal(classifyNodeHttp(429, null), "saturated");
    assert.equal(classifyNodeHttp(413, null), "client_error");
    assert.equal(classifyNodeHttp(422, null), "client_error");
    assert.equal(classifyNodeHttp(500, null), "node_error");
    assert.equal(classifyNodeHttp(403, null), "node_error");
    assert.equal(classifyNodeHttp(null, null), "node_error");
  });

  it("idle gap triggers timeout_idle on next()", async () => {
    const h = listen((_req, res) => {
      res.writeHead(200, { "content-type": "text/event-stream" });
      res.write('data: {"a":1}\n\n');
      // then stall: no end, no more chunks
    });
    const url = await h.url();
    try {
      const r = await postToNode({ url, body: "{}", expectStream: true, idleTimeoutMs: 60 });
      assert.equal(r.ok, true);
      if (!r.ok) return;
      const it = r.stream[Symbol.asyncIterator]();
      const first = await it.next();
      assert.equal(first.done, false);
      await assert.rejects(it.next(), /timeout_idle/);
      r.abort();
    } finally {
      await h.close();
    }
  });

  it("abort signal mid-wait -> aborted", async () => {
    const h = listen((_req, _res) => {
      /* never respond */
    });
    const url = await h.url();
    const ctl = new AbortController();
    try {
      const p = postToNode({
        url,
        body: "{}",
        expectStream: true,
        signal: ctl.signal,
        ttftBudgetMs: 5000,
        connectTimeoutMs: 2000,
      });
      setTimeout(() => ctl.abort(), 50);
      const r = await p;
      assert.equal(r.ok, false);
      assert.equal(r.ok ? "" : r.kind, "aborted");
    } finally {
      await h.close();
    }
  });
});
