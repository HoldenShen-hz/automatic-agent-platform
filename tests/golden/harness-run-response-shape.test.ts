/**
 * Golden Test: HarnessRun and PlanGraphBundle Response Shapes (R18-27)
 *
 * Verifies that HarnessRun and PlanGraphBundle response shapes are stable
 * and conform to the canonical contract defined in executable-contracts.
 *
 * R18-27: tests/golden/ - 无 HarnessRun/PlanGraphBundle 响应 shape golden test——
 *         golden tests 引用 TaskRecord-era 形态
 * Root cause: No golden tests for HarnessRun/PlanGraphBundle response shapes -
 *            existing golden tests reference TaskRecord-era shapes.
 *
 * These tests verify:
 * - HarnessRun response shape conforms to canonical interface
 * - PlanGraphBundle response shape conforms to canonical interface
 * - NodeRun response shape conforms to canonical interface
 * - NodeAttempt response shape conforms to canonical interface
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { assertGolden } from "../helpers/golden.js";
import {
  createHarnessRun,
  createPlanGraphBundle,
  createNodeRun,
  createNodeAttempt,
  createNodeAttemptReceipt,
  type HarnessRun,
  type PlanGraphBundle,
  type PlanNode,
  type NodeRun,
  type NodeAttempt,
  type NodeAttemptReceipt,
  type GraphValidationReport,
  type ReadyNodeSchedulingPolicy,
  type RiskPreview,
  type ArtifactRef,
} from "../../src/platform/contracts/executable-contracts/index.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";

function normalizeGeneratedId(value: string | undefined, prefix: string): string | undefined {
  if (value == null) {
    return value;
  }
  return value.startsWith(`${prefix}_`) ? `<${prefix}>` : value;
}

function normalizeIsoTimestamp(value: string | undefined): string | undefined {
  if (value == null) {
    return value;
  }
  return /^\d{4}-\d{2}-\d{2}T/.test(value) ? "<iso-timestamp>" : value;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function createTestPlanNode(overrides?: Partial<PlanNode>): PlanNode {
  return {
    nodeId: "test_node_001",
    nodeType: "llm",
    inputRefs: ["input_ref_1"],
    outputSchemaRef: "schema:test.output",
    riskClass: "medium",
    budgetIntent: { amount: 0.01, currency: "USD", resourceKinds: ["token", "compute"] },
    sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
    retryPolicyRef: "retry:test.default",
    timeoutMs: 30000,
    ...overrides,
  };
}

function createTestPlanNodes(): PlanNode[] {
  return [
    createTestPlanNode({ nodeId: "node_planner", nodeType: "llm", inputRefs: [] }),
    createTestPlanNode({ nodeId: "node_generator", nodeType: "tool", inputRefs: ["node_planner"] }),
    createTestPlanNode({ nodeId: "node_evaluator", nodeType: "evaluator", inputRefs: ["node_generator"] }),
  ];
}

function createTestGraphValidationReport(): GraphValidationReport {
  return {
    valid: true,
    findings: [],
    normalizedNodeIds: ["node_planner", "node_generator", "node_evaluator"],
  };
}

function createTestSchedulerPolicy(): ReadyNodeSchedulingPolicy {
  return {
    policyId: "scheduler:test.deterministic_fifo",
    strategy: "deterministic_fifo",
  };
}

function createTestRiskProfile(): RiskPreview {
  return {
    riskClass: "medium",
    reasons: ["test_risk_profile"],
  };
}

function createTestArtifactRefs(): ArtifactRef[] {
  return [
    { artifactId: "art_001", uri: "memory://test/art_001" },
    { artifactId: "art_002", uri: "memory://test/art_002" },
  ];
}

// ---------------------------------------------------------------------------
// HarnessRun Response Shape Tests
// ---------------------------------------------------------------------------

test("golden: HarnessRun response shape matches canonical interface (R18-27)", () => {
  const harness = createE2EHarness("aa-golden-harness-run-");
  try {
    const harnessRunId = newId("harness_run");
    const now = nowIso();

    const harnessRun = createHarnessRun({
      harnessRunId,
      tenantId: "tenant:test",
      domainId: "coding",
      confirmedTaskSpecId: `confirmed_task_spec:${harnessRunId}`,
      requestEnvelopeId: `request_envelope:${harnessRunId}`,
      requestHash: `hash:${harnessRunId}`,
      status: "created",
      constraintPackRef: "constraint_pack:test",
      versionLockId: newId("version_lock"),
      planGraphBundleId: `bundle:${harnessRunId}`,
      budgetLedgerId: newId("budget_ledger"),
      currentSeq: 0,
      createdAt: now,
      updatedAt: now,
    });

    // Verify all canonical fields are present
    assert.ok(harnessRun.harnessRunId, "HarnessRun must have harnessRunId");
    assert.ok(harnessRun.tenantId, "HarnessRun must have tenantId");
    assert.ok(harnessRun.domainId, "HarnessRun must have domainId");
    assert.ok(harnessRun.confirmedTaskSpecId, "HarnessRun must have confirmedTaskSpecId");
    assert.ok(harnessRun.requestEnvelopeId, "HarnessRun must have requestEnvelopeId");
    assert.ok(harnessRun.requestHash, "HarnessRun must have requestHash");
    assert.ok(harnessRun.status, "HarnessRun must have status");
    assert.ok(harnessRun.constraintPackRef, "HarnessRun must have constraintPackRef");
    assert.ok(harnessRun.versionLockId, "HarnessRun must have versionLockId");
    assert.ok(harnessRun.budgetLedgerId, "HarnessRun must have budgetLedgerId");
    assert.ok(typeof harnessRun.currentSeq === "number", "HarnessRun must have numeric currentSeq");
    assert.ok(harnessRun.createdAt, "HarnessRun must have createdAt");
    assert.ok(harnessRun.updatedAt, "HarnessRun must have updatedAt");

    // Verify optional fields
    assert.ok(harnessRun.planGraphBundleId, "HarnessRun should have planGraphBundleId");

    // Golden assertion
    assertGolden("harness-run-response-shape-v1", {
      harnessRunId: "<harness_run>",
      tenantId: harnessRun.tenantId,
      domainId: harnessRun.domainId,
      confirmedTaskSpecId: "confirmed_task_spec:<harness_run>",
      requestEnvelopeId: "request_envelope:<harness_run>",
      requestHash: "hash:<harness_run>",
      status: harnessRun.status,
      constraintPackRef: harnessRun.constraintPackRef,
      versionLockId: normalizeGeneratedId(harnessRun.versionLockId, "version_lock"),
      planGraphBundleId: "bundle:<harness_run>",
      budgetLedgerId: normalizeGeneratedId(harnessRun.budgetLedgerId, "budget_ledger"),
      currentSeq: harnessRun.currentSeq,
      createdAt: normalizeIsoTimestamp(harnessRun.createdAt),
      updatedAt: normalizeIsoTimestamp(harnessRun.updatedAt),
      terminalAt: normalizeIsoTimestamp(harnessRun.terminalAt),
    });

  } finally {
    harness.cleanup();
  }
});

test("golden: HarnessRun terminal states are properly represented (R18-27)", () => {
  const harness = createE2EHarness("aa-golden-harness-run-terminal-");
  try {
    const harnessRunId = newId("harness_run");
    const now = nowIso();
    const terminalAt = nowIso();

    const completedRun = createHarnessRun({
      harnessRunId,
      tenantId: "tenant:test",
      domainId: "coding",
      confirmedTaskSpecId: `confirmed_task_spec:${harnessRunId}`,
      requestEnvelopeId: `request_envelope:${harnessRunId}`,
      requestHash: `hash:${harnessRunId}`,
      status: "completed",
      constraintPackRef: "constraint_pack:test",
      versionLockId: newId("version_lock"),
      budgetLedgerId: newId("budget_ledger"),
      currentSeq: 1,
      createdAt: now,
      updatedAt: terminalAt,
      terminalAt,
      terminalReason: "task.completed",
    });

    // Verify terminal state fields
    assert.ok(completedRun.terminalAt, "Completed HarnessRun must have terminalAt");
    assert.equal(completedRun.status, "completed", "Status should be completed");

    // Golden assertion for terminal state
    assertGolden("harness-run-terminal-state-v1", {
      status: completedRun.status,
      terminalAt: normalizeIsoTimestamp(completedRun.terminalAt),
      terminalReason: completedRun.terminalReason,
      currentSeq: completedRun.currentSeq,
    });

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// PlanGraphBundle Response Shape Tests
// ---------------------------------------------------------------------------

test("golden: PlanGraphBundle response shape matches canonical interface (R18-27)", () => {
  const harness = createE2EHarness("aa-golden-plan-graph-bundle-");
  try {
    const bundle = createPlanGraphBundle({
      harnessRunId: "hrun_test_001",
      graph: {
        graphId: "graph_test_001",
        nodes: createTestPlanNodes(),
        edges: [
          {
            edgeId: "edge_1",
            fromNodeId: "node_planner",
            toNodeId: "node_generator",
            condition: true,
            dependencyType: "hard",
          },
          {
            edgeId: "edge_2",
            fromNodeId: "node_generator",
            toNodeId: "node_evaluator",
            condition: true,
            dependencyType: "hard",
          },
        ],
        entryNodeIds: ["node_planner"],
        terminalNodeIds: ["node_evaluator"],
        joinStrategy: "all",
        graphHash: "hash_test_001",
      },
      schedulerPolicy: createTestSchedulerPolicy(),
      budgetPlanRef: "budget:test.ref",
      riskProfile: createTestRiskProfile(),
      validationReport: createTestGraphValidationReport(),
      artifactRefs: createTestArtifactRefs(),
    });

    // Verify all canonical fields
    assert.ok(bundle.planGraphBundleId, "PlanGraphBundle must have planGraphBundleId");
    assert.ok(bundle.harnessRunId, "PlanGraphBundle must have harnessRunId");
    assert.equal(bundle.graphVersion, 1, "PlanGraphBundle must have graphVersion");
    assert.ok(bundle.graph, "PlanGraphBundle must have graph");
    assert.ok(bundle.schedulerPolicy, "PlanGraphBundle must have schedulerPolicy");
    assert.ok(bundle.budgetPlanRef, "PlanGraphBundle must have budgetPlanRef");
    assert.ok(bundle.riskProfile, "PlanGraphBundle must have riskProfile");
    assert.ok(bundle.validationReport, "PlanGraphBundle must have validationReport");
    assert.ok(Array.isArray(bundle.artifactRefs), "PlanGraphBundle must have artifactRefs array");
    assert.ok(bundle.createdAt, "PlanGraphBundle must have createdAt");

    // Verify graph structure
    assert.ok(bundle.graph.graphId, "Graph must have graphId");
    assert.ok(Array.isArray(bundle.graph.nodes), "Graph must have nodes array");
    assert.ok(Array.isArray(bundle.graph.edges), "Graph must have edges array");
    assert.ok(Array.isArray(bundle.graph.entryNodeIds), "Graph must have entryNodeIds");
    assert.ok(Array.isArray(bundle.graph.terminalNodeIds), "Graph must have terminalNodeIds");
    assert.ok(bundle.graph.joinStrategy, "Graph must have joinStrategy");
    assert.ok(bundle.graph.graphHash, "Graph must have graphHash");

    // Golden assertion
    assertGolden("plan-graph-bundle-response-shape-v1", {
      planGraphBundleId: normalizeGeneratedId(bundle.planGraphBundleId, "pgb"),
      harnessRunId: bundle.harnessRunId,
      graphVersion: bundle.graphVersion,
      graph: {
        graphId: bundle.graph.graphId,
        nodesCount: bundle.graph.nodes.length,
        edgesCount: bundle.graph.edges.length,
        entryNodeIds: bundle.graph.entryNodeIds,
        terminalNodeIds: bundle.graph.terminalNodeIds,
        joinStrategy: bundle.graph.joinStrategy,
        graphHash: bundle.graph.graphHash,
      },
      schedulerPolicy: bundle.schedulerPolicy,
      budgetPlanRef: bundle.budgetPlanRef,
      riskProfile: bundle.riskProfile,
      validationReport: bundle.validationReport,
      artifactRefsCount: bundle.artifactRefs.length,
      createdAt: normalizeIsoTimestamp(bundle.createdAt),
    });

  } finally {
    harness.cleanup();
  }
});

test("golden: PlanGraphBundle node structure matches canonical interface (R18-27)", () => {
  const harness = createE2EHarness("aa-golden-plan-node-");
  try {
    const nodes = createTestPlanNodes();

    // Verify node structure for each node type
    for (const node of nodes) {
      assert.ok(node.nodeId, "PlanNode must have nodeId");
      assert.ok(node.nodeType, "PlanNode must have nodeType");
      assert.ok(Array.isArray(node.inputRefs), "PlanNode must have inputRefs array");
      assert.ok(node.outputSchemaRef, "PlanNode must have outputSchemaRef");
      assert.ok(node.riskClass, "PlanNode must have riskClass");
      assert.ok(node.budgetIntent, "PlanNode must have budgetIntent");
      assert.ok(node.sideEffectProfile, "PlanNode must have sideEffectProfile");
      assert.ok(node.retryPolicyRef, "PlanNode must have retryPolicyRef");
      assert.ok(typeof node.timeoutMs === "number", "PlanNode must have numeric timeoutMs");
    }

    // Verify specific node types
    const llmNode = nodes.find((n) => n.nodeType === "llm");
    assert.ok(llmNode, "Should have an LLM node");
    assert.equal(llmNode?.riskClass, "medium", "LLM node should have medium risk by default");

    const toolNode = nodes.find((n) => n.nodeType === "tool");
    assert.ok(toolNode, "Should have a tool node");

    // Golden assertion
    assertGolden("plan-node-response-shape-v1", {
      nodes: nodes.map((n) => ({
        nodeId: n.nodeId,
        nodeType: n.nodeType,
        inputRefs: n.inputRefs,
        outputSchemaRef: n.outputSchemaRef,
        riskClass: n.riskClass,
        budgetIntent: n.budgetIntent,
        sideEffectProfile: n.sideEffectProfile,
        retryPolicyRef: n.retryPolicyRef,
        timeoutMs: n.timeoutMs,
      })),
    });

  } finally {
    harness.cleanup();
  }
});

test("golden: PlanGraphBundle validationReport structure is valid (R18-27)", () => {
  const harness = createE2EHarness("aa-golden-validation-report-");
  try {
    const bundle = createPlanGraphBundle({
      harnessRunId: "hrun_validation_test",
      graph: {
        graphId: "graph_validation_test",
        nodes: [createTestPlanNode()],
        edges: [],
        entryNodeIds: ["test_node_001"],
        terminalNodeIds: ["test_node_001"],
        joinStrategy: "all",
        graphHash: "hash_validation",
      },
      schedulerPolicy: createTestSchedulerPolicy(),
      budgetPlanRef: "budget:validation.test",
      riskProfile: createTestRiskProfile(),
      validationReport: {
        valid: true,
        findings: [],
        normalizedNodeIds: ["test_node_001"],
      },
      artifactRefs: [],
    });

    const report = bundle.validationReport;
    assert.ok(typeof report.valid === "boolean", "validationReport.valid must be boolean");
    assert.ok(Array.isArray(report.findings), "validationReport.findings must be array");
    assert.ok(report.findings.length === 0, "Valid bundle should have no findings");

    // Golden assertion
    assertGolden("plan-graph-validation-report-v1", {
      valid: report.valid,
      findings: report.findings,
      normalizedNodeIds: report.normalizedNodeIds,
      riskPropagation: report.riskPropagation,
      worstPath: report.worstPath,
    });

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// NodeRun Response Shape Tests
// ---------------------------------------------------------------------------

test("golden: NodeRun response shape matches canonical interface (R18-27)", () => {
  const harness = createE2EHarness("aa-golden-node-run-");
  try {
    const nodeRunId = newId("node_run");
    const harnessRunId = newId("harness_run");
    const planGraphBundleId = "bundle_test_001";
    const now = nowIso();

    const nodeRun = createNodeRun({
      nodeRunId,
      harnessRunId,
      planGraphBundleId,
      graphVersion: 1,
      nodeId: "test_node_001",
      currentSeq: 0,
    });

    // Verify canonical fields
    assert.ok(nodeRun.nodeRunId, "NodeRun must have nodeRunId");
    assert.ok(nodeRun.harnessRunId, "NodeRun must have harnessRunId");
    assert.ok(nodeRun.planGraphBundleId, "NodeRun must have planGraphBundleId");
    assert.equal(nodeRun.graphVersion, 1, "NodeRun must have graphVersion");
    assert.ok(nodeRun.nodeId, "NodeRun must have nodeId");
    assert.ok(nodeRun.status, "NodeRun must have status");
    assert.equal(nodeRun.attemptCount, 0, "NodeRun should have attemptCount of 0");
    assert.ok(typeof nodeRun.currentSeq === "number", "NodeRun must have numeric currentSeq");
    assert.ok(nodeRun.createdAt, "NodeRun must have createdAt");
    assert.ok(nodeRun.updatedAt, "NodeRun must have updatedAt");

    // Golden assertion
    assertGolden("node-run-response-shape-v1", {
      nodeRunId: normalizeGeneratedId(nodeRun.nodeRunId, "node_run"),
      harnessRunId: normalizeGeneratedId(nodeRun.harnessRunId, "harness_run"),
      planGraphBundleId: nodeRun.planGraphBundleId,
      graphVersion: nodeRun.graphVersion,
      nodeId: nodeRun.nodeId,
      status: nodeRun.status,
      attemptCount: nodeRun.attemptCount,
      currentSeq: nodeRun.currentSeq,
      createdAt: normalizeIsoTimestamp(nodeRun.createdAt),
      updatedAt: normalizeIsoTimestamp(nodeRun.updatedAt),
      leaseId: nodeRun.leaseId,
      fencingToken: nodeRun.fencingToken,
      terminalReason: nodeRun.terminalReason,
    });

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// NodeAttempt Response Shape Tests
// ---------------------------------------------------------------------------

test("golden: NodeAttempt response shape matches canonical interface (R18-27)", () => {
  const harness = createE2EHarness("aa-golden-node-attempt-");
  try {
    const nodeAttemptId = newId("node_attempt");
    const nodeRunId = newId("node_run");
    const now = nowIso();

    const nodeAttempt = createNodeAttempt({
      nodeAttemptId,
      nodeRunId,
      attemptNo: 1,
      attemptKind: "initial",
      executorRef: "executor:test",
      inputSnapshotRef: { artifactId: "input_art", uri: "memory://test/input" },
    });

    // Verify canonical fields
    assert.ok(nodeAttempt.nodeAttemptId, "NodeAttempt must have nodeAttemptId");
    assert.ok(nodeAttempt.nodeRunId, "NodeAttempt must have nodeRunId");
    assert.equal(nodeAttempt.attemptNo, 1, "NodeAttempt must have attemptNo");
    assert.ok(nodeAttempt.attemptKind, "NodeAttempt must have attemptKind");
    assert.ok(nodeAttempt.executorRef, "NodeAttempt must have executorRef");
    assert.ok(nodeAttempt.inputSnapshotRef, "NodeAttempt must have inputSnapshotRef");

    // Golden assertion
    assertGolden("node-attempt-response-shape-v1", {
      nodeAttemptId: normalizeGeneratedId(nodeAttempt.nodeAttemptId, "node_attempt"),
      nodeRunId: normalizeGeneratedId(nodeAttempt.nodeRunId, "node_run"),
      attemptNo: nodeAttempt.attemptNo,
      attemptKind: nodeAttempt.attemptKind,
      executorRef: nodeAttempt.executorRef,
      inputSnapshotRef: nodeAttempt.inputSnapshotRef,
      receiptId: nodeAttempt.receiptId,
      startedAt: normalizeIsoTimestamp(nodeAttempt.startedAt),
      completedAt: normalizeIsoTimestamp(nodeAttempt.completedAt),
    });

  } finally {
    harness.cleanup();
  }
});

test("golden: NodeAttemptReceipt response shape matches canonical interface (R18-27)", () => {
  const harness = createE2EHarness("aa-golden-node-attempt-receipt-");
  try {
    const nodeAttemptId = newId("node_attempt");
    const nodeRunId = newId("node_run");

    const receipt = createNodeAttemptReceipt({
      nodeAttemptId,
      nodeRunId,
      receiptKind: "llm",
      status: "succeeded",
      evidenceRefs: [
        { artifactId: "evidence_001", uri: "memory://test/evidence_001" },
      ],
    });

    // Verify canonical fields
    assert.ok(receipt.nodeAttemptId, "NodeAttemptReceipt must have nodeAttemptId");
    assert.ok(receipt.nodeRunId, "NodeAttemptReceipt must have nodeRunId");
    assert.ok(receipt.receiptKind, "NodeAttemptReceipt must have receiptKind");
    assert.ok(receipt.status, "NodeAttemptReceipt must have status");
    assert.ok(Array.isArray(receipt.evidenceRefs), "NodeAttemptReceipt must have evidenceRefs array");

    // Golden assertion
    assertGolden("node-attempt-receipt-response-shape-v1", {
      nodeAttemptId: normalizeGeneratedId(receipt.nodeAttemptId, "node_attempt"),
      nodeRunId: normalizeGeneratedId(receipt.nodeRunId, "node_run"),
      receiptKind: receipt.receiptKind,
      status: receipt.status,
      evidenceRefs: receipt.evidenceRefs,
    });

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// End of R18-27 Golden Tests
// ---------------------------------------------------------------------------
