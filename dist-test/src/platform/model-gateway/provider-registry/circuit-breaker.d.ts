/**
 * @fileoverview Circuit Breaker - Fault tolerance pattern for provider calls.
 *
 * Prevents cascading failures by tracking provider health and blocking
 * requests when a provider is deemed unhealthy.
 */
/**
 * Circuit breaker states.
 */
export type CircuitBreakerState = "closed" | "open" | "half_open";
/**
 * Circuit breaker options.
 */
export interface CircuitBreakerOptions {
    /** Name for logging and debugging */
    name: string;
    /** Number of failures before opening circuit (default: 5) */
    failureThreshold?: number;
    /** Time in ms before attempting recovery (default: 30000) */
    resetTimeoutMs?: number;
    /** Success count needed to close circuit from half-open (default: 3) */
    halfOpenSuccessThreshold?: number;
    /** Monitor window in ms for failure rate calculation (default: 60000) */
    monitorWindowMs?: number;
}
/**
 * Circuit breaker metrics snapshot.
 */
export interface CircuitBreakerMetrics {
    state: CircuitBreakerState;
    failures: number;
    successes: number;
    consecutiveFailures: number;
    consecutiveSuccesses: number;
    lastFailureAt: number | null;
    lastSuccessAt: number | null;
    nextAttemptAt: number | null;
}
/**
 * CircuitBreaker implements the circuit breaker pattern for fault tolerance.
 *
 * States:
 * - closed: Normal operation, requests pass through
 * - open: Too many failures, requests are rejected immediately
 * - half_open: Testing if service has recovered, limited requests pass through
 */
export declare class CircuitBreaker {
    private readonly name;
    private readonly failureThreshold;
    private readonly resetTimeoutMs;
    private readonly halfOpenSuccessThreshold;
    private readonly monitorWindowMs;
    private state;
    private failures;
    private successes;
    private consecutiveFailures;
    private consecutiveSuccesses;
    private halfOpenInFlight;
    private lastFailureAt;
    private lastSuccessAt;
    private nextAttemptAt;
    private readonly failureTimestamps;
    constructor(options: CircuitBreakerOptions);
    /**
     * Execute a function with circuit breaker protection.
     * Throws error if circuit is open.
     */
    execute<T>(fn: () => Promise<T>): Promise<T>;
    /**
     * Record a successful call.
     */
    onSuccess(): void;
    /**
     * Record a failed call.
     */
    onFailure(): void;
    /**
     * Get current circuit breaker state.
     */
    getState(): CircuitBreakerState;
    /**
     * Get circuit breaker metrics.
     */
    getMetrics(): CircuitBreakerMetrics;
    /**
     * Check if circuit allows execution.
     */
    private canExecute;
    /**
     * Transition to a new state.
     */
    private transitionTo;
    /**
     * Calculate failure rate within monitoring window.
     */
    private getRecentFailureRate;
    /**
     * Remove old failure timestamps outside monitoring window.
     */
    private pruneFailureTimestamps;
}
/**
 * Error thrown when circuit breaker is open.
 */
export declare class CircuitBreakerOpenError extends Error {
    readonly circuitName: string;
    readonly retryAfterMs: number | null;
    constructor(message: string, circuitName: string, retryAfterMs: number | null);
}
