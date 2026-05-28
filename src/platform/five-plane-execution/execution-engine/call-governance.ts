/**
 * @fileoverview Composable Retry, Breaker, and Limiter Governance.
 *
 * Provides three composable governance patterns for API calls:
 * - Rate Limiter: Controls call frequency within a time window
 * - Circuit Breaker: Prevents cascading failures by failing fast when a service is unhealthy
 * - Retry: Automatically retries transient failures with configurable backoff
 *
 * CallGovernance combines all three patterns into a single execute() method that
 * applies rate limiting, circuit breaker checks, and retries in order. The governance
 * is applied per-key (e.g., per-tenant, per-model, per-endpoint) for granular control.
 *
 * Key concepts:
 * - Limiter: Token-bucket style rate limiting with sliding window
 * - Circuit Breaker: Three states (closed=normal, open=failing fast, half_open=testing recovery)
 * - Retry: Exponential backoff with jitter, distinguishing retryable vs non-retryable errors
 * - Policy: Combined configuration for all three governance patterns
 *
 * @example
 * const governance = new CallGovernance({
 *   limiter: { maxCalls: 100, windowMs: 1000 },
 *   breaker: { failureThreshold: 5, successThreshold: 2, resetTimeoutMs: 30000 },
 *   retry: { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 5000, backoffMultiplier: 2 }
 * });
 *
 * const result = await governance.execute("model:gpt-4", async () => await callApi());
 */

import type {
  BreakerConfig,
  BreakerEntry,
  CallGovernanceOptions,
  CallPolicy,
  CallResult,
  CircuitBreakerSnapshot,
  CircuitState,
  DistributedRateLimiterLike,
  LimiterConfig,
  LimiterContext,
  LimiterEntry,
  PolicyStats,
  RetryConfig,
} from "./call-governance-types.js";
export type {
  BreakerConfig,
  CallGovernanceOptions,
  CallPolicy,
  CallResult,
  CircuitState,
  DistributedRateLimiterLike,
  LimiterConfig,
  LimiterContext,
  PolicyStats,
  RetryConfig,
} from "./call-governance-types.js";

/**
 * Sliding window rate limiter for API call governance.
 *
 * Tracks call counts per key within a time window. When the limit is exceeded,
 * returns retryAfterMs to indicate when the caller may retry.
 */
export class CallRateLimiter {
  private readonly entries = new Map<string, LimiterEntry>();

  public constructor(private config: LimiterConfig | null | undefined) {}

  /**
   * Removes expired entries to prevent memory growth.
   * Called periodically by CallGovernance to clean up stale entries.
   */
  public evictExpired(now = Date.now()): void {
    if (!this.config || this.config.windowMs <= 0) {
      return;
    }
    const expiry = now - this.config.windowMs * 2;
    for (const [key, entry] of this.entries) {
      if (entry.windowStart < expiry) {
        this.entries.delete(key);
      }
    }
  }

  /**
   * Checks if a call is allowed and consumes a token if so.
   *
   * If no entry exists for the key, creates one and allows the call.
   * If the entry exists but the window has expired, resets and allows.
   * If within the window and under the limit, increments and allows.
   * If within the window but at or over the limit, rejects with retryAfterMs.
   */
  public checkAndConsume(key: string, now = Date.now()): { allowed: boolean; retryAfterMs?: number | undefined } {
    if (!this.config) {
      return { allowed: true };
    }

    const entry = this.entries.get(key);
    if (!entry || now - entry.windowStart >= this.config.windowMs) {
      this.entries.set(key, { count: 1, windowStart: now });
      return { allowed: true };
    }

    if (entry.count >= this.config.maxCalls) {
      return {
        allowed: false,
        retryAfterMs: this.config.windowMs - (now - entry.windowStart),
      };
    }

    entry.count += 1;
    return { allowed: true };
  }

  public reset(key: string): void {
    this.entries.delete(key);
  }

  public updateConfig(config: LimiterConfig | null | undefined): void {
    this.config = config;
  }
}

/**
 * Circuit breaker for preventing cascading failures.
 *
 * Tracks failures per key and opens the circuit when failures exceed the threshold.
 * The circuit stays open during the reset timeout, then transitions to half_open
 * to test if the downstream service has recovered.
 *
 * State transitions:
 * - closed -> open: when failures >= failureThreshold
 * - open -> half_open: when resetTimeoutMs has elapsed since lastFailure
 * - half_open -> closed: when successes >= successThreshold
 * - half_open -> open: on any failure while in half_open
 */
