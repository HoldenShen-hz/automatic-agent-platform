/**
 * Cache Normalizer
 *
 * Provides input normalization for cache keys to maximize hit rates
 * by ensuring semantically equivalent inputs produce identical keys.
 */
import { normalizePath } from './utils/normalize-path.js';
import { normalizeQuery } from './utils/normalize-query.js';
import { stableStringify } from './utils/stable-stringify.js';
// Re-export utilities for direct access
export { normalizePath, normalizeQuery };
export class CacheNormalizer {
    workspaceRoot;
    caseInsensitive;
    constructor(workspaceRoot, caseInsensitive = false) {
        this.workspaceRoot = workspaceRoot;
        this.caseInsensitive = caseInsensitive;
    }
    /**
     * Normalizes tool arguments for cache key generation.
     */
    normalizeToolArgs(args) {
        const normalized = {};
        for (const [key, value] of Object.entries(args)) {
            if (value === undefined)
                continue;
            normalized[key] = this.normalizeValue(value);
        }
        // Sort keys for stable ordering
        const sortedKeys = Object.keys(normalized).sort();
        const result = {};
        for (const key of sortedKeys) {
            result[key] = normalized[key];
        }
        return result;
    }
    /**
     * Normalizes a value based on its type.
     */
    normalizeValue(value) {
        if (value === null || value === undefined) {
            return undefined;
        }
        if (typeof value === 'string') {
            return this.normalizeString(value);
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
            return value;
        }
        if (Array.isArray(value)) {
            return value.map((v) => this.normalizeValue(v));
        }
        if (typeof value === 'object') {
            const obj = value;
            const result = {};
            for (const [k, v] of Object.entries(obj)) {
                // Skip undefined values
                if (v === undefined)
                    continue;
                result[k] = this.normalizeValue(v);
            }
            // Sort keys for stable ordering
            return Object.keys(result)
                .sort()
                .reduce((acc, k) => {
                acc[k] = result[k];
                return acc;
            }, {});
        }
        // For functions, symbols, etc., return a placeholder
        return '[ComplexValue]';
    }
    /**
     * Normalizes a string value.
     */
    normalizeString(value) {
        let normalized = value.trim();
        // Normalize path if workspace root is set
        if (this.workspaceRoot) {
            try {
                normalized = normalizePath(value, this.workspaceRoot);
            }
            catch {
                // If path normalization fails, keep original
            }
        }
        if (this.caseInsensitive) {
            normalized = normalized.toLowerCase();
        }
        return normalized;
    }
    /**
     * Normalizes a query string.
     */
    normalizeQueryString(query) {
        return normalizeQuery(query);
    }
    /**
     * Normalizes a complete cache input object.
     */
    normalizeCacheInput(input) {
        return this.normalizeValue(input);
    }
    /**
     * Creates a stable string representation for hashing.
     */
    toStableString(input) {
        return stableStringify(this.normalizeCacheInput(input));
    }
}
//# sourceMappingURL=cache-normalizer.js.map