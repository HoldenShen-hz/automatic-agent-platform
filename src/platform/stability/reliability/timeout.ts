/**
 * Timeout - Wraps operations with configurable timeout constraints
 *
 * Supports: absolute timeouts, countdown timers, early rejection, cleanup
 *
 * Usage:
 *   const timeout = new Timeout({ timeoutMs: 5000 });
 *   const result = await timeout.wrap(async () => fetchData());
 */

export enum TimeoutState {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  TIMED_OUT = "TIMED_OUT",
  CANCELLED = "CANCELLED",
}

export interface TimeoutOptions {
  timeoutMs: number;              // Maximum time allowed (required)
  cleanupFn?: (() => void) | undefined;  // Called on timeout/cancellation for cleanup
  propagateError?: boolean;      // Whether to throw TimeoutError (default: true)
}

export interface TimeoutStats {
  state: TimeoutState;
  elapsedMs: number;
  remainingMs: number;
  result?: unknown;
  error: Error | undefined;
}

export class Timeout {
  private readonly timeoutMs: number;
  private readonly cleanupFn?: () => void;
  private readonly propagateError: boolean;

  private state: TimeoutState = TimeoutState.PENDING;
  private startTime: number = 0;
  private result: unknown;
  private error: Error | undefined;

  constructor(options: TimeoutOptions) {
    if (!options.timeoutMs || options.timeoutMs <= 0) {
      throw new Error("timeoutMs must be a positive number");
    }
    this.timeoutMs = options.timeoutMs;
    this.cleanupFn = options.cleanupFn;
    this.propagateError = options.propagateError ?? true;
  }

  async wrap<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state !== TimeoutState.PENDING) {
      throw new Error(`Cannot start timeout in ${this.state} state`);
    }

    this.state = TimeoutState.RUNNING;
    this.startTime = Date.now();

    const timeoutPromise = this.createTimeoutPromise();

    try {
      const result = await Promise.race([fn(), timeoutPromise]);
      this.state = TimeoutState.COMPLETED;
      this.result = result;
      return result as T;
    } catch (error) {
      if (error instanceof TimeoutError) {
        this.state = TimeoutState.TIMED_OUT;
        this.error = error;
        if (this.cleanupFn) {
          this.cleanupFn();
        }
        if (this.propagateError) {
          throw error;
        }
      } else {
        this.state = TimeoutState.COMPLETED;
        throw error;
      }
      throw error;
    }
  }

  private createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(`Operation timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);
    });
  }

  /**
   * Cancel the timeout if still running
   */
  cancel(): void {
    if (this.state === TimeoutState.RUNNING) {
      this.state = TimeoutState.CANCELLED;
      if (this.cleanupFn) {
        this.cleanupFn();
      }
    }
  }

  getState(): TimeoutState {
    return this.state;
  }

  getStats(): TimeoutStats {
    const elapsed = this.state === TimeoutState.PENDING ? 0 : Date.now() - this.startTime;
    return {
      state: this.state,
      elapsedMs: elapsed,
      remainingMs: Math.max(0, this.timeoutMs - elapsed),
      result: this.result,
      error: this.error,
    };
  }

  getRemainingMs(): number {
    if (this.state !== TimeoutState.RUNNING) {
      return 0;
    }
    return Math.max(0, this.timeoutMs - (Date.now() - this.startTime));
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TimeoutError";
  }
}

/**
 * Functional timeout wrapper - wraps a function with timeout semantics
 */
export function withTimeout<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  timeoutMs: number,
  cleanupFn?: (() => void) | undefined
): T {
  return ((...args: Parameters<T>) => {
    const options = cleanupFn !== undefined
      ? { timeoutMs, cleanupFn, propagateError: true }
      : { timeoutMs, propagateError: true };
    const timeout = new Timeout(options);
    return timeout.wrap(() => fn(...args));
  }) as T;
}

/**
 * Runs multiple operations with a shared timeout budget
 */
export async function withDeadline<T>(
  operations: Array<() => Promise<T>>,
  totalTimeoutMs: number,
  onProgress?: (completed: number, remaining: number) => void
): Promise<{ results: T[]; timedOut: boolean }> {
  const results: T[] = [];
  const startTime = Date.now();

  for (let i = 0; i < operations.length; i++) {
    const operation = operations[i];
    if (!operation) {
      continue;
    }
    const remaining = totalTimeoutMs - (Date.now() - startTime);
    if (remaining <= 0) {
      return { results, timedOut: true };
    }

    const timeout = new Timeout({ timeoutMs: remaining });
    try {
      const result = await timeout.wrap(operation);
      results.push(result);
    } catch {
      return { results, timedOut: true };
    }

    if (onProgress) {
      onProgress(i + 1, operations.length - i - 1);
    }
  }

  return { results, timedOut: false };
}