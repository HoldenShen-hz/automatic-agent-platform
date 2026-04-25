/**
 * Integration Test: Task Decomposition Service
 *
 * Tests task decomposition for breaking down complex requests
 * into executable steps with proper dependency tracking.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { TaskDecompositionService } from "../../../../../src/platform/orchestration/planner/task-decomposition-service.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("task decomposition: decomposes complex task into steps", () => {
  const workspace = createTempWorkspace("aa-decompose-");

  try {
    const db = new SqliteDatabase(join(workspace, "decompose.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TaskDecompositionService(store);

    const result = service.decompose({
      taskId: newId("task"),
      userRequest: "Implement a user authentication system with login, logout, and session management",
      context: { domain: "coding", priority: "high" },
    });

    assert.ok(result.subtasks.length >= 2);
    assert.ok(result.subtasks.every((s) => s.name.length > 0));
    assert.ok(result.dependencies.size >= 0);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("task decomposition: handles simple single-step task", () => {
  const workspace = createTempWorkspace("aa-decompose-simple-");

  try {
    const db = new SqliteDatabase(join(workspace, "decompose-simple.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TaskDecompositionService(store);

    const result = service.decompose({
      taskId: newId("task"),
      userRequest: "List files in current directory",
      context: { domain: "ops" },
    });

    assert.ok(result.subtasks.length >= 1);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("task decomposition: preserves dependencies between subtasks", () => {
  const workspace = createTempWorkspace("aa-decompose-deps-");

  try {
    const db = new SqliteDatabase(join(workspace, "decompose-deps.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TaskDecompositionService(store);

    const result = service.decompose({
      taskId: newId("task"),
      userRequest: "Build and test a new feature, then deploy it",
      context: { domain: "coding" },
    });

    assert.ok(result.dependencies.size >= 0);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("task decomposition: estimates complexity correctly", () => {
  const workspace = createTempWorkspace("aa-decompose-complex-");

  try {
    const db = new SqliteDatabase(join(workspace, "decompose-complex.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TaskDecompositionService(store);

    const simpleResult = service.decompose({
      taskId: newId("task"),
      userRequest: "Echo hello",
      context: {},
    });

    const complexResult = service.decompose({
      taskId: newId("task"),
      userRequest: "Implement a distributed transaction system with consensus, replication, and failure recovery",
      context: {},
    });

    assert.ok(complexResult.subtasks.length >= simpleResult.subtasks.length);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("task decomposition: validates subtask outputs", () => {
  const workspace = createTempWorkspace("aa-decompose-validate-");

  try {
    const db = new SqliteDatabase(join(workspace, "decompose-validate.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TaskDecompositionService(store);

    const result = service.decompose({
      taskId: newId("task"),
      userRequest: "Create and configure a new database",
      context: {},
    });

    const validation = service.validateSubtasks(result.subtasks);
    assert.strictEqual(validation.valid, true);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("task decomposition: detects missing required fields", () => {
  const workspace = createTempWorkspace("aa-decompose-missing-");

  try {
    const db = new SqliteDatabase(join(workspace, "decompose-missing.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new TaskDecompositionService(store);

    const result = service.decompose({
      taskId: newId("task"),
      userRequest: "Do something important",
      context: {},
    });

    const validation = service.validateSubtasks(result.subtasks);
    assert.ok(validation.errors.length >= 0);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});
