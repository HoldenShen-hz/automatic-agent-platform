import assert from "node:assert/strict";
import test from "node:test";

import {
  // Legacy types (deprecated - should throw on creation)
  type ExecutionPlan,
  type ExecutionPlanStep,
  createExecutionPlan,
  // Re-exported canonical types
  type PlanGraphBundle,
  type PlanGraph,
  type PlanNode,
  type PlanEdge,
  type GraphValidationReport,
  type GraphRiskFinding,
  type GraphWorstPathAnalysis,
  type GraphPatch,
  type GraphPatchOperation,
  type ReadyNodeSchedulingPolicy,
  createPlanGraphBundle,
  createGraphPatch,
} from "../../../../src/platform/contracts/execution-plan/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

// =============================================================================
// Re-export Verification Tests
// =============================================================================

test("execution-plan: re-exports PlanGraphBundle type", () => {
  // PlanGraphBundle should be re-exported and usable
  const bundle: PlanGraphBundle = {
    planGraphBundleId: "pgb_123",
    harnessRunId: "hrun_456",
    graphVersion: 1,
    graph: {
      graphId: "graph_1",
      nodes: [],
      edges: [],
      entryNodeIds: [],
      terminalNodeIds: [],
      joinStrategy: "all",
      graphHash: "hash123",
    },
    schedulerPolicy: {
      policyId: "policy_1",
      strategy: "deterministic_fifo",
    },
    budgetPlanRef: "budget_ref",
    riskProfile: {
      riskClass: "low",
      reasons: [],
    },
    validationReport: {
      valid: true,
      findings: [],
    },
    artifactRefs: [],
    createdAt: "2026-05-01T00:00:00.000Z",
  };

  assert.equal(bundle.planGraphBundleId, "pgb_123");
  assert.equal(bundle.graphVersion, 1);
});

test("execution-plan: re-exports createPlanGraphBundle factory", () => {
  const bundle = createPlanGraphBundle({
    harnessRunId: "hrun_test",
    graph: {
      graphId: "graph_test",
      nodes: [
        {
          nodeId: "node_1",
          nodeType: "tool",
          inputRefs: [],
          outputSchemaRef: "schema_1",
          riskClass: "low",
          budgetIntent: {
            amount: 100,
            currency: "USD",
            resourceKinds: ["token"],
          },
          sideEffectProfile: {
            mayCommitExternalEffect: false,
            reversible: false,
          },
          retryPolicyRef: "retry_1",
          timeoutMs: 30000,
        },
      ],
      edges: [],
      entryNodeIds: ["node_1"],
      terminalNodeIds: ["node_1"],
      joinStrategy: "all",
      graphHash: "hash_test",
    },
    schedulerPolicy: {
      policyId: "policy_test",
      strategy: "priority_then_fifo",
    },
    budgetPlanRef: "budget_ref_test",
    riskProfile: {
      riskClass: "low",
      reasons: ["test"],
    },
  });

  assert.ok(bundle.planGraphBundleId.startsWith("pgb_"));
  assert.equal(bundle.harnessRunId, "hrun_test");
  assert.equal(bundle.graph.nodes.length, 1);
});

test("execution-plan: createPlanGraphBundle throws when graph has no nodes", () => {
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
        schedulerPolicy: {
          policyId: "policy_empty",
          strategy: "deterministic_fifo",
        },
        budgetPlanRef: "budget_empty",
        riskProfile: {
          riskClass: "low",
          reasons: [],
        },
      }),
    ValidationError,
  );
});

test("execution-plan: re-exports createGraphPatch factory", () => {
  const patch = createGraphPatch({
    harnessRunId: "hrun_patch",
    baseGraphVersion: 1,
    newGraphVersion: 2,
    operations: [
      {
        operationId: "op_1",
        operationType: "add_node",
        targetRef: "node_new",
        payload: {},
      },
    ],
    policyProofRef: {
      artifactId: "art_policy",
      uri: "artifact://art_policy",
    },
    auditRef: {
      artifactId: "art_audit",
      uri: "artifact://art_audit",
    },
  });

  assert.ok(patch.graphPatchId.startsWith("gpatch_"));
  assert.equal(patch.baseGraphVersion, 1);
  assert.equal(patch.newGraphVersion, 2);
});

