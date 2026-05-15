/**
 * Integration Tests: Cost Allocation
 *
 * Tests end-to-end cost allocation flows across divisions, tenants,
 * workflows, and resource types using real service integrations.
 *
 * Uses node:test + assert/strict with ESM and .js extensions.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { DatabaseSync } from "node:sqlite";

import type { AuthoritativeSqlDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import { CostEstimationService } from "../../../../src/scale-ecosystem/billing/cost-estimation-service.js";
import { CostReportService } from "../../../../src/platform/five-plane-interface/api/cost-report-service.js";
import { aggregateCostAttribution } from "../../../../src/ops-maturity/cost-optimizer/attribution-engine/index.js";
import {
  CostOptimizationService,
  type CostAttributionRecord,
} from "../../../../src/ops-maturity/cost-optimizer/cost-optimization-service.js";

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
// Cost Allocation by Division Tests
// =============================================================================

test("cost allocation: allocate by division with different cost profiles", () => {
  const db = createTestDatabase();

  // Engineering division - higher cost
  for (let i = 0; i < 5; i++) {
    db.connection
      .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
      .run(`eng_task_${i}`, "engineering", "done", "2026-04-01T00:00:00.000Z");
    db.connection
      .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(`eng_cost_${i}`, `eng_task_${i}`, "anthropic", "claude-3-5-sonnet", 0.30 + i * 0.05, "2026-04-01T00:00:00.000Z");
  }

  // Sales division - lower cost
  for (let i = 0; i < 3; i++) {
    db.connection
      .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
      .run(`sales_task_${i}`, "sales", "done", "2026-04-01T00:00:00.000Z");
    db.connection
      .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(`sales_cost_${i}`, `sales_task_${i}`, "anthropic", "claude-3-5-haiku", 0.08 + i * 0.01, "2026-04-01T00:00:00.000Z");
  }

  const service = new CostEstimationService(db);

  const engEstimate = service.estimate("engineering");
  const salesEstimate = service.estimate("sales");

  assert.ok(engEstimate.estimatedCostUsd > salesEstimate.estimatedCostUsd);
  assert.equal(engEstimate.sampleCount, 5);
  assert.equal(salesEstimate.sampleCount, 3);
});

test("cost allocation: division with zero cost tasks excluded", () => {
  const db = createTestDatabase();

  // Mix of zero and non-zero costs
  for (let i = 0; i < 4; i++) {
    db.connection
      .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
      .run(`mixed_task_${i}`, "division_mixed", "done", "2026-04-01T00:00:00.000Z");
    const cost = i % 2 === 0 ? 0.10 : 0.00; // 0.10, 0, 0.10, 0
    db.connection
      .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(`mixed_cost_${i}`, `mixed_task_${i}`, "anthropic", "claude-3-5-sonnet", cost, "2026-04-01T00:00:00.000Z");
  }

  const service = new CostEstimationService(db);
  const estimate = service.estimate("division_mixed");

  // Only 2 non-zero samples
  assert.equal(estimate.sampleCount, 2);
  assert.ok(Math.abs(estimate.estimatedCostUsd - 0.10) < 0.001);
});

test("cost allocation: aggregation across multiple divisions", () => {
  const db = createTestDatabase();

  const divisions = [
    { name: "division_alpha", tasks: 3, avgCost: 0.25 },
    { name: "division_beta", tasks: 4, avgCost: 0.15 },
    { name: "division_gamma", tasks: 2, avgCost: 0.40 },
  ];

  for (const div of divisions) {
    for (let i = 0; i < div.tasks; i++) {
      const taskId = `${div.name}_task_${i}`;
      db.connection
        .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
        .run(taskId, div.name, "done", "2026-04-01T00:00:00.000Z");
      db.connection
        .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(`${taskId}_cost`, taskId, "anthropic", "claude-3-5-sonnet", div.avgCost, "2026-04-01T00:00:00.000Z");
    }
  }

  const service = new CostEstimationService(db);
  const estimates = divisions.map((div) => service.estimate(div.name));

  // Verify each division has correct estimate
  for (let i = 0; i < divisions.length; i++) {
    assert.ok(Math.abs(estimates[i]!.estimatedCostUsd - divisions[i]!.avgCost) < 0.001);
  }
});

// =============================================================================
// Cost Allocation by Tenant Tests
// =============================================================================

test("cost allocation: track costs per tenant", () => {
  const db = createTestDatabase();

  // Tenant A
  for (let i = 0; i < 3; i++) {
    db.connection
      .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
      .run(`tenant_a_task_${i}`, "tenant_a_division", "done", "2026-04-01T00:00:00.000Z");
    db.connection
      .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(`tenant_a_cost_${i}`, `tenant_a_task_${i}`, "anthropic", "claude-3-5-sonnet", 0.50, "2026-04-01T00:00:00.000Z");
  }

  // Tenant B
  for (let i = 0; i < 2; i++) {
    db.connection
      .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
      .run(`tenant_b_task_${i}`, "tenant_b_division", "done", "2026-04-01T00:00:00.000Z");
    db.connection
      .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(`tenant_b_cost_${i}`, `tenant_b_task_${i}`, "anthropic", "claude-3-5-haiku", 0.10, "2026-04-01T00:00:00.000Z");
  }

  const service = new CostEstimationService(db);

  const tenantAEstimate = service.estimate("tenant_a_division");
  const tenantBEstimate = service.estimate("tenant_b_division");

  assert.ok(tenantAEstimate.estimatedCostUsd > tenantBEstimate.estimatedCostUsd);
  assert.equal(tenantAEstimate.sampleCount, 3);
  assert.equal(tenantBEstimate.sampleCount, 2);
});

test("cost allocation: multi-tenant isolation", () => {
  const db = createTestDatabase();

  // Multiple tenants, same division structure
  const tenants = ["tenant_x", "tenant_y", "tenant_z"];
  const costs = [0.30, 0.20, 0.40];

  for (let t = 0; t < tenants.length; t++) {
    const division = `${tenants[t]}_division`;
    for (let i = 0; i < 2; i++) {
      db.connection
        .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
        .run(`${tenants[t]}_task_${i}`, division, "done", "2026-04-01T00:00:00.000Z");
      db.connection
        .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(`${tenants[t]}_cost_${i}`, `${tenants[t]}_task_${i}`, "anthropic", "claude-3-5-sonnet", costs[t]!, "2026-04-01T00:00:00.000Z");
    }
  }

  const service = new CostEstimationService(db);

  const estimates = tenants.map((tenant) => service.estimate(`${tenant}_division`));

  // Verify tenant isolation
  for (let i = 0; i < tenants.length; i++) {
    const estimate = estimates[i]!;
    const cost = costs[i]!;
    assert.ok(Math.abs(estimate.estimatedCostUsd - cost) < 0.001);
  }

  // Verify cost ordering
  assert.ok(estimates[2]!.estimatedCostUsd > estimates[1]!.estimatedCostUsd);
  assert.ok(estimates[1]!.estimatedCostUsd > estimates[0]!.estimatedCostUsd);
});

// =============================================================================
// Cost Allocation by Workflow Tests
// =============================================================================

test("cost allocation: track costs by workflow using attribution", () => {
  const costService = new CostOptimizationService();

  // Simulate workflow with multiple steps
  const workflowSteps = [
    { stepId: "wf_1:step_1", cost: 10.00, type: "llm" as const },
    { stepId: "wf_1:step_2", cost: 5.00, type: "compute" as const },
    { stepId: "wf_1:step_3", cost: 2.50, type: "tool" as const },
    { stepId: "wf_2:step_1", cost: 15.00, type: "llm" as const },
    { stepId: "wf_2:step_2", cost: 8.00, type: "compute" as const },
  ];

  for (const step of workflowSteps) {
    costService.recordCost({
      subjectType: "workflow",
      subjectId: step.stepId,
      costType: step.type,
      amountUsd: step.cost,
      llmCostUsd: step.type === "llm" ? step.cost : 0,
      toolCostUsd: step.type === "tool" ? step.cost : 0,
      computeCostUsd: step.type === "compute" ? step.cost : 0,
      storageCostUsd: 0,
      egressCostUsd: 0,
      humanReviewCostUsd: 0,
      decisionRef: `decision_${step.stepId}`,
      capturedAt: "2026-04-29T00:00:00.000Z",
    });
  }

  const aggregated = costService.aggregate("workflow");

  // Verify workflow cost aggregation
  const wf1Step1 = aggregated["wf_1:step_1"];
  const wf2Step1 = aggregated["wf_2:step_1"];
  assert.ok(wf1Step1 != null && wf1Step1 > 0);
  assert.ok(wf2Step1 != null && wf2Step1 > wf1Step1);
});

test("cost allocation: workflow total calculation", () => {
  const costService = new CostOptimizationService();

  // Record costs for workflow tasks
  costService.recordCost({
    subjectType: "task",
    subjectId: "wf_alpha:task_1",
    costType: "total",
    amountUsd: 25.00,
    llmCostUsd: 20.00,
    toolCostUsd: 3.00,
    computeCostUsd: 2.00,
    storageCostUsd: 0,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    decisionRef: "decision_1",
    capturedAt: "2026-04-29T00:00:00.000Z",
  });

  costService.recordCost({
    subjectType: "task",
    subjectId: "wf_alpha:task_2",
    costType: "total",
    amountUsd: 35.00,
    llmCostUsd: 28.00,
    toolCostUsd: 4.00,
    computeCostUsd: 3.00,
    storageCostUsd: 0,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    decisionRef: "decision_2",
    capturedAt: "2026-04-29T00:00:00.000Z",
  });

  const aggregated = costService.aggregate();

  // Calculate workflow total
  const wfAlphaTotal = Object.entries(aggregated)
    .filter(([key]) => key.startsWith("wf_alpha:"))
    .reduce((sum, [, value]) => sum + value, 0);

  assert.equal(wfAlphaTotal, 60.00);
});

// =============================================================================
// Cost Allocation by Resource Type Tests
// =============================================================================

test("cost allocation: by resource type using attribution", () => {
  const costService = new CostOptimizationService();

  const resources = [
    { id: "task_llm", type: "llm" as const, cost: 50.00 },
    { id: "task_compute", type: "compute" as const, cost: 20.00 },
    { id: "task_storage", type: "storage" as const, cost: 5.00 },
    { id: "task_egress", type: "egress" as const, cost: 3.00 },
    { id: "task_human", type: "humanReview" as const, cost: 100.00 },
  ];

  for (const res of resources) {
    costService.recordCost({
      subjectType: "task",
      subjectId: res.id,
      costType: res.type,
      amountUsd: res.cost,
      llmCostUsd: res.type === "llm" ? res.cost : 0,
      toolCostUsd: 0,
      computeCostUsd: res.type === "compute" ? res.cost : 0,
      storageCostUsd: res.type === "storage" ? res.cost : 0,
      egressCostUsd: res.type === "egress" ? res.cost : 0,
      humanReviewCostUsd: res.type === "humanReview" ? res.cost : 0,
      decisionRef: `decision_${res.id}`,
      capturedAt: "2026-04-29T00:00:00.000Z",
    });
  }

  const aggregated = costService.aggregate();

  assert.equal(aggregated["task_llm"], 50.00);
  assert.equal(aggregated["task_compute"], 20.00);
  assert.equal(aggregated["task_storage"], 5.00);
  assert.equal(aggregated["task_egress"], 3.00);
  assert.equal(aggregated["task_human"], 100.00);
});

test("cost allocation: aggregate total by type", () => {
  const costService = new CostOptimizationService();

  // Multiple tasks of same type
  for (let i = 0; i < 5; i++) {
    costService.recordCost({
      subjectType: "task",
      subjectId: `llm_task_${i}`,
      costType: "llm",
      amountUsd: 10.00 * (i + 1),
      llmCostUsd: 10.00 * (i + 1),
      toolCostUsd: 0,
      computeCostUsd: 0,
      storageCostUsd: 0,
      egressCostUsd: 0,
      humanReviewCostUsd: 0,
      decisionRef: `decision_llm_${i}`,
      capturedAt: "2026-04-29T00:00:00.000Z",
    });
  }

  const aggregated = costService.aggregate("llm");

  // Sum of 10 + 20 + 30 + 40 + 50 = 150
  const totalLlmCost = Object.values(aggregated).reduce((sum, v) => sum + v, 0);
  assert.equal(totalLlmCost, 150.00);
});

// =============================================================================
// Cost Report Allocation Tests
// =============================================================================

test("cost allocation: generate reports by tenant", () => {
  const reportService = new CostReportService();

  // Create reports for different tenants
  const tenants = ["tenant_reports_1", "tenant_reports_2", "tenant_reports_3"];
  const costs = [150.00, 200.00, 75.00];

  for (let i = 0; i < tenants.length; i++) {
    const tenantId = tenants[i]!;
    const cost = costs[i]!;
    reportService.createReport({
      tenantId,
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-30T23:59:59.999Z",
      totalCostUsd: cost,
      currency: "USD",
      resourceCosts: [],
      submittedBy: "admin",
      submittedAt: "2026-04-15T12:00:00.000Z",
    });
  }

  // Verify reports
  const allReports = reportService.listReports(50, null);
  assert.equal(allReports.length, 3);

  // Verify filtering
  const tenant1Reports = reportService.listReports(50, tenants[0] ?? null);
  assert.equal(tenant1Reports.length, 1);
  assert.equal(tenant1Reports[0]!.totalCostUsd, 150.00);
});

test("cost allocation: budget summaries by tenant", () => {
  const reportService = new CostReportService();

  // Create multiple reports for same tenant
  reportService.createReport({
    tenantId: "tenant_summary",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-15T23:59:59.999Z",
    totalCostUsd: 100.00,
    currency: "USD",
    resourceCosts: [],
    submittedBy: "admin",
    submittedAt: "2026-04-10T12:00:00.000Z",
  });

  reportService.createReport({
    tenantId: "tenant_summary",
    periodStart: "2026-04-16T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 150.00,
    currency: "USD",
    resourceCosts: [],
    submittedBy: "admin",
    submittedAt: "2026-04-25T12:00:00.000Z",
  });

  const summaries = reportService.listBudgetSummaries(50, "tenant_summary");

  assert.equal(summaries.length, 1);
  assert.equal(summaries[0]!.totalCostUsd, 250.00);
  assert.equal(summaries[0]!.reportCount, 2);
});

test("cost allocation: platform-wide cost reporting", () => {
  const reportService = new CostReportService();

  reportService.createReport({
    tenantId: null, // Platform-wide
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 5000.00,
    currency: "USD",
    resourceCosts: [],
    submittedBy: "system",
  });

  reportService.createReport({
    tenantId: "tenant_platform_1",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 500.00,
    currency: "USD",
    resourceCosts: [],
    submittedBy: "admin",
  });

  const platformReports = reportService.listReports(50, null);
  const platformOnly = platformReports.filter((r) => r.tenantId === null);

  assert.ok(platformOnly.length > 0);
  assert.equal(platformOnly[0]!.totalCostUsd, 5000.00);
});

test("cost allocation: cost reports with resource breakdown", () => {
  const reportService = new CostReportService();

  reportService.createReport({
    tenantId: "tenant_resources",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.999Z",
    totalCostUsd: 350.00,
    currency: "USD",
    resourceCosts: [
      { resourceId: "compute_cluster_1", resourceType: "compute", costUsd: 200.00, currency: "USD" },
      { resourceId: "storage_bucket_1", resourceType: "storage", costUsd: 100.00, currency: "USD" },
      { resourceId: "api_gateway_1", resourceType: "api", costUsd: 50.00, currency: "USD" },
    ],
    submittedBy: "admin",
  });

  const reports = reportService.listReports(50, "tenant_resources");
  assert.equal(reports.length, 1);

  const report = reports[0]!;
  assert.equal(report.resourceCount, 3);
  assert.equal(report.totalCostUsd, 350.00);

  const computeCost = report.resourceCosts.find((r) => r.resourceType === "compute");
  assert.ok(computeCost != null);
  assert.equal(computeCost!.costUsd, 200.00);
});

// =============================================================================
// Cost Allocation Aggregation Tests
// =============================================================================

test("cost allocation: aggregateCostAttribution with multiple subjects", () => {
  const entries = [
    { subjectId: "division:eng", amountUsd: 500.00 },
    { subjectId: "division:eng", amountUsd: 300.00 },
    { subjectId: "division:eng", amountUsd: 200.00 },
    { subjectId: "division:sales", amountUsd: 400.00 },
    { subjectId: "division:sales", amountUsd: 100.00 },
  ];

  const result = aggregateCostAttribution(entries);

  assert.equal(result["division:eng"], 1000.00);
  assert.equal(result["division:sales"], 500.00);
});

test("cost allocation: aggregateCostAttribution with rounding", () => {
  const entries = [
    { subjectId: "task_rounding", amountUsd: 0.123456789 },
    { subjectId: "task_rounding", amountUsd: 0.123456789 },
    { subjectId: "task_rounding", amountUsd: 0.123456789 },
  ];

  const result = aggregateCostAttribution(entries);

  // 0.123456789 * 3 = 0.370370367 -> rounded to 0.3704
  assert.equal(result["task_rounding"], 0.3704);
});

test("cost allocation: calculate division cost share", () => {
  const entries = [
    { subjectId: "division:alpha", amountUsd: 1000.00 },
    { subjectId: "division:beta", amountUsd: 500.00 },
    { subjectId: "division:gamma", amountUsd: 250.00 },
  ];

  const result = aggregateCostAttribution(entries);

  const total = Object.values(result).reduce((sum, v) => sum + v, 0);
  assert.equal(total, 1750.00);

  // Alpha share: 1000/1750 = 57.14%
  const alphaShare = ((result["division:alpha"] ?? 0) / total) * 100;
  assert.ok(Math.abs(alphaShare - 57.14) < 0.1);
});

// =============================================================================
// Multi-Dimensional Cost Allocation Tests
// =============================================================================

test("cost allocation: tenant x division matrix", () => {
  const costService = new CostOptimizationService();

  // Tenant A - Division Alpha
  costService.recordCost({
    subjectType: "task",
    subjectId: "tenant_a:division_alpha:task_1",
    costType: "total",
    amountUsd: 100.00,
    llmCostUsd: 80.00,
    toolCostUsd: 10.00,
    computeCostUsd: 10.00,
    storageCostUsd: 0,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    decisionRef: "dec_1",
    capturedAt: "2026-04-29T00:00:00.000Z",
  });

  // Tenant A - Division Beta
  costService.recordCost({
    subjectType: "task",
    subjectId: "tenant_a:division_beta:task_1",
    costType: "total",
    amountUsd: 50.00,
    llmCostUsd: 40.00,
    toolCostUsd: 5.00,
    computeCostUsd: 5.00,
    storageCostUsd: 0,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    decisionRef: "dec_2",
    capturedAt: "2026-04-29T00:00:00.000Z",
  });

  // Tenant B - Division Alpha
  costService.recordCost({
    subjectType: "task",
    subjectId: "tenant_b:division_alpha:task_1",
    costType: "total",
    amountUsd: 75.00,
    llmCostUsd: 60.00,
    toolCostUsd: 8.00,
    computeCostUsd: 7.00,
    storageCostUsd: 0,
    egressCostUsd: 0,
    humanReviewCostUsd: 0,
    decisionRef: "dec_3",
    capturedAt: "2026-04-29T00:00:00.000Z",
  });

  const aggregated = costService.aggregate();

  // Verify multi-dimensional keys
  assert.equal(aggregated["tenant_a:division_alpha:task_1"], 100.00);
  assert.equal(aggregated["tenant_a:division_beta:task_1"], 50.00);
  assert.equal(aggregated["tenant_b:division_alpha:task_1"], 75.00);

  // Calculate tenant totals
  const tenantATotal = Object.entries(aggregated)
    .filter(([key]) => key.startsWith("tenant_a:"))
    .reduce((sum, [, value]) => sum + value, 0);

  assert.equal(tenantATotal, 150.00);

  // Calculate division totals
  const divisionAlphaTotal = Object.entries(aggregated)
    .filter(([key]) => key.includes("division_alpha"))
    .reduce((sum, [, value]) => sum + value, 0);

  assert.equal(divisionAlphaTotal, 175.00); // 100 + 75
});

test("cost allocation: workflow x step matrix", () => {
  const costService = new CostOptimizationService();

  const workflowSteps = [
    { wf: "workflow_a", step: "step_1", cost: 25.00 },
    { wf: "workflow_a", step: "step_2", cost: 15.00 },
    { wf: "workflow_a", step: "step_3", cost: 10.00 },
    { wf: "workflow_b", step: "step_1", cost: 40.00 },
    { wf: "workflow_b", step: "step_2", cost: 20.00 },
  ];

  for (const ws of workflowSteps) {
    costService.recordCost({
      subjectType: "workflow",
      subjectId: `${ws.wf}:${ws.step}`,
      costType: "total",
      amountUsd: ws.cost,
      llmCostUsd: ws.cost * 0.8,
      toolCostUsd: 0,
      computeCostUsd: ws.cost * 0.2,
      storageCostUsd: 0,
      egressCostUsd: 0,
      humanReviewCostUsd: 0,
      decisionRef: `dec_${ws.wf}_${ws.step}`,
      capturedAt: "2026-04-29T00:00:00.000Z",
    });
  }

  const aggregated = costService.aggregate("workflow");

  // Step totals across workflows
  const step1Total = Object.entries(aggregated)
    .filter(([key]) => key.includes("step_1"))
    .reduce((sum, [, value]) => sum + value, 0);

  assert.equal(step1Total, 65.00); // 25 + 40

  // Workflow totals
  const workflowATotal = Object.entries(aggregated)
    .filter(([key]) => key.startsWith("workflow_a:"))
    .reduce((sum, [, value]) => sum + value, 0);

  assert.equal(workflowATotal, 50.00); // 25 + 15 + 10
});

// =============================================================================
// Cost Allocation Reporting Tests
// =============================================================================

test("cost allocation: generate allocation report by division", () => {
  const reportService = new CostReportService();

  // Create reports for different divisions (using tenant as proxy)
  const divisions = [
    { name: "engineering", cost: 1500.00 },
    { name: "sales", cost: 800.00 },
    { name: "marketing", cost: 400.00 },
  ];

  for (const div of divisions) {
    reportService.createReport({
      tenantId: `division:${div.name}`,
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-30T23:59:59.999Z",
      totalCostUsd: div.cost,
      currency: "USD",
      resourceCosts: [],
      submittedBy: "system",
    });
  }

  const allReports = reportService.listReports(50, null);

  // Calculate division totals
  const divisionCosts: Record<string, number> = {};
  for (const report of allReports) {
    if (report.tenantId?.startsWith("division:")) {
      const divName = report.tenantId.replace("division:", "");
      divisionCosts[divName] = (divisionCosts[divName] ?? 0) + report.totalCostUsd;
    }
  }

  assert.equal(divisionCosts["engineering"], 1500.00);
  assert.equal(divisionCosts["sales"], 800.00);
  assert.equal(divisionCosts["marketing"], 400.00);
});

test("cost allocation: track cost per task accurately", () => {
  const db = createTestDatabase();

  // Create tasks with varying costs
  const taskCosts = [0.10, 0.15, 0.20, 0.25, 0.30];
  for (let i = 0; i < taskCosts.length; i++) {
    db.connection
      .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
      .run(`task_acc_${i}`, "division_acc", "done", "2026-04-01T00:00:00.000Z");
    db.connection
      .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(`cost_acc_${i}`, `task_acc_${i}`, "anthropic", "claude-3-5-sonnet", taskCosts[i]!, "2026-04-01T00:00:00.000Z");
  }

  const service = new CostEstimationService(db);
  const estimate = service.estimate("division_acc");

  // Average of all task costs
  const expectedAvg = taskCosts.reduce((sum, cost) => sum + cost, 0) / taskCosts.length;
  assert.ok(Math.abs(estimate.estimatedCostUsd - expectedAvg) < 0.001);
});

// =============================================================================
// End-to-End Cost Allocation Flow Tests
// =============================================================================

test("cost allocation: complete flow from task to report", () => {
  const db = createTestDatabase();
  const reportService = new CostReportService();

  // Step 1: Create historical data
  const divisions = ["division_e2e_a", "division_e2e_b"];
  const avgCosts = [0.25, 0.15];

  for (let d = 0; d < divisions.length; d++) {
    for (let i = 0; i < 5; i++) {
      const taskId = `e2e_${divisions[d]}_task_${i}`;
      db.connection
        .prepare("INSERT INTO tasks (id, division_id, status, created_at) VALUES (?, ?, ?, ?)")
        .run(taskId, divisions[d]!, "done", "2026-04-01T00:00:00.000Z");
      db.connection
        .prepare("INSERT INTO cost_events (id, task_id, provider, model, cost_usd, created_at) VALUES (?, ?, ?, ?, ?, ?)")
        .run(`e2e_cost_${d}_${i}`, taskId, "anthropic", "claude-3-5-sonnet", avgCosts[d]!, "2026-04-01T00:00:00.000Z");
    }
  }

  // Step 2: Estimate costs for new divisions
  const service = new CostEstimationService(db);
  const estimates = divisions.map((div) => service.estimate(div));

  // Step 3: Simulate running tasks and accumulate costs
  const simulatedTasksPerDivision = [10, 15];
  const totalCosts: number[] = [];

  for (let d = 0; d < divisions.length; d++) {
    const estimate = estimates[d]!;
    const numTasks = simulatedTasksPerDivision[d]!;
    const total = estimate.estimatedCostUsd * numTasks;
    totalCosts.push(total);
  }

  // Step 4: Generate allocation report
  for (let d = 0; d < divisions.length; d++) {
    const totalCost = totalCosts[d]!;
    const division = divisions[d]!;
    reportService.createReport({
      tenantId: division,
      periodStart: "2026-04-01T00:00:00.000Z",
      periodEnd: "2026-04-30T23:59:59.999Z",
      totalCostUsd: totalCost,
      currency: "USD",
      resourceCosts: [
        {
          resourceId: `tasks_${division}`,
          resourceType: "compute",
          costUsd: totalCost,
          currency: "USD",
        },
      ],
      submittedBy: "system",
    });
  }

  // Step 5: Verify allocation
  const reports = reportService.listReports(50, null);
  assert.equal(reports.length, 2);

  // Division A: 0.25 * 10 = 2.50
  // Division B: 0.15 * 15 = 2.25
  const reportA = reports.find((r) => r.tenantId === "division_e2e_a");
  const reportB = reports.find((r) => r.tenantId === "division_e2e_b");

  assert.ok(reportA != null);
  assert.ok(reportB != null);
  assert.ok(Math.abs(reportA!.totalCostUsd - 2.50) < 0.01);
  assert.ok(Math.abs(reportB!.totalCostUsd - 2.25) < 0.01);
});

test("cost allocation: handle sparse allocation efficiently", () => {
  const costService = new CostOptimizationService();

  // Many subjects with sparse allocations
  const subjects = Array.from({ length: 100 }, (_, i) => `sparse_subject_${i}`);
  const costs = subjects.map((_, i) => (i % 10 === 0 ? 10.00 : 0.01));

  for (let i = 0; i < subjects.length; i++) {
    costService.recordCost({
      subjectType: "task",
      subjectId: subjects[i]!,
      costType: "total",
      amountUsd: costs[i]!,
      llmCostUsd: costs[i]!,
      toolCostUsd: 0,
      computeCostUsd: 0,
      storageCostUsd: 0,
      egressCostUsd: 0,
      humanReviewCostUsd: 0,
      decisionRef: `dec_sparse_${i}`,
      capturedAt: "2026-04-29T00:00:00.000Z",
    });
  }

  const aggregated = costService.aggregate("task");

  assert.equal(Object.keys(aggregated).length, 100);

  // Verify high-cost items
  const highCostItems = Object.entries(aggregated).filter(([, v]) => v >= 10.00);
  assert.equal(highCostItems.length, 10); // Every 10th item
});