/**
 * Tool Path Scope Validation
 *
 * Provides path access control for tool executions.
 * Ensures tools can only access files within explicitly declared path roots.
 *
 * This is a secondary access control layer on top of sandbox policy.
 * While sandbox policy determines if a path is accessible at all,
 * path scope determines if it falls within the execution's declared boundaries.
 */
/**
 * Result of checking if a path is within the allowed scope.
 */
export interface ToolPathScopeCheckResult {
    /** Whether the path is within scope */
    allowed: boolean;
    /** Canonical path after normalization */
    normalizedPath: string;
    /** Reason code if denied, null if allowed */
    reasonCode: string | null;
}
/**
 * Normalizes an array of path root strings.
 * Removes empty values, normalizes each path, and deduplicates.
 */
export declare function normalizeToolPathScopeRoots(roots: readonly string[] | null | undefined): string[];
/**
 * Checks if any path scope restrictions are in effect.
 */
export declare function hasToolPathScopeRestrictions(roots: readonly string[] | null | undefined): boolean;
/**
 * Checks if a path is within the allowed path scope.
 *
 * @param inputPath - The path to check
 * @param roots - The allowed path roots (null/empty means allow all)
 * @returns Result indicating if the path is allowed and the normalized path
 */
export declare function checkToolPathScope(inputPath: string, roots: readonly string[] | null | undefined): ToolPathScopeCheckResult;
