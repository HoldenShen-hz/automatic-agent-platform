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
/**
 * Rate limiter configuration.
 *
 * Implements a sliding window rate limiter that tracks call counts per key
 * within a configurable time window. Calls exceeding the limit are rejected
 * with a retry-after hint.
 */
export interface LimiterConfig {
    maxCalls: number;
    windowMs: number;
    keyGenerator?: ((context: LimiterContext) => string) | undefined;
}
export interface LimiterContext {
    provider?: string;
    model?: string;
    tenantId?: string;
    taskId?: string;
    endpoint?: string;
}
/** Circuit breaker states: closed (normal), open (failing fast), half_open (testing recovery). */
export type CircuitState = "closed" | "open" | "half_open";
/**
 * Circuit breaker configuration.
 *
 * The circuit breaker prevents cascading failures by tracking failures and
 * "opening" the circuit when failures exceed a threshold. In the open state,
 * calls fail immediately without attempting the operation. After a reset
 * timeout, it enters half_open state to test if the service has recovered.
 */
export interface BreakerConfig {
    failureThreshold: number;
    successThreshold: number;
    resetTimeoutMs: number;
    halfOpenMaxCalls?: number | undefined;
}
/**
 * Retry configuration with exponential backoff.
 *
 * Controls automatic retry behavior for failed calls. The retry delay follows
 * an exponential backoff formula: baseDelay * (backoffMultiplier ^ attempt).
 * Jitter adds randomness to prevent thundering herd when multiple clients retry.
 *
 * Error codes are classified as retryable or non-retryable. By default, errors
 * containing "transient", "rate_limit", or "timeout" are retryable; errors
 * containing "auth", "forbidden", or "not_found" are not.
 */
export interface RetryConfig {
    maxAttempts: number;
    baseDelayMs: number;
    maxDelayMs: number;
    backoffMultiplier: number;
    jitterFactor?: number | undefined;
    retryableCodes?: string[] | undefined;
    nonRetryableCodes?: string[] | undefined;
}
export interface CallResult<T> {
    success: boolean;
    data?: T;
    error?: {
        code: string;
        message: string;
        retryable: boolean;
        retryAfterMs?: number | undefined;
    };
    metadata?: {
        attempts: number;
        latencyMs: number;
        circuitState?: CircuitState | undefined;
    };
}
/**
 * Combined governance policy specifying limiter, breaker, and retry settings.
 *
 * All three patterns are optional. If a pattern is omitted, calls proceed
 * without that governance check.
 */
export interface CallPolicy {
    limiter?: LimiterConfig | undefined;
    breaker?: BreakerConfig | undefined;
    retry?: RetryConfig | undefined;
}
export interface PolicyStats {
    totalCalls: number;
    successfulCalls: number;
    failedCalls: number;
    rejectedCalls: number;
    currentCircuitState: CircuitState;
    lastFailure?: string;
    lastFailureAt?: string;
}
export interface DistributedRateLimiterLike {
    checkAndConsume(key: string): Promise<{
        allowed: boolean;
        retryAfterMs?: number | undefined;
    }>;
    reset?(key: string): Promise<void> | void;
}
export interface CallGovernanceOptions {
    distributedRateLimiter?: DistributedRateLimiterLike | null;
}
/**
 * Snapshot of circuit breaker state for a given key.
 * @internal
 */
interface CircuitBreakerSnapshot {
    failures: number;
    state: CircuitState;
    lastFailure: number;
}
/**
 * Sliding window rate limiter for API call governance.
 *
 * Tracks call counts per key within a time window. When the limit is exceeded,
 * returns retryAfterMs to indicate when the caller may retry.
 */
