/**
 * tests/helpers/mock-node.ts — in-process mock provider node (OpenAI-compatible).
 *
 * Mimics provider/agent/main.py response shapes for routing/failover tests.
 * Run via: npx tsx --test tests/mock-node-self.test.ts
 */
import http from "node:http";

export type MockBehavior =
  | "ok-stream"
  | "ok-json"
  | "saturate"
  | "fail500"
  | "fail400"
  | "hang"
  | "stall"
  | "error-json-200"
  | "sse-error-event";

export interface MockNode {
  url: string;
  port: number;
  received: { headers: Headers[]; bodies: any[] };
  stats: { requests: number; aborted: number };
  setBehavior(b: MockBehavior): void;
  close(): Promise<void>;
}

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  "Connection": "keep-alive",
  "X-Accel-Buffering": "no",
  "Access-Control-Allow-Origin": "*",
} as const;

const JSON_HEADERS = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
} as const;

const MOCK_CREATED = 1234567890;
const MOCK_ID = "chatcmpl-mock-1";
const MOCK_MODEL = "mock-model";

function contentChunk(): string {
  return (
    `data: ${JSON.stringify({
      id: MOCK_ID,
      object: "chat.completion.chunk",
      created: MOCK_CREATED,
      model: MOCK_MODEL,
      choices: [{ index: 0, delta: { content: "Hello" }, finish_reason: null }],
    })}\n\n`
  );
}

function usageChunk(): string {
  return (
    `data: ${JSON.stringify({
      id: MOCK_ID,
      object: "chat.completion.chunk",
      created: MOCK_CREATED,
      model: MOCK_MODEL,
      choices: [],
      usage: { prompt_tokens: 8, completion_tokens: 1, total_tokens: 9 },
    })}\n\n`
  );
}

function okJsonBody(): string {
  return JSON.stringify({
    id: MOCK_ID,
    object: "chat.completion",
    created: MOCK_CREATED,
    model: MOCK_MODEL,
    choices: [
      { index: 0, message: { role: "assistant", content: "Hello" }, finish_reason: "stop" },
    ],
    usage: { prompt_tokens: 8, completion_tokens: 1, total_tokens: 9 },
  });
}

function snapshotHeaders(raw: http.IncomingHttpHeaders): Headers {
  const h = new Headers();
  for (const [k, v] of Object.entries(raw)) {
    if (v === undefined) continue;
    if (Array.isArray(v)) {
      for (const item of v) h.append(k, item);
    } else {
      h.set(k, String(v));
    }
  }
  return h;
}

function parseBody(raw: string): any {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

export function startMockNode(initial: MockBehavior): Promise<MockNode> {
  let behavior: MockBehavior = initial;
  const received: { headers: Headers[]; bodies: any[] } = { headers: [], bodies: [] };
  const stats = { requests: 0, aborted: 0 };
  const openResponses = new Set<http.ServerResponse>();

  const server = http.createServer((req, res) => {
    stats.requests += 1;
    openResponses.add(res);

    // Client-abort detection: req 'close' fires on completion AND on abort.
    // Only count when the response never finished.
    req.on("close", () => {
      openResponses.delete(res);
      if (!res.writableEnded) {
        stats.aborted += 1;
      }
    });

    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf-8");
      received.headers.push(snapshotHeaders(req.headers));
      received.bodies.push(parseBody(raw));

      switch (behavior) {
        case "ok-stream": {
          res.writeHead(200, { ...SSE_HEADERS });
          res.write(contentChunk());
          res.write(usageChunk());
          res.write("data: [DONE]\n\n");
          res.end();
          break;
        }
        case "ok-json": {
          res.writeHead(200, { ...JSON_HEADERS });
          res.end(okJsonBody());
          break;
        }
        case "saturate": {
          res.writeHead(429, { ...JSON_HEADERS, "Retry-After": "1" });
          res.end(
            JSON.stringify({
              error: {
                message: "Provider node capacity saturated (mock).",
                type: "tokens_exceeded",
                param: null,
                code: "rate_limit_exceeded",
                retry_after: 1,
              },
            })
          );
          break;
        }
        case "fail500": {
          res.writeHead(500, { ...JSON_HEADERS });
          res.end(
            JSON.stringify({
              error: { message: "mock internal error", type: "server_error", code: 500 },
            })
          );
          break;
        }
        case "fail400": {
          res.writeHead(400, { ...JSON_HEADERS });
          res.end(
            JSON.stringify({
              error: {
                message: "mock bad request",
                type: "invalid_request_error",
                code: 400,
              },
            })
          );
          break;
        }
        case "hang": {
          // Accept and never respond. Keep socket open until client aborts
          // or close() destroys it. Headers/body already recorded above.
          break;
        }
        case "stall": {
          res.writeHead(200, { ...SSE_HEADERS });
          res.write(contentChunk());
          // Flush headers + first chunk, then hang (never end).
          break;
        }
        case "error-json-200": {
          // HTTP 200 with SSE content-type but a raw JSON error body.
          res.writeHead(200, { ...SSE_HEADERS });
          res.end(JSON.stringify({ error: { message: "x", code: 400 } }));
          break;
        }
        case "sse-error-event": {
          res.writeHead(200, { ...SSE_HEADERS });
          res.write(
            `data: ${JSON.stringify({ error: { message: "mock upstream error", code: 500 } })}\n\n`
          );
          res.end();
          break;
        }
      }
    });
  });

  // Allow indefinite hangs/stalls; do not let Node kill idle sockets.
  server.requestTimeout = 0;
  server.timeout = 0;
  server.keepAliveTimeout = 0;
  server.headersTimeout = 0;

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const addr = server.address();
      if (addr === null || typeof addr === "string") {
        reject(new Error("mock node failed to bind"));
        return;
      }
      const port = addr.port;
      resolve({
        url: `http://127.0.0.1:${port}`,
        port,
        received,
        stats,
        setBehavior(b: MockBehavior) {
          behavior = b;
        },
        close() {
          for (const r of openResponses) {
            try {
              if (!r.writableEnded) r.destroy();
            } catch {
              // ignore
            }
          }
          openResponses.clear();
          return new Promise<void>((resClose, rejClose) => {
            server.close((err) => (err ? rejClose(err) : resClose()));
          });
        },
      });
    });
  });
}
