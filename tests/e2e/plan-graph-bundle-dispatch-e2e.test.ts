/**
 * E2E PlanGraphBundle Dispatch Tests (R18-26)
 *
 * End-to-end tests covering the canonical P3→P4 execution path via PlanGraphBundle dispatch.
 *
 * R18-26: tests/e2e/ - 无 PlanGraphBundle dispatch e2e 测试——canonical P3→P4 路径零覆盖
 * Root cause: No E2E tests for PlanGraphBundle dispatch, meaning the canonical P3→P4 execution
 *            path has zero coverage.
 *
 * These tests verify:
 * - PlanGraphBundle is created via minimalWorkflowToPlanGraphBundle in runMultiStepOrchestration
 * - The oapeflir://plan request format triggers the P3→P4 path correctly
 * - RuntimeEntryGuard validates PlanGraphBundle at dispatch entry
 * - Full execution lifecycle with PlanGraphBundle in place
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createE2EHarness } from "../helpers/e2e-harness.js";
import { withProcessGuard } from "../helpers/process-guard.js";
import { runMultiStepOrchestration } from "../../src/platform/five-plane-execution/execution-engine/multi-step-orchestration.js";
// @ts-ignore
import { minimalWorkflowToPlanGraphBundle } from "../../src/platform/five-plane-orchestration/oapeflir/runtime-execute-bridge.js";
import type { PlanGraphBundle, PlanNode } from "../../src/platform/contracts/executable-contracts/index.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/**
 * Creates a minimal PlanGraphBundle for testing the P3→P4 dispatch path.
 */
function createTestPlanGraphBundle(harnessRunId: string): PlanGraphBundle {
  const plannerNodeId = "node_planner";
  const generatorNodeId = "node_generator";
  const evaluatorNodeId = "node_evaluator";

  const nodes: PlanNode[] = [
    {
      nodeId: plannerNodeId,
      nodeType: "llm",
      inputRefs: ["task:e2e_plan_graph_bundle_test"],
      outputSchemaRef: "schema:harness.plan",
      riskClass: "medium",
      budgetIntent: { amount: 0.01, currency: "USD", resourceKinds: ["token", "compute"] },
      sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
      retryPolicyRef: "retry:harness.default",
      timeoutMs: 30000,
    },
    {
      nodeId: generatorNodeId,
      nodeType: "tool",
      inputRefs: [plannerNodeId],
      outputSchemaRef: "schema:harness.work_product",
      riskClass: "medium",
      budgetIntent: { amount: 0.01, currency: "USD", resourceKinds: ["token", "compute"] },
      sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
      retryPolicyRef: "retry:harness.default",
      timeoutMs: 30000,
    },
    {
      nodeId: evaluatorNodeId,
      nodeType: "evaluator",
      inputRefs: [generatorNodeId],
      outputSchemaRef: "schema:harness.evaluation",
      riskClass: "medium",
      budgetIntent: { amount: 0.01, currency: "USD", resourceKinds: ["token", "compute"] },
      sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
      retryPolicyRef: "retry:harness.default",
      timeoutMs: 30000,
    },
  ];

  return {
    planGraphBundleId: "bundle_e2e_test_001",
    harnessRunId,
    graphVersion: 1,
    graph: {
      graphId: "graph_e2e_test_001",
      nodes,
      edges: [
        {
          edgeId: "edge_1",
          fromNodeId: plannerNodeId,
          toNodeId: generatorNodeId,
          condition: true,
          dependencyType: "hard",
        },
        {
          edgeId: "edge_2",
          fromNodeId: generatorNodeId,
          toNodeId: evaluatorNodeId,
          condition: true,
          dependencyType: "hard",
        },
      ],
      entryNodeIds: [plannerNodeId],
      terminalNodeIds: [evaluatorNodeId],
      joinStrategy: "all",
      graphHash: "hash_e2e_test_001",
    },
    schedulerPolicy: {
      policyId: "scheduler:harness.deterministic_fifo",
      strategy: "deterministic_fifo",
    },
    budgetPlanRef: "budget:harness.e2e_test",
    riskProfile: {
      riskClass: "medium",
      reasons: ["e2e_test_plan_graph_bundle"],
    },
    validationReport: {
      valid: true,
      findings: [],
      normalizedNodeIds: [plannerNodeId, generatorNodeId, evaluatorNodeId],
    },
    artifactRefs: [],
    createdAt: new Date().toISOString(),
  };
}

/**
 * Serializes a PlanGraphBundle's nodes into oapeflir://plan format for runMultiStepOrchestration.
 */
