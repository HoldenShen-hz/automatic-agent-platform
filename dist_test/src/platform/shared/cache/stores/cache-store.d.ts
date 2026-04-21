/**
 * Cache Store Interface
 *
 * Defines the contract for cache storage implementations at different layers.
 */
import type { CacheLookupResult, CacheMeta } from '../cache-types.js';
export interface CacheStore {
    /**
     * Retrieves a value from the cache.
     */
    get<T>(namespace: string, key: string): Promise<CacheLookupResult<T>>;
    /**
     * Stores a value in the cache with metadata.
     */
    set<T>(namespace: string, key: string, value: T, meta: CacheMeta): Promise<void>;
    /**
     * Deletes a specific entry from the cache.
     */
    delete(namespace: string, key: string): Promise<void>;
    /**
     * Invalidates all entries with a given tag.
     * @returns Number of entries invalidated.
     */
    invalidateByTag(tag: string): Promise<number>;
    /**
     * Invalidates all entries in a namespace.
     * @returns Number of entries invalidated.
     */
    invalidateNamespace(namespace: string): Promise<number>;
    /**
     * Removes all expired entries.
     * @returns Number of entries cleaned up.
     */
    cleanupExpired(): Promise<number>;
}
