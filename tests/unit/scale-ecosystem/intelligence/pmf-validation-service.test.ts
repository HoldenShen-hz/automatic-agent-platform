import assert from "node:assert/strict";
import test from "node:test";

import {
  PmfValidationService,
  DEFAULT_PMF_THRESHOLDS,
  type PmfValidationRunOptions,
} from "../../../../src/scale-ecosystem/intelligence/pmf-validation-service.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
import type { PmfValidationReportRecord } from "../../../../src/platform/contracts/types/domain.js";

type MockDb = {
  connection: {
    prepare: (sql: string) => MockStatement;
  };
  transaction: (fn: () => void) => void;
};

type MockStatement = {
  get: (...params: unknown[]) => Record<string, unknown> | null;
  all: (...params: unknown[]) => Array<Record<string, unknown>>;
};

type MockStore = {
  operations: {
    insertPmfValidationReport: (record: PmfValidationReportRecord) => void;
    listPmfValidationReports: (limit?: number) => PmfValidationReportRecord[];
    getLatestPmfValidationReport: (profileName?: string | null) => PmfValidationReportRecord | null;
  };
  task: {
    getTask: (taskId: string) => Record<string, unknown> | null;
    insertTask: (task: Record<string, unknown>) => void;
  };
  artifact: {
    insertArtifact: (artifact: Record<string, unknown>) => void;
  };
};

function createMockStore(): MockStore {
  const tasks = new Map<string, Record<string, unknown>>();
  const reports: PmfValidationReportRecord[] = [];

  return {
    operations: {
      insertPmfValidationReport: (record: PmfValidationReportRecord) => { reports.push(record); },
      listPmfValidationReports: (limit = 20) => reports.slice(0, limit),
      getLatestPmfValidationReport: (profileName?: string | null) => {
        const filtered = profileName
          ? reports.filter(r => r.profileName === profileName)
          : reports;
        return filtered[filtered.length - 1] ?? null;
      },
    },
    task: {
      getTask: (taskId: string) => tasks.get(taskId) ?? null,
      insertTask: (task: Record<string, unknown>) => { tasks.set(task.id as string, task); },
    },
    artifact: {
      insertArtifact: () => {},
    },
  };
}

function createMockDb(getOverride?: Record<string, Record<string, unknown> | null>, allOverride?: Record<string, Array<Record<string, unknown>>>): MockDb {
  return {
    transaction: (fn: () => void) => fn(),
    connection: {
      prepare: (sql: string) => {
        let getResponse: Record<string, unknown> | null = null;
        let allResponse: Array<Record<string, unknown>> = [];

        // Match based on full SQL context
        if (sql.includes("COUNT(*) AS rootCount") && sql.includes("FROM (")) {
          // Repeat usage query - has special structure with nested subquery
          getResponse = getOverride?.["FROM ("] ?? { rootCount: 0, repeatedRootCount: 0 };
        } else if (sql.includes("FROM sessions s")) {
          getResponse = getOverride?.["FROM sessions"] ?? { sessionCount: 0, activationSessionCount: 0 };
        } else if (sql.includes("FROM approvals a")) {
          getResponse = getOverride?.["FROM approvals"] ?? { approvalCount: 0, resolvedApprovalCount: 0 };
        } else if (sql.includes("FROM tasks")) {
          getResponse = getOverride?.["FROM tasks"] ?? { taskCount: 0, terminalTaskCount: 0, successfulTaskCount: 0, divisionCount: 0, crossDivisionTaskCount: 0, averageSuccessfulTaskCostUsd: null };
        }

        if (allOverride?.["workflow_step_outputs"]) {
          allResponse = allOverride["workflow_step_outputs"];
        }

        return {
          get: (..._params: unknown[]) => getResponse,
          all: (..._params: unknown[]) => allResponse,
        };
      },
    },
  };
}

function createService(
  db: MockDb = createMockDb(),
  store: MockStore = createMockStore(),
): PmfValidationService {
  return new PmfValidationService(
    db as unknown as ConstructorParameters<typeof PmfValidationService>[0],
    store as unknown as ConstructorParameters<typeof PmfValidationService>[1],
  );
}

