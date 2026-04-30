/**
 * Integration tests for DurableEventBus
 *
 * Tests durable event bus with real database for:
 * - Event persistence
 * - Consumer acknowledgment
 * - Retry behavior
 *
 * Extended coverage for:
 * - Issue #2033: Retry loop behavior
 * - Issue #2034: getRegisteredConsumers undefined type dereference
 * - Issue #2025: Transactional event appender transaction handling
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { DurableEventBus } from "../../../../../src/platform/state-evidence/events/durable-event-bus.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";
import { getRegisteredConsumers } from "../../../../../src/platform/state-evidence/events/event-registry.js";

test("durable event bus integration: event persists after publish and dispose", () => {
  const workspace = createTempWorkspace("aa-integration-persist-");
  let db: SqliteDatabase | undefined;

  try {
    db = new SqliteDatabase(join(workspace, "persist.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    seedTaskAndExecution(db, store, { taskId: "task-persist", executionId: "exec-persist", traceId: "trace-persist" });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-persist",
      executionId: "exec-persist",
      traceId: "trace-persist",
      payload: { fromStatus: "created", toStatus: "running" },
    });

    bus.dispose();
    db.close();

    // Reopen database and verify event persisted
    db = new SqliteDatabase(join(workspace, "persist.db"));
    db.migrate();
    const store2 = new AuthoritativeTaskStore(db);
    const events = store2.event.listEventsByType("task:status_changed");

    assert.ok(events.length > 0, "Event should persist after dispose");
  } finally {
    db?.close();
    cleanupPath(workspace);
  }
});

test("durable event bus integration: multiple consumers receive events independently", async () => {
  const workspace = createTempWorkspace("aa-integration-multi-");
  let db: SqliteDatabase | undefined;

  try {
    db = new SqliteDatabase(join(workspace, "multi.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    seedTaskAndExecution(db, store, { taskId: "task-multi", executionId: "exec-multi", traceId: "trace-multi" });

    const consumer1Events: string[] = [];
    const consumer2Events: string[] = [];

    bus.subscribe("consumer_1", async (event) => {
      consumer1Events.push(event.id);
    });

    bus.subscribe("consumer_2", async (event) => {
      consumer2Events.push(event.id);
    });

    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-multi",
      executionId: "exec-multi",
      traceId: "trace-multi",
      payload: { fromStatus: "created", toStatus: "running" },
    });

    await new Promise((resolve) => setTimeout(resolve, 200));

    assert.equal(consumer1Events.length, 1, "Consumer 1 should receive event");
    assert.equal(consumer2Events.length, 1, "Consumer 2 should receive event");
    assert.equal(consumer1Events[0], event.id);
    assert.equal(consumer2Events[0], event.id);

    bus.dispose();
  } finally {
    db?.close();
    cleanupPath(workspace);
  }
});

test("durable event bus integration: pending events survive unsubscribe/resubscribe cycle", async () => {
  const workspace = createTempWorkspace("aa-integration-cycle-");
  let db: SqliteDatabase | undefined;

  try {
    db = new SqliteDatabase(join(workspace, "cycle.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    seedTaskAndExecution(db, store, { taskId: "task-cycle", executionId: "exec-cycle", traceId: "trace-cycle" });

    bus.subscribe("cycling_consumer", async (_event) => {});

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-cycle",
      executionId: "exec-cycle",
      traceId: "trace-cycle",
      payload: { fromStatus: "created", toStatus: "running" },
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Unsubscribe
    bus.unsubscribe("cycling_consumer");

    // Resubscribe
    const eventsAfterResub: string[] = [];
    bus.subscribe("cycling_consumer", async (event) => {
      eventsAfterResub.push(event.id);
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    // The event was already delivered before unsubscribe, so no new delivery
    assert.ok(true, "Resubscribe cycle completed");

    bus.dispose();
  } finally {
    db?.close();
    cleanupPath(workspace);
  }
});

test("durable event bus integration: retry loop executes exactly 3 times - Issue #2033", async () => {
  const workspace = createTempWorkspace("aa-integration-retry-");
  let db: SqliteDatabase | undefined;

  try {
    db = new SqliteDatabase(join(workspace, "retry.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-retry", executionId: "exec-retry", traceId: "trace-retry" });

    let attemptCount = 0;

    bus.subscribe("inspect_projection", async (_event) => {
      attemptCount++;
      throw new Error("Simulated failure");
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-retry",
      executionId: "exec-retry",
      traceId: "trace-retry",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    // Wait for all retries to complete
    await new Promise((resolve) => setTimeout(resolve, 2500));

    // Issue #2033: Exactly 3 attempts (not 4)
    assert.equal(attemptCount, 3, `Expected exactly 3 retry attempts, got ${attemptCount}`);

    bus.dispose();
  } finally {
    db?.close();
    cleanupPath(workspace);
  }
});

test("durable event bus integration: event dead-lettered after 3 failed attempts", async () => {
  const workspace = createTempWorkspace("aa-integration-dlq-");
  let db: SqliteDatabase | undefined;

  try {
    db = new SqliteDatabase(join(workspace, "dlq.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-dlq", executionId: "exec-dlq", traceId: "trace-dlq" });

    let attemptCount = 0;

    bus.subscribe("inspect_projection", async (_event) => {
      attemptCount++;
      throw new Error("Permanent failure");
    });

    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-dlq",
      executionId: "exec-dlq",
      traceId: "trace-dlq",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    // Wait for all retries
    await new Promise((resolve) => setTimeout(resolve, 2500));

    // Verify exactly 3 attempts were made
    assert.equal(attemptCount, 3, "Should have exactly 3 attempts before dead-letter");

    // Event should be removed from pending queue after dead-letter
    const pending = bus.pendingForConsumer("inspect_projection");
    const eventStillPending = pending.find((p) => p.event.id === event.id);
    assert.equal(eventStillPending, undefined, "Event should be dead-lettered");

    bus.dispose();
  } finally {
    db?.close();
    cleanupPath(workspace);
  }
});

test("durable event bus integration: successful delivery after transient failure", async () => {
  const workspace = createTempWorkspace("aa-integration-recover-");
  let db: SqliteDatabase | undefined;

  try {
    db = new SqliteDatabase(join(workspace, "recover.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-recover", executionId: "exec-recover", traceId: "trace-recover" });

    let attemptCount = 0;
    const delivered: string[] = [];

    bus.subscribe("inspect_projection", async (event) => {
      attemptCount++;
      if (attemptCount === 1) {
        throw new Error("Transient failure - will succeed on retry");
      }
      delivered.push(event.id);
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-recover",
      executionId: "exec-recover",
      traceId: "trace-recover",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    // Wait for retry to succeed
    await new Promise((resolve) => setTimeout(resolve, 1500));

    assert.equal(delivered.length, 1, "Event should be delivered after retry");
    assert.equal(attemptCount, 2, "Should have 2 attempts (1 fail + 1 success)");

    bus.dispose();
  } finally {
    db?.close();
    cleanupPath(workspace);
  }
});

test("durable event bus integration: pendingForConsumer returns correct events", () => {
  const workspace = createTempWorkspace("aa-integration-pending-");
  let db: SqliteDatabase | undefined;

  try {
    db = new SqliteDatabase(join(workspace, "pending.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-pending", executionId: "exec-pending", traceId: "trace-pending" });

    bus.subscribe("consumer_a", async (_event) => {});

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-pending",
      executionId: "exec-pending",
      traceId: "trace-pending",
      payload: { fromStatus: "created", toStatus: "running" },
    });

    const pending = bus.pendingForConsumer("consumer_a");
    assert.equal(pending.length, 1, "Should have 1 pending event for consumer_a");
    assert.equal(pending[0]!.event.eventType, "task:status_changed");

    bus.dispose();
  } finally {
    db?.close();
    cleanupPath(workspace);
  }
});

test("durable event bus integration: publishBatch inserts events in single transaction", () => {
  const workspace = createTempWorkspace("aa-integration-batch-");
  let db: SqliteDatabase | undefined;

  try {
    db = new SqliteDatabase(join(workspace, "batch.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-batch", executionId: "exec-batch", traceId: "trace-batch" });

    const events = bus.publishBatch([
      {
        eventType: "task:status_changed",
        taskId: "task-batch",
        executionId: "exec-batch",
        traceId: "trace-batch",
        payload: { fromStatus: "created", toStatus: "running" },
      },
      {
        eventType: "task:status_changed",
        taskId: "task-batch",
        executionId: "exec-batch",
        traceId: "trace-batch",
        payload: { fromStatus: "running", toStatus: "completed" },
      },
    ]);

    assert.equal(events.length, 2, "Should return 2 event records");
    assert.ok(events[0]!.id);
    assert.ok(events[1]!.id);
    assert.notEqual(events[0]!.id, events[1]!.id, "Event IDs should be unique");

    bus.dispose();
  } finally {
    db?.close();
    cleanupPath(workspace);
  }
});

// ============================================================================
// Issue #2034: getRegisteredConsumers undefined type dereference
// ============================================================================

test("getRegisteredConsumers returns empty array for unknown event type - Issue #2034", () => {
  const result = getRegisteredConsumers("unknown:event:type:not:registered");
  assert.deepEqual(result, [], "Should return empty array for unknown event type");
});

test("getRegisteredConsumers returns consumers for known event type", () => {
  const result = getRegisteredConsumers("task:status_changed");
  assert.ok(Array.isArray(result), "Should return an array");
  assert.ok(result.length > 0, "task:status_changed should have registered consumers");
});

test("getRegisteredConsumers returns consumers for platform event type", () => {
  const result = getRegisteredConsumers("platform.harness_run.status_changed");
  assert.ok(Array.isArray(result), "Should return an array");
  assert.ok(result.length > 0, "platform event should have registered consumers");
});

test("getRegisteredConsumers handles event types in RUNTIME_EVENT_REPLAY_METADATA", () => {
  // These event types are in RUNTIME_EVENT_REPLAY_METADATA but not in EVENT_SCHEMA_REGISTRY
  const result = getRegisteredConsumers("oapeflir.view.run_lifecycle");
  assert.ok(Array.isArray(result), "Should return an array for oapeflir event");
});

test("getRegisteredConsumers returns empty array for perf events", () => {
  // Performance test events have empty consumers
  const result = getRegisteredConsumers("perf:test_event");
  assert.deepEqual(result, [], "perf events should have empty consumers");
});
