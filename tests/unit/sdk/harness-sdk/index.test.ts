/**
 * @fileoverview Unit tests for Harness SDK (src/sdk/harness-sdk/index.ts)
 * Tests for HarnessSdk class and PlanGraph bundle utilities
 */

import assert from "node:assert/strict";
import test from "node:test";

import { HarnessSdk, HarnessSdkError } from "../../../../src/sdk/harness-sdk/index.js";
import type { HarnessSdkCreateRunInput, HarnessSdkAppendStepInput } from "../../../../src/sdk/harness-sdk/index.js";
import { buildPlanGraphBundle, validatePlanGraph, validatePlanGraphBundle } from "../../../../src/sdk/harness-sdk/index.js";
import type { PlanGraphBuildInput } from "../../../../src/sdk/harness-sdk/index.js";
import type { PlanNode, PlanEdge } from "../../../../src/platform/contracts/executable-contracts/index.js";

// ============================================================================
// HarnessSdkError
// ============================================================================

test("HarnessSdkError has correct name and properties", () => {
  const error = new HarnessSdkError("test_code", "Test message", { key: "value" });
  assert.equal(error.name, "HarnessSdkError");
  assert.equal(error.code, "test_code");
  assert.equal(error.message, "Test message");
  assert.deepEqual(error.details, { key: "value" });
});

test("HarnessSdkError is instanceof Error", () => {
  const error = new HarnessSdkError("test_code", "Test message");
  assert.ok(error instanceof Error);
});

test("HarnessSdkError preserves stack trace", () => {
  const error = new HarnessSdkError("test_code", "Test message");
  assert.ok(error.stack !== undefined);
  assert.ok(error.stack!.includes("HarnessSdkError"));
});

// ============================================================================
// HarnessSdk.createRun
// ============================================================================

test("HarnessSdk.createRun throws when tenantId is missing", () => {
  const sdk = new HarnessSdk();

  const input: HarnessSdkCreateRunInput = {
    taskId: "task-123",
    domainId: "domain-1",
    constraintPack: { phase: "execution" } as any,
    // missing tenantId
  };

  assert.throws(
    () => sdk.createRun(input),
    (error: unknown) => error instanceof HarnessSdkError && error.code === "harness_sdk.missing_tenant",
  );
});

test("HarnessSdk.createRun allows run creation when tenantId is provided", () => {
  const sdk = new HarnessSdk();

  const input: HarnessSdkCreateRunInput = {
    taskId: "task-123",
    domainId: "domain-1",
    constraintPack: { phase: "execution" } as any,
    tenantId: "tenant-1",
  };

  // Should not throw - actual runtime creates run
  const run = sdk.createRun(input);
  assert.ok(run !== undefined);
  assert.ok(run.harnessRunId !== undefined);
});

test("HarnessSdk.createRun with budgetRef and allowed budget succeeds", () => {
  const sdk = new HarnessSdk(undefined, (_budgetRef: string) => ({
    allowed: true,
    remainingBudget: 1000,
  }));

  const input: HarnessSdkCreateRunInput = {
    taskId: "task-123",
    domainId: "domain-1",
    constraintPack: { phase: "execution" } as any,
    tenantId: "tenant-1",
    budgetRef: "budget-123",
  };

  const run = sdk.createRun(input);
  assert.ok(run !== undefined);
});

test("HarnessSdk.createRun with budgetRef and disallowed budget throws", () => {
  const sdk = new HarnessSdk(undefined, (_budgetRef: string) => ({
    allowed: false,
    remainingBudget: 0,
    error: "Budget exhausted",
  }));

  const input: HarnessSdkCreateRunInput = {
    taskId: "task-123",
    domainId: "domain-1",
    constraintPack: { phase: "execution" } as any,
    tenantId: "tenant-1",
    budgetRef: "budget-exhausted",
  };

  assert.throws(
    () => sdk.createRun(input),
    (error: unknown) => error instanceof HarnessSdkError && error.code === "harness_sdk.budget_exceeded",
  );
});

// ============================================================================
// HarnessSdk.appendStep
// ============================================================================

