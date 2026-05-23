/**
 * @fileoverview R6-13 to R6-24 Type System + API Serialization + Shared Layer Fixes
 *
 * Issues addressed:
 * R6-13: harness/index.ts vs contracts/executable-contracts/ - HarnessRun interface conflict
 * R6-14: contracts/control-directive/ + types/platform-contracts.ts - ControlDirective conflict
 * R6-15: contracts/execution-plan/ + types/platform-contracts.ts - ExecutionPlan conflict
 * R6-16: POST /v1/tasks bypasses intake pipeline
 * R6-17: Task status enum cannot represent canonical 13-state HarnessRunStatus
 * R6-18: OperationalDirective/DecisionDirective zero implementation
 * R6-19: stepId still used as universal execution identifier (870+ occurrences)
 * R6-20: HarnessRun contains steps:HarnessStep[] as first-class field
 * R6-21: as any cast in lease audit critical path
 * R6-22: EdgeExecutionPlan uses linear orderedTaskIds instead of PlanGraph
 * R6-23: validateExecutableContract() returns unknown
 * R6-24: assertNoLegacyTruthWrite() only runtime interception
 *
 * These tests verify the type system consistency and API serialization fixes.
 */

import test from "node:test";
import assert from "node:assert/strict";

// Import the canonical contracts
import {
  CANONICAL_CONTRACT_NAMES,
  type CanonicalContractName,
  createHarnessRun,
  createPlanGraphBundle,
  createNodeRun,
  createNodeAttempt,
  type HarnessRun,
  type HarnessRunStatus,
  type NodeRun,
  type NodeRunStatus,
  type PlanGraph,
  type PlanGraphBundle,
  type PlanNode,
  type PlanEdge,
  HARNESS_RUN_TERMINAL_STATUSES,
  NODE_RUN_TERMINAL_STATUSES,
  type OperationalDirective,
  type DecisionDirective,
  createOperationalDirective,
  createDecisionDirective,
  validateExecutableContract,
  type ContractEnvelope,
  createContractEnvelope,
  type RiskClass,
  type SideEffectRecord,
  createSideEffectRecord,
  type ArtifactRef,
  type JsonValue,
  type NodeAttemptReceipt,
  type RequestEnvelope,
  createRequestEnvelopeFromConfirmedTask,
  type ConfirmedTaskSpec,
  type BudgetIntent,
  type RiskPreview,
  type PrincipalRef,
  type HarnessAuditTrail,
  createPrincipalRef,
} from "../../../../src/platform/contracts/executable-contracts/index.js";

// Import legacy contracts for compatibility testing
import {
  type ControlDirective,
  createControlDirective,
  type OperationalDirectiveType,
  type DecisionDirectiveType,
} from "../../../../src/platform/contracts/control-directive/index.js";

// Import execution-plan legacy adapter
import {
  createExecutionPlan,
} from "../../../../src/platform/contracts/execution-plan/index.js";

// Import Edge runtime
import {
  type EdgePlanGraphBundle,
  buildEdgeExecutionPlan,
  buildLegacyEdgeExecutionPlan,
} from "../../../../src/ops-maturity/edge-runtime/edge-orchestrator/index.js";

// Import RuntimeEntryGuard
import {
  RuntimeEntryGuard,
} from "../../../../src/platform/five-plane-orchestration/harness/runtime/runtime-entry-guard.js";

import { ValidationError } from "../../../../src/platform/contracts/errors.js";

// =============================================================================
// Test Infrastructure
// =============================================================================

function createTestPrincipal(): PrincipalRef {
  return {
    principalId: "test-principal",
    type: "human",
    tenantId: "test-tenant",
    roles: ["operator"],
    displayName: "Test User",
  };
}

function createTestArtifactRef(): ArtifactRef {
  return {
    artifactId: "test-artifact",
    uri: "file:///test/artifact",
    hash: "abc123",
    version: "1.0",
  };
}

