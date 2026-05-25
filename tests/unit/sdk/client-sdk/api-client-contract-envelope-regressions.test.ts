import assert from "node:assert/strict";
import test from "node:test";

import {
  RetryableApiClient,
  createEventSubscriber,
  type ApiClientConfig,
} from "../../../../src/sdk/client-sdk/api-client.js";
import type { ContractEnvelope } from "../../../../src/platform/contracts/executable-contracts/index.js";

const mockPrincipal = {
  subject: "user_123",
  tenantId: "tenant_abc",
  roles: ["admin"],
};

function requireEnvelope<TPayload>(value: unknown): ContractEnvelope<TPayload> {
  assert.ok(value);
  return value as ContractEnvelope<TPayload>;
}

function createClient(overrides: Partial<ApiClientConfig> = {}): RetryableApiClient {
  return new RetryableApiClient({
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    principal: mockPrincipal,
    ...overrides,
  });
}

test("api client wraps requests in ContractEnvelope and preserves idempotency metadata", async () => {
  const client = createClient({ idempotencyKey: "idem-client-default" });
  const originalFetch = globalThis.fetch;

  let seenEnvelope: unknown = null;
  globalThis.fetch = async (_url, init) => {
    seenEnvelope = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await client.post("/test", { hello: "world" });
    const capturedEnvelope = requireEnvelope<{ hello: string }>(seenEnvelope);
    assert.equal(capturedEnvelope.payload.hello, "world");
    assert.equal(capturedEnvelope.idempotencyKey, "idem-client-default");
    assert.equal(capturedEnvelope.metadata.principalSubject, mockPrincipal.subject);
    assert.equal(capturedEnvelope.schemaVersion, "v4.3");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("api client derives principal subject from userId when subject aliases are absent", async () => {
  const client = createClient({
    principal: {
      userId: "ui-user-123",
      tenantId: "tenant_abc",
      roles: ["operator"],
    },
  });
  const originalFetch = globalThis.fetch;

  let seenEnvelope: unknown = null;
  globalThis.fetch = async (_url, init) => {
    seenEnvelope = JSON.parse(String(init?.body));
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await client.post("/test", { hello: "world" });
    const capturedEnvelope = requireEnvelope<{ hello: string }>(seenEnvelope);
    assert.equal(capturedEnvelope.principal?.subject, "ui-user-123");
    assert.equal(capturedEnvelope.metadata.principalSubject, "ui-user-123");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("api client initialize performs version handshake when enabled", async () => {
  const client = createClient({ performVersionHandshakeOnInit: true, sdkVersion: "1.2.0" });
  const originalFetch = globalThis.fetch;

  let requestedUrl = "";
  globalThis.fetch = async (url) => {
    requestedUrl = String(url);
    return new Response(JSON.stringify({
      platformVersion: "v4.3",
      contractVersion: "v4.3",
      minClientVersion: "1.0.0",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await client.initialize();
    assert.match(requestedUrl, /\/v1\/version$/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("api client does not retry 4xx business errors", async () => {
  const client = createClient();
  const originalFetch = globalThis.fetch;

  let attempts = 0;
  globalThis.fetch = async () => {
    attempts++;
    return new Response(JSON.stringify({ error: "invalid_input" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  };

  try {
    await assert.rejects(client.get("/test"), /API request failed with status 400/);
    assert.equal(attempts, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("api client exposes typed event subscription and pending delivery helpers", async () => {
  const events = new Map<string, Array<{ eventType: string; payloadJson: string }>>();
  const subscriberHandlers = new Map<string, (event: { eventType: string; payloadJson: string }) => void>();

  const subscriber = createEventSubscriber({
    publish: () => undefined,
    subscribe: (consumerId, handler) => {
      subscriberHandlers.set(consumerId, handler);
    },
    unsubscribe: (consumerId) => {
      subscriberHandlers.delete(consumerId);
      events.delete(consumerId);
    },
    pendingForConsumer: (consumerId) => events.get(consumerId) ?? [],
    deliverPending: async (consumerId) => {
      const pending = events.get(consumerId) ?? [];
      const handler = subscriberHandlers.get(consumerId);
      if (!handler) {
        return 0;
      }
      for (const event of pending) {
        handler(event);
      }
      return pending.length;
    },
  });

  const delivered: string[] = [];
  const handle = subscriber.subscribeToRunLifecycle("consumer-1", "run-123", (event) => {
    if (event != null && typeof event === "object" && typeof (event as { eventType?: unknown }).eventType === "string") {
      delivered.push((event as { eventType: string }).eventType);
    }
  });

  events.set("consumer-1", [{
    eventType: "platform.harness_run.status_changed",
    payloadJson: JSON.stringify({
      eventId: "evt-1",
      runId: "run-123",
      eventType: "platform.harness_run.status_changed",
      schemaVersion: 1,
      aggregateType: "run",
      aggregateId: "run-123",
      aggregateSeq: 1,
      tenantId: "tenant_abc",
      traceId: "trace-1",
      payloadHash: "hash-1",
      payload: { status: "completed" },
      replayBehavior: "replay_as_fact",
      occurredAt: new Date().toISOString(),
    }),
  }]);

  try {
    const deliveredCount = await subscriber.deliverPending("consumer-1");
    assert.equal(deliveredCount, 1);
    assert.deepEqual(delivered, ["platform.harness_run.status_changed"]);
    assert.equal(handle.consumerId, "consumer-1");
    assert.equal(handle.active, true);
  } finally {
    handle.unsubscribe();
  }
});
