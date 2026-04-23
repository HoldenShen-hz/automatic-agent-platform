/**
 * Async Human Takeover Service
 *
 * Async-first human takeover service that provides async/await interface for
 * managing operator interventions in task execution. This service wraps the
 * synchronous HumanTakeoverService and adds async-specific capabilities:
 *
 * - Queue-based async processing for non-blocking takeover requests
 * - Configurable timeout handling with escalation triggers
 * - Acknowledgment tracking with expiration management
 * - Typed event emission for all state transitions
 * - Background processing loop for deferred request handling
 *
 * @see HumanTakeoverService for the sync implementation
 */
import { createRequire } from "node:module";
import { nowIso, newId } from "../../contracts/types/ids.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { TakeoverQueueManager } from "./takeover-queue-manager.js";
import { TakeoverEscalationManager } from "./takeover-escalation-manager.js";
const require = createRequire(import.meta.url);
const DEFAULT_CONFIG = {
    timeoutConfig: {
        defaultTimeoutMs: 5 * 60 * 1000, // 5 minutes
        acknowledgmentTimeoutMs: 2 * 60 * 1000, // 2 minutes
        escalationCheckIntervalMs: 30 * 1000, // 30 seconds
        maxRetries: 3,
    },
    maxQueueDepth: 1000,
    processingConcurrency: 5,
    defaultPriority: 5,
    backoffDelayMs: 1000,
};
// ---------------------------------------------------------------------------
// Async Human Takeover Service
// ---------------------------------------------------------------------------
/**
 * Async Human Takeover Service
 *
 * Provides async-first human takeover capabilities with queue-based processing,
 * timeout management, escalation handling, and typed event emission.
 *
 * This service is the async counterpart to HumanTakeoverService, designed
 * for contexts where async/await is preferred and background processing is needed.
 */