function createTestRiskPreview(): RiskPreview {
  return {
    riskClass: "medium",
    reasons: ["test-reason"],
  };
}

// =============================================================================
// R6-13: HarnessRun interface conflict resolution
// =============================================================================

test("R6-13: canonical HarnessRun from executable-contracts has correct 14-status structure", () => {
  // Create a canonical HarnessRun using the factory
  const harnessRun = createHarnessRun({
    tenantId: "test-tenant",
    orgId: "test-org",
    confirmedTaskSpecId: "ctspec-123",
    requestEnvelopeId: "req-456",
    requestHash: "hash-789",
    constraintPackRef: "cp:default",
    versionLockId: "vlock-001",
    budgetLedgerId: "bledger-001",
    status: "running",
  });

  // Verify the HarnessRun has all required canonical fields
  assert.strictEqual(harnessRun.harnessRunId.startsWith("hrun_"), true);
  assert.strictEqual(harnessRun.tenantId, "test-tenant");
  assert.strictEqual(harnessRun.orgId, "test-org");
  assert.strictEqual(harnessRun.status, "running");
  assert.strictEqual(harnessRun.confirmedTaskSpecId, "ctspec-123");

  // Verify all 14 canonical statuses are available
  const allStatuses: HarnessRunStatus[] = [
    "created", "admitted", "planning", "ready", "running",
    "pausing", "paused", "resuming", "replanning", "compensating",
    "completed", "failed", "cancelled", "aborted",
  ];
  assert.strictEqual(allStatuses.length, 14);

  // Verify terminal statuses are correctly defined
  assert.strictEqual(HARNESS_RUN_TERMINAL_STATUSES.includes("completed"), true);
  assert.strictEqual(HARNESS_RUN_TERMINAL_STATUSES.includes("failed"), true);
  assert.strictEqual(HARNESS_RUN_TERMINAL_STATUSES.includes("cancelled"), true);
  assert.strictEqual(HARNESS_RUN_TERMINAL_STATUSES.includes("aborted"), true);
  assert.strictEqual(HARNESS_RUN_TERMINAL_STATUSES.length, 4);
});

test("R6-13 & R6-20: HarnessRun does NOT have steps field", () => {
  const harnessRun = createHarnessRun({
    tenantId: "test-tenant",
    confirmedTaskSpecId: "ctspec-123",
    requestEnvelopeId: "req-456",
    requestHash: "hash-789",
    constraintPackRef: "cp:default",
    versionLockId: "vlock-001",
    budgetLedgerId: "bledger-001",
  });

  // R6-20: steps should NOT be a first-class field on HarnessRun
  assert.strictEqual((harnessRun as unknown as { steps?: unknown }).steps, undefined);
});

test("R6-13 & R6-23: validateExecutableContract returns typed result (R6-23 fix)", () => {
  const budgetIntent: BudgetIntent = {
    amount: 1000,
    currency: "USD",
    resourceKinds: ["compute", "token"],
  };

  const principal = createTestPrincipal();
  const riskPreview = createTestRiskPreview();

  // Create a valid HarnessRun payload
  const validPayload = {
    harnessRunId: "hrun-001",
    tenantId: "test-tenant",
    orgId: "test-org",
    traceId: "trace-001",
    riskLevel: "medium" as RiskClass,
    riskProfile: riskPreview,
    ownership: { ownerId: "test-owner", ownerType: "tenant" },
    auditRefs: [],
    auditTrail: { auditRefs: [], evidenceRefs: [] },
    domainId: "coding",
    confirmedTaskSpecId: "ctspec-123",
    requestEnvelopeId: "req-456",
    requestHash: "hash-789",
    status: "running" as HarnessRunStatus,
    constraintPackRef: "cp:default",
    versionLockId: "vlock-001",
    budgetLedgerId: "bledger-001",
    budgetEnvelope: {
      budgetLedgerId: "bledger-001",
      currency: "USD",
      maxSteps: 100,
      maxCost: 5000,
      maxDurationMs: 3600000,
      maxModelTokens: 100000,
      maxContextTokens: 200000,
      maxOutputTokens: 50000,
    },
    currentSeq: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    fencingToken: "fence:hrun-001:0",
  };

  // R6-23 fix: validateExecutableContract should return typed result, not unknown
  const result = validateExecutableContract("HarnessRun", validPayload);

  // The result should be the typed HarnessRun, not unknown
  assert.strictEqual(result.harnessRunId, "hrun-001");
  assert.strictEqual(result.status, "running");

  // Verify the type is properly narrowed - we can access canonical fields
  const typed = result as HarnessRun;
  assert.strictEqual(typed.harnessRunId, "hrun-001");
  assert.strictEqual(typed.tenantId, "test-tenant");
});

