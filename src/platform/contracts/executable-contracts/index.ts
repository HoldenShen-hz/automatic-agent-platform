import { ValidationError } from "../errors.js";
import { newId, nowIso } from "../types/ids.js";
import type { MissionBinding, MissionRef } from "../mission/index.js";
import {
  createConfirmedTaskSpec,
  createPrincipalRef,
  createRequestEnvelopeFromConfirmedTask,
  createTaskDraft,
  isHighRisk,
  normalizeDomainBindingId,
  requireNonEmpty,
  resolveDomainBindingId,
} from "./contract-domain-factories.js";
import {
  CONTRACT_SCHEMA_VERSION,
  type AppErrorRef,
  type ArtifactRef,
  type ArtifactVersionLock,
  type ArtifactVersionLockSet,
  type BudgetIntent,
  type BudgetLedger,
  type BudgetReservation,
  type BudgetReservationResult,
  type BudgetResourceKind,
  type BudgetSettlement,
  type CompensationRecord,
  type ConfirmedTaskSpec,
  type DecisionInputBundle,
  type EventEnvelope,
  type EventReplayBehavior,
  type GraphPatch,
  type GraphPatchOperation,
  type GraphValidationReport,
  type HarnessAuditTrail,
  type HarnessBudgetEnvelope,
  type HarnessDecision,
  type HarnessRun,
  type HarnessRunStatus,
  type HumanResponsibilityRecord,
  type JsonValue,
  type NodeAttempt,
  type NodeAttemptKind,
  type NodeAttemptReceipt,
  type NodeRun,
  type NodeRunStatus,
  type OapeflirViewEvent,
  type PlanGraph,
  type PlanGraphBundle,
  type PlatformFactEvent,
  type PolicyFinding,
  type PrincipalRef,
  type ReadyNodeSchedulingPolicy,
  type ReconciliationRecord,
  type RequestEnvelope,
  type RiskClass,
  type RiskPreview,
  type RunVersionLock,
  type SideEffectKind,
  type SideEffectRecord,
  type SideEffectStatus,
  type TaskDraft,
  type UserConfirmationReceipt,
  type AttemptLineage,
} from "./contract-models.js";

export * from "./schemas.js";
export * from "./contract-models.js";
export * from "./contract-envelope.js";
export * from "./contract-domain-factories.js";

export function createHarnessRun(input: {
  tenantId: string;
  orgId?: string;
  traceId?: string;
  // R3-5 fix: Add goal/mode per §45.13
  goal?: string;
  mode?: string;
  riskLevel?: RiskClass;
  riskProfile?: RiskPreview;
  ownership?: Readonly<{ ownerId: string; ownerType: string }>;
  auditRefs?: readonly string[];
  auditTrail?: HarnessAuditTrail;
  domainId?: string;
  confirmedTaskSpecId: string;
  requestEnvelopeId: string;
  requestHash: string;
  constraintPackRef: string;
  versionLockId: string;
  budgetLedgerId: string;
  budgetEnvelope?: Partial<HarnessBudgetEnvelope>;
  harnessRunId?: string;
  status?: HarnessRunStatus;
  planGraphBundleId?: string;
  leaseId?: string;
  fencingToken?: string;
  currentSeq?: number;
  createdAt?: string;
  updatedAt?: string;
  terminalAt?: string;
  terminalReason?: string;
  missionBinding?: MissionBinding;
}): HarnessRun {
  const timestamp = input.createdAt ?? nowIso();
  const harnessRunId = input.harnessRunId ?? newId("hrun");
  const riskLevel = input.riskLevel ?? "medium";
  const domainId = resolveDomainBindingId({
    ...(input.domainId != null && input.domainId.trim().length > 0 ? { explicit: input.domainId } : {}),
    refCandidate: input.constraintPackRef,
    errorCode: "harness_run.domain_id_required",
    errorMessage: "harness_run.domain_id_required: HarnessRun requires a domainId or a constraintPackRef that preserves the domain binding.",
  });
  return {
    harnessRunId,
    tenantId: input.tenantId,
    orgId: input.orgId ?? input.tenantId,
    traceId: input.traceId ?? `trace:${harnessRunId}`,
    riskLevel,
    riskProfile: input.riskProfile ?? { riskClass: riskLevel, reasons: [`risk_level:${riskLevel}`] },
    ownership: input.ownership ?? { ownerId: input.tenantId, ownerType: "tenant" },
    auditRefs: input.auditRefs ?? [],
    auditTrail: input.auditTrail ?? { auditRefs: input.auditRefs ?? [], evidenceRefs: [] },
    domainId,
    confirmedTaskSpecId: input.confirmedTaskSpecId,
    requestEnvelopeId: input.requestEnvelopeId,
    requestHash: input.requestHash,
    status: input.status ?? "created",
    constraintPackRef: input.constraintPackRef,
    versionLockId: input.versionLockId,
    ...(input.planGraphBundleId != null ? { planGraphBundleId: input.planGraphBundleId } : {}),
    budgetLedgerId: input.budgetLedgerId,
    budgetEnvelope: {
      budgetLedgerId: input.budgetEnvelope?.budgetLedgerId ?? input.budgetLedgerId,
      currency: input.budgetEnvelope?.currency ?? "credits",
      ...(input.budgetEnvelope?.maxSteps != null ? { maxSteps: input.budgetEnvelope.maxSteps } : {}),
      ...(input.budgetEnvelope?.maxCost != null ? { maxCost: input.budgetEnvelope.maxCost } : {}),
      ...(input.budgetEnvelope?.maxDurationMs != null ? { maxDurationMs: input.budgetEnvelope.maxDurationMs } : {}),
      ...(input.budgetEnvelope?.maxModelTokens != null ? { maxModelTokens: input.budgetEnvelope.maxModelTokens } : {}),
      ...(input.budgetEnvelope?.maxContextTokens != null ? { maxContextTokens: input.budgetEnvelope.maxContextTokens } : {}),
      ...(input.budgetEnvelope?.maxOutputTokens != null ? { maxOutputTokens: input.budgetEnvelope.maxOutputTokens } : {}),
    },
    ...(input.leaseId != null ? { leaseId: input.leaseId } : {}),
    fencingToken: input.fencingToken ?? `fence:${harnessRunId}:${input.currentSeq ?? 0}`,
    ...(input.missionBinding != null ? { missionBinding: input.missionBinding } : {}),
    currentSeq: input.currentSeq ?? 0,
    createdAt: timestamp,
    updatedAt: input.updatedAt ?? timestamp,
    ...(input.terminalAt != null ? { terminalAt: input.terminalAt } : {}),
    ...(input.terminalReason != null ? { terminalReason: input.terminalReason } : {}),
  };
}

