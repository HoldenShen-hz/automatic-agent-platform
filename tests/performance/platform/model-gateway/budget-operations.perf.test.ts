/**
 * Budget Operations Performance Tests
 *
 * Tests performance characteristics of budget operations:
 * - BudgetGuard evaluation latency
 * - ChargebackService report generation latency
 * - Execution chain budget reservation throughput
 */

import assert from "node:assert/strict";
import test from "node:test";

import { BudgetGuard } from "../../../../src/platform/model-gateway/cost-tracker/budget-guard.js";
import { ChargebackService } from "../../../../src/platform/model-gateway/cost-tracker/chargeback-service.js";

// ============================================================================
// Mock Cost Report Source
// ============================================================================

interface MockCostReport {
  reportId: string;
  tenantId: string | null;
  periodStart: string;
  periodEnd: string;
  totalCostUsd: number;
  currency: string;
  resourceCosts: Array<{
    resourceId: string;
    resourceType: string;
    costUsd: number;
    currency: string;
    metadata?: Record<string, unknown>;
  }>;
  resourceCount: number;
  submittedBy: string;
  submittedAt: string;
  createdAt: string;
}

function createMockReportSource(reports: MockCostReport[]) {
  return {
    listReports: () => reports,
  };
}

// ============================================================================
// BudgetGuard Performance Tests
// ============================================================================

test("BudgetGuard evaluateTaskSpend performance: single evaluation", () => {
  const guard = new BudgetGuard();
  const policy = {
    maxTaskCostUsd: 100,
    maxPackCostUsd: 500,
    maxPlatformCostUsd: 5000,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    warnAtRatio: 0.8,
    mode: "supervised" as const,
    maxModelTokens: 100000,
    maxSteps: 50,
    maxDurationMs: 600000,
  };

  const start = performance.now();
  guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 30,
    nextEstimatedCostUsd: 20,
  });
  const end = performance.now();

  // Single evaluation should be fast (< 1ms)
  const latencyMs = end - start;
  assert.ok(latencyMs < 10, `Single evaluation took ${latencyMs}ms, expected < 10ms`);
});

test("BudgetGuard evaluateTaskSpend performance: 1000 evaluations", () => {
  const guard = new BudgetGuard();
  const policy = {
    maxTaskCostUsd: 100,
    maxPackCostUsd: 500,
    maxPlatformCostUsd: 5000,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    warnAtRatio: 0.8,
    mode: "supervised" as const,
    maxModelTokens: 100000,
    maxSteps: 50,
    maxDurationMs: 600000,
  };

  const iterations = 1000;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    guard.evaluateTaskSpend({
      policy,
      currentTaskCostUsd: i % 100,
      nextEstimatedCostUsd: 10,
    });
  }
  const end = performance.now();

  const totalMs = end - start;
  const avgMs = totalMs / iterations;

  // Average per evaluation should be very fast
  assert.ok(avgMs < 1, `Average evaluation took ${avgMs}ms, expected < 1ms`);
});

test("BudgetGuard evaluateExecutionChain performance: single cascade evaluation", () => {
  const guard = new BudgetGuard();
  const policy = {
    maxTaskCostUsd: 100,
    maxPackCostUsd: 500,
    maxPlatformCostUsd: 5000,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    warnAtRatio: 0.8,
    mode: "supervised" as const,
    maxModelTokens: 100000,
    maxSteps: 50,
    maxDurationMs: 600000,
  };
  const spend = {
    currentTaskCostUsd: 30,
    nextEstimatedCostUsd: 20,
    currentPackCostUsd: 200,
    currentPlatformCostUsd: 1000,
    currentDailyCostUsd: 500,
    currentMonthlyCostUsd: 2000,
  };

  const start = performance.now();
  guard.evaluateExecutionChain({ policy, spend });
  const end = performance.now();

  const latencyMs = end - start;
  assert.ok(latencyMs < 10, `Cascade evaluation took ${latencyMs}ms, expected < 10ms`);
});