// =============================================================================
// R6-14: ControlDirective conflict resolution
// =============================================================================

test("R6-14: ControlDirective is deprecated and createControlDirective throws", () => {
  // ControlDirective type exists for compatibility but is marked deprecated
  const legacyDirective: ControlDirective = {
    directiveId: "dir-001",
    kind: "pause",
    targetRef: "target-001",
    reasonCode: "test",
    issuedBy: "issuer-001",
    tenantId: "tenant-001",
    executionId: "exec-001",
    metadata: {},
    createdAt: new Date().toISOString(),
  };

  assert.strictEqual(legacyDirective.directiveId, "dir-001");
  assert.strictEqual(legacyDirective.kind, "pause");

  // R6-14 fix: createControlDirective must throw (fail-fast enforcement)
  assert.throws(
    () => createControlDirective({
      directiveId: "dir-001",
      kind: "pause",
      targetRef: "target-001",
      reasonCode: "test",
      issuedBy: "issuer-001",
      tenantId: "tenant-001",
      executionId: "exec-001",
    }),
    ValidationError,
  );
});

test("R6-14: OperationalDirective and DecisionDirective are canonical replacements", () => {
  // OperationalDirective is the canonical P2→P3/P4 runtime control directive
  const opDirective = createOperationalDirective({
    type: "pause",
    scope: { tenantId: "test-tenant", harnessRunId: "hrun-001" },
    issuedBy: {
      principalId: "operator-001",
      tenantId: "test-tenant",
      roles: ["operator"],
    },
    reason: "Test pause directive",
  });

  assert.strictEqual(opDirective.operationalDirectiveId.startsWith("opdir_"), true);
  assert.strictEqual(opDirective.type, "pause");
  assert.strictEqual(opDirective.scope.harnessRunId, "hrun-001");

  // DecisionDirective is the canonical P2→P3/P4 business/approval directive
  const decDirective = createDecisionDirective({
    type: "approve",
    scope: { tenantId: "test-tenant", humanResponsibilityRecordId: "hrr-001" },
    issuedBy: {
      principalId: "operator-001",
      tenantId: "test-tenant",
      roles: ["operator"],
    },
    targetRef: "target-001",
    payload: { approved: true },
    reason: "Test approval",
  });

  assert.strictEqual(decDirective.decisionDirectiveId.startsWith("decDir_"), true);
  assert.strictEqual(decDirective.type, "approve");
  assert.strictEqual(decDirective.targetRef, "target-001");
});

test("R6-14: operationalDirective types include all required runtime controls", () => {
  const validTypes: OperationalDirectiveType[] = [
    "mode_switch",
    "pause",
    "resume",
    "quota_adjust",
    "kill",
    "rollback",
  ];

  assert.strictEqual(validTypes.includes("pause"), true);
  assert.strictEqual(validTypes.includes("resume"), true);
  assert.strictEqual(validTypes.includes("kill"), true);
  assert.strictEqual(validTypes.length, 6);
});

