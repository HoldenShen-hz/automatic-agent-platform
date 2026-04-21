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
import type { ExecutionStatus, SessionStatus, TaskStatus, TaskTerminalStatus, WorkflowStatus } from "../../contracts/types/status.js";
import type { ApprovalStatusTransitionCommand, ExecutionStatusTransitionCommand, SessionStatusTransitionCommand, TaskStatusTransitionCommand, TransitionAuditContext, WorkflowStatusTransitionCommand } from "../../contracts/types/domain.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import { type RuntimeLifecycleRepository } from "../../state-evidence/truth/repositories/runtime-lifecycle-repository.js";
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
export declare class TaskTransitionService {
    private readonly db;
    private readonly repository;
    constructor(db: AuthoritativeSqlDatabase, repository: RuntimeLifecycleRepository);
    /**
     * Transitions task status within a database transaction.
     * Ensures atomic update and event emission.
     */
    transition(command: TaskStatusTransitionCommand): void;
    /**
     * Applies a task status transition.
     *
     * Validates the transition against the task state machine, updates the task
     * record in the repository, and emits a tier-1 event for reliable delivery.
     */
    apply(command: TaskStatusTransitionCommand): void;
}
/**
 * Service for transitioning workflow state.
 *
 * Workflows track multi-step execution progress. Updates include the current
 * step index and any accumulated outputs from previous steps.
 */
export declare class WorkflowTransitionService {
    private readonly repository;
    constructor(repository: RuntimeLifecycleRepository);
    /**
     * Transitions workflow status.
     * Note: Does not wrap in a transaction as workflows are updated independently.
     */
    transition(command: WorkflowStatusTransitionCommand): void;
    /**
     * Applies a workflow status transition.
     *
     * Updates the workflow state with the new status, step index, and outputs.
     * The outputs capture the accumulated results from completed workflow steps.
     */
    apply(command: WorkflowStatusTransitionCommand): void;
}
/**
 * Service for transitioning session status.
 *
 * Sessions track the interaction context. Status changes reflect user interaction
 * state, such as awaiting user input or completing a conversation turn.
 */
export declare class SessionTransitionService {
    private readonly repository;
    constructor(repository: RuntimeLifecycleRepository);
    /** Transitions session status. */
    transition(command: SessionStatusTransitionCommand): void;
    /**
     * Applies a session status transition.
     *
     * Updates the session status to reflect the current interaction state,
     * such as "streaming", "awaiting_user", or "completed".
     */
    apply(command: SessionStatusTransitionCommand): void;
}
/**
 * Service for transitioning execution status.
 *
 * Executions represent individual work attempts. Status changes track the
 * lifecycle from creation through execution to completion or failure.
 */
export declare class ExecutionTransitionService {
    private readonly repository;
    constructor(repository: RuntimeLifecycleRepository);
    /** Transitions execution status. */
    transition(command: ExecutionStatusTransitionCommand): void;
    /**
     * Applies an execution status transition.
     *
     * Updates execution status and records timing metadata: startedAt is set when
     * execution begins (prechecking or executing), finishedAt when execution ends.
     */
    apply(command: ExecutionStatusTransitionCommand): void;
}
/**
 * Service for transitioning approval status.
 *
 * Approvals track human authorization decisions. Status changes reflect whether
 * an approval request was approved, rejected, expired, or cancelled.
 */
export declare class ApprovalTransitionService {
    private readonly repository;
    constructor(repository: RuntimeLifecycleRepository);
    /** Transitions approval status. */
    transition(command: ApprovalStatusTransitionCommand): void;
    /**
     * Applies an approval status transition.
     *
     * Updates the approval record with the decision (approved/rejected/etc.),
     * the response JSON containing the decision details, and the response timestamp.
     */
    apply(command: ApprovalStatusTransitionCommand): void;
}
/**
 * Facade service that coordinates all entity transitions.
 *
 * TransitionService provides a unified interface for transitioning tasks, workflows,
 * sessions, executions, and approvals. It composes the individual transition
 * services and provides convenience methods for common transition scenarios,
 * including terminal transitions and approval blocking.
 */
export declare class TransitionService {
    private readonly tasks;
    private readonly workflows;
    private readonly sessions;
    private readonly executions;
    private readonly approvals;
    private readonly terminalTasks;
    private readonly approvalBlocks;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, repository?: RuntimeLifecycleRepository);
    /** Transitions a task's status. Validates against task state machine and emits events. */
    transitionTaskStatus(command: TaskStatusTransitionCommand): void;
    /** Transitions a workflow's status, including step index and outputs. */
    transitionWorkflowStatus(command: WorkflowStatusTransitionCommand): void;
    /** Transitions a session's status. */
    transitionSessionStatus(command: SessionStatusTransitionCommand): void;
    /** Transitions an execution's status, recording startedAt/finishedAt timestamps. */
    transitionExecutionStatus(command: ExecutionStatusTransitionCommand): void;
    /** Transitions an approval's status (approved, rejected, expired, cancelled). */
    transitionApprovalStatus(command: ApprovalStatusTransitionCommand): void;
    /**
     * Blocks an execution pending human approval.
     *
     * Transitions task, workflow, session, and execution to their blocked/paused
     * states, creates an approval record, and emits a decision:requested event.
     */
    transitionBlockedForApproval(input: BlockedForApprovalTransitionCommand): BlockedForApprovalTransitionResult;
    /**
     * Transitions all entities (task, workflow, session, execution) to terminal state.
     *
     * Called when a task completes, fails, or is cancelled. All related entities
     * must reach their terminal states atomically.
     */
    transitionTaskTerminalState(input: TaskTerminalTransitionInput): void;
    /**
     * Applies terminal state transitions without wrapping in a transaction.
     * Use this when the caller handles transaction management.
     */
    applyTaskTerminalState(input: TaskTerminalTransitionInput): void;
}
export {};
