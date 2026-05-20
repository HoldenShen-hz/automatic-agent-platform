/**
 * Unit Tests: Cost Management Service
 *
 * Tests for cost tracking, aggregation, budget threshold checking,
 * cost allocation by division/task, and cost reporting.
 *
 * Uses node:test + assert/strict with ESM and .js extensions.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { DatabaseSync } from "node:sqlite";

import type { AuthoritativeSqlDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";

// Re-export cost estimation from platform cost-management module
import {
  CostEstimationService,
  type CostEstimate,
  type CostEstimationConfig,
} from "../../../../src/platform/cost-management/index.js";

// Import CostAlertService and types
import { CostAlertService } from "../../../../src/platform/five-plane-control-plane/cost-alert/cost-alert-service.js";
import type {
  BudgetPolicy,
  BudgetScope,
  CostAlertConfig,
  CostAlertLevel,
} from "../../../../src/platform/five-plane-control-plane/cost-alert/cost-alert-types.js";

// Import CostReportService
import { CostReportService } from "../../../../src/platform/five-plane-interface/api/cost-report-service.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/**
 * Creates an in-memory database with the necessary schema for cost estimation.
 */
function createTestDb(): AuthoritativeSqlDatabase {
  const db = new DatabaseSync(":memory:");

  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      division_id TEXT,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS cost_events (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      session_id TEXT,
      execution_id TEXT,
      agent_id TEXT,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INTEGER NOT NULL DEFAULT 0,
      output_tokens INTEGER NOT NULL DEFAULT 0,
      cost_usd REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `);

  return {
    filePath: ":memory:",
    connection: db as Pick<DatabaseSync, "exec" | "prepare">,
    migrate: () => {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    getSchemaStatus: (): any => ({ currentVersion: 1, expectedVersion: 1, upToDate: true, pendingVersions: [], checksumMismatches: [] }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assertSchemaCurrent: (): any => {},
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    integrityCheck: (): any => [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transaction: ((work: () => unknown) => work()) as any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    readTransaction: ((work: () => unknown) => work()) as any,
    backendType: "sqlite" as const,
    async healthCheck(): Promise<boolean> {
      return true;
    },
  };
}

/**
 * Creates a mock task store for testing CostAlertService.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockTaskStore(): AuthoritativeTaskStore {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockEvent: any = {
    conn: {},
    insertEvent: () => ({ success: true }),
    insertEventDeadLetter: () => ({}),
    listEventDeadLetters: () => [],
    listEventsByType: () => [],
    listEventsForTask: () => [],
    getEvent: () => null,
    insertEventConsumerAck: () => ({}),
    markEventAck: () => ({}),
    markEventDeadLettered: () => ({}),
    getEventConsumerAck: () => null,
    getRequiredConsumerIds: () => [],
    ackAllConsumersForEvent: () => ({}),
    ensureEventConsumerAckPending: () => ({}),
    listPendingEventsForConsumer: () => [],
    listFailedEventsForConsumer: () => [],
    resetConsumerReplayState: () => 0,
    listDispatchDecisionTracesByTask: () => [],
    listDispatchDecisionTracesByExecution: () => [],
    listTier1EventRegistryCoverage: () => [],
    getTier1AuditIntegrityReport: () => ({}),
    bootstrapTier1AuditIntegrityRecords: () => ({}),
    listPendingTier1Acks: () => [],
    countPendingTier1Acks: () => 0,
    countFailedTier1Acks: () => 0,
    createTier1StatusEvent: () => ({}),
    listAllEvents: () => [],
  };

  return {
    task: {
      insertTask: async () => ({ success: true }),
      getTask: () => undefined,
      listTasks: () => [],
      updateTaskStatus: async () => ({ success: true, updated: 1 }),
    },
    artifact: {
      insertArtifact: () => ({ success: true }),
      getArtifact: () => null,
      listArtifactsByTask: async () => [],
    },
    checkpoint: {
      insertCheckpoint: async () => ({ success: true }),
      getCheckpoint: async () => null,
    },
    event: mockEvent,
    auditLog: {
      insertAuditLog: async () => ({ success: true }),
      getAuditLogs: async () => [],
    },
  } as any;
}

// ---------------------------------------------------------------------------
// Cost Tracking and Aggregation Tests
// ---------------------------------------------------------------------------

test("CostEstimationService returns default estimate when no historical data exists", () => {
  const db = createTestDb();
  const service = new CostEstimationService(db);

  const result = service.estimate();

  assert.equal(result.confidence, "default");
  assert.equal(result.sampleCount, 0);
  assert.equal(result.basedOn, "default");
  assert.equal(result.divisionId, null);
  assert.ok(result.estimatedCostUsd > 0, "Should return default cost");
});

test("CostEstimationService aggregates costs by division", () => {
  const db = createTestDb();

  // Insert tasks with done status for division_a
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_1", "division_a", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_2", "division_a", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_3", "division_a", "failed", "2026-04-01T00:00:00.000Z");

  // Insert cost events - $0.10, $0.20, $0.15 = avg $0.15
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_1", "task_1", "anthropic", "claude-3", 0.10, "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_2", "task_2", "anthropic", "claude-3", 0.20, "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_3", "task_3", "openai", "gpt-4", 0.15, "2026-04-01T00:00:00.000Z");

  const service = new CostEstimationService(db);

  const result = service.estimate("division_a");

  assert.equal(result.basedOn, "division_avg");
  assert.equal(result.divisionId, "division_a");
  assert.equal(result.sampleCount, 3);
  assert.ok(Math.abs(result.estimatedCostUsd - 0.15) < 0.001, "Should return division average");
});

test("CostEstimationService calculates global average across all divisions", () => {
  const db = createTestDb();

  // Insert tasks across different divisions
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_1", "division_a", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_2", "division_b", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_3", "division_c", "done", "2026-04-01T00:00:00.000Z");

  // Insert cost events - $0.10, $0.20, $0.30 = avg $0.20
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_1", "task_1", "anthropic", "claude-3", 0.10, "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_2", "task_2", "openai", "gpt-4", 0.20, "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_3", "task_3", "anthropic", "claude-3", 0.30, "2026-04-01T00:00:00.000Z");

  const service = new CostEstimationService(db);

  // Estimate without division should use global average
  const result = service.estimate();

  assert.equal(result.basedOn, "global_avg");
  assert.equal(result.divisionId, null);
  assert.equal(result.sampleCount, 3);
  assert.ok(Math.abs(result.estimatedCostUsd - 0.20) < 0.001, "Should return global average");
});

test("CostEstimationService ignores zero-cost events in aggregation", () => {
  const db = createTestDb();

  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_1", "division_test", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_2", "division_test", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_3", "division_test", "done", "2026-04-01T00:00:00.000Z");

  // One zero cost event
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_1", "task_1", "anthropic", "claude-3", 0.10, "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_2", "task_2", "openai", "gpt-4", 0.00, "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_3", "task_3", "anthropic", "claude-3", 0.20, "2026-04-01T00:00:00.000Z");

  const service = new CostEstimationService(db);

  const result = service.estimate("division_test");

  // Zero-cost excluded, so 2 samples with avg (0.10 + 0.20) / 2 = 0.15
  assert.equal(result.sampleCount, 2);
  assert.ok(Math.abs(result.estimatedCostUsd - 0.15) < 0.001);
});

// ---------------------------------------------------------------------------
// Budget Threshold Checking Tests
// ---------------------------------------------------------------------------

test("CostAlertService evaluates cost within warning threshold", () => {
  const db = createTestDb();
  const store = createMockTaskStore();

  const budgetPolicy: BudgetPolicy = {
    scope: "tenant" as BudgetScope,
    scopeId: "tenant_1",
    limitCostUsd: 100,
    period: "monthly",
    warningThreshold: 0.8,
    actionsOnWarning: [],
    actionsOnBreach: [],
  };

  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: { tenant_1: budgetPolicy },
  };

  const service = new CostAlertService(db, store, config);

  const result = service.evaluateCost({
    scope: "tenant",
    scopeId: "tenant_1",
    projectedCostUsd: 50, // 50% of limit - below warning threshold
    tenantId: "tenant_1",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.alertLevel, "ok");
  assert.equal(result.thresholdRatio, 0.5);
});

test("CostAlertService triggers warning at threshold crossing", () => {
  const db = createTestDb();
  const store = createMockTaskStore();

  const budgetPolicy: BudgetPolicy = {
    scope: "tenant" as BudgetScope,
    scopeId: "tenant_1",
    limitCostUsd: 100,
    period: "monthly",
    warningThreshold: 0.8,
    actionsOnWarning: [],
    actionsOnBreach: [],
  };

  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: { tenant_1: budgetPolicy },
  };

  const service = new CostAlertService(db, store, config);

  // Projecting cost at exactly warning threshold (80%)
  const result = service.evaluateCost({
    scope: "tenant",
    scopeId: "tenant_1",
    projectedCostUsd: 80, // 80% of limit - at warning threshold
    tenantId: "tenant_1",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.alertLevel, "warning");
  assert.equal(result.thresholdRatio, 0.8);
});

test("CostAlertService blocks cost at exceeded threshold", () => {
  const db = createTestDb();
  const store = createMockTaskStore();

  const budgetPolicy: BudgetPolicy = {
    scope: "tenant" as BudgetScope,
    scopeId: "tenant_1",
    limitCostUsd: 100,
    period: "monthly",
    warningThreshold: 0.8,
    actionsOnWarning: [],
    actionsOnBreach: [],
  };

  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: { tenant_1: budgetPolicy },
  };

  const service = new CostAlertService(db, store, config);

  // Projecting cost at 100% of limit
  const result = service.evaluateCost({
    scope: "tenant",
    scopeId: "tenant_1",
    projectedCostUsd: 100,
    tenantId: "tenant_1",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.alertLevel, "exceeded");
  assert.equal(result.thresholdRatio, 1.0);
});

test("CostAlertService emits event when threshold exceeded", () => {
  const db = createTestDb();
  const store = createMockTaskStore();

  const budgetPolicy: BudgetPolicy = {
    scope: "tenant" as BudgetScope,
    scopeId: "tenant_1",
    limitCostUsd: 100,
    period: "monthly",
    warningThreshold: 0.8,
    actionsOnWarning: [],
    actionsOnBreach: [],
  };

  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: { tenant_1: budgetPolicy },
  };

  const service = new CostAlertService(db, store, config);

  let eventEmitted = false;
  service.on("cost.threshold.exceeded", () => {
    eventEmitted = true;
  });

  // Record cost that exceeds limit
  service.recordCost({
    scope: "tenant",
    scopeId: "tenant_1",
    actualCostUsd: 100,
    tenantId: "tenant_1",
    taskId: "task_1",
  });

  assert.equal(eventEmitted, true);
});

test("CostAlertService allows cost with no policy configured", () => {
  const db = createTestDb();
  const store = createMockTaskStore();

  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {},
  };

  const service = new CostAlertService(db, store, config);

  const result = service.evaluateCost({
    scope: "tenant",
    scopeId: "tenant_with_no_policy",
    projectedCostUsd: 1000,
    tenantId: "tenant_with_no_policy",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.alertLevel, "ok");
});

test("CostAlertService respects custom warning threshold", () => {
  const db = createTestDb();
  const store = createMockTaskStore();

  const budgetPolicy: BudgetPolicy = {
    scope: "tenant" as BudgetScope,
    scopeId: "tenant_1",
    limitCostUsd: 100,
    period: "monthly",
    warningThreshold: 0.5, // 50% warning threshold
    actionsOnWarning: [],
    actionsOnBreach: [],
  };

  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: { tenant_1: budgetPolicy },
  };

  const service = new CostAlertService(db, store, config);

  // At 40% - should be ok
  const result1 = service.evaluateCost({
    scope: "tenant",
    scopeId: "tenant_1",
    projectedCostUsd: 40,
    tenantId: "tenant_1",
  });

  assert.equal(result1.alertLevel, "ok");

  // Re-evaluate on a fresh service so the warning-threshold check is isolated
  // from pending budget reservations made by the first allowed evaluation.
  const service2 = new CostAlertService(createTestDb(), createMockTaskStore(), config);
  const result2 = service2.evaluateCost({
    scope: "tenant",
    scopeId: "tenant_1",
    projectedCostUsd: 55,
    tenantId: "tenant_1",
  });

  assert.equal(result2.alertLevel, "warning");
  assert.equal(result2.thresholdRatio, 0.55);
});

// ---------------------------------------------------------------------------
// Cost Allocation by Division/Task Tests
// ---------------------------------------------------------------------------

test("CostEstimationService uses division-specific average for cost allocation", () => {
  const db = createTestDb();

  // Division A with higher costs
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_1", "division_a", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_2", "division_a", "done", "2026-04-01T00:00:00.000Z");

  // Division B with lower costs
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_3", "division_b", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_4", "division_b", "done", "2026-04-01T00:00:00.000Z");

  // Division A: $0.20, $0.30 = avg $0.25
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_1", "task_1", "anthropic", "claude-3", 0.20, "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_2", "task_2", "anthropic", "claude-3", 0.30, "2026-04-01T00:00:00.000Z");

  // Division B: $0.05, $0.10 = avg $0.075
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_3", "task_3", "anthropic", "claude-3", 0.05, "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_4", "task_4", "anthropic", "claude-3", 0.10, "2026-04-01T00:00:00.000Z");

  const service = new CostEstimationService(db);

  const estimateA = service.estimate("division_a");
  const estimateB = service.estimate("division_b");

  assert.ok(estimateA.estimatedCostUsd > estimateB.estimatedCostUsd, "Division A should have higher estimated cost");
  assert.equal(estimateA.divisionId, "division_a");
  assert.equal(estimateB.divisionId, "division_b");
});

test("CostEstimationService falls back to global when division has no data", () => {
  const db = createTestDb();

  // Only division_a has data
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_1", "division_a", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_1", "task_1", "anthropic", "claude-3", 0.15, "2026-04-01T00:00:00.000Z");

  const service = new CostEstimationService(db);

  // Division B has no data - should fall back to global
  const result = service.estimate("division_b");

  assert.equal(result.basedOn, "global_avg");
  assert.equal(result.sampleCount, 1);
});

test("CostEstimationService only includes done/failed tasks in allocation", () => {
  const db = createTestDb();

  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_1", "division_test", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_2", "division_test", "failed", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_3", "division_test", "in_progress", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_4", "division_test", "queued", "2026-04-01T00:00:00.000Z");

  for (let i = 1; i <= 4; i++) {
    db.connection
      .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(`cost_${i}`, `task_${i}`, "anthropic", "claude-3", 0.10, "2026-04-01T00:00:00.000Z");
  }

  const service = new CostEstimationService(db);

  const result = service.estimate("division_test");

  // Only done and failed count - 2 samples
  assert.equal(result.sampleCount, 2);
});

test("CostAlertService tracks costs per scope for allocation", () => {
  const db = createTestDb();
  const store = createMockTaskStore();

  const budgetPolicy: BudgetPolicy = {
    scope: "platform" as BudgetScope,
    scopeId: "platform",
    limitCostUsd: 1000,
    period: "monthly",
    warningThreshold: 0.8,
    actionsOnWarning: [],
    actionsOnBreach: [],
  };

  const config: Partial<CostAlertConfig> = {
    enabled: true,
    platformBudgetPolicy: budgetPolicy,
  };

  const service = new CostAlertService(db, store, config);

  // Record costs for different scopes
  service.recordCost({
    scope: "platform",
    scopeId: "platform",
    actualCostUsd: 100,
    tenantId: "tenant_1",
    taskId: "task_1",
  });

  service.recordCost({
    scope: "platform",
    scopeId: "platform",
    actualCostUsd: 150,
    tenantId: "tenant_2",
    taskId: "task_2",
  });

  const accumulator = service.getAccumulator("platform", "platform");

  assert.ok(accumulator != null, "Accumulator should exist");
  assert.equal(accumulator?.accumulatedCostUsd, 250, "Should track total platform cost");
});

// ---------------------------------------------------------------------------
// Cost Reporting Tests
// ---------------------------------------------------------------------------

test("CostReportService creates cost reports with resource breakdown", () => {
  const service = new CostReportService();

  const report = service.createReport({
    tenantId: "tenant_1",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 150.50,
    currency: "USD",
    resourceCosts: [
      { resourceId: "compute_1", resourceType: "compute", costUsd: 100.00, currency: "USD" },
      { resourceId: "storage_1", resourceType: "storage", costUsd: 30.50, currency: "USD" },
      { resourceId: "api_1", resourceType: "api", costUsd: 20.00, currency: "USD" },
    ],
    submittedBy: "admin",
  });

  assert.match(report.reportId, /^cost_report_[0-9a-f-]+$/, "Should have valid ID");
  assert.equal(report.tenantId, "tenant_1");
  assert.equal(report.totalCostUsd, 150.50);
  assert.equal(report.resourceCount, 3);
  assert.equal(report.currency, "USD");
  assert.ok(report.createdAt.length > 0);
});

test("CostReportService lists reports by tenant", () => {
  const service = new CostReportService();

  // Create reports for different tenants
  service.createReport({
    tenantId: "tenant_1",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 100,
    resourceCosts: [],
    submittedBy: "admin",
  });

  service.createReport({
    tenantId: "tenant_1",
    periodStart: "2026-03-01T00:00:00.000Z",
    periodEnd: "2026-03-31T23:59:59.999Z",
    totalCostUsd: 80,
    resourceCosts: [],
    submittedBy: "admin",
  });

  service.createReport({
    tenantId: "tenant_2",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 200,
    resourceCosts: [],
    submittedBy: "admin",
  });

  const tenant1Reports = service.listReports(50, "tenant_1");
  const allReports = service.listReports(50, null);

  assert.equal(tenant1Reports.length, 2);
  assert.equal(allReports.length, 3);
});

test("CostReportService generates budget summaries", () => {
  const service = new CostReportService();

  // Create multiple reports for same tenant
  service.createReport({
    tenantId: "tenant_1",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-15T23:59:59.999Z",
    totalCostUsd: 50,
    currency: "USD",
    resourceCosts: [],
    submittedBy: "admin",
    submittedAt: "2026-04-15T12:00:00.000Z",
  });

  service.createReport({
    tenantId: "tenant_1",
    periodStart: "2026-04-16T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 75,
    currency: "USD",
    resourceCosts: [],
    submittedBy: "admin",
    submittedAt: "2026-04-30T12:00:00.000Z",
  });

  const summaries = service.listBudgetSummaries(50, "tenant_1");

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]!.totalCostUsd, 125); // 50 + 75
  assert.equal(summaries[0]!.reportCount, 2);
  assert.equal(summaries[0]!.currency, "USD");
});

test("CostReportService respects limit parameter", () => {
  const service = new CostReportService();

  // Create 5 reports
  for (let i = 0; i < 5; i++) {
    service.createReport({
      tenantId: null,
      periodStart: `2026-04-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
      periodEnd: `2026-04-${String(i + 1).padStart(2, "0")}T23:59:59.999Z`,
      totalCostUsd: 10 * (i + 1),
      resourceCosts: [],
      submittedBy: "admin",
      submittedAt: `2026-04-${String(i + 10).padStart(2, "0")}T12:00:00.000Z`,
    });
  }

  const limited = service.listReports(3, null);

  assert.equal(limited.length, 3);
});

