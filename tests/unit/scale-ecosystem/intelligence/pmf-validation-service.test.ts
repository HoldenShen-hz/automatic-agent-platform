import assert from "node:assert/strict";
import test from "node:test";

import {
  PmfValidationService,
  DEFAULT_PMF_THRESHOLDS,
} from "../../../../src/scale-ecosystem/intelligence/pmf-validation-service.js";

const DEFAULT_RUNTIME_SUMMARY = {
  generatedAt: "2026-01-01T00:00:00.000Z",
  window: {
    firstTaskCreatedAt: null,
    lastTaskUpdatedAt: null,
  },
  taskMetrics: {
    total: 0,
    terminalCount: 0,
    successCount: 0,
    failedCount: 0,
    cancelledCount: 0,
    activeCount: 0,
    successRate: 0,
    completionRate: 0,
  },
  workflowMetrics: {
    total: 0,
    completedCount: 0,
    failedCount: 0,
    cancelledCount: 0,
    retriedCount: 0,
    retryRate: 0,
  },
  executionMetrics: {
    total: 0,
    activeCount: 0,
    retryAttemptCount: 0,
    retryRate: 0,
    supersededCount: 0,
  },
  recoveryMetrics: {
    taskCount: 0,
    successfulTaskCount: 0,
    successRate: 0,
    decisionCount: 0,
    repairEventCount: 0,
    deadLetterCount: 0,
    cancelledCount: 0,
  },
  stepMetrics: {
    total: 0,
    averageDurationMs: null,
    p95DurationMs: null,
    averageTokenCost: null,
    totalTokenCost: 0,
  },
  costMetrics: {
    totalActualCostUsd: 0,
    averageActualCostUsdPerTask: null,
    averageActualCostUsdPerSuccessfulTask: null,
  },
  approvalMetrics: {
    total: 0,
    pendingCount: 0,
    resolvedCount: 0,
    taskTriggerCount: 0,
    taskTriggerRate: 0,
  },
  eventMetrics: {
    total: 0,
    tier1Count: 0,
    tier2Count: 0,
    tier3Count: 0,
    pendingTier1AckCount: 0,
    failedTier1AckCount: 0,
  },
  runtimeMetrics: {
    status: "ok",
    degradationMode: "none",
    providerSuccessRate: 1,
    activeExecutions: 0,
    queuedTasks: 0,
    eventLoopLagMs: 0,
    memoryRssMb: 0,
    tier1AckBacklog: 0,
    queueGovernance: {
      backlogSize: 0,
      dispatchableBacklogSize: 0,
      claimedBacklogSize: 0,
      oldestWaitSeconds: null,
      oldestClaimAgeSeconds: null,
      queueNames: [],
      starvationDetected: false,
    },
    workerHealth: {
      totalWorkers: 0,
      healthyWorkers: 0,
      busyWorkers: 0,
      drainingWorkers: 0,
      degradedWorkers: 0,
      quarantinedWorkers: 0,
      offlineWorkers: 0,
      remoteWorkers: 0,
      remoteConnectedWorkers: 0,
      remoteReconnectingWorkers: 0,
      remoteDegradedSessions: 0,
      remoteFailedSessions: 0,
      remoteViewerOnlyWorkers: 0,
      remoteConsistencyMismatchWorkers: 0,
      remoteWorkspaceSyncConflictWorkers: 0,
      remoteOffsetMissingWorkers: 0,
      staleWorkers: 0,
      staleBusyWorkers: 0,
      loadSkewDetected: false,
      dominantWorkerId: null,
      dominantWorkerShare: null,
      skewedWorkerIds: [],
    },
    findings: [],
  },
} as const;

// Mock stores and db
function createMockStore(): any {
  return {
    operations: {
      insertPmfValidationReport: () => {},
      listPmfValidationReports: () => [],
      getLatestPmfValidationReport: () => null,
    },
    task: {
      getTask: () => null,
      insertTask: () => {},
    },
    artifact: {
      insertArtifact: () => {},
    },
  };
}

