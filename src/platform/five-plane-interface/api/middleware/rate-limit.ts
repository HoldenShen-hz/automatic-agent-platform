/**
 * Rate Limiting Middleware
 *
 * Implements rate limiting per §9.2 to prevent API abuse.
 * Uses token bucket algorithm for fair request throttling.
 */

/**
 * Rate limiting configuration.
 */
export interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Whether to enable per-tenant rate limiting */
  perTenant?: boolean;
  /** Whether to enable per-principal rate limiting */
  perPrincipal?: boolean;
}

/**
 * Rate limit decision result.
 */
export interface RateLimitDecision {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfterMs: number | null;
}

/**
 * Token bucket state for a rate limiter.
 */
interface TokenBucket {
  tokens: number;
  lastRefillAt: number;
}

/**
 * Key for tracking rate limits (tenant:principal or just key).
 */
type RateLimitKey = string;

/**
 * Rate Limiter using token bucket algorithm.
 *
 * Each key (tenant, principal, or global) gets a bucket of tokens.
 * Tokens refill at a steady rate up to maxRequests per window.
 */
export class RateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  private readonly perTenant: boolean;
  private readonly perPrincipal: boolean;
  private readonly buckets = new Map<RateLimitKey, TokenBucket>();

  constructor(config: RateLimitConfig) {
    this.maxRequests = config.maxRequests;
    this.windowMs = config.windowMs;
    this.perTenant = config.perTenant ?? false;
    this.perPrincipal = config.perPrincipal ?? false;
  }

  /**
   * Generate a rate limit key from request context.
   */
  public generateKey(options: { tenantId?: string; principal?: string; clientIp?: string }): RateLimitKey {
    if (this.perPrincipal && options.principal) {
      return `principal:${options.principal}`;
    }
    if (this.perTenant && options.tenantId) {
      return `tenant:${options.tenantId}`;
    }
    if (options.clientIp) {
      return `ip:${options.clientIp}`;
    }
    return "global";
  }

  /**
   * Check if a request is allowed and consume a token if so.
   *
   * @param key - Rate limit key
   * @returns RateLimitDecision with allowed status and metadata
   */
  public check(key: RateLimitKey): RateLimitDecision {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    // Initialize bucket if needed
    if (!bucket) {
      bucket = {
        tokens: this.maxRequests - 1, // Consume one token for this request
        lastRefillAt: now,
      };
      this.buckets.set(key, bucket);
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetAt: now + this.windowMs,
        retryAfterMs: null,
      };
    }

    // Refill tokens based on elapsed time
    const elapsed = now - bucket.lastRefillAt;
    if (elapsed >= this.windowMs) {
      // Window has passed, refill all tokens
      bucket.tokens = this.maxRequests - 1; // Consume one token
      bucket.lastRefillAt = now;
      return {
        allowed: true,
        remaining: this.maxRequests - 1,
        resetAt: now + this.windowMs,
        retryAfterMs: null,
      };
    }

    // Calculate tokens to add based on elapsed time
    const tokensPerMs = this.maxRequests / this.windowMs;
    const tokensToAdd = Math.floor(elapsed * tokensPerMs);
    bucket.tokens = Math.min(this.maxRequests, bucket.tokens + tokensToAdd);
    bucket.lastRefillAt = now;

    // Check if we have tokens available
    if (bucket.tokens <= 0) {
      const retryAfterMs = this.windowMs - elapsed;
      return {
        allowed: false,
        remaining: 0,
        resetAt: now + retryAfterMs,
        retryAfterMs,
      };
    }

    // Consume a token
    bucket.tokens--;
    return {
      allowed: true,
      remaining: bucket.tokens,
      resetAt: now + this.windowMs,
      retryAfterMs: null,
    };
  }

  /**
   * Reset rate limit for a specific key.
   */
  public reset(key: RateLimitKey): void {
    this.buckets.delete(key);
  }

  /**
   * Reset all rate limits.
   */
  public resetAll(): void {
    this.buckets.clear();
  }

  /**
   * Get current rate limit status without consuming a token.
   */
  public status(key: RateLimitKey): { tokens: number; resetAt: number } | null {
    const bucket = this.buckets.get(key);
    if (!bucket) {
      return null;
    }
    return {
      tokens: bucket.tokens,
      resetAt: bucket.lastRefillAt + this.windowMs,
    };
  }
}

/**
 * Default rate limit configuration per §9.2.
 */
export const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  maxRequests: 100,
  windowMs: 60_000, // 1 minute
  perTenant: true,
  perPrincipal: false,
};

/**
 * Creates a rate limiter with the given configuration.
 */
export function createRateLimiter(config: Partial<RateLimitConfig> = {}): RateLimiter {
  return new RateLimiter({ ...DEFAULT_RATE_LIMIT_CONFIG, ...config });
}

/**
 * Global rate limiter instance.
 */
let globalRateLimiter: RateLimiter | null = null;

/**
 * Get or create the global rate limiter.
 */
export function getGlobalRateLimiter(): RateLimiter {
  if (!globalRateLimiter) {
    globalRateLimiter = createRateLimiter();
  }
  return globalRateLimiter;
}

/**
 * Reset the global rate limiter.
 */
export function resetGlobalRateLimiter(): void {
  globalRateLimiter = null;
}

/**
 * Rate limit middleware that can be used with HTTP servers.
 */
export class RateLimitMiddleware {
  private readonly limiter: RateLimiter;

  public constructor(config: Partial<RateLimitConfig> = {}) {
    this.limiter = createRateLimiter(config);
  }

  /**
   * Middleware function to check rate limit.
   */
  public middleware() {
    return (context: { tenantId?: string; principal?: string; clientIp?: string }): RateLimitDecision => {
      const key = this.limiter.generateKey(context);
      return this.limiter.check(key);
    };
  }

  /**
   * Get the underlying rate limiter.
   */
  public getLimiter(): RateLimiter {
    return this.limiter;
  }
}
