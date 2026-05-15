/**
 * HealthService Reporting Tests
 *
 * Tests for src/platform/shared/observability/health-service.ts
 * Focus areas:
 * - Health status report generation
 * - Status transitions (ok -> degraded -> overloaded -> unhealthy)
 * - Finding detection and reporting
 * - Queue governance and worker health summaries
 */

import assert from "node:assert/strict";
import test from "node:test";
import { HealthService } from "../../../../../src/platform/shared/observability/health-service.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";

type ConnectionMock = Pick<any, "exec" | "prepare">;

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

test("HealthService - getReport returns report with all required fields", () => {
  const mockDb = createMockDb();
  const mockStore = createMockStore();
  const service = new HealthService(mockDb, mockStore);

  const report = service.getReport();

  assert.ok(typeof report.status === "string");
  assert.ok(typeof report.uptimeSeconds === "number");
  assert.ok(typeof report.dbWritable === "boolean");
  assert.ok(typeof report.providerHealth === "string");
  assert.ok(typeof report.providerSuccessRate === "number");
  assert.ok(typeof report.providerRecentCalls === "number");
  assert.ok(typeof report.activeExecutions === "number");
  assert.ok(typeof report.queuedTasks === "number");
  assert.ok(typeof report.memoryRssMb === "number");
  assert.ok(typeof report.tier1AckBacklog === "number");
  assert.ok(typeof report.degradationMode === "string");
  assert.ok(Array.isArray(report.findings));
  assert.ok(report.backpressure !== undefined);
  assert.ok(report.queueGovernance !== undefined);
  assert.ok(report.workerHealth !== undefined);
});

test("HealthService - checkHealth is alias for getReport", () => {
  const mockDb = createMockDb();
  const mockStore = createMockStore();
  const service = new HealthService(mockDb, mockStore);

  const report = service.checkHealth();
  const report2 = service.getReport();

  assert.deepEqual(report, report2);
});

test("HealthService - status transitions to overloaded when tier1AckBacklog exceeds threshold", () => {
  const mockDb = createMockDb({
    connection: {
      exec: () => {},
      prepare: (sql: string) => {
        if (sql.includes("event_consumer_acks")) {
          return { get: () => ({ count: 30 }) }; // Overloaded threshold is 25
        }
        return { get: () => ({ count: 0 }) };
      },
    } as ConnectionMock,
  });
  const mockStore = createMockStore();
  const service = new HealthService(mockDb, mockStore, {
    tier1AckOverloadedThreshold: 25,
  });

  const report = service.getReport();
  assert.equal(report.status, "overloaded");
  assert.ok(report.findings.includes("tier1_ack_backlog_overloaded"));
});

test("HealthService - status transitions to degraded when tier1AckBacklog exceeds degraded threshold", () => {
  const mockDb = createMockDb({
    connection: {
      exec: () => {},
      prepare: (sql: string) => {
        if (sql.includes("event_consumer_acks")) {
          return { get: () => ({ count: 15 }) }; // Between degraded (10) and overloaded (25)
        }
        return { get: () => ({ count: 0 }) };
      },
    } as ConnectionMock,
  });
  const mockStore = createMockStore();
  const service = new HealthService(mockDb, mockStore, {
    tier1AckDegradedThreshold: 10,
    tier1AckOverloadedThreshold: 25,
  });

  const report = service.getReport();
  assert.equal(report.status, "degraded");
  assert.ok(report.findings.includes("tier1_ack_backlog_degraded"));
});

test("HealthService - queuedTasks overload finding", () => {
  const mockDb = createMockDb({
    connection: {
      exec: () => {},
      prepare: (sql: string) => {
        if (sql.includes("tasks")) {
          return { get: () => ({ count: 15 }) }; // Overloaded threshold is 10
        }
        return { get: () => ({ count: 0 }) };
      },
    } as ConnectionMock,
  });
  const mockStore = createMockStore();
  const service = new HealthService(mockDb, mockStore, {
    queuedTaskOverloadedThreshold: 10,
  });

  const report = service.getReport();
  assert.ok(report.findings.includes("queued_tasks_overloaded"));
});

