import assert from "node:assert/strict";
import test from "node:test";
import { RuntimeEntryGuard } from "../../../src/platform/orchestration/harness/runtime/runtime-entry-guard.js";
/**
 * INV-GRAPH-001: The canonical P3 to P4 execution contract is PlanGraphBundle.
 *
 * This test verifies that:
 * 1. Only PlanGraphBundle is accepted as P3→P4 contract
 * 2. Linear steps/ExecutionPlan are rejected
 * 3. PlanGraph structure validation is enforced
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
            joinStrategy: "all",
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
    assert.throws(() => guard.assertPlanGraphBundleOnly(linearPlan), /plan_graph_bundle_required/, "Linear ExecutionPlan must be rejected");
});
test("INV-GRAPH-001: PlanGraph nodes must have valid structure", () => {
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
            joinStrategy: "all",
            graphHash: "hash-bad",
        },
    };
    assert.throws(() => guard.assertPlanGraphBundleOnly(invalidNodeBundle), /plan_graph_bundle_required/, "Invalid node structure must be rejected");
});
test("INV-GRAPH-001: PlanGraph edges must reference valid nodes", () => {
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
            joinStrategy: "all",
            graphHash: "hash-dangle",
        },
    };
    // Should be rejected due to dangling edge reference
    assert.throws(() => guard.assertPlanGraphBundleOnly(danglingEdgeBundle), /plan_graph_bundle_required/, "Dangling edge references must be rejected");
});
test("INV-GRAPH-001: DAG structure required, not linear steps", () => {
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
            joinStrategy: "all",
            graphHash: "hash-linear",
        },
    };
    assert.throws(() => guard.assertPlanGraphBundleOnly(linearStepsAsGraph), /plan_graph_bundle_required/, "Linear steps masquerading as graph must be rejected");
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
            joinStrategy: "all",
            graphHash: "hash-no-version",
        },
    };
    assert.throws(() => guard.assertPlanGraphBundleOnly(noVersionBundle), /plan_graph_bundle_required/, "Missing graphVersion must be rejected");
});
//# sourceMappingURL=plan-graph-only-dispatch.test.js.map