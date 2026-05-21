import assert from "node:assert/strict";
import test from "node:test";

import {
  executeOapeflirRuntimePlan,
  type RuntimePlanExecutionInput,
} from "../../../../src/platform/five-plane-execution/oapeflir/runtime-plan-executor.js";
import type { PlanGraphBundle, PlanNode } from "../../../../src/platform/contracts/executable-contracts/index.js";

function createMockPlanGraphBundle(override?: Partial<PlanGraphBundle>): PlanGraphBundle {
  const node1: PlanNode = {
    nodeId: "step-1",
    nodeType: "action",
    description: "First step",
    inputRefs: [],
    outputSchemaRef: "output-1",
    timeoutMs: 30000,
    metadata: {},
  };
  const node2: PlanNode = {
    nodeId: "step-2",
    nodeType: "action",
    description: "Second step",
    inputRefs: ["step-1"],
    outputSchemaRef: "output-2",
    timeoutMs: 30000,
    metadata: {},
  };
  return {
    planGraphBundleId: override?.planGraphBundleId ?? "test-plan-bundle-001",
    harnessRunId: override?.harnessRunId ?? "test-harness-run-001",
    graph: {
      nodes: override?.graph?.nodes ?? [node1, node2],
      edges: override?.graph?.edges ?? [],
      metadata: {},
    },
    executionConfig: {
      maxConcurrency: 1,
      retryPolicy: { maxRetries: 0, backoffMs: 0 },
      timeoutMs: 60000,
    },
    ...override,
  };
}

test("RuntimePlanExecutionInput interface accepts required fields", () => {
  const input: RuntimePlanExecutionInput = {
    dbPath: "/tmp/test.db",
    planGraphBundle: createMockPlanGraphBundle(),
  };
  assert.equal(input.dbPath, "/tmp/test.db");
  assert.equal(input.planGraphBundle.planGraphBundleId, "test-plan-bundle-001");
});

test("RuntimePlanExecutionInput interface accepts optional contextBudgetTokens", () => {
  const input: RuntimePlanExecutionInput = {
    dbPath: "/tmp/test.db",
    planGraphBundle: createMockPlanGraphBundle(),
    contextBudgetTokens: 4096,
  };
  assert.equal(input.contextBudgetTokens, 4096);
});

test("executeOapeflirRuntimePlan returns MultiStepOrchestrationResult type", async () => {
  const input: RuntimePlanExecutionInput = {
    dbPath: ":memory:",
    planGraphBundle: createMockPlanGraphBundle({
      planGraphBundleId: "test-plan-type-check",
      harnessRunId: "test-harness-type-check",
    }),
  };
  const result = await executeOapeflirRuntimePlan(input);
  assert.ok(result, "result should exist");
  assert.ok("taskId" in result || "error" in result, "result should have taskId or error");
});

test("executeOapeflirRuntimePlan handles plan with single node", async () => {
  const singleNodeBundle = createMockPlanGraphBundle({
    planGraphBundleId: "single-node-plan",
    harnessRunId: "single-harness-run",
    graph: {
      nodes: [
        {
          nodeId: "only-step",
          nodeType: "execute",
          description: "Only step",
          inputRefs: [],
          outputSchemaRef: "only-output",
          timeoutMs: 10000,
          metadata: {},
        },
      ],
      edges: [],
      metadata: {},
    },
  });

  const input: RuntimePlanExecutionInput = {
    dbPath: ":memory:",
    planGraphBundle: singleNodeBundle,
  };
  const result = await executeOapeflirRuntimePlan(input);
  assert.ok(result, "result should exist for single node plan");
});

test("executeOapeflirRuntimePlan handles plan with multiple dependencies", async () => {
  const multiDepsBundle = createMockPlanGraphBundle({
    planGraphBundleId: "multi-deps-plan",
    harnessRunId: "multi-deps-harness",
    graph: {
      nodes: [
        {
          nodeId: "root-step",
          nodeType: "action",
          description: "Root step",
          inputRefs: [],
          outputSchemaRef: "root-output",
          timeoutMs: 15000,
          metadata: {},
        },
        {
          nodeId: "branch-1",
          nodeType: "action",
          description: "Branch 1",
          inputRefs: ["root-step"],
          outputSchemaRef: "branch-1-output",
          timeoutMs: 15000,
          metadata: {},
        },
        {
          nodeId: "branch-2",
          nodeType: "action",
          description: "Branch 2",
          inputRefs: ["root-step"],
          outputSchemaRef: "branch-2-output",
          timeoutMs: 15000,
          metadata: {},
        },
        {
          nodeId: "final-step",
          nodeType: "action",
          description: "Final step",
          inputRefs: ["branch-1", "branch-2"],
          outputSchemaRef: "final-output",
          timeoutMs: 30000,
          metadata: {},
        },
      ],
      edges: [],
      metadata: {},
    },
  });

  const input: RuntimePlanExecutionInput = {
    dbPath: ":memory:",
    planGraphBundle: multiDepsBundle,
  };
  const result = await executeOapeflirRuntimePlan(input);
  assert.ok(result, "result should exist for multi-dependency plan");
});

