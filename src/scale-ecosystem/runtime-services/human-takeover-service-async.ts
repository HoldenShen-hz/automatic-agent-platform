/**
 * Async Human Takeover Service
 *
 * Async version of HumanTakeoverService that provides async/await interface
 * with retry logic, timeout handling, and enhanced audit capabilities.
 *
 * This async implementation wraps the sync service and adds:
 * - Async/await Promise-based API for all operations
 * - Retry with exponential backoff for transient failures
 * - Timeout/cancellation support via AbortController
 * - Operation queuing for batch processing
 * - Circuit breaker pattern for downstream protection
 * - Detailed audit trail with timestamps and duration tracking
 * - Priority-based operation processing
 *
 * @see HumanTakeoverService for the sync implementation
 */

import type { AuthoritativeSqlDatabase } from "../../platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { TaskTerminalStatus } from "../../platform/contracts/types/status.js";
import type { TakeoverActionResult } from "../../platform/five-plane-control-plane/incident-control/human-takeover-service.js";
import { HumanTakeoverService } from "../../platform/five-plane-control-plane/incident-control/human-takeover-service.js";
import { StructuredLogger } from "../../platform/shared/observability/structured-logger.js";
import { LocalTypedEventEmitter } from "../../platform/shared/events/local-typed-event-emitter.js";

export type { TakeoverActionResult } from "../../platform/five-plane-control-plane/incident-control/human-takeover-service.js";

/**
 * Options for configuring the async HumanTakeoverService
 */
export interface HumanTakeoverServiceAsyncOptions {
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
  /** Enable operation batching */
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
 * Circuit breaker metrics
 */
interface CircuitBreakerMetrics {
  failures: number;
  lastFailure: number | null;
  state: CircuitBreakerState;
  halfOpenAttempts: number;
}

/**
 * Takeover operation types
 */
export type TakeoverOperationType =
  | "openSession"
  | "modifyInput"
  | "switchWorker"
  | "retryExecution"
  | "setCurrentStep"
  | "writeStepOutput"
  | "skipCurrentStep"
  | "completeTask";

/**
 * Operation metrics
 */
interface TakeoverMetrics {
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  retriedOperations: number;
  timedOutOperations: number;
  operationsByType: Record<TakeoverOperationType, number>;
  averageLatencyMs: number;
}

/**
 * Event types emitted by the service
 */
export type HumanTakeoverServiceAsyncEvent =
  | { type: "operation_start"; operationId: string; operation: TakeoverOperationType }
  | { type: "operation_complete"; operationId: string; operation: TakeoverOperationType; durationMs: number; success: boolean }
  | { type: "operation_retry"; operationId: string; operation: TakeoverOperationType; attempt: number; delayMs: number }
  | { type: "operation_timeout"; operationId: string; operation: TakeoverOperationType }
  | { type: "circuit_breaker_open"; failureCount: number }
  | { type: "circuit_breaker_close" }
  | { type: "queue_overflow"; queueSize: number }
  | { type: "session_opened"; sessionId: string; taskId: string }
  | { type: "session_closed"; sessionId: string; taskId: string };

const logger = new StructuredLogger({ retentionLimit: 200 });

/**
 * Async Human Takeover Service
 *
 * Service for managing human-in-the-loop takeover requests with async/await interface,
 * retry logic, timeout handling, and enhanced audit capabilities.
 *
 * This async version provides the same functionality as HumanTakeoverService
 * but with enterprise-grade async patterns for reliable distributed operation.
 */
export class HumanTakeoverServiceAsync extends LocalTypedEventEmitter<Record<string, unknown>> {
  private readonly sync: HumanTakeoverService;
  private readonly options: Required<HumanTakeoverServiceAsyncOptions>;

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

  // Metrics
  private metrics: TakeoverMetrics = {
    totalOperations: 0,
    successfulOperations: 0,
    failedOperations: 0,
    retriedOperations: 0,
    timedOutOperations: 0,
    operationsByType: {
      openSession: 0,
      modifyInput: 0,
      switchWorker: 0,
      retryExecution: 0,
      setCurrentStep: 0,
      writeStepOutput: 0,
      skipCurrentStep: 0,
      completeTask: 0,
    },
    averageLatencyMs: 0,
  };

  // Disposal state
  private disposed = false;
  private processingPromise: Promise<void> | null = null;

