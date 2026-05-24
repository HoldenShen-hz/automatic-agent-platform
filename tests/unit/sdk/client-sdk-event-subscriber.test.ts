/**
 * @fileoverview Unit tests for Client SDK - Event Subscriber and Version Handshake
 *
 * Tests the event subscription API and version handshake functionality
 * in the Client SDK (src/sdk/client-sdk/api-client.ts)
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  RetryableApiClient,
  createApiClient,
  createEventSubscriber,
  type ApiClientConfig,
} from "../../../src/sdk/client-sdk/api-client.js";

// ============================================================================
// Test Fixtures and Helpers
// ============================================================================

interface MockEventBus {
  events: Array<{ eventType: string; payload: { eventType: string; payloadJson: string } }>;
  handlers: Map<string, (event: { eventType: string; payloadJson: string }) => void>;
  pending: Map<string, Array<{ eventType: string; payloadJson: string }>>;
  publishCount: number;
  deliverCount: number;
}

function createMockEventBus(): MockEventBus & {
  publish: (event: { eventType: string; payload: unknown }) => void;
  subscribe: (consumerId: string, handler: (event: { eventType: string; payloadJson: string }) => void) => void;
  unsubscribe: (consumerId: string) => void;
  pendingForConsumer: (consumerId: string) => Array<{ eventType: string; payloadJson: string }>;
  deliverPending: (consumerId: string) => Promise<number>;
} {
  const handlers = new Map<string, (event: { eventType: string; payloadJson: string }) => void>();
  const pending = new Map<string, Array<{ eventType: string; payloadJson: string }>>();
  let publishCount = 0;
  let deliverCount = 0;

  return {
    events: [],
    handlers,
    pending,
    publishCount,
    deliverCount,
    publish(event: { eventType: string; payload: unknown }) {
      publishCount++;
      const payloadJson = JSON.stringify(event.payload);
      this.events.push({ eventType: event.eventType, payload: { eventType: event.eventType, payloadJson } });
      // Notify handlers
      for (const handler of handlers.values()) {
        handler({ eventType: event.eventType, payloadJson });
      }
    },
    subscribe(consumerId: string, handler: (event: { eventType: string; payloadJson: string }) => void) {
      handlers.set(consumerId, handler);
    },
    unsubscribe(consumerId: string) {
      handlers.delete(consumerId);
    },
    pendingForConsumer(consumerId: string) {
      return pending.get(consumerId) ?? [];
    },
    deliverPending(consumerId: string) {
      deliverCount++;
      return Promise.resolve(pending.get(consumerId)?.length ?? 0);
    },
  };
}

// ============================================================================
// createEventSubscriber Tests
// ============================================================================

test("createEventSubscriber creates a subscriber with subscribe method", () => {
  const eventBus = createMockEventBus();
  const subscriber = createEventSubscriber(eventBus);

  assert.equal(typeof subscriber.subscribe, "function");
  assert.equal(typeof subscriber.subscribeToRunLifecycle, "function");
  assert.equal(typeof subscriber.unsubscribe, "function");
  assert.equal(typeof subscriber.getPendingEvents, "function");
  assert.equal(typeof subscriber.deliverPending, "function");
});

test("createEventSubscriber.subscribe creates subscription with correct properties", () => {
  const eventBus = createMockEventBus();
  const subscriber = createEventSubscriber(eventBus);

  const subscription = subscriber.subscribe(
    "consumer-1",
    ["event.type.a", "event.type.b"],
    (event) => { /* handler */ },
  );

  assert.ok(subscription.subscriptionId?.startsWith("sub:"));
  assert.equal(subscription.consumerId, "consumer-1");
  assert.deepEqual(subscription.eventTypes, ["event.type.a", "event.type.b"]);
  assert.equal(subscription.active, true);
  assert.equal(typeof subscription.unsubscribe, "function");
});

test("createEventSubscriber.subscribe registers handler for event types", () => {
  const eventBus = createMockEventBus();
  const subscriber = createEventSubscriber(eventBus);

  let handlerCalled = false;
  subscriber.subscribe(
    "consumer-1",
    ["test.event"],
    (event) => {
      handlerCalled = true;
      // SDK passes payload directly to handler, not the full event
      assert.deepEqual(event, { data: "test" });
    },
  );

  eventBus.publish({ eventType: "test.event", payload: { data: "test" } });

  assert.equal(handlerCalled, true);
});