test("CostReportService handles null tenantId for platform-wide reports", () => {
  const service = new CostReportService();

  service.createReport({
    tenantId: null, // Platform-wide
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 500,
    currency: "USD",
    resourceCosts: [],
    submittedBy: "system",
  });

  const platformReports = service.listReports(50, null);

  assert.ok(platformReports.length > 0);
  const platformReport = platformReports.find((r) => r.tenantId === null);
  assert.ok(platformReport != null, "Should have platform-wide report");
});

// ---------------------------------------------------------------------------
// Confidence Level Tests
// ---------------------------------------------------------------------------

test("CostEstimationService confidence is high with 20+ samples", () => {
  const db = createTestDb();

  for (let i = 0; i < 25; i++) {
    db.connection
      .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
      .run(`task_${i}`, "division_test", "done", "2026-04-01T00:00:00.000Z");
    db.connection
      .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(`cost_${i}`, `task_${i}`, "anthropic", "claude-3", 0.10, "2026-04-01T00:00:00.000Z");
  }

  const service = new CostEstimationService(db);

  const result = service.estimate("division_test");

  assert.equal(result.confidence, "high");
  assert.equal(result.sampleCount, 25);
});

test("CostEstimationService confidence is medium with 5-19 samples", () => {
  const db = createTestDb();

  for (let i = 0; i < 10; i++) {
    db.connection
      .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
      .run(`task_${i}`, "division_test", "done", "2026-04-01T00:00:00.000Z");
    db.connection
      .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(`cost_${i}`, `task_${i}`, "anthropic", "claude-3", 0.10, "2026-04-01T00:00:00.000Z");
  }

  const service = new CostEstimationService(db);

  const result = service.estimate("division_test");

  assert.equal(result.confidence, "medium");
  assert.equal(result.sampleCount, 10);
});

