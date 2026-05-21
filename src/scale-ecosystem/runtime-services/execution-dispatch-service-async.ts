/**
 * Async Execution Dispatch Service
 *
 * Async version of ExecutionDispatchService that provides async/await interface
 * with retry logic, timeout handling, and queue-based processing.
 *
 * This async implementation wraps the sync service and adds:
 * - Async/await Promise-based API
 * - Retry with exponential backoff for transient failures
 * - Timeout/cancellation support via AbortController
 * - Queue-based request processing to prevent race conditions
 * - Circuit breaker pattern for downstream service protection
 *
 * @see ExecutionDispatchService for the sync implementation
 */

import type { AuthoritativeSqlDatabase } from "../../platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { randomUUID } from "node:crypto";
import type { AdmissionBackpressureSnapshot } from "../../platform/five-plane-execution/dispatcher/admission-controller.js";
import type {
  CreateExecutionTicketInput,
  DispatchExecutionDecision,
  DispatchExecutionOptions,
  DispatchQueueAvailabilitySnapshot,
  ExecutionTicketDecision,
} from "../../platform/five-plane-execution/dispatcher/execution-dispatch-support.js";
import { ExecutionDispatchService } from "../../platform/five-plane-execution/dispatcher/execution-dispatch-service.js";
import { StructuredLogger } from "../../platform/shared/observability/structured-logger.js";
import { nowIso } from "../../platform/contracts/types/ids.js";
import { LocalTypedEventEmitter } from "../../platform/shared/events/local-typed-event-emitter.js";

export type {
  CreateExecutionTicketInput,
  DispatchExecutionDecision,
  DispatchExecutionOptions,
  DispatchQueueAvailabilitySnapshot,
  ExecutionTicketDecision,
} from "../../platform/five-plane-execution/dispatcher/execution-dispatch-support.js";

/**
 * Options for configuring the async ExecutionDispatchService
 */
export interface ExecutionDispatchServiceAsyncOptions {
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
  operation: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  abortController: AbortController;
  createdAt: number;
  timeoutMs: number;
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
 * Event types emitted by the service
 */
export type ExecutionDispatchServiceAsyncEvent =
  | { type: "operation_start"; operationId: string; operation: string }
  | { type: "operation_complete"; operationId: string; operation: string; durationMs: number }
  | { type: "operation_retry"; operationId: string; operation: string; attempt: number; delayMs: number }
  | { type: "operation_timeout"; operationId: string; operation: string }
  | { type: "circuit_breaker_open"; failureCount: number }
  | { type: "circuit_breaker_close" }
  | { type: "queue_overflow"; queueSize: number };

const logger = new StructuredLogger({ retentionLimit: 200 });

/**
 * Async Execution Dispatch Service
 *
 * Manages execution dispatch with async/await interface, retry logic,
 * timeout handling, and queue-based processing.
 *
 * This service wraps the synchronous ExecutionDispatchService and adds
 * enterprise-grade async patterns for reliable distributed operation.
 */
export class ExecutionDispatchServiceAsync extends LocalTypedEventEmitter<Record<string, unknown>> {
  private readonly sync: ExecutionDispatchService;
  private readonly options: Required<ExecutionDispatchServiceAsyncOptions>;

  // Queue-based processing
  private readonly operationQueue: PendingOperation<unknown>[] = [];
  private readonly activeOperations = new Set<string>();
  private readonly maxConcurrentOperations: number;

  // Circuit breaker
  private circuitBreaker: CircuitBreakerMetrics = {
    failures: 0,
    lastFailure: null,
    state: "closed",
    halfOpenAttempts: 0,
  };

  // Disposal state
  private disposed = false;
  private processingPromise: Promise<void> | null = null;
  private readonly isProcessing = false;

  /**
   * Creates a new ExecutionDispatchServiceAsync instance.
   *
   * @param db - SQLite database instance (sync mode)
   * @param store - AuthoritativeTaskStore for data access
   * @param backpressureSnapshot - Optional backpressure snapshot function
   * @param queueAvailabilitySnapshot - Optional queue availability snapshot function
   * @param options - Service configuration options
   */
  public constructor(
    db: AuthoritativeSqlDatabase,
    store: AuthoritativeTaskStore,
    backpressureSnapshot: (() => AdmissionBackpressureSnapshot | null) | null = null,
    queueAvailabilitySnapshot: (() => DispatchQueueAvailabilitySnapshot | null) | null = null,
    options: ExecutionDispatchServiceAsyncOptions = {},
  ) {
    super();
    this.sync = new ExecutionDispatchService(db, store, backpressureSnapshot, queueAvailabilitySnapshot);
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      initialBackoffMs: options.initialBackoffMs ?? 100,
      maxBackoffMs: options.maxBackoffMs ?? 5000,
      defaultTimeoutMs: options.defaultTimeoutMs ?? 30000,
      maxQueueSize: options.maxQueueSize ?? 1000,
      circuitBreakerEnabled: options.circuitBreakerEnabled ?? true,
      circuitBreakerThreshold: options.circuitBreakerThreshold ?? 5,
      circuitBreakerResetMs: options.circuitBreakerResetMs ?? 60000,
    };
    this.maxConcurrentOperations = 10;
  }

