import assert from "node:assert/strict";
import test from "node:test";

import { AsyncWorkerRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/worker-repository.js";
import type { AsyncSqlConnection, AsyncQueryResult } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-sql-database.js";
import type {
  AgentExecutionRecord,
  CoordinatorInstanceRecord,
  ExecutionLeaseRecord,
  ExecutionTicketRecord,
  HeartbeatSnapshotRecord,
  LeaseAuditRecord,
  RemoteLogRecord,
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

function workerSnapshotRecord(overrides: Partial<WorkerSnapshotRecord> = {}): WorkerSnapshotRecord {
  return {
    workerId: "worker-1",
    status: "active",
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
    saturation: 0.5,
    activeLeaseCount: 3,
    meanStartupLatencyMs: null,
    sandboxSuccessRate: null,
    repoCacheHitRate: null,
    registrationVerifiedAt: null,
    registrationChallengeId: null,
    capabilitiesJson: "[]",
    runningExecutionsJson: "[]",
    maxConcurrency: 5,
    queueAffinity: null,
    runtimeInstanceId: "runtime-1",
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    cpuPct: 45.0,
    memoryMb: 512,
    toolBacklogCount: 2,
    currentStepId: null,
    lastProgressAt: now,
    lastHeartbeatAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function executionTicketRecord(overrides: Partial<ExecutionTicketRecord> = {}): ExecutionTicketRecord {
  return {
    id: "ticket-1",
    executionId: "exec-1",
    taskId: "task-1",
    priority: 10,
    queueName: "default",
    dispatchTarget: "any",
    requiredIsolationLevel: "standard",
    requiredRepoVersion: null,
    requiredCapabilitiesJson: "[]",
    dispatchAfter: now,
    attempt: 1,
    status: "pending",
    assignedWorkerId: null,
    leaseId: null,
    claimedAt: null,
    consumedAt: null,
    invalidatedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function executionLeaseRecord(overrides: Partial<ExecutionLeaseRecord> = {}): ExecutionLeaseRecord {
  return {
    id: "lease-1",
    executionId: "exec-1",
    workerId: "worker-1",
    attempt: 1,
    fencingToken: 1,
    queueName: "default",
    status: "active",
    leasedAt: now,
    expiresAt: "2026-04-23T11:00:00.000Z",
    lastHeartbeatAt: now,
    releasedAt: null,
    reasonCode: null,
    ...overrides,
  };
}

// === Worker Snapshot Tests ===

test("AsyncWorkerRepository upsertWorkerSnapshot inserts snapshot", async () => {
  const snapshot = workerSnapshotRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncWorkerRepository(connection);

  await repo.upsertWorkerSnapshot(snapshot);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO worker_snapshots/);
  assert.match(calls[0]!.sql, /ON CONFLICT\(worker_id\) DO UPDATE SET/);
});

test("AsyncWorkerRepository getWorkerSnapshot returns snapshot when found", async () => {
  const snapshot = workerSnapshotRecord();
  const { connection, calls } = createConnection({ queryOneRows: [snapshot] });
  const repo = new AsyncWorkerRepository(connection);

  const result = await repo.getWorkerSnapshot("worker-1");

  assert.deepEqual(result, snapshot);
  assert.match(calls[0]!.sql, /FROM worker_snapshots/);
  assert.match(calls[0]!.sql, /WHERE worker_id = \$1/);
});

test("AsyncWorkerRepository getWorkerSnapshot returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncWorkerRepository(connection);

  const result = await repo.getWorkerSnapshot("worker-missing");

  assert.equal(result, null);
});

test("AsyncWorkerRepository listWorkerSnapshots returns all snapshots", async () => {
  const snapshot = workerSnapshotRecord();
  const { connection, calls } = createConnection({ queryRows: [[snapshot]] });
  const repo = new AsyncWorkerRepository(connection);

  const result = await repo.listWorkerSnapshots();

  assert.deepEqual(result, [snapshot]);
  assert.match(calls[0]!.sql, /FROM worker_snapshots/);
});

test("AsyncWorkerRepository listWorkerSnapshots filters by status", async () => {
  const snapshot = workerSnapshotRecord();
  const { connection, calls } = createConnection({ queryRows: [[snapshot]] });
  const repo = new AsyncWorkerRepository(connection);

  const result = await repo.listWorkerSnapshots("active");

  assert.deepEqual(result, [snapshot]);
  assert.match(calls[0]!.sql, /WHERE status = \$1/);
  assert.deepEqual(calls[0]!.params, ["active"]);
});

test("AsyncWorkerRepository listWorkerSnapshots respects limit", async () => {
  const snapshot = workerSnapshotRecord();
  const { connection, calls } = createConnection({ queryRows: [[snapshot]] });
  const repo = new AsyncWorkerRepository(connection);

  const result = await repo.listWorkerSnapshots(undefined, 5);

  assert.deepEqual(result, [snapshot]);
  assert.match(calls[0]!.sql, /LIMIT \$1/);
  assert.deepEqual(calls[0]!.params, [5]);
});

test("AsyncWorkerRepository listStaleWorkerSnapshots returns stale snapshots", async () => {
  const snapshot = workerSnapshotRecord();
  const { connection, calls } = createConnection({ queryRows: [[snapshot]] });
  const repo = new AsyncWorkerRepository(connection);

  const result = await repo.listStaleWorkerSnapshots(now);

  assert.deepEqual(result, [snapshot]);
  assert.match(calls[0]!.sql, /FROM worker_snapshots/);
  assert.match(calls[0]!.sql, /WHERE last_heartbeat_at < \$1/);
});

// === Execution Ticket Tests ===

test("AsyncWorkerRepository insertExecutionTicket inserts ticket", async () => {
  const ticket = executionTicketRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncWorkerRepository(connection);

  await repo.insertExecutionTicket(ticket);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO execution_tickets/);
});

test("AsyncWorkerRepository claimExecutionTicket claims ticket", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncWorkerRepository(connection);

  await repo.claimExecutionTicket({
    ticketId: "ticket-1",
    assignedWorkerId: "worker-1",
    leaseId: "lease-1",
    claimedAt: now,
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /UPDATE execution_tickets/);
  assert.match(calls[0]!.sql, /status = 'claimed'/);
  assert.match(calls[0]!.sql, /WHERE id = \$5/);
  assert.match(calls[0]!.sql, /AND status = 'pending'/);
});

test("AsyncWorkerRepository consumeExecutionTicket consumes ticket", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncWorkerRepository(connection);

  await repo.consumeExecutionTicket("ticket-1", now);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /UPDATE execution_tickets/);
  assert.match(calls[0]!.sql, /status = 'consumed'/);
  assert.deepEqual(calls[0]!.params, [now, now, "ticket-1"]);
});

test("AsyncWorkerRepository listPendingExecutionTickets returns pending tickets", async () => {
  const ticket = executionTicketRecord();
  const { connection, calls } = createConnection({ queryRows: [[ticket]] });
  const repo = new AsyncWorkerRepository(connection);

  const result = await repo.listPendingExecutionTickets();

  assert.deepEqual(result, [ticket]);
  assert.match(calls[0]!.sql, /FROM execution_tickets/);
  assert.match(calls[0]!.sql, /WHERE status = 'pending'/);
});

test("AsyncWorkerRepository listPendingExecutionTickets filters by queueName", async () => {
  const ticket = executionTicketRecord();
  const { connection, calls } = createConnection({ queryRows: [[ticket]] });
  const repo = new AsyncWorkerRepository(connection);

  const result = await repo.listPendingExecutionTickets("default");

  assert.deepEqual(result, [ticket]);
  assert.match(calls[0]!.sql, /queue_name = \$1/);
});

test("AsyncWorkerRepository getExecutionTicket returns ticket when found", async () => {
  const ticket = executionTicketRecord();
  const { connection, calls } = createConnection({ queryOneRows: [ticket] });
  const repo = new AsyncWorkerRepository(connection);

  const result = await repo.getExecutionTicket("ticket-1");

  assert.deepEqual(result, ticket);
  assert.match(calls[0]!.sql, /FROM execution_tickets/);
  assert.match(calls[0]!.sql, /WHERE id = \$1/);
});

test("AsyncWorkerRepository getExecutionTicket returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncWorkerRepository(connection);

  const result = await repo.getExecutionTicket("ticket-missing");

  assert.equal(result, null);
});

