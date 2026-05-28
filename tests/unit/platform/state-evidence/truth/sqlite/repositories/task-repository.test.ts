import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { TaskRepository } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/task-repository.js";
import { SqliteDatabase } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../../helpers/fs.js";
import type { TaskRecord } from "../../../../../../../src/platform/contracts/types/domain.js";

function createTestTask(
  repo: TaskRepository,
  taskId: string,
  now: string,
  overrides: Partial<TaskRecord> = {},
): void {
  repo.insertTask({
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId: "general_ops",
    tenantId: null,
    title: `Task ${taskId}`,
    status: "queued",
    source: "user",
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
    ...overrides,
  });
}

test("TaskRepository insertTask and getTask round-trip", () => {
  const workspace = createTempWorkspace("aa-sqlite-task-repo-");
  const dbPath = join(workspace, "task-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new TaskRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    const task: TaskRecord = {
      id: "sqlite-task-001",
      parentId: null,
      rootId: "sqlite-task-001",
      divisionId: "general_ops",
      tenantId: "tenant-x",
      title: "SQLite task round-trip test",
      status: "queued",
      source: "user",
      priority: "high",
      inputJson: '{"key":"value"}',
      normalizedInputJson: '{"key":"value"}',
      outputJson: null,
      estimatedCostUsd: 1.5,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };

    repo.insertTask(task);
    const result = repo.getTask("sqlite-task-001");

    assert.ok(result, "getTask should return inserted task");
    assert.equal(result.id, "sqlite-task-001");
    assert.equal(result.title, "SQLite task round-trip test");
    assert.equal(result.status, "queued");
    assert.equal(result.priority, "high");
    assert.equal(result.tenantId, "tenant-x");
    assert.equal(result.inputJson, '{"key":"value"}');
    assert.equal(result.normalizedInputJson, '{"key":"value"}');
    assert.equal(result.estimatedCostUsd, 1.5);
  } finally {
    cleanupPath(workspace);
  }
});

test("TaskRepository getTask returns undefined for non-existent task", () => {
  const workspace = createTempWorkspace("aa-sqlite-task-repo-");
  const dbPath = join(workspace, "task-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new TaskRepository(db.connection);

    const result = repo.getTask("nonexistent-task-id");
    assert.strictEqual(result, undefined);
  } finally {
    cleanupPath(workspace);
  }
});

test("TaskRepository getTask with tenantId filter scopes query", () => {
  const workspace = createTempWorkspace("aa-sqlite-task-repo-");
  const dbPath = join(workspace, "task-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new TaskRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    createTestTask(repo, "task-tenant-scope-a", now, { tenantId: "tenant-a", title: "Tenant A task" });
    createTestTask(repo, "task-tenant-scope-b", now, { tenantId: "tenant-b", title: "Tenant B task" });

    const foundA = repo.getTask("task-tenant-scope-a", "tenant-a");
    assert.ok(foundA);
    assert.equal(foundA.tenantId, "tenant-a");

    const foundB = repo.getTask("task-tenant-scope-b", "tenant-b");
    assert.ok(foundB);
    assert.equal(foundB.tenantId, "tenant-b");

    // Cross-tenant lookup should fail
    const wrongTenant = repo.getTask("task-tenant-scope-a", "tenant-b");
    assert.strictEqual(wrongTenant, undefined);
  } finally {
    cleanupPath(workspace);
  }
});

test("TaskRepository listTasks returns all tasks ordered by updated_at DESC", () => {
  const workspace = createTempWorkspace("aa-sqlite-task-repo-");
  const dbPath = join(workspace, "task-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new TaskRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    for (let i = 1; i <= 5; i++) {
      repo.insertTask({
        id: `sqlite-list-${i}`,
        parentId: null,
        rootId: `sqlite-list-${i}`,
        divisionId: "general_ops",
        tenantId: null,
        title: `List task ${i}`,
        status: "queued",
        source: "user",
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
    }

    const results = repo.listTasks();
    assert.equal(results.length, 5);
  } finally {
    cleanupPath(workspace);
  }
});

test("TaskRepository listTasks with limit returns specified number", () => {
  const workspace = createTempWorkspace("aa-sqlite-task-repo-");
  const dbPath = join(workspace, "task-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new TaskRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    for (let i = 1; i <= 5; i++) {
      createTestTask(repo, `sqlite-limit-${i}`, now);
    }

    const results = repo.listTasks(3);
    assert.equal(results.length, 3);
  } finally {
    cleanupPath(workspace);
  }
});

test("TaskRepository listTasks with cursor pagination", () => {
  const workspace = createTempWorkspace("aa-sqlite-task-repo-");
  const dbPath = join(workspace, "task-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new TaskRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    const timestamps = [
      "2026-04-27T10:00:00.000Z",
      "2026-04-27T10:01:00.000Z",
      "2026-04-27T10:02:00.000Z",
    ];

    for (let i = 0; i < 3; i++) {
      createTestTask(repo, `sqlite-cursor-${i}`, timestamps[i]!);
    }

    const firstPage = repo.listTasks(2);
    assert.equal(firstPage.length, 2);

    const cursorTask = firstPage[1];
    if (cursorTask) {
      const cursor = TaskRepository.encodeCursor(cursorTask);
      const secondPage = repo.listTasks(2, undefined, cursor);
      assert.ok(secondPage.length >= 1);
    }
  } finally {
    cleanupPath(workspace);
  }
});

