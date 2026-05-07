import { ValidationError, WorkflowStateError } from "../contracts/errors.js";
import {
  createPlatformFactEvent,
  type BudgetLedger,
  type BudgetReservation,
  type EventEnvelope,
  type HarnessRun,
  type HarnessRunStatus,
  type JsonValue,
  type NodeRun,
  type NodeRunStatus,
  type PlatformFactEvent,
  type SideEffectRecord,
  type SideEffectStatus,
} from "../contracts/executable-contracts/index.js";
import type {
  ApprovalStatus,
  ExecutionStatus,
  SessionStatus,
  TaskStatus,
  WorkflowStatus,
} from "../contracts/types/status.js";

export type RuntimeStateAggregate = HarnessRun | NodeRun | SideEffectRecord | BudgetLedger | BudgetReservation;

export type RuntimeStateAggregateType =
  | "HarnessRun"
  | "NodeRun"
  | "SideEffectRecord"
  | "BudgetLedger"
  | "BudgetReservation";

type RuntimeStatus<TAggregate extends RuntimeStateAggregate> = TAggregate extends HarnessRun
  ? HarnessRunStatus
  : TAggregate extends NodeRun
    ? NodeRunStatus
    : TAggregate extends SideEffectRecord
      ? SideEffectStatus
      : TAggregate extends BudgetLedger
        ? BudgetLedger["status"]
        : TAggregate extends BudgetReservation
          ? BudgetReservation["status"]
          : never;

export interface RuntimeTransitionCommand<TAggregate extends RuntimeStateAggregate> {
  readonly commandId: string;
  readonly entityType: RuntimeStateAggregateType;
  readonly entityId: string;
  readonly principal: string;
  readonly aggregateType: RuntimeStateAggregateType;
  readonly aggregate: TAggregate;
  readonly fromStatus: RuntimeStatus<TAggregate>;
  readonly toStatus: RuntimeStatus<TAggregate>;
  readonly expectedSeq?: number;
  readonly expectedVersion?: number;
  readonly leaseId?: string;
  readonly fencingToken?: string;
  readonly traceId: string;
  readonly tenantId: string;
  readonly reasonCode: string;
  readonly emittedBy: string;
  readonly runVersionLockId?: string;
  readonly policyGuard?: RuntimePolicyGuard;
  readonly budgetPrecondition?: RuntimeBudgetPrecondition;
  readonly sideEffectSafety?: RuntimeSideEffectSafety;
  readonly auditRef?: string;
  readonly occurredAt?: string;
}

export interface RuntimePolicyGuard {
  readonly allowed: boolean;
  readonly policyProofRef: string;
}

export interface RuntimeBudgetPrecondition {
  readonly reservationId: string;
  readonly hardCapSatisfied: boolean;
}

export interface RuntimeSideEffectSafety {
  readonly idempotencyKey?: string;
  readonly preCommitPolicyProofRef?: string;
  readonly humanApprovalRef?: string;
  readonly reversible?: boolean;
}

export interface RuntimeTransitionResult<TAggregate extends RuntimeStateAggregate> {
  readonly aggregate: TAggregate;
  readonly event: PlatformFactEvent;
}

export interface LegacyTransitionResult {
  readonly aggregate: LegacyRuntimeAggregate;
  readonly event: PlatformFactEvent;
}

export type LegacyRuntimeEntityKind = "Task" | "Workflow" | "Session" | "Execution" | "Approval";

export interface LegacyRuntimeAggregate {
  readonly legacyEntityKind: LegacyRuntimeEntityKind;
  readonly legacyEntityId: string;
  readonly status: string;
  readonly currentSeq: number;
  readonly updatedAt: string;
  readonly terminalReason?: string;
}

export interface LegacyRuntimeTransitionCommand {
  readonly commandId: string;
  readonly entityKind: LegacyRuntimeEntityKind;
  readonly entityId: string;
  readonly principal: string;
  readonly fromStatus: string;
  readonly toStatus: string;
  readonly currentSeq?: number;
  readonly tenantId: string;
  readonly traceId: string;
  readonly reasonCode: string;
  readonly emittedBy: string;
  readonly auditRef?: string;
  readonly occurredAt?: string;
  readonly correlationId?: string;
  readonly payload?: Record<string, unknown>;
}

