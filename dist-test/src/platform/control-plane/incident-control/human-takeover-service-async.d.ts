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
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { TaskTerminalStatus } from "../../contracts/types/status.js";
import type { StepOutputRecord } from "../../contracts/types/domain.js";
import { HumanTakeoverService, type TakeoverActionResult } from "./human-takeover-service.js";
/**
 * Takeover request entry for the async processing queue.
 * Each entry represents an enqueued takeover action to be processed asynchronously.
 */
export interface TakeoverRequestEntry {
    requestId: string;
    taskId: string;
    operatorId: string;
    reasonCode: string;
    actionType: AsyncTakeoverActionType;
    enqueuedAt: string;
    priority: number;
    payload: TakeoverRequestPayload;
    status: TakeoverRequestStatus;
    attempts: number;
    lastError?: string;
}
/**
 * Async-specific action types that map to sync HumanTakeoverService actions.
 */
export type AsyncTakeoverActionType = "open_session" | "modify_input" | "switch_worker" | "retry_execution" | "set_current_step" | "write_step_output" | "skip_current_step" | "complete_task" | "acknowledge_takeover";
/**
 * Status of a queued takeover request.
 */
export type TakeoverRequestStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";
/**
 * Payload for a takeover request — varies by action type.
 */
export interface OpenSessionPayload {
    type: "open_session";
    reasonCode: string;
    tenantId?: string | null;
}
export interface ModifyInputPayload {
    type: "modify_input";
    sessionId: string;
    inputJson: string;
    reasonCode: string;
    tenantId?: string | null | undefined;
}
export interface SwitchWorkerPayload {
    type: "switch_worker";
    sessionId: string;
    agentId: string;
    reasonCode: string;
    tenantId?: string | null | undefined;
}
export interface RetryExecutionPayload {
    type: "retry_execution";
    sessionId: string;
    reasonCode: string;
    tenantId?: string | null | undefined;
}
export interface SetCurrentStepPayload {
    type: "set_current_step";
    sessionId: string;
    reasonCode: string;
    stepId?: string;
    stepIndex?: number;
    tenantId?: string | null | undefined;
}
export interface WriteStepOutputPayload {
    type: "write_step_output";
    sessionId: string;
    outputJson: string;
    reasonCode: string;
    stepId?: string;
    stepIndex?: number;
    status?: StepOutputRecord["status"];
    summary?: string;
    tenantId?: string | null | undefined;
}
export interface SkipCurrentStepPayload {
    type: "skip_current_step";
    sessionId: string;
    note?: string;
    reasonCode: string;
    tenantId?: string | null | undefined;
}
export interface CompleteTaskPayload {
    type: "complete_task";
    sessionId: string;
    terminalStatus: TaskTerminalStatus;
    reasonCode: string;
    outputJson?: string;
    tenantId?: string | null | undefined;
}
export interface AcknowledgeTakeoverPayload {
    type: "acknowledge_takeover";
    sessionId: string;
    operatorId: string;
    tenantId?: string | null | undefined;
}
export type TakeoverRequestPayload = OpenSessionPayload | ModifyInputPayload | SwitchWorkerPayload | RetryExecutionPayload | SetCurrentStepPayload | WriteStepOutputPayload | SkipCurrentStepPayload | CompleteTaskPayload | AcknowledgeTakeoverPayload;
/**
 * Result of processing a queued takeover request.
 */
export interface TakeoverRequestResult {
    requestId: string;
    success: boolean;
    actionResult?: TakeoverActionResult;
    processedAt: string;
    error?: string;
}
/**
 * Acknowledgment status for a takeover session.
 */
export interface TakeoverAckStatus {
    sessionId: string;
    acknowledgedAt: string | null;
    expiresAt: string | null;
    status: "pending" | "acknowledged" | "expired";
    acknowledgedBy: string | null;
}
/**
 * Configuration for timeout behavior.
 */
export interface TakeoverTimeoutConfig {
    defaultTimeoutMs: number;
    acknowledgmentTimeoutMs: number;
    escalationCheckIntervalMs: number;
    maxRetries: number;
}
/**
 * Escalation policy for a takeover session.
 */
export interface EscalationPolicy {
    sessionId: string;
    currentLevel: EscalationLevel;
    escalationHistory: EscalationEvent[];
    nextEscalationAt: string | null;
}
/**
 * Escalation level for operator intervention.
 */
export type EscalationLevel = "operator" | "supervisor" | "admin" | "auto_close";
/**
 * An escalation event in history.
 */
export interface EscalationEvent {
    level: EscalationLevel;
    reason: string;
    timestamp: string;
    target: string | null;
}
/**
 * Lifecycle event types emitted by the async service.
 */
export type TakeoverLifecycleEvent = "takeover:session_opened" | "takeover:acknowledged" | "takeover:completed" | "takeover:timeout" | "takeover:escalated" | "takeover:cancelled" | "takeover:request_enqueued" | "takeover:request_processed" | "takeover:ack_expired";
/**
 * Event payload map keyed by lifecycle event type.
 */
