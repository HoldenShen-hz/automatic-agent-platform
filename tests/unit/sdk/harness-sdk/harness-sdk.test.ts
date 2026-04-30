/**
 * @fileoverview Tests for harness-sdk/index.ts - Lifecycle hooks and HarnessSdk methods
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  HarnessSdk,
  buildPlanGraphBundle,
  validatePlanGraph,
  validatePlanGraphBundle,
  type HarnessSdkCreateRunInput,
  type PlanGraphBuildInput,
  type PlanNode,
  type PlanEdge,
} from "../../../../src/sdk/harness-sdk/index.js";
import { newId } from "../../../../src/platform/contracts/types/ids.js";

// ============================================================================
// HarnessSdk Lifecycle Hook Tests
// ============================================================================

test("HarnessSdk.createRun throws when tenantId is missing", () => {
  const sdk = new HarnessSdk();

  const input: HarnessSdkCreateRunInput = {
    taskId: "task_123",
    domainId: "core",
    constraintPack: {
      constraints: [],
      maxConcurrentNodes: 1,
      strategy: { type: "fifo" },
    },
    // tenantId intentionally omitted
  };

  assert.throws(
    () => sdk.createRun(input),
    /missing_tenant/i,
  );
});

test("HarnessSdk.createRun throws when budget exceeded", () => {
  const sdk = new HarnessSdk(undefined, (budgetRef) => ({
    allowed: false,
    remainingBudget: 0,
    error: "Budget exhausted",
  }));

  const input: HarnessSdkCreateRunInput = {
    taskId: "task_123",
    domainId: "core",
    tenantId: "tenant_abc",
    budgetRef: "budget_exhausted",
    constraintPack: {
      constraints: [],
      maxConcurrentNodes: 1,
      strategy: { type: "fifo" },
    },
  };

  assert.throws(
    () => sdk.createRun(input),
    /budget/i,
  );
});

test("HarnessSdk.createRun succeeds with valid tenant and budget", () => {
  const sdk = new HarnessSdk(undefined, (budgetRef) => ({
    allowed: true,
    remainingBudget: 1000,
  }));

  const input: HarnessSdkCreateRunInput = {
    taskId: "task_123",
    domainId: "core",
    tenantId: "tenant_abc",
    budgetRef: "budget_valid",
    constraintPack: {
      constraints: [],
      maxConcurrentNodes: 1,
      strategy: { type: "fifo" },
    },
  };

  const run = sdk.createRun(input);
  assert.ok(run, "Run should be created successfully");
  assert.ok(run.harnessRunId, "Run should have harnessRunId");
});

test("HarnessSdk.createRun succeeds without budgetRef", () => {
  const sdk = new HarnessSdk();

  const input: HarnessSdkCreateRunInput = {
    taskId: "task_123",
    domainId: "core",
    tenantId: "tenant_abc",
    constraintPack: {
      constraints: [],
      maxConcurrentNodes: 1,
      strategy: { type: "fifo" },
    },
  };

  const run = sdk.createRun(input);
  assert.ok(run, "Run should be created successfully");
});

test("HarnessSdk.appendStep routes nodeRunId and planGraphId properly", () => {
  const sdk = new HarnessSdk();

  // Create a minimal run
  const run = {
    harnessRunId: newId("run"),
    createdAt: new Date().toISOString(),
    status: "active" as const,
    currentSeq: 1,
    tenantId: "tenant_abc",
    taskId: "task_123",
    domainId: "core",
    planGraphId: "pg_123",
    nodes: [],
    edges: [],
    timeline: [],
  };

  const result = sdk.appendStep(run, {
    role: "executor" as const,
    nodeRunId: "nr_456",
    planGraphId: "pg_789",
    inputs: { query: "test" },
    outputs: { result: "success" },
  });

  assert.ok(result, "appendStep should return a run");
});

test("HarnessSdk.appendStepWithReceipt produces NodeAttemptReceipt", () => {
  const sdk = new HarnessSdk();

  const run = {
    harnessRunId: newId("run"),
    createdAt: new Date().toISOString(),
    status: "active" as const,
    currentSeq: 1,
    tenantId: "tenant_abc",
    taskId: "task_123",
    domainId: "core",
    planGraphId: "pg_123",
    nodes: [],
    edges: [],
    timeline: [],
  };

  const { run: updatedRun, receipt } = sdk.appendStepWithReceipt(run, {
    role: "executor" as const,
    nodeRunId: "nr_456",
    planGraphId: "pg_789",
    inputs: { query: "test" },
    outputs: { result: "success" },
  });

  assert.ok(updatedRun, "Should return updated run");
  assert.ok(receipt, "Should produce receipt");
  assert.equal(receipt.nodeRunId, "nr_456");
  assert.equal(receipt.harnessRunId, run.harnessRunId);
  assert.equal(receipt.planGraphId, "pg_789");
  assert.equal(receipt.status, "succeeded");
});

test("HarnessSdk.appendStepWithReceipt accepts custom status", () => {
  const sdk = new HarnessSdk();

  const run = {
    harnessRunId: newId("run"),
    createdAt: new Date().toISOString(),
    status: "active" as const,
    currentSeq: 1,
    tenantId: "tenant_abc",
    taskId: "task_123",
    domainId: "core",
    planGraphId: "pg_123",
    nodes: [],
    edges: [],
    timeline: [],
  };

  const { receipt } = sdk.appendStepWithReceipt(
    run,
    {
      role: "executor" as const,
      nodeRunId: "nr_456",
      planGraphId: "pg_789",
      inputs: {},
      outputs: {},
    },
    { status: "failed" },
  );

  assert.equal(receipt.status, "failed");
});

test("HarnessSdk.appendStepWithReceipt accepts error info", () => {
  const sdk = new HarnessSdk();

  const run = {
    harnessRunId: newId("run"),
    createdAt: new Date().toISOString(),
    status: "active" as const,
    currentSeq: 1,
    tenantId: "tenant_abc",
    taskId: "task_123",
    domainId: "core",
    planGraphId: "pg_123",
    nodes: [],
    edges: [],
    timeline: [],
  };

  const { receipt } = sdk.appendStepWithReceipt(
    run,
    {
      role: "executor" as const,
      nodeRunId: "nr_456",
      planGraphId: "pg_789",
      inputs: {},
      outputs: {},
    },
    {
      status: "failed",
      error: {
        code: "eval_failed",
        message: "Evaluation failed",
        retryable: true,
      },
    },
  );

  assert.equal(receipt.status, "failed");
  assert.ok(receipt.error, "Receipt should have error");
  assert.equal(receipt.error.code, "eval_failed");
});

test("HarnessSdk.appendStepWithReceipt accepts outputRef", () => {
  const sdk = new HarnessSdk();

  const run = {
    harnessRunId: newId("run"),
    createdAt: new Date().toISOString(),
    status: "active" as const,
    currentSeq: 1,
    tenantId: "tenant_abc",
    taskId: "task_123",
    domainId: "core",
    planGraphId: "pg_123",
    nodes: [],
    edges: [],
    timeline: [],
  };

  const { receipt } = sdk.appendStepWithReceipt(
    run,
    {
      role: "executor" as const,
      nodeRunId: "nr_456",
      planGraphId: "pg_789",
      inputs: {},
      outputs: {},
    },
    {
      outputRef: {
        artifactId: "art_123",
        uri: "s3://bucket/path",
        hash: "abc123",
      },
    },
  );

  assert.ok(receipt.outputRef, "Receipt should have outputRef");
  assert.equal(receipt.outputRef.artifactId, "art_123");
});

// ============================================================================
// buildPlanGraphBundle Tests
// ============================================================================

test("buildPlanGraphBundle creates bundle with nodes and edges", () => {
  const nodes: PlanNode[] = [
    {
      nodeId: "node_1",
      nodeType: "task",
      status: "pending",
      version: 1,
    },
    {
      nodeId: "node_2",
      nodeType: "task",
      status: "pending",
      version: 1,
    },
  ];

  const edges: PlanEdge[] = [
    {
      edgeId: "edge_1",
      edgeType: "dependency",
      fromNodeId: "node_1",
      toNodeId: "node_2",
    },
  ];

  const input: PlanGraphBuildInput = {
    harnessRunId: "run_123",
    nodes,
    edges,
    entryNodeIds: ["node_1"],
    terminalNodeIds: ["node_2"],
  };

  const { bundle, validationReport } = buildPlanGraphBundle(input);

  assert.ok(bundle, "Should return bundle");
  assert.ok(bundle.graph, "Bundle should have graph");
  assert.equal(bundle.graph.nodes.length, 2);
  assert.equal(bundle.graph.edges.length, 1);
  assert.ok(validationReport, "Should have validation report");
});

test("buildPlanGraphBundle sets default scheduler policy", () => {
  const input: PlanGraphBuildInput = {
    harnessRunId: "run_123",
    nodes: [],
    edges: [],
    entryNodeIds: [],
    terminalNodeIds: [],
  };

  const { bundle } = buildPlanGraphBundle(input);

  assert.ok(bundle.schedulerPolicy, "Should have default scheduler policy");
  assert.equal(bundle.schedulerPolicy.strategy, "deterministic_fifo");
});

test("buildPlanGraphBundle accepts custom scheduler policy", () => {
  const input: PlanGraphBuildInput = {
    harnessRunId: "run_123",
    nodes: [],
    edges: [],
    entryNodeIds: [],
    terminalNodeIds: [],
    schedulerPolicy: {
      policyId: "custom_scheduler",
      strategy: "priority_then_fifo",
    },
  };

  const { bundle } = buildPlanGraphBundle(input);

  assert.equal(bundle.schedulerPolicy.strategy, "priority_then_fifo");
});

test("buildPlanGraphBundle sets default budgetPlanRef", () => {
  const input: PlanGraphBuildInput = {
    harnessRunId: "run_123",
    nodes: [],
    edges: [],
    entryNodeIds: [],
    terminalNodeIds: [],
  };

  const { bundle } = buildPlanGraphBundle(input);

  assert.equal(bundle.budgetPlanRef, "budget:default");
});

test("buildPlanGraphBundle uses custom budgetPlanRef", () => {
  const input: PlanGraphBuildInput = {
    harnessRunId: "run_123",
    nodes: [],
    edges: [],
    entryNodeIds: [],
    terminalNodeIds: [],
    budgetPlanRef: "budget_custom",
  };

  const { bundle } = buildPlanGraphBundle(input);

  assert.equal(bundle.budgetPlanRef, "budget_custom");
});

// ============================================================================
// validatePlanGraph Tests
// ============================================================================

test("validatePlanGraph returns valid for proper graph", () => {
  const graph = {
    graphId: "graph_1",
    nodes: [
      { nodeId: "node_1", nodeType: "task" as const, status: "pending" as const, version: 1 },
      { nodeId: "node_2", nodeType: "task" as const, status: "pending" as const, version: 1 },
    ],
    edges: [
      { edgeId: "edge_1", edgeType: "dependency" as const, fromNodeId: "node_1", toNodeId: "node_2" },
    ],
    entryNodeIds: ["node_1"],
    terminalNodeIds: ["node_2"],
    joinStrategy: "all" as const,
    graphHash: "hash123",
  };

  const report = validatePlanGraph(graph);

  assert.equal(report.valid, true);
  assert.deepEqual(report.findings, []);
});

test("validatePlanGraph reports missing entry node", () => {
  const graph = {
    graphId: "graph_1",
    nodes: [
      { nodeId: "node_1", nodeType: "task" as const, status: "pending" as const, version: 1 },
    ],
    edges: [],
    entryNodeIds: ["nonexistent"],
    terminalNodeIds: [],
    joinStrategy: "all" as const,
    graphHash: "hash123",
  };

  const report = validatePlanGraph(graph);

  assert.equal(report.valid, false);
  assert.ok(report.findings.some((f) => f.includes("nonexistent")));
});

test("validatePlanGraph reports missing terminal node", () => {
  const graph = {
    graphId: "graph_1",
    nodes: [
      { nodeId: "node_1", nodeType: "task" as const, status: "pending" as const, version: 1 },
    ],
    edges: [],
    entryNodeIds: [],
    terminalNodeIds: ["nonexistent"],
    joinStrategy: "all" as const,
    graphHash: "hash123",
  };

  const report = validatePlanGraph(graph);

  assert.equal(report.valid, false);
  assert.ok(report.findings.some((f) => f.includes("nonexistent")));
});

test("validatePlanGraph reports edge with unknown fromNodeId", () => {
  const graph = {
    graphId: "graph_1",
    nodes: [
      { nodeId: "node_1", nodeType: "task" as const, status: "pending" as const, version: 1 },
    ],
    edges: [
      { edgeId: "edge_1", edgeType: "dependency" as const, fromNodeId: "unknown", toNodeId: "node_1" },
    ],
    entryNodeIds: ["node_1"],
    terminalNodeIds: ["node_1"],
    joinStrategy: "all" as const,
    graphHash: "hash123",
  };

  const report = validatePlanGraph(graph);

  assert.equal(report.valid, false);
  assert.ok(report.findings.some((f) => f.includes("unknown")));
});

test("validatePlanGraph reports edge with unknown toNodeId", () => {
  const graph = {
    graphId: "graph_1",
    nodes: [
      { nodeId: "node_1", nodeType: "task" as const, status: "pending" as const, version: 1 },
    ],
    edges: [
      { edgeId: "edge_1", edgeType: "dependency" as const, fromNodeId: "node_1", toNodeId: "unknown" },
    ],
    entryNodeIds: ["node_1"],
    terminalNodeIds: ["unknown"],
    joinStrategy: "all" as const,
    graphHash: "hash123",
  };

  const report = validatePlanGraph(graph);

  assert.equal(report.valid, false);
  assert.ok(report.findings.some((f) => f.includes("unknown")));
});

test("validatePlanGraph reports orphaned nodes", () => {
  const graph = {
    graphId: "graph_1",
    nodes: [
      { nodeId: "node_1", nodeType: "task" as const, status: "pending" as const, version: 1 },
      { nodeId: "node_2", nodeType: "task" as const, status: "pending" as const, version: 1 },
    ],
    edges: [],
    entryNodeIds: ["node_1"],
    terminalNodeIds: ["node_2"],
    joinStrategy: "all" as const,
    graphHash: "hash123",
  };

  const report = validatePlanGraph(graph);

  assert.equal(report.valid, false);
  assert.ok(report.findings.some((f) => f.includes("not reachable")));
});

test("validatePlanGraph allows isolated cycle", () => {
  const graph = {
    graphId: "graph_1",
    nodes: [
      { nodeId: "node_1", nodeType: "task" as const, status: "pending" as const, version: 1 },
      { nodeId: "node_2", nodeType: "task" as const, status: "pending" as const, version: 1 },
    ],
    edges: [
      { edgeId: "edge_1", edgeType: "dependency" as const, fromNodeId: "node_1", toNodeId: "node_2" },
      { edgeId: "edge_2", edgeType: "dependency" as const, fromNodeId: "node_2", toNodeId: "node_1" },
    ],
    entryNodeIds: ["node_1"],
    terminalNodeIds: ["node_1"],
    joinStrategy: "all" as const,
    graphHash: "hash123",
  };

  const report = validatePlanGraph(graph);

  // Both nodes are reachable from entry node node_1
  assert.equal(report.valid, true);
});

// ============================================================================
// validatePlanGraphBundle Tests
// ============================================================================

test("validatePlanGraphBundle validates wrapped bundle", () => {
  const nodes: PlanNode[] = [
    {
      nodeId: "node_1",
      nodeType: "task",
      status: "pending",
      version: 1,
    },
  ];

  const edges: PlanEdge[] = [];

  const { bundle } = buildPlanGraphBundle({
    harnessRunId: "run_123",
    nodes,
    edges,
    entryNodeIds: ["node_1"],
    terminalNodeIds: ["node_1"],
  });

  const result = validatePlanGraphBundle(bundle);

  assert.equal(result.valid, true);
  assert.deepEqual(result.findings, []);
  assert.ok(result.normalizedNodeIds);
  assert.equal(result.normalizedNodeIds.length, 1);
});

test("validatePlanGraphBundle reports issues from wrapped graph", () => {
  // Create an invalid bundle by manually constructing one
  const bundle = {
    harnessRunId: "run_123",
    graph: {
      graphId: "graph_1",
      nodes: [
        { nodeId: "node_1", nodeType: "task" as const, status: "pending" as const, version: 1 },
      ],
      edges: [],
      entryNodeIds: ["nonexistent"],
      terminalNodeIds: [],
      joinStrategy: "all" as const,
      graphHash: "hash123",
    },
    schedulerPolicy: {
      policyId: "default",
      strategy: "deterministic_fifo" as const,
    },
    budgetPlanRef: "budget:default",
    riskProfile: { riskClass: "low" as const, reasons: [] },
    validationReport: { valid: false, findings: [], normalizedNodeIds: [] },
    planGraphBundleId: "bundle_1",
    graphVersion: 1,
  };

  const result = validatePlanGraphBundle(bundle);

  assert.equal(result.valid, false);
});

// ============================================================================
// HarnessSdk run management tests
// ============================================================================

test("HarnessSdk.checkpoint returns checkpoint ref string", () => {
  const sdk = new HarnessSdk();

  const run = {
    harnessRunId: newId("run"),
    createdAt: new Date().toISOString(),
    status: "active" as const,
    currentSeq: 1,
    tenantId: "tenant_abc",
    taskId: "task_123",
    domainId: "core",
    planGraphId: "pg_123",
    nodes: [],
    edges: [],
    timeline: [],
  };

  const checkpointRef = sdk.checkpoint(run);
  assert.equal(typeof checkpointRef, "string");
});

test("HarnessSdk.persist returns same run", () => {
  const sdk = new HarnessSdk();

  const run = {
    harnessRunId: newId("run"),
    createdAt: new Date().toISOString(),
    status: "active" as const,
    currentSeq: 1,
    tenantId: "tenant_abc",
    taskId: "task_123",
    domainId: "core",
    planGraphId: "pg_123",
    nodes: [],
    edges: [],
    timeline: [],
  };

  const persisted = sdk.persist(run);
  assert.equal(persisted.harnessRunId, run.harnessRunId);
});

test("HarnessSdk.restore returns null for non-existent run", () => {
  const sdk = new HarnessSdk();

  const restored = sdk.restore(newId("nonexistent"));
  assert.equal(restored, null);
});

test("HarnessSdk.restoreFromCheckpoint returns null for non-existent checkpoint", () => {
  const sdk = new HarnessSdk();

  const restored = sdk.restoreFromCheckpoint("checkpoint_nonexistent");
  assert.equal(restored, null);
});

test("HarnessSdk.requireRun throws for non-existent run via string", () => {
  const sdk = new HarnessSdk();

  assert.throws(
    () => sdk.resume(newId("nonexistent")),
    /run_not_found/i,
  );
});

test("HarnessSdk.getTimeline returns timeline array", () => {
  const sdk = new HarnessSdk();

  const run = {
    harnessRunId: newId("run"),
    createdAt: new Date().toISOString(),
    status: "active" as const,
    currentSeq: 1,
    tenantId: "tenant_abc",
    taskId: "task_123",
    domainId: "core",
    planGraphId: "pg_123",
    nodes: [],
    edges: [],
    timeline: [
      {
        eventId: "evt_1",
        runId: newId("run"),
        eventType: "harness.run.created",
        schemaVersion: 1,
        aggregateType: "HarnessRun",
        aggregateId: newId("run"),
        aggregateSeq: 1,
        tenantId: "tenant_abc",
        traceId: "trace_1",
        payloadHash: "hash1",
        payload: { status: "created" },
        replayBehavior: "replay_as_fact" as const,
        occurredAt: new Date().toISOString(),
      },
    ],
  };

  const timeline = sdk.getTimeline(run);
  assert.ok(Array.isArray(timeline));
  assert.equal(timeline.length, 1);
});

test("HarnessSdk.requestHumanReview creates run with open HITL review", () => {
  const sdk = new HarnessSdk();

  const run = {
    harnessRunId: newId("run"),
    createdAt: new Date().toISOString(),
    status: "active" as const,
    currentSeq: 1,
    tenantId: "tenant_abc",
    taskId: "task_123",
    domainId: "core",
    planGraphId: "pg_123",
    nodes: [],
    edges: [],
    timeline: [],
  };

  const updatedRun = sdk.requestHumanReview(run, "Needs approval", ["ref1", "ref2"]);
  assert.ok(updatedRun, "Should return updated run");
});

test("HarnessSdk.resolveReview creates run with resolved HITL review", () => {
  const sdk = new HarnessSdk();

  const run = {
    harnessRunId: newId("run"),
    createdAt: new Date().toISOString(),
    status: "active" as const,
    currentSeq: 1,
    tenantId: "tenant_abc",
    taskId: "task_123",
    domainId: "core",
    planGraphId: "pg_123",
    nodes: [],
    edges: [],
    timeline: [],
  };

  const updatedRun = sdk.resolveReview(run, "approved", "user_456");
  assert.ok(updatedRun, "Should return updated run");
});

test("HarnessSdk.sleep creates run with sleep state", () => {
  const sdk = new HarnessSdk();

  const run = {
    harnessRunId: newId("run"),
    createdAt: new Date().toISOString(),
    status: "active" as const,
    currentSeq: 1,
    tenantId: "tenant_abc",
    taskId: "task_123",
    domainId: "core",
    planGraphId: "pg_123",
    nodes: [],
    edges: [],
    timeline: [],
  };

  const resumeAt = new Date(Date.now() + 60000).toISOString();
  const updatedRun = sdk.sleep(run, "Waiting for resource", resumeAt);
  assert.ok(updatedRun, "Should return updated run");
});

test("HarnessSdk.resume wakes sleeping run", () => {
  const sdk = new HarnessSdk();

  const run = {
    harnessRunId: newId("run"),
    createdAt: new Date().toISOString(),
    status: "active" as const,
    currentSeq: 1,
    tenantId: "tenant_abc",
    taskId: "task_123",
    domainId: "core",
    planGraphId: "pg_123",
    nodes: [],
    edges: [],
    timeline: [],
  };

  const resumed = sdk.resume(run);
  assert.ok(resumed, "Should return updated run");
});

test("HarnessSdk.assertInvariants does not throw for valid run", () => {
  const sdk = new HarnessSdk();

  const run = {
    harnessRunId: newId("run"),
    createdAt: new Date().toISOString(),
    status: "active" as const,
    currentSeq: 1,
    tenantId: "tenant_abc",
    taskId: "task_123",
    domainId: "core",
    planGraphId: "pg_123",
    nodes: [],
    edges: [],
    timeline: [],
  };

  assert.doesNotThrow(() => sdk.assertInvariants(run));
});