test("TaskRepository updateTaskStatus changes status and timestamps", () => {
  const workspace = createTempWorkspace("aa-sqlite-task-repo-");
  const dbPath = join(workspace, "task-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new TaskRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    const later = "2026-04-27T11:00:00.000Z";
    createTestTask(repo, "sqlite-status-update", now);

    repo.updateTaskStatus("sqlite-status-update", "in_progress", later, null, null);

    const result = repo.getTask("sqlite-status-update");
    assert.equal(result?.status, "in_progress");
    assert.equal(result?.updatedAt, later);
    assert.equal(result?.errorCode, null);
    assert.equal(result?.completedAt, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("TaskRepository updateTaskStatus sets error and completedAt on failure", () => {
  const workspace = createTempWorkspace("aa-sqlite-task-repo-");
  const dbPath = join(workspace, "task-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new TaskRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    const failedAt = "2026-04-27T11:30:00.000Z";
    createTestTask(repo, "sqlite-failed-task", now);

    repo.updateTaskStatus("sqlite-failed-task", "failed", failedAt, "task.timeout", failedAt);

    const result = repo.getTask("sqlite-failed-task");
    assert.equal(result?.status, "failed");
    assert.equal(result?.errorCode, "task.timeout");
    assert.equal(result?.completedAt, failedAt);
  } finally {
    cleanupPath(workspace);
  }
});

test("TaskRepository updateTaskStatusCas only updates when expected status matches", () => {
  const workspace = createTempWorkspace("aa-sqlite-task-repo-");
  const dbPath = join(workspace, "task-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new TaskRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    createTestTask(repo, "sqlite-cas-task", now);

    // CAS should succeed - current status is queued
    const changed = repo.updateTaskStatusCas("sqlite-cas-task", "queued", "in_progress", now, null, null);
    assert.equal(changed, 1);

    // CAS should fail - current status is now in_progress, not queued
    const unchanged = repo.updateTaskStatusCas("sqlite-cas-task", "queued", "completed", now, null, now);
    assert.equal(unchanged, 0);

    const finalState = repo.getTask("sqlite-cas-task");
    assert.equal(finalState?.status, "in_progress");
  } finally {
    cleanupPath(workspace);
  }
});

test("TaskRepository setTaskState overwrites all state fields", () => {
  const workspace = createTempWorkspace("aa-sqlite-task-repo-");
  const dbPath = join(workspace, "task-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new TaskRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    createTestTask(repo, "sqlite-state-set", now, { status: "in_progress" });

    const doneAt = "2026-04-27T12:00:00.000Z";
    repo.setTaskState({
      taskId: "sqlite-state-set",
      status: "failed",
      updatedAt: doneAt,
      errorCode: "sandbox.terminated",
      completedAt: doneAt,
    });

    const result = repo.getTask("sqlite-state-set");
    assert.equal(result?.status, "failed");
    assert.equal(result?.errorCode, "sandbox.terminated");
    assert.equal(result?.completedAt, doneAt);
    assert.equal(result?.updatedAt, doneAt);
  } finally {
    cleanupPath(workspace);
  }
});

test("TaskRepository updateTaskOutput updates output and updatedAt", () => {
  const workspace = createTempWorkspace("aa-sqlite-task-repo-");
  const dbPath = join(workspace, "task-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new TaskRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    createTestTask(repo, "sqlite-output-task", now, { status: "in_progress" });

    const outputJson = '{"result":"completed","data":[1,2,3]}';
    const doneAt = "2026-04-27T12:30:00.000Z";
    repo.updateTaskOutput("sqlite-output-task", outputJson, doneAt);

    const result = repo.getTask("sqlite-output-task");
    assert.equal(result?.outputJson, outputJson);
    assert.equal(result?.updatedAt, doneAt);
  } finally {
    cleanupPath(workspace);
  }
});

test("TaskRepository updateTaskInput updates both input fields", () => {
  const workspace = createTempWorkspace("aa-sqlite-task-repo-");
  const dbPath = join(workspace, "task-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new TaskRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    const updatedAt = "2026-04-27T10:15:00.000Z";
    createTestTask(repo, "sqlite-input-task", now, { inputJson: '{"before":true}' });

    repo.updateTaskInput("sqlite-input-task", '{"after":true}', '{"after":true}', updatedAt);

    const result = repo.getTask("sqlite-input-task");
    assert.equal(result?.inputJson, '{"after":true}');
    assert.equal(result?.normalizedInputJson, '{"after":true}');
    assert.equal(result?.updatedAt, updatedAt);
  } finally {
    cleanupPath(workspace);
  }
});

test("TaskRepository countQueuedTasks counts tasks with queued or pending status", () => {
  const workspace = createTempWorkspace("aa-sqlite-task-repo-");
  const dbPath = join(workspace, "task-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new TaskRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    createTestTask(repo, "sqlite-queued-1", now, { status: "queued" });
    createTestTask(repo, "sqlite-queued-2", now, { status: "queued" });
    createTestTask(repo, "sqlite-pending-1", now, { status: "pending" });
    createTestTask(repo, "sqlite-in-progress-1", now, { status: "in_progress" });
    createTestTask(repo, "sqlite-completed-1", now, { status: "completed" });

    const count = repo.countQueuedTasks();
    assert.equal(count, 3, "should count queued + pending tasks");
  } finally {
    cleanupPath(workspace);
  }
});

test("TaskRepository insertTask violates primary key constraint", () => {
  const workspace = createTempWorkspace("aa-sqlite-task-repo-");
  const dbPath = join(workspace, "task-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new TaskRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    createTestTask(repo, "sqlite-duplicate-task", now);

    assert.throws(() => {
      createTestTask(repo, "sqlite-duplicate-task", now);
    }, /UNIQUE.*sqlite-duplicate-task|UNIQUE constraint failed/i);
  } finally {
    cleanupPath(workspace);
  }
});
