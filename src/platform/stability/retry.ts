/**
 * Retry - Executes operations with configurable backoff retry logic
 *
 * Supports: exponential backoff, jitter, max duration, and retry conditions
 */

export enum RetryResult {
  SUCCESS = "SUCCESS",
  RETRYABLE_FAILURE = "RETRYABLE_FAILURE",
  NON_RETRYABLE_FAILURE = "NON_RETRYABLE_FAILURE",
}

export interface RetryOptions {
  maxAttempts?: number;          // Maximum number of attempts (default: 3)
  initialDelayMs?: number;       // Initial delay before first retry (default: 100)
  maxDelayMs?: number;           // Maximum delay between retries (default: 30000)
  backoffMultiplier?: number;     // Multiplier for exponential backoff (default: 2)
  jitterFactor?: number;          // Random jitter factor 0-1 (default: 0.2 = 20%)
  maxDurationMs?: number;        // Maximum total time for all retries (default: 60000)
  retryableErrors?: string[];    // Error names to retry on (default: all errors retryable)
}

export interface RetryExecutionOptions {
  signal?: AbortSignal;
}

export interface RetryAttempt<T> {
  attempt: number;
  delay: number;
  result?: T;
  error?: Error;
  success: boolean;
}

export interface RetryStats {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  totalDurationMs: number;
  lastError?: Error;
}

export class Retry {
  private readonly maxAttempts: number;
  private readonly initialDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly backoffMultiplier: number;
  private readonly jitterFactor: number;
  private readonly maxDurationMs: number;
  private readonly retryableErrors: Set<string>;
  private lastStats: RetryStats = {
    totalAttempts: 0,
    successfulAttempts: 0,
    failedAttempts: 0,
    totalDurationMs: 0,
  };

  constructor(options: RetryOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? 3;
    this.initialDelayMs = options.initialDelayMs ?? 100;
    this.maxDelayMs = options.maxDelayMs ?? 30000;
    this.backoffMultiplier = options.backoffMultiplier ?? 2;
    this.jitterFactor = options.jitterFactor ?? 0.2;
    this.maxDurationMs = options.maxDurationMs ?? 60000;
    this.retryableErrors = new Set(options.retryableErrors ?? []);
  }

  async execute<T>(
    fn: (signal?: AbortSignal) => Promise<T>,
    shouldRetry?: (error: Error, attempt: number) => boolean,
    executionOptions: RetryExecutionOptions = {},
  ): Promise<T> {
    const startTime = Date.now();
    let lastError: Error | undefined;
    let attempt = 0;
    const attempts: RetryAttempt<unknown>[] = [];
    this.throwIfAborted(executionOptions.signal);

    while (attempt < this.maxAttempts) {
      const elapsed = Date.now() - startTime;
      if (elapsed >= this.maxDurationMs) {
        const timeoutError = new RetryTimeoutError(
          `Max retry duration exceeded: ${this.maxDurationMs}ms`
        );
        this.lastStats = this.buildStats(attempts, startTime, timeoutError);
        throw timeoutError;
      }

      attempt++;
      this.throwIfAborted(executionOptions.signal);
      const attemptStart = Date.now();

      try {
        const result = await fn(executionOptions.signal);
        attempts.push({
          attempt,
          delay: Date.now() - attemptStart,
          result,
          success: true,
        });
        this.lastStats = this.buildStats(attempts, startTime);
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempts.push({
          attempt,
          delay: Date.now() - attemptStart,
          error: lastError,
          success: false,
        });

        if (shouldRetry && !shouldRetry(lastError, attempt)) {
          this.lastStats = this.buildStats(attempts, startTime, lastError);
          throw lastError;
        }

        if (attempt >= this.maxAttempts) {
          this.lastStats = this.buildStats(attempts, startTime, lastError);
          throw lastError;
        }

        if (this.retryableErrors.size > 0 && !this.retryableErrors.has(lastError.name)) {
          this.lastStats = this.buildStats(attempts, startTime, lastError);
          throw lastError;
        }

        const delay = this.calculateDelay(attempt);
        await this.sleep(delay, executionOptions.signal);
      }
    }

    const finalError = lastError ?? new Error("Retry failed with no error");
    this.lastStats = this.buildStats(attempts, startTime, finalError);
    throw finalError;
  }