export class CallCircuitBreaker {
  private readonly entries = new Map<string, BreakerEntry>();

  public constructor(private config: BreakerConfig | null | undefined) {}

  /**
   * Removes expired breaker entries to prevent memory growth.
   * Closed entries are removed if no failures recently; open entries are
   * removed if they've been open for twice the reset timeout.
   */
  public evictExpired(now = Date.now()): void {
    const resetTimeoutMs = this.config?.resetTimeoutMs ?? 5000;
    const breakerExpiry = now - resetTimeoutMs * 5;

    for (const [key, entry] of this.entries) {
      if (entry.state === "closed" && entry.lastFailure > 0 && entry.lastFailure < breakerExpiry) {
        this.entries.delete(key);
      } else if (entry.state === "open" && entry.lastFailure > 0 && now - entry.lastFailure > resetTimeoutMs * 2) {
        this.entries.delete(key);
      }
    }
  }

  /**
   * Checks if a call is allowed under the circuit breaker.
   *
   * Returns the current circuit state and whether the call is allowed:
   * - closed: always allowed, tracks failures
   * - open: not allowed, returns retryAfterMs until timeout
   * - half_open: allowed up to halfOpenMaxCalls to test recovery
   */
  public check(key: string, now = Date.now()): { allowed: boolean; state: CircuitState; retryAfterMs?: number | undefined } {
    if (!this.config) {
      return { allowed: true, state: "closed" };
    }

    let entry = this.entries.get(key);
    if (!entry) {
      entry = {
        failures: 0,
        successes: 0,
        state: "closed",
        lastFailure: 0,
        halfOpenCalls: 0,
      };
      this.entries.set(key, entry);
    }

    if (entry.state === "closed") {
      return { allowed: true, state: "closed" };
    }

    if (entry.state === "open") {
      if (now - entry.lastFailure >= this.config.resetTimeoutMs) {
        entry.state = "half_open";
        entry.halfOpenCalls = 0;
        entry.successes = 0;
        return { allowed: true, state: "half_open" };
      }
      return {
        allowed: false,
        state: "open",
        retryAfterMs: this.config.resetTimeoutMs - (now - entry.lastFailure),
      };
    }

    const maxCalls = this.config.halfOpenMaxCalls ?? 1;
    if (entry.halfOpenCalls >= maxCalls) {
      return { allowed: false, state: "half_open" };
    }
    entry.halfOpenCalls += 1;
    return { allowed: true, state: "half_open" };
  }

  /**
   * Records a successful call.
   *
   * In closed state: decrements failure count (graceful recovery).
   * In half_open state: increments success count; if threshold reached,
   * transitions to closed (recovery successful).
   */
  public recordSuccess(key: string): void {
    const entry = this.entries.get(key);
    if (!entry || !this.config) {
      return;
    }

    if (entry.state === "half_open") {
      entry.successes += 1;
      if (entry.successes >= this.config.successThreshold) {
        entry.state = "closed";
        entry.failures = 0;
        entry.successes = 0;
        entry.halfOpenCalls = 0;
      }
      return;
    }

    if (entry.state === "closed") {
      entry.failures = Math.max(0, entry.failures - 1);
    }
  }

  /**
   * Records a failed call.
   *
   * In half_open state: immediately opens the circuit (recovery failed).
   * In closed state: increments failure count; if threshold reached,
   * transitions to open (fail fast mode).
   */
  public recordFailure(key: string): void {
    if (!this.config) {
      return;
    }

    let entry = this.entries.get(key);
    if (!entry) {
      entry = {
        failures: 0,
        successes: 0,
        state: "closed",
        lastFailure: 0,
        halfOpenCalls: 0,
      };
      this.entries.set(key, entry);
    }

    entry.lastFailure = Date.now();
    if (entry.state === "half_open") {
      entry.state = "open";
      entry.halfOpenCalls = 0;
      entry.successes = 0;
      return;
    }

    if (entry.state === "closed") {
      entry.failures += 1;
      if (entry.failures >= this.config.failureThreshold) {
        entry.state = "open";
      }
    }
  }

  public getSnapshot(key: string): CircuitBreakerSnapshot | null {
    const entry = this.entries.get(key);
    if (!entry) {
      return null;
    }
    return {
      failures: entry.failures,
      state: entry.state,
      lastFailure: entry.lastFailure,
    };
  }

  public reset(key: string): void {
    this.entries.delete(key);
  }

