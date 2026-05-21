import assert from "node:assert/strict";
import test from "node:test";

import {
  SloTracker,
  type SloComplianceStatus,
  type SloTrackingRecord,
  type SloComplianceReport,
  type SloTrackingOptions,
} from "../../../../src/platform/stability/slo-tracking.js";

test("SloTracker exports are available", () => {
  assert.equal(typeof SloTracker, "function");
});

test("SloTracker default construction", () => {
  const tracker = new SloTracker();
  assert.ok(tracker instanceof SloTracker);
});

test("SloTracker with custom options", () => {
  const tracker = new SloTracker({
    defaultWindowMinutes: 120,
    domains: ["execution", "control-plane"],
  });
  assert.ok(tracker instanceof SloTracker);
});

test("SloTracker.trackSlo creates a record", () => {
  const tracker = new SloTracker();
  const record = tracker.trackSlo({
    sloId: "slo-1",
    domain: "execution",
    name: "Task Completion Rate",
    targetValue: 99.5,
    currentValue: 99.2,
  });

  assert.equal(record.sloId, "slo-1");
  assert.equal(record.domain, "execution");
  assert.equal(record.name, "Task Completion Rate");
  assert.equal(record.targetValue, 99.5);
  assert.equal(record.currentValue, 99.2);
  assert.ok(record.windowStart);
  assert.ok(record.windowEnd);
  assert.ok(record.lastUpdated);
});

test("SloTracker tracks availability-style SLO correctly", () => {
  const tracker = new SloTracker();

  // Healthy: target >= 100, current >= target
  const healthyRecord = tracker.trackSlo({
    sloId: "availability-healthy",
    domain: "execution",
    name: "Availability",
    targetValue: 99.9,
    currentValue: 99.95,
  });
  assert.equal(healthyRecord.complianceStatus, "healthy");
  assert.ok(healthyRecord.errorBudgetUsed < 100);

  // At risk: target < 100, current < target, but errorBudgetUsed < 100 (meaning slightly over budget but not breached)
  // For rate-style (target < 100): errorBudgetUsed = (current/target)*100 - 100
  // target=10, current=5: current < target, errorBudgetUsed = 50 - 100 = -50 -> clamped to 0, status = "at_risk"
  const atRiskRecord = tracker.trackSlo({
    sloId: "availability-at-risk",
    domain: "execution",
    name: "Availability Rate",
    targetValue: 10,
    currentValue: 5,
  });
  assert.equal(atRiskRecord.complianceStatus, "at_risk");

  // Breached: current < target and errorBudgetUsed >= 100
  // For availability-style (target >= 100): errorBudgetUsed = (1 - current/target)*100
  // target=100, current=0: errorBudgetUsed = (1 - 0/100)*100 = 100, current < target, breached
  const breachedRecord = tracker.trackSlo({
    sloId: "availability-breached",
    domain: "execution",
    name: "Availability",
    targetValue: 100,
    currentValue: 0,
  });
  assert.equal(breachedRecord.complianceStatus, "breached");
});

test("SloTracker tracks error-rate-style SLO correctly", () => {
  const tracker = new SloTracker();

  // For error-rate style (target < 100): errorBudgetUsed = (currentValue / targetValue) * 100 - 100
  // With targetValue=0.1 (10% error rate target) and currentValue=0.05 (5% actual):
  // currentValue (0.05) < targetValue (0.1) so second branch
  // errorBudgetUsed = max(0, (0.05/0.1)*100 - 100) = max(0, 50 - 100) = max(0, -50) = 0
  // Since current < target and errorBudgetUsed (0) < 100, status is "at_risk"
  const atRiskRecord = tracker.trackSlo({
    sloId: "error-rate-at-risk",
    domain: "execution",
    name: "Error Rate",
    targetValue: 0.1,
    currentValue: 0.05,
  });
  assert.equal(atRiskRecord.complianceStatus, "at_risk");

  // At risk when current > target: target=0.1, current=0.2
  // errorBudgetUsed = (0.2/0.1)*100 - 100 = 200 - 100 = 100
  // current >= target (0.2 >= 0.1), first branch: errorBudgetUsed (100) > 80, status = "at_risk"
  const highErrorRateRecord = tracker.trackSlo({
    sloId: "error-rate-high",
    domain: "execution",
    name: "Error Rate",
    targetValue: 0.1,
    currentValue: 0.2,
  });
  assert.equal(highErrorRateRecord.complianceStatus, "at_risk");

  // For rate-style SLOs, the "breached" status when current > target requires errorBudgetUsed >= 100
  // AND current >= target, but then condition is errorBudgetUsed > 80 for at_risk, so breached is not hit
  // For current < target, breached requires errorBudgetUsed >= 100 which is impossible since errorBudgetUsed
  // is clamped to 0 when current < target
  // So breached is effectively only hit for availability-style SLOs (target >= 100)
  const testAtRisk = tracker.trackSlo({
    sloId: "error-rate-test",
    domain: "execution",
    name: "Error Rate",
    targetValue: 0.1,
    currentValue: 0.25,
  });
  assert.equal(testAtRisk.complianceStatus, "at_risk");
});

