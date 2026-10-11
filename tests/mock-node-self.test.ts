/**
 * tests/mock-node-self.test.ts — self-test for tests/helpers/mock-node.ts.
 * Run: npx tsx --test tests/mock-node-self.test.ts
 */
import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { startMockNode, type MockNode } from "./helpers/mock-node.js";

const CHAT_BODY = JSON.stringify({
  model: "mock-model",
  messages: [{ role: "user", content: "hi" }],
});

let node: MockNode;

async function postChat(stream: boolean): Promise<Response> {
  return fetch(`${node.url}/v1/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer test-key" },
    body: JSON.stringify({
      model: "mock-model",
      stream,
      messages: [{ role: "user", content: "hi" }],
    }),
  });
}

function splitSseEvents(text: string): string[] {
  return text
    .split("\n\n")
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
}

before(async () => {
  node = await startMockNode("ok-stream");
});

after(async () => {
  await node.close();
});

describe("mock-node self-test", () => {
  it("ok-stream: SSE content chunk + final empty-choices usage chunk + [DONE]", async () => {
    node.setBehavior("ok-stream");
    const baseRequests = node.stats.requests;

    const res = await postChat(true);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/event-stream/);

    const text = await res.text();
    const events = splitSseEvents(text);
    // content chunk, usage chunk, [DONE]
    assert.equal(events.length, 3);
    assert.ok(events[0].startsWith("data: "));
    const first = JSON.parse(events[0].slice("data: ".length));
    assert.equal(first.choices[0].delta.content, "Hello");

    assert.ok(events[1].startsWith("data: "));
    const second = JSON.parse(events[1].slice("data: ".length));
    assert.deepEqual(second.choices, []);
    assert.equal(second.usage.prompt_tokens, 8);
    assert.equal(second.usage.completion_tokens, 1);

    assert.equal(events[2], "data: [DONE]");

    // server saw exactly one more request, with body + auth forwarded
    assert.equal(node.stats.requests, baseRequests + 1);
    const lastBody = node.received.bodies[node.received.bodies.length - 1];
    assert.equal(lastBody.model, "mock-model");
    assert.deepEqual(lastBody.messages, [{ role: "user", content: CHAT_BODY ? "hi" : "hi" }]);
    const lastHeaders = node.received.headers[node.received.headers.length - 1];
    assert.equal(lastHeaders.get("authorization"), "Bearer test-key");
  });

  it("ok-json passthrough still works (shape sanity)", async () => {
    node.setBehavior("ok-json");
    const baseRequests = node.stats.requests;

    const res = await postChat(false);
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.object, "chat.completion");
    assert.equal(body.choices[0].message.content, "Hello");
    assert.equal(body.usage.total_tokens, 9);
    assert.equal(node.stats.requests, baseRequests + 1);
  });

  it("saturate: 429 + Retry-After:1 + tokens_exceeded/rate_limit_exceeded/retry_after:1", async () => {
    node.setBehavior("saturate");
    const baseRequests = node.stats.requests;

    const res = await postChat(false);
    assert.equal(res.status, 429);
    assert.equal(res.headers.get("retry-after"), "1");
    const body = (await res.json()) as any;
    assert.equal(body.error.type, "tokens_exceeded");
    assert.equal(body.error.code, "rate_limit_exceeded");
    assert.equal(body.error.retry_after, 1);
    assert.equal(node.stats.requests, baseRequests + 1);
  });

  it("fail500: 500 JSON error", async () => {
    node.setBehavior("fail500");
    const res = await postChat(false);
    assert.equal(res.status, 500);
    const body = (await res.json()) as any;
    assert.ok(body.error);
  });

  it("fail400: 400 JSON error with code 400", async () => {
    node.setBehavior("fail400");
    const res = await postChat(false);
    assert.equal(res.status, 400);
    const body = (await res.json()) as any;
    assert.equal(body.error.code, 400);
  });

  it("error-json-200: HTTP 200 SSE content-type but raw JSON error body", async () => {
    node.setBehavior("error-json-200");
    const res = await postChat(true);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type") ?? "", /text\/event-stream/);
    const body = (await res.json()) as any;
    assert.equal(body.error.message, "x");
    assert.equal(body.error.code, 400);
  });

  it("sse-error-event: data error event then close", async () => {
    node.setBehavior("sse-error-event");
    const res = await postChat(true);
    assert.equal(res.status, 200);
    const text = await res.text();
    const events = splitSseEvents(text);
    assert.equal(events.length, 1);
    assert.ok(events[0].startsWith("data: "));
    const payload = JSON.parse(events[0].slice("data: ".length));
    assert.equal(payload.error.code, 500);
  });

  it("stall: one SSE chunk then hang — abort counted via req close", async () => {
    node.setBehavior("stall");
    const baseRequests = node.stats.requests;
    const baseAborted = node.stats.aborted;

    const ctrl = new AbortController();
    const reqPromise = fetch(`${node.url}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "mock-model",
        stream: true,
        messages: [{ role: "user", content: "hi" }],
      }),
      signal: ctrl.signal,
    });

    const res = await reqPromise;
    assert.equal(res.status, 200);
    const reader = res.body!.getReader();
    const first = await reader.read();
    assert.equal(first.done, false);
    const text = new TextDecoder().decode(first.value);
    assert.ok(text.startsWith("data: "));
    assert.ok(text.includes("Hello"));

    // second read hangs -> abort the client side
    const pending = reader.read();
    ctrl.abort();
    await assert.rejects(pending);
    try {
      await reader.cancel();
    } catch {
      // ignore cancel errors after abort
    }

    // wait for the server-side req 'close' handler to fire
    const deadline = Date.now() + 3000;
    while (node.stats.aborted === baseAborted && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 25));
    }
    assert.equal(node.stats.requests, baseRequests + 1);
    assert.equal(node.stats.aborted, baseAborted + 1);
  });

  it("hang: accept never respond — abort counted via req close", async () => {
    node.setBehavior("hang");
    const baseRequests = node.stats.requests;
    const baseAborted = node.stats.aborted;

    const ctrl = new AbortController();
    const responsePromise = fetch(`${node.url}/v1/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: "mock-model",
        stream: false,
        messages: [{ role: "user", content: "hi" }],
      }),
      signal: ctrl.signal,
    });
    // server never responds; give it a moment to accept, then abort
    await new Promise((r) => setTimeout(r, 200));
    ctrl.abort();
    await assert.rejects(responsePromise);

    const deadline = Date.now() + 3000;
    while (node.stats.aborted === baseAborted && Date.now() < deadline) {
      await new Promise((r) => setTimeout(r, 25));
    }
    assert.equal(node.stats.requests, baseRequests + 1);
    assert.equal(node.stats.aborted, baseAborted + 1);
  });

  it("setBehavior switches live without restart", async () => {
    node.setBehavior("ok-json");
    const okRes = await postChat(false);
    assert.equal(okRes.status, 200);
    await okRes.json();

    node.setBehavior("fail500");
    const errRes = await postChat(false);
    assert.equal(errRes.status, 500);
    await errRes.json();
  });
});