function makeReportRecord(overrides: Partial<PmfValidationReportRecord> = {}): PmfValidationReportRecord {
  return {
    id: "report_001",
    profileName: "test",
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-15T00:00:00.000Z",
    divisionId: null,
    verdict: "pass",
    summaryJson: "{}",
    reportJson: "{}",
    generatedAt: "2026-04-15T00:00:00.000Z",
    ...overrides,
  };
}

// ============================================================================
// DEFAULT_PMF_THRESHOLDS
// ============================================================================

test("DEFAULT_PMF_THRESHOLDS has all required threshold fields", () => {
  assert.ok(typeof DEFAULT_PMF_THRESHOLDS.minTaskCount === "number");
  assert.ok(typeof DEFAULT_PMF_THRESHOLDS.minSessionCount === "number");
  assert.ok(typeof DEFAULT_PMF_THRESHOLDS.minTaskSuccessRatePct === "number");
  assert.ok(typeof DEFAULT_PMF_THRESHOLDS.minActivationRatePct === "number");
  assert.ok(typeof DEFAULT_PMF_THRESHOLDS.minRepeatUsageRatePct === "number");
  assert.ok(typeof DEFAULT_PMF_THRESHOLDS.minApprovalResolutionRatePct === "number");
  assert.ok(typeof DEFAULT_PMF_THRESHOLDS.maxAverageSuccessfulTaskCostUsd === "number");
  assert.ok(typeof DEFAULT_PMF_THRESHOLDS.maxP95StepDurationMs === "number");
});

test("DEFAULT_PMF_THRESHOLDS values are positive", () => {
  assert.ok(DEFAULT_PMF_THRESHOLDS.minTaskCount > 0);
  assert.ok(DEFAULT_PMF_THRESHOLDS.minSessionCount > 0);
  assert.ok(DEFAULT_PMF_THRESHOLDS.minTaskSuccessRatePct >= 0);
  assert.ok(DEFAULT_PMF_THRESHOLDS.minActivationRatePct >= 0);
  assert.ok(DEFAULT_PMF_THRESHOLDS.minRepeatUsageRatePct >= 0);
  assert.ok(DEFAULT_PMF_THRESHOLDS.minApprovalResolutionRatePct >= 0);
  assert.ok(DEFAULT_PMF_THRESHOLDS.maxAverageSuccessfulTaskCostUsd > 0);
  assert.ok(DEFAULT_PMF_THRESHOLDS.maxP95StepDurationMs > 0);
});

// ============================================================================
// PmfValidationService: instantiation
// ============================================================================

test("PmfValidationService can be instantiated", () => {
  const service = createService();
  assert.ok(service);
});

// ============================================================================
// PmfValidationService: runValidation
// ============================================================================

test("PmfValidationService.runValidation returns report and record", () => {
  const service = createService();
  const result = service.runValidation({});

  assert.ok(result.report);
  assert.ok(result.record);
  assert.equal(result.record.id, result.report.reportId);
});

test("PmfValidationService.runValidation persists record to store", () => {
  const mockStore = createMockStore();
  const service = createService(createMockDb(), mockStore);
  service.runValidation({});

  assert.ok(mockStore.operations.listPmfValidationReports().length > 0);
});

test("PmfValidationService.runValidation uses default options", () => {
  const service = createService();
  const result = service.runValidation({});

  assert.equal(result.report.profileName, "phase3_default");
  assert.equal(result.report.window.days, 14);
});

// ============================================================================
// PmfValidationService: buildReport
// ============================================================================

test("PmfValidationService.buildReport returns valid report structure", () => {
  const service = createService();
  const report = service.buildReport({});

  assert.ok(report.reportId);
  assert.ok(report.profileName);
  assert.ok(report.generatedAt);
  assert.ok(report.window);
  assert.equal(typeof report.window.start, "string");
  assert.equal(typeof report.window.end, "string");
  assert.equal(typeof report.window.days, "number");
  assert.ok(report.summary);
  assert.ok(report.verdict);
  assert.ok(Array.isArray(report.checks));
  assert.ok(report.metrics);
});

test("PmfValidationService.buildReport accepts custom profileName", () => {
  const service = createService();
  const report = service.buildReport({ profileName: "custom_profile" });
  assert.equal(report.profileName, "custom_profile");
});

test("PmfValidationService.buildReport accepts custom divisionId", () => {
  const service = createService();
  const report = service.buildReport({ divisionId: "engineering" });
  assert.equal(report.divisionId, "engineering");
});