export type TakeoverEventPayload = {
    "takeover:session_opened": {
        sessionId: string;
        taskId: string;
        operatorId: string;
        reasonCode: string;
        enqueuedAt: string;
    };
    "takeover:acknowledged": {
        sessionId: string;
        taskId: string;
        operatorId: string;
        acknowledgedAt: string;
        expiresAt: string;
    };
    "takeover:completed": {
        sessionId: string;
        taskId: string;
        terminalStatus: TaskTerminalStatus;
        completedAt: string;
    };
    "takeover:timeout": {
        sessionId: string;
        taskId: string;
        reason: string;
        timedOutAt: string;
    };
    "takeover:escalated": {
        sessionId: string;
        taskId: string;
        fromLevel: EscalationLevel;
        toLevel: EscalationLevel;
        reason: string;
        escalatedAt: string;
    };
    "takeover:cancelled": {
        sessionId: string;
        taskId: string;
        reason: string;
        cancelledAt: string;
    };
    "takeover:request_enqueued": {
        requestId: string;
        taskId: string;
        actionType: AsyncTakeoverActionType;
        priority: number;
    };
    "takeover:request_processed": {
        requestId: string;
        taskId: string;
        actionType: AsyncTakeoverActionType;
        success: boolean;
        error?: string;
    };
    "takeover:ack_expired": {
        sessionId: string;
        taskId: string;
        expiredAt: string;
    };
};
/**
 * Handler signature for lifecycle event subscribers.
 */
type TakeoverEventHandler<T extends TakeoverLifecycleEvent> = (payload: TakeoverEventPayload[T]) => Promise<void> | void;
/**
 * Result of an acknowledgment operation.
 */
export interface AckResult {
    sessionId: string;
    acknowledged: boolean;
    acknowledgedAt: string;
    expiresAt: string;
    previousStatus: TakeoverAckStatus["status"];
}
/**
 * Configuration for the async takeover service.
 */
export interface HumanTakeoverServiceAsyncConfig {
    timeoutConfig: TakeoverTimeoutConfig;
    maxQueueDepth: number;
    processingConcurrency: number;
    defaultPriority: number;
    backoffDelayMs: number;
}
/**
 * Async Human Takeover Service
 *
 * Provides async-first human takeover capabilities with queue-based processing,
 * timeout management, escalation handling, and typed event emission.
 *
 * This service is the async counterpart to HumanTakeoverService, designed
 * for contexts where async/await is preferred and background processing is needed.
 */
export declare class HumanTakeoverServiceAsync {
    private readonly sync;
    private readonly config;
    private readonly logger;
    /** Queue manager for pending takeover requests. */
    private readonly queueManager;
    /** Escalation manager for timeout, acknowledgment, and escalation handling. */
    private readonly escalationManager;
    /** Event handlers keyed by event type. */
    private readonly eventHandlers;
    /** Flag indicating if the processing loop is running. */
    private processingLoopActive;
    /** Abort controller for graceful shutdown of the processing loop. */
    private readonly abortController;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, config?: Partial<HumanTakeoverServiceAsyncConfig>);
    /**
     * Enqueues a takeover request for async processing.
     * Returns the request ID for tracking.
     */
    enqueueTakeoverRequest(request: {
        taskId: string;
        operatorId: string;
        reasonCode: string;
        actionType: AsyncTakeoverActionType;
        payload: TakeoverRequestPayload;
        priority?: number;
    }): TakeoverRequestEntry;
    /**
     * Gets the current depth of the pending queue.
     */
    getQueueDepth(): number;
    /**
     * Gets all pending requests without removing them.
     */
    getPendingRequests(): TakeoverRequestEntry[];
    /**
     * Cancels a pending request by requestId.
     * Returns true if the request was found and cancelled.
     */
    cancelRequest(requestId: string): boolean;
    /**
     * Opens a new takeover session asynchronously.
     * Enqueues the request for async processing and returns immediately.
     */
    openSessionAsync(input: {
        taskId: string;
        operatorId: string;
        reasonCode: string;
        tenantId?: string | null;
        priority?: number;
    }): TakeoverRequestEntry;
    /**
     * Processes a single takeover request synchronously.
     */
    processRequest(requestId: string): TakeoverRequestResult;
    /**
     * Dispatches a queued entry to the appropriate sync service method.
     */
    private dispatchToSyncService;
    /**
     * Processes the next pending request from the queue.
     */
    processNextRequest(): TakeoverRequestResult | null;
    /**
     * Acknowledges a takeover session — operator is now actively working.
     */
    acknowledgeSession(sessionId: string, operatorId: string): AckResult;
    /**
     * Gets the acknowledgment status for a session.
     */
    getAcknowledgmentStatus(sessionId: string): TakeoverAckStatus | null;
    /**
     * Extends the acknowledgment deadline for an active session.
     */
    extendAcknowledgment(sessionId: string, additionalMs?: number): AckResult;
    /**
     * Handles automatic session close when max escalation is reached.
     */
    private handleAutoClose;
    /**
     * Emits a lifecycle event to all registered handlers.
     */
    private emit;
    /**
     * Subscribes to a lifecycle event.
     * Returns an unsubscribe function.
     */
    on<T extends TakeoverLifecycleEvent>(event: T, handler: TakeoverEventHandler<T>): () => void;
    /**
     * Starts the background processing loop.
     */
    startProcessingLoop(): void;
    /**
     * Stops the background processing loop gracefully.
     */
    stopProcessingLoop(): Promise<void>;
    /**
     * Gets the synchronous service instance for internal use.
     */
    getSyncService(): HumanTakeoverService;
}
export {};