export function createPlanGraphBundle(input: {
  harnessRunId: string;
  graph: PlanGraph;
  schedulerPolicy: ReadyNodeSchedulingPolicy;
  budgetPlanRef: string;
  riskProfile: RiskPreview;
  validationReport?: GraphValidationReport;
  planGraphBundleId?: string;
  graphVersion?: number;
  artifactRefs?: readonly ArtifactRef[];
  createdAt?: string;
  missionSnapshotRef?: string;
}): PlanGraphBundle {
  if (input.graph.nodes.length === 0) {
    throw new ValidationError("plan_graph.nodes_required", "plan_graph.nodes_required: PlanGraphBundle requires at least one node.");
  }
  return {
    planGraphBundleId: input.planGraphBundleId ?? newId("pgb"),
    harnessRunId: input.harnessRunId,
    graphVersion: input.graphVersion ?? 1,
    graph: input.graph,
    schedulerPolicy: input.schedulerPolicy,
    budgetPlanRef: input.budgetPlanRef,
    riskProfile: input.riskProfile,
    validationReport: input.validationReport ?? { valid: true, findings: [] },
    artifactRefs: input.artifactRefs ?? [],
    createdAt: input.createdAt ?? nowIso(),
    ...(input.missionSnapshotRef != null ? { missionSnapshotRef: input.missionSnapshotRef } : {}),
  };
}

export function createGraphPatch(input: {
  harnessRunId: string;
  baseGraphVersion: number;
  newGraphVersion: number;
  operations: readonly GraphPatchOperation[];
  affectedExecutedNodes?: readonly string[];
  affectedSideEffects?: readonly string[];
  compatibilityClass?: GraphPatch["compatibilityClass"];
  compensationPlanRef?: ArtifactRef;
  policyProofRef: ArtifactRef;
  auditRef: ArtifactRef;
  graphPatchId?: string;
}): GraphPatch {
  if (input.newGraphVersion <= input.baseGraphVersion) {
    throw new ValidationError("graph_patch.version_must_advance", "graph_patch.version_must_advance: GraphPatch newGraphVersion must advance.");
  }
  if (input.operations.length === 0) {
    throw new ValidationError("graph_patch.operations_required", "graph_patch.operations_required: GraphPatch requires at least one operation.");
  }
  const patch: GraphPatch = {
    graphPatchId: input.graphPatchId ?? newId("gpatch"),
    harnessRunId: input.harnessRunId,
    baseGraphVersion: input.baseGraphVersion,
    newGraphVersion: input.newGraphVersion,
    operations: input.operations,
    affectedExecutedNodes: input.affectedExecutedNodes ?? [],
    affectedSideEffects: input.affectedSideEffects ?? [],
    compatibilityClass: input.compatibilityClass ?? "safe_append",
    ...(input.compensationPlanRef != null ? { compensationPlanRef: input.compensationPlanRef } : {}),
    policyProofRef: input.policyProofRef,
    auditRef: input.auditRef,
  };
  assertGraphPatchSafety(patch);
  return patch;
}