export class HumanTakeoverServiceAsync {
    sync;
    config;
    logger;
    /** Queue manager for pending takeover requests. */
    queueManager;
    /** Escalation manager for timeout, acknowledgment, and escalation handling. */
    escalationManager;
    /** Event handlers keyed by event type. */
    eventHandlers = new Map();
    /** Flag indicating if the processing loop is running. */
    processingLoopActive = false;
    /** Abort controller for graceful shutdown of the processing loop. */
    abortController = new AbortController();
    constructor(db, store, config = {}) {
        const { HumanTakeoverService: SyncService } = require("./human-takeover-service.js");
        this.sync = new SyncService(db, store);
        this.config = { ...DEFAULT_CONFIG, ...config };
        this.logger = new StructuredLogger({ retentionLimit: 100 });
        // Create event emitter wrapper for the managers
        const eventEmitter = {
            emit: (event, payload) => {
                this.emit(event, payload);
            },
        };
        // Initialize queue manager
        const queueConfig = {
            maxQueueDepth: this.config.maxQueueDepth,
            defaultPriority: this.config.defaultPriority,
        };
        this.queueManager = new TakeoverQueueManager(queueConfig, eventEmitter);
        // Initialize escalation manager with auto-close handler
        this.escalationManager = new TakeoverEscalationManager(this.config.timeoutConfig, eventEmitter, async (sessionId, taskId) => {
            await this.handleAutoClose(sessionId, taskId);
        });
    }
    // -------------------------------------------------------------------------
    // Queue Management
    // -------------------------------------------------------------------------
    /**
     * Enqueues a takeover request for async processing.
     * Returns the request ID for tracking.
     */
    enqueueTakeoverRequest(request) {
        return this.queueManager.enqueue(request);
    }
    /**
     * Gets the current depth of the pending queue.
     */
    getQueueDepth() {
        return this.queueManager.getQueueDepth();
    }
    /**
     * Gets all pending requests without removing them.
     */
    getPendingRequests() {
        return this.queueManager.getPendingRequests();
    }
    /**
     * Cancels a pending request by requestId.
     * Returns true if the request was found and cancelled.
     */
    cancelRequest(requestId) {
        return this.queueManager.cancel(requestId);
    }
    // -------------------------------------------------------------------------
    // Async Action Wrappers
    // -------------------------------------------------------------------------
    /**
     * Opens a new takeover session asynchronously.
     * Enqueues the request for async processing and returns immediately.
     */
    openSessionAsync(input) {
        return this.enqueueTakeoverRequest({
            taskId: input.taskId,
            operatorId: input.operatorId,
            reasonCode: input.reasonCode,
            actionType: "open_session",
            payload: {
                type: "open_session",
                reasonCode: input.reasonCode,
                ...(input.tenantId !== undefined ? { tenantId: input.tenantId } : {}),
            },
            ...(input.priority !== undefined ? { priority: input.priority } : {}),
        });
    }
    /**
     * Processes a single takeover request synchronously.
     */
    processRequest(requestId) {
        const entry = this.queueManager.findPending(requestId);
        if (!entry) {
            return { requestId, success: false, processedAt: nowIso(), error: "Request not found" };
        }
        if (entry.status !== "pending") {
            return { requestId, success: false, processedAt: nowIso(), error: `Request is ${entry.status}` };
        }
        entry.status = "processing";
        entry.attempts++;
        try {
            const result = this.dispatchToSyncService(entry);
            if (!result) {
                entry.status = entry.attempts >= this.config.timeoutConfig.maxRetries ? "failed" : "pending";
                return { requestId, success: false, processedAt: nowIso(), error: "Unknown action type" };
            }
            if (entry.actionType === "open_session") {
                this.escalationManager.startSessionTracking(result.takeoverSessionId, entry.taskId);
                this.emit("takeover:session_opened", {
                    sessionId: result.takeoverSessionId,
                    taskId: entry.taskId,
                    operatorId: entry.operatorId,
                    reasonCode: entry.reasonCode,
                    enqueuedAt: entry.enqueuedAt,
                });
            }
            else if (entry.actionType === "complete_task") {
                const p = entry.payload;
                this.escalationManager.stopSessionTracking(p.sessionId);
                this.emit("takeover:completed", {
                    sessionId: p.sessionId,
                    taskId: entry.taskId,
                    terminalStatus: p.terminalStatus,
                    completedAt: nowIso(),
                });
            }
            entry.status = "completed";
            this.queueManager.removeEntry(requestId);
            this.emit("takeover:request_processed", {
                requestId: entry.requestId,
                taskId: entry.taskId,
                actionType: entry.actionType,
                success: true,
            });
            this.logger.log({
                level: "debug",
                message: "takeover.request_processed",
                data: { requestId, actionType: entry.actionType, success: true },
            });
            return { requestId, success: true, actionResult: result, processedAt: nowIso() };
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            entry.lastError = errorMessage;
            entry.status = entry.attempts >= this.config.timeoutConfig.maxRetries ? "failed" : "pending";
            if (entry.attempts >= this.config.timeoutConfig.maxRetries) {
                this.queueManager.removeEntry(requestId);
            }
            this.emit("takeover:request_processed", {
                requestId: entry.requestId,
                taskId: entry.taskId,
                actionType: entry.actionType,
                success: false,
                error: errorMessage,
            });
            this.logger.log({
                level: "error",
                message: "takeover.request_processed_failed",
                data: { requestId, actionType: entry.actionType, error: errorMessage, attempts: entry.attempts },
            });
            return { requestId, success: false, processedAt: nowIso(), error: errorMessage };
        }
    }
    /**
     * Dispatches a queued entry to the appropriate sync service method.
     */
    dispatchToSyncService(entry) {
        const p = entry.payload;
        switch (p.type) {
            case "open_session":
                return this.sync.openSession({
                    taskId: entry.taskId,
                    operatorId: entry.operatorId,
                    reasonCode: p.reasonCode,
                    ...(p.tenantId !== undefined ? { tenantId: p.tenantId } : {}),
                });
            case "modify_input":
                return this.sync.modifyInput({
                    takeoverSessionId: p.sessionId,
                    inputJson: p.inputJson,
                    reasonCode: p.reasonCode,
                    ...(p.tenantId !== undefined ? { tenantId: p.tenantId } : {}),
                });
            case "switch_worker":
                return this.sync.switchWorker({
                    takeoverSessionId: p.sessionId,
                    agentId: p.agentId,
                    reasonCode: p.reasonCode,
                    ...(p.tenantId !== undefined ? { tenantId: p.tenantId } : {}),
                });
            case "retry_execution":
                return this.sync.retryExecution({
                    takeoverSessionId: p.sessionId,
                    reasonCode: p.reasonCode,
                    ...(p.tenantId !== undefined ? { tenantId: p.tenantId } : {}),
                });
            case "set_current_step":
                return this.sync.setCurrentStep({
                    takeoverSessionId: p.sessionId,
                    reasonCode: p.reasonCode,
                    ...(p.stepId !== undefined ? { stepId: p.stepId } : {}),
                    ...(p.stepIndex !== undefined ? { stepIndex: p.stepIndex } : {}),
                    ...(p.tenantId !== undefined ? { tenantId: p.tenantId } : {}),
                });
            case "write_step_output":
                return this.sync.writeStepOutput({
                    takeoverSessionId: p.sessionId,
                    outputJson: p.outputJson,
                    reasonCode: p.reasonCode,
                    ...(p.stepId !== undefined ? { stepId: p.stepId } : {}),
                    ...(p.stepIndex !== undefined ? { stepIndex: p.stepIndex } : {}),
                    ...(p.status !== undefined ? { status: p.status } : {}),
                    ...(p.summary !== undefined ? { summary: p.summary } : {}),
                    ...(p.tenantId !== undefined ? { tenantId: p.tenantId } : {}),
                });
            case "skip_current_step":
                return this.sync.skipCurrentStep({
                    takeoverSessionId: p.sessionId,
                    reasonCode: p.reasonCode,
                    ...(p.note !== undefined ? { note: p.note } : {}),
                    ...(p.tenantId !== undefined ? { tenantId: p.tenantId } : {}),
                });
            case "complete_task":
                return this.sync.completeTask({
                    takeoverSessionId: p.sessionId,
                    terminalStatus: p.terminalStatus,
                    reasonCode: p.reasonCode,
                    ...(p.outputJson !== undefined ? { outputJson: p.outputJson } : {}),
                    ...(p.tenantId !== undefined ? { tenantId: p.tenantId } : {}),
                });
            case "acknowledge_takeover":
                this.escalationManager.acknowledgeSession(p.sessionId, p.operatorId, entry.taskId);
                return {
                    taskId: entry.taskId,
                    executionId: null,
                    takeoverSessionId: p.sessionId,
                    operatorActionId: newId("opact"),
                };
            default:
                return undefined;
        }
    }
    /**
     * Processes the next pending request from the queue.
     */
    processNextRequest() {
        const next = this.queueManager.findNextPending();
        if (!next)
            return null;
        return this.processRequest(next.requestId);
    }
    // -------------------------------------------------------------------------
    // Escalation Management (delegated to TakeoverEscalationManager)
    // -------------------------------------------------------------------------
    /**
     * Acknowledges a takeover session — operator is now actively working.
     */
    acknowledgeSession(sessionId, operatorId) {
        return this.escalationManager.acknowledgeSession(sessionId, operatorId, "");
    }
    /**
     * Gets the acknowledgment status for a session.
     */
    getAcknowledgmentStatus(sessionId) {
        return this.escalationManager.getAcknowledgmentStatus(sessionId);
    }
    /**
     * Extends the acknowledgment deadline for an active session.
     */
    extendAcknowledgment(sessionId, additionalMs) {
        return this.escalationManager.extendAcknowledgment(sessionId, additionalMs);
    }
    /**
     * Handles automatic session close when max escalation is reached.
     */
    async handleAutoClose(sessionId, taskId) {
        try {
            this.sync.completeTask({
                takeoverSessionId: sessionId,
                terminalStatus: "failed",
                reasonCode: "takeover.auto_closed_max_escalation",
                tenantId: null,
            });
            this.emit("takeover:cancelled", {
                sessionId,
                taskId,
                reason: "Max escalation reached, session auto-closed",
                cancelledAt: nowIso(),
            });
            this.escalationManager.stopSessionTracking(sessionId);
        }
        catch (err) {
            this.logger.log({
                level: "error",
                message: "takeover.auto_close_failed",
                data: { sessionId, error: err instanceof Error ? err.message : String(err) },
            });
        }
    }
    // -------------------------------------------------------------------------
    // Event Emission
    // -------------------------------------------------------------------------
    /**
     * Emits a lifecycle event to all registered handlers.
     */
    emit(event, payload) {
        const handlers = this.eventHandlers.get(event);
        if (!handlers || handlers.size === 0)
            return;
        for (const handler of handlers) {
            try {
                const result = handler(payload);
                if (result instanceof Promise) {
                    result.catch((err) => {
                        this.logger.log({
                            level: "error",
                            message: "takeover.event_handler_error",
                            data: { event, error: err instanceof Error ? err.message : String(err) },
                        });
                    });
                }
            }
            catch (err) {
                this.logger.log({
                    level: "error",
                    message: "takeover.event_handler_error",
                    data: { event, error: err instanceof Error ? err.message : String(err) },
                });
            }
        }
    }
    /**
     * Subscribes to a lifecycle event.
     * Returns an unsubscribe function.
     */
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, new Set());
        }
        this.eventHandlers.get(event).add(handler);
        return () => {
            this.eventHandlers.get(event)?.delete(handler);
        };
    }
    // -------------------------------------------------------------------------
    // Processing Loop
    // -------------------------------------------------------------------------
    /**
     * Starts the background processing loop.
     */
    startProcessingLoop() {
        if (this.processingLoopActive)
            return;
        this.processingLoopActive = true;
        this.abortController.signal;
        const loop = async () => {
            while (this.processingLoopActive && !this.abortController.signal.aborted) {
                try {
                    let processed = 0;
                    while (processed < this.config.processingConcurrency &&
                        this.queueManager.getQueueDepth() > 0) {
                        const result = this.processNextRequest();
                        if (!result)
                            break;
                        processed++;
                    }
                    await new Promise((resolve) => setImmediate(resolve));
                }
                catch (err) {
                    this.logger.log({
                        level: "error",
                        message: "takeover.processing_loop_error",
                        data: { error: err instanceof Error ? err.message : String(err) },
                    });
                    await new Promise((resolve) => setTimeout(resolve, this.config.backoffDelayMs));
                }
            }
        };
        loop().catch((err) => {
            this.logger.log({
                level: "error",
                message: "takeover.processing_loop_crashed",
                data: { error: err instanceof Error ? err.message : String(err) },
            });
        });
        this.logger.log({ level: "info", message: "takeover.processing_loop_started" });
    }
    /**
     * Stops the background processing loop gracefully.
     */
    async stopProcessingLoop() {
        if (!this.processingLoopActive)
            return;
        this.processingLoopActive = false;
        this.abortController.abort();
        await new Promise((resolve) => setTimeout(resolve, 100));
        this.escalationManager.clearAllTimers();
        this.logger.log({ level: "info", message: "takeover.processing_loop_stopped" });
    }
    // -------------------------------------------------------------------------
    // Direct Sync Access
    // -------------------------------------------------------------------------
    /**
     * Gets the synchronous service instance for internal use.
     */
    getSyncService() {
        return this.sync;
    }
}
//# sourceMappingURL=human-takeover-service-async.js.map