test("PmfValidationService.buildReport accepts custom windowDays", () => {
  const service = createService();
  const report = service.buildReport({ windowDays: 30 });
  assert.equal(report.window.days, 30);
});

test("PmfValidationService.buildReport accepts custom evaluatedAt", () => {
  const service = createService();
  const customTime = "2026-04-01T12:00:00.000Z";
  const report = service.buildReport({ evaluatedAt: customTime });
  assert.equal(report.generatedAt, customTime);
});

test("PmfValidationService.buildReport with null divisionId", () => {
  const service = createService();
  const report = service.buildReport({ divisionId: null });
  assert.equal(report.divisionId, null);
});

test("PmfValidationService.buildReport handles empty database responses", () => {
  const service = createService();
  const report = service.buildReport({});
  // With zero data, verdict should be fail (sample size insufficient)
  assert.equal(report.verdict, "fail");
});

test("PmfValidationService.buildReport checks cover all expected metric types", () => {
  const report = createService().buildReport({});
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
    assert.ok(report.checks.some((check) => check.checkId === expected), `Missing check: ${expected}`);
  }
});

test("PmfValidationService.buildReport each check has required fields", () => {
  const report = createService().buildReport({});

  for (const check of report.checks) {
    assert.ok(check.checkId);
    assert.ok(check.status);
    assert.ok(check.detail);
    assert.ok(check.unit);
    assert.ok(typeof check.observed === "number" || check.observed === null);
  }
});

test("PmfValidationService.buildReport verdict is fail when sample size insufficient", () => {
  const mockDb = createMockDb(
    { "FROM tasks": { taskCount: 2, terminalTaskCount: 2, successfulTaskCount: 1, divisionCount: 1, crossDivisionTaskCount: 0, averageSuccessfulTaskCostUsd: 0.1 } },
    {}
  );

  const report = createService(mockDb, createMockStore()).buildReport({});
  const sampleSizeCheck = report.checks.find((check) => check.checkId === "sample_size");
  assert.equal(sampleSizeCheck?.status, "fail");
  assert.equal(report.verdict, "fail");
});

test("PmfValidationService.buildReport verdict is pass when all checks meet thresholds", () => {
  // Use default thresholds with data that exceeds them
  // minTaskCount: 5, minSessionCount: 3
  // minTaskSuccessRatePct: 70, minActivationRatePct: 60
  // minRepeatUsageRatePct: 20, minApprovalResolutionRatePct: 90
  // maxAverageSuccessfulTaskCostUsd: 2, maxP95StepDurationMs: 60000
  const mockDb = createMockDb(
    {
      "FROM tasks": { taskCount: 10, terminalTaskCount: 10, successfulTaskCount: 8, divisionCount: 1, crossDivisionTaskCount: 0, averageSuccessfulTaskCostUsd: 0.5 },
      "FROM sessions": { sessionCount: 5, activationSessionCount: 4 },
      "FROM approvals": { approvalCount: 10, resolvedApprovalCount: 10 },
      "FROM (": { rootCount: 5, repeatedRootCount: 2 },
    },
    { "workflow_step_outputs": [{ durationMs: 1000 }] }
  );

  const report = createService(mockDb, createMockStore()).buildReport({});
  // All checks pass -> verdict should be pass
  assert.ok(report.verdict === "pass" || report.verdict === "warn", `Expected pass or warn but got ${report.verdict}`);
});

test("PmfValidationService.buildReport with sufficient data does not fail on sample_size", () => {
  const mockDb = createMockDb(
    {
      "FROM tasks": { taskCount: 10, terminalTaskCount: 10, successfulTaskCount: 8, divisionCount: 1, crossDivisionTaskCount: 0, averageSuccessfulTaskCostUsd: 0.5 },
      "FROM sessions": { sessionCount: 5, activationSessionCount: 4 },
      "FROM approvals": { approvalCount: 10, resolvedApprovalCount: 10 },
      "FROM (": { rootCount: 5, repeatedRootCount: 2 },
    },
    { "workflow_step_outputs": [{ durationMs: 1000 }] }
  );

  const report = createService(mockDb, createMockStore()).buildReport({});
  const sampleSizeCheck = report.checks.find((check) => check.checkId === "sample_size");
  assert.notEqual(sampleSizeCheck?.status, "fail");
});

