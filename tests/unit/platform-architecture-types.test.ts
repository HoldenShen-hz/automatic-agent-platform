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

// ─────────────────────────────────────────────────────────────────────────────
// PlatformArchitectureLayer Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PlatformArchitectureLayer accepts all valid values", () => {
  const layers: PlatformArchitectureLayer[] = [
    "platform",
    "domains",
    "interaction",
    "org-governance",
    "scale-ecosystem",
    "ops-maturity",
    "plugins",
    "sdk",
    "apps",
  ];
  assert.equal(layers.length, 9);
});

// ─────────────────────────────────────────────────────────────────────────────
// PlatformPlane Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PlatformPlane accepts all valid values", () => {
  const planes: PlatformPlane[] = ["P1", "P2", "P3", "P4", "P5", "X1"];
  assert.equal(planes.length, 6);
});

// ─────────────────────────────────────────────────────────────────────────────
// PlatformAppKind Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PlatformAppKind accepts all valid values", () => {
  const kinds: PlatformAppKind[] = ["api", "console", "worker"];
  assert.equal(kinds.length, 3);
});

// ─────────────────────────────────────────────────────────────────────────────
// PlatformAppManifest Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PlatformAppManifest accepts valid structure", () => {
  const manifest: PlatformAppManifest = {
    appId: "test-app",
    kind: "api",
    entryModule: "/path/to/module.js",
    defaultPort: 8080,
    healthEndpoint: "/health",
    capabilities: ["execution", "monitoring"],
    requiredLayers: ["platform"],
    startupCommand: "npm start",
    startupMode: "daemon",
  };

  assert.equal(manifest.appId, "test-app");
  assert.equal(manifest.kind, "api");
  assert.equal(manifest.defaultPort, 8080);
  assert.equal(manifest.capabilities.length, 2);
  assert.equal(manifest.requiredLayers.length, 1);
  assert.equal(manifest.startupMode, "daemon");
});

test("PlatformAppManifest accepts null optional fields", () => {
  const manifest: PlatformAppManifest = {
    appId: "minimal-app",
    kind: "worker",
    entryModule: "./entry.js",
    defaultPort: null,
    healthEndpoint: null,
    capabilities: [],
    requiredLayers: [],
    startupCommand: "node worker.js",
    startupMode: "job",
  };

  assert.equal(manifest.defaultPort, null);
  assert.equal(manifest.healthEndpoint, null);
});

test("PlatformAppManifest startupMode accepts daemon and job", () => {
  const daemonManifest: PlatformAppManifest = {
    appId: "daemon-app",
    kind: "api",
    entryModule: "./api.js",
    defaultPort: 8080,
    healthEndpoint: "/health",
    capabilities: [],
    requiredLayers: ["platform"],
    startupCommand: "npm start",
    startupMode: "daemon",
  };

  const jobManifest: PlatformAppManifest = {
    appId: "job-app",
    kind: "worker",
    entryModule: "./worker.js",
    defaultPort: null,
    healthEndpoint: null,
    capabilities: [],
    requiredLayers: ["platform"],
    startupCommand: "node job.js",
    startupMode: "job",
  };

  assert.equal(daemonManifest.startupMode, "daemon");
  assert.equal(jobManifest.startupMode, "job");
});

// ─────────────────────────────────────────────────────────────────────────────
// PlatformStartupTargetKind Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PlatformStartupTargetKind accepts all valid values", () => {
  const kinds: PlatformStartupTargetKind[] = ["summary", "demo", "api", "console", "worker"];
  assert.equal(kinds.length, 5);
});

// ─────────────────────────────────────────────────────────────────────────────
// PlatformStartupTarget Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PlatformStartupTarget accepts valid structure", () => {
  const target: PlatformStartupTarget = {
    targetKind: "api",
    rootEntryModule: "/app/main.js",
    description: "API server",
    requiredLayers: ["platform", "domains"],
    startupCommand: "npm run api",
    appManifest: null,
  };

  assert.equal(target.targetKind, "api");
  assert.equal(target.description, "API server");
  assert.equal(target.requiredLayers.length, 2);
  assert.equal(target.appManifest, null);
});

