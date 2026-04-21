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
import { EventEmitter } from "node:events";
import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";
import type { AdmissionBackpressureSnapshot } from "../../platform/execution/dispatcher/admission-controller.js";
import type { CreateExecutionTicketInput, DispatchExecutionDecision, DispatchExecutionOptions, DispatchQueueAvailabilitySnapshot, ExecutionTicketDecision } from "../../platform/execution/dispatcher/execution-dispatch-support.js";
import { ExecutionDispatchService } from "../../platform/execution/dispatcher/execution-dispatch-service.js";
export type { CreateExecutionTicketInput, DispatchExecutionDecision, DispatchExecutionOptions, DispatchQueueAvailabilitySnapshot, ExecutionTicketDecision, } from "../../platform/execution/dispatcher/execution-dispatch-support.js";
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
 * Event types emitted by the service
 */
export type ExecutionDispatchServiceAsyncEvent = {
    type: "operation_start";
    operationId: string;
    operation: string;
} | {
    type: "operation_complete";
    operationId: string;
    operation: string;
    durationMs: number;
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
};
/**
 * Async Execution Dispatch Service
 *
 * Manages execution dispatch with async/await interface, retry logic,
 * timeout handling, and queue-based processing.
 *
 * This service wraps the synchronous ExecutionDispatchService and adds
 * enterprise-grade async patterns for reliable distributed operation.
 */
export declare class ExecutionDispatchServiceAsync extends EventEmitter {
    private readonly sync;
    private readonly options;
    private readonly operationQueue;
    private readonly activeOperations;
    private readonly maxConcurrentOperations;
    private circuitBreaker;
    private disposed;
    private processingPromise;
    private readonly isProcessing;
    /**
     * Creates a new ExecutionDispatchServiceAsync instance.
     *
     * @param db - SQLite database instance (sync mode)
     * @param store - AuthoritativeTaskStore for data access
     * @param backpressureSnapshot - Optional backpressure snapshot function
     * @param queueAvailabilitySnapshot - Optional queue availability snapshot function
     * @param options - Service configuration options
     */
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, backpressureSnapshot?: (() => AdmissionBackpressureSnapshot | null) | null, queueAvailabilitySnapshot?: (() => DispatchQueueAvailabilitySnapshot | null) | null, options?: ExecutionDispatchServiceAsyncOptions);
    /**
     * Creates a new execution ticket for an execution with retry and timeout support.
     *
     * @param input - The execution ticket creation input
     * @param options - Optional override options for timeout and abort signal
     * @returns Promise resolving to the ticket decision
     */
    createTicket(input: CreateExecutionTicketInput, options?: {
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<ExecutionTicketDecision>;
    /**
     * Dispatches the next available ticket to an available worker with retry and timeout.
     *
     * @param options - Dispatch options including queue name, worker preference, lease TTL
     * @param timeoutOptions - Optional override options for timeout and abort signal
     * @returns Promise resolving to the dispatch decision
     */
    dispatchNext(options: DispatchExecutionOptions, timeoutOptions?: {
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<DispatchExecutionDecision>;
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
    enqueueTicketCreation(input: CreateExecutionTicketInput, options?: {
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<ExecutionTicketDecision>;
    /**
     * Enqueues a dispatch operation for batch processing.
     *
     * @param options - Dispatch options
     * @param timeoutOptions - Optional timeout and abort signal
     * @returns Promise resolving to the dispatch decision
     */
    enqueueDispatch(options: DispatchExecutionOptions, timeoutOptions?: {
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<DispatchExecutionDecision>;
    /**
     * Gets the current queue depth (number of pending operations).
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
     * Resets the circuit breaker to closed state.
     * Use this after resolving the underlying issue.
     */
    resetCircuitBreaker(): void;
    /**
     * Gets the synchronous service instance for internal use.
     * @internal
     */
    getSyncService(): ExecutionDispatchService;
    /**
     * Executes an operation with retry logic, timeout, and circuit breaker.
     *
     * @param operationName - Name of the operation for logging
     * @param operation - The synchronous operation to execute
     * @param timeoutMs - Timeout in milliseconds
     * @param signal - Optional abort signal
     * @returns Promise resolving to the operation result
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