function buildDefaultRow(sql: string): Record<string, number | string | null> | null {
  if (sql.includes("COUNT(*) AS taskCount")) {
    return {
      taskCount: 24,
      terminalTaskCount: 20,
      successfulTaskCount: 18,
      divisionCount: 1,
      crossDivisionTaskCount: 12,
      averageSuccessfulTaskCostUsd: 0.05,
    };
  }
  if (sql.includes("COUNT(*) AS sessionCount")) {
    return {
      sessionCount: 20,
      activationSessionCount: 18,
    };
  }
  if (sql.includes("COUNT(*) AS rootCount")) {
    return {
      rootCount: 12,
      repeatedRootCount: 6,
    };
  }
  if (sql.includes("COUNT(*) AS approvalCount")) {
    return {
      approvalCount: 10,
      resolvedApprovalCount: 9,
    };
  }
  return null;
}

function createMockDb(overrides: {
  get?: (sql: string) => Record<string, unknown> | null | undefined;
  all?: (sql: string) => Array<Record<string, unknown>>;
} = {}): any {
  return {
    connection: {
      prepare: (sql: string) => ({
        get: () => overrides.get?.(sql) ?? buildDefaultRow(sql),
        all: () => overrides.all?.(sql) ?? [],
      }),
    },
  };
}

function createService(
  db: any = createMockDb(),
  store: any = createMockStore(),
): PmfValidationService {
  const service = new PmfValidationService(db as any, store as any);
  (service as any).metricsService = {
    buildSummary: () => DEFAULT_RUNTIME_SUMMARY,
  };
  return service;
}

test("DEFAULT_PMF_THRESHOLDS has expected structure", () => {
  assert.ok(DEFAULT_PMF_THRESHOLDS.minTaskCount > 0);
  assert.ok(DEFAULT_PMF_THRESHOLDS.minSessionCount > 0);
  assert.ok(DEFAULT_PMF_THRESHOLDS.minTaskSuccessRatePct >= 0);
  assert.ok(DEFAULT_PMF_THRESHOLDS.minActivationRatePct >= 0);
  assert.ok(DEFAULT_PMF_THRESHOLDS.minRepeatUsageRatePct >= 0);
  assert.ok(DEFAULT_PMF_THRESHOLDS.minApprovalResolutionRatePct >= 0);
  assert.ok(DEFAULT_PMF_THRESHOLDS.maxAverageSuccessfulTaskCostUsd > 0);
  assert.ok(DEFAULT_PMF_THRESHOLDS.maxP95StepDurationMs > 0);
});

test("PmfValidationService can be instantiated", () => {
  const service = createService();

  assert.ok(service);
});

test("PmfValidationService runValidation returns report and record", () => {
  const mockStore = createMockStore();
  mockStore.operations.insertPmfValidationReport = () => {};

  const service = createService(createMockDb(), mockStore);

  const result = service.runValidation({});

  assert.ok(result.report);
  assert.ok(result.record);
  assert.ok(result.report.verdict);
  assert.ok(result.report.reportId);
  assert.ok(result.report.checks);
  assert.ok(result.report.metrics);
});

test("PmfValidationService buildReport returns valid report structure", () => {
  const service = createService();

  const report = service.buildReport({});

  assert.ok(report.reportId);
  assert.ok(report.profileName);
  assert.ok(report.generatedAt);
  assert.ok(report.window);
  assert.equal(typeof report.window.start, "string");
  assert.equal(typeof report.window.end, "string");
  assert.ok(typeof report.window.days, "number");
  assert.ok(report.summary);
  assert.ok(report.verdict);
  assert.ok(Array.isArray(report.checks));
  assert.ok(report.metrics);
});

test("PmfValidationService buildReport accepts custom window days", () => {
  const service = createService();

  const report = service.buildReport({ windowDays: 30 });

  assert.equal(report.window.days, 30);
});

test("PmfValidationService buildReport accepts custom profile name", () => {
  const service = createService();

  const report = service.buildReport({ profileName: "custom_profile" });

  assert.equal(report.profileName, "custom_profile");
});

test("PmfValidationService buildReport accepts custom division id", () => {
  const service = createService();

  const report = service.buildReport({ divisionId: "engineering" });

  assert.equal(report.divisionId, "engineering");
});

