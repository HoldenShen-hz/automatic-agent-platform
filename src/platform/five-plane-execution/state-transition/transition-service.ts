/**
 * @fileoverview Transition Service - Enforces valid state transitions for all entities.
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
 * @see State Transition Machine: state-transition-machine.ts
 * @see Transition Service Contract: docs_zh/contracts/transition_service_contract.md
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
 */
const SESSION_TRANSITIONS: Record<SessionStatus, readonly SessionStatus[]> = {
  open: ["streaming", "awaiting_user", "completed", "failed", "cancelled"],
  streaming: ["awaiting_user", "completed", "failed", "cancelled", "open"],
  awaiting_user: ["streaming", "completed", "failed", "cancelled"],
  paused: ["streaming", "completed", "failed", "cancelled", "open"],
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
  created: ["prechecking", "executing", "cancelled", "failed"],
  prechecking: ["executing", "blocked", "cancelled", "failed"],
  ready: ["queued", "cancelled", "failed"],
  queued: ["dispatching", "cancelled", "failed"],
  dispatching: ["executing", "cancelled", "failed"],
  executing: ["blocked", "succeeded", "failed", "cancelled"],
  blocked: ["prechecking", "executing", "cancelled", "failed", "superseded"],
  paused: ["resuming", "executing", "cancelled", "failed"],
  resuming: ["executing", "cancelled", "failed"],
  recovering: ["executing", "cancelled", "failed", "timed_out"],
  timed_out: ["executing", "cancelled", "failed"],
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
};

/**
 * Service for transitioning task status.
 *
 * Applies task status changes within a database transaction, validates the
 * transition against the task state machine, and emits a tier-1 status change event.
 */