test("CostEstimationService confidence is low with 1-4 samples", () => {
  const db = createTestDb();

  for (let i = 0; i < 3; i++) {
    db.connection
      .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
      .run(`task_${i}`, "division_test", "done", "2026-04-01T00:00:00.000Z");
    db.connection
      .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(`cost_${i}`, `task_${i}`, "anthropic", "claude-3", 0.10, "2026-04-01T00:00:00.000Z");
  }

  const service = new CostEstimationService(db);

  const result = service.estimate("division_test");

  assert.equal(result.confidence, "low");
  assert.equal(result.sampleCount, 3);
});

test("CostEstimationService respects custom confidence thresholds", () => {
  const db = createTestDb();

  // 15 samples would be medium with default config
  for (let i = 0; i < 15; i++) {
    db.connection
      .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
      .run(`task_${i}`, "division_test", "done", "2026-04-01T00:00:00.000Z");
    db.connection
      .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(`cost_${i}`, `task_${i}`, "anthropic", "claude-3", 0.10, "2026-04-01T00:00:00.000Z");
  }

  // With highConfidenceThreshold=10, 15 samples should be high
  const service = new CostEstimationService(db, { highConfidenceThreshold: 10 });

  const result = service.estimate("division_test");

  assert.equal(result.confidence, "high");
});