test("HealthService - queuedTasks degraded finding", () => {
  const mockDb = createMockDb({
    connection: {
      exec: () => {},
      prepare: (sql: string) => {
        if (sql.includes("tasks")) {
          return { get: () => ({ count: 7 }) }; // Between degraded (5) and overloaded (10)
        }
        return { get: () => ({ count: 0 }) };
      },
    } as ConnectionMock,
  });
  const mockStore = createMockStore();
  const service = new HealthService(mockDb, mockStore, {
    queuedTaskDegradedThreshold: 5,
    queuedTaskOverloadedThreshold: 10,
  });

  const report = service.getReport();
  assert.ok(report.findings.includes("queued_tasks_degraded"));
});

test("HealthService - activeExecutions overload finding", () => {
  const mockDb = createMockDb({
    connection: {
      exec: () => {},
      prepare: (sql: string) => {
        if (sql.includes("executions")) {
          return { get: () => ({ count: 15 }) }; // Overloaded threshold is 10
        }
        return { get: () => ({ count: 0 }) };
      },
    } as ConnectionMock,
  });
  const mockStore = createMockStore();
  const service = new HealthService(mockDb, mockStore, {
    activeExecutionOverloadedThreshold: 10,
  });

  const report = service.getReport();
  assert.ok(report.findings.includes("active_executions_overloaded"));
});

test("HealthService - queueGovernance with no tickets", () => {
  const mockStore = createMockStore({
    worker: {
      listExecutionTicketsByStatuses: () => [],
      listWorkerSnapshots: () => [],
      listStaleWorkerSnapshots: () => [],
    },
  });
  const mockDb = createMockDb();
  const service = new HealthService(mockDb, mockStore);

  const report = service.getReport();

  assert.equal(report.queueGovernance.backlogSize, 0);
  assert.equal(report.queueGovernance.dispatchableBacklogSize, 0);
  assert.equal(report.queueGovernance.claimedBacklogSize, 0);
  assert.equal(report.queueGovernance.oldestWaitSeconds, null);
  assert.equal(report.queueGovernance.oldestClaimAgeSeconds, null);
  assert.deepEqual(report.queueGovernance.queueNames, []);
  assert.equal(report.queueGovernance.starvationDetected, false);
});

test("HealthService - queueGovernance with pending tickets", () => {
  const mockStore = createMockStore({
    worker: {
      listExecutionTicketsByStatuses: () => [
        { queueName: "default", status: "pending", createdAt: "2026-05-01T00:00:00.000Z", dispatchAfter: null, claimedAt: null },
        { queueName: "default", status: "pending", createdAt: "2026-05-01T00:01:00.000Z", dispatchAfter: null, claimedAt: null },
        { queueName: "priority", status: "pending", createdAt: "2026-05-01T00:02:00.000Z", dispatchAfter: null, claimedAt: null },
      ],
      listWorkerSnapshots: () => [],
      listStaleWorkerSnapshots: () => [],
    },
  });
  const mockDb = createMockDb();
  const service = new HealthService(mockDb, mockStore, {
    nowMsSupplier: () => Date.parse("2026-05-01T00:05:00.000Z"),
  });

  const report = service.getReport();

  assert.equal(report.queueGovernance.backlogSize, 3);
  assert.equal(report.queueGovernance.dispatchableBacklogSize, 3);
  assert.equal(report.queueGovernance.claimedBacklogSize, 0);
  assert.deepEqual(report.queueGovernance.queueNames, ["default", "priority"]);
});

test("HealthService - queueGovernance starvation detection", () => {
  const oldTimestamp = "2026-05-01T00:00:00.000Z";
  const mockStore = createMockStore({
    worker: {
      listExecutionTicketsByStatuses: () => [
        { queueName: "default", status: "pending", createdAt: oldTimestamp, dispatchAfter: null, claimedAt: null },
      ],
      listWorkerSnapshots: () => [],
      listStaleWorkerSnapshots: () => [],
    },
  });
  const mockDb = createMockDb();
  // 6 minutes later - exceeds queueStarvationThresholdSeconds (300 = 5 minutes)
  const service = new HealthService(mockDb, mockStore, {
    nowMsSupplier: () => Date.parse("2026-05-01T00:06:00.000Z"),
    queueStarvationThresholdSeconds: 300,
  });

  const report = service.getReport();

  assert.equal(report.queueGovernance.starvationDetected, true);
  assert.ok(report.findings.includes("queue_starvation_detected"));
});

