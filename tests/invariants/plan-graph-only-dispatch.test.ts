import assert from "node:assert/strict";
import test from "node:test";

import { RuntimeEntryGuard } from "../../src/platform/orchestration/harness/runtime/runtime-entry-guard.js";
import { ValidationError } from "../../src/platform/contracts/errors.js";

/**
 * INV-GRAPH-001: The canonical P3 to P4 execution contract is PlanGraphBundle.
 *
 * This test verifies that:
 * 1. Only PlanGraphBundle is accepted as P3→P4 contract
 * 2. Linear steps/ExecutionPlan are rejected
 * 3. Entry guard enforces bundle envelope; deeper graph semantics are validated downstream
 */
test("INV-GRAPH-001: PlanGraphBundle is the only valid P3→P4 contract", () => {
  const guard = new RuntimeEntryGuard();

  const validBundle = {
    planGraphBundleId: "bundle-graph-001",
    harnessRunId: "run-graph-001",
    graphVersion: 1,
    graph: {
      nodes: [
        {
          nodeId: "node:analyze",
          nodeType: "llm",
          inputRefs: ["task:${taskId}"],
          outputSchemaRef: "schema:analyze",
          riskClass: "low",
          budgetIntent: {
            amount: 0.1,
            currency: "USD",
            resourceKinds: ["token"],
          },
          sideEffectProfile: {
            mayCommitExternalEffect: false,
            reversible: true,
          },
          retryPolicyRef: "retry:default",
          timeoutMs: 60000,
        },
        {
          nodeId: "node:execute",
          nodeType: "tool",
          inputRefs: ["node:analyze.output"],
          outputSchemaRef: "schema:execute",
          riskClass: "medium",
          budgetIntent: {
            amount: 0.05,
            currency: "USD",
            resourceKinds: ["tool"],
          },
          sideEffectProfile: {
            mayCommitExternalEffect: true,
            reversible: false,
          },
          retryPolicyRef: "retry:default",
          timeoutMs: 30000,
        },
      ],
      edges: [
        {
          edgeId: "edge-1",
          sourceNodeId: "node:analyze",
          targetNodeId: "node:execute",
          condition: "always",
        },
      ],
      entryNodeIds: ["node:analyze"],
      terminalNodeIds: ["node:execute"],
      joinStrategy: "all" as const,
      graphHash: "sha256:abc123",
    },
  };

  const result = guard.assertPlanGraphBundleOnly(validBundle);
  assert.equal(result.accepted, true);
  assert.equal(result.planGraphBundle.graph.nodes.length, 2);
  assert.equal(result.planGraphBundle.graph.edges.length, 1);
});

test("INV-GRAPH-001: Linear ExecutionPlan is rejected", () => {
  const guard = new RuntimeEntryGuard();

  // Legacy linear plan
  const linearPlan = {
    planId: "plan-linear-001",
    taskId: "task-001",
    steps: [
      { stepId: "step-1", name: "Analyze", tool: "analyze" },
      { stepId: "step-2", name: "Execute", tool: "execute" },
      { stepId: "step-3", name: "Output", tool: "output" },
    ],
  };

  assert.throws(
    () => guard.assertPlanGraphBundleOnly(linearPlan),
    (error: unknown) =>
      error instanceof ValidationError && error.code === "runtime_entry_guard.plan_graph_bundle_required",
    "Linear ExecutionPlan must be rejected",
  );
});

test("INV-GRAPH-001: Envelope guard does not validate node internals", () => {
  const guard = new RuntimeEntryGuard();

  // Invalid node - missing required fields
  const invalidNodeBundle = {
    planGraphBundleId: "bundle-invalid-node",
    harnessRunId: "run-invalid",
    graphVersion: 1,
    graph: {
      nodes: [
        {
          nodeId: "node:bad",
          // Missing nodeType, inputRefs, outputSchemaRef, etc.
        },
      ],
      edges: [],
      entryNodeIds: ["node:bad"],
      terminalNodeIds: ["node:bad"],
      joinStrategy: "all" as const,
      graphHash: "hash-bad",
    },
  };

  const result = guard.assertPlanGraphBundleOnly(invalidNodeBundle);
  assert.equal(result.accepted, true);
});

test("INV-GRAPH-001: Envelope guard does not validate edge references", () => {
  const guard = new RuntimeEntryGuard();

  const danglingEdgeBundle = {
    planGraphBundleId: "bundle-dangle",
    harnessRunId: "run-dangle",
    graphVersion: 1,
    graph: {
      nodes: [
        {
          nodeId: "node:exists",
          nodeType: "llm",
          inputRefs: [],
          outputSchemaRef: "schema:exists",
          riskClass: "low",
          budgetIntent: {
            amount: 0.1,
            currency: "USD",
            resourceKinds: ["token"],
          },
          sideEffectProfile: {
            mayCommitExternalEffect: false,
            reversible: true,
          },
          retryPolicyRef: "retry:default",
          timeoutMs: 60000,
        },
      ],
      edges: [
        {
          edgeId: "edge-dangle",
          sourceNodeId: "node:exists",
          targetNodeId: "node:does-not-exist", // Dangling reference
          condition: "always",
        },
      ],
      entryNodeIds: ["node:exists"],
      terminalNodeIds: ["node:does-not-exist"],
      joinStrategy: "all" as const,
      graphHash: "hash-dangle",
    },
  };

  const result = guard.assertPlanGraphBundleOnly(danglingEdgeBundle);
  assert.equal(result.accepted, true);
});

test("INV-GRAPH-001: Envelope guard accepts graph-shaped legacy step payloads", () => {
  const guard = new RuntimeEntryGuard();

  // Attempt to use linear steps array as a graph
  const linearStepsAsGraph = {
    planGraphBundleId: "bundle-linear-steps",
    harnessRunId: "run-linear",
    graphVersion: 1,
    graph: {
      nodes: [
        { stepId: "step-1", name: "Step 1" }, // Not a proper PlanNode
        { stepId: "step-2", name: "Step 2" },
        { stepId: "step-3", name: "Step 3" },
      ],
      edges: [],
      entryNodeIds: ["step-1"],
      terminalNodeIds: ["step-3"],
      joinStrategy: "all" as const,
      graphHash: "hash-linear",
    },
  };

  const result = guard.assertPlanGraphBundleOnly(linearStepsAsGraph);
  assert.equal(result.accepted, true);
});

test("INV-GRAPH-001: graphVersion is required for immutability tracking", () => {
  const guard = new RuntimeEntryGuard();

  const noVersionBundle = {
    planGraphBundleId: "bundle-no-version",
    harnessRunId: "run-no-version",
    // Missing graphVersion
    graph: {
      nodes: [],
      edges: [],
      entryNodeIds: [],
      terminalNodeIds: [],
      joinStrategy: "all" as const,
      graphHash: "hash-no-version",
    },
  };

  assert.throws(
    () => guard.assertPlanGraphBundleOnly(noVersionBundle),
    (error: unknown) =>
      error instanceof ValidationError && error.code === "runtime_entry_guard.plan_graph_bundle_required",
    "Missing graphVersion must be rejected",
  );
});
