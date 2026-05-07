/**
 * @fileoverview Transition Service - Enforces valid state transitions for LEGACY entities.
 *
 * ════════════════════════════════════════════════════════════════════════════════════
 * IMPORTANT: Architectural Coexistence Notice (INV-STATE-001)
 * ════════════════════════════════════════════════════════════════════════════════════
 *
 * This service handles LEGACY entity types ONLY:
 *   - Task, Workflow, Session, Execution, Approval
 *
 * These legacy types are being migrated to the new five-plane model with canonical types:
 *   - HarnessRun (replaces Task)
 *   - NodeRun (replaces Execution)
 *   - SideEffectRecord
 *   - BudgetLedger
 *   - BudgetReservation
 *
 * The canonical path for new entities is:
 *   RuntimeStateMachine → RuntimeTruthRepository → PlatformFactEvent
 *
 * INV-STATE-001 BYPASS RISK:
 *   TransitionService uses RuntimeLifecycleRepository (not RuntimeTruthRepository)
 *   and creates EventRecord objects (not PlatformFactEvent).
 *   This bypasses the inv-state-001 enforcement required for canonical entities.
 *
 * USE RuntimeStateMachine FOR:
 *   - HarnessRun, NodeRun, SideEffectRecord, BudgetLedger, BudgetReservation
 *   - Any entity with harnessRunId or nodeRunId
 *
 * USE TransitionService ONLY FOR:
 *   - Legacy Task/Workflow/Session/Execution/Approval entities
 *   - Entities that have NOT yet been migrated to the five-plane model
 *
 * ════════════════════════════════════════════════════════════════════════════════════
 *
 * Provides a centralized service for validating and applying state transitions across
 * tasks, workflows, sessions, executions, and approvals. Every transition is audited
 * with trace context and emits tier-1 events for reliable delivery.
 *
 * Each entity type has its own StateTransitionMachine that validates transitions against
 * an allowed-transition map before applying. Invalid transitions throw WorkflowStateError.
 *
 * Key responsibilities:
 * - Validate state transitions against allowed-transition maps
 * - Update entity records in the repository
 * - Emit status change events for observability
 * - Handle terminal transitions that cascade across multiple entities
 * - Block execution for approval requests
 *
 * @see RuntimeStateMachine: runtime-state-machine.ts (canonical path for new entities)
 * @see RuntimeTruthRepository: five-plane-state-evidence/truth/runtime-truth-repository.ts
 * @see Transition Service Contract: docs_zh/contracts/transition_service_contract.md
 * @see INV-STATE-001: docs_zh/adr/xxx-inv-state-001.md (invariant enforcement)
 */

import type {
  ApprovalStatus,
  ExecutionStatus,
  SessionStatus,
  TaskStatus,
  TaskTerminalStatus,
  WorkflowStatus,
} from "../../contracts/types/status.js";
import type {
  ApprovalRecord,
  ApprovalStatusTransitionCommand,
  ExecutionStatusTransitionCommand,
  SessionStatusTransitionCommand,
  TaskStatusTransitionCommand,
  TransitionAuditContext,
  TransitionCommand,
  TransitionEntityKind,
  WorkflowStatusTransitionCommand,
} from "../../contracts/types/domain.js";

import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import {
  createRuntimeLifecycleRepository,
  type RuntimeLifecycleRepository,
} from "../../state-evidence/truth/repositories/runtime-lifecycle-repository.js";
import { injectTraceContext, toAuditContextTraceContext } from "../../shared/observability/trace-context.js";
import { newId } from "../../contracts/types/ids.js";
import { StateTransitionMachine } from "./state-transition-machine.js";
import {
  RuntimeStateMachine,
  type LegacyRuntimeEntityKind,
} from "../../five-plane-execution/runtime-state-machine.js";
import { createPlatformFactEvent, type JsonValue } from "../../contracts/executable-contracts/index.js";
import { assertLeaderAuthoritative } from "../ha/ha-coordinator-service-inner.js";

/**
 * Canonical entity type prefixes used by RuntimeStateMachine.
 * These entity IDs should NEVER be passed to TransitionService - they require
 * PlatformFactEvent and RuntimeTruthRepository (INV-STATE-001).
 */
const CANONICAL_ENTITY_PREFIXES = ["hrn_", "ndr_", "ser_", "bdl_", "bdr_"] as const;
const legacyRuntimeStateMachine = new RuntimeStateMachine();

/**
 * Error thrown when attempting to transition a canonical five-plane entity
 * through the legacy TransitionService (INV-STATE-001 bypass).
 */
export class InvState001BypassError extends Error {
  public constructor(entityId: string, entityType: string) {
    super(
      `INV-STATE-001 BYPASS DETECTED: Entity "${entityId}" appears to be a canonical ` +
        `five-plane entity (type: ${entityType}) that must use RuntimeStateMachine ` +
        `and RuntimeTruthRepository. TransitionService is for legacy entities only. ` +
        `Do not use TransitionService for HarnessRun, NodeRun, SideEffectRecord, ` +
        `BudgetLedger, or BudgetReservation.`,
    );
    this.name = "InvState001BypassError";
  }
}

/**
 * Validates that an entity ID does not represent a canonical five-plane entity.
 * Throws InvState001BypassError if the entity appears to be a HarnessRun, NodeRun,
 * SideEffectRecord, BudgetLedger, or BudgetReservation.
 *
 * This enforces INV-STATE-001: canonical entities must use RuntimeStateMachine
 * and emit PlatformFactEvent, not EventRecord via TransitionService.
 *
 * @param entityId - The entity ID to validate
 * @param entityType - The entity type being transitioned (for error messages)
 * @throws InvState001BypassError if the entity appears to be a canonical five-plane entity
 */
function assertNotCanonicalEntity(entityId: string, entityType: string): void {
  // Check for known canonical entity ID prefixes
  for (const prefix of CANONICAL_ENTITY_PREFIXES) {
    if (entityId.startsWith(prefix)) {
      throw new InvState001BypassError(entityId, entityType);
    }
  }

  // R4-15 (INV-STATE-001): TransitionService bypasses RuntimeStateMachine for legacy entities.
  // This is INTENTIONAL for legacy Task/Workflow/Session/Execution/Approval types.
  // However, UUID-formatted entity IDs from canonical five-plane entities (HarnessRun, NodeRun, etc.)
  // should NEVER be passed here - they must use RuntimeStateMachine. The code below detects this
  // and throws InvState001BypassError.
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (entityType !== "approval" && uuidPattern.test(entityId)) {
    throw new InvState001BypassError(entityId, entityType);
  }
}

/**
 * Allowed task status transitions.
 *
 * Tasks flow through a linear progression: queued -> pending -> in_progress,
 * then branch to done, failed, cancelled, or await_decision (for human approval).
 * Once in a terminal state (done, failed, cancelled), no further transitions are allowed.
 */
const TASK_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  queued: ["pending", "in_progress", "cancelled"],
  pending: ["in_progress", "cancelled"],
  in_progress: ["awaiting_decision", "done", "failed", "cancelled"],
  awaiting_decision: ["in_progress", "failed", "cancelled"],
  done: [],
  failed: [],
  cancelled: [],
};

/**
 * Allowed workflow status transitions.
 *
 * Workflows represent multi-step execution plans. They support pausing and resuming,
 * and can transition to cancelling (a transient state) before reaching cancelled.
 * The terminal states (completed, failed, cancelled) allow no further transitions.
 */