// ---------------------------------------------------------------------------
// Cost Rounding Tests
// ---------------------------------------------------------------------------

test("CostEstimationService rounds cost to 4 decimal places", () => {
  const db = createTestDb();

  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_1", "division_test", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_1", "task_1", "anthropic", "claude-3", 0.123456789, "2026-04-01T00:00:00.000Z");

  const service = new CostEstimationService(db);

  const result = service.estimate("division_test");

  assert.equal(result.estimatedCostUsd, 0.1235);
});

// ---------------------------------------------------------------------------
// Type Validation Tests
// ---------------------------------------------------------------------------

test("CostEstimate type accepts valid structure", () => {
  const estimate: CostEstimate = {
    estimatedCostUsd: 0.15,
    confidence: "high",
    sampleCount: 25,
    divisionId: "division_a",
    basedOn: "division_avg",
  };

  assert.equal(estimate.estimatedCostUsd, 0.15);
  assert.equal(estimate.confidence, "high");
  assert.equal(estimate.divisionId, "division_a");
});

test("CostEstimationConfig type accepts all optional fields", () => {
  const config: CostEstimationConfig = {
    highConfidenceThreshold: 30,
    mediumConfidenceThreshold: 10,
    defaultCostUsd: 0.10,
  };

  assert.equal(config.highConfidenceThreshold, 30);
  assert.equal(config.mediumConfidenceThreshold, 10);
  assert.equal(config.defaultCostUsd, 0.10);
});

