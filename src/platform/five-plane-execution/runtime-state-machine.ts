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
  readonly aggregateType: RuntimeStateAggregateType;
  readonly aggregate: TAggregate;
  readonly fromStatus: RuntimeStatus<TAggregate>;
  readonly toStatus: RuntimeStatus<TAggregate>;
  readonly principal: string;
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

/**
 * Callback type for persisting events produced by RuntimeStateMachine.
 * Implementations must durably write the event (e.g., to event store, outbox, or journal).
 */
export type EventPersistenceCallback = (event: PlatformFactEvent) => void;

type TransitionTable<TStatus extends string> = Record<TStatus, readonly TStatus[]>;

const HARNESS_RUN_TRANSITIONS: TransitionTable<HarnessRunStatus> = {
  created: ["admitted", "failed", "cancelled", "aborted"],
  admitted: ["planning", "ready", "failed", "cancelled", "aborted"],
  planning: ["ready", "replanning", "failed", "cancelled", "aborted"],
  ready: ["running", "paused", "failed", "cancelled", "aborted"],
  running: ["pausing", "paused", "replanning", "compensating", "completed", "failed", "cancelled", "aborted"],
  pausing: ["paused", "failed", "cancelled", "aborted"],
  paused: ["resuming", "replanning", "failed", "cancelled", "aborted"],
  resuming: ["running", "failed", "cancelled", "aborted"],
  replanning: ["ready", "running", "failed", "cancelled", "aborted"],
  compensating: ["completed", "failed", "cancelled", "aborted"],
  completed: [],
  failed: [],
  cancelled: [],
  aborted: ["paused"],
};

const NODE_RUN_TRANSITIONS: TransitionTable<NodeRunStatus> = {
  created: ["ready", "policy_blocked", "dependency_failed", "aborted"],
  ready: ["leased", "policy_blocked", "dependency_failed", "skipped", "aborted"],
  leased: ["running", "ready", "cancelled", "aborted"],
  running: ["retry_wait", "awaiting_hitl", "reconciling", "succeeded", "failed", "cancelled", "aborted"],
  retry_wait: ["ready", "failed", "aborted"],
  awaiting_hitl: ["ready", "running", "failed", "cancelled", "aborted"],
  reconciling: ["succeeded", "failed", "aborted"],
  succeeded: [],
  failed: [],
  skipped: [],
  cancelled: [],
  dependency_failed: [],
  policy_blocked: [],
  aborted: [],
};

/**
 * R20-52 FIX: Both the FSM (SIDE_EFFECT_TRANSITIONS) and the canonical contract
 * (side-effect-reconciliation-contract.md v4.3, §2) define 16 states and are
 * fully aligned.
 *
 * The contract §2 previously listed only 14 states, omitting:
 *   - manual_review_required
 *   - compensation_required
 *
 * The 16 aligned states are:
 *   proposed, approved, reserved, committing, committed, confirming,
 *   confirmed, ambiguous, reconciling, compensation_required, compensating,
 *   compensated, failed, revoked, expired, manual_review_required
 */
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
  open: ["soft_cap_reached", "hard_cap_reached", "closed"],
  soft_cap_reached: ["open", "hard_cap_reached", "closed"],
  hard_cap_reached: ["closed"],
  settling: ["closed"],
  reserving: ["closed"],
  releasing: ["closed"],
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
  private readonly persistEvent: EventPersistenceCallback | null;

  public constructor(options: { persistEvent?: EventPersistenceCallback } = {}) {
    this.persistEvent = options.persistEvent ?? (() => {});
  }

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
    assertEventPersistenceConfigured(this.persistEvent);

    const occurredAt = command.occurredAt ?? new Date(Date.now()).toISOString();
    const aggregate = applyStatus(command, occurredAt);
    const event = createPlatformFactEvent({
      eventType: `platform.${toEventNamespace(command.aggregateType)}.status_changed`,
      aggregateType: command.aggregateType,
      aggregateId: getAggregateId(command.aggregateType, aggregate),
      aggregateSeq: getAggregateSeq(aggregate),
      tenantId: command.tenantId,
      runId: getRunId(command.aggregateType, aggregate),
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

    this.persistEvent(event);

    return { aggregate, event };
  }

  public emitFactEvent(event: PlatformFactEvent): void {
    assertEventPersistenceConfigured(this.persistEvent);
    this.persistEvent(event);
  }
}