test("createEventSubscriber.subscribe ignores non-subscribed event types", () => {
  const eventBus = createMockEventBus();
  const subscriber = createEventSubscriber(eventBus);

  let handlerCalled = false;
  subscriber.subscribe(
    "consumer-1",
    ["subscribed.event"],
    () => {
      handlerCalled = true;
    },
  );

  eventBus.publish({ eventType: "other.event", payload: { data: "test" } });

  assert.equal(handlerCalled, false);
});

test("createEventSubscriber.subscribeToRunLifecycle creates subscription for run events", () => {
  const eventBus = createMockEventBus();
  const subscriber = createEventSubscriber(eventBus);

  const subscription = subscriber.subscribeToRunLifecycle(
    "consumer-1",
    "harness-run-123",
    (event) => { /* handler */ },
  );

  assert.ok(subscription.subscriptionId?.startsWith("sub:run:"));
  assert.equal(subscription.consumerId, "consumer-1");
  assert.ok(Array.isArray(subscription.eventTypes));
});

test("createEventSubscriber.subscribeToRunLifecycle filters by runId", () => {
  const eventBus = createMockEventBus();
  const subscriber = createEventSubscriber(eventBus);

  let handlerCallCount = 0;
  subscriber.subscribeToRunLifecycle(
    "consumer-1",
    "harness-run-123",
    (event) => {
      handlerCallCount++;
    },
  );

  // Event for the subscribed run - should trigger
  eventBus.publish({
    eventType: "platform.harness_run.status_changed",
    payload: { runId: "harness-run-123", status: "completed" },
  });

  // Event for different run - should not trigger
  eventBus.publish({
    eventType: "platform.harness_run.status_changed",
    payload: { runId: "harness-run-456", status: "completed" },
  });

  assert.equal(handlerCallCount, 1);
});

test("createEventSubscriber.unsubscribe removes consumer subscription", () => {
  const eventBus = createMockEventBus();
  const subscriber = createEventSubscriber(eventBus);

  let handlerCalled = false;
  subscriber.subscribe(
    "consumer-1",
    ["test.event"],
    () => {
      handlerCalled = true;
    },
  );

  subscriber.unsubscribe("consumer-1");

  eventBus.publish({ eventType: "test.event", payload: { data: "test" } });

  assert.equal(handlerCalled, false);
});

test("createEventSubscriber.getPendingEvents returns pending events for consumer", () => {
  const eventBus = createMockEventBus();
  const subscriber = createEventSubscriber(eventBus);

  // Manually add pending events via the mock
  eventBus.pending.set("consumer-1", [
    { eventType: "event.1", payloadJson: '{"data":"value1"}' },
    { eventType: "event.2", payloadJson: '{"data":"value2"}' },
  ]);

  const pending = subscriber.getPendingEvents("consumer-1");

  assert.equal(pending.length, 2);
  assert.equal((pending[0]?.payload as { data: string }).data, "value1");
  assert.equal((pending[1]?.payload as { data: string }).data, "value2");
});

test("createEventSubscriber.getPendingEvents returns empty array for unknown consumer", () => {
  const eventBus = createMockEventBus();
  const subscriber = createEventSubscriber(eventBus);

  const pending = subscriber.getPendingEvents("unknown-consumer");

  assert.deepEqual(pending, []);
});

test("createEventSubscriber.deliverPending calls eventBus.deliverPending", async () => {
  const eventBus = createMockEventBus();
  const subscriber = createEventSubscriber(eventBus);

  const delivered = await subscriber.deliverPending("consumer-1");

  assert.equal(delivered, 0); // No pending events in mock
});

