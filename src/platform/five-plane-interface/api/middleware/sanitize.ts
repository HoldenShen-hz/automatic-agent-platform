import { AppError } from "../../../contracts/errors.js";

const DANGEROUS_JSON_KEYS = new Set(["__proto__", "prototype", "constructor"]);

/**
 * Rate limiting configuration for API endpoints.
 * Per §9.2 requires per-endpoint-class rate limiting.
 */
export interface RateLimitConfig {
  /** Maximum requests per window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Endpoint class for rate limiting classification */
  endpointClass: "critical" | "standard" | "bulk";
}

/**
 * Default rate limits per endpoint class per §9.2
 */
export const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  critical: { maxRequests: 100, windowMs: 60_000, endpointClass: "critical" },
  standard: { maxRequests: 1000, windowMs: 60_000, endpointClass: "standard" },
  bulk: { maxRequests: 5000, windowMs: 60_000, endpointClass: "bulk" },
};

/**
 * Rate limit entry for tracking requests.
 */
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/**
 * Rate limiting middleware per §9.2.
 * Implements per-endpoint-class rate limiting with sliding window.
 */
export class RateLimitMiddleware {
  private readonly limits = new Map<string, RateLimitEntry>();
  private readonly config: RateLimitConfig;

  public constructor(config: RateLimitConfig) {
    this.config = config;
  }

  /**
   * Check if request is allowed under rate limit.
   * @returns true if allowed, false if rate limit exceeded
   */
  public check(identifier: string): boolean {
    const now = Date.now();
    let entry = this.limits.get(identifier);

    if (entry == null || now >= entry.resetAt) {
      entry = { count: 0, resetAt: now + this.config.windowMs };
      this.limits.set(identifier, entry);
    }

    if (entry.count >= this.config.maxRequests) {
      return false;
    }

    entry.count++;
    return true;
  }

  /**
   * Get remaining requests for identifier.
   */
  public remaining(identifier: string): number {
    const entry = this.limits.get(identifier);
    if (entry == null) {
      return this.config.maxRequests;
    }
    if (Date.now() >= entry.resetAt) {
      return this.config.maxRequests;
    }
    return Math.max(0, this.config.maxRequests - entry.count);
  }

  /**
   * Reset rate limit for identifier.
   */
  public reset(identifier: string): void {
    this.limits.delete(identifier);
  }

  /**
   * Clean up expired entries.
   */
  public cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now >= entry.resetAt) {
        this.limits.delete(key);
      }
    }
  }
}

/**
 * Global rate limiters for each endpoint class.
 */
export const globalRateLimiters = {
  critical: new RateLimitMiddleware(DEFAULT_RATE_LIMITS.critical),
  standard: new RateLimitMiddleware(DEFAULT_RATE_LIMITS.standard),
  bulk: new RateLimitMiddleware(DEFAULT_RATE_LIMITS.bulk),
};

/**
 * Idempotency key middleware per §6.2.
 * Ensures idempotent operations using X-Idempotency-Key header.
 */
export class IdempotencyMiddleware {
  private readonly keys = new Map<string, { status: "processing" | "completed"; result?: unknown; expiresAt: number }>();

  /**
   * Check and validate idempotency key.
   * @returns result if already processed, null if new request
   */
  public check(key: string): { isDuplicate: boolean; result?: unknown } {
    const now = Date.now();
    const entry = this.keys.get(key);

    if (entry == null) {
      this.keys.set(key, { status: "processing", expiresAt: now + 24 * 60 * 60 * 1000 });
      return { isDuplicate: false };
    }

    if (now >= entry.expiresAt) {
      this.keys.delete(key);
      this.keys.set(key, { status: "processing", expiresAt: now + 24 * 60 * 60 * 1000 });
      return { isDuplicate: false };
    }

    if (entry.status === "completed" && entry.result != null) {
      return { isDuplicate: true, result: entry.result };
    }

    return { isDuplicate: false };
  }

  /**
   * Mark idempotency key as completed with result.
   */
  public complete(key: string, result: unknown): void {
    const entry = this.keys.get(key);
    if (entry != null) {
      entry.status = "completed";
      entry.result = result;
    }
  }

  /**
   * Remove idempotency key.
   */
  public remove(key: string): void {
    this.keys.delete(key);
  }

  /**
   * Clean up expired entries.
   */
  public cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.keys.entries()) {
      if (now >= entry.expiresAt) {
        this.keys.delete(key);
      }
    }
  }
}

/**
 * Global idempotency middleware instance.
 */
export const globalIdempotencyMiddleware = new IdempotencyMiddleware();

function buildValidationError(code: string, message: string): AppError {
  return new AppError(code, message, {
    statusCode: 400,
    category: "validation",
    source: "runtime",
    retryable: false,
  });
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

export function sanitizeJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeJsonValue(entry));
  }
  if (!isPlainObject(value)) {
    return value;
  }
  const sanitized = Object.create(null) as Record<string, unknown>;
  for (const [key, entry] of Object.entries(value)) {
    if (DANGEROUS_JSON_KEYS.has(key)) {
      throw buildValidationError(
        "api.invalid_json_key",
        `JSON payload contains reserved key: ${key}.`,
      );
    }
    sanitized[key] = sanitizeJsonValue(entry);
  }
  return sanitized;
}
