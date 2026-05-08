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

import type {
  AuthoritativeSqlDatabase,
} from "../../state-evidence/truth/authoritative-sql-database.js";
import type {
  AuthoritativeTaskStore,
} from "../../state-evidence/truth/authoritative-task-store.js";
import type {
  TaskTerminalStatus,
} from "../../contracts/types/status.js";
import type {
  StepOutputRecord,
} from "../../contracts/types/domain.js";
import { nowIso, newId } from "../../contracts/types/ids.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { HumanTakeoverService, type TakeoverActionResult } from "./human-takeover-service.js";
import { TakeoverQueueManager, type TakeoverQueueConfig } from "./takeover-queue-manager.js";
import { TakeoverEscalationManager } from "./takeover-escalation-manager.js";

const require = createRequire(import.meta.url);

// ---------------------------------------------------------------------------
// Type Definitions
// ---------------------------------------------------------------------------

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
export type AsyncTakeoverActionType =
  | "open_session"
  | "modify_input"
  | "switch_worker"
  | "retry_execution"
  | "set_current_step"
  | "write_step_output"
  | "skip_current_step"
  | "complete_task"
  | "acknowledge_takeover";

/**
 * Status of a queued takeover request.
 */
export type TakeoverRequestStatus = "pending" | "processing" | "completed" | "failed" | "cancelled";

/**
 * Payload for a takeover request — varies by action type.
 */
export interface OpenSessionPayload { type: "open_session"; reasonCode: string; tenantId?: string | null }
export interface ModifyInputPayload { type: "modify_input"; sessionId: string; inputJson: string; reasonCode: string; tenantId?: string | null | undefined }
export interface SwitchWorkerPayload { type: "switch_worker"; sessionId: string; agentId: string; reasonCode: string; tenantId?: string | null | undefined }
export interface RetryExecutionPayload { type: "retry_execution"; sessionId: string; reasonCode: string; tenantId?: string | null | undefined }
export interface SetCurrentStepPayload { type: "set_current_step"; sessionId: string; reasonCode: string; stepId?: string; stepIndex?: number; tenantId?: string | null | undefined }
export interface WriteStepOutputPayload { type: "write_step_output"; sessionId: string; outputJson: string; reasonCode: string; stepId?: string; stepIndex?: number; status?: StepOutputRecord["status"]; summary?: string; tenantId?: string | null | undefined }
export interface SkipCurrentStepPayload { type: "skip_current_step"; sessionId: string; note?: string; reasonCode: string; tenantId?: string | null | undefined }
export interface CompleteTaskPayload { type: "complete_task"; sessionId: string; terminalStatus: TaskTerminalStatus; reasonCode: string; outputJson?: string; tenantId?: string | null | undefined }
export interface AcknowledgeTakeoverPayload { type: "acknowledge_takeover"; sessionId: string; operatorId: string; tenantId?: string | null | undefined }

export type TakeoverRequestPayload =
  | OpenSessionPayload
  | ModifyInputPayload
  | SwitchWorkerPayload
  | RetryExecutionPayload
  | SetCurrentStepPayload
  | WriteStepOutputPayload
  | SkipCurrentStepPayload
  | CompleteTaskPayload
  | AcknowledgeTakeoverPayload;

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
export type TakeoverLifecycleEvent =
  | "takeover:session_opened"
  | "takeover:acknowledged"
  | "takeover:completed"
  | "takeover:timeout"
  | "takeover:escalated"
  | "takeover:cancelled"
  | "takeover:request_enqueued"
  | "takeover:request_processed"
  | "takeover:ack_expired";

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
type TakeoverEventHandler<T extends TakeoverLifecycleEvent> = (
  payload: TakeoverEventPayload[T],
) => Promise<void> | void;

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

