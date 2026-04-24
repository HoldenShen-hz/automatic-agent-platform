/**
 * Unit tests for ExecutionRepository with mocks.
 *
 * Tests the synchronous ExecutionRepository using mock SqliteConnection
 * rather than a real database.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionRepository } from "../../../../../src/platform/state-evidence/truth/sqlite/repositories/execution-repository.js";
import type { SqliteConnection } from "../../../../../src/platform/state-evidence/truth/sqlite/query-helper.js";
import type { ExecutionRecord, ExecutionPrecheckRecord, DeadLetterRecord } from "../../../../../src/platform/contracts/types/domain.js";

interface MockStatement {
  sql: string;
  params: unknown[];
  runResult: { changes: number };
  allResult: unknown[];
  getResult: unknown;
}

function createMockConnection(statements: MockStatement[]): SqliteConnection {
  const preparedStatements = new Map<string, MockStatement>();

  for (const stmt of statements) {
    preparedStatements.set(stmt.sql, stmt);
  }

  const mockPrepare = (sql: string) => {
    const stmt = preparedStatements.get(sql);
    if (!stmt) {
      throw new Error(`No mock statement found for: ${sql}`);
    }

    return {
      all: (...params: unknown[]) => {
        stmt.params.push(...params);
        return stmt.allResult;
      },
      get: (...params: unknown[]) => {
        stmt.params.push(...params);
        return stmt.getResult;
      },
      run: (...params: unknown[]) => {
        stmt.params.push(...params);
        return stmt.runResult;
      },
    };
  };

  return {
    exec: () => {},
    prepare: mockPrepare,
  } as unknown as SqliteConnection;
}

function createTestExecutionRecord(): ExecutionRecord {
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
  };
}

test("ExecutionRepository insertExecution calls prepare with correct SQL", () => {
  const mockExecution = createTestExecutionRecord();

  const insertSql = `INSERT INTO executions (
          id, task_id, workflow_id, parent_execution_id, agent_id, role_id, run_kind, status,
          input_ref, trace_id, attempt, timeout_ms, budget_usd_limit, requires_approval,
          sandbox_mode, allowed_tools_json, allowed_paths_json, max_retries, retry_backoff,
          last_error_code, last_error_message, started_at, finished_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

  let calledSql = "";
  const mockPrepare = (sql: string) => {
    calledSql = sql;
    return {
      run: () => ({ changes: 1 }),
      all: () => [],
      get: () => undefined,
    };
  };

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new ExecutionRepository(conn);

  repo.insertExecution(mockExecution);

  assert.ok(calledSql.includes("INSERT INTO executions"), "Should use INSERT INTO executions");
  assert.ok(calledSql.includes("id, task_id, workflow_id"), "Should include correct columns");
  assert.ok(calledSql.includes("VALUES (?"), "Should use parameterized values");
});

test("ExecutionRepository getExecution returns mapped record", () => {
  const mockGetResult = {
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

  const selectSql = `SELECT
        id, task_id AS taskId, workflow_id AS workflowId, parent_execution_id AS parentExecutionId,
        agent_id AS agentId, role_id AS roleId, run_kind AS runKind, status,
        input_ref AS inputRef, trace_id AS traceId, attempt, timeout_ms AS timeoutMs,
        budget_usd_limit AS budgetUsdLimit, requires_approval AS requiresApproval,
        sandbox_mode AS sandboxMode, allowed_tools_json AS allowedToolsJson,
        allowed_paths_json AS allowedPathsJson, max_retries AS maxRetries,
        retry_backoff AS retryBackoff, last_error_code AS lastErrorCode,
        last_error_message AS lastErrorMessage, started_at AS startedAt,
        finished_at AS finishedAt, created_at AS createdAt, updated_at AS updatedAt
       FROM executions WHERE id = ?`;

  let capturedParams: unknown[] = [];
  const mockPrepare = (sql: string) => {
    assert.ok(sql.includes("FROM executions WHERE id = ?"), "Should query executions by id");
    return {
      get: (...params: unknown[]) => {
        capturedParams = params;
        return mockGetResult;
      },
      all: () => [],
      run: () => ({ changes: 0 }),
    };
  };

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new ExecutionRepository(conn);

  const result = repo.getExecution("exec-001");

  assert.ok(result, "Should return a result");
  assert.equal(result.id, "exec-001");
  assert.equal(result.taskId, "task-001");
  assert.equal(result.workflowId, "single_agent_minimal");
  assert.equal(result.agentId, "agent-1");
  assert.equal(capturedParams[0], "exec-001", "Should pass executionId as parameter");
});

test("ExecutionRepository getExecution returns undefined for missing record", () => {
  const selectSql = `SELECT
        id, task_id AS taskId, workflow_id AS workflowId, parent_execution_id AS parentExecutionId,
        agent_id AS agentId, role_id AS roleId, run_kind AS runKind, status,
        input_ref AS inputRef, trace_id AS traceId, attempt, timeout_ms AS timeoutMs,
        budget_usd_limit AS budgetUsdLimit, requires_approval AS requiresApproval,
        sandbox_mode AS sandboxMode, allowed_tools_json AS allowedToolsJson,
        allowed_paths_json AS allowedPathsJson, max_retries AS maxRetries,
        retry_backoff AS retryBackoff, last_error_code AS lastErrorCode,
        last_error_message AS lastErrorMessage, started_at AS startedAt,
        finished_at AS finishedAt, created_at AS createdAt, updated_at AS updatedAt
       FROM executions WHERE id = ?`;

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
  const mockResults = [
    {
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
    },
    {
      id: "exec-002",
      taskId: "task-001",
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-1",
      roleId: "general_executor",
      runKind: "task_run",
      status: "succeeded",
      inputRef: null,
      traceId: "trace-002",
      attempt: 2,
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
      startedAt: "2026-04-14T10:05:00.000Z",
      finishedAt: "2026-04-14T10:06:00.000Z",
      createdAt: "2026-04-14T10:05:00.000Z",
      updatedAt: "2026-04-14T10:06:00.000Z",
    },
  ];

  const mockPrepare = () => ({
    all: () => mockResults,
    get: () => undefined,
    run: () => ({ changes: 0 }),
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new ExecutionRepository(conn);

  const results = repo.listExecutionsByTask("task-001");

  assert.equal(results.length, 2, "Should return 2 executions");
  assert.equal(results[0]!.id, "exec-001");
  assert.equal(results[1]!.id, "exec-002");
});

test("ExecutionRepository listExecutionsByStatuses filters by status array", () => {
  const mockResults = [
    {
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
    },
  ];

  let capturedSql = "";
  const mockPrepare = (sql: string) => {
    capturedSql = sql;
    return {
      all: () => mockResults,
      get: () => undefined,
      run: () => ({ changes: 0 }),
    };
  };

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new ExecutionRepository(conn);

  const results = repo.listExecutionsByStatuses(["executing"]);

  assert.ok(capturedSql.includes("status IN"), "Should use IN clause for statuses");
  assert.equal(results.length, 1, "Should return 1 execution");
  assert.equal(results[0]!.status, "executing");
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

test("ExecutionRepository updateExecutionStatus modifies execution status", () => {
  let capturedParams: unknown[] = [];
  const mockPrepare = (sql: string) => {
    assert.ok(sql.includes("UPDATE executions SET status"), "Should update executions status");
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

  repo.updateExecutionStatus("exec-001", "prechecking", "2026-04-14T11:00:00.000Z");

  assert.equal(capturedParams[0], "prechecking", "First param should be new status");
  assert.equal(capturedParams[1], "2026-04-14T11:00:00.000Z", "Second param should be updatedAt");
  assert.equal(capturedParams[2], "exec-001", "Last param should be executionId");
});

test("ExecutionRepository updateExecutionFailure records error details", () => {
  let capturedParams: unknown[] = [];
  const mockPrepare = (sql: string) => {
    assert.ok(sql.includes("last_error_code"), "Should update last_error_code");
    assert.ok(sql.includes("last_error_message"), "Should update last_error_message");
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

  assert.equal(capturedParams[0], "failed");
  assert.equal(capturedParams[3], "EXEC_TIMEOUT", "Fourth param should be error code");
  assert.equal(capturedParams[4], "Execution timed out", "Fifth param should be error message");
  assert.equal(capturedParams[5], "exec-001", "Last param should be executionId");
});

test("ExecutionRepository updateExecutionAgent reassigns agent", () => {
  let capturedParams: unknown[] = [];
  const mockPrepare = (sql: string) => {
    assert.ok(sql.includes("SET agent_id"), "Should update agent_id");
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

  repo.updateExecutionAgent("exec-001", "agent-2", "2026-04-14T11:00:00.000Z");

  assert.equal(capturedParams[0], "agent-2", "First param should be new agentId");
  assert.equal(capturedParams[1], "2026-04-14T11:00:00.000Z", "Second param should be updatedAt");
  assert.equal(capturedParams[2], "exec-001", "Last param should be executionId");
});

test("ExecutionRepository insertExecutionPrecheck stores precheck record", () => {
  let capturedParams: unknown[] = [];
  const mockPrepare = (sql: string) => {
    assert.ok(sql.includes("INSERT INTO execution_prechecks"), "Should insert into execution_prechecks");
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

  assert.equal(capturedParams[0], "precheck-001", "First param should be precheck id");
  assert.equal(capturedParams[1], "exec-001", "Second param should be executionId");
  assert.equal(capturedParams[2], 1, "Third param should be allowed flag");
});

test("ExecutionRepository getExecutionPrecheck retrieves precheck record", () => {
  const mockPrecheckResult = {
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
    get: () => mockPrecheckResult,
    all: () => [],
    run: () => ({ changes: 0 }),
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new ExecutionRepository(conn);

  const result = repo.getExecutionPrecheck("exec-001");

  assert.ok(result, "Should return precheck result");
  assert.equal(result.executionId, "exec-001");
  assert.equal(result.allowed, 1);
  assert.equal(result.reasonCode, "budget_sufficient");
});

test("ExecutionRepository insertDeadLetter stores dead letter record", () => {
  let capturedParams: unknown[] = [];
  const mockPrepare = (sql: string) => {
    assert.ok(sql.includes("INSERT INTO dead_letters"), "Should insert into dead_letters");
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

  assert.equal(capturedParams[0], "dl-001", "First param should be dead letter id");
  assert.equal(capturedParams[2], "exec-001", "Third param should be executionId");
  assert.equal(capturedParams[3], "timeout", "Fourth param should be finalReasonCode");
  assert.equal(capturedParams[4], 3, "Fifth param should be retryCount");
});

test("ExecutionRepository getDeadLetterByExecutionId retrieves dead letter", () => {
  const mockDeadLetterResult = {
    id: "dl-001",
    taskId: "task-001",
    executionId: "exec-001",
    finalReasonCode: "timeout",
    retryCount: 3,
    lastErrorMessage: "Execution timed out",
    movedAt: "2026-04-14T11:00:00.000Z",
  };

  const mockPrepare = () => ({
    get: () => mockDeadLetterResult,
    all: () => [],
    run: () => ({ changes: 0 }),
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new ExecutionRepository(conn);

  const result = repo.getDeadLetterByExecutionId("exec-001");

  assert.ok(result, "Should return dead letter result");
  assert.equal(result.executionId, "exec-001");
  assert.equal(result.finalReasonCode, "timeout");
  assert.equal(result.retryCount, 3);
});

test("ExecutionRepository listDeadLettersByTask returns all dead letters for task", () => {
  const mockDeadLetters = [
    {
      id: "dl-001",
      taskId: "task-001",
      executionId: "exec-001",
      finalReasonCode: "timeout",
      retryCount: 1,
      lastErrorMessage: "Timed out",
      movedAt: "2026-04-14T11:00:00.000Z",
    },
    {
      id: "dl-002",
      taskId: "task-001",
      executionId: "exec-002",
      finalReasonCode: "budget_exceeded",
      retryCount: 2,
      lastErrorMessage: "Budget exceeded",
      movedAt: "2026-04-14T11:05:00.000Z",
    },
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
  assert.equal(results[0]!.id, "dl-001");
  assert.equal(results[1]!.id, "dl-002");
});

test("ExecutionRepository countActiveExecutions returns count of active executions", () => {
  const mockPrepare = () => ({
    get: () => ({ count: 42 }),
    all: () => [],
    run: () => ({ changes: 0 }),
  });

  const conn = { exec: () => {}, prepare: mockPrepare } as unknown as SqliteConnection;
  const repo = new ExecutionRepository(conn);

  const count = repo.countActiveExecutions();

  assert.equal(count, 42, "Should return the count");
});

test("ExecutionRepository updateExecutionStatusCas returns affected row count", () => {
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

  assert.ok(capturedSql.includes("WHERE id = ? AND status = ?"), "Should have CAS condition");
  assert.equal(affected, 1, "Should return 1 affected row");
});