  /**
   * Creates a new HumanTakeoverServiceAsync instance.
   *
   * @param db - SQLite database instance (sync mode)
   * @param store - AuthoritativeTaskStore for data access
   * @param options - Service configuration options
   */
  public constructor(
    db: AuthoritativeSqlDatabase,
    store: AuthoritativeTaskStore,
    options: HumanTakeoverServiceAsyncOptions = {},
  ) {
    super();
    this.sync = new HumanTakeoverService(db, store);
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      initialBackoffMs: options.initialBackoffMs ?? 100,
      maxBackoffMs: options.maxBackoffMs ?? 5000,
      defaultTimeoutMs: options.defaultTimeoutMs ?? 60000, // Longer timeout for human-facing operations
      maxQueueSize: options.maxQueueSize ?? 500,
      circuitBreakerEnabled: options.circuitBreakerEnabled ?? true,
      circuitBreakerThreshold: options.circuitBreakerThreshold ?? 5,
      circuitBreakerResetMs: options.circuitBreakerResetMs ?? 60000,
      batchingEnabled: options.batchingEnabled ?? false,
      batchSize: options.batchSize ?? 20,
      batchFlushIntervalMs: options.batchFlushIntervalMs ?? 200,
    };
    this.maxConcurrentOperations = 5; // Lower concurrency for human-facing operations
  }

