import assert from "node:assert/strict";
import test from "node:test";

import { buildMarkdownReport } from "../../../../../src/scale-ecosystem/intelligence/pmf-validation/report-format.js";
import type { PmfValidationReport } from "../../../../../src/scale-ecosystem/intelligence/pmf-validation/types.js";

function createReport(overrides: Partial<PmfValidationReport> = {}): PmfValidationReport {
  const base: PmfValidationReport = {
    reportId: "rpt-001",
    profileName: "phase3_default",
    verdict: "pass",
    generatedAt: "2026-04-25T00:00:00Z",
    window: {
      start: "2026-04-11T00:00:00Z",
      end: "2026-04-25T00:00:00Z",
      days: 14,
    },
    divisionId: null,
    summary: "All PMF checks passed.",
    metrics: {
      taskCount: 1000,
      terminalTaskCount: 800,
      successfulTaskCount: 750,
      sessionCount: 500,
      activationSessionCount: 400,
      repeatedRootCount: 150,
      rootCount: 300,
      approvalCount: 50,
      resolvedApprovalCount: 45,
      averageSuccessfulTaskCostUsd: 0.05,
      p95StepDurationMs: 250,
      divisionCount: 3,
      crossDivisionTaskCount: 100,
      taskSuccessRatePct: 93.75,
      activationRatePct: 80.0,
      repeatUsageRatePct: 50.0,
      approvalResolutionRatePct: 90.0,
      crossDivisionUsageRatePct: 10.0,
    },
    checks: [
      {
        checkId: "sample_size",
        status: "pass",
        detail: "Sufficient sample size.",
        observed: 1000,
        threshold: 100,
        unit: "count",
      },
      {
        checkId: "task_success_rate",
        status: "pass",
        detail: "Task success rate is acceptable.",
        observed: 93.75,
        threshold: 80.0,
        unit: "pct",
      },
    ],
    runtimeSummary: {
      generatedAt: "2026-04-01T00:00:00.000Z",
      window: { firstTaskCreatedAt: null, lastTaskUpdatedAt: null },
      taskMetrics: { total: 0, terminalCount: 0, successCount: 0, failedCount: 0, cancelledCount: 0, activeCount: 0, successRate: 0, completionRate: 0 },
      workflowMetrics: { total: 0, completedCount: 0, failedCount: 0, cancelledCount: 0, retriedCount: 0, retryRate: 0 },
      executionMetrics: { total: 0, activeCount: 0, retryAttemptCount: 0, retryRate: 0, supersededCount: 0 },
      recoveryMetrics: { taskCount: 0, successfulTaskCount: 0, successRate: 0, decisionCount: 0, repairEventCount: 0, deadLetterCount: 0, cancelledCount: 0 },
      stepMetrics: { total: 0, averageDurationMs: null, p95DurationMs: null, averageTokenCost: null, totalTokenCost: 0 },
      costMetrics: { totalActualCostUsd: 0, averageActualCostUsdPerTask: null, averageActualCostUsdPerSuccessfulTask: null },
      approvalMetrics: { total: 0, pendingCount: 0, resolvedCount: 0, taskTriggerCount: 0, taskTriggerRate: 0 },
      eventMetrics: { total: 0, tier1Count: 0, tier2Count: 0, tier3Count: 0, pendingTier1AckCount: 0, failedTier1AckCount: 0 },
      runtimeMetrics: { status: "ok" as const, degradationMode: "none" as const, providerSuccessRate: 1, activeExecutions: 0, queuedTasks: 0, eventLoopLagMs: null, memoryRssMb: 0, tier1AckBacklog: 0, queueGovernance: { backlogSize: 0, dispatchableBacklogSize: 0, claimedBacklogSize: 0, oldestWaitSeconds: null, oldestClaimAgeSeconds: null, queueNames: [], starvationDetected: false }, workerHealth: { totalWorkers: 0, healthyWorkers: 0, busyWorkers: 0, drainingWorkers: 0, degradedWorkers: 0, quarantinedWorkers: 0, offlineWorkers: 0, remoteWorkers: 0, remoteConnectedWorkers: 0, remoteReconnectingWorkers: 0, remoteDegradedSessions: 0, remoteFailedSessions: 0, remoteViewerOnlyWorkers: 0, remoteConsistencyMismatchWorkers: 0, quarantinedReason: null } as any, findings: [] },
    },
  };
  return { ...base, ...overrides };
}

