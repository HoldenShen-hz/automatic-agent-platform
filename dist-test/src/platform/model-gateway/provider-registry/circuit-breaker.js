/**
 * @fileoverview Circuit Breaker - Fault tolerance pattern for provider calls.
 *
 * Prevents cascading failures by tracking provider health and blocking
 * requests when a provider is deemed unhealthy.
 */
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
const logger = new StructuredLogger({ retentionLimit: 100 });
/**
 * CircuitBreaker implements the circuit breaker pattern for fault tolerance.
 *
 * States:
 * - closed: Normal operation, requests pass through
 * - open: Too many failures, requests are rejected immediately
 * - half_open: Testing if service has recovered, limited requests pass through
 */
export class CircuitBreaker {
    name;
    failureThreshold;
    resetTimeoutMs;
    halfOpenSuccessThreshold;
    monitorWindowMs;
    state = "closed";
    failures = 0;
    successes = 0;
    consecutiveFailures = 0;
    consecutiveSuccesses = 0;
    // PROV-01: number of probe requests currently admitted in half_open.
    halfOpenInFlight = 0;
    lastFailureAt = null;
    lastSuccessAt = null;
    nextAttemptAt = null;
    // Track failures within monitoring window for rate-based decisions
    failureTimestamps = [];
    constructor(options) {
        this.name = options.name;
        this.failureThreshold = options.failureThreshold ?? 5;
        this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000;
        this.halfOpenSuccessThreshold = options.halfOpenSuccessThreshold ?? 3;
        this.monitorWindowMs = options.monitorWindowMs ?? 60_000;
    }
    /**
     * Execute a function with circuit breaker protection.
     * Throws error if circuit is open.
     */
    async execute(fn) {
        if (!this.canExecute()) {
            throw new CircuitBreakerOpenError(`Circuit breaker '${this.name}' is open`, this.name, this.nextAttemptAt);
        }
        try {
            const result = await fn();
            this.onSuccess();
            return result;
        }
        catch (error) {
            this.onFailure();
            throw error;
        }
    }
    /**
     * Record a successful call.
     */
    onSuccess() {
        const now = Date.now();
        this.lastSuccessAt = now;
        this.successes++;
        this.consecutiveFailures = 0;
        if (this.state === "half_open") {
            this.consecutiveSuccesses++;
            if (this.halfOpenInFlight > 0) {
                this.halfOpenInFlight--;
            }
            if (this.consecutiveSuccesses >= this.halfOpenSuccessThreshold) {
                this.transitionTo("closed");
            }
        }
        logger.log({
            level: "debug",
            message: `circuit_breaker:success`,
            data: {
                name: this.name,
                state: this.state,
                consecutiveSuccesses: this.consecutiveSuccesses,
            },
        });
    }
    /**
     * Record a failed call.
     */
    onFailure() {
        const now = Date.now();
        this.lastFailureAt = now;
        this.failures++;
        this.consecutiveFailures++;
        this.consecutiveSuccesses = 0;
        // Track failure for rate-based opening
        this.failureTimestamps.push(now);
        this.pruneFailureTimestamps(now);
        if (this.state === "closed") {
            // Open circuit if failure threshold reached or failure rate is high
            if (this.consecutiveFailures >= this.failureThreshold ||
                this.getRecentFailureRate() >= 0.5 // 50% failure rate
            ) {
                this.transitionTo("open");
            }
        }
        else if (this.state === "half_open") {
            // Any failure in half-open goes back to open
            this.transitionTo("open");
        }
        logger.log({
            level: "debug",
            message: `circuit_breaker:failure`,
            data: {
                name: this.name,
                state: this.state,
                consecutiveFailures: this.consecutiveFailures,
                recentFailureRate: this.getRecentFailureRate(),
            },
        });
    }
    /**
     * Get current circuit breaker state.
     */
    getState() {
        // Check if we should transition from open to half_open
        if (this.state === "open" && this.nextAttemptAt !== null) {
            if (Date.now() >= this.nextAttemptAt) {
                this.transitionTo("half_open");
            }
        }
        return this.state;
    }
    /**
     * Get circuit breaker metrics.
     */
    getMetrics() {
        return {
            state: this.getState(),
            failures: this.failures,
            successes: this.successes,
            consecutiveFailures: this.consecutiveFailures,
            consecutiveSuccesses: this.consecutiveSuccesses,
            lastFailureAt: this.lastFailureAt,
            lastSuccessAt: this.lastSuccessAt,
            nextAttemptAt: this.nextAttemptAt,
        };
    }
    /**
     * Check if circuit allows execution.
     */
    canExecute() {
        if (this.state === "closed") {
            return true;
        }
        if (this.state === "open") {
            if (this.nextAttemptAt !== null && Date.now() >= this.nextAttemptAt) {
                this.transitionTo("half_open");
                this.halfOpenInFlight++;
                return true;
            }
            return false;
        }
        // PROV-01: half_open admits at most one probe at a time. Previously every
        // caller was allowed through, which re-amplified load against a struggling
        // provider instead of gradually testing recovery.
        if (this.halfOpenInFlight >= 1) {
            return false;
        }
        this.halfOpenInFlight++;
        return true;
    }
    /**
     * Transition to a new state.
     */
    transitionTo(newState) {
        const oldState = this.state;
        this.state = newState;
        if (newState === "open") {
            this.nextAttemptAt = Date.now() + this.resetTimeoutMs;
            this.consecutiveSuccesses = 0;
            this.halfOpenInFlight = 0;
        }
        else if (newState === "half_open") {
            this.nextAttemptAt = null;
            this.consecutiveSuccesses = 0;
            this.halfOpenInFlight = 0;
        }
        else if (newState === "closed") {
            this.nextAttemptAt = null;
            this.consecutiveFailures = 0;
            this.consecutiveSuccesses = 0;
            this.failureTimestamps.length = 0;
            this.halfOpenInFlight = 0;
        }
        logger.log({
            level: "info",
            message: `circuit_breaker:state_change`,
            data: {
                name: this.name,
                oldState,
                newState,
                nextAttemptAt: this.nextAttemptAt,
            },
        });
    }
    /**
     * Calculate failure rate within monitoring window.
     */
    getRecentFailureRate() {
        this.pruneFailureTimestamps(Date.now());
        const recentFailures = this.failureTimestamps.length;
        const windowSeconds = this.monitorWindowMs / 1000;
        // Approximate rate: failures per second * window
        // If we have 3 failures in 60s, rate is low
        // If we have 30 failures in 60s, rate is high
        return Math.min(1, (recentFailures / windowSeconds) * 10); // Normalize to 0-1
    }
    /**
     * Remove old failure timestamps outside monitoring window.
     */
    pruneFailureTimestamps(now) {
        const cutoff = now - this.monitorWindowMs;
        while (this.failureTimestamps.length > 0 && this.failureTimestamps[0] < cutoff) {
            this.failureTimestamps.shift();
        }
    }
}
/**
 * Error thrown when circuit breaker is open.
 */
export class CircuitBreakerOpenError extends Error {
    circuitName;
    retryAfterMs;
    constructor(message, circuitName, retryAfterMs) {
        super(message);
        this.circuitName = circuitName;
        this.retryAfterMs = retryAfterMs;
        this.name = "CircuitBreakerOpenError";
    }
}
//# sourceMappingURL=circuit-breaker.js.map