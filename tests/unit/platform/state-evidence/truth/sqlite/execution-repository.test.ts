/**
 * Unit tests for ExecutionRepository with mocks.
 *
 * Tests the synchronous ExecutionRepository for execution record management.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/execution-repository.js";
import type { SqliteConnection } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/query-helper.js";
import type { ExecutionRecord, ExecutionPrecheckRecord, DeadLetterRecord } from "../../../../../../src/platform/contracts/types/domain.js";

function createMockConnection(): { exec: () => void; prepare: (sql: string) => { run: (...params: unknown[]) => { changes: number }; all: () => unknown[]; get: () => unknown } } {
  return {
    exec: () => {},
    prepare: (sql: string) => ({
      run: () => ({ changes: 1 }),
      all: () => [],
      get: () => undefined,
    }),
  } as unknown as SqliteConnection;
}

function createTestExecutionRecord(overrides?: Partial<ExecutionRecord>): ExecutionRecord {
  return {
    id: "exec-001",
    taskId: "task-001",
    workflowId: "single_agent_minimal",
    parentExecutionId: null,
    agentId: "agent-1",
    roleId: "general_executor",
    runKind: "task_run",
    status: "executing",
    inputRef: null,
    traceId: "trace-001",
    attempt: 1,
    timeoutMs: 60000,
    budgetUsdLimit: 1.0,
    requiresApproval: 0,
    sandboxMode: "workspace_write",
    allowedToolsJson: "[]",
    allowedPathsJson: "[]",
    maxRetries: 0,
    retryBackoff: "none",
    lastErrorCode: null,
    lastErrorMessage: null,
    startedAt: "2026-04-14T10:00:00.000Z",
    finishedAt: null,
    createdAt: "2026-04-14T10:00:00.000Z",
    updatedAt: "2026-04-14T10:00:00.000Z",
    ...overrides,
  };
}

test("ExecutionRepository constructor works with connection", () => {
  const conn = createMockConnection();
  const repo = new ExecutionRepository(conn);
  assert.ok(repo instanceof ExecutionRepository, "Should create ExecutionRepository instance");
});

test("ExecutionRepository insertExecution calls prepare with correct SQL", () => {
  let capturedSql = "";

  const mockPrepare = (sql: string) => {
    capturedSql = sql;
    return {
      run: () => ({ changes: 1 }),
      all: () => [],
      get: () => undefined,
    };
  };

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new ExecutionRepository(conn);

  const execution = createTestExecutionRecord();
  repo.insertExecution(execution);

  assert.ok(capturedSql.includes("INSERT INTO executions"), "Should insert into executions");
  assert.ok(capturedSql.includes("id, task_id, workflow_id"), "Should include id, task_id, workflow_id columns");
});

test("ExecutionRepository getExecution returns mapped record", () => {
  const mockExecution = {
    id: "exec-001",
    taskId: "task-001",
    workflowId: "single_agent_minimal",
    parentExecutionId: null,
    agentId: "agent-1",
    roleId: "general_executor",
    runKind: "task_run",
    status: "executing",
    inputRef: null,
    traceId: "trace-001",
    attempt: 1,
    timeoutMs: 60000,
    budgetUsdLimit: 1.0,
    requiresApproval: 0,
    sandboxMode: "workspace_write",
    allowedToolsJson: "[]",
    allowedPathsJson: "[]",
    maxRetries: 0,
    retryBackoff: "none",
    lastErrorCode: null,
    lastErrorMessage: null,
    startedAt: "2026-04-14T10:00:00.000Z",
    finishedAt: null,
    createdAt: "2026-04-14T10:00:00.000Z",
    updatedAt: "2026-04-14T10:00:00.000Z",
  };

  const mockPrepare = () => ({
    get: () => mockExecution,
    all: () => [],
    run: () => ({ changes: 0 }),
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new ExecutionRepository(conn);

  const result = repo.getExecution("exec-001");

  assert.ok(result !== undefined, "Should return a result");
  assert.equal(result.id, "exec-001");
  assert.equal(result.taskId, "task-001");
  assert.equal(result.workflowId, "single_agent_minimal");
  assert.equal(result.status, "executing");
});

test("ExecutionRepository getExecution returns undefined for missing record", () => {
  const mockPrepare = () => ({
    get: () => undefined,
    all: () => [],
    run: () => ({ changes: 0 }),
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new ExecutionRepository(conn);

  const result = repo.getExecution("nonexistent");
  assert.strictEqual(result, undefined, "Should return undefined for missing execution");
});

test("ExecutionRepository listExecutionsByTask returns executions for task", () => {
  const mockExecutions = [
    createTestExecutionRecord({ id: "exec-001", status: "executing" }),
    createTestExecutionRecord({ id: "exec-002", status: "succeeded", attempt: 2 }),
  ];

  const mockPrepare = () => ({
    all: () => mockExecutions,
    get: () => undefined,
    run: () => ({ changes: 0 }),
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new ExecutionRepository(conn);

  const results = repo.listExecutionsByTask("task-001");

  assert.equal(results.length, 2, "Should return 2 executions");
  assert.equal(results[0].id, "exec-001");
  assert.equal(results[1].id, "exec-002");
});

test("ExecutionRepository listExecutionsByStatuses filters by status array", () => {
  let capturedSql = "";
  const mockPrepare = (sql: string) => {
    capturedSql = sql;
    return {
      all: () => [createTestExecutionRecord()],
      get: () => undefined,
      run: () => ({ changes: 0 }),
    };
  };

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new ExecutionRepository(conn);

  const results = repo.listExecutionsByStatuses(["executing", "prechecking"]);

  assert.ok(capturedSql.includes("status IN"), "Should use IN clause for statuses");
  assert.ok(capturedSql.includes("?"), "Should use parameterized placeholders");
});

test("ExecutionRepository listExecutionsByStatuses with empty array returns empty array", () => {
  const mockPrepare = () => ({
    all: () => [],
    get: () => undefined,
    run: () => ({ changes: 0 }),
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new ExecutionRepository(conn);

  const results = repo.listExecutionsByStatuses([]);
  assert.deepEqual(results, [], "Should return empty array for empty statuses");
});

test("ExecutionRepository listExecutionsByStatuses with cursor uses created_at filter", () => {
  let capturedSql = "";
  const mockPrepare = (sql: string) => {
    capturedSql = sql;
    return {
      all: () => [],
      get: () => undefined,
      run: () => ({ changes: 0 }),
    };
  };

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new ExecutionRepository(conn);

  repo.listExecutionsByStatuses(["executing"], 10, "2026-05-01T00:00:00.000Z");

  assert.ok(capturedSql.includes("created_at < ?"), "Should include created_at cursor filter");
});

test("ExecutionRepository updateExecutionStatus modifies execution status", () => {
  let capturedSql = "";
  let capturedParams: unknown[] = [];

  const mockPrepare = (sql: string) => {
    capturedSql = sql;
    return {
      run: (...params: unknown[]) => {
        capturedParams = params;
        return { changes: 1 };
      },
      all: () => [],
      get: () => undefined,
    };
  };

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new ExecutionRepository(conn);

  repo.updateExecutionStatus("exec-001", "prechecking", "2026-04-14T11:00:00.000Z", "2026-04-14T10:00:00.000Z");

  assert.ok(capturedSql.includes("UPDATE executions"), "Should update executions table");
  assert.ok(capturedSql.includes("SET status = ?"), "Should update execution status");
  assert.equal(capturedParams[0], "prechecking", "First param should be new status");
  assert.equal(capturedParams[1], "2026-04-14T11:00:00.000Z", "Second param should be updatedAt");
  assert.equal(capturedParams[2], "2026-04-14T10:00:00.000Z", "Third param should be startedAt");
});

test("ExecutionRepository updateExecutionStatusCas uses CAS condition", () => {
  let capturedSql = "";

  const mockPrepare = (sql: string) => {
    capturedSql = sql;
    return {
      run: () => ({ changes: 1 }),
      all: () => [],
      get: () => undefined,
    };
  };

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new ExecutionRepository(conn);

  const affected = repo.updateExecutionStatusCas("exec-001", "executing", "prechecking", "2026-04-14T11:00:00.000Z");

  assert.ok(capturedSql.includes("WHERE id = ? AND status = ?"), "Should have CAS condition with status check");
  assert.equal(affected, 1, "Should return affected row count");
});

test("ExecutionRepository updateExecutionFailure records error details", () => {
  let capturedSql = "";
  let capturedParams: unknown[] = [];

  const mockPrepare = (sql: string) => {
    capturedSql = sql;
    return {
      run: (...params: unknown[]) => {
        capturedParams = params;
        return { changes: 1 };
      },
      all: () => [],
      get: () => undefined,
    };
  };

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new ExecutionRepository(conn);

  repo.updateExecutionFailure({
    executionId: "exec-001",
    status: "failed",
    updatedAt: "2026-04-14T11:00:00.000Z",
    finishedAt: "2026-04-14T11:00:00.000Z",
    lastErrorCode: "EXEC_TIMEOUT",
    lastErrorMessage: "Execution timed out",
  });

  assert.ok(capturedSql.includes("last_error_code"), "Should update last_error_code");
  assert.ok(capturedSql.includes("last_error_message"), "Should update last_error_message");
  assert.equal(capturedParams[3], "EXEC_TIMEOUT", "Error code should be at position 3");
  assert.equal(capturedParams[4], "Execution timed out", "Error message should be at position 4");
});

test("ExecutionRepository updateExecutionAgent reassigns agent", () => {
  let capturedParams: unknown[] = [];

  const mockPrepare = (sql: string) => ({
    run: (...params: unknown[]) => {
      capturedParams = params;
      return { changes: 1 };
    },
    all: () => [],
    get: () => undefined,
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new ExecutionRepository(conn);

  repo.updateExecutionAgent("exec-001", "agent-2", "2026-04-14T11:00:00.000Z");

  assert.equal(capturedParams[0], "agent-2", "First param should be new agentId");
  assert.equal(capturedParams[1], "2026-04-14T11:00:00.000Z", "Second param should be updatedAt");
  assert.equal(capturedParams[2], "exec-001", "Last param should be executionId");
});

test("ExecutionRepository countActiveExecutions returns count", () => {
  const mockPrepare = () => ({
    get: () => ({ count: 42 }),
    all: () => [],
    run: () => ({ changes: 0 }),
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new ExecutionRepository(conn);

  const count = repo.countActiveExecutions();
  assert.equal(count, 42, "Should return the count of active executions");
});

test("ExecutionRepository insertExecutionPrecheck stores precheck record", () => {
  let capturedSql = "";

  const mockPrepare = (sql: string) => {
    capturedSql = sql;
    return {
      run: () => ({ changes: 1 }),
      all: () => [],
      get: () => undefined,
    };
  };

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new ExecutionRepository(conn);

  const precheck: ExecutionPrecheckRecord = {
    id: "precheck-001",
    executionId: "exec-001",
    allowed: 1,
    reasonCode: "budget_sufficient",
    resolvedBudgetUsd: 0.5,
    resolvedTimeoutMs: 60000,
    resolvedSandboxMode: "workspace_write",
    resolvedToolsJson: "[]",
    resolvedPathsJson: "[]",
    checkedAt: "2026-04-14T10:00:00.000Z",
  };

  repo.insertExecutionPrecheck(precheck);

  assert.ok(capturedSql.includes("INSERT INTO execution_prechecks"), "Should insert into execution_prechecks");
  assert.ok(capturedSql.includes("execution_id"), "Should include execution_id column");
});

test("ExecutionRepository getExecutionPrecheck retrieves precheck record", () => {
  const mockPrecheck = {
    id: "precheck-001",
    executionId: "exec-001",
    allowed: 1,
    reasonCode: "budget_sufficient",
    resolvedBudgetUsd: 0.5,
    resolvedTimeoutMs: 60000,
    resolvedSandboxMode: "workspace_write",
    resolvedToolsJson: "[]",
    resolvedPathsJson: "[]",
    checkedAt: "2026-04-14T10:00:00.000Z",
  };

  const mockPrepare = () => ({
    get: () => mockPrecheck,
    all: () => [],
    run: () => ({ changes: 0 }),
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new ExecutionRepository(conn);

  const result = repo.getExecutionPrecheck("exec-001");

  assert.ok(result !== undefined, "Should return precheck result");
  assert.equal(result.executionId, "exec-001");
  assert.equal(result.allowed, 1);
  assert.equal(result.reasonCode, "budget_sufficient");
});

test("ExecutionRepository insertDeadLetter stores dead letter record", () => {
  let capturedSql = "";

  const mockPrepare = (sql: string) => {
    capturedSql = sql;
    return {
      run: () => ({ changes: 1 }),
      all: () => [],
      get: () => undefined,
    };
  };

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new ExecutionRepository(conn);

  const deadLetter: DeadLetterRecord = {
    id: "dl-001",
    taskId: "task-001",
    executionId: "exec-001",
    finalReasonCode: "timeout",
    retryCount: 3,
    lastErrorMessage: "Execution timed out",
    movedAt: "2026-04-14T11:00:00.000Z",
  };

  repo.insertDeadLetter(deadLetter);

  assert.ok(capturedSql.includes("INSERT INTO dead_letters"), "Should insert into dead_letters");
  assert.ok(capturedSql.includes("final_reason_code"), "Should include final_reason_code column");
});

test("ExecutionRepository getDeadLetterByExecutionId retrieves dead letter", () => {
  const mockDeadLetter = {
    id: "dl-001",
    taskId: "task-001",
    executionId: "exec-001",
    finalReasonCode: "timeout",
    retryCount: 3,
    lastErrorMessage: "Execution timed out",
    movedAt: "2026-04-14T11:00:00.000Z",
  };

  const mockPrepare = () => ({
    get: () => mockDeadLetter,
    all: () => [],
    run: () => ({ changes: 0 }),
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new ExecutionRepository(conn);

  const result = repo.getDeadLetterByExecutionId("exec-001");

  assert.ok(result !== undefined, "Should return dead letter result");
  assert.equal(result.executionId, "exec-001");
  assert.equal(result.finalReasonCode, "timeout");
  assert.equal(result.retryCount, 3);
});

test("ExecutionRepository listDeadLettersByTask returns all dead letters for task", () => {
  const mockDeadLetters = [
    { id: "dl-001", taskId: "task-001", executionId: "exec-001", finalReasonCode: "timeout", retryCount: 1, lastErrorMessage: "Timed out", movedAt: "2026-04-14T11:00:00.000Z" },
    { id: "dl-002", taskId: "task-001", executionId: "exec-002", finalReasonCode: "budget_exceeded", retryCount: 2, lastErrorMessage: "Budget exceeded", movedAt: "2026-04-14T11:05:00.000Z" },
  ];

  const mockPrepare = () => ({
    all: () => mockDeadLetters,
    get: () => undefined,
    run: () => ({ changes: 0 }),
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new ExecutionRepository(conn);

  const results = repo.listDeadLettersByTask("task-001");

  assert.equal(results.length, 2, "Should return 2 dead letters");
  assert.equal(results[0].id, "dl-001");
  assert.equal(results[1].id, "dl-002");
});