const WORKFLOW_TRANSITIONS: Record<WorkflowStatus, readonly WorkflowStatus[]> = {
  running: ["paused", "completed", "failed", "cancelling", "cancelled"],
  paused: ["resuming", "failed", "cancelled"],
  resuming: ["running", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelling: ["cancelled"],
  cancelled: [],
};

/**
 * Allowed session status transitions.
 *
 * Sessions track the interaction context between agent and user. They can pause
 * (e.g., when waiting for user input) and resume. The "open" state is the initial
 * state; sessions can return to open for recovery scenarios.
 * R37-2149: Added "paused" as inbound transition target from "streaming" state.
 */
const SESSION_TRANSITIONS: Record<SessionStatus, readonly SessionStatus[]> = {
  open: ["streaming", "awaiting_user", "completed", "failed", "cancelled"],
  streaming: ["awaiting_user", "completed", "failed", "cancelled", "open", "paused"],
  awaiting_user: ["streaming", "completed", "failed", "cancelled"],
  paused: ["streaming", "open", "completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

/**
 * Allowed execution status transitions.
 *
 * Executions are individual attempts to perform work. They go through prechecking
 * (validation), executing (actual work), and can become blocked (awaiting approval),
 * succeeded, failed, cancelled, or superseded (by a newer execution).
 */
const EXECUTION_TRANSITIONS: Record<ExecutionStatus, readonly ExecutionStatus[]> = {
  created: ["queued", "prechecking", "executing", "dispatching", "ready", "cancelled", "failed"],
  queued: ["dispatching", "prechecking", "executing", "cancelled", "failed"],
  dispatching: ["prechecking", "executing", "paused", "recovering", "cancelled", "failed"],
  prechecking: ["executing", "blocked", "paused", "recovering", "cancelled", "failed"],
  executing: ["blocked", "succeeded", "failed", "cancelled", "paused", "recovering"],
  paused: ["resuming", "recovering", "timed_out", "failed", "cancelled"],
  resuming: ["executing", "failed", "cancelled"],
  ready: ["executing", "failed", "cancelled"],
  recovering: ["ready", "executing", "failed", "cancelled", "timed_out"],
  timed_out: ["resuming", "failed", "cancelled"],
  blocked: ["prechecking", "executing", "cancelled", "failed", "superseded"],
  succeeded: [],
  failed: [],
  cancelled: [],
  superseded: [],
};

/**
 * Allowed approval status transitions.
 *
 * Approvals track human authorization decisions. A request can be approved, rejected,
 * expired (timeout), or cancelled. Once in a terminal state, no further transitions apply.
 */
const APPROVAL_TRANSITIONS: Record<ApprovalStatus, readonly ApprovalStatus[]> = {
  requested: ["approved", "rejected", "expired", "cancelled"],
  approved: [],
  rejected: [],
  expired: [],
  cancelled: [],
};

/**
 * State machines for each entity type.
 * Each machine validates transitions against its allowed-transition map.
 */
const taskStateMachine = new StateTransitionMachine("task", TASK_TRANSITIONS);
const workflowStateMachine = new StateTransitionMachine("workflow", WORKFLOW_TRANSITIONS);
const sessionStateMachine = new StateTransitionMachine("session", SESSION_TRANSITIONS);
const executionStateMachine = new StateTransitionMachine("execution", EXECUTION_TRANSITIONS);
const approvalStateMachine = new StateTransitionMachine("approval", APPROVAL_TRANSITIONS);

/**
 * Defines an approval request when execution is blocked pending human decision.
 *
 * When a task requires human approval (e.g., for sensitive tool execution),
 * this definition captures the request details: source agent, reason, risk level,
 * available approval options, and timeout policy.
 */
export interface BlockedApprovalRequestDefinition {
  approvalId?: string | undefined;
  sourceAgentId: string;
  reason: string;
  riskLevel: "low" | "medium" | "high" | "critical";
  options: readonly string[];
  context: Record<string, unknown>;
  timeoutPolicy: "reject" | "approve" | "remain_pending";
  createdAt?: string | undefined;
}

/**
 * Command to transition multiple entities to blocked/awaiting-approval state.
 *
 * When an execution requires human approval, all related entities (task, workflow,
 * session, execution) must be transitioned to their "blocked" states atomically.
 * This command captures the current state of each entity to validate transitions.
 */
export interface BlockedForApprovalTransitionCommand {
  taskId: string;
  sessionId: string;
  executionId: string;
  currentTaskStatus: TaskStatus;
  currentWorkflowStatus: WorkflowStatus;
  currentSessionStatus: SessionStatus;
  currentExecutionStatus: ExecutionStatus;
  workflowCurrentStepIndex: number;
  workflowOutputsJson: string;
  approval: BlockedApprovalRequestDefinition;
  context: TransitionAuditContext;
}

/** Result of blocking an execution for approval - returns the created approval ID and timestamp. */
export interface BlockedForApprovalTransitionResult {
  approvalId: string;
  createdAt: string;
}

/**
 * Input for transitioning a task and its related entities to a terminal state.
 *
 * When a task reaches a terminal state (done, failed, cancelled), all related
 * entities (workflow, session, execution) must also transition to their
 * corresponding terminal states atomically. This input captures the current
 * state of each entity for validation.
 *
 * R9-02: The current*Status fields are provided by the caller but MUST be
 * re-validated against fresh database state before use in CAS operations.
 * Use the version/fencing fields (expectedTaskUpdatedAt, expectedWorkflowStepIndex,
 * expectedSessionUpdatedAt, expectedExecutionUpdatedAt) for CAS to prevent
 * TOCTOU race conditions per §25.3.
 */
type TaskTerminalTransitionInput = {
  taskId: string;
  sessionId: string;
  executionId: string;
  currentTaskStatus: TaskStatus;
  currentWorkflowStatus: WorkflowStatus;
  currentSessionStatus: SessionStatus;
  currentExecutionStatus: ExecutionStatus;
  terminalStatus: TaskTerminalStatus;
  taskOutputJson: string;
  outputsJson: string;
  context: TransitionAuditContext;
  /** R9-02: Fencing token for task - used as CAS expected value */
  expectedTaskUpdatedAt?: string;
  /** R9-02: Fencing token for workflow - current_step_index used as CAS expected value */
  expectedWorkflowStepIndex?: number;
  /** R9-02: Fencing token for session - used as CAS expected value */
  expectedSessionUpdatedAt?: string;
  /** R9-02: Fencing token for execution - used as CAS expected value */
  expectedExecutionUpdatedAt?: string;
};

/**
 * Service for transitioning task status.
 *
 * LEGACY ENTITY TYPE: Task
 *
 * This service handles legacy Task entities. The canonical path for new entities
 * is RuntimeStateMachine → RuntimeTruthRepository → PlatformFactEvent.
 *
 * INV-STATE-001 ENFORCEMENT: TaskTransitionService.apply() will throw
 * InvState001BypassError if invoked with a canonical five-plane entity ID
 * (e.g., harnessRunId, nodeRunId patterns).
 *
 * Applies task status changes within a database transaction, validates the
 * transition against the task state machine, and emits a tier-1 status change event.
 *
 * §205-2420: transition() accepts TaskStatusTransitionCommand per legacy domain model.
 * For unified RuntimeTransitionCommand handling, use RuntimeStateMachine instead.
 */
export class TaskTransitionService {
  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly repository: RuntimeLifecycleRepository,
  ) {}

  /**
   * Transitions task status within a database transaction.
   * Ensures atomic update and event emission.
   *
   * @deprecated Use RuntimeStateMachine with RuntimeTransitionCommand instead.
   * This method exists for backward compatibility; new code should use the
   * canonical runtime transition path.
   */
  public transition(command: TaskStatusTransitionCommand): void {
    // INV-STATE-001: Validate this is not a canonical five-plane entity
    assertNotCanonicalEntity(command.entityId, "task");
    this.db.transaction(() => {
      this.apply(command);
    });
  }

  /**
   * Applies a task status transition.
   *
   * Validates the transition against the task state machine, updates the task
   * record in the repository, and emits a tier-1 event for reliable delivery.
   *
   * R4-28 (INV-STATE-001): PlatformFactEvent is appended BEFORE the state mutation
   * to establish the event as the source of truth. The state mutation is derived
   * from the event, not the other way around.
   *
   * @throws InvState001BypassError if entityId appears to be a canonical entity
   */
  public apply(command: TaskStatusTransitionCommand): void {
    // INV-STATE-001: Enforce that this service is not used for canonical entities
    assertNotCanonicalEntity(command.entityId, "task");
    // Read current state to check if already in target status (noop case)
    const current = this.repository.getTask(command.entityId);
    if (current != null && current.status === command.toStatus) {
      // Task already in target status - treat as noop success
      return;
    }
    taskStateMachine.assertTransition(command.fromStatus, command.toStatus);
    const traceContext = buildEventTraceContext(command, command.entityId);

    // R4-28: Append PlatformFactEvent BEFORE state mutation - event is source of truth
    const platformEvent = buildLegacyTransitionPlatformFactEvent({
      aggregateType: "Task",
      aggregateId: command.entityId,
      traceId: command.traceId,
      payload: injectTraceContext(buildStatusTransitionEventPayload(command), traceContext),
      occurredAt: command.occurredAt,
      correlationId: command.entityId,
      tenantId: current?.tenantId ?? "global",
      reasonCode: command.reasonCode,
      emittedBy: "TaskTransitionService",
      principal: command.actorId ?? "system",
    });
    this.repository.appendPlatformFactEvent(platformEvent);

    // RT-01: CAS on status. If another transaction already moved the task
    // out of fromStatus, the UPDATE matches zero rows and we must refuse to
    // emit the state-change event. Previously a plain UPDATE + assertTransition
    // gave the illusion of serialization, but two concurrent writers could
    // both pass the in-memory check and overwrite each other.
    const affected = this.repository.updateTaskStatusCas(
      command.entityId,
      command.fromStatus,
      command.toStatus,
      command.occurredAt,
      null,
      command.toStatus === "done" || command.toStatus === "failed" || command.toStatus === "cancelled"
        ? command.occurredAt
        : null,
    );
    if (affected === 0) {
      throw new Error(
        `task.transition_cas_failed:${command.entityId}:${command.fromStatus}->${command.toStatus}`,
      );
    }
    // Legacy tier-1 event still emitted for backward compatibility with existing consumers
    this.repository.createTier1StatusEvent({
      taskId: command.entityId,
      executionId: resolveExistingExecutionId(this.db, command.executionId),
      eventType: "task:status_changed",
      traceId: command.traceId,
      payload: injectTraceContext(buildStatusTransitionEventPayload(command), traceContext),
    });
  }
}

/**
 * Service for transitioning workflow state.
 *
 * LEGACY ENTITY TYPE: Workflow
 *
 * This service handles legacy Workflow entities. The canonical path for new entities
 * is RuntimeStateMachine → RuntimeTruthRepository → PlatformFactEvent.
 *
 * INV-STATE-001 ENFORCEMENT: WorkflowTransitionService.transition() will throw
 * InvState001BypassError if invoked with a canonical five-plane entity ID.
 *
 * Workflows track multi-step execution progress. Updates include the current
 * step index and any accumulated outputs from previous steps.
 */
export class WorkflowTransitionService {
  private static readonly passthroughDb = {
    transaction<T>(fn: () => T): T {
      return fn();
    },
  } satisfies Pick<AuthoritativeSqlDatabase, "transaction">;

  private readonly db: Pick<AuthoritativeSqlDatabase, "transaction">;
  private readonly repository: RuntimeLifecycleRepository;

  public constructor(
    dbOrRepository: AuthoritativeSqlDatabase | RuntimeLifecycleRepository,
    repository?: RuntimeLifecycleRepository,
  ) {
    if (repository == null) {
      this.db = WorkflowTransitionService.passthroughDb;
      this.repository = dbOrRepository as RuntimeLifecycleRepository;
      return;
    }

    this.db = dbOrRepository as AuthoritativeSqlDatabase;
    this.repository = repository;
  }

  private emitWorkflowStatusEvent(command: WorkflowStatusTransitionCommand): void {
    try {
      this.repository.createTier1StatusEvent({
        taskId: command.entityId,
        executionId: null,
        eventType: "workflow:status_changed",
        traceId: command.traceId,
        payload: injectTraceContext(
          buildStatusTransitionEventPayload(command),
          buildEventTraceContext(command, command.entityId),
        ),
      });
    } catch (error) {
      if (error instanceof Error && error.message === "unused") {
        return;
      }
      throw error;
    }
  }

  /**
   * Transitions workflow status atomically within a database transaction.
   * Ensures workflow state updates are serialized with other concurrent operations.
   *
   * §184-2148: read+write operations must be atomic to prevent lost updates
   * during concurrent transitions. Without a transaction, concurrent calls
   * could both read the same state, then both write their own version,
   * causing one update to be lost.
   */
  public transition(command: WorkflowStatusTransitionCommand): void {
    // INV-STATE-001: Validate this is not a canonical five-plane entity
    assertNotCanonicalEntity(command.entityId, "workflow");
    this.db.transaction(() => {
      // Read current state under transaction lock
      const current = this.repository.getWorkflowState(command.entityId);
      if (current == null) {
        throw new Error(`workflow.not_found:${command.entityId}`);
      }
      // If workflow is already in the target status, treat as noop success
      if (current.status === command.toStatus) {
        return;
      }
      // R9-02: Check fromStatus mismatch BEFORE validating the transition itself.
      // This ensures CAS failures are reported correctly rather than as invalid transitions.
      if (current.status !== command.fromStatus) {
        throw new Error(
          `workflow.transition_fromStatus_mismatch:${command.entityId}:${command.fromStatus}->${current.status}`,
        );
      }
      workflowStateMachine.assertTransition(current.status, command.toStatus);
      // Write with CAS under transaction lock
      const affected = this.repository.updateWorkflowStateCas(
        command.entityId,
        current.currentStepIndex,
        current.status,
        command.toStatus,
        command.currentStepIndex,
        command.outputsJson,
        command.occurredAt,
      );
      if (affected === 0) {
        throw new Error(
          `workflow.transition_cas_failed:${command.entityId}:${command.fromStatus}->${command.toStatus}`,
        );
      }
      // §28: Emit tier-1 status change event for workflow transitions
      this.emitWorkflowStatusEvent(command);
    });
  }

  /**
   * Applies a workflow status transition.
   *
   * Updates the workflow state with the new status, step index, and outputs.
   * The outputs capture the accumulated results from completed workflow steps.
   *
   * R4-28 (INV-STATE-001): PlatformFactEvent is appended BEFORE the state mutation
   * to establish the event as the source of truth.
   *
   * @throws InvState001BypassError if entityId appears to be a canonical entity
   */
  public apply(command: WorkflowStatusTransitionCommand): void {
    // INV-STATE-001: Enforce that this service is not used for canonical entities
    assertNotCanonicalEntity(command.entityId, "workflow");
    const current = this.repository.getWorkflowState(command.entityId);
    if (current == null) {
      throw new Error(`workflow.not_found:${command.entityId}`);
    }
    // If workflow is already in the target status, treat as noop success
    if (current.status === command.toStatus) {
      return;
    }
    workflowStateMachine.assertTransition(current.status, command.toStatus);
    if (current.status !== command.fromStatus) {
      throw new Error(
        `workflow.transition_fromStatus_mismatch:${command.entityId}:${command.fromStatus}->${current.status}`,
      );
    }

    // R4-28: Append PlatformFactEvent BEFORE state mutation - event is source of truth
    const traceContext = buildEventTraceContext(command, command.entityId);
    const platformEvent = buildLegacyTransitionPlatformFactEvent({
      aggregateType: "Workflow",
      aggregateId: command.entityId,
      traceId: command.traceId,
      payload: injectTraceContext(buildStatusTransitionEventPayload(command), traceContext),
      occurredAt: command.occurredAt,
      correlationId: command.entityId,
      reasonCode: command.reasonCode,
      emittedBy: "WorkflowTransitionService",
      principal: command.actorId ?? "system",
    });
    this.repository.appendPlatformFactEvent(platformEvent);

    const affected = this.repository.updateWorkflowStateCas(
      command.entityId,
      current.currentStepIndex,
      current.status,
      command.toStatus,
      command.currentStepIndex,
      command.outputsJson,
      command.occurredAt,
    );
    if (affected === 0) {
      throw new Error(
        `workflow.transition_cas_failed:${command.entityId}:${command.fromStatus}->${command.toStatus}`,
      );
    }
    // §28: Emit tier-1 status change event for workflow transitions (legacy compatibility)
    this.emitWorkflowStatusEvent(command);
  }
}

/**
 * Service for transitioning session status.
 *
 * LEGACY ENTITY TYPE: Session
 *
 * This service handles legacy Session entities. The canonical path for new entities
 * is RuntimeStateMachine → RuntimeTruthRepository → PlatformFactEvent.
 *
 * INV-STATE-001 ENFORCEMENT: SessionTransitionService.apply() will throw
 * InvState001BypassError if invoked with a canonical five-plane entity ID.
 *
 * Sessions track the interaction context. Status changes reflect user interaction
 * state, such as awaiting user input or completing a conversation turn.
 */
export class SessionTransitionService {
  public constructor(private readonly repository: RuntimeLifecycleRepository) {}

  /** Transitions session status. */
  public transition(command: SessionStatusTransitionCommand): void {
    // INV-STATE-001: Validate this is not a canonical five-plane entity
    assertNotCanonicalEntity(command.entityId, "session");
    this.apply(command);
  }

  /**
   * Applies a session status transition.
   *
   * Updates the session status to reflect the current interaction state,
   * such as "streaming", "awaiting_user", or "completed".
   *
   * R4-28 (INV-STATE-001): PlatformFactEvent is appended BEFORE the state mutation
   * to establish the event as the source of truth.
   *
   * @throws InvState001BypassError if entityId appears to be a canonical entity
   */
  public apply(command: SessionStatusTransitionCommand): void {
    // INV-STATE-001: Enforce that this service is not used for canonical entities
    assertNotCanonicalEntity(command.entityId, "session");
    // Read current state to check if already in target status (noop case)
    const current = this.repository.getSession(command.entityId);
    // R9-02: Check fromStatus mismatch BEFORE validating the transition itself.
    // This ensures CAS failures are reported correctly rather than as invalid transitions.
    // CAS check must come BEFORE noop check so we detect concurrent modifications
    // even when the target status happens to match the current status.
    if (current != null && current.status !== command.fromStatus) {
      throw new Error(
        `session.transition_cas_failed:${command.entityId}:${command.fromStatus}->${current.status}`,
      );
    }
    if (current != null && current.status === command.toStatus) {
      // Session already in target status - treat as noop success
      return;
    }
    sessionStateMachine.assertTransition(command.fromStatus, command.toStatus);
    const traceContext = buildEventTraceContext(command, command.entityId);

    // R4-28: Append PlatformFactEvent BEFORE state mutation - event is source of truth
    const platformEvent = buildLegacyTransitionPlatformFactEvent({
      aggregateType: "Session",
      aggregateId: command.entityId,
      traceId: command.traceId,
      payload: injectTraceContext(buildStatusTransitionEventPayload(command), traceContext),
      occurredAt: command.occurredAt,
      correlationId: command.entityId,
      reasonCode: command.reasonCode,
      emittedBy: "SessionTransitionService",
      principal: command.actorId ?? "system",
    });
    this.repository.appendPlatformFactEvent(platformEvent);

    // RT-01: CAS on status. If another transaction already moved the session
    // out of fromStatus, the UPDATE matches zero rows and we must refuse to
    // emit the state-change event.
    const affected = this.repository.updateSessionStatusCas(
      command.entityId,
      command.fromStatus,
      command.toStatus,
      command.occurredAt,
    );
    if (affected === 0) {
      throw new Error(
        `session.transition_cas_failed:${command.entityId}:${command.fromStatus}->${command.toStatus}`,
      );
    }
    // §28: Emit tier-1 status change event for session transitions (legacy compatibility)
    this.repository.createTier1StatusEvent({
      taskId: null,
      sessionId: command.entityId,
      executionId: null,
      eventType: "session:status_changed",
      traceId: command.traceId,
      payload: injectTraceContext(buildStatusTransitionEventPayload(command), traceContext),
    });
  }
}

/**
 * Service for transitioning execution status.
 *
 * LEGACY ENTITY TYPE: Execution
 *
 * This service handles legacy Execution entities. The canonical path for new entities
 * is RuntimeStateMachine → RuntimeTruthRepository → PlatformFactEvent.
 *
 * NOTE: The new NodeRun entity replaces Execution in the five-plane model.
 * For NodeRun transitions, use RuntimeStateMachine with RuntimeTransitionCommand.
 *
 * INV-STATE-001 ENFORCEMENT: ExecutionTransitionService.apply() will throw
 * InvState001BypassError if invoked with a canonical five-plane entity ID.
 *
 * Executions represent individual work attempts. Status changes track the
 * lifecycle from creation through execution to completion or failure.
 */
export class ExecutionTransitionService {
  public constructor(private readonly repository: RuntimeLifecycleRepository) {}

  /** Transitions execution status. */
  public transition(command: ExecutionStatusTransitionCommand): void {
    // INV-STATE-001: Validate this is not a canonical five-plane entity
    assertNotCanonicalEntity(command.entityId, "execution");
    this.apply(command);
  }

  /**
   * Applies an execution status transition.
   *
   * Updates execution status and records timing metadata: startedAt is set when
   * execution begins (prechecking or executing), finishedAt when execution ends.
   *
   * R4-28 (INV-STATE-001): PlatformFactEvent is appended BEFORE the state mutation
   * to establish the event as the source of truth.
   *
   * @throws InvState001BypassError if entityId appears to be a canonical entity
   */
  public apply(command: ExecutionStatusTransitionCommand): void {
    // INV-STATE-001: Enforce that this service is not used for canonical entities
    assertNotCanonicalEntity(command.entityId, "execution");
    // Read current state to check if already in target status (noop case)
    const current = this.repository.getExecution(command.entityId);
    // R9-02: Check fromStatus mismatch BEFORE validating the transition itself.
    // This ensures CAS failures are reported correctly rather than as invalid transitions.
    // CAS check must come BEFORE noop check so we detect concurrent modifications
    // even when the target status happens to match the current status.
    if (current != null && current.status !== command.fromStatus) {
      throw new Error(
        `execution.transition_cas_failed:${command.entityId}:${command.fromStatus}->${current.status}`,
      );
    }
    if (current != null && current.status === command.toStatus) {
      // Execution already in target status - treat as noop success
      return;
    }
    executionStateMachine.assertTransition(command.fromStatus, command.toStatus);
    const startedAt =
      command.toStatus === "prechecking" || command.toStatus === "executing"
        ? command.occurredAt
        : null;
    const finishedAt =
      command.toStatus === "succeeded" || command.toStatus === "failed" || command.toStatus === "cancelled"
        ? command.occurredAt
        : null;
    const lastErrorCode = command.toStatus === "failed" ? command.reasonCode ?? null : null;
    const traceContext = buildEventTraceContext(command, command.entityId);

    // R4-28: Append PlatformFactEvent BEFORE state mutation - event is source of truth
    const platformEvent = buildLegacyTransitionPlatformFactEvent({
      aggregateType: "Execution",
      aggregateId: command.entityId,
      traceId: command.traceId,
      payload: injectTraceContext(buildStatusTransitionEventPayload(command), traceContext),
      occurredAt: command.occurredAt,
      correlationId: command.entityId,
      reasonCode: command.reasonCode,
      emittedBy: "ExecutionTransitionService",
      principal: command.actorId ?? "system",
    });
    this.repository.appendPlatformFactEvent(platformEvent);

    // RT-01: CAS on status. If another transaction already moved the execution
    // out of fromStatus, the UPDATE matches zero rows and we must refuse to
    // complete the transition.
    const affected = this.repository.updateExecutionStatusCas(
      command.entityId,
      command.fromStatus,
      command.toStatus,
      command.occurredAt,
      startedAt,
      finishedAt,
      lastErrorCode,
    );
    if (affected === 0) {
      throw new Error(
        `execution.transition_cas_failed:${command.entityId}:${command.fromStatus}->${command.toStatus}`,
      );
    }
    // §28: Emit tier-1 status change event for execution transitions (legacy compatibility)
    this.repository.createTier1StatusEvent({
      taskId: null,
      executionId: command.entityId,
      eventType: "execution:status_changed",
      traceId: command.traceId,
      payload: injectTraceContext(buildStatusTransitionEventPayload(command), traceContext),
    });
  }
}

/**
 * Service for transitioning approval status.
 *
 * LEGACY ENTITY TYPE: Approval
 *
 * This service handles legacy Approval entities. The canonical path for new entities
 * is RuntimeStateMachine → RuntimeTruthRepository → PlatformFactEvent.
 *
 * Approvals track human authorization decisions. Status changes reflect whether
 * an approval request was approved, rejected, expired, or cancelled.
 */
export class ApprovalTransitionService {
  public constructor(private readonly repository: RuntimeLifecycleRepository) {}

  /** Transitions approval status. */
  public transition(command: ApprovalStatusTransitionCommand): void {
    this.apply(command);
  }

  /**
   * Applies an approval status transition.
   *
   * Updates the approval record with the decision (approved/rejected/etc.),
   * the response JSON containing the decision details, and the response timestamp.
   */
  public apply(command: ApprovalStatusTransitionCommand): void {
    const current = this.repository.getApproval(command.entityId);
    if (current != null && current.status !== command.fromStatus) {
      throw new Error(
        `approval.transition_cas_failed:${command.entityId}:${command.fromStatus}->${current.status}`,
      );
    }
    if (current != null && current.status === command.toStatus) {
      return;
    }
    approvalStateMachine.assertTransition(command.fromStatus, command.toStatus);
    const traceContext = buildEventTraceContext(command, command.entityId);
    const platformEvent = buildLegacyTransitionPlatformFactEvent({
      aggregateType: "Approval",
      aggregateId: command.entityId,
      traceId: command.traceId,
      payload: injectTraceContext({
        fromStatus: command.fromStatus,
        toStatus: command.toStatus,
        reasonCode: command.reasonCode,
        occurredAt: command.occurredAt,
      }, traceContext),
      occurredAt: command.occurredAt,
      correlationId: command.entityId,
      reasonCode: command.reasonCode,
      emittedBy: "ApprovalTransitionService",
      principal: command.actorId ?? "system",
    });
    this.repository.appendPlatformFactEvent(platformEvent);
    // RT-01: CAS on status. If another transaction already moved the approval
    // out of fromStatus, the UPDATE matches zero rows and we must refuse to
    // complete the transition.
    const affected = this.repository.updateApprovalDecisionCas({
      approvalId: command.entityId,
      expectedStatus: command.fromStatus,
      status: command.toStatus,
      responseJson: command.responseJson,
      respondedAt: command.occurredAt,
    });
    if (affected === 0) {
      throw new Error(
        `approval.transition_cas_failed:${command.entityId}:${command.fromStatus}->${command.toStatus}`,
      );
    }
  }
}

/**
 * Handles terminal transitions that affect multiple entities simultaneously.
 *
 * LEGACY ENTITY TYPES: Task, Workflow, Session, Execution (all legacy)
 *
 * When a task reaches a terminal state (done, failed, cancelled), all related
 * entities must also reach their terminal states. This service coordinates
 * the transitions atomically to maintain consistency.
 *
 * INV-STATE-001: This service operates on legacy entity types only.
 * For canonical entities (HarnessRun, NodeRun), use RuntimeStateMachine directly.
 */
class TaskTerminalTransitionService {
  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly repository: RuntimeLifecycleRepository,
  ) {}

  /**
   * Transitions all related entities to terminal state within a transaction.
   *
   * When a task completes (done, failed, cancelled), the workflow, session, and
   * execution must also reach their terminal states. This ensures data consistency
   * across all related entities.
   */
  public transition(input: TaskTerminalTransitionInput): void {
    // INV-STATE-001: Validate these are not canonical five-plane entities
    assertNotCanonicalEntity(input.taskId, "task");
    assertNotCanonicalEntity(input.sessionId, "session");
    assertNotCanonicalEntity(input.executionId, "execution");
    this.db.transaction(() => {
      this.apply(input);
    });
  }

  /**
   * Applies terminal state transitions to all related entities.
   *
   * Maps the task terminal status to corresponding terminal statuses for
   * workflow (completed/failed/cancelled), session (completed/failed/cancelled),
   * and execution (succeeded/failed/cancelled). All transitions are validated
   * before any updates are applied.
   *
   * R9-02: This method implements proper CAS with version/fencing tokens per §25.3.
   * Fresh state is read at the start of the method and used in all CAS operations
   * to prevent TOCTOU race conditions where concurrent transitions could overwrite
   * each other.
   */
  public apply(input: TaskTerminalTransitionInput): void {
    // INV-STATE-001: Enforce that this service is not used for canonical entities
    assertNotCanonicalEntity(input.taskId, "task");
    assertNotCanonicalEntity(input.sessionId, "session");
    assertNotCanonicalEntity(input.executionId, "execution");
    const traceContext = buildEventTraceContext(input.context, input.taskId);
    const workflowTerminal: WorkflowStatus = input.terminalStatus === "done" ? "completed" : input.terminalStatus;
    const sessionTerminal: SessionStatus = input.terminalStatus === "done" ? "completed" : input.terminalStatus;
    const executionTerminal: ExecutionStatus = input.terminalStatus === "done" ? "succeeded" : input.terminalStatus;

    // R9-02: Read fresh state BEFORE any CAS operations to prevent TOCTOU races.
    // The input fields (currentTaskStatus, etc.) may be stale if another
    // concurrent transition modified the entity since the input was constructed.
    const currentTask = this.repository.getTask(input.taskId);
    const currentWorkflow = this.repository.getWorkflowState(input.taskId);
    const currentSession = this.repository.getSession(input.sessionId);
    const currentExecution = this.repository.getExecution(input.executionId);

    // R9-02: Use fresh status values from freshly-read state for validation and CAS
    const freshTaskStatus = currentTask?.status ?? input.currentTaskStatus;
    const freshWorkflowStatus = currentWorkflow?.status ?? input.currentWorkflowStatus;
    const freshSessionStatus = currentSession?.status ?? input.currentSessionStatus;
    const freshExecutionStatus = currentExecution?.status ?? input.currentExecutionStatus;
    const freshTaskUpdatedAt = currentTask?.updatedAt ?? input.expectedTaskUpdatedAt ?? input.context.occurredAt;
    const freshSessionUpdatedAt = currentSession?.updatedAt ?? input.expectedSessionUpdatedAt ?? input.context.occurredAt;
    const freshExecutionUpdatedAt = currentExecution?.updatedAt ?? input.expectedExecutionUpdatedAt ?? input.context.occurredAt;
    const freshWorkflowStepIndex = currentWorkflow?.currentStepIndex ?? input.expectedWorkflowStepIndex ?? 0;

    // R9-02: Validate transitions using fresh status values.
    // If an entity is already in the target terminal state, treat this as a noop
    // (idempotent success) rather than throwing a noop transition error.
    // This handles cases where concurrent transitions or race conditions result
    // in the entity already being terminal when we attempt to transition.
    // R9-02: Check if each entity is already in its terminal state.
    // If so, skip that entity's transition since it was already handled.
    // This prevents a noop transition error when individual entities are already
    // terminal but others (like task) are still transitioning.
    const taskAlreadyTerminal = freshTaskStatus === input.terminalStatus;
    const workflowAlreadyTerminal = freshWorkflowStatus === workflowTerminal;
    const sessionAlreadyTerminal = freshSessionStatus === sessionTerminal;
    const executionAlreadyTerminal = freshExecutionStatus === executionTerminal;

    // If ALL entities are already in their terminal states, this is a true noop - return early
    if (taskAlreadyTerminal && workflowAlreadyTerminal && sessionAlreadyTerminal && executionAlreadyTerminal) {
      // All entities already in terminal state - noop success
      return;
    }

    // For each entity: only assert transition if not already terminal
    if (!taskAlreadyTerminal) {
      taskStateMachine.assertTransition(freshTaskStatus, input.terminalStatus);
    }
    if (!workflowAlreadyTerminal) {
      workflowStateMachine.assertTransition(freshWorkflowStatus, workflowTerminal);
    }
    if (!sessionAlreadyTerminal) {
      sessionStateMachine.assertTransition(freshSessionStatus, sessionTerminal);
    }
    if (!executionAlreadyTerminal) {
      executionStateMachine.assertTransition(freshExecutionStatus, executionTerminal);
    }

    // R4-28 (INV-STATE-001): Append PlatformFactEvent BEFORE state mutations - event is source of truth
    // This establishes the terminal transition as a PlatformFactEvent before any derived table updates.
    // Skip events for entities that are already in their terminal state (no actual transition occurred).
    const taskPlatformEvent = !taskAlreadyTerminal
      ? buildLegacyTransitionPlatformFactEvent({
          aggregateType: "Task",
          aggregateId: input.taskId,
          traceId: input.context.traceId,
          payload: injectTraceContext({
            fromStatus: freshTaskStatus,
            toStatus: input.terminalStatus,
            reasonCode: input.context.reasonCode,
            occurredAt: input.context.occurredAt,
          }, traceContext),
          occurredAt: input.context.occurredAt,
          correlationId: input.taskId,
          tenantId: currentTask?.tenantId ?? "global",
          reasonCode: input.context.reasonCode,
          emittedBy: "TaskTerminalTransitionService",
          principal: input.context.actorId ?? "system",
        })
      : null;
    const workflowPlatformEvent = !workflowAlreadyTerminal
      ? buildLegacyTransitionPlatformFactEvent({
          aggregateType: "Workflow",
          aggregateId: input.taskId,
          traceId: input.context.traceId,
          payload: injectTraceContext({
            fromStatus: freshWorkflowStatus,
            toStatus: workflowTerminal,
            reasonCode: input.context.reasonCode,
            occurredAt: input.context.occurredAt,
          }, traceContext),
          occurredAt: input.context.occurredAt,
          correlationId: input.taskId,
          reasonCode: input.context.reasonCode,
          emittedBy: "TaskTerminalTransitionService",
          principal: input.context.actorId ?? "system",
        })
      : null;
    const sessionPlatformEvent = !sessionAlreadyTerminal
      ? buildLegacyTransitionPlatformFactEvent({
          aggregateType: "Session",
          aggregateId: input.sessionId,
          traceId: input.context.traceId,
          payload: injectTraceContext({
            fromStatus: freshSessionStatus,
            toStatus: sessionTerminal,
            reasonCode: input.context.reasonCode,
            occurredAt: input.context.occurredAt,
          }, traceContext),
          occurredAt: input.context.occurredAt,
          correlationId: input.taskId,
          reasonCode: input.context.reasonCode,
          emittedBy: "TaskTerminalTransitionService",
          principal: input.context.actorId ?? "system",
        })
      : null;
    const executionPlatformEvent = !executionAlreadyTerminal
      ? buildLegacyTransitionPlatformFactEvent({
          aggregateType: "Execution",
          aggregateId: input.executionId,
          traceId: input.context.traceId,
          payload: injectTraceContext({
            fromStatus: freshExecutionStatus,
            toStatus: executionTerminal,
            reasonCode: input.context.reasonCode,
            occurredAt: input.context.occurredAt,
          }, traceContext),
          occurredAt: input.context.occurredAt,
          correlationId: input.taskId,
          reasonCode: input.context.reasonCode,
          emittedBy: "TaskTerminalTransitionService",
          principal: input.context.actorId ?? "system",
        })
      : null;
    if (taskPlatformEvent) this.repository.appendPlatformFactEvent(taskPlatformEvent);
    if (workflowPlatformEvent) this.repository.appendPlatformFactEvent(workflowPlatformEvent);
    if (sessionPlatformEvent) this.repository.appendPlatformFactEvent(sessionPlatformEvent);
    if (executionPlatformEvent) this.repository.appendPlatformFactEvent(executionPlatformEvent);

    // R9-02: updateTaskOutputCas uses updated_at as fencing token (§25.3) to prevent
    // TOCTOU races. Only updates if the task's updated_at matches expectedTaskUpdatedAt
    // AND status matches expectedStatus.
    const outputAffected = this.repository.updateTaskOutputCas(
      input.taskId,
      freshTaskUpdatedAt,
      freshTaskStatus,
      input.taskOutputJson,
      input.context.occurredAt,
    );
    if (outputAffected === 0) {
      throw new Error(
        `task.output_cas_failed:${input.taskId}:${freshTaskStatus}:fencing_token_mismatch`,
      );
    }
    // R9-02: updateTaskStatusCas uses status check (no explicit version column in tasks table)
    const taskAffected = this.repository.updateTaskStatusCas(
      input.taskId,
      freshTaskStatus,
      input.terminalStatus,
      input.context.occurredAt,
      input.terminalStatus === "failed" ? input.context.reasonCode : null,
      input.context.occurredAt,
    );
    if (taskAffected === 0) {
      throw new Error(
        `task.transition_cas_failed:${input.taskId}:${freshTaskStatus}->${input.terminalStatus}:status_changed`,
      );
    }

    // R9-02: updateWorkflowStateCas uses current_step_index as fencing token (§25.3)
    const workflowAffected = this.repository.updateWorkflowStateCas(
      input.taskId,
      freshWorkflowStepIndex,
      freshWorkflowStatus,
      workflowTerminal,
      input.expectedWorkflowStepIndex ?? freshWorkflowStepIndex,
      input.outputsJson,
      input.context.occurredAt,
    );
    if (workflowAffected === 0) {
      throw new Error(
        `workflow.transition_cas_failed:${input.taskId}:${freshWorkflowStatus}->${workflowTerminal}:fencing_token_mismatch`,
      );
    }
    // R9-02: updateSessionStatusCas uses status check (no explicit version in sessions table)
    const sessionAffected = this.repository.updateSessionStatusCas(
      input.sessionId,
      freshSessionStatus,
      sessionTerminal,
      input.context.occurredAt,
    );
    if (sessionAffected === 0) {
      throw new Error(
        `session.transition_cas_failed:${input.sessionId}:${freshSessionStatus}->${sessionTerminal}:status_changed`,
      );
    }
    // R9-02: updateExecutionStatusCas uses status check (no explicit version in executions table)
    // Skip if execution is already terminal (already handled by step loop)
    let executionAffected = 1; // Default to success if skipping
    if (!executionAlreadyTerminal) {
      executionAffected = this.repository.updateExecutionStatusCas(
        input.executionId,
        freshExecutionStatus,
        executionTerminal,
        input.context.occurredAt,
        null,
        input.context.occurredAt,
        input.terminalStatus === "failed" ? input.context.reasonCode : null,
      );
      if (executionAffected === 0) {
        throw new Error(
          `execution.transition_cas_failed:${input.executionId}:${freshExecutionStatus}->${executionTerminal}:status_changed`,
        );
      }
    }
    this.repository.createTier1StatusEvent({
      taskId: input.taskId,
      executionId: input.executionId,
      eventType: "task:status_changed",
      traceId: input.context.traceId,
      payload: injectTraceContext({
        fromStatus: freshTaskStatus,
        toStatus: input.terminalStatus,
        reasonCode: input.context.reasonCode,
        occurredAt: input.context.occurredAt,
      }, traceContext),
    });
  }
}

/**
 * Coordinates state transitions when an execution is blocked pending approval.
 *
 * LEGACY ENTITY TYPES: Task, Workflow, Session, Execution, Approval (all legacy)
 *
 * When human approval is required, this service transitions the task to
 * "awaiting_decision", workflow to "paused", session to "awaiting_user", and
 * execution to "blocked", then creates the approval record.
 *
 * INV-STATE-001: This service operates on legacy entity types only.
 * For canonical entities (HarnessRun, NodeRun), use RuntimeStateMachine directly.
 */
class ApprovalBlockingTransitionService {
  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly repository: RuntimeLifecycleRepository,
    private readonly tasks: TaskTransitionService,
    private readonly workflows: WorkflowTransitionService,
    private readonly sessions: SessionTransitionService,
    private readonly executions: ExecutionTransitionService,
  ) {}

  /**
   * Transitions all entities to blocked/awaiting-approval state atomically.
   *
   * This is called when an execution encounters a step that requires human
   * approval before proceeding. All related entities are transitioned to
   * their "blocked" states to prevent further processing until the approval
   * is resolved.
   */
  public transition(input: BlockedForApprovalTransitionCommand): BlockedForApprovalTransitionResult {
    // INV-STATE-001: Validate these are not canonical five-plane entities
    assertNotCanonicalEntity(input.taskId, "task");
    assertNotCanonicalEntity(input.sessionId, "session");
    assertNotCanonicalEntity(input.executionId, "execution");
    return this.db.transaction(() => this.apply(input));
  }

  /**
   * Applies the approval blocking transition.
   *
   * Creates an approval record with the request details, transitions each
   * entity (task, workflow, session, execution) to its blocked state, and
   * emits a tier-1 "decision:requested" event for reliable delivery.
   */
  public apply(input: BlockedForApprovalTransitionCommand): BlockedForApprovalTransitionResult {
    // INV-STATE-001: Enforce that this service is not used for canonical entities
    assertNotCanonicalEntity(input.taskId, "task");
    assertNotCanonicalEntity(input.sessionId, "session");
    assertNotCanonicalEntity(input.executionId, "execution");
    const approvalId = input.approval.approvalId ?? newId("approval");
    const createdAt = input.approval.createdAt ?? input.context.occurredAt;
    const approvalRecord: ApprovalRecord = {
      id: approvalId,
      taskId: input.taskId,
      executionId: input.executionId,
      status: "requested",
      requestJson: JSON.stringify({
        approvalId,
        taskId: input.taskId,
        executionId: input.executionId,
        sourceAgentId: input.approval.sourceAgentId,
        reason: input.approval.reason,
        riskLevel: input.approval.riskLevel,
        options: input.approval.options,
        context: input.approval.context,
        timeoutPolicy: input.approval.timeoutPolicy,
        createdAt,
      }),
      responseJson: null,
      timeoutPolicy: input.approval.timeoutPolicy,
      createdAt,
      respondedAt: null,
    };

    this.tasks.apply({
      entityKind: "task",
      entityId: input.taskId,
      fromStatus: input.currentTaskStatus,
      toStatus: "awaiting_decision",
      executionId: input.executionId,
      ...input.context,
    });
    this.workflows.apply({
      entityKind: "workflow",
      entityId: input.taskId,
      fromStatus: input.currentWorkflowStatus,
      toStatus: "paused",
      currentStepIndex: input.workflowCurrentStepIndex,
      outputsJson: input.workflowOutputsJson,
      ...input.context,
    });
    this.sessions.apply({
      entityKind: "session",
      entityId: input.sessionId,
      fromStatus: input.currentSessionStatus,
      toStatus: "awaiting_user",
      ...input.context,
    });
    this.executions.apply({
      entityKind: "execution",
      entityId: input.executionId,
      fromStatus: input.currentExecutionStatus,
      toStatus: "blocked",
      ...input.context,
    });
    this.repository.insertApproval(approvalRecord);
    this.repository.insertEvent({
      id: newId("evt"),
      taskId: input.taskId,
      executionId: input.executionId,
      eventType: "decision:requested",
      eventTier: "tier_1",
      payloadJson: approvalRecord.requestJson,
      traceId: input.context.traceId,
      createdAt,
    });

    return {
      approvalId,
      createdAt,
    };
  }
}

