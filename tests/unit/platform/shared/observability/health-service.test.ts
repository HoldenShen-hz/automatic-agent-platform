import assert from "node:assert/strict";
import test from "node:test";

import { HealthService } from "../../../../../src/platform/shared/observability/health-service.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ConnectionMock = Pick<any, "exec" | "prepare">;

/**
 * Mock AuthoritativeSqlDatabase for testing health-service routing logic.
 */
function createMockDb(overrides: Partial<AuthoritativeSqlDatabase> = {}): AuthoritativeSqlDatabase {
  return {
    filePath: "/tmp/test.db",
    backendType: "sqlite",
    connection: {
      exec: () => {},
      prepare: () => ({ get: () => ({ count: 0 }) }),
    } as ConnectionMock,
    migrate: () => {},
    getSchemaStatus: () => ({ current: 1, target: 1, missing: [] }),
    assertSchemaCurrent: () => {},
    integrityCheck: () => [],
    healthCheck: () => Promise.resolve(true),
    transaction: <T>(work: () => T) => work(),
    readTransaction: <T>(work: () => T) => work(),
    ...overrides,
  } as unknown as AuthoritativeSqlDatabase;
}

/**
 * Minimal mock for AuthoritativeTaskStore — only needed for buildQueueGovernanceSummary
 * and buildWorkerHealthSummary. HealthService calls store.worker.listExecutionTicketsByStatuses
 * and store.worker.listWorkerSnapshots / listStaleWorkerSnapshots.
 */
function createMockStore(overrides: Partial<AuthoritativeTaskStore> = {}): AuthoritativeTaskStore {
  return {
    worker: {
      listExecutionTicketsByStatuses: () => [],
      listWorkerSnapshots: () => [],
      listStaleWorkerSnapshots: () => [],
    },
    ...overrides,
  } as unknown as AuthoritativeTaskStore;
}

test("getReportAsync delegates postgres health check", async () => {
  const mockDb = createMockDb({
    backendType: "postgres" as const,
    healthCheck: async () => true,
  });
  const mockStore = createMockStore();
  const service = new HealthService(mockDb, mockStore);

  const report = await service.getReportAsync();
  assert.equal(report.dbWritable, true, "postgres backend should use async healthCheck");
});

test("checkDbWritable returns true for sqlite backendType when probe succeeds", () => {
  const execCalls: string[] = [];
  const mockDb = createMockDb({
    backendType: "sqlite" as const,
    connection: {
      exec: (sql: string) => { execCalls.push(sql); },
      prepare: () => ({ get: () => ({ count: 0 }) }),
    } as ConnectionMock,
  });
  const mockStore = createMockStore();
  const service = new HealthService(mockDb, mockStore);

  const report = service.getReport();
  assert.equal(report.dbWritable, true, "sqlite backend should report dbWritable=true");
  assert.ok(execCalls.length > 0, "sqlite probe should have called exec");
});

test("checkDbWritable returns false for sqlite backendType when probe throws", () => {
  const mockDb = createMockDb({
    backendType: "sqlite" as const,
    connection: {
      exec: () => { throw new Error("read-only filesystem"); },
      prepare: () => ({ get: () => ({ count: 0 }) }),
    } as ConnectionMock,
  });
  const mockStore = createMockStore();
  const service = new HealthService(mockDb, mockStore);

  const report = service.getReport();
  assert.equal(report.dbWritable, false, "sqlite backend with failing probe should report dbWritable=false");
});

test("getReport returns status unhealthy when sqlite probe fails", () => {
  const mockDb = createMockDb({
    backendType: "sqlite" as const,
    connection: {
      exec: () => { throw new Error("read-only"); },
      prepare: () => ({ get: () => ({ count: 0 }) }),
    } as ConnectionMock,
  });
  const mockStore = createMockStore();
  const service = new HealthService(mockDb, mockStore);

  const report = service.getReport();
  assert.equal(report.status, "unhealthy", "status should be unhealthy when sqlite probe fails");
  assert.ok(report.findings.includes("db_not_writable"), "findings should include db_not_writable");
});

test("getReport returns degradationMode read_only_operations_only when sqlite probe fails", () => {
  const mockDb = createMockDb({
    backendType: "sqlite" as const,
    connection: {
      exec: () => { throw new Error("read-only"); },
      prepare: () => ({ get: () => ({ count: 0 }) }),
    } as ConnectionMock,
  });
  const mockStore = createMockStore();
  const service = new HealthService(mockDb, mockStore);

  const report = service.getReport();
  assert.equal(report.degradationMode, "read_only_operations_only", "degradationMode should be read_only_operations_only");
});

test("getReportAsync returns unhealthy when postgres health check fails", async () => {
  const mockDb = createMockDb({
    backendType: "postgres" as const,
    healthCheck: async () => false,
  });
  const mockStore = createMockStore();
  const service = new HealthService(mockDb, mockStore);

  const report = await service.getReportAsync();
  assert.equal(report.status, "unhealthy");
  assert.equal(report.dbWritable, false);
});

test("weak remote reconnect signal requires consecutive reports before degrading health", () => {
  const workerSnapshot = {
    workerId: "worker-1",
    status: "idle",
    placement: "remote",
    remoteSessionStatus: "reconnecting",
    sessionConsistencyCheckStatus: "ok",
    workspaceSyncStatus: "ok",
    lastAcknowledgedStreamOffset: "42",
    queueAffinity: "default",
    maxConcurrency: 1,
    runningExecutionsJson: "[]",
    activeLeaseCount: 0,
    toolBacklogCount: 0,
    saturation: null,
    cpuPct: null,
  };
  const mockStore = createMockStore({
    worker: {
      listExecutionTicketsByStatuses: () => [],
      listWorkerSnapshots: () => [workerSnapshot],
      listStaleWorkerSnapshots: () => [],
    },
  });
  const service = new HealthService(createMockDb(), mockStore);

  const first = service.getReport();
  const second = service.getReport();

  assert.equal(first.findings.includes("remote_session_reconnecting"), true);
  assert.equal(first.status, "ok");
  assert.equal(second.status, "degraded");
});

test("degraded health requires consecutive clean reports before recovering to ok", () => {
  let includeWeakSignal = true;
  const workerSnapshot = {
    workerId: "worker-1",
    status: "idle",
    placement: "remote",
    remoteSessionStatus: "reconnecting",
    sessionConsistencyCheckStatus: "ok",
    workspaceSyncStatus: "ok",
    lastAcknowledgedStreamOffset: "42",
    queueAffinity: "default",
    maxConcurrency: 1,
    runningExecutionsJson: "[]",
    activeLeaseCount: 0,
    toolBacklogCount: 0,
    saturation: null,
    cpuPct: null,
  };
  const mockStore = createMockStore({
    worker: {
      listExecutionTicketsByStatuses: () => [],
      listWorkerSnapshots: () => includeWeakSignal ? [workerSnapshot] : [],
      listStaleWorkerSnapshots: () => [],
    },
  });
  const service = new HealthService(createMockDb(), mockStore);

  service.getReport();
  const degraded = service.getReport();
  includeWeakSignal = false;
  const firstRecovery = service.getReport();
  const secondRecovery = service.getReport();

  assert.equal(degraded.status, "degraded");
  assert.equal(firstRecovery.status, "degraded");
  assert.equal(secondRecovery.status, "ok");
});
