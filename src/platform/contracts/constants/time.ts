/**
 * Time-related constants for consistent value reuse across the codebase.
 *
 * Purpose: Replace magic numbers with named constants to improve code
 * readability and maintainability.
 */

/** Default TTL for distributed locks in milliseconds (30 seconds) */
export const DEFAULT_LOCK_TTL_MS = 30_000;

/** Number of milliseconds in one second */
export const MS_PER_SECOND = 1_000;

/** Number of milliseconds in five seconds */
export const FIVE_SECONDS_MS = 5_000;

/** Number of milliseconds in one minute */
export const MS_PER_MINUTE = 60_000;

/** Number of milliseconds in two minutes */
export const TWO_MINUTES_MS = 120_000;

/** Number of milliseconds in five minutes */
export const FIVE_MINUTES_MS = 300_000;

/** Number of seconds in one day */
export const SECONDS_PER_DAY = 86_400;

/** Number of milliseconds in one day */
export const MS_PER_DAY = 86_400_000;
