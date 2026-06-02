/**
 * Distributed Rate Limiter
 *
 * Provides distributed rate limiting across multiple instances.
 * Uses Redis for cross-instance coordination when configured,
 * falls back to in-memory rate limiting for single-instance deployments.
 */

import type { RedisRateLimiterConfig, RateLimitResult } from "./redis-rate-limiter.js";
import { RedisRateLimiter } from "./redis-rate-limiter.js";
import { MS_PER_SECOND } from "../../contracts/constants/time.js";

export interface RateLimiterConfig {
  /** Redis configuration for distributed rate limiting */
  redis?: RedisRateLimiterConfig;
  /** Whether this limiter should enforce production-only Redis requirements */
  isProduction?: boolean;
  /** Explicitly allow local fallback in production-like deployments */
  allowLocalFallbackInProduction?: boolean;
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
  private static readonly LOCAL_IDLE_TTL_MULTIPLIER = 2;
  private static readonly LOCAL_MAX_ENTRIES = 10_000;
  private readonly maxCalls: number;
  private readonly windowMs: number;

  constructor(private config: RateLimiterConfig) {
    this.maxCalls = config.maxCalls ?? 100;
    this.windowMs = config.windowMs ?? MS_PER_SECOND;

    if (config.redis) {
      this.redisLimiter = new RedisRateLimiter(config.redis);
    } else {
      if (config.isProduction === true && config.allowLocalFallbackInProduction !== true) {
        throw new Error("rate_limiter.redis_required_in_production");
      }
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
    this.pruneLocalEntries(now);
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
    this.touchLocalEntry(key, entry);
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

  private touchLocalEntry(key: string, entry: { count: number; windowStart: number }): void {
    this.localEntries.delete(key);
    this.localEntries.set(key, entry);
    while (this.localEntries.size > DistributedRateLimiter.LOCAL_MAX_ENTRIES) {
      const oldestKey = this.localEntries.keys().next().value;
      if (oldestKey == null) {
        return;
      }
      this.localEntries.delete(oldestKey);
    }
  }

  private pruneLocalEntries(now: number): void {
    const idleTtlMs = Math.max(this.windowMs, this.windowMs * DistributedRateLimiter.LOCAL_IDLE_TTL_MULTIPLIER);
    for (const [entryKey, entry] of this.localEntries.entries()) {
      if (now - entry.windowStart >= idleTtlMs) {
        this.localEntries.delete(entryKey);
      }
    }
  }
}
