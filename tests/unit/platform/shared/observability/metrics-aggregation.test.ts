/**
 * MetricsService Aggregation Tests
 *
 * Tests for src/platform/shared/observability/metrics-service.ts
 * Focus areas:
 * - Task metrics aggregation and rates
 * - Workflow metrics aggregation
 * - Execution metrics aggregation
 * - Recovery metrics aggregation
 * - Step performance metrics (durations, percentiles)
 * - Cost metrics aggregation
 * - Approval and event metrics aggregation
 */

import assert from "node:assert/strict";
import test from "node:test";
import { MetricsService } from "../../../../../src/platform/shared/observability/metrics-service.js";
import { HealthService } from "../../../../../src/platform/shared/observability/health-service.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";

type ConnectionMock = Pick<any, "exec" | "prepare">;

function createMockDb(overrides: Partial<AuthoritativeSqlDatabase> & { selectResults?: Record<string, unknown> } = {}): AuthoritativeSqlDatabase {
  const selectResults = overrides.selectResults ?? {};
  return {
    filePath: "/tmp/test.db",
    backendType: "sqlite",
    connection: {
      exec: () => {},
      prepare: (sql: string) => {
        // Return predefined results for specific queries
        for (const [key, value] of Object.entries(selectResults)) {
          if (sql.includes(key)) {
            return { get: () => value, all: () => [] };
          }
        }
        // Default responses
        if (sql.includes("COUNT")) {
          return { get: () => ({ count: 0 }) };
        }
        return { get: () => ({}), all: () => [] };
      },
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

function createMockHealthService(): HealthService {
  const mockDb = createMockDb();
  const mockStore = createMockStore();
  return new HealthService(mockDb, mockStore);
}

test("MetricsService - buildSummary returns complete structure", () => {
  const mockDb = createMockDb();
  const healthService = createMockHealthService();
  const service = new MetricsService(mockDb, healthService);

  const summary = service.buildSummary("2026-05-01T00:00:00.000Z");

  assert.ok(typeof summary.generatedAt === "string");
  assert.ok(summary.window !== undefined);
  assert.ok(summary.taskMetrics !== undefined);
  assert.ok(summary.workflowMetrics !== undefined);
  assert.ok(summary.executionMetrics !== undefined);
  assert.ok(summary.recoveryMetrics !== undefined);
  assert.ok(summary.stepMetrics !== undefined);
  assert.ok(summary.costMetrics !== undefined);
  assert.ok(summary.approvalMetrics !== undefined);
  assert.ok(summary.eventMetrics !== undefined);
  assert.ok(summary.runtimeMetrics !== undefined);
});

test("MetricsService - task metrics successRate calculation", () => {
  const mockDb = createMockDb({
    selectResults: {
      "MIN(created_at)": { firstTaskCreatedAt: "2026-05-01T00:00:00.000Z", lastTaskUpdatedAt: "2026-05-01T00:30:00.000Z" },
      "COUNT(*) FROM tasks": { total: 100, terminalCount: 80, successCount: 60, failedCount: 15, cancelledCount: 5, activeCount: 20 },
    },
  });
  const healthService = createMockHealthService();
  const service = new MetricsService(mockDb, healthService);

  const summary = service.buildSummary();

  assert.equal(summary.taskMetrics.total, 100);
  assert.equal(summary.taskMetrics.terminalCount, 80);
  assert.equal(summary.taskMetrics.successCount, 60);
  assert.equal(summary.taskMetrics.failedCount, 15);
  assert.equal(summary.taskMetrics.cancelledCount, 5);
  assert.equal(summary.taskMetrics.activeCount, 20);
  // successRate = successCount / terminalCount = 60 / 80 = 0.75
  assert.equal(summary.taskMetrics.successRate, 0.75);
  // completionRate = terminalCount / total = 80 / 100 = 0.8
  assert.equal(summary.taskMetrics.completionRate, 0.8);
});

test("MetricsService - successRate is 0 when no terminal tasks", () => {
  const mockDb = createMockDb({
    selectResults: {
      "MIN(created_at)": { firstTaskCreatedAt: null, lastTaskUpdatedAt: null },
      "COUNT(*) FROM tasks": { total: 10, terminalCount: 0, successCount: 0, failedCount: 0, cancelledCount: 0, activeCount: 10 },
    },
  });
  const healthService = createMockHealthService();
  const service = new MetricsService(mockDb, healthService);

  const summary = service.buildSummary();

  assert.equal(summary.taskMetrics.successRate, 0);
  assert.equal(summary.taskMetrics.completionRate, 0);
});

test("MetricsService - workflow metrics retryRate calculation", () => {
  const mockDb = createMockDb({
    selectResults: {
      "MIN(created_at)": { firstTaskCreatedAt: null, lastTaskUpdatedAt: null },
      "COUNT(*) FROM workflow_state": { total: 50, completedCount: 30, failedCount: 10, cancelledCount: 5, retriedCount: 15 },
    },
  });
  const healthService = createMockHealthService();
  const service = new MetricsService(mockDb, healthService);

  const summary = service.buildSummary();

  assert.equal(summary.workflowMetrics.total, 50);
  assert.equal(summary.workflowMetrics.completedCount, 30);
  assert.equal(summary.workflowMetrics.failedCount, 10);
  assert.equal(summary.workflowMetrics.cancelledCount, 5);
  assert.equal(summary.workflowMetrics.retriedCount, 15);
  // retryRate = retriedCount / total = 15 / 50 = 0.3
  assert.equal(summary.workflowMetrics.retryRate, 0.3);
});

test("MetricsService - execution metrics retryRate calculation", () => {
  const mockDb = createMockDb({
    selectResults: {
      "MIN(created_at)": { firstTaskCreatedAt: null, lastTaskUpdatedAt: null },
      "COUNT(*) FROM executions": { total: 100, activeCount: 20, retryAttemptCount: 25, supersededCount: 5 },
    },
  });
  const healthService = createMockHealthService();
  const service = new MetricsService(mockDb, healthService);

  const summary = service.buildSummary();

  assert.equal(summary.executionMetrics.total, 100);
  assert.equal(summary.executionMetrics.activeCount, 20);
  assert.equal(summary.executionMetrics.retryAttemptCount, 25);
  assert.equal(summary.executionMetrics.supersededCount, 5);
  // retryRate = retryAttemptCount / total = 25 / 100 = 0.25
  assert.equal(summary.executionMetrics.retryRate, 0.25);
});

test("MetricsService - recovery metrics successRate calculation", () => {
  const mockDb = createMockDb({
    selectResults: {
      "MIN(created_at)": { firstTaskCreatedAt: null, lastTaskUpdatedAt: null },
      "events e": { taskCount: 40, successfulTaskCount: 30, decisionCount: 50, repairEventCount: 35, deadLetterCount: 5, cancelledCount: 3 },
    },
  });
  const healthService = createMockHealthService();
  const service = new MetricsService(mockDb, healthService);

  const summary = service.buildSummary();

  assert.equal(summary.recoveryMetrics.taskCount, 40);
  assert.equal(summary.recoveryMetrics.successfulTaskCount, 30);
  assert.equal(summary.recoveryMetrics.decisionCount, 50);
  assert.equal(summary.recoveryMetrics.repairEventCount, 35);
  assert.equal(summary.recoveryMetrics.deadLetterCount, 5);
  assert.equal(summary.recoveryMetrics.cancelledCount, 3);
  // successRate = successfulTaskCount / taskCount = 30 / 40 = 0.75
  assert.equal(summary.recoveryMetrics.successRate, 0.75);
});

test("MetricsService - step metrics with duration data", () => {
  const mockDb = createMockDb({
    selectResults: {
      "MIN(created_at)": { firstTaskCreatedAt: null, lastTaskUpdatedAt: null },
    },
    connection: {
      exec: () => {},
      prepare: (sql: string) => {
        if (sql.includes("workflow_step_outputs")) {
          return {
            all: () => [
              { durationMs: 100, tokenCost: 50 },
              { durationMs: 200, tokenCost: 100 },
              { durationMs: 300, tokenCost: 150 },
              { durationMs: 400, tokenCost: 200 },
              { durationMs: 500, tokenCost: 250 },
            ],
          };
        }
        if (sql.includes("COUNT")) {
          return { get: () => ({ count: 0 }) };
        }
        return { get: () => ({}), all: () => [] };
      },
    } as ConnectionMock,
  });
  const healthService = createMockHealthService();
  const service = new MetricsService(mockDb, healthService);

  const summary = service.buildSummary();

  assert.equal(summary.stepMetrics.total, 5);
  // averageDurationMs = (100 + 200 + 300 + 400 + 500) / 5 = 300
  assert.equal(summary.stepMetrics.averageDurationMs, 300);
  // p95DurationMs - 5 items, index = ceil(5 * 0.95) - 1 = 5 - 1 = 4, so index 4 = 500
  assert.equal(summary.stepMetrics.p95DurationMs, 500);
  // averageTokenCost = (50 + 100 + 150 + 200 + 250) / 5 = 150
  assert.equal(summary.stepMetrics.averageTokenCost, 150);
  // totalTokenCost = 50 + 100 + 150 + 200 + 250 = 750
  assert.equal(summary.stepMetrics.totalTokenCost, 750);
});

test("MetricsService - step metrics returns null for empty data", () => {
  const mockDb = createMockDb({
    selectResults: {
      "MIN(created_at)": { firstTaskCreatedAt: null, lastTaskUpdatedAt: null },
    },
    connection: {
      exec: () => {},
      prepare: () => ({ all: () => [], get: () => ({ count: 0 }) }),
    } as ConnectionMock,
  });
  const healthService = createMockHealthService();
  const service = new MetricsService(mockDb, healthService);

  const summary = service.buildSummary();

  assert.equal(summary.stepMetrics.total, 0);
  assert.equal(summary.stepMetrics.averageDurationMs, null);
  assert.equal(summary.stepMetrics.p95DurationMs, null);
  assert.equal(summary.stepMetrics.averageTokenCost, null);
  assert.equal(summary.stepMetrics.totalTokenCost, 0);
});

test("MetricsService - cost metrics calculation", () => {
  const mockDb = createMockDb({
    selectResults: {
      "MIN(created_at)": { firstTaskCreatedAt: null, lastTaskUpdatedAt: null },
      "cost_events": { totalActualCostUsd: 150.5, averageActualCostUsdPerTask: 1.505, averageActualCostUsdPerSuccessfulTask: 2.0 },
    },
  });
  const healthService = createMockHealthService();
  const service = new MetricsService(mockDb, healthService);

  const summary = service.buildSummary();

  assert.equal(summary.costMetrics.totalActualCostUsd, 150.5);
  assert.equal(summary.costMetrics.averageActualCostUsdPerTask, 1.505);
  assert.equal(summary.costMetrics.averageActualCostUsdPerSuccessfulTask, 2.0);
});

test("MetricsService - cost metrics rounded to 4 decimal places", () => {
  const mockDb = createMockDb({
    selectResults: {
      "MIN(created_at)": { firstTaskCreatedAt: null, lastTaskUpdatedAt: null },
      "cost_events": { totalActualCostUsd: 123.456789, averageActualCostUsdPerTask: 1.23456789, averageActualCostUsdPerSuccessfulTask: 2.99999999 },
    },
  });
  const healthService = createMockHealthService();
  const service = new MetricsService(mockDb, healthService);

  const summary = service.buildSummary();

  // Should be rounded to 4 decimal places
  assert.equal(summary.costMetrics.totalActualCostUsd, 123.4568);
  assert.equal(summary.costMetrics.averageActualCostUsdPerTask, 1.2346);
  assert.equal(summary.costMetrics.averageActualCostUsdPerSuccessfulTask, 3.0);
});

test("MetricsService - approval metrics calculation", () => {
  const mockDb = createMockDb({
    selectResults: {
      "MIN(created_at)": { firstTaskCreatedAt: null, lastTaskUpdatedAt: null },
      "COUNT(*) FROM approvals": { total: 50, pendingCount: 10, resolvedCount: 40, taskTriggerCount: 30 },
    },
  });
  const healthService = createMockHealthService();
  const service = new MetricsService(mockDb, healthService);

  const summary = service.buildSummary();

  assert.equal(summary.approvalMetrics.total, 50);
  assert.equal(summary.approvalMetrics.pendingCount, 10);
  assert.equal(summary.approvalMetrics.resolvedCount, 40);
  assert.equal(summary.approvalMetrics.taskTriggerCount, 30);
  // taskTriggerRate = taskTriggerCount / total = 30 / 50 = 0.6
  assert.equal(summary.approvalMetrics.taskTriggerRate, 0.6);
});

test("MetricsService - event metrics tier counts", () => {
  const mockDb = createMockDb({
    selectResults: {
      "MIN(created_at)": { firstTaskCreatedAt: null, lastTaskUpdatedAt: null },
      "COUNT(*) FROM events": { total: 1000, tier1Count: 500, tier2Count: 300, tier3Count: 200 },
    },
  });
  const healthService = createMockHealthService();
  const service = new MetricsService(mockDb, healthService);

  const summary = service.buildSummary();

  assert.equal(summary.eventMetrics.total, 1000);
  assert.equal(summary.eventMetrics.tier1Count, 500);
  assert.equal(summary.eventMetrics.tier2Count, 300);
  assert.equal(summary.eventMetrics.tier3Count, 200);
});

test("MetricsService - event consumer ack counts", () => {
  const mockDb = createMockDb({
    selectResults: {
      "MIN(created_at)": { firstTaskCreatedAt: null, lastTaskUpdatedAt: null },
      "events e": { total: 0, tier1Count: 0, tier2Count: 0, tier3Count: 0 },
      "event_consumer_acks": { pendingTier1AckCount: 15, failedTier1AckCount: 3 },
    },
  });
  const healthService = createMockHealthService();
  const service = new MetricsService(mockDb, healthService);

  const summary = service.buildSummary();

  assert.equal(summary.eventMetrics.pendingTier1AckCount, 15);
  assert.equal(summary.eventMetrics.failedTier1AckCount, 3);
});

test("MetricsService - runtime metrics from health service", () => {
  const mockDb = createMockDb();
  const mockStore = createMockStore();
  const customHealthService = new HealthService(mockDb, mockStore, {
    nowMsSupplier: () => Date.now(),
  });
  const service = new MetricsService(mockDb, customHealthService);

  const summary = service.buildSummary();

  assert.ok(typeof summary.runtimeMetrics.status === "string");
  assert.ok(typeof summary.runtimeMetrics.degradationMode === "string");
  assert.ok(typeof summary.runtimeMetrics.providerSuccessRate === "number");
  assert.ok(typeof summary.runtimeMetrics.activeExecutions === "number");
  assert.ok(typeof summary.runtimeMetrics.queuedTasks === "number");
  assert.ok(typeof summary.runtimeMetrics.memoryRssMb === "number");
  assert.ok(typeof summary.runtimeMetrics.tier1AckBacklog === "number");
  assert.ok(Array.isArray(summary.runtimeMetrics.findings));
});

test("MetricsService - taskTriggerRate is 0 when no tasks", () => {
  const mockDb = createMockDb({
    selectResults: {
      "MIN(created_at)": { firstTaskCreatedAt: null, lastTaskUpdatedAt: null },
      "COUNT(*) FROM tasks": { total: 0, terminalCount: 0, successCount: 0, failedCount: 0, cancelledCount: 0, activeCount: 0 },
      "COUNT(*) FROM approvals": { total: 0, pendingCount: 0, resolvedCount: 0, taskTriggerCount: 0 },
    },
  });
  const healthService = createMockHealthService();
  const service = new MetricsService(mockDb, healthService);

  const summary = service.buildSummary();

  assert.equal(summary.approvalMetrics.taskTriggerRate, 0);
});

test("MetricsService - window timestamps from tasks", () => {
  const mockDb = createMockDb({
    selectResults: {
      "MIN(created_at)": { firstTaskCreatedAt: "2026-05-01T00:00:00.000Z", lastTaskUpdatedAt: "2026-05-01T12:00:00.000Z" },
    },
  });
  const healthService = createMockHealthService();
  const service = new MetricsService(mockDb, healthService);

  const summary = service.buildSummary();

  assert.equal(summary.window.firstTaskCreatedAt, "2026-05-01T00:00:00.000Z");
  assert.equal(summary.window.lastTaskUpdatedAt, "2026-05-01T12:00:00.000Z");
});

test("MetricsService - window timestamps are null when no tasks", () => {
  const mockDb = createMockDb({
    selectResults: {
      "MIN(created_at)": { firstTaskCreatedAt: null, lastTaskUpdatedAt: null },
    },
  });
  const healthService = createMockHealthService();
  const service = new MetricsService(mockDb, healthService);

  const summary = service.buildSummary();

  assert.equal(summary.window.firstTaskCreatedAt, null);
  assert.equal(summary.window.lastTaskUpdatedAt, null);
});
