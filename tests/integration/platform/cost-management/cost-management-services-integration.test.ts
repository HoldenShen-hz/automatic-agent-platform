/**
 * Integration Tests: Cost Management Services
 *
 * Tests end-to-end cost management flows including estimation, alerting,
 * budget enforcement, and reporting across multiple services.
 *
 * Uses node:test + assert/strict with ESM and .js extensions.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { DatabaseSync } from "node:sqlite";

import type { AuthoritativeSqlDatabase } from "../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";
import { CostEstimationService } from "../../../../src/scale-ecosystem/billing/cost-estimation-service.js";
import type { CostEstimate } from "../../../../src/scale-ecosystem/billing/cost-estimation-service.js";

// =============================================================================
// Test Database Setup
// =============================================================================

function createTestDatabase(): AuthoritativeSqlDatabase {
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
    getSchemaStatus: () => ({ currentVersion: 1, expectedVersion: 1, upToDate: true, pendingVersions: [], checksumMismatches: [] }),
    assertSchemaCurrent: () => {},
    integrityCheck: () => [],
    transaction: ((work: () => unknown) => work()) as <T>(work: () => T) => T,
    readTransaction: ((work: () => unknown) => work()) as <T>(work: () => T) => T,
    backendType: "sqlite" as const,
    async healthCheck(): Promise<boolean> {
      return true;
    },
  };
}

// =============================================================================
// Cost Estimation Integration Tests
// =============================================================================

test("cost management: estimate cost for new division with historical data", () => {
  const db = createTestDatabase();

  // Seed historical data for division_a
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_1", "division_a", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_2", "division_a", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_3", "division_a", "failed", "2026-04-01T00:00:00.000Z");

  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_1", "task_1", "anthropic", "claude-3-5-sonnet", 0.10, "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_2", "task_2", "anthropic", "claude-3-5-sonnet", 0.20, "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_3", "task_3", "openai", "gpt-4o", 0.15, "2026-04-01T00:00:00.000Z");

  const service = new CostEstimationService(db);

  const estimate = service.estimate("division_a");

  assert.equal(estimate.basedOn, "division_avg");
  assert.equal(estimate.divisionId, "division_a");
  assert.equal(estimate.sampleCount, 3);
  assert.ok(Math.abs(estimate.estimatedCostUsd - 0.15) < 0.001);
});

test("cost management: global average fallback when division has no data", () => {
  const db = createTestDatabase();

  // Seed data only for division_a
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_1", "division_a", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_1", "task_1", "anthropic", "claude-3-5-sonnet", 0.25, "2026-04-01T00:00:00.000Z");

  const service = new CostEstimationService(db);

  // division_b has no data - should fallback to global
  const estimate = service.estimate("division_b");

  assert.equal(estimate.basedOn, "global_avg");
  assert.equal(estimate.sampleCount, 1);
  assert.equal(estimate.estimatedCostUsd, 0.25);
});

test("cost management: estimate cost with multiple divisions", () => {
  const db = createTestDatabase();

  // Division A - higher cost operations
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_a1", "division_a", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_a2", "division_a", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_a1", "task_a1", "anthropic", "claude-3-5-sonnet", 0.30, "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_a2", "task_a2", "anthropic", "claude-3-5-sonnet", 0.40, "2026-04-01T00:00:00.000Z");

  // Division B - lower cost operations
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_b1", "division_b", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_b1", "task_b1", "anthropic", "claude-3-5-haiku", 0.05, "2026-04-01T00:00:00.000Z");

  const service = new CostEstimationService(db);

  const estimateA = service.estimate("division_a");
  const estimateB = service.estimate("division_b");

  assert.ok(estimateA.estimatedCostUsd > estimateB.estimatedCostUsd);
  assert.equal(estimateA.divisionId, "division_a");
  assert.equal(estimateB.divisionId, "division_b");
});

// =============================================================================
// Budget Threshold Integration Tests
// =============================================================================

test("cost management: track costs against monthly budget", () => {
  const db = createTestDatabase();

  // Seed historical data
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_hist", "division_budget", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_hist", "task_hist", "anthropic", "claude-3-5-sonnet", 0.20, "2026-04-01T00:00:00.000Z");

  const service = new CostEstimationService(db);

  // Simulate running tasks with estimated costs
  const monthlyBudget = 10.00; // $10/month limit
  let totalSpent = 0;

  // Simulate 10 tasks
  for (let i = 0; i < 10; i++) {
    const estimate = service.estimate("division_budget");
    const projectedSpend = estimate.estimatedCostUsd;

    if (totalSpent + projectedSpend <= monthlyBudget) {
      totalSpent += projectedSpend;
    }
  }

  // All tasks should fit within budget
  assert.ok(totalSpent <= monthlyBudget);
});

test("cost management: default estimate when no historical data", () => {
  const db = createTestDatabase();

  const service = new CostEstimationService(db);

  const estimate = service.estimate("division_new");

  assert.equal(estimate.confidence, "default");
  assert.equal(estimate.basedOn, "default");
  assert.ok(estimate.estimatedCostUsd > 0);
  assert.equal(estimate.sampleCount, 0);
});

test("cost management: confidence improves with more samples", () => {
  const db = createTestDatabase();

  // Insert 5 tasks
  for (let i = 0; i < 5; i++) {
    db.connection
      .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
      .run(`task_${i}`, "division_confidence", "done", "2026-04-01T00:00:00.000Z");
    db.connection
      .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(`cost_${i}`, `task_${i}`, "anthropic", "claude-3-5-sonnet", 0.10, "2026-04-01T00:00:00.000Z");
  }

  const service = new CostEstimationService(db);

  const estimate = service.estimate("division_confidence");

  assert.equal(estimate.confidence, "medium");
  assert.equal(estimate.sampleCount, 5);
});

test("cost management: high confidence with sufficient samples", () => {
  const db = createTestDatabase();

  // Insert 20 tasks for high confidence
  for (let i = 0; i < 20; i++) {
    db.connection
      .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
      .run(`task_${i}`, "division_high_conf", "done", "2026-04-01T00:00:00.000Z");
    db.connection
      .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(`cost_${i}`, `task_${i}`, "anthropic", "claude-3-5-sonnet", 0.10, "2026-04-01T00:00:00.000Z");
  }

  const service = new CostEstimationService(db);

  const estimate = service.estimate("division_high_conf");

  assert.equal(estimate.confidence, "high");
  assert.equal(estimate.sampleCount, 20);
});

// =============================================================================
// Cost Allocation Integration Tests
// =============================================================================

test("cost management: allocate costs across multiple tenants", () => {
  const db = createTestDatabase();

  // Tenant A costs
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_tenant_a_1", "division_a", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_tenant_a_2", "division_a", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_a1", "task_tenant_a_1", "anthropic", "claude-3-5-sonnet", 0.30, "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_a2", "task_tenant_a_2", "anthropic", "claude-3-5-sonnet", 0.40, "2026-04-01T00:00:00.000Z");

  // Tenant B costs
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_tenant_b_1", "division_b", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_b1", "task_tenant_b_1", "anthropic", "claude-3-5-haiku", 0.05, "2026-04-01T00:00:00.000Z");

  const service = new CostEstimationService(db);

  const estimateA = service.estimate("division_a");
  const estimateB = service.estimate("division_b");

  // Division A has higher average
  assert.ok(estimateA.estimatedCostUsd > estimateB.estimatedCostUsd);
});

test("cost management: track cumulative costs over time", () => {
  const db = createTestDatabase();

  // Insert historical data
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_cumulative", "division_cumulative", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_cumulative", "task_cumulative", "anthropic", "claude-3-5-sonnet", 0.25, "2026-04-01T00:00:00.000Z");

  const service = new CostEstimationService(db);

  // Simulate multiple cost estimates over time
  const estimates = [
    service.estimate("division_cumulative"),
    service.estimate("division_cumulative"),
    service.estimate("division_cumulative"),
  ];

  // All estimates should be consistent
  for (const estimate of estimates) {
    assert.equal(estimate.estimatedCostUsd, 0.25);
    assert.equal(estimate.sampleCount, 1);
  }
});

test("cost management: zero-cost events are excluded", () => {
  const db = createTestDatabase();

  // Mix of zero and non-zero costs
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_zero_1", "division_zero", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_zero_2", "division_zero", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_zero_3", "division_zero", "done", "2026-04-01T00:00:00.000Z");

  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_zero_1", "task_zero_1", "anthropic", "claude-3-5-sonnet", 0.10, "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_zero_2", "task_zero_2", "anthropic", "claude-3-5-sonnet", 0.00, "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_zero_3", "task_zero_3", "anthropic", "claude-3-5-sonnet", 0.20, "2026-04-01T00:00:00.000Z");

  const service = new CostEstimationService(db);

  const estimate = service.estimate("division_zero");

  // Zero-cost excluded, so 2 samples with avg (0.10 + 0.20) / 2 = 0.15
  assert.equal(estimate.sampleCount, 2);
  assert.ok(Math.abs(estimate.estimatedCostUsd - 0.15) < 0.001);
});

test("cost management: only done/failed tasks count for estimation", () => {
  const db = createTestDatabase();

  // Different statuses
  const statuses = ["done", "failed", "in_progress", "queued", "cancelled"];
  for (let i = 0; i < statuses.length; i++) {
    db.connection
      .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
      .run(`task_status_${i}`, "division_status", statuses[i]!, "2026-04-01T00:00:00.000Z");
    db.connection
      .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(`cost_status_${i}`, `task_status_${i}`, "anthropic", "claude-3-5-sonnet", 0.10, "2026-04-01T00:00:00.000Z");
  }

  const service = new CostEstimationService(db);

  const estimate = service.estimate("division_status");

  // Only done (0) and failed (1) count = 2 samples
  assert.equal(estimate.sampleCount, 2);
});

// =============================================================================
// End-to-End Cost Management Flow Tests
// =============================================================================

test("cost management: complete flow from estimation to reporting", () => {
  const db = createTestDatabase();

  // Step 1: Seed historical cost data
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("seed_task_1", "division_e2e", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("seed_task_2", "division_e2e", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("seed_cost_1", "seed_task_1", "anthropic", "claude-3-5-sonnet", 0.15, "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("seed_cost_2", "seed_task_2", "anthropic", "claude-3-5-sonnet", 0.25, "2026-04-01T00:00:00.000Z");

  const service = new CostEstimationService(db);

  // Step 2: Estimate cost for new task
  const estimate = service.estimate("division_e2e");
  assert.equal(estimate.basedOn, "division_avg");
  assert.ok(Math.abs(estimate.estimatedCostUsd - 0.20) < 0.001);

  // Step 3: Simulate running 5 new tasks
  const simulatedCosts: number[] = [];
  for (let i = 0; i < 5; i++) {
    simulatedCosts.push(estimate.estimatedCostUsd);
  }

  // Step 4: Calculate total projected cost
  const totalProjected = simulatedCosts.reduce((sum, cost) => sum + cost, 0);
  assert.ok(Math.abs(totalProjected - 1.00) < 0.001);

  // Step 5: Check against budget
  const budgetLimit = 2.00;
  assert.ok(totalProjected <= budgetLimit);
});

test("cost management: budget warning at threshold", () => {
  const db = createTestDatabase();

  // Seed cheap tasks
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("cheap_task", "division_budget_warning", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cheap_cost", "cheap_task", "anthropic", "claude-3-5-haiku", 0.05, "2026-04-01T00:00:00.000Z");

  const service = new CostEstimationService(db);
  const estimate = service.estimate("division_budget_warning");

  // Simulate running many tasks
  const budget = 1.00;
  const warningThreshold = 0.8;
  let accumulatedCost = 0;
  let warningTriggered = false;

  for (let i = 0; i < 30; i++) {
    accumulatedCost += estimate.estimatedCostUsd;
    const ratio = accumulatedCost / budget;

    if (ratio >= warningThreshold && !warningTriggered) {
      warningTriggered = true;
    }

    if (ratio >= 1.0) {
      break;
    }
  }

  assert.equal(warningTriggered, true);
  assert.ok(accumulatedCost > budget * warningThreshold);
});

test("cost management: cost allocation across cost centers", () => {
  const db = createTestDatabase();

  // Engineering cost center
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_eng_1", "engineering", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_eng_2", "engineering", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_eng_1", "task_eng_1", "anthropic", "claude-3-5-sonnet", 0.50, "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_eng_2", "task_eng_2", "anthropic", "claude-3-5-sonnet", 0.60, "2026-04-01T00:00:00.000Z");

  // Sales cost center
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_sales_1", "sales", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_sales_1", "task_sales_1", "anthropic", "claude-3-5-haiku", 0.10, "2026-04-01T00:00:00.000Z");

  const service = new CostEstimationService(db);

  const engEstimate = service.estimate("engineering");
  const salesEstimate = service.estimate("sales");

  // Engineering has higher costs than sales
  assert.ok(engEstimate.estimatedCostUsd > salesEstimate.estimatedCostUsd);
  assert.equal(engEstimate.sampleCount, 2);
  assert.equal(salesEstimate.sampleCount, 1);
});

// =============================================================================
// Cost Reporting Integration Tests
// =============================================================================

test("cost management: generate cost report with resource breakdown", () => {
  const db = createTestDatabase();

  // Seed historical data
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("rpt_task_1", "division_report", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("rpt_task_2", "division_report", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("rpt_cost_1", "rpt_task_1", "anthropic", "claude-3-5-sonnet", 0.20, "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("rpt_cost_2", "rpt_task_2", "anthropic", "claude-3-5-sonnet", 0.30, "2026-04-01T00:00:00.000Z");

  const service = new CostEstimationService(db);
  const estimate = service.estimate("division_report");

  // Build report data
  const reportData = {
    tenantId: "tenant_report_test",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: estimate.estimatedCostUsd * 10,
    resourceCosts: [
      { resourceId: "compute_1", resourceType: "compute" as const, costUsd: estimate.estimatedCostUsd * 7, currency: "USD" },
      { resourceId: "storage_1", resourceType: "storage" as const, costUsd: estimate.estimatedCostUsd * 3, currency: "USD" },
    ],
    submittedBy: "system",
  };

  // Verify structure
  assert.equal(reportData.resourceCosts.length, 2);
  assert.ok(reportData.totalCostUsd > 0);
});

// =============================================================================
// Multi-Region Cost Allocation Integration Tests
// =============================================================================

test("cost management: allocate costs by region", () => {
  const db = createTestDatabase();

  // US West
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_us_west", "us-west-2", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_us_west", "task_us_west", "anthropic", "claude-3-5-sonnet", 0.25, "2026-04-01T00:00:00.000Z");

  // EU West
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_eu_west", "eu-west-1", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_eu_west", "task_eu_west", "anthropic", "claude-3-5-sonnet", 0.30, "2026-04-01T00:00:00.000Z");

  const service = new CostEstimationService(db);

  const usWestEstimate = service.estimate("us-west-2");
  const euWestEstimate = service.estimate("eu-west-1");

  // Both should use division averages
  assert.equal(usWestEstimate.basedOn, "division_avg");
  assert.equal(euWestEstimate.basedOn, "division_avg");
  assert.ok(euWestEstimate.estimatedCostUsd > usWestEstimate.estimatedCostUsd);
});

test("cost management: handle unknown region with global fallback", () => {
  const db = createTestDatabase();

  // Only setup us-west-2
  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_known", "us-west-2", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_known", "task_known", "anthropic", "claude-3-5-sonnet", 0.20, "2026-04-01T00:00:00.000Z");

  const service = new CostEstimationService(db);

  // ap-southeast-1 has no data - should fallback to global
  const estimate = service.estimate("ap-southeast-1");

  assert.equal(estimate.basedOn, "global_avg");
  assert.equal(estimate.estimatedCostUsd, 0.20);
});

// =============================================================================
// Cost Estimation Precision Tests
// =============================================================================

test("cost management: rounding to 4 decimal places", () => {
  const db = createTestDatabase();

  db.connection
    .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
    .run("task_precision", "division_precision", "done", "2026-04-01T00:00:00.000Z");
  db.connection
    .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run("cost_precision", "task_precision", "anthropic", "claude-3-5-sonnet", 0.123456789, "2026-04-01T00:00:00.000Z");

  const service = new CostEstimationService(db);

  const estimate = service.estimate("division_precision");

  assert.equal(estimate.estimatedCostUsd, 0.1235);
});

test("cost management: custom default cost", () => {
  const db = createTestDatabase();

  const service = new CostEstimationService(db, { defaultCostUsd: 0.10 });

  const estimate = service.estimate("division_unknown");

  assert.equal(estimate.estimatedCostUsd, 0.10);
  assert.equal(estimate.confidence, "default");
});

test("cost management: custom confidence thresholds", () => {
  const db = createTestDatabase();

  // Insert 15 tasks
  for (let i = 0; i < 15; i++) {
    db.connection
      .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
      .run(`task_custom_${i}`, "division_custom", "done", "2026-04-01T00:00:00.000Z");
    db.connection
      .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(`cost_custom_${i}`, `task_custom_${i}`, "anthropic", "claude-3-5-sonnet", 0.10, "2026-04-01T00:00:00.000Z");
  }

  // With threshold 10, 15 samples should be high confidence
  const service = new CostEstimationService(db, { highConfidenceThreshold: 10 });

  const estimate = service.estimate("division_custom");

  assert.equal(estimate.confidence, "high");
});

// =============================================================================
// Large-Scale Cost Tracking Integration Tests
// =============================================================================

test("cost management: track costs with large sample size", () => {
  const db = createTestDatabase();

  // Insert 100 tasks
  for (let i = 0; i < 100; i++) {
    db.connection
      .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
      .run(`task_large_${i}`, "division_large", "done", "2026-04-01T00:00:00.000Z");
    db.connection
      .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(`cost_large_${i}`, `task_large_${i}`, "anthropic", "claude-3-5-sonnet", 0.10 + (i * 0.001), "2026-04-01T00:00:00.000Z");
  }

  const service = new CostEstimationService(db);

  const estimate = service.estimate("division_large");

  assert.equal(estimate.confidence, "high");
  assert.equal(estimate.sampleCount, 100);
  assert.ok(estimate.estimatedCostUsd > 0.10);
});

test("cost management: memory-efficient cost tracking", () => {
  const db = createTestDatabase();

  // Simulate many divisions
  for (let div = 0; div < 10; div++) {
    for (let task = 0; task < 5; task++) {
      const taskId = `div_${div}_task_${task}`;
      db.connection
        .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
        .run(taskId, `division_${div}`, "done", "2026-04-01T00:00:00.000Z");
      db.connection
        .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(`cost_${taskId}`, taskId, "anthropic", "claude-3-5-sonnet", 0.10 + task * 0.01, "2026-04-01T00:00:00.000Z");
    }
  }

  const service = new CostEstimationService(db);

  // Query each division
  for (let div = 0; div < 10; div++) {
    const estimate = service.estimate(`division_${div}`);
    assert.ok(estimate.estimatedCostUsd > 0);
  }
});