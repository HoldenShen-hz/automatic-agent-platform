import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { DurableEventBus } from "../../../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

test("DurableEventBus publish assigns monotonic run-local sequence and exposes replay fields", () => {
  const workspace = createTempWorkspace("aa-event-bus-review-sequence-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    seedTaskAndExecution(db, store, { taskId: "task-review-seq", executionId: "exec-review-seq", traceId: "trace-review-seq" });

    const first = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-review-seq",
      executionId: "exec-review-seq",
      traceContext: {
        traceId: "trace-review-seq",
        spanId: "span-review-seq-1",
        parentSpanId: null,
        correlationId: "corr-review-seq",
      },
      runId: "run-review-seq",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
      },
    });
    const second = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-review-seq",
      executionId: "exec-review-seq",
      traceContext: {
        traceId: "trace-review-seq",
        spanId: "span-review-seq-2",
        parentSpanId: null,
        correlationId: "corr-review-seq",
      },
      runId: "run-review-seq",
      payload: {
        fromStatus: "in_progress",
        toStatus: "completed",
      },
    });

    assert.equal(first.sequence, 1);
    assert.equal(second.sequence, 2);
    assert.equal(first.correlationId, "corr-review-seq");
    assert.equal(first.causationId, null);
    assert.equal(first.payloadHash, null);
    assert.equal(first.idempotencyKey, null);

    bus.dispose();
    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("DurableEventBus persists event dead letters in dedicated DLQ storage", async () => {
  const workspace = createTempWorkspace("aa-event-bus-review-dlq-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    seedTaskAndExecution(db, store, { taskId: "task-review-dlq", executionId: "exec-review-dlq", traceId: "trace-review-dlq" });

    bus.subscribe("inspect_projection", async () => {
      throw new Error("projection unavailable");
    });

    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-review-dlq",
      executionId: "exec-review-dlq",
      traceId: "trace-review-dlq",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 450));

    const deadLetters = store.event.listEventDeadLetters();
    assert.equal(deadLetters.length, 1);
    assert.equal(deadLetters[0]?.originalEventId, event.id);
    assert.equal(deadLetters[0]?.eventType, "task:status_changed");
    assert.equal(deadLetters[0]?.consumerId, "inspect_projection");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("DurableEventBus marks ack rows dead_lettered after retry exhaustion", async () => {
  const workspace = createTempWorkspace("aa-event-bus-review-ack-dlq-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    seedTaskAndExecution(db, store, { taskId: "task-review-ack-dlq", executionId: "exec-review-ack-dlq", traceId: "trace-review-ack-dlq" });

    bus.subscribe("inspect_projection", async () => {
      throw new Error("projection unavailable");
    });

    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-review-ack-dlq",
      executionId: "exec-review-ack-dlq",
      traceId: "trace-review-ack-dlq",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
      },
    });

    await assert.rejects(() => bus.deliverPending("inspect_projection"), /dead-lettered/);

    const ack = store.event.getEventConsumerAck(event.id, "inspect_projection");
    assert.equal(ack?.status, "dead_lettered");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("DurableEventBus does not enqueue phantom volatile events when transaction rolls back", () => {
  const workspace = createTempWorkspace("aa-event-bus-review-rollback-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task-review-rollback", executionId: "exec-review-rollback", traceId: "trace-review-rollback" });
    const originalTransaction = db.transaction.bind(db);
    db.transaction = ((callback: () => unknown) => originalTransaction(() => {
      callback();
      throw new Error("force rollback");
    })) as typeof db.transaction;
    const bus = new DurableEventBus(db, store);

    bus.subscribe("task_projection", async () => undefined);

    assert.throws(() => bus.publish({
      eventType: "task:status_changed",
      taskId: "task-review-rollback",
      executionId: "exec-review-rollback",
      traceId: "trace-review-rollback",
      aggregateId: "agg-review-rollback",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
      },
    }), /force rollback/);

    assert.equal((bus as unknown as { pendingPartitionEvents: Map<string, unknown[]> }).pendingPartitionEvents.size, 0);

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("DurableEventBus does not advance partition sequence after failed volatile delivery", async () => {
  const workspace = createTempWorkspace("aa-event-bus-review-volatile-sequence-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    const deliveredIds: string[] = [];

    seedTaskAndExecution(db, store, { taskId: "task-review-volatile-sequence", executionId: "exec-review-volatile-sequence", traceId: "trace-review-volatile-sequence" });

    let shouldFail = true;
    bus.subscribe("task_projection", async (event) => {
      if (shouldFail) {
        throw new Error("first delivery fails");
      }
      deliveredIds.push(event.id);
    });

    bus.publish({
      eventType: "dispatch:ticket_created",
      taskId: "task-review-volatile-sequence",
      executionId: "exec-review-volatile-sequence",
      traceId: "trace-review-volatile-sequence",
      aggregateId: "agg-review-volatile-sequence",
      sequence: 1,
      payload: {
        workerId: "worker-1",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 25));

    shouldFail = false;
    const replayed = bus.publish({
      eventType: "dispatch:ticket_created",
      taskId: "task-review-volatile-sequence",
      executionId: "exec-review-volatile-sequence",
      traceId: "trace-review-volatile-sequence",
      aggregateId: "agg-review-volatile-sequence",
      sequence: 1,
      payload: {
        workerId: "worker-1",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 25));

    assert.deepEqual(deliveredIds, [replayed.id]);

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("DurableEventBus schedules only event-relevant tier-1 consumers", () => {
  const workspace = createTempWorkspace("aa-event-bus-review-targeted-fanout-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    seedTaskAndExecution(db, store, { taskId: "task-review-targeted-fanout", executionId: "exec-review-targeted-fanout", traceId: "trace-review-targeted-fanout" });

    bus.subscribe("task_projection", async () => undefined);
    bus.subscribe("approval_projection", async () => undefined);

    const scheduledConsumers: string[] = [];
    (bus as unknown as { scheduleDelivery: (consumerId: string) => void }).scheduleDelivery = (consumerId: string) => {
      scheduledConsumers.push(consumerId);
    };

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-review-targeted-fanout",
      executionId: "exec-review-targeted-fanout",
      traceId: "trace-review-targeted-fanout",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
      },
    });

    assert.deepEqual(scheduledConsumers, ["task_projection"]);

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