export function isTruthConsumerEvent(event: EventEnvelope): boolean {
  return event.eventType.startsWith("platform.");
}

function assertEventPersistenceConfigured(
  persistEvent: EventPersistenceCallback | null,
): asserts persistEvent is EventPersistenceCallback {
  if (persistEvent == null) {
    throw new WorkflowStateError(
      "runtime_state_machine.persistence_required",
      "RuntimeStateMachine requires an event persistence callback before transitions can be applied.",
      { details: { reason: "event persistence callback missing" } },
    );
  }
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
  const requiresAudit =
    command.aggregateType === "SideEffectRecord" ||
    command.aggregateType === "HarnessRun" ||
    command.toStatus === "succeeded" ||
    command.toStatus === "failed";
  if (requiresAudit && "commandId" in command && command.auditRef == null) {
    throw new WorkflowStateError("runtime_state_machine.audit_ref_required", "Audit ref is required for audited transitions.", {
      details: { aggregateType: command.aggregateType },
    });
  }
  if (requiresAudit && command.auditRef != null && command.auditRef.trim().length === 0) {
    throw new WorkflowStateError("runtime_state_machine.audit_ref_invalid", "Audit ref cannot be empty.", {
      details: { aggregateType: command.aggregateType },
    });
  }
}

function assertLeaseAndFencing<TAggregate extends RuntimeStateAggregate>(
  command: RuntimeTransitionCommand<TAggregate>,
): void {
  // R4-30 (INV-FENCING-001): Extend lease and fencing checks to all execution entities
  // NodeRun transitions require lease+fencing per R4-30 (original scope)
  // HarnessRun transitions for critical states also require fencing
  // SideEffectRecord commits require fencing token verification
  const requiresFencingCheck =
    command.aggregateType === "NodeRun" ||
    command.aggregateType === "HarnessRun" ||
    command.aggregateType === "SideEffectRecord" ||
    command.aggregateType === "BudgetLedger";

  if (!requiresFencingCheck) {
    return;
  }

  if (command.aggregateType === "NodeRun") {
    const nodeRun = command.aggregate as NodeRun;
    const executionStatuses: readonly string[] = [
      "leased",
      "running",
      "retry_wait",
      "awaiting_hitl",
      "reconciling",
      "succeeded",
      "failed",
    ];
    if (executionStatuses.includes(command.toStatus as string) && (command.leaseId == null || command.fencingToken == null)) {
      throw new WorkflowStateError(
        "runtime_state_machine.lease_and_fencing_required",
        "NodeRun execution transitions require an active lease and fencing token.",
        { details: { nodeRunId: nodeRun.nodeRunId } },
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

  if (command.aggregateType === "HarnessRun") {
    const harnessRun = command.aggregate as HarnessRun;
    // R4-30: HarnessRun planning/running transitions require fencing token
    const criticalStatuses: readonly string[] = ["planning", "ready", "running", "pausing", "paused", "resuming", "replanning"];
    const commandMeta = command as { commandId?: string; auditRef?: string };
    if (
      criticalStatuses.includes(command.toStatus as string) &&
      (commandMeta.commandId != null || commandMeta.auditRef?.startsWith("audit://"))
    ) {
      if (command.fencingToken == null) {
        throw new WorkflowStateError(
          "runtime_state_machine.harness_fencing_required",
          "HarnessRun critical transitions require a fencing token.",
          { details: { harnessRunId: harnessRun.harnessRunId } },
        );
      }
      if (harnessRun.fencingToken != null && command.fencingToken !== harnessRun.fencingToken) {
        throw new WorkflowStateError(
          "runtime_state_machine.harness_fencing_token_mismatch",
          "HarnessRun transition requires the active fencing token.",
          { details: { harnessRunId: harnessRun.harnessRunId } },
        );
      }
    }
  }

  if (command.aggregateType === "BudgetLedger") {
    const budgetLedger = command.aggregate as BudgetLedger;
    const commandMeta = command as { commandId?: string };
    const requiresFencing = commandMeta.commandId != null && ["soft_cap_reached", "hard_cap_reached", "closed"].includes(command.toStatus as string);
    if (requiresFencing && (command.leaseId == null || command.fencingToken == null)) {
      throw new WorkflowStateError(
        "runtime_state_machine.budget_ledger_fencing_required",
        "BudgetLedger modifying transitions require an active lease and fencing token.",
        { details: { budgetLedgerId: budgetLedger.budgetLedgerId } },
      );
    }
  }

  if (command.aggregateType === "SideEffectRecord") {
    const sideEffect = command.aggregate as SideEffectRecord;
    // R4-30: SideEffectRecord commit path transitions require fencing token
    const commitStatuses: readonly string[] = ["approved", "reserved", "committing", "committed", "confirming", "confirmed"];
    const commandMeta = command as { commandId?: string; auditRef?: string };
    if (
      commitStatuses.includes(command.toStatus as string) &&
      (sideEffect.leaseId != null || sideEffect.fencingToken != null || commandMeta.commandId != null || commandMeta.auditRef?.startsWith("audit://"))
    ) {
      if (command.leaseId == null || command.fencingToken == null) {
        throw new WorkflowStateError(
          "runtime_state_machine.side_effect_fencing_required",
          "SideEffectRecord commit transitions require an active lease and fencing token.",
          { details: { sideEffectId: sideEffect.sideEffectId } },
        );
      }
      if (sideEffect.leaseId != null && command.leaseId !== sideEffect.leaseId) {
        throw new WorkflowStateError(
          "runtime_state_machine.side_effect_lease_mismatch",
          "SideEffectRecord transition requires the active lease.",
          { details: { sideEffectId: sideEffect.sideEffectId } },
        );
      }
      if (sideEffect.fencingToken != null && command.fencingToken !== sideEffect.fencingToken) {
        throw new WorkflowStateError(
          "runtime_state_machine.side_effect_fencing_token_mismatch",
          "SideEffectRecord transition requires the active fencing token.",
          { details: { sideEffectId: sideEffect.sideEffectId } },
        );
      }
    }
  }
}

function applyStatus<TAggregate extends RuntimeStateAggregate>(
  command: RuntimeTransitionCommand<TAggregate>,
  occurredAt: string,
): TAggregate {
  switch (command.aggregateType) {
    case "HarnessRun":
      return applyHarnessRunStatus(command.aggregate as HarnessRun, command.toStatus as HarnessRunStatus, command.reasonCode, occurredAt) as TAggregate;
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
        ...(command.leaseId != null ? { leaseId: command.leaseId } : {}),
        ...(command.fencingToken != null ? { fencingToken: command.fencingToken } : {}),
        version: (command.aggregate as SideEffectRecord).version + 1,
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
        version: (command.aggregate as BudgetReservation).version + 1,
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
): HarnessRun {
  const isTerminal = status === "completed" || status === "failed" || status === "cancelled" || status === "aborted";
  return {
    ...aggregate,
    status,
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

function getRunId(aggregateType: RuntimeStateAggregateType, aggregate: RuntimeStateAggregate): string {
  switch (aggregateType) {
    case "HarnessRun":
      return (aggregate as HarnessRun).harnessRunId;
    case "NodeRun":
      return (aggregate as NodeRun).harnessRunId;
    case "SideEffectRecord":
      return (aggregate as SideEffectRecord).harnessRunId;
    case "BudgetLedger":
      return (aggregate as BudgetLedger).harnessRunId;
    case "BudgetReservation":
      return (aggregate as BudgetReservation).harnessRunId;
  }
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
