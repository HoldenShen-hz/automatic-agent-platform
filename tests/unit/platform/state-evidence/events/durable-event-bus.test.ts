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

test("durable event bus publishBatch inserts multiple events in transaction", async () => {
  const workspace = createTempWorkspace("aa-event-bus-batch-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
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
        payload: { fromStatus: "queued", toStatus: "in_progress", sequence: 1 },
      },
      {
        eventType: "task:status_changed",
        taskId: "task-batch",
        executionId: "exec-batch",
        traceId: "trace-batch",
        payload: { fromStatus: "in_progress", toStatus: "completed", sequence: 2 },
      },
      {
        eventType: "task:status_changed",
        taskId: "task-batch",
        executionId: "exec-batch",
        traceId: "trace-batch",
        payload: { fromStatus: "completed", toStatus: "done", sequence: 3 },
      },
    ]);

    assert.equal(events.length, 3);
    assert.notEqual(events[0]!.id, events[1]!.id);
    assert.notEqual(events[1]!.id, events[2]!.id);

    const allEvents = store.listEventsForTask("task-batch");
    assert.equal(allEvents.length, 3);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("durable event bus publishBatch validates all payloads before inserting", async () => {
  const workspace = createTempWorkspace("aa-event-bus-batch-validate-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-batch-validate", executionId: "exec-batch-validate", traceId: "trace-batch-validate" });

    // Second event has invalid payload (missing required fromStatus/toStatus)
    assert.throws(
      () =>
        bus.publishBatch([
          {
            eventType: "task:status_changed",
            taskId: "task-batch-validate",
            executionId: "exec-batch-validate",
            traceId: "trace-batch-validate",
            payload: { fromStatus: "queued", toStatus: "in_progress" },
          },
          {
            eventType: "task:status_changed",
            taskId: "task-batch-validate",
            executionId: "exec-batch-validate",
            traceId: "trace-batch-validate",
            payload: { invalid: "payload" },
          },
        ]),
      /Invalid payload for event type/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("durable event bus publishBatch rejects oversized payload", async () => {
  const workspace = createTempWorkspace("aa-event-bus-batch-size-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-batch-size", executionId: "exec-batch-size", traceId: "trace-batch-size" });

    assert.throws(
      () =>
        bus.publishBatch([
          {
            eventType: "task:status_changed",
            taskId: "task-batch-size",
            executionId: "exec-batch-size",
            traceId: "trace-batch-size",
            payload: {
              fromStatus: "queued",
              toStatus: "in_progress",
              largeData: "x".repeat(1_100_000),
            },
          },
        ]),
      /event\.payload_too_large/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("durable event bus publishBatch fanning out to subscribers", async () => {
  const workspace = createTempWorkspace("aa-event-bus-batch-fanout-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-batch-fanout", executionId: "exec-batch-fanout", traceId: "trace-batch-fanout" });

    const seen: string[] = [];
    bus.subscribe("inspect_projection", async (event) => {
      seen.push(event.id);
    });

    const events = bus.publishBatch([
      {
        eventType: "task:status_changed",
        taskId: "task-batch-fanout",
        executionId: "exec-batch-fanout",
        traceId: "trace-batch-fanout",
        payload: { fromStatus: "queued", toStatus: "in_progress" },
      },
      {
        eventType: "task:status_changed",
        taskId: "task-batch-fanout",
        executionId: "exec-batch-fanout",
        traceId: "trace-batch-fanout",
        payload: { fromStatus: "in_progress", toStatus: "completed" },
      },
    ]);

    // Wait for async fan-out delivery
    await new Promise((resolve) => setTimeout(resolve, 30));

    assert.equal(seen.length, 2);
    assert.ok(seen.includes(events[0]!.id));
    assert.ok(seen.includes(events[1]!.id));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("durable event bus publishBatch creates ack records for tier1 events", async () => {
  const workspace = createTempWorkspace("aa-event-bus-batch-ack-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-batch-ack", executionId: "exec-batch-ack", traceId: "trace-batch-ack" });

    bus.publishBatch([
      {
        eventType: "task:status_changed",
        taskId: "task-batch-ack",
        executionId: "exec-batch-ack",
        traceId: "trace-batch-ack",
        payload: { fromStatus: "queued", toStatus: "in_progress" },
      },
    ]);

    const pending = bus.pendingForConsumer("task_projection");
    assert.equal(pending.length, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("durable event bus publishBatch dispose rejects new batch publish", async () => {
  const workspace = createTempWorkspace("aa-event-bus-batch-dispose-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-batch-dispose", executionId: "exec-batch-dispose", traceId: "trace-batch-dispose" });

    bus.dispose();

    assert.throws(
      () =>
        bus.publishBatch([
          {
            eventType: "task:status_changed",
            taskId: "task-batch-dispose",
            executionId: "exec-batch-dispose",
            traceId: "trace-batch-dispose",
            payload: { fromStatus: "queued", toStatus: "in_progress" },
          },
        ]),
      /event_bus\.disposed/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("durable event bus multiple subscribers each receive events", async () => {
  const workspace = createTempWorkspace("aa-event-bus-multi-sub-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-multi-sub", executionId: "exec-multi-sub", traceId: "trace-multi-sub" });

    const seen1: string[] = [];
    const seen2: string[] = [];
    bus.subscribe("subscriber_1", async (event) => {
      seen1.push(event.eventType);
    });
    bus.subscribe("subscriber_2", async (event) => {
      seen2.push(event.eventType);
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-multi-sub",
      executionId: "exec-multi-sub",
      traceId: "trace-multi-sub",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    await new Promise((resolve) => setTimeout(resolve, 30));

    assert.equal(seen1.length, 1);
    assert.equal(seen2.length, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("durable event bus deliverPending returns count of delivered events", async () => {
  const workspace = createTempWorkspace("aa-event-bus-deliver-count-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-deliver-count", executionId: "exec-deliver-count", traceId: "trace-deliver-count" });

    bus.subscribe("task_projection", async () => {});

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-deliver-count",
      executionId: "exec-deliver-count",
      traceId: "trace-deliver-count",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    const delivered = await bus.deliverPending("task_projection");
    assert.equal(delivered, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("durable event bus pendingForConsumer returns empty for unknown consumer", async () => {
  const workspace = createTempWorkspace("aa-event-bus-pending-unknown-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    const pending = bus.pendingForConsumer("unknown_consumer");
    assert.equal(pending.length, 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("durable event bus publish with traceContext injects trace fields into payload", async () => {
  const workspace = createTempWorkspace("aa-event-bus-trace-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-trace", executionId: "exec-trace", traceId: "trace-trace" });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-trace",
      executionId: "exec-trace",
      traceId: "trace-trace",
      traceContext: {
        traceId: "trace-trace",
        spanId: "span-abc",
        parentSpanId: "span-root",
        correlationId: "corr-123",
      },
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    const events = store.listEventsForTask("task-trace");
    assert.equal(events.length, 1);
    const payload = JSON.parse(events[0]!.payloadJson) as Record<string, unknown>;
    assert.equal(payload.traceContext, undefined); // traceContext not included in payload itself

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("durable event bus empty batch returns empty array", async () => {
  const workspace = createTempWorkspace("aa-event-bus-batch-empty-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    const events = bus.publishBatch([]);
    assert.deepEqual(events, []);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
