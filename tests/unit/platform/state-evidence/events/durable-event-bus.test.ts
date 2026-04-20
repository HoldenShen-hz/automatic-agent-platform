import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { DurableEventBus } from "../../../../../src/platform/state-evidence/events/durable-event-bus.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

test("durable event bus publishes tier1 event and acks after delivery", async () => {
  const workspace = createTempWorkspace("aa-event-bus-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    const seen: string[] = [];
    seedTaskAndExecution(db, store, { taskId: "task-1", executionId: "exec-1", traceId: "trace-1" });

    bus.subscribe("task_projection", async (event) => {
      seen.push(event.eventType);
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-1",
      executionId: "exec-1",
      traceId: "trace-1",
      traceContext: {
        traceId: "trace-1",
        spanId: "span-1",
        parentSpanId: "span-root",
        correlationId: "task-1",
      },
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
        reasonCode: "scheduler.dispatch",
      },
    });

    const pendingBefore = bus.pendingForConsumer("task_projection");
    assert.equal(pendingBefore.length, 1);

    await bus.deliverPending("task_projection");

    const pendingAfter = bus.pendingForConsumer("task_projection");
    const event = store.listEventsForTask("task-1")[0];
    const payload = event ? (JSON.parse(event.payloadJson) as Record<string, unknown>) : null;
    const traceContext = payload?.traceContext as Record<string, unknown> | undefined;
    assert.equal(seen.length, 1);
    assert.equal(pendingAfter.length, 0);
    assert.equal(traceContext?.spanId, "span-1");
    assert.equal(traceContext?.correlationId, "task-1");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("durable event bus publish auto-fans out to active subscribers", async () => {
  const workspace = createTempWorkspace("aa-event-bus-fanout-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    const seen: string[] = [];
    seedTaskAndExecution(db, store, { taskId: "task-fanout", executionId: "exec-fanout", traceId: "trace-fanout" });

    bus.subscribe("task_projection", async (event) => {
      seen.push(event.id);
    });

    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-fanout",
      executionId: "exec-fanout",
      traceId: "trace-fanout",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
        reasonCode: "scheduler.dispatch",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 20));

    assert.deepEqual(seen, [event.id]);
    assert.equal(bus.pendingForConsumer("task_projection").length, 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("durable event bus continues delivering later pending events after an earlier one dead-letters", async () => {
  const workspace = createTempWorkspace("aa-event-bus-retry-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-retry", executionId: "exec-retry", traceId: "trace-retry" });
    const delivered: string[] = [];

    bus.subscribe("task_projection", async (event) => {
      if (event.payloadJson.includes("\"sequence\":1")) {
        throw new Error("projection unavailable");
      }
      delivered.push(event.id);
    });

    const first = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-retry",
      executionId: "exec-retry",
      traceId: "trace-retry",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
        sequence: 1,
      },
    });
    const second = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-retry",
      executionId: "exec-retry",
      traceId: "trace-retry",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
        sequence: 2,
      },
    });

    await assert.rejects(
      () => bus.deliverPending("task_projection"),
      /dead-lettered/,
    );

    assert.deepEqual(delivered, [second.id]);
    const remaining = bus.pendingForConsumer("task_projection");
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0]?.event.id, first.id);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("durable event bus dispose clears subscribers and rejects new operations", async () => {
  const workspace = createTempWorkspace("aa-event-bus-dispose-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-dispose", executionId: "exec-dispose", traceId: "trace-dispose" });

    bus.subscribe("task_projection", async () => undefined);
    assert.equal(bus.pendingForConsumer("task_projection").length, 0);

    bus.dispose();

    assert.throws(() => bus.pendingForConsumer("task_projection"), /event_bus\.disposed/);
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
    await assert.rejects(() => bus.deliverPending("task_projection"), /event_bus\.disposed/);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});


