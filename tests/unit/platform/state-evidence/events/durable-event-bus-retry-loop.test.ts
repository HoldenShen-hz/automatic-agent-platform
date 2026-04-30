/**
 * Unit tests for DurableEventBus - Issue #2033
 *
 * Tests retry loop behavior: loop 0..<=MAX(3) actually runs 4 times.
 * MAX_DELIVERY_RETRIES = 3, but the loop should run exactly 3 times.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { DurableEventBus } from "../../../../../src/platform/state-evidence/events/durable-event-bus.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

test("durable event bus: retry loop runs exactly MAX_DELIVERY_RETRIES times - Issue #2033", async () => {
  const workspace = createTempWorkspace("aa-retry-loop-");
  let db: SqliteDatabase | undefined;

  try {
    db = new SqliteDatabase(join(workspace, "retry-test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-retry", executionId: "exec-retry", traceId: "trace-retry" });

    let attemptCount = 0;

    bus.subscribe("inspect_projection", async (_event) => {
      attemptCount++;
      throw new Error("Simulated handler failure");
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-retry",
      executionId: "exec-retry",
      traceId: "trace-retry",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    // Wait for all retries to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Issue #2033: The bug is that loop runs 0..<=MAX which is 4 times when MAX=3
    // Expected: exactly 3 attempts (MAX_DELIVERY_RETRIES = 3)
    // Actual bug: 4 attempts
    assert.equal(attemptCount, 3, `Expected exactly 3 retry attempts, got ${attemptCount}`);

    bus.dispose();
  } finally {
    db?.close();
    cleanupPath(workspace);
  }
});

test("durable event bus: dead letter after MAX_DELIVERY_RETRIES exhausted", async () => {
  const workspace = createTempWorkspace("aa-dead-letter-");
  let db: SqliteDatabase | undefined;

  try {
    db = new SqliteDatabase(join(workspace, "dead-letter.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-dlq", executionId: "exec-dlq", traceId: "trace-dlq" });

    let attemptCount = 0;

    bus.subscribe("inspect_projection", async (_event) => {
      attemptCount++;
      throw new Error("Permanent failure");
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-dlq",
      executionId: "exec-dlq",
      traceId: "trace-dlq",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    // Wait for all retries to complete
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // After 3 retries (not 4), event should be dead-lettered
    const pending = bus.pendingForConsumer("inspect_projection");
    assert.equal(pending.length, 0, "Event should be removed from pending queue after dead-letter");

    // Verify the event was marked as dead-lettered in the store
    const ack = store.event.getEventConsumerAck(
      pending[0]?.event.id ?? "",
      "inspect_projection",
    );

    bus.dispose();
  } finally {
    db?.close();
    cleanupPath(workspace);
  }
});

test("durable event bus: successful delivery after one retry", async () => {
  const workspace = createTempWorkspace("aa-retry-success-");
  let db: SqliteDatabase | undefined;

  try {
    db = new SqliteDatabase(join(workspace, "retry-success.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-success", executionId: "exec-success", traceId: "trace-success" });

    let attemptCount = 0;
    const delivered: string[] = [];

    bus.subscribe("inspect_projection", async (event) => {
      attemptCount++;
      if (event.payloadJson.includes("\"failOnce\":true") && attemptCount === 1) {
        throw new Error("Temporary failure");
      }
      delivered.push(event.id);
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-success",
      executionId: "exec-success",
      traceId: "trace-success",
      payload: { failOnce: true },
    });

    // Wait for delivery and potential retry
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Should succeed on second attempt
    assert.equal(delivered.length, 1, "Event should be delivered after successful retry");
    assert.equal(attemptCount, 2, "Should have exactly 2 attempts (1 failure + 1 success)");

    bus.dispose();
  } finally {
    db?.close();
    cleanupPath(workspace);
  }
});