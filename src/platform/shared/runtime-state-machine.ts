import { ValidationError, WorkflowStateError } from "../contracts/errors.js";
import { newId, nowIso } from "../contracts/types/ids.js";
import {
  createHarnessRun,
  createNodeRun,
  createPlatformFactEvent,
  type BudgetLedger,
  type BudgetReservation,
  type EventEnvelope,
  type HarnessRun,
  type JsonValue,
  type NodeRun,
  type PlatformFactEvent,
  type SideEffectRecord,
} from "../contracts/executable-contracts/index.js";
import {
  BUDGET_LEDGER_TRANSITIONS,
  BUDGET_RESERVATION_TRANSITIONS,
  HARNESS_RUN_TRANSITIONS,
  NODE_RUN_TRANSITIONS,
  SIDE_EFFECT_TRANSITIONS,
  type EventPersistenceCallback,
  type RuntimeStateAggregate,
  type RuntimeStateAggregateType,
  type RuntimeStatus,
  type RuntimeTransitionCommand,
  type RuntimeTransitionResult,
} from "./runtime-state-machine-model.js";
export type {
  EventPersistenceCallback,
  RuntimeBudgetPrecondition,
  RuntimePolicyGuard,
  RuntimeSideEffectSafety,
  RuntimeStateAggregate,
  RuntimeStateAggregateType,
  RuntimeTransitionCommand,
  RuntimeTransitionResult,
} from "./runtime-state-machine-model.js";

function toJsonObject(value: object): JsonValue {
  return value as JsonValue;
}

export class RuntimeStateMachine {
  private readonly persistEvent: EventPersistenceCallback | null;

