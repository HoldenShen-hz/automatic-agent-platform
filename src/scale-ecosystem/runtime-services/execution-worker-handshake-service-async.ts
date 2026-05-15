/**
 * Async Execution Worker Handshake Service
 *
 * Async version of ExecutionWorkerHandshakeService that provides async/await interface
 * with retry logic, timeout handling, and queue-based processing.
 *
 * This async implementation wraps the sync service and adds:
 * - Async/await Promise-based API
 * - Retry with exponential backoff for transient failures
 * - Timeout/cancellation support via AbortController
 * - Queue-based request processing to prevent race conditions
 * - Circuit breaker pattern for downstream service protection
 * - Detailed operation telemetry and metrics
 *
 * @see ExecutionWorkerHandshakeService for the sync implementation
 */

import type { AuthoritativeSqlDatabase } from "../../platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type {
  ExecutionWorkerHandshakeServiceOptions,
  WorkerClaimExecutionInput,
  WorkerExecutionHeartbeatInput,
  WorkerHandshakeDecision,
  WorkerRemoteLogInput,
} from "../../platform/five-plane-execution/worker-pool/execution-worker-handshake-types.js";
import { ExecutionWorkerHandshakeService } from "../../platform/five-plane-execution/worker-pool/execution-worker-handshake-service.js";
import { StructuredLogger } from "../../platform/shared/observability/structured-logger.js";
import { LocalTypedEventEmitter } from "../../platform/shared/events/local-typed-event-emitter.js";

export type {
  ExecutionWorkerHandshakeServiceOptions,
  WorkerClaimExecutionInput,
  WorkerExecutionHeartbeatInput,
  WorkerHandshakeDecision,
  WorkerRemoteLogInput,
} from "../../platform/five-plane-execution/worker-pool/execution-worker-handshake-types.js";

/**
 * Options for configuring the async ExecutionWorkerHandshakeService
 */
export interface ExecutionWorkerHandshakeServiceAsyncOptions {
  /** Maximum number of retry attempts for transient failures */
  maxRetries?: number;
  /** Initial backoff delay in milliseconds */
  initialBackoffMs?: number;
  /** Maximum backoff delay in milliseconds */
  maxBackoffMs?: number;
  /** Default timeout for operations in milliseconds */
  defaultTimeoutMs?: number;
  /** Maximum queue size for pending operations */
  maxQueueSize?: number;
  /** Enable circuit breaker pattern */
  circuitBreakerEnabled?: boolean;
  /** Circuit breaker failure threshold */
  circuitBreakerThreshold?: number;
  /** Circuit breaker reset timeout in milliseconds */
  circuitBreakerResetMs?: number;
  /** Enable operation batching for high throughput */
  batchingEnabled?: boolean;
  /** Batch size for operations */
  batchSize?: number;
  /** Batch flush interval in milliseconds */
  batchFlushIntervalMs?: number;
}

/**
 * State of the circuit breaker
 */
type CircuitBreakerState = "closed" | "open" | "half_open";

/**
 * Pending operation in the queue
 */
interface PendingOperation<T> {
  id: string;
  operationName: string;
  operation: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  abortController: AbortController;
  createdAt: number;
  timeoutMs: number;
  priority: number;
}

/**
 * Batch item for grouped operations
 */
interface BatchItem<T> {
  operation: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
}

/**
 * Circuit breaker metrics
 */
interface CircuitBreakerMetrics {
  failures: number;
  lastFailure: number | null;
  state: CircuitBreakerState;
  halfOpenAttempts: number;
}

/**
 * Operation metrics
 */
interface OperationMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  retriedOperations: number;
  timedOutOperations: number;
  averageLatencyMs: number;
}

/**
 * Event types emitted by the service
 */
export type ExecutionWorkerHandshakeServiceAsyncEvent =
  | { type: "operation_start"; operationId: string; operation: string }
  | { type: "operation_complete"; operationId: string; operation: string; durationMs: number; success: boolean }
  | { type: "operation_retry"; operationId: string; operation: string; attempt: number; delayMs: number }
  | { type: "operation_timeout"; operationId: string; operation: string }
  | { type: "circuit_breaker_open"; failureCount: number }
  | { type: "circuit_breaker_close" }
  | { type: "queue_overflow"; queueSize: number }
  | { type: "batch_flush"; batchSize: number; durationMs: number };

const logger = new StructuredLogger({ retentionLimit: 200 });

/**
 * Async Execution Worker Handshake Service
 *
 * Handles the handshake between the authoritative system and workers -
 * including lease acquisition, heartbeat, and execution claim.
 *
 * This async version provides the same functionality as ExecutionWorkerHandshakeService
 * but with async/await interface, retry logic, timeout handling, and queue-based processing.
 */
