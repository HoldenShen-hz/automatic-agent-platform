/**
 * Cache Key Factory
 *
 * Creates deterministic cache keys from namespace, version,
 * and normalized input using stable hashing.
 */
export declare class CacheKeyFactory {
    /**
     * Creates a cache key in the format: {namespace}:{version}:{fingerprint}
     */
    static create(namespace: string, version: string, normalizedInput: unknown): string;
    /**
     * Extracts the fingerprint from a cache key.
     */
    static getFingerprint(key: string): string | null;
    /**
     * Extracts the version from a cache key.
     */
    static getVersion(key: string): string | null;
    /**
     * Extracts the namespace from a cache key.
     */
    static getNamespace(key: string): string | null;
    /**
     * Parses a cache key into its components.
     */
    static parse(key: string): {
        namespace: string;
        version: string;
        fingerprint: string;
    } | null;
}