export function assertGraphPatchSafety(patch: GraphPatch): void {
  const touchesExecutedFacts = patch.affectedExecutedNodes.length > 0 || patch.affectedSideEffects.length > 0;
  if (touchesExecutedFacts && patch.compatibilityClass === "safe_append") {
    throw new ValidationError(
      "graph_patch.safe_append_cannot_touch_executed_facts",
      "graph_patch.safe_append_cannot_touch_executed_facts: GraphPatch safe_append cannot affect executed nodes or side effects.",
    );
  }
  if (patch.affectedSideEffects.length > 0 && patch.compensationPlanRef == null) {
    throw new ValidationError(
      "graph_patch.compensation_required_for_side_effects",
      "graph_patch.compensation_required_for_side_effects: GraphPatch affecting side effects requires a compensation plan.",
    );
  }
  const executedNodeIds = new Set(patch.affectedExecutedNodes);
  const rewritesExecutedNode = patch.operations.some((operation) => {
    return (
      executedNodeIds.has(operation.targetRef) &&
      operation.operationType === "mark_skipped"
    );
  });
  if (rewritesExecutedNode) {
    throw new ValidationError(
      "graph_patch.executed_node_rewrite_forbidden",
      "graph_patch.executed_node_rewrite_forbidden: GraphPatch cannot disable or skip an already executed node.",
    );
  }
}

export function createNodeRun(input: {
  harnessRunId: string;
  planGraphBundleId: string;
  graphVersion: number;
  nodeId: string;
  nodeRunId?: string;
  status?: NodeRunStatus;
  attemptCount?: number;
  sideEffects?: readonly string[];
  compensation?: readonly string[];
  leaseId?: string;
  fencingToken?: string;
  currentSeq?: number;
  createdAt?: string;
  updatedAt?: string;
  missionSnapshotRef?: string;
}): NodeRun {
  const timestamp = input.createdAt ?? nowIso();
  const nodeRunId = input.nodeRunId ?? newId("nrun");
  return {
    nodeRunId,
    harnessRunId: input.harnessRunId,
    planGraphBundleId: input.planGraphBundleId,
    graphVersion: input.graphVersion,
    nodeId: input.nodeId,
    status: input.status ?? "created",
    attemptCount: input.attemptCount ?? 0,
    sideEffects: input.sideEffects ?? [],
    compensation: input.compensation ?? [],
    ...(input.leaseId != null ? { leaseId: input.leaseId } : {}),
    // Use nodeId (not nodeRunId) for default fencingToken to match harness runtime's token format.
    // The harness runtime computes fencingToken as `${node.nodeId}-fence`, so using input.nodeId
    // here ensures the default token matches when the harness runtime doesn't explicitly provide one.
    fencingToken: input.fencingToken ?? `${input.nodeId}-fence`,
    currentSeq: input.currentSeq ?? 0,
    createdAt: timestamp,
    updatedAt: input.updatedAt ?? timestamp,
    ...(input.missionSnapshotRef != null ? { missionSnapshotRef: input.missionSnapshotRef } : {}),
  };
}

export function createNodeAttempt(input: {
  nodeRunId: string;
  attemptNo: number;
  attemptKind: NodeAttemptKind;
  executorRef: string;
  inputSnapshotRef: ArtifactRef;
  nodeAttemptId?: string;
  startedAt?: string;
  completedAt?: string;
  receiptId?: string;
}): NodeAttempt {
  if (input.attemptNo < 1) {
    throw new ValidationError("node_attempt.attempt_no_invalid", "node_attempt.attempt_no_invalid: NodeAttempt attemptNo starts at 1.");
  }
  return {
    nodeAttemptId: input.nodeAttemptId ?? newId("nattempt"),
    nodeRunId: input.nodeRunId,
    attemptNo: input.attemptNo,
    attemptKind: input.attemptKind,
    startedAt: input.startedAt ?? nowIso(),
    ...(input.completedAt != null ? { completedAt: input.completedAt } : {}),
    executorRef: input.executorRef,
    inputSnapshotRef: input.inputSnapshotRef,
    ...(input.receiptId != null ? { receiptId: input.receiptId } : {}),
  };
}

export function createAttemptLineage(input: {
  nodeRunId: string;
  reason: string;
  createdBy: string;
  attemptLineageId?: string;
  previousAttemptId?: string;
  nextAttemptId?: string;
  createdAt?: string;
}): AttemptLineage {
  requireNonEmpty(input.reason, "attempt_lineage.reason_required");
  return {
    attemptLineageId: input.attemptLineageId ?? newId("alineage"),
    nodeRunId: input.nodeRunId,
    ...(input.previousAttemptId != null ? { previousAttemptId: input.previousAttemptId } : {}),
    ...(input.nextAttemptId != null ? { nextAttemptId: input.nextAttemptId } : {}),
    reason: input.reason,
    createdBy: input.createdBy,
    createdAt: input.createdAt ?? nowIso(),
  };
}

