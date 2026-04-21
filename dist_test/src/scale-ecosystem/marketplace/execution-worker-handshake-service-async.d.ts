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
import { EventEmitter } from "node:events";
import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";
import type { ExecutionWorkerHandshakeServiceOptions, WorkerClaimExecutionInput, WorkerExecutionHeartbeatInput, WorkerHandshakeDecision } from "../../platform/execution/worker-pool/execution-worker-handshake-types.js";
import { ExecutionWorkerHandshakeService } from "../../platform/execution/worker-pool/execution-worker-handshake-service.js";
export type { ExecutionWorkerHandshakeServiceOptions, WorkerClaimExecutionInput, WorkerExecutionHeartbeatInput, WorkerHandshakeDecision, WorkerRemoteLogInput, } from "../../platform/execution/worker-pool/execution-worker-handshake-types.js";
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
export type ExecutionWorkerHandshakeServiceAsyncEvent = {
    type: "operation_start";
    operationId: string;
    operation: string;
} | {
    type: "operation_complete";
    operationId: string;
    operation: string;
    durationMs: number;
    success: boolean;
} | {
    type: "operation_retry";
    operationId: string;
    operation: string;
    attempt: number;
    delayMs: number;
} | {
    type: "operation_timeout";
    operationId: string;
    operation: string;
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
 * Async Execution Worker Handshake Service
 *
 * Handles the handshake between the authoritative system and workers -
 * including lease acquisition, heartbeat, and execution claim.
 *
 * This async version provides the same functionality as ExecutionWorkerHandshakeService
 * but with async/await interface, retry logic, timeout handling, and queue-based processing.
 */
export declare class ExecutionWorkerHandshakeServiceAsync extends EventEmitter {
    private readonly sync;
    private readonly options;
    private readonly operationQueue;
    private readonly activeOperations;
    private readonly maxConcurrentOperations;
    private readonly batchQueue;
    private batchFlushTimer;
    private circuitBreaker;
    private metrics;
    private disposed;
    private processingPromise;
    /**
     * Creates a new ExecutionWorkerHandshakeServiceAsync instance.
     *
     * @param db - SQLite database instance (sync mode)
     * @param store - AuthoritativeTaskStore for data access
     * @param options - Service configuration options
     */
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, options?: ExecutionWorkerHandshakeServiceOptions, asyncOptions?: ExecutionWorkerHandshakeServiceAsyncOptions);
    /**
     * Handles a worker's request to claim an execution ticket with retry and timeout.
     *
     * @param input - Claim parameters including ticket ID, worker ID, lease, and fencing token
     * @param options - Optional timeout and abort signal
     * @returns Promise resolving to the handshake decision
     */
    claimExecution(input: WorkerClaimExecutionInput, options?: {
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<WorkerHandshakeDecision>;
    /**
     * Records a heartbeat from a worker with retry and timeout.
     *
     * @param input - Heartbeat parameters including execution ID, worker, lease, and telemetry
     * @param options - Optional timeout and abort signal
     * @returns Promise resolving to the handshake decision
     */
    recordHeartbeat(input: WorkerExecutionHeartbeatInput, options?: {
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<WorkerHandshakeDecision>;
    /**
     * Enqueues a claim execution operation for batch processing.
     *
     * @param input - Claim parameters
     * @param options - Optional timeout and abort signal
     * @returns Promise resolving to the handshake decision
     */
    enqueueClaimExecution(input: WorkerClaimExecutionInput, options?: {
        timeoutMs?: number;
        signal?: AbortSignal;
        priority?: number;
    }): Promise<WorkerHandshakeDecision>;
    /**
     * Enqueues a heartbeat operation for batch processing.
     *
     * @param input - Heartbeat parameters
     * @param options - Optional timeout and abort signal
     * @returns Promise resolving to the handshake decision
     */
    enqueueHeartbeat(input: WorkerExecutionHeartbeatInput, options?: {
        timeoutMs?: number;
        signal?: AbortSignal;
        priority?: number;
    }): Promise<WorkerHandshakeDecision>;
    /**
     * Gets the current queue depth.
     *
     * @returns Number of operations currently queued
     */
    getQueueDepth(): number;
    /**
     * Gets the number of currently active operations.
     *
     * @returns Number of operations currently executing
     */
    getActiveOperationCount(): number;
    /**
     * Gets circuit breaker status.
     *
     * @returns Object with circuit breaker state and metrics
     */
    getCircuitBreakerStatus(): {
        state: CircuitBreakerState;
        failures: number;
        lastFailure: number | null;
    };
    /**
     * Gets operation metrics.
     *
     * @returns Object with operation metrics
     */
    getMetrics(): OperationMetrics;
    /**
     * Resets the circuit breaker to closed state.
     */
    resetCircuitBreaker(): void;
    /**
     * Resets operation metrics.
     */
    resetMetrics(): void;
    /**
     * Gets the synchronous service instance for internal use.
     * @internal
     */
    getSyncService(): ExecutionWorkerHandshakeService;
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
