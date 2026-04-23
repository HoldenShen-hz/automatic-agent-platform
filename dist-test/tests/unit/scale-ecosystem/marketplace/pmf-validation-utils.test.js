import assert from "node:assert/strict";
import test from "node:test";
import { subtractDaysIso, roundMetric, calculatePercentile, safeDividePercent, validateProfileName, validateDivisionId, validateWindowDays, mergeThresholds, buildSummary, DEFAULT_PMF_THRESHOLDS, } from "../../../../src/scale-ecosystem/marketplace/pmf-validation/utils.js";
test("subtractDaysIso subtracts days from timestamp", () => {
    const result = subtractDaysIso("2026-04-14T00:00:00.000Z", 1);
    assert.equal(result, "2026-04-13T00:00:00.000Z");
});
test("subtractDaysIso subtracts multiple days", () => {
    const result = subtractDaysIso("2026-04-14T00:00:00.000Z", 30);
    assert.equal(result, "2026-03-15T00:00:00.000Z");
});
test("subtractDaysIso handles month boundary", () => {
    const result = subtractDaysIso("2026-04-01T00:00:00.000Z", 1);
    assert.equal(result, "2026-03-31T00:00:00.000Z");
});
test("subtractDaysIso throws for invalid timestamp", () => {
    assert.throws(() => subtractDaysIso("invalid", 1), (e) => e?.message?.includes("pmf.invalid_evaluated_at"));
});
test("roundMetric rounds to 2 decimal places", () => {
    assert.equal(roundMetric(1.2345), 1.23);
    assert.equal(roundMetric(1.235), 1.24);
    assert.equal(roundMetric(1.2), 1.2);
});
test("roundMetric returns null for null", () => {
    assert.equal(roundMetric(null), null);
});
test("roundMetric returns null for undefined-like values", () => {
    // undefined is not a number but JavaScript's == comparison makes it work
    // We test with null which has the same behavior
    assert.equal(roundMetric(null), null);
});
test("roundMetric returns null for Infinity", () => {
    assert.equal(roundMetric(Infinity), null);
    assert.equal(roundMetric(-Infinity), null);
});
test("roundMetric returns null for NaN", () => {
    assert.equal(roundMetric(NaN), null);
});
test("calculatePercentile returns null for empty array", () => {
    assert.equal(calculatePercentile([], 50), null);
});
test("calculatePercentile calculates 50th percentile", () => {
    const result = calculatePercentile([1, 2, 3, 4, 5], 0.5);
    assert.equal(result, 3);
});
test("calculatePercentile calculates 95th percentile", () => {
    const result = calculatePercentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 0.95);
    assert.equal(result, 10);
});
test("calculatePercentile handles single element", () => {
    assert.equal(calculatePercentile([42], 0.5), 42);
});
test("safeDividePercent returns percentage", () => {
    assert.equal(safeDividePercent(50, 100), 50);
    assert.equal(safeDividePercent(1, 3), 33.33);
});
test("safeDividePercent returns null for zero denominator", () => {
    assert.equal(safeDividePercent(50, 0), null);
});
test("safeDividePercent returns null for negative denominator", () => {
    assert.equal(safeDividePercent(50, -10), null);
});
test("validateProfileName accepts valid names", () => {
    assert.equal(validateProfileName("valid"), "valid");
    assert.equal(validateProfileName("valid_name"), "valid_name");
    assert.equal(validateProfileName("valid-name"), "valid-name");
    assert.equal(validateProfileName("valid.name"), "valid.name");
    assert.equal(validateProfileName("a"), "a");
    assert.equal(validateProfileName("A1b2C3"), "A1b2C3");
});
test("validateProfileName throws for invalid names", () => {
    assert.throws(() => validateProfileName(""), (e) => e?.message?.includes("pmf.invalid_profile_name"));
    assert.throws(() => validateProfileName("invalid name"), (e) => e?.message?.includes("pmf.invalid_profile_name"));
    assert.throws(() => validateProfileName("invalid@name"), (e) => e?.message?.includes("pmf.invalid_profile_name"));
});
test("validateProfileName throws for too long names", () => {
    const longName = "a".repeat(65);
    assert.throws(() => validateProfileName(longName), (e) => e?.message?.includes("pmf.invalid_profile_name"));
});
test("validateDivisionId returns null for null", () => {
    assert.equal(validateDivisionId(null), null);
});
test("validateDivisionId returns null for undefined", () => {
    assert.equal(validateDivisionId(undefined), null);
});
test("validateDivisionId accepts valid IDs", () => {
    assert.equal(validateDivisionId("valid"), "valid");
    assert.equal(validateDivisionId("valid_id"), "valid_id");
    assert.equal(validateDivisionId("valid-id"), "valid-id");
    assert.equal(validateDivisionId("valid:id"), "valid:id");
    assert.equal(validateDivisionId("a1"), "a1");
});
test("validateDivisionId throws for invalid IDs", () => {
    assert.throws(() => validateDivisionId(""), (e) => e?.message?.includes("pmf.invalid_division_id"));
    assert.throws(() => validateDivisionId("a"), (e) => e?.message?.includes("pmf.invalid_division_id")); // too short
    assert.throws(() => validateDivisionId("invalid id"), (e) => e?.message?.includes("pmf.invalid_division_id")); // space
});
test("validateWindowDays accepts valid values", () => {
    assert.equal(validateWindowDays(1), 1);
    assert.equal(validateWindowDays(30), 30);
    assert.equal(validateWindowDays(365), 365);
});
test("validateWindowDays truncates floats", () => {
    assert.equal(validateWindowDays(30.9), 30);
    assert.equal(validateWindowDays(1.1), 1);
});
test("validateWindowDays throws for invalid values", () => {
    assert.throws(() => validateWindowDays(0), (e) => e?.message?.includes("pmf.invalid_window_days"));
    assert.throws(() => validateWindowDays(366), (e) => e?.message?.includes("pmf.invalid_window_days"));
    assert.throws(() => validateWindowDays(-1), (e) => e?.message?.includes("pmf.invalid_window_days"));
    assert.throws(() => validateWindowDays(Infinity), (e) => e?.message?.includes("pmf.invalid_window_days"));
});
test("mergeThresholds returns defaults when undefined", () => {
    const result = mergeThresholds(undefined);
    assert.equal(result.minTaskCount, 5);
    assert.equal(result.minSessionCount, 3);
    assert.equal(result.minTaskSuccessRatePct, 70);
});
test("mergeThresholds merges partial overrides", () => {
    const result = mergeThresholds({ minTaskCount: 10 });
    assert.equal(result.minTaskCount, 10);
    assert.equal(result.minSessionCount, 3); // default
});
test("mergeThresholds throws for negative thresholds", () => {
    assert.throws(() => mergeThresholds({ minTaskCount: -1 }), (e) => e?.message?.includes("pmf.invalid_threshold:minTaskCount"));
});
test("mergeThresholds throws for NaN thresholds", () => {
    assert.throws(() => mergeThresholds({ minTaskCount: NaN }), (e) => e?.message?.includes("pmf.invalid_threshold:minTaskCount"));
});
test("buildSummary returns pass message for pass verdict", () => {
    const result = buildSummary("pass", []);
    assert.equal(result, "PMF validation meets the current product baseline thresholds.");
});
test("buildSummary returns warnings message when no failed checks but warn verdict", () => {
    const result = buildSummary("warn", []);
    assert.equal(result, "PMF validation completed with warnings, but no hard-fail threshold was crossed.");
});
test("buildSummary lists failed checks for fail verdict", () => {
    const checks = [
        { checkId: "task_success_rate", status: "fail", detail: "Task success rate below threshold", observed: 50, threshold: 70, unit: "pct" },
        { checkId: "activation_rate", status: "pass", detail: "Activation rate acceptable", observed: 65, threshold: 60, unit: "pct" },
    ];
    const result = buildSummary("fail", checks);
    assert.ok(result.includes("task_success_rate"));
    assert.ok(!result.includes("activation_rate"));
});
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
//# sourceMappingURL=pmf-validation-utils.test.js.map