// === Execution Lease Tests ===

test("AsyncWorkerRepository insertExecutionLease inserts lease", async () => {
  const lease = executionLeaseRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncWorkerRepository(connection);

  await repo.insertExecutionLease(lease);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO execution_leases/);
});

test("AsyncWorkerRepository renewExecutionLease renews lease", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncWorkerRepository(connection);

  await repo.renewExecutionLease("lease-1", "2026-04-23T12:00:00.000Z", now);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /UPDATE execution_leases/);
  assert.match(calls[0]!.sql, /expires_at = \$1/);
  assert.deepEqual(calls[0]!.params, ["2026-04-23T12:00:00.000Z", now, "lease-1"]);
});

test("AsyncWorkerRepository closeExecutionLease closes lease", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncWorkerRepository(connection);

  await repo.closeExecutionLease({
    leaseId: "lease-1",
    status: "released",
    releasedAt: now,
    reasonCode: "completed",
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /UPDATE execution_leases/);
  assert.match(calls[0]!.sql, /status = \$1/);
  assert.match(calls[0]!.sql, /released_at = \$2/);
  assert.match(calls[0]!.sql, /reason_code = \$3/);
});

test("AsyncWorkerRepository getExecutionLease returns lease when found", async () => {
  const lease = executionLeaseRecord();
  const { connection, calls } = createConnection({ queryOneRows: [lease] });
  const repo = new AsyncWorkerRepository(connection);

  const result = await repo.getExecutionLease("lease-1");

  assert.deepEqual(result, lease);
  assert.match(calls[0]!.sql, /FROM execution_leases/);
  assert.match(calls[0]!.sql, /WHERE id = \$1/);
});