test("PmfValidationService buildReport calculates checks correctly for pass", () => {
  const mockDb = createMockDb({
    get: (sql) => {
      if (sql.includes("COUNT(*) AS taskCount")) {
        return {
          taskCount: 100,
          terminalTaskCount: 90,
          successfulTaskCount: 81,
          divisionCount: 1,
          crossDivisionTaskCount: 50,
          averageSuccessfulTaskCostUsd: 0.05,
        };
      }
      if (sql.includes("COUNT(*) AS sessionCount")) {
        return {
          sessionCount: 70,
          activationSessionCount: 63,
        };
      }
      return buildDefaultRow(sql);
    },
  });

  const mockStore = createMockStore();

  const service = createService(mockDb, mockStore);

  const report = service.buildReport({});

  // With sufficient samples and good metrics, should pass
  const sampleSizeCheck = report.checks.find(c => c.checkId === "sample_size");
  assert.ok(sampleSizeCheck);
  assert.equal(sampleSizeCheck.status, "pass");
});

test("PmfValidationService buildReport handles null metrics gracefully", () => {
  const mockDb = createMockDb({
    get: (sql) => {
      if (sql.includes("COUNT(*) AS taskCount")) {
        return {
          taskCount: 0,
          terminalTaskCount: 0,
          successfulTaskCount: 0,
          divisionCount: 0,
          crossDivisionTaskCount: 0,
          averageSuccessfulTaskCostUsd: null,
        };
      }
      if (sql.includes("COUNT(*) AS sessionCount")) {
        return {
          sessionCount: 0,
          activationSessionCount: 0,
        };
      }
      if (sql.includes("COUNT(*) AS rootCount")) {
        return {
          rootCount: 0,
          repeatedRootCount: 0,
        };
      }
      if (sql.includes("COUNT(*) AS approvalCount")) {
        return {
          approvalCount: 0,
          resolvedApprovalCount: 0,
        };
      }
      return null;
    },
  });

  const mockStore = createMockStore();

  const service = createService(mockDb, mockStore);

  const report = service.buildReport({});

  assert.ok(report);
  assert.equal(report.verdict, "fail"); // Should fail due to insufficient samples
});

test("PmfValidationService exportValidation returns artifacts", () => {
  const mockStore = createMockStore();
  mockStore.operations.insertPmfValidationReport = () => {};
  mockStore.task.getTask = () => null;
  mockStore.task.insertTask = () => {};

  const mockDb = createMockDb({
    get: (sql) => {
      if (sql.includes("COUNT(*) AS taskCount")) {
        return {
          taskCount: 0,
          terminalTaskCount: 0,
          successfulTaskCount: 0,
          divisionCount: 0,
          crossDivisionTaskCount: 0,
          averageSuccessfulTaskCostUsd: null,
        };
      }
      if (sql.includes("COUNT(*) AS sessionCount")) {
        return {
          sessionCount: 0,
          activationSessionCount: 0,
        };
      }
      if (sql.includes("COUNT(*) AS rootCount")) {
        return {
          rootCount: 0,
          repeatedRootCount: 0,
        };
      }
      if (sql.includes("COUNT(*) AS approvalCount")) {
        return {
          approvalCount: 0,
          resolvedApprovalCount: 0,
        };
      }
      return null;
    },
  });

  const service = createService(mockDb, mockStore);

  const result = service.exportValidation({});

  assert.ok(result.jsonArtifact);
  assert.ok(result.markdownArtifact);
  assert.ok(result.report);
  assert.ok(result.record);
});

test("PmfValidationService listHistory returns reports", () => {
  const mockStore = createMockStore();
  mockStore.operations.listPmfValidationReports = () => [
    { id: "report_1" } as any,
    { id: "report_2" } as any,
  ];

  const service = createService(createMockDb(), mockStore);

  const history = service.listHistory(10);

  assert.equal(history.length, 2);
});

test("PmfValidationService getLatest returns most recent report", () => {
  const mockStore = createMockStore();
  mockStore.operations.getLatestPmfValidationReport = () => ({ id: "report_latest" } as any);

  const service = createService(createMockDb(), mockStore);

  const latest = service.getLatest();

  assert.ok(latest);
  assert.equal((latest as any).id, "report_latest");
});