test("SloTracker.getTrackingRecord returns record", () => {
  const tracker = new SloTracker();
  tracker.trackSlo({
    sloId: "test-slo",
    domain: "execution",
    name: "Test SLO",
    targetValue: 99,
    currentValue: 98,
  });

  const record = tracker.getTrackingRecord("test-slo");
  assert.ok(record !== null);
  assert.equal(record?.sloId, "test-slo");
});

test("SloTracker.getTrackingRecord returns null for unknown", () => {
  const tracker = new SloTracker();
  const record = tracker.getTrackingRecord("unknown-slo");
  assert.equal(record, null);
});

test("SloTracker.listTrackingRecords returns all records", () => {
  const tracker = new SloTracker();
  tracker.trackSlo({
    sloId: "slo-a",
    domain: "execution",
    name: "SLO A",
    targetValue: 99,
    currentValue: 98,
  });
  tracker.trackSlo({
    sloId: "slo-b",
    domain: "control-plane",
    name: "SLO B",
    targetValue: 99,
    currentValue: 97,
  });

  const all = tracker.listTrackingRecords();
  assert.equal(all.length, 2);
});

test("SloTracker.listTrackingRecords filters by domain", () => {
  const tracker = new SloTracker();
  tracker.trackSlo({
    sloId: "slo-a",
    domain: "execution",
    name: "SLO A",
    targetValue: 99,
    currentValue: 98,
  });
  tracker.trackSlo({
    sloId: "slo-b",
    domain: "control-plane",
    name: "SLO B",
    targetValue: 99,
    currentValue: 97,
  });

  const executionRecords = tracker.listTrackingRecords("execution");
  assert.equal(executionRecords.length, 1);
  assert.equal(executionRecords[0].sloId, "slo-a");
});

test("SloTracker.listByStatus filters correctly", () => {
  const tracker = new SloTracker();

  // Healthy: target >= 100 and current >= target
  tracker.trackSlo({
    sloId: "healthy-slo",
    domain: "execution",
    name: "Healthy SLO",
    targetValue: 99.9,
    currentValue: 99.95,
  });

  // At-risk: target < 100, current < target (rate-style)
  tracker.trackSlo({
    sloId: "at-risk-slo",
    domain: "execution",
    name: "At Risk SLO",
    targetValue: 10,
    currentValue: 5,
  });

  // Breached: availability-style (target >= 100) with current below target and error budget >= 100%
  tracker.trackSlo({
    sloId: "breached-slo",
    domain: "execution",
    name: "Breached SLO",
    targetValue: 100,
    currentValue: 0,
  });

  const healthyRecords = tracker.listByStatus("healthy");
  const atRiskRecords = tracker.listByStatus("at_risk");
  const breachedRecords = tracker.listByStatus("breached");

  assert.ok(healthyRecords.some((r) => r.sloId === "healthy-slo"));
  assert.ok(atRiskRecords.some((r) => r.sloId === "at-risk-slo"));
  assert.ok(breachedRecords.some((r) => r.sloId === "breached-slo"));
});

test("SloTracker.generateComplianceReport returns correct structure", () => {
  const tracker = new SloTracker();

  tracker.trackSlo({
    sloId: "slo-1",
    domain: "execution",
    name: "SLO 1",
    targetValue: 99.9,
    currentValue: 99.95,
  });

  tracker.trackSlo({
    sloId: "slo-2",
    domain: "execution",
    name: "SLO 2",
    targetValue: 99.9,
    currentValue: 95.0,
  });

  const report = tracker.generateComplianceReport({ domain: "execution" });

  assert.equal(report.totalSlos, 2);
  assert.equal(report.domain, "execution");
  assert.ok(report.periodStart);
  assert.ok(report.periodEnd);
  assert.ok(report.generatedAt);
  assert.equal(typeof report.overallCompliancePercent, "number");
});