export function createNodeAttemptReceipt(input: {
  nodeAttemptId: string;
  nodeRunId: string;
  harnessRunId: string;
  planGraphId: string;
  graphVersion: number;
  receiptKind: NodeAttemptReceipt["receiptKind"];
  status: NodeAttemptReceipt["status"];
  duration: number;
  errorDetail?: string;
  nodeAttemptReceiptId?: string;
  outputRef?: ArtifactRef;
  error?: AppErrorRef;
  sideEffectRefs?: readonly string[];
  budgetSettlementRefs?: readonly string[];
  evidenceRefs?: readonly ArtifactRef[];
  producedAt?: string;
}): NodeAttemptReceipt {
  return {
    nodeAttemptReceiptId: input.nodeAttemptReceiptId ?? newId("nreceipt"),
    nodeAttemptId: input.nodeAttemptId,
    nodeRunId: input.nodeRunId,
    harnessRunId: input.harnessRunId,
    planGraphId: input.planGraphId,
    graphVersion: input.graphVersion,
    receiptKind: input.receiptKind,
    status: input.status,
    duration: input.duration,
    ...(input.outputRef != null ? { outputRef: input.outputRef } : {}),
    ...(input.error != null ? { error: input.error } : {}),
    errorDetail: input.errorDetail
      ?? input.error?.message
      ?? (input.status === "failed" ? "node_attempt.failed" : "node_attempt.no_error_detail"),
    sideEffectRefs: input.sideEffectRefs ?? [],
    budgetSettlementRefs: input.budgetSettlementRefs ?? [],
    evidenceRefs: input.evidenceRefs ?? [],
    producedAt: input.producedAt ?? nowIso(),
  };
}

export function createSideEffectRecord(input: {
  harnessRunId: string;
  nodeRunId: string;
  nodeAttemptId: string;
  effectKind: SideEffectKind;
  idempotencyKey: string;
  riskClass: RiskClass;
  preCommitPolicyProofRef: ArtifactRef;
  sideEffectId?: string;
  status?: SideEffectStatus;
  leaseId?: string;
  fencingToken?: string;
  approvalRef?: string;
  externalRef?: string;
  deadline?: string;
  /** R13-35: rollback handler with timeout in milliseconds */
  rollbackHandler?: {
    handler: string;
    timeout: number;
  };
  compensationPlan?: string;
  createdAt?: string;
  updatedAt?: string;
  version?: number;
}): SideEffectRecord {
  const timestamp = input.createdAt ?? nowIso();
  return {
    sideEffectId: input.sideEffectId ?? newId("seffect"),
    harnessRunId: input.harnessRunId,
    nodeRunId: input.nodeRunId,
    nodeAttemptId: input.nodeAttemptId,
    effectKind: input.effectKind,
    idempotencyKey: input.idempotencyKey,
    status: input.status ?? "proposed",
    riskClass: input.riskClass,
    ...(input.leaseId != null ? { leaseId: input.leaseId } : {}),
    ...(input.fencingToken != null ? { fencingToken: input.fencingToken } : {}),
    ...(input.approvalRef != null ? { approvalRef: input.approvalRef } : {}),
    preCommitPolicyProofRef: input.preCommitPolicyProofRef,
    ...(input.externalRef != null ? { externalRef: input.externalRef } : {}),
    deadline: input.deadline ?? new Date(Date.parse(timestamp) + 5 * 60_000).toISOString(),
    ...(input.rollbackHandler != null ? { rollbackHandler: input.rollbackHandler } : {}),
    ...(input.compensationPlan != null ? { compensationPlan: input.compensationPlan } : {}),
    createdAt: timestamp,
    updatedAt: input.updatedAt ?? timestamp,
    version: input.version ?? 0,
  };
}

export function createReconciliationRecord(input: {
  sideEffectId: string;
  probeKind: string;
  externalObservedState: JsonValue;
  result: ReconciliationRecord["result"];
  nextAction: ReconciliationRecord["nextAction"];
  reconciliationId?: string;
  evidenceRefs?: readonly ArtifactRef[];
  createdAt?: string;
}): ReconciliationRecord {
  return {
    reconciliationId: input.reconciliationId ?? newId("recon"),
    sideEffectId: input.sideEffectId,
    probeKind: input.probeKind,
    externalObservedState: input.externalObservedState,
    result: input.result,
    evidenceRefs: input.evidenceRefs ?? [],
    nextAction: input.nextAction,
    createdAt: input.createdAt ?? nowIso(),
  };
}

