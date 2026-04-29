import assert from "node:assert/strict";
import test from "node:test";

import type {
  PlatformArchitectureLayer,
  PlatformPlane,
  PlatformAppKind,
  PlatformAppManifest,
  PlatformStartupTargetKind,
  PlatformStartupTarget,
  HarnessRunStatus,
  HarnessRun,
  NodeRunStatus,
  NodeRun,
  PlanNodeType,
  PlanNode,
  PlanEdge,
  DependencyType,
  PlanGraph,
  ReadyNodeSchedulingPolicy,
  GraphValidationReport,
  BudgetIntent,
  BudgetResourceKind,
  SideEffectProfile,
  RiskClass,
  RiskPreview,
  BudgetReservation,
  ArtifactRef,
  PlanGraphBundle,
  JsonValue,
} from "../../src/platform-architecture-types.js";

test("integration: PlatformArchitectureLayer type can be used in composite structures", () => {
  const layers: PlatformArchitectureLayer[] = ["platform", "domains", "interaction"];

  const manifest: PlatformAppManifest = {
    appId: "composite-app",
    kind: "api",
    entryModule: "./api.js",
    defaultPort: 8080,
    healthEndpoint: "/health",
    capabilities: ["execution"],
    requiredLayers: layers,
    startupCommand: "npm start",
    startupMode: "daemon",
  };

  assert.ok(manifest.requiredLayers.includes("platform"));
  assert.ok(manifest.requiredLayers.includes("domains"));
  assert.equal(manifest.requiredLayers.length, 3);
});

test("integration: PlatformPlane can be used with PlatformAppManifest", () => {
  const manifest: PlatformAppManifest = {
    appId: "plane-aware-app",
    kind: "api",
    entryModule: "./api.js",
    defaultPort: 8080,
    healthEndpoint: "/health",
    capabilities: ["execution"],
    requiredLayers: ["platform"],
    startupCommand: "npm start",
    startupMode: "daemon",
  };

  const plane: PlatformPlane = "P1";

  assert.equal(typeof plane, "string");
  assert.ok(["P1", "P2", "P3", "P4", "P5", "X1"].includes(plane));
});

test("integration: HarnessRun and NodeRun can reference each other", () => {
  const harnessRun: HarnessRun = {
    harnessRunId: "run-001",
    tenantId: "tenant-001",
    confirmedTaskSpecId: "spec-001",
    requestEnvelopeId: "env-001",
    requestHash: "hash-001",
    status: "running",
    constraintPackRef: "cp-001",
    versionLockId: "vl-001",
    budgetLedgerId: "bl-001",
    currentSeq: 5,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:01:00Z",
  };

  const nodeRun: NodeRun = {
    nodeRunId: "nr-001",
    harnessRunId: harnessRun.harnessRunId,
    planGraphBundleId: "pgb-001",
    graphVersion: 1,
    nodeId: "node-001",
    status: "running",
    attemptCount: 1,
    currentSeq: 1,
    createdAt: "2026-01-01T00:00:05Z",
    updatedAt: "2026-01-01T00:00:30Z",
  };

  assert.equal(nodeRun.harnessRunId, harnessRun.harnessRunId);
  assert.equal(harnessRun.status, "running");
  assert.equal(nodeRun.status, "running");
});

test("integration: PlanGraphBundle contains nested PlanGraph and related structures", () => {
  const planGraphBundle = buildValidPlanGraphBundle();

  assert.equal(planGraphBundle.graph.nodes.length, 3);
  assert.equal(planGraphBundle.graph.edges.length, 2);
  assert.equal(planGraphBundle.schedulerPolicy.strategy, "priority_then_fifo");
  assert.equal(planGraphBundle.riskProfile.riskClass, "medium");
  assert.equal(planGraphBundle.validationReport.valid, true);
  assert.equal(planGraphBundle.artifactRefs.length, 2);
});

test("integration: BudgetIntent works with BudgetReservation", () => {
  const budgetIntent: BudgetIntent = {
    amount: 10000,
    currency: "USD",
    resourceKinds: ["token", "compute"],
  };

  const reservation: BudgetReservation = {
    budgetReservationId: "res-001",
    budgetLedgerId: "bl-001",
    harnessRunId: "run-001",
    amount: budgetIntent.amount,
    resourceKind: budgetIntent.resourceKinds[0],
    status: "reserved",
    expiresAt: "2026-01-01T01:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
  };

  assert.equal(reservation.amount, budgetIntent.amount);
  assert.equal(reservation.resourceKind, "token");
});