test("BudgetGuard evaluateExecutionChain performance: 1000 cascade evaluations", () => {
  const guard = new BudgetGuard();
  const policy = {
    maxTaskCostUsd: 100,
    maxPackCostUsd: 500,
    maxPlatformCostUsd: 5000,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    warnAtRatio: 0.8,
    mode: "supervised" as const,
    maxModelTokens: 100000,
    maxSteps: 50,
    maxDurationMs: 600000,
  };

  const iterations = 1000;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    guard.evaluateExecutionChain({
      policy,
      spend: {
        currentTaskCostUsd: i % 100,
        nextEstimatedCostUsd: 10,
        currentPackCostUsd: (i * 5) % 500,
        currentPlatformCostUsd: (i * 10) % 5000,
        currentDailyCostUsd: (i * 2) % 1000,
        currentMonthlyCostUsd: (i * 20) % 10000,
      },
    });
  }
  const end = performance.now();

  const totalMs = end - start;
  const avgMs = totalMs / iterations;

  // Average per cascade evaluation should be fast
  assert.ok(avgMs < 2, `Average cascade evaluation took ${avgMs}ms, expected < 2ms`);
});

test("BudgetGuard reserveExecutionChainBudget performance: single reservation", () => {
  const guard = new BudgetGuard();
  const policy = {
    maxTaskCostUsd: 100,
    maxPackCostUsd: 500,
    maxPlatformCostUsd: 5000,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    warnAtRatio: 0.8,
    mode: "supervised" as const,
    maxModelTokens: 100000,
    maxSteps: 50,
    maxDurationMs: 600000,
  };

  const start = performance.now();
  guard.reserveExecutionChainBudget({
    policy,
    spend: {
      currentTaskCostUsd: 0,
      nextEstimatedCostUsd: 25,
      currentPackCostUsd: 0,
      currentPlatformCostUsd: 0,
      currentDailyCostUsd: 0,
      currentMonthlyCostUsd: 0,
    },
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    traceId: "trace-1",
    emittedBy: "test",
  });
  const end = performance.now();

  const latencyMs = end - start;
  assert.ok(latencyMs < 50, `Single reservation took ${latencyMs}ms, expected < 50ms`);
});

test("BudgetGuard reserveExecutionChainBudget performance: 100 reservations", () => {
  const guard = new BudgetGuard();
  const policy = {
    maxTaskCostUsd: 100,
    maxPackCostUsd: 500,
    maxPlatformCostUsd: 5000,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    warnAtRatio: 0.8,
    mode: "supervised" as const,
    maxModelTokens: 100000,
    maxSteps: 50,
    maxDurationMs: 600000,
  };

  const iterations = 100;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    guard.reserveExecutionChainBudget({
      policy,
      spend: {
        currentTaskCostUsd: 0,
        nextEstimatedCostUsd: 10 + (i % 20),
        currentPackCostUsd: 0,
        currentPlatformCostUsd: 0,
        currentDailyCostUsd: 0,
        currentMonthlyCostUsd: 0,
      },
      tenantId: "tenant-1",
      harnessRunId: `run-${i}`,
      traceId: `trace-${i}`,
      emittedBy: "test",
    });
  }
  const end = performance.now();

  const totalMs = end - start;
  const avgMs = totalMs / iterations;

  assert.ok(avgMs < 50, `Average reservation took ${avgMs}ms, expected < 50ms`);
});

// ============================================================================
// ChargebackService Performance Tests
// ============================================================================