test("HarnessSdk.appendStep appends step to run", () => {
  const sdk = new HarnessSdk();

  // Create a run first
  const runInput: HarnessSdkCreateRunInput = {
    taskId: "task-123",
    domainId: "domain-1",
    constraintPack: { phase: "execution" } as any,
    tenantId: "tenant-1",
  };
  const run = sdk.createRun(runInput);

  const stepInput: HarnessSdkAppendStepInput = {
    role: "executor",
    nodeRunId: "node-1",
    planGraphId: "graph-1",
    inputs: { query: "test" },
    outputs: { result: "success" },
  };

  const updatedRun = sdk.appendStep(run, stepInput);
  assert.ok(updatedRun !== undefined);
  assert.ok(updatedRun.harnessRunId === run.harnessRunId);
  assert.ok(updatedRun.nodeRunIds.includes("node-1"));
});

test("HarnessSdk.appendStepWithReceipt returns run and receipt", () => {
  const sdk = new HarnessSdk();

  const runInput: HarnessSdkCreateRunInput = {
    taskId: "task-123",
    domainId: "domain-1",
    constraintPack: { phase: "execution" } as any,
    tenantId: "tenant-1",
  };
  const run = sdk.createRun(runInput);

  const stepInput: HarnessSdkAppendStepInput = {
    role: "executor",
    nodeRunId: "node-1",
    planGraphId: "graph-1",
    inputs: { query: "test" },
    outputs: { result: "success" },
  };

  const result = sdk.appendStepWithReceipt(run, stepInput, {
    status: "succeeded",
    duration: 100,
  });

  assert.ok(result.run !== undefined);
  assert.ok(result.receipt !== undefined);
  assert.equal(result.receipt.status, "succeeded");
  assert.equal(result.receipt.duration, 100);
  assert.equal(result.receipt.nodeRunId, "node-1");
});

test("HarnessSdk.appendStepWithReceipt with error details", () => {
  const sdk = new HarnessSdk();

  const runInput: HarnessSdkCreateRunInput = {
    taskId: "task-123",
    domainId: "domain-1",
    constraintPack: { phase: "execution" } as any,
    tenantId: "tenant-1",
  };
  const run = sdk.createRun(runInput);

  const stepInput: HarnessSdkAppendStepInput = {
    role: "executor",
    nodeRunId: "node-1",
    planGraphId: "graph-1",
    inputs: {},
    outputs: {},
  };

  const result = sdk.appendStepWithReceipt(run, stepInput, {
    status: "failed",
    duration: 50,
    error: { code: "ERR_TOOL_FAILED", message: "Tool execution failed", retryable: true },
  });

  assert.equal(result.receipt.status, "failed");
  assert.equal(result.receipt.error?.code, "ERR_TOOL_FAILED");
  assert.equal(result.receipt.error?.retryable, true);
});

test("HarnessSdk.appendStepWithReceipt with outputRef", () => {
  const sdk = new HarnessSdk();

  const runInput: HarnessSdkCreateRunInput = {
    taskId: "task-123",
    domainId: "domain-1",
    constraintPack: { phase: "execution" } as any,
    tenantId: "tenant-1",
  };
  const run = sdk.createRun(runInput);

  const stepInput: HarnessSdkAppendStepInput = {
    role: "executor",
    nodeRunId: "node-1",
    planGraphId: "graph-1",
    inputs: {},
    outputs: {},
  };

  const outputRef = { artifactId: "art-123", uri: "s3://bucket/path", hash: "sha256:abc" };
  const result = sdk.appendStepWithReceipt(run, stepInput, { outputRef });

  assert.deepEqual(result.receipt.outputRef, outputRef);
});

test("HarnessSdk.reserveBudget delegates to budget checker", () => {
  const sdk = new HarnessSdk(undefined, (budgetRef: string) => ({
    allowed: budgetRef === "budget-ok",
    remainingBudget: budgetRef === "budget-ok" ? 42 : 0,
    ...(budgetRef === "budget-ok" ? {} : { error: "Budget exhausted" }),
  }));

  assert.deepEqual(sdk.reserveBudget("budget-ok", 10), {
    allowed: true,
    remainingBudget: 42,
  });
  assert.deepEqual(sdk.reserveBudget("budget-denied", 10), {
    allowed: false,
    remainingBudget: 0,
    error: "Budget exhausted",
  });
});

test("HarnessSdk.settleBudget persists an existing run", () => {
  const sdk = new HarnessSdk();
  const run = sdk.createRun({
    taskId: "task-123",
    domainId: "domain-1",
    constraintPack: { phase: "execution" } as any,
    tenantId: "tenant-1",
  });

  const settled = sdk.settleBudget(run);
  assert.equal(settled.harnessRunId, run.harnessRunId);
});

