/**
 * Distributed Rate Limiter
 *
 * Provides distributed rate limiting across multiple instances.
 * Uses Redis for cross-instance coordination when configured,
 * falls back to in-memory rate limiting for single-instance deployments.
 */
import type { RedisRateLimiterConfig } from "./redis-rate-limiter.js";
export interface RateLimiterConfig {
    /** Redis configuration for distributed rate limiting */
    redis?: RedisRateLimiterConfig;
    /** In-memory fallback limit (used when Redis is not configured) */
    maxCalls?: number;
    /** In-memory fallback window in ms (used when Redis is not configured) */
    windowMs?: number;
}
export interface RateLimitCheckResult {
    allowed: boolean;
    remaining: number;
    retryAfterMs?: number;
}
/**
 * Unified rate limiter that switches between distributed (Redis) and
 * local (in-memory) modes based on configuration.
 */
export declare class DistributedRateLimiter {
    private config;
    private readonly redisLimiter;
    private readonly localEntries;
    private readonly maxCalls;
    private readonly windowMs;
    constructor(config: RateLimiterConfig);
    /**
     * Checks if a request is allowed and consumes a rate limit token.
     * Uses Redis for distributed rate limiting when configured.
     */
    checkAndConsume(key: string): Promise<RateLimitCheckResult>;
    private checkLocal;
    private toRateLimitCheckResult;
}