  /**
   * Creates a new execution ticket for an execution with retry and timeout support.
   *
   * @param input - The execution ticket creation input
   * @param options - Optional override options for timeout and abort signal
   * @returns Promise resolving to the ticket decision
   */
  public async createTicket(
    input: CreateExecutionTicketInput,
    options?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<ExecutionTicketDecision> {
    return this.executeWithRetryAndTimeout(
      "createTicket",
      () => this.sync.createTicket(input),
      options?.timeoutMs ?? this.options.defaultTimeoutMs,
      options?.signal,
    );
  }

  /**
   * Dispatches the next available ticket to an available worker with retry and timeout.
   *
   * @param options - Dispatch options including queue name, worker preference, lease TTL
   * @param timeoutOptions - Optional override options for timeout and abort signal
   * @returns Promise resolving to the dispatch decision
   */
  public async dispatchNext(
    options: DispatchExecutionOptions,
    timeoutOptions?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<DispatchExecutionDecision> {
    return this.executeWithRetryAndTimeout(
      "dispatchNext",
      () => this.sync.dispatchNext(options),
      timeoutOptions?.timeoutMs ?? this.options.defaultTimeoutMs,
      timeoutOptions?.signal,
    );
  }

  /**
   * Enqueues a ticket creation operation for batch processing.
   *
   * This method queues the operation and returns a promise that resolves
   * when the operation is processed. Operations are processed in order
   * with configurable concurrency limits.
   *
   * @param input - The execution ticket creation input
   * @param options - Optional timeout and abort signal
   * @returns Promise resolving to the ticket decision
   */
  public enqueueTicketCreation(
    input: CreateExecutionTicketInput,
    options?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<ExecutionTicketDecision> {
    return this.enqueueOperation(
      "createTicket",
      () => this.sync.createTicket(input),
      options?.timeoutMs ?? this.options.defaultTimeoutMs,
      options?.signal,
    );
  }

  /**
   * Enqueues a dispatch operation for batch processing.
   *
   * @param options - Dispatch options
   * @param timeoutOptions - Optional timeout and abort signal
   * @returns Promise resolving to the dispatch decision
   */
  public enqueueDispatch(
    options: DispatchExecutionOptions,
    timeoutOptions?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<DispatchExecutionDecision> {
    return this.enqueueOperation(
      "dispatchNext",
      () => this.sync.dispatchNext(options),
      timeoutOptions?.timeoutMs ?? this.options.defaultTimeoutMs,
      timeoutOptions?.signal,
    );
  }

  /**
   * Gets the current queue depth (number of pending operations).
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
   * Resets the circuit breaker to closed state.
   * Use this after resolving the underlying issue.
   */
  public resetCircuitBreaker(): void {
    this.circuitBreaker = {
      failures: 0,
      lastFailure: null,
      state: "closed",
      halfOpenAttempts: 0,
    };
    logger.log({ level: "info", message: "execution_dispatch_service.circuit_breaker_reset", data: {} });
    this.emit("circuit_breaker_close");
  }

  /**
   * Gets the synchronous service instance for internal use.
   * @internal
   */
  public getSyncService(): ExecutionDispatchService {
    return this.sync;
  }

  /**
   * Executes an operation with retry logic, timeout, and circuit breaker.
   *
   * @param operationName - Name of the operation for logging
   * @param operation - The synchronous operation to execute
   * @param timeoutMs - Timeout in milliseconds
   * @param signal - Optional abort signal
   * @returns Promise resolving to the operation result
   */
  private async executeWithRetryAndTimeout<T>(
    operationName: string,
    operation: () => T,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<T> {
    const operationId = this.generateOperationId();
    const startedAt = Date.now();

    this.emit("operation_start", { type: "operation_start", operationId, operation: operationName });

    // Check circuit breaker
    if (this.options.circuitBreakerEnabled && this.circuitBreaker.state === "open") {
      if (Date.now() - this.circuitBreaker.lastFailure! >= this.options.circuitBreakerResetMs) {
        this.circuitBreaker.state = "half_open";
        this.circuitBreaker.halfOpenAttempts++;
        logger.log({
          level: "warn",
          message: "execution_dispatch_service.circuit_breaker_half_open",
          data: { halfOpenAttempts: this.circuitBreaker.halfOpenAttempts },
        });
      } else {
        const error = new Error("Circuit breaker is open");
        this.emit("operation_complete", { type: "operation_complete", operationId, operation: operationName, durationMs: Date.now() - startedAt });
        throw error;
      }
    }

    // Create timeout promise
    const timeoutController = new AbortController();
    const timeoutPromise = new Promise<never>((_, reject) => {
      const timer = setTimeout(() => {
        if (!signal?.aborted) {
          reject(new Error(`Operation ${operationName} timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);

      signal?.addEventListener("abort", () => {
        clearTimeout(timer);
        if (!signal!.aborted) {
          reject(new Error(`Operation ${operationName} was aborted`));
        }
      });
    });

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
      try {
        if (attempt > 0) {
          const backoffDelay = this.calculateBackoff(attempt);
          this.emit("operation_retry", { type: "operation_retry", operationId, operation: operationName, attempt, delayMs: backoffDelay });
          await this.sleep(backoffDelay);
        }

        // Race between operation and timeout
        const result = await Promise.race([
          this.executeOperation(operation, operationId, operationName),
          timeoutPromise,
        ]);

        // Success - reset circuit breaker on success
        if (this.options.circuitBreakerEnabled && this.circuitBreaker.state !== "closed") {
          this.circuitBreaker = {
            failures: 0,
            lastFailure: null,
            state: "closed",
            halfOpenAttempts: 0,
          };
        }

        const durationMs = Date.now() - startedAt;
        this.emit("operation_complete", { type: "operation_complete", operationId, operation: operationName, durationMs });

        return result;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Check if this is a retryable error
        if (!this.isRetryableError(lastError)) {
          // Non-retryable error - fail immediately
          const durationMs = Date.now() - startedAt;
          this.emit("operation_complete", { type: "operation_complete", operationId, operation: operationName, durationMs });
          this.recordCircuitBreakerFailure();
          throw lastError;
        }

        // Check if we've exhausted retries
        if (attempt >= this.options.maxRetries) {
          const durationMs = Date.now() - startedAt;
          this.emit("operation_complete", { type: "operation_complete", operationId, operation: operationName, durationMs });
          this.recordCircuitBreakerFailure();
          throw lastError;
        }
      }
    }

    // Should not reach here, but just in case
    this.recordCircuitBreakerFailure();
    throw lastError ?? new Error("Operation failed");
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
        operation: async () => {
          // Check abort signal before executing
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
      };

      this.operationQueue.push(pendingOp as PendingOperation<unknown>);
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

      // Skip if already aborted
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
          this.processQueue(); // Continue processing
        });
    }
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
      // Failed during half-open - go back to open
      this.circuitBreaker.state = "open";
      logger.log({
        level: "warn",
        message: "execution_dispatch_service.circuit_breaker_open",
        data: { failureCount: this.circuitBreaker.failures, trigger: "half_open_failure" },
      });
      this.emit("circuit_breaker_open", { type: "circuit_breaker_open", failureCount: this.circuitBreaker.failures });
    } else if (this.circuitBreaker.failures >= this.options.circuitBreakerThreshold) {
      this.circuitBreaker.state = "open";
      logger.log({
        level: "warn",
        message: "execution_dispatch_service.circuit_breaker_open",
        data: { failureCount: this.circuitBreaker.failures, trigger: "threshold_exceeded" },
      });
      this.emit("circuit_breaker_open", { type: "circuit_breaker_open", failureCount: this.circuitBreaker.failures });
    }
  }

  /**
   * Determines if an error is retryable.
   */
  private isRetryableError(error: Error): boolean {
    // Network-related errors are retryable
    if (error.message.includes("ETIMEDOUT") || error.message.includes("ECONNREFUSED") || error.message.includes("ENOTFOUND")) {
      return true;
    }

    // Storage errors with transient codes are retryable
    if (error.message.includes("SQLITE_BUSY") || error.message.includes("SQLITE_LOCKED")) {
      return true;
    }

    // Workflow state errors are generally not retryable
    if (error.message.includes("invalid_transition") || error.message.includes("storage.execution_not_found")) {
      return false;
    }

    // Timeout errors during retry should be retried
    if (error.message.includes("timed out")) {
      return true;
    }

    // Abort errors should not be retried
    if (error.message.includes("aborted")) {
      return false;
    }

    // Default to retryable for unknown errors
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
   * Sleep utility for async delay.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generates a unique operation ID.
   */
  private generateOperationId(): string {
    return `op_${randomUUID()}`;
  }

  /**
   * Disposes the service and cleans up resources.
   */
  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    // Abort all pending operations
    for (const pendingOp of this.operationQueue) {
      pendingOp.abortController.abort();
      pendingOp.reject(new Error("Service disposed"));
    }

    this.operationQueue.length = 0;
    this.activeOperations.clear();

    logger.log({ level: "info", message: "execution_dispatch_service.disposed", data: {} });
  }
}