// ============================================================================
// HarnessSdk lifecycle methods
// ============================================================================

test("HarnessSdk.decide returns decision", () => {
  const sdk = new HarnessSdk();
  const decision = sdk.decide({} as any);
  assert.ok(decision !== undefined);
});

test("HarnessSdk.evaluate returns evaluation", () => {
  const sdk = new HarnessSdk();

  const runInput: HarnessSdkCreateRunInput = {
    taskId: "task-123",
    domainId: "domain-1",
    constraintPack: { phase: "execution" } as any,
    tenantId: "tenant-1",
  };
  const run = sdk.createRun(runInput);

  const evaluation = sdk.evaluate(run);
  assert.ok(evaluation !== undefined);
});

test("HarnessSdk.persist returns run", () => {
  const sdk = new HarnessSdk();

  const runInput: HarnessSdkCreateRunInput = {
    taskId: "task-123",
    domainId: "domain-1",
    constraintPack: { phase: "execution" } as any,
    tenantId: "tenant-1",
  };
  const run = sdk.createRun(runInput);

  const persisted = sdk.persist(run);
  assert.ok(persisted !== undefined);
  assert.ok(persisted.harnessRunId === run.harnessRunId);
});

test("HarnessSdk.checkpoint returns checkpoint string", () => {
  const sdk = new HarnessSdk();

  const runInput: HarnessSdkCreateRunInput = {
    taskId: "task-123",
    domainId: "domain-1",
    constraintPack: { phase: "execution" } as any,
    tenantId: "tenant-1",
  };
  const run = sdk.createRun(runInput);

  const checkpointRef = sdk.checkpoint(run);
  assert.ok(checkpointRef !== undefined);
  assert.ok(checkpointRef.length > 0);
});

test("HarnessSdk.restore returns null for non-existent run", () => {
  const sdk = new HarnessSdk();
  const restored = sdk.restore("non-existent-run-id");
  assert.equal(restored, null);
});

test("HarnessSdk.restoreFromCheckpoint returns null for non-existent checkpoint", () => {
  const sdk = new HarnessSdk();
  const restored = sdk.restoreFromCheckpoint("non-existent-checkpoint");
  assert.equal(restored, null);
});

test("HarnessSdk.sleep requires valid run", () => {
  const sdk = new HarnessSdk();

  assert.throws(
    () => sdk.sleep("non-existent-run", "reason", "2026-05-01T00:00:00.000Z"),
    /run_not_found/,
  );
});

test("HarnessSdk.resume requires valid run", () => {
  const sdk = new HarnessSdk();

  assert.throws(
    () => sdk.resume("non-existent-run"),
    /run_not_found/,
  );
});

test("HarnessSdk.requestHumanReview requires valid run", () => {
  const sdk = new HarnessSdk();

  assert.throws(
    () => sdk.requestHumanReview("non-existent-run", "Needs review", []),
    /run_not_found/,
  );
});

test("HarnessSdk.resolveReview requires valid run", () => {
  const sdk = new HarnessSdk();

  assert.throws(
    () => sdk.resolveReview("non-existent-run", "approved", "actor-1"),
    /run_not_found/,
  );
});

test("HarnessSdk.getTimeline requires valid run", () => {
  const sdk = new HarnessSdk();

  assert.throws(
    () => sdk.getTimeline("non-existent-run"),
    /run_not_found/,
  );
});

test("HarnessSdk.getEvaluation requires valid run", () => {
  const sdk = new HarnessSdk();

  assert.throws(
    () => sdk.getEvaluation("non-existent-run"),
    /run_not_found/,
  );
});

test("HarnessSdk.sideEffectReconciliation requires valid run", () => {
  const sdk = new HarnessSdk();

  assert.throws(
    () => sdk.sideEffectReconciliation("non-existent-run"),
    /run_not_found/,
  );
});

test("HarnessSdk.assertInvariants passes for valid run", () => {
  const sdk = new HarnessSdk();

  const runInput: HarnessSdkCreateRunInput = {
    taskId: "task-123",
    domainId: "domain-1",
    constraintPack: { phase: "execution" } as any,
    tenantId: "tenant-1",
  };
  const run = sdk.createRun(runInput);

  // Should not throw
  sdk.assertInvariants(run);
});

// ============================================================================
// PlanGraph bundle utilities
// ============================================================================

