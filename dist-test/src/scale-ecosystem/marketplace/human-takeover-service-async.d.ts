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
import { EventEmitter } from "node:events";
import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";
import type { TaskTerminalStatus } from "../../platform/contracts/types/status.js";
import type { TakeoverActionResult } from "../../platform/control-plane/incident-control/human-takeover-service.js";
import { HumanTakeoverService } from "../../platform/control-plane/incident-control/human-takeover-service.js";
export type { TakeoverActionResult } from "../../platform/control-plane/incident-control/human-takeover-service.js";
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
 * Takeover operation types
 */
export type TakeoverOperationType = "openSession" | "modifyInput" | "switchWorker" | "retryExecution" | "setCurrentStep" | "writeStepOutput" | "skipCurrentStep" | "completeTask";
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
export type HumanTakeoverServiceAsyncEvent = {
    type: "operation_start";
    operationId: string;
    operation: TakeoverOperationType;
} | {
    type: "operation_complete";
    operationId: string;
    operation: TakeoverOperationType;
    durationMs: number;
    success: boolean;
} | {
    type: "operation_retry";
    operationId: string;
    operation: TakeoverOperationType;
    attempt: number;
    delayMs: number;
} | {
    type: "operation_timeout";
    operationId: string;
    operation: TakeoverOperationType;
} | {
    type: "circuit_breaker_open";
    failureCount: number;
} | {
    type: "circuit_breaker_close";
} | {
    type: "queue_overflow";
    queueSize: number;
} | {
    type: "session_opened";
    sessionId: string;
    taskId: string;
} | {
    type: "session_closed";
    sessionId: string;
    taskId: string;
};
/**
 * Async Human Takeover Service
 *
 * Service for managing human-in-the-loop takeover requests with async/await interface,
 * retry logic, timeout handling, and enhanced audit capabilities.
 *
 * This async version provides the same functionality as HumanTakeoverService
 * but with enterprise-grade async patterns for reliable distributed operation.
 */
export declare class HumanTakeoverServiceAsync extends EventEmitter {
    private readonly sync;
    private readonly options;
    private readonly operationQueue;
    private readonly activeOperations;
    private readonly maxConcurrentOperations;
    private circuitBreaker;
    private metrics;
    private disposed;
    private processingPromise;
    /**
     * Creates a new HumanTakeoverServiceAsync instance.
     *
     * @param db - SQLite database instance (sync mode)
     * @param store - AuthoritativeTaskStore for data access
     * @param options - Service configuration options
     */
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, options?: HumanTakeoverServiceAsyncOptions);
    /**
     * Opens a new takeover session for a task with retry and timeout.
     *
     * @param input - Contains taskId, operatorId making the takeover, and reasonCode
     * @param options - Optional timeout and abort signal
     * @returns Promise resolving to the action result with session and action identifiers
     */
    openSession(input: {
        taskId: string;
        operatorId: string;
        reasonCode: string;
        tenantId?: string | null;
    }, options?: {
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<TakeoverActionResult>;
    /**
     * Modifies the input JSON for a task within an active takeover session.
     *
     * @param input - Contains session ID, new input JSON, and reason code
     * @param options - Optional timeout and abort signal
     * @returns Promise resolving to the action result
     */
    modifyInput(input: {
        takeoverSessionId: string;
        inputJson: string;
        normalizedInputJson?: string;
        reasonCode: string;
        tenantId?: string | null;
    }, options?: {
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<TakeoverActionResult>;
    /**
     * Switches the worker agent assigned to the current execution.
     *
     * @param input - Contains session ID, new agent ID, and reason code
     * @param options - Optional timeout and abort signal
     * @returns Promise resolving to the action result
     */
    switchWorker(input: {
        takeoverSessionId: string;
        agentId: string;
        reasonCode: string;
        tenantId?: string | null;
    }, options?: {
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<TakeoverActionResult>;
    /**
     * Retries the current execution by creating a new execution record.
     *
     * @param input - Contains session ID and reason code
     * @param options - Optional timeout and abort signal
     * @returns Promise resolving to the action result
     */
    retryExecution(input: {
        takeoverSessionId: string;
        reasonCode: string;
        tenantId?: string | null;
    }, options?: {
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<TakeoverActionResult>;
    /**
     * Moves the workflow to a different step.
     *
     * @param input - Contains session ID, step target, and reason code
     * @param options - Optional timeout and abort signal
     * @returns Promise resolving to the action result
     */
    setCurrentStep(input: {
        takeoverSessionId: string;
        reasonCode: string;
        stepId?: string;
        stepIndex?: number;
        tenantId?: string | null;
    }, options?: {
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<TakeoverActionResult>;
    /**
     * Writes a manual step output for the current or specified step.
     *
     * @param input - Contains session ID, output JSON, and step targeting
     * @param options - Optional timeout and abort signal
     * @returns Promise resolving to the action result
     */
    writeStepOutput(input: {
        takeoverSessionId: string;
        outputJson: string;
        reasonCode: string;
        stepId?: string;
        stepIndex?: number;
        status?: "succeeded" | "failed" | "partial_success";
        summary?: string;
        tenantId?: string | null;
    }, options?: {
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<TakeoverActionResult>;
    /**
     * Skips the current workflow step.
     *
     * @param input - Contains session ID, optional note, and reason code
     * @param options - Optional timeout and abort signal
     * @returns Promise resolving to the action result
     */
    skipCurrentStep(input: {
        takeoverSessionId: string;
        note?: string;
        reasonCode: string;
        tenantId?: string | null;
    }, options?: {
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<TakeoverActionResult>;
    /**
     * Completes a task with a specified terminal status.
     *
     * @param input - Contains session ID, terminal status, and reason code
     * @param options - Optional timeout and abort signal
     * @returns Promise resolving to the action result
     */
    completeTask(input: {
        takeoverSessionId: string;
        terminalStatus: TaskTerminalStatus;
        reasonCode: string;
        outputJson?: string;
        tenantId?: string | null;
    }, options?: {
        timeoutMs?: number;
        signal?: AbortSignal;
    }): Promise<TakeoverActionResult>;
    /**
     * Enqueues a takeover operation for batch processing.
     *
     * @param operationType - The type of operation to enqueue
     * @param input - The operation input
     * @param options - Optional timeout and abort signal
     * @returns Promise resolving to the action result
     */
    enqueueOperation<T extends TakeoverActionResult>(operationType: TakeoverOperationType, input: Record<string, unknown>, options?: {
        timeoutMs?: number;
        signal?: AbortSignal;
        priority?: number;
    }): Promise<T>;
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
     * Gets operation metrics.
     */
    getMetrics(): TakeoverMetrics;
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
    getSyncService(): HumanTakeoverService;
    /**
     * Executes an operation with retry logic, timeout, and circuit breaker.
     */
    private executeWithRetryAndTimeout;
    /**
     * Executes an operation within the concurrency limit.
     */
    private executeOperation;
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