type TransitionTable<TStatus extends string> = Record<TStatus, readonly TStatus[]>;

const LEGACY_TASK_TRANSITIONS: TransitionTable<TaskStatus> = {
  queued: ["pending", "in_progress", "cancelled"],
  pending: ["in_progress", "cancelled"],
  in_progress: ["awaiting_decision", "done", "failed", "cancelled"],
  awaiting_decision: ["in_progress", "failed", "cancelled"],
  done: [],
  failed: [],
  cancelled: [],
};

const LEGACY_WORKFLOW_TRANSITIONS: TransitionTable<WorkflowStatus> = {
  running: ["paused", "completed", "failed", "cancelling", "cancelled"],
  paused: ["resuming", "failed", "cancelled"],
  resuming: ["running", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelling: ["cancelled"],
  cancelled: [],
};

const LEGACY_SESSION_TRANSITIONS: TransitionTable<SessionStatus> = {
  open: ["streaming", "awaiting_user", "completed", "failed", "cancelled"],
  streaming: ["awaiting_user", "completed", "failed", "cancelled", "open", "paused"],
  awaiting_user: ["streaming", "completed", "failed", "cancelled", "paused"],
  paused: ["streaming", "open", "completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

const LEGACY_EXECUTION_TRANSITIONS: TransitionTable<ExecutionStatus> = {
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

const LEGACY_APPROVAL_TRANSITIONS: TransitionTable<ApprovalStatus> = {
  requested: ["approved", "rejected", "expired", "cancelled"],
  approved: [],
  rejected: [],
  expired: [],
  cancelled: [],
};

const HARNESS_RUN_TRANSITIONS: TransitionTable<HarnessRunStatus> = {
  created: ["admitted", "failed", "aborted"],
  admitted: ["planning", "ready", "failed", "aborted"],
  planning: ["ready", "replanning", "failed", "aborted"],
  ready: ["running", "paused", "failed", "aborted"],
  running: ["pausing", "paused", "replanning", "compensating", "completed", "failed", "aborted"],
  pausing: ["paused", "failed", "aborted"],
  paused: ["resuming", "replanning", "failed", "aborted"],
  resuming: ["running", "failed", "aborted"],
  replanning: ["ready", "running", "failed", "aborted"],
  compensating: ["completed", "failed", "aborted"],
  completed: [],
  failed: [],
  aborted: [],
};

const NODE_RUN_TRANSITIONS: TransitionTable<NodeRunStatus> = {
  created: ["ready", "policy_blocked", "dependency_failed", "aborted"],
  ready: ["leased", "policy_blocked", "dependency_failed", "skipped", "aborted"],
  leased: ["running", "ready", "cancelled", "aborted"],
  running: ["retry_wait", "awaiting_hitl", "reconciling", "succeeded", "failed", "cancelled", "aborted"],
  retry_wait: ["ready", "failed", "aborted"],
  awaiting_hitl: ["running", "succeeded", "failed", "cancelled", "aborted"],
  reconciling: ["succeeded", "failed", "aborted"],
  succeeded: [],
  failed: [],
  skipped: [],
  cancelled: [],
  dependency_failed: [],
  policy_blocked: [],
  aborted: [],
};

const SIDE_EFFECT_TRANSITIONS: TransitionTable<SideEffectStatus> = {
  proposed: ["approved", "reserved", "manual_review_required", "revoked", "expired", "failed"],
  approved: ["reserved", "committing", "revoked", "expired", "failed"],
  reserved: ["committing", "revoked", "expired", "failed"],
  committing: ["committed", "confirming", "confirmed", "ambiguous", "manual_review_required", "failed"],
  committed: ["confirming", "confirmed", "ambiguous", "compensation_required", "failed"],
  confirming: ["confirmed", "ambiguous", "manual_review_required", "failed"],
  confirmed: ["reconciling", "compensation_required", "compensating"],
  ambiguous: ["reconciling", "manual_review_required", "compensation_required", "compensating", "failed"],
  manual_review_required: ["approved", "reconciling", "compensation_required", "failed"],
  reconciling: ["confirmed", "ambiguous", "manual_review_required", "compensation_required", "compensating", "failed"],
  compensation_required: ["compensating", "failed"],
  compensating: ["compensated", "failed"],
  compensated: [],
  failed: [],
  revoked: [],
  expired: [],
};

const BUDGET_LEDGER_TRANSITIONS: TransitionTable<BudgetLedger["status"]> = {
  open: ["soft_cap_reached", "hard_cap_reached", "closed", "settling", "reserving", "releasing"],
  soft_cap_reached: ["open", "hard_cap_reached", "closed", "settling", "reserving", "releasing"],
  hard_cap_reached: ["closed", "settling", "reserving", "releasing"],
  settling: ["open", "soft_cap_reached", "hard_cap_reached"],
  reserving: ["open", "soft_cap_reached", "hard_cap_reached"],
  releasing: ["open", "soft_cap_reached", "hard_cap_reached"],
  closed: [],
};

const BUDGET_RESERVATION_TRANSITIONS: TransitionTable<BudgetReservation["status"]> = {
  reserved: ["settled", "released", "expired", "rejected"],
  settled: [],
  released: [],
  expired: [],
  rejected: [],
};

export class RuntimeStateMachine {
  public transition<TAggregate extends RuntimeStateAggregate>(
    command: RuntimeTransitionCommand<TAggregate>,
  ): RuntimeTransitionResult<TAggregate> {
    assertStatusMatches(command);
    assertTransitionAllowed(command.aggregateType, command.fromStatus, command.toStatus);
    assertCas(command);
    assertRunVersionLock(command);
    assertPolicyGuard(command);
    assertBudgetPrecondition(command);
    assertSideEffectSafety(command);
    assertAuditRef(command);
    assertLeaseAndFencing(command);

    const occurredAt = command.occurredAt ?? new Date(Date.now()).toISOString();
    const aggregate = applyStatus(command, occurredAt);
    const event = createPlatformFactEvent({
      eventType: `platform.${toEventNamespace(command.aggregateType)}.status_changed`,
      aggregateType: command.aggregateType,
      aggregateId: getAggregateId(command.aggregateType, aggregate),
      aggregateSeq: getAggregateSeq(aggregate),
      tenantId: command.tenantId,
      runId: command.traceId,
      traceId: command.traceId,
      payload: {
        aggregateType: command.aggregateType,
        fromStatus: command.fromStatus,
        toStatus: command.toStatus,
        reasonCode: command.reasonCode,
        emittedBy: command.emittedBy,
        ...(command.runVersionLockId != null ? { runVersionLockId: command.runVersionLockId } : {}),
        ...(command.policyGuard != null ? { policyGuard: command.policyGuard } : {}),
        ...(command.budgetPrecondition != null ? { budgetPrecondition: command.budgetPrecondition } : {}),
        ...(command.sideEffectSafety != null ? { sideEffectSafety: command.sideEffectSafety } : {}),
        ...(command.auditRef != null ? { auditRef: command.auditRef } : {}),
      } as unknown as JsonValue,
      occurredAt,
    });

    return { aggregate, event };
  }

  public transitionLegacy(
    command: LegacyRuntimeTransitionCommand,
  ): LegacyTransitionResult {
    assertLegacyTransitionAllowed(command.entityKind, command.fromStatus, command.toStatus);
    assertLegacyAuditRef(command.entityKind, command.toStatus, command.auditRef);

    const occurredAt = command.occurredAt ?? new Date(Date.now()).toISOString();
    const aggregate: LegacyRuntimeAggregate = {
      legacyEntityKind: command.entityKind,
      legacyEntityId: command.entityId,
      status: command.toStatus,
      currentSeq: (command.currentSeq ?? 0) + 1,
      updatedAt: occurredAt,
      ...(
        isLegacyTerminalStatus(command.entityKind, command.toStatus)
          ? { terminalReason: command.reasonCode }
          : {}
      ),
    };
    const event = createPlatformFactEvent({
      eventType: `platform.${toLegacyEventNamespace(command.entityKind)}.status_changed`,
      aggregateType: command.entityKind,
      aggregateId: command.entityId,
      aggregateSeq: aggregate.currentSeq,
      tenantId: command.tenantId,
      runId: command.entityId,
      traceId: command.traceId,
      payload: {
        aggregateType: command.entityKind,
        fromStatus: command.fromStatus,
        toStatus: command.toStatus,
        reasonCode: command.reasonCode,
        emittedBy: command.emittedBy,
        ...(command.auditRef != null ? { auditRef: command.auditRef } : {}),
        ...(command.payload ?? {}),
      } as JsonValue,
      occurredAt,
      ...(command.correlationId != null ? { correlationId: command.correlationId } : {}),
    });

    return { aggregate, event };
  }
}

export function isTruthConsumerEvent(event: EventEnvelope): boolean {
  return event.eventType.startsWith("platform.");
}

function assertStatusMatches<TAggregate extends RuntimeStateAggregate>(
  command: RuntimeTransitionCommand<TAggregate>,
): void {
  if (command.aggregate.status !== command.fromStatus) {
    throw new WorkflowStateError(
      "runtime_state_machine.status_mismatch",
      `Runtime aggregate status mismatch: ${command.aggregate.status} !== ${command.fromStatus}`,
      { details: { aggregateType: command.aggregateType } },
    );
  }
}

function assertTransitionAllowed(
  aggregateType: RuntimeStateAggregateType,
  fromStatus: string,
  toStatus: string,
): void {
  if (fromStatus === toStatus) {
    throw new WorkflowStateError(
      "runtime_state_machine.noop_transition_denied",
      `No-op ${aggregateType} transition is not allowed: ${fromStatus} -> ${toStatus}`,
      { details: { aggregateType, fromStatus, toStatus } },
    );
  }
  const allowed = getTransitionTable(aggregateType)[fromStatus] ?? [];
  if (!allowed.includes(toStatus)) {
    throw new WorkflowStateError(
      "runtime_state_machine.invalid_transition",
      `Invalid ${aggregateType} transition: ${fromStatus} -> ${toStatus}`,
      { details: { aggregateType, fromStatus, toStatus } },
    );
  }
}

function assertLegacyTransitionAllowed(
  entityKind: LegacyRuntimeEntityKind,
  fromStatus: string,
  toStatus: string,
): void {
  if (fromStatus === toStatus) {
    throw new WorkflowStateError(
      "runtime_state_machine.noop_transition_denied",
      `No-op ${entityKind} transition is not allowed: ${fromStatus} -> ${toStatus}`,
      { details: { entityKind, fromStatus, toStatus } },
    );
  }
  const allowed = getLegacyTransitionTable(entityKind)[fromStatus] ?? [];
  if (!allowed.includes(toStatus)) {
    throw new WorkflowStateError(
      "runtime_state_machine.invalid_transition",
      `Invalid ${entityKind} transition: ${fromStatus} -> ${toStatus}`,
      { details: { entityKind, fromStatus, toStatus } },
    );
  }
}

function assertLegacyAuditRef(
  entityKind: LegacyRuntimeEntityKind,
  toStatus: string,
  auditRef: string | undefined,
): void {
  const requiresAudit =
    entityKind === "Task" ||
    toStatus === "failed" ||
    toStatus === "cancelled" ||
    toStatus === "completed" ||
    toStatus === "succeeded" ||
    toStatus === "rejected";
  if (requiresAudit && (auditRef == null || auditRef.trim().length === 0)) {
    throw new WorkflowStateError(
      "runtime_state_machine.audit_ref_required",
      `Audit ref is required for ${entityKind} -> ${toStatus} legacy transitions.`,
      { details: { entityKind, toStatus } },
    );
  }
}

function assertCas<TAggregate extends RuntimeStateAggregate>(command: RuntimeTransitionCommand<TAggregate>): void {
  if ("currentSeq" in command.aggregate && command.expectedSeq != null && command.aggregate.currentSeq !== command.expectedSeq) {
    throw new WorkflowStateError(
      "runtime_state_machine.cas_failed",
      `CAS failed for ${command.aggregateType}: expected seq ${command.expectedSeq}`,
      { details: { aggregateType: command.aggregateType, expectedSeq: command.expectedSeq } },
    );
  }
  if ("version" in command.aggregate && command.expectedVersion != null && command.aggregate.version !== command.expectedVersion) {
    throw new WorkflowStateError(
      "runtime_state_machine.version_cas_failed",
      `Version CAS failed for ${command.aggregateType}: expected version ${command.expectedVersion}`,
      { details: { aggregateType: command.aggregateType, expectedVersion: command.expectedVersion } },
    );
  }
}

function assertRunVersionLock<TAggregate extends RuntimeStateAggregate>(
  command: RuntimeTransitionCommand<TAggregate>,
): void {
  if (command.aggregateType === "HarnessRun" && command.toStatus === "admitted" && command.runVersionLockId == null) {
    throw new WorkflowStateError(
      "runtime_state_machine.run_version_lock_required",
      "HarnessRun admission requires a frozen RunVersionLock.",
      { details: { aggregateType: command.aggregateType } },
    );
  }
}

function assertPolicyGuard<TAggregate extends RuntimeStateAggregate>(
  command: RuntimeTransitionCommand<TAggregate>,
): void {
  if (command.policyGuard == null) {
    return;
  }
  if (!command.policyGuard.allowed) {
    throw new WorkflowStateError("runtime_state_machine.policy_denied", "Policy guard denied the transition.", {
      details: { aggregateType: command.aggregateType, policyProofRef: command.policyGuard.policyProofRef },
    });
  }
  if (command.policyGuard.policyProofRef.trim().length === 0) {
    throw new WorkflowStateError("runtime_state_machine.policy_proof_required", "Policy guard requires a proof ref.", {
      details: { aggregateType: command.aggregateType },
    });
  }
}

function assertBudgetPrecondition<TAggregate extends RuntimeStateAggregate>(
  command: RuntimeTransitionCommand<TAggregate>,
): void {
  if (command.budgetPrecondition == null) {
    return;
  }
  if (!command.budgetPrecondition.hardCapSatisfied) {
    throw new WorkflowStateError(
      "runtime_state_machine.budget_hard_cap_not_satisfied",
      "Budget hard cap precondition denied the transition.",
      { details: { aggregateType: command.aggregateType, reservationId: command.budgetPrecondition.reservationId } },
    );
  }
}

function assertSideEffectSafety<TAggregate extends RuntimeStateAggregate>(
  command: RuntimeTransitionCommand<TAggregate>,
): void {
  if (command.aggregateType !== "SideEffectRecord") {
    return;
  }
  const toStatus = command.toStatus as SideEffectStatus;
  if (!["approved", "reserved", "committing", "committed", "confirming", "confirmed"].includes(toStatus)) {
    return;
  }
  if (command.sideEffectSafety?.preCommitPolicyProofRef == null) {
    throw new WorkflowStateError(
      "runtime_state_machine.side_effect_policy_proof_required",
      "Side effect commit path requires a pre-commit policy proof.",
      { details: { aggregateType: command.aggregateType } },
    );
  }
  const sideEffect = command.aggregate as SideEffectRecord;
  if ((sideEffect.riskClass === "high" || sideEffect.riskClass === "critical") && command.sideEffectSafety.humanApprovalRef == null) {
    throw new WorkflowStateError(
      "runtime_state_machine.side_effect_human_approval_required",
      "High and critical side effects require a human approval ref before commit.",
      { details: { sideEffectId: sideEffect.sideEffectId } },
    );
  }
}

function assertAuditRef<TAggregate extends RuntimeStateAggregate>(
  command: RuntimeTransitionCommand<TAggregate>,
): void {
  // R16-16 FIX: requiresAudit must check for null/undefined explicitly
  // Previously, only string empty-check was done, allowing null auditRef to pass when requiresAudit=true
  const requiresAudit =
    command.aggregateType === "HarnessRun" ||
    command.aggregateType === "SideEffectRecord" ||
    command.toStatus === "succeeded" ||
    command.toStatus === "failed";
  if (requiresAudit && (command.auditRef == null || command.auditRef.trim().length === 0)) {
    throw new WorkflowStateError("runtime_state_machine.audit_ref_required", "Audit ref is required for HarnessRun, SideEffectRecord, succeeded, and failed transitions.", {
      details: { aggregateType: command.aggregateType, toStatus: command.toStatus },
    });
  }
}

function assertLeaseAndFencing<TAggregate extends RuntimeStateAggregate>(
  command: RuntimeTransitionCommand<TAggregate>,
): void {
  // R4-30 (INV-FENCING): Extended fencing checks to all truth entities
  // Previously only NodeRun was checked; now we check all aggregate types
  const toStatus = command.toStatus as string;
  // Issue #1899 P0: NodeRun→cancelled/aborted transitions from leased/running states
  // must also require lease+fencing checks to prevent unauthorized cancellation.
  // Terminal transitions (cancelled/aborted) from active execution states require
  // lease+fencing to prevent one partition from unilaterally cancelling another.
  const terminalStatuses: readonly string[] = [
    "succeeded",
    "failed",
    "skipped",
    "cancelled",
    "dependency_failed",
    "policy_blocked",
    "aborted",
  ];
  // Issue #1899 P0: executionStatuses defines NodeRun states that require lease+fencing
  // for transitions (as opposed to terminal states handled by isTerminalFromActive)
  const executionStatuses: readonly string[] = [
    "created",
    "ready",
    "leased",
    "running",
    "retry_wait",
    "awaiting_hitl",
    "reconciling",
  ];

  if (command.aggregateType === "NodeRun") {
    const nodeRun = command.aggregate as NodeRun;
    // Check if this is a terminal transition from an active execution state
    const isTerminalFromActive = terminalStatuses.includes(toStatus) &&
      ["leased", "running", "retry_wait", "awaiting_hitl", "reconciling"].includes(nodeRun.status);
    const isExecutionTransition = executionStatuses.includes(toStatus);

    if ((isExecutionTransition || isTerminalFromActive) && (command.leaseId == null || command.fencingToken == null)) {
      throw new WorkflowStateError(
        "runtime_state_machine.lease_and_fencing_required",
        "NodeRun execution and terminal transitions require an active lease and fencing token.",
        { details: { nodeRunId: nodeRun.nodeRunId, toStatus } },
      );
    }
    if (nodeRun.leaseId != null && command.leaseId !== nodeRun.leaseId) {
      throw new WorkflowStateError("runtime_state_machine.lease_mismatch", "NodeRun transition requires the active lease.", {
        details: { nodeRunId: nodeRun.nodeRunId },
      });
    }
    if (nodeRun.fencingToken != null && command.fencingToken !== nodeRun.fencingToken) {
      throw new WorkflowStateError(
        "runtime_state_machine.fencing_token_mismatch",
        "NodeRun transition requires the active fencing token.",
        { details: { nodeRunId: nodeRun.nodeRunId } },
      );
    }
  }

  // R4-30 (INV-FENCING): HarnessRun requires fencing token for status transitions
  // to ensure proper sequencing of state changes
  if (command.aggregateType === "HarnessRun") {
    const harnessRun = command.aggregate as HarnessRun;
    const harnessExecutionStatuses: readonly string[] = [
      "admitted",
      "planning",
      "ready",
      "running",
      "pausing",
      "paused",
      "resuming",
      "replanning",
      "compensating",
    ];
    if (harnessExecutionStatuses.includes(toStatus) && (command.leaseId == null || command.fencingToken == null)) {
      throw new WorkflowStateError(
        "runtime_state_machine.lease_and_fencing_required",
        "HarnessRun status transitions require an active lease and fencing token.",
        { details: { harnessRunId: harnessRun.harnessRunId } },
      );
    }
  }

  // R4-30 (INV-FENCING): SideEffectRecord requires fencing for commit-affecting transitions
  if (command.aggregateType === "SideEffectRecord") {
    const sideEffect = command.aggregate as SideEffectRecord;
    const commitStatuses: readonly string[] = [
      "approved",
      "reserved",
      "committing",
      "committed",
      "confirming",
      "confirmed",
    ];
    if (commitStatuses.includes(toStatus) && (command.leaseId == null || command.fencingToken == null)) {
      throw new WorkflowStateError(
        "runtime_state_machine.lease_and_fencing_required",
        "SideEffectRecord commit-affecting transitions require an active lease and fencing token.",
        { details: { sideEffectId: sideEffect.sideEffectId } },
      );
    }
  }

  // R4-30 (INV-FENCING): BudgetLedger requires fencing for budget-modifying transitions
  if (command.aggregateType === "BudgetLedger") {
    const ledger = command.aggregate as BudgetLedger;
    const budgetModifyStatuses: readonly string[] = [
      "soft_cap_reached",
      "hard_cap_reached",
      "closed",
    ];
    if (budgetModifyStatuses.includes(toStatus) && (command.leaseId == null || command.fencingToken == null)) {
      throw new WorkflowStateError(
        "runtime_state_machine.lease_and_fencing_required",
        "BudgetLedger budget-modifying transitions require an active lease and fencing token.",
        { details: { budgetLedgerId: ledger.budgetLedgerId } },
      );
    }
  }

  // R4-30 (INV-FENCING): BudgetReservation requires fencing token for write operations
  // Check via aggregateType or entityId prefix (bdr_)
  const entityIdStr = command.entityId ?? "";
  if (command.aggregateType === "BudgetReservation" || entityIdStr.startsWith("bdr_")) {
    assertBudgetReservationFencing(command);
  }
}

function assertBudgetReservationFencing<TAggregate extends RuntimeStateAggregate>(
  command: RuntimeTransitionCommand<TAggregate>,
): void {
  const entityIdStr = command.entityId ?? "";
  if (command.aggregateType !== "BudgetReservation" && !entityIdStr.startsWith("bdr_")) {
    return;
  }
  // BudgetReservation requires fencing token for write operations
  if (command.fencingToken == null) {
    throw new WorkflowStateError(
      "runtime_state_machine.fencing_token_required",
      `BudgetReservation ${command.entityId}: write operation requires fencing token`,
      { details: { budgetReservationId: command.entityId } },
    );
  }
}

function applyStatus<TAggregate extends RuntimeStateAggregate>(
  command: RuntimeTransitionCommand<TAggregate>,
  occurredAt: string,
): TAggregate {
  switch (command.aggregateType) {
    case "HarnessRun":
      return applyHarnessRunStatus(
        command.aggregate as HarnessRun,
        command.toStatus as HarnessRunStatus,
        command.reasonCode,
        occurredAt,
        command.leaseId,
        command.fencingToken,
      ) as TAggregate;
    case "NodeRun":
      return applyNodeRunStatus(
        command.aggregate as NodeRun,
        command.toStatus as NodeRunStatus,
        command.reasonCode,
        occurredAt,
        command.leaseId,
        command.fencingToken,
      ) as TAggregate;
    case "SideEffectRecord":
      return {
        ...(command.aggregate as SideEffectRecord),
        status: command.toStatus as SideEffectStatus,
        updatedAt: occurredAt,
      } as TAggregate;
    case "BudgetLedger":
      return {
        ...(command.aggregate as BudgetLedger),
        status: command.toStatus as BudgetLedger["status"],
        version: (command.aggregate as BudgetLedger).version + 1,
      } as TAggregate;
    case "BudgetReservation":
      return {
        ...(command.aggregate as BudgetReservation),
        status: command.toStatus as BudgetReservation["status"],
      } as TAggregate;
    default:
      throw new ValidationError("runtime_state_machine.unknown_aggregate", "Unknown runtime aggregate type.");
  }
}

function applyHarnessRunStatus(
  aggregate: HarnessRun,
  status: HarnessRunStatus,
  terminalReason: string,
  occurredAt: string,
  leaseId?: string,
  fencingToken?: string,
): HarnessRun {
  const isTerminal = status === "completed" || status === "failed" || status === "aborted";
  return {
    ...aggregate,
    status,
    ...(leaseId != null ? { leaseId } : {}),
    ...(fencingToken != null ? { fencingToken } : {}),
    currentSeq: aggregate.currentSeq + 1,
    updatedAt: occurredAt,
    ...(isTerminal ? { terminalAt: occurredAt, terminalReason } : {}),
  };
}

function applyNodeRunStatus(
  aggregate: NodeRun,
  status: NodeRunStatus,
  terminalReason: string,
  occurredAt: string,
  leaseId?: string,
  fencingToken?: string,
): NodeRun {
  const isTerminal = [
    "succeeded",
    "failed",
    "skipped",
    "cancelled",
    "dependency_failed",
    "policy_blocked",
    "aborted",
  ].includes(status);
  return {
    ...aggregate,
    status,
    ...(leaseId != null ? { leaseId } : {}),
    ...(fencingToken != null ? { fencingToken } : {}),
    currentSeq: aggregate.currentSeq + 1,
    updatedAt: occurredAt,
    ...(isTerminal ? { terminalReason } : {}),
  };
}

function getTransitionTable(aggregateType: RuntimeStateAggregateType): Record<string, readonly string[]> {
  switch (aggregateType) {
    case "HarnessRun":
      return HARNESS_RUN_TRANSITIONS;
    case "NodeRun":
      return NODE_RUN_TRANSITIONS;
    case "SideEffectRecord":
      return SIDE_EFFECT_TRANSITIONS;
    case "BudgetLedger":
      return BUDGET_LEDGER_TRANSITIONS;
    case "BudgetReservation":
      return BUDGET_RESERVATION_TRANSITIONS;
  }
}

function getLegacyTransitionTable(entityKind: LegacyRuntimeEntityKind): Record<string, readonly string[]> {
  switch (entityKind) {
    case "Task":
      return LEGACY_TASK_TRANSITIONS;
    case "Workflow":
      return LEGACY_WORKFLOW_TRANSITIONS;
    case "Session":
      return LEGACY_SESSION_TRANSITIONS;
    case "Execution":
      return LEGACY_EXECUTION_TRANSITIONS;
    case "Approval":
      return LEGACY_APPROVAL_TRANSITIONS;
  }
}

function getAggregateId(aggregateType: RuntimeStateAggregateType, aggregate: RuntimeStateAggregate): string {
  switch (aggregateType) {
    case "HarnessRun":
      return (aggregate as HarnessRun).harnessRunId;
    case "NodeRun":
      return (aggregate as NodeRun).nodeRunId;
    case "SideEffectRecord":
      return (aggregate as SideEffectRecord).sideEffectId;
    case "BudgetLedger":
      return (aggregate as BudgetLedger).budgetLedgerId;
    case "BudgetReservation":
      return (aggregate as BudgetReservation).budgetReservationId;
  }
}

function getAggregateSeq(aggregate: RuntimeStateAggregate): number {
  if ("currentSeq" in aggregate) {
    return aggregate.currentSeq;
  }
  if ("version" in aggregate) {
    return aggregate.version;
  }
  return 1;
}

function toEventNamespace(aggregateType: RuntimeStateAggregateType): string {
  switch (aggregateType) {
    case "HarnessRun":
      return "harness_run";
    case "NodeRun":
      return "node_run";
    case "SideEffectRecord":
      return "side_effect";
    case "BudgetLedger":
      return "budget_ledger";
    case "BudgetReservation":
      return "budget_reservation";
  }
}

function toLegacyEventNamespace(entityKind: LegacyRuntimeEntityKind): string {
  switch (entityKind) {
    case "Task":
      return "task";
    case "Workflow":
      return "workflow";
    case "Session":
      return "session";
    case "Execution":
      return "execution";
    case "Approval":
      return "approval";
  }
}

function isLegacyTerminalStatus(entityKind: LegacyRuntimeEntityKind, status: string): boolean {
  switch (entityKind) {
    case "Task":
      return status === "done" || status === "failed" || status === "cancelled";
    case "Workflow":
      return status === "completed" || status === "failed" || status === "cancelled";
    case "Session":
      return status === "completed" || status === "failed" || status === "cancelled";
    case "Execution":
      return status === "succeeded" || status === "failed" || status === "cancelled" || status === "superseded";
    case "Approval":
      return status === "approved" || status === "rejected" || status === "expired" || status === "cancelled";
  }
}

function isNodeRunStatus(value: string): value is NodeRunStatus {
  return [
    "created",
    "ready",
    "leased",
    "running",
    "retry_wait",
    "awaiting_hitl",
    "reconciling",
    "succeeded",
    "failed",
    "skipped",
    "cancelled",
    "dependency_failed",
    "policy_blocked",
    "aborted",
  ].includes(value);
}