test("execution-plan: createGraphPatch throws when version does not advance", () => {
  assert.throws(
    () =>
      createGraphPatch({
        harnessRunId: "hrun_same",
        baseGraphVersion: 2,
        newGraphVersion: 2,
        operations: [
          {
            operationId: "op_same",
            operationType: "add_node",
            targetRef: "node_same",
            payload: {},
          },
        ],
        policyProofRef: {
          artifactId: "art_policy",
          uri: "artifact://art_policy",
        },
        auditRef: {
          artifactId: "art_audit",
          uri: "artifact://art_audit",
        },
      }),
    ValidationError,
  );
});

test("execution-plan: createGraphPatch throws when operations is empty", () => {
  assert.throws(
    () =>
      createGraphPatch({
        harnessRunId: "hrun_no_ops",
        baseGraphVersion: 1,
        newGraphVersion: 2,
        operations: [],
        policyProofRef: {
          artifactId: "art_policy",
          uri: "artifact://art_policy",
        },
        auditRef: {
          artifactId: "art_audit",
          uri: "artifact://art_audit",
        },
      }),
    ValidationError,
  );
});

// =============================================================================
// Legacy Type Tests (Deprecated)
// =============================================================================

test("execution-plan: ExecutionPlanStep has correct shape", () => {
  // Verify the deprecated type structure is still accessible
  const step: ExecutionPlanStep = {
    stepId: "step_1",
    title: "Test Step",
    actionRef: "action_1",
    dependsOn: [],
    requiresApproval: false,
  };

  assert.equal(step.stepId, "step_1");
  assert.equal(step.title, "Test Step");
  assert.deepEqual(step.dependsOn, []);
  assert.equal(step.requiresApproval, false);
});

test("execution-plan: ExecutionPlan has correct shape", () => {
  const plan: ExecutionPlan = {
    planId: "plan_1",
    taskId: "task_1",
    tenantId: "tenant_1",
    version: 1,
    steps: [],
    createdAt: "2026-05-01T00:00:00.000Z",
  };

  assert.equal(plan.planId, "plan_1");
  assert.equal(plan.taskId, "task_1");
  assert.equal(plan.version, 1);
});

test("execution-plan: createExecutionPlan throws ValidationError (deprecated)", () => {
  // The legacy factory should throw since it's deprecated
  assert.throws(
    () =>
      createExecutionPlan({
        taskId: "task_1",
        tenantId: "tenant_1",
        version: 1,
        steps: [],
      }),
    {
      name: "ValidationError",
      message: /deprecated|Use PlanGraphBundle/i,
    },
  );
});

// =============================================================================
// Type Consistency Tests
// =============================================================================

test("execution-plan: PlanNodeType union contains expected values", () => {
  const nodeTypes: Array<PlanNode["nodeType"]> = [
    "tool",
    "llm",
    "hitl_wait",
    "subgraph",
    "evaluator",
    "router",
    "compensation",
  ];

  for (const nodeType of nodeTypes) {
    const node: PlanNode = {
      nodeId: `node_${nodeType}`,
      nodeType,
      inputRefs: [],
      outputSchemaRef: "schema_1",
      riskClass: "low",
      budgetIntent: {
        amount: 100,
        currency: "USD",
        resourceKinds: ["token"],
      },
      sideEffectProfile: {
        mayCommitExternalEffect: false,
        reversible: false,
      },
      retryPolicyRef: "retry_1",
      timeoutMs: 30000,
    };
    assert.equal(node.nodeType, nodeType);
  }
});