  async executeWithResult<T>(
    fn: (signal?: AbortSignal) => Promise<T>,
    shouldRetry?: (error: Error, attempt: number) => boolean,
    executionOptions: RetryExecutionOptions = {},
  ): Promise<RetryAttempt<T>> {
    const startTime = Date.now();
    const attempts: RetryAttempt<T>[] = [];
    this.throwIfAborted(executionOptions.signal);

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      const attemptStart = Date.now();
      this.throwIfAborted(executionOptions.signal);

      try {
        const result = await fn(executionOptions.signal);
        attempts.push({
          attempt,
          delay: Date.now() - attemptStart,
          result,
          success: true,
        });
        this.lastStats = this.buildStats(attempts, startTime);
        return attempts[attempts.length - 1]!;
      } catch (error) {
        const attemptError = error instanceof Error ? error : new Error(String(error));
        attempts.push({
          attempt,
          delay: Date.now() - attemptStart,
          error: attemptError,
          success: false,
        });

        const shouldContinue = shouldRetry
          ? shouldRetry(attemptError, attempt)
          : true;

        if (!shouldContinue || attempt >= this.maxAttempts) {
          this.lastStats = this.buildStats(attempts, startTime, attemptError);
          return attempts[attempts.length - 1]!;
        }

        const delay = this.calculateDelay(attempt);
        await this.sleep(delay, executionOptions.signal);
      }
    }

    this.lastStats = this.buildStats(attempts, startTime);
    return attempts[attempts.length - 1]!;
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay = this.initialDelayMs * Math.pow(this.backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, this.maxDelayMs);
    const jitter = cappedDelay * this.jitterFactor * (Math.random() * 2 - 1);
    const candidateDelay = Math.floor(cappedDelay + jitter);
    return Math.min(this.maxDelayMs, Math.max(this.initialDelayMs, candidateDelay));
  }

  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    this.throwIfAborted(signal);
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        signal?.removeEventListener("abort", onAbort);
        resolve();
      }, Math.max(0, ms));
      const onAbort = () => {
        clearTimeout(timeoutId);
        signal?.removeEventListener("abort", onAbort);
        reject(this.toAbortError(signal));
      };
      signal?.addEventListener("abort", onAbort, { once: true });
    });
  }

  private throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) {
      throw this.toAbortError(signal);
    }
  }

  private toAbortError(signal?: AbortSignal): Error {
    const reason = signal?.reason;
    if (reason instanceof Error) {
      return reason;
    }
    return new RetryAbortError(typeof reason === "string" ? reason : "Retry aborted");
  }

  private buildStats(
    attempts: readonly RetryAttempt<unknown>[],
    startTime: number,
    lastError?: Error,
  ): RetryStats {
    return {
      totalAttempts: attempts.length,
      successfulAttempts: attempts.filter((attempt) => attempt.success).length,
      failedAttempts: attempts.filter((attempt) => !attempt.success).length,
      totalDurationMs: Date.now() - startTime,
      ...(lastError ? { lastError } : {}),
    };
  }

  getStats(): RetryStats {
    return { ...this.lastStats };
  }
}

export class RetryTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryTimeoutError";
  }
}

export class RetryAbortError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryAbortError";
  }
}

/**
 * Decorator-style retry wrapper
 */
export function withRetry<TArgs extends readonly unknown[], TResult>(
  fn: (...args: TArgs) => Promise<TResult>,
  options?: RetryOptions
): (...args: TArgs) => Promise<TResult> {
  const retry = new Retry(options);

  return (...args: TArgs) => retry.execute(() => fn(...args));
}