test("CostEstimate accepts null divisionId", () => {
  const estimate: CostEstimate = {
    estimatedCostUsd: 0.05,
    confidence: "default",
    sampleCount: 0,
    divisionId: null,
    basedOn: "default",
  };

  assert.equal(estimate.divisionId, null);
});

test("CostEstimate confidence accepts all valid values", () => {
  const confidences: CostEstimate["confidence"][] = ["high", "medium", "low", "default"];
  assert.equal(confidences.length, 4);
});

test("CostEstimate basedOn accepts all valid values", () => {
  const basedOnValues: CostEstimate["basedOn"][] = ["division_avg", "global_avg", "default"];
  assert.equal(basedOnValues.length, 3);
});

// ---------------------------------------------------------------------------
// Integration Tests - End-to-End Cost Management Flow
// ---------------------------------------------------------------------------

test("Cost management flow: estimate then track then report", () => {
  const db = createTestDb();
  const store = createMockTaskStore();

  // Step 1: Estimate cost for new division
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("existing_task", "division_new", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("existing_cost", "existing_task", "anthropic", "claude-3", 0.25, "2026-04-01T00:00:00.000Z");

  const estimationService = new CostEstimationService(db);
  const estimate = estimationService.estimate("division_new");

  assert.equal(estimate.divisionId, "division_new");
  assert.ok(estimate.estimatedCostUsd > 0);

  // Step 2: Set up budget alert
  const budgetPolicy: BudgetPolicy = {
    scope: "tenant" as BudgetScope,
    scopeId: "new_tenant",
    limitCostUsd: 100,
    period: "monthly",
    warningThreshold: 0.8,
    actionsOnWarning: [],
    actionsOnBreach: [],
  };

  const alertService = new CostAlertService(db, store, {
    enabled: true,
    tenantBudgetPolicies: { new_tenant: budgetPolicy },
  });

  // Step 3: Create cost report
  const reportService = new CostReportService();
  const report = reportService.createReport({
    tenantId: "new_tenant",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: estimate.estimatedCostUsd * 10,
    resourceCosts: [
      {
        resourceId: "task_1",
        resourceType: "compute",
        costUsd: estimate.estimatedCostUsd * 10,
        currency: "USD",
      },
    ],
    submittedBy: "system",
  });

  assert.ok(report.reportId.length > 0);
  assert.equal(report.tenantId, "new_tenant");

  // Step 4: Verify reports can be listed
  const reports = reportService.listReports(50, "new_tenant");
  assert.equal(reports.length, 1);
});
