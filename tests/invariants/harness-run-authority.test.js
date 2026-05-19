import assert from "node:assert/strict";
import test from "node:test";
import { RuntimeEntryGuard } from "../../../src/platform/orchestration/harness/runtime/runtime-entry-guard.js";
/**
 * INV-RUN-001: HarnessRuntime is the only execution entry and
 * P4 must reject bypass execution.
 *
 * This test verifies that:
 * 1. Only PlanGraphBundle can be dispatched for execution
 * 2. Legacy execution paths are blocked
 * 3. RuntimeEntryGuard enforces entry point control
 */
test("INV-RUN-001: HarnessRuntime is the only execution entry", () => {
    const guard = new RuntimeEntryGuard();
    // Valid PlanGraphBundle entry
    const validBundle = {
        planGraphBundleId: "bundle-run-001",
        harnessRunId: "run-001",
        graphVersion: 1,
        graph: {
            nodes: [
                {
                    nodeId: "node-1",
                    nodeType: "llm",
                    inputRefs: [],
                    outputSchemaRef: "schema://output",
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
                    retryPolicyRef: "retry://default",
                    timeoutMs: 60000,
                },
            ],
            edges: [],
            entryNodeIds: ["node-1"],
            terminalNodeIds: ["node-1"],
            joinStrategy: "all",
            graphHash: "hash-001",
        },
    };
    const result = guard.assertPlanGraphBundleOnly(validBundle);
    assert.equal(result.accepted, true);
    assert.equal(result.planGraphBundle.planGraphBundleId, "bundle-run-001");
});
test("INV-RUN-001: Bypass execution is rejected", () => {
    const guard = new RuntimeEntryGuard();
    // Attempt to bypass with legacy execution plan
    const legacyExecution = {
        executionId: "exec-001",
        taskId: "task-001",
        steps: [
            { stepId: "step-1", action: "analyze" },
            { stepId: "step-2", action: "execute" },
        ],
    };
    assert.throws(() => guard.assertPlanGraphBundleOnly(legacyExecution), /plan_graph_bundle_required/, "Legacy execution bypass must be rejected");
});
test("INV-RUN-001: Direct TaskRecord execution is blocked", () => {
    const guard = new RuntimeEntryGuard();
    // Attempt to execute raw TaskRecord without HarnessRun
    const rawTask = {
        taskId: "task-raw-001",
        title: "Execute directly",
        status: "pending",
    };
    assert.throws(() => guard.assertPlanGraphBundleOnly(rawTask), /plan_graph_bundle_required/, "Direct TaskRecord execution must be blocked");
});
test("INV-RUN-001: WorkflowState linear execution is blocked", () => {
    const guard = new RuntimeEntryGuard();
    // Legacy workflow execution model
    const workflowState = {
        workflowId: "wf-001",
        currentStepIndex: 0,
        steps: [
            { stepId: "step-1", name: "Plan" },
            { stepId: "step-2", name: "Execute" },
            { stepId: "step-3", name: "Output" },
        ],
        status: "running",
    };
    assert.throws(() => guard.assertPlanGraphBundleOnly(workflowState), /plan_graph_bundle_required/, "WorkflowState linear execution must be blocked");
});
test("INV-RUN-001: ExecutionPlan bypass is blocked", () => {
    const guard = new RuntimeEntryGuard();
    // Direct ExecutionPlan dispatch
    const executionPlan = {
        planId: "plan-direct-001",
        taskId: "task-001",
        steps: [
            {
                stepId: "step-1",
                tool: "analyze",
                inputs: { query: "test" },
            },
        ],
    };
    assert.throws(() => guard.assertPlanGraphBundleOnly(executionPlan), /plan_graph_bundle_required/, "ExecutionPlan bypass must be rejected");
});
test("INV-RUN-001: Partial PlanGraphBundle is rejected", () => {
    const guard = new RuntimeEntryGuard();
    // Missing required fields
    const partialBundle = {
        planGraphBundleId: "bundle-partial",
        // Missing harnessRunId
        graphVersion: 1,
        graph: {
            nodes: [],
            edges: [],
        },
    };
    assert.throws(() => guard.assertPlanGraphBundleOnly(partialBundle), /plan_graph_bundle_required/, "Incomplete PlanGraphBundle must be rejected");
});
test("INV-RUN-001: Empty graph is rejected", () => {
    const guard = new RuntimeEntryGuard();
    const emptyGraphBundle = {
        planGraphBundleId: "bundle-empty",
        harnessRunId: "run-empty",
        graphVersion: 1,
        graph: {
            nodes: [],
            edges: [],
            entryNodeIds: [], // No entry nodes
            terminalNodeIds: [],
            joinStrategy: "all",
            graphHash: "hash-empty",
        },
    };
    // Empty graph without entry nodes should be invalid
    assert.throws(() => guard.assertPlanGraphBundleOnly(emptyGraphBundle), /plan_graph_bundle_required/, "Graph without entry nodes must be rejected");
});
//# sourceMappingURL=harness-run-authority.test.js.map