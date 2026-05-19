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
import type { HarnessRun, HarnessRunStatus, PlanGraphBundle, PlanGraph, PlanNode, PlanEdge, PlanNodeType, NodeRun, NodeRunStatus, NodeAttempt, NodeAttemptReceipt, SideEffectRecord, SideEffectStatus, SideEffectKind, BudgetReservation, BudgetLedger, BudgetResourceKind, RiskClass, ArtifactRef, GraphValidationReport, ReadyNodeSchedulingPolicy, PrincipalRef, BudgetIntent, RiskPreview } from "../../../src/platform/contracts/executable-contracts/index.js";
export declare function createTestPrincipal(overrides?: Partial<PrincipalRef>): PrincipalRef;
export declare function createTestRiskPreview(riskClass?: RiskClass): RiskPreview;
export declare function createTestArtifactRef(overrides?: Partial<ArtifactRef>): ArtifactRef;
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
export declare function createMinimalHarnessRun(input?: MinimalHarnessRunInput): HarnessRun;
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
export declare function createMinimalPlanNode(input?: MinimalPlanNodeInput): PlanNode;
export declare function createMinimalPlanEdge(input: {
    fromNodeId: string;
    toNodeId: string;
    edgeId?: string;
    condition?: unknown;
    dependencyType?: "hard" | "soft" | "compensation" | "retry" | "replan";
}): PlanEdge;
export interface MinimalPlanGraphInput {
    graphId?: string;
    nodes?: readonly PlanNode[];
    edges?: readonly PlanEdge[];
    entryNodeIds?: readonly string[];
    terminalNodeIds?: readonly string[];
    overrides?: Partial<PlanGraph>;
}
export declare function createMinimalPlanGraph(input?: MinimalPlanGraphInput): PlanGraph;
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
export declare function createMinimalPlanGraphBundle(input?: MinimalPlanGraphBundleInput): PlanGraphBundle;
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
export declare function createMinimalNodeRun(input?: MinimalNodeRunInput): NodeRun;
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
export declare function createMinimalNodeAttempt(input?: MinimalNodeAttemptInput): NodeAttempt;
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
    error?: {
        code: string;
        message: string;
        retryable: boolean;
    };
    errorDetail?: string;
    sideEffectRefs?: readonly string[];
    budgetSettlementRefs?: readonly string[];
    evidenceRefs?: readonly ArtifactRef[];
    producedAt?: string;
    nodeAttemptReceiptId?: string;
    overrides?: Partial<NodeAttemptReceipt>;
}
export declare function createMinimalNodeAttemptReceipt(input?: MinimalNodeAttemptReceiptInput): NodeAttemptReceipt;
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
export declare function createMinimalBudgetLedger(input?: MinimalBudgetLedgerInput): BudgetLedger;
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
export declare function createMinimalBudgetReservation(input?: MinimalBudgetReservationInput): BudgetReservation;
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
export declare function createMinimalSideEffectRecord(input?: MinimalSideEffectRecordInput): SideEffectRecord;
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
export declare function createCanonicalHarnessScenario(input?: {
    tenantId?: string;
    goal?: string;
    riskClass?: RiskClass;
}): CanonicalHarnessScenario;