test("HealthService - workerHealth with no workers", () => {
  const mockStore = createMockStore({
    worker: {
      listExecutionTicketsByStatuses: () => [],
      listWorkerSnapshots: () => [],
      listStaleWorkerSnapshots: () => [],
    },
  });
  const mockDb = createMockDb();
  const service = new HealthService(mockDb, mockStore);

  const report = service.getReport();

  assert.equal(report.workerHealth.totalWorkers, 0);
  assert.equal(report.workerHealth.healthyWorkers, 0);
  assert.equal(report.workerHealth.busyWorkers, 0);
  assert.equal(report.workerHealth.drainingWorkers, 0);
  assert.equal(report.workerHealth.degradedWorkers, 0);
  assert.equal(report.workerHealth.quarantinedWorkers, 0);
  assert.equal(report.workerHealth.offlineWorkers, 0);
  assert.equal(report.workerHealth.staleWorkers, 0);
  assert.equal(report.workerHealth.loadSkewDetected, false);
});

test("HealthService - workerHealth categorizes worker statuses", () => {
  const mockStore = createMockStore({
    worker: {
      listExecutionTicketsByStatuses: () => [],
      listWorkerSnapshots: () => [
        { workerId: "w1", status: "idle", placement: "local", runningExecutionsJson: "[]", maxConcurrency: 5 },
        { workerId: "w2", status: "busy", placement: "local", runningExecutionsJson: "[1]", maxConcurrency: 5 },
        { workerId: "w3", status: "draining", placement: "local", runningExecutionsJson: "[]", maxConcurrency: 5 },
        { workerId: "w4", status: "degraded", placement: "local", runningExecutionsJson: "[]", maxConcurrency: 5 },
      ],
      listStaleWorkerSnapshots: () => [],
    },
  });
  const mockDb = createMockDb();
  const service = new HealthService(mockDb, mockStore);

  const report = service.getReport();

  assert.equal(report.workerHealth.totalWorkers, 4);
  assert.equal(report.workerHealth.healthyWorkers, 2); // idle + busy
  assert.equal(report.workerHealth.busyWorkers, 1);
  assert.equal(report.workerHealth.drainingWorkers, 1);
  assert.equal(report.workerHealth.degradedWorkers, 1);
});

test("HealthService - workerHealth remote session tracking", () => {
  const mockStore = createMockStore({
    worker: {
      listExecutionTicketsByStatuses: () => [],
      listWorkerSnapshots: () => [
        { workerId: "r1", status: "idle", placement: "remote", remoteSessionStatus: "connected", runningExecutionsJson: "[]", maxConcurrency: 5 },
        { workerId: "r2", status: "busy", placement: "remote", remoteSessionStatus: "reconnecting", runningExecutionsJson: "[]", maxConcurrency: 5 },
        { workerId: "r3", status: "idle", placement: "remote", remoteSessionStatus: "degraded", runningExecutionsJson: "[]", maxConcurrency: 5 },
        { workerId: "r4", status: "idle", placement: "remote", remoteSessionStatus: "failed", runningExecutionsJson: "[]", maxConcurrency: 5 },
      ],
      listStaleWorkerSnapshots: () => [],
    },
  });
  const mockDb = createMockDb();
  const service = new HealthService(mockDb, mockStore);

  const report = service.getReport();

  assert.equal(report.workerHealth.remoteWorkers, 4);
  assert.equal(report.workerHealth.remoteConnectedWorkers, 1);
  assert.equal(report.workerHealth.remoteReconnectingWorkers, 1);
  assert.equal(report.workerHealth.remoteDegradedSessions, 1);
  assert.equal(report.workerHealth.remoteFailedSessions, 1);
  assert.ok(report.findings.includes("remote_session_reconnecting"));
  assert.ok(report.findings.includes("remote_session_degraded"));
  assert.ok(report.findings.includes("remote_session_failed"));
});

test("HealthService - backpressure summary contains required fields", () => {
  const mockDb = createMockDb();
  const mockStore = createMockStore();
  const service = new HealthService(mockDb, mockStore);

  const report = service.getReport();

  assert.equal(report.backpressure.status, report.status);
  assert.equal(report.backpressure.degradationMode, report.degradationMode);
  assert.equal(report.backpressure.tier1AckBacklog, report.tier1AckBacklog);
  assert.ok(report.backpressure.queueGovernance !== undefined);
});

