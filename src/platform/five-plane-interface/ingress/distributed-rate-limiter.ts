/**
 * Distributed Rate Limiter
 *
 * Provides distributed rate limiting across multiple instances.
 * Uses Redis for cross-instance coordination when configured,
 * falls back to in-memory rate limiting for single-instance deployments.
 */

import type { RedisRateLimiterConfig, RateLimitResult } from "./redis-rate-limiter.js";
import { RedisRateLimiter } from "./redis-rate-limiter.js";

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
export class DistributedRateLimiter {
  private readonly redisLimiter: RedisRateLimiter | null;
  private readonly localEntries = new Map<string, { count: number; windowStart: number }>();
  private readonly maxCalls: number;
  private readonly windowMs: number;

  constructor(private config: RateLimiterConfig) {
    this.maxCalls = config.maxCalls ?? 100;
    this.windowMs = config.windowMs ?? 1000;

    if (config.redis) {
      this.redisLimiter = new RedisRateLimiter(config.redis);
    } else {
      this.redisLimiter = null;
    }
  }

  /**
   * Checks if a request is allowed and consumes a rate limit token.
   * Uses Redis for distributed rate limiting when configured.
   */
  async checkAndConsume(key: string): Promise<RateLimitCheckResult> {
    if (this.redisLimiter) {
      return this.toRateLimitCheckResult(
        await this.redisLimiter.checkAndConsume(key, this.maxCalls, this.windowMs),
      );
    }

    return this.checkLocal(key);
  }

  private checkLocal(key: string): RateLimitCheckResult {
    const now = Date.now();
    if (this.maxCalls <= 0) {
      return { allowed: false, remaining: 0, retryAfterMs: this.windowMs };
    }
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

  private toRateLimitCheckResult(result: RateLimitResult): RateLimitCheckResult {
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