test("integration: NodeRunStatus lifecycle transitions are valid", () => {
  const initialStatus: NodeRunStatus = "created";
  const readyStatus: NodeRunStatus = "ready";
  const leasedStatus: NodeRunStatus = "leased";
  const runningStatus: NodeRunStatus = "running";
  const terminalStatus: NodeRunStatus = "succeeded";

  const statuses: NodeRunStatus[] = [
    initialStatus,
    readyStatus,
    leasedStatus,
    runningStatus,
    terminalStatus,
  ];

  const nodeRun: NodeRun = {
    nodeRunId: "nr-lifecycle",
    harnessRunId: "run-001",
    planGraphBundleId: "pgb-001",
    graphVersion: 1,
    nodeId: "node-001",
    status: terminalStatus,
    attemptCount: 1,
    currentSeq: 5,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:05:00Z",
  };

  assert.deepEqual(
    statuses,
    ["created", "ready", "leased", "running", "succeeded"],
  );
  assert.equal(nodeRun.status, terminalStatus);
});

test("integration: HarnessRunStatus lifecycle transitions are valid", () => {
  const lifecycleStatuses: HarnessRunStatus[] = [
    "created",
    "admitted",
    "planning",
    "ready",
    "running",
    "completed",
  ];

  const harnessRun: HarnessRun = {
    harnessRunId: "run-lifecycle",
    tenantId: "tenant-001",
    confirmedTaskSpecId: "spec-001",
    requestEnvelopeId: "env-001",
    requestHash: "hash-001",
    status: "completed",
    constraintPackRef: "cp-001",
    versionLockId: "vl-001",
    budgetLedgerId: "bl-001",
    currentSeq: 10,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:10:00Z",
    terminalAt: "2026-01-01T00:10:00Z",
    terminalReason: "Completed successfully",
  };

  assert.equal(harnessRun.status, "completed");
  assert.equal(lifecycleStatuses.length, 6);
});

test("integration: PlanNode with all PlanNodeType variants", () => {
  const nodeTypes: PlanNodeType[] = [
    "tool",
    "llm",
    "hitl_wait",
    "subgraph",
    "evaluator",
    "router",
    "compensation",
  ];

  const nodes: PlanNode[] = nodeTypes.map((nodeType, index) => ({
    nodeId: `node-${index}`,
    nodeType,
    inputRefs: [],
    outputSchemaRef: `schema-${index}`,
    riskClass: "low" as RiskClass,
    budgetIntent: {
      amount: 100,
      currency: "USD",
      resourceKinds: ["token"] as BudgetResourceKind[],
    },
    sideEffectProfile: {
      mayCommitExternalEffect: false,
      reversible: true,
    },
    retryPolicyRef: `retry-${index}`,
    timeoutMs: 30000,
  }));

  assert.equal(nodes.length, 7);
  nodes.forEach((node, index) => {
    assert.equal(node.nodeType, nodeTypes[index]);
  });
});

test("integration: PlanEdge with all DependencyType variants", () => {
  const dependencyTypes: DependencyType[] = [
    "hard",
    "soft",
    "compensation",
    "retry",
    "replan",
  ];

  const edges: PlanEdge[] = dependencyTypes.map((depType, index) => ({
    edgeId: `edge-${index}`,
    fromNodeId: `node-${index}`,
    toNodeId: `node-${index + 1}`,
    condition: true,
    dependencyType: depType,
  }));

  assert.equal(edges.length, 5);
  edges.forEach((edge, index) => {
    assert.equal(edge.dependencyType, dependencyTypes[index]);
  });
});

test("integration: JsonValue can represent complex runtime data", () => {
  const runtimeEvent: JsonValue = {
    type: "NodeRunCompleted",
    timestamp: "2026-01-01T00:00:00Z",
    payload: {
      nodeRunId: "nr-001",
      harnessRunId: "run-001",
      status: "succeeded",
      durationMs: 1500,
      outputRefs: ["artifact-001", "artifact-002"],
      metadata: {
        attemptCount: 1,
        flags: ["retry_used"],
        nested: {
          deep: {
            value: 42,
          },
        },
      },
    },
    version: 1,
  };

  const obj = runtimeEvent as {
    type: string;
    payload: {
      nodeRunId: string;
      status: string;
      durationMs: number;
      outputRefs: string[];
      metadata: {
        attemptCount: number;
        flags: string[];
        nested: { deep: { value: number } };
      };
    };
    version: number;
  };

  assert.equal(obj.type, "NodeRunCompleted");
  assert.equal(obj.payload.status, "succeeded");
  assert.equal(obj.payload.durationMs, 1500);
  assert.deepEqual(obj.payload.outputRefs, ["artifact-001", "artifact-002"]);
  assert.equal(obj.payload.metadata.nested.deep.value, 42);
});

