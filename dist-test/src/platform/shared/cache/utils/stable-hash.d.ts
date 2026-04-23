/**
 * Stable Hash Utility
 *
 * Provides deterministic hashing using SHA-256 with stable stringify
 * to ensure consistent fingerprints for equal inputs.
 */
/**
 * Creates a deterministic SHA-256 hash of any serializable value.
 * Equal values will always produce equal hashes.
 */
export declare function stableHash(value: unknown): string;
/**
 * Creates a shorter hash (first 16 characters of SHA-256).
 * Useful for display or when full hash is not needed.
 */
export declare function shortHash(value: unknown): string;
/**
 * Creates a namespace-qualified cache key with version and fingerprint.
 */
export declare function buildCacheKey(namespace: string, version: string, normalizedInput: unknown): string;
