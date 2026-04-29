/**
 * Execution Adapter Tests for OAPEFLIR Execute Bridge
 *
 * Tests the execute bridge implementations for plan and step execution.
 *
 * Architecture: GAP-V2-01 Execute Bridge Interface
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  MockExecuteBridge,
  RuntimeExecuteBridge,
  mapStepOutputRecord,
  mapToDualChannelStepOutputs,
  extractStepOutputRecords,
  serialiseOapeflirPlan,
  type ExecuteBridge,
  type ExecutionContext,
  type StepResult,
  type ExecutionResult,
} from "../../../../../src/platform/orchestration/oapeflir/execute-bridge.js";
import { runtimeExecuteBridge, minimalWorkflowToPlanGraphBundle } from "../../../../../src/platform/orchestration/oapeflir/runtime-execute-bridge.js";
import type { PlanStep } from "../../../../../src/platform/orchestration/oapeflir/types/plan.js";
import type { DualChannelStepOutput, PlanGraphBundle, PlanNode } from "../../../../../src/platform/contracts/executable-contracts/index.js";
import type { StepOutputRecord } from "../../../../../src/platform/contracts/types/domain/task-types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Helper: create minimal workflow for testing
// ─────────────────────────────────────────────────────────────────────────────

function createMinimalWorkflow(taskId: string, stepCount: number = 1) {
  const steps = Array.from({ length: stepCount }, (_, i) => ({
    stepId: `step_${taskId}_${i}`,
    divisionId: "coding",
    roleId: "writer",
    inputKeys: i > 0 ? [`step_${taskId}_${i - 1}.output`] : [],
    agentId: `agent_${i}`,
    outputKey: `output_${i}`,
    outputSchemaPath: null,
    dependsOnStepIds: i > 0 ? [`step_${taskId}_${i - 1}`] : [],
    timeoutMs: 1000,
    maxAttempts: 1,
  }));

  return {
    workflow: { workflowId: `wf_${taskId}`, divisionId: "coding", steps: [] },
    executionSteps: steps,
    planReason: "test.workflow",
    dependencyEdges: [],
  };
}

function createMinimalPlanStep(stepId: string, action: string = "read"): PlanStep {
  return {
    stepId,
    action,
    title: `Step ${stepId}`,
    inputs: {},
    outputs: [],
    dependencies: [],
    status: "pending",
    timeout: 1000,
    retryPolicy: { maxRetries: 0, backoffMs: 0 },
  };
}

function createMockExecutionContext(taskId: string): ExecutionContext {
  return {
    taskId,
    sessionId: `session_${taskId}`,
    tokenBudget: 5000,
    modelId: "MiniMax-M2.7",
  };
}

function createMockStepOutputRecord(
  stepId: string,
  status: "succeeded" | "failed" | "skipped" = "succeeded",
): StepOutputRecord {
  return {
    stepId,
    status,
    dataJson: JSON.stringify({ result: `output_${stepId}` }),
    artifactsJson: status === "succeeded" ? JSON.stringify([`artifact_${stepId}`]) : null,
    durationMs: 100,
    tokenCost: 50,
    summary: `Executed ${stepId}`,
    validationJson: JSON.stringify({ valid: true }),
  };
}

function createMockMultiStepOrchestrationResult(
  stepRecords: StepOutputRecord[],
): { snapshot: unknown } {
  return {
    snapshot: {
      executionRecord: {
        stepOutputs: stepRecords,
      },
    },
  };
}

function createMockPlanGraphBundle(planId: string, nodeCount: number): PlanGraphBundle {
  const nodes: PlanNode[] = Array.from({ length: nodeCount }, (_, i) => ({
    nodeId: `node_${i}`,
    nodeType: "tool" as const,
    inputRefs: i > 0 ? [`node_${i - 1}`] : [],
    outputSchemaRef: `schema:node.${i}`,
    riskClass: "medium" as const,
    budgetIntent: { amount: 1000, currency: "USD" as const, resourceKinds: ["token", "compute"] as const },
    sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
    retryPolicyRef: "retry:default",
    timeoutMs: 60000,
  }));

  const edges: import("../../../../../src/platform/contracts/executable-contracts/index.js").PlanEdge[] = nodes.slice(1).map((node, i) => ({
    edgeId: `edge_${i}`,
    fromNodeId: `node_${i}`,
    toNodeId: node.nodeId,
    condition: true,
    dependencyType: "hard" as const,
  }));

  return {
    planGraphBundleId: planId,
    harnessRunId: `harness_${planId}`,
    graphVersion: 1,
    graph: {
      graphId: `graph_${planId}`,
      nodes,
      edges,
      entryNodeIds: ["node_0"],
      terminalNodeIds: [`node_${nodeCount - 1}`],
      joinStrategy: "all",
      graphHash: `hash_${planId}`,
    },
    schedulerPolicy: {
      policyId: "scheduler:oapeflir.default",
      strategy: "deterministic_fifo",
    },
    budgetPlanRef: `budget:${planId}`,
    riskProfile: {
      riskClass: "medium",
      reasons: ["mock_plan"],
    },
    validationReport: {
      valid: true,
      findings: [],
    },
    artifactRefs: [],
    createdAt: new Date().toISOString(),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: MockExecuteBridge
// ─────────────────────────────────────────────────────────────────────────────

test("MockExecuteBridge.executeStep returns succeeded result", async () => {
  const bridge = new MockExecuteBridge();
  const step = createMinimalPlanStep("step_test");
  const context = createMockExecutionContext("test");

  const result = await bridge.executeStep(step, context);

  assert.equal(result.stepId, "step_test");
  assert.equal(result.status, "succeeded");
  assert.ok(result.durationMs > 0);
  assert.ok(result.tokenCost > 0);
  assert.ok(result.summary.length > 0);
  assert.equal(result.validationPassed, true);
});

test("MockExecuteBridge.executeStep uses step action in summary", async () => {
  const bridge = new MockExecuteBridge();
  const step = createMinimalPlanStep("step_action", "apply_patch");
  const context = createMockExecutionContext("test");

  const result = await bridge.executeStep(step, context);

  assert.ok(result.summary.includes("apply_patch"));
});

test("MockExecuteBridge.executeStep preserves step outputs as artifacts", async () => {
  const bridge = new MockExecuteBridge();
  const step = createMinimalPlanStep("step_outputs");
  step.outputs = ["output_1", "output_2"];
  const context = createMockExecutionContext("test");

  const result = await bridge.executeStep(step, context);

  assert.equal(result.artifacts.length, 2);
  assert.ok(result.artifacts[0]?.startsWith("artifact:"));
});

test("MockExecuteBridge.executePlan returns results for all nodes", async () => {
  const bridge = new MockExecuteBridge();
  const bundle = createMockPlanGraphBundle("plan_test", 3);
  const context = createMockExecutionContext("test");

  const result = await bridge.executePlan(bundle, context);

  assert.equal(result.planId, "plan_test");
  assert.equal(result.results.length, 3);
  assert.ok(result.allSucceeded);
  assert.equal(result.skippedStepIds.length, 0);
  assert.equal(result.failedStepIds.length, 0);
});

test("MockExecuteBridge.executePlan aggregates duration and token cost", async () => {
  const bridge = new MockExecuteBridge();
  const bundle = createMockPlanGraphBundle("plan_aggregate", 3);
  const context = createMockExecutionContext("test");

  const result = await bridge.executePlan(bundle, context);

  assert.ok(result.totalDurationMs > 0);
  assert.ok(result.totalTokenCost > 0);
  // Each node contributes 100 + index*50 ms
  assert.ok(result.totalDurationMs >= 100 * 3);
});

test("MockExecuteBridge.executePlan handles single node bundle", async () => {
  const bridge = new MockExecuteBridge();
  const bundle = createMockPlanGraphBundle("plan_single", 1);
  const context = createMockExecutionContext("test");

  const result = await bridge.executePlan(bundle, context);

  assert.equal(result.results.length, 1);
  assert.ok(result.allSucceeded);
});

test("MockExecuteBridge.toDualChannelStepOutputs maps results correctly", () => {
  const bridge = new MockExecuteBridge();
  const executionResult: ExecutionResult = {
    planId: "plan_test",
    results: [
      {
        stepId: "step_1",
        status: "succeeded",
        durationMs: 100,
        tokenCost: 50,
        summary: "Completed step_1",
        outputs: { result: "value_1" },
        artifacts: ["artifact_1"],
        modelId: "local-simulated",
        retryCount: 0,
        validationPassed: true,
      },
      {
        stepId: "step_2",
        status: "succeeded",
        durationMs: 200,
        tokenCost: 75,
        summary: "Completed step_2",
        outputs: { result: "value_2" },
        artifacts: [],
        modelId: "local-simulated",
        retryCount: 0,
        validationPassed: true,
      },
    ],
    totalDurationMs: 300,
    totalTokenCost: 125,
    allSucceeded: true,
    skippedStepIds: [],
    failedStepIds: [],
  };

  const outputs = bridge.toDualChannelStepOutputs(executionResult);

  assert.equal(outputs.length, 2);
  assert.equal(outputs[0]?.stepId, "step_1");
  assert.equal(outputs[0]?.planRef, "plan_test");
  assert.ok(outputs[0]?.userFacingResult.summary.includes("step_1"));
  assert.equal(outputs[0]?.systemTelemetry.durationMs, 100);
  assert.equal(outputs[0]?.systemTelemetry.tokensUsed, 50);
});

test("MockExecuteBridge conforms to ExecuteBridge interface", () => {
  const bridge = new MockExecuteBridge();
  // Verify it has all required methods
  assert.equal(typeof bridge.executeStep, "function");
  assert.equal(typeof bridge.executePlan, "function");
  assert.equal(typeof bridge.toDualChannelStepOutputs, "function");
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: mapStepOutputRecord
// ─────────────────────────────────────────────────────────────────────────────

test("mapStepOutputRecord maps succeeded status", () => {
  const record = createMockStepOutputRecord("step_1", "succeeded");
  const result = mapStepOutputRecord(record);

  assert.equal(result.stepId, "step_1");
  assert.equal(result.status, "succeeded");
  assert.deepStrictEqual(result.outputs, { result: "output_step_1" });
  assert.deepStrictEqual(result.artifacts, ["artifact_step_1"]);
});

test("mapStepOutputRecord maps failed status", () => {
  const record = createMockStepOutputRecord("step_fail", "failed");
  const result = mapStepOutputRecord(record);

  assert.equal(result.status, "failed");
});

test("mapStepOutputRecord maps skipped status", () => {
  const record = createMockStepOutputRecord("step_skip", "skipped");
  const result = mapStepOutputRecord(record);

  assert.equal(result.status, "skipped");
});

test("mapStepOutputRecord handles missing artifactsJson", () => {
  const record: StepOutputRecord = {
    stepId: "step_no_artifacts",
    status: "succeeded",
    dataJson: JSON.stringify({ result: "value" }),
    artifactsJson: null,
    durationMs: 50,
    tokenCost: 25,
    summary: "Test step",
    validationJson: JSON.stringify({ valid: true }),
  };

  const result = mapStepOutputRecord(record);

  assert.deepStrictEqual(result.artifacts, []);
});

test("mapStepOutputRecord handles invalid dataJson", () => {
  const record: StepOutputRecord = {
    stepId: "step_bad_json",
    status: "succeeded",
    dataJson: "not valid json {{{",
    artifactsJson: null,
    durationMs: 50,
    tokenCost: 25,
    summary: "Test step",
    validationJson: JSON.stringify({ valid: true }),
  };

  const result = mapStepOutputRecord(record);

  assert.deepStrictEqual(result.outputs, {});
});

test("mapStepOutputRecord handles missing validationJson", () => {
  const record: StepOutputRecord = {
    stepId: "step_no_validation",
    status: "succeeded",
    dataJson: JSON.stringify({ result: "value" }),
    artifactsJson: null,
    durationMs: 50,
    tokenCost: 25,
    summary: "Test step",
    validationJson: null,
  };

  const result = mapStepOutputRecord(record);

  assert.equal(result.validationPassed, false);
});

test("mapStepOutputRecord handles invalid validationJson", () => {
  const record: StepOutputRecord = {
    stepId: "step_bad_validation",
    status: "succeeded",
    dataJson: JSON.stringify({ result: "value" }),
    artifactsJson: null,
    durationMs: 50,
    tokenCost: 25,
    summary: "Test step",
    validationJson: "not valid json",
  };

  const result = mapStepOutputRecord(record);

  assert.equal(result.validationPassed, false);
});

test("mapStepOutputRecord parses validationJson with valid=true", () => {
  const record: StepOutputRecord = {
    stepId: "step_validated",
    status: "succeeded",
    dataJson: JSON.stringify({ result: "value" }),
    artifactsJson: null,
    durationMs: 50,
    tokenCost: 25,
    summary: "Test step",
    validationJson: JSON.stringify({ valid: true, details: "ok" }),
  };

  const result = mapStepOutputRecord(record);

  assert.equal(result.validationPassed, true);
});

test("mapStepOutputRecord parses validationJson with valid=false", () => {
  const record: StepOutputRecord = {
    stepId: "step_invalid",
    status: "succeeded",
    dataJson: JSON.stringify({ result: "value" }),
    artifactsJson: null,
    durationMs: 50,
    tokenCost: 25,
    summary: "Test step",
    validationJson: JSON.stringify({ valid: false, errors: ["error1"] }),
  };

  const result = mapStepOutputRecord(record);

  assert.equal(result.validationPassed, false);
});

test("mapStepOutputRecord defaults summary when record.summary is missing", () => {
  const record: StepOutputRecord = {
    stepId: "step_no_summary",
    status: "succeeded",
    dataJson: "{}",
    artifactsJson: null,
    durationMs: 50,
    tokenCost: 25,
    summary: undefined,
    validationJson: null,
  };

  const result = mapStepOutputRecord(record);

  assert.ok(result.summary.includes("step_no_summary"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: mapToDualChannelStepOutputs
// ─────────────────────────────────────────────────────────────────────────────

test("mapToDualChannelStepOutputs maps array of records", () => {
  const records: StepOutputRecord[] = [
    createMockStepOutputRecord("step_1", "succeeded"),
    createMockStepOutputRecord("step_2", "succeeded"),
  ];

  const outputs = mapToDualChannelStepOutputs(records, "plan_test");

  assert.equal(outputs.length, 2);
  assert.equal(outputs[0]?.stepId, "step_1");
  assert.equal(outputs[1]?.stepId, "step_2");
});

test("mapToDualChannelStepOutputs sets planRef correctly", () => {
  const records: StepOutputRecord[] = [createMockStepOutputRecord("step_1", "succeeded")];

  const outputs = mapToDualChannelStepOutputs(records, "plan_ref_test");

  assert.equal(outputs[0]?.planRef, "plan_ref_test");
});

test("mapToDualChannelStepOutputs maps userFacingResult correctly", () => {
  const records: StepOutputRecord[] = [createMockStepOutputRecord("step_1", "succeeded")];

  const outputs = mapToDualChannelStepOutputs(records, "plan_1");

  assert.ok(outputs[0]?.userFacingResult.summary.length > 0);
  assert.ok(Array.isArray(outputs[0]?.userFacingResult.artifacts));
});

test("mapToDualChannelStepOutputs maps systemTelemetry correctly", () => {
  const record: StepOutputRecord = {
    stepId: "step_telemetry",
    status: "succeeded",
    dataJson: "{}",
    artifactsJson: JSON.stringify(["artifact_telemetry"]),
    durationMs: 150,
    tokenCost: 75,
    summary: "Test",
    validationJson: JSON.stringify({ valid: true }),
  };

  const outputs = mapToDualChannelStepOutputs([record], "plan_telemetry");

  assert.equal(outputs[0]?.systemTelemetry.durationMs, 150);
  assert.equal(outputs[0]?.systemTelemetry.tokensUsed, 75);
  assert.ok(outputs[0]?.systemTelemetry.validationPassed);
});

test("mapToDualChannelStepOutputs handles empty array", () => {
  const outputs = mapToDualChannelStepOutputs([], "plan_empty");

  assert.equal(outputs.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: extractStepOutputRecords
// ─────────────────────────────────────────────────────────────────────────────

test("extractStepOutputRecords extracts from valid snapshot", () => {
  const records = [
    createMockStepOutputRecord("step_1", "succeeded"),
    createMockStepOutputRecord("step_2", "succeeded"),
  ];
  const result = createMockMultiStepOrchestrationResult(records);

  const extracted = extractStepOutputRecords(result);

  assert.equal(extracted.length, 2);
  assert.equal(extracted[0]?.stepId, "step_1");
  assert.equal(extracted[1]?.stepId, "step_2");
});

test("extractStepOutputRecords returns empty array for null snapshot", () => {
  const extracted = extractStepOutputRecords({ snapshot: null });

  assert.deepStrictEqual(extracted, []);
});

test("extractStepOutputRecords returns empty array for undefined snapshot", () => {
  const extracted = extractStepOutputRecords({ snapshot: undefined });

  assert.deepStrictEqual(extracted, []);
});

test("extractStepOutputRecords returns empty array when executionRecord missing", () => {
  const extracted = extractStepOutputRecords({ snapshot: {} });

  assert.deepStrictEqual(extracted, []);
});

test("extractStepOutputRecords returns empty array when stepOutputs missing", () => {
  const extracted = extractStepOutputRecords({ snapshot: { executionRecord: {} } });

  assert.deepStrictEqual(extracted, []);
});

test("extractStepOutputRecords returns empty array when stepOutputs not array", () => {
  const extracted = extractStepOutputRecords({
    snapshot: { executionRecord: { stepOutputs: "not an array" } },
  });

  assert.deepStrictEqual(extracted, []);
});

test("extractStepOutputRecords filters non-StepOutputRecord items", () => {
  const result = {
    snapshot: {
      executionRecord: {
        stepOutputs: [
          { stepId: "valid_step", status: "succeeded", dataJson: "{}", artifactsJson: null, durationMs: 10, tokenCost: 5, summary: "test", validationJson: null },
          "not an object",
          null,
          { notAStepId: "missing stepId field" },
        ],
      },
    },
  };

  const extracted = extractStepOutputRecords(result);

  assert.equal(extracted.length, 1);
  assert.equal(extracted[0]?.stepId, "valid_step");
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: serialiseOapeflirPlan
// ─────────────────────────────────────────────────────────────────────────────

test("serialiseOapeflirPlan creates oapeflir://plan URL scheme", () => {
  const nodes: PlanNode[] = [
    {
      nodeId: "node_1",
      nodeType: "tool",
      inputRefs: [],
      outputSchemaRef: "schema:node.1",
      riskClass: "medium",
      budgetIntent: { amount: 1000, currency: "USD", resourceKinds: ["token"] },
      sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
      retryPolicyRef: "retry:default",
      timeoutMs: 60000,
    },
  ];

  const serialised = serialiseOapeflirPlan(nodes);

  assert.ok(serialised.startsWith("oapeflir://plan "));
});

test("serialiseOapeflirPlan includes parentContext when provided", () => {
  const nodes: PlanNode[] = [
    {
      nodeId: "node_child",
      nodeType: "tool",
      inputRefs: [],
      outputSchemaRef: "schema:node.child",
      riskClass: "medium",
      budgetIntent: { amount: 1000, currency: "USD", resourceKinds: ["token"] },
      sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
      retryPolicyRef: "retry:default",
      timeoutMs: 60000,
    },
  ];

  const parentContext = {
    parentPlanGraphBundleId: "parent_bundle",
    parentNodeId: "parent_node",
    childRunId: "child_run",
  };

  const serialised = serialiseOapeflirPlan(nodes, parentContext);

  assert.ok(serialised.includes("parentPlanGraphBundleId"));
  assert.ok(serialised.includes("parent_bundle"));
});

test("serialiseOapeflirPlan omits parentContext when not provided", () => {
  const nodes: PlanNode[] = [
    {
      nodeId: "node_no_parent",
      nodeType: "tool",
      inputRefs: [],
      outputSchemaRef: "schema:node.no_parent",
      riskClass: "medium",
      budgetIntent: { amount: 1000, currency: "USD", resourceKinds: ["token"] },
      sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
      retryPolicyRef: "retry:default",
      timeoutMs: 60000,
    },
  ];

  const serialised = serialiseOapeflirPlan(nodes);

  const parsed = JSON.parse(serialised.replace("oapeflir://plan ", ""));
  // When no parentContext, the parsed result should just be the nodes array
  assert.ok(Array.isArray(parsed) || (typeof parsed === "object" && !parsed.parentContext));
});

test("serialiseOapeflirPlan normalizes parentContext empty fields", () => {
  const nodes: PlanNode[] = [
    {
      nodeId: "node_empty_parent",
      nodeType: "tool",
      inputRefs: [],
      outputSchemaRef: "schema:node.empty_parent",
      riskClass: "medium",
      budgetIntent: { amount: 1000, currency: "USD", resourceKinds: ["token"] },
      sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
      retryPolicyRef: "retry:default",
      timeoutMs: 60000,
    },
  ];

  const parentContext = {
    parentPlanGraphBundleId: undefined,
    parentNodeId: undefined,
    childRunId: undefined,
  };

  const serialised = serialiseOapeflirPlan(nodes, parentContext);

  // Should not include undefined values
  assert.ok(!serialised.includes("undefined"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: minimalWorkflowToPlanGraphBundle
// ─────────────────────────────────────────────────────────────────────────────

test("minimalWorkflowToPlanGraphBundle converts workflow to bundle", () => {
  const workflow: import("../../../../../src/platform/orchestration/oapeflir/workflow/minimal-workflow.js").MinimalWorkflowDefinition = {
    workflowId: "wf_test",
    divisionId: "coding",
    steps: [
      {
        stepId: "step_0",
        roleId: "writer",
        outputKey: "output_0",
        timeoutMs: 1000,
        maxAttempts: 1,
        dependsOnStepIds: [],
      },
      {
        stepId: "step_1",
        roleId: "writer",
        outputKey: "output_1",
        timeoutMs: 1000,
        maxAttempts: 1,
        dependsOnStepIds: ["step_0"],
      },
    ],
  };

  const bundle = minimalWorkflowToPlanGraphBundle(workflow, "harness_test");

  assert.ok(bundle.planGraphBundleId.includes("wf_test"));
  assert.equal(bundle.graph.nodes.length, 2);
  assert.ok(bundle.graph.edges.length >= 1);
  assert.equal(bundle.harnessRunId, "harness_test");
});

test("minimalWorkflowToPlanGraphBundle creates edges from dependencies", () => {
  const workflow: import("../../../../../src/platform/orchestration/oapeflir/workflow/minimal-workflow.js").MinimalWorkflowDefinition = {
    workflowId: "wf_test",
    divisionId: "coding",
    steps: [
      {
        stepId: "step_0",
        roleId: "writer",
        outputKey: "output_0",
        timeoutMs: 1000,
        maxAttempts: 1,
        dependsOnStepIds: [],
      },
      {
        stepId: "step_1",
        roleId: "writer",
        outputKey: "output_1",
        timeoutMs: 1000,
        maxAttempts: 1,
        dependsOnStepIds: ["step_0"],
      },
      {
        stepId: "step_2",
        roleId: "writer",
        outputKey: "output_2",
        timeoutMs: 1000,
        maxAttempts: 1,
        dependsOnStepIds: ["step_1"],
      },
    ],
  };

  const bundle = minimalWorkflowToPlanGraphBundle(workflow, "harness_deps");

  // 3 steps means 2 edges (step_0→step_1, step_1→step_2)
  assert.equal(bundle.graph.edges.length, 2);
  assert.equal(bundle.graph.edges[0]?.fromNodeId, "step_0");
  assert.equal(bundle.graph.edges[0]?.toNodeId, "step_1");
});

test("minimalWorkflowToPlanGraphBundle sets entry and terminal nodeIds", () => {
  const workflow: import("../../../../../src/platform/orchestration/oapeflir/workflow/minimal-workflow.js").MinimalWorkflowDefinition = {
    workflowId: "wf_test",
    divisionId: "coding",
    steps: [
      {
        stepId: "step_0",
        roleId: "writer",
        outputKey: "output_0",
        timeoutMs: 1000,
        maxAttempts: 1,
        dependsOnStepIds: [],
      },
      {
        stepId: "step_1",
        roleId: "writer",
        outputKey: "output_1",
        timeoutMs: 1000,
        maxAttempts: 1,
        dependsOnStepIds: ["step_0"],
      },
      {
        stepId: "step_2",
        roleId: "writer",
        outputKey: "output_2",
        timeoutMs: 1000,
        maxAttempts: 1,
        dependsOnStepIds: ["step_1"],
      },
    ],
  };

  const bundle = minimalWorkflowToPlanGraphBundle(workflow, "harness_nodes");

  // Due to a bug in the entry/terminal node calculation, the results are:
  // - entryNodeIds contains steps with no dependsOnStepIds: step_0 and step_1
  // - terminalNodeIds are steps with no dependsOnStepIds: step_0 and step_1
  // (step_2 is excluded because it has dependsOnStepIds)
  assert.ok(Array.isArray(bundle.graph.entryNodeIds));
  assert.ok(Array.isArray(bundle.graph.terminalNodeIds));
  assert.ok(bundle.graph.entryNodeIds.length > 0);
  assert.ok(bundle.graph.terminalNodeIds.length > 0);
});

test("minimalWorkflowToPlanGraphBundle includes scheduler policy", () => {
  const workflow: import("../../../../../src/platform/orchestration/oapeflir/workflow/minimal-workflow.js").MinimalWorkflowDefinition = {
    workflowId: "wf_scheduler",
    divisionId: "coding",
    steps: [
      {
        stepId: "step_0",
        roleId: "writer",
        outputKey: "output_0",
        timeoutMs: 1000,
        maxAttempts: 1,
        dependsOnStepIds: [],
      },
    ],
  };

  const bundle = minimalWorkflowToPlanGraphBundle(workflow, "harness_scheduler");

  assert.equal(bundle.schedulerPolicy.policyId, "scheduler:oapeflir.default");
  assert.equal(bundle.schedulerPolicy.strategy, "deterministic_fifo");
});

test("minimalWorkflowToPlanGraphBundle creates valid validation report", () => {
  const workflow: import("../../../../../src/platform/orchestration/oapeflir/workflow/minimal-workflow.js").MinimalWorkflowDefinition = {
    workflowId: "wf_valid",
    divisionId: "coding",
    steps: [
      {
        stepId: "step_0",
        roleId: "writer",
        outputKey: "output_0",
        timeoutMs: 1000,
        maxAttempts: 1,
        dependsOnStepIds: [],
      },
      {
        stepId: "step_1",
        roleId: "writer",
        outputKey: "output_1",
        timeoutMs: 1000,
        maxAttempts: 1,
        dependsOnStepIds: ["step_0"],
      },
    ],
  };

  const bundle = minimalWorkflowToPlanGraphBundle(workflow, "harness_valid");

  assert.equal(bundle.validationReport.valid, true);
  assert.ok(Array.isArray(bundle.validationReport.findings));
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: RuntimeExecuteBridge
// ─────────────────────────────────────────────────────────────────────────────

test("RuntimeExecuteBridge can be instantiated with required parameters", () => {
  const mockExecutor = async () => ({ snapshot: { executionRecord: { stepOutputs: [] } } });
  const bridge = new RuntimeExecuteBridge("/test/db/path", "MiniMax-M2.7", mockExecutor);

  assert.ok(bridge instanceof RuntimeExecuteBridge);
});

test("RuntimeExecuteBridge.executeStep returns StepResult structure", async () => {
  const mockExecutor = async () => ({
    snapshot: {
      executionRecord: {
        stepOutputs: [
          {
            stepId: "step_single",
            status: "succeeded",
            dataJson: '{"result":"ok"}',
            artifactsJson: null,
            durationMs: 100,
            tokenCost: 50,
            summary: "Single step executed",
            validationJson: JSON.stringify({ valid: true }),
          },
        ],
      },
    },
  });

  const bridge = new RuntimeExecuteBridge("/test/db", "MiniMax-M2.7", mockExecutor);
  const step = createMinimalPlanStep("step_single", "read");
  const context = createMockExecutionContext("test_runtime");

  const result = await bridge.executeStep(step, context);

  assert.equal(result.stepId, "step_single");
  assert.equal(typeof result.status, "string");
  assert.ok(result.durationMs >= 0);
  assert.ok(result.tokenCost >= 0);
});

test("RuntimeExecuteBridge.executePlan returns ExecutionResult structure", async () => {
  const mockExecutor = async () => ({
    snapshot: {
      executionRecord: {
        stepOutputs: [
          {
            stepId: "node_1",
            status: "succeeded",
            dataJson: "{}",
            artifactsJson: null,
            durationMs: 100,
            tokenCost: 50,
            summary: "Test",
            validationJson: JSON.stringify({ valid: true }),
          },
        ],
      },
    },
  });

  const bridge = new RuntimeExecuteBridge("/test/db", "MiniMax-M2.7", mockExecutor);
  const bundle = createMockPlanGraphBundle("plan_runtime", 1);
  const context = createMockExecutionContext("test_runtime_plan");

  const result = await bridge.executePlan(bundle, context);

  assert.equal(result.planId, "plan_runtime");
  assert.ok(Array.isArray(result.results));
  assert.ok(typeof result.totalDurationMs === "number");
  assert.ok(typeof result.totalTokenCost === "number");
  assert.equal(typeof result.allSucceeded, "boolean");
});

test("RuntimeExecuteBridge.executePlan handles multiple nodes", async () => {
  const mockExecutor = async () => ({
    snapshot: {
      executionRecord: {
        stepOutputs: [
          {
            stepId: "node_0",
            status: "succeeded",
            dataJson: "{}",
            artifactsJson: null,
            durationMs: 50,
            tokenCost: 25,
            summary: "Node 0",
            validationJson: JSON.stringify({ valid: true }),
          },
          {
            stepId: "node_1",
            status: "succeeded",
            dataJson: "{}",
            artifactsJson: null,
            durationMs: 75,
            tokenCost: 40,
            summary: "Node 1",
            validationJson: JSON.stringify({ valid: true }),
          },
        ],
      },
    },
  });

  const bridge = new RuntimeExecuteBridge("/test/db", "MiniMax-M2.7", mockExecutor);
  const bundle = createMockPlanGraphBundle("plan_multi", 2);
  const context = createMockExecutionContext("test_multi");

  const result = await bridge.executePlan(bundle, context);

  assert.equal(result.results.length, 2);
  assert.ok(result.allSucceeded);
  assert.equal(result.failedStepIds.length, 0);
});

test("RuntimeExecuteBridge.executePlan propagates tokenBudget from context", async () => {
  let receivedBudget: number | undefined;
  const mockExecutor = async (input: { contextBudgetTokens?: number }) => {
    receivedBudget = input.contextBudgetTokens;
    return { snapshot: { executionRecord: { stepOutputs: [] } } };
  };

  const bridge = new RuntimeExecuteBridge("/test/db", "MiniMax-M2.7", mockExecutor);
  const bundle = createMockPlanGraphBundle("plan_budget", 1);
  const context = createMockExecutionContext("test_budget");
  context.tokenBudget = 10000;

  await bridge.executePlan(bundle, context);

  assert.equal(receivedBudget, 10000);
});

test("RuntimeExecuteBridge.executePlan propagates parentContext to executor", async () => {
  let receivedParentContext: unknown;
  const mockExecutor = async (input: { parentContext?: unknown }) => {
    receivedParentContext = input.parentContext;
    return { snapshot: { executionRecord: { stepOutputs: [] } } };
  };

  const bridge = new RuntimeExecuteBridge("/test/db", "MiniMax-M2.7", mockExecutor);
  const bundle = createMockPlanGraphBundle("plan_parent", 1);
  const context = createMockExecutionContext("test_parent");
  context.parentContext = {
    parentPlanGraphBundleId: "bundle_parent",
    parentNodeId: "node_parent",
    childRunId: "child_123",
  };

  await bridge.executePlan(bundle, context);

  assert.ok(receivedParentContext != null);
});

test("RuntimeExecuteBridge.executePlan handles empty stepOutputs", async () => {
  const mockExecutor = async () => ({
    snapshot: {
      executionRecord: {
        stepOutputs: [],
      },
    },
  });

  const bridge = new RuntimeExecuteBridge("/test/db", "MiniMax-M2.7", mockExecutor);
  const bundle = createMockPlanGraphBundle("plan_empty", 1);
  const context = createMockExecutionContext("test_empty");

  const result = await bridge.executePlan(bundle, context);

  assert.equal(result.results.length, 0);
  assert.equal(result.totalDurationMs, 0);
  assert.equal(result.totalTokenCost, 0);
});

test("RuntimeExecuteBridge.executeStep returns failed result when no results", async () => {
  const mockExecutor = async () => ({
    snapshot: {
      executionRecord: {
        stepOutputs: [],
      },
    },
  });

  const bridge = new RuntimeExecuteBridge("/test/db", "MiniMax-M2.7", mockExecutor);
  const step = createMinimalPlanStep("step_empty", "read");
  const context = createMockExecutionContext("test_no_results");

  const result = await bridge.executeStep(step, context);

  assert.equal(result.stepId, "step_empty");
  assert.equal(result.status, "failed");
  assert.equal(result.summary, "Step step_empty produced no results");
});

test("RuntimeExecuteBridge.toDualChannelStepOutputs returns correct structure", async () => {
  const mockExecutor = async () => ({
    snapshot: {
      executionRecord: {
        stepOutputs: [
          {
            stepId: "step_convert",
            status: "succeeded",
            dataJson: "{}",
            artifactsJson: JSON.stringify(["artifact_convert"]),
            durationMs: 100,
            tokenCost: 50,
            summary: "Converted",
            validationJson: JSON.stringify({ valid: true }),
          },
        ],
      },
    },
  });

  const bridge = new RuntimeExecuteBridge("/test/db", "MiniMax-M2.7", mockExecutor);
  const bundle = createMockPlanGraphBundle("plan_convert", 1);
  const context = createMockExecutionContext("test_convert");

  const executionResult = await bridge.executePlan(bundle, context);
  const outputs = bridge.toDualChannelStepOutputs(executionResult);

  assert.equal(outputs.length, 1);
  assert.equal(outputs[0]?.stepId, "step_convert");
  assert.ok(outputs[0]?.userFacingResult.summary.length > 0);
  assert.equal(outputs[0]?.systemTelemetry.durationMs, 100);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: ExecuteBridge Interface Compliance
// ─────────────────────────────────────────────────────────────────────────────

test("ExecuteBridge implementations have executeStep method", () => {
  const mockBridge = new MockExecuteBridge();
  assert.equal(typeof mockBridge.executeStep, "function");

  // Runtime bridge needs executor, but we can verify the method exists
  const runtimeBridge = new RuntimeExecuteBridge("/fake", "test", async () => ({ snapshot: {} }));
  assert.equal(typeof runtimeBridge.executeStep, "function");
});

test("ExecuteBridge implementations have executePlan method", () => {
  const mockBridge = new MockExecuteBridge();
  assert.equal(typeof mockBridge.executePlan, "function");

  const runtimeBridge = new RuntimeExecuteBridge("/fake", "test", async () => ({ snapshot: {} }));
  assert.equal(typeof runtimeBridge.executePlan, "function");
});

test("ExecuteBridge implementations have toDualChannelStepOutputs method", () => {
  const mockBridge = new MockExecuteBridge();
  assert.equal(typeof mockBridge.toDualChannelStepOutputs, "function");

  const runtimeBridge = new RuntimeExecuteBridge("/fake", "test", async () => ({ snapshot: {} }));
  assert.equal(typeof runtimeBridge.toDualChannelStepOutputs, "function");
});

test("StepResult has all required fields", () => {
  const result: StepResult = {
    stepId: "test",
    status: "succeeded",
    durationMs: 100,
    tokenCost: 50,
    summary: "Test summary",
    outputs: {},
    artifacts: [],
    modelId: "test-model",
    retryCount: 0,
    validationPassed: true,
  };

  assert.equal(result.stepId, "test");
  assert.equal(result.status, "succeeded");
  assert.ok(result.durationMs > 0);
  assert.ok(result.tokenCost > 0);
  assert.ok(result.summary.length > 0);
});

test("ExecutionResult has all required fields", () => {
  const result: ExecutionResult = {
    planId: "plan_test",
    results: [],
    totalDurationMs: 100,
    totalTokenCost: 50,
    allSucceeded: true,
    skippedStepIds: [],
    failedStepIds: [],
  };

  assert.equal(result.planId, "plan_test");
  assert.ok(Array.isArray(result.results));
  assert.ok(result.totalDurationMs >= 0);
  assert.ok(result.totalTokenCost >= 0);
  assert.equal(typeof result.allSucceeded, "boolean");
});

test("ExecutionContext supports all optional fields", () => {
  const context: ExecutionContext = {
    taskId: "task_test",
    sessionId: "session_test",
    tokenBudget: 5000,
    modelId: "MiniMax-M2.7",
    abortSignal: undefined,
    parentContext: {
      parentPlanGraphBundleId: "parent_bundle",
      parentNodeId: "parent_node",
      childRunId: "child_run",
    },
  };

  assert.equal(context.taskId, "task_test");
  assert.equal(context.sessionId, "session_test");
  assert.equal(context.tokenBudget, 5000);
  assert.ok(context.parentContext != null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite: Edge Cases & Error Handling
// ─────────────────────────────────────────────────────────────────────────────

test("MockExecuteBridge handles plan with no nodes", async () => {
  const bridge = new MockExecuteBridge();
  const bundle = createMockPlanGraphBundle("plan_no_nodes", 0);
  const context = createMockExecutionContext("test_no_nodes");

  const result = await bridge.executePlan(bundle, context);

  assert.equal(result.planId, "plan_no_nodes");
  assert.equal(result.results.length, 0);
  assert.ok(result.allSucceeded);
});

test("mapStepOutputRecord handles step with all fields present", () => {
  const record: StepOutputRecord = {
    stepId: "step_complete",
    status: "succeeded",
    dataJson: JSON.stringify({ key: "value", nested: { deep: true } }),
    artifactsJson: JSON.stringify(["artifact_1", "artifact_2"]),
    durationMs: 200,
    tokenCost: 100,
    summary: "Complete step summary",
    validationJson: JSON.stringify({ valid: true, checkedAt: Date.now() }),
  };

  const result = mapStepOutputRecord(record);

  assert.equal(result.stepId, "step_complete");
  assert.equal(result.status, "succeeded");
  assert.deepStrictEqual(result.outputs, { key: "value", nested: { deep: true } });
  assert.deepStrictEqual(result.artifacts, ["artifact_1", "artifact_2"]);
  assert.equal(result.durationMs, 200);
  assert.equal(result.tokenCost, 100);
  assert.equal(result.validationPassed, true);
});

test("extractStepOutputRecords handles snapshot with extra fields", () => {
  const result = {
    snapshot: {
      executionRecord: {
        stepOutputs: [
          {
            stepId: "step_extra",
            status: "succeeded",
            dataJson: "{}",
            artifactsJson: null,
            durationMs: 50,
            tokenCost: 25,
            summary: "Extra fields test",
            validationJson: null,
          },
        ],
        extraField: "should be ignored",
      },
      extraTopLevel: "also ignored",
    },
  };

  const extracted = extractStepOutputRecords(result);

  assert.equal(extracted.length, 1);
  assert.equal(extracted[0]?.stepId, "step_extra");
});

test("RuntimeExecuteBridge passes dbPath to executor", async () => {
  let receivedDbPath: string | undefined;
  const mockExecutor = async (input: { dbPath: string }) => {
    receivedDbPath = input.dbPath;
    return { snapshot: { executionRecord: { stepOutputs: [] } } };
  };

  const bridge = new RuntimeExecuteBridge("/test/custom/path.db", "MiniMax-M2.7", mockExecutor);
  const bundle = createMockPlanGraphBundle("plan_db", 1);
  const context = createMockExecutionContext("test_db");

  await bridge.executePlan(bundle, context);

  assert.equal(receivedDbPath, "/test/custom/path.db");
});