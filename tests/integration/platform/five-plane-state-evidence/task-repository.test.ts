/**
 * Integration tests for TaskRepository CRUD operations.
 *
 * Tests SQLite-based task repository: insert, get, update, list,
 * and terminal status immutability enforcement.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createIntegrationContext } from "../../../helpers/integration-context.js";
import { TaskRepository } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/task-repository.js";
import type { TaskRecord } from "../../../../src/platform/contracts/types/domain.js";

function makeTask(overrides: Partial<TaskRecord> = {}): TaskRecord {
  const now = new Date().toISOString();
  return {
    id: "task-test-001",
    parentId: null,
    rootId: "task-test-001",
    divisionId: "general_ops",
    tenantId: null,
    title: "Test task",
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
    ...overrides,
  };
}

test("integration: TaskRepository.insertTask creates task record", () => {
  const ctx = createIntegrationContext("aa-task-repo-insert-");
  try {
    const repo = new TaskRepository(ctx.db.connection);
    const task = makeTask({ id: "task-insert-001", title: "Insert test" });

    repo.insertTask(task);
    const retrieved = repo.getTask("task-insert-001");

    assert.notEqual(retrieved, undefined);
    assert.equal(retrieved!.id, "task-insert-001");
    assert.equal(retrieved!.title, "Insert test");
    assert.equal(retrieved!.status, "queued");
    assert.equal(retrieved!.divisionId, "general_ops");
    assert.equal(retrieved!.source, "user");
    assert.equal(retrieved!.priority, "normal");
  } finally {
    ctx.cleanup();
  }
});

test("integration: TaskRepository.getTask retrieves task by ID", () => {
  const ctx = createIntegrationContext("aa-task-repo-get-");
  try {
    const repo = new TaskRepository(ctx.db.connection);
    const task = makeTask({ id: "task-get-001", title: "Get test" });
    repo.insertTask(task);

    const retrieved = repo.getTask("task-get-001");

    assert.notEqual(retrieved, undefined);
    assert.equal(retrieved!.id, "task-get-001");
    assert.equal(retrieved!.title, "Get test");
  } finally {
    ctx.cleanup();
  }
});

test("integration: TaskRepository.getTask returns undefined for non-existent task", () => {
  const ctx = createIntegrationContext("aa-task-repo-get-none-");
  try {
    const repo = new TaskRepository(ctx.db.connection);
    const retrieved = repo.getTask("non-existent-task");
    assert.equal(retrieved, undefined);
  } finally {
    ctx.cleanup();
  }
});

test("integration: TaskRepository.updateTaskStatus updates task status correctly", () => {
  const ctx = createIntegrationContext("aa-task-repo-update-");
  try {
    const repo = new TaskRepository(ctx.db.connection);
    const task = makeTask({ id: "task-update-001", status: "queued" });
    repo.insertTask(task);

    const updatedAt = new Date().toISOString();
    repo.updateTaskStatus("task-update-001", "in_progress", updatedAt, null, null);

    const retrieved = repo.getTask("task-update-001");
    assert.notEqual(retrieved, undefined);
    assert.equal(retrieved!.status, "in_progress");
    assert.equal(retrieved!.updatedAt, updatedAt);
  } finally {
    ctx.cleanup();
  }
});

test("integration: TaskRepository.updateTaskStatus sets completedAt on terminal status", () => {
  const ctx = createIntegrationContext("aa-task-repo-update-completed-");
  try {
    const repo = new TaskRepository(ctx.db.connection);
    const task = makeTask({ id: "task-update-done-001", status: "in_progress" });
    repo.insertTask(task);

    const updatedAt = new Date().toISOString();
    const completedAt = new Date().toISOString();
    repo.updateTaskStatus("task-update-done-001", "done", updatedAt, null, completedAt);

    const retrieved = repo.getTask("task-update-done-001");
    assert.notEqual(retrieved, undefined);
    assert.equal(retrieved!.status, "done");
    assert.notEqual(retrieved!.completedAt, null);
  } finally {
    ctx.cleanup();
  }
});

test("integration: TaskRepository.updateTaskStatus sets errorCode on failed status", () => {
  const ctx = createIntegrationContext("aa-task-repo-update-failed-");
  try {
    const repo = new TaskRepository(ctx.db.connection);
    const task = makeTask({ id: "task-update-fail-001", status: "in_progress" });
    repo.insertTask(task);

    const updatedAt = new Date().toISOString();
    repo.updateTaskStatus("task-update-fail-001", "failed", updatedAt, "ERR_EXECUTION_TIMEOUT", null);

    const retrieved = repo.getTask("task-update-fail-001");
    assert.notEqual(retrieved, undefined);
    assert.equal(retrieved!.status, "failed");
    assert.equal(retrieved!.errorCode, "ERR_EXECUTION_TIMEOUT");
  } finally {
    ctx.cleanup();
  }
});

test("integration: TaskRepository.listTasks returns all tasks", () => {
  const ctx = createIntegrationContext("aa-task-repo-list-");
  try {
    const repo = new TaskRepository(ctx.db.connection);
    repo.insertTask(makeTask({ id: "task-list-001", title: "Task 1" }));
    repo.insertTask(makeTask({ id: "task-list-002", title: "Task 2" }));
    repo.insertTask(makeTask({ id: "task-list-003", title: "Task 3" }));

    const tasks = repo.listTasks();

    assert.equal(tasks.length, 3);
    const ids = tasks.map((t) => t.id).sort();
    assert.deepEqual(ids, ["task-list-001", "task-list-002", "task-list-003"]);
  } finally {
    ctx.cleanup();
  }
});

test("integration: TaskRepository.listTasks respects limit", () => {
  const ctx = createIntegrationContext("aa-task-repo-list-limit-");
  try {
    const repo = new TaskRepository(ctx.db.connection);
    repo.insertTask(makeTask({ id: "task-limit-001" }));
    repo.insertTask(makeTask({ id: "task-limit-002" }));
    repo.insertTask(makeTask({ id: "task-limit-003" }));

    const tasks = repo.listTasks(2);

    assert.equal(tasks.length, 2);
  } finally {
    ctx.cleanup();
  }
});

test("integration: TaskRepository.updateTaskStatusCas uses compare-and-swap", () => {
  const ctx = createIntegrationContext("aa-task-repo-cas-");
  try {
    const repo = new TaskRepository(ctx.db.connection);
    const task = makeTask({ id: "task-cas-001", status: "queued" });
    repo.insertTask(task);

    // Successful CAS: status matches expected
    const updatedAt = new Date().toISOString();
    const rowsAffected = repo.updateTaskStatusCas("task-cas-001", "queued", "in_progress", updatedAt, null, null);
    assert.equal(rowsAffected, 1);

    const retrieved = repo.getTask("task-cas-001");
    assert.equal(retrieved!.status, "in_progress");

    // Failed CAS: status does not match expected
    const rowsAffected2 = repo.updateTaskStatusCas("task-cas-001", "queued", "done", updatedAt, null, null);
    assert.equal(rowsAffected2, 0);

    // Status should remain unchanged
    const retrieved2 = repo.getTask("task-cas-001");
    assert.equal(retrieved2!.status, "in_progress");
  } finally {
    ctx.cleanup();
  }
});

test("integration: TaskRepository.setTaskState overwrites task state unconditionally", () => {
  const ctx = createIntegrationContext("aa-task-repo-setstate-");
  try {
    const repo = new TaskRepository(ctx.db.connection);
    const task = makeTask({ id: "task-setstate-001", status: "queued" });
    repo.insertTask(task);

    const updatedAt = new Date().toISOString();
    repo.setTaskState({
      taskId: "task-setstate-001",
      status: "done",
      updatedAt,
      errorCode: null,
      completedAt: updatedAt,
    });

    const retrieved = repo.getTask("task-setstate-001");
    assert.notEqual(retrieved, undefined);
    assert.equal(retrieved!.status, "done");
    assert.notEqual(retrieved!.completedAt, null);
  } finally {
    ctx.cleanup();
  }
});

test("integration: TaskRepository.updateTaskOutput updates outputJson", () => {
  const ctx = createIntegrationContext("aa-task-repo-output-");
  try {
    const repo = new TaskRepository(ctx.db.connection);
    const task = makeTask({ id: "task-output-001" });
    repo.insertTask(task);

    const updatedAt = new Date().toISOString();
    const outputJson = JSON.stringify({ result: "success", data: { foo: "bar" } });
    repo.updateTaskOutput("task-output-001", outputJson, updatedAt);

    const retrieved = repo.getTask("task-output-001");
    assert.notEqual(retrieved, undefined);
    assert.equal(retrieved!.outputJson, outputJson);
  } finally {
    ctx.cleanup();
  }
});

test("integration: TaskRepository.countQueuedTasks returns correct count", () => {
  const ctx = createIntegrationContext("aa-task-repo-count-");
  try {
    const repo = new TaskRepository(ctx.db.connection);
    repo.insertTask(makeTask({ id: "task-count-001", status: "queued" }));
    repo.insertTask(makeTask({ id: "task-count-002", status: "pending" }));
    repo.insertTask(makeTask({ id: "task-count-003", status: "in_progress" }));
    repo.insertTask(makeTask({ id: "task-count-004", status: "done" }));

    const count = repo.countQueuedTasks();
    assert.equal(count, 2);
  } finally {
    ctx.cleanup();
  }
});