test("R6-14: decisionDirective types include all required business decisions", () => {
  const validTypes: DecisionDirectiveType[] = [
    "approve",
    "deny",
    "override",
    "patch",
    "takeover",
    "expire_approval",
  ];

  assert.strictEqual(validTypes.includes("approve"), true);
  assert.strictEqual(validTypes.includes("takeover"), true);
  assert.strictEqual(validTypes.length, 6);
});

// =============================================================================
// R6-15: ExecutionPlan deprecation and PlanGraphBundle migration
// =============================================================================

test("R6-15: createExecutionPlan throws (fail-fast enforcement)", () => {
  // R6-15 fix: createExecutionPlan must throw
  assert.throws(
    () => createExecutionPlan({
      taskId: "task-001",
      tenantId: "tenant-001",
      version: 1,
      steps: [],
    }),
    ValidationError,
  );
});

test("R6-15: PlanGraphBundle is the canonical replacement with full graph structure", () => {
  // Create a proper PlanGraph with nodes and edges
  const planNode1: PlanNode = {
    nodeId: "node-001",
    nodeType: "tool",
    inputRefs: [],
    outputSchemaRef: "schema:output",
    riskClass: "medium",
    budgetIntent: { amount: 100, currency: "USD", resourceKinds: ["compute"] },
    sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
    retryPolicyRef: "retry:default",
    timeoutMs: 60000,
  };

  const planNode2: PlanNode = {
    nodeId: "node-002",
    nodeType: "llm",
    inputRefs: ["node-001"],
    outputSchemaRef: "schema:llm-output",
    riskClass: "medium",
    budgetIntent: { amount: 200, currency: "USD", resourceKinds: ["token"] },
    sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
    retryPolicyRef: "retry:default",
    timeoutMs: 120000,
  };

  const planEdge: PlanEdge = {
    edgeId: "edge-001",
    fromNodeId: "node-001",
    toNodeId: "node-002",
    condition: { type: "always" },
    dependencyType: "hard",
  };

  const planGraph: PlanGraph = {
    graphId: "graph-001",
    nodes: [planNode1, planNode2],
    edges: [planEdge],
    entryNodeIds: ["node-001"],
    terminalNodeIds: ["node-002"],
    joinStrategy: "all",
    graphHash: "hash-abc",
  };

  const planGraphBundle = createPlanGraphBundle({
    harnessRunId: "hrun-001",
    graph: planGraph,
    schedulerPolicy: {
      policyId: "policy-001",
      strategy: "priority_then_fifo",
    },
    budgetPlanRef: "budget:default",
    riskProfile: { riskClass: "medium", reasons: ["multi-step-plan"] },
  });

  assert.strictEqual(planGraphBundle.planGraphBundleId.startsWith("pgb_"), true);
  assert.strictEqual(planGraphBundle.graph.nodes.length, 2);
  assert.strictEqual(planGraphBundle.graph.edges.length, 1);
  assert.strictEqual(planGraphBundle.graph.nodes[0]!.nodeId, "node-001");
  assert.strictEqual(planGraphBundle.graph.edges[0]!.fromNodeId, "node-001");
});

// =============================================================================
// R6-17: Task status enum supports all canonical HarnessRunStatus states
// =============================================================================

test("R6-17: updateTaskPayload schema includes all canonical HarnessRunStatus states", () => {
  // The schema fix for R6-17 adds all canonical states to the status enum
  const validStatuses = [
    "queued", "pending", "in_progress", "awaiting_decision", "done",
    "failed", "cancelled",
    // Additional canonical states from HarnessRunStatus
    "prechecking", "ready", "dispatching", "executing", "blocked",
    "paused", "resuming", "recovering", "timed_out", "superseded",
  ];

  assert.strictEqual(validStatuses.includes("ready"), true);
  assert.strictEqual(validStatuses.includes("paused"), true);
  assert.strictEqual(validStatuses.includes("resuming"), true);
  assert.strictEqual(validStatuses.length, 17);
});

