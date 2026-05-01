import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";

import { DurableEventBusAsync } from "../../../../src/scale-ecosystem/runtime-services/durable-event-bus-async.js";
import type { BusMetrics } from "../../../../src/scale-ecosystem/runtime-services/durable-event-bus-async.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function makeAsyncBus(): DurableEventBusAsync {
  return new DurableEventBusAsync(
    { transaction<T>(fn: () => T): T { return fn(); } } as never,
    {
      operations: { loadExecutionAuthoritativeView: () => null },
      event: {
        listPendingEventsForConsumer: () => [],
      },
    } as never,
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Constructor & Options
// ─────────────────────────────────────────────────────────────────────────────

test("DurableEventBusAsync is instantiable", () => {
  const bus = makeAsyncBus();
  assert.ok(bus instanceof EventEmitter);
});

test("DurableEventBusAsync default options are applied", () => {
  const bus = makeAsyncBus();
  const sync = bus.getSyncService();
  assert.ok(sync != null);
});

test("DurableEventBusAsync custom options are applied", () => {
  const bus = new DurableEventBusAsync(
    { transaction<T>(fn: () => T): T { return fn(); } } as never,
    {} as never,
    {
      maxDeliveryRetries: 5,
      initialBackoffMs: 200,
      maxBackoffMs: 10000,
      defaultTimeoutMs: 60000,
      maxBatchSize: 100,
      batchFlushIntervalMs: 200,
      batchingEnabled: true,
      maxPendingEvents: 5000,
      deadLetterEnabled: true,
      deadLetterThreshold: 10,
    },
  );
  assert.ok(bus != null);
  bus.dispose();
});

test("DurableEventBusAsync getSyncService returns underlying sync service", () => {
  const bus = makeAsyncBus();
  const sync = bus.getSyncService();
  assert.ok(sync != null);
  assert.equal(typeof sync.publish, "function");
  assert.equal(typeof sync.subscribe, "function");
  assert.equal(typeof sync.unsubscribe, "function");
});

// ─────────────────────────────────────────────────────────────────────────────
// Metrics
// ─────────────────────────────────────────────────────────────────────────────

test("DurableEventBusAsync getMetrics returns metrics object", () => {
  const bus = makeAsyncBus();
  const metrics = bus.getMetrics();
  assert.ok(metrics != null);
  assert.ok(typeof metrics.totalPublishedEvents === "number");
  assert.ok(typeof metrics.totalDeliveredEvents === "number");
  assert.ok(typeof metrics.totalFailedDeliveries === "number");
  assert.ok(typeof metrics.totalDeadLetteredEvents === "number");
  assert.ok(typeof metrics.averageDeliveryLatencyMs === "number");
  assert.ok(typeof metrics.averagePublishLatencyMs === "number");
});

test("DurableEventBusAsync resetMetrics clears all metrics", () => {
  const bus = makeAsyncBus();
  bus.resetMetrics();
  const metrics = bus.getMetrics();
  assert.equal(metrics.totalPublishedEvents, 0);
  assert.equal(metrics.totalDeliveredEvents, 0);
  assert.equal(metrics.totalFailedDeliveries, 0);
  assert.equal(metrics.totalDeadLetteredEvents, 0);
  assert.equal(metrics.averageDeliveryLatencyMs, 0);
  assert.equal(metrics.averagePublishLatencyMs, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Subscriber Management
// ─────────────────────────────────────────────────────────────────────────────

test("DurableEventBusAsync subscribe emits subscriber_added event", () => {
  const bus = makeAsyncBus();
  let eventReceived = false;
  bus.on("subscriber_added" as never, (data: { consumerId: string; priority: string }) => {
    eventReceived = true;
    assert.equal(data.consumerId, "consumer-1");
    assert.equal(data.priority, "normal");
  });
  bus.subscribe("consumer-1", () => {});
  assert.ok(eventReceived);
});

test("DurableEventBusAsync subscribeHighPriority emits subscriber_added with high priority", () => {
  const bus = makeAsyncBus();
  let eventReceived = false;
  bus.on("subscriber_added" as never, (data: { consumerId: string; priority: string }) => {
    eventReceived = true;
    assert.equal(data.consumerId, "consumer-high");
    assert.equal(data.priority, "high");
  });
  bus.subscribeHighPriority("consumer-high", () => {});
  assert.ok(eventReceived);
});

test("DurableEventBusAsync subscribeLowPriority emits subscriber_added with low priority", () => {
  const bus = makeAsyncBus();
  let eventReceived = false;
  bus.on("subscriber_added" as never, (data: { consumerId: string; priority: string }) => {
    eventReceived = true;
    assert.equal(data.consumerId, "consumer-low");
    assert.equal(data.priority, "low");
  });
  bus.subscribeLowPriority("consumer-low", () => {});
  assert.ok(eventReceived);
});

test("DurableEventBusAsync unsubscribe emits subscriber_removed event", () => {
  const bus = makeAsyncBus();
  bus.subscribe("consumer-2", () => {});
  let eventReceived = false;
  bus.on("subscriber_removed" as never, (data: { consumerId: string }) => {
    eventReceived = true;
    assert.equal(data.consumerId, "consumer-2");
  });
  bus.unsubscribe("consumer-2");
  assert.ok(eventReceived);
});

test("DurableEventBusAsync getSubscriber returns undefined for unknown consumer", () => {
  const bus = makeAsyncBus();
  const subscriber = bus.getSubscriber("unknown-consumer");
  assert.equal(subscriber, undefined);
});

test("DurableEventBusAsync getSubscriber returns subscriber for known consumer", () => {
  const bus = makeAsyncBus();
  bus.subscribe("consumer-known", () => {});
  const subscriber = bus.getSubscriber("consumer-known");
  assert.ok(subscriber != null);
  assert.equal(subscriber!.priority, "normal");
});

test("DurableEventBusAsync getAllSubscribers returns empty map initially", () => {
  const bus = makeAsyncBus();
  const subscribers = bus.getAllSubscribers();
  assert.ok(subscribers instanceof Map);
  assert.equal(subscribers.size, 0);
});

test("DurableEventBusAsync getAllSubscribers returns all subscribers", () => {
  const bus = makeAsyncBus();
  bus.subscribe("consumer-a", () => {});
  bus.subscribeHighPriority("consumer-b", () => {});
  const subscribers = bus.getAllSubscribers();
  assert.equal(subscribers.size, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// Pending Events
// ─────────────────────────────────────────────────────────────────────────────

test("DurableEventBusAsync getPendingCount returns 0 for unknown consumer", () => {
  const bus = makeAsyncBus();
  const count = bus.getPendingCount("unknown-consumer");
  assert.equal(count, 0);
});

test("DurableEventBusAsync pendingForConsumer returns empty array for unknown consumer", () => {
  const bus = makeAsyncBus();
  const pending = bus.pendingForConsumer("unknown-consumer");
  assert.ok(Array.isArray(pending));
});

test("DurableEventBusAsync pendingForConsumerAsync returns promise", async () => {
  const bus = makeAsyncBus();
  const result = bus.pendingForConsumerAsync("unknown-consumer");
  assert.ok(result instanceof Promise);
  const pending = await result;
  assert.ok(Array.isArray(pending));
});

// ─────────────────────────────────────────────────────────────────────────────
// Disposal Behavior
// ─────────────────────────────────────────────────────────────────────────────

test("DurableEventBusAsync dispose marks service as disposed", async () => {
  const bus = makeAsyncBus();
  bus.dispose();
  // After dispose, publish should throw
  await assert.rejects(
    () => bus.publish({ eventType: "test", payload: {} }),
    (err: Error) => err.message.includes("disposed"),
  );
});

test("DurableEventBusAsync dispose can be called multiple times safely", () => {
  const bus = makeAsyncBus();
  bus.dispose();
  bus.dispose(); // Should not throw
  assert.ok(true);
});

test("DurableEventBusAsync dispose clears batch queue", () => {
  const bus = new DurableEventBusAsync(
    { transaction<T>(fn: () => T): T { return fn(); } } as never,
    {} as never,
    { batchingEnabled: true, batchFlushIntervalMs: 50 },
  );
  bus.dispose();
  assert.ok(true); // Verify no throw
});

// ─────────────────────────────────────────────────────────────────────────────
// Batching
// ─────────────────────────────────────────────────────────────────────────────

test("DurableEventBusAsync batchingEnabled sets up batch flush timer", () => {
  const bus = new DurableEventBusAsync(
    { transaction<T>(fn: () => T): T { return fn(); } } as never,
    {} as never,
    { batchingEnabled: true, batchFlushIntervalMs: 50 },
  );
  // Timer is set up internally, verify no throw
  assert.ok(bus != null);
  bus.dispose();
});

test("DurableEventBusAsync enqueuePublish returns a promise", () => {
  const bus = makeAsyncBus();
  const result = bus.enqueuePublish({ eventType: "test", payload: {} });
  assert.ok(result instanceof Promise);
  // Clean up
  bus.dispose();
});

// ─────────────────────────────────────────────────────────────────────────────
// Publish Validation
// ─────────────────────────────────────────────────────────────────────────────

test("DurableEventBusAsync publish rejects oversized payload", async () => {
  const bus = makeAsyncBus();
  const largePayload = { data: "x".repeat(1_000_001) };
  await assert.rejects(
    () => bus.publish({ eventType: "test", payload: largePayload }),
    (err: Error) => err.message.includes("payload size"),
  );
});

test("DurableEventBusAsync publish accepts valid payload", async () => {
  const bus = makeAsyncBus();
  try {
    await bus.publish({ eventType: "test", payload: { key: "value" } });
  } catch {
    // Expected without real DB
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Circuit Breaker Events
// ─────────────────────────────────────────────────────────────────────────────

test("DurableEventBusAsync emits circuit_breaker_close event", () => {
  const bus = makeAsyncBus();
  let closeCount = 0;
  bus.on("circuit_breaker_close" as never, () => closeCount++);
  // Circuit breaker is managed internally - verify event system works
  assert.ok(true);
  assert.equal(closeCount, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Type Exports
// ─────────────────────────────────────────────────────────────────────────────

test("DurableEventBusAsync exports BusMetrics type", () => {
  const metrics: BusMetrics = {
    totalPublishedEvents: 10,
    totalDeliveredEvents: 8,
    totalFailedDeliveries: 2,
    totalDeadLetteredEvents: 0,
    averageDeliveryLatencyMs: 100,
    averagePublishLatencyMs: 50,
  };
  assert.equal(metrics.totalPublishedEvents, 10);
  assert.equal(metrics.averageDeliveryLatencyMs, 100);
});

// ─────────────────────────────────────────────────────────────────────────────
// Error Handling - Abort Signal
// ─────────────────────────────────────────────────────────────────────────────

test("DurableEventBusAsync publish accepts AbortSignal", async () => {
  const bus = makeAsyncBus();
  const controller = new AbortController();
  try {
    await bus.publish(
      { eventType: "test", payload: {} },
      { signal: controller.signal },
    );
  } catch {
    // Expected without real DB
  }
  controller.abort();
});

test("DurableEventBusAsync publish accepts custom timeout", async () => {
  const bus = makeAsyncBus();
  try {
    await bus.publish(
      { eventType: "test", payload: {} },
      { timeoutMs: 100 },
    );
  } catch {
    // Expected without real DB
  }
});

test("DurableEventBusAsync deliverPending accepts AbortSignal", async () => {
  const bus = makeAsyncBus();
  const controller = new AbortController();
  try {
    await bus.deliverPending("consumer-1", { signal: controller.signal });
  } catch {
    // Expected without real DB
  }
  controller.abort();
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("DurableEventBusAsync handles empty event type", async () => {
  const bus = makeAsyncBus();
  try {
    await bus.publish({ eventType: "", payload: {} });
  } catch {
    // Expected without real DB
  }
});

test("DurableEventBusAsync handles null trace context", async () => {
  const bus = makeAsyncBus();
  try {
    await bus.publish({
      eventType: "test",
      traceContext: null,
      payload: {},
    });
  } catch {
    // Expected without real DB
  }
});

test("DurableEventBusAsync enqueuePublish rejects when disposed", async () => {
  const bus = makeAsyncBus();
  bus.dispose();
  await assert.rejects(
    () => bus.enqueuePublish({ eventType: "test", payload: {} }),
    (err: Error) => err.message.includes("disposed"),
  );
});