/**
 * Integration Test: Division Routing Integration
 *
 * Verifies division-based routing and role assignment
 * for task execution.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { newId, nowIso } from "../../../../src/platform/contracts/types/ids.js";

test("division routing: tasks can be assigned to different divisions", () => {
  const workspace = createTempWorkspace("aa-division-");

  try {
    const dbPath = join(workspace, "division.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId1 = newId("task");
    const taskId2 = newId("task");
    const now = nowIso();

    // Create tasks in different divisions
    db.transaction(() => {
      store.insertTask({
        id: taskId1,
        parentId: null,
        rootId: taskId1,
        divisionId: "general_ops",
        title: "General ops task",
        status: "queued",
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

      store.insertTask({
        id: taskId2,
        parentId: null,
        rootId: taskId2,
        divisionId: "code_review",
        title: "Code review task",
        status: "queued",
        source: "user",
        priority: "high",
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

    // Verify division assignment
    const task1 = store.getTask(taskId1);
    assert.equal(task1!.divisionId, "general_ops", "Task 1 should be in general_ops division");

    const task2 = store.getTask(taskId2);
    assert.equal(task2!.divisionId, "code_review", "Task 2 should be in code_review division");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("division routing: priority is preserved across divisions", () => {
  const workspace = createTempWorkspace("aa-division-priority-");

  try {
    const dbPath = join(workspace, "division-priority.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const now = nowIso();

    // Create high priority task
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "security_ops",
        title: "Security alert",
        status: "queued",
        source: "system",
        priority: "urgent",
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

    const task = store.getTask(taskId);
    assert.equal(task!.priority, "urgent", "Priority should be preserved");
    assert.equal(task!.divisionId, "security_ops", "Division should be preserved");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
