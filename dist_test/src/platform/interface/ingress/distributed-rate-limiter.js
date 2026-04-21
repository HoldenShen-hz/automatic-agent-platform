/**
 * Distributed Rate Limiter
 *
 * Provides distributed rate limiting across multiple instances.
 * Uses Redis for cross-instance coordination when configured,
 * falls back to in-memory rate limiting for single-instance deployments.
 */
import { RedisRateLimiter } from "./redis-rate-limiter.js";
/**
 * Unified rate limiter that switches between distributed (Redis) and
 * local (in-memory) modes based on configuration.
 */
export class DistributedRateLimiter {
    config;
    redisLimiter;
    localEntries = new Map();
    maxCalls;
    windowMs;
    constructor(config) {
        this.config = config;
        this.maxCalls = config.maxCalls ?? 100;
        this.windowMs = config.windowMs ?? 1000;
        if (config.redis) {
            this.redisLimiter = new RedisRateLimiter(config.redis);
        }
        else {
            this.redisLimiter = null;
        }
    }
    /**
     * Checks if a request is allowed and consumes a rate limit token.
     * Uses Redis for distributed rate limiting when configured.
     */
    async checkAndConsume(key) {
        if (this.redisLimiter) {
            return this.toRateLimitCheckResult(await this.redisLimiter.checkAndConsume(key, this.maxCalls, this.windowMs));
        }
        return this.checkLocal(key);
    }
    checkLocal(key) {
        const now = Date.now();
        const entry = this.localEntries.get(key);
        if (!entry || now - entry.windowStart >= this.windowMs) {
            this.localEntries.set(key, { count: 1, windowStart: now });
            return { allowed: true, remaining: this.maxCalls - 1 };
        }
        if (entry.count >= this.maxCalls) {
            const retryAfterMs = this.windowMs - (now - entry.windowStart);
            return {
                allowed: false,
                remaining: 0,
                retryAfterMs,
            };
        }
        entry.count += 1;
        return { allowed: true, remaining: this.maxCalls - entry.count };
    }
    toRateLimitCheckResult(result) {
        const base = {
            allowed: result.allowed,
            remaining: result.remaining,
        };
        if (result.retryAfterMs !== undefined) {
            return { ...base, retryAfterMs: result.retryAfterMs };
        }
        return base;
    }
}
//# sourceMappingURL=distributed-rate-limiter.js.map