test("buildPlanGraphBundle creates valid bundle", () => {
  const nodes: PlanNode[] = [
    {
      nodeId: "node-1",
      nodeIndex: 0,
      capability: "execute",
      description: "Execute task",
      inputSchema: {},
      outputSchema: {},
      retryPolicy: { maxAttempts: 3 },
    },
    {
      nodeId: "node-2",
      nodeIndex: 1,
      capability: "evaluate",
      description: "Evaluate result",
      inputSchema: {},
      outputSchema: {},
    },
  ];

  const edges: PlanEdge[] = [
    {
      edgeId: "edge-1",
      fromNodeId: "node-1",
      toNodeId: "node-2",
      edgeType: "control_flow",
    },
  ];

  const input: PlanGraphBuildInput = {
    harnessRunId: "run-123",
    nodes,
    edges,
    entryNodeIds: ["node-1"],
    terminalNodeIds: ["node-2"],
  };

  const result = buildPlanGraphBundle(input);

  assert.ok(result.bundle !== undefined);
  assert.ok(result.bundle.graph !== undefined);
  assert.equal(result.bundle.graph.graphId.startsWith("plan_graph"), true);
  assert.equal(result.validationReport.valid, true);
  assert.equal(result.bundle.graph.nodes.length, 2);
  assert.equal(result.bundle.graph.edges.length, 1);
});

test("buildPlanGraphBundle with custom scheduler policy", () => {
  const nodes: PlanNode[] = [
    {
      nodeId: "node-1",
      nodeIndex: 0,
      capability: "execute",
      description: "Execute task",
      inputSchema: {},
      outputSchema: {},
    },
  ];

  const edges: PlanEdge[] = [];

  const input: PlanGraphBuildInput = {
    harnessRunId: "run-123",
    nodes,
    edges,
    entryNodeIds: ["node-1"],
    terminalNodeIds: ["node-1"],
    schedulerPolicy: {
      policyId: "custom-scheduler",
      strategy: "priority_then_fifo",
    },
  };

  const result = buildPlanGraphBundle(input);

  assert.equal(result.bundle.schedulerPolicy.policyId, "custom-scheduler");
  assert.equal(result.bundle.schedulerPolicy.strategy, "priority_then_fifo");
});

test("buildPlanGraphBundle with budget plan ref", () => {
  const nodes: PlanNode[] = [
    {
      nodeId: "node-1",
      nodeIndex: 0,
      capability: "execute",
      description: "Execute task",
      inputSchema: {},
      outputSchema: {},
    },
  ];

  const edges: PlanEdge[] = [];

  const input: PlanGraphBuildInput = {
    harnessRunId: "run-123",
    nodes,
    edges,
    entryNodeIds: ["node-1"],
    terminalNodeIds: ["node-1"],
    budgetPlanRef: "budget:premium",
  };

  const result = buildPlanGraphBundle(input);

  assert.equal(result.bundle.budgetPlanRef, "budget:premium");
});

test("validatePlanGraph validates entry nodes exist", () => {
  const graph = {
    graphId: "graph-1",
    nodes: [
      {
        nodeId: "node-1",
        nodeIndex: 0,
        capability: "execute",
        description: "Test",
        inputSchema: {},
        outputSchema: {},
      },
    ],
    edges: [],
    entryNodeIds: ["non-existent-node"],
    terminalNodeIds: ["node-1"],
    joinStrategy: "all" as const,
    graphHash: "hash-1",
  };

  const report = validatePlanGraph(graph);

  assert.equal(report.valid, false);
  assert.ok(report.findings.some((f) => f.includes("Entry node non-existent-node not found")));
});

test("validatePlanGraph validates terminal nodes exist", () => {
  const graph = {
    graphId: "graph-1",
    nodes: [
      {
        nodeId: "node-1",
        nodeIndex: 0,
        capability: "execute",
        description: "Test",
        inputSchema: {},
        outputSchema: {},
      },
    ],
    edges: [],
    entryNodeIds: ["node-1"],
    terminalNodeIds: ["non-existent-terminal"],
    joinStrategy: "all" as const,
    graphHash: "hash-1",
  };

  const report = validatePlanGraph(graph);

  assert.equal(report.valid, false);
  assert.ok(report.findings.some((f) => f.includes("Terminal node non-existent-terminal not found")));
});

