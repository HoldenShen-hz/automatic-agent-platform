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
  TakeoverSessionRecord,
} from "../../contracts/types/domain.js";
import type {
  ExecutionRecord,
  OperatorActionType,
  StepOutputRecord,
  TaskSnapshot,
} from "../../contracts/types/domain.js";
import { nowIso, newId } from "../../contracts/types/ids.js";
import { AppError, StorageError, WorkflowStateError } from "../../contracts/errors.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { HumanTakeoverService, type TakeoverActionResult } from "./human-takeover-service.js";

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

  /** Pending request queue ordered by priority (lower = higher priority). */
  private readonly pendingQueue: TakeoverRequestEntry[] = [];

  /** Active timeout timers keyed by sessionId. */
  private readonly activeTimeouts: Map<string, NodeJS.Timeout> = new Map();

  /** Active escalation timers keyed by sessionId. */
  private readonly escalationTimers: Map<string, NodeJS.Timeout> = new Map();

  /** Acknowledgment status tracking keyed by sessionId. */
  private readonly ackStatuses: Map<string, TakeoverAckStatus> = new Map();

  /** Escalation policies keyed by sessionId. */
  private readonly escalationPolicies: Map<string, EscalationPolicy> = new Map();

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
  }

  // -------------------------------------------------------------------------
  // Queue Management
  // -------------------------------------------------------------------------

  /**
   * Enqueues a takeover request for async processing.
   * Returns the request ID for tracking.
   *
   * @param request - The takeover request to enqueue
   * @returns The enqueued request entry with requestId
   */
  public enqueueTakeoverRequest(request: {
    taskId: string;
    operatorId: string;
    reasonCode: string;
    actionType: AsyncTakeoverActionType;
    payload: TakeoverRequestPayload;
    priority?: number;
  }): TakeoverRequestEntry {
    if (this.pendingQueue.length >= this.config.maxQueueDepth) {
      throw new StorageError(
        "takeover.queue_full",
        "Takeover request queue is full",
        { statusCode: 503, retryable: true, details: { maxQueueDepth: this.config.maxQueueDepth } },
      );
    }

    const requestId = newId("tkrq");
    const entry: TakeoverRequestEntry = {
      requestId,
      taskId: request.taskId,
      operatorId: request.operatorId,
      reasonCode: request.reasonCode,
      actionType: request.actionType,
      enqueuedAt: nowIso(),
      priority: request.priority ?? this.config.defaultPriority,
      payload: request.payload,
      status: "pending",
      attempts: 0,
    };

    // Insert sorted by priority
    const insertIndex = this.pendingQueue.findIndex((e) => e.priority > entry.priority);
    if (insertIndex === -1) {
      this.pendingQueue.push(entry);
    } else {
      this.pendingQueue.splice(insertIndex, 0, entry);
    }

    this.emit("takeover:request_enqueued", {
      requestId: entry.requestId,
      taskId: entry.taskId,
      actionType: entry.actionType,
      priority: entry.priority,
    });

    this.logger.log({
      level: "debug",
      message: "takeover.request_enqueued",
      data: { requestId, taskId: request.taskId, actionType: request.actionType },
    });

    return entry;
  }

  /**
   * Gets the current depth of the pending queue.
   */
  public getQueueDepth(): number {
    return this.pendingQueue.length;
  }

  /**
   * Gets all pending requests without removing them.
   */
  public getPendingRequests(): TakeoverRequestEntry[] {
    return [...this.pendingQueue];
  }

  /**
   * Cancels a pending request by requestId.
   * Returns true if the request was found and cancelled.
   */
  public cancelRequest(requestId: string): boolean {
    const entry = this.pendingQueue.find((e) => e.requestId === requestId);
    if (!entry || entry.status !== "pending") return false;

    entry.status = "cancelled";
    const idx = this.pendingQueue.indexOf(entry);
    if (idx !== -1) this.pendingQueue.splice(idx, 1);

    this.logger.log({
      level: "info",
      message: "takeover.request_cancelled",
      data: { requestId, taskId: entry.taskId },
    });

    return true;
  }

  // -------------------------------------------------------------------------
  // Async Action Wrappers (sync service calls wrapped in Promises)
  // -------------------------------------------------------------------------

  /**
   * Opens a new takeover session asynchronously.
   * Enqueues the request for async processing and returns immediately.
   *
   * @param input - Session open parameters
   * @returns The enqueued request entry
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
   * Called by the processing loop; can also be called directly for synchronous paths.
   */
  public processRequest(requestId: string): TakeoverRequestResult {
    const entry = this.pendingQueue.find((e) => e.requestId === requestId);
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

      // Handle post-action tracking for specific action types
      if (entry.actionType === "open_session") {
        this.startSessionTracking(result.takeoverSessionId, entry.taskId);
        this.emit("takeover:session_opened", {
          sessionId: result.takeoverSessionId,
          taskId: entry.taskId,
          operatorId: entry.operatorId,
          reasonCode: entry.reasonCode,
          enqueuedAt: entry.enqueuedAt,
        });
      } else if (entry.actionType === "complete_task") {
        const p = entry.payload as CompleteTaskPayload;
        this.stopSessionTracking(p.sessionId);
        this.emit("takeover:completed", {
          sessionId: p.sessionId,
          taskId: entry.taskId,
          terminalStatus: p.terminalStatus,
          completedAt: nowIso(),
        });
      }

      entry.status = "completed";
      const idx = this.pendingQueue.indexOf(entry);
      if (idx !== -1) this.pendingQueue.splice(idx, 1);

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
        const idx = this.pendingQueue.indexOf(entry);
        if (idx !== -1) this.pendingQueue.splice(idx, 1);
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
        // Acknowledgment is handled by the async service
        this.acknowledgeSession(p.sessionId, p.operatorId);
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
   * Returns null if queue is empty.
   */
  public processNextRequest(): TakeoverRequestResult | null {
    const next = this.pendingQueue.find((e) => e.status === "pending");
    if (!next) return null;
    return this.processRequest(next.requestId);
  }

  // -------------------------------------------------------------------------
  // Timeout and Escalation Management
  // -------------------------------------------------------------------------

  /**
   * Starts timeout and escalation tracking for a newly opened session.
   */
  private startSessionTracking(sessionId: string, taskId: string): void {
    // Set up session timeout
    this.startTimeoutTimer(sessionId, taskId, this.config.timeoutConfig.defaultTimeoutMs);

    // Set up escalation tracking
    this.initializeEscalationPolicy(sessionId, taskId);
  }

  /**
   * Stops all tracking (timeout and escalation) for a session.
   */
  private stopSessionTracking(sessionId: string): void {
    const timeout = this.activeTimeouts.get(sessionId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeTimeouts.delete(sessionId);
    }

    const escalation = this.escalationTimers.get(sessionId);
    if (escalation) {
      clearTimeout(escalation);
      this.escalationTimers.delete(sessionId);
    }

    this.ackStatuses.delete(sessionId);
    this.escalationPolicies.delete(sessionId);
  }

  /**
   * Starts a timeout timer for a takeover session.
   * If the timeout expires before acknowledgment, the session is escalated.
   */
  private startTimeoutTimer(sessionId: string, taskId: string, durationMs: number): void {
    // Clear any existing timer
    const existing = this.activeTimeouts.get(sessionId);
    if (existing) clearTimeout(existing);

    const timeout = setTimeout(() => {
      this.handleSessionTimeout(sessionId, taskId);
    }, durationMs);

    this.activeTimeouts.set(sessionId, timeout);

    this.logger.log({
      level: "debug",
      message: "takeover.timeout_started",
      data: { sessionId, taskId, durationMs },
    });
  }

  /**
   * Handles session timeout — escalates or auto-expires.
   */
  private handleSessionTimeout(sessionId: string, taskId: string): void {
    this.activeTimeouts.delete(sessionId);

    const ackStatus = this.ackStatuses.get(sessionId);
    const isAcknowledged = ackStatus?.status === "acknowledged";

    if (!isAcknowledged) {
      // Session timed out without acknowledgment — escalate
      this.emit("takeover:timeout", {
        sessionId,
        taskId,
        reason: "Session expired without operator acknowledgment",
        timedOutAt: nowIso(),
      });

      // Auto-escalate
      this.escalateSession(sessionId, taskId, "timeout").catch((err) => {
        this.logger.log({
          level: "error",
          message: "takeover.escalation_failed",
          data: { sessionId, error: err instanceof Error ? err.message : String(err) },
        });
      });
    }
  }

  /**
   * Initializes escalation policy for a new session.
   */
  private initializeEscalationPolicy(sessionId: string, taskId: string): void {
    const policy: EscalationPolicy = {
      sessionId,
      currentLevel: "operator",
      escalationHistory: [],
      nextEscalationAt: null,
    };

    this.escalationPolicies.set(sessionId, policy);

    // Set up the first escalation check
    this.scheduleEscalationCheck(sessionId, taskId);

    this.logger.log({
      level: "debug",
      message: "takeover.escalation_initialized",
      data: { sessionId, initialLevel: "operator" },
    });
  }

  /**
   * Schedules the next escalation check.
   */
  private scheduleEscalationCheck(sessionId: string, taskId: string): void {
    const existing = this.escalationTimers.get(sessionId);
    if (existing) clearTimeout(existing);

    const timer = setTimeout(async () => {
      await this.checkEscalation(sessionId, taskId);
    }, this.config.timeoutConfig.escalationCheckIntervalMs);

    this.escalationTimers.set(sessionId, timer);
  }

  /**
   * Checks if a session needs escalation and performs it if so.
   */
  private async checkEscalation(sessionId: string, taskId: string): Promise<void> {
    const policy = this.escalationPolicies.get(sessionId);
    if (!policy) return;

    const ackStatus = this.ackStatuses.get(sessionId);
    const now = new Date();

    // Check if acknowledgment has expired
    if (ackStatus?.expiresAt && new Date(ackStatus.expiresAt) <= now) {
      ackStatus.status = "expired";
      this.emit("takeover:ack_expired", {
        sessionId,
        taskId,
        expiredAt: nowIso(),
      });
    }

    // Determine if escalation is needed based on current level and time
    if (ackStatus?.status === "pending" || ackStatus?.status === "expired") {
      await this.escalateSession(sessionId, taskId, "no_acknowledgment");
    } else {
      // Reschedule if session is still active
      this.scheduleEscalationCheck(sessionId, taskId);
    }
  }

  /**
   * Escalates a takeover session to the next level.
   */
  private async escalateSession(
    sessionId: string,
    taskId: string,
    reason: string,
  ): Promise<void> {
    const policy = this.escalationPolicies.get(sessionId);
    if (!policy) return;

    const previousLevel = policy.currentLevel;
    const nextLevel = this.getNextEscalationLevel(previousLevel);

    policy.escalationHistory.push({
      level: nextLevel,
      reason,
      timestamp: nowIso(),
      target: null,
    });
    policy.currentLevel = nextLevel;

    // Determine next escalation time based on level
    const escalationDelayMs = this.getEscalationDelayForLevel(nextLevel);
    if (escalationDelayMs > 0) {
      policy.nextEscalationAt = new Date(Date.now() + escalationDelayMs).toISOString();
    } else {
      policy.nextEscalationAt = null;
    }

    this.emit("takeover:escalated", {
      sessionId,
      taskId,
      fromLevel: previousLevel,
      toLevel: nextLevel,
      reason,
      escalatedAt: nowIso(),
    });

    this.logger.log({
      level: "warn",
      message: "takeover.session_escalated",
      data: { sessionId, taskId, fromLevel: previousLevel, toLevel: nextLevel, reason },
    });

    // If not terminal level, schedule next check
    if (nextLevel !== "auto_close") {
      this.scheduleEscalationCheck(sessionId, taskId);
    } else {
      // Auto-close: complete the session
      await this.handleAutoClose(sessionId, taskId);
    }
  }

  /**
   * Gets the next escalation level given the current level.
   */
  private getNextEscalationLevel(current: EscalationLevel): EscalationLevel {
    switch (current) {
      case "operator": return "supervisor";
      case "supervisor": return "admin";
      case "admin": return "auto_close";
      case "auto_close": return "auto_close";
    }
  }

  /**
   * Gets the escalation delay in ms for a given level.
   */
  private getEscalationDelayForLevel(level: EscalationLevel): number {
    switch (level) {
      case "operator": return this.config.timeoutConfig.defaultTimeoutMs;
      case "supervisor": return this.config.timeoutConfig.defaultTimeoutMs * 2;
      case "admin": return this.config.timeoutConfig.defaultTimeoutMs * 4;
      case "auto_close": return 0;
    }
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

      this.stopSessionTracking(sessionId);
    } catch (err) {
      this.logger.log({
        level: "error",
        message: "takeover.auto_close_failed",
        data: { sessionId, error: err instanceof Error ? err.message : String(err) },
      });
    }
  }

  // -------------------------------------------------------------------------
  // Acknowledgment Management
  // -------------------------------------------------------------------------

  /**
   * Acknowledges a takeover session — operator is now actively working.
   */
  public acknowledgeSession(sessionId: string, operatorId: string): AckResult {
    const existing = this.ackStatuses.get(sessionId);
    const previousStatus = existing?.status ?? "pending";
    const now = nowIso();
    const expiresAt = new Date(Date.now() + this.config.timeoutConfig.acknowledgmentTimeoutMs).toISOString();

    const ackStatus: TakeoverAckStatus = {
      sessionId,
      acknowledgedAt: now,
      expiresAt,
      status: "acknowledged",
      acknowledgedBy: operatorId,
    };

    this.ackStatuses.set(sessionId, ackStatus);

    // Extend the session timeout
    this.startTimeoutTimer(sessionId, "", this.config.timeoutConfig.acknowledgmentTimeoutMs);

    const policy = this.escalationPolicies.get(sessionId);
    if (policy) {
      policy.escalationHistory.push({
        level: policy.currentLevel,
        reason: "acknowledged",
        timestamp: now,
        target: operatorId,
      });
    }

    this.emit("takeover:acknowledged", {
      sessionId,
      taskId: "", // TaskId resolved from session lookup if needed
      operatorId,
      acknowledgedAt: now,
      expiresAt,
    });

    this.logger.log({
      level: "info",
      message: "takeover.session_acknowledged",
      data: { sessionId, operatorId, expiresAt },
    });

    return { sessionId, acknowledged: true, acknowledgedAt: now, expiresAt, previousStatus };
  }

  /**
   * Gets the acknowledgment status for a session.
   */
  public getAcknowledgmentStatus(sessionId: string): TakeoverAckStatus | null {
    const status = this.ackStatuses.get(sessionId);

    // Check if the acknowledgment has expired
    if (status?.status === "acknowledged" && status.expiresAt) {
      if (new Date(status.expiresAt) <= new Date()) {
        return { ...status, status: "expired" };
      }
    }

    return status ?? null;
  }

  /**
   * Extends the acknowledgment deadline for an active session.
   */
  public extendAcknowledgment(sessionId: string, additionalMs?: number): AckResult {
    const status = this.ackStatuses.get(sessionId);
    if (!status || status.status !== "acknowledged") {
      throw new WorkflowStateError(
        "takeover.ack_not_found",
        "Acknowledgment not found or not active",
        { details: { sessionId, status: status?.status ?? "not_found" } },
      );
    }

    const extensionMs = additionalMs ?? this.config.timeoutConfig.acknowledgmentTimeoutMs;
    const newExpiresAt = new Date(Date.now() + extensionMs).toISOString();
    status.expiresAt = newExpiresAt;

    // Restart the timeout timer
    this.startTimeoutTimer(sessionId, "", extensionMs);

    this.logger.log({
      level: "info",
      message: "takeover.ack_extended",
      data: { sessionId, newExpiresAt },
    });

    return {
      sessionId,
      acknowledged: true,
      acknowledgedAt: status.acknowledgedAt ?? nowIso(),
      expiresAt: newExpiresAt,
      previousStatus: status.status,
    };
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
   * Processes pending requests with the configured concurrency.
   */
  public startProcessingLoop(): void {
    if (this.processingLoopActive) return;
    this.processingLoopActive = true;
    this.abortController.signal;

    const loop = async (): Promise<void> => {
      while (this.processingLoopActive && !this.abortController.signal.aborted) {
        try {
          // Process up to concurrency requests per tick
          let processed = 0;
          while (
            processed < this.config.processingConcurrency &&
            this.pendingQueue.some((e) => e.status === "pending")
          ) {
            const result = this.processNextRequest();
            if (!result) break;
            processed++;
          }

          // Yield to the event loop
          await new Promise((resolve) => setImmediate(resolve));
        } catch (err) {
          this.logger.log({
            level: "error",
            message: "takeover.processing_loop_error",
            data: { error: err instanceof Error ? err.message : String(err) },
          });

          // Back off on error
          await new Promise((resolve) => setTimeout(resolve, this.config.backoffDelayMs));
        }
      }
    };

    // Start the loop asynchronously
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

    // Wait for current processing to complete (with timeout)
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Clear all timers
    for (const timeout of this.activeTimeouts.values()) {
      clearTimeout(timeout);
    }
    for (const timer of this.escalationTimers.values()) {
      clearTimeout(timer);
    }

    this.logger.log({ level: "info", message: "takeover.processing_loop_stopped" });
  }

  // -------------------------------------------------------------------------
  // Direct Sync Access (delegated to underlying sync service)
  // -------------------------------------------------------------------------

  /**
   * Gets the synchronous service instance for internal use.
   * @internal
   */
  public getSyncService(): HumanTakeoverService {
    return this.sync;
  }
}