  public updateConfig(config: BreakerConfig | null | undefined): void {
    this.config = config;
  }
}

/**
 * Records call results for statistics and observability.
 *
 * Maintains a rolling history of call results per key, capped at MAX_HISTORY
 * entries to prevent unbounded memory growth. Used to compute PolicyStats.
 */
export class CallHistoryRecorder {
  private static readonly MAX_HISTORY = 1000;
  private static readonly MAX_KEYS = 500;
  private readonly historyByKey = new Map<string, CallResult<unknown>[]>();

  /**
   * Records a call result, trimming old entries when the limit is exceeded.
   */
  public record(key: string, result: CallResult<unknown>): void {
    const history = this.historyByKey.get(key) ?? [];
    history.push(result);
    if (history.length > CallHistoryRecorder.MAX_HISTORY) {
      history.splice(0, history.length - CallHistoryRecorder.MAX_HISTORY);
    }
    if (!this.historyByKey.has(key) && this.historyByKey.size >= CallHistoryRecorder.MAX_KEYS) {
      const oldestKey = this.historyByKey.keys().next().value;
      if (oldestKey !== undefined) {
        this.historyByKey.delete(oldestKey);
      }
    }
    this.historyByKey.set(key, history);
  }

  /**
   * Computes statistics for a given key based on recorded call history.
   *
   * Counts total, successful, failed (non-governance errors), and rejected
   * (limiter or circuit breaker) calls. Includes current circuit breaker state.
   */
  public getStats(key: string, breaker: CircuitBreakerSnapshot | null): PolicyStats {
    const history = this.historyByKey.get(key) ?? [];
    const stats: PolicyStats = {
      totalCalls: history.length,
      successfulCalls: history.filter((result) => result.success).length,
      failedCalls: history.filter(
        (result) =>
          !result.success
          && result.error?.code !== "governance.limiter_rejected"
          && result.error?.code !== "governance.circuit_open",
      ).length,
      rejectedCalls: history.filter(
        (result) =>
          !result.success
          && (result.error?.code === "governance.limiter_rejected" || result.error?.code === "governance.circuit_open"),
      ).length,
      currentCircuitState: breaker?.state ?? "closed",
    };
    if (breaker != null) {
      stats.lastFailure = `failures:${breaker.failures}`;
      if (breaker.lastFailure > 0) {
        stats.lastFailureAt = new Date(breaker.lastFailure).toISOString();
      }
    }
    return stats;
  }

  /** Clears recorded history for a key. */
  public reset(key: string): void {
    this.historyByKey.delete(key);
  }
}

/**
 * Composes rate limiter, circuit breaker, and retry into a single governance layer.
 *
 * CallGovernance.execute() applies all three patterns in order:
 * 1. Rate limiter check (reject if over limit)
 * 2. Circuit breaker check (fail fast if open)
 * 3. Execute the call
 * 4. Retry if the error is retryable and under max attempts
 *
 * Each pattern is optional and can be omitted from the policy.
 */
export class CallGovernance {
  private policy: CallPolicy;
  private readonly rateLimiter: CallRateLimiter;
  private readonly circuitBreaker: CallCircuitBreaker;
  private readonly distributedRateLimiter: DistributedRateLimiterLike | null;
  private readonly historyRecorder = new CallHistoryRecorder();
  private lastEvictionTime = 0;
  private readonly evictionIntervalMs = 60000;

  public constructor(policy: CallPolicy, options: CallGovernanceOptions = {}) {
    this.policy = policy;
    this.rateLimiter = new CallRateLimiter(policy.limiter);
    this.circuitBreaker = new CallCircuitBreaker(policy.breaker);
    this.distributedRateLimiter = options.distributedRateLimiter ?? null;
  }

  /**
   * Periodically evicts expired entries from rate limiter and circuit breaker.
   * Runs at most once per evictionIntervalMs to avoid overhead.
   */
  private evictExpired(now = Date.now()): void {
    if (now - this.lastEvictionTime < this.evictionIntervalMs) {
      return;
    }
    this.lastEvictionTime = now;
    this.rateLimiter.evictExpired(now);
    this.circuitBreaker.evictExpired(now);
  }

