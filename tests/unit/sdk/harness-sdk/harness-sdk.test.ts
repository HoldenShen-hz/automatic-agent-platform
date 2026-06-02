import assert from "node:assert/strict";
import test from "node:test";

import {
  HarnessSdk,
  buildPlanGraphBundle,
  isIso8601Timestamp,
  validatePlanGraph,
  validatePlanGraphBundle,
  type HarnessSdkCreateRunInput,
  type PlanEdge,
  type PlanGraphBuildInput,
  type PlanNode,
} from "../../../../src/sdk/harness-sdk/index.js";
import type { ConstraintPack } from "../../../../src/platform/five-plane-orchestration/harness/index.js";

function createConstraintPack(overrides: Partial<ConstraintPack> = {}): ConstraintPack {
  return {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "semi_auto",
    tool_policy: { allowedTools: ["search"] },
    risk_policy: { maxRiskScore: 0.7, escalationThreshold: 0.5 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budgetEnvelope: { maxSteps: 8, maxCost: 25, maxDurationMs: 60_000 },
    sandboxRequirement: { sandboxMode: "ephemeral", timeoutMs: 60_000 },
    approvalRequirement: {
      requiredForRiskClass: ["critical"],
      approverRoles: ["operator"],
      escalationTimeoutMs: 300_000,
    },
    ...overrides,
  };
}

function createRunInput(overrides: Partial<HarnessSdkCreateRunInput> = {}): HarnessSdkCreateRunInput {
  return {
    taskId: "task_123",
    domainId: "core",
    tenantId: "tenant_abc",
    constraintPack: createConstraintPack(),
    ...overrides,
  };
}

function createPlanNode(nodeId: string): PlanNode {
  return {
    nodeId,
    nodeType: "tool",
    inputRefs: [],
    outputSchemaRef: "schema:default",
    riskClass: "medium",
    budgetIntent: { amount: 1, currency: "USD", resourceKinds: ["compute"] },
    sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
    retryPolicyRef: "retry:default",
    timeoutMs: 60_000,
  };
}

test("HarnessSdk.createRun rejects missing tenant for the current contract", () => {
  const sdk = new HarnessSdk();

  assert.throws(
    () => sdk.createRun(createRunInput({ tenantId: "" })),
    /missing_tenant/i,
  );
});

test("HarnessSdk.createRun rejects exhausted budgets and succeeds with valid inputs", () => {
  const sdk = new HarnessSdk(undefined, (budgetRef) => ({
    allowed: budgetRef !== "budget_exhausted",
    remainingBudget: budgetRef === "budget_exhausted" ? 0 : 1000,
    ...(budgetRef === "budget_exhausted" ? { error: "Budget exhausted" } : {}),
  }));

  assert.throws(
    () => sdk.createRun(createRunInput({ budgetRef: "budget_exhausted" })),
    /budget/i,
  );

  const run = sdk.createRun(createRunInput({ budgetRef: "budget_valid" }));
  const runtimeView = run as typeof run & { constraintPack: ConstraintPack };
  assert.equal(run.tenantId, "tenant:local");
  assert.equal(runtimeView.constraintPack.tool_policy.allowedTools.includes("search"), true);
});

test("HarnessSdk.appendStepWithReceipt emits node receipts against the current run shape", () => {
  const sdk = new HarnessSdk();
  const run = sdk.createRun(createRunInput());
  const runtimeView = run as typeof run & {
    planGraphBundle: { graph: { graphId: string } };
  };

  const { run: updatedRun, receipt } = sdk.appendStepWithReceipt(run, {
    role: "generator",
    nodeRunId: "node_run_456",
    planGraphId: runtimeView.planGraphBundle.graph.graphId,
    inputs: { query: "test" },
    outputs: { result: "success" },
  });

  assert.equal(updatedRun.currentSeq, run.currentSeq);
  assert.equal(receipt.nodeRunId, "node_run_456");
  assert.equal(receipt.harnessRunId, run.harnessRunId);
  assert.equal(receipt.planGraphId, runtimeView.planGraphBundle.graph.graphId);
  assert.equal(receipt.status, "succeeded");
});

test("buildPlanGraphBundle normalizes graph inputs and validatePlanGraph detects structural issues", () => {
  const nodes = [createPlanNode("node_1"), createPlanNode("node_2")];
  const edges: PlanEdge[] = [{
    edgeId: "edge_1",
    fromNodeId: "node_1",
    toNodeId: "node_2",
    condition: null,
    dependencyType: "hard",
  }];

  const input: PlanGraphBuildInput = {
    harnessRunId: "run_123",
    nodes,
    edges,
    entryNodeIds: ["node_1"],
    terminalNodeIds: ["node_2"],
  };

  const { bundle, validationReport } = buildPlanGraphBundle(input);
  const invalidReport = validatePlanGraph({
    nodes,
    edges: [{ fromNodeId: "node_1", toNodeId: "missing_node" }],
    entryNodeIds: ["node_1"],
    terminalNodeIds: ["missing_node"],
  });

  assert.equal(validationReport.valid, true);
  assert.equal(validatePlanGraphBundle(bundle).valid, true);
  assert.equal(bundle.graph.entryNodeIds[0], "node_1");
  assert.equal(bundle.graph.terminalNodeIds[0], "node_2");
  assert.equal(invalidReport.valid, false);
  assert.equal(invalidReport.findings.some((finding) => finding.includes("missing_node")), true);
});

test("isIso8601Timestamp accepts broader valid offset and precision forms", () => {
  assert.equal(isIso8601Timestamp("2026-06-02T10:20:30.123456789Z"), true);
  assert.equal(isIso8601Timestamp("2026-06-02T10:20:30+0800"), true);
  assert.equal(isIso8601Timestamp("2026-06-02T10:20:30+08:00"), true);
});

test("buildPlanGraphBundle graphHash changes when critical node fields change", () => {
  const baseInput: PlanGraphBuildInput = {
    harnessRunId: "run_hash_1",
    nodes: [createPlanNode("node_1")],
    edges: [],
    entryNodeIds: ["node_1"],
    terminalNodeIds: ["node_1"],
  };

  const base = buildPlanGraphBundle(baseInput);
  const changed = buildPlanGraphBundle({
    ...baseInput,
    nodes: [{
      ...createPlanNode("node_1"),
      sideEffectProfile: { mayCommitExternalEffect: true, reversible: false },
    }],
  });

  assert.notEqual(base.bundle.graph.graphHash, changed.bundle.graph.graphHash);
});

test("HarnessSdk persistence helpers operate on run ids and facade runs", () => {
  const sdk = new HarnessSdk();
  const run = sdk.createRun(createRunInput());
  const checkpoint = sdk.checkpoint(run);
  const restored = sdk.restore(run.harnessRunId);
  const replayed = sdk.traceReplay(run.harnessRunId, []);

  assert.equal(checkpoint.startsWith("harness_checkpoint_"), true);
  assert.equal(restored?.harnessRunId, run.harnessRunId);
  assert.equal(replayed?.harnessRunId, run.harnessRunId);
});
