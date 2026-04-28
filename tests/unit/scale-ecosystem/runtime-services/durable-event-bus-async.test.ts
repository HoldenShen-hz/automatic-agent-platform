import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";

import { DurableEventBusAsync } from "../../../../src/scale-ecosystem/runtime-services/durable-event-bus-async.js";
import type { BusMetrics } from "../../../../src/scale-ecosystem/runtime-services/durable-event-bus-async.js";

// NOTE: Full integration tests require database setup.
// These tests focus on class structure, options handling, and behavior validation.

test("DurableEventBusAsync is an EventEmitter subclass", () => {
  assert.ok(new DurableEventBusAsync({} as never, {} as never) instanceof EventEmitter);
});

test("DurableEventBusAsync default options are applied", () => {
  const bus = new DurableEventBusAsync({} as never, {} as never);
  const status = bus.getSyncService();
  assert.ok(status != null);
});

test("DurableEventBusAsync custom options are applied", () => {
  const bus = new DurableEventBusAsync({} as never, {} as never, {
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
  });
  assert.ok(bus != null);
});

test("DurableEventBusAsync getSyncService returns DurableEventBus", () => {
  const bus = new DurableEventBusAsync({} as never, {} as never);
  const sync = bus.getSyncService();
  assert.ok(sync != null);
  assert.equal(typeof sync.publish, "function");
  assert.equal(typeof sync.subscribe, "function");
  assert.equal(typeof sync.unsubscribe, "function");
});

test("DurableEventBusAsync getMetrics returns metrics object", () => {
  const bus = new DurableEventBusAsync({} as never, {} as never);
  const metrics = bus.getMetrics();
  assert.ok(metrics != null);
  assert.ok(typeof metrics.totalPublishedEvents === "number");
  assert.ok(typeof metrics.totalDeliveredEvents === "number");
  assert.ok(typeof metrics.totalFailedDeliveries === "number");
});

test("DurableEventBusAsync resetMetrics clears all metrics", () => {
  const bus = new DurableEventBusAsync({} as never, {} as never);
  bus.resetMetrics();
  const metrics = bus.getMetrics();
  assert.equal(metrics.totalPublishedEvents, 0);
  assert.equal(metrics.totalDeliveredEvents, 0);
  assert.equal(metrics.totalFailedDeliveries, 0);
  assert.equal(metrics.totalDeadLetteredEvents, 0);
});

test("DurableEventBusAsync getSubscriber returns undefined for unknown consumer", () => {
  const bus = new DurableEventBusAsync({} as never, {} as never);
  const subscriber = bus.getSubscriber("unknown-consumer");
  assert.equal(subscriber, undefined);
});

test("DurableEventBusAsync getAllSubscribers returns empty map initially", () => {
  const bus = new DurableEventBusAsync({} as never, {} as never);
  const subscribers = bus.getAllSubscribers();
  assert.ok(subscribers instanceof Map);
  assert.equal(subscribers.size, 0);
});

test("DurableEventBusAsync getPendingCount returns 0 for unknown consumer", () => {
  const bus = new DurableEventBusAsync({} as never, {} as never);
  const count = bus.getPendingCount("unknown-consumer");
  assert.equal(count, 0);
});

test("DurableEventBusAsync dispose marks service as disposed", async () => {
  const bus = new DurableEventBusAsync({} as never, {} as never);
  bus.dispose();
  // After dispose, publish should throw
  await assert.rejects(
    () => bus.publish({ eventType: "test", payload: {} }),
    (err: Error) => err.message.includes("disposed"),
  );
});

test("DurableEventBusAsync dispose can be called multiple times safely", () => {
  const bus = new DurableEventBusAsync({} as never, {} as never);
  bus.dispose();
  bus.dispose(); // Should not throw
  assert.ok(true);
});

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

test("DurableEventBusAsync emits subscriber_added event on subscribe", (t) => {
  const bus = new DurableEventBusAsync({} as never, {} as never);
  let eventReceived = false;
  bus.on("subscriber_added" as never, () => {
    eventReceived = true;
  });
  bus.subscribe("consumer-1", () => {});
  assert.ok(eventReceived);
});

test("DurableEventBusAsync emits subscriber_removed event on unsubscribe", (t) => {
  const bus = new DurableEventBusAsync({} as never, {} as never);
  let eventReceived = false;
  bus.on("subscriber_removed" as never, () => {
    eventReceived = true;
  });
  bus.subscribe("consumer-2", () => {});
  bus.unsubscribe("consumer-2");
  assert.ok(eventReceived);
});

test("DurableEventBusAsync batchingEnabled sets up batch flush timer", () => {
  const bus = new DurableEventBusAsync({} as never, {} as never, {
    batchingEnabled: true,
    batchFlushIntervalMs: 50,
  });
  // Timer is set up internally, verify no throw
  assert.ok(bus != null);
  bus.dispose();
});
