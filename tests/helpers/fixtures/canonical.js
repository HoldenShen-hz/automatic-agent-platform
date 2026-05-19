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
const DEFAULT_NOW = nowIso();
// ---------------------------------------------------------------------------
// Principal & Risk Preview Helpers
// ---------------------------------------------------------------------------
export function createTestPrincipal(overrides = {}) {
    return {
        principalId: "principal-test-001",
        tenantId: "tenant-test-001",
        roles: ["test_role"],
        displayName: "Test Principal",
        ...overrides,
    };
}
export function createTestRiskPreview(riskClass = "low") {
    return {
        riskClass,
        reasons: ["test risk preview"],
    };
}
export function createTestArtifactRef(overrides = {}) {
    return {
        artifactId: "artifact-test-001",
        uri: "memory://test/artifact-001",
        hash: "sha256:test",
        version: "1.0.0",
        ...overrides,
    };
}
export function createMinimalHarnessRun(input = {}) {
    const now = input.createdAt ?? DEFAULT_NOW;
    return {
        harnessRunId: newId("hrun"),
        tenantId: input.tenantId ?? "tenant-test-001",
        confirmedTaskSpecId: input.confirmedTaskSpecId ?? newId("ctspec"),
        requestEnvelopeId: input.requestEnvelopeId ?? newId("request"),
        requestHash: input.requestHash ?? newId("reqhash"),
        status: input.status ?? "created",
        constraintPackRef: input.constraintPackRef ?? "test-constraint-pack",
        versionLockId: input.versionLockId ?? newId("vlock"),
        ...(input.planGraphBundleId != null ? { planGraphBundleId: input.planGraphBundleId } : {}),
        budgetLedgerId: input.budgetLedgerId ?? newId("bledger"),
        currentSeq: input.currentSeq ?? 0,
        createdAt: now,
        updatedAt: input.updatedAt ?? now,
        ...input.overrides,
    };
}
export function createMinimalPlanNode(input = {}) {
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
export function createMinimalPlanEdge(input) {
    return {
        edgeId: input.edgeId ?? newId("edge"),
        fromNodeId: input.fromNodeId,
        toNodeId: input.toNodeId,
        condition: input.condition ?? true,
        dependencyType: input.dependencyType ?? "hard",
    };
}
export function createMinimalPlanGraph(input = {}) {
    const nodes = input.nodes ?? [createMinimalPlanNode({ nodeId: "node-init" })];
    const entryNodeIds = input.entryNodeIds ?? [nodes[0].nodeId];
    const terminalNodeIds = input.terminalNodeIds ?? [nodes[nodes.length - 1].nodeId];
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
export function createMinimalPlanGraphBundle(input = {}) {
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
export function createMinimalNodeRun(input = {}) {
    const now = input.createdAt ?? DEFAULT_NOW;
    return {
        nodeRunId: input.nodeRunId ?? newId("nrun"),
        harnessRunId: input.harnessRunId ?? newId("hrun"),
        planGraphBundleId: input.planGraphBundleId ?? newId("pgb"),
        graphVersion: input.graphVersion ?? 1,
        nodeId: input.nodeId ?? newId("node"),
        status: input.status ?? "created",
        attemptCount: input.attemptCount ?? 0,
        ...(input.leaseId != null ? { leaseId: input.leaseId } : {}),
        ...(input.fencingToken != null ? { fencingToken: input.fencingToken } : {}),
        currentSeq: input.currentSeq ?? 0,
        createdAt: now,
        updatedAt: input.updatedAt ?? now,
        ...input.overrides,
    };
}
export function createMinimalNodeAttempt(input = {}) {
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
export function createMinimalNodeAttemptReceipt(input = {}) {
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
        ...(input.errorDetail != null ? { errorDetail: input.errorDetail } : {}),
        sideEffectRefs: input.sideEffectRefs ?? [],
        budgetSettlementRefs: input.budgetSettlementRefs ?? [],
        evidenceRefs: input.evidenceRefs ?? [],
        producedAt: input.producedAt ?? DEFAULT_NOW,
        ...input.overrides,
    };
}
export function createMinimalBudgetLedger(input = {}) {
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
export function createMinimalBudgetReservation(input = {}) {
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
export function createMinimalSideEffectRecord(input = {}) {
    const now = input.createdAt ?? DEFAULT_NOW;
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
        createdAt: now,
        updatedAt: input.updatedAt ?? now,
        ...input.overrides,
    };
}
/**
 * Creates a fully wired canonical harness scenario with all related entities.
 * Use this for E2E tests that need to exercise the full canonical execution path.
 */
export function createCanonicalHarnessScenario(input = {}) {
    const budgetLedger = createMinimalBudgetLedger({ tenantId: input.tenantId });
    const harnessRun = createMinimalHarnessRun({
        tenantId: input.tenantId,
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
//# sourceMappingURL=canonical.js.map