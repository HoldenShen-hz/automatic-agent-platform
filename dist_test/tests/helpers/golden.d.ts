/**
 * Golden Test Utilities
 *
 * Provides assertGolden() for snapshot assertion and supports UPDATE_GOLDEN=1
 * environment variable to regenerate snapshots.
 */
/**
 * Assert that actual output matches the stored golden snapshot.
 *
 * Usage:
 * ```typescript
 * test("output matches golden", () => {
 *   const result = computeSomething();
 *   assertGolden("compute-something-v1", result);
 * });
 * ```
 *
 * To update snapshots:
 * ```bash
 * UPDATE_GOLDEN=1 npm run test:golden
 * ```
 */
export declare function assertGolden(snapshotName: string, actual: unknown): void;
/**
 * Assert that actual output matches a substring of the golden snapshot.
 * Useful when the snapshot contains partial content.
 */
export declare function assertGoldenContains(snapshotName: string, actual: string): void;
/**
 * Assert that actual output matches a regex pattern in the golden snapshot.
 */
export declare function assertGoldenMatches(snapshotName: string, pattern: RegExp): void;