  /**
   * Executes a call with full governance: rate limiting, circuit breaker, and retry.
   *
   * The key is used for per-key governance tracking (e.g., "tenant:123" or "model:gpt-4").
   * The call function is only invoked if all pre-checks pass. On failure, governance
   * rules determine whether to retry and what error to return.
   *
   * Returns a CallResult with success/data or failure/error information, including
   * metadata about attempts, latency, and circuit state.
   */
  public async execute<T>(
    key: string,
    call: () => Promise<T>,
  ): Promise<CallResult<T>> {
    this.evictExpired();
    const startTime = Date.now();
    let attempts = 0;

    while (true) {
      attempts += 1;

      const limiterResult = this.distributedRateLimiter != null
        ? await this.distributedRateLimiter.checkAndConsume(key)
        : this.rateLimiter.checkAndConsume(key);
      if (!limiterResult.allowed) {
        const result: CallResult<T> = {
          success: false,
          error: {
            code: "governance.limiter_rejected",
            message: `Rate limit exceeded for ${key}`,
            retryable: true,
            ...(limiterResult.retryAfterMs != null ? { retryAfterMs: limiterResult.retryAfterMs } : {}),
          },
          metadata: { attempts, latencyMs: Date.now() - startTime },
        };
        this.historyRecorder.record(key, result);
        return result;
      }

      const breakerResult = this.circuitBreaker.check(key);
      if (!breakerResult.allowed) {
        const result: CallResult<T> = {
          success: false,
          error: {
            code: "governance.circuit_open",
            message: `Circuit breaker open for ${key}`,
            retryable: true,
            retryAfterMs: breakerResult.retryAfterMs ?? this.policy.breaker?.resetTimeoutMs ?? 5000,
          },
          metadata: {
            attempts,
            latencyMs: Date.now() - startTime,
            circuitState: breakerResult.state,
          },
        };
        this.historyRecorder.record(key, result);
        return result;
      }

      try {
        const data = await call();
        this.circuitBreaker.recordSuccess(key);
        const result: CallResult<T> = {
          success: true,
          data,
          metadata: {
            attempts,
            latencyMs: Date.now() - startTime,
            circuitState: breakerResult.state,
          },
        };
        this.historyRecorder.record(key, result);
        return result;
      } catch (error) {
        let parsedError = this.parseError(error);
        if (!parsedError.retryable && this.policy.retry?.nonRetryableCodes?.some((item) => parsedError.code.includes(item))) {
          parsedError = {
            code: "governance.unknown_error",
            message: parsedError.message,
            retryable: false,
            ...(parsedError.retryAfterMs == null ? {} : { retryAfterMs: parsedError.retryAfterMs }),
          };
        }
        if (!parsedError.retryable || attempts >= (this.policy.retry?.maxAttempts ?? 1)) {
          this.circuitBreaker.recordFailure(key);
          const result: CallResult<T> = {
            success: false,
            error: parsedError,
            metadata: { attempts, latencyMs: Date.now() - startTime },
          };
          this.historyRecorder.record(key, result);
          return result;
        }

        this.circuitBreaker.recordFailure(key);
        const delay = this.calculateRetryDelay(attempts, parsedError.retryAfterMs);
        await this.policy.retry?.onRetry?.({ attempt: attempts + 1, error: parsedError });
        if (delay > 0) {
          await this.sleep(delay);
        }
      }
    }
  }

  /**
   * Parses an error to extract error code, message, and retry metadata.
   *
   * Extracts error code from the error's code property (common convention for
   * typed errors). Also checks for retryAfterMs to honor server-suggested
   * retry timing. The retryable flag is determined by isRetryable().
   */
  private parseError(
    error: unknown,
  ): { code: string; message: string; retryable: boolean; retryAfterMs?: number | undefined } {
    if (error instanceof Error) {
      const code = (error as Error & { code?: string }).code ?? "governance.unknown_error";
      const retryAfterMs = (error as Error & { retryAfterMs?: number }).retryAfterMs;
      return {
        code,
        message: error.message,
        retryable: this.isRetryable(code),
        ...(retryAfterMs != null ? { retryAfterMs } : {}),
      };
    }
    return {
      code: "governance.unknown_error",
      message: String(error),
      retryable: false,
    };
  }

  /**
   * Determines if an error code is retryable.
   *
   * Checks against nonRetryableCodes first (takes precedence), then
   * retryableCodes. If the error code contains any nonRetryable string,
   * it is not retryable. If it contains any retryable string, it is
   * retryable. Defaults to true if no matches are found.
   */
  private isRetryable(code: string): boolean {
    if (!this.policy.retry) {
      return false;
    }

    const retryPolicy = createRetryPolicy(this.policy.retry);
    const retryableCodes = retryPolicy.retryableCodes;
    const nonRetryableCodes = retryPolicy.nonRetryableCodes;

    if (nonRetryableCodes?.some((item) => code.includes(item))) {
      return false;
    }
    if (retryableCodes?.some((item) => code.includes(item))) {
      return true;
    }
    return true;
  }