test("PmfValidationService getLatest with profile returns filtered report", () => {
  const mockStore = createMockStore();
  mockStore.operations.getLatestPmfValidationReport = () => ({ id: "report_production" } as any);

  const service = createService(createMockDb(), mockStore);

  const latest = service.getLatest("production");

  assert.ok(latest);
});

test("PmfValidationService getLatest returns null when no reports", () => {
  const mockStore = createMockStore();
  mockStore.operations.getLatestPmfValidationReport = () => null;

  const service = createService(createMockDb(), mockStore);

  const latest = service.getLatest();

  assert.equal(latest, null);
});

test("PmfValidationService buildReport with custom thresholds", () => {
  const service = createService();

  const customThresholds = {
    ...DEFAULT_PMF_THRESHOLDS,
    minTaskSuccessRatePct: 90,
    maxAverageSuccessfulTaskCostUsd: 0.01,
  };

  const report = service.buildReport({
    thresholds: customThresholds,
  });

  assert.ok(report);
});

test("PmfValidationService verdict is fail when sample size insufficient", () => {
  const mockDb = createMockDb({
    get: (sql) => {
      if (sql.includes("COUNT(*) AS taskCount")) {
        return {
          taskCount: 1,
          terminalTaskCount: 1,
          successfulTaskCount: 0,
          divisionCount: 1,
          crossDivisionTaskCount: 0,
          averageSuccessfulTaskCostUsd: 0.10,
        };
      }
      if (sql.includes("COUNT(*) AS sessionCount")) {
        return {
          sessionCount: 1,
          activationSessionCount: 0,
        };
      }
      return buildDefaultRow(sql);
    },
  });

  const mockStore = createMockStore();

  const service = createService(mockDb, mockStore);

  const report = service.buildReport({});

  const sampleSizeCheck = report.checks.find(c => c.checkId === "sample_size");
  assert.equal(sampleSizeCheck?.status, "fail");
  assert.equal(report.verdict, "fail");
});

test("PmfValidationService check IDs are unique", () => {
  const service = createService();

  const report = service.buildReport({});

  const checkIds = report.checks.map(c => c.checkId);
  const uniqueIds = new Set(checkIds);
  assert.equal(checkIds.length, uniqueIds.size);
});

test("PmfValidationService checks cover all expected metric types", () => {
  const service = createService();

  const report = service.buildReport({});

  const expectedChecks = [
    "sample_size",
    "task_success_rate",
    "activation_rate",
    "repeat_usage_rate",
    "approval_resolution_rate",
    "average_success_cost",
    "p95_step_duration",
  ];

  for (const expected of expectedChecks) {
    assert.ok(report.checks.some(c => c.checkId === expected), `Missing check: ${expected}`);
  }
});

test("PmfValidationService each check has required fields", () => {
  const service = createService();

  const report = service.buildReport({});

  for (const check of report.checks) {
    assert.ok(check.checkId);
    assert.ok(check.status);
    assert.ok(check.detail);
    assert.ok(check.unit);
    assert.ok(typeof check.observed === "number" || check.observed === null);
    assert.ok(typeof check.threshold === "number");
  }
});

test("PmfValidationService metrics are all numbers or null", () => {
  const service = createService();

  const report = service.buildReport({});

  const numericMetrics = [
    report.metrics.taskCount,
    report.metrics.terminalTaskCount,
    report.metrics.successfulTaskCount,
    report.metrics.activationSessionCount,
    report.metrics.sessionCount,
    report.metrics.repeatedRootCount,
    report.metrics.rootCount,
    report.metrics.approvalCount,
    report.metrics.resolvedApprovalCount,
  ];

  for (const metric of numericMetrics) {
    assert.equal(typeof metric, "number");
  }
});

test("PmfValidationService report can be converted to record", () => {
  const mockStore = createMockStore();
  mockStore.operations.insertPmfValidationReport = (record: any) => {
    assert.ok(record.id);
    assert.ok(record.profileName);
    assert.ok(record.windowStart);
    assert.ok(record.windowEnd);
  };

  const service = createService(createMockDb(), mockStore);

  const result = service.runValidation({});

  assert.ok(result.record);
  assert.equal(result.record.id, result.report.reportId);
});
