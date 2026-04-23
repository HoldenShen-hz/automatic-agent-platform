/**
 * Cache Invalidation Broadcast
 *
 * Provides cross-instance cache invalidation via Redis pub/sub.
 * When one instance invalidates a cache entry, all other instances
 * receive the invalidation event and clear their local cache.
 */
import type { RedisConnectionConfig } from "../utils/redis-client-options.js";
export interface CacheInvalidationMessage {
    type: "tag" | "namespace";
    tag?: string;
    namespace?: string;
    origin: string;
}
export interface CacheInvalidationBroadcastConfig extends RedisConnectionConfig {
    channel?: string;
}
export declare class CacheInvalidationBroadcast {
    private readonly config;
    private readonly pub;
    private readonly sub;
    private readonly channel;
    private readonly instanceId;
    private readonly onInvalidate;
    private isStarted;
    constructor(config: CacheInvalidationBroadcastConfig, onInvalidate: (msg: CacheInvalidationMessage) => Promise<void>);
    start(): Promise<void>;
    broadcastTagInvalidation(tag: string): Promise<void>;
    broadcastNamespaceInvalidation(namespace: string): Promise<void>;
    close(): Promise<void>;
}
