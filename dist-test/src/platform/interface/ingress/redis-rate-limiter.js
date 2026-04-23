/**
 * Redis Rate Limiter
 *
 * Provides a Redis-backed sliding window rate limiter for distributed
 * rate limiting across multiple instances.
 */
import { Redis } from "ioredis";
import { buildRedisClientOptions } from "../../shared/utils/redis-client-options.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { runtimeMetricsRegistry } from "../../shared/observability/runtime-metrics-registry.js";
const logger = new StructuredLogger({ retentionLimit: 200 });
export class RedisRateLimiter {
    redis;
    keyPrefix;
    constructor(config) {
        this.keyPrefix = config.keyPrefix ?? "ratelimit:";
        this.redis = new Redis(buildRedisClientOptions(config, {
            keyPrefix: this.keyPrefix,
            maxRetriesPerRequest: config.maxRetriesPerRequest ?? 1,
            connectTimeout: config.connectTimeout ?? 500,
        }));
        this.redis.on("error", (err) => {
            runtimeMetricsRegistry.incrementCounter("redis_connection_errors", { component: "redis-rate-limiter" }, 1);
            logger.error("redis.connection_error", { err: err instanceof Error ? err.message : String(err) });
        });
    }
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
    async checkAndConsume(key, limit, windowMs) {
        const fullKey = `${this.keyPrefix}${key}`;
        const now = Date.now();
        const windowStart = now - windowMs;
        // Use Redis sorted set for sliding window
        const pipeline = this.redis.pipeline();
        // Remove expired entries (outside the window)
        pipeline.zremrangebyscore(fullKey, 0, windowStart);
        // Add current request with timestamp as score
        const requestId = `${now}:${Math.random()}`;
        pipeline.zadd(fullKey, now, requestId);
        // Count entries in the window
        pipeline.zcard(fullKey);
        // Set expiry on the key for auto-cleanup
        pipeline.pexpire(fullKey, windowMs);
        const results = await pipeline.exec();
        const count = results?.[2]?.[1] ?? 0;
        if (count > limit) {
            // Over limit - find when the oldest entry expires
            const oldest = await this.redis.zrange(fullKey, 0, 0, "WITHSCORES");
            const oldestTime = oldest.length >= 2 && oldest[1] != null ? parseFloat(oldest[1]) : now;
            const retryAfterMs = Math.max(0, oldestTime + windowMs - now);
            // Remove the entry we just added since it was rejected
            await this.redis.zrem(fullKey, requestId);
            return {
                allowed: false,
                remaining: 0,
                retryAfterMs,
            };
        }
        return {
            allowed: true,
            remaining: Math.max(0, limit - count),
        };
    }
    /**
     * Gets the current usage count for a key without consuming a token.
     */
    async getUsage(key, windowMs) {
        const fullKey = `${this.keyPrefix}${key}`;
        const now = Date.now();
        const windowStart = now - windowMs;
        await this.redis.zremrangebyscore(fullKey, 0, windowStart);
        return this.redis.zcard(fullKey);
    }
    /**
     * Resets the rate limit for a key.
     */
    async reset(key) {
        const fullKey = `${this.keyPrefix}${key}`;
        await this.redis.del(fullKey);
    }
    async connect() {
        await this.redis.connect();
    }
    async close() {
        if (this.redis.status === "wait" || this.redis.status === "end") {
            this.redis.disconnect();
            return;
        }
        await this.redis.quit();
    }
}
//# sourceMappingURL=redis-rate-limiter.js.map