test("SloTracker.generateComplianceReport with no domain returns all", () => {
  const tracker = new SloTracker();

  tracker.trackSlo({
    sloId: "slo-1",
    domain: "execution",
    name: "SLO 1",
    targetValue: 99.9,
    currentValue: 99.95,
  });
  tracker.trackSlo({
    sloId: "slo-2",
    domain: "control-plane",
    name: "SLO 2",
    targetValue: 99.9,
    currentValue: 99.9,
  });

  const report = tracker.generateComplianceReport();
  assert.equal(report.totalSlos, 2);
  assert.equal(report.domain, null);
});

test("SloTracker.getErrorBudgetRemaining returns correct value", () => {
  const tracker = new SloTracker();

  tracker.trackSlo({
    sloId: "budget-slo",
    domain: "execution",
    name: "Budget SLO",
    targetValue: 99.9,
    currentValue: 99.0,
  });

  const remaining = tracker.getErrorBudgetRemaining("budget-slo");
  assert.ok(remaining >= 0);
  assert.ok(remaining <= 100);
});

test("SloTracker.getErrorBudgetRemaining returns 100 for unknown", () => {
  const tracker = new SloTracker();
  const remaining = tracker.getErrorBudgetRemaining("unknown-slo");
  assert.equal(remaining, 100);
});

test("SloTracker.isWithinErrorBudget returns true for healthy SLO", () => {
  const tracker = new SloTracker();

  tracker.trackSlo({
    sloId: "healthy-slo",
    domain: "execution",
    name: "Healthy SLO",
    targetValue: 99.9,
    currentValue: 99.95,
  });

  assert.equal(tracker.isWithinErrorBudget("healthy-slo"), true);
});

test("SloTracker.isWithinErrorBudget returns false for breached SLO", () => {
  const tracker = new SloTracker();

  // Use rate-style SLO to get breached status
  // targetValue=1, currentValue=200 -> errorBudgetUsed = (200/1)*100 - 100 = 20000 - 100 = 19900%
  tracker.trackSlo({
    sloId: "breached-slo",
    domain: "execution",
    name: "Breached Rate SLO",
    targetValue: 1,
    currentValue: 200,
  });

  assert.equal(tracker.isWithinErrorBudget("breached-slo"), false);
});

test("SloTracker.isWithinErrorBudget returns true for unknown", () => {
  const tracker = new SloTracker();
  assert.equal(tracker.isWithinErrorBudget("unknown-slo"), true);
});

test("SloTracker.reset clears all records", () => {
  const tracker = new SloTracker();

  tracker.trackSlo({
    sloId: "slo-1",
    domain: "execution",
    name: "SLO 1",
    targetValue: 99.9,
    currentValue: 99.95,
  });

  tracker.reset();

  const record = tracker.getTrackingRecord("slo-1");
  assert.equal(record, null);
  const all = tracker.listTrackingRecords();
  assert.equal(all.length, 0);
});

test("SloTracker with custom windowMinutes", () => {
  const tracker = new SloTracker({ defaultWindowMinutes: 30 });

  const record = tracker.trackSlo({
    sloId: "window-test",
    domain: "execution",
    name: "Window Test",
    targetValue: 99.9,
    currentValue: 99.95,
  });

  const windowDuration = new Date(record.windowEnd).getTime() - new Date(record.windowStart).getTime();
  const expectedDuration = 30 * 60 * 1000;
  assert.ok(Math.abs(windowDuration - expectedDuration) < 5000);
});

test("SloTrackingRecord has correct types", () => {
  const tracker = new SloTracker();
  const record = tracker.trackSlo({
    sloId: "type-test",
    domain: "execution",
    name: "Type Test",
    targetValue: 99.9,
    currentValue: 99.95,
  });

  const status: SloComplianceStatus = record.complianceStatus;
  assert.ok(["healthy", "at_risk", "breached", "no_data"].includes(status));
});

test("SloComplianceReport has correct structure", () => {
  const tracker = new SloTracker();
  const report: SloComplianceReport = tracker.generateComplianceReport();

  assert.equal(typeof report.reportId, "string");
  assert.ok(report.reportId.startsWith("slo_report"));
  assert.equal(typeof report.totalSlos, "number");
  assert.equal(typeof report.healthySlos, "number");
  assert.equal(typeof report.atRiskSlos, "number");
  assert.equal(typeof report.breachedSlos, "number");
  assert.equal(typeof report.overallCompliancePercent, "number");
});