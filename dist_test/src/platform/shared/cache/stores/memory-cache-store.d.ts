/**
 * Memory Cache Store
 *
 * L1 in-memory cache with LRU eviction and TTL support.
 * Fastest cache layer, suitable for high-frequency access.
 */
import type { CacheLookupResult, CacheMeta } from '../cache-types.js';
import type { CacheStore } from './cache-store.js';
export declare class MemoryCacheStore implements CacheStore {
    private readonly entries;
    private head;
    private tail;
    private readonly maxEntries;
    constructor(maxEntries?: number);
    private getBucketKey;
    private removeLru;
    private addToHead;
    get<T>(namespace: string, key: string): Promise<CacheLookupResult<T>>;
    set<T>(namespace: string, key: string, value: T, meta: CacheMeta): Promise<void>;
    private findKeyByEntry;
    delete(namespace: string, key: string): Promise<void>;
    invalidateByTag(tag: string): Promise<number>;
    invalidateNamespace(namespace: string): Promise<number>;
    cleanupExpired(): Promise<number>;
    /**
     * Returns current entry count (for diagnostics).
     */
    get size(): number;
}
