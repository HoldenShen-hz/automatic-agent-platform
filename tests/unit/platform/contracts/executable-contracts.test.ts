/**
 * Executable Contracts Unit Tests
 *
 * Tests the canonical NodeAttemptReceipt contract and its factory function,
 * plus schema validation for the canonical contract system.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  createNodeAttemptReceipt,
  createNodeAttempt,
  createNodeRun,
  createHarnessRun,
  createPrincipalRef,
  createPlanGraphBundle,
  CANONICAL_CONTRACT_NAMES,
  LEGACY_CONTRACT_NAMES,
  validateExecutableContract,
  type NodeAttemptReceipt,
  type ArtifactRef,
  type BudgetIntent,
  type PlanGraph,
  type RiskPreview,
  type AppErrorRef,
  CONTRACT_SCHEMA_VERSION,
} from "../../../../src/platform/contracts/executable-contracts/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

const principal = createPrincipalRef({
  principalId: "user-1",
  tenantId: "tenant-1",
  roles: ["operator"],
});

const artifact: ArtifactRef = {
  artifactId: "artifact-1",
  uri: "artifact://artifact-1",
  hash: "sha256:test",
};

const budgetIntent: BudgetIntent = {
  amount: 100,
  currency: "USD",
  resourceKinds: ["token", "tool"],
};

const riskPreview: RiskPreview = {
  riskClass: "low",
  reasons: [],
};

function createMinimalPlanGraph(graphId: string, nodeIds: string[]): PlanGraph {
  const nodes = nodeIds.map((nodeId) => ({
    nodeId,
    nodeType: "tool" as const,
    inputRefs: [] as readonly string[],
    outputSchemaRef: "schema://output",
    riskClass: "low" as const,
    budgetIntent,
    sideEffectProfile: {
      mayCommitExternalEffect: false,
      reversible: true,
    },
    retryPolicyRef: "retry://default",
    timeoutMs: 30000,
  }));

  return {
    graphId,
    nodes,
    edges: [],
    entryNodeIds: nodeIds.slice(0, 1),
    terminalNodeIds: nodeIds.slice(-1),
    joinStrategy: "all",
    graphHash: `hash-${graphId}`,
  };
}

test("CONTRACT_SCHEMA_VERSION is v4.3", () => {
  assert.equal(CONTRACT_SCHEMA_VERSION, "v4.3");
});

test("NodeAttemptReceipt is listed in CANONICAL_CONTRACT_NAMES", () => {
  assert.equal(CANONICAL_CONTRACT_NAMES.includes("NodeAttemptReceipt"), true);
});

test("ExecutionReceipt is listed in LEGACY_CONTRACT_NAMES", () => {
  assert.equal(LEGACY_CONTRACT_NAMES.includes("ExecutionReceipt"), true);
});

test("validateExecutableContract enforces typed RequestEnvelope directives", () => {
  const envelope = {
    requestId: "req-1",
    confirmedTaskSpecId: "task-1",
    tenantId: "tenant-1",
    principal,
    domainId: "coding",
    traceId: "trace-1",
    idempotencyKey: "idem-1",
    priority: 1,
    requestHash: "hash-1",
    constraintPackRef: "constraint://default",
    budgetIntent,
    policyContext: {},
    artifactRefs: [],
    submittedAt: "2026-05-19T00:00:00.000Z",
    directives: [
      {
        operationalDirectiveId: "od-1",
        type: "pause",
        scope: { tenantId: "tenant-1", harnessRunId: "hrun-1" },
        issuedBy: { principalId: "principal-1", tenantId: "tenant-1", roles: ["operator"] },
        reason: "manual pause",
        params: { mode: "safe" },
        audience: ["runtime"],
        nonce: "nonce-1",
        signature: "sig-1",
        createdAt: "2026-05-19T00:00:00.000Z",
      },
      {
        decisionDirectiveId: "dd-1",
        type: "approve",
        scope: { tenantId: "tenant-1", humanResponsibilityRecordId: "hrr-1" },
        issuedBy: {
          principalId: "principal-2",
          tenantId: "tenant-1",
          roles: ["approver"],
          displayName: "Approver",
        },
        targetRef: "approval://1",
        payload: { decision: "approve" },
        reason: "approved",
        riskAcknowledged: true,
        audience: ["policy"],
        nonce: "nonce-2",
        signature: "sig-2",
        createdAt: "2026-05-19T00:00:00.000Z",
      },
    ],
  };

  const validated = validateExecutableContract("RequestEnvelope", envelope);
  assert.equal(validated.directives?.length, 2);
});

test("validateExecutableContract rejects malformed RequestEnvelope directives", () => {
  const envelope = {
    requestId: "req-1",
    confirmedTaskSpecId: "task-1",
    tenantId: "tenant-1",
    principal,
    domainId: "coding",
    traceId: "trace-1",
    idempotencyKey: "idem-1",
    priority: 1,
    requestHash: "hash-1",
    constraintPackRef: "constraint://default",
    budgetIntent,
    policyContext: {},
    artifactRefs: [],
    submittedAt: "2026-05-19T00:00:00.000Z",
    directives: [
      {
        operationalDirectiveId: "od-1",
        type: "pause",
        scope: { tenantId: "tenant-1" },
        issuedBy: { principalId: "principal-1", tenantId: "tenant-1", roles: ["operator"] },
        reason: "manual pause",
        params: { mode: "safe" },
        audience: ["runtime"],
        nonce: "nonce-1",
        signature: "sig-1",
      },
    ],
  };

  assert.throws(
    () => validateExecutableContract("RequestEnvelope", envelope),
    ValidationError,
  );
});

test("createNodeAttemptReceipt creates successful tool receipt", () => {
  const receipt = createNodeAttemptReceipt({
    nodeAttemptId: "nattempt-1",
    nodeRunId: "nrun-1",
    harnessRunId: "hrun-1",
    planGraphId: "pgb-1",
    graphVersion: 1,
    receiptKind: "tool",
    status: "succeeded",
    duration: 1500,
    outputRef: artifact,
  });

  assert.equal(receipt.nodeAttemptReceiptId.startsWith("nreceipt_"), true);
  assert.equal(receipt.nodeAttemptId, "nattempt-1");
  assert.equal(receipt.receiptKind, "tool");
  assert.equal(receipt.status, "succeeded");
  assert.equal(receipt.duration, 1500);
  assert.equal(receipt.outputRef?.artifactId, "artifact-1");
  assert.equal(receipt.sideEffectRefs.length, 0);
  assert.equal(receipt.budgetSettlementRefs.length, 0);
  assert.equal(receipt.evidenceRefs.length, 0);
});

test("createNodeAttemptReceipt creates failed llm receipt with error", () => {
  const error: AppErrorRef = {
    code: "LLM_ERROR",
    message: "Model timeout",
    retryable: true,
  };

  const receipt = createNodeAttemptReceipt({
    nodeAttemptId: "nattempt-2",
    nodeRunId: "nrun-2",
    harnessRunId: "hrun-2",
    planGraphId: "pgb-1",
    graphVersion: 1,
    receiptKind: "llm",
    status: "failed",
    duration: 30000,
    error,
    errorDetail: "Timeout after 30s",
  });

  assert.equal(receipt.status, "failed");
  assert.equal(receipt.receiptKind, "llm");
  assert.equal(receipt.error?.code, "LLM_ERROR");
  assert.equal(receipt.error?.retryable, true);
  assert.equal(receipt.errorDetail, "Timeout after 30s");
});

test("createNodeAttemptReceipt creates partial hitl receipt", () => {
  const receipt = createNodeAttemptReceipt({
    nodeAttemptId: "nattempt-3",
    nodeRunId: "nrun-3",
    harnessRunId: "hrun-3",
    planGraphId: "pgb-1",
    graphVersion: 1,
    receiptKind: "hitl",
    status: "partial",
    duration: 5000,
    sideEffectRefs: ["seff-1", "seff-2"],
    budgetSettlementRefs: ["bsettle-1"],
    evidenceRefs: [artifact],
  });

  assert.equal(receipt.status, "partial");
  assert.equal(receipt.receiptKind, "hitl");
  assert.equal(receipt.sideEffectRefs.length, 2);
  assert.equal(receipt.budgetSettlementRefs.length, 1);
  assert.equal(receipt.evidenceRefs.length, 1);
});

test("createNodeAttemptReceipt creates blocked evaluator receipt", () => {
  const receipt = createNodeAttemptReceipt({
    nodeAttemptId: "nattempt-4",
    nodeRunId: "nrun-4",
    harnessRunId: "hrun-4",
    planGraphId: "pgb-1",
    graphVersion: 2,
    receiptKind: "evaluator",
    status: "blocked",
    duration: 0,
  });

  assert.equal(receipt.status, "blocked");
  assert.equal(receipt.receiptKind, "evaluator");
  assert.equal(receipt.duration, 0);
});

test("createNodeAttemptReceipt accepts all receiptKind values", () => {
  const kinds: Array<NodeAttemptReceipt["receiptKind"]> = ["tool", "llm", "hitl", "subgraph", "evaluator", "router"];

  for (const kind of kinds) {
    const receipt = createNodeAttemptReceipt({
      nodeAttemptId: `nattempt-${kind}`,
      nodeRunId: "nrun-x",
      harnessRunId: "hrun-x",
      planGraphId: "pgb-x",
      graphVersion: 1,
      receiptKind: kind,
      status: "succeeded",
      duration: 100,
    });

    assert.equal(receipt.receiptKind, kind, `kind '${kind}' should be accepted`);
  }
});

test("createNodeAttemptReceipt accepts all status values", () => {
  const statuses: Array<NodeAttemptReceipt["status"]> = ["succeeded", "failed", "partial", "blocked"];

  for (const status of statuses) {
    const receipt = createNodeAttemptReceipt({
      nodeAttemptId: `nattempt-status-${status}`,
      nodeRunId: "nrun-x",
      harnessRunId: "hrun-x",
      planGraphId: "pgb-x",
      graphVersion: 1,
      receiptKind: "tool",
      status,
      duration: 100,
    });

    assert.equal(receipt.status, status, `status '${status}' should be accepted`);
  }
});

test("createNodeAttemptReceipt uses provided nodeAttemptReceiptId", () => {
  const receipt = createNodeAttemptReceipt({
    nodeAttemptReceiptId: "custom_receipt_123",
    nodeAttemptId: "nattempt-x",
    nodeRunId: "nrun-x",
    harnessRunId: "hrun-x",
    planGraphId: "pgb-x",
    graphVersion: 1,
    receiptKind: "tool",
    status: "succeeded",
    duration: 100,
  });

  assert.equal(receipt.nodeAttemptReceiptId, "custom_receipt_123");
});

test("createNodeAttemptReceipt uses provided producedAt", () => {
  const receipt = createNodeAttemptReceipt({
    nodeAttemptId: "nattempt-x",
    nodeRunId: "nrun-x",
    harnessRunId: "hrun-x",
    planGraphId: "pgb-x",
    graphVersion: 1,
    receiptKind: "tool",
    status: "succeeded",
    duration: 100,
    producedAt: "2026-04-28T12:00:00.000Z",
  });

  assert.equal(receipt.producedAt, "2026-04-28T12:00:00.000Z");
});

test("createNodeAttemptReceipt defaults producedAt to nowIso", () => {
  const before = new Date().toISOString();

  const receipt = createNodeAttemptReceipt({
    nodeAttemptId: "nattempt-x",
    nodeRunId: "nrun-x",
    harnessRunId: "hrun-x",
    planGraphId: "pgb-x",
    graphVersion: 1,
    receiptKind: "tool",
    status: "succeeded",
    duration: 100,
  });

  const after = new Date().toISOString();
  assert.ok(receipt.producedAt >= before);
  assert.ok(receipt.producedAt <= after);
});

test("createNodeAttemptReceipt defaults sideEffectRefs to empty array", () => {
  const receipt = createNodeAttemptReceipt({
    nodeAttemptId: "nattempt-x",
    nodeRunId: "nrun-x",
    harnessRunId: "hrun-x",
    planGraphId: "pgb-x",
    graphVersion: 1,
    receiptKind: "tool",
    status: "succeeded",
    duration: 100,
  });

  assert.equal(Array.isArray(receipt.sideEffectRefs), true);
  assert.equal(receipt.sideEffectRefs.length, 0);
});

test("createNodeAttemptReceipt defaults budgetSettlementRefs to empty array", () => {
  const receipt = createNodeAttemptReceipt({
    nodeAttemptId: "nattempt-x",
    nodeRunId: "nrun-x",
    harnessRunId: "hrun-x",
    planGraphId: "pgb-x",
    graphVersion: 1,
    receiptKind: "tool",
    status: "succeeded",
    duration: 100,
  });

  assert.equal(Array.isArray(receipt.budgetSettlementRefs), true);
  assert.equal(receipt.budgetSettlementRefs.length, 0);
});

test("createNodeAttemptReceipt defaults evidenceRefs to empty array", () => {
  const receipt = createNodeAttemptReceipt({
    nodeAttemptId: "nattempt-x",
    nodeRunId: "nrun-x",
    harnessRunId: "hrun-x",
    planGraphId: "pgb-x",
    graphVersion: 1,
    receiptKind: "tool",
    status: "succeeded",
    duration: 100,
  });

  assert.equal(Array.isArray(receipt.evidenceRefs), true);
  assert.equal(receipt.evidenceRefs.length, 0);
});

test("validateExecutableContract accepts valid NodeAttemptReceipt", () => {
  const receipt = createNodeAttemptReceipt({
    nodeAttemptId: "nattempt-validate",
    nodeRunId: "nrun-validate",
    harnessRunId: "hrun-validate",
    planGraphId: "pgb-validate",
    graphVersion: 1,
    receiptKind: "tool",
    status: "succeeded",
    duration: 500,
    errorDetail: "completed successfully",
  });

  const validated = validateExecutableContract("NodeAttemptReceipt", receipt);
  assert.deepEqual(validated, receipt);
});

test("validateExecutableContract rejects invalid NodeAttemptReceipt", () => {
  const invalidReceipt = {
    nodeAttemptReceiptId: "",
    nodeAttemptId: "nattempt-1",
    nodeRunId: "nrun-1",
    harnessRunId: "hrun-1",
    planGraphId: "pgb-1",
    graphVersion: 1,
    receiptKind: "tool",
    status: "succeeded",
    duration: 500,
    sideEffectRefs: [],
    budgetSettlementRefs: [],
    evidenceRefs: [],
    producedAt: "2026-04-28T00:00:00.000Z",
  };

  assert.throws(
    () => validateExecutableContract("NodeAttemptReceipt", invalidReceipt),
    ValidationError,
  );
});

test("full runtime chain: HarnessRun -> PlanGraphBundle -> NodeRun -> NodeAttempt -> NodeAttemptReceipt", () => {
  const run = createHarnessRun({
    tenantId: "tenant-1",
    domainId: "coding",
    confirmedTaskSpecId: "ctspec-1",
    requestEnvelopeId: "request-1",
    requestHash: "request-hash-1",
    constraintPackRef: "constraint-pack-1",
    versionLockId: "rvlock-1",
    budgetLedgerId: "bledger-1",
  });

  const bundle = createPlanGraphBundle({
    harnessRunId: run.harnessRunId,
    graph: createMinimalPlanGraph("graph-runtime", ["node-1", "node-2"]),
    schedulerPolicy: {
      policyId: "scheduler-1",
      strategy: "deterministic_fifo",
    },
    budgetPlanRef: "budget-plan-1",
    riskProfile: riskPreview,
  });

  const nodeRun = createNodeRun({
    harnessRunId: run.harnessRunId,
    planGraphBundleId: bundle.planGraphBundleId,
    graphVersion: bundle.graphVersion,
    nodeId: "node-1",
  });

  const attempt = createNodeAttempt({
    nodeRunId: nodeRun.nodeRunId,
    attemptNo: 1,
    attemptKind: "initial",
    executorRef: "worker-1",
    inputSnapshotRef: artifact,
  });

  const receipt = createNodeAttemptReceipt({
    nodeAttemptId: attempt.nodeAttemptId,
    nodeRunId: nodeRun.nodeRunId,
    harnessRunId: run.harnessRunId,
    planGraphId: bundle.planGraphBundleId,
    graphVersion: bundle.graphVersion,
    receiptKind: "tool",
    status: "succeeded",
    duration: 1200,
    outputRef: artifact,
  });

  // Verify the chain links
  assert.equal(receipt.harnessRunId, run.harnessRunId);
  assert.equal(receipt.nodeRunId, nodeRun.nodeRunId);
  assert.equal(receipt.nodeAttemptId, attempt.nodeAttemptId);
  assert.equal(receipt.planGraphId, bundle.planGraphBundleId);
  assert.equal(receipt.graphVersion, bundle.graphVersion);
  assert.equal(receipt.status, "succeeded");
  assert.equal(receipt.duration, 1200);
});

test("CANONICAL_CONTRACT_NAMES contains expected number of contracts", () => {
  // Current count is 28 contracts as of v4.3
  assert.ok(CANONICAL_CONTRACT_NAMES.length >= 27, "Should have at least 27 canonical contracts");
});

test("LEGACY_CONTRACT_NAMES contains ExecutionPlan and ExecutionReceipt", () => {
  assert.ok(LEGACY_CONTRACT_NAMES.includes("ExecutionPlan"));
  assert.ok(LEGACY_CONTRACT_NAMES.includes("ExecutionReceipt"));
  assert.ok(LEGACY_CONTRACT_NAMES.includes("ControlDirective"));
});

test("CANONICAL_CONTRACT_NAMES does not contain any legacy contract names", () => {
  for (const legacyName of LEGACY_CONTRACT_NAMES) {
    assert.equal(
      CANONICAL_CONTRACT_NAMES.includes(legacyName as typeof CANONICAL_CONTRACT_NAMES[number]),
      false,
      `${legacyName} should not be in CANONICAL_CONTRACT_NAMES`,
    );
  }
});
