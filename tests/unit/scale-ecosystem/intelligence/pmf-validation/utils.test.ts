/**
 * Unit tests for PMF Validation Utils
 *
 * @see src/scale-ecosystem/intelligence/pmf-validation/utils.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

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
import type { PmfValidationThresholds, PmfMetricCheck } from "../../../../../src/scale-ecosystem/intelligence/pmf-validation/utils.js";

describe("DEFAULT_PMF_THRESHOLDS", () => {
  test("has correct structure with all required fields", () => {
    assert.equal(DEFAULT_PMF_THRESHOLDS.minTaskCount, 5);
    assert.equal(DEFAULT_PMF_THRESHOLDS.minSessionCount, 3);
    assert.equal(DEFAULT_PMF_THRESHOLDS.minTaskSuccessRatePct, 70);
    assert.equal(DEFAULT_PMF_THRESHOLDS.minActivationRatePct, 60);
    assert.equal(DEFAULT_PMF_THRESHOLDS.minRepeatUsageRatePct, 20);
    assert.equal(DEFAULT_PMF_THRESHOLDS.minApprovalResolutionRatePct, 90);
    assert.equal(DEFAULT_PMF_THRESHOLDS.maxAverageSuccessfulTaskCostUsd, 2);
    assert.equal(DEFAULT_PMF_THRESHOLDS.maxP95StepDurationMs, 60_000);
  });

  test("is read-only", () => {
    assert.ok(Object.isFrozen(DEFAULT_PMF_THRESHOLDS));
  });
});

describe("subtractDaysIso", () => {
  test("subtracts single day correctly", () => {
    const result = subtractDaysIso("2026-04-26T00:00:00Z", 1);
    assert.equal(result, "2026-04-25T00:00:00.000Z");
  });

  test("subtracts multiple days correctly", () => {
    const result = subtractDaysIso("2026-04-26T00:00:00Z", 14);
    assert.equal(result, "2026-04-12T00:00:00.000Z");
  });

  test("handles month boundary", () => {
    const result = subtractDaysIso("2026-04-01T00:00:00Z", 1);
    assert.equal(result, "2026-03-31T00:00:00.000Z");
  });

  test("handles year boundary", () => {
    const result = subtractDaysIso("2026-01-01T00:00:00Z", 1);
    assert.equal(result, "2025-12-31T00:00:00.000Z");
  });

  test("throws for invalid timestamp", () => {
    assert.throws(
      () => subtractDaysIso("not-a-date", 5),
      /pmf.invalid_evaluated_at/,
    );
  });

  test("subtracts zero days returns same date", () => {
    const result = subtractDaysIso("2026-04-26T10:30:00Z", 0);
    assert.equal(result, "2026-04-26T10:30:00.000Z");
  });
});

describe("roundMetric", () => {
  test("rounds to 2 decimal places", () => {
    assert.equal(roundMetric(1.234), 1.23);
    assert.equal(roundMetric(1.235), 1.24);
    assert.equal(roundMetric(1.236), 1.24);
  });

  test("returns null for null", () => {
    assert.equal(roundMetric(null), null);
  });

  test("returns null for undefined", () => {
    assert.equal(roundMetric(undefined as any), null);
  });

  test("returns null for Infinity", () => {
    assert.equal(roundMetric(Infinity), null);
    assert.equal(roundMetric(-Infinity), null);
  });

  test("returns null for NaN", () => {
    assert.equal(roundMetric(NaN), null);
  });

  test("handles zero", () => {
    assert.equal(roundMetric(0), 0);
  });

  test("handles whole numbers", () => {
    assert.equal(roundMetric(100), 100);
  });

  test("handles negative numbers", () => {
    assert.equal(roundMetric(-1.234), -1.23);
    assert.equal(roundMetric(-1.235), -1.24);
  });
});

describe("calculatePercentile", () => {
  test("calculates p50 (median) correctly for odd length array", () => {
    const values = [1, 2, 3, 4, 5];
    assert.equal(calculatePercentile(values, 0.5), 3);
  });

  test("calculates p50 for even length array", () => {
    const values = [1, 2, 3, 4];
    assert.equal(calculatePercentile(values, 0.5), 3);
  });

  test("calculates p95 correctly", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const result = calculatePercentile(values, 0.95);
    assert.ok(result !== null);
    assert.ok(result >= 9);
  });

  test("returns null for empty array", () => {
    assert.equal(calculatePercentile([], 0.5), null);
  });

  test("handles single element array", () => {
    assert.equal(calculatePercentile([42], 0.5), 42);
  });

  test("handles unsorted input", () => {
    const values = [5, 2, 8, 1, 9];
    const result = calculatePercentile(values, 0.5);
    assert.ok(result !== null);
    assert.ok(result >= 1 && result <= 9);
  });

  test("handles percentile of 0", () => {
    const values = [10, 20, 30];
    assert.equal(calculatePercentile(values, 0), 10);
  });

  test("handles percentile of 1", () => {
    const values = [10, 20, 30];
    assert.equal(calculatePercentile(values, 1), 30);
  });

  test("handles duplicate values", () => {
    const values = [5, 5, 5, 5, 5];
    assert.equal(calculatePercentile(values, 0.5), 5);
  });
});

describe("safeDividePercent", () => {
  test("calculates percentage correctly", () => {
    assert.equal(safeDividePercent(50, 100), 50);
    assert.equal(safeDividePercent(1, 3), 33.33);
  });

  test("returns null for zero denominator", () => {
    assert.equal(safeDividePercent(50, 0), null);
  });

  test("returns null for negative denominator", () => {
    assert.equal(safeDividePercent(50, -10), null);
  });

  test("handles zero numerator", () => {
    assert.equal(safeDividePercent(0, 100), 0);
  });

  test("handles fractional results", () => {
    const result = safeDividePercent(1, 7);
    assert.ok(result !== null);
    assert.ok(result > 14 && result < 15);
  });

  test("rounds to 2 decimal places", () => {
    const result = safeDividePercent(1, 3);
    assert.equal(result, 33.33);
  });
});

describe("validateProfileName", () => {
  test("accepts valid alphanumeric names", () => {
    assert.equal(validateProfileName("abc123"), "abc123");
    assert.equal(validateProfileName("profile_name"), "profile_name");
    assert.equal(validateProfileName("profile-name"), "profile-name");
    assert.equal(validateProfileName("profile.name"), "profile.name");
  });

  test("accepts mixed valid characters", () => {
    assert.equal(validateProfileName("My_Profile-2"), "My_Profile-2");
  });

  test("throws for empty string", () => {
    assert.throws(
      () => validateProfileName(""),
      /pmf.invalid_profile_name/,
    );
  });

  test("throws for name exceeding 64 characters", () => {
    const longName = "a".repeat(65);
    assert.throws(
      () => validateProfileName(longName),
      /pmf.invalid_profile_name/,
    );
  });

  test("throws for name with invalid characters", () => {
    assert.throws(
      () => validateProfileName("invalid name"),
      /pmf.invalid_profile_name/,
    );
    assert.throws(
      () => validateProfileName("invalid@name"),
      /pmf.invalid_profile_name/,
    );
  });

  test("throws for name starting with hyphen", () => {
    assert.throws(
      () => validateProfileName("-invalid"),
      /pmf.invalid_profile_name/,
    );
  });
});

describe("validateDivisionId", () => {
  test("returns null for null input", () => {
    assert.equal(validateDivisionId(null), null);
  });

  test("returns null for undefined input", () => {
    assert.equal(validateDivisionId(undefined), null);
  });

  test("accepts valid division IDs", () => {
    assert.equal(validateDivisionId("division-1"), "division-1");
    assert.equal(validateDivisionId("div_1"), "div_1");
    assert.equal(validateDivisionId("div.1"), "div.1");
    assert.equal(validateDivisionId("div:1"), "div:1");
  });

  test("accepts longer valid IDs", () => {
    assert.equal(validateDivisionId("my-division-id-123"), "my-division-id-123");
  });

  test("throws for single character ID", () => {
    assert.throws(
      () => validateDivisionId("a"),
      /pmf.invalid_division_id/,
    );
  });

  test("throws for ID with invalid characters", () => {
    assert.throws(
      () => validateDivisionId("invalid id"),
      /pmf.invalid_division_id/,
    );
    assert.throws(
      () => validateDivisionId("invalid@id"),
      /pmf.invalid_division_id/,
    );
  });

  test("throws for ID exceeding 128 characters", () => {
    const longId = "a".repeat(129);
    assert.throws(
      () => validateDivisionId(longId),
      /pmf.invalid_division_id/,
    );
  });
});

describe("validateWindowDays", () => {
  test("accepts valid window days", () => {
    assert.equal(validateWindowDays(1), 1);
    assert.equal(validateWindowDays(7), 7);
    assert.equal(validateWindowDays(30), 30);
    assert.equal(validateWindowDays(365), 365);
  });

  test("truncates fractional values", () => {
    assert.equal(validateWindowDays(7.9), 7);
    assert.equal(validateWindowDays(14.5), 14);
    assert.equal(validateWindowDays(1.1), 1);
  });

  test("throws for zero days", () => {
    assert.throws(
      () => validateWindowDays(0),
      /pmf.invalid_window_days/,
    );
  });

  test("throws for negative days", () => {
    assert.throws(
      () => validateWindowDays(-1),
      /pmf.invalid_window_days/,
    );
    assert.throws(
      () => validateWindowDays(-30),
      /pmf.invalid_window_days/,
    );
  });

  test("throws for days exceeding 365", () => {
    assert.throws(
      () => validateWindowDays(366),
      /pmf.invalid_window_days/,
    );
  });

  test("throws for Infinity", () => {
    assert.throws(
      () => validateWindowDays(Infinity),
      /pmf.invalid_window_days/,
    );
  });

  test("throws for NaN", () => {
    assert.throws(
      () => validateWindowDays(NaN),
      /pmf.invalid_window_days/,
    );
  });
});

describe("mergeThresholds", () => {
  test("returns default thresholds when input is undefined", () => {
    const result = mergeThresholds(undefined);
    assert.equal(result.minTaskCount, DEFAULT_PMF_THRESHOLDS.minTaskCount);
    assert.equal(result.minSessionCount, DEFAULT_PMF_THRESHOLDS.minSessionCount);
  });

  test("returns default thresholds when input is empty object", () => {
    const result = mergeThresholds({});
    assert.equal(result.minTaskCount, DEFAULT_PMF_THRESHOLDS.minTaskCount);
  });

  test("merges provided thresholds with defaults", () => {
    const result = mergeThresholds({ minTaskCount: 100 });
    assert.equal(result.minTaskCount, 100);
    assert.equal(result.minSessionCount, DEFAULT_PMF_THRESHOLDS.minSessionCount);
  });

  test("overrides multiple thresholds", () => {
    const result = mergeThresholds({
      minTaskCount: 50,
      minTaskSuccessRatePct: 80,
    });
    assert.equal(result.minTaskCount, 50);
    assert.equal(result.minTaskSuccessRatePct, 80);
    assert.equal(result.minActivationRatePct, DEFAULT_PMF_THRESHOLDS.minActivationRatePct);
  });

  test("throws for negative threshold values", () => {
    assert.throws(
      () => mergeThresholds({ minTaskCount: -1 }),
      /pmf.invalid_threshold:minTaskCount/,
    );
  });

  test("throws for non-finite threshold values", () => {
    assert.throws(
      () => mergeThresholds({ minTaskCount: Infinity }),
      /pmf.invalid_threshold:minTaskCount/,
    );
    assert.throws(
      () => mergeThresholds({ minTaskCount: NaN }),
      /pmf.invalid_threshold:minTaskCount/,
    );
  });

  test("allows zero as valid threshold", () => {
    const result = mergeThresholds({ minTaskCount: 0, minSessionCount: 0 });
    assert.equal(result.minTaskCount, 0);
    assert.equal(result.minSessionCount, 0);
  });

  test("returns all required threshold fields", () => {
    const result = mergeThresholds({});
    assert.ok("minTaskCount" in result);
    assert.ok("minSessionCount" in result);
    assert.ok("minTaskSuccessRatePct" in result);
    assert.ok("minActivationRatePct" in result);
    assert.ok("minRepeatUsageRatePct" in result);
    assert.ok("minApprovalResolutionRatePct" in result);
    assert.ok("maxAverageSuccessfulTaskCostUsd" in result);
    assert.ok("maxP95StepDurationMs" in result);
  });
});

describe("buildSummary", () => {
  test("returns pass message when verdict is pass", () => {
    const checks: PmfMetricCheck[] = [];
    const result = buildSummary("pass", checks);
    assert.equal(result, "PMF validation meets the current product baseline thresholds.");
  });

  test("returns warn message when verdict is warn with no failures", () => {
    const checks: PmfMetricCheck[] = [
      { checkId: "sample_size", status: "warn", detail: "ok", observed: 100, threshold: 50, unit: "count" },
    ];
    const result = buildSummary("warn", checks);
    assert.equal(result, "PMF validation completed with warnings, but no hard-fail threshold was crossed.");
  });

  test("lists failed check IDs when verdict is fail", () => {
    const checks: PmfMetricCheck[] = [
      { checkId: "task_success_rate", status: "fail", detail: "low", observed: 50, threshold: 70, unit: "pct" },
      { checkId: "activation_rate", status: "fail", detail: "low", observed: 40, threshold: 60, unit: "pct" },
    ];
    const result = buildSummary("fail", checks);
    assert.ok(result.includes("task_success_rate"));
    assert.ok(result.includes("activation_rate"));
    assert.ok(result.includes("did not meet the current baseline"));
  });

  test("handles single failed check", () => {
    const checks: PmfMetricCheck[] = [
      { checkId: "sample_size", status: "fail", detail: "low", observed: 1, threshold: 5, unit: "count" },
    ];
    const result = buildSummary("fail", checks);
    assert.ok(result.includes("sample_size"));
  });

  test("handles empty checks with fail verdict", () => {
    const result = buildSummary("fail", []);
    assert.ok(result.includes("did not meet the current baseline"));
  });
});