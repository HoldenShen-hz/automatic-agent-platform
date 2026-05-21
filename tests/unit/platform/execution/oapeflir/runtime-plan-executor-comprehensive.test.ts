/**
 * Runtime Plan Executor Comprehensive Tests
 *
 * Tests for OAPEFLIR runtime plan execution including edge cases
 * and coverage for serialisePlanGraphBundle and planNodeToRuntimeStep helpers.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { executeOapeflirRuntimePlan } from "../../../../../src/platform/five-plane-execution/oapeflir/runtime-plan-executor.js";
import { initHaCoordinatorForTests } from "../../../../helpers/ha-coordinator.js";
import type { PlanGraphBundle, PlanNode } from "../../../../../src/platform/contracts/executable-contracts/index.js";

// Helper to create minimal plan graph bundle for testing
function createTestPlanGraphBundle(
  nodes: PlanNode[],
  overrides?: Partial<PlanGraphBundle>,
): PlanGraphBundle {
  return {
    planGraphBundleId: "test-bundle-001",
    harnessRunId: "test-harness-run-001",
    graphVersion: 1,
    graph: {
      graphId: "graph:test-001",
      nodes,
      edges: [],
      entryNodeIds: nodes.map((n) => n.nodeId),
      terminalNodeIds: nodes.map((n) => n.nodeId),
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
    ...overrides,
  };
}

// Helper to create a basic plan node
function createPlanNode(overrides: Partial<PlanNode> & { nodeId: string; nodeType: PlanNode["nodeType"] }): PlanNode {
  return {
    nodeId: "default-node-id",
    nodeType: "tool",
    inputRefs: [],
    outputSchemaRef: "schema:default",
    riskClass: "medium",
    budgetIntent: { amount: 1000, currency: "USD", resourceKinds: ["token"] },
    sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
    retryPolicyRef: "retry:max:1",
    timeoutMs: 60_000,
    ...overrides,
  };
}

test("executeOapeflirRuntimePlan handles empty nodes array", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  try {
    const bundle = createTestPlanGraphBundle([]);

    const result = await executeOapeflirRuntimePlan({
      dbPath,
      planGraphBundle: bundle,
    });

    assert.ok(result.snapshot.task);
    assert.equal(result.snapshot.task?.id, bundle.planGraphBundleId);
  } finally {
    cleanup();
  }
});

test("executeOapeflirRuntimePlan handles single node", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  try {
    const bundle = createTestPlanGraphBundle([
      createPlanNode({
        nodeId: "single-step",
        nodeType: "tool",
        inputRefs: [],
        timeoutMs: 30_000,
      }),
    ]);

    const result = await executeOapeflirRuntimePlan({
      dbPath,
      planGraphBundle: bundle,
    });

    assert.ok(result.snapshot.task);
    assert.equal(result.plannedWorkflow.workflow.steps.length, 1);
    assert.equal(result.plannedWorkflow.workflow.steps[0]?.stepId, "single-step");
  } finally {
    cleanup();
  }
});

test("executeOapeflirRuntimePlan handles multiple nodes with dependencies", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  try {
    const bundle = createTestPlanGraphBundle([
      createPlanNode({
        nodeId: "step-1",
        nodeType: "tool",
        inputRefs: [],
        timeoutMs: 60_000,
      }),
      createPlanNode({
        nodeId: "step-2",
        nodeType: "llm",
        inputRefs: ["step-1"],
        timeoutMs: 120_000,
      }),
      createPlanNode({
        nodeId: "step-3",
        nodeType: "tool",
        inputRefs: ["step-2"],
        timeoutMs: 60_000,
      }),
    ]);

    const result = await executeOapeflirRuntimePlan({
      dbPath,
      planGraphBundle: bundle,
    });

    assert.ok(result.snapshot.task);
    assert.equal(result.plannedWorkflow.workflow.steps.length, 3);
    assert.deepEqual(
      result.plannedWorkflow.workflow.steps.map((s) => s.stepId),
      ["step-1", "step-2", "step-3"],
    );
  } finally {
    cleanup();
  }
});

test("executeOapeflirRuntimePlan handles all node types", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  try {
    const bundle = createTestPlanGraphBundle([
      createPlanNode({ nodeId: "tool-node", nodeType: "tool" }),
      createPlanNode({ nodeId: "llm-node", nodeType: "llm" }),
      createPlanNode({ nodeId: "hitl-wait-node", nodeType: "hitl_wait" }),
      createPlanNode({ nodeId: "subgraph-node", nodeType: "subgraph" }),
      createPlanNode({ nodeId: "evaluator-node", nodeType: "evaluator" }),
      createPlanNode({ nodeId: "router-node", nodeType: "router" }),
      createPlanNode({ nodeId: "compensation-node", nodeType: "compensation" }),
    ]);

    const result = await executeOapeflirRuntimePlan({
      dbPath,
      planGraphBundle: bundle,
    });

    assert.ok(result.snapshot.task);
    assert.equal(result.plannedWorkflow.workflow.steps.length, 7);

    const stepIds = result.plannedWorkflow.workflow.steps.map((s) => s.stepId);
    assert.ok(stepIds.includes("tool-node"));
    assert.ok(stepIds.includes("llm-node"));
    assert.ok(stepIds.includes("hitl-wait-node"));
    assert.ok(stepIds.includes("subgraph-node"));
    assert.ok(stepIds.includes("evaluator-node"));
    assert.ok(stepIds.includes("router-node"));
    assert.ok(stepIds.includes("compensation-node"));
  } finally {
    cleanup();
  }
});

test("executeOapeflirRuntimePlan with contextBudgetTokens", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  try {
    const bundle = createTestPlanGraphBundle([
      createPlanNode({ nodeId: "budget-step", nodeType: "tool" }),
    ]);

    const result = await executeOapeflirRuntimePlan({
      dbPath,
      planGraphBundle: bundle,
      contextBudgetTokens: 100_000,
    });

    assert.ok(result.snapshot.task);
    assert.ok(result.compaction !== undefined || result.compaction === null);
  } finally {
    cleanup();
  }
});

test("executeOapeflirRuntimePlan with different risk classes", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  try {
    const bundle = createTestPlanGraphBundle([
      createPlanNode({ nodeId: "low-risk", nodeType: "tool", riskClass: "low" }),
      createPlanNode({ nodeId: "medium-risk", nodeType: "tool", riskClass: "medium" }),
      createPlanNode({ nodeId: "high-risk", nodeType: "tool", riskClass: "high" }),
      createPlanNode({ nodeId: "critical-risk", nodeType: "tool", riskClass: "critical" }),
    ]);

    const result = await executeOapeflirRuntimePlan({
      dbPath,
      planGraphBundle: bundle,
    });

    assert.ok(result.snapshot.task);
    assert.equal(result.plannedWorkflow.workflow.steps.length, 4);
  } finally {
    cleanup();
  }
});

test("executeOapeflirRuntimePlan preserves node timeout values", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  try {
    const bundle = createTestPlanGraphBundle([
      createPlanNode({
        nodeId: "short-timeout",
        nodeType: "tool",
        timeoutMs: 5_000,
      }),
      createPlanNode({
        nodeId: "long-timeout",
        nodeType: "llm",
        timeoutMs: 300_000,
      }),
    ]);

    const result = await executeOapeflirRuntimePlan({
      dbPath,
      planGraphBundle: bundle,
    });

    const steps = result.plannedWorkflow.workflow.steps;
    const shortStep = steps.find((s) => s.stepId === "short-timeout");
    const longStep = steps.find((s) => s.stepId === "long-timeout");

    assert.ok(shortStep);
    assert.ok(longStep);
    assert.equal(shortStep.timeout, 5_000);
    assert.equal(longStep.timeout, 300_000);
  } finally {
    cleanup();
  }
});

test("executeOapeflirRuntimePlan preserves input dependencies", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  try {
    const bundle = createTestPlanGraphBundle([
      createPlanNode({
        nodeId: "root",
        nodeType: "tool",
        inputRefs: [],
      }),
      createPlanNode({
        nodeId: "child-1",
        nodeType: "tool",
        inputRefs: ["root"],
      }),
      createPlanNode({
        nodeId: "child-2",
        nodeType: "tool",
        inputRefs: ["root"],
      }),
      createPlanNode({
        nodeId: "grandchild",
        nodeType: "tool",
        inputRefs: ["child-1", "child-2"],
      }),
    ]);

    const result = await executeOapeflirRuntimePlan({
      dbPath,
      planGraphBundle: bundle,
    });

    const steps = result.plannedWorkflow.workflow.steps;
    const grandchild = steps.find((s) => s.stepId === "grandchild");
    assert.ok(grandchild);
    assert.deepEqual(grandchild.dependsOnStepIds, ["child-1", "child-2"]);
  } finally {
    cleanup();
  }
});

test("executeOapeflirRuntimePlan generates harness run events", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  try {
    const bundle = createTestPlanGraphBundle(
      [createPlanNode({ nodeId: "event-test-step", nodeType: "tool" })],
      { harnessRunId: "harness:event-test-123" },
    );

    const result = await executeOapeflirRuntimePlan({
      dbPath,
      planGraphBundle: bundle,
    });

    const harnessRunEvent = result.snapshot.events.find(
      (event) => event.eventType === "platform.harness_run.status_changed",
    );
    assert.ok(harnessRunEvent, "Should have harness_run status_changed event");
    const payload = JSON.parse(harnessRunEvent?.payloadJson ?? "{}");
    assert.equal(payload.harnessRunId, "harness:event-test-123");
  } finally {
    cleanup();
  }
});

test("executeOapeflirRuntimePlan with complex bundle id", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  try {
    const bundle = createTestPlanGraphBundle(
      [createPlanNode({ nodeId: "complex-id-step", nodeType: "tool" })],
      {
        planGraphBundleId: "pgb:complex:workflow:id:12345",
        harnessRunId: "harness:run:with:colons:67890",
      },
    );

    const result = await executeOapeflirRuntimePlan({
      dbPath,
      planGraphBundle: bundle,
    });

    assert.ok(result.snapshot.task);
    assert.equal(
      result.snapshot.task?.id,
      "pgb:complex:workflow:id:12345",
    );
  } finally {
    cleanup();
  }
});

test("executeOapeflirRuntimePlan with output schema refs", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  try {
    const bundle = createTestPlanGraphBundle([
      createPlanNode({
        nodeId: "output-ref-step",
        nodeType: "tool",
        outputSchemaRef: "schema:custom:output:ref",
      }),
    ]);

    const result = await executeOapeflirRuntimePlan({
      dbPath,
      planGraphBundle: bundle,
    });

    const step = result.plannedWorkflow.workflow.steps[0];
    assert.ok(step);
    assert.deepEqual(step.outputs, ["schema:custom:output:ref"]);
  } finally {
    cleanup();
  }
});

test("executeOapeflirRuntimePlan handles retry policies", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  try {
    const bundle = createTestPlanGraphBundle([
      createPlanNode({
        nodeId: "no-retry",
        nodeType: "tool",
        retryPolicyRef: "retry:max:0",
      }),
      createPlanNode({
        nodeId: "single-retry",
        nodeType: "tool",
        retryPolicyRef: "retry:max:1",
      }),
      createPlanNode({
        nodeId: "multi-retry",
        nodeType: "llm",
        retryPolicyRef: "retry:max:3",
      }),
    ]);

    const result = await executeOapeflirRuntimePlan({
      dbPath,
      planGraphBundle: bundle,
    });

    assert.ok(result.snapshot.task);
    const steps = result.plannedWorkflow.workflow.steps;
    assert.ok(steps.find((s) => s.stepId === "no-retry"));
    assert.ok(steps.find((s) => s.stepId === "single-retry"));
    assert.ok(steps.find((s) => s.stepId === "multi-retry"));
  } finally {
    cleanup();
  }
});

test("executeOapeflirRuntimePlan with budget intents", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  try {
    const bundle = createTestPlanGraphBundle([
      createPlanNode({
        nodeId: "budget-step",
        nodeType: "llm",
        budgetIntent: {
          amount: 5000,
          currency: "USD",
          resourceKinds: ["token", "compute", "storage"],
        },
      }),
    ]);

    const result = await executeOapeflirRuntimePlan({
      dbPath,
      planGraphBundle: bundle,
    });

    assert.ok(result.snapshot.task);
  } finally {
    cleanup();
  }
});

test("executeOapeflirRuntimePlan with side effect profiles", async () => {
  const { dbPath, cleanup } = initHaCoordinatorForTests();

  try {
    const bundle = createTestPlanGraphBundle([
      createPlanNode({
        nodeId: "reversible-step",
        nodeType: "tool",
        sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
      }),
      createPlanNode({
        nodeId: "external-effect-step",
        nodeType: "tool",
        sideEffectProfile: { mayCommitExternalEffect: true, reversible: false },
      }),
    ]);

    const result = await executeOapeflirRuntimePlan({
      dbPath,
      planGraphBundle: bundle,
    });

    assert.ok(result.snapshot.task);
    assert.equal(result.plannedWorkflow.workflow.steps.length, 2);
  } finally {
    cleanup();
  }
});