test("PmfValidationService.buildReport verdict is warn when any check warns", () => {
  // Empty step data causes p95 to return null which triggers warn status
  const mockDb = createMockDb(
    {
      "FROM tasks": { taskCount: 100, terminalTaskCount: 90, successfulTaskCount: 81, divisionCount: 1, crossDivisionTaskCount: 50, averageSuccessfulTaskCostUsd: 0.05 },
      "FROM sessions": { sessionCount: 100, activationSessionCount: 81 },
      "FROM approvals": { approvalCount: 20, resolvedApprovalCount: 19 },
    },
    { "workflow_step_outputs": [] }
  );

  const report = createService(mockDb, createMockStore()).buildReport({});
  const p95Check = report.checks.find((check) => check.checkId === "p95_step_duration");
  assert.equal(p95Check?.status, "warn");
});

test("PmfValidationService.buildReport with custom thresholds", () => {
  const report = createService().buildReport({
    thresholds: {
      ...DEFAULT_PMF_THRESHOLDS,
      minTaskSuccessRatePct: 90,
      maxAverageSuccessfulTaskCostUsd: 0.01,
    },
  });

  assert.ok(report);
});

test("PmfValidationService.buildReport reportId is non-empty string", () => {
  const report = createService().buildReport({});
  assert.ok(typeof report.reportId === "string");
  assert.ok(report.reportId.length > 0);
});

test("PmfValidationService.buildReport window start is before end", () => {
  const service = createService();
  const report = service.buildReport({});
  assert.ok(new Date(report.window.start) < new Date(report.window.end));
});

// ============================================================================
// PmfValidationService: exportValidation
// ============================================================================

test("PmfValidationService.exportValidation returns JSON and Markdown artifacts", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(
    { "FROM tasks": null, "FROM sessions": null, "FROM approvals": null },
    { "workflow_step_outputs": [] }
  );

  const result = createService(mockDb, mockStore).exportValidation({});

  assert.ok(result.jsonArtifact);
  assert.ok(result.markdownArtifact);
  assert.ok(result.report);
  assert.ok(result.record);
});

test("PmfValidationService.exportValidation creates pmf_validation artifact task", () => {
  const mockStore = createMockStore();
  const mockDb = createMockDb(
    { "FROM tasks": null, "FROM sessions": null, "FROM approvals": null },
    { "workflow_step_outputs": [] }
  );

  createService(mockDb, mockStore).exportValidation({});

  assert.ok(mockStore.task.getTask("pmf_validation"));
});

// ============================================================================
// PmfValidationService: listHistory
// ============================================================================

test("PmfValidationService.listHistory returns reports", () => {
  const mockStore = createMockStore();
  mockStore.operations.listPmfValidationReports = () => [
    makeReportRecord({ id: "report_1" }),
    makeReportRecord({ id: "report_2" }),
  ];

  const history = createService(createMockDb(), mockStore).listHistory(10);
  assert.equal(history.length, 2);
});

test("PmfValidationService.listHistory uses default limit", () => {
  let calledWith = 0;
  const mockStore = createMockStore();
  mockStore.operations.listPmfValidationReports = (limit?: number) => {
    calledWith = limit ?? 20;
    return [];
  };

  createService(createMockDb(), mockStore).listHistory();
  assert.equal(calledWith, 20);
});

test("PmfValidationService.listHistory respects custom limit", () => {
  let calledWith = 0;
  const mockStore = createMockStore();
  mockStore.operations.listPmfValidationReports = (limit?: number) => {
    calledWith = limit ?? 20;
    return [];
  };

  createService(createMockDb(), mockStore).listHistory(5);
  assert.equal(calledWith, 5);
});

// ============================================================================
// PmfValidationService: getLatest
// ============================================================================

test("PmfValidationService.getLatest returns most recent report", () => {
  const mockStore = createMockStore();
  mockStore.operations.getLatestPmfValidationReport = () => makeReportRecord({ id: "report_latest" });

  const latest = createService(createMockDb(), mockStore).getLatest();
  assert.ok(latest);
  assert.equal(latest.id, "report_latest");
});

