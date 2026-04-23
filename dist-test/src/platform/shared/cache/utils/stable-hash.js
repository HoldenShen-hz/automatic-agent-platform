/**
 * Stable Hash Utility
 *
 * Provides deterministic hashing using SHA-256 with stable stringify
 * to ensure consistent fingerprints for equal inputs.
 */
import { createHash } from 'node:crypto';
import { stableStringify } from './stable-stringify.js';
/**
 * Creates a deterministic SHA-256 hash of any serializable value.
 * Equal values will always produce equal hashes.
 */
export function stableHash(value) {
    return createHash('sha256')
        .update(stableStringify(value))
        .digest('hex');
}
/**
 * Creates a shorter hash (first 16 characters of SHA-256).
 * Useful for display or when full hash is not needed.
 */
export function shortHash(value) {
    return stableHash(value).slice(0, 16);
}
/**
 * Creates a namespace-qualified cache key with version and fingerprint.
 */
export function buildCacheKey(namespace, version, normalizedInput) {
    const fingerprint = stableHash(normalizedInput);
    return `${namespace}:${version}:${fingerprint}`;
}
//# sourceMappingURL=stable-hash.js.map