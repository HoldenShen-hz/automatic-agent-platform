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
  id: number;
  fn: (signal?: AbortSignal) => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  queuedAt: number;
  deadlineAt: number;
  timeoutId: ReturnType<typeof setTimeout>;
  settled: boolean;
}

/**
 * Bulkhead Isolation per §9.1.
 * Limits concurrent calls to a target plane to prevent cascade failures.
 */
export class BulkheadIsolator {
  private config: BulkheadConfig;
  private readonly planeName: string;
  private activeCalls = 0;
  private readonly queue: QueuedCall[] = [];
  private totalRejections = 0;
  private totalWaitTime = 0;
  private waitCount = 0;
  private nextQueuedCallId = 1;

  public constructor(planeName: string, config: Partial<BulkheadConfig> = {}) {
    this.planeName = planeName;
    this.config = { ...DEFAULT_BULKHEAD_CONFIG, ...config };
  }

  /**
   * Execute a function with bulkhead isolation.
   * @returns Promise that resolves with the function result
   */
  async execute<T>(fn: (signal?: AbortSignal) => Promise<T>): Promise<T> {
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

    return this.startCall(fn, Date.now() + this.config.timeoutMs);
  }

  /**
   * Start a new call.
   */
  private async startCall<T>(fn: (signal?: AbortSignal) => Promise<T>, deadlineAt: number): Promise<T> {
    this.activeCalls++;
    const controller = new AbortController();
    let settled = false;
    const remainingMs = Math.max(0, deadlineAt - Date.now());
    const timeoutMs = remainingMs;
    const timeoutError = new BulkheadTimeoutError(
      `bulkhead:timeout:${this.planeName}`,
      `Bulkhead isolation: ${this.planeName} call timed out after ${timeoutMs}ms`,
      this.planeName,
      timeoutMs,
    );
    const timeoutId = setTimeout(() => {
      controller.abort(timeoutError);
      settled = true;
      rejectPromise(timeoutError);
    }, remainingMs);
    let rejectPromise!: (error: Error) => void;
    const responsePromise = new Promise<T>((resolve, reject) => {
      rejectPromise = reject;
      fn(controller.signal)
        .then((result) => {
          if (!settled) {
            settled = true;
            clearTimeout(timeoutId);
            resolve(result);
          }
        })
        .catch((error) => {
          if (!settled) {
            settled = true;
            clearTimeout(timeoutId);
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        })
        .finally(() => {
          clearTimeout(timeoutId);
          this.activeCalls = Math.max(0, this.activeCalls - 1);
          this.processQueue();
        });
    });

    try {
      return await responsePromise;
    } catch (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Queue a call when at capacity.
   */
  private queueCall<T>(fn: (signal?: AbortSignal) => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const queuedAt = Date.now();
      const queuedCallId = this.nextQueuedCallId++;
      const deadlineAt = queuedAt + this.config.timeoutMs;
      const timeoutId = setTimeout(() => {
        const index = this.queue.findIndex((c) => c.id === queuedCallId);
        if (index !== -1) {
          const [call] = this.queue.splice(index, 1);
          if (call && !call.settled) {
            call.settled = true;
            this.totalRejections++;
            reject(new BulkheadTimeoutError(
              `bulkhead:timeout:${this.planeName}`,
              `Bulkhead isolation: ${this.planeName} queued call timed out after ${this.config.timeoutMs}ms`,
              this.planeName,
              this.config.timeoutMs,
            ));
          }
        }
      }, this.config.timeoutMs);

      this.queue.push({
        id: queuedCallId,
        fn,
        resolve: resolve as (value: unknown) => void,
        reject,
        queuedAt,
        deadlineAt,
        timeoutId,
        settled: false,
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
      clearTimeout(call.timeoutId);
      if (call.settled) {
        continue;
      }
      const waitTime = Date.now() - call.queuedAt;
      this.totalWaitTime += waitTime;
      this.waitCount++;
      const remainingMs = call.deadlineAt - Date.now();
      if (remainingMs <= 0) {
        call.settled = true;
        this.totalRejections++;
        call.reject(new BulkheadTimeoutError(
          `bulkhead:timeout:${this.planeName}`,
          `Bulkhead isolation: ${this.planeName} queued call timed out after ${this.config.timeoutMs}ms`,
          this.planeName,
          this.config.timeoutMs,
        ));
        continue;
      }

      this.startCall(call.fn, call.deadlineAt)
        .then((result) => {
          if (!call.settled) {
            call.settled = true;
            call.resolve(result);
          }
        })
        .catch((err) => {
          if (!call.settled) {
            call.settled = true;
            call.reject(err instanceof Error ? err : new Error(String(err)));
          }
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

  public updateConfig(config: Partial<BulkheadConfig>): void {
    this.config = { ...this.config, ...config };
    this.processQueue();
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
    } else if (config != null) {
      isolator.updateConfig(config);
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
