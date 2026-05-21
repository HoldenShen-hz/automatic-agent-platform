import assert from "node:assert/strict";
import test from "node:test";

import {
  createRecoveryReport,
  summarizeRecoveryReports,
  type RecoveryReport,
  type RecoveryReportStatus,
  type RecoveryReportSummary,
} from "../../../../../src/platform/five-plane-execution/recovery/recovery-report.js";

test("RecoveryReportStatus type accepts all valid values", () => {
  const statuses: RecoveryReportStatus[] = ["success", "failure", "skipped", "escalated"];
  assert.equal(statuses.length, 4);
});

test("RecoveryReport interface structure", () => {
  const report: RecoveryReport = {
    reportId: "report-123",
    executionId: "exec-456",
    taskId: "task-789",
    action: "resume_same_worker",
    phase: "immediate_retry",
    attemptNumber: 1,
    overallAttemptNumber: 1,
    status: "success",
    errorCode: null,
    errorMessage: null,
    recovered: true,
    attemptedAt: "2026-05-21T10:00:00.000Z",
    completedAt: "2026-05-21T10:00:01.000Z",
    durationMs: 1000,
  };

  assert.equal(report.reportId, "report-123");
  assert.equal(report.executionId, "exec-456");
  assert.equal(report.taskId, "task-789");
  assert.equal(report.action, "resume_same_worker");
  assert.equal(report.phase, "immediate_retry");
  assert.equal(report.attemptNumber, 1);
  assert.equal(report.overallAttemptNumber, 1);
  assert.equal(report.status, "success");
  assert.equal(report.errorCode, null);
  assert.equal(report.errorMessage, null);
  assert.equal(report.recovered, true);
  assert.equal(report.attemptedAt, "2026-05-21T10:00:00.000Z");
  assert.equal(report.completedAt, "2026-05-21T10:00:01.000Z");
  assert.equal(report.durationMs, 1000);
});

test("RecoveryReportSummary interface structure", () => {
  const summary: RecoveryReportSummary = {
    totalAttempts: 10,
    successfulRecoveries: 6,
    failedRecoveries: 2,
    skippedRecoveries: 1,
    escalatedRecoveries: 1,
    averageDurationMs: 1500,
  };

  assert.equal(summary.totalAttempts, 10);
  assert.equal(summary.successfulRecoveries, 6);
  assert.equal(summary.failedRecoveries, 2);
  assert.equal(summary.skippedRecoveries, 1);
  assert.equal(summary.escalatedRecoveries, 1);
  assert.equal(summary.averageDurationMs, 1500);
});

test("createRecoveryReport calculates durationMs when completedAt is provided", () => {
  const report = createRecoveryReport({
    reportId: "report-123",
    executionId: "exec-456",
    taskId: "task-789",
    action: "retry_new_ticket",
    phase: "backoff_retry",
    attemptNumber: 1,
    overallAttemptNumber: 3,
    status: "success",
    errorCode: null,
    errorMessage: null,
    recovered: true,
    attemptedAt: "2026-05-21T10:00:00.000Z",
    completedAt: "2026-05-21T10:00:02.500Z",
  });

  assert.equal(report.durationMs, 2500);
});

test("createRecoveryReport sets durationMs to null when completedAt is null", () => {
  const report = createRecoveryReport({
    reportId: "report-123",
    executionId: "exec-456",
    taskId: "task-789",
    action: "escalate_takeover",
    phase: "escalate",
    attemptNumber: 1,
    overallAttemptNumber: 10,
    status: "escalated",
    errorCode: "ESCALATION_REQUIRED",
    errorMessage: "Human intervention required",
    recovered: false,
    attemptedAt: "2026-05-21T10:00:00.000Z",
    completedAt: null,
  });

  assert.equal(report.durationMs, null);
});