test("ChargebackService buildReport performance: 100 reports", () => {
  const reports: MockCostReport[] = Array.from({ length: 100 }, (_, i) => ({
    reportId: `r${i}`,
    tenantId: "tenant-1",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-01T23:59:59.000Z",
    totalCostUsd: 10 + (i % 50),
    currency: "USD",
    resourceCosts: Array.from({ length: 5 }, (_, j) => ({
      resourceId: `resource:${i}:${j}`,
      resourceType: j % 2 === 0 ? "api" : "compute",
      costUsd: 1 + (i + j) % 10,
      currency: "USD",
    })),
    resourceCount: 5,
    submittedBy: "operator",
    submittedAt: "2026-04-01T12:00:00.000Z",
    createdAt: "2026-04-01T12:00:00.000Z",
  }));

  const service = new ChargebackService(createMockReportSource(reports));

  const start = performance.now();
  const report = service.buildReport({ tenantId: "tenant-1" });
  const end = performance.now();

  const latencyMs = end - start;

  // 100 reports with 500 resources should process quickly
  assert.ok(latencyMs < 100, `100 reports took ${latencyMs}ms, expected < 100ms`);
  assert.equal(report.reportCount, 100);
  assert.ok(report.allocations.length > 0);
});

test("ChargebackService buildReport performance: 500 reports", () => {
  const reports: MockCostReport[] = Array.from({ length: 500 }, (_, i) => ({
    reportId: `r${i}`,
    tenantId: "tenant-1",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-01T23:59:59.000Z",
    totalCostUsd: 10 + (i % 100),
    currency: "USD",
    resourceCosts: Array.from({ length: 3 }, (_, j) => ({
      resourceId: `resource:${i}:${j}`,
      resourceType: j % 2 === 0 ? "api" : "compute",
      costUsd: 1 + (i + j) % 20,
      currency: "USD",
    })),
    resourceCount: 3,
    submittedBy: "operator",
    submittedAt: "2026-04-01T12:00:00.000Z",
    createdAt: "2026-04-01T12:00:00.000Z",
  }));

  const service = new ChargebackService(createMockReportSource(reports));

  const start = performance.now();
  const report = service.buildReport({ tenantId: "tenant-1" });
  const end = performance.now();

  const latencyMs = end - start;

  // 500 reports with 1500 resources should still be fast
  assert.ok(latencyMs < 200, `500 reports took ${latencyMs}ms, expected < 200ms`);
  assert.equal(report.reportCount, 500);
});

test("ChargebackService buildReport performance: empty reports", () => {
  const service = new ChargebackService(createMockReportSource([]));

  const start = performance.now();
  const report = service.buildReport();
  const end = performance.now();

  const latencyMs = end - start;

  assert.ok(latencyMs < 10, `Empty reports took ${latencyMs}ms, expected < 10ms`);
  assert.equal(report.totalCostUsd, 0);
  assert.equal(report.allocations.length, 0);
});

test("ChargebackService buildReport performance: many small reports", () => {
  // Many small reports (1 resource each)
  const reports: MockCostReport[] = Array.from({ length: 1000 }, (_, i) => ({
    reportId: `r${i}`,
    tenantId: "tenant-1",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-01T23:59:59.000Z",
    totalCostUsd: 1,
    currency: "USD",
    resourceCosts: [
      { resourceId: `api:${i}`, resourceType: "api", costUsd: 1, currency: "USD" },
    ],
    resourceCount: 1,
    submittedBy: "operator",
    submittedAt: "2026-04-01T12:00:00.000Z",
    createdAt: "2026-04-01T12:00:00.000Z",
  }));

  const service = new ChargebackService(createMockReportSource(reports));

  const start = performance.now();
  const report = service.buildReport({ tenantId: "tenant-1" });
  const end = performance.now();

  const latencyMs = end - start;

  // 1000 single-resource reports should aggregate quickly
  assert.ok(latencyMs < 300, `1000 small reports took ${latencyMs}ms, expected < 300ms`);
  assert.equal(report.reportCount, 1000);
});

// ============================================================================
// Memory Usage Tests
// ============================================================================

