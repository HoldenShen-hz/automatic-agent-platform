/**
 * SQLite Cache Store
 *
 * Persistent cache store using SQLite for L2/L3 caching.
 * Provides tag-based invalidation and TTL support.
 */
import type { CacheLookupResult, CacheMeta } from '../cache-types.js';
import type { CacheStore } from './cache-store.js';
export interface SqliteCacheStoreDeps {
    execute(sql: string, params?: unknown[]): Promise<{
        changes?: number;
    }>;
    query<T>(sql: string, params?: unknown[]): Promise<T[]>;
}
export declare class SqliteCacheStore implements CacheStore {
    private readonly db;
    constructor(db: SqliteCacheStoreDeps);
    get<T>(namespace: string, key: string): Promise<CacheLookupResult<T>>;
    set<T>(namespace: string, key: string, value: T, meta: CacheMeta): Promise<void>;
    delete(namespace: string, key: string): Promise<void>;
    invalidateByTag(tag: string): Promise<number>;
    invalidateNamespace(namespace: string): Promise<number>;
    cleanupExpired(): Promise<number>;
}
