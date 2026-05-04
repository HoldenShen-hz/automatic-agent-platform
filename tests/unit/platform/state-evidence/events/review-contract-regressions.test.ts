import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { DurableEventBus } from "../../../../../src/platform/state-evidence/events/durable-event-bus.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
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

    await assert.rejects(() => bus.deliverPending("inspect_projection"), /event_delivery\.failed/);

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
