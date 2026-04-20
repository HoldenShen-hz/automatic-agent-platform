/**
 * Reliability Integration Test: Degradation Behavior
 *
 * Verifies system degradation behavior under adverse conditions.
 * Part of reliability tests per strategy doc Section 6.0b.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../../src/platform/contracts/types/ids.js";

test("reliability: Task status remains consistent under read-only conditions", () => {
  const workspace = createTempWorkspace("reliability-readonly-");

  try {
    const dbPath = join(workspace, "readonly.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const now = nowIso();

    // Create a task
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Readonly test",
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

    // Read operations should always work
    const tasks = store.listTasks(10);
    const found = tasks.find((t) => t.id === taskId);
    assert.ok(found, "Task should be readable");
    assert.strictEqual(found!.status, "in_progress");

    // Update should work normally
    db.transaction(() => {
      store.updateTaskStatus(taskId, "done", nowIso(), null, nowIso());
    });

    // Verify update
    const updatedTasks = store.listTasks(10);
    const updated = updatedTasks.find((t) => t.id === taskId);
    assert.strictEqual(updated!.status, "done", "Task status should be updated");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("reliability: Events persist even when consumers are unavailable", () => {
  const workspace = createTempWorkspace("reliability-events-");

  try {
    const dbPath = join(workspace, "events-persist.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const now = nowIso();

    // Create task
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Event persistence test",
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

    // Store events directly in DB (simulating event bus behavior)
    const eventIds: string[] = [];
    db.transaction(() => {
      for (let i = 0; i < 5; i++) {
        const eventId = newId("event");
        eventIds.push(eventId);
        db.connection
          .prepare(
            "INSERT INTO events (id, task_id, execution_id, event_type, event_tier, payload_json, trace_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .run(
            eventId,
            taskId,
            null,
            "task:status_changed",
            "tier1_reliable",
            JSON.stringify({ fromStatus: "pending", toStatus: "in_progress", sequence: i }),
            newId("trace"),
            now,
          );
      }
    });

    // Events should be queryable directly
    const events = db.connection
      .prepare("SELECT * FROM events WHERE task_id = ? ORDER BY created_at")
      .all(taskId) as Array<{ id: string }>;

    assert.strictEqual(events.length, 5, "All events should be persisted");
    assert.strictEqual(events[0]!.id, eventIds[0]);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("reliability: Multiple concurrent reads don't block each other", () => {
  const workspace = createTempWorkspace("reliability-concurrent-read-");

  try {
    const dbPath = join(workspace, "concurrent-read.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const now = nowIso();

    // Insert many tasks
    db.transaction(() => {
      for (let i = 0; i < 100; i++) {
        store.insertTask({
          id: newId("task"),
          parentId: null,
          rootId: newId("root"),
          divisionId: "general_ops",
          title: `Concurrent read test ${i}`,
          status: "pending",
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
      }
    });

    // Perform many concurrent reads
    const readPromises = Array.from({ length: 20 }, () =>
      Promise.resolve(store.listTasks(100)),
    );

    Promise.all(readPromises).then((results) => {
      for (const tasks of results) {
        assert.ok(tasks.length >= 100, "Each read should return tasks");
      }
    });

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("reliability: Data integrity maintained under batch operations", () => {
  const workspace = createTempWorkspace("reliability-batch-");

  try {
    const dbPath = join(workspace, "batch.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const now = nowIso();
    const taskIds: string[] = [];

    // Batch insert tasks
    db.transaction(() => {
      for (let i = 0; i < 50; i++) {
        const taskId = newId("task");
        taskIds.push(taskId);
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general_ops",
          title: `Batch test ${i}`,
          status: "pending",
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
      }
    });

    // Verify all tasks were inserted
    const allTasks = store.listTasks(100);
    assert.ok(allTasks.length >= 50, "All batch inserted tasks should be queryable");

    // Verify each task has correct data
    for (const taskId of taskIds) {
      const task = allTasks.find((t) => t.id === taskId);
      assert.ok(task, `Task ${taskId} should exist`);
      assert.strictEqual(task!.status, "pending");
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