test("integration: PlatformStartupTargetKind with PlatformAppManifest", () => {
  const kinds: PlatformStartupTargetKind[] = ["api", "console", "worker", "summary", "demo"];

  const targets: PlatformStartupTarget[] = kinds.map((kind) => ({
    targetKind: kind,
    rootEntryModule: `./${kind}.js`,
    description: `Target for ${kind}`,
    requiredLayers: kind === "summary" || kind === "demo" ? [] : ["platform"],
    startupCommand: kind === "summary" || kind === "demo" ? null : "npm start",
    appManifest:
      kind === "api" || kind === "console" || kind === "worker"
        ? {
            appId: `app-${kind}`,
            kind: kind as PlatformAppKind,
            entryModule: `./${kind}.js`,
            defaultPort: kind === "api" ? 8080 : kind === "console" ? 3000 : null,
            healthEndpoint: kind === "api" || kind === "console" ? "/health" : null,
            capabilities: [],
            requiredLayers: ["platform"],
            startupCommand: "npm start",
            startupMode: "daemon",
          }
        : null,
  }));

  assert.equal(targets.length, 5);
  assert.equal(targets[0].appManifest?.kind, "api");
  assert.equal(targets[1].appManifest?.kind, "console");
  assert.equal(targets[2].appManifest?.kind, "worker");
  assert.equal(targets[3].appManifest, null);
  assert.equal(targets[4].appManifest, null);
});

test("integration: GraphValidationReport with PlanGraph", () => {
  const graph: PlanGraph = {
    graphId: "graph-validation-test",
    nodes: [
      {
        nodeId: "node-1",
        nodeType: "tool",
        inputRefs: [],
        outputSchemaRef: "schema-1",
        riskClass: "low",
        budgetIntent: { amount: 100, currency: "USD", resourceKinds: ["token"] },
        sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
        retryPolicyRef: "retry-1",
        timeoutMs: 30000,
      },
      {
        nodeId: "node-2",
        nodeType: "llm",
        inputRefs: ["node-1"],
        outputSchemaRef: "schema-2",
        riskClass: "medium",
        budgetIntent: { amount: 500, currency: "USD", resourceKinds: ["token"] },
        sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
        retryPolicyRef: "retry-2",
        timeoutMs: 60000,
      },
    ],
    edges: [
      {
        edgeId: "edge-1",
        fromNodeId: "node-1",
        toNodeId: "node-2",
        condition: true,
        dependencyType: "hard",
      },
    ],
    entryNodeIds: ["node-1"],
    terminalNodeIds: ["node-2"],
    joinStrategy: "all",
    graphHash: "hash-abc",
  };

  const validationReport: GraphValidationReport = {
    valid: true,
    findings: [],
    normalizedNodeIds: graph.nodes.map((n) => n.nodeId),
  };

  assert.equal(validationReport.valid, true);
  assert.deepEqual(validationReport.normalizedNodeIds, ["node-1", "node-2"]);
  assert.equal(graph.nodes.length, validationReport.normalizedNodeIds?.length);
});

test("integration: RiskPreview with RiskClass and BudgetIntent", () => {
  const riskClasses: RiskClass[] = ["low", "medium", "high", "critical"];

  const riskProfiles: RiskPreview[] = riskClasses.map((riskClass, index) => ({
    riskClass,
    reasons: index === 0 ? [] : [`Reason for ${riskClass} risk`],
  }));

  const budgetIntents: BudgetIntent[] = riskClasses.map((riskClass) => ({
    amount: riskClass === "critical" ? 10000 : riskClass === "high" ? 5000 : riskClass === "medium" ? 2000 : 500,
    currency: "USD",
    resourceKinds: riskClass === "critical" ? ["token", "compute", "human"] : ["token"],
  }));

  assert.equal(riskProfiles.length, 4);
  assert.equal(riskProfiles[3].riskClass, "critical");
  assert.equal(budgetIntents[3].amount, 10000);
  assert.deepEqual(budgetIntents[3].resourceKinds, ["token", "compute", "human"]);
});

test("integration: SideEffectProfile affects PlanNode behavior", () => {
  const nodesWithExternalEffect: PlanNode[] = [
    {
      nodeId: "node-external",
      nodeType: "tool",
      inputRefs: [],
      outputSchemaRef: "schema-1",
      riskClass: "high",
      budgetIntent: { amount: 1000, currency: "USD", resourceKinds: ["token", "side_effect"] },
      sideEffectProfile: { mayCommitExternalEffect: true, reversible: false },
      retryPolicyRef: "retry-1",
      timeoutMs: 30000,
    },
  ];

  const nodesWithoutExternalEffect: PlanNode[] = [
    {
      nodeId: "node-internal",
      nodeType: "llm",
      inputRefs: [],
      outputSchemaRef: "schema-2",
      riskClass: "low",
      budgetIntent: { amount: 500, currency: "USD", resourceKinds: ["token"] },
      sideEffectProfile: { mayCommitExternalEffect: false, reversible: true },
      retryPolicyRef: "retry-2",
      timeoutMs: 60000,
    },
  ];

  assert.equal(nodesWithExternalEffect[0].sideEffectProfile.mayCommitExternalEffect, true);
  assert.equal(nodesWithExternalEffect[0].sideEffectProfile.reversible, false);
  assert.equal(nodesWithoutExternalEffect[0].sideEffectProfile.mayCommitExternalEffect, false);
  assert.equal(nodesWithoutExternalEffect[0].sideEffectProfile.reversible, true);
});