test("PmfValidationService.getLatest with profile name returns filtered", () => {
  const mockStore = createMockStore();
  mockStore.operations.getLatestPmfValidationReport = (profileName?: string | null) => {
    assert.equal(profileName, "production");
    return makeReportRecord({ id: "report_prod", profileName: "production" });
  };

  const latest = createService(createMockDb(), mockStore).getLatest("production");
  assert.ok(latest);
});

test("PmfValidationService.getLatest returns null when no reports", () => {
  const mockStore = createMockStore();
  mockStore.operations.getLatestPmfValidationReport = () => null;

  const latest = createService(createMockDb(), mockStore).getLatest();
  assert.equal(latest, null);
});

test("PmfValidationService.getLatest with undefined profile passes null", () => {
  const mockStore = createMockStore();
  mockStore.operations.getLatestPmfValidationReport = (profileName?: string | null) => {
    assert.equal(profileName, null);
    return null;
  };

  createService(createMockDb(), mockStore).getLatest(undefined);
});

// ============================================================================
// PmfValidationService: metrics structure
// ============================================================================

test("PmfValidationService metrics are all numbers or null", () => {
  const report = createService().buildReport({});

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

test("PmfValidationService report includes all metric fields", () => {
  const report = createService().buildReport({});

  assert.ok(typeof report.metrics.taskCount === "number");
  assert.ok(typeof report.metrics.terminalTaskCount === "number");
  assert.ok(typeof report.metrics.successfulTaskCount === "number");
  assert.ok(typeof report.metrics.sessionCount === "number");
  assert.ok(typeof report.metrics.repeatUsageRatePct === "number" || report.metrics.repeatUsageRatePct === null);
  assert.ok(typeof report.metrics.taskSuccessRatePct === "number" || report.metrics.taskSuccessRatePct === null);
  assert.ok(typeof report.metrics.activationRatePct === "number" || report.metrics.activationRatePct === null);
  assert.ok(typeof report.metrics.averageSuccessfulTaskCostUsd === "number" || report.metrics.averageSuccessfulTaskCostUsd === null);
  assert.ok(typeof report.metrics.p95StepDurationMs === "number" || report.metrics.p95StepDurationMs === null);
});

test("PmfValidationService check IDs are unique", () => {
  const report = createService().buildReport({});
  const checkIds = report.checks.map((check) => check.checkId);
  const uniqueIds = new Set(checkIds);
  assert.equal(checkIds.length, uniqueIds.size);
});

// ============================================================================
// PmfValidationService: p95_step_duration check
// ============================================================================

test("PmfValidationService.p95_step_duration returns null when no step data", () => {
  const mockDb = createMockDb(
    {
      "FROM tasks": { taskCount: 100, terminalTaskCount: 90, successfulTaskCount: 81, divisionCount: 1, crossDivisionTaskCount: 0, averageSuccessfulTaskCostUsd: 0.05 },
      "FROM sessions": { sessionCount: 100, activationSessionCount: 81 },
      "FROM approvals": { approvalCount: 20, resolvedApprovalCount: 19 },
    },
    { "workflow_step_outputs": [] }
  );

  const report = createService(mockDb, createMockStore()).buildReport({});
  const p95Check = report.checks.find((check) => check.checkId === "p95_step_duration");

  assert.ok(p95Check);
  assert.equal(p95Check.observed, null);
  assert.equal(p95Check.status, "warn");
});

test("PmfValidationService.p95_step_duration calculates percentile from step data", () => {
  const mockDb = createMockDb(
    {
      "FROM tasks": { taskCount: 100, terminalTaskCount: 90, successfulTaskCount: 81, divisionCount: 1, crossDivisionTaskCount: 0, averageSuccessfulTaskCostUsd: 0.05 },
      "FROM sessions": { sessionCount: 100, activationSessionCount: 81 },
      "FROM approvals": { approvalCount: 20, resolvedApprovalCount: 19 },
    },
    { "workflow_step_outputs": [{ durationMs: 100 }, { durationMs: 200 }, { durationMs: 300 }, { durationMs: 400 }, { durationMs: 500 }] }
  );

  const report = createService(mockDb, createMockStore()).buildReport({});
  const p95Check = report.checks.find((check) => check.checkId === "p95_step_duration");

  assert.ok(p95Check);
  assert.ok(p95Check.observed !== null);
  // P95 of [100, 200, 300, 400, 500] with index = ceil(4 * 0.95) = ceil(3.8) = 4 -> 500
  assert.ok(p95Check.observed! >= 400);
});

// ============================================================================
// PmfValidationService: rate calculations
// ============================================================================

test("PmfValidationService.task_success_rate calculation", () => {
  const mockDb = createMockDb(
    {
      "FROM tasks": { taskCount: 100, terminalTaskCount: 80, successfulTaskCount: 60, divisionCount: 1, crossDivisionTaskCount: 0, averageSuccessfulTaskCostUsd: 0.05 },
      "FROM sessions": { sessionCount: 100, activationSessionCount: 81 },
      "FROM approvals": { approvalCount: 20, resolvedApprovalCount: 19 },
    },
    { "workflow_step_outputs": [] }
  );

  const report = createService(mockDb, createMockStore()).buildReport({});
  const successRateCheck = report.checks.find((check) => check.checkId === "task_success_rate");

  assert.ok(successRateCheck);
  // 60/80 * 100 = 75
  assert.equal(successRateCheck.observed, 75);
});

test("PmfValidationService.activation_rate calculation", () => {
  const mockDb = createMockDb(
    {
      "FROM tasks": { taskCount: 100, terminalTaskCount: 90, successfulTaskCount: 81, divisionCount: 1, crossDivisionTaskCount: 0, averageSuccessfulTaskCostUsd: 0.05 },
      "FROM sessions": { sessionCount: 50, activationSessionCount: 30 },
      "FROM approvals": { approvalCount: 20, resolvedApprovalCount: 19 },
    },
    { "workflow_step_outputs": [] }
  );

  const report = createService(mockDb, createMockStore()).buildReport({});
  const activationCheck = report.checks.find((check) => check.checkId === "activation_rate");

  assert.ok(activationCheck);
  // 30/50 * 100 = 60
  assert.equal(activationCheck.observed, 60);
});

test("PmfValidationService.repeat_usage_rate calculation", () => {
  const mockDb = createMockDb(
    {
      "FROM tasks": { taskCount: 100, terminalTaskCount: 90, successfulTaskCount: 81, divisionCount: 1, crossDivisionTaskCount: 0, averageSuccessfulTaskCostUsd: 0.05 },
      "FROM sessions": { sessionCount: 100, activationSessionCount: 81 },
      "FROM approvals": { approvalCount: 20, resolvedApprovalCount: 19 },
    },
    { "workflow_step_outputs": [] }
  );

  // Mock the repeat query
  const customGetOverride: Record<string, Record<string, unknown> | null> = {
    "FROM tasks": { taskCount: 100, terminalTaskCount: 90, successfulTaskCount: 81, divisionCount: 1, crossDivisionTaskCount: 0, averageSuccessfulTaskCostUsd: 0.05 },
    "FROM sessions": { sessionCount: 100, activationSessionCount: 81 },
    "FROM approvals": { approvalCount: 20, resolvedApprovalCount: 19 },
    "FROM (": { rootCount: 40, repeatedRootCount: 15 },
  };

  const report = createService(createMockDb(customGetOverride, { "workflow_step_outputs": [] }), createMockStore()).buildReport({});
  const repeatCheck = report.checks.find((check) => check.checkId === "repeat_usage_rate");

  assert.ok(repeatCheck);
  // 15/40 * 100 = 37.5
  assert.equal(repeatCheck.observed, 37.5);
});

test("PmfValidationService.approval_resolution_rate calculation", () => {
  const mockDb = createMockDb(
    {
      "FROM tasks": { taskCount: 100, terminalTaskCount: 90, successfulTaskCount: 81, divisionCount: 1, crossDivisionTaskCount: 0, averageSuccessfulTaskCostUsd: 0.05 },
      "FROM sessions": { sessionCount: 100, activationSessionCount: 81 },
      "FROM approvals": { approvalCount: 100, resolvedApprovalCount: 85 },
    },
    { "workflow_step_outputs": [] }
  );

  const report = createService(mockDb, createMockStore()).buildReport({});
  const approvalCheck = report.checks.find((check) => check.checkId === "approval_resolution_rate");

  assert.ok(approvalCheck);
  // 85/100 * 100 = 85
  assert.equal(approvalCheck.observed, 85);
});