  /**
   * Opens a new takeover session for a task with retry and timeout.
   *
   * @param input - Contains taskId, operatorId making the takeover, and reasonCode
   * @param options - Optional timeout and abort signal
   * @returns Promise resolving to the action result with session and action identifiers
   */
  public async openSession(
    input: {
      taskId: string;
      operatorId: string;
      reasonCode: string;
      tenantId?: string | null;
    },
    options?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<TakeoverActionResult> {
    const result = await this.executeWithRetryAndTimeout<TakeoverActionResult>(
      "openSession",
      () => this.sync.openSession(input),
      options?.timeoutMs ?? this.options.defaultTimeoutMs,
      options?.signal,
    );

    this.emit("session_opened", {
      type: "session_opened",
      sessionId: result.takeoverSessionId,
      taskId: result.taskId,
    });

    return result;
  }

  /**
   * Modifies the input JSON for a task within an active takeover session.
   *
   * @param input - Contains session ID, new input JSON, and reason code
   * @param options - Optional timeout and abort signal
   * @returns Promise resolving to the action result
   */
  public async modifyInput(
    input: {
      takeoverSessionId: string;
      inputJson: string;
      normalizedInputJson?: string;
      reasonCode: string;
      tenantId?: string | null;
    },
    options?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<TakeoverActionResult> {
    return this.executeWithRetryAndTimeout(
      "modifyInput",
      () => this.sync.modifyInput(input),
      options?.timeoutMs ?? this.options.defaultTimeoutMs,
      options?.signal,
    );
  }

  /**
   * Switches the worker agent assigned to the current execution.
   *
   * @param input - Contains session ID, new agent ID, and reason code
   * @param options - Optional timeout and abort signal
   * @returns Promise resolving to the action result
   */
  public async switchWorker(
    input: {
      takeoverSessionId: string;
      agentId: string;
      reasonCode: string;
      tenantId?: string | null;
    },
    options?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<TakeoverActionResult> {
    return this.executeWithRetryAndTimeout(
      "switchWorker",
      () => this.sync.switchWorker(input),
      options?.timeoutMs ?? this.options.defaultTimeoutMs,
      options?.signal,
    );
  }

  /**
   * Retries the current execution by creating a new execution record.
   *
   * @param input - Contains session ID and reason code
   * @param options - Optional timeout and abort signal
   * @returns Promise resolving to the action result
   */
  public async retryExecution(
    input: {
      takeoverSessionId: string;
      reasonCode: string;
      tenantId?: string | null;
    },
    options?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<TakeoverActionResult> {
    return this.executeWithRetryAndTimeout(
      "retryExecution",
      () => this.sync.retryExecution(input),
      options?.timeoutMs ?? this.options.defaultTimeoutMs,
      options?.signal,
    );
  }

  /**
   * Moves the workflow to a different step.
   *
   * @param input - Contains session ID, step target, and reason code
   * @param options - Optional timeout and abort signal
   * @returns Promise resolving to the action result
   */
  public async setCurrentStep(
    input: {
      takeoverSessionId: string;
      reasonCode: string;
      stepId?: string;
      stepIndex?: number;
      tenantId?: string | null;
    },
    options?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<TakeoverActionResult> {
    return this.executeWithRetryAndTimeout(
      "setCurrentStep",
      () => this.sync.setCurrentStep(input),
      options?.timeoutMs ?? this.options.defaultTimeoutMs,
      options?.signal,
    );
  }

  /**
   * Writes a manual step output for the current or specified step.
   *
   * @param input - Contains session ID, output JSON, and step targeting
   * @param options - Optional timeout and abort signal
   * @returns Promise resolving to the action result
   */
  public async writeStepOutput(
    input: {
      takeoverSessionId: string;
      outputJson: string;
      reasonCode: string;
      stepId?: string;
      stepIndex?: number;
      status?: "succeeded" | "failed" | "partial_success";
      summary?: string;
      tenantId?: string | null;
    },
    options?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<TakeoverActionResult> {
    return this.executeWithRetryAndTimeout(
      "writeStepOutput",
      () => this.sync.writeStepOutput(input),
      options?.timeoutMs ?? this.options.defaultTimeoutMs,
      options?.signal,
    );
  }

  /**
   * Skips the current workflow step.
   *
   * @param input - Contains session ID, optional note, and reason code
   * @param options - Optional timeout and abort signal
   * @returns Promise resolving to the action result
   */
  public async skipCurrentStep(
    input: {
      takeoverSessionId: string;
      note?: string;
      reasonCode: string;
      tenantId?: string | null;
    },
    options?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<TakeoverActionResult> {
    return this.executeWithRetryAndTimeout(
      "skipCurrentStep",
      () => this.sync.skipCurrentStep(input),
      options?.timeoutMs ?? this.options.defaultTimeoutMs,
      options?.signal,
    );
  }

  /**
   * Completes a task with a specified terminal status.
   *
   * @param input - Contains session ID, terminal status, and reason code
   * @param options - Optional timeout and abort signal
   * @returns Promise resolving to the action result
   */
  public async completeTask(
    input: {
      takeoverSessionId: string;
      terminalStatus: TaskTerminalStatus;
      reasonCode: string;
      outputJson?: string;
      tenantId?: string | null;
    },
    options?: { timeoutMs?: number; signal?: AbortSignal },
  ): Promise<TakeoverActionResult> {
    const result = await this.executeWithRetryAndTimeout(
      "completeTask",
      () => this.sync.completeTask(input),
      options?.timeoutMs ?? this.options.defaultTimeoutMs,
      options?.signal,
    );

    this.emit("session_closed", {
      type: "session_closed",
      sessionId: input.takeoverSessionId,
      taskId: result.taskId,
    });

    return result;
  }

  /**
   * Enqueues a takeover operation for batch processing.
   *
   * @param operationType - The type of operation to enqueue
   * @param input - The operation input
   * @param options - Optional timeout and abort signal
   * @returns Promise resolving to the action result
   */
  public enqueueOperation<T extends TakeoverActionResult>(
    operationType: TakeoverOperationType,
    input: Record<string, unknown>,
    options?: { timeoutMs?: number; signal?: AbortSignal; priority?: number },
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

      const operationFn = () => {
        switch (operationType) {
          case "openSession":
            return this.sync.openSession(input as Parameters<typeof this.sync.openSession>[0]) as unknown as T;
          case "modifyInput":
            return this.sync.modifyInput(input as Parameters<typeof this.sync.modifyInput>[0]) as unknown as T;
          case "switchWorker":
            return this.sync.switchWorker(input as Parameters<typeof this.sync.switchWorker>[0]) as unknown as T;
          case "retryExecution":
            return this.sync.retryExecution(input as Parameters<typeof this.sync.retryExecution>[0]) as unknown as T;
          case "setCurrentStep":
            return this.sync.setCurrentStep(input as Parameters<typeof this.sync.setCurrentStep>[0]) as unknown as T;
          case "writeStepOutput":
            return this.sync.writeStepOutput(input as Parameters<typeof this.sync.writeStepOutput>[0]) as unknown as T;
          case "skipCurrentStep":
            return this.sync.skipCurrentStep(input as Parameters<typeof this.sync.skipCurrentStep>[0]) as unknown as T;
          case "completeTask":
            return this.sync.completeTask(input as Parameters<typeof this.sync.completeTask>[0]) as unknown as T;
          default:
            throw new Error(`Unknown operation type: ${operationType}`);
        }
      };

      const pendingOp: PendingOperation<T> = {
        id: this.generateOperationId(),
        operationName: operationType,
        operation: async () => {
          if (options?.signal?.aborted || abortController.signal.aborted) {
            throw new Error(`Operation ${operationType} was aborted`);
          }
          return this.executeWithRetryAndTimeout(operationType, operationFn, options?.timeoutMs ?? this.options.defaultTimeoutMs, options?.signal);
        },
        resolve,
        reject,
        abortController,
        createdAt: Date.now(),
        timeoutMs: options?.timeoutMs ?? this.options.defaultTimeoutMs,
        priority: options?.priority ?? 0,
      };

      this.operationQueue.push(pendingOp as PendingOperation<unknown>);
      this.operationQueue.sort((a, b) => b.priority - a.priority);
      this.processQueue();
    });
  }

  /**
   * Gets the current queue depth.
   */
  public getQueueDepth(): number {
    return this.operationQueue.length;
  }

  /**
   * Gets the number of currently active operations.
   */
  public getActiveOperationCount(): number {
    return this.activeOperations.size;
  }

  /**
   * Gets circuit breaker status.
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
   */
  public getMetrics(): TakeoverMetrics {
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
    logger.log({ level: "info", message: "human_takeover_service.circuit_breaker_reset", data: {} });
    this.emit("circuit_breaker_close");
  }

  /**
   * Resets metrics.
   */
  public resetMetrics(): void {
    this.metrics = {
      totalOperations: 0,
      successfulOperations: 0,
      failedOperations: 0,
      retriedOperations: 0,
      timedOutOperations: 0,
      operationsByType: {
        openSession: 0,
        modifyInput: 0,
        switchWorker: 0,
        retryExecution: 0,
        setCurrentStep: 0,
        writeStepOutput: 0,
        skipCurrentStep: 0,
        completeTask: 0,
      },
      averageLatencyMs: 0,
    };
  }

  /**
   * Gets the synchronous service instance for internal use.
   * @internal
   */
  public getSyncService(): HumanTakeoverService {
    return this.sync;
  }

  /**
   * Executes an operation with retry logic, timeout, and circuit breaker.
   */
  private async executeWithRetryAndTimeout<T>(
    operationName: TakeoverOperationType,
    operation: () => T,
    timeoutMs: number,
    signal?: AbortSignal,
  ): Promise<T> {
    const operationId = this.generateOperationId();
    const startedAt = Date.now();

    this.metrics.totalOperations++;
    this.metrics.operationsByType[operationName]++;
    this.emit("operation_start", { type: "operation_start", operationId, operation: operationName });

    // Check circuit breaker
    if (this.options.circuitBreakerEnabled && this.circuitBreaker.state === "open") {
      if (Date.now() - this.circuitBreaker.lastFailure! >= this.options.circuitBreakerResetMs) {
        this.circuitBreaker.state = "half_open";
        this.circuitBreaker.halfOpenAttempts++;
        logger.log({
          level: "warn",
          message: "human_takeover_service.circuit_breaker_half_open",
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

    // Create timeout handle
    let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutHandle = setTimeout(() => {
        if (!signal?.aborted) {
          this.metrics.timedOutOperations++;
          this.emit("operation_timeout", { type: "operation_timeout", operationId, operation: operationName });
          reject(new Error(`Operation ${operationName} timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);
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
    operationName: TakeoverOperationType,
  ): Promise<T> {
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
        message: "human_takeover_service.circuit_breaker_open",
        data: { failureCount: this.circuitBreaker.failures, trigger: "half_open_failure" },
      });
      this.emit("circuit_breaker_open", { type: "circuit_breaker_open", failureCount: this.circuitBreaker.failures });
    } else if (this.circuitBreaker.failures >= this.options.circuitBreakerThreshold) {
      this.circuitBreaker.state = "open";
      logger.log({
        level: "warn",
        message: "human_takeover_service.circuit_breaker_open",
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

    // Workflow errors are generally not retryable
    if (
      error.message.includes("invalid_transition") ||
      error.message.includes("takeover.workflow") ||
      error.message.includes("takeover.session")
    ) {
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
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Generates a unique operation ID.
   */
  private generateOperationId(): string {
    return `hto_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
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

    logger.log({ level: "info", message: "human_takeover_service.disposed", data: {} });
  }
}
