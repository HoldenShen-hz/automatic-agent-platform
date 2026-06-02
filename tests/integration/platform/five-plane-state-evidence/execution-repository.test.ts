/**
 * Integration tests for ExecutionRepository CRUD operations.
 *
 * Tests SQLite-based execution repository: insert, get, update (CAS),
 * list, and terminal execution immutability enforcement.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createIntegrationContext } from "../../../helpers/integration-context.js";
import { ExecutionRepository } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/execution-repository.js";
import { TaskRepository } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/task-repository.js";
import type { ExecutionRecord } from "../../../../src/platform/contracts/types/domain.js";
import { EXECUTION_STATUSES } from "../../../../src/platform/contracts/types/status.js";

/**
 * Inserts a task and execution within a single transaction to satisfy FK constraints.
 */
function insertTaskAndExecution(
  ctx: ReturnType<typeof createIntegrationContext>,
  exec: ExecutionRecord,
): void {
  const taskRepo = new TaskRepository(ctx.db.connection);
  const now = new Date().toISOString();
  ctx.db.transaction(() => {
    taskRepo.insertTask({
      id: exec.taskId,
      parentId: null,
      rootId: exec.taskId,
      divisionId: "general-ops",
      tenantId: null,
      title: `Task for execution ${exec.id}`,
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
    const execRepo = new ExecutionRepository(ctx.db.connection);
    execRepo.insertExecution(exec);
  });
}

function makeExecution(overrides: Partial<ExecutionRecord> = {}): ExecutionRecord {
  const now = new Date().toISOString();
  return {
    id: "exec-test-001",
    taskId: "task-test-001",
    workflowId: "single_agent_minimal",
    parentExecutionId: null,
    harnessRunId: null,
    budgetReservationId: null,
    budgetLedgerId: null,
    agentId: "agent-test",
    roleId: "general_executor",
    runKind: "task_run",
    status: "created",
    inputRef: null,
    traceId: `trace-${Math.random().toString(36).slice(2)}`,
    attempt: 1,
    timeoutMs: 60000,
    budgetUsdLimit: 1,
    requiresApproval: 0,
    sandboxMode: "workspace_write",
    allowedToolsJson: "[]",
    allowedPathsJson: "[]",
    maxRetries: 0,
    retryBackoff: "none",
    lastErrorCode: null,
    lastErrorMessage: null,
    startedAt: null,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test("integration: ExecutionRepository.insertExecution creates execution record", () => {
  const ctx = createIntegrationContext("aa-exec-repo-insert-");
  try {
    const repo = new ExecutionRepository(ctx.db.connection);
    const exec = makeExecution({ id: "exec-insert-001" });

    insertTaskAndExecution(ctx, exec);
    const retrieved = repo.getExecution("exec-insert-001");

    assert.notEqual(retrieved, undefined);
    assert.equal(retrieved!.id, "exec-insert-001");
    assert.equal(retrieved!.taskId, "task-test-001");
    assert.equal(retrieved!.workflowId, "single_agent_minimal");
    assert.equal(retrieved!.status, "created");
    assert.equal(retrieved!.agentId, "agent-test");
    assert.equal(retrieved!.runKind, "task_run");
    assert.equal(retrieved!.attempt, 1);
  } finally {
    ctx.cleanup();
  }
});

test("integration: ExecutionRepository.getExecution retrieves execution by ID", () => {
  const ctx = createIntegrationContext("aa-exec-repo-get-");
  try {
    const repo = new ExecutionRepository(ctx.db.connection);
    const exec = makeExecution({ id: "exec-get-001", traceId: "trace-get-001" });
    insertTaskAndExecution(ctx, exec);

    const retrieved = repo.getExecution("exec-get-001");

    assert.notEqual(retrieved, undefined);
    assert.equal(retrieved!.id, "exec-get-001");
    assert.equal(retrieved!.traceId, "trace-get-001");
  } finally {
    ctx.cleanup();
  }
});

test("integration: ExecutionRepository.getExecution returns undefined for non-existent execution", () => {
  const ctx = createIntegrationContext("aa-exec-repo-get-none-");
  try {
    const repo = new ExecutionRepository(ctx.db.connection);
    const retrieved = repo.getExecution("non-existent-exec");
    assert.equal(retrieved, undefined);
  } finally {
    ctx.cleanup();
  }
});

test("integration: ExecutionRepository.updateExecutionStatus updates status correctly", () => {
  const ctx = createIntegrationContext("aa-exec-repo-update-");
  try {
    const repo = new ExecutionRepository(ctx.db.connection);
    const exec = makeExecution({ id: "exec-update-001", status: "created" });
    insertTaskAndExecution(ctx, exec);

    const updatedAt = new Date().toISOString();
    const startedAt = new Date().toISOString();
    repo.updateExecutionStatus("exec-update-001", "executing", updatedAt, startedAt, null, null);

    const retrieved = repo.getExecution("exec-update-001");
    assert.notEqual(retrieved, undefined);
    assert.equal(retrieved!.status, "executing");
    assert.equal(retrieved!.updatedAt, updatedAt);
    assert.equal(retrieved!.startedAt, startedAt);
  } finally {
    ctx.cleanup();
  }
});

test("integration: ExecutionRepository.updateExecutionStatus sets finishedAt on terminal status", () => {
  const ctx = createIntegrationContext("aa-exec-repo-update-finished-");
  try {
    const repo = new ExecutionRepository(ctx.db.connection);
    const exec = makeExecution({ id: "exec-update-finished-001", status: "executing" });
    insertTaskAndExecution(ctx, exec);

    const updatedAt = new Date().toISOString();
    const finishedAt = new Date().toISOString();
    repo.updateExecutionStatus("exec-update-finished-001", "succeeded", updatedAt, null, finishedAt, null);

    const retrieved = repo.getExecution("exec-update-finished-001");
    assert.notEqual(retrieved, undefined);
    assert.equal(retrieved!.status, "succeeded");
    assert.equal(retrieved!.finishedAt, finishedAt);
  } finally {
    ctx.cleanup();
  }
});

test("integration: ExecutionRepository.updateExecutionStatusCas uses compare-and-swap", () => {
  const ctx = createIntegrationContext("aa-exec-repo-cas-");
  try {
    const repo = new ExecutionRepository(ctx.db.connection);
    const exec = makeExecution({ id: "exec-cas-001", status: "created" });
    insertTaskAndExecution(ctx, exec);

    // Successful CAS: status matches expected
    const updatedAt = new Date().toISOString();
    const rowsAffected = repo.updateExecutionStatusCas(
      "exec-cas-001",
      "created",
      "executing",
      updatedAt,
      new Date().toISOString(),
      null,
      null,
    );
    assert.equal(rowsAffected, 1);

    const retrieved = repo.getExecution("exec-cas-001");
    assert.equal(retrieved!.status, "executing");

    // Failed CAS: status does not match expected (execution is now "executing", not "created")
    const rowsAffected2 = repo.updateExecutionStatusCas(
      "exec-cas-001",
      "created",
      "succeeded",
      updatedAt,
      null,
      new Date().toISOString(),
      null,
    );
    assert.equal(rowsAffected2, 0);

    // Status should remain unchanged
    const retrieved2 = repo.getExecution("exec-cas-001");
    assert.equal(retrieved2!.status, "executing");
  } finally {
    ctx.cleanup();
  }
});

test("integration: ExecutionRepository.listExecutionsByStatuses returns all executions matching statuses", () => {
  const ctx = createIntegrationContext("aa-exec-repo-list-");
  try {
    const repo = new ExecutionRepository(ctx.db.connection);
    // Each execution needs its own task since FK constraint requires unique task.id
    insertTaskAndExecution(ctx, makeExecution({ id: "exec-list-001", taskId: "task-list-001", status: "created" }));
    insertTaskAndExecution(ctx, makeExecution({ id: "exec-list-002", taskId: "task-list-002", status: "executing" }));
    insertTaskAndExecution(ctx, makeExecution({ id: "exec-list-003", taskId: "task-list-003", status: "failed" }));
    insertTaskAndExecution(ctx, makeExecution({ id: "exec-list-004", taskId: "task-list-004", status: "succeeded" }));

    // List all executions regardless of status
    const allStatuses = [...EXECUTION_STATUSES];
    const executions = repo.listExecutionsByStatuses(allStatuses);

    assert.equal(executions.length, 4);
    const ids = executions.map((e) => e.id).sort();
    assert.deepEqual(ids, ["exec-list-001", "exec-list-002", "exec-list-003", "exec-list-004"]);
  } finally {
    ctx.cleanup();
  }
});

test("integration: ExecutionRepository.listExecutionsByStatuses returns executions with specific status", () => {
  const ctx = createIntegrationContext("aa-exec-repo-list-status-");
  try {
    const repo = new ExecutionRepository(ctx.db.connection);
    insertTaskAndExecution(ctx, makeExecution({ id: "exec-status-001", taskId: "task-status-001", status: "executing" }));
    insertTaskAndExecution(ctx, makeExecution({ id: "exec-status-002", taskId: "task-status-002", status: "executing" }));
    insertTaskAndExecution(ctx, makeExecution({ id: "exec-status-003", taskId: "task-status-003", status: "succeeded" }));

    const executing = repo.listExecutionsByStatuses(["executing"]);

    assert.equal(executing.length, 2);
    executing.forEach((e) => assert.equal(e.status, "executing"));
  } finally {
    ctx.cleanup();
  }
});

test("integration: ExecutionRepository.listExecutionsByStatuses returns empty array for empty status filter", () => {
  const ctx = createIntegrationContext("aa-exec-repo-list-empty-");
  try {
    const repo = new ExecutionRepository(ctx.db.connection);
    insertTaskAndExecution(ctx, makeExecution({ id: "exec-empty-001", status: "executing" }));

    const executions = repo.listExecutionsByStatuses([]);
    assert.equal(executions.length, 0);
  } finally {
    ctx.cleanup();
  }
});

test("integration: ExecutionRepository.updateExecutionStatus cannot modify terminal execution via CAS with wrong expected status", () => {
  const ctx = createIntegrationContext("aa-exec-repo-terminal-cas-");
  try {
    const repo = new ExecutionRepository(ctx.db.connection);
    const exec = makeExecution({ id: "exec-terminal-cas-001", status: "succeeded" });
    insertTaskAndExecution(ctx, exec);

    const updatedAt = new Date().toISOString();
    // Attempt CAS with wrong expected status - this should return 0 (no rows affected)
    const rowsAffected = repo.updateExecutionStatusCas(
      "exec-terminal-cas-001",
      "executing", // wrong expected status - actual is "succeeded"
      "running",
      updatedAt,
      new Date().toISOString(),
      null,
      null,
    );
    assert.equal(rowsAffected, 0);

    // Status should remain terminal
    const retrieved = repo.getExecution("exec-terminal-cas-001");
    assert.equal(retrieved!.status, "succeeded");
  } finally {
    ctx.cleanup();
  }
});

test("integration: ExecutionRepository.countActiveExecutions returns correct count", () => {
  const ctx = createIntegrationContext("aa-exec-repo-count-");
  try {
    const repo = new ExecutionRepository(ctx.db.connection);
    // Each execution needs its own task due to FK constraint
    insertTaskAndExecution(ctx, makeExecution({ id: "exec-count-001", taskId: "task-count-001", status: "executing" }));
    insertTaskAndExecution(ctx, makeExecution({ id: "exec-count-002", taskId: "task-count-002", status: "prechecking" }));
    insertTaskAndExecution(ctx, makeExecution({ id: "exec-count-003", taskId: "task-count-003", status: "succeeded" }));

    const count = repo.countActiveExecutions();
    assert.equal(count, 2);
  } finally {
    ctx.cleanup();
  }
});

test("integration: ExecutionRepository.updateExecutionAgent updates agentId", () => {
  const ctx = createIntegrationContext("aa-exec-repo-agent-");
  try {
    const repo = new ExecutionRepository(ctx.db.connection);
    const exec = makeExecution({ id: "exec-agent-001", status: "executing" });
    insertTaskAndExecution(ctx, exec);

    const updatedAt = new Date().toISOString();
    repo.updateExecutionAgent("exec-agent-001", "agent-updated", updatedAt);

    const retrieved = repo.getExecution("exec-agent-001");
    assert.notEqual(retrieved, undefined);
    assert.equal(retrieved!.agentId, "agent-updated");
    assert.equal(retrieved!.updatedAt, updatedAt);
  } finally {
    ctx.cleanup();
  }
});