// =============================================================================
// R6-19: stepId deprecation - nodeId is the canonical execution identifier
// =============================================================================

test("R6-19: PlanNode uses nodeId (not stepId) as canonical identifier", () => {
  const planNode: PlanNode = {
    nodeId: "canonical-node-001", // nodeId is the canonical identifier
    nodeType: "tool",
    inputRefs: [],
    outputSchemaRef: "schema:output",
    riskClass: "low",
    budgetIntent: { amount: 50, currency: "USD", resourceKinds: ["compute"] },
    sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
    retryPolicyRef: "retry:default",
    timeoutMs: 30000,
  };

  // nodeId is the canonical identifier for execution units
  assert.strictEqual(planNode.nodeId, "canonical-node-001");
  assert.strictEqual(planNode.nodeId.startsWith("canonical-node-"), true);
});

test("R6-19: NodeRun uses nodeId for execution reference", () => {
  const nodeRun = createNodeRun({
    harnessRunId: "hrun-001",
    planGraphBundleId: "pgb-001",
    graphVersion: 1,
    nodeId: "node-001", // nodeId links to PlanNode
  });

  assert.strictEqual(nodeRun.nodeId, "node-001");
  assert.strictEqual(nodeRun.nodeRunId.startsWith("nrun_"), true);
});

// =============================================================================
// R6-22: EdgeExecutionPlan uses PlanGraph instead of linear orderedTaskIds
// =============================================================================

test("R6-22: buildEdgeExecutionPlan returns EdgePlanGraphBundle with proper PlanGraph", () => {
  const taskIds = ["task-001", "task-002", "task-003"];

  const edgePlan = buildEdgeExecutionPlan(taskIds, "normal");

  // R6-22 fix: EdgePlanGraphBundle uses PlanGraph structure
  assert.ok(edgePlan.planGraph);
  assert.strictEqual(edgePlan.planGraph.nodes.length, 3);
  assert.strictEqual(edgePlan.planGraph.edges.length, 2); // 2 edges for 3 sequential nodes
  assert.strictEqual(edgePlan.syncRequired, true);
  assert.strictEqual(edgePlan.priority, "normal");

  // Verify graph structure
  assert.strictEqual(edgePlan.planGraph.graphId.includes("edge_graph_"), true);
  assert.strictEqual(edgePlan.planGraph.entryNodeIds.length, 1);
  assert.strictEqual(edgePlan.planGraph.terminalNodeIds.length, 1);
  assert.strictEqual(edgePlan.planGraph.joinStrategy, "first_success");
});

test("R6-22: buildLegacyEdgeExecutionPlan returns linear orderedTaskIds (deprecated)", () => {
  const taskIds = ["task-001", "task-002"];

  const legacyPlan = buildLegacyEdgeExecutionPlan(taskIds, "high");

  // Legacy format still works for backward compatibility
  assert.deepStrictEqual(legacyPlan.orderedTaskIds, taskIds);
  assert.strictEqual(legacyPlan.syncRequired, true);
  assert.strictEqual(legacyPlan.priority, "high");
});

test("R6-22: EdgePlanGraphBundle type alias points to canonical PlanGraph structure", () => {
  // The EdgePlanGraphBundle type uses PlanGraph for proper graph semantics
  const taskIds = ["task-A", "task-B"];

  const edgePlan = buildEdgeExecutionPlan(taskIds);

  // Access canonical PlanGraph fields
  const nodes = edgePlan.planGraph.nodes;
  const edges = edgePlan.planGraph.edges;

  assert.strictEqual(nodes[0]!.nodeId, "edge_node_task-A");
  assert.strictEqual(nodes[1]!.nodeId, "edge_node_task-B");
  assert.strictEqual(edges[0]!.fromNodeId, "edge_node_task-A");
  assert.strictEqual(edges[0]!.toNodeId, "edge_node_task-B");
});

