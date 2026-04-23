// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import { AsyncExecutionRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/execution-repository.js";
import type { AsyncSqlConnection, AsyncQueryResult } from "../../../../../../src/platform/state-evidence/truth/async-sql-database.js";
import type { ExecutionRecord, ExecutionPrecheckRecord, DeadLetterRecord } from "../../../../../../src/platform/contracts/types/domain.js";

type SqlCall = {
  method: "query" | "queryOne" | "execute";
  sql: string;
  params: unknown[];
};

function createConnection(options: {
  queryRows?: unknown[][];
  queryOneRows?: unknown[];
  executeResults?: number[];
} = {}) {
  const calls: SqlCall[] = [];
  let queryIndex = 0;
  let queryOneIndex = 0;
  let executeIndex = 0;

  const connection: AsyncSqlConnection = {
    async query<T>(sql: string, ...params: unknown[]): Promise<AsyncQueryResult<T>> {
      calls.push({ method: "query", sql, params });
      const rows = (options.queryRows?.[queryIndex++] ?? []) as T[];
      return { rows, rowCount: rows.length, changes: rows.length };
    },
    async queryOne<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
      calls.push({ method: "queryOne", sql, params });
      return options.queryOneRows?.[queryOneIndex++] as T | undefined;
    },
    async execute(sql: string, ...params: unknown[]): Promise<number> {
      calls.push({ method: "execute", sql, params });
      return options.executeResults?.[executeIndex++] ?? 1;
    },
  };

  return { connection, calls };
}

const now = "2026-04-23T10:00:00.000Z";

function executionRecord(overrides: Partial<ExecutionRecord> = {}): ExecutionRecord {
  return {
    id: "exec-1",
    taskId: "task-1",
    workflowId: "wf-1",
    parentExecutionId: null,
    agentId: "agent-1",
    roleId: "role-1",
    runKind: "standard",
    status: "executing",
    inputRef: "input-ref-1",
    traceId: "trace-1",
    attempt: 1,
    timeoutMs: 60000,
    budgetUsdLimit: 1.0,
    requiresApproval: false,
    sandboxMode: "standard",
    allowedToolsJson: "[]",
    allowedPathsJson: "[]",
    maxRetries: 3,
    retryBackoff: "exponential",
    lastErrorCode: null,
    lastErrorMessage: null,
    startedAt: now,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

test("AsyncExecutionRepository insertExecution inserts execution record", async () => {
  const execution = executionRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncExecutionRepository(connection);

  await repo.insertExecution(execution);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO executions/);
  assert.match(calls[0]!.sql, /id, task_id, workflow_id/);
});

test("AsyncExecutionRepository getExecution returns execution when found", async () => {
  const execution = executionRecord();
  const { connection, calls } = createConnection({ queryOneRows: [execution] });
  const repo = new AsyncExecutionRepository(connection);

  const result = await repo.getExecution("exec-1");

  assert.deepEqual(result, execution);
  assert.match(calls[0]!.sql, /FROM executions WHERE id = \$1/);
});

test("AsyncExecutionRepository getExecution returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncExecutionRepository(connection);

  const result = await repo.getExecution("exec-missing");

  assert.equal(result, null);
});

test("AsyncExecutionRepository listExecutionsByTask returns executions without tenant", async () => {
  const execution = executionRecord();
  const { connection, calls } = createConnection({ queryRows: [[execution]] });
  const repo = new AsyncExecutionRepository(connection);

  const result = await repo.listExecutionsByTask("task-1");

  assert.deepEqual(result, [execution]);
  assert.match(calls[0]!.sql, /WHERE e\.task_id = \$1/);
  assert.match(calls[0]!.sql, /ORDER BY e\.created_at ASC/);
});

