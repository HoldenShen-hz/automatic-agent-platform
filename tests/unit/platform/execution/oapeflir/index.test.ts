/**
 * OAPEFLIR Index Tests
 *
 * Tests for module exports and re-exports from the oapeflir execution directory.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  executeOapeflirRuntimePlan,
  type RuntimePlanExecutionInput,
  type RuntimePlanExecutor,
} from "../../../../../src/platform/five-plane-execution/oapeflir/index.js";

test("index exports executeOapeflirRuntimePlan function [index]", () => {
  assert.equal(typeof executeOapeflirRuntimePlan, "function");
});

test("index exports RuntimePlanExecutionInput type [index]", () => {
  // RuntimePlanExecutionInput should be a valid type/interface
  const input: RuntimePlanExecutionInput = {
    dbPath: "/tmp/test.db",
    planGraphBundle: {
      planGraphBundleId: "test-bundle",
      harnessRunId: "test-harness",
      graphVersion: 1,
      graph: {
        graphId: "graph:test",
        nodes: [],
        edges: [],
        entryNodeIds: [],
        terminalNodeIds: [],
        joinStrategy: "all",
        graphHash: "hash:test",
      },
      schedulerPolicy: {
        policyId: "scheduler:default",
        strategy: "deterministic_fifo",
      },
      budgetPlanRef: "budget:test",
      riskProfile: { riskClass: "low", reasons: ["test"] },
      validationReport: { valid: true, findings: [] },
      artifactRefs: [],
      createdAt: new Date().toISOString(),
    },
  };

  assert.equal(input.dbPath, "/tmp/test.db");
  assert.equal(input.planGraphBundle.planGraphBundleId, "test-bundle");
});

test("index exports RuntimePlanExecutor type as function type [index]", () => {
  // RuntimePlanExecutor should be compatible with the executeOapeflirRuntimePlan function
  const executor: RuntimePlanExecutor = executeOapeflirRuntimePlan;
  assert.equal(typeof executor, "function");
});

test("executeOapeflirRuntimePlan callable with required fields only [index]", async () => {
  const { dbPath, cleanup } = await import("../../../../helpers/ha-coordinator.js").then((m) =>
    m.initHaCoordinatorForTests(),
  );

  try {
    const input: RuntimePlanExecutionInput = {
      dbPath,
      planGraphBundle: {
        planGraphBundleId: "index-test-bundle",
        harnessRunId: "index-test-harness",
        graphVersion: 1,
        graph: {
          graphId: "graph:index-test",
          nodes: [
            {
              nodeId: "index-test-step",
              nodeType: "tool",
              inputRefs: [],
              outputSchemaRef: "schema:index-test",
              riskClass: "medium",
              budgetIntent: { amount: 500, currency: "USD", resourceKinds: ["token"] },
              sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
              retryPolicyRef: "retry:max:1",
              timeoutMs: 30_000,
            },
          ],
          edges: [],
          entryNodeIds: ["index-test-step"],
          terminalNodeIds: ["index-test-step"],
          joinStrategy: "all",
          graphHash: "hash:index-test",
        },
        schedulerPolicy: {
          policyId: "scheduler:default",
          strategy: "deterministic_fifo",
        },
        budgetPlanRef: "budget:index-test",
        riskProfile: { riskClass: "medium", reasons: ["index-test"] },
        validationReport: { valid: true, findings: [] },
        artifactRefs: [],
        createdAt: new Date().toISOString(),
      },
    };

    const result = await executeOapeflirRuntimePlan(input);

    assert.ok(result.snapshot.task);
    assert.equal(result.snapshot.task?.id, "index-test-bundle");
    assert.equal(result.plannedWorkflow.workflow.steps.length, 1);
    assert.equal(result.plannedWorkflow.workflow.steps[0]?.stepId, "index-test-step");
  } finally {
    cleanup();
  }
});

test("executeOapeflirRuntimePlan callable with optional contextBudgetTokens [index]", async () => {
  const { dbPath, cleanup } = await import("../../../../helpers/ha-coordinator.js").then((m) =>
    m.initHaCoordinatorForTests(),
  );

  try {
    const input: RuntimePlanExecutionInput = {
      dbPath,
      planGraphBundle: {
        planGraphBundleId: "context-budget-test",
        harnessRunId: "context-budget-harness",
        graphVersion: 1,
        graph: {
          graphId: "graph:context-budget",
          nodes: [
            {
              nodeId: "budget-step",
              nodeType: "tool",
              inputRefs: [],
              outputSchemaRef: "schema:budget",
              riskClass: "low",
              budgetIntent: { amount: 100, currency: "USD", resourceKinds: ["token"] },
              sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
              retryPolicyRef: "retry:max:1",
              timeoutMs: 30_000,
            },
          ],
          edges: [],
          entryNodeIds: ["budget-step"],
          terminalNodeIds: ["budget-step"],
          joinStrategy: "all",
          graphHash: "hash:budget",
        },
        schedulerPolicy: {
          policyId: "scheduler:default",
          strategy: "deterministic_fifo",
        },
        budgetPlanRef: "budget:context",
        riskProfile: { riskClass: "low", reasons: ["context-budget"] },
        validationReport: { valid: true, findings: [] },
        artifactRefs: [],
        createdAt: new Date().toISOString(),
      },
      contextBudgetTokens: 50_000,
    };

    const result = await executeOapeflirRuntimePlan(input);

    assert.ok(result.snapshot.task);
  } finally {
    cleanup();
  }
});
