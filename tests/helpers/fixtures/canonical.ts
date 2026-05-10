/**
 * Canonical Test Fixtures
 *
 * Factory functions for creating canonical test objects (HarnessRun, NodeRun,
 * PlanGraphBundle, BudgetReservation, etc.) per R6-32.
 *
 * These fixtures replace legacy TaskRecord+ExecutionRecord fixtures with
 * the v4.3 canonical model. Use these when writing new tests or updating
 * existing tests to use the canonical execution model.
 *
 * Usage:
 * ```typescript
 * import { createMinimalHarnessRun, createMinimalNodeRun, createMinimalPlanGraphBundle } from './canonical.js';
 *
 * test("E2E with canonical model", () => {
 *   const harnessRun = createMinimalHarnessRun({ tenantId: "tenant-1" });
 *   const planGraphBundle = createMinimalPlanGraphBundle({ harnessRunId: harnessRun.harnessRunId });
 *   const nodeRun = createMinimalNodeRun({ harnessRunId: harnessRun.harnessRunId, planGraphBundleId: planGraphBundle.planGraphBundleId, nodeId: planGraphBundle.graph.nodes[0].nodeId });
 * });
 * ```
 */

import { nowIso, newId } from "../../../src/platform/contracts/types/ids.js";
import type {
  HarnessRun,
  HarnessRunStatus,
  PlanGraphBundle,
  PlanGraph,
  PlanNode,
  PlanEdge,
  PlanNodeType,
  NodeRun,
  NodeRunStatus,
  NodeAttempt,
  NodeAttemptReceipt,
  SideEffectRecord,
  SideEffectStatus,
  SideEffectKind,
  BudgetReservation,
  BudgetLedger,
  BudgetResourceKind,
  RiskClass,
  ArtifactRef,
  GraphValidationReport,
  ReadyNodeSchedulingPolicy,
  PrincipalRef,
  BudgetIntent,
  RiskPreview,
} from "../../../src/platform/contracts/executable-contracts/index.js";
import { createBudgetReservation as factoryCreateBudgetReservation, createSideEffectRecord as factoryCreateSideEffectRecord } from "../../../src/platform/contracts/executable-contracts/index.js";

const DEFAULT_NOW = nowIso();

// ---------------------------------------------------------------------------
// Principal & Risk Preview Helpers
// ---------------------------------------------------------------------------

export function createTestPrincipal(overrides: Partial<PrincipalRef> = {}): PrincipalRef {
  return {
    principalId: "principal-test-001",
    tenantId: "tenant-test-001",
    roles: ["test_role"],
    displayName: "Test Principal",
    ...overrides,
  };
}

export function createTestRiskPreview(riskClass: RiskClass = "low"): RiskPreview {
  return {
    riskClass,
    reasons: ["test risk preview"],
  };
}

