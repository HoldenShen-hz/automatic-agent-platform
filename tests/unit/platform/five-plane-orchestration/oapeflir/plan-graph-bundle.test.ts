import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createPlanGraphBundle,
  createGraphPatch,
  type PlanGraphBundle,
  type PlanGraph,
  type PlanNode,
  type PlanEdge,
  type GraphPatch,
  type GraphValidationReport,
  type ReadyNodeSchedulingPolicy,
  type RiskPreview,
  type ArtifactRef,
} from "/Users/holden/Project/automatic_agent/automatic_agent_platform/dist/src/platform/contracts/executable-contracts/index.js";

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function makeMinimalPlanGraph(graphId: string): PlanGraph {
  return {
    graphId,
    nodes: [
      {
        nodeId: "node_1",
        nodeType: "tool",
        inputRefs: [],
        outputSchemaRef: "schema_1",
        riskClass: "low",
        budgetIntent: { amount: 100, currency: "usd", resourceKinds: ["token"] },
        sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
        retryPolicyRef: "retry_default",
        timeoutMs: 30000,
      },
      {
        nodeId: "node_2",
        nodeType: "llm",
        inputRefs: ["node_1"],
        outputSchemaRef: "schema_2",
        riskClass: "medium",
        budgetIntent: { amount: 200, currency: "usd", resourceKinds: ["token"] },
        sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
        retryPolicyRef: "retry_default",
        timeoutMs: 60000,
      },
    ],
    edges: [
      {
        edgeId: "edge_1",
        fromNodeId: "node_1",
        toNodeId: "node_2",
        condition: true,
        dependencyType: "hard",
      },
    ],
    entryNodeIds: ["node_1"],
    terminalNodeIds: ["node_2"],
    joinStrategy: "all",
    graphHash: "hash_" + graphId,
  };
}

function makeSchedulerPolicy(): ReadyNodeSchedulingPolicy {
  return {
    policyId: "policy_fifo",
    strategy: "deterministic_fifo",
  };
}

function makeRiskProfile(): RiskPreview {
  return {
    riskClass: "medium",
    reasons: ["contains_llm_node"],
  };
}

function makeValidationReport(): GraphValidationReport {
  return {
    valid: true,
    findings: [],
    normalizedNodeIds: ["node_1", "node_2"],
  };
}

function makeArtifactRefs(): ArtifactRef[] {
  return [
    { artifactId: "art_1", uri: "s3://bucket/art_1.json" },
    { artifactId: "art_2", uri: "s3://bucket/art_2.json" },
  ];
}