test("BudgetGuard memory: Multiple evaluations don't leak", () => {
  const guard = new BudgetGuard();
  const policy = {
    maxTaskCostUsd: 100,
    maxPackCostUsd: 500,
    maxPlatformCostUsd: 5000,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    warnAtRatio: 0.8,
    mode: "supervised" as const,
    maxModelTokens: 100000,
    maxSteps: 50,
    maxDurationMs: 600000,
  };

  // Run many evaluations
  for (let i = 0; i < 10000; i++) {
    guard.evaluateTaskSpend({
      policy,
      currentTaskCostUsd: i % 100,
      nextEstimatedCostUsd: 10,
    });
  }

  // If we get here without OOM, test passes
  const result = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 50,
    nextEstimatedCostUsd: 10,
  });

  assert.equal(result.allowed, true);
});

test("ChargebackService memory: Large report set doesn't leak", () => {
  const reports: MockCostReport[] = Array.from({ length: 500 }, (_, i) => ({
    reportId: `r${i}`,
    tenantId: "tenant-1",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-01T23:59:59.000Z",
    totalCostUsd: 10 + (i % 100),
    currency: "USD",
    resourceCosts: Array.from({ length: 5 }, (_, j) => ({
      resourceId: `resource:${i}:${j}`,
      resourceType: j % 2 === 0 ? "api" : "compute",
      costUsd: 1 + (i + j) % 20,
      currency: "USD",
    })),
    resourceCount: 5,
    submittedBy: "operator",
    submittedAt: "2026-04-01T12:00:00.000Z",
    createdAt: "2026-04-01T12:00:00.000Z",
  }));

  const service = new ChargebackService(createMockReportSource(reports));

  // Build multiple reports
  for (let i = 0; i < 10; i++) {
    service.buildReport({ tenantId: "tenant-1" });
  }

  // If we get here without OOM, test passes
  const finalReport = service.buildReport({ tenantId: "tenant-1" });
  assert.ok(finalReport.reportCount > 0);
});

// ============================================================================
// Throughput Tests
// ============================================================================

test("BudgetGuard throughput: Evaluations per second", () => {
  const guard = new BudgetGuard();
  const policy = {
    maxTaskCostUsd: 100,
    maxPackCostUsd: 500,
    maxPlatformCostUsd: 5000,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    warnAtRatio: 0.8,
    mode: "supervised" as const,
    maxModelTokens: 100000,
    maxSteps: 50,
    maxDurationMs: 600000,
  };

  const iterations = 10000;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    guard.evaluateTaskSpend({
      policy,
      currentTaskCostUsd: i % 100,
      nextEstimatedCostUsd: 10,
    });
  }
  const end = performance.now();

  const totalMs = end - start;
  const opsPerSecond = (iterations / totalMs) * 1000;

  // Should handle at least 100k ops/second
  assert.ok(opsPerSecond > 100000, `Throughput was ${opsPerSecond} ops/s, expected > 100k`);
});

test("ChargebackService throughput: Reports per second", () => {
  const reports: MockCostReport[] = Array.from({ length: 100 }, (_, i) => ({
    reportId: `r${i}`,
    tenantId: "tenant-1",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-01T23:59:59.000Z",
    totalCostUsd: 10 + (i % 50),
    currency: "USD",
    resourceCosts: Array.from({ length: 5 }, (_, j) => ({
      resourceId: `resource:${i}:${j}`,
      resourceType: j % 2 === 0 ? "api" : "compute",
      costUsd: 1 + (i + j) % 10,
      currency: "USD",
    })),
    resourceCount: 5,
    submittedBy: "operator",
    submittedAt: "2026-04-01T12:00:00.000Z",
    createdAt: "2026-04-01T12:00:00.000Z",
  }));

  const service = new ChargebackService(createMockReportSource(reports));

  const iterations = 100;
  const start = performance.now();
  for (let i = 0; i < iterations; i++) {
    service.buildReport({ tenantId: "tenant-1" });
  }
  const end = performance.now();

  const totalMs = end - start;
  const opsPerSecond = (iterations / totalMs) * 1000;

  // Should handle at least 1k reports/second
  assert.ok(opsPerSecond > 1000, `Throughput was ${opsPerSecond} reports/s, expected > 1k`);
});