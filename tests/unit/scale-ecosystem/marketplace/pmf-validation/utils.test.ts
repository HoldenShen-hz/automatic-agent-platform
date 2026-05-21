/**
 * Unit tests for PMF Validation Utils
 *
 * Tests utility functions for PMF validation calculations.
 *
 * @see src/scale-ecosystem/intelligence/pmf-validation/utils.ts
 * @see src/scale-ecosystem/marketplace/pmf-validation/utils.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";
import {
  DEFAULT_PMF_THRESHOLDS,
  subtractDaysIso,
  roundMetric,
  calculatePercentile,
  safeDividePercent,
  validateProfileName,
  validateDivisionId,
  validateWindowDays,
  mergeThresholds,
  buildSummary,
} from "../../../../../src/scale-ecosystem/intelligence/pmf-validation/utils.js";
import type { PmfValidationThresholds, PmfMetricCheck } from "../../../../../src/scale-ecosystem/intelligence/pmf-validation/types.js";
import type { PmfValidationVerdict } from "../../../../../src/platform/contracts/types/domain.js";

test("DEFAULT_PMF_THRESHOLDS has correct values", () => {
  assert.equal(DEFAULT_PMF_THRESHOLDS.minTaskCount, 5);
  assert.equal(DEFAULT_PMF_THRESHOLDS.minSessionCount, 3);
  assert.equal(DEFAULT_PMF_THRESHOLDS.minTaskSuccessRatePct, 70);
  assert.equal(DEFAULT_PMF_THRESHOLDS.minActivationRatePct, 60);
  assert.equal(DEFAULT_PMF_THRESHOLDS.minRepeatUsageRatePct, 20);
  assert.equal(DEFAULT_PMF_THRESHOLDS.minApprovalResolutionRatePct, 90);
  assert.equal(DEFAULT_PMF_THRESHOLDS.maxAverageSuccessfulTaskCostUsd, 2);
  assert.equal(DEFAULT_PMF_THRESHOLDS.maxP95StepDurationMs, 60_000);
});

test("subtractDaysIso subtracts days correctly", () => {
  const result = subtractDaysIso("2026-05-21T00:00:00.000Z", 7);
  assert.ok(result.includes("2026-05-14"));
});

test("subtractDaysIso handles single day", () => {
  const result = subtractDaysIso("2026-05-21T00:00:00.000Z", 1);
  assert.ok(result.includes("2026-05-20"));
});

test("subtractDaysIso handles large number of days", () => {
  const result = subtractDaysIso("2026-05-21T00:00:00.000Z", 365);
  assert.ok(result.includes("2025-05-22"));
});

test("subtractDaysIso rejects invalid timestamp", () => {
  assert.throws(
    () => subtractDaysIso("not-a-date", 5),
    ValidationError
  );
});

test("roundMetric rounds to 2 decimal places", () => {
  assert.equal(roundMetric(1.234), 1.23);
  assert.equal(roundMetric(1.235), 1.24);
  assert.equal(roundMetric(1.999), 2.0);
});

test("roundMetric returns null for null input", () => {
  assert.equal(roundMetric(null), null);
});

test("roundMetric returns null for non-finite values", () => {
  assert.equal(roundMetric(Infinity), null);
  assert.equal(roundMetric(-Infinity), null);
  assert.equal(roundMetric(NaN), null);
});

test("calculatePercentile returns correct value for median", () => {
  const values = [1, 2, 3, 4, 5];
  assert.equal(calculatePercentile(values, 0.5), 3);
});

test("calculatePercentile returns correct value for 95th percentile", () => {
  const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
  assert.equal(calculatePercentile(values, 0.95), 10);
});

test("calculatePercentile returns null for empty array", () => {
  assert.equal(calculatePercentile([], 0.5), null);
});

test("calculatePercentile handles single element array", () => {
  assert.equal(calculatePercentile([42], 0.5), 42);
});

test("calculatePercentile bounds percentile to valid range", () => {
  const values = [1, 2, 3, 4, 5];
  assert.equal(calculatePercentile(values, 1.5), 5);
  assert.equal(calculatePercentile(values, -0.5), 1);
});

test("safeDividePercent returns percentage", () => {
  assert.equal(safeDividePercent(50, 100), 50);
  assert.equal(safeDividePercent(1, 3), null);
});

test("safeDividePercent returns null when denominator is zero", () => {
  assert.equal(safeDividePercent(10, 0), null);
});

test("safeDividePercent returns null when denominator is negative", () => {
  assert.equal(safeDividePercent(10, -1), null);
});

test("validateProfileName accepts valid profile names", () => {
  assert.equal(validateProfileName("default"), "default");
  assert.equal(validateProfileName("my-profile"), "my-profile");
  assert.equal(validateProfileName("my_profile"), "my_profile");
  assert.equal(validateProfileName("my.profile"), "my.profile");
  assert.equal(validateProfileName("a123"), "a123");
});

test("validateProfileName accepts 64 character names", () => {
  const longName = "a" + "b".repeat(63);
  assert.equal(validateProfileName(longName), longName);
});

test("validateProfileName rejects names starting with special chars", () => {
  assert.throws(() => validateProfileName("_invalid"), ValidationError);
  assert.throws(() => validateProfileName("-invalid"), ValidationError);
  assert.throws(() => validateProfileName(".invalid"), ValidationError);
});

test("validateProfileName rejects names over 64 characters", () => {
  const tooLong = "a" + "b".repeat(64);
  assert.throws(() => validateProfileName(tooLong), ValidationError);
});

test("validateDivisionId accepts valid division IDs", () => {
  assert.equal(validateDivisionId("engineering"), "engineering");
  assert.equal(validateDivisionId("sales.ops"), "sales.ops");
  assert.equal(validateDivisionId("east-region-1"), "east-region-1");
});

test("validateDivisionId returns null for null input", () => {
  assert.equal(validateDivisionId(null), null);
});

test("validateDivisionId returns null for undefined input", () => {
  assert.equal(validateDivisionId(undefined), null);
});

test("validateDivisionId rejects invalid division IDs", () => {
  assert.throws(() => validateDivisionId(""), ValidationError);
  assert.throws(() => validateDivisionId("a"), ValidationError);
});

test("validateDivisionId rejects IDs over 128 characters", () => {
  const tooLong = "a".repeat(129);
  assert.throws(() => validateDivisionId(tooLong), ValidationError);
});

test("validateWindowDays accepts valid values", () => {
  assert.equal(validateWindowDays(1), 1);
  assert.equal(validateWindowDays(30), 30);
  assert.equal(validateWindowDays(365), 365);
});

test("validateWindowDays rejects values below 1", () => {
  assert.throws(() => validateWindowDays(0), ValidationError);
  assert.throws(() => validateWindowDays(-1), ValidationError);
});

test("validateWindowDays rejects values above 365", () => {
  assert.throws(() => validateWindowDays(366), ValidationError);
  assert.throws(() => validateWindowDays(1000), ValidationError);
});

test("validateWindowDays truncates decimal values", () => {
  assert.equal(validateWindowDays(14.7), 14);
});

test("mergeThresholds returns default when no overrides", () => {
  const result = mergeThresholds(undefined);
  assert.equal(result.minTaskCount, 5);
  assert.equal(result.minSessionCount, 3);
});

test("mergeThresholds merges partial overrides", () => {
  const result = mergeThresholds({ minTaskCount: 10 });
  assert.equal(result.minTaskCount, 10);
  assert.equal(result.minSessionCount, 3);
  assert.equal(result.minTaskSuccessRatePct, 70);
});

test("mergeThresholds rejects negative threshold values", () => {
  assert.throws(
    () => mergeThresholds({ minTaskCount: -1 }),
    /invalid_threshold/
  );
});

test("mergeThresholds rejects non-finite threshold values", () => {
  assert.throws(
    () => mergeThresholds({ minTaskCount: Infinity }),
    /invalid_threshold/
  );
});

test("buildSummary returns positive message for pass verdict", () => {
  const checks: PmfMetricCheck[] = [
    { checkId: "sample_size", status: "pass", detail: "OK", observed: 10, threshold: 5, unit: "count" },
  ];
  const result = buildSummary("pass", checks);
  assert.ok(result.includes("meets the current product baseline thresholds"));
});

test("buildSummary returns negative message for fail verdict", () => {
  const checks: PmfMetricCheck[] = [
    { checkId: "sample_size", status: "fail", detail: "Below", observed: 3, threshold: 5, unit: "count" },
  ];
  const result = buildSummary("fail", checks);
  assert.ok(result.includes("did not meet the current baseline"));
  assert.ok(result.includes("sample_size"));
});

test("buildSummary includes failed check IDs", () => {
  const checks: PmfMetricCheck[] = [
    { checkId: "task_success_rate", status: "fail", detail: "Below", observed: 50, threshold: 70, unit: "pct" },
    { checkId: "activation_rate", status: "fail", detail: "Below", observed: 40, threshold: 60, unit: "pct" },
  ];
  const result = buildSummary("fail", checks);
  assert.ok(result.includes("task_success_rate"));
  assert.ok(result.includes("activation_rate"));
});

test("buildSummary handles warn verdict without failed checks", () => {
  const checks: PmfMetricCheck[] = [
    { checkId: "sample_size", status: "warn", detail: "Near threshold", observed: 5, threshold: 5, unit: "count" },
  ];
  const result = buildSummary("warn", checks);
  assert.ok(result.includes("warnings"));
});

test("buildSummary returns partial info when fail verdict but no failed checks", () => {
  const checks: PmfMetricCheck[] = [];
  const result = buildSummary("fail", checks);
  assert.ok(result.includes("did not meet the current baseline"));
});