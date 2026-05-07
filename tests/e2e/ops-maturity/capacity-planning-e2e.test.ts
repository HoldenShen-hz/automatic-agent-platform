/**
 * E2E Capacity Planning Tests
 *
 * End-to-end tests covering capacity planning service:
 * 1. Capacity planning calculations
 * 2. Forecasting future resource needs
 * 3. Resource simulation scenarios
 * 4. Trend analysis
 *
 * Uses node:test + node:assert/strict. ESM imports with .js extensions.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../../helpers/e2e-harness.js";
import { CapacityPlanningService } from "../../../src/ops-maturity/capacity-planner/capacity-planning-service.js";
import { TrendAnalyzer } from "../../../src/ops-maturity/capacity-planner/trend-analyzer/index.js";
import type { CapacitySnapshot, ForecastRequest, ResourceAllocation } from "../../../src/ops-maturity/capacity-planner/types.js";

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function createCapacitySnapshot(overrides: Partial<CapacitySnapshot> = {}): CapacitySnapshot {
  return {
    timestamp: overrides.timestamp ?? new Date().toISOString(),
    divisionId: overrides.divisionId ?? "devops",
    activeTasks: overrides.activeTasks ?? 10,
    queuedTasks: overrides.queuedTasks ?? 5,
    activeExecutions: overrides.activeExecutions ?? 8,
    workerCount: overrides.workerCount ?? 4,
    avgLatencyMs: overrides.avgLatencyMs ?? 500,
    successRate: overrides.successRate ?? 0.98,
    resourceUtilization: overrides.resourceUtilization ?? 0.65,
    ...overrides,
  };
}

function createForecastRequest(overrides: Partial<ForecastRequest> = {}): ForecastRequest {
  return {
    divisionId: overrides.divisionId ?? "devops",
    horizonHours: overrides.horizonHours ?? 24,
    currentSnapshot: overrides.currentSnapshot ?? createCapacitySnapshot(),
    historicalSnapshots: overrides.historicalSnapshots ?? [],
    confidenceLevel: overrides.confidenceLevel ?? 0.95,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test Suite 1: Capacity Planning Service
// ---------------------------------------------------------------------------

test("E2E Capacity: CapacityPlanningService calculates current utilization", async () => {
  const harness = createE2EHarness("aa-e2e-capacity-");
  try {
    const service = new CapacityPlanningService();

    const snapshot = createCapacitySnapshot({
      activeTasks: 20,
      workerCount: 8,
      resourceUtilization: 0.75,
    });

    const analysis = service.analyzeUtilization(snapshot);

    assert.ok(analysis, "Should return utilization analysis");
    assert.ok(typeof analysis.utilizationPercent === "number", "Should have utilization percentage");
    assert.ok(analysis.recommendations, "Should have recommendations");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 2: Forecasting
// ---------------------------------------------------------------------------

test("E2E Capacity: Service forecasts resource needs for horizon period", async () => {
  const harness = createE2EHarness("aa-e2e-capacity-forecast-");
  try {
    const service = new CapacityPlanningService();

    // Historical snapshots for trend analysis
    const historical: CapacitySnapshot[] = [
      createCapacitySnapshot({ timestamp: "2026-05-01T00:00:00Z", activeTasks: 15 }),
      createCapacitySnapshot({ timestamp: "2026-05-01T06:00:00Z", activeTasks: 18 }),
      createCapacitySnapshot({ timestamp: "2026-05-01T12:00:00Z", activeTasks: 22 }),
    ];

    const request = createForecastRequest({
      horizonHours: 24,
      historicalSnapshots: historical,
    });

    const forecast = service.forecast(request);

    assert.ok(forecast, "Should return forecast");
    assert.ok(forecast.predictedDemand, "Should have predicted demand");
    assert.ok(forecast.confidenceInterval, "Should have confidence interval");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 3: Trend Analysis
// ---------------------------------------------------------------------------

test("E2E Capacity: TrendAnalyzer identifies patterns in historical data", async () => {
  const harness = createE2EHarness("aa-e2e-trend-");
  try {
    const analyzer = new TrendAnalyzer();

    const snapshots: CapacitySnapshot[] = [
      createCapacitySnapshot({ timestamp: "2026-05-01T00:00:00Z", activeTasks: 10, queuedTasks: 2 }),
      createCapacitySnapshot({ timestamp: "2026-05-01T04:00:00Z", activeTasks: 12, queuedTasks: 3 }),
      createCapacitySnapshot({ timestamp: "2026-05-01T08:00:00Z", activeTasks: 15, queuedTasks: 4 }),
      createCapacitySnapshot({ timestamp: "2026-05-01T12:00:00Z", activeTasks: 18, queuedTasks: 5 }),
    ];

    const trends = analyzer.analyzeTrends(snapshots);

    assert.ok(trends, "Should return trend analysis");
    assert.ok(Array.isArray(trends.patterns), "Should have patterns");
    assert.ok(trends.growthRate, "Should identify growth rate");
  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test Suite 4: Resource Allocation
// ---------------------------------------------------------------------------

test("E2E Capacity: Service recommends resource allocation adjustments", async () => {
  const harness = createE2EHarness("aa-e2e-alloc-");
  try {
    const service = new CapacityPlanningService();

    const snapshot = createCapacitySnapshot({
      activeTasks: 50,
      workerCount: 8,
      avgLatencyMs: 2000,
      resourceUtilization: 0.95,
    });

    const allocation = service.calculateAllocation(snapshot);

    assert.ok(allocation, "Should return allocation recommendation");
    assert.ok(typeof allocation.currentWorkers === "number", "Should have current workers");
    assert.ok(typeof allocation.recommendedWorkers === "number", "Should have recommended workers");
  } finally {
    harness.cleanup();
  }
});