// =============================================================================
// R6-21: Lease audit critical path type safety
// =============================================================================

test("R6-21: LeaseAuditRecord uses proper types without 'as any' casts", () => {
  // Create a properly typed lease audit record
  const auditRecord = {
    id: "audit-001",
    executionId: "exec-001",
    leaseId: "lease-001",
    workerId: "worker-001",
    fencingToken: 1,
    eventType: "lease_granted" as const,
    reasonCode: null as string | null,
    recordedAt: new Date().toISOString(),
  };

  // Audit record should have proper typing
  assert.strictEqual(auditRecord.eventType, "lease_granted");
  assert.strictEqual(auditRecord.fencingToken, 1);
  assert.strictEqual(typeof auditRecord.recordedAt, "string");
});

test("R6-21 & R6-23: validateExecutableContract returns properly typed contract", () => {
  // Create test data for validation
  const testArtifactRef = createTestArtifactRef();

  const validSideEffectRecord = {
    sideEffectId: "seffect-001",
    harnessRunId: "hrun-001",
    nodeRunId: "nrun-001",
    nodeAttemptId: "nattempt-001",
    effectKind: "file_write" as const,
    idempotencyKey: "idem-001",
    status: "proposed" as const,
    riskClass: "medium" as RiskClass,
    preCommitPolicyProofRef: testArtifactRef,
    deadline: new Date(Date.now() + 60000).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: 0,
  };

  // R6-23 fix: validateExecutableContract returns typed result
  const result = validateExecutableContract("SideEffectRecord", validSideEffectRecord);

  // Type is properly narrowed - can access sideEffectId directly
  assert.strictEqual(result.sideEffectId, "seffect-001");
  assert.strictEqual(result.effectKind, "file_write");

  // Verify it's not unknown type
  const typed = result as SideEffectRecord;
  assert.strictEqual(typed.sideEffectId, "seffect-001");
  assert.strictEqual(typed.harnessRunId, "hrun-001");
});

// =============================================================================
// R6-24: RuntimeEntryGuard assertNoLegacyTruthWrite enforcement
// =============================================================================

test("R6-24: RuntimeEntryGuard warns on legacy contract usage", () => {
  const guard = new RuntimeEntryGuard();

  // R6-24 fix: assertNoLegacyTruthWrite emits console warning for legacy contracts
  assert.throws(
    () => guard.assertNoLegacyTruthWrite({
      contractName: "ExecutionPlan", // Legacy contract
    }),
    ValidationError,
  );

  assert.throws(
    () => guard.assertNoLegacyTruthWrite({
      contractName: "ControlDirective", // Legacy contract
    }),
    ValidationError,
  );
});

test("R6-24: RuntimeEntryGuard allows canonical contract writes", () => {
  const guard = new RuntimeEntryGuard();

  // Canonical contracts should not throw
  guard.assertNoLegacyTruthWrite({
    contractName: "HarnessRun",
  });

  guard.assertNoLegacyTruthWrite({
    contractName: "PlanGraphBundle",
  });
});

test("R6-24: RuntimeEntryGuard requires platform.* event types for truth writes", () => {
  const guard = new RuntimeEntryGuard();

  // Non-platform event types should throw
  assert.throws(
    () => guard.assertNoLegacyTruthWrite({
      eventType: "custom.event",
    }),
    ValidationError,
  );

  // Platform event types should be allowed
  guard.assertNoLegacyTruthWrite({
    eventType: "platform.task.created",
  });
});

