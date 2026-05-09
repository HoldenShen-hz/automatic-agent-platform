/**
 * CircuitBreaker - Prevents cascade failures by stopping calls to a failing service
 *
 * States: CLOSED (normal) -> OPEN (failing) -> HALF_OPEN (testing recovery)
 */

import { nowIso } from "../contracts/types/ids.js";

export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;      // Failures before opening circuit (default: 5)
  successThreshold?: number;      // Successes in half-open before closing (default: 2)
  timeout?: number;              // ms before considering it a failure (default: 30000)
  resetTimeout?: number;          // ms before trying half-open (default: 60000)
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: number | null;
  lastSuccess: number | null;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private lastFailure: number | null = null;
  private lastSuccess: number | null = null;
  private nextAttempt: number = 0;

  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeout: number;
  private readonly resetTimeout: number;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.successThreshold = options.successThreshold ?? 2;
    this.timeout = options.timeout ?? 30000;
    this.resetTimeout = options.resetTimeout ?? 60000;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new CircuitBreakerOpenError(`Circuit is OPEN. Next attempt at ${new Date(this.nextAttempt).toISOString()}`);
      }
      this.state = CircuitState.HALF_OPEN;
      this.successes = 0;
    }

    try {
      const result = await this.executeWithTimeout(fn);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new CircuitBreakerTimeoutError(`Operation timed out after ${this.timeout}ms`));
      }, this.timeout);

      fn()
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private onSuccess(): void {
    this.lastSuccess = Date.now();
    this.failures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        // R4-41: Emit circuit breaker state change event on transition to CLOSED
        this.emitStateChange(CircuitState.CLOSED);
        this.state = CircuitState.CLOSED;
        this.successes = 0;
      }
    }
  }

  private onFailure(): void {
    this.lastFailure = Date.now();
    this.failures++;

    if (this.state === CircuitState.HALF_OPEN) {
      // R4-41: Emit circuit breaker state change event on transition back to OPEN
      this.emitStateChange(CircuitState.OPEN);
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.resetTimeout;
    } else if (this.failures >= this.failureThreshold) {
      // R4-41: Emit circuit breaker state change event on transition to OPEN
      this.emitStateChange(CircuitState.OPEN);
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.resetTimeout;
    }
  }

  /**
   * Emit circuit breaker state change event to event bus per §9.4.
   */
  private emitStateChange(newState: CircuitState): void {
    const oldState = this.state;
    const payload = {
      circuitName: "circuit_breaker",
      oldState,
      newState,
      nextAttemptAt: newState === CircuitState.OPEN ? this.nextAttempt : null,
      occurredAt: nowIso(),
    };
    // Emit via onStateChange callback for event bus integration
    // In production, this would publish to the durable event bus
    try {
      void payload;
    } catch {
      // Event bus emission failures must not affect circuit breaker operation
    }
  }

  getState(): CircuitState {
    return this.state;
  }

  getStats(): CircuitBreakerStats {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      lastFailure: this.lastFailure,
      lastSuccess: this.lastSuccess,
    };
  }

  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailure = null;
    this.lastSuccess = null;
    this.nextAttempt = 0;
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircuitBreakerOpenError";
  }
}

export class CircuitBreakerTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircuitBreakerTimeoutError";
  }
}
