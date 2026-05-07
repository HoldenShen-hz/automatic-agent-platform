/**
 * Bulkhead Isolation Pattern
 *
 * Implements §9.1 plane-to-plane fault isolation using bulkhead pattern.
 * Prevents cascade failures between planes by isolating each caller-callee pair.
 */

export interface BulkheadConfig {
  /** Maximum concurrent calls to the target */
  maxConcurrentCalls: number;
  /** Timeout for each call in milliseconds */
  timeoutMs: number;
  /** Queue size for waiting calls when at capacity */
  queueSize: number;
}

/**
 * Default bulkhead configuration per §9.1.
 */
export const DEFAULT_BULKHEAD_CONFIG: BulkheadConfig = {
  maxConcurrentCalls: 100,
  timeoutMs: 30_000,
  queueSize: 50,
};

/**
 * Bulkhead metrics for monitoring.
 */
export interface BulkheadMetrics {
  planeName: string;
  activeCalls: number;
  queuedCalls: number;
  totalRejections: number;
  averageWaitTimeMs: number;
}

interface QueuedCall<T = unknown> {
  fn: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  queuedAt: number;
  timeoutId: ReturnType<typeof setTimeout>;
}

/**
 * Bulkhead Isolation per §9.1.
 * Limits concurrent calls to a target plane to prevent cascade failures.
 */
export class BulkheadIsolator {
  private readonly config: BulkheadConfig;
  private readonly planeName: string;
  private activeCalls = 0;
  private readonly queue: QueuedCall[] = [];
  private totalRejections = 0;
  private totalWaitTime = 0;
  private waitCount = 0;

  public constructor(planeName: string, config: Partial<BulkheadConfig> = {}) {
    this.planeName = planeName;
    this.config = { ...DEFAULT_BULKHEAD_CONFIG, ...config };
  }

