// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import { AsyncDispatchRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/dispatch-repository.js";
import type { AsyncSqlConnection, AsyncQueryResult } from "../../../../../../src/platform/state-evidence/truth/async-sql-database.js";
import type {
  ExecutionRecord,
  ExecutionPrecheckRecord,
  DeadLetterRecord,
  SessionRecord,
  GatewayTargetRecord,
  MessageRecord,
  WorkerSnapshotRecord,
} from "../../../../../../src/platform/contracts/types/domain.js";

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
    runKind: "execute",
    status: "pending",
    inputRef: "input://task-1",
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
    startedAt: null,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function sessionRecord(overrides: Partial<SessionRecord> = {}): SessionRecord {
  return {
    id: "session-1",
    taskId: "task-1",
    channel: "console",
    status: "active",
    externalSessionId: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function gatewayTargetRecord(overrides: Partial<GatewayTargetRecord> = {}): GatewayTargetRecord {
  return {
    targetId: "target-1",
    channel: "console",
    targetKind: "agent",
    externalTargetId: "ext-target-1",
    displayName: "Target One",
    aliasesJson: "[]",
    metadataJson: "{}",
    source: "internal",
    lastSeenAt: now,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function workerSnapshotRecord(overrides: Partial<WorkerSnapshotRecord> = {}): WorkerSnapshotRecord {
  return {
    workerId: "worker-1",
    status: "idle",
    placement: "local",
    isolationLevel: "standard",
    repoVersion: null,
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    streamResumeSuccessRate: null,
    credentialRefreshSuccessRate: null,
    sessionConsistencyCheckStatus: null,
    sessionConsistencyCheckedAt: null,
    workspaceSyncStatus: null,
    workspaceSyncCheckedAt: null,
    saturation: null,
    activeLeaseCount: 0,
    meanStartupLatencyMs: null,
    sandboxSuccessRate: null,
    repoCacheHitRate: null,
    registrationVerifiedAt: null,
    registrationChallengeId: null,
    capabilitiesJson: "{}",
    runningExecutionsJson: "[]",
    maxConcurrency: 10,
    queueAffinity: "default",
    runtimeInstanceId: "instance-1",
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    cpuPct: 10,
    memoryMb: 512,
    toolBacklogCount: 0,
    currentStepId: null,
    lastProgressAt: now,
    lastHeartbeatAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// === Execution Tests ===

test("AsyncDispatchRepository listExecutionsByStatuses returns empty for empty statuses", async () => {
  const { connection } = createConnection({});
  const repo = new AsyncDispatchRepository(connection);

  const result = await repo.listExecutionsByStatuses([]);

  assert.deepEqual(result, []);
});

test("AsyncDispatchRepository listExecutionsByStatuses returns executions", async () => {
  const exec = executionRecord();
  const { connection, calls } = createConnection({ queryRows: [[exec]] });
  const repo = new AsyncDispatchRepository(connection);

  const result = await repo.listExecutionsByStatuses(["pending", "in_progress"]);

  assert.deepEqual(result, [exec]);
  assert.match(calls[0]!.sql, /FROM executions/);
  assert.match(calls[0]!.sql, /WHERE status IN \(\$1, \$2\)/);
});

test("AsyncDispatchRepository getExecution returns execution without tenant", async () => {
  const exec = executionRecord();
  const { connection, calls } = createConnection({ queryOneRows: [exec] });
  const repo = new AsyncDispatchRepository(connection);

  const result = await repo.getExecution("exec-1");

  assert.deepEqual(result, exec);
  assert.match(calls[0]!.sql, /FROM executions/);
  assert.match(calls[0]!.sql, /WHERE id = \$1/);
});

test("AsyncDispatchRepository getExecution returns execution with tenant", async () => {
  const exec = executionRecord();
  const { connection, calls } = createConnection({ queryOneRows: [exec] });
  const repo = new AsyncDispatchRepository(connection);

  const result = await repo.getExecution("exec-1", "tenant-a");

  assert.deepEqual(result, exec);
  assert.match(calls[0]!.sql, /INNER JOIN tasks t ON t\.id = e\.task_id/);
  assert.match(calls[0]!.sql, /t\.tenant_id = \$2/);
});

test("AsyncDispatchRepository getExecution returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncDispatchRepository(connection);

  const result = await repo.getExecution("exec-missing");

  assert.equal(result, null);
});

// === Execution Precheck Tests ===

test("AsyncDispatchRepository getExecutionPrecheck returns precheck without tenant", async () => {
  const precheck = { id: "pc-1", executionId: "exec-1", allowed: true, reasonCode: null, resolvedBudgetUsd: 1.0, resolvedTimeoutMs: 60000, resolvedSandboxMode: "standard", resolvedToolsJson: "[]", resolvedPathsJson: "[]", checkedAt: now };
  const { connection, calls } = createConnection({ queryOneRows: [precheck] });
  const repo = new AsyncDispatchRepository(connection);

  const result = await repo.getExecutionPrecheck("exec-1");

  assert.equal(result?.executionId, "exec-1");
  assert.match(calls[0]!.sql, /FROM execution_prechecks/);
});

test("AsyncDispatchRepository getExecutionPrecheck returns precheck with tenant", async () => {
  const precheck = { id: "pc-1", executionId: "exec-1", allowed: true, reasonCode: null, resolvedBudgetUsd: 1.0, resolvedTimeoutMs: 60000, resolvedSandboxMode: "standard", resolvedToolsJson: "[]", resolvedPathsJson: "[]", checkedAt: now };
  const { connection, calls } = createConnection({ queryOneRows: [precheck] });
  const repo = new AsyncDispatchRepository(connection);

  const result = await repo.getExecutionPrecheck("exec-1", "tenant-a");

  assert.equal(result?.executionId, "exec-1");
  assert.match(calls[0]!.sql, /INNER JOIN tasks t/);
});

test("AsyncDispatchRepository getExecutionPrecheck returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncDispatchRepository(connection);

  const result = await repo.getExecutionPrecheck("exec-missing");

  assert.equal(result, null);
});

// === Dead Letter Tests ===

test("AsyncDispatchRepository getDeadLetterByExecutionId returns dead letter without tenant", async () => {
  const dl = { id: "dl-1", executionId: "exec-1", taskId: "task-1", finalReasonCode: "timeout", retryCount: 3, lastErrorMessage: "timeout", movedAt: now };
  const { connection, calls } = createConnection({ queryOneRows: [dl] });
  const repo = new AsyncDispatchRepository(connection);

  const result = await repo.getDeadLetterByExecutionId("exec-1");

  assert.equal(result?.executionId, "exec-1");
  assert.match(calls[0]!.sql, /FROM dead_letters/);
});

test("AsyncDispatchRepository getDeadLetterByExecutionId returns dead letter with tenant", async () => {
  const dl = { id: "dl-1", executionId: "exec-1", taskId: "task-1", finalReasonCode: "timeout", retryCount: 3, lastErrorMessage: "timeout", movedAt: now };
  const { connection, calls } = createConnection({ queryOneRows: [dl] });
  const repo = new AsyncDispatchRepository(connection);

  const result = await repo.getDeadLetterByExecutionId("exec-1", "tenant-a");

  assert.equal(result?.executionId, "exec-1");
  assert.match(calls[0]!.sql, /INNER JOIN tasks t/);
});

test("AsyncDispatchRepository listDeadLettersByTask returns dead letters without tenant", async () => {
  const dl = { id: "dl-1", executionId: "exec-1", taskId: "task-1", finalReasonCode: "timeout", retryCount: 3, lastErrorMessage: "timeout", movedAt: now };
  const { connection, calls } = createConnection({ queryRows: [[dl]] });
  const repo = new AsyncDispatchRepository(connection);

  const result = await repo.listDeadLettersByTask("task-1");

  assert.equal(result.length, 1);
  assert.match(calls[0]!.sql, /FROM dead_letters/);
});

test("AsyncDispatchRepository listDeadLettersByTask returns dead letters with tenant", async () => {
  const dl = { id: "dl-1", executionId: "exec-1", taskId: "task-1", finalReasonCode: "timeout", retryCount: 3, lastErrorMessage: "timeout", movedAt: now };
  const { connection, calls } = createConnection({ queryRows: [[dl]] });
  const repo = new AsyncDispatchRepository(connection);

  const result = await repo.listDeadLettersByTask("task-1", "tenant-a");

  assert.equal(result.length, 1);
  assert.match(calls[0]!.sql, /INNER JOIN tasks t/);
});

// === Session Tests ===

test("AsyncDispatchRepository getSession returns session without tenant", async () => {
  const session = sessionRecord();
  const { connection, calls } = createConnection({ queryOneRows: [session] });
  const repo = new AsyncDispatchRepository(connection);

  const result = await repo.getSession("session-1");

  assert.deepEqual(result, session);
  assert.match(calls[0]!.sql, /FROM sessions/);
});

test("AsyncDispatchRepository getSession returns session with tenant", async () => {
  const session = sessionRecord();
  const { connection, calls } = createConnection({ queryOneRows: [session] });
  const repo = new AsyncDispatchRepository(connection);

  const result = await repo.getSession("session-1", "tenant-a");

  assert.deepEqual(result, session);
  assert.match(calls[0]!.sql, /INNER JOIN tasks t/);
});

test("AsyncDispatchRepository getSession returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncDispatchRepository(connection);

  const result = await repo.getSession("session-missing");

  assert.equal(result, null);
});

test("AsyncDispatchRepository selectLatestSessionByTask returns session", async () => {
  const session = sessionRecord();
  const { connection, calls } = createConnection({ queryOneRows: [session] });
  const repo = new AsyncDispatchRepository(connection);

  const result = await repo.selectLatestSessionByTask("task-1");

  assert.deepEqual(result, session);
  assert.match(calls[0]!.sql, /FROM sessions/);
  assert.match(calls[0]!.sql, /ORDER BY created_at DESC/);
});

// === Gateway Target Tests ===

test("AsyncDispatchRepository getGatewayTarget returns target when found", async () => {
  const target = gatewayTargetRecord();
  const { connection, calls } = createConnection({ queryOneRows: [target] });
  const repo = new AsyncDispatchRepository(connection);

  const result = await repo.getGatewayTarget("target-1");

  assert.deepEqual(result, target);
  assert.match(calls[0]!.sql, /FROM gateway_targets/);
});

test("AsyncDispatchRepository getGatewayTarget returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncDispatchRepository(connection);

  const result = await repo.getGatewayTarget("target-missing");

  assert.equal(result, null);
});

test("AsyncDispatchRepository listGatewayTargets returns all targets", async () => {
  const target = gatewayTargetRecord();
  const { connection, calls } = createConnection({ queryRows: [[target]] });
  const repo = new AsyncDispatchRepository(connection);

  const result = await repo.listGatewayTargets();

  assert.deepEqual(result, [target]);
  assert.match(calls[0]!.sql, /FROM gateway_targets/);
});

test("AsyncDispatchRepository listGatewayTargets filters by channel", async () => {
  const target = gatewayTargetRecord();
  const { connection, calls } = createConnection({ queryRows: [[target]] });
  const repo = new AsyncDispatchRepository(connection);

  const result = await repo.listGatewayTargets(100, "console");

  assert.deepEqual(result, [target]);
  assert.match(calls[0]!.sql, /WHERE channel = \$1/);
});

// === Message Tests ===

test("AsyncDispatchRepository listMessagesBySession returns messages without tenant", async () => {
  const msg = { id: "msg-1", sessionId: "session-1", direction: "inbound", messageType: "text", content: "hello", partsJson: null, attachmentsJson: "[]", createdAt: now };
  const { connection, calls } = createConnection({ queryRows: [[msg]] });
  const repo = new AsyncDispatchRepository(connection);

  const result = await repo.listMessagesBySession("session-1");

  assert.equal(result.length, 1);
  assert.match(calls[0]!.sql, /FROM messages/);
});

test("AsyncDispatchRepository listMessagesBySession returns messages with tenant", async () => {
  const msg = { id: "msg-1", sessionId: "session-1", direction: "inbound", messageType: "text", content: "hello", partsJson: null, attachmentsJson: "[]", createdAt: now };
  const { connection, calls } = createConnection({ queryRows: [[msg]] });
  const repo = new AsyncDispatchRepository(connection);

  const result = await repo.listMessagesBySession("session-1", "tenant-a");

  assert.equal(result.length, 1);
  assert.match(calls[0]!.sql, /INNER JOIN tasks t/);
});

// === Worker Snapshot Tests ===

test("AsyncDispatchRepository getWorkerSnapshot returns snapshot when found", async () => {
  const snapshot = workerSnapshotRecord();
  const { connection, calls } = createConnection({ queryOneRows: [snapshot] });
  const repo = new AsyncDispatchRepository(connection);

  const result = await repo.getWorkerSnapshot("worker-1");

  assert.deepEqual(result, snapshot);
  assert.match(calls[0]!.sql, /FROM worker_snapshots/);
});

test("AsyncDispatchRepository getWorkerSnapshot returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncDispatchRepository(connection);

  const result = await repo.getWorkerSnapshot("worker-missing");

  assert.equal(result, null);
});