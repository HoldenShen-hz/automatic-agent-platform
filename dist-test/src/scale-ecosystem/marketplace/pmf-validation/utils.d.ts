import type { PmfValidationThresholds, PmfMetricCheck } from "./types.js";
import type { PmfValidationVerdict } from "../../../platform/contracts/types/domain.js";
/** Default PMF thresholds for the current product baseline */
export declare const DEFAULT_PMF_THRESHOLDS: Readonly<PmfValidationThresholds>;
/**
 * Subtracts a number of days from an ISO timestamp.
 * Returns the resulting ISO timestamp string.
 */
export declare function subtractDaysIso(value: string, days: number): string;
/** Rounds a metric to 2 decimal places, returns null for invalid values */
export declare function roundMetric(value: number | null): number | null;
/** Calculates a percentile from an array of values */
export declare function calculatePercentile(values: readonly number[], percentile: number): number | null;
/** Safely divides two numbers and returns percentage, null if denominator is zero */
export declare function safeDividePercent(numerator: number, denominator: number): number | null;
/** Validates profile name format (alphanumeric with dots, underscores, hyphens) */
export declare function validateProfileName(profileName: string): string;
/** Validates division ID format */
export declare function validateDivisionId(divisionId: string | null | undefined): string | null;
/** Validates window days (must be 1-365) */
export declare function validateWindowDays(windowDays: number): number;
/**
 * Merges provided thresholds with defaults.
 * Validates that all threshold values are finite and non-negative.
 */
export declare function mergeThresholds(thresholds: Partial<PmfValidationThresholds> | undefined): PmfValidationThresholds;
/** Builds a human-readable summary based on verdict and failed checks */
export declare function buildSummary(verdict: PmfValidationVerdict, checks: readonly PmfMetricCheck[]): string;
