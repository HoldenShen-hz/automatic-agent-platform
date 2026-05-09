/**
 * CircuitBreaker - Prevents cascade failures by stopping calls to a failing service
 *
 * States: CLOSED (normal operation) -> OPEN (failing) -> HALF_OPEN (testing recovery)
 *
 * Usage:
 *   const cb = new CircuitBreaker({ failureThreshold: 5, resetTimeout: 30000 });
 *   const result = await cb.execute(async () => fetchData());
 */

export enum CircuitState {
  CLOSED = "CLOSED",
  OPEN = "OPEN",
  HALF_OPEN = "HALF_OPEN",
}

export interface CircuitBreakerOptions {
  failureThreshold?: number;   // Failures before opening circuit (default: 5)
  successThreshold?: number;  // Successes in half-open before closing (default: 2)
  timeout?: number;           // ms before considering operation a failure (default: 30000)
  resetTimeout?: number;      // ms before trying half-open state (default: 60000)
  /** Optional handler for state change events (emits to event bus per §9.4) */
  onStateChange?: (prevState: CircuitState, newState: CircuitState, reason: string) => void;
}

export interface CircuitBreakerStateChangePayload {
  readonly name: string;
  readonly previousState: CircuitState;
  readonly newState: CircuitState;
  readonly reason: string;
  readonly timestamp: string;
}

export interface CircuitBreakerStats {
  state: CircuitState;
  failures: number;
  successes: number;
  lastFailure: number | null;
  lastSuccess: number | null;
  nextAttemptAt: number | null;
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private successes: number = 0;
  private totalRequests: number = 0;
  private lastFailure: number | null = null;
  private lastSuccess: number | null = null;
  private nextAttempt: number = 0;

  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeout: number;
  private readonly resetTimeout: number;
  private readonly onStateChange: ((prevState: CircuitState, newState: CircuitState, reason: string) => void) | undefined;

  constructor(options: CircuitBreakerOptions = {}) {
    this.failureThreshold = options.failureThreshold ?? 5;
    this.successThreshold = options.successThreshold ?? 2;
    this.timeout = options.timeout ?? 30000;
    this.resetTimeout = options.resetTimeout ?? 60000;
    this.onStateChange = options.onStateChange ?? undefined;
  }

  private emitStateChange(newState: CircuitState, reason: string): void {
    if (this.onStateChange) {
      this.onStateChange(this.state, newState, reason);
    }
  }

  /**
   * Get the current failure rate as a percentage.
   * R4-49 FIX: Computed as failures / totalRequests to avoid division by zero
   * when there are no successful requests yet.
   */
  public getFailureRate(): number {
    if (this.totalRequests === 0) {
      return 0;
    }
    return (this.failures / this.totalRequests) * 100;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;
    // Check if circuit should transition from OPEN to HALF_OPEN
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new CircuitBreakerOpenError(
          `Circuit is OPEN. Next attempt allowed at ${new Date(this.nextAttempt).toISOString()}`
        );
      }
      // Transition to half-open to test recovery
      const prevState = this.state;
      this.state = CircuitState.HALF_OPEN;
      this.successes = 0;
      this.emitStateChange(prevState, "half_open_transition");
    }

    try {
      const result = await this.executeWithTimeout(fn);
      this.recordSuccess();
      return result;
    } catch (error) {
      this.recordFailure();
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

  private recordSuccess(): void {
    this.lastSuccess = Date.now();
    const prevState = this.state;
    this.failures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        // Successful recovery - close the circuit
        this.state = CircuitState.CLOSED;
        this.successes = 0;
        this.emitStateChange(prevState, "successful_recovery");
      }
    }
  }

  private recordFailure(): void {
    this.lastFailure = Date.now();
    const prevState = this.state;
    this.failures++;

    if (this.state === CircuitState.HALF_OPEN) {
      // Failed recovery attempt - go back to open
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.resetTimeout;
      this.emitStateChange(prevState, "half_open_recovery_failed");
    } else if (this.failures >= this.failureThreshold) {
      // Threshold exceeded - open the circuit
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.resetTimeout;
      this.emitStateChange(prevState, "failure_threshold_exceeded");
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
      nextAttemptAt: this.state === CircuitState.OPEN ? this.nextAttempt : null,
    };
  }

  /**
   * Manually reset the circuit to closed state
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.totalRequests = 0;
    this.lastFailure = null;
    this.lastSuccess = null;
    this.nextAttempt = 0;
  }

  /**
   * Force the circuit into a specific state
   */
  forceState(state: CircuitState): void {
    if (state === CircuitState.OPEN) {
      this.nextAttempt = Date.now() + this.resetTimeout;
    }
    this.state = state;
    if (state === CircuitState.CLOSED) {
      this.totalRequests = 0;
    }
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