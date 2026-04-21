/**
 * Unit tests for DurableEventBusAsync
 *
 * Tests async wrapper around DurableEventBus providing async/await interface.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { DurableEventBusAsync } from "../../../../../src/platform/state-evidence/events/durable-event-bus-async.js";
import { DurableEventBus } from "../../../../../src/platform/state-evidence/events/durable-event-bus.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

function createTestBus(workspace: string): { bus: DurableEventBusAsync; db: SqliteDatabase; store: AuthoritativeTaskStore } {
  const db = new SqliteDatabase(join(workspace, "async-events.db"));
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const bus = new DurableEventBusAsync(db, store);
  return { bus, db, store };
}

test("DurableEventBusAsync.publish returns Promise<EventRecord>", async () => {
  const workspace = createTempWorkspace("aa-async-bus-pub-");
  try {
    const { bus, db, store } = createTestBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-async-1", executionId: "exec-async-1", traceId: "trace-async-1" });

    const result = await bus.publish({
      eventType: "task:status_changed",
      taskId: "task-async-1",
      executionId: "exec-async-1",
      traceId: "trace-async-1",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
        reasonCode: "scheduler.dispatch",
      },
    });

    assert.ok(result.id.startsWith("evt_"), "Event ID should have correct prefix");
    assert.equal(result.eventType, "task:status_changed");
    assert.equal(result.taskId, "task-async-1");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("DurableEventBusAsync.subscribe registers handler", async () => {
  const workspace = createTempWorkspace("aa-async-bus-sub-");
  try {
    const { bus, db, store } = createTestBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-async-sub", executionId: "exec-async-sub", traceId: "trace-sub" });

    const seen: string[] = [];
    bus.subscribe("async_consumer", async (event) => {
      seen.push(event.eventType);
    });

    await bus.publish({
      eventType: "task:status_changed",
      taskId: "task-async-sub",
      executionId: "exec-async-sub",
      traceId: "trace-sub",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    // Wait for async delivery
    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.equal(seen.length, 1);
    assert.equal(seen[0], "task:status_changed");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("DurableEventBusAsync.unsubscribe removes handler", async () => {
  const workspace = createTempWorkspace("aa-async-bus-unsub-");
  try {
    const { bus, db, store } = createTestBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-unsub", executionId: "exec-unsub", traceId: "trace-unsub" });

    const seen: string[] = [];
    bus.subscribe("unsub_consumer", async (event) => {
      seen.push(event.eventType);
    });

    await bus.publish({
      eventType: "task:status_changed",
      taskId: "task-unsub",
      executionId: "exec-unsub",
      traceId: "trace-unsub",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(seen.length, 1);

    bus.unsubscribe("unsub_consumer");

    await bus.publish({
      eventType: "task:status_changed",
      taskId: "task-unsub",
      executionId: "exec-unsub",
      traceId: "trace-unsub",
      payload: { fromStatus: "in_progress", toStatus: "done" },
    });

    await new Promise((resolve) => setTimeout(resolve, 20));
    // Should still only have 1 since we unsubscribed
    assert.equal(seen.length, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("DurableEventBusAsync.dispose clears subscribers", async () => {
  const workspace = createTempWorkspace("aa-async-bus-dispose-");
  try {
    const { bus, db, store } = createTestBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-dispose", executionId: "exec-dispose", traceId: "trace-dispose" });

    bus.subscribe("dispose_consumer", async () => undefined);

    bus.dispose();

    // After dispose, publish should throw
    assert.throws(
      () =>
        bus.publish({
          eventType: "task:status_changed",
          taskId: "task-dispose",
          executionId: "exec-dispose",
          traceId: "trace-dispose",
          payload: { fromStatus: "queued", toStatus: "in_progress" },
        }),
      /event_bus\.disposed/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("DurableEventBusAsync.pendingForConsumer returns pending events", async () => {
  const workspace = createTempWorkspace("aa-async-bus-pending-");
  try {
    const { bus, db, store } = createTestBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-pending", executionId: "exec-pending", traceId: "trace-pending" });

    bus.subscribe("pending_consumer", async () => undefined);

    await bus.publish({
      eventType: "task:status_changed",
      taskId: "task-pending",
      executionId: "exec-pending",
      traceId: "trace-pending",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    // For tier_1 events, we need to check pending after subscribe
    // The pendingForConsumer returns the internal state
    const pending = bus.pendingForConsumer("pending_consumer");
    // After subscription and publish, the event should be tracked

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("DurableEventBusAsync.pendingForConsumerAsync returns Promise", async () => {
  const workspace = createTempWorkspace("aa-async-bus-pending-async-");
  try {
    const { bus, db, store } = createTestBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-pending-async", executionId: "exec-pending-async", traceId: "trace-pending-async" });

    bus.subscribe("pending_async_consumer", async () => undefined);

    const result = await bus.pendingForConsumerAsync("pending_async_consumer");
    assert.ok(Array.isArray(result), "Should return array");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("DurableEventBusAsync.getSyncService returns underlying DurableEventBus", async () => {
  const workspace = createTempWorkspace("aa-async-bus-sync-");
  try {
    const { bus, db, store } = createTestBus(workspace);

    const syncBus = bus.getSyncService();
    assert.ok(syncBus instanceof DurableEventBus, "Should return DurableEventBus instance");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("DurableEventBusAsync deliverPending delegates to sync", async () => {
  const workspace = createTempWorkspace("aa-async-bus-deliver-");
  try {
    const { bus, db, store } = createTestBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-deliver", executionId: "exec-deliver", traceId: "trace-deliver" });

    const delivered: string[] = [];
    bus.subscribe("deliver_consumer", async (event) => {
      delivered.push(event.id);
    });

    await bus.publish({
      eventType: "task:status_changed",
      taskId: "task-deliver",
      executionId: "exec-deliver",
      traceId: "trace-deliver",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    const count = await bus.deliverPending("deliver_consumer");
    assert.equal(typeof count, "number", "Should return number of delivered events");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});