export class ExecutionWorkerHandshakeServiceAsync extends LocalTypedEventEmitter<Record<string, unknown>> {
  private readonly sync: ExecutionWorkerHandshakeService;
  private readonly options: Required<ExecutionWorkerHandshakeServiceAsyncOptions>;

  // Queue-based processing
  private readonly operationQueue: PendingOperation<unknown>[] = [];
  private readonly activeOperations = new Set<string>();
  private readonly maxConcurrentOperations: number;

  // Batching
  private readonly batchQueue: BatchItem<unknown>[] = [];
  private batchFlushTimer: ReturnType<typeof setInterval> | null = null;

  // Circuit breaker
  private circuitBreaker: CircuitBreakerMetrics = {
    failures: 0,
    lastFailure: null,
    state: "closed",
    halfOpenAttempts: 0,
  };

  // Metrics
  private metrics: OperationMetrics = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    retriedOperations: 0,
    timedOutOperations: 0,
    averageLatencyMs: 0,
  };

  // Disposal state
  private disposed = false;
  private processingPromise: Promise<void> | null = null;

  /**
   * Creates a new ExecutionWorkerHandshakeServiceAsync instance.
   *
   * @param db - SQLite database instance (sync mode)
   * @param store - AuthoritativeTaskStore for data access
   * @param options - Service configuration options
   */
  public constructor(
    db: AuthoritativeSqlDatabase,
    store: AuthoritativeTaskStore,
    options: ExecutionWorkerHandshakeServiceOptions = {},
    asyncOptions: ExecutionWorkerHandshakeServiceAsyncOptions = {},
  ) {
    super();
    this.sync = new ExecutionWorkerHandshakeService(db, store, options);
    this.options = {
      maxRetries: asyncOptions.maxRetries ?? 3,
      initialBackoffMs: asyncOptions.initialBackoffMs ?? 100,
      maxBackoffMs: asyncOptions.maxBackoffMs ?? 5000,
      defaultTimeoutMs: asyncOptions.defaultTimeoutMs ?? 30000,
      maxQueueSize: asyncOptions.maxQueueSize ?? 1000,
      circuitBreakerEnabled: asyncOptions.circuitBreakerEnabled ?? true,
      circuitBreakerThreshold: asyncOptions.circuitBreakerThreshold ?? 5,
      circuitBreakerResetMs: asyncOptions.circuitBreakerResetMs ?? 60000,
      batchingEnabled: asyncOptions.batchingEnabled ?? false,
      batchSize: asyncOptions.batchSize ?? 50,
      batchFlushIntervalMs: asyncOptions.batchFlushIntervalMs ?? 100,
    };
    this.maxConcurrentOperations = 20;

    // Start batch flush timer if batching is enabled
    if (this.options.batchingEnabled) {
      this.startBatchFlushTimer();
    }
  }

  /**
   * Handles a worker's request to claim an execution ticket with retry and timeout.
   *
   * @param input - Claim parameters including ticket ID, worker ID, lease, and fencing token
   * @param options - Optional timeout and abort signal
   * @returns Promise resolving to the handshake decision
   */
  public async claimExecution(
    input: WorkerClaimExecutionInput,
    options?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<WorkerHandshakeDecision> {
    return this.executeWithRetryAndTimeout(
      "claimExecution",
      () => this.sync.claimExecution(input),
      options?.timeoutMs ?? this.options.defaultTimeoutMs,
      options?.signal,
    );
  }

  /**
   * Records a heartbeat from a worker with retry and timeout.
   *
   * @param input - Heartbeat parameters including execution ID, worker, lease, and telemetry
   * @param options - Optional timeout and abort signal
   * @returns Promise resolving to the handshake decision
   */
  public async recordHeartbeat(
    input: WorkerExecutionHeartbeatInput,
    options?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<WorkerHandshakeDecision> {
    return this.executeWithRetryAndTimeout(
      "recordHeartbeat",
      () => this.sync.recordHeartbeat(input),
      options?.timeoutMs ?? this.options.defaultTimeoutMs,
      options?.signal,
    );
  }

  /**
   * Enqueues a claim execution operation for batch processing.
   *
   * @param input - Claim parameters
   * @param options - Optional timeout and abort signal
   * @returns Promise resolving to the handshake decision
   */
  public enqueueClaimExecution(
    input: WorkerClaimExecutionInput,
    options?: { timeoutMs?: number; signal?: AbortSignal; priority?: number },
  ): Promise<WorkerHandshakeDecision> {
    return this.enqueueOperation(
      "claimExecution",
      () => this.sync.claimExecution(input),
      options?.timeoutMs ?? this.options.defaultTimeoutMs,
      options?.signal,
      options?.priority ?? 0,
    );
  }

  /**
   * Enqueues a heartbeat operation for batch processing.
   *
   * @param input - Heartbeat parameters
   * @param options - Optional timeout and abort signal
   * @returns Promise resolving to the handshake decision
   */
  public enqueueHeartbeat(
    input: WorkerExecutionHeartbeatInput,
    options?: { timeoutMs?: number; signal?: AbortSignal; priority?: number },
  ): Promise<WorkerHandshakeDecision> {
    return this.enqueueOperation(
      "recordHeartbeat",
      () => this.sync.recordHeartbeat(input),
      options?.timeoutMs ?? this.options.defaultTimeoutMs,
      options?.signal,
      options?.priority ?? 0,
    );
  }

  /**
   * Gets the current queue depth.
   *
   * @returns Number of operations currently queued
   */
  public getQueueDepth(): number {
    return this.operationQueue.length;
  }

  /**
   * Gets the number of currently active operations.
   *
   * @returns Number of operations currently executing
   */
  public getActiveOperationCount(): number {
    return this.activeOperations.size;
  }

  /**
   * Gets circuit breaker status.
   *
   * @returns Object with circuit breaker state and metrics
   */
  public getCircuitBreakerStatus(): { state: CircuitBreakerState; failures: number; lastFailure: number | null } {
    return {
      state: this.circuitBreaker.state,
      failures: this.circuitBreaker.failures,
      lastFailure: this.circuitBreaker.lastFailure,
    };
  }

  /**
   * Gets operation metrics.
   *
   * @returns Object with operation metrics
   */
  public getMetrics(): OperationMetrics {
    return { ...this.metrics };
  }

  /**
   * Resets the circuit breaker to closed state.
   */
  public resetCircuitBreaker(): void {
    this.circuitBreaker = {
      failures: 0,
      lastFailure: null,
      state: "closed",
      halfOpenAttempts: 0,
    };
    logger.log({ level: "info", message: "execution_worker_handshake_service.circuit_breaker_reset", data: {} });
    this.emit("circuit_breaker_close");
  }

  /**
   * Resets operation metrics.
   */
  public resetMetrics(): void {
    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      retriedOperations: 0,
      timedOutOperations: 0,
      averageLatencyMs: 0,
    };
  }

  /**
   * Gets the synchronous service instance for internal use.
   * @internal
   */
  public getSyncService(): ExecutionWorkerHandshakeService {
    return this.sync;
  }

  /**
   * Executes an operation with retry logic, timeout, and circuit breaker.
   */
  private async executeWithRetryAndTimeout<T>(
    operationName: string,
    operation: () => T,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<T> {
    const operationId = this.generateOperationId();
    const startedAt = Date.now();

    this.metrics.totalOperations++;
    this.emit("operation_start", { type: "operation_start", operationId, operation: operationName });

    // Check circuit breaker
    if (this.options.circuitBreakerEnabled && this.circuitBreaker.state === "open") {
      if (Date.now() - this.circuitBreaker.lastFailure! >= this.options.circuitBreakerResetMs) {
        this.circuitBreaker.state = "half_open";
        this.circuitBreaker.halfOpenAttempts++;
        logger.log({
          level: "warn",
          message: "execution_worker_handshake_service.circuit_breaker_half_open",
          data: { halfOpenAttempts: this.circuitBreaker.halfOpenAttempts },
        });
      } else {
        const error = new Error("Circuit breaker is open");
        const durationMs = Date.now() - startedAt;
        this.metrics.failedOperations++;
        this.emit("operation_complete", {
          type: "operation_complete",
          operationId,
          operation: operationName,
          durationMs,
          success: false,
        });
        throw error;
      }
    }

    // Create abort controller for timeout
    const timeoutController = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        if (!signal?.aborted) {
          this.metrics.timedOutOperations++;
          this.emit("operation_timeout", { type: "operation_timeout", operationId, operation: operationName });
          reject(new Error(`Operation ${operationName} timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);
      timeoutHandle.unref?.();
    });

    // Handle external abort
    const abortHandler = () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
    };
    signal?.addEventListener("abort", abortHandler);

    let lastError: Error | null = null;

    try {
      for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
        try {
          if (attempt > 0) {
            const backoffDelay = this.calculateBackoff(attempt);
            this.metrics.retriedOperations++;
            this.emit("operation_retry", {
              type: "operation_retry",
              operationId,
              operation: operationName,
              attempt,
              delayMs: backoffDelay,
            });
            await this.sleep(backoffDelay);
          }

          // Execute operation with timeout
          const result = await Promise.race([
            this.executeOperation(operation, operationId, operationName),
            timeoutPromise,
          ]);

          // Success
          if (this.options.circuitBreakerEnabled && this.circuitBreaker.state !== "closed") {
            this.circuitBreaker = {
              failures: 0,
              lastFailure: null,
              state: "closed",
              halfOpenAttempts: 0,
            };
          }

          const durationMs = Date.now() - startedAt;
          this.metrics.successfulOperations++;
          this.updateAverageLatency(durationMs);
          this.emit("operation_complete", {
            type: "operation_complete",
            operationId,
            operation: operationName,
            durationMs,
            success: true,
          });

          return result;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));

          // Check if we should retry
          if (!this.isRetryableError(lastError)) {
            const durationMs = Date.now() - startedAt;
            this.metrics.failedOperations++;
            this.emit("operation_complete", {
              type: "operation_complete",
              operationId,
              operation: operationName,
              durationMs,
              success: false,
            });
            this.recordCircuitBreakerFailure();
            throw lastError;
          }

          // Check if we've exhausted retries
          if (attempt >= this.options.maxRetries) {
            const durationMs = Date.now() - startedAt;
            this.metrics.failedOperations++;
            this.emit("operation_complete", {
              type: "operation_complete",
              operationId,
              operation: operationName,
              durationMs,
              success: false,
            });
            this.recordCircuitBreakerFailure();
            throw lastError;
          }
        }
      }

      // Should not reach here
      this.recordCircuitBreakerFailure();
      throw lastError ?? new Error("Operation failed");
    } finally {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      signal?.removeEventListener("abort", abortHandler);
    }
  }

  /**
   * Executes an operation within the concurrency limit.
   */
  private async executeOperation<T>(
    operation: () => T,
    operationId: string,
    operationName: string,
  ): Promise<T> {
    // Wait for capacity if at limit
    while (this.activeOperations.size >= this.maxConcurrentOperations) {
      await this.sleep(10);
    }

    this.activeOperations.add(operationId);

    try {
      return operation();
    } finally {
      this.activeOperations.delete(operationId);
    }
  }

  /**
   * Enqueues an operation for batch processing.
   */
  private enqueueOperation<T>(
    operationName: string,
    operation: () => T,
    timeoutMs: number,
    signal?: AbortSignal,
    priority: number = 0,
  ): Promise<T> {
    if (this.disposed) {
      return Promise.reject(new Error("Service has been disposed"));
    }

    if (this.operationQueue.length >= this.options.maxQueueSize) {
      this.emit("queue_overflow", { type: "queue_overflow", queueSize: this.operationQueue.length });
      return Promise.reject(new Error("Operation queue is full"));
    }

    return new Promise<T>((resolve, reject) => {
      const abortController = new AbortController();

      const pendingOp: PendingOperation<T> = {
        id: this.generateOperationId(),
        operationName,
        operation: async () => {
          if (signal?.aborted || abortController.signal.aborted) {
            throw new Error(`Operation ${operationName} was aborted`);
          }
          return this.executeWithRetryAndTimeout(operationName, operation, timeoutMs, signal);
        },
        resolve,
        reject,
        abortController,
        createdAt: Date.now(),
        timeoutMs,
        priority,
      };

      this.operationQueue.push(pendingOp as PendingOperation<unknown>);

      // Sort by priority (higher priority first)
      this.operationQueue.sort((a, b) => b.priority - a.priority);

      this.processQueue();
    });
  }

  /**
   * Processes queued operations.
   */
  private async processQueue(): Promise<void> {
    if (this.processingPromise) {
      return;
    }

    this.processingPromise = this.doProcessQueue();

    try {
      await this.processingPromise;
    } finally {
      this.processingPromise = null;
    }
  }

  /**
   * Internal queue processing loop.
   */
  private async doProcessQueue(): Promise<void> {
    while (this.operationQueue.length > 0 && !this.disposed) {
      // Wait for capacity
      while (this.activeOperations.size >= this.maxConcurrentOperations && !this.disposed) {
        await this.sleep(10);
      }

      if (this.disposed) {
        break;
      }

      const pendingOp = this.operationQueue.shift();
      if (!pendingOp) {
        continue;
      }

      if (pendingOp.abortController.signal.aborted) {
        pendingOp.reject(new Error("Operation was aborted before processing"));
        continue;
      }

      const operationId = pendingOp.id;
      this.activeOperations.add(operationId);

      pendingOp.operation()
        .then((result) => {
          pendingOp.resolve(result);
        })
        .catch((error) => {
          pendingOp.reject(error instanceof Error ? error : new Error(String(error)));
        })
        .finally(() => {
          this.activeOperations.delete(operationId);
          this.processQueue();
        });
    }
  }

  /**
   * Starts the batch flush timer for batching mode.
   */
  private startBatchFlushTimer(): void {
    this.batchFlushTimer = setInterval(() => {
      this.flushBatch();
    }, this.options.batchFlushIntervalMs);
    this.batchFlushTimer.unref?.();
  }

  /**
   * Flushes the batch queue.
   */
  private async flushBatch(): Promise<void> {
    if (this.batchQueue.length === 0 || this.disposed) {
      return;
    }

    const batch = this.batchQueue.splice(0, this.options.batchSize);
    const startedAt = Date.now();

    // Process batch items concurrently
    await Promise.allSettled(
      batch.map((item) =>
        item
          .operation()
          .then(item.resolve)
          .catch((error) => item.reject(error instanceof Error ? error : new Error(String(error))))
      )
    );

    const durationMs = Date.now() - startedAt;
    this.emit("batch_flush", { type: "batch_flush", batchSize: batch.length, durationMs });
  }

  /**
   * Records a failure for circuit breaker.
   */
  private recordCircuitBreakerFailure(): void {
    if (!this.options.circuitBreakerEnabled) {
      return;
    }

    this.circuitBreaker.failures++;
    this.circuitBreaker.lastFailure = Date.now();

    if (this.circuitBreaker.state === "half_open") {
      this.circuitBreaker.state = "open";
      logger.log({
        level: "warn",
        message: "execution_worker_handshake_service.circuit_breaker_open",
        data: { failureCount: this.circuitBreaker.failures, trigger: "half_open_failure" },
      });
      this.emit("circuit_breaker_open", { type: "circuit_breaker_open", failureCount: this.circuitBreaker.failures });
    } else if (this.circuitBreaker.failures >= this.options.circuitBreakerThreshold) {
      this.circuitBreaker.state = "open";
      logger.log({
        level: "warn",
        message: "execution_worker_handshake_service.circuit_breaker_open",
        data: { failureCount: this.circuitBreaker.failures, trigger: "threshold_exceeded" },
      });
      this.emit("circuit_breaker_open", { type: "circuit_breaker_open", failureCount: this.circuitBreaker.failures });
    }
  }

  /**
   * Determines if an error is retryable.
   */
  private isRetryableError(error: Error): boolean {
    if (
      error.message.includes("ETIMEDOUT") ||
      error.message.includes("ECONNREFUSED") ||
      error.message.includes("ENOTFOUND")
    ) {
      return true;
    }

    if (error.message.includes("SQLITE_BUSY") || error.message.includes("SQLITE_LOCKED")) {
      return true;
    }

    if (error.message.includes("timed out")) {
      return true;
    }

    if (error.message.includes("aborted")) {
      return false;
    }

    return true;
  }

  /**
   * Calculates exponential backoff delay with jitter.
   */
  private calculateBackoff(attemptIndex: number): number {
    const exponentialDelay = Math.min(
      this.options.initialBackoffMs * Math.pow(2, attemptIndex),
      this.options.maxBackoffMs,
    );
    const jitter = Math.random() * exponentialDelay * 0.1;
    return Math.round(exponentialDelay + jitter);
  }

  /**
   * Updates the average latency metric.
   */
  private updateAverageLatency(newLatencyMs: number): void {
    const totalLatency = this.metrics.averageLatencyMs * this.metrics.successfulOperations + newLatencyMs;
    this.metrics.averageLatencyMs = totalLatency / this.metrics.successfulOperations;
  }

  /**
   * Sleep utility for async delay.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      timer.unref?.();
    });
  }

  /**
   * Generates a unique operation ID.
   */
  private generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
  }

  /**
   * Disposes the service and cleans up resources.
   */
  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Stop batch flush timer
    if (this.batchFlushTimer) {
      clearInterval(this.batchFlushTimer);
      this.batchFlushTimer = null;
    }

    // Abort all pending operations
    for (const pendingOp of this.operationQueue) {
      pendingOp.abortController.abort();
      pendingOp.reject(new Error("Service disposed"));
    }

    this.operationQueue.length = 0;
    this.activeOperations.clear();

    logger.log({ level: "info", message: "execution_worker_handshake_service.disposed", data: {} });
  }
}