test("PlatformStartupTarget accepts appManifest", () => {
  const appManifest: PlatformAppManifest = {
    appId: "console-app",
    kind: "console",
    entryModule: "/console/main.js",
    defaultPort: 3000,
    healthEndpoint: "/health",
    capabilities: ["ui"],
    requiredLayers: ["platform"],
    startupCommand: "npm run console",
    startupMode: "daemon",
  };

  const target: PlatformStartupTarget = {
    targetKind: "console",
    rootEntryModule: "/console/main.js",
    description: "Console UI",
    requiredLayers: ["platform"],
    startupCommand: null,
    appManifest,
  };

  assert.notEqual(target.appManifest, null);
  assert.equal(target.appManifest!.appId, "console-app");
});

// ─────────────────────────────────────────────────────────────────────────────
// HarnessRunStatus Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HarnessRunStatus accepts all valid values", () => {
  const statuses: HarnessRunStatus[] = [
    "created",
    "admitted",
    "planning",
    "ready",
    "running",
    "pausing",
    "paused",
    "resuming",
    "replanning",
    "compensating",
    "completed",
    "failed",
    "aborted",
  ];
  assert.equal(statuses.length, 13);
});

// ─────────────────────────────────────────────────────────────────────────────
// HarnessRun Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HarnessRun accepts valid structure", () => {
  const run: HarnessRun = {
    harnessRunId: "run-123",
    tenantId: "tenant-456",
    confirmedTaskSpecId: "spec-789",
    requestEnvelopeId: "env-001",
    requestHash: "hash-abc",
    status: "created",
    constraintPackRef: "cp-ref",
    versionLockId: "vl-001",
    budgetLedgerId: "bl-001",
    currentSeq: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  assert.equal(run.harnessRunId, "run-123");
  assert.equal(run.tenantId, "tenant-456");
  assert.equal(run.status, "created");
  assert.equal(run.currentSeq, 0);
  assert.equal(run.terminalAt, undefined);
});

test("HarnessRun accepts optional fields", () => {
  const run: HarnessRun = {
    harnessRunId: "run-123",
    tenantId: "tenant-456",
    confirmedTaskSpecId: "spec-789",
    requestEnvelopeId: "env-001",
    requestHash: "hash-abc",
    status: "completed",
    constraintPackRef: "cp-ref",
    versionLockId: "vl-001",
    planGraphBundleId: "pgb-001",
    budgetLedgerId: "bl-001",
    currentSeq: 10,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:01:00Z",
    terminalAt: "2026-01-01T00:01:00Z",
    terminalReason: "Completed successfully",
  };

  assert.equal(run.planGraphBundleId, "pgb-001");
  assert.equal(run.terminalAt, "2026-01-01T00:01:00Z");
  assert.equal(run.terminalReason, "Completed successfully");
});

// ─────────────────────────────────────────────────────────────────────────────
// NodeRunStatus Tests
// ─────────────────────────────────────────────────────────────────────────────

test("NodeRunStatus accepts all valid values", () => {
  const statuses: NodeRunStatus[] = [
    "created",
    "ready",
    "leased",
    "running",
    "retry_wait",
    "awaiting_hitl",
    "reconciling",
    "succeeded",
    "failed",
    "skipped",
    "cancelled",
    "dependency_failed",
    "policy_blocked",
    "aborted",
  ];
  assert.equal(statuses.length, 14);
});

// ─────────────────────────────────────────────────────────────────────────────
// NodeRun Tests
// ─────────────────────────────────────────────────────────────────────────────

