/**
 * @fileoverview Circuit Breaker - Fault tolerance pattern for provider calls.
 *
 * Prevents cascading failures by tracking provider health and blocking
 * requests when a provider is deemed unhealthy.
 */

import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

/**
 * Circuit breaker state change event payload.
 */
export interface CircuitBreakerStateChangePayload {
  circuitName: string;
  oldState: CircuitBreakerState;
  newState: CircuitBreakerState;
  nextAttemptAt: number | null;
  occurredAt: string;
}

/**
 * Circuit breaker events for event bus emission.
 */
export const CIRCUIT_BREAKER_EVENTS = {
  STATE_CHANGED: "circuit_breaker:state_changed",
} as const;

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
  /** Optional callback for state change events per §9.4 */
  onStateChange?: (payload: CircuitBreakerStateChangePayload) => void;
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
export class CircuitBreaker {
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly resetTimeoutMs: number;
  private readonly halfOpenSuccessThreshold: number;
  private readonly monitorWindowMs: number;

  private state: CircuitBreakerState = "closed";
  private failures = 0;
  private successes = 0;
  private consecutiveFailures = 0;
  private consecutiveSuccesses = 0;
  // PROV-01: number of probe requests currently admitted in half_open.
  private halfOpenInFlight = 0;
  private lastFailureAt: number | null = null;
  private lastSuccessAt: number | null = null;
  private nextAttemptAt: number | null = null;
  private readonly onStateChange?: (payload: CircuitBreakerStateChangePayload) => void;

  // Track failures within monitoring window for rate-based decisions
  private readonly failureTimestamps: number[] = [];

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.resetTimeoutMs = options.resetTimeoutMs ?? 30_000;
    this.halfOpenSuccessThreshold = options.halfOpenSuccessThreshold ?? 3;
    this.monitorWindowMs = options.monitorWindowMs ?? 60_000;
    this.onStateChange = options.onStateChange;
  }

  /**
   * Execute a function with circuit breaker protection.
   * Throws error if circuit is open.
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.canExecute()) {
      throw new CircuitBreakerOpenError(
        `Circuit breaker '${this.name}' is open`,
        this.name,
        this.nextAttemptAt,
      );
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Record a successful call.
   */
  onSuccess(): void {
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
  onFailure(): void {
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
      if (
        this.consecutiveFailures >= this.failureThreshold ||
        this.getRecentFailureRate() >= 0.5 // 50% failure rate
      ) {
        this.transitionTo("open");
      }
    } else if (this.state === "half_open") {
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
  getState(): CircuitBreakerState {
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
  getMetrics(): CircuitBreakerMetrics {
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
  private canExecute(): boolean {
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
  private transitionTo(newState: CircuitBreakerState): void {
    const oldState = this.state;
    this.state = newState;

    if (newState === "open") {
      this.nextAttemptAt = Date.now() + this.resetTimeoutMs;
      this.consecutiveSuccesses = 0;
      this.halfOpenInFlight = 0;
    } else if (newState === "half_open") {
      this.nextAttemptAt = null;
      this.consecutiveSuccesses = 0;
      this.halfOpenInFlight = 0;
    } else if (newState === "closed") {
      this.nextAttemptAt = null;
      this.consecutiveFailures = 0;
      this.consecutiveSuccesses = 0;
      this.failureTimestamps.length = 0;
      this.halfOpenInFlight = 0;
    }

    // Emit state change event per §9.4
    const payload: CircuitBreakerStateChangePayload = {
      circuitName: this.name,
      oldState,
      newState,
      nextAttemptAt: this.nextAttemptAt,
      occurredAt: new Date().toISOString(),
    };
    this.onStateChange?.(payload);

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
  private getRecentFailureRate(): number {
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
  private pruneFailureTimestamps(now: number): void {
    const cutoff = now - this.monitorWindowMs;
    while (this.failureTimestamps.length > 0 && this.failureTimestamps[0]! < cutoff) {
      this.failureTimestamps.shift();
    }
  }
}

/**
 * Error thrown when circuit breaker is open.
 */
export class CircuitBreakerOpenError extends Error {
  constructor(
    message: string,
    public readonly circuitName: string,
    public readonly retryAfterMs: number | null,
  ) {
    super(message);
    this.name = "CircuitBreakerOpenError";
  }
}