/**
 * Facade service that coordinates all entity transitions.
 *
 * LEGACY ENTITY TYPES ONLY: Task, Workflow, Session, Execution, Approval
 *
 * TransitionService provides a unified interface for transitioning tasks, workflows,
 * sessions, executions, and approvals. It composes the individual transition
 * services and provides convenience methods for common transition scenarios,
 * including terminal transitions and approval blocking.
 *
 * INV-STATE-001 ENFORCEMENT:
 *   All public methods validate that entity IDs do not represent canonical
 *   five-plane entities (HarnessRun, NodeRun, SideEffectRecord, BudgetLedger,
 *   BudgetReservation). These entities require RuntimeStateMachine and
 *   RuntimeTruthRepository with PlatformFactEvent emission.
 *
 * For canonical entities, use RuntimeStateMachine.transition() directly.
 *
 * @see RuntimeStateMachine: runtime-state-machine.ts
 * @see RuntimeTruthRepository: five-plane-state-evidence/truth/runtime-truth-repository.ts
 */
export class TransitionService {
  private readonly repository: RuntimeLifecycleRepository;
  private readonly tasks: TaskTransitionService;
  private readonly workflows: WorkflowTransitionService;
  private readonly sessions: SessionTransitionService;
  private readonly executions: ExecutionTransitionService;
  private readonly approvals: ApprovalTransitionService;
  private readonly terminalTasks: TaskTerminalTransitionService;
  private readonly approvalBlocks: ApprovalBlockingTransitionService;