test("NodeRun accepts valid structure", () => {
  const nodeRun: NodeRun = {
    nodeRunId: "nr-001",
    harnessRunId: "run-123",
    planGraphBundleId: "pgb-001",
    graphVersion: 1,
    nodeId: "node-001",
    status: "created",
    attemptCount: 0,
    currentSeq: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  assert.equal(nodeRun.nodeRunId, "nr-001");
  assert.equal(nodeRun.status, "created");
  assert.equal(nodeRun.attemptCount, 0);
});

test("NodeRun accepts optional lease fields", () => {
  const nodeRun: NodeRun = {
    nodeRunId: "nr-002",
    harnessRunId: "run-123",
    planGraphBundleId: "pgb-001",
    graphVersion: 1,
    nodeId: "node-002",
    status: "leased",
    attemptCount: 1,
    leaseId: "lease-001",
    fencingToken: "token-abc",
    currentSeq: 5,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:30Z",
    terminalReason: "Processing",
  };

  assert.equal(nodeRun.leaseId, "lease-001");
  assert.equal(nodeRun.fencingToken, "token-abc");
  assert.equal(nodeRun.terminalReason, "Processing");
});

// ─────────────────────────────────────────────────────────────────────────────
// PlanNodeType Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PlanNodeType accepts all valid values", () => {
  const nodeTypes: PlanNodeType[] = [
    "tool",
    "llm",
    "hitl_wait",
    "subgraph",
    "evaluator",
    "router",
    "compensation",
  ];
  assert.equal(nodeTypes.length, 7);
});

// ─────────────────────────────────────────────────────────────────────────────
// PlanNode Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PlanNode accepts valid structure", () => {
  const node: PlanNode = {
    nodeId: "node-001",
    nodeType: "tool",
    inputRefs: ["input-1", "input-2"],
    outputSchemaRef: "schema-001",
    riskClass: "low",
    budgetIntent: {
      amount: 1000,
      currency: "USD",
      resourceKinds: ["token"],
    },
    sideEffectProfile: {
      mayCommitExternalEffect: false,
      reversible: true,
    },
    retryPolicyRef: "retry-001",
    timeoutMs: 30000,
  };

  assert.equal(node.nodeId, "node-001");
  assert.equal(node.nodeType, "tool");
  assert.equal(node.inputRefs.length, 2);
  assert.equal(node.riskClass, "low");
  assert.equal(node.budgetIntent.amount, 1000);
});

// ─────────────────────────────────────────────────────────────────────────────
// DependencyType Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DependencyType accepts all valid values", () => {
  const deps: DependencyType[] = ["hard", "soft", "compensation", "retry", "replan"];
  assert.equal(deps.length, 5);
});

// ─────────────────────────────────────────────────────────────────────────────
// PlanEdge Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PlanEdge accepts valid structure", () => {
  const edge: PlanEdge = {
    edgeId: "edge-001",
    fromNodeId: "node-001",
    toNodeId: "node-002",
    condition: true,
    dependencyType: "hard",
  };

  assert.equal(edge.edgeId, "edge-001");
  assert.equal(edge.fromNodeId, "node-001");
  assert.equal(edge.toNodeId, "node-002");
  assert.equal(edge.condition, true);
  assert.equal(edge.dependencyType, "hard");
});

test("PlanEdge accepts JsonValue condition", () => {
  const edge: PlanEdge = {
    edgeId: "edge-002",
    fromNodeId: "node-002",
    toNodeId: "node-003",
    condition: { key: "value", count: 42 },
    dependencyType: "soft",
  };

  assert.deepEqual(edge.condition, { key: "value", count: 42 });
});

// ─────────────────────────────────────────────────────────────────────────────
// PlanGraph Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PlanGraph accepts valid structure", () => {
  const graph: PlanGraph = {
    graphId: "graph-001",
    nodes: [],
    edges: [],
    entryNodeIds: ["node-001"],
    terminalNodeIds: ["node-003"],
    joinStrategy: "all",
    graphHash: "hash-abc",
  };

  assert.equal(graph.graphId, "graph-001");
  assert.deepEqual(graph.nodes, []);
  assert.deepEqual(graph.edges, []);
  assert.deepEqual(graph.entryNodeIds, ["node-001"]);
  assert.deepEqual(graph.terminalNodeIds, ["node-003"]);
  assert.equal(graph.joinStrategy, "all");
});