test("validatePlanGraph validates edge references", () => {
  const graph = {
    graphId: "graph-1",
    nodes: [
      {
        nodeId: "node-1",
        nodeIndex: 0,
        capability: "execute",
        description: "Test",
        inputSchema: {},
        outputSchema: {},
      },
    ],
    edges: [
      {
        edgeId: "edge-1",
        fromNodeId: "node-1",
        toNodeId: "non-existent-target",
        edgeType: "control_flow" as const,
      },
    ],
    entryNodeIds: ["node-1"],
    terminalNodeIds: ["node-1"],
    joinStrategy: "all" as const,
    graphHash: "hash-1",
  };

  const report = validatePlanGraph(graph);

  assert.equal(report.valid, false);
  assert.ok(report.findings.some((f) => f.includes("Edge edge-1 references unknown toNodeId")));
});

test("validatePlanGraph validates no orphaned nodes", () => {
  const graph = {
    graphId: "graph-1",
    nodes: [
      {
        nodeId: "node-1",
        nodeIndex: 0,
        capability: "execute",
        description: "Test",
        inputSchema: {},
        outputSchema: {},
      },
      {
        nodeId: "orphaned-node",
        nodeIndex: 1,
        capability: "orphan",
        description: "Not reachable",
        inputSchema: {},
        outputSchema: {},
      },
    ],
    edges: [],
    entryNodeIds: ["node-1"],
    terminalNodeIds: ["node-1"],
    joinStrategy: "all" as const,
    graphHash: "hash-1",
  };

  const report = validatePlanGraph(graph);

  assert.equal(report.valid, false);
  assert.ok(report.findings.some((f) => f.includes("orphaned-node")));
});

test("validatePlanGraph accepts valid graph", () => {
  const graph = {
    graphId: "graph-1",
    nodes: [
      {
        nodeId: "node-1",
        nodeIndex: 0,
        capability: "start",
        description: "Start",
        inputSchema: {},
        outputSchema: {},
      },
      {
        nodeId: "node-2",
        nodeIndex: 1,
        capability: "end",
        description: "End",
        inputSchema: {},
        outputSchema: {},
      },
    ],
    edges: [
      {
        edgeId: "edge-1",
        fromNodeId: "node-1",
        toNodeId: "node-2",
        edgeType: "control_flow" as const,
      },
    ],
    entryNodeIds: ["node-1"],
    terminalNodeIds: ["node-2"],
    joinStrategy: "all" as const,
    graphHash: "hash-1",
  };

  const report = validatePlanGraph(graph);

  assert.equal(report.valid, true);
  assert.equal(report.findings.length, 0);
  assert.deepEqual(report.normalizedNodeIds, ["node-1", "node-2"]);
});

test("validatePlanGraphBundle validates bundle graph", () => {
  const nodes: PlanNode[] = [
    {
      nodeId: "node-1",
      nodeIndex: 0,
      capability: "execute",
      description: "Execute",
      inputSchema: {},
      outputSchema: {},
    },
  ];

  const edges: PlanEdge[] = [];

  const input: PlanGraphBuildInput = {
    harnessRunId: "run-123",
    nodes,
    edges,
    entryNodeIds: ["node-1"],
    terminalNodeIds: ["node-1"],
  };

  const result = buildPlanGraphBundle(input);
  const bundleValidation = validatePlanGraphBundle(result.bundle);

  assert.equal(bundleValidation.valid, true);
  assert.equal(bundleValidation.findings.length, 0);
});

test("validatePlanGraphBundle detects invalid bundle", () => {
  const nodes: PlanNode[] = [
    {
      nodeId: "node-1",
      nodeIndex: 0,
      capability: "execute",
      description: "Execute",
      inputSchema: {},
      outputSchema: {},
    },
  ];

  const edges: PlanEdge[] = [];

  const input: PlanGraphBuildInput = {
    harnessRunId: "run-123",
    nodes,
    edges,
    entryNodeIds: ["non-existent-node"], // Invalid entry node
    terminalNodeIds: ["node-1"],
  };

  const result = buildPlanGraphBundle(input);
  const bundleValidation = validatePlanGraphBundle(result.bundle);

  assert.equal(bundleValidation.valid, false);
  assert.ok(bundleValidation.findings.length > 0);
});

// ============================================================================
// Edge cases
// ============================================================================

