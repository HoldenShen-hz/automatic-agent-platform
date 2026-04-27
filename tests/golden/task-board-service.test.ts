/**
 * Golden Test: Task Board Service Output
 *
 * Verifies task board service produces consistent list output
 * for operator-facing task queue visibility.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { TaskBoardService } from "../../src/platform/shared/observability/task-board-service.js";
import { seedTaskAndExecution } from "../helpers/seed.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { assertGolden } from "../helpers/golden.js";

test("golden: task board list returns expected structure", () => {
  const workspace = createTempWorkspace("aa-golden-taskboard-");

  const dbPath = `${workspace}/taskboard.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const service = new TaskBoardService(store);

  // Create multiple tasks with different statuses
  seedTaskAndExecution(db, store, {
    taskId: "taskboard_task_001",
    executionId: "taskboard_exec_001",
    traceId: "tb-trace-1",
  });
  seedTaskAndExecution(db, store, {
    taskId: "taskboard_task_002",
    executionId: "taskboard_exec_002",
    traceId: "tb-trace-2",
  });

  const items = service.list(25);

  // Verify structure
  assert.ok(Array.isArray(items), "Should return array");
  assert.ok(items.length >= 2, "Should have at least 2 items");

  for (const item of items) {
    assert.ok(item.taskId, "Should have taskId");
    assert.ok(item.title !== undefined, "Should have title");
    assert.ok(item.priority, "Should have priority");
    assert.ok(item.taskStatus, "Should have taskStatus");
    assert.ok(item.updatedAt, "Should have updatedAt");
  }

  assertGolden("taskboard-list-output", {
    count: items.length,
    // Note: task IDs are sorted to ensure deterministic output regardless of insertion order
    taskIds: items.map((i) => i.taskId).sort(),
    hasSecondItem: items.length >= 2,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: task board item has all required fields", () => {
  const workspace = createTempWorkspace("aa-golden-taskboard-item-");

  const dbPath = `${workspace}/taskboard-item.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const service = new TaskBoardService(store);

  seedTaskAndExecution(db, store, {
    taskId: "taskboard_item_task_001",
    executionId: "taskboard_item_exec_001",
    traceId: "tb-item-trace",
  });

  const items = service.list(10);

  assert.ok(items.length > 0, "Should have at least one item");
  const item = items[0];

  // Verify all TaskBoardItem fields are present
  assert.ok(typeof item.taskId === "string", "taskId should be string");
  assert.ok(typeof item.title === "string", "title should be string");
  assert.ok(["low", "normal", "high", "critical"].includes(item.priority), "priority should be valid enum");
  assert.ok(["pending", "queued", "in_progress", "done", "failed", "cancelled"].includes(item.taskStatus), "taskStatus should be valid");
  assert.ok(item.workflowStatus === null || typeof item.workflowStatus === "string", "workflowStatus should be string or null");
  assert.ok(item.divisionId === null || typeof item.divisionId === "string", "divisionId should be string or null");
  assert.ok(item.currentStepIndex === null || typeof item.currentStepIndex === "number", "currentStepIndex should be number or null");
  assert.ok(item.sessionStatus === null || typeof item.sessionStatus === "string", "sessionStatus should be string or null");
  assert.ok(item.latestEventAt === null || typeof item.latestEventAt === "string", "latestEventAt should be string or null");
  assert.ok(typeof item.updatedAt === "string", "updatedAt should be string");

  assertGolden("taskboard-item-fields", {
    taskId: item.taskId,
    hasTitle: item.title.length > 0,
    priority: item.priority,
    taskStatus: item.taskStatus,
    hasWorkflowStatus: item.workflowStatus !== null,
    hasDivisionId: item.divisionId !== null,
    hasCurrentStepIndex: item.currentStepIndex !== null,
    hasSessionStatus: item.sessionStatus !== null,
    hasLatestEventAt: item.latestEventAt !== null,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: task board respects limit parameter", () => {
  const workspace = createTempWorkspace("aa-golden-taskboard-limit-");

  const dbPath = `${workspace}/taskboard-limit.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const service = new TaskBoardService(store);

  // Create 5 tasks
  for (let i = 1; i <= 5; i++) {
    seedTaskAndExecution(db, store, {
      taskId: `taskboard_limit_task_${String(i).padStart(3, "0")}`,
      executionId: `taskboard_limit_exec_${String(i).padStart(3, "0")}`,
      traceId: `tb-limit-trace-${i}`,
    });
  }

  const limitedItems = service.list(3);
  const allItems = service.list(100);

  assert.ok(limitedItems.length <= 3, "Should respect limit");
  assert.ok(allItems.length >= 5, "Should return more items with higher limit");

  assertGolden("taskboard-limit-behavior", {
    limitedCount: limitedItems.length,
    allCount: allItems.length,
    limitRespected: limitedItems.length <= 3,
  });

  db.close();
  cleanupPath(workspace);
});