test("PlanGraph joinStrategy accepts all valid values", () => {
  const strategies: PlanGraph["joinStrategy"][] = ["all", "any", "first_success", "policy"];

  for (const strategy of strategies) {
    const graph: PlanGraph = {
      graphId: "graph-test",
      nodes: [],
      edges: [],
      entryNodeIds: [],
      terminalNodeIds: [],
      joinStrategy: strategy,
      graphHash: "hash",
    };
    assert.equal(graph.joinStrategy, strategy);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ReadyNodeSchedulingPolicy Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ReadyNodeSchedulingPolicy accepts valid structure", () => {
  const policy: ReadyNodeSchedulingPolicy = {
    policyId: "policy-001",
    strategy: "deterministic_fifo",
  };

  assert.equal(policy.policyId, "policy-001");
  assert.equal(policy.strategy, "deterministic_fifo");
});

test("ReadyNodeSchedulingPolicy strategy accepts all valid values", () => {
  const strategies: ReadyNodeSchedulingPolicy["strategy"][] = [
    "deterministic_fifo",
    "priority_then_fifo",
    "risk_isolated",
  ];

  for (const strategy of strategies) {
    const policy: ReadyNodeSchedulingPolicy = {
      policyId: "policy-test",
      strategy,
    };
    assert.equal(policy.strategy, strategy);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GraphValidationReport Tests
// ─────────────────────────────────────────────────────────────────────────────

test("GraphValidationReport accepts valid structure", () => {
  const report: GraphValidationReport = {
    valid: true,
    findings: [],
  };

  assert.equal(report.valid, true);
  assert.deepEqual(report.findings, []);
  assert.equal(report.normalizedNodeIds, undefined);
});

test("GraphValidationReport accepts findings and normalizedNodeIds", () => {
  const report: GraphValidationReport = {
    valid: false,
    findings: ["Node missing output schema", "Edge references non-existent node"],
    normalizedNodeIds: ["node-001", "node-002", "node-003"],
  };

  assert.equal(report.valid, false);
  assert.equal(report.findings.length, 2);
  assert.deepEqual(report.normalizedNodeIds, ["node-001", "node-002", "node-003"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// BudgetResourceKind Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BudgetResourceKind accepts all valid values", () => {
  const kinds: BudgetResourceKind[] = [
    "token",
    "tool",
    "api",
    "compute",
    "human",
    "side_effect",
    "other",
  ];
  assert.equal(kinds.length, 7);
});

// ─────────────────────────────────────────────────────────────────────────────
// BudgetIntent Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BudgetIntent accepts valid structure", () => {
  const intent: BudgetIntent = {
    amount: 5000,
    currency: "USD",
    resourceKinds: ["token", "compute"],
  };

  assert.equal(intent.amount, 5000);
  assert.equal(intent.currency, "USD");
  assert.equal(intent.resourceKinds.length, 2);
});

test("BudgetIntent accepts single resource kind", () => {
  const intent: BudgetIntent = {
    amount: 100,
    currency: "USD",
    resourceKinds: ["token"],
  };

  assert.deepEqual(intent.resourceKinds, ["token"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// SideEffectProfile Tests
// ─────────────────────────────────────────────────────────────────────────────

test("SideEffectProfile accepts valid structure", () => {
  const profile: SideEffectProfile = {
    mayCommitExternalEffect: false,
    reversible: true,
  };

  assert.equal(profile.mayCommitExternalEffect, false);
  assert.equal(profile.reversible, true);
});

test("SideEffectProfile for non-reversible external effect", () => {
  const profile: SideEffectProfile = {
    mayCommitExternalEffect: true,
    reversible: false,
  };

  assert.equal(profile.mayCommitExternalEffect, true);
  assert.equal(profile.reversible, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// RiskClass Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RiskClass accepts all valid values", () => {
  const classes: RiskClass[] = ["low", "medium", "high", "critical"];
  assert.equal(classes.length, 4);
});

// ─────────────────────────────────────────────────────────────────────────────
// RiskPreview Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RiskPreview accepts valid structure", () => {
  const preview: RiskPreview = {
    riskClass: "high",
    reasons: ["External API call", "Sensitive data access"],
  };

  assert.equal(preview.riskClass, "high");
  assert.equal(preview.reasons.length, 2);
});

test("RiskPreview with empty reasons", () => {
  const preview: RiskPreview = {
    riskClass: "low",
    reasons: [],
  };

  assert.deepEqual(preview.reasons, []);
});

// ─────────────────────────────────────────────────────────────────────────────
// BudgetReservation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BudgetReservation accepts valid structure", () => {
  const reservation: BudgetReservation = {
    budgetReservationId: "res-001",
    budgetLedgerId: "bl-001",
    harnessRunId: "run-123",
    amount: 1000,
    resourceKind: "token",
    status: "reserved",
    expiresAt: "2026-01-01T01:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
  };

  assert.equal(reservation.budgetReservationId, "res-001");
  assert.equal(reservation.status, "reserved");
  assert.equal(reservation.amount, 1000);
});

test("BudgetReservation accepts all status values", () => {
  const statuses: BudgetReservation["status"][] = [
    "reserved",
    "settled",
    "released",
    "expired",
    "rejected",
  ];

  for (const status of statuses) {
    const reservation: BudgetReservation = {
      budgetReservationId: `res-${status}`,
      budgetLedgerId: "bl-001",
      harnessRunId: "run-123",
      amount: 100,
      resourceKind: "token",
      status,
      expiresAt: "2026-01-01T01:00:00Z",
      createdAt: "2026-01-01T00:00:00Z",
    };
    assert.equal(reservation.status, status);
  }
});

test("BudgetReservation accepts optional nodeRunId", () => {
  const reservation: BudgetReservation = {
    budgetReservationId: "res-002",
    budgetLedgerId: "bl-001",
    harnessRunId: "run-123",
    nodeRunId: "nr-001",
    amount: 500,
    resourceKind: "compute",
    status: "reserved",
    expiresAt: "2026-01-01T01:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
  };

  assert.equal(reservation.nodeRunId, "nr-001");
});

// ─────────────────────────────────────────────────────────────────────────────
// ArtifactRef Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ArtifactRef accepts valid structure", () => {
  const artifact: ArtifactRef = {
    artifactId: "artifact-001",
    uri: "s3://bucket/path/to/artifact",
  };

  assert.equal(artifact.artifactId, "artifact-001");
  assert.equal(artifact.uri, "s3://bucket/path/to/artifact");
  assert.equal(artifact.hash, undefined);
  assert.equal(artifact.version, undefined);
});

test("ArtifactRef accepts optional hash and version", () => {
  const artifact: ArtifactRef = {
    artifactId: "artifact-002",
    uri: "s3://bucket/path/to/artifact",
    hash: "sha256-abc123",
    version: "v1.2.3",
  };

  assert.equal(artifact.hash, "sha256-abc123");
  assert.equal(artifact.version, "v1.2.3");
});

// ─────────────────────────────────────────────────────────────────────────────
// PlanGraphBundle Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PlanGraphBundle accepts valid structure", () => {
  const bundle: PlanGraphBundle = {
    planGraphBundleId: "pgb-001",
    harnessRunId: "run-123",
    graphVersion: 1,
    graph: {
      graphId: "graph-001",
      nodes: [],
      edges: [],
      entryNodeIds: [],
      terminalNodeIds: [],
      joinStrategy: "all",
      graphHash: "hash-abc",
    },
    schedulerPolicy: {
      policyId: "policy-001",
      strategy: "deterministic_fifo",
    },
    budgetPlanRef: "budget-plan-001",
    riskProfile: {
      riskClass: "medium",
      reasons: ["External dependency"],
    },
    validationReport: {
      valid: true,
      findings: [],
    },
    artifactRefs: [],
    createdAt: "2026-01-01T00:00:00Z",
  };

  assert.equal(bundle.planGraphBundleId, "pgb-001");
  assert.equal(bundle.harnessRunId, "run-123");
  assert.equal(bundle.graph.graphId, "graph-001");
  assert.equal(bundle.schedulerPolicy.policyId, "policy-001");
  assert.equal(bundle.riskProfile.riskClass, "medium");
  assert.equal(bundle.validationReport.valid, true);
});

test("PlanGraphBundle with artifact refs", () => {
  const bundle: PlanGraphBundle = {
    planGraphBundleId: "pgb-002",
    harnessRunId: "run-123",
    graphVersion: 1,
    graph: {
      graphId: "graph-002",
      nodes: [],
      edges: [],
      entryNodeIds: [],
      terminalNodeIds: [],
      joinStrategy: "any",
      graphHash: "hash-def",
    },
    schedulerPolicy: {
      policyId: "policy-002",
      strategy: "priority_then_fifo",
    },
    budgetPlanRef: "budget-plan-002",
    riskProfile: {
      riskClass: "low",
      reasons: [],
    },
    validationReport: {
      valid: true,
      findings: [],
    },
    artifactRefs: [
      { artifactId: "artifact-001", uri: "s3://bucket/artifact-1" },
      { artifactId: "artifact-002", uri: "s3://bucket/artifact-2", hash: "sha256-xyz" },
    ],
    createdAt: "2026-01-01T00:00:00Z",
  };

  assert.equal(bundle.artifactRefs.length, 2);
  assert.equal(bundle.artifactRefs[0].artifactId, "artifact-001");
  assert.equal(bundle.artifactRefs[1].hash, "sha256-xyz");
});

// ─────────────────────────────────────────────────────────────────────────────
// JsonValue Tests
// ─────────────────────────────────────────────────────────────────────────────

test("JsonValue accepts null", () => {
  const value: JsonValue = null;
  assert.equal(value, null);
});

test("JsonValue accepts boolean", () => {
  const trueValue: JsonValue = true;
  const falseValue: JsonValue = false;
  assert.equal(trueValue, true);
  assert.equal(falseValue, false);
});

test("JsonValue accepts number", () => {
  const intValue: JsonValue = 42;
  const floatValue: JsonValue = 3.14;
  const negValue: JsonValue = -100;
  assert.equal(intValue, 42);
  assert.equal(floatValue, 3.14);
  assert.equal(negValue, -100);
});

test("JsonValue accepts string", () => {
  const value: JsonValue = "hello world";
  assert.equal(value, "hello world");
});

test("JsonValue accepts array", () => {
  const value: JsonValue = [1, "two", true, null];
  assert.deepEqual(value, [1, "two", true, null]);
});

test("JsonValue accepts object", () => {
  const value: JsonValue = { key: "value", count: 42 };
  assert.deepEqual(value, { key: "value", count: 42 });
});

test("JsonValue accepts nested structure", () => {
  const value: JsonValue = {
    user: {
      name: "Alice",
      roles: ["admin", "user"],
      active: true,
    },
    metadata: {
      createdAt: "2026-01-01",
      count: null,
    },
  };

  const obj = value as { user: { name: string; roles: string[]; active: boolean }; metadata: { createdAt: string; count: null } };
  assert.equal(obj.user.name, "Alice");
  assert.deepEqual(obj.user.roles, ["admin", "user"]);
  assert.equal(obj.metadata.count, null);
});

test("JsonValue accepts readonly array", () => {
  const arr: readonly [number, string, boolean] = [1, "two", true];
  const value: JsonValue = arr;
  assert.deepEqual(value, [1, "two", true]);
});

test("JsonValue accepts complex nested array with objects", () => {
  const value: JsonValue = [
    { id: 1, name: "first" },
    { id: 2, name: "second" },
    [1, 2, 3],
    { nested: { deep: true } },
  ];

  const arr = value as JsonValue[];
  assert.deepEqual((arr[0] as { id: number }).id, 1);
  assert.deepEqual((arr[2] as number[]), [1, 2, 3]);
  assert.deepEqual((arr[3] as { nested: { deep: boolean } }).nested.deep, true);
});