test("HarnessSdk.appendStepWithReceipt uses provided nodeAttemptId", () => {
  const sdk = new HarnessSdk();

  const runInput: HarnessSdkCreateRunInput = {
    taskId: "task-123",
    domainId: "domain-1",
    constraintPack: { phase: "execution" } as any,
    tenantId: "tenant-1",
  };
  const run = sdk.createRun(runInput);

  const stepInput: HarnessSdkAppendStepInput = {
    role: "executor",
    nodeRunId: "node-1",
    planGraphId: "graph-1",
    inputs: {},
    outputs: {},
    nodeAttemptId: "custom-nattempt-id",
  };

  const result = sdk.appendStepWithReceipt(run, stepInput);

  assert.equal(result.receipt.nodeAttemptId, "custom-nattempt-id");
});

test("HarnessSdk.appendStepWithReceipt uses provided graphVersion", () => {
  const sdk = new HarnessSdk();

  const runInput: HarnessSdkCreateRunInput = {
    taskId: "task-123",
    domainId: "domain-1",
    constraintPack: { phase: "execution" } as any,
    tenantId: "tenant-1",
  };
  const run = sdk.createRun(runInput);

  const stepInput: HarnessSdkAppendStepInput = {
    role: "executor",
    nodeRunId: "node-1",
    planGraphId: "graph-1",
    inputs: {},
    outputs: {},
    graphVersion: 42,
  };

  const result = sdk.appendStepWithReceipt(run, stepInput);

  assert.equal(result.receipt.graphVersion, 42);
});

test("HarnessSdk.appendStepWithReceipt uses provided receiptKind", () => {
  const sdk = new HarnessSdk();

  const runInput: HarnessSdkCreateRunInput = {
    taskId: "task-123",
    domainId: "domain-1",
    constraintPack: { phase: "execution" } as any,
    tenantId: "tenant-1",
  };
  const run = sdk.createRun(runInput);

  const stepInput: HarnessSdkAppendStepInput = {
    role: "executor",
    nodeRunId: "node-1",
    planGraphId: "graph-1",
    inputs: {},
    outputs: {},
    receiptKind: "retriever",
  };

  const result = sdk.appendStepWithReceipt(run, stepInput);

  assert.equal(result.receipt.receiptKind, "retriever");
});

test("HarnessSdk works with empty constraintPack", () => {
  const sdk = new HarnessSdk();

  const runInput: HarnessSdkCreateRunInput = {
    taskId: "task-123",
    domainId: "domain-1",
    constraintPack: {} as any,
    tenantId: "tenant-1",
  };

  const run = sdk.createRun(runInput);
  assert.ok(run !== undefined);
});

test("buildPlanGraphBundle with empty edges array is valid", () => {
  const nodes: PlanNode[] = [
    {
      nodeId: "node-1",
      nodeIndex: 0,
      capability: "solo",
      description: "Solo node",
      inputSchema: {},
      outputSchema: {},
    },
  ];

  const input: PlanGraphBuildInput = {
    harnessRunId: "run-123",
    nodes,
    edges: [],
    entryNodeIds: ["node-1"],
    terminalNodeIds: ["node-1"],
  };

  const result = buildPlanGraphBundle(input);

  assert.equal(result.validationReport.valid, true);
  assert.equal(result.bundle.graph.edges.length, 0);
});

test("buildPlanGraphBundle uses default scheduler policy when not provided", () => {
  const nodes: PlanNode[] = [
    {
      nodeId: "node-1",
      nodeIndex: 0,
      capability: "execute",
      description: "Execute",
      inputSchema: {},
      outputSchema: {},
    },
  ];

  const input: PlanGraphBuildInput = {
    harnessRunId: "run-123",
    nodes,
    edges: [],
    entryNodeIds: ["node-1"],
    terminalNodeIds: ["node-1"],
  };

  const result = buildPlanGraphBundle(input);

  assert.equal(result.bundle.schedulerPolicy.policyId, "scheduler:default");
  assert.equal(result.bundle.schedulerPolicy.strategy, "deterministic_fifo");
});

test("buildPlanGraphBundle uses default budget plan ref when not provided", () => {
  const nodes: PlanNode[] = [
    {
      nodeId: "node-1",
      nodeIndex: 0,
      capability: "execute",
      description: "Execute",
      inputSchema: {},
      outputSchema: {},
    },
  ];

  const input: PlanGraphBuildInput = {
    harnessRunId: "run-123",
    nodes,
    edges: [],
    entryNodeIds: ["node-1"],
    terminalNodeIds: ["node-1"],
  };

  const result = buildPlanGraphBundle(input);

  assert.equal(result.bundle.budgetPlanRef, "budget:default");
});
