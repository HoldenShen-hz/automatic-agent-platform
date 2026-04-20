import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { TaskRepository } from "../../../../../../src/platform/state-evidence/truth/sqlite/repositories/task-repository.js";
import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";
import type { TaskRecord } from "../../../../../../src/platform/contracts/types/domain.js";
import type { TaskStatus } from "../../../../../../src/platform/contracts/types/status.js";

test("TaskRepository inserts a task and getTask returns it", () => {
  const workspace = createTempWorkspace("aa-task-repo-");
  const dbPath = join(workspace, "task-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new TaskRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const task: TaskRecord = {
      id: "task-001",
      parentId: null,
      rootId: "task-001",
      divisionId: "general_ops",
      tenantId: null,
      title: "Test task",
      status: "queued",
      source: "user",
      priority: "normal",
      inputJson: '{"user":"alice"}',
      normalizedInputJson: '{"user":"alice"}',
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    };

    repo.insertTask(task);
    const result = repo.getTask("task-001");

    assert.ok(result, "getTask should return the inserted task");
    assert.equal(result.id, "task-001");
    assert.equal(result.title, "Test task");
    assert.equal(result.status, "queued");
    assert.equal(result.divisionId, "general_ops");
    assert.equal(result.source, "user");
    assert.equal(result.priority, "normal");
    assert.equal(result.inputJson, '{"user":"alice"}');
  } finally {
    cleanupPath(workspace);
  }
});

test("TaskRepository getTask returns undefined for non-existent task", () => {
  const workspace = createTempWorkspace("aa-task-repo-");
  const dbPath = join(workspace, "task-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new TaskRepository(db.connection);

    const result = repo.getTask("nonexistent-task");
    assert.strictEqual(result, undefined);
  } finally {
    cleanupPath(workspace);
  }
});