  public constructor(options: { persistEvent?: EventPersistenceCallback | null } = {}) {
    this.persistEvent = Object.prototype.hasOwnProperty.call(options, "persistEvent")
      ? options.persistEvent ?? null
      : (() => {});
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
    assertEventPersistenceConfigured(this.persistEvent);
    assertLeaseAndFencing(command);

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
      payload: toJsonObject({
        aggregateType: command.aggregateType,
        fromStatus: command.fromStatus,
        toStatus: command.toStatus,
        reasonCode: command.reasonCode,
        emittedBy: command.emittedBy,
        ...(command.runVersionLockId != null ? { runVersionLockId: command.runVersionLockId } : {}),
        ...(command.policyGuard != null ? { policyGuard: command.policyGuard } : {}),
        ...(command.budgetPrecondition != null ? { budgetPrecondition: command.budgetPrecondition } : {}),
        ...(command.sideEffectSafety != null ? { sideEffectSafety: command.sideEffectSafety } : {}),
        ...(hasAuditRef(command.auditRef) ? { auditRef: command.auditRef } : {}),
      }),
      occurredAt,
    });

    this.persistEvent(event);

    return { aggregate, event };
  }

  public emitFactEvent(event: PlatformFactEvent): void {
    assertEventPersistenceConfigured(this.persistEvent);
    this.persistEvent(event);
  }

  public createHarnessRunAggregate(harnessRunId: string): HarnessRun {
    return createHarnessRun({
      harnessRunId,
      tenantId: "perf-tenant",
      orgId: "perf-org",
      traceId: newId("trace"),
      riskLevel: "medium",
      riskProfile: {
        riskClass: "medium",
        reasons: [],
      },
      ownership: { ownerId: "perf-owner", ownerType: "system" },
      auditRefs: [],
      auditTrail: { auditRefs: [], evidenceRefs: [] },
      domainId: "general_ops",
      confirmedTaskSpecId: newId("ctspec"),
      requestEnvelopeId: newId("request"),
      requestHash: newId("reqhash"),
      status: "created",
      constraintPackRef: "general_ops:default",
      versionLockId: newId("vlock"),
      budgetLedgerId: newId("bledger"),
      budgetEnvelope: {
        budgetLedgerId: newId("bledger"),
        currency: "USD",
        maxCost: 1000,
      },
      currentSeq: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      fencingToken: newId("fence"),
    });
  }

  public createNodeRunAggregate(nodeRunId: string, harnessRunId: string): NodeRun {
    return createNodeRun({
      harnessRunId,
      nodeRunId,
      planGraphBundleId: newId("bundle"),
      graphVersion: 1,
      nodeId: newId("node"),
      status: "created",
      attemptCount: 0,
      sideEffects: [],
      compensation: [],
      fencingToken: newId("fence"),
      currentSeq: 0,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }

  public buildTransitionCommand<TAggregate extends RuntimeStateAggregate>(
    aggregate: TAggregate,
    toStatus: string,
    fromStatus: string,
    command: Omit<RuntimeTransitionCommand<TAggregate>, "aggregate" | "fromStatus" | "toStatus">,
  ): RuntimeTransitionCommand<TAggregate> {
    return {
      ...command,
      aggregate,
      fromStatus: fromStatus as RuntimeStatus<TAggregate>,
      toStatus: toStatus as RuntimeStatus<TAggregate>,
      auditRef: command.auditRef ?? `perf-audit:${command.commandId}`,
    };
  }

  public validateTransition<TAggregate extends RuntimeStateAggregate>(
    aggregate: TAggregate,
    toStatus: string,
    fromStatus: string,
  ): boolean {
    try {
      assertTransitionAllowed(inferAggregateType(aggregate), fromStatus, toStatus);
      return true;
    } catch (error) {
      if (error instanceof WorkflowStateError) {
        return false;
      }
      throw error;
    }
  }

  public executeTransition<TAggregate extends RuntimeStateAggregate>(
    aggregate: TAggregate,
    toStatus: string,
    command: Omit<RuntimeTransitionCommand<TAggregate>, "aggregate" | "fromStatus" | "toStatus">,
  ): RuntimeTransitionResult<TAggregate> {
    return this.transition({
      ...command,
      aggregate,
      fromStatus: aggregate.status as RuntimeStatus<TAggregate>,
      toStatus: toStatus as RuntimeStatus<TAggregate>,
    });
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
  const allowed = (getTransitionTable(aggregateType) as Record<string, readonly string[]>)[fromStatus] ?? [];
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

function assertRunVersionLock<TAggregate extends RuntimeStateAggregate>(command: RuntimeTransitionCommand<TAggregate>): void {
  if (command.aggregateType === "HarnessRun" && command.toStatus === "admitted" && command.runVersionLockId == null) {
    throw new WorkflowStateError(
      "runtime_state_machine.run_version_lock_required",
      "HarnessRun admission requires a runVersionLockId.",
      { details: { aggregateType: command.aggregateType, toStatus: command.toStatus } },
    );
  }
}

function assertPolicyGuard<TAggregate extends RuntimeStateAggregate>(command: RuntimeTransitionCommand<TAggregate>): void {
  if (command.policyGuard?.allowed === false) {
    throw new WorkflowStateError("runtime_state_machine.policy_denied", "Policy guard denied the transition.", {
      details: { aggregateType: command.aggregateType },
    });
  }
  if (command.policyGuard != null && command.policyGuard.allowed && command.policyGuard.policyProofRef.trim().length === 0) {
    throw new WorkflowStateError("runtime_state_machine.policy_proof_required", "Policy guard requires a proof ref.", {
      details: { aggregateType: command.aggregateType },
    });
  }
}

function assertBudgetPrecondition<TAggregate extends RuntimeStateAggregate>(command: RuntimeTransitionCommand<TAggregate>): void {
  if (command.budgetPrecondition != null && !command.budgetPrecondition.hardCapSatisfied) {
    throw new WorkflowStateError(
      "runtime_state_machine.budget_precondition_failed",
      "Budget precondition failed for the transition.",
      { details: { aggregateType: command.aggregateType } },
    );
  }
}

function assertSideEffectSafety<TAggregate extends RuntimeStateAggregate>(command: RuntimeTransitionCommand<TAggregate>): void {
  if (command.aggregateType !== "SideEffectRecord") {
    return;
  }
  const sideEffect = command.aggregate as SideEffectRecord;
  const requiresApprovalSafety = command.toStatus === "approved" || command.toStatus === "committing";
  if (requiresApprovalSafety && command.sideEffectSafety?.preCommitPolicyProofRef == null) {
    throw new WorkflowStateError(
      "runtime_state_machine.pre_commit_policy_proof_required",
      "Side-effect approval transitions require a pre-commit policy proof ref.",
    );
  }
  if (
    requiresApprovalSafety
    && (sideEffect.riskClass === "high" || sideEffect.riskClass === "critical")
    && command.sideEffectSafety?.humanApprovalRef == null
  ) {
    throw new WorkflowStateError(
      "runtime_state_machine.human_approval_required",
      "High-risk side-effect approval transitions require a human approval ref.",
    );
  }
  if (command.toStatus === "committing" && command.sideEffectSafety?.idempotencyKey == null) {
    throw new ValidationError(
      "runtime_state_machine.idempotency_key_required",
      "Side-effect commit transitions require an idempotency key.",
    );
  }
}

function hasAuditRef(auditRef: string | undefined): auditRef is string {
  return typeof auditRef === "string" && auditRef.trim().length > 0;
}

function assertAuditRef<TAggregate extends RuntimeStateAggregate>(command: RuntimeTransitionCommand<TAggregate>): void {
  const requiresAuditRef =
    command.aggregateType === "HarnessRun"
    || command.aggregateType === "NodeRun"
    || command.aggregateType === "SideEffectRecord";
  if (!requiresAuditRef) {
    return;
  }
  if (!hasAuditRef(command.auditRef)) {
    throw new WorkflowStateError("runtime_state_machine.audit_ref_required", "Audit ref is required for audited transitions.", {
      details: { aggregateType: command.aggregateType, toStatus: command.toStatus },
    });
  }
}

function assertLeaseAndFencing<TAggregate extends RuntimeStateAggregate>(command: RuntimeTransitionCommand<TAggregate>): void {
  if (command.aggregateType === "NodeRun") {
    const nodeRun = command.aggregate as NodeRun;
    const requiresExecutionProtection =
      command.toStatus === "leased"
      || command.toStatus === "running"
      || command.toStatus === "retry_wait"
      || command.toStatus === "awaiting_hitl"
      || command.toStatus === "reconciling"
      || command.toStatus === "succeeded"
      || command.toStatus === "failed"
      || nodeRun.leaseId != null
      || nodeRun.fencingToken != null;
    if (requiresExecutionProtection && (command.leaseId == null || command.fencingToken == null)) {
      throw new WorkflowStateError(
        "runtime_state_machine.lease_and_fencing_required",
        "NodeRun execution transitions require an active lease and fencing token.",
      );
    }
    if (requiresExecutionProtection && nodeRun.leaseId != null && command.leaseId !== nodeRun.leaseId) {
      throw new WorkflowStateError("runtime_state_machine.lease_mismatch", "NodeRun transition requires the active lease.", {
        details: { expectedLeaseId: nodeRun.leaseId, actualLeaseId: command.leaseId },
      });
    }
    if (requiresExecutionProtection && nodeRun.fencingToken != null && command.fencingToken !== nodeRun.fencingToken) {
      throw new WorkflowStateError(
        "runtime_state_machine.fencing_token_mismatch",
        "NodeRun transition requires the active fencing token.",
        { details: { expectedFencingToken: nodeRun.fencingToken, actualFencingToken: command.fencingToken } },
      );
    }
    return;
  }

  if (command.aggregateType === "HarnessRun") {
    const harnessRun = command.aggregate as HarnessRun;
    const requiresFencing =
      command.toStatus === "running"
      || command.toStatus === "replanning"
      || command.toStatus === "compensating"
      || command.toStatus === "completed"
      || command.toStatus === "failed";
    if (requiresFencing) {
      if (command.fencingToken == null) {
        throw new WorkflowStateError(
          "runtime_state_machine.harness_fencing_required",
          "HarnessRun critical transitions require a fencing token.",
        );
      }
      if (harnessRun.fencingToken != null && command.fencingToken !== harnessRun.fencingToken) {
        throw new WorkflowStateError(
          "runtime_state_machine.harness_fencing_token_mismatch",
          "HarnessRun transition requires the active fencing token.",
          { details: { expectedFencingToken: harnessRun.fencingToken, actualFencingToken: command.fencingToken } },
        );
      }
    }
    return;
  }

  if (command.aggregateType === "BudgetLedger") {
    const requiresFencing = command.toStatus !== "open";
    if (requiresFencing && (command.leaseId == null || command.fencingToken == null)) {
      throw new WorkflowStateError(
        "runtime_state_machine.budget_ledger_fencing_required",
        "BudgetLedger modifying transitions require an active lease and fencing token.",
      );
    }
    return;
  }

  if (command.aggregateType === "SideEffectRecord") {
    const sideEffect = command.aggregate as SideEffectRecord;
    const requiresFencing = command.toStatus === "committing" || command.toStatus === "confirming";
    if (requiresFencing && (command.leaseId == null || command.fencingToken == null)) {
      throw new WorkflowStateError(
        "runtime_state_machine.side_effect_fencing_required",
        "SideEffectRecord commit transitions require an active lease and fencing token.",
      );
    }
    if (requiresFencing && sideEffect.leaseId != null && command.leaseId !== sideEffect.leaseId) {
      throw new WorkflowStateError(
        "runtime_state_machine.side_effect_lease_mismatch",
        "SideEffectRecord transition requires the active lease.",
        { details: { expectedLeaseId: sideEffect.leaseId, actualLeaseId: command.leaseId } },
      );
    }
    if (requiresFencing && sideEffect.fencingToken != null && command.fencingToken !== sideEffect.fencingToken) {
      throw new WorkflowStateError(
        "runtime_state_machine.side_effect_fencing_token_mismatch",
        "SideEffectRecord transition requires the active fencing token.",
        { details: { expectedFencingToken: sideEffect.fencingToken, actualFencingToken: command.fencingToken } },
      );
    }
  }
}

function applyStatus<TAggregate extends RuntimeStateAggregate>(
  command: RuntimeTransitionCommand<TAggregate>,
  occurredAt: string,
): TAggregate {
  const aggregate = {
    ...command.aggregate,
    status: command.toStatus,
    updatedAt: occurredAt,
    ...(command.leaseId != null ? { leaseId: command.leaseId } : {}),
    ...(command.fencingToken != null ? { fencingToken: command.fencingToken } : {}),
  } as TAggregate;

  if ("currentSeq" in aggregate) {
    const currentSeq = typeof aggregate.currentSeq === "number" ? aggregate.currentSeq : 0;
    Object.assign(aggregate, { currentSeq: currentSeq + 1 });
  }
  if ("version" in aggregate) {
    const currentVersion = typeof aggregate.version === "number" ? aggregate.version : 0;
    Object.assign(aggregate, { version: currentVersion + 1 });
  }
  if (isTerminalStatus(command.aggregateType, command.toStatus)) {
    Object.assign(aggregate, {
      terminalAt: occurredAt,
      ...(command.reasonCode.length > 0 ? { terminalReason: command.reasonCode } : {}),
    });
  }
  return aggregate;
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
  if ("currentSeq" in aggregate && typeof aggregate.currentSeq === "number") {
    return aggregate.currentSeq;
  }
  if ("version" in aggregate && typeof aggregate.version === "number") {
    return aggregate.version;
  }
  return 0;
}

function inferAggregateType(aggregate: RuntimeStateAggregate): RuntimeStateAggregateType {
  if ("harnessRunId" in aggregate && "confirmedTaskSpecId" in aggregate) {
    return "HarnessRun";
  }
  if ("nodeRunId" in aggregate) {
    return "NodeRun";
  }
  if ("sideEffectId" in aggregate) {
    return "SideEffectRecord";
  }
  if ("budgetLedgerId" in aggregate && "currency" in aggregate) {
    return "BudgetLedger";
  }
  return "BudgetReservation";
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

function getTransitionTable(aggregateType: RuntimeStateAggregateType) {
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

function isTerminalStatus(aggregateType: RuntimeStateAggregateType, status: string): boolean {
  switch (aggregateType) {
    case "HarnessRun":
      return HARNESS_RUN_TRANSITIONS[status as keyof typeof HARNESS_RUN_TRANSITIONS]?.length === 0;
    case "NodeRun":
      return NODE_RUN_TRANSITIONS[status as keyof typeof NODE_RUN_TRANSITIONS]?.length === 0;
    case "SideEffectRecord":
      return SIDE_EFFECT_TRANSITIONS[status as keyof typeof SIDE_EFFECT_TRANSITIONS]?.length === 0;
    case "BudgetLedger":
      return BUDGET_LEDGER_TRANSITIONS[status as keyof typeof BUDGET_LEDGER_TRANSITIONS]?.length === 0;
    case "BudgetReservation":
      return BUDGET_RESERVATION_TRANSITIONS[status as keyof typeof BUDGET_RESERVATION_TRANSITIONS]?.length === 0;
  }
}