test("createRecoveryReport preserves all fields correctly", () => {
  const report = createRecoveryReport({
    reportId: "report-abc",
    executionId: "exec-xyz",
    taskId: "task-def",
    action: "move_dead_letter",
    phase: "dead_letter",
    attemptNumber: 5,
    overallAttemptNumber: 8,
    status: "failure",
    errorCode: "DEAD_LETTER_THRESHOLD",
    errorMessage: "Maximum attempts exceeded",
    recovered: false,
    attemptedAt: "2026-05-21T12:30:00.000Z",
    completedAt: "2026-05-21T12:30:03.000Z",
  });

  assert.equal(report.reportId, "report-abc");
  assert.equal(report.executionId, "exec-xyz");
  assert.equal(report.taskId, "task-def");
  assert.equal(report.action, "move_dead_letter");
  assert.equal(report.phase, "dead_letter");
  assert.equal(report.attemptNumber, 5);
  assert.equal(report.overallAttemptNumber, 8);
  assert.equal(report.status, "failure");
  assert.equal(report.errorCode, "DEAD_LETTER_THRESHOLD");
  assert.equal(report.errorMessage, "Maximum attempts exceeded");
  assert.equal(report.recovered, false);
  assert.equal(report.durationMs, 3000);
});

test("summarizeRecoveryReports returns zeros for empty array", () => {
  const summary = summarizeRecoveryReports([]);

  assert.equal(summary.totalAttempts, 0);
  assert.equal(summary.successfulRecoveries, 0);
  assert.equal(summary.failedRecoveries, 0);
  assert.equal(summary.skippedRecoveries, 0);
  assert.equal(summary.escalatedRecoveries, 0);
  assert.equal(summary.averageDurationMs, null);
});

test("summarizeRecoveryReports counts all success statuses", () => {
  const reports: RecoveryReport[] = [
    createReport("r1", "success", 1000),
    createReport("r2", "success", 2000),
    createReport("r3", "success", 1500),
  ];

  const summary = summarizeRecoveryReports(reports);

  assert.equal(summary.totalAttempts, 3);
  assert.equal(summary.successfulRecoveries, 3);
  assert.equal(summary.failedRecoveries, 0);
  assert.equal(summary.skippedRecoveries, 0);
  assert.equal(summary.escalatedRecoveries, 0);
  assert.equal(summary.averageDurationMs, 1500); // (1000 + 2000 + 1500) / 3
});

test("summarizeRecoveryReports counts all failure statuses", () => {
  const reports: RecoveryReport[] = [
    createReport("r1", "failure", 500),
    createReport("r2", "failure", 800),
  ];

  const summary = summarizeRecoveryReports(reports);

  assert.equal(summary.totalAttempts, 2);
  assert.equal(summary.successfulRecoveries, 0);
  assert.equal(summary.failedRecoveries, 2);
  assert.equal(summary.skippedRecoveries, 0);
  assert.equal(summary.escalatedRecoveries, 0);
  assert.equal(summary.averageDurationMs, 650); // (500 + 800) / 2
});

test("summarizeRecoveryReports counts all skipped statuses", () => {
  const reports: RecoveryReport[] = [
    createReport("r1", "skipped", null),
    createReport("r2", "skipped", null),
    createReport("r3", "skipped", null),
  ];

  const summary = summarizeRecoveryReports(reports);

  assert.equal(summary.totalAttempts, 3);
  assert.equal(summary.successfulRecoveries, 0);
  assert.equal(summary.failedRecoveries, 0);
  assert.equal(summary.skippedRecoveries, 3);
  assert.equal(summary.escalatedRecoveries, 0);
  assert.equal(summary.averageDurationMs, null); // No reports have duration
});

test("summarizeRecoveryReports counts all escalated statuses", () => {
  const reports: RecoveryReport[] = [
    createReport("r1", "escalated", 3000),
  ];

  const summary = summarizeRecoveryReports(reports);

  assert.equal(summary.totalAttempts, 1);
  assert.equal(summary.successfulRecoveries, 0);
  assert.equal(summary.failedRecoveries, 0);
  assert.equal(summary.skippedRecoveries, 0);
  assert.equal(summary.escalatedRecoveries, 1);
  assert.equal(summary.averageDurationMs, 3000);
});

