import assert from "node:assert/strict";
import test from "node:test";

import {
  executeOapeflirRuntimePlan,
  type RuntimePlanExecutionInput,
} from "../../../../../src/platform/five-plane-execution/oapeflir/runtime-plan-executor.js";
import type { PlanGraphBundle } from "../../../../../src/platform/contracts/executable-contracts/index.js";

function createBundle(overrides: Partial<PlanGraphBundle> = {}): PlanGraphBundle {
  return {
    planGraphBundleId: "plan-bundle-1",
    harnessRunId: "harness-run-1",
    graphVersion: 1,
    graph: {
      graphId: "graph-1",
      nodes: [{
        nodeId: "node-1",
        nodeType: "tool",
        inputRefs: [],
        outputSchemaRef: "schema://output-1",
        riskClass: "low",
        budgetIntent: { amount: 1, currency: "USD", resourceKinds: ["tool"] },
        sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
        retryPolicyRef: "retry://default",
        timeoutMs: 5_000,
      }],
      edges: [],
      entryNodeIds: ["node-1"],
      terminalNodeIds: ["node-1"],
      joinStrategy: "all",
      graphHash: "graph-hash-1",
    },
    schedulerPolicy: {
      policyId: "policy-1",
      strategy: "deterministic_fifo",
    },
    budgetPlanRef: "budget://plan-1",
    riskProfile: { riskClass: "low", reasons: ["unit-test"] },
    validationReport: { valid: true, findings: [] },
    artifactRefs: [],
    createdAt: "2026-05-24T00:00:00.000Z",
    ...overrides,
  };
}

test("RuntimePlanExecutionInput accepts the current plan graph bundle contract", () => {
  const input: RuntimePlanExecutionInput = {
    dbPath: ":memory:",
    planGraphBundle: createBundle(),
    contextBudgetTokens: 4_096,
  };

  assert.equal(input.planGraphBundle.graph.nodes[0]?.nodeType, "tool");
  assert.equal(input.contextBudgetTokens, 4_096);
});

test("executeOapeflirRuntimePlan returns the plan bundle id as task id", async () => {
  const input: RuntimePlanExecutionInput = {
    dbPath: ":memory:",
    planGraphBundle: createBundle({
      planGraphBundleId: "bundle-task-id",
      harnessRunId: "harness-task-id",
    }),
  };

  const result = await executeOapeflirRuntimePlan(input);

  assert.equal(result.taskId, "bundle-task-id");
});

test("executeOapeflirRuntimePlan accepts additional supported node types", async () => {
  const input: RuntimePlanExecutionInput = {
    dbPath: ":memory:",
    planGraphBundle: createBundle({
      graph: {
        graphId: "graph-2",
        nodes: [
          {
            nodeId: "node-llm",
            nodeType: "llm",
            inputRefs: [],
            outputSchemaRef: "schema://llm-output",
            riskClass: "medium",
            budgetIntent: { amount: 2, currency: "USD", resourceKinds: ["tool"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry://default",
            timeoutMs: 5_000,
          },
          {
            nodeId: "node-comp",
            nodeType: "compensation",
            inputRefs: ["node-llm"],
            outputSchemaRef: "schema://comp-output",
            riskClass: "medium",
            budgetIntent: { amount: 1, currency: "USD", resourceKinds: ["tool"] },
            sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
            retryPolicyRef: "retry://default",
            timeoutMs: 5_000,
          },
        ],
        edges: [{
          edgeId: "edge-1",
          fromNodeId: "node-llm",
          toNodeId: "node-comp",
          condition: {},
          dependencyType: "hard",
        }],
        entryNodeIds: ["node-llm"],
        terminalNodeIds: ["node-comp"],
        joinStrategy: "all",
        graphHash: "graph-hash-2",
      },
    }),
  };

  const result = await executeOapeflirRuntimePlan(input);

  assert.equal(result.taskId, "plan-bundle-1");
});