export declare class CallRateLimiter {
    private config;
    private readonly entries;
    constructor(config: LimiterConfig | null | undefined);
    /**
     * Removes expired entries to prevent memory growth.
     * Called periodically by CallGovernance to clean up stale entries.
     */
    evictExpired(now?: number): void;
    /**
     * Checks if a call is allowed and consumes a token if so.
     *
     * If no entry exists for the key, creates one and allows the call.
     * If the entry exists but the window has expired, resets and allows.
     * If within the window and under the limit, increments and allows.
     * If within the window but at or over the limit, rejects with retryAfterMs.
     */
    checkAndConsume(key: string, now?: number): {
        allowed: boolean;
        retryAfterMs?: number | undefined;
    };
    reset(key: string): void;
    updateConfig(config: LimiterConfig | null | undefined): void;
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
export declare class CallCircuitBreaker {
    private config;
    private readonly entries;
    constructor(config: BreakerConfig | null | undefined);
    /**
     * Removes expired breaker entries to prevent memory growth.
     * Closed entries are removed if no failures recently; open entries are
     * removed if they've been open for twice the reset timeout.
     */
    evictExpired(now?: number): void;
    /**
     * Checks if a call is allowed under the circuit breaker.
     *
     * Returns the current circuit state and whether the call is allowed:
     * - closed: always allowed, tracks failures
     * - open: not allowed, returns retryAfterMs until timeout
     * - half_open: allowed up to halfOpenMaxCalls to test recovery
     */
    check(key: string, now?: number): {
        allowed: boolean;
        state: CircuitState;
        retryAfterMs?: number | undefined;
    };
    /**
     * Records a successful call.
     *
     * In closed state: decrements failure count (graceful recovery).
     * In half_open state: increments success count; if threshold reached,
     * transitions to closed (recovery successful).
     */
    recordSuccess(key: string): void;
    /**
     * Records a failed call.
     *
     * In half_open state: immediately opens the circuit (recovery failed).
     * In closed state: increments failure count; if threshold reached,
     * transitions to open (fail fast mode).
     */
    recordFailure(key: string): void;
    getSnapshot(key: string): CircuitBreakerSnapshot | null;
    reset(key: string): void;
    updateConfig(config: BreakerConfig | null | undefined): void;
}
/**
 * Records call results for statistics and observability.
 *
 * Maintains a rolling history of call results per key, capped at MAX_HISTORY
 * entries to prevent unbounded memory growth. Used to compute PolicyStats.
 */
export declare class CallHistoryRecorder {
    private static readonly MAX_HISTORY;
    private readonly historyByKey;
    /**
     * Records a call result, trimming old entries when the limit is exceeded.
     */
    record(key: string, result: CallResult<unknown>): void;
    /**
     * Computes statistics for a given key based on recorded call history.
     *
     * Counts total, successful, failed (non-governance errors), and rejected
     * (limiter or circuit breaker) calls. Includes current circuit breaker state.
     */
    getStats(key: string, breaker: CircuitBreakerSnapshot | null): PolicyStats;
    /** Clears recorded history for a key. */
    reset(key: string): void;
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
export declare class CallGovernance {
    private policy;
    private readonly rateLimiter;
    private readonly circuitBreaker;
    private readonly distributedRateLimiter;
    private readonly historyRecorder;
    private lastEvictionTime;
    private readonly evictionIntervalMs;
    constructor(policy: CallPolicy, options?: CallGovernanceOptions);
    /**
     * Periodically evicts expired entries from rate limiter and circuit breaker.
     * Runs at most once per evictionIntervalMs to avoid overhead.
     */
    private evictExpired;
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
    execute<T>(key: string, call: () => Promise<T>): Promise<CallResult<T>>;
    /**
     * Parses an error to extract error code, message, and retry metadata.
     *
     * Extracts error code from the error's code property (common convention for
     * typed errors). Also checks for retryAfterMs to honor server-suggested
     * retry timing. The retryable flag is determined by isRetryable().
     */
    private parseError;
    /**
     * Determines if an error code is retryable.
     *
     * Checks against nonRetryableCodes first (takes precedence), then
     * retryableCodes. If the error code contains any nonRetryable string,
     * it is not retryable. If it contains any retryable string, it is
     * retryable. Defaults to true if no matches are found.
     */
    private isRetryable;
    /**
     * Calculates the delay before the next retry attempt.
     *
     * Uses exponential backoff: baseDelay * (backoffMultiplier ^ attempt).
     * Caps at maxDelayMs. Optionally adds jitter to prevent thundering herd.
     * If retryAfterMs is provided by the server, uses that instead.
     */
    private calculateRetryDelay;
    /** Promise-based sleep for retry delays. */
    private sleep;
    /** Returns governance statistics for a key. */
    getStats(key: string): PolicyStats;
    /** Resets all governance state for a key (rate limiter, circuit breaker, history). */
    reset(key: string): void;
    /** Updates the governance policy at runtime. */
    updatePolicy(policy: Partial<CallPolicy>): void;
}
/**
 * Creates a retry policy with sensible defaults.
 *
 * Default retryable codes: "transient", "rate_limit", "timeout"
 * Default nonRetryable codes: "auth", "forbidden", "not_found"
 */
export declare function createRetryPolicy(config?: Partial<RetryConfig>): RetryConfig;
/**
 * Creates a circuit breaker policy with sensible defaults.
 *
 * Opens after 5 consecutive failures, requires 2 successes in half_open
 * to close, and attempts recovery every 30 seconds.
 */
export declare function createBreakerPolicy(config?: Partial<BreakerConfig>): BreakerConfig;
/**
 * Creates a rate limiter policy.
 *
 * Requires maxCalls and windowMs. Optionally accepts a keyGenerator
 * for custom rate limiting key derivation from LimiterContext.
 */
export declare function createLimiterPolicy(config: Partial<LimiterConfig> & {
    maxCalls: number;
    windowMs: number;
}): LimiterConfig;
export {};
