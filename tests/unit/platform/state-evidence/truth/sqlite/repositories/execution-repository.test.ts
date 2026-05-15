import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionRepository } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/execution-repository.js";

// Test type exports and structure from the execution-repository
// We test the structure and types without needing actual database connections

test("ExecutionRepository can be instantiated with mock connection", () => {
  // Create a minimal mock connection
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [],
    }),
  } as any;

  const repo = new ExecutionRepository(mockConn);
  
  assert.ok(repo);
  assert.equal(typeof repo.insertExecution, "function");
  assert.equal(typeof repo.getExecution, "function");
  assert.equal(typeof repo.listExecutionsByTask, "function");
});

test("ExecutionRepository has all required methods", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [],
    }),
  } as any;

  const repo = new ExecutionRepository(mockConn);

  // Execution methods
  assert.equal(typeof repo.insertExecution, "function");
  assert.equal(typeof repo.getExecution, "function");
  assert.equal(typeof repo.listExecutionsByTask, "function");
  assert.equal(typeof repo.listExecutionsByStatuses, "function");
  assert.equal(typeof repo.updateExecutionStatus, "function");
  assert.equal(typeof repo.updateExecutionStatusCas, "function");
  assert.equal(typeof repo.updateExecutionFailure, "function");
  assert.equal(typeof repo.updateExecutionAgent, "function");
  assert.equal(typeof repo.countActiveExecutions, "function");

  // Precheck methods
  assert.equal(typeof repo.insertExecutionPrecheck, "function");
  assert.equal(typeof repo.getExecutionPrecheck, "function");

  // Dead letter methods
  assert.equal(typeof repo.insertDeadLetter, "function");
  assert.equal(typeof repo.getDeadLetterByExecutionId, "function");
  assert.equal(typeof repo.listDeadLettersByTask, "function");
});

test("ExecutionRepository insertExecution accepts ExecutionRecord type", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
      get: () => undefined,
      all: () => [],
    }),
  } as any;

  const repo = new ExecutionRepository(mockConn);

  // Create a mock execution record
  const mockExecution = {
    id: "exec-123",
    taskId: "task-456",
    workflowId: "wf-789",
    parentExecutionId: null,
    agentId: "agent-1",
    roleId: "role-1",
    runKind: "task_run" as const,
    status: "executing" as const,
    inputRef: null,
    traceId: "trace-abc",
    attempt: 1,
    timeoutMs: 3600000,
    budgetUsdLimit: null,
    requiresApproval: 0,
    sandboxMode: null,
    allowedToolsJson: null,
    allowedPathsJson: null,
    maxRetries: 3,
    retryBackoff: "exponential" as const,
    lastErrorCode: null,
    lastErrorMessage: null,
    startedAt: "2026-04-26T10:00:00.000Z",
    finishedAt: null,
    createdAt: "2026-04-26T10:00:00.000Z",
    updatedAt: "2026-04-26T10:00:00.000Z",
  };

  // Should not throw
  assert.doesNotThrow(() => {
    repo.insertExecution(mockExecution);
  });
});

test("ExecutionRepository getExecution returns undefined when not found", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [],
    }),
  } as any;

  const repo = new ExecutionRepository(mockConn);

  const result = repo.getExecution("nonexistent-id");
  assert.equal(result, undefined);
});

test("ExecutionRepository listExecutionsByStatuses handles empty array", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [],
    }),
  } as any;

  const repo = new ExecutionRepository(mockConn);

  const result = repo.listExecutionsByStatuses([]);
  assert.deepEqual(result, []);
});

test("ExecutionRepository updateExecutionStatusCas returns number", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
      get: () => undefined,
      all: () => [],
    }),
  } as any;

  const repo = new ExecutionRepository(mockConn);

  const result = repo.updateExecutionStatusCas("exec-123", "executing", "completed", "2026-04-26T10:00:00.000Z", null, null, null);
  assert.equal(typeof result, "number");
});

test("ExecutionRepository countActiveExecutions returns number", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => ({ count: 5 }),
      all: () => [],
    }),
  } as any;

  const repo = new ExecutionRepository(mockConn);

  const result = repo.countActiveExecutions();
  assert.equal(result, 5);
});

test("ExecutionRepository insertExecutionPrecheck accepts record", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
      get: () => undefined,
      all: () => [],
    }),
  } as any;

  const repo = new ExecutionRepository(mockConn);

  const precheck = {
    id: "precheck-1",
    executionId: "exec-123",
    allowed: true,
    reasonCode: null,
    resolvedBudgetUsd: null,
    resolvedTimeoutMs: 3600000,
    resolvedSandboxMode: null,
    resolvedToolsJson: null,
    resolvedPathsJson: null,
    checkedAt: "2026-04-26T10:00:00.000Z",
  };

  assert.doesNotThrow(() => {
    repo.insertExecutionPrecheck(precheck);
  });
});

test("ExecutionRepository insertDeadLetter accepts record", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 1 }),
      get: () => undefined,
      all: () => [],
    }),
  } as any;

  const repo = new ExecutionRepository(mockConn);

  const deadLetter = {
    id: "dl-1",
    taskId: "task-456",
    executionId: "exec-123",
    finalReasonCode: "timeout",
    retryCount: 3,
    lastErrorMessage: "Execution timed out",
    movedAt: "2026-04-26T12:00:00.000Z",
  };

  assert.doesNotThrow(() => {
    repo.insertDeadLetter(deadLetter);
  });
});

test("ExecutionRepository getDeadLetterByExecutionId returns undefined when not found", () => {
  const mockConn = {
    prepare: () => ({
      run: () => ({ changes: 0 }),
      get: () => undefined,
      all: () => [],
    }),
  } as any;

  const repo = new ExecutionRepository(mockConn);

  const result = repo.getDeadLetterByExecutionId("nonexistent-exec");
  assert.equal(result, undefined);
});
