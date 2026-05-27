/**
 * Unit tests for PMF Validation Types
 *
 * @see src/scale-ecosystem/intelligence/pmf-validation/types.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import type {
  PmfValidationThresholds,
  PmfValidationWindow,
  PmfMetricCheck,
  PmfValidationReport,
  PmfValidationRunOptions,
  PmfValidationRunResult,
  PmfValidationExportResult,
  SqlFilterClause,
  PmfCheckStatus,
} from "../../../../../src/scale-ecosystem/intelligence/pmf-validation/types.js";

describe("PmfValidationThresholds", () => {
  test("has correct structure with all required fields [types]", () => {
    const thresholds: PmfValidationThresholds = {
      minTaskCount: 5,
      minSessionCount: 3,
      minTaskSuccessRatePct: 70,
      minActivationRatePct: 60,
      minRepeatUsageRatePct: 20,
      minApprovalResolutionRatePct: 90,
      maxAverageSuccessfulTaskCostUsd: 2,
      maxP95StepDurationMs: 60000,
    };

    assert.equal(thresholds.minTaskCount, 5);
    assert.equal(thresholds.minSessionCount, 3);
    assert.equal(thresholds.minTaskSuccessRatePct, 70);
    assert.equal(thresholds.minActivationRatePct, 60);
    assert.equal(thresholds.minRepeatUsageRatePct, 20);
    assert.equal(thresholds.minApprovalResolutionRatePct, 90);
    assert.equal(thresholds.maxAverageSuccessfulTaskCostUsd, 2);
    assert.equal(thresholds.maxP95StepDurationMs, 60000);
  });

  test("accepts boundary values for percentages [types]", () => {
    const thresholds: PmfValidationThresholds = {
      minTaskCount: 0,
      minSessionCount: 0,
      minTaskSuccessRatePct: 0,
      minActivationRatePct: 100,
      minRepeatUsageRatePct: 0,
      minApprovalResolutionRatePct: 100,
      maxAverageSuccessfulTaskCostUsd: 0,
      maxP95StepDurationMs: 0,
    };

    assert.equal(thresholds.minTaskSuccessRatePct, 0);
    assert.equal(thresholds.minActivationRatePct, 100);
  });

  test("accepts large values for durations and counts [types]", () => {
    const thresholds: PmfValidationThresholds = {
      minTaskCount: 1000000,
      minSessionCount: 500000,
      minTaskSuccessRatePct: 99,
      minActivationRatePct: 95,
      minRepeatUsageRatePct: 80,
      minApprovalResolutionRatePct: 99,
      maxAverageSuccessfulTaskCostUsd: 1000,
      maxP95StepDurationMs: 3600000,
    };

    assert.equal(thresholds.maxP95StepDurationMs, 3600000); // 1 hour
  });
});

describe("PmfValidationWindow", () => {
  test("has correct structure [types]", () => {
    const window: PmfValidationWindow = {
      start: "2026-04-01T00:00:00Z",
      end: "2026-04-14T00:00:00Z",
      days: 14,
    };

    assert.equal(window.start, "2026-04-01T00:00:00Z");
    assert.equal(window.end, "2026-04-14T00:00:00Z");
    assert.equal(window.days, 14);
  });

  test("supports different window sizes [types]", () => {
    const window7: PmfValidationWindow = {
      start: "2026-04-01T00:00:00Z",
      end: "2026-04-08T00:00:00Z",
      days: 7,
    };

    const window30: PmfValidationWindow = {
      start: "2026-03-01T00:00:00Z",
      end: "2026-03-31T00:00:00Z",
      days: 30,
    };

    assert.equal(window7.days, 7);
    assert.equal(window30.days, 30);
  });
});

describe("PmfMetricCheck", () => {
  test("accepts all valid checkId values [types]", () => {
    const checkIds: PmfMetricCheck["checkId"][] = [
      "sample_size",
      "task_success_rate",
      "activation_rate",
      "repeat_usage_rate",
      "approval_resolution_rate",
      "average_success_cost",
      "p95_step_duration",
    ];

    for (const checkId of checkIds) {
      const check: PmfMetricCheck = {
        checkId,
        status: "pass",
        detail: "Test detail",
        observed: 100,
        threshold: 50,
        unit: "count",
      };
      assert.equal(check.checkId, checkId);
    }
  });

  test("accepts all valid status values [types]", () => {
    const statuses: PmfCheckStatus[] = ["pass", "warn", "fail"];

    for (const status of statuses) {
      const check: PmfMetricCheck = {
        checkId: "sample_size",
        status,
        detail: "Test detail",
        observed: 100,
        threshold: 50,
        unit: "count",
      };
      assert.equal(check.status, status);
    }
  });

  test("accepts all valid unit values [types]", () => {
    const units: PmfMetricCheck["unit"][] = ["count", "pct", "usd", "ms"];

    for (const unit of units) {
      const check: PmfMetricCheck = {
        checkId: "sample_size",
        status: "pass",
        detail: "Test",
        observed: 100,
        threshold: 50,
        unit,
      };
      assert.equal(check.unit, unit);
    }
  });

  test("allows null observed and threshold for insufficient data [types]", () => {
    const check: PmfMetricCheck = {
      checkId: "sample_size",
      status: "fail",
      detail: "Insufficient data",
      observed: null,
      threshold: null,
      unit: "count",
    };

    assert.equal(check.observed, null);
    assert.equal(check.threshold, null);
  });
});

describe("PmfValidationReport", () => {
  test("has correct structure with all required fields [types]", () => {
    const report: PmfValidationReport = {
      reportId: "rpt-001",
      profileName: "phase3_default",
      generatedAt: "2026-04-26T00:00:00Z",
      window: {
        start: "2026-04-12T00:00:00Z",
        end: "2026-04-26T00:00:00Z",
        days: 14,
      },
      divisionId: null,
      verdict: "pass",
      summary: "All checks passed",
      metrics: {
        taskCount: 1000,
        terminalTaskCount: 800,
        successfulTaskCount: 750,
        activationSessionCount: 400,
        sessionCount: 500,
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
      checks: [],
      runtimeSummary: {
        generatedAt: "2026-04-26T00:00:00Z",
        window: { firstTaskCreatedAt: null, lastTaskUpdatedAt: null },
        taskMetrics: {
          total: 0, terminalCount: 0, successCount: 0, failedCount: 0,
          cancelledCount: 0, activeCount: 0, successRate: 0, completionRate: 0
        },
        workflowMetrics: {
          total: 0, completedCount: 0, failedCount: 0,
          cancelledCount: 0, retriedCount: 0, retryRate: 0
        },
        executionMetrics: {
          total: 0, activeCount: 0, retryAttemptCount: 0, retryRate: 0, supersededCount: 0
        },
        recoveryMetrics: {
          taskCount: 0, successfulTaskCount: 0, successRate: 0,
          decisionCount: 0, repairEventCount: 0, deadLetterCount: 0, cancelledCount: 0
        },
        stepMetrics: {
          total: 0, averageDurationMs: null, p95DurationMs: null,
          averageTokenCost: null, totalTokenCost: 0
        },
        costMetrics: {
          totalActualCostUsd: 0, averageActualCostUsdPerTask: null,
          averageActualCostUsdPerSuccessfulTask: null
        },
        approvalMetrics: {
          total: 0, pendingCount: 0, resolvedCount: 0,
          taskTriggerCount: 0, taskTriggerRate: 0
        },
        eventMetrics: {
          total: 0, tier1Count: 0, tier2Count: 0, tier3Count: 0,
          pendingTier1AckCount: 0, failedTier1AckCount: 0
        },
        runtimeMetrics: {
          status: "ok" as const, degradationMode: "none" as const,
          providerSuccessRate: 1, activeExecutions: 0, queuedTasks: 0,
          eventLoopLagMs: null, memoryRssMb: 0, tier1AckBacklog: 0,
          queueGovernance: {
            backlogSize: 0, dispatchableBacklogSize: 0, claimedBacklogSize: 0,
            oldestWaitSeconds: null, oldestClaimAgeSeconds: null, queueNames: [],
            starvationDetected: false
          },
          workerHealth: {
            totalWorkers: 0, healthyWorkers: 0, busyWorkers: 0,
            drainingWorkers: 0, degradedWorkers: 0, quarantinedWorkers: 0,
            offlineWorkers: 0, remoteWorkers: 0, remoteConnectedWorkers: 0,
            remoteReconnectingWorkers: 0, remoteDegradedSessions: 0,
            remoteFailedSessions: 0, remoteViewerOnlyWorkers: 0,
            remoteConsistencyMismatchWorkers: 0, quarantinedReason: null
          },
          findings: []
        },
      },
    };

    assert.equal(report.reportId, "rpt-001");
    assert.equal(report.profileName, "phase3_default");
    assert.equal(report.divisionId, null);
    assert.equal(report.verdict, "pass");
    assert.equal(report.metrics.taskCount, 1000);
    assert.equal(report.metrics.successfulTaskCount, 750);
  });

  test("supports different verdict values [types]", () => {
    const verdicts: PmfValidationReport["verdict"][] = ["pass", "warn", "fail"];

    for (const verdict of verdicts) {
      const report: PmfValidationReport = {
        reportId: "rpt-test",
        profileName: "test",
        generatedAt: "2026-04-26T00:00:00Z",
        window: { start: "2026-04-12T00:00:00Z", end: "2026-04-26T00:00:00Z", days: 14 },
        divisionId: null,
        verdict,
        summary: "Test summary",
        metrics: {
          taskCount: 0, terminalTaskCount: 0, successfulTaskCount: 0,
          activationSessionCount: 0, sessionCount: 0, repeatedRootCount: 0,
          rootCount: 0, approvalCount: 0, resolvedApprovalCount: 0,
          averageSuccessfulTaskCostUsd: null, p95StepDurationMs: null,
          divisionCount: 0, crossDivisionTaskCount: 0, taskSuccessRatePct: null,
          activationRatePct: null, repeatUsageRatePct: null,
          approvalResolutionRatePct: null, crossDivisionUsageRatePct: null,
        },
        checks: [],
        runtimeSummary: {} as any,
      };
      assert.equal(report.verdict, verdict);
    }
  });

  test("supports divisionId as string [types]", () => {
    const report: PmfValidationReport = {
      reportId: "rpt-001",
      profileName: "test",
      generatedAt: "2026-04-26T00:00:00Z",
      window: { start: "2026-04-12T00:00:00Z", end: "2026-04-26T00:00:00Z", days: 14 },
      divisionId: "division-alpha",
      verdict: "pass",
      summary: "Test",
      metrics: {
        taskCount: 0, terminalTaskCount: 0, successfulTaskCount: 0,
        activationSessionCount: 0, sessionCount: 0, repeatedRootCount: 0,
        rootCount: 0, approvalCount: 0, resolvedApprovalCount: 0,
        averageSuccessfulTaskCostUsd: null, p95StepDurationMs: null,
        divisionCount: 0, crossDivisionTaskCount: 0, taskSuccessRatePct: null,
        activationRatePct: null, repeatUsageRatePct: null,
        approvalResolutionRatePct: null, crossDivisionUsageRatePct: null,
      },
      checks: [],
      runtimeSummary: {} as any,
    };

    assert.equal(report.divisionId, "division-alpha");
  });
});

describe("PmfValidationRunOptions", () => {
  test("has correct structure with optional fields [types]", () => {
    const options: PmfValidationRunOptions = {
      profileName: "custom_profile",
      divisionId: "division-beta",
      windowDays: 30,
      evaluatedAt: "2026-04-26T00:00:00Z",
      thresholds: {
        minTaskCount: 10,
      },
    };

    assert.equal(options.profileName, "custom_profile");
    assert.equal(options.divisionId, "division-beta");
    assert.equal(options.windowDays, 30);
    assert.equal(options.evaluatedAt, "2026-04-26T00:00:00Z");
    assert.equal(options.thresholds?.minTaskCount, 10);
  });

  test("accepts minimal options with no fields [types]", () => {
    const options: PmfValidationRunOptions = {};

    assert.equal(options.profileName, undefined);
    assert.equal(options.divisionId, undefined);
    assert.equal(options.windowDays, undefined);
  });

  test("allows null divisionId [types]", () => {
    const options: PmfValidationRunOptions = {
      divisionId: null,
    };

    assert.equal(options.divisionId, null);
  });
});

describe("PmfValidationRunResult", () => {
  test("has correct structure [types]", () => {
    const result: PmfValidationRunResult = {
      report: {
        reportId: "rpt-001",
        profileName: "test",
        generatedAt: "2026-04-26T00:00:00Z",
        window: { start: "2026-04-12T00:00:00Z", end: "2026-04-26T00:00:00Z", days: 14 },
        divisionId: null,
        verdict: "pass",
        summary: "Test",
        metrics: {
          taskCount: 0, terminalTaskCount: 0, successfulTaskCount: 0,
          activationSessionCount: 0, sessionCount: 0, repeatedRootCount: 0,
          rootCount: 0, approvalCount: 0, resolvedApprovalCount: 0,
          averageSuccessfulTaskCostUsd: null, p95StepDurationMs: null,
          divisionCount: 0, crossDivisionTaskCount: 0, taskSuccessRatePct: null,
          activationRatePct: null, repeatUsageRatePct: null,
          approvalResolutionRatePct: null, crossDivisionUsageRatePct: null,
        },
        checks: [],
        runtimeSummary: {} as any,
      },
      record: {
        reportId: "rpt-001",
        profileName: "test",
        generatedAt: "2026-04-26T00:00:00Z",
        windowDays: 14,
        divisionId: null,
        verdict: "pass",
        summary: "Test",
      } as any,
    };

    assert.equal(result.report.reportId, "rpt-001");
    assert.equal(result.record.reportId, "rpt-001");
  });
});

describe("PmfValidationExportResult", () => {
  test("extends PmfValidationRunResult with artifact references [types]", () => {
    const result: PmfValidationExportResult = {
      report: {
        reportId: "rpt-001",
        profileName: "test",
        generatedAt: "2026-04-26T00:00:00Z",
        window: { start: "2026-04-12T00:00:00Z", end: "2026-04-26T00:00:00Z", days: 14 },
        divisionId: null,
        verdict: "pass",
        summary: "Test",
        metrics: {
          taskCount: 0, terminalTaskCount: 0, successfulTaskCount: 0,
          activationSessionCount: 0, sessionCount: 0, repeatedRootCount: 0,
          rootCount: 0, approvalCount: 0, resolvedApprovalCount: 0,
          averageSuccessfulTaskCostUsd: null, p95StepDurationMs: null,
          divisionCount: 0, crossDivisionTaskCount: 0, taskSuccessRatePct: null,
          activationRatePct: null, repeatUsageRatePct: null,
          approvalResolutionRatePct: null, crossDivisionUsageRatePct: null,
        },
        checks: [],
        runtimeSummary: {} as any,
      },
      record: {
        reportId: "rpt-001",
        profileName: "test",
        generatedAt: "2026-04-26T00:00:00Z",
        windowDays: 14,
        divisionId: null,
        verdict: "pass",
        summary: "Test",
      } as any,
      jsonArtifact: {
        artifactId: "art-json-001",
        artifactKind: "json",
        storageClass: "standard",
        sizeBytes: 1024,
        checksumSha256: "abc123",
        createdAt: "2026-04-26T00:00:00Z",
        expiresAt: null,
      } as any,
      markdownArtifact: {
        artifactId: "art-md-001",
        artifactKind: "text",
        storageClass: "standard",
        sizeBytes: 512,
        checksumSha256: "def456",
        createdAt: "2026-04-26T00:00:00Z",
        expiresAt: null,
      } as any,
    };

    assert.equal(result.jsonArtifact.artifactId, "art-json-001");
    assert.equal(result.markdownArtifact.artifactId, "art-md-001");
  });
});

describe("SqlFilterClause", () => {
  test("has correct structure [types]", () => {
    const clause: SqlFilterClause = {
      whereClause: "division_id = ? AND status = ?",
      parameters: ["division-1", "active"],
    };

    assert.equal(clause.whereClause, "division_id = ? AND status = ?");
    assert.deepEqual(clause.parameters, ["division-1", "active"]);
  });

  test("supports empty parameters [types]", () => {
    const clause: SqlFilterClause = {
      whereClause: "1=1",
      parameters: [],
    };

    assert.equal(clause.whereClause, "1=1");
    assert.deepEqual(clause.parameters, []);
  });

  test("supports null in parameters [types]", () => {
    const clause: SqlFilterClause = {
      whereClause: "division_id = ? OR parent_id = ?",
      parameters: ["division-1", null],
    };

    assert.equal(clause.parameters.length, 2);
    assert.equal(clause.parameters[1], null);
  });
});