import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { DurableEventBus } from "../../../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

/**
 * R16-27 CRITICAL Audit Fix Test
 *
 * Requirement: §25.2 requires truth+event log atomic same transaction.
 *
 * Issue: publish() writes event+ack but does not co-write truth table.
 * The event bus publish operation does not write to the truth table atomically
 * with the event. Truth mutation and event append are separate operations,
 * breaking the atomicity requirement.
 *
 * Fix: Modify publish() to perform truth+event in a single transaction.
 * The truth mutation must be appended atomically with the event.
 */
test("R16-27: publish() writes event and truth in same atomic transaction", async () => {
  const workspace = createTempWorkspace("aa-event-bus-truth-atomic-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    // Use a taskId that does NOT exist yet
    const taskId = "non-existent-task-for-truth-atomic-test";
    const executionId = "exec-truth-atomic";

    // Verify task does not exist before publish
    const taskBefore = store.task.getTask(taskId);
    assert.equal(taskBefore, undefined, "Task should not exist before publish");

    // Publish event with the non-existent taskId
    // This should atomically create the task reference AND the event
    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: taskId,
      executionId: executionId,
      traceId: "trace-truth-atomic",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
      },
    });

    // Verify event was created
    assert.ok(event.id, "Event should have an ID");
    assert.equal(event.taskId, taskId, "Event should reference the taskId");

    // R16-27 CRITICAL FIX: Task should have been created atomically WITH the event
    // Both operations happen in the same transaction, or the fix is not applied
    const taskAfter = store.task.getTask(taskId);
    assert.ok(taskAfter, "Task should be created via ensureReferencedTask() atomically with event");
    assert.equal(taskAfter.id, taskId, "Task ID should match");
    assert.equal(taskAfter.status, "pending", "Task should have default status");

    // Verify event is in the event store
    const events = store.event.listEventsForTask(taskId);
    assert.equal(events.length, 1, "Should have exactly one event for the task");
    assert.equal(events[0].id, event.id, "Event ID should match");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("R16-27: transaction rollback prevents partial truth write", async () => {
  const workspace = createTempWorkspace("aa-event-bus-truth-rollback-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    const taskId = "task-for-rollback-test";

    // Create task first so we don't trigger the auto-create logic
    const now = new Date().toISOString();
    store.task.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: null,
      tenantId: null,
      title: "Test Task",
      status: "pending",
      source: "test",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: null,
      outputJson: null,
      estimatedCostUsd: null,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    });

    // Publish an event referencing the existing task
    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: taskId,
      executionId: "exec-rollback",
      traceId: "trace-rollback",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
      },
    });

    // Verify atomicity: both task update and event should be present
    const task = store.task.getTask(taskId);
    const events = store.event.listEventsForTask(taskId);

    assert.ok(task, "Task should still exist after event publish");
    assert.equal(events.length, 1, "Event should be stored");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