test("execution-plan: DependencyType union contains expected values", () => {
  const dependencyTypes: Array<PlanEdge["dependencyType"]> = [
    "hard",
    "soft",
    "compensation",
    "retry",
    "replan",
  ];

  for (const depType of dependencyTypes) {
    const edge: PlanEdge = {
      edgeId: `edge_${depType}`,
      fromNodeId: "node_a",
      toNodeId: "node_b",
      condition: {},
      dependencyType: depType,
    };
    assert.equal(edge.dependencyType, depType);
  }
});

test("execution-plan: GraphPatchOperationType union contains expected values", () => {
  const operationTypes: Array<GraphPatchOperation["operationType"]> = [
    "add_node",
    "add_edge",
    "disable_edge",
    "add_compensation_node",
    "add_failure_path",
    "mark_skipped",
    "append_subgraph",
  ];

  for (const opType of operationTypes) {
    const op: GraphPatchOperation = {
      operationId: `op_${opType}`,
      operationType: opType,
      targetRef: "target_1",
      payload: {},
    };
    assert.equal(op.operationType, opType);
  }
});

test("execution-plan: ReadyNodeSchedulingPolicy strategy union", () => {
  const policies: Array<ReadyNodeSchedulingPolicy["strategy"]> = [
    "deterministic_fifo",
    "priority_then_fifo",
    "risk_isolated",
  ];

  for (const strategy of policies) {
    const policy: ReadyNodeSchedulingPolicy = {
      policyId: `policy_${strategy}`,
      strategy,
    };
    assert.equal(policy.strategy, strategy);
  }
});

test("execution-plan: contract remains as compatibility shell and rejects legacy creation", () => {
  assert.throws(
    () =>
      createExecutionPlan({
        taskId: "task_123",
        tenantId: "tenant_abc",
        version: 1,
        steps: [
          {
            stepId: "step_1",
            title: "First step",
            actionRef: "action_one",
            dependsOn: [],
            requiresApproval: false,
          },
        ],
      }),
    (error: unknown) =>
      error instanceof ValidationError && error.code === "execution_plan.legacy_contract_forbidden",
  );
});

test("execution-plan: GraphValidationReport valid field controls validity", () => {
  const validReport: GraphValidationReport = {
    valid: true,
    findings: [],
  };

  const invalidReport: GraphValidationReport = {
    valid: false,
    findings: ["Node node_1 has unresolvable dependencies", "Cycle detected at node_2"],
  };

  assert.equal(validReport.valid, true);
  assert.equal(invalidReport.valid, false);
  assert.equal(invalidReport.findings.length, 2);
});

test("execution-plan: GraphRiskFinding structure", () => {
  const finding: GraphRiskFinding = {
    nodeId: "node_high_risk",
    inheritedRiskClass: "high",
    reasons: ["Accesses external API", "Modifies state"],
  };

  assert.equal(finding.nodeId, "node_high_risk");
  assert.equal(finding.inheritedRiskClass, "high");
  assert.equal(finding.reasons.length, 2);
});

test("execution-plan: GraphWorstPathAnalysis structure", () => {
  const analysis: GraphWorstPathAnalysis = {
    pathNodeIds: ["node_start", "node_mid", "node_end"],
    riskClass: "critical",
    estimatedBudgetAmount: 5000,
    timeoutMs: 120000,
  };

  assert.equal(analysis.pathNodeIds.length, 3);
  assert.equal(analysis.riskClass, "critical");
  assert.equal(analysis.estimatedBudgetAmount, 5000);
  assert.equal(analysis.timeoutMs, 120000);
});

test("execution-plan: PlanGraph joinStrategy union", () => {
  const strategies: Array<PlanGraph["joinStrategy"]> = [
    "all",
    "any",
    "first_success",
    "policy",
  ];

  for (const strategy of strategies) {
    const graph: PlanGraph = {
      graphId: `graph_${strategy}`,
      nodes: [],
      edges: [],
      entryNodeIds: [],
      terminalNodeIds: [],
      joinStrategy: strategy,
      graphHash: "hash_test",
    };
    assert.equal(graph.joinStrategy, strategy);
  }
});