  public constructor(
    db: AuthoritativeSqlDatabase,
    store: AuthoritativeTaskStore,
    repository: RuntimeLifecycleRepository = createRuntimeLifecycleRepository(store),
  ) {
    this.repository = repository;
    this.tasks = new TaskTransitionService(db, repository);
    this.workflows = new WorkflowTransitionService(db, repository);
    this.sessions = new SessionTransitionService(repository);
    this.executions = new ExecutionTransitionService(repository);
    this.approvals = new ApprovalTransitionService(repository);
    this.terminalTasks = new TaskTerminalTransitionService(db, repository);
    this.approvalBlocks = new ApprovalBlockingTransitionService(
      db,
      repository,
      this.tasks,
      this.workflows,
      this.sessions,
      this.executions,
    );
  }

  /**
   * Transitions a task's status. Validates against task state machine and emits events.
   *
   * @deprecated For canonical five-plane entities (HarnessRun), use RuntimeStateMachine.
   * This method is for legacy Task entities only.
   * @throws InvState001BypassError if command.entityId appears to be a canonical entity
   * @throws LeaderAuthorityError if caller is not the current leader (R4-36)
   */
  public transitionTaskStatus(command: TaskStatusTransitionCommand): void {
    // R4-36: Verify leader authority before any write operation
    const nodeId = command.actorId ?? "unknown";
    assertLeaderAuthoritative(nodeId, "transition_task_status");
    this.tasks.transition(command);
  }