export function createCompensationRecord(input: {
  sideEffectId: string;
  harnessRunId: string;
  planRef: ArtifactRef;
  status?: CompensationRecord["status"];
  compensationId?: string;
  evidenceRefs?: readonly ArtifactRef[];
  createdAt?: string;
  completedAt?: string;
}): CompensationRecord {
  return {
    compensationId: input.compensationId ?? newId("comp"),
    sideEffectId: input.sideEffectId,
    harnessRunId: input.harnessRunId,
    planRef: input.planRef,
    status: input.status ?? "planned",
    evidenceRefs: input.evidenceRefs ?? [],
    createdAt: input.createdAt ?? nowIso(),
    ...(input.completedAt != null ? { completedAt: input.completedAt } : {}),
  };
}

export function createBudgetLedger(input: {
  tenantId: string;
  harnessRunId?: string;
  currency?: string;
  hardCap: number;
  budgetLedgerId?: string;
  resourceKinds?: readonly BudgetResourceKind[];
  tier?: "platform" | "tenant" | "pack" | "step";
  scopeKey?: string;
  parentBudgetLedgerId?: string;
  softCap?: number;
  reservedAmount?: number;
  settledAmount?: number;
  releasedAmount?: number;
  status?: BudgetLedger["status"];
  version?: number;
  createdAt?: string;
  updatedAt?: string;
}): BudgetLedger {
  requireNonNegative(input.hardCap, "budget_ledger.hard_cap_invalid");
  const createdAt = input.createdAt ?? nowIso();
  return {
    budgetLedgerId: input.budgetLedgerId ?? newId("bledger"),
    tenantId: input.tenantId,
    harnessRunId: input.harnessRunId ?? "legacy-harness-run",
    ...(input.tier != null ? { tier: input.tier } : {}),
    ...(input.scopeKey != null ? { scopeKey: input.scopeKey } : {}),
    ...(input.parentBudgetLedgerId != null ? { parentBudgetLedgerId: input.parentBudgetLedgerId } : {}),
    currency: input.currency ?? "USD",
    hardCap: input.hardCap,
    ...(input.softCap != null ? { softCap: input.softCap } : {}),
    reservedAmount: input.reservedAmount ?? 0,
    settledAmount: input.settledAmount ?? 0,
    releasedAmount: input.releasedAmount ?? 0,
    status: input.status ?? "open",
    version: input.version ?? 0,
    resourceKinds: input.resourceKinds ?? [],
    createdAt,
    updatedAt: input.updatedAt ?? createdAt,
  } as BudgetLedger;
}

export function createBudgetReservation(input: {
  budgetLedgerId?: string;
  ledger?: BudgetLedger;
  harnessRunId?: string;
  amount: number;
  resourceKind: BudgetResourceKind;
  expiresAt: string;
  budgetReservationId?: string;
  reservationId?: string;
  nodeRunId?: string;
  status?: BudgetReservation["status"];
  createdAt?: string;
  version?: number;
}): BudgetReservation {
  requirePositive(input.amount, "budget_reservation.amount_invalid");
  const budgetReservationId = input.budgetReservationId ?? input.reservationId ?? newId("bresv");
  return {
    budgetReservationId,
    reservationId: budgetReservationId,
    budgetLedgerId: input.budgetLedgerId ?? input.ledger?.budgetLedgerId ?? "legacy-budget-ledger",
    harnessRunId: input.harnessRunId ?? input.ledger?.harnessRunId ?? "legacy-harness-run",
    ...(input.nodeRunId != null ? { nodeRunId: input.nodeRunId } : {}),
    amount: input.amount,
    resourceKind: input.resourceKind,
    status: input.status ?? "reserved",
    expiresAt: input.expiresAt,
    createdAt: input.createdAt ?? nowIso(),
    version: input.version ?? 0,
  } as BudgetReservation;
}

export function reserveBudgetHardCap(input: {
  ledger: BudgetLedger;
  amount: number;
  resourceKind: BudgetResourceKind;
  expiresAt: string;
  expectedVersion: number;
  nodeRunId?: string;
  createdAt?: string;
}): BudgetReservationResult {
  if (input.ledger.version !== input.expectedVersion) {
    throw new ValidationError(
      "budget_reservation.version_cas_failed",
      "budget_reservation.version_cas_failed: Budget reservation requires the current ledger version.",
    );
  }
  requirePositive(input.amount, "budget_reservation.amount_invalid");
  const activeCommittedAmount = input.ledger.reservedAmount + input.ledger.settledAmount - input.ledger.releasedAmount;
  if (activeCommittedAmount + input.amount > input.ledger.hardCap) {
    throw new ValidationError("budget_reservation.hard_cap_exceeded", "budget_reservation.hard_cap_exceeded: Budget reservation exceeds hard cap.");
  }
  const computedStatus = activeCommittedAmount + input.amount === input.ledger.hardCap ? "hard_cap_reached" : input.ledger.status;
  // Only bump version if this function is computing the status transition itself.
  // When ledger.status is not "open", the state machine already handled the version bump
  // for any status transition, so we should not bump again.
  const versionIncrement = input.ledger.status === "open" ? 1 : 0;
  const ledger: BudgetLedger = {
    ...input.ledger,
    reservedAmount: input.ledger.reservedAmount + input.amount,
    status: computedStatus,
    version: input.ledger.version + versionIncrement,
  };
  const reservation = createBudgetReservation({
    budgetLedgerId: input.ledger.budgetLedgerId,
    harnessRunId: input.ledger.harnessRunId,
    ...(input.nodeRunId != null ? { nodeRunId: input.nodeRunId } : {}),
    amount: input.amount,
    resourceKind: input.resourceKind,
    expiresAt: input.expiresAt,
    ...(input.createdAt != null ? { createdAt: input.createdAt } : {}),
  });
  return { ledger, reservation };
}