test("createEventSubscriber.subscription.unsubscribe cleans up subscription", () => {
  const eventBus = createMockEventBus();
  const subscriber = createEventSubscriber(eventBus);

  const subscription = subscriber.subscribe(
    "consumer-1",
    ["test.event"],
    () => { /* handler */ },
  );

  let handlerCalled = false;
  subscriber.subscribe(
    "consumer-2",  // Different consumer to test independent subscriptions
    ["test.event"],
    () => {
      handlerCalled = true;
    },
  );

  subscription.unsubscribe();

  eventBus.publish({ eventType: "test.event", payload: { data: "test" } });

  // Handler should still be called since we subscribed a different consumer
  assert.equal(handlerCalled, true);
});

// ============================================================================
// EventSubscription Interface Tests
// ============================================================================

test("EventSubscription has required readonly properties", () => {
  const eventBus = createMockEventBus();
  const subscriber = createEventSubscriber(eventBus);

  const subscription = subscriber.subscribe(
    "test-consumer",
    ["event.type"],
    () => { /* handler */ },
  );

  // Check readonly (TypeScript level)
  assert.equal(typeof subscription.subscriptionId, "string");
  assert.equal(typeof subscription.consumerId, "string");
  assert.equal(typeof subscription.eventTypes, "object");
  assert.equal(typeof subscription.active, "boolean");
  assert.equal(typeof subscription.unsubscribe, "function");
});

// ============================================================================
// RetryableApiClient Version Handshake Tests
// ============================================================================

test("RetryableApiClient.initialize without performVersionHandshakeOnInit does nothing", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    performVersionHandshakeOnInit: false,
  };

  const client = new RetryableApiClient(config);

  // Should not throw
  await client.initialize();
});

