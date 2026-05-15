/**
 * Smoke Test: Task Lifecycle
 *
 * Verifies basic task creation through completion.
 * Part of the smoke test suite in tests/integration/smoke/.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("smoke: task can be created and queried", () => {
  const workspace = createTempWorkspace("smoke-task-");

  try {
    const dbPath = join(workspace, "task.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const now = nowIso();

    // Insert a task
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Smoke test task",
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
    });

    // Query the task back
    const tasks = store.listTasks(10);
    const found = tasks.find((t) => t.id === taskId);

    assert.ok(found, "Task should be findable after insertion");
    assert.strictEqual(found!.title, "Smoke test task");
    assert.strictEqual(found!.status, "pending");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("smoke: task status transitions work correctly", () => {
  const workspace = createTempWorkspace("smoke-transition-");

  try {
    const dbPath = join(workspace, "transition.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const now = nowIso();

    // Create task in pending
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Transition test task",
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
    });

    // Update to in_progress
    db.transaction(() => {
      store.updateTaskStatus(taskId, "in_progress", nowIso(), null, null);
    });

    // Verify status changed
    const tasks = store.listTasks(10);
    const task = tasks.find((t) => t.id === taskId);

    assert.strictEqual(task!.status, "in_progress");

    // Update to completed
    db.transaction(() => {
      const completedAt = nowIso();
      store.updateTaskStatus(taskId, "done", completedAt, null, completedAt);
    });

    // Verify final status
    const finalTasks = store.listTasks(10);
    const finalTask = finalTasks.find((t) => t.id === taskId);

    assert.strictEqual(finalTask!.status, "done");
    assert.ok(finalTask!.completedAt, "completedAt should be set");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