  /** Transitions a workflow's status, including step index and outputs.
   *
   * @deprecated For canonical five-plane entities, use RuntimeStateMachine.
   * This method is for legacy Workflow entities only.
   * @throws InvState001BypassError if command.entityId appears to be a canonical entity
   * @throws LeaderAuthorityError if caller is not the current leader (R4-36)
   */
  public transitionWorkflowStatus(command: WorkflowStatusTransitionCommand): void {
    // R4-36: Verify leader authority before any write operation
    const nodeId = command.actorId ?? "unknown";
    assertLeaderAuthoritative(nodeId, "transition_workflow_status");
    this.workflows.transition(command);
  }

  /** Transitions a session's status.
   *
   * @deprecated For canonical five-plane entities, use RuntimeStateMachine.
   * This method is for legacy Session entities only.
   * @throws InvState001BypassError if command.entityId appears to be a canonical entity
   * @throws LeaderAuthorityError if caller is not the current leader (R4-36)
   */
  public transitionSessionStatus(command: SessionStatusTransitionCommand): void {
    // R4-36: Verify leader authority before any write operation
    const nodeId = command.actorId ?? "unknown";
    assertLeaderAuthoritative(nodeId, "transition_session_status");
    this.sessions.transition(command);
  }

  /** Transitions an execution's status, recording startedAt/finishedAt timestamps.
   *
   * @deprecated For canonical five-plane entities (NodeRun), use RuntimeStateMachine.
   * This method is for legacy Execution entities only.
   * @throws InvState001BypassError if command.entityId appears to be a canonical entity
   * @throws LeaderAuthorityError if caller is not the current leader (R4-36)
   */
  public transitionExecutionStatus(command: ExecutionStatusTransitionCommand): void {
    // R4-36: Verify leader authority before any write operation
    const nodeId = command.actorId ?? "unknown";
    assertLeaderAuthoritative(nodeId, "transition_execution_status");
    this.executions.transition(command);
  }