function createTestBundle(overrides?: Partial<Parameters<typeof createPlanGraphBundle>[0]>): PlanGraphBundle {
  return createPlanGraphBundle({
    harnessRunId: "hrun_test_" + Math.random().toString(36).slice(2),
    graph: makeMinimalPlanGraph("graph_" + Math.random().toString(36).slice(2)),
    schedulerPolicy: makeSchedulerPolicy(),
    budgetPlanRef: "budget_ref_test",
    riskProfile: makeRiskProfile(),
    validationReport: makeValidationReport(),
    artifactRefs: makeArtifactRefs(),
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Test: PlanGraphBundle can be serialized to JSON and back
// ---------------------------------------------------------------------------

test("serialization: PlanGraphBundle can be serialized to JSON and back", () => {
  const bundle = createTestBundle();

  // Serialize to JSON
  const json = JSON.stringify(bundle);
  assert.ok(typeof json === "string", "JSON serialization should return a string");
  assert.ok(json.length > 0, "JSON should not be empty");

  // Deserialize from JSON
  const parsed = JSON.parse(json) as PlanGraphBundle;

  // Verify all fields survive round-trip
  assert.equal(parsed.planGraphBundleId, bundle.planGraphBundleId, "planGraphBundleId should match");
  assert.equal(parsed.harnessRunId, bundle.harnessRunId, "harnessRunId should match");
  assert.equal(parsed.graphVersion, bundle.graphVersion, "graphVersion should match");
  assert.equal(parsed.budgetPlanRef, bundle.budgetPlanRef, "budgetPlanRef should match");
  assert.equal(parsed.createdAt, bundle.createdAt, "createdAt should match");

  // Verify nested objects
  assert.equal(parsed.graph.graphId, bundle.graph.graphId, "graph.graphId should match");
  assert.equal(parsed.schedulerPolicy.policyId, bundle.schedulerPolicy.policyId, "schedulerPolicy.policyId should match");
  assert.equal(parsed.riskProfile.riskClass, bundle.riskProfile.riskClass, "riskProfile.riskClass should match");
  assert.equal(parsed.validationReport.valid, bundle.validationReport.valid, "validationReport.valid should match");
});

test("serialization: PlanGraph can be serialized and deserialized independently", () => {
  const graph = makeMinimalPlanGraph("graph_independent");

  const json = JSON.stringify(graph);
  const parsed = JSON.parse(json) as PlanGraph;

  assert.equal(parsed.graphId, graph.graphId);
  assert.equal(parsed.nodes.length, graph.nodes.length);
  assert.equal(parsed.edges.length, graph.edges.length);
  assert.equal(parsed.entryNodeIds.length, graph.entryNodeIds.length);
  assert.equal(parsed.terminalNodeIds.length, graph.terminalNodeIds.length);
  assert.equal(parsed.joinStrategy, graph.joinStrategy);
  assert.equal(parsed.graphHash, graph.graphHash);
});

test("serialization: nested arrays in PlanGraphBundle survive round-trip", () => {
  const bundle = createTestBundle();

  const json = JSON.stringify(bundle);
  const parsed = JSON.parse(json) as PlanGraphBundle;

  // Verify nodes array
  assert.equal(parsed.graph.nodes.length, bundle.graph.nodes.length);
  for (let i = 0; i < bundle.graph.nodes.length; i++) {
    assert.equal(parsed.graph.nodes[i].nodeId, bundle.graph.nodes[i].nodeId);
    assert.equal(parsed.graph.nodes[i].nodeType, bundle.graph.nodes[i].nodeType);
  }

  // Verify edges array
  assert.equal(parsed.graph.edges.length, bundle.graph.edges.length);
  assert.equal(parsed.graph.edges[0].edgeId, bundle.graph.edges[0].edgeId);

  // Verify artifactRefs array
  assert.equal(parsed.artifactRefs.length, bundle.artifactRefs.length);
  assert.equal(parsed.artifactRefs[0].artifactId, bundle.artifactRefs[0].artifactId);

  // Verify entryNodeIds and terminalNodeIds
  assert.deepStrictEqual(parsed.graph.entryNodeIds, bundle.graph.entryNodeIds);
  assert.deepStrictEqual(parsed.graph.terminalNodeIds, bundle.graph.terminalNodeIds);
});

// ---------------------------------------------------------------------------
// Test: PlanGraphBundle.planGraph contains correct nodes and edges
// ---------------------------------------------------------------------------

test("planGraph: contains correct nodes with proper structure", () => {
  const bundle = createTestBundle();

  const nodes = bundle.graph.nodes;
  assert.ok(Array.isArray(nodes), "nodes should be an array");
  assert.ok(nodes.length >= 1, "nodes should have at least one node");

  const firstNode = nodes[0];
  assert.ok(firstNode.nodeId.length > 0, "nodeId should not be empty");
  assert.ok(
    ["tool", "llm", "hitl_wait", "subgraph", "evaluator", "router", "compensation"].includes(firstNode.nodeType),
    "nodeType should be valid"
  );
  assert.ok(Array.isArray(firstNode.inputRefs), "inputRefs should be an array");
  assert.ok(firstNode.outputSchemaRef.length > 0, "outputSchemaRef should not be empty");
  assert.ok(
    ["low", "medium", "high", "critical"].includes(firstNode.riskClass),
    "riskClass should be valid"
  );
  assert.ok(firstNode.budgetIntent.amount >= 0, "budgetIntent.amount should be non-negative");
  assert.ok(firstNode.sideEffectProfile !== undefined, "sideEffectProfile should exist");
  assert.ok(firstNode.retryPolicyRef.length > 0, "retryPolicyRef should not be empty");
  assert.ok(firstNode.timeoutMs > 0, "timeoutMs should be positive");
});

test("planGraph: contains correct edges with proper structure", () => {
  const bundle = createTestBundle();

  const edges = bundle.graph.edges;
  assert.ok(Array.isArray(edges), "edges should be an array");

  if (edges.length > 0) {
    const firstEdge = edges[0];
    assert.ok(firstEdge.edgeId.length > 0, "edgeId should not be empty");
    assert.ok(firstEdge.fromNodeId.length > 0, "fromNodeId should not be empty");
    assert.ok(firstEdge.toNodeId.length > 0, "toNodeId should not be empty");
    assert.ok(firstEdge.condition !== undefined, "condition should exist");
    assert.ok(
      ["hard", "soft", "compensation", "retry", "replan"].includes(firstEdge.dependencyType),
      "dependencyType should be valid"
    );
  }
});

test("planGraph: entryNodeIds and terminalNodeIds reference actual nodes", () => {
  const bundle = createTestBundle();

  const nodeIds = new Set(bundle.graph.nodes.map((n) => n.nodeId));

  for (const entryId of bundle.graph.entryNodeIds) {
    assert.ok(nodeIds.has(entryId), `entryNodeId ${entryId} should reference an existing node`);
  }

  for (const terminalId of bundle.graph.terminalNodeIds) {
    assert.ok(nodeIds.has(terminalId), `terminalNodeId ${terminalId} should reference an existing node`);
  }
});

test("planGraph: joinStrategy is one of the valid values", () => {
  const bundle = createTestBundle();

  assert.ok(
    ["all", "any", "first_success", "policy"].includes(bundle.graph.joinStrategy),
    "joinStrategy should be a valid value"
  );
});

// ---------------------------------------------------------------------------
// Test: PlanGraphBundle.planGraphBundleId is unique for each bundle
// ---------------------------------------------------------------------------

test("unique ID: each createTestBundle call produces a unique planGraphBundleId", () => {
  const bundle1 = createTestBundle();
  const bundle2 = createTestBundle();
  const bundle3 = createTestBundle();

  assert.notEqual(bundle1.planGraphBundleId, bundle2.planGraphBundleId, "bundle IDs should be unique");
  assert.notEqual(bundle2.planGraphBundleId, bundle3.planGraphBundleId, "bundle IDs should be unique");
  assert.notEqual(bundle1.planGraphBundleId, bundle3.planGraphBundleId, "bundle IDs should be unique");
});

test("unique ID: planGraphBundleId format follows expected pattern", () => {
  const bundle = createTestBundle();

  assert.ok(bundle.planGraphBundleId.startsWith("pgb_"), "planGraphBundleId should start with pgb_ prefix");
  assert.ok(bundle.planGraphBundleId.length > 10, "planGraphBundleId should have reasonable length");
});

test("unique ID: harnessRunId can be shared but planGraphBundleId is always unique", () => {
  // Create multiple bundles with same harnessRunId but different graphIds
  const harnessRunId = "hrun_shared";

  const bundle1 = createTestBundle({ harnessRunId });
  const bundle2 = createTestBundle({ harnessRunId });
  const bundle3 = createTestBundle({ harnessRunId });

  // harnessRunId can be the same
  assert.equal(bundle1.harnessRunId, bundle2.harnessRunId);
  assert.equal(bundle2.harnessRunId, bundle3.harnessRunId);

  // But planGraphBundleId must be unique
  assert.notEqual(bundle1.planGraphBundleId, bundle2.planGraphBundleId);
  assert.notEqual(bundle2.planGraphBundleId, bundle3.planGraphBundleId);
  assert.notEqual(bundle1.planGraphBundleId, bundle3.planGraphBundleId);
});

// ---------------------------------------------------------------------------
// Test: GraphPatch can be applied to modify bundle state
// ---------------------------------------------------------------------------

test("GraphPatch: can be created and serialized", () => {
  const patch: GraphPatch = createGraphPatch({
    harnessRunId: "hrun_patch_test",
    baseGraphVersion: 1,
    newGraphVersion: 2,
    operations: [
      {
        operationId: "op_1",
        operationType: "add_node",
        targetRef: "new_node_id",
        payload: { nodeType: "tool" },
      },
      {
        operationId: "op_2",
        operationType: "add_edge",
        targetRef: "new_edge_id",
        payload: { fromNodeId: "node_1", toNodeId: "new_node_id" },
      },
    ],
    affectedExecutedNodes: [],
    affectedSideEffects: [],
    compatibilityClass: "safe_append",
    policyProofRef: { artifactId: "proof_1", uri: "s3://bucket/proof.json" },
    auditRef: { artifactId: "audit_1", uri: "s3://bucket/audit.json" },
  });

  assert.ok(patch.graphPatchId.startsWith("gpatch_"), "graphPatchId should start with gpatch_");
  assert.equal(patch.baseGraphVersion, 1);
  assert.equal(patch.newGraphVersion, 2);
  assert.equal(patch.operations.length, 2);

  // Serialize and deserialize
  const json = JSON.stringify(patch);
  const parsed = JSON.parse(json) as GraphPatch;

  assert.equal(parsed.graphPatchId, patch.graphPatchId);
  assert.equal(parsed.baseGraphVersion, patch.baseGraphVersion);
  assert.equal(parsed.newGraphVersion, patch.newGraphVersion);
  assert.equal(parsed.operations.length, patch.operations.length);
});

test("GraphPatch: newGraphVersion must be greater than baseGraphVersion", () => {
  assert.throws(
    () =>
      createGraphPatch({
        harnessRunId: "hrun_invalid",
        baseGraphVersion: 3,
        newGraphVersion: 2,
        operations: [
          {
            operationId: "op_invalid",
            operationType: "add_node",
            targetRef: "node_x",
            payload: {},
          },
        ],
        policyProofRef: { artifactId: "proof", uri: "s3://bucket/proof.json" },
        auditRef: { artifactId: "audit", uri: "s3://bucket/audit.json" },
      }),
    /advance/
  );
});

test("GraphPatch: requires at least one operation", () => {
  assert.throws(
    () =>
      createGraphPatch({
        harnessRunId: "hrun_no_ops",
        baseGraphVersion: 1,
        newGraphVersion: 2,
        operations: [],
        policyProofRef: { artifactId: "proof", uri: "s3://bucket/proof.json" },
        auditRef: { artifactId: "audit", uri: "s3://bucket/audit.json" },
      }),
    /operation/
  );
});

test("GraphPatch: all operation types are representable in JSON", () => {
  const operationTypes = [
    "add_node",
    "add_edge",
    "disable_edge",
    "add_compensation_node",
    "add_failure_path",
    "mark_skipped",
    "append_subgraph",
  ] as const;

  for (const operationType of operationTypes) {
    const patch = createGraphPatch({
      harnessRunId: "hrun_op_test",
      baseGraphVersion: 1,
      newGraphVersion: 2,
      operations: [
        {
          operationId: `op_${operationType}`,
          operationType,
          targetRef: "target_1",
          payload: { test: true },
        },
      ],
      policyProofRef: { artifactId: "proof", uri: "s3://bucket/proof.json" },
      auditRef: { artifactId: "audit", uri: "s3://bucket/audit.json" },
    });

    const json = JSON.stringify(patch);
    const parsed = JSON.parse(json) as GraphPatch;

    assert.equal(parsed.operations[0].operationType, operationType);
  }
});

test("GraphPatch: safe_append cannot affect executed nodes", () => {
  assert.throws(
    () =>
      createGraphPatch({
        harnessRunId: "hrun_executed",
        baseGraphVersion: 1,
        newGraphVersion: 2,
        operations: [
          {
            operationId: "op_skip_executed",
            operationType: "mark_skipped",
            targetRef: "executed_node_1",
            payload: {},
          },
        ],
        affectedExecutedNodes: ["executed_node_1"],
        affectedSideEffects: [],
        compatibilityClass: "safe_append",
        policyProofRef: { artifactId: "proof", uri: "s3://bucket/proof.json" },
        auditRef: { artifactId: "audit", uri: "s3://bucket/audit.json" },
      }),
    /safe_append|cannot.*executed/
  );
});

test("GraphPatch: safe_append cannot affect side effects without compensation plan", () => {
  assert.throws(
    () =>
      createGraphPatch({
        harnessRunId: "hrun_side_effect",
        baseGraphVersion: 1,
        newGraphVersion: 2,
        operations: [
          {
            operationId: "op_affect_se",
            operationType: "add_node",
            targetRef: "new_node",
            payload: {},
          },
        ],
        affectedExecutedNodes: [],
        affectedSideEffects: ["side_effect_1"],
        compatibilityClass: "safe_append",
        policyProofRef: { artifactId: "proof", uri: "s3://bucket/proof.json" },
        auditRef: { artifactId: "audit", uri: "s3://bucket/audit.json" },
      }),
    /compensation|side.effect/
  );
});

test("GraphPatch: compatibilityClass values are all representable", () => {
  const classes: GraphPatch["compatibilityClass"][] = [
    "safe_append",
    "requires_checkpoint_revalidation",
    "requires_human_approval",
    "incompatible_restart_required",
  ];

  for (const cls of classes) {
    const patch = createGraphPatch({
      harnessRunId: "hrun_compat",
      baseGraphVersion: 1,
      newGraphVersion: 2,
      operations: [
        {
          operationId: "op_compat",
          operationType: "add_node",
          targetRef: "new_node",
          payload: {},
        },
      ],
      compatibilityClass: cls,
      policyProofRef: { artifactId: "proof", uri: "s3://bucket/proof.json" },
      auditRef: { artifactId: "audit", uri: "s3://bucket/audit.json" },
    });

    assert.equal(patch.compatibilityClass, cls);

    const json = JSON.stringify(patch);
    const parsed = JSON.parse(json) as GraphPatch;
    assert.equal(parsed.compatibilityClass, cls);
  }
});

// ---------------------------------------------------------------------------
// Test: Bundle validates integrity of graph structure
// ---------------------------------------------------------------------------

test("validation: createPlanGraphBundle requires at least one node", () => {
  assert.throws(
    () =>
      createPlanGraphBundle({
        harnessRunId: "hrun_empty",
        graph: {
          graphId: "graph_empty",
          nodes: [],
          edges: [],
          entryNodeIds: [],
          terminalNodeIds: [],
          joinStrategy: "all",
          graphHash: "hash_empty",
        },
        schedulerPolicy: makeSchedulerPolicy(),
        budgetPlanRef: "budget_ref",
        riskProfile: makeRiskProfile(),
      }),
    /node/
  );
});

test("validation: PlanGraphBundle with valid graph passes validation", () => {
  const bundle = createTestBundle();

  assert.ok(bundle.validationReport.valid, "bundle with valid graph should pass validation");
  assert.ok(Array.isArray(bundle.validationReport.findings), "findings should be an array");
});

test("validation: GraphValidationReport structure is correct", () => {
  const bundle = createTestBundle();

  assert.equal(typeof bundle.validationReport.valid, "boolean");
  assert.ok(Array.isArray(bundle.validationReport.findings));

  if (bundle.validationReport.normalizedNodeIds) {
    assert.ok(Array.isArray(bundle.validationReport.normalizedNodeIds));
  }
});

test("validation: planId is accessible and well-formed in bundle", () => {
  const bundle = createTestBundle();

  // planGraphBundleId serves as the unique plan identifier
  assert.ok(bundle.planGraphBundleId.length > 0, "planGraphBundleId should not be empty");
  assert.ok(bundle.planGraphBundleId.includes("_"), "planGraphBundleId should have semantic prefix");
});

test("validation: graphVersion starts at 1 and increments properly", () => {
  const bundle1 = createTestBundle({ graphVersion: undefined });
  assert.equal(bundle1.graphVersion, 1, "default graphVersion should be 1");

  const bundle2 = createTestBundle({ graphVersion: 5 });
  assert.equal(bundle2.graphVersion, 5, "graphVersion should accept custom value");
});

test("validation: budgetPlanRef is preserved in serialization", () => {
  const bundle = createTestBundle({ budgetPlanRef: "custom_budget_ref_12345" });

  const json = JSON.stringify(bundle);
  const parsed = JSON.parse(json) as PlanGraphBundle;

  assert.equal(parsed.budgetPlanRef, "custom_budget_ref_12345");
});

test("validation: schedulerPolicy is fully preserved", () => {
  const customPolicy: ReadyNodeSchedulingPolicy = {
    policyId: "custom_policy",
    strategy: "risk_isolated",
  };

  const bundle = createTestBundle({ schedulerPolicy: customPolicy });

  const json = JSON.stringify(bundle);
  const parsed = JSON.parse(json) as PlanGraphBundle;

  assert.equal(parsed.schedulerPolicy.policyId, "custom_policy");
  assert.equal(parsed.schedulerPolicy.strategy, "risk_isolated");
});

test("validation: riskProfile reasons array is preserved", () => {
  const customRisk: RiskPreview = {
    riskClass: "high",
    reasons: ["contains_external_api", "modifies_state", "user_confirmed"],
  };

  const bundle = createTestBundle({ riskProfile: customRisk });

  const json = JSON.stringify(bundle);
  const parsed = JSON.parse(json) as PlanGraphBundle;

  assert.equal(parsed.riskProfile.riskClass, "high");
  assert.deepStrictEqual(parsed.riskProfile.reasons, [
    "contains_external_api",
    "modifies_state",
    "user_confirmed",
  ]);
});

test("validation: artifactRefs array with optional fields survives round-trip", () => {
  const customArtifacts: ArtifactRef[] = [
    { artifactId: "art_with_all", uri: "s3://bucket/art.json", hash: "sha256_hash", version: "v1.0.0" },
    { artifactId: "art_minimal", uri: "s3://bucket/art2.json" },
  ];

  const bundle = createTestBundle({ artifactRefs: customArtifacts });

  const json = JSON.stringify(bundle);
  const parsed = JSON.parse(json) as PlanGraphBundle;

  assert.equal(parsed.artifactRefs.length, 2);
  assert.equal(parsed.artifactRefs[0].hash, "sha256_hash");
  assert.equal(parsed.artifactRefs[0].version, "v1.0.0");
  assert.strictEqual(parsed.artifactRefs[1].hash, undefined);
  assert.strictEqual(parsed.artifactRefs[1].version, undefined);
});

test("validation: createdAt timestamp is ISO 8601 format", () => {
  const bundle = createTestBundle();

  // Verify ISO 8601 format by checking it parses correctly
  const parsedDate = new Date(bundle.createdAt);
  assert.ok(!isNaN(parsedDate.getTime()), "createdAt should be valid ISO 8601 date string");

  // Verify it contains expected components
  assert.ok(bundle.createdAt.includes("T"), "ISO 8601 format should contain T separator");
  assert.ok(bundle.createdAt.endsWith("Z"), "ISO 8601 format should end with Z for UTC");
});

test("validation: graphHash is present and non-empty", () => {
  const bundle = createTestBundle();

  assert.ok(bundle.graph.graphHash.length > 0, "graphHash should not be empty");
  assert.ok(bundle.graph.graphHash.startsWith("hash_"), "graphHash should have expected prefix");
});