test("TaskRepository getTask with tenantId filter returns task with matching tenant", () => {
  const workspace = createTempWorkspace("aa-task-repo-");
  const dbPath = join(workspace, "task-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new TaskRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    repo.insertTask({
      id: "task-tenant-a",
      parentId: null,
      rootId: "task-tenant-a",
      divisionId: "general_ops",
      tenantId: "tenant-a",
      title: "Tenant A task",
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
    repo.insertTask({
      id: "task-tenant-b",
      parentId: null,
      rootId: "task-tenant-b",
      divisionId: "general_ops",
      tenantId: "tenant-b",
      title: "Tenant B task",
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

    const resultA = repo.getTask("task-tenant-a", "tenant-a");
    assert.ok(resultA, "should find task with matching tenant");
    assert.equal(resultA.tenantId, "tenant-a");

    const resultB = repo.getTask("task-tenant-b", "tenant-b");
    assert.ok(resultB, "should find task with matching tenant");
    assert.equal(resultB.tenantId, "tenant-b");

    const wrongTenant = repo.getTask("task-tenant-a", "tenant-b");
    assert.strictEqual(wrongTenant, undefined, "should not find task with wrong tenant");
  } finally {
    cleanupPath(workspace);
  }
});

test("TaskRepository listTasks returns all tasks without filter", () => {
  const workspace = createTempWorkspace("aa-task-repo-");
  const dbPath = join(workspace, "task-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new TaskRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    for (let i = 1; i <= 3; i++) {
      repo.insertTask({
        id: `task-list-${i}`,
        parentId: null,
        rootId: `task-list-${i}`,
        divisionId: "general_ops",
        tenantId: null,
        title: `Task ${i}`,
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
    assert.equal(results.length, 3, "should return all 3 tasks");
  } finally {
    cleanupPath(workspace);
  }
});

test("TaskRepository listTasks with limit returns only specified number", () => {
  const workspace = createTempWorkspace("aa-task-repo-");
  const dbPath = join(workspace, "task-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new TaskRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    for (let i = 1; i <= 5; i++) {
      repo.insertTask({
        id: `task-limit-${i}`,
        parentId: null,
        rootId: `task-limit-${i}`,
        divisionId: "general_ops",
        tenantId: null,
        title: `Task ${i}`,
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

    const results = repo.listTasks(3);
    assert.equal(results.length, 3, "should return only 3 tasks");
  } finally {
    cleanupPath(workspace);
  }
});

test("TaskRepository updateTaskStatus changes task status", () => {
  const workspace = createTempWorkspace("aa-task-repo-");
  const dbPath = join(workspace, "task-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new TaskRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    repo.insertTask({
      id: "task-status-update",
      parentId: null,
      rootId: "task-status-update",
      divisionId: "general_ops",
      tenantId: null,
      title: "Status update test",
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

    repo.updateTaskStatus("task-status-update", "in_progress", now, null, null);

    const result = repo.getTask("task-status-update");
    assert.ok(result);
    assert.equal(result.status, "in_progress");
    assert.equal(result.errorCode, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("TaskRepository updateTaskStatusCas only updates when expected status matches", () => {
  const workspace = createTempWorkspace("aa-task-repo-");
  const dbPath = join(workspace, "task-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new TaskRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    repo.insertTask({
      id: "task-status-cas",
      parentId: null,
      rootId: "task-status-cas",
      divisionId: "general_ops",
      tenantId: null,
      title: "CAS test",
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

    const changed = repo.updateTaskStatusCas("task-status-cas", "queued", "in_progress", now, null, null);
    const unchanged = repo.updateTaskStatusCas("task-status-cas", "queued", "completed", now, null, now);

    assert.equal(changed, 1);
    assert.equal(unchanged, 0);
    assert.equal(repo.getTask("task-status-cas")?.status, "in_progress");
  } finally {
    cleanupPath(workspace);
  }
});

test("TaskRepository setTaskState overwrites terminal fields", () => {
  const workspace = createTempWorkspace("aa-task-repo-");
  const dbPath = join(workspace, "task-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new TaskRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const doneAt = "2026-04-14T10:30:00.000Z";
    repo.insertTask({
      id: "task-set-state",
      parentId: null,
      rootId: "task-set-state",
      divisionId: "general_ops",
      tenantId: null,
      title: "Set state test",
      status: "in_progress",
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

    repo.setTaskState({
      taskId: "task-set-state",
      status: "failed",
      updatedAt: doneAt,
      errorCode: "sandbox.timeout",
      completedAt: doneAt,
    });

    const result = repo.getTask("task-set-state");
    assert.equal(result?.status, "failed");
    assert.equal(result?.errorCode, "sandbox.timeout");
    assert.equal(result?.completedAt, doneAt);
  } finally {
    cleanupPath(workspace);
  }
});

test("TaskRepository updateTaskInput updates input and normalized input", () => {
  const workspace = createTempWorkspace("aa-task-repo-");
  const dbPath = join(workspace, "task-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new TaskRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const updatedAt = "2026-04-14T10:05:00.000Z";
    repo.insertTask({
      id: "task-input-update",
      parentId: null,
      rootId: "task-input-update",
      divisionId: "general_ops",
      tenantId: null,
      title: "Input test",
      status: "queued",
      source: "user",
      priority: "normal",
      inputJson: "{\"before\":true}",
      normalizedInputJson: null,
      outputJson: null,
      estimatedCostUsd: null,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    });

    repo.updateTaskInput("task-input-update", "{\"after\":true}", "{\"after\":true}", updatedAt);

    const result = repo.getTask("task-input-update");
    assert.equal(result?.inputJson, "{\"after\":true}");
    assert.equal(result?.normalizedInputJson, "{\"after\":true}");
    assert.equal(result?.updatedAt, updatedAt);
  } finally {
    cleanupPath(workspace);
  }
});

test("TaskRepository updateTaskStatus sets error code and completedAt on failure", () => {
  const workspace = createTempWorkspace("aa-task-repo-");
  const dbPath = join(workspace, "task-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new TaskRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const completedAt = "2026-04-14T11:00:00.000Z";
    repo.insertTask({
      id: "task-failed",
      parentId: null,
      rootId: "task-failed",
      divisionId: "general_ops",
      tenantId: null,
      title: "Failed task",
      status: "in_progress",
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

    repo.updateTaskStatus("task-failed", "failed", now, "task.execution_error", completedAt);

    const result = repo.getTask("task-failed");
    assert.ok(result);
    assert.equal(result.status, "failed");
    assert.equal(result.errorCode, "task.execution_error");
    assert.equal(result.completedAt, completedAt);
  } finally {
    cleanupPath(workspace);
  }
});

test("TaskRepository updateTaskOutput updates output json", () => {
  const workspace = createTempWorkspace("aa-task-repo-");
  const dbPath = join(workspace, "task-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new TaskRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    repo.insertTask({
      id: "task-output-update",
      parentId: null,
      rootId: "task-output-update",
      divisionId: "general_ops",
      tenantId: null,
      title: "Output update test",
      status: "in_progress",
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

    const outputJson = '{"result":"success","data":[1,2,3]}';
    repo.updateTaskOutput("task-output-update", outputJson, now);

    const result = repo.getTask("task-output-update");
    assert.ok(result);
    assert.equal(result.outputJson, outputJson);
  } finally {
    cleanupPath(workspace);
  }
});

test("TaskRepository countQueuedTasks returns correct count", () => {
  const workspace = createTempWorkspace("aa-task-repo-");
  const dbPath = join(workspace, "task-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new TaskRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    for (let i = 0; i < 3; i++) {
      const status: TaskStatus = i < 2 ? "queued" : "in_progress";
      repo.insertTask({
        id: `task-count-${i}`,
        parentId: null,
        rootId: `task-count-${i}`,
        divisionId: "general_ops",
        tenantId: null,
        title: `Task ${i}`,
        status,
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

    const count = repo.countQueuedTasks();
    assert.equal(count, 2, "should count only queued tasks");
  } finally {
    cleanupPath(workspace);
  }
});

test("TaskRepository insertTask violates primary key constraint throws error", () => {
  const workspace = createTempWorkspace("aa-task-repo-");
  const dbPath = join(workspace, "task-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new TaskRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    repo.insertTask({
      id: "task-duplicate",
      parentId: null,
      rootId: "task-duplicate",
      divisionId: "general_ops",
      tenantId: null,
      title: "First task",
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

    assert.throws(() => {
      repo.insertTask({
        id: "task-duplicate",
        parentId: null,
        rootId: "task-duplicate",
        divisionId: "general_ops",
        tenantId: null,
        title: "Duplicate task",
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
    }, /UNIQUE.*task-duplicate|UNIQUE constraint failed/i);
  } finally {
    cleanupPath(workspace);
  }
});

test("TaskRepository column mapping snake_case to camelCase is correct", () => {
  const workspace = createTempWorkspace("aa-task-repo-");
  const dbPath = join(workspace, "task-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new TaskRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    repo.insertTask({
      id: "task-columns",
      parentId: null,
      rootId: "task-columns",
      divisionId: null,
      tenantId: "tenant-xyz",
      title: "Column mapping test",
      status: "in_progress",
      source: "system",
      priority: "high",
      inputJson: '{"key":"value"}',
      normalizedInputJson: '{"key":"value"}',
      outputJson: '{"out":"result"}',
      estimatedCostUsd: 1.5,
      actualCostUsd: 2.5,
      errorCode: "some_error",
      createdAt: now,
      updatedAt: now,
      completedAt: now,
    });

    const result = repo.getTask("task-columns");
    assert.ok(result);
    assert.equal(result.parentId, null);
    assert.equal(result.rootId, "task-columns");
    assert.equal(result.divisionId, null);
    assert.equal(result.tenantId, "tenant-xyz");
    assert.equal(result.inputJson, '{"key":"value"}');
    assert.equal(result.normalizedInputJson, '{"key":"value"}');
    assert.equal(result.outputJson, '{"out":"result"}');
    assert.equal(result.estimatedCostUsd, 1.5);
    assert.equal(result.actualCostUsd, 2.5);
    assert.equal(result.errorCode, "some_error");
    assert.equal(result.completedAt, now);
  } finally {
    cleanupPath(workspace);
  }
});
