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
    fn: () => Promise<T>,
    shouldRetry?: (error: Error, attempt: number) => boolean
  ): Promise<T> {
    const startTime = Date.now();
    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt < this.maxAttempts) {
      const elapsed = Date.now() - startTime;
      if (elapsed >= this.maxDurationMs) {
        throw new RetryTimeoutError(
          `Max retry duration exceeded: ${this.maxDurationMs}ms`
        );
      }

      attempt++;

      try {
        const result = await fn();
        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (shouldRetry && !shouldRetry(lastError, attempt)) {
          throw lastError;
        }

        if (attempt >= this.maxAttempts) {
          throw lastError;
        }

        if (this.retryableErrors.size > 0 && !this.retryableErrors.has(lastError.name)) {
          throw lastError;
        }

        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }

    throw lastError ?? new Error("Retry failed with no error");
  }

  async executeWithResult<T>(
    fn: () => Promise<T>,
    shouldRetry?: (error: Error, attempt: number) => boolean
  ): Promise<RetryAttempt<T>> {
    const startTime = Date.now();
    const attempts: RetryAttempt<T>[] = [];

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      const attemptStart = Date.now();

      try {
        const result = await fn();
        attempts.push({
          attempt,
          delay: Date.now() - attemptStart,
          result,
          success: true,
        });
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
          return attempts[attempts.length - 1]!;
        }

        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }

    return attempts[attempts.length - 1]!;
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay = this.initialDelayMs * Math.pow(this.backoffMultiplier, attempt - 1);
    const cappedDelay = Math.min(exponentialDelay, this.maxDelayMs);
    const jitter = cappedDelay * this.jitterFactor * (Math.random() * 2 - 1);
    return Math.floor(cappedDelay + jitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  getStats(): RetryStats {
    return {
      totalAttempts: this.maxAttempts,
      successfulAttempts: 0,
      failedAttempts: this.maxAttempts - 1,
      totalDurationMs: 0,
    };
  }
}

export class RetryTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryTimeoutError";
  }
}

/**
 * Decorator-style retry wrapper
 */
export function withRetry<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options?: RetryOptions
): T {
  const retry = new Retry(options);

  return ((...args: Parameters<T>) => {
    return retry.execute(() => fn(...args));
  }) as T;
}