test("summarizeRecoveryReports calculates correct average with mixed durations", () => {
  const reports: RecoveryReport[] = [
    createReport("r1", "success", 1000),
    createReport("r2", "failure", null), // No duration
    createReport("r3", "success", 3000),
  ];

  const summary = summarizeRecoveryReports(reports);

  // Only 2 reports have duration: (1000 + 3000) / 2 = 2000
  assert.equal(summary.averageDurationMs, 2000);
});

test("summarizeRecoveryReports with mixed statuses", () => {
  const reports: RecoveryReport[] = [
    createReport("r1", "success", 1000),
    createReport("r2", "failure", 500),
    createReport("r3", "skipped", null),
    createReport("r4", "escalated", 3000),
    createReport("r5", "success", 2000),
  ];

  const summary = summarizeRecoveryReports(reports);

  assert.equal(summary.totalAttempts, 5);
  assert.equal(summary.successfulRecoveries, 2);
  assert.equal(summary.failedRecoveries, 1);
  assert.equal(summary.skippedRecoveries, 1);
  assert.equal(summary.escalatedRecoveries, 1);
  // Duration from reports with duration: 1000 + 500 + 3000 + 2000 = 6500
  // 4 reports have duration
  // 6500 / 4 = 1625
  assert.equal(summary.averageDurationMs, 1625);
  // 4 reports have duration: 1000 + 500 + 3000 + 2000 = 6500
  // 6500 / 4 = 1625
  assert.equal(summary.averageDurationMs, 1625);
});

test("summarizeRecoveryReports averageDurationMs is null when no reports have duration", () => {
  const reports: RecoveryReport[] = [
    createReport("r1", "success", null),
    createReport("r2", "failure", null),
    createReport("r3", "skipped", null),
  ];

  const summary = summarizeRecoveryReports(reports);

  assert.equal(summary.totalAttempts, 3);
  assert.equal(summary.averageDurationMs, null);
});

test("summarizeRecoveryReports handles single report", () => {
  const reports: RecoveryReport[] = [
    createReport("r1", "success", 1500),
  ];

  const summary = summarizeRecoveryReports(reports);

  assert.equal(summary.totalAttempts, 1);
  assert.equal(summary.successfulRecoveries, 1);
  assert.equal(summary.failedRecoveries, 0);
  assert.equal(summary.skippedRecoveries, 0);
  assert.equal(summary.escalatedRecoveries, 0);
  assert.equal(summary.averageDurationMs, 1500);
});

test("summarizeRecoveryReports with all status types in single report", () => {
  // Test each status type individually
  const successSummary = summarizeRecoveryReports([createReport("r1", "success", 1000)]);
  assert.equal(successSummary.successfulRecoveries, 1);

  const failureSummary = summarizeRecoveryReports([createReport("r1", "failure", 1000)]);
  assert.equal(failureSummary.failedRecoveries, 1);

  const skippedSummary = summarizeRecoveryReports([createReport("r1", "skipped", 1000)]);
  assert.equal(skippedSummary.skippedRecoveries, 1);

  const escalatedSummary = summarizeRecoveryReports([createReport("r1", "escalated", 1000)]);
  assert.equal(escalatedSummary.escalatedRecoveries, 1);
});

// Helper function to create test recovery reports
function createReport(
  reportId: string,
  status: RecoveryReportStatus,
  durationMs: number | null,
): RecoveryReport {
  const attemptedAt = "2026-05-21T10:00:00.000Z";
  const completedAt = durationMs != null
    ? new Date(new Date(attemptedAt).getTime() + durationMs).toISOString()
    : null;

  return createRecoveryReport({
    reportId,
    executionId: `exec-${reportId}`,
    taskId: `task-${reportId}`,
    action: "retry_new_ticket",
    phase: "backoff_retry",
    attemptNumber: 1,
    overallAttemptNumber: 1,
    status,
    errorCode: status === "failure" || status === "escalated" ? "TEST_ERROR" : null,
    errorMessage: status === "failure" || status === "escalated" ? "Test error" : null,
    recovered: status === "success",
    attemptedAt,
    completedAt,
  });
}
