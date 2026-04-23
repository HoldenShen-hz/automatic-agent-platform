/**
 * Multi-Level Cache Store
 *
 * Coordinates L1, L2, and L3 cache layers with hierarchical lookup
 * and automatic population of upper layers on hits.
 */
import type { CacheLookupResult, CacheMeta } from '../cache-types.js';
import type { CacheStore } from './cache-store.js';
export declare class MultiLevelCacheStore implements CacheStore {
    private readonly l1;
    private readonly l2;
    private readonly l3;
    constructor(l1: CacheStore, l2: CacheStore, l3: CacheStore);
    private getStoreForLayer;
    get<T>(namespace: string, key: string): Promise<CacheLookupResult<T>>;
    set<T>(namespace: string, key: string, value: T, meta: CacheMeta): Promise<void>;
    delete(namespace: string, key: string): Promise<void>;
    invalidateByTag(tag: string): Promise<number>;
    invalidateNamespace(namespace: string): Promise<number>;
    cleanupExpired(): Promise<number>;
}