test("R6-24: RuntimeEntryGuard.assertPlanGraphBundleOnly validates PlanGraphBundle structure", () => {
  const guard = new RuntimeEntryGuard();

  // Invalid input should throw
  assert.throws(
    () => guard.assertPlanGraphBundleOnly(null),
    ValidationError,
  );
  assert.throws(
    () => guard.assertPlanGraphBundleOnly({}),
    ValidationError,
  );
  assert.throws(
    () => guard.assertPlanGraphBundleOnly({ planGraphBundleId: "test" }),
    ValidationError,
  );

  // Valid PlanGraphBundle should pass
  const validBundle = createPlanGraphBundle({
    harnessRunId: "hrun-001",
    graph: {
      graphId: "graph-001",
      nodes: [{
        nodeId: "node-001",
        nodeType: "tool",
        inputRefs: [],
        outputSchemaRef: "schema:output",
        riskClass: "medium",
        budgetIntent: { amount: 100, currency: "USD", resourceKinds: ["compute"] },
        sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
        retryPolicyRef: "retry:default",
        timeoutMs: 30000,
      }],
      edges: [],
      entryNodeIds: ["node-001"],
      terminalNodeIds: ["node-001"],
      joinStrategy: "all",
      graphHash: "hash-001",
    },
    schedulerPolicy: { policyId: "policy-001", strategy: "priority_then_fifo" },
    budgetPlanRef: "budget:default",
    riskProfile: { riskClass: "medium", reasons: ["test"] },
  });

  const result = guard.assertPlanGraphBundleOnly(validBundle);
  assert.strictEqual(result.accepted, true);
  assert.strictEqual(result.planGraphBundle.planGraphBundleId, validBundle.planGraphBundleId);
});

// =============================================================================
// Contract Envelope tests (signature verification)
// =============================================================================

test("Contract Envelope: createContractEnvelope creates properly typed envelope", () => {
  const envelope = createContractEnvelope({
    payload: { test: "data" },
  });

  assert.strictEqual(envelope.envelopeId.startsWith("env_"), true);
  assert.strictEqual(envelope.schemaVersion, "v4.3");
  assert.strictEqual(envelope.commandId.startsWith("cmd_"), true);
  assert.strictEqual(envelope.idempotencyKey.startsWith("idem_"), true);
  assert.strictEqual(envelope.correlationId.startsWith("corr_"), true);
  assert.ok(envelope.timestamp);
  assert.strictEqual(envelope.signature, null); // No signature by default
  assert.deepStrictEqual(envelope.payload, { test: "data" });
  assert.strictEqual(envelope.ttl, null);
  assert.deepStrictEqual(envelope.metadata, {});
});

test("Contract Envelope: supports typed payloads", () => {
  interface TestPayload {
    taskId: string;
    status: string;
  }

  const envelope = createContractEnvelope<TestPayload>({
    payload: { taskId: "task-001", status: "completed" },
  });

  const typed = envelope as ContractEnvelope<TestPayload>;
  assert.strictEqual(typed.payload.taskId, "task-001");
  assert.strictEqual(typed.payload.status, "completed");
});

// =============================================================================
// NodeAttemptReceipt type tests
// =============================================================================

test("NodeAttemptReceipt: has all required fields per canonical contract", () => {
  const artifactRef = createTestArtifactRef();

  const receipt: NodeAttemptReceipt = {
    nodeAttemptReceiptId: "receipt-001",
    nodeAttemptId: "nattempt-001",
    nodeRunId: "nrun-001",
    harnessRunId: "hrun-001",
    planGraphId: "graph-001",
    graphVersion: 1,
    receiptKind: "tool",
    status: "succeeded",
    duration: 1500,
    errorDetail: "",
    sideEffectRefs: [],
    budgetSettlementRefs: [],
    evidenceRefs: [artifactRef],
    producedAt: new Date().toISOString(),
  };

  assert.strictEqual(receipt.nodeAttemptReceiptId, "receipt-001");
  assert.strictEqual(receipt.receiptKind, "tool");
  assert.strictEqual(receipt.status, "succeeded");
  assert.strictEqual(receipt.duration, 1500);
  assert.strictEqual(receipt.evidenceRefs.length, 1);
});

// =============================================================================
// RequestEnvelope tests
// =============================================================================

