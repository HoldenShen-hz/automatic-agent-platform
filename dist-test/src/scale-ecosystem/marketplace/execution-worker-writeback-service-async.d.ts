/**
 * Async Execution Worker Writeback Service
 *
 * Async version of ExecutionWorkerWritebackService that provides async/await interface
 * with retry logic, timeout handling, and queue-based processing.
 *
 * This async implementation wraps the sync service and adds:
 * - Async/await Promise-based API
 * - Retry with exponential backoff for transient failures
 * - Timeout/cancellation support via AbortController
 * - Queue-based request processing to prevent race conditions
 * - Circuit breaker pattern for downstream service protection
 * - Writeback batching for high-throughput scenarios
 * - Detailed operation telemetry and metrics
 *
 * @see ExecutionWorkerWritebackService for the sync implementation
 */
import { EventEmitter } from "node:events";
import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";
import type { WorkerWritebackInput, WorkerWritebackDecision, ExecutionWorkerWritebackServiceOptions } from "../../platform/execution/worker-pool/execution-worker-writeback-service.js";
import { ExecutionWorkerWritebackService } from "../../platform/execution/worker-pool/execution-worker-writeback-service.js";
export type { WorkerWritebackInput, WorkerWritebackDecision, ExecutionWorkerWritebackServiceOptions, } from "../../platform/execution/worker-pool/execution-worker-writeback-service.js";
/**
 * Options for configuring the async ExecutionWorkerWritebackService
 */
export interface ExecutionWorkerWritebackServiceAsyncOptions {
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
    /** Enable writeback batching for high throughput */
    batchingEnabled?: boolean;
    /** Batch size for writebacks */
    batchSize?: number;
    /** Batch flush interval in milliseconds */
    batchFlushIntervalMs?: number;
    /** Enable write coalescing to combine rapid writes for same execution */
    coalescingEnabled?: boolean;
    /** Coalescing window in milliseconds */
    coalescingWindowMs?: number;
}
/**
 * State of the circuit breaker
 */
type CircuitBreakerState = "closed" | "open" | "half_open";
/**
 * Operation metrics
 */
interface WritebackMetrics {
    totalWritebacks: number;
    acceptedWritebacks: number;
    rejectedWritebacks: number;
    retriedWritebacks: number;
    timedOutWritebacks: number;
    coalescedWritebacks: number;
    averageLatencyMs: number;
}
/**
 * Event types emitted by the service
 */
export type ExecutionWorkerWritebackServiceAsyncEvent = {
    type: "writeback_start";
    writebackId: string;
    executionId: string;
} | {
    type: "writeback_complete";
    writebackId: string;
    executionId: string;
    durationMs: number;
    accepted: boolean;
} | {
    type: "writeback_retry";
    writebackId: string;
    executionId: string;
    attempt: number;
    delayMs: number;
} | {
    type: "writeback_timeout";
    writebackId: string;
    executionId: string;
} | {
    type: "writeback_coalesced";
    executionId: string;
    count: number;
} | {
    type: "circuit_breaker_open";
    failureCount: number;
} | {
    type: "circuit_breaker_close";
} | {
    type: "queue_overflow";
    queueSize: number;
} | {
    type: "batch_flush";
    batchSize: number;
    durationMs: number;
};
/**
 * Async Execution Worker Writeback Service
 *
 * Handles result reporting from workers with async/await interface,
 * retry logic, timeout handling, and queue-based processing.
 *
 * This async version provides the same functionality as ExecutionWorkerWritebackService
 * but with enterprise-grade async patterns for reliable distributed operation.
 */
export declare class ExecutionWorkerWritebackServiceAsync extends EventEmitter {
    private readonly sync;
    private readonly options;
    private readonly operationQueue;
    private readonly activeOperations;
    private readonly maxConcurrentOperations;
    private readonly coalescedWritebacks;
    private coalescingTimer;
    private readonly batchQueue;
    private batchFlushTimer;
    private circuitBreaker;
    private metrics;
    private disposed;
    private processingPromise;
    /**
     * Creates a new ExecutionWorkerWritebackServiceAsync instance.
     *
     * @param db - SQLite database instance (sync mode)
     * @param store - AuthoritativeTaskStore for data access
     * @param options - Service configuration options
     */
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, syncOptions?: ExecutionWorkerWritebackServiceOptions, asyncOptions?: ExecutionWorkerWritebackServiceAsyncOptions);
    /**
     * Records a writeback from a worker with retry and timeout.
     *
     * @param input - Writeback parameters including execution ID, worker ID, lease, and terminal status
     * @param options - Optional timeout and abort signal
     * @returns Promise resolving to the writeback decision
     */
    recordWriteback(input: WorkerWritebackInput, options?: {
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<WorkerWritebackDecision>;
    /**
     * Enqueues a writeback for batch processing with optional coalescing.
     *
     * @param input - Writeback parameters
     * @param options - Optional timeout and abort signal
     * @returns Promise resolving to the writeback decision
     */
    enqueueWriteback(input: WorkerWritebackInput, options?: {
        timeoutMs?: number;
        signal?: AbortSignal;
        priority?: number;
    }): Promise<WorkerWritebackDecision>;
    /**
     * Tries to coalesce a writeback with a pending one for the same execution.
     */
    private tryCoalesceWriteback;
    /**
     * Gets the current queue depth.
     */
    getQueueDepth(): number;
    /**
     * Gets the number of currently active operations.
     */
    getActiveOperationCount(): number;
    /**
     * Gets circuit breaker status.
     */
    getCircuitBreakerStatus(): {
        state: CircuitBreakerState;
        failures: number;
        lastFailure: number | null;
    };
    /**
     * Gets writeback metrics.
     */
    getMetrics(): WritebackMetrics;
    /**
     * Resets the circuit breaker to closed state.
     */
    resetCircuitBreaker(): void;
    /**
     * Resets metrics.
     */
    resetMetrics(): void;
    /**
     * Gets the synchronous service instance for internal use.
     * @internal
     */
    getSyncService(): ExecutionWorkerWritebackService;
    /**
     * Executes an operation with retry logic, timeout, and circuit breaker.
     */
    private executeWithRetryAndTimeout;
    /**
     * Executes an operation within the concurrency limit.
     */
    private executeOperation;
    /**
     * Enqueues an operation for batch processing.
     */
    private enqueueOperation;
    /**
     * Processes queued operations.
     */
    private processQueue;
    /**
     * Internal queue processing loop.
     */
    private doProcessQueue;
    /**
     * Starts the coalescing timer.
     */
    private startCoalescingTimer;
    /**
     * Flushes coalesced writebacks that have exceeded the window.
     */
    private flushCoalescedWritebacks;
    /**
     * Starts the batch flush timer for batching mode.
     */
    private startBatchFlushTimer;
    /**
     * Flushes the batch queue.
     */
    private flushBatch;
    /**
     * Records a failure for circuit breaker.
     */
    private recordCircuitBreakerFailure;
    /**
     * Determines if an error is retryable.
     */
    private isRetryableError;
    /**
     * Calculates exponential backoff delay with jitter.
     */
    private calculateBackoff;
    /**
     * Updates the average latency metric.
     */
    private updateAverageLatency;
    /**
     * Sleep utility for async delay.
     */
    private sleep;
    /**
     * Generates a unique operation ID.
     */
    private generateOperationId;
    /**
     * Disposes the service and cleans up resources.
     */
    dispose(): void;
}
