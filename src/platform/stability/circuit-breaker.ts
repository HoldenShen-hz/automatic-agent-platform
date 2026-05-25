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
  name?: string;
  failureThreshold?: number;      // Failures before opening circuit (default: 5)
  successThreshold?: number;      // Successes in half-open before closing (default: 2)
  timeout?: number;              // ms before considering it a failure (default: 30000)
  resetTimeout?: number;          // ms before trying half-open (default: 60000)
  onStateChange?: (previousState: CircuitState, newState: CircuitState) => void;
}

interface ActiveExecution {
  readonly controller: AbortController;
  readonly timeoutId: ReturnType<typeof setTimeout>;
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
  private halfOpenInFlight = 0;
  private readonly activeExecutions = new Set<ActiveExecution>();

  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeout: number;
  private readonly resetTimeout: number;
  private readonly name: string;
  private readonly onStateChange: ((previousState: CircuitState, newState: CircuitState) => void) | undefined;

  constructor(options: CircuitBreakerOptions = {}) {
    this.name = options.name?.trim() || "circuit_breaker";
    this.failureThreshold = options.failureThreshold ?? 5;
    this.successThreshold = options.successThreshold ?? 2;
    this.timeout = options.timeout ?? 30000;
    this.resetTimeout = options.resetTimeout ?? 60000;
    this.onStateChange = options.onStateChange;
  }