test("AsyncWorkerRepository getExecutionLease returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncWorkerRepository(connection);

  const result = await repo.getExecutionLease("lease-missing");

  assert.equal(result, null);
});

test("AsyncWorkerRepository getActiveExecutionLease returns active lease", async () => {
  const lease = executionLeaseRecord({ status: "active" });
  const { connection, calls } = createConnection({ queryOneRows: [lease] });
  const repo = new AsyncWorkerRepository(connection);

  const result = await repo.getActiveExecutionLease("exec-1");

  assert.deepEqual(result, lease);
  assert.match(calls[0]!.sql, /WHERE execution_id = \$1/);
  assert.match(calls[0]!.sql, /status = 'active'/);
});

test("AsyncWorkerRepository getLatestExecutionLease returns latest lease by fencing token", async () => {
  const lease = executionLeaseRecord();
  const { connection, calls } = createConnection({ queryOneRows: [lease] });
  const repo = new AsyncWorkerRepository(connection);

  const result = await repo.getLatestExecutionLease("exec-1");

  assert.deepEqual(result, lease);
  assert.match(calls[0]!.sql, /WHERE execution_id = \$1/);
  assert.match(calls[0]!.sql, /ORDER BY fencing_token DESC/);
  assert.match(calls[0]!.sql, /LIMIT 1/);
});

test("AsyncWorkerRepository listExecutionLeases returns all leases for execution", async () => {
  const lease = executionLeaseRecord();
  const { connection, calls } = createConnection({ queryRows: [[lease]] });
  const repo = new AsyncWorkerRepository(connection);

  const result = await repo.listExecutionLeases("exec-1");

  assert.deepEqual(result, [lease]);
  assert.match(calls[0]!.sql, /FROM execution_leases/);
  assert.match(calls[0]!.sql, /WHERE execution_id = \$1/);
});

test("AsyncWorkerRepository listExpiredExecutionLeases returns expired leases", async () => {
  const lease = executionLeaseRecord();
  const { connection, calls } = createConnection({ queryRows: [[lease]] });
  const repo = new AsyncWorkerRepository(connection);

  const result = await repo.listExpiredExecutionLeases(now);

  assert.deepEqual(result, [lease]);
  assert.match(calls[0]!.sql, /WHERE status = 'active'/);
  assert.match(calls[0]!.sql, /AND expires_at < \$1/);
});

test("AsyncWorkerRepository getLatestFencingToken returns max fencing token", async () => {
  const { connection, calls } = createConnection({ queryOneRows: [{ maxFencingToken: 5 }] });
  const repo = new AsyncWorkerRepository(connection);

  const result = await repo.getLatestFencingToken("exec-1");

  assert.equal(result, 5);
  assert.match(calls[0]!.sql, /SELECT MAX\(fencing_token\)/);
});

test("AsyncWorkerRepository getLatestFencingToken returns 0 when no leases", async () => {
  const { connection, calls } = createConnection({ queryOneRows: [{ maxFencingToken: undefined }] });
  const repo = new AsyncWorkerRepository(connection);

  const result = await repo.getLatestFencingToken("exec-no-leases");

  assert.equal(result, 0);
});
