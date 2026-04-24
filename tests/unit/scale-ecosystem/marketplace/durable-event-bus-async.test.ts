/**
 * Unit tests for DurableEventBusAsync
 *
 * @see src/scale-ecosystem/marketplace/durable-event-bus-async.ts
 */

import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { join } from "node:path";

import { DurableEventBusAsync } from "../../../../src/scale-ecosystem/marketplace/durable-event-bus-async.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

function createTestBus(): DurableEventBusAsync {
  const workspace = createTempWorkspace("aa-durable-bus-");
  const dbPath = join(workspace, "durable-bus.db");

  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  const bus = new DurableEventBusAsync(db, store);
  return bus;
}

test("DurableEventBusAsync constructor applies default options", () => {
  const workspace = createTempWorkspace("aa-durable-default-");
  const dbPath = join(workspace, "durable-default.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const bus = new DurableEventBusAsync(db, store);

    const metrics = bus.getMetrics();
    assert.equal(metrics.totalPublishedEvents, 0);
    assert.equal(metrics.totalDeliveredEvents, 0);

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("DurableEventBusAsync constructor applies custom options", () => {
  const workspace = createTempWorkspace("aa-durable-custom-");
  const dbPath = join(workspace, "durable-custom.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const bus = new DurableEventBusAsync(db, store, {
      maxDeliveryRetries: 5,
      initialBackoffMs: 200,
      maxBackoffMs: 10000,
      defaultTimeoutMs: 60000,
      maxBatchSize: 100,
      batchingEnabled: true,
    });

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test.skip("DurableEventBusAsync subscribe adds subscriber", () => {
  const bus = createTestBus();

  try {
    let callCount = 0;
    const handler = () => { callCount++; };

    bus.subscribe("consumer_1", handler);

    const subscriber = bus.getSubscriber("consumer_1");
    assert.ok(subscriber !== undefined);
    assert.equal(subscriber!.priority, "normal");

    bus.dispose();
  } finally {
    cleanupPath((bus as any).sync.store.dbPath as string);
  }
});

test.skip("DurableEventBusAsync subscribeHighPriority adds high priority subscriber", () => {
  const bus = createTestBus();

  try {
    bus.subscribeHighPriority("consumer_high", () => {});

    const subscriber = bus.getSubscriber("consumer_high");
    assert.ok(subscriber !== undefined);
    assert.equal(subscriber!.priority, "high");

    bus.dispose();
  } finally {
    cleanupPath((bus as any).sync.store.dbPath as string);
  }
});

test.skip("DurableEventBusAsync subscribeLowPriority adds low priority subscriber", () => {
  const bus = createTestBus();

  try {
    bus.subscribeLowPriority("consumer_low", () => {});

    const subscriber = bus.getSubscriber("consumer_low");
    assert.ok(subscriber !== undefined);
    assert.equal(subscriber!.priority, "low");

    bus.dispose();
  } finally {
    cleanupPath((bus as any).sync.store.dbPath as string);
  }
});

test.skip("DurableEventBusAsync unsubscribe removes subscriber", () => {
  const bus = createTestBus();

  try {
    bus.subscribe("consumer_remove", () => {});
    assert.ok(bus.getSubscriber("consumer_remove") !== undefined);

    bus.unsubscribe("consumer_remove");
    assert.equal(bus.getSubscriber("consumer_remove"), undefined);

    bus.dispose();
  } finally {
    cleanupPath((bus as any).sync.store.dbPath as string);
  }
});

test.skip("DurableEventBusAsync getAllSubscribers returns all subscribers", () => {
  const bus = createTestBus();

  try {
    bus.subscribe("consumer_a", () => {});
    bus.subscribe("consumer_b", () => {});
    bus.subscribeHighPriority("consumer_c", () => {});

    const all = bus.getAllSubscribers();
    assert.equal(all.size, 3);
    assert.ok(all.has("consumer_a"));
    assert.ok(all.has("consumer_b"));
    assert.ok(all.has("consumer_c"));

    bus.dispose();
  } finally {
    cleanupPath((bus as any).sync.store.dbPath as string);
  }
});

test.skip("DurableEventBusAsync publish emits event_published", async () => {
  const bus = createTestBus();

  try {
    let publishedEvent: any = null;
    bus.on("event_published", (event: any) => { publishedEvent = event; });

    const record = await bus.publish({
      eventType: "test.event",
      payload: { message: "hello" },
    });

    assert.ok(record !== null);
    assert.equal(record.eventType, "test.event");
    assert.ok(publishedEvent !== null);
    assert.equal(publishedEvent.eventType, "test.event");

    bus.dispose();
  } finally {
    cleanupPath((bus as any).sync.store.dbPath as string);
  }
});

test.skip("DurableEventBusAsync publish rejects payload exceeding max size", async () => {
  const bus = createTestBus();

  try {
    const largePayload = { data: "x".repeat(1_000_001) };

    await assert.rejects(
      async () => bus.publish({
        eventType: "test.large",
        payload: largePayload,
      }),
      /exceeds maximum/
    );

    bus.dispose();
  } finally {
    cleanupPath((bus as any).sync.store.dbPath as string);
  }
});

test.skip("DurableEventBusAsync publish throws when circuit breaker is open", async () => {
  const bus = createTestBus();

  try {
    // Force circuit breaker open by setting failure state
    (bus as any).circuitBreakerOpen = true;
    (bus as any).lastFailureTime = Date.now();

    await assert.rejects(
      async () => bus.publish({
        eventType: "test.circuit",
        payload: { data: "test" },
      }),
      /Circuit breaker/
    );

    bus.dispose();
  } finally {
    cleanupPath((bus as any).sync.store.dbPath as string);
  }
});

test.skip("DurableEventBusAsync pendingForConsumer returns pending events", () => {
  const bus = createTestBus();

  try {
    bus.subscribe("consumer_pending", () => {});

    const pending = bus.pendingForConsumer("consumer_pending");
    assert.ok(Array.isArray(pending));

    bus.dispose();
  } finally {
    cleanupPath((bus as any).sync.store.dbPath as string);
  }
});

test.skip("DurableEventBusAsync pendingForConsumerAsync returns promise", async () => {
  const bus = createTestBus();

  try {
    bus.subscribe("consumer_async", () => {});

    const pending = await bus.pendingForConsumerAsync("consumer_async");
    assert.ok(Array.isArray(pending));

    bus.dispose();
  } finally {
    cleanupPath((bus as any).sync.store.dbPath as string);
  }
});

test.skip("DurableEventBusAsync getPendingCount returns count", () => {
  const bus = createTestBus();

  try {
    bus.subscribe("consumer_count", () => {});

    const count = bus.getPendingCount("consumer_count");
    assert.equal(typeof count, "number");

    bus.dispose();
  } finally {
    cleanupPath((bus as any).sync.store.dbPath as string);
  }
});

test.skip("DurableEventBusAsync getMetrics returns metrics object", () => {
  const bus = createTestBus();

  try {
    const metrics = bus.getMetrics();

    assert.ok("totalPublishedEvents" in metrics);
    assert.ok("totalDeliveredEvents" in metrics);
    assert.ok("totalFailedDeliveries" in metrics);
    assert.ok("totalDeadLetteredEvents" in metrics);
    assert.ok("averageDeliveryLatencyMs" in metrics);
    assert.ok("averagePublishLatencyMs" in metrics);

    bus.dispose();
  } finally {
    cleanupPath((bus as any).sync.store.dbPath as string);
  }
});

test.skip("DurableEventBusAsync resetMetrics resets all values", () => {
  const bus = createTestBus();

  try {
    bus.resetMetrics();

    const metrics = bus.getMetrics();
    assert.equal(metrics.totalPublishedEvents, 0);
    assert.equal(metrics.totalDeliveredEvents, 0);
    assert.equal(metrics.totalFailedDeliveries, 0);

    bus.dispose();
  } finally {
    cleanupPath((bus as any).sync.store.dbPath as string);
  }
});

test.skip("DurableEventBusAsync getSyncService returns sync service", () => {
  const bus = createTestBus();

  try {
    const syncService = bus.getSyncService();
    assert.ok(syncService !== null);

    bus.dispose();
  } finally {
    cleanupPath((bus as any).sync.store.dbPath as string);
  }
});

test.skip("DurableEventBusAsync dispose prevents further operations", () => {
  const bus = createTestBus();
  const dbPath = (bus as any).sync.store.dbPath;

  bus.dispose();

  assert.throws(
    () => bus.subscribe("after_dispose", () => {}),
    /disposed/
  );

  cleanupPath(dbPath);
});

test.skip("DurableEventBusAsync double dispose is safe", () => {
  const bus = createTestBus();
  const dbPath = (bus as any).sync.store.dbPath;

  bus.dispose();
  bus.dispose(); // Should not throw

  cleanupPath(dbPath);
});

test.skip("DurableEventBusAsync emits subscriber_added event", () => {
  const bus = createTestBus();

  try {
    let addedEvent: any = null;
    bus.on("subscriber_added", (event: any) => { addedEvent = event; });

    bus.subscribe("new_consumer", () => {});

    assert.ok(addedEvent !== null);
    assert.equal(addedEvent.consumerId, "new_consumer");
    assert.equal(addedEvent.priority, "normal");

    bus.dispose();
  } finally {
    cleanupPath((bus as any).sync.store.dbPath as string);
  }
});

test.skip("DurableEventBusAsync emits subscriber_removed event", () => {
  const bus = createTestBus();

  try {
    let removedEvent: any = null;
    bus.on("subscriber_removed", (event: any) => { removedEvent = event; });

    bus.subscribe("remove_me", () => {});
    bus.unsubscribe("remove_me");

    assert.ok(removedEvent !== null);
    assert.equal(removedEvent.consumerId, "remove_me");

    bus.dispose();
  } finally {
    cleanupPath((bus as any).sync.store.dbPath as string);
  }
});

test.skip("DurableEventBusAsync circuit breaker closes after backoff", async () => {
  const bus = createTestBus();

  try {
    let circuitCloseEvent: any = null;
    bus.on("circuit_breaker_close", () => { circuitCloseEvent = true; });

    // Open circuit breaker
    (bus as any).circuitBreakerOpen = true;
    (bus as any).lastFailureTime = Date.now() - 10000; // 10 seconds ago
    (bus as any).failureCount = 5;

    // Should close circuit since maxBackoffMs (5000) has passed
    await bus.publish({
      eventType: "test.circuit.close",
      payload: { data: "test" },
    });

    assert.equal((bus as any).circuitBreakerOpen, false);

    bus.dispose();
  } finally {
    cleanupPath((bus as any).sync.store.dbPath as string);
  }
});