export function createBudgetSettlement(input: {
  budgetReservationId?: string;
  reservation?: BudgetReservation;
  actualAmount: number;
  settlementKind?: BudgetSettlement["settlementKind"];
  budgetSettlementId?: string;
  settlementId?: string;
  evidenceRefs?: readonly ArtifactRef[];
  createdAt?: string;
}): BudgetSettlement {
  requireNonNegative(input.actualAmount, "budget_settlement.actual_amount_invalid");
  const budgetSettlementId = input.budgetSettlementId ?? input.settlementId ?? newId("bsettle");
  const budgetReservationId = input.budgetReservationId ?? input.reservation?.budgetReservationId ?? input.reservation?.["reservationId" as keyof BudgetReservation] as string | undefined;
  return {
    budgetSettlementId,
    settlementId: budgetSettlementId,
    budgetReservationId: budgetReservationId ?? "legacy-budget-reservation",
    reservationId: budgetReservationId ?? "legacy-budget-reservation",
    actualAmount: input.actualAmount,
    settlementKind: input.settlementKind ?? "final",
    evidenceRefs: input.evidenceRefs ?? [],
    createdAt: input.createdAt ?? nowIso(),
  } as BudgetSettlement;
}

export function createRunVersionLock(input: {
  harnessRunId: string;
  runtimeProfileVersion: string;
  runVersionLockId?: string;
  schemaVersion?: string;
  promptVersions?: Readonly<Record<string, string>>;
  policyVersions?: Readonly<Record<string, string>>;
  toolVersions?: Readonly<Record<string, string>>;
  modelVersions?: Readonly<Record<string, string>>;
  evalVersions?: Readonly<Record<string, string>>;
  guardrailVersions?: Readonly<Record<string, string>>;
  domainVersions?: Readonly<Record<string, string>>;
  createdAt?: string;
}): RunVersionLock {
  return {
    runVersionLockId: input.runVersionLockId ?? newId("rvlock"),
    harnessRunId: input.harnessRunId,
    schemaVersion: input.schemaVersion ?? CONTRACT_SCHEMA_VERSION,
    runtimeProfileVersion: input.runtimeProfileVersion,
    promptVersions: input.promptVersions ?? {},
    policyVersions: input.policyVersions ?? {},
    toolVersions: input.toolVersions ?? {},
    modelVersions: input.modelVersions ?? {},
    evalVersions: input.evalVersions ?? {},
    guardrailVersions: input.guardrailVersions ?? {},
    domainVersions: input.domainVersions ?? {},
    createdAt: input.createdAt ?? nowIso(),
  };
}

export function createArtifactVersionLockSet(input: {
  harnessRunId: string;
  artifactLocks: readonly ArtifactVersionLock[];
  artifactVersionLockSetId?: string;
  createdAt?: string;
}): ArtifactVersionLockSet {
  if (input.artifactLocks.length === 0) {
    throw new ValidationError(
      "artifact_version_lock_set.artifact_locks_required",
      "artifact_version_lock_set.artifact_locks_required: ArtifactVersionLockSet requires at least one artifact lock.",
    );
  }
  return {
    artifactVersionLockSetId: input.artifactVersionLockSetId ?? newId("avlocks"),
    harnessRunId: input.harnessRunId,
    artifactLocks: input.artifactLocks,
    createdAt: input.createdAt ?? nowIso(),
  };
}

