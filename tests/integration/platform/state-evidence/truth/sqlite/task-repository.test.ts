/**
 * Integration Tests: TaskRepository (SQLite Direct)
 *
 * Tests data access operations on the tasks table using
 * TaskRepository with a real SQLite database in temp directory.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { TaskRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/task-repository.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";

test("TaskRepository: insert and retrieve task", () => {
  const workspace = createTempWorkspace("aa-task-repo-");
  let db: SqliteDatabase;
  let repo: TaskRepository;

  try {
    const dbPath = join(workspace, "task_test.db");
    db = new SqliteDatabase(dbPath);
    db.migrate();
    repo = new TaskRepository(db.connection);

    const taskId = "task-repo-001";
    const now = new Date().toISOString();

    db.transaction(() => {
      repo.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: "tenant-test",
        title: "Task Repository Test",
        status: "queued",
        source: "user",
        priority: "normal",
        inputJson: '{"test":"value"}',
        normalizedInputJson: '{"test":"value"}',
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    const retrieved = repo.getTask(taskId);

    assert.ok(retrieved, "Task should be retrieved");
    assert.equal(retrieved!.id, taskId);
    assert.equal(retrieved!.title, "Task Repository Test");
    assert.equal(retrieved!.status, "queued");
    assert.equal(retrieved!.tenantId, "tenant-test");
  } finally {
    db?.close();
    cleanupPath(workspace);
  }
});

test("TaskRepository: get task returns undefined for non-existent", () => {
  const workspace = createTempWorkspace("aa-task-notfound-");
  let db: SqliteDatabase;
  let repo: TaskRepository;

  try {
    const dbPath = join(workspace, "task_notfound.db");
    db = new SqliteDatabase(dbPath);
    db.migrate();
    repo = new TaskRepository(db.connection);

    const result = repo.getTask("non-existent-task");

    assert.equal(result, undefined);
  } finally {
    db?.close();
    cleanupPath(workspace);
  }
});

test("TaskRepository: update task status with CAS", () => {
  const workspace = createTempWorkspace("aa-task-cas-");
  let db: SqliteDatabase;
  let repo: TaskRepository;

  try {
    const dbPath = join(workspace, "task_cas.db");
    db = new SqliteDatabase(dbPath);
    db.migrate();
    repo = new TaskRepository(db.connection);

    const taskId = "task-cas-001";
    const now = new Date().toISOString();

    db.transaction(() => {
      repo.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: "tenant-cas",
        title: "CAS Test Task",
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
    });

    // Update with CAS - current status is "queued"
    const updateTime = new Date().toISOString();
    const rowsAffected = db.transaction(() => {
      return repo.updateTaskStatusCas(taskId, "queued", "in_progress", updateTime, null, null);
    });

    assert.equal(rowsAffected, 1, "Should update 1 row");

    const updated = repo.getTask(taskId);
    assert.equal(updated!.status, "in_progress");
    assert.equal(updated!.updatedAt, updateTime);

    // CAS should fail if expected status doesn't match
    const rowsFailed = db.transaction(() => {
      return repo.updateTaskStatusCas(taskId, "queued", "done", updateTime, null, updateTime);
    });

    assert.equal(rowsFailed, 0, "Should update 0 rows when status doesn't match");
    assert.equal(updated!.status, "in_progress", "Status should remain unchanged");
  } finally {
    db?.close();
    cleanupPath(workspace);
  }
});

test("TaskRepository: list tasks with limit and tenant filter", () => {
  const workspace = createTempWorkspace("aa-task-list-");
  let db: SqliteDatabase;
  let repo: TaskRepository;

  try {
    const dbPath = join(workspace, "task_list.db");
    db = new SqliteDatabase(dbPath);
    db.migrate();
    repo = new TaskRepository(db.connection);

    const tenantId = "tenant-list";
    const now = new Date().toISOString();

    db.transaction(() => {
      for (let i = 0; i < 15; i++) {
        repo.insertTask({
          id: `task-list-${i}`,
          parentId: null,
          rootId: `task-list-${i}`,
          divisionId: "general_ops",
          tenantId,
          title: `Task ${i}`,
          status: "queued",
          source: "user",
          priority: i % 2 === 0 ? "high" : "normal",
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

    const allTasks = repo.listTasks(undefined, tenantId);
    assert.equal(allTasks.length, 15, "Should list all 15 tasks");

    const limitedTasks = repo.listTasks(5, tenantId);
    assert.equal(limitedTasks.length, 5, "Should limit to 5 tasks");

    // List tasks for different tenant - should be empty
    const otherTenantTasks = repo.listTasks(undefined, "other-tenant");
    assert.equal(otherTenantTasks.length, 0, "Should return empty for non-matching tenant");
  } finally {
    db?.close();
    cleanupPath(workspace);
  }
});

test("TaskRepository: update task output", () => {
  const workspace = createTempWorkspace("aa-task-output-");
  let db: SqliteDatabase;
  let repo: TaskRepository;

  try {
    const dbPath = join(workspace, "task_output.db");
    db = new SqliteDatabase(dbPath);
    db.migrate();
    repo = new TaskRepository(db.connection);

    const taskId = "task-output-001";
    const now = new Date().toISOString();

    db.transaction(() => {
      repo.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: "tenant-output",
        title: "Output Test",
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
    });

    const outputJson = '{"result":"success","data":{"key":"value"}}';
    const updateTime = new Date().toISOString();

    db.transaction(() => {
      repo.updateTaskOutput(taskId, outputJson, updateTime);
    });

    const updated = repo.getTask(taskId);
    assert.equal(updated!.outputJson, outputJson, "Output should be updated");
  } finally {
    db?.close();
    cleanupPath(workspace);
  }
});

test("TaskRepository: count queued tasks", () => {
  const workspace = createTempWorkspace("aa-task-count-");
  let db: SqliteDatabase;
  let repo: TaskRepository;

  try {
    const dbPath = join(workspace, "task_count.db");
    db = new SqliteDatabase(dbPath);
    db.migrate();
    repo = new TaskRepository(db.connection);

    const tenantId = "tenant-count";
    const now = new Date().toISOString();

    db.transaction(() => {
      // Insert 3 queued tasks
      for (let i = 0; i < 3; i++) {
        repo.insertTask({
          id: `task-queued-${i}`,
          parentId: null,
          rootId: `task-queued-${i}`,
          divisionId: "general_ops",
          tenantId,
          title: `Queued Task ${i}`,
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
      }

      // Insert 2 pending tasks
      for (let i = 0; i < 2; i++) {
        repo.insertTask({
          id: `task-pending-${i}`,
          parentId: null,
          rootId: `task-pending-${i}`,
          divisionId: "general_ops",
          tenantId,
          title: `Pending Task ${i}`,
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

      // Insert 1 done task (should not be counted)
      repo.insertTask({
        id: "task-done-001",
        parentId: null,
        rootId: "task-done-001",
        divisionId: "general_ops",
        tenantId,
        title: "Done Task",
        status: "done",
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
        completedAt: now,
      });
    });

    const totalQueued = repo.countQueuedTasks();
    const tenantQueued = repo.countQueuedTasks(tenantId);

    assert.equal(totalQueued, 5, "Should count 5 total queued/pending tasks");
    assert.equal(tenantQueued, 5, "Should count 5 tenant queued/pending tasks");

    const otherTenantQueued = repo.countQueuedTasks("other-tenant");
    assert.equal(otherTenantQueued, 0, "Should count 0 for non-existent tenant");
  } finally {
    db?.close();
    cleanupPath(workspace);
  }
});

test("TaskRepository: parent-child task relationships", () => {
  const workspace = createTempWorkspace("aa-task-parent-");
  let db: SqliteDatabase;
  let repo: TaskRepository;

  try {
    const dbPath = join(workspace, "task_parent.db");
    db = new SqliteDatabase(dbPath);
    db.migrate();
    repo = new TaskRepository(db.connection);

    const parentId = "task-parent-001";
    const childId = "task-child-001";
    const now = new Date().toISOString();

    db.transaction(() => {
      repo.insertTask({
        id: parentId,
        parentId: null,
        rootId: parentId,
        divisionId: "general_ops",
        tenantId: "tenant-parent",
        title: "Parent Task",
        status: "in_progress",
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

      repo.insertTask({
        id: childId,
        parentId,
        rootId: parentId,
        divisionId: "general_ops",
        tenantId: "tenant-parent",
        title: "Child Task",
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
    });

    const parent = repo.getTask(parentId);
    assert.equal(parent!.id, parentId);
    assert.equal(parent!.parentId, null);
    assert.equal(parent!.rootId, parentId);

    const child = repo.getTask(childId);
    assert.equal(child!.parentId, parentId);
    assert.equal(child!.rootId, parentId);
  } finally {
    db?.close();
    cleanupPath(workspace);
  }
});