test("buildMarkdownReport renders report header fields", () => {
  const report = createReport({
    reportId: "test-123",
    profileName: "custom_profile",
    verdict: "warn",
    generatedAt: "2026-03-01T12:00:00Z",
  });

  const output = buildMarkdownReport(report);

  assert.match(output, /# PMF Validation Report/);
  assert.match(output, /- Report ID: `test-123`/);
  assert.match(output, /- Profile: `custom_profile`/);
  assert.match(output, /- Verdict: `warn`/);
  assert.match(output, /- Generated At: `2026-03-01T12:00:00Z`/);
});

test("buildMarkdownReport renders window information", () => {
  const report = createReport({
    window: {
      start: "2026-01-01T00:00:00Z",
      end: "2026-01-31T23:59:59Z",
      days: 30,
    },
  });

  const output = buildMarkdownReport(report);

  assert.match(output, /- Window: `2026-01-01T00:00:00Z` -> `2026-01-31T23:59:59Z` \(30d\)/);
});

test("buildMarkdownReport renders division scope", () => {
  const report = createReport({ divisionId: "div-alpha" });
  const output = buildMarkdownReport(report);
  assert.match(output, /- Division Scope: `div-alpha`/);

  const reportNoDivision = createReport({ divisionId: null });
  const outputNoDivision = buildMarkdownReport(reportNoDivision);
  assert.match(outputNoDivision, /- Division Scope: `all`/);
});

test("buildMarkdownReport renders summary section", () => {
  const report = createReport({ summary: "Custom summary text." });
  const output = buildMarkdownReport(report);
  assert.match(output, /## Summary/);
  assert.match(output, /Custom summary text\./);
});

test("buildMarkdownReport renders all metrics", () => {
  const report = createReport();
  const output = buildMarkdownReport(report);

  assert.match(output, /- taskCount: 1000/);
  assert.match(output, /- terminalTaskCount: 800/);
  assert.match(output, /- successfulTaskCount: 750/);
  assert.match(output, /- sessionCount: 500/);
  assert.match(output, /- activationSessionCount: 400/);
  assert.match(output, /- repeatedRootCount: 150/);
  assert.match(output, /- rootCount: 300/);
  assert.match(output, /- approvalCount: 50/);
  assert.match(output, /- resolvedApprovalCount: 45/);
});

test("buildMarkdownReport renders nullable metrics as n/a", () => {
  const customMetrics: PmfValidationReport["metrics"] = {
    taskCount: 0,
    terminalTaskCount: 0,
    successfulTaskCount: 0,
    sessionCount: 0,
    activationSessionCount: 0,
    repeatedRootCount: 0,
    rootCount: 0,
    approvalCount: 0,
    resolvedApprovalCount: 0,
    averageSuccessfulTaskCostUsd: null,
    p95StepDurationMs: null,
    taskSuccessRatePct: null,
    activationRatePct: null,
    repeatUsageRatePct: null,
    approvalResolutionRatePct: null,
    crossDivisionUsageRatePct: null,
    divisionCount: 1,
    crossDivisionTaskCount: 0,
  };
  const reportWithNulls = createReport({ metrics: customMetrics });
  const output = buildMarkdownReport(reportWithNulls);

  assert.match(output, /- averageSuccessfulTaskCostUsd: n\/a/);
  assert.match(output, /- p95StepDurationMs: n\/a/);
  assert.match(output, /- taskSuccessRatePct: n\/a/);
  assert.match(output, /- activationRatePct: n\/a/);
  assert.match(output, /- repeatUsageRatePct: n\/a/);
  assert.match(output, /- approvalResolutionRatePct: n\/a/);
  assert.match(output, /- crossDivisionUsageRatePct: n\/a/);
});

test("buildMarkdownReport renders checks section", () => {
  const report = createReport({
    checks: [
      {
        checkId: "task_success_rate",
        status: "pass",
        detail: "Task success rate is acceptable.",
        observed: 93.75,
        threshold: 80.0,
        unit: "pct",
      },
      {
        checkId: "activation_rate",
        status: "warn",
        detail: "Activation rate is marginal.",
        observed: 55.0,
        threshold: 60.0,
        unit: "pct",
      },
    ],
  });

  const output = buildMarkdownReport(report);

  assert.match(output, /## Checks/);
  assert.match(output, /- task_success_rate: pass \(observed=93.75 pct, threshold=80 pct\)/);
  assert.match(output, /- activation_rate: warn \(observed=55 pct, threshold=60 pct\)/);
});

test("buildMarkdownReport handles check with null observed value", () => {
  const report = createReport({
    checks: [
      {
        checkId: "sample_size",
        status: "fail",
        detail: "Insufficient sample size.",
        observed: null,
        threshold: 100,
        unit: "count",
      },
    ],
  });

  const output = buildMarkdownReport(report);

  assert.match(output, /- sample_size: fail \(observed=n\/a count, threshold=100 count\)/);
});

test("buildMarkdownReport handles empty checks array", () => {
  const report = createReport({ checks: [] });
  const output = buildMarkdownReport(report);

  assert.match(output, /## Checks/);
  // Empty checks array produces no check lines
  assert.doesNotMatch(output, /checkId:/);
});

test("buildMarkdownReport output is valid markdown", () => {
  const report = createReport();
  const output = buildMarkdownReport(report);

  // Should contain expected markdown structure
  assert.match(output, /^# PMF Validation Report$/m);
  assert.match(output, /^## Summary$/m);
  assert.match(output, /^## Metrics$/m);
  assert.match(output, /^## Checks$/m);
});