export function createDecisionInputBundle(input: {
  harnessRunId: string;
  decisionKind: DecisionInputBundle["decisionKind"];
  riskClass: RiskClass;
  decisionInputBundleId?: string;
  nodeRunId?: string;
  contextRefs?: readonly ArtifactRef[];
  evidenceRefs?: readonly ArtifactRef[];
  policyFindings?: readonly PolicyFinding[];
  budgetSnapshotRef?: ArtifactRef;
  sideEffectRefs?: readonly string[];
  /** §45.25: Frozen evaluator state captured at decision time */
  evaluator?: Readonly<{
    readonly score: number;
    readonly reasoning: string;
  }>;
  /** §45.25: Frozen policy state captured at decision time */
  policy?: Readonly<{
    readonly policyIds: readonly string[];
    readonly constraintPackRef: string;
  }>;
  /** §45.25: Frozen budget state captured at decision time */
  budget?: Readonly<{
    readonly remainingSteps: number;
    readonly remainingCost: number;
    readonly remainingDurationMs: number;
  }>;
  /** §45.25: Frozen risk state captured at decision time */
  risk?: Readonly<{
    readonly currentScore: number;
    readonly maxScore: number;
    readonly escalationThreshold: number;
  }>;
  /** §45.25: Frozen node state captured at decision time */
  node?: Readonly<{
    readonly nodeId: string;
    readonly nodeType: string;
    readonly status: string;
  }>;
  /** §45.25: Frozen sideEffect state captured at decision time */
  sideEffect?: Readonly<{
    readonly mayCommit: boolean;
    readonly reversible: boolean;
  }>;
  /** §45.25: Frozen hitl state captured at decision time */
  hitl?: Readonly<{
    readonly pending: boolean;
    readonly requestId: string | null;
  }>;
  /** §45.25: Frozen guardrail assessment captured at decision time */
  guardrail?: Readonly<{
    readonly passed: boolean;
    readonly requiresHuman: boolean;
    readonly suggestedAction: string;
    readonly findings: readonly { readonly code: string; readonly message: string }[];
  }> | null;
  createdAt?: string;
}): DecisionInputBundle {
  const createdAt = input.createdAt ?? nowIso();
  return {
    decisionInputBundleId: input.decisionInputBundleId ?? newId("dib"),
    harnessRunId: input.harnessRunId,
    ...(input.nodeRunId != null ? { nodeRunId: input.nodeRunId } : {}),
    decisionKind: input.decisionKind,
    riskClass: input.riskClass,
    contextRefs: input.contextRefs ?? [],
    evidenceRefs: input.evidenceRefs ?? [],
    policyFindings: input.policyFindings ?? [],
    ...(input.budgetSnapshotRef != null ? { budgetSnapshotRef: input.budgetSnapshotRef } : {}),
    sideEffectRefs: input.sideEffectRefs ?? [],
    // §45.25: Always include frozen state fields with defaults when not provided
    evaluator: input.evaluator ?? { score: 0, reasoning: "" },
    policy: input.policy ?? { policyIds: [], constraintPackRef: "" },
    budget: input.budget ?? { remainingSteps: 0, remainingCost: 0, remainingDurationMs: 0 },
    risk: input.risk ?? { currentScore: 0, maxScore: 1, escalationThreshold: 0.7 },
    node: input.node ?? { nodeId: "", nodeType: "", status: "" },
    sideEffect: input.sideEffect ?? { mayCommit: false, reversible: false },
    hitl: input.hitl ?? { pending: false, requestId: null },
    guardrail: input.guardrail ?? null,
    createdAt,
  };
}

export function createHarnessDecision(input: {
  decisionInputBundleId: string;
  decisionKind: HarnessDecision["decisionKind"];
  decision: HarnessDecision["decision"];
  deciderType: HarnessDecision["deciderType"];
  deciderRef: string;
  reasonCode: string;
  harnessDecisionId?: string;
  expiresAt?: string;
  createdAt?: string;
}): HarnessDecision {
  return {
    harnessDecisionId: input.harnessDecisionId ?? newId("hdecision"),
    decisionInputBundleId: input.decisionInputBundleId,
    decisionKind: input.decisionKind,
    decision: input.decision,
    deciderType: input.deciderType,
    deciderRef: input.deciderRef,
    reasonCode: input.reasonCode,
    ...(input.expiresAt != null ? { expiresAt: input.expiresAt } : {}),
    createdAt: input.createdAt ?? nowIso(),
  };
}

export function createHumanResponsibilityRecord(input: {
  harnessDecisionId: string;
  humanActorRef: PrincipalRef;
  responsibilityScope: HumanResponsibilityRecord["responsibilityScope"];
  acknowledgedRiskClass: RiskClass;
  acknowledgementReceiptRef: ArtifactRef;
  humanResponsibilityRecordId?: string;
  effectiveFrom?: string;
  expiresAt?: string;
}): HumanResponsibilityRecord {
  if (isHighRisk(input.acknowledgedRiskClass) && input.expiresAt == null) {
    throw new ValidationError(
      "human_responsibility_record.expires_at_required",
      "human_responsibility_record.expires_at_required: High and critical human responsibility records require expiresAt.",
    );
  }
  return {
    humanResponsibilityRecordId: input.humanResponsibilityRecordId ?? newId("hrrecord"),
    harnessDecisionId: input.harnessDecisionId,
    humanActorRef: input.humanActorRef,
    responsibilityScope: input.responsibilityScope,
    acknowledgedRiskClass: input.acknowledgedRiskClass,
    acknowledgementReceiptRef: input.acknowledgementReceiptRef,
    effectiveFrom: input.effectiveFrom ?? nowIso(),
    ...(input.expiresAt != null ? { expiresAt: input.expiresAt } : {}),
  };
}

