import { ValidationError } from "../../../platform/contracts/errors.js";
/** Default PMF thresholds for the current product baseline */
export const DEFAULT_PMF_THRESHOLDS = {
    minTaskCount: 5,
    minSessionCount: 3,
    minTaskSuccessRatePct: 70,
    minActivationRatePct: 60,
    minRepeatUsageRatePct: 20,
    minApprovalResolutionRatePct: 90,
    maxAverageSuccessfulTaskCostUsd: 2,
    maxP95StepDurationMs: 60_000,
};
/**
 * Parses an ISO timestamp string into a Date object.
 * Throws if the timestamp is invalid.
 */
function parseIsoTimestamp(value, errorCode) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        throw new ValidationError(errorCode, errorCode);
    }
    return date;
}
/**
 * Subtracts a number of days from an ISO timestamp.
 * Returns the resulting ISO timestamp string.
 */
export function subtractDaysIso(value, days) {
    const date = parseIsoTimestamp(value, "pmf.invalid_evaluated_at");
    date.setUTCDate(date.getUTCDate() - days);
    return date.toISOString();
}
/** Rounds a metric to 2 decimal places, returns null for invalid values */
export function roundMetric(value) {
    if (value == null || !Number.isFinite(value)) {
        return null;
    }
    return Math.round(value * 100) / 100;
}
/** Calculates a percentile from an array of values */
export function calculatePercentile(values, percentile) {
    if (values.length === 0) {
        return null;
    }
    const sorted = [...values].sort((left, right) => left - right);
    const index = Math.max(0, Math.ceil(sorted.length * percentile) - 1);
    return roundMetric(sorted[index] ?? sorted[sorted.length - 1] ?? 0);
}
/** Safely divides two numbers and returns percentage, null if denominator is zero */
export function safeDividePercent(numerator, denominator) {
    if (denominator <= 0) {
        return null;
    }
    return roundMetric((numerator / denominator) * 100);
}
/** Validates profile name format (alphanumeric with dots, underscores, hyphens) */
export function validateProfileName(profileName) {
    if (!/^[a-zA-Z0-9._-]{1,64}$/.test(profileName)) {
        throw new ValidationError("pmf.invalid_profile_name", "pmf.invalid_profile_name");
    }
    return profileName;
}
/** Validates division ID format */
export function validateDivisionId(divisionId) {
    if (divisionId == null) {
        return null;
    }
    if (!/^[a-zA-Z0-9._:-]{2,128}$/.test(divisionId)) {
        throw new ValidationError("pmf.invalid_division_id", "pmf.invalid_division_id");
    }
    return divisionId;
}
/** Validates window days (must be 1-365) */
export function validateWindowDays(windowDays) {
    if (!Number.isFinite(windowDays) || windowDays < 1 || windowDays > 365) {
        throw new ValidationError("pmf.invalid_window_days", "pmf.invalid_window_days");
    }
    return Math.trunc(windowDays);
}
/**
 * Merges provided thresholds with defaults.
 * Validates that all threshold values are finite and non-negative.
 */
export function mergeThresholds(thresholds) {
    const merged = {
        ...DEFAULT_PMF_THRESHOLDS,
        ...(thresholds ?? {}),
    };
    for (const [key, value] of Object.entries(merged)) {
        if (!Number.isFinite(value) || value < 0) {
            throw new ValidationError(`pmf.invalid_threshold:${key}`, `pmf.invalid_threshold:${key}`);
        }
    }
    return merged;
}
/** Builds a human-readable summary based on verdict and failed checks */
export function buildSummary(verdict, checks) {
    const failed = checks.filter((check) => check.status === "fail").map((check) => check.checkId);
    if (verdict === "pass") {
        return "PMF validation meets the current product baseline thresholds.";
    }
    if (failed.length === 0) {
        return "PMF validation completed with warnings, but no hard-fail threshold was crossed.";
    }
    return `PMF validation did not meet the current baseline for: ${failed.join(", ")}.`;
}
//# sourceMappingURL=utils.js.map