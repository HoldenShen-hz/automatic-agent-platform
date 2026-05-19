/**
 * @fileoverview Unit tests for Harness SDK (src/sdk/harness-sdk/index.ts)
 * Covers R8-22 PlanGraphBundle API
 */
import assert from "node:assert/strict";
import test from "node:test";
import { HarnessSdk, buildPlanGraphBundle, validatePlanGraph, validatePlanGraphBundle } from "../../../src/sdk/harness-sdk/index.js";
// ============================================================================
// R8-22: PlanGraphBundle API via buildPlanGraphBundle
// ============================================================================
test("buildPlanGraphBundle creates bundle with nodes and edges", () => {
    const nodes = [
        {
            nodeId: "start",
            nodeIndex: 0,
            displayName: "Start",
            type: "task",
            inputSchema: {},
            outputSchema: {},
            retryPolicy: null,
        },
        {
            nodeId: "end",
            nodeIndex: 1,
            displayName: "End",
            type: "task",
            inputSchema: {},
            outputSchema: {},
            retryPolicy: null,
        },
    ];
    const edges = [
        {
            edgeId: "e1",
            fromNodeId: "start",
            toNodeId: "end",
            edgeType: "control_flow",
        },
    ];
    const result = buildPlanGraphBundle({
        harnessRunId: "harness_run_test",
        nodes,
        edges,
        entryNodeIds: ["start"],
        terminalNodeIds: ["end"],
    });
    assert.equal(result.bundle.harnessRunId, "harness_run_test");
    assert.equal(result.bundle.graph.nodes.length, 2);
    assert.equal(result.bundle.graph.edges.length, 1);
    assert.equal(result.bundle.graph.entryNodeIds[0], "start");
    assert.equal(result.bundle.graph.terminalNodeIds[0], "end");
    assert.ok(result.bundle.planGraphBundleId.startsWith("pgb_"));
    assert.equal(result.bundle.graphVersion, 1);
});
test("buildPlanGraphBundle with custom schedulerPolicy", () => {
    const nodes = [
        {
            nodeId: "n1",
            nodeIndex: 0,
            displayName: "Node 1",
            type: "task",
            inputSchema: {},
            outputSchema: {},
            retryPolicy: null,
        },
    ];
    const result = buildPlanGraphBundle({
        harnessRunId: "harness_run_test",
        nodes,
        edges: [],
        entryNodeIds: ["n1"],
        terminalNodeIds: ["n1"],
        schedulerPolicy: {
            policyId: "scheduler:priority",
            strategy: "priority_then_fifo",
        },
    });
    assert.equal(result.bundle.schedulerPolicy.policyId, "scheduler:priority");
    assert.equal(result.bundle.schedulerPolicy.strategy, "priority_then_fifo");
});
test("buildPlanGraphBundle with riskProfile", () => {
    const nodes = [
        {
            nodeId: "n1",
            nodeIndex: 0,
            displayName: "Node 1",
            type: "task",
            inputSchema: {},
            outputSchema: {},
            retryPolicy: null,
        },
    ];
    const riskProfile = { riskClass: "high", reasons: ["contains_api_calls"] };
    const result = buildPlanGraphBundle({
        harnessRunId: "harness_run_test",
        nodes,
        edges: [],
        entryNodeIds: ["n1"],
        terminalNodeIds: ["n1"],
        riskProfile,
    });
    assert.equal(result.bundle.riskProfile.riskClass, "high");
    assert.ok(result.bundle.riskProfile.reasons.includes("contains_api_calls"));
});
test("buildPlanGraphBundle uses default schedulerPolicy when not provided", () => {
    const nodes = [
        {
            nodeId: "n1",
            nodeIndex: 0,
            displayName: "Node 1",
            type: "task",
            inputSchema: {},
            outputSchema: {},
            retryPolicy: null,
        },
    ];
    const result = buildPlanGraphBundle({
        harnessRunId: "harness_run_test",
        nodes,
        edges: [],
        entryNodeIds: ["n1"],
        terminalNodeIds: ["n1"],
    });
    assert.equal(result.bundle.schedulerPolicy.policyId, "scheduler:default");
    assert.equal(result.bundle.schedulerPolicy.strategy, "deterministic_fifo");
});
test("buildPlanGraphBundle uses default budgetPlanRef when not provided", () => {
    const nodes = [
        {
            nodeId: "n1",
            nodeIndex: 0,
            displayName: "Node 1",
            type: "task",
            inputSchema: {},
            outputSchema: {},
            retryPolicy: null,
        },
    ];
    const result = buildPlanGraphBundle({
        harnessRunId: "harness_run_test",
        nodes,
        edges: [],
        entryNodeIds: ["n1"],
        terminalNodeIds: ["n1"],
    });
    assert.equal(result.bundle.budgetPlanRef, "budget:default");
});
test("buildPlanGraphBundle uses default riskProfile when not provided", () => {
    const nodes = [
        {
            nodeId: "n1",
            nodeIndex: 0,
            displayName: "Node 1",
            type: "task",
            inputSchema: {},
            outputSchema: {},
            retryPolicy: null,
        },
    ];
    const result = buildPlanGraphBundle({
        harnessRunId: "harness_run_test",
        nodes,
        edges: [],
        entryNodeIds: ["n1"],
        terminalNodeIds: ["n1"],
    });
    assert.equal(result.bundle.riskProfile.riskClass, "medium");
    assert.ok(result.bundle.riskProfile.reasons.includes("harness_sdk.built"));
});
// ============================================================================
// validatePlanGraph - structural validation
// ============================================================================
test("validatePlanGraph returns valid for correct graph", () => {
    const graph = {
        graphId: "graph_1",
        nodes: [
            {
                nodeId: "n1",
                nodeIndex: 0,
                displayName: "Start",
                type: "task",
                inputSchema: {},
                outputSchema: {},
                retryPolicy: null,
            },
            {
                nodeId: "n2",
                nodeIndex: 1,
                displayName: "End",
                type: "task",
                inputSchema: {},
                outputSchema: {},
                retryPolicy: null,
            },
        ],
        edges: [
            {
                edgeId: "e1",
                fromNodeId: "n1",
                toNodeId: "n2",
                edgeType: "control_flow",
            },
        ],
        entryNodeIds: ["n1"],
        terminalNodeIds: ["n2"],
        joinStrategy: "all",
        graphHash: "hash123",
    };
    const report = validatePlanGraph(graph);
    assert.equal(report.valid, true);
    assert.deepEqual(report.findings, []);
});
test("validatePlanGraph detects missing entry node", () => {
    const graph = {
        graphId: "graph_1",
        nodes: [
            {
                nodeId: "n1",
                nodeIndex: 0,
                displayName: "Start",
                type: "task",
                inputSchema: {},
                outputSchema: {},
                retryPolicy: null,
            },
        ],
        edges: [],
        entryNodeIds: ["nonexistent"],
        terminalNodeIds: ["n1"],
        joinStrategy: "all",
        graphHash: "hash123",
    };
    const report = validatePlanGraph(graph);
    assert.equal(report.valid, false);
    assert.ok(report.findings.some(f => f.includes("Entry node nonexistent not found")));
});
test("validatePlanGraph detects missing terminal node", () => {
    const graph = {
        graphId: "graph_1",
        nodes: [
            {
                nodeId: "n1",
                nodeIndex: 0,
                displayName: "Start",
                type: "task",
                inputSchema: {},
                outputSchema: {},
                retryPolicy: null,
            },
        ],
        edges: [],
        entryNodeIds: ["n1"],
        terminalNodeIds: ["nonexistent"],
        joinStrategy: "all",
        graphHash: "hash123",
    };
    const report = validatePlanGraph(graph);
    assert.equal(report.valid, false);
    assert.ok(report.findings.some(f => f.includes("Terminal node nonexistent not found")));
});
test("validatePlanGraph detects edge with unknown fromNodeId", () => {
    const graph = {
        graphId: "graph_1",
        nodes: [
            {
                nodeId: "n1",
                nodeIndex: 0,
                displayName: "Start",
                type: "task",
                inputSchema: {},
                outputSchema: {},
                retryPolicy: null,
            },
        ],
        edges: [
            {
                edgeId: "e1",
                fromNodeId: "nonexistent",
                toNodeId: "n1",
                edgeType: "control_flow",
            },
        ],
        entryNodeIds: ["n1"],
        terminalNodeIds: ["n1"],
        joinStrategy: "all",
        graphHash: "hash123",
    };
    const report = validatePlanGraph(graph);
    assert.equal(report.valid, false);
    assert.ok(report.findings.some(f => f.includes("references unknown fromNodeId nonexistent")));
});
test("validatePlanGraph detects edge with unknown toNodeId", () => {
    const graph = {
        graphId: "graph_1",
        nodes: [
            {
                nodeId: "n1",
                nodeIndex: 0,
                displayName: "Start",
                type: "task",
                inputSchema: {},
                outputSchema: {},
                retryPolicy: null,
            },
        ],
        edges: [
            {
                edgeId: "e1",
                fromNodeId: "n1",
                toNodeId: "nonexistent",
                edgeType: "control_flow",
            },
        ],
        entryNodeIds: ["n1"],
        terminalNodeIds: ["n1"],
        joinStrategy: "all",
        graphHash: "hash123",
    };
    const report = validatePlanGraph(graph);
    assert.equal(report.valid, false);
    assert.ok(report.findings.some(f => f.includes("references unknown toNodeId nonexistent")));
});
test("validatePlanGraph detects unreachable nodes", () => {
    const graph = {
        graphId: "graph_1",
        nodes: [
            {
                nodeId: "n1",
                nodeIndex: 0,
                displayName: "Start",
                type: "task",
                inputSchema: {},
                outputSchema: {},
                retryPolicy: null,
            },
            {
                nodeId: "n2",
                nodeIndex: 1,
                displayName: "Orphan",
                type: "task",
                inputSchema: {},
                outputSchema: {},
                retryPolicy: null,
            },
        ],
        edges: [],
        entryNodeIds: ["n1"],
        terminalNodeIds: ["n1"],
        joinStrategy: "all",
        graphHash: "hash123",
    };
    const report = validatePlanGraph(graph);
    assert.equal(report.valid, false);
    assert.ok(report.findings.some(f => f.includes("not reachable from any entry node")));
});
// ============================================================================
// validatePlanGraphBundle
// ============================================================================
test("validatePlanGraphBundle returns validation result for bundle", () => {
    const nodes = [
        {
            nodeId: "n1",
            nodeIndex: 0,
            displayName: "Start",
            type: "task",
            inputSchema: {},
            outputSchema: {},
            retryPolicy: null,
        },
    ];
    const { bundle } = buildPlanGraphBundle({
        harnessRunId: "harness_run_test",
        nodes,
        edges: [],
        entryNodeIds: ["n1"],
        terminalNodeIds: ["n1"],
    });
    const result = validatePlanGraphBundle(bundle);
    assert.equal(result.valid, true);
});
test("validatePlanGraphBundle propagates findings from graph validation", () => {
    const nodes = [
        {
            nodeId: "n1",
            nodeIndex: 0,
            displayName: "Start",
            type: "task",
            inputSchema: {},
            outputSchema: {},
            retryPolicy: null,
        },
    ];
    const { bundle } = buildPlanGraphBundle({
        harnessRunId: "harness_run_test",
        nodes,
        edges: [],
        entryNodeIds: ["n1"],
        terminalNodeIds: ["n1"],
    });
    // Manually create invalid bundle by adding invalid entry node
    const invalidBundle = {
        ...bundle,
        graph: {
            ...bundle.graph,
            entryNodeIds: ["nonexistent"],
        },
    };
    const result = validatePlanGraphBundle(invalidBundle);
    assert.equal(result.valid, false);
});
// ============================================================================
// HarnessSdk basic operations
// ============================================================================
test("HarnessSdk.createRun returns run with valid structure", () => {
    const sdk = new HarnessSdk();
    const run = sdk.createRun({
        taskId: "task_test",
        domainId: "testing",
        constraintPack: {
            policyIds: ["policy.test"],
            approvalMode: "none",
            autonomyMode: "auto",
            toolPolicy: { allowedTools: ["tool1"] },
            risk_policy: { maxRiskScore: 0.8, escalationThreshold: 0.6 },
            output_policy: { requiredEvidence: [], redactSensitiveData: false },
            budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
        },
    });
    assert.ok(run.runId.startsWith("harness_run_"));
    assert.equal(run.taskId, "task_test");
    assert.equal(run.domainId, "testing");
    assert.equal(run.status, "running");
});
test("HarnessSdk.appendStep adds step to run", () => {
    const sdk = new HarnessSdk();
    const run = sdk.createRun({
        taskId: "task_test",
        domainId: "testing",
        constraintPack: {
            policyIds: [],
            approvalMode: "none",
            autonomyMode: "auto",
            toolPolicy: { allowedTools: [] },
            risk_policy: { maxRiskScore: 1, escalationThreshold: 0.9 },
            output_policy: { requiredEvidence: [], redactSensitiveData: false },
            budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
        },
    });
    const updated = sdk.appendStep(run, {
        role: "executor",
        nodeRunId: "node_run_1",
        planGraphId: "pg_1",
        inputs: { prompt: "test" },
        outputs: { result: "ok" },
    });
    assert.equal(updated.steps.length, 1);
    assert.equal(updated.steps[0].role, "executor");
});
test("HarnessSdk.appendStepWithReceipt returns receipt", () => {
    const sdk = new HarnessSdk();
    const run = sdk.createRun({
        taskId: "task_test",
        domainId: "testing",
        constraintPack: {
            policyIds: [],
            approvalMode: "none",
            autonomyMode: "auto",
            toolPolicy: { allowedTools: [] },
            risk_policy: { maxRiskScore: 1, escalationThreshold: 0.9 },
            output_policy: { requiredEvidence: [], redactSensitiveData: false },
            budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
        },
    });
    const { receipt } = sdk.appendStepWithReceipt(run, {
        role: "executor",
        nodeRunId: "node_run_1",
        planGraphId: "pg_1",
        inputs: {},
        outputs: {},
    }, { duration: 100, status: "succeeded" });
    assert.ok(receipt.nodeAttemptId.startsWith("nattempt_"));
    assert.equal(receipt.status, "succeeded");
    assert.equal(receipt.duration, 100);
});
//# sourceMappingURL=harness-sdk.test.js.map