export function createTestArtifactRef(overrides: Partial<ArtifactRef> = {}): ArtifactRef {
  return {
    artifactId: "artifact-test-001",
    uri: "memory://test/artifact-001",
    hash: "sha256:test",
    version: "1.0.0",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// HarnessRun Factories
// ---------------------------------------------------------------------------

export interface MinimalHarnessRunInput {
  tenantId?: string;
  confirmedTaskSpecId?: string;
  requestEnvelopeId?: string;
  requestHash?: string;
  constraintPackRef?: string;
  versionLockId?: string;
  budgetLedgerId?: string;
  status?: HarnessRunStatus;
  planGraphBundleId?: string;
  currentSeq?: number;
  createdAt?: string;
  updatedAt?: string;
  overrides?: Partial<HarnessRun>;
}

export function createMinimalHarnessRun(input: MinimalHarnessRunInput = {}): HarnessRun {
  const now = input.createdAt ?? DEFAULT_NOW;
  return {
    harnessRunId: newId("hrun"),
    tenantId: input.tenantId ?? "tenant-test-001",
    orgId: input.overrides?.orgId ?? "org-test-001",
    traceId: input.overrides?.traceId ?? newId("trace"),
    domainId: input.overrides?.domainId ?? "domain-test-001",
    riskLevel: input.overrides?.riskLevel ?? "low",
    riskProfile: input.overrides?.riskProfile ?? createTestRiskPreview("low"),
    ownership: input.overrides?.ownership ?? { ownerId: "owner-test-001", ownerType: "principal" },
    auditRefs: input.overrides?.auditRefs ?? [],
    auditTrail: input.overrides?.auditTrail ?? { auditRefs: [], evidenceRefs: [] },
    confirmedTaskSpecId: input.confirmedTaskSpecId ?? newId("ctspec"),
    requestEnvelopeId: input.requestEnvelopeId ?? newId("request"),
    requestHash: input.requestHash ?? newId("reqhash"),
    status: input.status ?? "created",
    constraintPackRef: input.constraintPackRef ?? "test-constraint-pack",
    versionLockId: input.versionLockId ?? newId("vlock"),
    ...(input.planGraphBundleId != null ? { planGraphBundleId: input.planGraphBundleId } : {}),
    budgetLedgerId: input.budgetLedgerId ?? newId("bledger"),
    budgetEnvelope: input.overrides?.budgetEnvelope ?? { budgetLedgerId: input.budgetLedgerId ?? newId("bledger"), currency: "USD" },
    currentSeq: input.currentSeq ?? 0,
    createdAt: now,
    updatedAt: input.updatedAt ?? now,
    fencingToken: input.overrides?.fencingToken ?? "test-fencing-token",
    ...input.overrides,
  };
}

// ---------------------------------------------------------------------------
// PlanGraph / PlanNode / PlanEdge Factories
// ---------------------------------------------------------------------------

export interface MinimalPlanNodeInput {
  nodeId?: string;
  nodeType?: PlanNodeType;
  inputRefs?: readonly string[];
  outputSchemaRef?: string;
  riskClass?: RiskClass;
  budgetIntent?: BudgetIntent;
  timeoutMs?: number;
  overrides?: Partial<PlanNode>;
}

export function createMinimalPlanNode(input: MinimalPlanNodeInput = {}): PlanNode {
  return {
    nodeId: input.nodeId ?? newId("node"),
    nodeType: input.nodeType ?? "tool",
    inputRefs: input.inputRefs ?? [],
    outputSchemaRef: input.outputSchemaRef ?? "test://schema/output",
    riskClass: input.riskClass ?? "low",
    budgetIntent: input.budgetIntent ?? { amount: 1000, currency: "USD", resourceKinds: ["token"] },
    sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
    retryPolicyRef: "test-retry-policy",
    timeoutMs: input.timeoutMs ?? 60000,
    ...input.overrides,
  };
}

export function createMinimalPlanEdge(input: {
  fromNodeId: string;
  toNodeId: string;
  edgeId?: string;
  condition?: unknown;
  dependencyType?: "hard" | "soft" | "compensation" | "retry" | "replan";
}): PlanEdge {
  return {
    edgeId: input.edgeId ?? newId("edge"),
    fromNodeId: input.fromNodeId,
    toNodeId: input.toNodeId,
    condition: (input.condition !== undefined ? input.condition : true) as import("../../../src/platform/contracts/executable-contracts/index.js").JsonValue,
    dependencyType: input.dependencyType ?? "hard",
  };
}

export interface MinimalPlanGraphInput {
  graphId?: string;
  nodes?: readonly PlanNode[];
  edges?: readonly PlanEdge[];
  entryNodeIds?: readonly string[];
  terminalNodeIds?: readonly string[];
  overrides?: Partial<PlanGraph>;
}

export function createMinimalPlanGraph(input: MinimalPlanGraphInput = {}): PlanGraph {
  const nodes = input.nodes ?? [createMinimalPlanNode({ nodeId: "node-init" })];
  const entryNodeIds = input.entryNodeIds ?? [nodes[0]!.nodeId];
  const terminalNodeIds = input.terminalNodeIds ?? [nodes[nodes.length - 1]!.nodeId];

  return {
    graphId: input.graphId ?? newId("graph"),
    nodes,
    edges: input.edges ?? [],
    entryNodeIds,
    terminalNodeIds,
    joinStrategy: "all",
    graphHash: "sha256:test-graph",
    ...input.overrides,
  };
}

export interface MinimalPlanGraphBundleInput {
  harnessRunId?: string;
  graph?: PlanGraph;
  schedulerPolicy?: ReadyNodeSchedulingPolicy;
  budgetPlanRef?: string;
  riskProfile?: RiskPreview;
  planGraphBundleId?: string;
  graphVersion?: number;
  validationReport?: GraphValidationReport;
  artifactRefs?: readonly ArtifactRef[];
  createdAt?: string;
  overrides?: Partial<PlanGraphBundle>;
}

export function createMinimalPlanGraphBundle(input: MinimalPlanGraphBundleInput = {}): PlanGraphBundle {
  const graph = input.graph ?? createMinimalPlanGraph();
  const entryNodeId = graph.entryNodeIds[0];
  if (!entryNodeId) {
    throw new Error("PlanGraph must have at least one entry node");
  }

  return {
    planGraphBundleId: input.planGraphBundleId ?? newId("pgb"),
    harnessRunId: input.harnessRunId ?? newId("hrun"),
    graphVersion: input.graphVersion ?? 1,
    graph,
    schedulerPolicy: input.schedulerPolicy ?? {
      policyId: newId("spolicy"),
      strategy: "priority_then_fifo",
    },
    budgetPlanRef: input.budgetPlanRef ?? "test://budget-plan",
    riskProfile: input.riskProfile ?? createTestRiskPreview("low"),
    validationReport: input.validationReport ?? { valid: true, findings: [] },
    artifactRefs: input.artifactRefs ?? [],
    createdAt: input.createdAt ?? DEFAULT_NOW,
    ...input.overrides,
  };
}

// ---------------------------------------------------------------------------
// NodeRun / NodeAttempt Factories
// ---------------------------------------------------------------------------

export interface MinimalNodeRunInput {
  harnessRunId?: string;
  planGraphBundleId?: string;
  graphVersion?: number;
  nodeId?: string;
  nodeRunId?: string;
  status?: NodeRunStatus;
  attemptCount?: number;
  leaseId?: string;
  fencingToken?: string;
  currentSeq?: number;
  createdAt?: string;
  updatedAt?: string;
  overrides?: Partial<NodeRun>;
}

export function createMinimalNodeRun(input: MinimalNodeRunInput = {}): NodeRun {
  const now = input.createdAt ?? DEFAULT_NOW;
  return {
    nodeRunId: input.nodeRunId ?? newId("nrun"),
    harnessRunId: input.harnessRunId ?? newId("hrun"),
    planGraphBundleId: input.planGraphBundleId ?? newId("pgb"),
    graphVersion: input.graphVersion ?? 1,
    nodeId: input.nodeId ?? newId("node"),
    status: input.status ?? "created",
    attemptCount: input.attemptCount ?? 0,
    sideEffects: [],
    compensation: [],
    ...(input.leaseId != null ? { leaseId: input.leaseId } : {}),
    fencingToken: input.fencingToken ?? "test-fencing-token",
    currentSeq: input.currentSeq ?? 0,
    createdAt: now,
    updatedAt: input.updatedAt ?? now,
    ...input.overrides,
  };
}

export interface MinimalNodeAttemptInput {
  nodeRunId?: string;
  attemptNo?: number;
  attemptKind?: "initial" | "retry" | "redrive" | "recovery";
  executorRef?: string;
  inputSnapshotRef?: ArtifactRef;
  nodeAttemptId?: string;
  receiptId?: string;
  startedAt?: string;
  completedAt?: string;
  overrides?: Partial<NodeAttempt>;
}

export function createMinimalNodeAttempt(input: MinimalNodeAttemptInput = {}): NodeAttempt {
  const now = input.startedAt ?? DEFAULT_NOW;
  return {
    nodeAttemptId: input.nodeAttemptId ?? newId("nattempt"),
    nodeRunId: input.nodeRunId ?? newId("nrun"),
    attemptNo: input.attemptNo ?? 1,
    attemptKind: input.attemptKind ?? "initial",
    startedAt: now,
    ...(input.completedAt != null ? { completedAt: input.completedAt } : {}),
    executorRef: input.executorRef ?? "agent-test-001",
    inputSnapshotRef: input.inputSnapshotRef ?? createTestArtifactRef(),
    ...(input.receiptId != null ? { receiptId: input.receiptId } : {}),
    ...input.overrides,
  };
}

export interface MinimalNodeAttemptReceiptInput {
  harnessRunId?: string;
  planGraphId?: string;
  graphVersion?: number;
  nodeAttemptId?: string;
  nodeRunId?: string;
  receiptKind?: "tool" | "llm" | "hitl" | "subgraph" | "evaluator" | "router";
  status?: "succeeded" | "failed" | "partial" | "blocked";
  duration?: number;
  outputRef?: ArtifactRef;
  error?: { code: string; message: string; retryable: boolean };
  errorDetail?: string;
  sideEffectRefs?: readonly string[];
  budgetSettlementRefs?: readonly string[];
  evidenceRefs?: readonly ArtifactRef[];
  producedAt?: string;
  nodeAttemptReceiptId?: string;
  overrides?: Partial<NodeAttemptReceipt>;
}

export function createMinimalNodeAttemptReceipt(input: MinimalNodeAttemptReceiptInput = {}): NodeAttemptReceipt {
  return {
    nodeAttemptReceiptId: input.nodeAttemptReceiptId ?? newId("nreceipt"),
    harnessRunId: input.harnessRunId ?? newId("hrun"),
    planGraphId: input.planGraphId ?? newId("pgb"),
    graphVersion: input.graphVersion ?? 1,
    nodeAttemptId: input.nodeAttemptId ?? newId("nattempt"),
    nodeRunId: input.nodeRunId ?? newId("nrun"),
    receiptKind: input.receiptKind ?? "tool",
    status: input.status ?? "succeeded",
    duration: input.duration ?? 100,
    ...(input.outputRef != null ? { outputRef: input.outputRef } : {}),
    ...(input.error != null ? { error: input.error } : {}),
    errorDetail: input.errorDetail ?? "",
    sideEffectRefs: input.sideEffectRefs ?? [],
    budgetSettlementRefs: input.budgetSettlementRefs ?? [],
    evidenceRefs: input.evidenceRefs ?? [],
    producedAt: input.producedAt ?? DEFAULT_NOW,
    ...input.overrides,
  };
}

// ---------------------------------------------------------------------------
// BudgetLedger / BudgetReservation Factories
// ---------------------------------------------------------------------------

export interface MinimalBudgetLedgerInput {
  tenantId?: string;
  harnessRunId?: string;
  currency?: string;
  hardCap?: number;
  budgetLedgerId?: string;
  softCap?: number;
  reservedAmount?: number;
  settledAmount?: number;
  releasedAmount?: number;
  status?: "open" | "soft_cap_reached" | "hard_cap_reached" | "closed";
  version?: number;
  overrides?: Partial<BudgetLedger>;
}

export function createMinimalBudgetLedger(input: MinimalBudgetLedgerInput = {}): BudgetLedger {
  return {
    budgetLedgerId: input.budgetLedgerId ?? newId("bledger"),
    tenantId: input.tenantId ?? "tenant-test-001",
    harnessRunId: input.harnessRunId ?? newId("hrun"),
    currency: input.currency ?? "USD",
    hardCap: input.hardCap ?? 10000,
    ...(input.softCap != null ? { softCap: input.softCap } : {}),
    reservedAmount: input.reservedAmount ?? 0,
    settledAmount: input.settledAmount ?? 0,
    releasedAmount: input.releasedAmount ?? 0,
    status: input.status ?? "open",
    version: input.version ?? 0,
    ...input.overrides,
  };
}

export interface MinimalBudgetReservationInput {
  budgetLedgerId?: string;
  harnessRunId?: string;
  amount?: number;
  resourceKind?: BudgetResourceKind;
  expiresAt?: string;
  budgetReservationId?: string;
  nodeRunId?: string;
  status?: "reserved" | "settled" | "released" | "expired" | "rejected";
  createdAt?: string;
  overrides?: Partial<BudgetReservation>;
}

export function createMinimalBudgetReservation(input: MinimalBudgetReservationInput = {}): BudgetReservation {
  return {
    budgetReservationId: input.budgetReservationId ?? newId("bresv"),
    budgetLedgerId: input.budgetLedgerId ?? newId("bledger"),
    harnessRunId: input.harnessRunId ?? newId("hrun"),
    ...(input.nodeRunId != null ? { nodeRunId: input.nodeRunId } : {}),
    amount: input.amount ?? 1000,
    resourceKind: input.resourceKind ?? "token",
    status: input.status ?? "reserved",
    expiresAt: input.expiresAt ?? new Date(Date.now() + 3600000).toISOString(),
    createdAt: input.createdAt ?? DEFAULT_NOW,
    ...input.overrides,
  };
}

// ---------------------------------------------------------------------------
// SideEffectRecord Factory
// ---------------------------------------------------------------------------

export interface MinimalSideEffectRecordInput {
  harnessRunId?: string;
  nodeRunId?: string;
  nodeAttemptId?: string;
  effectKind?: SideEffectKind;
  idempotencyKey?: string;
  riskClass?: RiskClass;
  preCommitPolicyProofRef?: ArtifactRef;
  sideEffectId?: string;
  status?: SideEffectStatus;
  approvalRef?: string;
  externalRef?: string;
  createdAt?: string;
  updatedAt?: string;
  overrides?: Partial<SideEffectRecord>;
}

export function createMinimalSideEffectRecord(input: MinimalSideEffectRecordInput = {}): SideEffectRecord {
  const now = input.createdAt ?? DEFAULT_NOW;
  const deadline = new Date(Date.now() + 3600000).toISOString();
  return {
    sideEffectId: input.sideEffectId ?? newId("seffect"),
    harnessRunId: input.harnessRunId ?? newId("hrun"),
    nodeRunId: input.nodeRunId ?? newId("nrun"),
    nodeAttemptId: input.nodeAttemptId ?? newId("nattempt"),
    effectKind: input.effectKind ?? "file_write",
    idempotencyKey: input.idempotencyKey ?? newId("idem"),
    status: input.status ?? "proposed",
    riskClass: input.riskClass ?? "low",
    ...(input.approvalRef != null ? { approvalRef: input.approvalRef } : {}),
    preCommitPolicyProofRef: input.preCommitPolicyProofRef ?? createTestArtifactRef(),
    ...(input.externalRef != null ? { externalRef: input.externalRef } : {}),
    deadline,
    createdAt: now,
    updatedAt: input.updatedAt ?? now,
    ...input.overrides,
  };
}

// ---------------------------------------------------------------------------
// Composite Factory: Fully Wired Harness Run with PlanGraph and NodeRun
// ---------------------------------------------------------------------------

export interface CanonicalHarnessScenario {
  harnessRun: HarnessRun;
  planGraphBundle: PlanGraphBundle;
  nodeRun: NodeRun;
  nodeAttempt: NodeAttempt;
  nodeAttemptReceipt: NodeAttemptReceipt;
  budgetLedger: BudgetLedger;
  budgetReservation: BudgetReservation;
}

/**
 * Creates a fully wired canonical harness scenario with all related entities.
 * Use this for E2E tests that need to exercise the full canonical execution path.
 */
export function createCanonicalHarnessScenario(input: {
  tenantId?: string;
  goal?: string;
  riskClass?: RiskClass;
} = {}): CanonicalHarnessScenario {
  const budgetLedger = createMinimalBudgetLedger(
    input.tenantId != null ? { tenantId: input.tenantId } : {}
  );
  const harnessRun = createMinimalHarnessRun({
    ...(input.tenantId != null ? { tenantId: input.tenantId } : {}),
    budgetLedgerId: budgetLedger.budgetLedgerId,
    status: "planning",
  });
  const planGraph = createMinimalPlanGraph();
  const planGraphBundle = createMinimalPlanGraphBundle({
    harnessRunId: harnessRun.harnessRunId,
    graph: planGraph,
    riskProfile: createTestRiskPreview(input.riskClass ?? "low"),
  });
  const entryNodeId = planGraph.entryNodeIds[0];
  if (!entryNodeId) {
    throw new Error("PlanGraph must have at least one entry node");
  }
  const nodeRun = createMinimalNodeRun({
    harnessRunId: harnessRun.harnessRunId,
    planGraphBundleId: planGraphBundle.planGraphBundleId,
    graphVersion: planGraphBundle.graphVersion,
    nodeId: entryNodeId,
  });
  const nodeAttempt = createMinimalNodeAttempt({ nodeRunId: nodeRun.nodeRunId });
  const nodeAttemptReceipt = createMinimalNodeAttemptReceipt({
    harnessRunId: harnessRun.harnessRunId,
    planGraphId: planGraphBundle.planGraphBundleId,
    graphVersion: planGraphBundle.graphVersion,
    nodeAttemptId: nodeAttempt.nodeAttemptId,
    nodeRunId: nodeRun.nodeRunId,
  });
  const budgetReservation = createMinimalBudgetReservation({
    budgetLedgerId: budgetLedger.budgetLedgerId,
    harnessRunId: harnessRun.harnessRunId,
    nodeRunId: nodeRun.nodeRunId,
  });

  return {
    harnessRun,
    planGraphBundle,
    nodeRun,
    nodeAttempt,
    nodeAttemptReceipt,
    budgetLedger,
    budgetReservation,
  };
}
