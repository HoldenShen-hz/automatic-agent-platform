import assert from "node:assert/strict";
import test from "node:test";

import {
  PmfValidationService,
  DEFAULT_PMF_THRESHOLDS,
} from "../../../../src/scale-ecosystem/intelligence/pmf-validation-service.js";

// Mock stores and db
function createMockStore() {
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

function createMockDb() {
  return {
    connection: {
      prepare: () => ({
        get: () => null,
        all: () => [],
      }),
    },
  };
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
  const service = new PmfValidationService(createMockDb() as any, createMockStore() as any);

  assert.ok(service);
});

test("PmfValidationService runValidation returns report and record", () => {
  const mockStore = createMockStore();
  mockStore.operations.insertPmfValidationReport = () => {};

  const service = new PmfValidationService(createMockDb() as any, mockStore as any);

  const result = service.runValidation({});

  assert.ok(result.report);
  assert.ok(result.record);
  assert.ok(result.report.verdict);
  assert.ok(result.report.reportId);
  assert.ok(result.report.checks);
  assert.ok(result.report.metrics);
});

test("PmfValidationService buildReport returns valid report structure", () => {
  const service = new PmfValidationService(createMockDb() as any, createMockStore() as any);

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
  const service = new PmfValidationService(createMockDb() as any, createMockStore() as any);

  const report = service.buildReport({ windowDays: 30 });

  assert.equal(report.window.days, 30);
});

test("PmfValidationService buildReport accepts custom profile name", () => {
  const service = new PmfValidationService(createMockDb() as any, createMockStore() as any);

  const report = service.buildReport({ profileName: "custom_profile" });

  assert.equal(report.profileName, "custom_profile");
});

test("PmfValidationService buildReport accepts custom division id", () => {
  const service = new PmfValidationService(createMockDb() as any, createMockStore() as any);

  const report = service.buildReport({ divisionId: "engineering" });

  assert.equal(report.divisionId, "engineering");
});

test("PmfValidationService buildReport calculates checks correctly for pass", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({
      taskCount: 100,
      terminalTaskCount: 90,
      successfulTaskCount: 81,
      divisionCount: 1,
      crossDivisionTaskCount: 50,
      averageSuccessfulTaskCostUsd: 0.05,
    }),
    all: () => [],
  });

  const mockStore = createMockStore();

  const service = new PmfValidationService(mockDb as any, mockStore as any);

  const report = service.buildReport({});

  // With sufficient samples and good metrics, should pass
  const sampleSizeCheck = report.checks.find(c => c.checkId === "sample_size");
  assert.ok(sampleSizeCheck);
  assert.equal(sampleSizeCheck.status, "pass");
});

test("PmfValidationService buildReport handles null metrics gracefully", () => {
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => null,
    all: () => [],
  });

  const mockStore = createMockStore();

  const service = new PmfValidationService(mockDb as any, mockStore as any);

  const report = service.buildReport({});

  assert.ok(report);
  assert.equal(report.verdict, "fail"); // Should fail due to insufficient samples
});

test("PmfValidationService exportValidation returns artifacts", () => {
  const mockStore = createMockStore();
  mockStore.operations.insertPmfValidationReport = () => {};
  mockStore.task.getTask = () => null;
  mockStore.task.insertTask = () => {};

  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => null,
    all: () => [],
  });

  const service = new PmfValidationService(mockDb as any, mockStore as any);

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

  const service = new PmfValidationService(createMockDb() as any, mockStore as any);

  const history = service.listHistory(10);

  assert.equal(history.length, 2);
});

test("PmfValidationService getLatest returns most recent report", () => {
  const mockStore = createMockStore();
  mockStore.operations.getLatestPmfValidationReport = () => ({ id: "report_latest" } as any);

  const service = new PmfValidationService(createMockDb() as any, mockStore as any);

  const latest = service.getLatest();

  assert.ok(latest);
  assert.equal((latest as any).id, "report_latest");
});

test("PmfValidationService getLatest with profile returns filtered report", () => {
  const mockStore = createMockStore();
  mockStore.operations.getLatestPmfValidationReport = () => ({ id: "report_production" } as any);

  const service = new PmfValidationService(createMockDb() as any, mockStore as any);

  const latest = service.getLatest("production");

  assert.ok(latest);
});

test("PmfValidationService getLatest returns null when no reports", () => {
  const mockStore = createMockStore();
  mockStore.operations.getLatestPmfValidationReport = () => null;

  const service = new PmfValidationService(createMockDb() as any, mockStore as any);

  const latest = service.getLatest();

  assert.equal(latest, null);
});

test("PmfValidationService buildReport with custom thresholds", () => {
  const service = new PmfValidationService(createMockDb() as any, createMockStore() as any);

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
  const mockDb = createMockDb();
  mockDb.connection.prepare = () => ({
    get: () => ({
      taskCount: 5, // Very low
      terminalTaskCount: 5,
      successfulTaskCount: 3,
      divisionCount: 1,
      crossDivisionTaskCount: 2,
      averageSuccessfulTaskCostUsd: 0.10,
    }),
    all: () => [],
  });

  const mockStore = createMockStore();

  const service = new PmfValidationService(mockDb as any, mockStore as any);

  const report = service.buildReport({});

  const sampleSizeCheck = report.checks.find(c => c.checkId === "sample_size");
  assert.equal(sampleSizeCheck?.status, "fail");
  assert.equal(report.verdict, "fail");
});

test("PmfValidationService check IDs are unique", () => {
  const service = new PmfValidationService(createMockDb() as any, createMockStore() as any);

  const report = service.buildReport({});

  const checkIds = report.checks.map(c => c.checkId);
  const uniqueIds = new Set(checkIds);
  assert.equal(checkIds.length, uniqueIds.size);
});

test("PmfValidationService checks cover all expected metric types", () => {
  const service = new PmfValidationService(createMockDb() as any, createMockStore() as any);

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
  const service = new PmfValidationService(createMockDb() as any, createMockStore() as any);

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
  const service = new PmfValidationService(createMockDb() as any, createMockStore() as any);

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

  const service = new PmfValidationService(createMockDb() as any, mockStore as any);

  const result = service.runValidation({});

  assert.ok(result.record);
  assert.equal(result.record.id, result.report.reportId);
});
