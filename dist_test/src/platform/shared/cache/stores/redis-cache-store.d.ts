/**
 * Redis Cache Store
 *
 * Provides a Redis-backed implementation of the CacheStore interface
 * for multi-instance shared caching.
 */
import type { CacheStore } from "./cache-store.js";
import type { CacheLookupResult, CacheMeta } from "../cache-types.js";
import type { RedisConnectionConfig } from "../../utils/redis-client-options.js";
export interface RedisCacheConfig extends RedisConnectionConfig {
    keyPrefix?: string;
}
export declare class RedisCacheStore implements CacheStore {
    private readonly redis;
    private readonly prefix;
    constructor(config: RedisCacheConfig);
    private cacheKey;
    private tagSetKey;
    private namespaceSetKey;
    get<T>(namespace: string, key: string): Promise<CacheLookupResult<T>>;
    set<T>(namespace: string, key: string, value: T, meta: CacheMeta): Promise<void>;
    delete(namespace: string, key: string): Promise<void>;
    invalidateByTag(tag: string): Promise<number>;
    invalidateNamespace(namespace: string): Promise<number>;
    cleanupExpired(): Promise<number>;
    connect(): Promise<void>;
    close(): Promise<void>;
}
