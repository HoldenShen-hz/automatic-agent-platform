/**
 * Cache Normalizer
 *
 * Provides input normalization for cache keys to maximize hit rates
 * by ensuring semantically equivalent inputs produce identical keys.
 */
import { normalizePath } from './utils/normalize-path.js';
import { normalizeQuery } from './utils/normalize-query.js';
export { normalizePath, normalizeQuery };
export interface NormalizerOptions {
    workspaceRoot?: string;
    caseInsensitive?: boolean;
}
export declare class CacheNormalizer {
    private readonly workspaceRoot?;
    private readonly caseInsensitive;
    constructor(workspaceRoot?: string | undefined, caseInsensitive?: boolean);
    /**
     * Normalizes tool arguments for cache key generation.
     */
    normalizeToolArgs(args: Record<string, unknown>): Record<string, unknown>;
    /**
     * Normalizes a value based on its type.
     */
    private normalizeValue;
    /**
     * Normalizes a string value.
     */
    private normalizeString;
    /**
     * Normalizes a query string.
     */
    normalizeQueryString(query: string): string;
    /**
     * Normalizes a complete cache input object.
     */
    normalizeCacheInput(input: unknown): unknown;
    /**
     * Creates a stable string representation for hashing.
     */
    toStableString(input: unknown): string;
}
