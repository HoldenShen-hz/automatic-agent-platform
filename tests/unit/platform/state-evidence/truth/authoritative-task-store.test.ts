/**
 * Unit tests for AuthoritativeTaskStore
 *
 * Tests core task store operations using in-memory SQLite database.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";

function createTestDb(): { db: SqliteDatabase; cleanup: () => void } {
  const db = new SqliteDatabase(":memory:");
  db.migrate();
  return {
    db,
    cleanup: () => db.close(),
  };
}

const now = "2026-04-29T00:00:00.000Z";

function createTestTaskRecord(overrides: Partial<{
  id: string;
  tenantId: string | null;
  status: string;
}> = {}): Parameters<AuthoritativeTaskStore["insertTask"]>[0] {
  return {
    id: overrides.id ?? "task-001",
    parentId: null,
    rootId: overrides.id ?? "task-001",
    divisionId: "general_ops",
    tenantId: overrides.tenantId ?? null,
    title: "Test Task",
    status: overrides.status ?? "queued",
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
  };
}

// ---------------------------------------------------------------------------
// insertTask
// ---------------------------------------------------------------------------

test("insertTask stores task and makes it retrievable", () => {
  const { db, cleanup } = createTestDb();
  try {
    const store = new AuthoritativeTaskStore(db);
    const task = createTestTaskRecord({ id: "task-insert-1" });

    store.insertTask(task);

    const retrieved = store.getTask("task-insert-1");
    assert.ok(retrieved, "Task should be retrievable");
    assert.equal(retrieved!.id, "task-insert-1");
    assert.equal(retrieved!.title, "Test Task");
  } finally {
    cleanup();
  }
});

test("insertTask throws when task with same ID already exists", () => {
  const { db, cleanup } = createTestDb();
  try {
    const store = new AuthoritativeTaskStore(db);
    const task = createTestTaskRecord({ id: "task-dup" });

    store.insertTask(task);

    assert.throws(
      () => store.insertTask(task),
      /UNIQUE.*tasks\.id|UNIQUE constraint failed/,
    );
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// getTask
// ---------------------------------------------------------------------------

test("getTask returns null for non-existent task", () => {
  const { db, cleanup } = createTestDb();
  try {
    const store = new AuthoritativeTaskStore(db);

    const result = store.getTask("non-existent");

    assert.equal(result, null);
  } finally {
    cleanup();
  }
});

test("getTask returns task with correct properties", () => {
  const { db, cleanup } = createTestDb();
  try {
    const store = new AuthoritativeTaskStore(db);
    const task = createTestTaskRecord({
      id: "task-get-1",
      tenantId: "tenant-test",
      status: "in_progress",
    });

    store.insertTask(task);
    const retrieved = store.getTask("task-get-1");

    assert.ok(retrieved);
    assert.equal(retrieved!.id, "task-get-1");
    assert.equal(retrieved!.tenantId, "tenant-test");
    assert.equal(retrieved!.status, "in_progress");
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// updateTaskStatus
// ---------------------------------------------------------------------------

test("updateTaskStatus modifies task status", () => {
  const { db, cleanup } = createTestDb();
  try {
    const store = new AuthoritativeTaskStore(db);
    store.insertTask(createTestTaskRecord({ id: "task-status-1" }));

    store.updateTaskStatus("task-status-1", "in_progress", now);

    const updated = store.getTask("task-status-1");
    assert.equal(updated!.status, "in_progress");
  } finally {
    cleanup();
  }
});

test("updateTaskStatus records error code when provided", () => {
  const { db, cleanup } = createTestDb();
  try {
    const store = new AuthoritativeTaskStore(db);
    store.insertTask(createTestTaskRecord({ id: "task-error-1" }));

    store.updateTaskStatus("task-error-1", "failed", now, "ERR_TIMEOUT");

    const updated = store.getTask("task-error-1");
    assert.equal(updated!.status, "failed");
    assert.equal(updated!.errorCode, "ERR_TIMEOUT");
  } finally {
    cleanup();
  }
});

test("updateTaskStatus sets completedAt when status is terminal", () => {
  const { db, cleanup } = createTestDb();
  try {
    const store = new AuthoritativeTaskStore(db);
    store.insertTask(createTestTaskRecord({ id: "task-complete-1" }));

    store.updateTaskStatus("task-complete-1", "completed", now, null, now);

    const updated = store.getTask("task-complete-1");
    assert.equal(updated!.completedAt, now);
  } finally {
    cleanup();
  }
});

test("updateTaskStatusCas returns 1 when status matches", () => {
  const { db, cleanup } = createTestDb();
  try {
    const store = new AuthoritativeTaskStore(db);
    store.insertTask(createTestTaskRecord({ id: "task-cas-1", status: "queued" }));

    const affected = store.updateTaskStatusCas("task-cas-1", "queued", "in_progress", now);

    assert.equal(affected, 1);
    assert.equal(store.getTask("task-cas-1")!.status, "in_progress");
  } finally {
    cleanup();
  }
});

test("updateTaskStatusCas returns 0 when status does not match", () => {
  const { db, cleanup } = createTestDb();
  try {
    const store = new AuthoritativeTaskStore(db);
    store.insertTask(createTestTaskRecord({ id: "task-cas-2", status: "queued" }));

    const affected = store.updateTaskStatusCas("task-cas-2", "wrong_status", "in_progress", now);

    assert.equal(affected, 0);
    assert.equal(store.getTask("task-cas-2")!.status, "queued");
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// updateTaskOutput
// ---------------------------------------------------------------------------

test("updateTaskOutput sets output JSON", () => {
  const { db, cleanup } = createTestDb();
  try {
    const store = new AuthoritativeTaskStore(db);
    store.insertTask(createTestTaskRecord({ id: "task-output-1" }));

    store.updateTaskOutput("task-output-1", '{"result": "success"}', now);

    const updated = store.getTask("task-output-1");
    assert.equal(updated!.outputJson, '{"result": "success"}');
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// listTasks
// ---------------------------------------------------------------------------

test("listTasks returns all tasks", () => {
  const { db, cleanup } = createTestDb();
  try {
    const store = new AuthoritativeTaskStore(db);
    store.insertTask(createTestTaskRecord({ id: "task-list-1" }));
    store.insertTask(createTestTaskRecord({ id: "task-list-2" }));

    const tasks = store.listTasks();

    assert.equal(tasks.length, 2);
  } finally {
    cleanup();
  }
});

test("listTasks filters by tenantId when provided", () => {
  const { db, cleanup } = createTestDb();
  try {
    const store = new AuthoritativeTaskStore(db);
    store.insertTask(createTestTaskRecord({ id: "task-tenant-1", tenantId: "tenant-a" }));
    store.insertTask(createTestTaskRecord({ id: "task-tenant-2", tenantId: "tenant-b" }));
    store.insertTask(createTestTaskRecord({ id: "task-tenant-3", tenantId: "tenant-a" }));

    const tasks = store.listTasks({ tenantId: "tenant-a" });

    assert.equal(tasks.length, 2);
    assert.ok(tasks.every((t) => t.tenantId === "tenant-a"));
  } finally {
    cleanup();
  }
});

test("listTasks filters by status when provided", () => {
  const { db, cleanup } = createTestDb();
  try {
    const store = new AuthoritativeTaskStore(db);
    store.insertTask(createTestTaskRecord({ id: "task-st-1", status: "queued" }));
    store.insertTask(createTestTaskRecord({ id: "task-st-2", status: "in_progress" }));
    store.insertTask(createTestTaskRecord({ id: "task-st-3", status: "queued" }));

    const tasks = store.listTasks({ status: "queued" });

    assert.equal(tasks.length, 2);
    assert.ok(tasks.every((t) => t.status === "queued"));
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// Workflow operations
// ---------------------------------------------------------------------------

test("insertWorkflowState stores workflow state", () => {
  const { db, cleanup } = createTestDb();
  try {
    const store = new AuthoritativeTaskStore(db);
    const workflow = {
      id: "wf-001",
      taskId: "task-wf-1",
      status: "running",
      currentStepIndex: 0,
      outputsJson: "{}",
      stepCount: 3,
      version: 1,
      createdAt: now,
      updatedAt: now,
      resumableFromStep: null,
    };

    store.insertWorkflowState(workflow);

    const retrieved = store.getWorkflowState("task-wf-1");
    assert.ok(retrieved);
    assert.equal(retrieved!.id, "wf-001");
    assert.equal(retrieved!.status, "running");
  } finally {
    cleanup();
  }
});

test("getWorkflowState returns null for non-existent workflow", () => {
  const { db, cleanup } = createTestDb();
  try {
    const store = new AuthoritativeTaskStore(db);

    const result = store.getWorkflowState("non-existent");

    assert.equal(result, null);
  } finally {
    cleanup();
  }
});

test("updateWorkflowState modifies workflow state", () => {
  const { db, cleanup } = createTestDb();
  try {
    const store = new AuthoritativeTaskStore(db);
    const workflow = {
      id: "wf-upd-1",
      taskId: "task-wf-upd-1",
      status: "running",
      currentStepIndex: 0,
      outputsJson: "{}",
      stepCount: 3,
      version: 1,
      createdAt: now,
      updatedAt: now,
      resumableFromStep: null,
    };
    store.insertWorkflowState(workflow);

    store.updateWorkflowState("task-wf-upd-1", "running", 1, '{"step1": "done"}', now);

    const updated = store.getWorkflowState("task-wf-upd-1");
    assert.equal(updated!.currentStepIndex, 1);
    assert.equal(updated!.outputsJson, '{"step1": "done"}');
  } finally {
    cleanup();
  }
});

// ---------------------------------------------------------------------------
// Execution operations
// ---------------------------------------------------------------------------

test("insertExecution stores execution", () => {
  const { db, cleanup } = createTestDb();
  try {
    const store = new AuthoritativeTaskStore(db);
    store.insertTask(createTestTaskRecord({ id: "task-exec-1" }));

    const execution = {
      id: "exec-001",
      taskId: "task-exec-1",
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-001",
      roleId: "general_executor",
      runKind: "task_run" as const,
      status: "pending" as const,
      inputRef: null,
      traceId: "trace-001",
      attempt: 1,
      timeoutMs: 60000,
      budgetUsdLimit: 1.0,
      requiresApproval: 0,
      sandboxMode: "workspace_write" as const,
      allowedToolsJson: "[]",
      allowedPathsJson: "[]",
      maxRetries: 0,
      retryBackoff: "none" as const,
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    };

    store.insertExecution(execution);

    const retrieved = store.getExecution("exec-001");
    assert.ok(retrieved);
    assert.equal(retrieved!.taskId, "task-exec-1");
    assert.equal(retrieved!.status, "pending");
  } finally {
    cleanup();
  }
});

test("getExecution returns null for non-existent execution", () => {
  const { db, cleanup } = createTestDb();
  try {
    const store = new AuthoritativeTaskStore(db);

    const result = store.getExecution("non-existent");

    assert.equal(result, null);
  } finally {
    cleanup();
  }
});

test("updateExecutionStatus modifies execution status", () => {
  const { db, cleanup } = createTestDb();
  try {
    const store = new AuthoritativeTaskStore(db);
    store.insertTask(createTestTaskRecord({ id: "task-exec-upd-1" }));

    const execution = {
      id: "exec-upd-1",
      taskId: "task-exec-upd-1",
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-001",
      roleId: "general_executor",
      runKind: "task_run" as const,
      status: "pending" as const,
      inputRef: null,
      traceId: "trace-001",
      attempt: 1,
      timeoutMs: 60000,
      budgetUsdLimit: 1.0,
      requiresApproval: 0,
      sandboxMode: "workspace_write" as const,
      allowedToolsJson: "[]",
      allowedPathsJson: "[]",
      maxRetries: 0,
      retryBackoff: "none" as const,
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    store.insertExecution(execution);

    store.updateExecutionStatus("exec-upd-1", "executing", now, now);

    const updated = store.getExecution("exec-upd-1");
    assert.equal(updated!.status, "executing");
    assert.equal(updated!.startedAt, now);
  } finally {
    cleanup();
  }
});

test("updateExecutionFailure records error details", () => {
  const { db, cleanup } = createTestDb();
  try {
    const store = new AuthoritativeTaskStore(db);
    store.insertTask(createTestTaskRecord({ id: "task-exec-fail-1" }));

    const execution = {
      id: "exec-fail-1",
      taskId: "task-exec-fail-1",
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-001",
      roleId: "general_executor",
      runKind: "task_run" as const,
      status: "executing" as const,
      inputRef: null,
      traceId: "trace-001",
      attempt: 1,
      timeoutMs: 60000,
      budgetUsdLimit: 1.0,
      requiresApproval: 0,
      sandboxMode: "workspace_write" as const,
      allowedToolsJson: "[]",
      allowedPathsJson: "[]",
      maxRetries: 0,
      retryBackoff: "none" as const,
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: now,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    store.insertExecution(execution);

    store.updateExecutionFailure({
      executionId: "exec-fail-1",
      status: "failed",
      updatedAt: now,
      finishedAt: now,
      lastErrorCode: "ERR_TIMEOUT",
      lastErrorMessage: "Execution timed out",
    });

    const updated = store.getExecution("exec-fail-1");
    assert.equal(updated!.status, "failed");
    assert.equal(updated!.lastErrorCode, "ERR_TIMEOUT");
    assert.equal(updated!.lastErrorMessage, "Execution timed out");
  } finally {
    cleanup();
  }
});

test("listExecutionsByTask returns all executions for task", () => {
  const { db, cleanup } = createTestDb();
  try {
    const store = new AuthoritativeTaskStore(db);
    store.insertTask(createTestTaskRecord({ id: "task-exec-list-1" }));

    for (let i = 1; i <= 3; i++) {
      store.insertExecution({
        id: `exec-list-${i}`,
        taskId: "task-exec-list-1",
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-001",
        roleId: "general_executor",
        runKind: "task_run" as const,
        status: "pending" as const,
        inputRef: null,
        traceId: `trace-${i}`,
        attempt: i,
        timeoutMs: 60000,
        budgetUsdLimit: 1.0,
        requiresApproval: 0,
        sandboxMode: "workspace_write" as const,
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none" as const,
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }

    const executions = store.listExecutionsByTask("task-exec-list-1");
    assert.equal(executions.length, 3);
  } finally {
    cleanup();
  }
});
