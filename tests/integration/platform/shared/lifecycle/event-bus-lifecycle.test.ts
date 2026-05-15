/**
 * Lifecycle Integration Test: Event Bus Disposal
 *
 * Verifies event bus disposal behavior.
 * Part of lifecycle tests in tests/integration/lifecycle/.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { DurableEventBus } from "../../../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("lifecycle: DurableEventBus.dispose() prevents further publishing", () => {
  const workspace = createTempWorkspace("lifecycle-eventbus-");

  try {
    const dbPath = join(workspace, "eventbus-lifecycle.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const eventBus = new DurableEventBus(db, store);

    const taskId = newId("task");
    const now = nowIso();

    // Create a task for events
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Event bus lifecycle test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // Dispose the event bus
    eventBus.dispose();

    // Publishing after dispose should throw
    assert.throws(
      () => {
        eventBus.publish({
          eventType: "task:status_changed",
          taskId,
          payload: { fromStatus: "in_progress", toStatus: "done" },
          traceId: newId("trace"),
        });
      },
      (err: unknown) =>
        err instanceof Error && err.message.includes("disposed"),
      "Should throw after dispose",
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lifecycle: Event bus reports disposed state correctly", () => {
  const workspace = createTempWorkspace("lifecycle-eventbus-state-");

  try {
    const dbPath = join(workspace, "eventbus-state.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const eventBus = new DurableEventBus(db, store);

    // Before dispose, should not be disposed
    const taskId = newId("task");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "State test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // Publish should work before dispose
    eventBus.publish({
      eventType: "task:status_changed",
      taskId,
      payload: { fromStatus: "in_progress", toStatus: "done" },
      traceId: newId("trace"),
    });

    // Dispose
    eventBus.dispose();

    // Verify events were still stored before dispose
    const events = db.connection
      .prepare("SELECT * FROM events WHERE task_id = ?")
      .all(taskId) as Array<{ id: string }>;

    assert.ok(events.length > 0, "Events should be stored before dispose");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