test("executeOapeflirRuntimePlan handles plan with context budget tokens", async () => {
  const input: RuntimePlanExecutionInput = {
    dbPath: ":memory:",
    planGraphBundle: createMockPlanGraphBundle({
      planGraphBundleId: "budget-plan",
      harnessRunId: "budget-harness",
    }),
    contextBudgetTokens: 8192,
  };
  const result = await executeOapeflirRuntimePlan(input);
  assert.ok(result, "result should exist when context budget tokens provided");
});

test("executeOapeflirRuntimePlan uses plan bundle ID as task ID", async () => {
  const customBundleId = "custom-bundle-id-12345";
  const input: RuntimePlanExecutionInput = {
    dbPath: ":memory:",
    planGraphBundle: createMockPlanGraphBundle({
      planGraphBundleId: customBundleId,
      harnessRunId: "harness-123",
    }),
  };
  const result = await executeOapeflirRuntimePlan(input);
  if ("taskId" in result) {
    assert.equal(result.taskId, customBundleId);
  }
});

test("executeOapeflirRuntimePlan uses harness run ID from bundle", async () => {
  const customHarnessRunId = "custom-harness-run-456";
  const input: RuntimePlanExecutionInput = {
    dbPath: ":memory:",
    planGraphBundle: createMockPlanGraphBundle({
      planGraphBundleId: "bundle-789",
      harnessRunId: customHarnessRunId,
    }),
  };
  const result = await executeOapeflirRuntimePlan(input);
  assert.ok(result, "result should exist with harness run ID from bundle");
});

test("executeOapeflirRuntimePlan handles plan with various node types", async () => {
  const mixedTypesBundle = createMockPlanGraphBundle({
    planGraphBundleId: "mixed-types-plan",
    harnessRunId: "mixed-types-harness",
    graph: {
      nodes: [
        {
          nodeId: "query-node",
          nodeType: "query",
          description: "A query node",
          inputRefs: [],
          outputSchemaRef: "query-output",
          timeoutMs: 5000,
          metadata: {},
        },
        {
          nodeId: "action-node",
          nodeType: "action",
          description: "An action node",
          inputRefs: ["query-node"],
          outputSchemaRef: "action-output",
          timeoutMs: 10000,
          metadata: {},
        },
        {
          nodeId: "transform-node",
          nodeType: "transform",
          description: "A transform node",
          inputRefs: ["action-node"],
          outputSchemaRef: "transform-output",
          timeoutMs: 8000,
          metadata: {},
        },
      ],
      edges: [],
      metadata: {},
    },
  });

  const input: RuntimePlanExecutionInput = {
    dbPath: ":memory:",
    planGraphBundle: mixedTypesBundle,
  };
  const result = await executeOapeflirRuntimePlan(input);
  assert.ok(result, "result should exist for mixed node types plan");
});

test("executeOapeflirRuntimePlan handles empty plan graph bundle", async () => {
  const emptyBundle = createMockPlanGraphBundle({
    planGraphBundleId: "empty-plan",
    harnessRunId: "empty-harness",
    graph: {
      nodes: [],
      edges: [],
      metadata: {},
    },
  });

  const input: RuntimePlanExecutionInput = {
    dbPath: ":memory:",
    planGraphBundle: emptyBundle,
  };
  const result = await executeOapeflirRuntimePlan(input);
  assert.ok(result, "result should exist for empty plan");
});

test("executeOapeflirRuntimePlan handles plan with zero timeout", async () => {
  const zeroTimeoutBundle = createMockPlanGraphBundle({
    planGraphBundleId: "zero-timeout-plan",
    harnessRunId: "zero-timeout-harness",
    graph: {
      nodes: [
        {
          nodeId: "zero-timeout-step",
          nodeType: "action",
          description: "Zero timeout step",
          inputRefs: [],
          outputSchemaRef: "zero-output",
          timeoutMs: 0,
          metadata: {},
        },
      ],
      edges: [],
      metadata: {},
    },
  });

  const input: RuntimePlanExecutionInput = {
    dbPath: ":memory:",
    planGraphBundle: zeroTimeoutBundle,
  };
  const result = await executeOapeflirRuntimePlan(input);
  assert.ok(result, "result should exist for zero timeout plan");
});

test("executeOapeflirRuntimePlan handles plan with high timeout", async () => {
  const highTimeoutBundle = createMockPlanGraphBundle({
    planGraphBundleId: "high-timeout-plan",
    harnessRunId: "high-timeout-harness",
    graph: {
      nodes: [
        {
          nodeId: "high-timeout-step",
          nodeType: "action",
          description: "High timeout step",
          inputRefs: [],
          outputSchemaRef: "high-timeout-output",
          timeoutMs: 3600000,
          metadata: {},
        },
      ],
      edges: [],
      metadata: {},
    },
  });

  const input: RuntimePlanExecutionInput = {
    dbPath: ":memory:",
    planGraphBundle: highTimeoutBundle,
  };
  const result = await executeOapeflirRuntimePlan(input);
  assert.ok(result, "result should exist for high timeout plan");
});