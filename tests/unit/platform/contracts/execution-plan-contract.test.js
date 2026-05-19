/**
 * ExecutionPlan Contract Unit Tests
 *
 * Tests the deprecated ExecutionPlan contract vs canonical PlanGraphBundle replacement.
 * Per §4.4, ExecutionPlan is deprecated and should not be instantiated.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createExecutionPlan } from "../../../../src/platform/contracts/execution-plan/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
import { createPlanGraphBundle, createPrincipalRef, LEGACY_CONTRACT_NAMES, } from "../../../../src/platform/contracts/executable-contracts/index.js";
const principal = createPrincipalRef({
    principalId: "user-1",
    tenantId: "tenant-1",
    roles: ["operator"],
});
const budgetIntent = {
    amount: 100,
    currency: "USD",
    resourceKinds: ["token", "tool"],
};
const riskPreview = {
    riskClass: "low",
    reasons: [],
};
function createMinimalPlanNode(nodeId) {
    return {
        nodeId,
        nodeType: "tool",
        inputRefs: [],
        outputSchemaRef: "schema://output",
        riskClass: "low",
        budgetIntent,
        sideEffectProfile: {
            mayCommitExternalEffect: false,
            reversible: true,
        },
        retryPolicyRef: "retry://default",
        timeoutMs: 30000,
    };
}
function createMinimalPlanGraph(graphId, nodeIds) {
    const nodes = nodeIds.map(createMinimalPlanNode);
    const entryNodeIds = nodeIds.slice(0, 1);
    const terminalNodeIds = nodeIds.slice(-1);
    const edges = [];
    for (let i = 0; i < nodeIds.length - 1; i++) {
        edges.push({
            edgeId: `edge-${i}`,
            fromNodeId: nodeIds[i],
            toNodeId: nodeIds[i + 1],
            condition: {},
            dependencyType: "hard",
        });
    }
    return {
        graphId,
        nodes,
        edges,
        entryNodeIds,
        terminalNodeIds,
        joinStrategy: "all",
        graphHash: `hash-${graphId}`,
    };
}
test("ExecutionPlan is listed in LEGACY_CONTRACT_NAMES", () => {
    assert.equal(LEGACY_CONTRACT_NAMES.includes("ExecutionPlan"), true);
});
test("ExecutionPlan type is deprecated via JSDoc @deprecated marker", () => {
    // Verify by checking that createExecutionPlan throws with legacy_contract_forbidden code
    assert.throws(() => createExecutionPlan({
        taskId: "task_123",
        tenantId: "tenant_abc",
        version: 1,
        steps: [
            {
                stepId: "step_1",
                title: "First step",
                actionRef: "action_one",
                dependsOn: [],
                requiresApproval: false,
            },
        ],
    }), (error) => error instanceof ValidationError && error.code === "execution_plan.legacy_contract_forbidden");
});
test("createExecutionPlan rejects all inputs with legacy_contract_forbidden error", () => {
    assert.throws(() => createExecutionPlan({
        taskId: "task_123",
        tenantId: "tenant_abc",
        version: 1,
        steps: [],
    }), (error) => error instanceof ValidationError && error.code === "execution_plan.legacy_contract_forbidden");
});
test("createExecutionPlan error message references canonical replacement", () => {
    assert.throws(() => createExecutionPlan({
        taskId: "task_123",
        tenantId: "tenant_abc",
        version: 1,
        steps: [],
    }), (error) => {
        if (error instanceof ValidationError) {
            return error.message.includes("PlanGraphBundle");
        }
        return false;
    });
});
test("canonical PlanGraphBundle can be created as ExecutionPlan replacement", () => {
    const graph = createMinimalPlanGraph("graph-1", ["node-1", "node-2"]);
    const bundle = createPlanGraphBundle({
        harnessRunId: "hrun-1",
        graph,
        schedulerPolicy: {
            policyId: "scheduler-1",
            strategy: "deterministic_fifo",
        },
        budgetPlanRef: "budget-plan-1",
        riskProfile: riskPreview,
    });
    assert.equal(bundle.planGraphBundleId.startsWith("pgb_"), true);
    assert.equal(bundle.graph.nodes.length, 2);
    assert.equal(bundle.graph.edges.length, 1);
    assert.equal(bundle.graphVersion, 1);
});
test("PlanGraphBundle requires at least one node", () => {
    assert.throws(() => createPlanGraphBundle({
        harnessRunId: "hrun-1",
        graph: createMinimalPlanGraph("graph-empty", []),
        schedulerPolicy: {
            policyId: "scheduler-1",
            strategy: "deterministic_fifo",
        },
        budgetPlanRef: "budget-plan-1",
        riskProfile: riskPreview,
    }), ValidationError);
});
test("PlanGraphBundle accepts custom planGraphBundleId and graphVersion", () => {
    const graph = createMinimalPlanGraph("graph-2", ["node-a"]);
    const bundle = createPlanGraphBundle({
        harnessRunId: "hrun-2",
        graph,
        schedulerPolicy: {
            policyId: "scheduler-2",
            strategy: "priority_then_fifo",
        },
        budgetPlanRef: "budget-plan-2",
        riskProfile: riskPreview,
        planGraphBundleId: "custom_pgb_123",
        graphVersion: 5,
    });
    assert.equal(bundle.planGraphBundleId, "custom_pgb_123");
    assert.equal(bundle.graphVersion, 5);
});
test("PlanGraphBundle validationReport defaults to valid:true with empty findings", () => {
    const graph = createMinimalPlanGraph("graph-3", ["node-x"]);
    const bundle = createPlanGraphBundle({
        harnessRunId: "hrun-3",
        graph,
        schedulerPolicy: {
            policyId: "scheduler-3",
            strategy: "risk_isolated",
        },
        budgetPlanRef: "budget-plan-3",
        riskProfile: { riskClass: "high", reasons: ["external_api"] },
    });
    assert.equal(bundle.validationReport.valid, true);
    assert.equal(bundle.validationReport.findings.length, 0);
});
//# sourceMappingURL=execution-plan-contract.test.js.map