  /** Transitions an approval's status (approved, rejected, expired, cancelled).
   *
   * @deprecated For canonical five-plane entities, use RuntimeStateMachine.
   * This method is for legacy Approval entities only.
   * @throws LeaderAuthorityError if caller is not the current leader (R4-36)
   */
  public transitionApprovalStatus(command: ApprovalStatusTransitionCommand): void {
    // R4-36: Verify leader authority before any write operation
    const nodeId = command.actorId ?? "unknown";
    assertLeaderAuthoritative(nodeId, "transition_approval_status");
    this.approvals.transition(command);
  }

  /**
   * Blocks an execution pending human approval.
   *
   * Transitions task, workflow, session, and execution to their blocked/paused
   * states, creates an approval record, and emits a decision:requested event.
   * @throws LeaderAuthorityError if caller is not the current leader (R4-36)
   */
  public transitionBlockedForApproval(
    input: BlockedForApprovalTransitionCommand,
  ): BlockedForApprovalTransitionResult {
    // R4-36: Verify leader authority before any write operation
    const nodeId = input.context.actorId ?? "unknown";
    assertLeaderAuthoritative(nodeId, "transition_blocked_for_approval");
    return this.approvalBlocks.transition(input);
  }

  /**
   * Transitions all entities (task, workflow, session, execution) to terminal state.
   *
   * Called when a task completes, fails, or is cancelled. All related entities
   * must reach their terminal states atomically.
   * @throws LeaderAuthorityError if caller is not the current leader (R4-36)
   */
  public transitionTaskTerminalState(input: TaskTerminalTransitionInput): void {
    // R4-36: Verify leader authority before any write operation
    const nodeId = input.context.actorId ?? "unknown";
    assertLeaderAuthoritative(nodeId, "transition_task_terminal_state");
    this.terminalTasks.transition(input);
  }