test("integration: ReadyNodeSchedulingPolicy strategies work with PlanGraphBundle", () => {
  const strategies: ReadyNodeSchedulingPolicy["strategy"][] = [
    "deterministic_fifo",
    "priority_then_fifo",
    "risk_isolated",
  ];

  const bundles: PlanGraphBundle[] = strategies.map((strategy, index) => ({
    planGraphBundleId: `pgb-strategy-${index}`,
    harnessRunId: "run-001",
    graphVersion: 1,
    graph: {
      graphId: `graph-strategy-${index}`,
      nodes: [],
      edges: [],
      entryNodeIds: [],
      terminalNodeIds: [],
      joinStrategy: "all" as const,
      graphHash: "hash",
    },
    schedulerPolicy: {
      policyId: `policy-${strategy}`,
      strategy,
    },
    budgetPlanRef: "budget-plan-001",
    riskProfile: {
      riskClass: "low" as RiskClass,
      reasons: [],
    },
    validationReport: {
      valid: true,
      findings: [],
    },
    artifactRefs: [],
    createdAt: "2026-01-01T00:00:00Z",
  }));

  assert.equal(bundles.length, 3);
  assert.equal(bundles[0].schedulerPolicy.strategy, "deterministic_fifo");
  assert.equal(bundles[1].schedulerPolicy.strategy, "priority_then_fifo");
  assert.equal(bundles[2].schedulerPolicy.strategy, "risk_isolated");
});

// Helper function used in tests above
function buildValidPlanGraphBundle(): PlanGraphBundle {
  return {
    planGraphBundleId: "pgb-integration-test",
    harnessRunId: "run-integration",
    graphVersion: 1,
    graph: {
      graphId: "graph-integration",
      nodes: [
        {
          nodeId: "node-1",
          nodeType: "tool",
          inputRefs: [],
          outputSchemaRef: "schema-1",
          riskClass: "low",
          budgetIntent: {
            amount: 100,
            currency: "USD",
            resourceKinds: ["token"],
          },
          sideEffectProfile: {
            mayCommitExternalEffect: false,
            reversible: true,
          },
          retryPolicyRef: "retry-1",
          timeoutMs: 30000,
        },
        {
          nodeId: "node-2",
          nodeType: "llm",
          inputRefs: ["node-1"],
          outputSchemaRef: "schema-2",
          riskClass: "medium",
          budgetIntent: {
            amount: 500,
            currency: "USD",
            resourceKinds: ["token"],
          },
          sideEffectProfile: {
            mayCommitExternalEffect: false,
            reversible: true,
          },
          retryPolicyRef: "retry-2",
          timeoutMs: 60000,
        },
        {
          nodeId: "node-3",
          nodeType: "evaluator",
          inputRefs: ["node-2"],
          outputSchemaRef: "schema-3",
          riskClass: "low",
          budgetIntent: {
            amount: 200,
            currency: "USD",
            resourceKinds: ["token"],
          },
          sideEffectProfile: {
            mayCommitExternalEffect: false,
            reversible: true,
          },
          retryPolicyRef: "retry-3",
          timeoutMs: 30000,
        },
      ],
      edges: [
        {
          edgeId: "edge-1",
          fromNodeId: "node-1",
          toNodeId: "node-2",
          condition: true,
          dependencyType: "hard",
        },
        {
          edgeId: "edge-2",
          fromNodeId: "node-2",
          toNodeId: "node-3",
          condition: true,
          dependencyType: "hard",
        },
      ],
      entryNodeIds: ["node-1"],
      terminalNodeIds: ["node-3"],
      joinStrategy: "all",
      graphHash: "hash-integration",
    },
    schedulerPolicy: {
      policyId: "policy-integration",
      strategy: "priority_then_fifo",
    },
    budgetPlanRef: "budget-plan-integration",
    riskProfile: {
      riskClass: "medium",
      reasons: ["Contains LLM node with external dependency"],
    },
    validationReport: {
      valid: true,
      findings: [],
    },
    artifactRefs: [
      {
        artifactId: "artifact-1",
        uri: "s3://bucket/artifact-1",
        hash: "sha256-artifact-1",
        version: "v1.0.0",
      },
      {
        artifactId: "artifact-2",
        uri: "s3://bucket/artifact-2",
        hash: "sha256-artifact-2",
      },
    ],
    createdAt: "2026-01-01T00:00:00Z",
  };
}