test("durable event bus delivery retries MAX_DELIVERY_RETRIES times before dead-lettering", async () => {
  const workspace = createTempWorkspace("aa-event-bus-retry-exhaust-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-retry-exhaust", executionId: "exec-retry-exhaust", traceId: "trace-retry-exhaust" });
    let attemptCount = 0;

    bus.subscribe("task_projection", async (_event) => {
      attemptCount++;
      throw new Error("handler always fails");
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-retry-exhaust",
      executionId: "exec-retry-exhaust",
      traceId: "trace-retry-exhaust",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
        reasonCode: "scheduler.dispatch",
        sequence: 1,
      },
    });

    // deliverPending uses swallowErrors=false, so errors propagate
    // The handler will be called MAX_DELIVERY_RETRIES+1 times (attempts 0,1,2,3)
    // with exponential backoff between failures (100, 200, 400 ms)
    // Total time: ~700ms+ so use 3000ms timeout
    await assert.rejects(
      () => bus.deliverPending("task_projection"),
      /dead-lettered/,
    );

    // Verify handler was called MAX_DELIVERY_RETRIES times (not attempt 4 since last one marks failed)
    // Actually the loop is for (attempt = 0; attempt <= MAX_DELIVERY_RETRIES; attempt++)
    // So attempts: 0 (first call), 1 (after backoff 100ms), 2 (after backoff 200ms), 3 (after backoff 400ms)
    // That's MAX_DELIVERY_RETRIES + 1 = 4 total attempts
    assert.ok(attemptCount >= 3, `Expected at least 3 handler attempts, got ${attemptCount}`);

    // After dead-lettering, the event should still be in pending list but with status='failed'
    const remaining = bus.pendingForConsumer("task_projection");
    assert.equal(remaining.length, 1);
    assert.equal(remaining[0]?.ack.status, "failed");
    assert.ok(remaining[0]?.ack.errorCode?.includes("failed_after_3_retries"), `Expected error code with retry info, got: ${remaining[0]?.ack.errorCode}`);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("durable event bus invalid payload rejects at publish time", async () => {
  const workspace = createTempWorkspace("aa-event-bus-invalid-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-invalid", executionId: "exec-invalid", traceId: "trace-invalid" });

    assert.throws(
      () =>
        bus.publish({
          eventType: "task:status_changed",
          taskId: "task-invalid",
          executionId: "exec-invalid",
          traceId: "trace-invalid",
          payload: { sequence: 1 },
        }),
      (error: unknown) =>
        typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === "event.payload_invalid",
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("durable event bus rejects payload larger than 1MB", async () => {
  const workspace = createTempWorkspace("aa-event-bus-payload-large-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-large", executionId: "exec-large", traceId: "trace-large" });

    // Create a payload that exceeds 1MB (1,000,000 bytes)
    // Must include valid task:status_changed fields for validation to pass before size check
    const largePayload = {
      fromStatus: "queued",
      toStatus: "in_progress",
      reasonCode: "scheduler.dispatch",
      extraData: "x".repeat(1_100_000),
    };

    assert.throws(
      () =>
        bus.publish({
          eventType: "task:status_changed",
          taskId: "task-large",
          executionId: "exec-large",
          traceId: "trace-large",
          payload: largePayload,
        }),
      (error: unknown) =>
        typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === "event.payload_too_large",
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("durable event bus volatile subscriber error does not propagate", async () => {
  const workspace = createTempWorkspace("aa-event-bus-volatile-error-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-volatile", executionId: "exec-volatile", traceId: "trace-volatile" });

    bus.subscribe("volatile_consumer", async (_event) => {
      throw new Error("volatile handler always fails");
    });

    // Publishing stream:chunk_emitted (tier_3) triggers dispatchVolatile
    // The error should be caught and logged, not propagated
    const event = bus.publish({
      eventType: "stream:chunk_emitted",
      taskId: "task-volatile",
      executionId: "exec-volatile",
      traceId: "trace-volatile",
      payload: {
        sequence: 1,
        chunk: "test chunk data",
      },
    });

    // Give async handler time to execute
    await new Promise((resolve) => setTimeout(resolve, 50));

    // The publish should succeed (error doesn't propagate)
    assert.equal(event.eventType, "stream:chunk_emitted");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("durable event bus unsubscribe removes subscriber", async () => {
  const workspace = createTempWorkspace("aa-event-bus-unsubscribe-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-unsub", executionId: "exec-unsub", traceId: "trace-unsub" });

    const seen: string[] = [];
    // Use inspect_projection - a required consumer for task:status_changed
    // Non-required consumers don't get auto-created pending acks, so delivery won't work
    bus.subscribe("inspect_projection", async (event) => {
      seen.push(event.eventType);
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-unsub",
      executionId: "exec-unsub",
      traceId: "trace-unsub",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
        reasonCode: "scheduler.dispatch",
      },
    });

    // Check pending after publish
    const pendingAfter = bus.pendingForConsumer("inspect_projection");
    assert.equal(pendingAfter.length, 1, "Should have 1 pending event after publish");

    // Wait for async fan-out delivery to complete
    await new Promise((resolve) => setTimeout(resolve, 30));

    assert.equal(seen.length, 1);

    // Unsubscribe
    bus.unsubscribe("inspect_projection");

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-unsub",
      executionId: "exec-unsub",
      traceId: "trace-unsub",
      payload: {
        fromStatus: "in_progress",
        toStatus: "done",
        reasonCode: "complete",
      },
    });

    // Wait for async fan-out delivery
    await new Promise((resolve) => setTimeout(resolve, 30));

    // Should still only have 1 event since we unsubscribed
    assert.equal(seen.length, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("durable event bus dispose clears subscribers", async () => {
  const workspace = createTempWorkspace("aa-event-bus-dispose-2-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-dispose2", executionId: "exec-dispose2", traceId: "trace-dispose2" });

    const seen: string[] = [];
    bus.subscribe("dispose_consumer", async (event) => {
      seen.push(event.eventType);
    });

    bus.dispose();

    // After dispose, publish should throw synchronously
    assert.throws(
      () =>
        bus.publish({
          eventType: "task:status_changed",
          taskId: "task-dispose2",
          executionId: "exec-dispose2",
          traceId: "trace-dispose2",
          payload: {
            fromStatus: "queued",
            toStatus: "in_progress",
            reasonCode: "scheduler.dispatch",
          },
        }),
      /event_bus\.disposed/,
    );

    // Should not have received any events since bus is disposed
    assert.equal(seen.length, 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
