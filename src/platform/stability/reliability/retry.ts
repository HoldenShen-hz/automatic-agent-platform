/**
 * Retry - Executes operations with configurable backoff retry logic
 *
 * Supports: exponential backoff, jitter, max duration, and conditional retry
 *
 * Usage:
 *   const retry = new Retry({ maxAttempts: 3, initialDelayMs: 100 });
 *   const result = await retry.execute(async () => fetchData());
 */

export enum RetryResult {
  SUCCESS = "SUCCESS",
  RETRYABLE_FAILURE = "RETRYABLE_FAILURE",
  NON_RETRYABLE_FAILURE = "NON_RETRYABLE_FAILURE",
}

export interface RetryOptions {
  maxAttempts?: number;           // Maximum number of attempts (default: 3)
  initialDelayMs?: number;       // Initial delay before first retry (default: 100)
  maxDelayMs?: number;           // Maximum delay between retries (default: 30000)
  backoffMultiplier?: number;    // Multiplier for exponential backoff (default: 2)
  jitterFactor?: number;         // Random jitter factor 0-1 (default: 0.2 = 20%)
  maxDurationMs?: number;        // Maximum total time for all retries (default: 60000)
  retryableErrors?: string[];    // Error names to retry on (default: all errors retryable)
}

export interface RetryAttempt<T> {
  attempt: number;
  delayMs: number;
  result?: T;
  error?: Error;
  success: boolean;
  timestamp: number;
}

export interface RetryStats {
  totalAttempts: number;
  successfulAttempts: number;
  failedAttempts: number;
  totalDurationMs: number;
  lastError: Error | undefined;
  attempts: RetryAttempt<unknown>[];
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

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      const elapsed = Date.now() - startTime;
      if (elapsed >= this.maxDurationMs) {
        throw new RetryTimeoutError(
          `Max retry duration exceeded: ${this.maxDurationMs}ms after ${attempt - 1} attempts`
        );
      }

      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if we should skip retry based on custom predicate
        if (shouldRetry && !shouldRetry(lastError, attempt)) {
          throw lastError;
        }

        // Check if error is non-retryable based on error name
        if (this.retryableErrors.size > 0 && !this.retryableErrors.has(lastError.name)) {
          throw lastError;
        }

        // Don't retry if we've exhausted attempts
        if (attempt >= this.maxAttempts) {
          throw lastError;
        }

        // Calculate and wait for backoff delay
        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }

    throw lastError ?? new RetryTimeoutError("Retry failed with no error recorded");
  }

  /**
   * Execute with detailed attempt tracking
   */
  async executeWithStats<T>(
    fn: () => Promise<T>,
    shouldRetry?: (error: Error, attempt: number) => boolean
  ): Promise<{ result: T; stats: RetryStats }> {
    const startTime = Date.now();
    const attempts: RetryAttempt<unknown>[] = [];
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= this.maxAttempts; attempt++) {
      const attemptStart = Date.now();
      const elapsed = startTime - Date.now();

      if (elapsed >= this.maxDurationMs) {
        throw new RetryTimeoutError(
          `Max retry duration exceeded: ${this.maxDurationMs}ms after ${attempt - 1} attempts`
        );
      }

      try {
        const result = await fn();
        attempts.push({
          attempt,
          delayMs: Date.now() - attemptStart,
          result,
          success: true,
          timestamp: Date.now(),
        });
        return {
          result,
          stats: {
            totalAttempts: attempts.length,
            successfulAttempts: attempts.filter(a => a.success).length,
            failedAttempts: attempts.filter(a => !a.success).length,
            totalDurationMs: Date.now() - startTime,
            lastError: undefined,
            attempts,
          },
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        attempts.push({
          attempt,
          delayMs: Date.now() - attemptStart,
          error: lastError,
          success: false,
          timestamp: Date.now(),
        });

        if (shouldRetry && !shouldRetry(lastError, attempt)) {
          throw lastError;
        }

        if (this.retryableErrors.size > 0 && !this.retryableErrors.has(lastError.name)) {
          throw lastError;
        }

        if (attempt >= this.maxAttempts) {
          throw lastError;
        }

        const delay = this.calculateDelay(attempt);
        await this.sleep(delay);
      }
    }

    throw lastError ?? new RetryTimeoutError("Retry failed with no error recorded");
  }

  private calculateDelay(attempt: number): number {
    // Exponential backoff: initial * multiplier^(attempt-1)
    const exponentialDelay = this.initialDelayMs * Math.pow(this.backoffMultiplier, attempt - 1);
    // Cap at max delay
    const cappedDelay = Math.min(exponentialDelay, this.maxDelayMs);
    // Add jitter to prevent thundering herd
    const jitter = cappedDelay * this.jitterFactor * (Math.random() * 2 - 1);
    return Math.floor(cappedDelay + jitter);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
  }
}

export class RetryTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RetryTimeoutError";
  }
}

/**
 * Decorator-style retry wrapper for function
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