test("HealthService - degradationMode transitions correctly", () => {
  // Test tier1AckBacklog overload -> pause_non_critical
  const mockDb = createMockDb({
    connection: {
      exec: () => {},
      prepare: (sql: string) => {
        if (sql.includes("event_consumer_acks")) {
          return { get: () => ({ count: 30 }) };
        }
        return { get: () => ({ count: 0 }) };
      },
    } as ConnectionMock,
  });
  const mockStore = createMockStore();
  const service = new HealthService(mockDb, mockStore, {
    tier1AckOverloadedThreshold: 25,
  });

  const report = service.getReport();
  assert.equal(report.degradationMode, "pause_non_critical");
});

test("HealthService - providerHealth failed triggers unhealthy", () => {
  const mockDb = createMockDb();
  const mockStore = createMockStore();
  const service = new HealthService(mockDb, mockStore, {
    providerTracker: {
      getSummary: () => ({
        status: "failed" as const,
        successRate: 0,
        totalCalls: 10,
      }),
    },
  });

  const report = service.getReport();
  assert.equal(report.providerHealth, "failed");
  assert.equal(report.status, "overloaded");
  assert.ok(report.findings.includes("provider_failed"));
});

test("HealthService - providerHealth degraded finding", () => {
  const mockDb = createMockDb();
  const mockStore = createMockStore();
  const service = new HealthService(mockDb, mockStore, {
    providerTracker: {
      getSummary: () => ({
        status: "degraded" as const,
        successRate: 0.7,
        totalCalls: 100,
      }),
    },
  });

  const report = service.getReport();
  assert.equal(report.providerHealth, "degraded");
  assert.ok(report.findings.includes("provider_degraded"));
});

test("HealthService - uptimeSeconds increases over time", () => {
  const mockDb = createMockDb();
  const mockStore = createMockStore();
  let nowMs = Date.now();
  const service = new HealthService(mockDb, mockStore, {
    nowMsSupplier: () => nowMs,
  });

  const report1 = service.getReport();
  const uptime1 = report1.uptimeSeconds;

  // Simulate time passing
  nowMs += 3000;
  const report2 = service.getReport();

  assert.ok(report2.uptimeSeconds >= uptime1 + 3);
});

test("HealthService - memory pressure degraded finding", () => {
  const mockDb = createMockDb();
  const mockStore = createMockStore();

  // Mock memory usage by overriding process.memoryUsage
  const originalMemoryUsage = process.memoryUsage;
  const mockMemoryUsage = () => {
    return { rss: 600 * 1024 * 1024, heapTotal: 400 * 1024 * 1024, heapUsed: 350 * 1024 * 1024, external: 100 * 1024 * 1024 };
  };

  try {
    (process as any).memoryUsage = mockMemoryUsage;
    const service = new HealthService(mockDb, mockStore, {
      memoryHighWatermarkMb: 560, // 600MB RSS is degraded but below overloaded threshold
    });

    const report = service.getReport();
    assert.ok(report.findings.includes("memory_pressure_degraded"));
  } finally {
    (process as any).memoryUsage = originalMemoryUsage;
  }
});

test("HealthService - status is ok when all metrics are healthy", () => {
  const mockDb = createMockDb();
  const mockStore = createMockStore({
    worker: {
      listExecutionTicketsByStatuses: () => [],
      listWorkerSnapshots: () => [],
      listStaleWorkerSnapshots: () => [],
    },
  });
  const service = new HealthService(mockDb, mockStore, {
    nowMsSupplier: () => Date.now(),
    memoryHighWatermarkMb: 512,
    eventLoopLagThresholdMs: 200,
    queuedTaskDegradedThreshold: 5,
    queuedTaskOverloadedThreshold: 10,
    tier1AckDegradedThreshold: 10,
    tier1AckOverloadedThreshold: 25,
    activeExecutionOverloadedThreshold: 10,
  });

  const report = service.getReport();
  assert.equal(report.status, "ok");
  assert.equal(report.degradationMode, "none");
  assert.equal(report.findings.length, 0);
});