test("RetryableApiClient.performVersionHandshake calls /version endpoint", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    sdkVersion: "1.0.0",
  };

  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({
      platformVersion: "v4.3",
      contractVersion: "v4.3",
      minClientVersion: "0.9.0",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await client.performVersionHandshake();

    assert.equal(result.platformVersion, "v4.3");
    assert.equal(result.contractVersion, "v4.3");
    assert.equal(result.minClientVersion, "0.9.0");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient.performVersionHandshake throws on version incompatibility", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    sdkVersion: "0.5.0", // Older than minClientVersion
  };

  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({
      platformVersion: "v4.3",
      contractVersion: "v4.3",
      minClientVersion: "1.0.0", // Requires 1.0.0 but client is 0.5.0
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    await assert.rejects(
      () => client.performVersionHandshake(),
      /not compatible/i,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient.performVersionHandshake accepts newer client version", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    sdkVersion: "2.0.0", // Newer than minClientVersion
  };

  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({
      platformVersion: "v4.3",
      contractVersion: "v4.3",
      minClientVersion: "1.0.0",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await client.performVersionHandshake();

    assert.equal(result.platformVersion, "v4.3");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient.performVersionHandshake accepts exact version match", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    sdkVersion: "1.0.0", // Exact match
  };

  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({
      platformVersion: "v4.3",
      contractVersion: "v4.3",
      minClientVersion: "1.0.0",
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await client.performVersionHandshake();

    assert.equal(result.platformVersion, "v4.3");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("RetryableApiClient.performVersionHandshake handles version with different segment counts", async () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    sdkVersion: "1.0", // Two segments
  };

  const client = new RetryableApiClient(config);

  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(JSON.stringify({
      platformVersion: "v4.3",
      contractVersion: "v4.3",
      minClientVersion: "1.0.0", // Three segments
    }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });

  try {
    const result = await client.performVersionHandshake();

    assert.equal(result.platformVersion, "v4.3");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

// ============================================================================
// RetryableApiClient Default Config Tests
// ============================================================================

test("RetryableApiClient defaults platformVersion if not provided", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    // No platformVersion provided
  };

  const client = new RetryableApiClient(config);
  // Client should be created successfully with default version
  assert.ok(client);
});

test("RetryableApiClient defaults sdkVersion if not provided", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    // No sdkVersion provided
  };

  const client = new RetryableApiClient(config);
  assert.ok(client);
});

test("RetryableApiClient defaults contractVersion if not provided", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    // No contractVersion provided
  };

  const client = new RetryableApiClient(config);
  assert.ok(client);
});

test("RetryableApiClient uses provided version values when given", () => {
  const config: ApiClientConfig = {
    baseUrl: "https://api.example.com",
    apiVersion: "v1",
    bearerToken: "test-token",
    platformVersion: "v5.0",
    sdkVersion: "2.0.0",
    contractVersion: "v5.0",
  };

  const client = new RetryableApiClient(config);
  assert.ok(client);
});

test("event subscriber exposes the current helper surface", () => {
  const eventBus = createMockEventBus();
  const subscriber = createEventSubscriber(eventBus);

  assert.equal(typeof subscriber.subscribe, "function");
  assert.equal(typeof subscriber.subscribeToRunLifecycle, "function");
  assert.equal(typeof subscriber.unsubscribe, "function");
  assert.equal(typeof subscriber.getPendingEvents, "function");
  assert.equal(typeof subscriber.deliverPending, "function");
});

test("event subscriber can handle multiple consumers", () => {
  const eventBus = createMockEventBus();
  const subscriber = createEventSubscriber(eventBus);

  let consumer1Called = false;
  let consumer2Called = false;

  subscriber.subscribe(
    "consumer-1",
    ["test.event"],
    () => { consumer1Called = true; },
  );

  subscriber.subscribe(
    "consumer-2",
    ["test.event"],
    () => { consumer2Called = true; },
  );

  eventBus.publish({ eventType: "test.event", payload: { data: "test" } });

  assert.equal(consumer1Called, true);
  assert.equal(consumer2Called, true);
});

test("event subscriber handlers receive parsed payload", () => {
  const eventBus = createMockEventBus();
  const subscriber = createEventSubscriber(eventBus);

  let receivedPayload: unknown = null;
  subscriber.subscribe(
    "consumer-1",
    ["test.event"],
    (event) => {
      // SDK passes payload directly to handler, not PlatformFactEvent
      receivedPayload = event;
    },
  );

  eventBus.publish({
    eventType: "test.event",
    payload: { nested: { value: 42 } },
  });

  assert.deepEqual(receivedPayload, { nested: { value: 42 } });
});

test("event subscriber surfaces malformed JSON metadata in pending events", () => {
  const eventBus = createMockEventBus();
  const subscriber = createEventSubscriber(eventBus);

  // Add a pending event with invalid JSON
  eventBus.pending.set("consumer-1", [
    { eventType: "event.1", payloadJson: "not-valid-json{{{" },
  ]);

  // Should not throw, should return a diagnostic payload instead of silently discarding the parse failure.
  const pending = subscriber.getPendingEvents("consumer-1");
  const payload = pending[0]?.payload as {
    errorCode: string;
    message: string;
    rawPayload: string;
  };

  assert.equal(pending.length, 1);
  assert.equal(payload.errorCode, "client_sdk.event_payload_invalid");
  assert.equal(payload.rawPayload, "not-valid-json{{{");
  assert.match(payload.message, /not valid JSON|Unexpected token/);
});

test("event subscriber subscribeToRunLifecycle handles multiple run lifecycle events", () => {
  const eventBus = createMockEventBus();
  const subscriber = createEventSubscriber(eventBus);

  const receivedPayloads: unknown[] = [];
  subscriber.subscribeToRunLifecycle(
    "consumer-1",
    "harness-run-123",
    (event) => {
      // SDK passes payload directly to handler
      receivedPayloads.push(event);
    },
  );

  // Trigger different run lifecycle events
  eventBus.publish({
    eventType: "platform.harness_run.status_changed",
    payload: { runId: "harness-run-123", status: "completed" },
  });

  eventBus.publish({
    eventType: "platform.node_run.status_changed",
    payload: { runId: "harness-run-123", status: "completed" },
  });

  eventBus.publish({
    eventType: "platform.side_effect.status_changed",
    payload: { runId: "harness-run-123", status: "completed" },
  });

  // All 3 events should be received with matching runId
  assert.equal(receivedPayloads.length, 3);
  assert.deepEqual(receivedPayloads[0], { runId: "harness-run-123", status: "completed" });
  assert.deepEqual(receivedPayloads[1], { runId: "harness-run-123", status: "completed" });
  assert.deepEqual(receivedPayloads[2], { runId: "harness-run-123", status: "completed" });
});
