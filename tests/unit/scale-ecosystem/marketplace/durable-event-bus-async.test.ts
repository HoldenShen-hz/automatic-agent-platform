import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { DurableEventBusAsync as MarketplaceDurableEventBusAsync } from "../../../../src/scale-ecosystem/marketplace/durable-event-bus-async.js";
import { DurableEventBusAsync as PlatformDurableEventBusAsync } from "../../../../src/platform/five-plane-state-evidence/events/durable-event-bus-async.js";
import { DurableEventBus } from "../../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";

function createTestBus(workspace: string): { bus: MarketplaceDurableEventBusAsync; db: SqliteDatabase; store: AuthoritativeTaskStore } {
  const db = new SqliteDatabase(join(workspace, "marketplace-durable-events.db"));
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const bus = new MarketplaceDurableEventBusAsync(db, store);
  return { bus, db, store };
}

test("marketplace DurableEventBusAsync aliases the platform async implementation [durable-event-bus-async]", () => {
  assert.equal(MarketplaceDurableEventBusAsync, PlatformDurableEventBusAsync);
  assert.equal(typeof MarketplaceDurableEventBusAsync.prototype.subscribe, "function");
  assert.equal(typeof MarketplaceDurableEventBusAsync.prototype.publish, "function");
  assert.equal(typeof MarketplaceDurableEventBusAsync.prototype.publishBatch, "function");
  assert.equal(typeof MarketplaceDurableEventBusAsync.prototype.deliverPending, "function");
  assert.equal(typeof MarketplaceDurableEventBusAsync.prototype.pendingForConsumerAsync, "function");
  assert.equal(typeof MarketplaceDurableEventBusAsync.prototype.getSyncService, "function");
});

test("marketplace DurableEventBusAsync publishes and delivers through the async mirror [durable-event-bus-async]", async () => {
  const workspace = createTempWorkspace("aa-marketplace-durable-bus-");
  try {
    const { bus, db, store } = createTestBus(workspace);
    seedTaskAndExecution(db, store, {
      taskId: "task-marketplace-bus",
      executionId: "exec-marketplace-bus",
      traceId: "trace-marketplace-bus",
    });

    const delivered: string[] = [];
    bus.subscribe("marketplace_projection", async (event) => {
      delivered.push(event.eventType);
    });

    const event = await bus.publish({
      eventType: "task:status_changed",
      taskId: "task-marketplace-bus",
      executionId: "exec-marketplace-bus",
      traceId: "trace-marketplace-bus",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    const deliveredCount = await bus.deliverPending("marketplace_projection");

    assert.equal(event.eventType, "task:status_changed");
    assert.equal(deliveredCount, 1);
    assert.deepEqual(delivered, ["task:status_changed"]);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("marketplace DurableEventBusAsync exposes sync bus access and pending helpers [durable-event-bus-async]", async () => {
  const workspace = createTempWorkspace("aa-marketplace-durable-bus-pending-");
  try {
    const { bus, db, store } = createTestBus(workspace);
    seedTaskAndExecution(db, store, {
      taskId: "task-marketplace-pending",
      executionId: "exec-marketplace-pending",
      traceId: "trace-marketplace-pending",
    });

    bus.subscribe("pending_consumer", async () => undefined);

    const syncBus = bus.getSyncService();
    assert.ok(syncBus instanceof DurableEventBus);

    const pendingSync = bus.pendingForConsumer("pending_consumer");
    const pendingAsync = await bus.pendingForConsumerAsync("pending_consumer");
    assert.ok(Array.isArray(pendingSync));
    assert.ok(Array.isArray(pendingAsync));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("marketplace DurableEventBusAsync delegates batch publishing to the platform async service [durable-event-bus-async]", async () => {
  const workspace = createTempWorkspace("aa-marketplace-durable-bus-batch-");
  try {
    const { bus, db, store } = createTestBus(workspace);
    seedTaskAndExecution(db, store, {
      taskId: "task-marketplace-batch",
      executionId: "exec-marketplace-batch",
      traceId: "trace-marketplace-batch",
    });

    bus.subscribe("batch_consumer", async () => undefined);

    const events = await bus.publishBatch([
      {
        eventType: "task:status_changed",
        taskId: "task-marketplace-batch",
        executionId: "exec-marketplace-batch",
        traceId: "trace-marketplace-batch",
        payload: { fromStatus: "queued", toStatus: "in_progress" },
      },
      {
        eventType: "task:status_changed",
        taskId: "task-marketplace-batch",
        executionId: "exec-marketplace-batch",
        traceId: "trace-marketplace-batch",
        payload: { fromStatus: "in_progress", toStatus: "done" },
      },
    ]);

    assert.equal(events.length, 2);
    assert.ok(events.every((event) => event.eventType === "task:status_changed"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