export function createPlatformFactEvent<TPayload extends JsonValue>(input: {
  eventType: `platform.${string}`;
  aggregateType: string;
  aggregateId: string;
  aggregateSeq: number;
  tenantId: string;
  runId?: string;
  traceId: string;
  payload: TPayload;
  source?: string;
  eventId?: string;
  schemaVersion?: number;
  causationId?: string;
  correlationId?: string;
  payloadHash?: string;
  replayBehavior?: EventReplayBehavior;
  schemaOwner?: string;
  consumerContractTests?: readonly string[];
  occurredAt?: string;
}): PlatformFactEvent<TPayload> {
  assertPlatformEventType(input.eventType);
  return {
    eventId: input.eventId ?? newId("evt"),
    runId: input.runId ?? input.aggregateId,
    eventType: input.eventType,
    schemaVersion: input.schemaVersion ?? 1,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    aggregateSeq: input.aggregateSeq,
    tenantId: input.tenantId,
    traceId: input.traceId,
    ...(input.causationId != null ? { causationId: input.causationId } : {}),
    correlationId: input.correlationId ?? input.runId ?? input.aggregateId,
    payloadHash: input.payloadHash ?? newId("payloadhash"),
    payload: input.payload,
    replayBehavior: input.replayBehavior ?? "replay_as_fact",
    source: input.source ?? "platform-runtime",
    sourceOfTruth: "platform",
    schemaOwner: input.schemaOwner ?? "platform-runtime",
    consumerContractTests: input.consumerContractTests ?? [],
    occurredAt: input.occurredAt ?? nowIso(),
  };
}

export function createOapeflirViewEvent<TPayload extends JsonValue>(input: {
  eventType: `oapeflir.view.${string}` | `oapeflir.rationale.${string}`;
  aggregateType: string;
  aggregateId: string;
  aggregateSeq: number;
  tenantId: string;
  runId?: string;
  traceId: string;
  payload: TPayload;
  derivedFromEventIds: readonly string[];
  eventId?: string;
  schemaVersion?: number;
  causationId?: string;
  correlationId?: string;
  payloadHash?: string;
  replayBehavior?: EventReplayBehavior;
  schemaOwner?: string;
  consumerContractTests?: readonly string[];
  occurredAt?: string;
}): OapeflirViewEvent<TPayload> {
  assertOapeflirViewEventType(input.eventType);
  if (input.derivedFromEventIds.length === 0) {
    throw new ValidationError(
      "oapeflir_view_event.derived_from_required",
      "oapeflir_view_event.derived_from_required: OAPEFLIR view events require at least one source event.",
    );
  }
  return {
    eventId: input.eventId ?? newId("evt"),
    runId: input.runId ?? input.aggregateId,
    eventType: input.eventType,
    schemaVersion: input.schemaVersion ?? 1,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    aggregateSeq: input.aggregateSeq,
    tenantId: input.tenantId,
    traceId: input.traceId,
    ...(input.causationId != null ? { causationId: input.causationId } : {}),
    correlationId: input.correlationId ?? input.runId ?? input.aggregateId,
    payloadHash: input.payloadHash ?? newId("payloadhash"),
    payload: input.payload,
    replayBehavior: input.replayBehavior ?? "simulate",
    sourceOfTruth: "projection",
    schemaOwner: input.schemaOwner ?? "oapeflir-projection",
    consumerContractTests: input.consumerContractTests ?? [],
    occurredAt: input.occurredAt ?? nowIso(),
    derivedFromEventIds: input.derivedFromEventIds,
    projectionOnly: true,
  };
}

export function isPlatformFactEvent(event: EventEnvelope): event is PlatformFactEvent {
  return event.eventType.startsWith("platform.");
}

export function isOapeflirViewEvent(event: EventEnvelope): event is OapeflirViewEvent {
  return event.eventType.startsWith("oapeflir.view.") || event.eventType.startsWith("oapeflir.rationale.");
}

export function canTruthConsumerConsume(event: EventEnvelope): boolean {
  return isPlatformFactEvent(event);
}

function requireNonNegative(value: number, code: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new ValidationError(code, `${code}: Value must be a finite non-negative number.`);
  }
}

function requirePositive(value: number, code: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new ValidationError(code, `${code}: Value must be a finite positive number.`);
  }
}

function assertPlatformEventType(eventType: string): void {
  if (!eventType.startsWith("platform.")) {
    throw new ValidationError("platform_fact_event.namespace_required", "platform_fact_event.namespace_required: Platform fact events must use platform.*.");
  }
}

function assertOapeflirViewEventType(eventType: string): void {
  if (!eventType.startsWith("oapeflir.view.") && !eventType.startsWith("oapeflir.rationale.")) {
    throw new ValidationError(
      "oapeflir_view_event.namespace_required",
      "oapeflir_view_event.namespace_required: OAPEFLIR view events must use oapeflir.view.* or oapeflir.rationale.*.",
    );
  }
}
