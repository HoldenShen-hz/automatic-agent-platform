/**
 * Redis Rate Limiter
 *
 * Provides a Redis-backed sliding window rate limiter for distributed
 * rate limiting across multiple instances.
 */
import type { RedisConnectionConfig } from "../../shared/utils/redis-client-options.js";
export interface RedisRateLimiterConfig extends RedisConnectionConfig {
    keyPrefix?: string;
}
export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    retryAfterMs?: number;
}
export declare class RedisRateLimiter {
    private readonly redis;
    private readonly keyPrefix;
    constructor(config: RedisRateLimiterConfig);
    /**
     * Checks if a request is allowed under the rate limit and consumes a token if so.
     *
     * Uses a sliding window algorithm with Redis sorted sets:
     * - Score: timestamp of the request
     * - Member: unique request ID (timestamp:random)
     *
     * @param key - The rate limit key (e.g., "tenant:123" or "endpoint:/api/tasks")
     * @param limit - Maximum number of requests allowed in the window
     * @param windowMs - Window size in milliseconds
     * @returns RateLimitResult with allowed status and retry information
     */
    checkAndConsume(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
    /**
     * Gets the current usage count for a key without consuming a token.
     */
    getUsage(key: string, windowMs: number): Promise<number>;
    /**
     * Resets the rate limit for a key.
     */
    reset(key: string): Promise<void>;
    connect(): Promise<void>;
    close(): Promise<void>;
}
