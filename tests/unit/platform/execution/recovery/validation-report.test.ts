import assert from "node:assert/strict";
import test from "node:test";

import {
  createValidationReport,
  hasFailedRequiredChecks,
  getFailedCheckCount,
  type ValidationReport,
  type CheckResult,
  type ValidationDecision,
} from "../../../../../src/platform/five-plane-execution/recovery/validation-report.js";

test("createValidationReport returns pass decision when all checks pass [validation-report]", () => {
  const checks: readonly CheckResult[] = [
    {
      checkId: "check_1",
      name: "TypeScript",
      type: "typecheck",
      passed: true,
      errorCount: 0,
      warningCount: 0,
      errors: [],
      durationMs: 100,
      required: true,
    },
    {
      checkId: "check_2",
      name: "Lint",
      type: "lint",
      passed: true,
      errorCount: 0,
      warningCount: 0,
      errors: [],
      durationMs: 50,
      required: false,
    },
  ];

  const report = createValidationReport({
    reportId: "report_1",
    taskId: "task_1",
    bundleId: "bundle_1",
    checks,
    summary: "All checks passed",
  });

  assert.equal(report.decision, "pass");
  assert.equal(report.checks.length, 2);
  assert.ok(report.createdAt);
});

test("createValidationReport returns fail decision when required check fails [validation-report]", () => {
  const checks: readonly CheckResult[] = [
    {
      checkId: "check_1",
      name: "Tests",
      type: "test",
      passed: false,
      errorCount: 2,
      warningCount: 0,
      errors: [],
      durationMs: 100,
      required: true,
    },
  ];

  const report = createValidationReport({
    reportId: "report_1",
    taskId: "task_1",
    bundleId: "bundle_1",
    checks,
  });

  assert.equal(report.decision, "fail");
});

test("createValidationReport returns fail decision when any check fails [validation-report]", () => {
  const checks: readonly CheckResult[] = [
    {
      checkId: "check_1",
      name: "TypeScript",
      type: "typecheck",
      passed: true,
      errorCount: 0,
      warningCount: 0,
      errors: [],
      durationMs: 100,
      required: false,
    },
    {
      checkId: "check_2",
      name: "Lint",
      type: "lint",
      passed: false,
      errorCount: 1,
      warningCount: 0,
      errors: [],
      durationMs: 50,
      required: false,
    },
  ];

  const report = createValidationReport({
    reportId: "report_1",
    taskId: "task_1",
    bundleId: "bundle_1",
    checks,
  });

  assert.equal(report.decision, "fail");
});

test("createValidationReport returns warning decision when no failures but has warnings [validation-report]", () => {
  const checks: readonly CheckResult[] = [
    {
      checkId: "check_1",
      name: "TypeScript",
      type: "typecheck",
      passed: true,
      errorCount: 0,
      warningCount: 0,
      errors: [],
      durationMs: 100,
      required: true,
    },
    {
      checkId: "check_2",
      name: "Lint",
      type: "lint",
      passed: true,
      errorCount: 0,
      warningCount: 2,
      errors: [],
      durationMs: 50,
      required: false,
    },
  ];

  const report = createValidationReport({
    reportId: "report_1",
    taskId: "task_1",
    bundleId: "bundle_1",
    checks,
  });

  assert.equal(report.decision, "warning");
});

test("createValidationReport uses provided summary [validation-report]", () => {
  const report = createValidationReport({
    reportId: "report_1",
    taskId: "task_1",
    bundleId: "bundle_1",
    checks: [],
    summary: "Custom summary",
  });

  assert.equal(report.summary, "Custom summary");
});

test("createValidationReport defaults summary to empty string [validation-report]", () => {
  const report = createValidationReport({
    reportId: "report_1",
    taskId: "task_1",
    bundleId: "bundle_1",
    checks: [],
  });

  assert.equal(report.summary, "");
});

test("hasFailedRequiredChecks returns true when required check failed [validation-report]", () => {
  const checks: readonly CheckResult[] = [
    {
      checkId: "check_1",
      name: "Tests",
      type: "test",
      passed: false,
      errorCount: 1,
      warningCount: 0,
      errors: [],
      durationMs: 100,
      required: true,
    },
  ];

  const report = createValidationReport({
    reportId: "report_1",
    taskId: "task_1",
    bundleId: "bundle_1",
    checks,
  });

  assert.equal(hasFailedRequiredChecks(report), true);
});

test("hasFailedRequiredChecks returns false when only optional check failed [validation-report]", () => {
  const checks: readonly CheckResult[] = [
    {
      checkId: "check_1",
      name: "Style",
      type: "lint",
      passed: false,
      errorCount: 1,
      warningCount: 0,
      errors: [],
      durationMs: 100,
      required: false,
    },
  ];

  const report = createValidationReport({
    reportId: "report_1",
    taskId: "task_1",
    bundleId: "bundle_1",
    checks,
  });

  assert.equal(hasFailedRequiredChecks(report), false);
});

test("hasFailedRequiredChecks returns false when all checks pass [validation-report]", () => {
  const checks: readonly CheckResult[] = [
    {
      checkId: "check_1",
      name: "TypeScript",
      type: "typecheck",
      passed: true,
      errorCount: 0,
      warningCount: 0,
      errors: [],
      durationMs: 100,
      required: true,
    },
  ];

  const report = createValidationReport({
    reportId: "report_1",
    taskId: "task_1",
    bundleId: "bundle_1",
    checks,
  });

  assert.equal(hasFailedRequiredChecks(report), false);
});

test("getFailedCheckCount returns correct count [validation-report]", () => {
  const checks: readonly CheckResult[] = [
    {
      checkId: "check_1",
      name: "Tests",
      type: "test",
      passed: false,
      errorCount: 2,
      warningCount: 0,
      errors: [],
      durationMs: 100,
      required: true,
    },
    {
      checkId: "check_2",
      name: "Lint",
      type: "lint",
      passed: false,
      errorCount: 1,
      warningCount: 0,
      errors: [],
      durationMs: 50,
      required: false,
    },
    {
      checkId: "check_3",
      name: "TypeScript",
      type: "typecheck",
      passed: true,
      errorCount: 0,
      warningCount: 0,
      errors: [],
      durationMs: 80,
      required: true,
    },
  ];

  const report = createValidationReport({
    reportId: "report_1",
    taskId: "task_1",
    bundleId: "bundle_1",
    checks,
  });

  assert.equal(getFailedCheckCount(report), 2);
});

test("getFailedCheckCount returns 0 when all pass [validation-report]", () => {
  const checks: readonly CheckResult[] = [
    {
      checkId: "check_1",
      name: "Tests",
      type: "test",
      passed: true,
      errorCount: 0,
      warningCount: 0,
      errors: [],
      durationMs: 100,
      required: true,
    },
  ];

  const report = createValidationReport({
    reportId: "report_1",
    taskId: "task_1",
    bundleId: "bundle_1",
    checks,
  });

  assert.equal(getFailedCheckCount(report), 0);
});

test("ValidationDecision type accepts all valid values [validation-report]", () => {
  const decisions: ValidationDecision[] = ["pass", "fail", "warning"];
  assert.equal(decisions.length, 3);
});

test("CheckResult type accepts all valid types [validation-report]", () => {
  const types: CheckResult["type"][] = ["typecheck", "lint", "test", "security", "review", "custom"];
  assert.equal(types.length, 6);
});

test("CheckError severity accepts all valid values [validation-report]", () => {
  const severities: ("error" | "warning")[] = ["error", "warning"];
  assert.equal(severities.length, 2);
});