const DEFAULT_CONFIG: HumanTakeoverServiceAsyncConfig = {
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
  private readonly sync: HumanTakeoverService;
  private readonly config: HumanTakeoverServiceAsyncConfig;
  private readonly logger: StructuredLogger;

  /** Queue manager for pending takeover requests. */
  private readonly queueManager: TakeoverQueueManager;

  /** Escalation manager for timeout, acknowledgment, and escalation handling. */
  private readonly escalationManager: TakeoverEscalationManager;

  /** Event handlers keyed by event type. */
  private readonly eventHandlers: Map<TakeoverLifecycleEvent, Set<TakeoverEventHandler<TakeoverLifecycleEvent>>> = new Map();

  /** Flag indicating if the processing loop is running. */
  private processingLoopActive = false;

  /** Abort controller for graceful shutdown of the processing loop. */
  private readonly abortController: AbortController = new AbortController();

  public constructor(
    db: AuthoritativeSqlDatabase,
    store: AuthoritativeTaskStore,
    config: Partial<HumanTakeoverServiceAsyncConfig> = {},
  ) {
    const { HumanTakeoverService: SyncService } = require("./human-takeover-service.js");
    this.sync = new SyncService(db, store);
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.logger = new StructuredLogger({ retentionLimit: 100 });

    // Create event emitter wrapper for the managers
    const eventEmitter = {
      emit: <T extends TakeoverLifecycleEvent>(event: T, payload: TakeoverEventPayload[T]) => {
        this.emit(event, payload);
      },
    };

    // Initialize queue manager
    const queueConfig: TakeoverQueueConfig = {
      maxQueueDepth: this.config.maxQueueDepth,
      defaultPriority: this.config.defaultPriority,
    };
    this.queueManager = new TakeoverQueueManager(queueConfig, eventEmitter);

    // Initialize escalation manager with auto-close handler
    this.escalationManager = new TakeoverEscalationManager(
      this.config.timeoutConfig,
      eventEmitter,
      async (sessionId, taskId) => {
        await this.handleAutoClose(sessionId, taskId);
      },
    );
  }

  // -------------------------------------------------------------------------
  // Queue Management
  // -------------------------------------------------------------------------

  /**
   * Enqueues a takeover request for async processing.
   * Returns the request ID for tracking.
   */
  public enqueueTakeoverRequest(request: {
    taskId: string;
    operatorId: string;
    reasonCode: string;
    actionType: AsyncTakeoverActionType;
    payload: TakeoverRequestPayload;
    priority?: number;
  }): TakeoverRequestEntry {
    return this.queueManager.enqueue(request);
  }

  /**
   * Gets the current depth of the pending queue.
   */
  public getQueueDepth(): number {
    return this.queueManager.getQueueDepth();
  }

  /**
   * Gets all pending requests without removing them.
   */
  public getPendingRequests(): TakeoverRequestEntry[] {
    return this.queueManager.getPendingRequests();
  }

  /**
   * Cancels a pending request by requestId.
   * Returns true if the request was found and cancelled.
   */
  public cancelRequest(requestId: string): boolean {
    return this.queueManager.cancel(requestId);
  }

  // -------------------------------------------------------------------------
  // Async Action Wrappers
  // -------------------------------------------------------------------------

  /**
   * Opens a new takeover session asynchronously.
   * Enqueues the request for async processing and returns immediately.
   */
  public openSessionAsync(input: {
    taskId: string;
    operatorId: string;
    reasonCode: string;
    tenantId?: string | null;
    priority?: number;
  }): TakeoverRequestEntry {
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
  public processRequest(requestId: string): TakeoverRequestResult {
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
      } else if (entry.actionType === "complete_task") {
        const p = entry.payload as CompleteTaskPayload;
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
    } catch (error) {
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
  private dispatchToSyncService(entry: TakeoverRequestEntry): TakeoverActionResult | undefined {
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
  public processNextRequest(): TakeoverRequestResult | null {
    const next = this.queueManager.findNextPending();
    if (!next) return null;
    return this.processRequest(next.requestId);
  }

  // -------------------------------------------------------------------------
  // Escalation Management (delegated to TakeoverEscalationManager)
  // -------------------------------------------------------------------------

  /**
   * Acknowledges a takeover session — operator is now actively working.
   */
  public acknowledgeSession(sessionId: string, operatorId: string): AckResult {
    return this.escalationManager.acknowledgeSession(sessionId, operatorId, "");
  }

  /**
   * Gets the acknowledgment status for a session.
   */
  public getAcknowledgmentStatus(sessionId: string): TakeoverAckStatus | null {
    return this.escalationManager.getAcknowledgmentStatus(sessionId);
  }

  /**
   * Extends the acknowledgment deadline for an active session.
   */
  public extendAcknowledgment(sessionId: string, additionalMs?: number): AckResult {
    return this.escalationManager.extendAcknowledgment(sessionId, additionalMs);
  }

  /**
   * Handles automatic session close when max escalation is reached.
   */
  private async handleAutoClose(sessionId: string, taskId: string): Promise<void> {
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
    } catch (err) {
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
  private emit<T extends TakeoverLifecycleEvent>(event: T, payload: TakeoverEventPayload[T]): void {
    const handlers = this.eventHandlers.get(event);
    if (!handlers || handlers.size === 0) return;

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
      } catch (err) {
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
  public on<T extends TakeoverLifecycleEvent>(
    event: T,
    handler: TakeoverEventHandler<T>,
  ): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler as TakeoverEventHandler<TakeoverLifecycleEvent>);

    return () => {
      this.eventHandlers.get(event)?.delete(handler as TakeoverEventHandler<TakeoverLifecycleEvent>);
    };
  }

  // -------------------------------------------------------------------------
  // Processing Loop
  // -------------------------------------------------------------------------

  /**
   * Starts the background processing loop.
   */
  public startProcessingLoop(): void {
    if (this.processingLoopActive) return;
    this.processingLoopActive = true;
    this.abortController.signal;

    const loop = async (): Promise<void> => {
      while (this.processingLoopActive && !this.abortController.signal.aborted) {
        try {
          let processed = 0;
          while (
            processed < this.config.processingConcurrency &&
            this.queueManager.getQueueDepth() > 0
          ) {
            const result = this.processNextRequest();
            if (!result) break;
            processed++;
          }

          await new Promise((resolve) => setImmediate(resolve));
        } catch (err) {
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
  public async stopProcessingLoop(): Promise<void> {
    if (!this.processingLoopActive) return;

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
  public getSyncService(): HumanTakeoverService {
    return this.sync;
  }
}