  /**
   * Applies terminal state transitions without wrapping in a transaction.
   * Use this when the caller handles transaction management.
   * @throws LeaderAuthorityError if caller is not the current leader (R4-36)
   */
  public applyTaskTerminalState(input: TaskTerminalTransitionInput): void {
    // R4-36: Verify leader authority before any write operation
    const nodeId = input.context.actorId ?? "unknown";
    assertLeaderAuthoritative(nodeId, "apply_task_terminal_state");
    this.terminalTasks.apply(input);
  }

  /**
   * Returns the allowed status transitions for a task based on its current status.
   *
   * @param taskId - The task ID to look up
   * @returns The list of allowed target statuses, or empty array if task not found
   */
  public getAllowedTaskTransitions(taskId: string): readonly TaskStatus[] {
    const task = this.repository.getTask(taskId);
    if (task == null) {
      return [];
    }
    return TASK_TRANSITIONS[task.status] ?? [];
  }

  /**
   * Returns the allowed status transitions for an execution based on its current status.
   *
   * @param executionId - The execution ID to look up
   * @returns The list of allowed target statuses, or empty array if execution not found
   */
  public getAllowedExecutionTransitions(executionId: string): readonly ExecutionStatus[] {
    const execution = this.repository.getExecution(executionId);
    if (execution == null) {
      return [];
    }
    return EXECUTION_TRANSITIONS[execution.status] ?? [];
  }