test("AsyncExecutionRepository listExecutionsByTask returns executions with tenant", async () => {
  const execution = executionRecord();
  const { connection, calls } = createConnection({ queryRows: [[execution]] });
  const repo = new AsyncExecutionRepository(connection);

  const result = await repo.listExecutionsByTask("task-1", "tenant-a");

  assert.deepEqual(result, [execution]);
  assert.match(calls[0]!.sql, /INNER JOIN tasks t ON t\.id = e\.task_id/);
  assert.match(calls[0]!.sql, /t\.tenant_id = \$2/);
});

test("AsyncExecutionRepository listExecutionsByStatuses returns empty array for empty statuses", async () => {
  const { connection } = createConnection({});
  const repo = new AsyncExecutionRepository(connection);

  const result = await repo.listExecutionsByStatuses([]);

  assert.deepEqual(result, []);
});

test("AsyncExecutionRepository listExecutionsByStatuses returns executions with status filter", async () => {
  const execution = executionRecord({ status: "executing" });
  const { connection, calls } = createConnection({ queryRows: [[execution]] });
  const repo = new AsyncExecutionRepository(connection);

  const result = await repo.listExecutionsByStatuses(["executing"]);

  assert.deepEqual(result, [execution]);
  assert.match(calls[0]!.sql, /WHERE status IN \(\$1\)/);
  assert.deepEqual(calls[0]!.params, ["executing"]);
});

test("AsyncExecutionRepository listExecutionsByStatuses respects limit and cursor", async () => {
  const execution = executionRecord();
  const { connection, calls } = createConnection({ queryRows: [[execution]] });
  const repo = new AsyncExecutionRepository(connection);

  const result = await repo.listExecutionsByStatuses(["executing", "prechecking"], 10, "2026-04-22T00:00:00.000Z");

  assert.deepEqual(result, [execution]);
  assert.match(calls[0]!.sql, /created_at < \$3/);
  assert.match(calls[0]!.sql, /LIMIT \$4/);
  assert.deepEqual(calls[0]!.params, ["executing", "prechecking", "2026-04-22T00:00:00.000Z", 10]);
});

test("AsyncExecutionRepository updateExecutionStatus updates status", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncExecutionRepository(connection);

  const result = await repo.updateExecutionStatus("exec-1", "completed", now, null, now, null);

  assert.equal(result, 1);
  assert.match(calls[0]!.sql, /UPDATE executions SET status = \$1/);
  assert.match(calls[0]!.sql, /started_at = COALESCE\(\$3, started_at\)/);
});

test("AsyncExecutionRepository updateExecutionFailure updates failure fields", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncExecutionRepository(connection);

  const result = await repo.updateExecutionFailure({
    executionId: "exec-1",
    status: "failed",
    updatedAt: now,
    finishedAt: now,
    lastErrorCode: "ERR_TIMEOUT",
    lastErrorMessage: "Execution timed out",
  });

  assert.equal(result, 1);
  assert.match(calls[0]!.sql, /last_error_code = \$4/);
  assert.match(calls[0]!.sql, /last_error_message = \$5/);
});

test("AsyncExecutionRepository updateExecutionAgent updates agent", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncExecutionRepository(connection);

  const result = await repo.updateExecutionAgent("exec-1", "agent-new", now);

  assert.equal(result, 1);
  assert.match(calls[0]!.sql, /SET agent_id = \$1/);
  assert.deepEqual(calls[0]!.params, ["agent-new", now, "exec-1"]);
});

test("AsyncExecutionRepository countActiveExecutions returns count", async () => {
  const { connection, calls } = createConnection({ queryOneRows: [{ count: 15 }] });
  const repo = new AsyncExecutionRepository(connection);

  const result = await repo.countActiveExecutions();

  assert.equal(result, 15);
  assert.match(calls[0]!.sql, /COUNT\(\*\) AS count/);
  assert.match(calls[0]!.sql, /status IN \('executing', 'prechecking'\)/);
});

