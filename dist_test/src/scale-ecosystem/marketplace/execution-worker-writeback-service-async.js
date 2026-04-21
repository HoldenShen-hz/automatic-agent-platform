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
import { ExecutionWorkerWritebackService } from "../../platform/execution/worker-pool/execution-worker-writeback-service.js";
import { StructuredLogger } from "../../platform/shared/observability/structured-logger.js";
const logger = new StructuredLogger({ retentionLimit: 200 });
/**
 * Async Execution Worker Writeback Service
 *
 * Handles result reporting from workers with async/await interface,
 * retry logic, timeout handling, and queue-based processing.
 *
 * This async version provides the same functionality as ExecutionWorkerWritebackService
 * but with enterprise-grade async patterns for reliable distributed operation.
 */
export class ExecutionWorkerWritebackServiceAsync extends EventEmitter {
    sync;
    options;
    // Queue-based processing
    operationQueue = [];
    activeOperations = new Set();
    maxConcurrentOperations;
    // Writeback coalescing
    coalescedWritebacks = new Map();
    coalescingTimer = null;
    // Batching
    batchQueue = [];
    batchFlushTimer = null;
    // Circuit breaker
    circuitBreaker = {
        failures: 0,
        lastFailure: null,
        state: "closed",
        halfOpenAttempts: 0,
    };
    // Metrics
    metrics = {
        totalWritebacks: 0,
        acceptedWritebacks: 0,
        rejectedWritebacks: 0,
        retriedWritebacks: 0,
        timedOutWritebacks: 0,
        coalescedWritebacks: 0,
        averageLatencyMs: 0,
    };
    // Disposal state
    disposed = false;
    processingPromise = null;
    /**
     * Creates a new ExecutionWorkerWritebackServiceAsync instance.
     *
     * @param db - SQLite database instance (sync mode)
     * @param store - AuthoritativeTaskStore for data access
     * @param options - Service configuration options
     */
    constructor(db, store, syncOptions = {}, asyncOptions = {}) {
        super();
        this.sync = new ExecutionWorkerWritebackService(db, store, syncOptions);
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
            coalescingEnabled: asyncOptions.coalescingEnabled ?? true,
            coalescingWindowMs: asyncOptions.coalescingWindowMs ?? 50,
        };
        this.maxConcurrentOperations = 15;
        // Start auxiliary timers
        if (this.options.coalescingEnabled) {
            this.startCoalescingTimer();
        }
        if (this.options.batchingEnabled) {
            this.startBatchFlushTimer();
        }
    }
    /**
     * Records a writeback from a worker with retry and timeout.
     *
     * @param input - Writeback parameters including execution ID, worker ID, lease, and terminal status
     * @param options - Optional timeout and abort signal
     * @returns Promise resolving to the writeback decision
     */
    async recordWriteback(input, options) {
        return this.executeWithRetryAndTimeout("recordWriteback", () => this.sync.recordWriteback(input), input.executionId, options?.timeoutMs ?? this.options.defaultTimeoutMs, options?.signal);
    }
    /**
     * Enqueues a writeback for batch processing with optional coalescing.
     *
     * @param input - Writeback parameters
     * @param options - Optional timeout and abort signal
     * @returns Promise resolving to the writeback decision
     */
    enqueueWriteback(input, options) {
        // Check for coalescing
        if (this.options.coalescingEnabled) {
            const coalesced = this.tryCoalesceWriteback(input);
            if (coalesced) {
                return coalesced;
            }
        }
        return this.enqueueOperation("recordWriteback", () => this.sync.recordWriteback(input), input.executionId, options?.timeoutMs ?? this.options.defaultTimeoutMs, options?.signal, options?.priority ?? 0);
    }
    /**
     * Tries to coalesce a writeback with a pending one for the same execution.
     */
    tryCoalesceWriteback(input) {
        const key = input.executionId;
        const existing = this.coalescedWritebacks.get(key);
        if (existing) {
            // Update the coalesced entry
            existing.input = input; // Use latest input
            existing.count++;
            existing.lastQueuedAt = Date.now();
            this.metrics.coalescedWritebacks++;
            this.emit("writeback_coalesced", {
                type: "writeback_coalesced",
                executionId: input.executionId,
                count: existing.count,
            });
            // Return a promise that resolves when the coalesced writeback completes
            return new Promise((resolve, reject) => {
                setTimeout(() => {
                    // The actual resolution happens when the coalesced operation completes
                    this.enqueueOperation("recordWriteback", () => this.sync.recordWriteback(input), input.executionId, this.options.defaultTimeoutMs, undefined, 0)
                        .then(resolve)
                        .catch(reject);
                }, this.options.coalescingWindowMs);
            });
        }
        // Create new coalesced entry
        this.coalescedWritebacks.set(key, {
            input,
            count: 1,
            firstQueuedAt: Date.now(),
            lastQueuedAt: Date.now(),
        });
        return null;
    }
    /**
     * Gets the current queue depth.
     */
    getQueueDepth() {
        return this.operationQueue.length;
    }
    /**
     * Gets the number of currently active operations.
     */
    getActiveOperationCount() {
        return this.activeOperations.size;
    }
    /**
     * Gets circuit breaker status.
     */
    getCircuitBreakerStatus() {
        return {
            state: this.circuitBreaker.state,
            failures: this.circuitBreaker.failures,
            lastFailure: this.circuitBreaker.lastFailure,
        };
    }
    /**
     * Gets writeback metrics.
     */
    getMetrics() {
        return { ...this.metrics };
    }
    /**
     * Resets the circuit breaker to closed state.
     */
    resetCircuitBreaker() {
        this.circuitBreaker = {
            failures: 0,
            lastFailure: null,
            state: "closed",
            halfOpenAttempts: 0,
        };
        logger.log({ level: "info", message: "execution_worker_writeback_service.circuit_breaker_reset", data: {} });
        this.emit("circuit_breaker_close");
    }
    /**
     * Resets metrics.
     */
    resetMetrics() {
        this.metrics = {
            totalWritebacks: 0,
            acceptedWritebacks: 0,
            rejectedWritebacks: 0,
            retriedWritebacks: 0,
            timedOutWritebacks: 0,
            coalescedWritebacks: 0,
            averageLatencyMs: 0,
        };
    }
    /**
     * Gets the synchronous service instance for internal use.
     * @internal
     */
    getSyncService() {
        return this.sync;
    }
    /**
     * Executes an operation with retry logic, timeout, and circuit breaker.
     */
    async executeWithRetryAndTimeout(operationName, operation, executionId, timeoutMs, signal) {
        const operationId = this.generateOperationId();
        const startedAt = Date.now();
        this.metrics.totalWritebacks++;
        this.emit("writeback_start", { type: "writeback_start", writebackId: operationId, executionId });
        // Check circuit breaker
        if (this.options.circuitBreakerEnabled && this.circuitBreaker.state === "open") {
            if (Date.now() - this.circuitBreaker.lastFailure >= this.options.circuitBreakerResetMs) {
                this.circuitBreaker.state = "half_open";
                this.circuitBreaker.halfOpenAttempts++;
                logger.log({
                    level: "warn",
                    message: "execution_worker_writeback_service.circuit_breaker_half_open",
                    data: { halfOpenAttempts: this.circuitBreaker.halfOpenAttempts },
                });
            }
            else {
                const error = new Error("Circuit breaker is open");
                const durationMs = Date.now() - startedAt;
                this.metrics.rejectedWritebacks++;
                this.emit("writeback_complete", {
                    type: "writeback_complete",
                    writebackId: operationId,
                    executionId,
                    durationMs,
                    accepted: false,
                });
                throw error;
            }
        }
        // Create abort controller for timeout
        let timeoutHandle = null;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutHandle = setTimeout(() => {
                if (!signal?.aborted) {
                    this.metrics.timedOutWritebacks++;
                    this.emit("writeback_timeout", { type: "writeback_timeout", writebackId: operationId, executionId });
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
        let lastError = null;
        try {
            for (let attempt = 0; attempt <= this.options.maxRetries; attempt++) {
                try {
                    if (attempt > 0) {
                        const backoffDelay = this.calculateBackoff(attempt);
                        this.metrics.retriedWritebacks++;
                        this.emit("writeback_retry", {
                            type: "writeback_retry",
                            writebackId: operationId,
                            executionId,
                            attempt,
                            delayMs: backoffDelay,
                        });
                        await this.sleep(backoffDelay);
                    }
                    // Execute operation with timeout
                    const result = await Promise.race([
                        this.executeOperation(operation, operationId),
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
                    // Track acceptance
                    if (typeof result === "object" && result !== null && "accepted" in result) {
                        if (result.accepted) {
                            this.metrics.acceptedWritebacks++;
                        }
                        else {
                            this.metrics.rejectedWritebacks++;
                        }
                    }
                    this.updateAverageLatency(durationMs);
                    this.emit("writeback_complete", {
                        type: "writeback_complete",
                        writebackId: operationId,
                        executionId,
                        durationMs,
                        accepted: result.accepted ?? false,
                    });
                    return result;
                }
                catch (error) {
                    lastError = error instanceof Error ? error : new Error(String(error));
                    // Check if we should retry
                    if (!this.isRetryableError(lastError)) {
                        const durationMs = Date.now() - startedAt;
                        this.metrics.rejectedWritebacks++;
                        this.emit("writeback_complete", {
                            type: "writeback_complete",
                            writebackId: operationId,
                            executionId,
                            durationMs,
                            accepted: false,
                        });
                        this.recordCircuitBreakerFailure();
                        throw lastError;
                    }
                    // Check if we've exhausted retries
                    if (attempt >= this.options.maxRetries) {
                        const durationMs = Date.now() - startedAt;
                        this.metrics.rejectedWritebacks++;
                        this.emit("writeback_complete", {
                            type: "writeback_complete",
                            writebackId: operationId,
                            executionId,
                            durationMs,
                            accepted: false,
                        });
                        this.recordCircuitBreakerFailure();
                        throw lastError;
                    }
                }
            }
            // Should not reach here
            this.recordCircuitBreakerFailure();
            throw lastError ?? new Error("Operation failed");
        }
        finally {
            if (timeoutHandle) {
                clearTimeout(timeoutHandle);
            }
            signal?.removeEventListener("abort", abortHandler);
        }
    }
    /**
     * Executes an operation within the concurrency limit.
     */
    async executeOperation(operation, operationId) {
        while (this.activeOperations.size >= this.maxConcurrentOperations) {
            await this.sleep(10);
        }
        this.activeOperations.add(operationId);
        try {
            return operation();
        }
        finally {
            this.activeOperations.delete(operationId);
        }
    }
    /**
     * Enqueues an operation for batch processing.
     */
    enqueueOperation(operationName, operation, executionId, timeoutMs, signal, priority = 0) {
        if (this.disposed) {
            return Promise.reject(new Error("Service has been disposed"));
        }
        if (this.operationQueue.length >= this.options.maxQueueSize) {
            this.emit("queue_overflow", { type: "queue_overflow", queueSize: this.operationQueue.length });
            return Promise.reject(new Error("Operation queue is full"));
        }
        return new Promise((resolve, reject) => {
            const abortController = new AbortController();
            const pendingOp = {
                id: this.generateOperationId(),
                operationName,
                operation: async () => {
                    if (signal?.aborted || abortController.signal.aborted) {
                        throw new Error(`Operation ${operationName} was aborted`);
                    }
                    return this.executeWithRetryAndTimeout(operationName, operation, executionId, timeoutMs, signal);
                },
                resolve,
                reject,
                abortController,
                createdAt: Date.now(),
                timeoutMs,
                priority,
            };
            this.operationQueue.push(pendingOp);
            this.operationQueue.sort((a, b) => b.priority - a.priority);
            this.processQueue();
        });
    }
    /**
     * Processes queued operations.
     */
    async processQueue() {
        if (this.processingPromise) {
            return;
        }
        this.processingPromise = this.doProcessQueue();
        try {
            await this.processingPromise;
        }
        finally {
            this.processingPromise = null;
        }
    }
    /**
     * Internal queue processing loop.
     */
    async doProcessQueue() {
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
     * Starts the coalescing timer.
     */
    startCoalescingTimer() {
        this.coalescingTimer = setInterval(() => {
            this.flushCoalescedWritebacks();
        }, this.options.coalescingWindowMs * 2);
    }
    /**
     * Flushes coalesced writebacks that have exceeded the window.
     */
    flushCoalescedWritebacks() {
        const now = Date.now();
        const staleThreshold = this.options.coalescingWindowMs * 3;
        for (const [key, coalesced] of this.coalescedWritebacks.entries()) {
            if (now - coalesced.lastQueuedAt > staleThreshold) {
                this.coalescedWritebacks.delete(key);
            }
        }
    }
    /**
     * Starts the batch flush timer for batching mode.
     */
    startBatchFlushTimer() {
        this.batchFlushTimer = setInterval(() => {
            this.flushBatch();
        }, this.options.batchFlushIntervalMs);
    }
    /**
     * Flushes the batch queue.
     */
    async flushBatch() {
        if (this.batchQueue.length === 0 || this.disposed) {
            return;
        }
        const batch = this.batchQueue.splice(0, this.options.batchSize);
        const startedAt = Date.now();
        await Promise.allSettled(batch.map((item) => item
            .operation()
            .then(item.resolve)
            .catch((error) => item.reject(error instanceof Error ? error : new Error(String(error))))));
        const durationMs = Date.now() - startedAt;
        this.emit("batch_flush", { type: "batch_flush", batchSize: batch.length, durationMs });
    }
    /**
     * Records a failure for circuit breaker.
     */
    recordCircuitBreakerFailure() {
        if (!this.options.circuitBreakerEnabled) {
            return;
        }
        this.circuitBreaker.failures++;
        this.circuitBreaker.lastFailure = Date.now();
        if (this.circuitBreaker.state === "half_open") {
            this.circuitBreaker.state = "open";
            logger.log({
                level: "warn",
                message: "execution_worker_writeback_service.circuit_breaker_open",
                data: { failureCount: this.circuitBreaker.failures, trigger: "half_open_failure" },
            });
            this.emit("circuit_breaker_open", { type: "circuit_breaker_open", failureCount: this.circuitBreaker.failures });
        }
        else if (this.circuitBreaker.failures >= this.options.circuitBreakerThreshold) {
            this.circuitBreaker.state = "open";
            logger.log({
                level: "warn",
                message: "execution_worker_writeback_service.circuit_breaker_open",
                data: { failureCount: this.circuitBreaker.failures, trigger: "threshold_exceeded" },
            });
            this.emit("circuit_breaker_open", { type: "circuit_breaker_open", failureCount: this.circuitBreaker.failures });
        }
    }
    /**
     * Determines if an error is retryable.
     */
    isRetryableError(error) {
        if (error.message.includes("ETIMEDOUT") ||
            error.message.includes("ECONNREFUSED") ||
            error.message.includes("ENOTFOUND")) {
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
    calculateBackoff(attemptIndex) {
        const exponentialDelay = Math.min(this.options.initialBackoffMs * Math.pow(2, attemptIndex), this.options.maxBackoffMs);
        const jitter = Math.random() * exponentialDelay * 0.1;
        return Math.round(exponentialDelay + jitter);
    }
    /**
     * Updates the average latency metric.
     */
    updateAverageLatency(newLatencyMs) {
        const totalLatency = this.metrics.averageLatencyMs * this.metrics.totalWritebacks + newLatencyMs;
        this.metrics.averageLatencyMs = totalLatency / this.metrics.totalWritebacks;
    }
    /**
     * Sleep utility for async delay.
     */
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    /**
     * Generates a unique operation ID.
     */
    generateOperationId() {
        return `wb_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
    }
    /**
     * Disposes the service and cleans up resources.
     */
    dispose() {
        if (this.disposed) {
            return;
        }
        this.disposed = true;
        // Stop timers
        if (this.coalescingTimer) {
            clearInterval(this.coalescingTimer);
            this.coalescingTimer = null;
        }
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
        this.coalescedWritebacks.clear();
        logger.log({ level: "info", message: "execution_worker_writeback_service.disposed", data: {} });
    }
}
//# sourceMappingURL=execution-worker-writeback-service-async.js.map