export class TaskTransitionService {
  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly repository: RuntimeLifecycleRepository,
  ) {}

  /**
   * Transitions task status within a database transaction.
   * Ensures atomic update and event emission.
   */
  public transition(command: TaskStatusTransitionCommand): void {
    this.db.transaction(() => {
      this.apply(command);
    });
  }

  /**
   * Applies a task status transition.
   *
   * Validates the transition against the task state machine, updates the task
   * record in the repository, and emits a tier-1 event for reliable delivery.
   */
  public apply(command: TaskStatusTransitionCommand): void {
    taskStateMachine.assertTransition(command.fromStatus, command.toStatus);
    const traceContext = buildEventTraceContext(command, command.entityId);
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
 * Workflows track multi-step execution progress. Updates include the current
 * step index and any accumulated outputs from previous steps.
 */
export class WorkflowTransitionService {
  public constructor(
    private readonly db: AuthoritativeSqlDatabase | null,
    private readonly repository: RuntimeLifecycleRepository,
  ) {}

  /**
   * Transitions workflow status atomically within a database transaction.
   */
  public transition(command: WorkflowStatusTransitionCommand): void {
    if (this.db) {
      this.db.transaction(() => {
        this.apply(command);
      });
    } else {
      // Fallback for testing without database
      this.apply(command);
    }
  }

  /**
   * Applies a workflow status transition.
   *
   * Updates the workflow state with the new status, step index, and outputs.
   * The outputs capture the accumulated results from completed workflow steps.
   */
  public apply(command: WorkflowStatusTransitionCommand): void {
    workflowStateMachine.assertTransition(command.fromStatus, command.toStatus);
    const current = this.repository.getWorkflowState(command.entityId);
    if (current == null) {
      throw new Error(`workflow.not_found:${command.entityId}`);
    }
    if (current.status !== command.fromStatus) {
      throw new Error(
        `workflow.transition_fromStatus_mismatch:${command.entityId}:${command.fromStatus}->${current.status}`,
      );
    }
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
  }
}

/**
 * Service for transitioning session status.
 *
 * Sessions track the interaction context. Status changes reflect user interaction
 * state, such as awaiting user input or completing a conversation turn.
 */
export class SessionTransitionService {
  public constructor(private readonly repository: RuntimeLifecycleRepository) {}

  /** Transitions session status. */
  public transition(command: SessionStatusTransitionCommand): void {
    this.apply(command);
  }

  /**
   * Applies a session status transition.
   *
   * Updates the session status to reflect the current interaction state,
   * such as "streaming", "awaiting_user", or "completed".
   */
  public apply(command: SessionStatusTransitionCommand): void {
    sessionStateMachine.assertTransition(command.fromStatus, command.toStatus);
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
  }
}

/**
 * Service for transitioning execution status.
 *
 * Executions represent individual work attempts. Status changes track the
 * lifecycle from creation through execution to completion or failure.
 */
export class ExecutionTransitionService {
  public constructor(private readonly repository: RuntimeLifecycleRepository) {}

  /** Transitions execution status. */
  public transition(command: ExecutionStatusTransitionCommand): void {
    this.apply(command);
  }

  /**
   * Applies an execution status transition.
   *
   * Updates execution status and records timing metadata: startedAt is set when
   * execution begins (prechecking or executing), finishedAt when execution ends.
   */
  public apply(command: ExecutionStatusTransitionCommand): void {
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
  }
}

/**
 * Service for transitioning approval status.
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
    approvalStateMachine.assertTransition(command.fromStatus, command.toStatus);
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
 * When a task reaches a terminal state (done, failed, cancelled), all related
 * entities must also reach their terminal states. This service coordinates
 * the transitions atomically to maintain consistency.
 */
class TaskTerminalTransitionService {
  public constructor(
    private readonly db: AuthoritativeSqlDatabase | null,
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
    if (this.db) {
      this.db.transaction(() => {
        this.apply(input);
      });
    } else {
      // Fallback for testing without database
      this.apply(input);
    }
  }

  /**
   * Applies terminal state transitions to all related entities.
   *
   * Maps the task terminal status to corresponding terminal statuses for
   * workflow (completed/failed/cancelled), session (completed/failed/cancelled),
   * and execution (succeeded/failed/cancelled). All transitions are validated
   * before any updates are applied.
   */
  public apply(input: TaskTerminalTransitionInput): void {
    const traceContext = buildEventTraceContext(input.context, input.taskId);
    const workflowTerminal: WorkflowStatus = input.terminalStatus === "done" ? "completed" : input.terminalStatus;
    const sessionTerminal: SessionStatus = input.terminalStatus === "done" ? "completed" : input.terminalStatus;
    const executionTerminal: ExecutionStatus = input.terminalStatus === "done" ? "succeeded" : input.terminalStatus;
    const shouldTransitionExecution = input.currentExecutionStatus !== executionTerminal;

    if (input.currentTaskStatus === input.terminalStatus) {
      throw new Error(
        `task.noop_transition_denied:${input.taskId}:${input.currentTaskStatus}->${input.terminalStatus}`,
      );
    }

    taskStateMachine.assertTransition(input.currentTaskStatus, input.terminalStatus);
    workflowStateMachine.assertTransition(input.currentWorkflowStatus, workflowTerminal);
    sessionStateMachine.assertTransition(input.currentSessionStatus, sessionTerminal);
    if (shouldTransitionExecution) {
      executionStateMachine.assertTransition(input.currentExecutionStatus, executionTerminal);
    }

    this.repository.updateTaskOutput(input.taskId, input.taskOutputJson, input.context.occurredAt);
    // R9-02 fix: Use CAS update to detect concurrent modifications
    const taskAffected = this.repository.updateTaskStatusCas(
      input.taskId,
      input.currentTaskStatus,
      input.terminalStatus,
      input.context.occurredAt,
      input.terminalStatus === "failed" ? input.context.reasonCode : null,
      input.context.occurredAt,
    );
    if (taskAffected === 0) {
      throw new Error(
        `task.transition_cas_failed:${input.taskId}:${input.currentTaskStatus}->${input.terminalStatus}`,
      );
    }
    const currentWorkflow = this.repository.getWorkflowState(input.taskId);
    const terminalStepIndex = currentWorkflow?.currentStepIndex ?? 0;

    // R9-02 fix: Use CAS update for workflow
    const workflowAffected = this.repository.updateWorkflowStateCas(
      input.taskId,
      currentWorkflow?.currentStepIndex ?? 0,
      input.currentWorkflowStatus,
      workflowTerminal,
      terminalStepIndex,
      input.outputsJson,
      input.context.occurredAt,
    );
    if (workflowAffected === 0) {
      throw new Error(
        `workflow.transition_cas_failed:${input.taskId}:${input.currentWorkflowStatus}->${workflowTerminal}`,
      );
    }

    // R9-02 fix: Use CAS update for session
    const sessionAffected = this.repository.updateSessionStatusCas(
      input.sessionId,
      input.currentSessionStatus,
      sessionTerminal,
      input.context.occurredAt,
    );
    if (sessionAffected === 0) {
      throw new Error(
        `session.transition_cas_failed:${input.sessionId}:${input.currentSessionStatus}->${sessionTerminal}`,
      );
    }

    // R9-02 fix: Use CAS update for execution
    if (shouldTransitionExecution) {
      const executionAffected = this.repository.updateExecutionStatusCas(
        input.executionId,
        input.currentExecutionStatus,
        executionTerminal,
        input.context.occurredAt,
        null,
        input.context.occurredAt,
        input.terminalStatus === "failed" ? input.context.reasonCode : null,
      );
      if (executionAffected === 0) {
        throw new Error(
          `execution.transition_cas_failed:${input.executionId}:${input.currentExecutionStatus}->${executionTerminal}`,
        );
      }
    }

    this.repository.createTier1StatusEvent({
      taskId: input.taskId,
      executionId: input.executionId,
      eventType: "task:status_changed",
      traceId: input.context.traceId,
      payload: injectTraceContext({
        fromStatus: input.currentTaskStatus,
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
 * When human approval is required, this service transitions the task to
 * "awaiting_decision", workflow to "paused", session to "awaiting_user", and
 * execution to "blocked", then creates the approval record.
 */
class ApprovalBlockingTransitionService {
  public constructor(
    private readonly db: AuthoritativeSqlDatabase | null,
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
    if (this.db) {
      return this.db.transaction(() => this.apply(input));
    }
    // Fallback for testing without database
    return this.apply(input);
  }

  /**
   * Applies the approval blocking transition.
   *
   * Creates an approval record with the request details, transitions each
   * entity (task, workflow, session, execution) to its blocked state, and
   * emits a tier-1 "decision:requested" event for reliable delivery.
   */
  public apply(input: BlockedForApprovalTransitionCommand): BlockedForApprovalTransitionResult {
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
 * TransitionService provides a unified interface for transitioning tasks, workflows,
 * sessions, executions, and approvals. It composes the individual transition
 * services and provides convenience methods for common transition scenarios,
 * including terminal transitions and approval blocking.
 */
export class TransitionService {
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

  /** Transitions a task's status. Validates against task state machine and emits events. */
  public transitionTaskStatus(command: TaskStatusTransitionCommand): void {
    this.tasks.transition(command);
  }

  /** Transitions a workflow's status, including step index and outputs. */
  public transitionWorkflowStatus(command: WorkflowStatusTransitionCommand): void {
    this.workflows.transition(command);
  }

  /** Transitions a session's status. */
  public transitionSessionStatus(command: SessionStatusTransitionCommand): void {
    this.sessions.transition(command);
  }

  /** Transitions an execution's status, recording startedAt/finishedAt timestamps. */
  public transitionExecutionStatus(command: ExecutionStatusTransitionCommand): void {
    this.executions.transition(command);
  }

  /** Transitions an approval's status (approved, rejected, expired, cancelled). */
  public transitionApprovalStatus(command: ApprovalStatusTransitionCommand): void {
    this.approvals.transition(command);
  }

  /**
   * Blocks an execution pending human approval.
   *
   * Transitions task, workflow, session, and execution to their blocked/paused
   * states, creates an approval record, and emits a decision:requested event.
   */
  public transitionBlockedForApproval(
    input: BlockedForApprovalTransitionCommand,
  ): BlockedForApprovalTransitionResult {
    return this.approvalBlocks.transition(input);
  }

  /**
   * Transitions all entities (task, workflow, session, execution) to terminal state.
   *
   * Called when a task completes, fails, or is cancelled. All related entities
   * must reach their terminal states atomically.
   */
  public transitionTaskTerminalState(input: TaskTerminalTransitionInput): void {
    this.terminalTasks.transition(input);
  }

  /**
   * Applies terminal state transitions without wrapping in a transaction.
   * Use this when the caller handles transaction management.
   */
  public applyTaskTerminalState(input: TaskTerminalTransitionInput): void {
    this.terminalTasks.apply(input);
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

function resolveExistingExecutionId(db: AuthoritativeSqlDatabase | null, executionId: string | null): string | null {
  if (executionId == null) {
    return null;
  }
  if (db == null) {
    return executionId;
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