test("AsyncExecutionRepository insertExecutionPrecheck inserts precheck record", async () => {
  const precheck: ExecutionPrecheckRecord = {
    id: "precheck-1",
    executionId: "exec-1",
    allowed: true,
    reasonCode: "approved",
    resolvedBudgetUsd: 1.0,
    resolvedTimeoutMs: 60000,
    resolvedSandboxMode: "standard",
    resolvedToolsJson: "[]",
    resolvedPathsJson: "[]",
    checkedAt: now,
  };
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncExecutionRepository(connection);

  await repo.insertExecutionPrecheck(precheck);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO execution_prechecks/);
});

test("AsyncExecutionRepository getExecutionPrecheck returns precheck when found", async () => {
  const precheck: ExecutionPrecheckRecord = {
    id: "precheck-1",
    executionId: "exec-1",
    allowed: true,
    reasonCode: "approved",
    resolvedBudgetUsd: 1.0,
    resolvedTimeoutMs: 60000,
    resolvedSandboxMode: "standard",
    resolvedToolsJson: "[]",
    resolvedPathsJson: "[]",
    checkedAt: now,
  };
  const { connection, calls } = createConnection({ queryOneRows: [precheck] });
  const repo = new AsyncExecutionRepository(connection);

  const result = await repo.getExecutionPrecheck("exec-1");

  assert.deepEqual(result, precheck);
  assert.match(calls[0]!.sql, /FROM execution_prechecks WHERE execution_id = \$1/);
});

test("AsyncExecutionRepository getExecutionPrecheck returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncExecutionRepository(connection);

  const result = await repo.getExecutionPrecheck("exec-missing");

  assert.equal(result, null);
});

test("AsyncExecutionRepository insertDeadLetter inserts dead letter record", async () => {
  const deadLetter: DeadLetterRecord = {
    id: "dl-1",
    taskId: "task-1",
    executionId: "exec-1",
    finalReasonCode: "max_retries_exceeded",
    retryCount: 3,
    lastErrorMessage: "All retries failed",
    movedAt: now,
  };
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncExecutionRepository(connection);

  await repo.insertDeadLetter(deadLetter);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO dead_letters/);
});

test("AsyncExecutionRepository getDeadLetterByExecutionId returns dead letter when found", async () => {
  const deadLetter: DeadLetterRecord = {
    id: "dl-1",
    taskId: "task-1",
    executionId: "exec-1",
    finalReasonCode: "max_retries_exceeded",
    retryCount: 3,
    lastErrorMessage: "All retries failed",
    movedAt: now,
  };
  const { connection, calls } = createConnection({ queryOneRows: [deadLetter] });
  const repo = new AsyncExecutionRepository(connection);

  const result = await repo.getDeadLetterByExecutionId("exec-1");

  assert.deepEqual(result, deadLetter);
  assert.match(calls[0]!.sql, /FROM dead_letters WHERE execution_id = \$1/);
});

test("AsyncExecutionRepository getDeadLetterByExecutionId returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncExecutionRepository(connection);

  const result = await repo.getDeadLetterByExecutionId("exec-missing");

  assert.equal(result, null);
});

test("AsyncExecutionRepository listDeadLettersByTask returns dead letters for task", async () => {
  const deadLetter: DeadLetterRecord = {
    id: "dl-1",
    taskId: "task-1",
    executionId: "exec-1",
    finalReasonCode: "max_retries_exceeded",
    retryCount: 3,
    lastErrorMessage: "All retries failed",
    movedAt: now,
  };
  const { connection, calls } = createConnection({ queryRows: [[deadLetter]] });
  const repo = new AsyncExecutionRepository(connection);

  const result = await repo.listDeadLettersByTask("task-1");

  assert.deepEqual(result, [deadLetter]);
  assert.match(calls[0]!.sql, /FROM dead_letters WHERE task_id = \$1/);
  assert.match(calls[0]!.sql, /ORDER BY moved_at DESC/);
});