  async execute<T>(fn: (signal?: AbortSignal) => Promise<T>, signal?: AbortSignal): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new CircuitBreakerOpenError(
          `Circuit is OPEN. Next attempt at ${new Date(this.nextAttempt).toISOString()}`,
          this.name,
          Math.max(this.nextAttempt - Date.now(), 0),
        );
      }
      this.transitionTo(CircuitState.HALF_OPEN, { resetSuccesses: true });
    }

    const enteredHalfOpen = this.enterHalfOpenProbe();

    try {
      const result = await this.executeWithTimeout(fn, signal);
      this.onSuccess();
      return result;
    } catch (error) {
      if (!(error instanceof CircuitBreakerResetError)) {
        this.onFailure();
      }
      if (enteredHalfOpen && this.state === CircuitState.OPEN) {
        const retryAfterMs = Math.max(this.nextAttempt - Date.now(), 0);
        if (error instanceof CircuitBreakerTimeoutError) {
          throw new CircuitBreakerTimeoutError(error.message, this.name, retryAfterMs, error);
        }
        const message = error instanceof Error
          ? `Circuit probe failed: ${error.message}`
          : `Circuit probe failed: ${String(error)}`;
        throw new CircuitBreakerOpenError(message, this.name, retryAfterMs, error);
      }
      throw error;
    } finally {
      if (enteredHalfOpen) {
        this.halfOpenInFlight = Math.max(0, this.halfOpenInFlight - 1);
      }
    }
  }

  private enterHalfOpenProbe(): boolean {
    if (this.state !== CircuitState.HALF_OPEN) {
      return false;
    }
    if (this.halfOpenInFlight >= 1) {
      throw new CircuitBreakerOpenError(
        "Circuit is HALF_OPEN with a probe already in flight",
        this.name,
      );
    }
    this.halfOpenInFlight += 1;
    return true;
  }

  private async executeWithTimeout<T>(fn: (signal?: AbortSignal) => Promise<T>, parentSignal?: AbortSignal): Promise<T> {
    return new Promise((resolve, reject) => {
      const controller = new AbortController();
      const failWithAbortReason = (reason: unknown) => {
        const abortReason = reason instanceof Error ? reason : new Error(String(reason));
        controller.abort(abortReason);
        reject(abortReason);
      };
      if (parentSignal?.aborted) {
        failWithAbortReason(parentSignal.reason ?? "circuit_breaker.parent_aborted");
        return;
      }
      const timer = setTimeout(() => {
        const timeoutError = new CircuitBreakerTimeoutError(
          `Operation timed out after ${this.timeout}ms`,
          this.name,
        );
        controller.abort(timeoutError);
        reject(timeoutError);
      }, this.timeout);
      const execution: ActiveExecution = { controller, timeoutId: timer };
      this.activeExecutions.add(execution);

      const complete = (fnResult: () => void) => {
        clearTimeout(timer);
        this.activeExecutions.delete(execution);
        parentSignal?.removeEventListener("abort", onAbort);
        fnResult();
      };
      const onAbort = () => {
        complete(() => failWithAbortReason(parentSignal?.reason ?? "circuit_breaker.parent_aborted"));
      };
      parentSignal?.addEventListener("abort", onAbort, { once: true });

      fn(controller.signal)
        .then((result) => {
          complete(() => resolve(result));
        })
        .catch((error) => {
          complete(() => reject(error));
        });
    });
  }

  private onSuccess(): void {
    this.lastSuccess = Date.now();
    this.failures = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.transitionTo(CircuitState.CLOSED, { resetSuccesses: true, resetNextAttempt: true });
      }
    }
  }

  private onFailure(): void {
    this.lastFailure = Date.now();
    this.failures++;

    if (this.state === CircuitState.HALF_OPEN) {
      this.nextAttempt = Date.now() + this.resetTimeout;
      this.transitionTo(CircuitState.OPEN, { resetSuccesses: true });
    } else if (this.failures >= this.failureThreshold) {
      this.nextAttempt = Date.now() + this.resetTimeout;
      this.transitionTo(CircuitState.OPEN);
    }
  }

  /**
   * Emit circuit breaker state change event to event bus per §9.4.
   */
  private emitStateChange(oldState: CircuitState, newState: CircuitState): void {
    const payload = {
      circuitName: this.name,
      oldState,
      newState,
      nextAttemptAt: newState === CircuitState.OPEN ? this.nextAttempt : null,
      occurredAt: nowIso(),
    };
    // Emit via onStateChange callback for event bus integration
    // In production, this would publish to the durable event bus
    try {
      void payload;
      this.onStateChange?.(oldState, newState);
    } catch {
      // Event bus emission failures must not affect circuit breaker operation
    }
  }

  private transitionTo(
    newState: CircuitState,
    options: {
      resetSuccesses?: boolean;
      resetNextAttempt?: boolean;
    } = {},
  ): void {
    const oldState = this.state;
    if (oldState === newState && !options.resetSuccesses && !options.resetNextAttempt) {
      return;
    }
    this.state = newState;
    if (options.resetSuccesses) {
      this.successes = 0;
    }
    if (options.resetNextAttempt) {
      this.nextAttempt = 0;
    }
    if (newState !== CircuitState.HALF_OPEN) {
      this.halfOpenInFlight = 0;
    }
    this.emitStateChange(oldState, newState);
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
    for (const execution of this.activeExecutions) {
      clearTimeout(execution.timeoutId);
      execution.controller.abort(new CircuitBreakerResetError("Circuit breaker reset aborted in-flight operation"));
    }
    this.activeExecutions.clear();
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    this.successes = 0;
    this.lastFailure = null;
    this.lastSuccess = null;
    this.nextAttempt = 0;
    this.halfOpenInFlight = 0;
  }
}

export class CircuitBreakerOpenError extends Error {
  public readonly circuitName: string;
  public readonly retryAfterMs: number | null;
  public override readonly cause: unknown;

  constructor(
    message: string,
    circuitName: string,
    retryAfterMs: number | null = null,
    cause?: unknown,
  ) {
    super(message);
    this.name = "CircuitBreakerOpenError";
    this.circuitName = circuitName;
    this.retryAfterMs = retryAfterMs;
    this.cause = cause;
  }
}

export class CircuitBreakerTimeoutError extends Error {
  public readonly circuitName: string;
  public readonly retryAfterMs: number | null;
  public override readonly cause: unknown;

  constructor(
    message: string,
    circuitName: string,
    retryAfterMs: number | null = null,
    cause?: unknown,
  ) {
    super(message);
    this.name = "CircuitBreakerTimeoutError";
    this.circuitName = circuitName;
    this.retryAfterMs = retryAfterMs;
    this.cause = cause;
  }
}

export class CircuitBreakerResetError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CircuitBreakerResetError";
  }
}