  /**
   * Calculates the delay before the next retry attempt.
   *
   * Uses exponential backoff: baseDelay * (backoffMultiplier ^ attempt).
   * Caps at maxDelayMs. Optionally adds jitter to prevent thundering herd.
   * If retryAfterMs is provided by the server, uses that instead.
   */
  private calculateRetryDelay(attempt: number, retryAfterMs?: number): number {
    if (retryAfterMs != null) {
      return retryAfterMs;
    }

    const retryPolicy = this.policy.retry ?? {
      maxAttempts: 1,
      baseDelayMs: 100,
      maxDelayMs: 5000,
      backoffMultiplier: 2,
    };
    const baseDelay = retryPolicy.baseDelayMs * Math.pow(retryPolicy.backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(baseDelay, retryPolicy.maxDelayMs);

    if (retryPolicy.jitterFactor != null && retryPolicy.jitterFactor > 0) {
      const jitter = cappedDelay * retryPolicy.jitterFactor * Math.random();
      return Math.min(retryPolicy.maxDelayMs, Math.floor(cappedDelay + jitter));
    }

    return Math.floor(cappedDelay);
  }

  /** Promise-based sleep for retry delays. */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
  }

  /** Returns governance statistics for a key. */
  public getStats(key: string): PolicyStats {
    return this.historyRecorder.getStats(key, this.circuitBreaker.getSnapshot(key));
  }

  /** Resets all governance state for a key (rate limiter, circuit breaker, history). */
  public reset(key: string): void {
    this.rateLimiter.reset(key);
    const resetResult = this.distributedRateLimiter?.reset?.(key);
    if (resetResult instanceof Promise) {
      void resetResult.catch(() => {
        // Best-effort distributed cleanup must not block the local reset path.
      });
    }
    this.circuitBreaker.reset(key);
    this.historyRecorder.reset(key);
  }

  /** Updates the governance policy at runtime. */
  public updatePolicy(policy: Partial<CallPolicy>): void {
    this.policy = { ...this.policy, ...policy };
    this.rateLimiter.updateConfig(this.policy.limiter);
    this.circuitBreaker.updateConfig(this.policy.breaker);
  }
}

/**
 * Creates a retry policy with sensible defaults.
 *
 * Default retryable codes: "transient", "rate_limit", "timeout"
 * Default nonRetryable codes: "auth", "forbidden", "not_found"
 */
export function createRetryPolicy(config: Partial<RetryConfig> = {}): RetryConfig {
  return {
    maxAttempts: config.maxAttempts ?? 3,
    baseDelayMs: config.baseDelayMs ?? 100,
    maxDelayMs: config.maxDelayMs ?? 5000,
    backoffMultiplier: config.backoffMultiplier ?? 2,
    jitterFactor: config.jitterFactor ?? 0.1,
    retryableCodes: config.retryableCodes ?? ["transient", "rate_limit", "timeout"],
    nonRetryableCodes: config.nonRetryableCodes ?? ["auth", "forbidden", "not_found"],
  };
}

/**
 * Creates a circuit breaker policy with sensible defaults.
 *
 * Opens after 5 consecutive failures, requires 2 successes in half_open
 * to close, and attempts recovery every 30 seconds.
 */
export function createBreakerPolicy(config: Partial<BreakerConfig> = {}): BreakerConfig {
  return {
    failureThreshold: config.failureThreshold ?? 5,
    successThreshold: config.successThreshold ?? 2,
    resetTimeoutMs: config.resetTimeoutMs ?? 30000,
    ...(config.halfOpenMaxCalls !== undefined ? { halfOpenMaxCalls: config.halfOpenMaxCalls } : {}),
  };
}

/**
 * Creates a rate limiter policy.
 *
 * Requires maxCalls and windowMs. Optionally accepts a keyGenerator
 * for custom rate limiting key derivation from LimiterContext.
 */
export function createLimiterPolicy(
  config: Partial<LimiterConfig> & { maxCalls: number; windowMs: number },
): LimiterConfig {
  return {
    maxCalls: config.maxCalls,
    windowMs: config.windowMs,
    ...(config.keyGenerator ? { keyGenerator: config.keyGenerator } : {}),
  };
}