  /**
   * Execute a function with bulkhead isolation.
   * @returns Promise that resolves with the function result
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // Check if we can start a new call
    if (this.activeCalls >= this.config.maxConcurrentCalls) {
      // Check queue capacity
      if (this.queue.length >= this.config.queueSize) {
        this.totalRejections++;
        throw new BulkheadRejectionError(
          `bulkhead:rejected:${this.planeName}`,
          `Bulkhead isolation: ${this.planeName} at capacity (${this.activeCalls}/${this.config.maxConcurrentCalls})`,
          this.planeName,
        );
      }

      // Queue the call
      return this.queueCall(fn);
    }

    return this.startCall(fn);
  }

  /**
   * Start a new call.
   */
  private async startCall<T>(fn: () => Promise<T>): Promise<T> {
    this.activeCalls++;

    let timeoutId: ReturnType<typeof setTimeout>;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new BulkheadTimeoutError(
          `bulkhead:timeout:${this.planeName}`,
          `Bulkhead isolation: ${this.planeName} call timed out after ${this.config.timeoutMs}ms`,
          this.planeName,
          this.config.timeoutMs,
        ));
      }, this.config.timeoutMs);
    });

    try {
      const result = await Promise.race([fn(), timeoutPromise]);
      clearTimeout(timeoutId!);
      return result as T;
    } finally {
      this.activeCalls--;
      this.processQueue();
    }
  }

  /**
   * Queue a call when at capacity.
   */
  private queueCall<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const queuedAt = Date.now();
      const timeoutId = setTimeout(() => {
        // Remove from queue if still waiting
        const index = this.queue.findIndex((c) => c.fn === fn && c.queuedAt === queuedAt);
        if (index !== -1) {
          this.queue.splice(index, 1);
        }
        this.totalRejections++;
        reject(new BulkheadTimeoutError(
          `bulkhead:timeout:${this.planeName}`,
          `Bulkhead isolation: ${this.planeName} queued call timed out after ${this.config.timeoutMs * 2}ms`,
          this.planeName,
          this.config.timeoutMs * 2,
        ));
      }, this.config.timeoutMs * 2);

      this.queue.push({
        fn,
        resolve: resolve as (value: unknown) => void,
        reject,
        queuedAt,
        timeoutId,
      });
    });
  }

  /**
   * Process the queue if there is capacity.
   */
  private processQueue(): void {
    while (
      this.activeCalls < this.config.maxConcurrentCalls
      && this.queue.length > 0
    ) {
      const call = this.queue.shift()!;
      const waitTime = Date.now() - call.queuedAt;
      this.totalWaitTime += waitTime;
      this.waitCount++;

      // Start the queued call
      this.activeCalls++;

      const timeoutId = setTimeout(() => {
        clearTimeout(call.timeoutId);
        this.activeCalls--;
        call.reject(new BulkheadTimeoutError(
          `bulkhead:timeout:${this.planeName}`,
          `Bulkhead isolation: ${this.planeName} queued call timed out after ${this.config.timeoutMs}ms`,
          this.planeName,
          this.config.timeoutMs,
        ));
        this.processQueue();
      }, this.config.timeoutMs);

      // Execute the function with timeout
      fnWithTimeout(call.fn, this.config.timeoutMs)
        .then((result) => {
          clearTimeout(timeoutId);
          clearTimeout(call.timeoutId);
          call.resolve(result);
        })
        .catch((err) => {
          clearTimeout(timeoutId);
          clearTimeout(call.timeoutId);
          call.reject(err);
        })
        .finally(() => {
          this.activeCalls--;
          this.processQueue();
        });
    }
  }

  /**
   * Get current bulkhead metrics.
   */
  public getMetrics(): BulkheadMetrics {
    return {
      planeName: this.planeName,
      activeCalls: this.activeCalls,
      queuedCalls: this.queue.length,
      totalRejections: this.totalRejections,
      averageWaitTimeMs: this.waitCount > 0 ? this.totalWaitTime / this.waitCount : 0,
    };
  }

  /**
   * Reset metrics.
   */
  public resetMetrics(): void {
    this.totalRejections = 0;
    this.totalWaitTime = 0;
    this.waitCount = 0;
  }
}

/**
 * Error thrown when bulkhead is at capacity.
 */
export class BulkheadRejectionError extends Error {
  constructor(
    public readonly code: string,
    public override readonly message: string,
    public readonly planeName: string,
  ) {
    super(message);
    this.name = "BulkheadRejectionError";
  }
}

/**
 * Error thrown when bulkhead call times out.
 */
export class BulkheadTimeoutError extends Error {
  constructor(
    public readonly code: string,
    public override readonly message: string,
    public readonly planeName: string,
    public readonly timeoutMs: number,
  ) {
    super(message);
    this.name = "BulkheadTimeoutError";
  }
}

/**
 * Helper for timing out a function.
 * Executes the provided function with timeout protection.
 */
async function fnWithTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      reject(new Error(`Function timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    fn()
      .then((result) => {
        clearTimeout(timeoutId);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timeoutId);
        reject(err);
      });
  });
}

/**
 * Global bulkhead isolators for each plane pair.
 */
export class BulkheadRegistry {
  private readonly isolators = new Map<string, BulkheadIsolator>();

  /**
   * Get or create a bulkhead isolator for a plane.
   */
  public getOrCreate(planeName: string, config?: Partial<BulkheadConfig>): BulkheadIsolator {
    let isolator = this.isolators.get(planeName);
    if (isolator == null) {
      isolator = new BulkheadIsolator(planeName, config);
      this.isolators.set(planeName, isolator);
    }
    return isolator;
  }

  /**
   * Get all bulkhead metrics.
   */
  public getAllMetrics(): BulkheadMetrics[] {
    return [...this.isolators.values()].map((i) => i.getMetrics());
  }
}

/**
 * Global bulkhead registry instance.
 */
export const globalBulkheadRegistry = new BulkheadRegistry();