  /**
   * Returns the allowed status transitions for an approval based on its current status.
   *
   * @param approvalId - The approval ID to look up
   * @returns The list of allowed target statuses, or empty array if approval not found
   */
  public getAllowedApprovalTransitions(approvalId: string): readonly ApprovalStatus[] {
    const approval = this.repository.getApproval(approvalId);
    if (approval == null) {
      return [];
    }
    return APPROVAL_TRANSITIONS[approval.status] ?? [];
  }

  /**
   * Returns the allowed status transitions for a workflow based on its current status.
   *
   * @param taskId - The task ID (workflows are keyed by taskId)
   * @returns The list of allowed target statuses, or empty array if workflow not found
   */
  public getAllowedWorkflowTransitions(taskId: string): readonly WorkflowStatus[] {
    const workflow = this.repository.getWorkflowState(taskId);
    if (workflow == null) {
      return [];
    }
    return WORKFLOW_TRANSITIONS[workflow.status] ?? [];
  }
}

/**
 * Builds trace context for events emitted during transitions.
 *
 * Injects trace context (traceId, spanId, correlationId) into the event
 * payload to enable distributed tracing across entity state changes.
 */
function buildEventTraceContext(context: TransitionAuditContext, taskId: string) {
  const traceContext = toAuditContextTraceContext(context);
  return {
    ...traceContext,
    spanId: traceContext.spanId ?? newId("span"),
    correlationId: context.correlationId ?? taskId,
  };
}

/**
 * R4-28 (INV-STATE-001): Builds a PlatformFactEvent for a legacy entity transition.
 * The event is the source of truth and is appended BEFORE the state mutation.
 *
 * @param aggregateType - The legacy entity type (task, workflow, session, execution)
 * @param aggregateId - The entity ID
 * @param eventType - The event type (e.g., "platform.task.status_changed")
 * @param traceId - Trace context ID
 * @param payload - Event payload with transition details
 * @param occurredAt - When the transition occurred
 * @param correlationId - Optional correlation ID for linking related events
 * @returns A PlatformFactEvent ready to be appended to the event store
 */
function buildLegacyTransitionPlatformFactEvent(input: {
  aggregateType: LegacyRuntimeEntityKind;
  aggregateId: string;
  traceId: string;
  payload: Record<string, unknown>;
  occurredAt: string;
  correlationId?: string;
  tenantId?: string;
  reasonCode?: string | null;
  emittedBy?: string;
  principal?: string;
  auditRef?: string;
}): ReturnType<typeof createPlatformFactEvent> {
  return legacyRuntimeStateMachine.transitionLegacy({
    commandId: newId("cmd"),
    entityKind: input.aggregateType,
    entityId: input.aggregateId,
    principal: input.principal ?? "legacy-transition-service",
    fromStatus: String(input.payload.fromStatus ?? ""),
    toStatus: String(input.payload.toStatus ?? ""),
    tenantId: input.tenantId ?? "global",
    traceId: input.traceId,
    reasonCode: input.reasonCode ?? String(input.payload.reasonCode ?? "legacy.status_changed"),
    emittedBy: input.emittedBy ?? "TransitionService",
    auditRef: input.auditRef ?? `audit://legacy/${input.aggregateType.toLowerCase()}/${input.aggregateId}/status`,
    occurredAt: input.occurredAt,
    correlationId: input.correlationId ?? "unknown",
    payload: input.payload,
  }).event;
}

function resolveExistingExecutionId(db: AuthoritativeSqlDatabase, executionId: string | null): string | null {
  if (executionId == null) {
    return null;
  }
  if (typeof db.connection.prepare !== "function") {
    return executionId;
  }
  const row = db.connection.prepare("SELECT 1 FROM executions WHERE id = ? LIMIT 1").get(executionId) as
    | Record<string, unknown>
    | undefined;
  return row == null ? null : executionId;
}

/**
 * Builds the event payload for status transition events.
 *
 * Captures all relevant information about the transition including entity
 * details, status values, audit context, and timing. This payload is
 * attached to tier-1 events for reliable delivery and observability.
 */
function buildStatusTransitionEventPayload<TStatus extends string>(
  command: TransitionCommand<TransitionEntityKind, TStatus>,
): Record<string, unknown> {
  return {
    entityKind: command.entityKind,
    entityId: command.entityId,
    fromStatus: command.fromStatus ?? null,
    toStatus: command.toStatus,
    reasonCode: command.reasonCode,
    reasonDetail: command.reasonDetail ?? null,
    actorType: command.actorType,
    actorId: command.actorId ?? null,
    idempotencyKey: command.idempotencyKey ?? null,
    metadataJson: command.metadataJson ?? null,
    occurredAt: command.occurredAt,
  };
}