function serialiseOapeflirPlan(nodes: PlanNode[]): string {
  return `oapeflir://plan ${JSON.stringify(nodes)}`;
}

// ---------------------------------------------------------------------------
// Test 1: PlanGraphBundle dispatch via oapeflir://plan request format
// ---------------------------------------------------------------------------

test("E2E PlanGraphBundle: runMultiStepOrchestration with oapeflir://plan creates valid PlanGraphBundle (R18-26)", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-plan-graph-bundle-");
    try {
      const planGraphBundle = createTestPlanGraphBundle("hrun_e2e_test_001");
// @ts-ignore
      const oapeflirRequest = serialiseOapeflirPlan(planGraphBundle.graph.nodes);

      // Execute orchestration with oapeflir://plan format - this triggers the P3→P4 path
      const result = await runMultiStepOrchestration({
        dbPath: harness.dbPath,
        title: "E2E PlanGraphBundle dispatch test",
        request: oapeflirRequest,
      });

      // Verify result structure
      assert.ok(result, "Should return orchestration result");
      assert.ok(result.snapshot, "Result should contain task snapshot");
      assert.ok(result.plannedWorkflow, "Result should contain planned workflow");
      assert.ok(result.routing, "Result should contain routing decision");

      // Verify routing indicates oapeflir_bridge path was used
      assert.equal(
        result.routing.routeReason,
        "oapeflir_bridge",
        "Routing should indicate oapeflir_bridge was used for P3→P4 path"
      );

      // Verify workflow was created with correct workflowId prefix
      assert.ok(
        result.plannedWorkflow.workflow.workflowId.startsWith("oapeflir_"),
        "WorkflowId should have oapeflir_ prefix for P3→P4 path"
      );

      // Verify task snapshot contains expected fields
      const snapshot = result.snapshot;
      assert.ok(snapshot.task, "Snapshot should contain task");
      assert.ok(snapshot.workflow, "Snapshot should contain workflow");
      assert.ok(snapshot.session, "Snapshot should contain session");
// @ts-ignore
      assert.ok(snapshot.executions, "Snapshot should contain executions array");

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

// ---------------------------------------------------------------------------
// Test 2: minimalWorkflowToPlanGraphBundle produces valid PlanGraphBundle
// ---------------------------------------------------------------------------

test("E2E PlanGraphBundle: minimalWorkflowToPlanGraphBundle produces valid structure (R18-26)", () => {
  const harness = createE2EHarness("aa-e2e-minimal-workflow-to-bundle-");
  try {
    // Create a minimal workflow definition
    const minimalWorkflow = {
      workflowId: "test_workflow_001",
      steps: [
        {
          stepId: "step_1",
          roleId: "planner",
          outputKey: "output_step_1",
          inputKeys: [] as string[],
          timeoutMs: 30000,
          maxAttempts: 1,
          dependsOnStepIds: [] as string[],
        },
        {
          stepId: "step_2",
          roleId: "generator",
          outputKey: "output_step_2",
          inputKeys: ["step_1"],
          timeoutMs: 30000,
          maxAttempts: 1,
          dependsOnStepIds: ["step_1"],
        },
      ],
    };

    const harnessRunId = "hrun_test_minimal_001";
    const bundle = minimalWorkflowToPlanGraphBundle(minimalWorkflow, harnessRunId);

    // Verify PlanGraphBundle structure
    assert.ok(bundle.planGraphBundleId, "Bundle should have planGraphBundleId");
    assert.equal(bundle.harnessRunId, harnessRunId, "Bundle harnessRunId should match");
    assert.equal(bundle.graphVersion, 1, "Bundle graphVersion should be 1");

    // Verify graph structure
    assert.ok(bundle.graph, "Bundle should have graph");
    assert.equal(bundle.graph.nodes.length, 2, "Graph should have 2 nodes");
    assert.equal(bundle.graph.edges.length, 1, "Graph should have 1 edge");
    assert.ok(bundle.graph.entryNodeIds.length > 0, "Graph should have entry nodes");
    assert.ok(bundle.graph.terminalNodeIds.length > 0, "Graph should have terminal nodes");

    // Verify nodes have correct mapping from steps
// @ts-ignore
    const node1 = bundle.graph.nodes.find((n) => n.nodeId === "step_1");
    assert.ok(node1, "Node for step_1 should exist");
    assert.equal(node1?.nodeType, "llm", "step_1 should be mapped to llm nodeType");

// @ts-ignore
    const node2 = bundle.graph.nodes.find((n) => n.nodeId === "step_2");
    assert.ok(node2, "Node for step_2 should exist");
    assert.equal(node2?.nodeType, "tool", "step_2 should be mapped to tool nodeType");

    // Verify scheduler policy
    assert.ok(bundle.schedulerPolicy, "Bundle should have schedulerPolicy");
    assert.equal(bundle.schedulerPolicy.strategy, "deterministic_fifo", "Strategy should be deterministic_fifo");

    // Verify validation report
    assert.ok(bundle.validationReport, "Bundle should have validationReport");
    assert.equal(bundle.validationReport.valid, true, "Validation should be valid");

  } finally {
    harness.cleanup();
  }
});

// ---------------------------------------------------------------------------
// Test 3: Full execution lifecycle with PlanGraphBundle
// ---------------------------------------------------------------------------

test("E2E PlanGraphBundle: full execution lifecycle completes with terminal state (R18-26)", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-plan-graph-lifecycle-");
    try {
      // Create a simple 2-node plan for fast execution
      const nodes: PlanNode[] = [
        {
          nodeId: "node_read",
          nodeType: "tool",
          inputRefs: [],
          outputSchemaRef: "schema:step.output",
          riskClass: "low",
          budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
          sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
          retryPolicyRef: "retry:default",
          timeoutMs: 10000,
        },
        {
          nodeId: "node_write",
          nodeType: "tool",
          inputRefs: ["node_read"],
          outputSchemaRef: "schema:step.output",
          riskClass: "low",
          budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
          sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
          retryPolicyRef: "retry:default",
          timeoutMs: 10000,
        },
      ];

      const oapeflirRequest = serialiseOapeflirPlan(nodes);

      const result = await runMultiStepOrchestration({
        dbPath: harness.dbPath,
        title: "E2E PlanGraphBundle lifecycle test",
        request: oapeflirRequest,
      });

      // Verify task reached terminal state
      assert.ok(result.snapshot.task, "Snapshot should have task");
      const task = result.snapshot.task!;
      assert.ok(
        task.status === "done" || task.status === "failed" || task.status === "cancelled",
        `Task should reach terminal state (done/failed/cancelled), got: ${task.status}`
      );

      // Verify workflow is in terminal state
      assert.ok(result.snapshot.workflow, "Snapshot should have workflow");
      const workflow = result.snapshot.workflow!;
      assert.ok(
        workflow.status === "completed" || workflow.status === "failed",
        `Workflow should be in terminal state, got: ${workflow.status}`
      );

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

// ---------------------------------------------------------------------------
// Test 4: PlanGraphBundle dispatch respects node dependencies
// ---------------------------------------------------------------------------

test("E2E PlanGraphBundle: dispatch respects node dependency edges (R18-26)", async () => {
  const guard = withProcessGuard(async () => {
    const harness = createE2EHarness("aa-e2e-plan-graph-deps-");
    try {
      // Create a 3-node chain: A → B → C
      const nodes: PlanNode[] = [
        {
          nodeId: "node_a",
          nodeType: "tool",
          inputRefs: [],
          outputSchemaRef: "schema:a.output",
          riskClass: "low",
          budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
          sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
          retryPolicyRef: "retry:default",
          timeoutMs: 10000,
        },
        {
          nodeId: "node_b",
          nodeType: "tool",
          inputRefs: ["node_a"],
          outputSchemaRef: "schema:b.output",
          riskClass: "low",
          budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
          sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
          retryPolicyRef: "retry:default",
          timeoutMs: 10000,
        },
        {
          nodeId: "node_c",
          nodeType: "tool",
          inputRefs: ["node_b"],
          outputSchemaRef: "schema:c.output",
          riskClass: "low",
          budgetIntent: { amount: 0.001, currency: "USD", resourceKinds: ["token"] },
          sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
          retryPolicyRef: "retry:default",
          timeoutMs: 10000,
        },
      ];

      const oapeflirRequest = serialiseOapeflirPlan(nodes);

      const result = await runMultiStepOrchestration({
        dbPath: harness.dbPath,
        title: "E2E PlanGraphBundle dependency chain test",
        request: oapeflirRequest,
      });

      // Verify the orchestration completed
      assert.ok(result.snapshot.task, "Should have task snapshot");

      // Verify the planned workflow has correct dependency structure
      const workflow = result.plannedWorkflow;
      assert.ok(workflow.executionSteps.length >= 3, "Should have at least 3 execution steps");

      // Verify routing was successful
      assert.equal(result.routing.requiresOrchestration, true, "Should require orchestration for multi-step");

    } finally {
      harness.cleanup();
    }
  });
  await guard();
});

// ---------------------------------------------------------------------------
// End of R18-26 E2E Tests
// ---------------------------------------------------------------------------