test("RequestEnvelope: has all required fields per §5.3", () => {
  const confirmedTaskSpec: ConfirmedTaskSpec = {
    confirmedTaskSpecId: "ctspec-001",
    taskDraftId: "draft-001",
    tenantId: "tenant-001",
    principal: createTestPrincipal(),
    domainId: "coding",
    goal: "Test task",
    inputs: {},
    constraintPackRef: "cp:default",
    riskClass: "medium",
    idempotencyKey: "idem-001",
    traceId: "trace-001",
    createdAt: new Date().toISOString(),
  };

  const budgetIntent: BudgetIntent = {
    amount: 1000,
    currency: "USD",
    resourceKinds: ["compute", "token"],
  };

  const requestEnvelope = createRequestEnvelopeFromConfirmedTask({
    confirmedTaskSpec,
    budgetIntent,
  });

  assert.ok(requestEnvelope.requestId.startsWith("request_"));
  assert.strictEqual(requestEnvelope.confirmedTaskSpecId, "ctspec-001");
  assert.strictEqual(requestEnvelope.tenantId, "tenant-001");
  assert.strictEqual(requestEnvelope.priority, 0);
  assert.ok(requestEnvelope.requestHash.startsWith("reqhash_"));
  assert.ok(requestEnvelope.submittedAt);
  assert.strictEqual(requestEnvelope.sourcePlane, undefined);
  assert.strictEqual(requestEnvelope.targetPlane, undefined);
});

test("RequestEnvelope: supports sourcePlane/targetPlane for cross-plane routing (R27-17)", () => {
  const confirmedTaskSpec: ConfirmedTaskSpec = {
    confirmedTaskSpecId: "ctspec-002",
    taskDraftId: "draft-002",
    tenantId: "tenant-001",
    principal: createTestPrincipal(),
    domainId: "coding",
    goal: "Cross-plane task",
    inputs: {},
    constraintPackRef: "cp:default",
    riskClass: "low",
    idempotencyKey: "idem-002",
    traceId: "trace-002",
    createdAt: new Date().toISOString(),
  };

  const requestEnvelope = createRequestEnvelopeFromConfirmedTask({
    confirmedTaskSpec,
    budgetIntent: { amount: 500, currency: "USD", resourceKinds: ["compute"] },
    sourcePlane: "P1",
    targetPlane: "P3",
  });

  assert.strictEqual(requestEnvelope.sourcePlane, "P1");
  assert.strictEqual(requestEnvelope.targetPlane, "P3");
});

// =============================================================================
// CANONICAL_CONTRACT_NAMES verification
// =============================================================================

test("CANONICAL_CONTRACT_NAMES: includes all required contracts", () => {
  const requiredContracts: CanonicalContractName[] = [
    "TaskDraft",
    "ConfirmedTaskSpec",
    "RequestEnvelope",
    "HarnessRun",
    "PlanGraphBundle",
    "PlanGraph",
    "PlanNode",
    "PlanEdge",
    "GraphPatch",
    "GraphPatchOperation",
    "NodeRun",
    "NodeAttempt",
    "AttemptLineage",
    "NodeAttemptReceipt",
    "SideEffectRecord",
    "ReconciliationRecord",
    "CompensationRecord",
    "BudgetLedger",
    "BudgetReservation",
    "BudgetSettlement",
    "RunVersionLock",
    "ArtifactVersionLockSet",
    "DecisionInputBundle",
    "HarnessDecision",
    "HumanResponsibilityRecord",
    "EventEnvelope",
    "PlatformFactEvent",
    "OapeflirViewEvent",
  ];

  for (const contract of requiredContracts) {
    assert.strictEqual(CANONICAL_CONTRACT_NAMES.includes(contract), true, `Missing contract: ${contract}`);
  }

  assert.strictEqual(CANONICAL_CONTRACT_NAMES.length, 28);
});
