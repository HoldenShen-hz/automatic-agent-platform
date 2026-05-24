import assert from "node:assert/strict";
import test from "node:test";

import {
  createGraphPatch,
  createPlanGraphBundle,
  type ArtifactRef,
  type GraphPatch,
  type PlanGraph,
  type PlanGraphBundle,
} from "../../../../../src/platform/contracts/executable-contracts/index.js";

function createGraph(graphId: string): PlanGraph {
  return {
    graphId,
    nodes: [
      {
        nodeId: "node-1",
        nodeType: "tool",
        inputRefs: [],
        outputSchemaRef: "schema:tool",
        riskClass: "low",
        budgetIntent: { amount: 100, currency: "USD", resourceKinds: ["token"] },
        sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
        retryPolicyRef: "retry:default",
        timeoutMs: 30_000,
      },
      {
        nodeId: "node-2",
        nodeType: "llm",
        inputRefs: ["node-1"],
        outputSchemaRef: "schema:llm",
        riskClass: "medium",
        budgetIntent: { amount: 200, currency: "USD", resourceKinds: ["token"] },
        sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
        retryPolicyRef: "retry:default",
        timeoutMs: 60_000,
      },
    ],
    edges: [{
      edgeId: "edge-1",
      fromNodeId: "node-1",
      toNodeId: "node-2",
      condition: true,
      dependencyType: "hard",
    }],
    entryNodeIds: ["node-1"],
    terminalNodeIds: ["node-2"],
    joinStrategy: "all",
    graphHash: `hash:${graphId}`,
  };
}

function createArtifactRefs(): ArtifactRef[] {
  return [
    { artifactId: "artifact-1", uri: "s3://bucket/artifact-1.json" },
    { artifactId: "artifact-2", uri: "s3://bucket/artifact-2.json" },
  ];
}

function createBundle(overrides: Partial<Parameters<typeof createPlanGraphBundle>[0]> = {}): PlanGraphBundle {
  return createPlanGraphBundle({
    harnessRunId: "harness-run-1",
    graph: createGraph("graph-1"),
    schedulerPolicy: {
      policyId: "scheduler:fifo",
      strategy: "deterministic_fifo",
    },
    budgetPlanRef: "budget:1",
    riskProfile: {
      riskClass: "medium",
      reasons: ["contains_llm_node"],
    },
    validationReport: {
      valid: true,
      findings: [],
      normalizedNodeIds: ["node-1", "node-2"],
    },
    artifactRefs: createArtifactRefs(),
    ...overrides,
  });
}

test("createPlanGraphBundle round-trips through JSON", () => {
  const bundle = createBundle();
  const parsed = JSON.parse(JSON.stringify(bundle)) as PlanGraphBundle;

  assert.equal(parsed.planGraphBundleId, bundle.planGraphBundleId);
  assert.equal(parsed.graph.nodes.length, 2);
  assert.equal(parsed.graph.edges[0]?.dependencyType, "hard");
  assert.deepEqual(parsed.graph.entryNodeIds, ["node-1"]);
  assert.deepEqual(parsed.graph.terminalNodeIds, ["node-2"]);
});

test("createPlanGraphBundle requires at least one node", () => {
  assert.throws(
    () =>
      createBundle({
        graph: {
          graphId: "graph-empty",
          nodes: [],
          edges: [],
          entryNodeIds: [],
          terminalNodeIds: [],
          joinStrategy: "all",
          graphHash: "hash:empty",
        },
      }),
    /nodes_required/,
  );
});

test("createGraphPatch enforces version advancement and operations", () => {
  const patch = createGraphPatch({
    harnessRunId: "harness-run-1",
    baseGraphVersion: 1,
    newGraphVersion: 2,
    operations: [{
      operationId: "op-1",
      operationType: "add_node",
      targetRef: "node-3",
      payload: { nodeType: "tool" },
    }],
    policyProofRef: { artifactId: "proof-1", uri: "s3://bucket/proof.json" },
    auditRef: { artifactId: "audit-1", uri: "s3://bucket/audit.json" },
  });

  assert.equal(patch.newGraphVersion, 2);
  assert.equal(patch.operations[0]?.operationType, "add_node");
  assert.throws(
    () =>
      createGraphPatch({
        harnessRunId: "harness-run-1",
        baseGraphVersion: 2,
        newGraphVersion: 2,
        operations: patch.operations,
        policyProofRef: { artifactId: "proof-1", uri: "s3://bucket/proof.json" },
        auditRef: { artifactId: "audit-1", uri: "s3://bucket/audit.json" },
      }),
    /version_must_advance/,
  );
});

test("safe_append patches cannot touch executed nodes", () => {
  assert.throws(
    () =>
      createGraphPatch({
        harnessRunId: "harness-run-1",
        baseGraphVersion: 1,
        newGraphVersion: 2,
        operations: [{
          operationId: "op-skip",
          operationType: "mark_skipped",
          targetRef: "node-1",
          payload: {},
        }],
        affectedExecutedNodes: ["node-1"],
        compatibilityClass: "safe_append",
        policyProofRef: { artifactId: "proof-1", uri: "s3://bucket/proof.json" },
        auditRef: { artifactId: "audit-1", uri: "s3://bucket/audit.json" },
      }),
    /safe_append/,
  );
});

test("GraphPatch compatibility classes serialize cleanly", () => {
  const compatibilityClasses: GraphPatch["compatibilityClass"][] = [
    "safe_append",
    "requires_checkpoint_revalidation",
    "requires_human_approval",
    "incompatible_restart_required",
  ];

  for (const compatibilityClass of compatibilityClasses) {
    const patch = createGraphPatch({
      harnessRunId: "harness-run-1",
      baseGraphVersion: 1,
      newGraphVersion: 2,
      operations: [{
        operationId: `op-${compatibilityClass}`,
        operationType: "add_node",
        targetRef: "node-3",
        payload: {},
      }],
      compatibilityClass,
      policyProofRef: { artifactId: "proof-1", uri: "s3://bucket/proof.json" },
      auditRef: { artifactId: "audit-1", uri: "s3://bucket/audit.json" },
    });

    const parsed = JSON.parse(JSON.stringify(patch)) as GraphPatch;
    assert.equal(parsed.compatibilityClass, compatibilityClass);
  }
});
