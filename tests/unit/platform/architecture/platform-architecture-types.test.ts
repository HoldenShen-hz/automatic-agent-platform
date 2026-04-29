/**
 * Unit tests for PlatformArchitectureTypes
 *
 * @see src/platform-architecture-types.ts
 */

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
  PlanGraphBundle,
  PlanGraph,
  PlanNode,
  PlanNodeType,
  PlanEdge,
  DependencyType,
  ReadyNodeSchedulingPolicy,
  GraphValidationReport,
  BudgetIntent,
  BudgetResourceKind,
  SideEffectProfile,
  RiskClass,
  RiskPreview,
  BudgetReservation,
  ArtifactRef,
  JsonValue,
} from "../../../../src/platform-architecture-types.js";

// ─────────────────────────────────────────────────────────────────────────────
// PlatformArchitectureLayer Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PlatformArchitectureLayer accepts all 9 valid layer values", () => {
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
  for (const layer of layers) {
    assert.equal(typeof layer, "string");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PlatformPlane Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PlatformPlane accepts all valid plane values", () => {
  const planes: PlatformPlane[] = ["P1", "P2", "P3", "P4", "P5", "X1"];

  assert.equal(planes.length, 6);
  for (const plane of planes) {
    assert.equal(typeof plane, "string");
  }
});

test("PlatformPlane X1 is a special plane", () => {
  const specialPlane: PlatformPlane = "X1";
  assert.equal(specialPlane, "X1");
  assert.ok(!["P1", "P2", "P3", "P4", "P5"].includes(specialPlane));
});

// ─────────────────────────────────────────────────────────────────────────────
// PlatformAppKind Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PlatformAppKind accepts all valid values", () => {
  const kinds: PlatformAppKind[] = ["api", "console", "worker"];

  assert.equal(kinds.length, 3);
  for (const kind of kinds) {
    assert.equal(typeof kind, "string");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PlatformAppManifest Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PlatformAppManifest has all required fields", () => {
  const manifest: PlatformAppManifest = {
    appId: "test_app",
    kind: "api",
    entryModule: "./src/apps/api/index.js",
    defaultPort: 8080,
    healthEndpoint: "/health",
    capabilities: ["execution", "monitoring"],
    requiredLayers: ["platform", "domains"],
    startupCommand: "npm run start:api",
    startupMode: "daemon",
  };

  assert.equal(manifest.appId, "test_app");
  assert.equal(manifest.kind, "api");
  assert.equal(manifest.entryModule, "./src/apps/api/index.js");
  assert.equal(manifest.defaultPort, 8080);
  assert.equal(manifest.healthEndpoint, "/health");
  assert.ok(Array.isArray(manifest.capabilities));
  assert.ok(Array.isArray(manifest.requiredLayers));
  assert.equal(manifest.startupCommand, "npm run start:api");
  assert.equal(manifest.startupMode, "daemon");
});

test("PlatformAppManifest with null defaultPort and healthEndpoint", () => {
  const manifest: PlatformAppManifest = {
    appId: "test_app",
    kind: "worker",
    entryModule: "./src/apps/workers/index.js",
    defaultPort: null,
    healthEndpoint: null,
    capabilities: ["execution"],
    requiredLayers: ["platform"],
    startupCommand: "npm run start:worker",
    startupMode: "job",
  };

  assert.equal(manifest.defaultPort, null);
  assert.equal(manifest.healthEndpoint, null);
  assert.equal(manifest.startupMode, "job");
});

test("PlatformAppManifest with empty capabilities and requiredLayers", () => {
  const manifest: PlatformAppManifest = {
    appId: "minimal_app",
    kind: "console",
    entryModule: "./console.js",
    defaultPort: 3000,
    healthEndpoint: "/health",
    capabilities: [],
    requiredLayers: [],
    startupCommand: "npm run start:console",
    startupMode: "daemon",
  };

  assert.ok(Array.isArray(manifest.capabilities));
  assert.equal(manifest.capabilities.length, 0);
  assert.ok(Array.isArray(manifest.requiredLayers));
  assert.equal(manifest.requiredLayers.length, 0);
});

test("PlatformAppManifest startupMode accepts daemon or job", () => {
  const daemonManifest: PlatformAppManifest = {
    appId: "daemon_app",
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
    appId: "job_app",
    kind: "worker",
    entryModule: "./worker.js",
    defaultPort: null,
    healthEndpoint: null,
    capabilities: [],
    requiredLayers: ["platform"],
    startupCommand: "npm run job",
    startupMode: "job",
  };

  assert.equal(daemonManifest.startupMode, "daemon");
  assert.equal(jobManifest.startupMode, "job");
});

test("PlatformAppManifest with all architecture layers", () => {
  const manifest: PlatformAppManifest = {
    appId: "full_stack_app",
    kind: "console",
    entryModule: "./console.js",
    defaultPort: 3000,
    healthEndpoint: "/health",
    capabilities: ["execution", "monitoring", "governance", "orchestration"],
    requiredLayers: [
      "platform",
      "domains",
      "interaction",
      "org-governance",
      "scale-ecosystem",
      "ops-maturity",
      "plugins",
      "sdk",
      "apps",
    ],
    startupCommand: "npm start",
    startupMode: "daemon",
  };

  assert.equal(manifest.requiredLayers.length, 9);
});

test("PlatformAppManifest port number boundaries", () => {
  const minPortManifest: PlatformAppManifest = {
    appId: "min_port",
    kind: "api",
    entryModule: "./api.js",
    defaultPort: 0,
    healthEndpoint: null,
    capabilities: [],
    requiredLayers: ["platform"],
    startupCommand: "npm start",
    startupMode: "daemon",
  };

  const maxPortManifest: PlatformAppManifest = {
    appId: "max_port",
    kind: "api",
    entryModule: "./api.js",
    defaultPort: 65535,
    healthEndpoint: null,
    capabilities: [],
    requiredLayers: ["platform"],
    startupCommand: "npm start",
    startupMode: "daemon",
  };

  assert.equal(minPortManifest.defaultPort, 0);
  assert.equal(maxPortManifest.defaultPort, 65535);
});

// ─────────────────────────────────────────────────────────────────────────────
// PlatformStartupTargetKind Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PlatformStartupTargetKind accepts summary and demo strings", () => {
  const validKinds: PlatformStartupTargetKind[] = ["summary", "demo"];

  for (const kind of validKinds) {
    assert.equal(typeof kind, "string");
  }
});

test("PlatformStartupTargetKind accepts PlatformAppKind values", () => {
  const apiKind: PlatformStartupTargetKind = "api";
  const consoleKind: PlatformStartupTargetKind = "console";
  const workerKind: PlatformStartupTargetKind = "worker";

  assert.equal(apiKind, "api");
  assert.equal(consoleKind, "console");
  assert.equal(workerKind, "worker");
});

// ─────────────────────────────────────────────────────────────────────────────
// PlatformStartupTarget Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PlatformStartupTarget with summary targetKind", () => {
  const target: PlatformStartupTarget = {
    targetKind: "summary",
    rootEntryModule: "./src/platform-architecture-bootstrap.js",
    description: "Platform summary view",
    requiredLayers: ["platform", "domains"],
    startupCommand: null,
    appManifest: null,
  };

  assert.equal(target.targetKind, "summary");
  assert.equal(target.rootEntryModule, "./src/platform-architecture-bootstrap.js");
  assert.equal(target.description, "Platform summary view");
  assert.ok(Array.isArray(target.requiredLayers));
  assert.equal(target.startupCommand, null);
  assert.equal(target.appManifest, null);
});

test("PlatformStartupTarget with app manifest", () => {
  const appManifest: PlatformAppManifest = {
    appId: "target_app",
    kind: "api",
    entryModule: "./api.js",
    defaultPort: 8080,
    healthEndpoint: "/health",
    capabilities: ["execution"],
    requiredLayers: ["platform"],
    startupCommand: "npm start",
    startupMode: "daemon",
  };

  const target: PlatformStartupTarget = {
    targetKind: "api",
    rootEntryModule: "./src/apps/api/index.js",
    description: "API application",
    requiredLayers: ["platform"],
    startupCommand: "npm start",
    appManifest,
  };

  assert.notEqual(target.appManifest, null);
  assert.equal(target.appManifest.appId, "target_app");
  assert.equal(target.appManifest.kind, "api");
});

test("PlatformStartupTarget with worker targetKind", () => {
  const target: PlatformStartupTarget = {
    targetKind: "worker",
    rootEntryModule: "./src/apps/workers/index.js",
    description: "Worker process",
    requiredLayers: ["platform"],
    startupCommand: "npm run worker",
    appManifest: null,
  };

  assert.equal(target.targetKind, "worker");
  assert.ok(target.startupCommand !== null);
  assert.ok(target.startupCommand.includes("worker"));
});

test("PlatformStartupTarget with demo targetKind", () => {
  const target: PlatformStartupTarget = {
    targetKind: "demo",
    rootEntryModule: "./demo.js",
    description: "Demo mode",
    requiredLayers: ["platform", "domains", "interaction"],
    startupCommand: "npm run demo",
    appManifest: null,
  };

  assert.equal(target.targetKind, "demo");
  assert.ok(target.requiredLayers.length >= 3);
});

test("PlatformStartupTarget with empty description", () => {
  const target: PlatformStartupTarget = {
    targetKind: "api",
    rootEntryModule: "./api.js",
    description: "",
    requiredLayers: [],
    startupCommand: null,
    appManifest: null,
  };

  assert.equal(target.description, "");
  assert.ok(Array.isArray(target.requiredLayers));
});

// ─────────────────────────────────────────────────────────────────────────────
// HarnessRunStatus Tests (Readiness Ring)
// ─────────────────────────────────────────────────────────────────────────────

test("HarnessRunStatus accepts all valid status values", () => {
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
  for (const status of statuses) {
    assert.equal(typeof status, "string");
  }
});

test("HarnessRunStatus terminal states", () => {
  const terminalStatuses: HarnessRunStatus[] = ["completed", "failed", "aborted"];

  for (const status of terminalStatuses) {
    assert.ok(
      ["completed", "failed", "aborted"].includes(status),
      `${status} should be terminal`
    );
  }
});

test("HarnessRunStatus active states", () => {
  const activeStatuses: HarnessRunStatus[] = [
    "running",
    "pausing",
    "paused",
    "resuming",
    "replanning",
    "compensating",
  ];

  for (const status of activeStatuses) {
    assert.ok(
      [
        "running",
        "pausing",
        "paused",
        "resuming",
        "replanning",
        "compensating",
      ].includes(status),
      `${status} should be active`
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// HarnessRun Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HarnessRun has all required readonly fields", () => {
  const run: HarnessRun = {
    harnessRunId: "run-123",
    tenantId: "tenant-456",
    confirmedTaskSpecId: "task-spec-789",
    requestEnvelopeId: "env-101",
    requestHash: "hash-202",
    status: "created",
    constraintPackRef: "constraints-303",
    versionLockId: "version-404",
    budgetLedgerId: "budget-505",
    currentSeq: 1,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  assert.equal(run.harnessRunId, "run-123");
  assert.equal(run.tenantId, "tenant-456");
  assert.equal(run.confirmedTaskSpecId, "task-spec-789");
  assert.equal(run.requestEnvelopeId, "env-101");
  assert.equal(run.requestHash, "hash-202");
  assert.equal(run.status, "created");
  assert.equal(run.constraintPackRef, "constraints-303");
  assert.equal(run.versionLockId, "version-404");
  assert.equal(run.budgetLedgerId, "budget-505");
  assert.equal(run.currentSeq, 1);
  assert.equal(run.createdAt, "2026-01-01T00:00:00Z");
  assert.equal(run.updatedAt, "2026-01-01T00:00:00Z");
  assert.equal(run.terminalAt, undefined);
  assert.equal(run.terminalReason, undefined);
});

test("HarnessRun with optional fields", () => {
  const run: HarnessRun = {
    harnessRunId: "run-123",
    tenantId: "tenant-456",
    confirmedTaskSpecId: "task-spec-789",
    requestEnvelopeId: "env-101",
    requestHash: "hash-202",
    status: "completed",
    constraintPackRef: "constraints-303",
    versionLockId: "version-404",
    planGraphBundleId: "bundle-606",
    budgetLedgerId: "budget-505",
    currentSeq: 42,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-02T00:00:00Z",
    terminalAt: "2026-01-02T00:00:00Z",
    terminalReason: "Task completed successfully",
  };

  assert.equal(run.planGraphBundleId, "bundle-606");
  assert.equal(run.terminalAt, "2026-01-02T00:00:00Z");
  assert.equal(run.terminalReason, "Task completed successfully");
});

test("HarnessRun status progression", () => {
  const statuses: HarnessRunStatus[] = [
    "created",
    "admitted",
    "planning",
    "ready",
    "running",
    "completed",
  ];

  for (const status of statuses) {
    const run: HarnessRun = {
      harnessRunId: `run-${status}`,
      tenantId: "tenant-456",
      confirmedTaskSpecId: "task-spec-789",
      requestEnvelopeId: "env-101",
      requestHash: "hash-202",
      status,
      constraintPackRef: "constraints-303",
      versionLockId: "version-404",
      budgetLedgerId: "budget-505",
      currentSeq: 1,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    assert.equal(run.status, status);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// NodeRunStatus Tests (Readiness Ring)
// ─────────────────────────────────────────────────────────────────────────────

test("NodeRunStatus accepts all valid status values", () => {
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
  for (const status of statuses) {
    assert.equal(typeof status, "string");
  }
});

test("NodeRunStatus terminal states", () => {
  const terminalStatuses: NodeRunStatus[] = [
    "succeeded",
    "failed",
    "skipped",
    "cancelled",
    "dependency_failed",
    "policy_blocked",
    "aborted",
  ];

  for (const status of terminalStatuses) {
    assert.ok(
      [
        "succeeded",
        "failed",
        "skipped",
        "cancelled",
        "dependency_failed",
        "policy_blocked",
        "aborted",
      ].includes(status),
      `${status} should be terminal`
    );
  }
});

test("NodeRunStatus non-terminal states", () => {
  const nonTerminalStatuses: NodeRunStatus[] = [
    "created",
    "ready",
    "leased",
    "running",
    "retry_wait",
    "awaiting_hitl",
    "reconciling",
  ];

  for (const status of nonTerminalStatuses) {
    assert.ok(
      [
        "created",
        "ready",
        "leased",
        "running",
        "retry_wait",
        "awaiting_hitl",
        "reconciling",
      ].includes(status),
      `${status} should be non-terminal`
    );
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// NodeRun Tests
// ─────────────────────────────────────────────────────────────────────────────

test("NodeRun has all required readonly fields", () => {
  const nodeRun: NodeRun = {
    nodeRunId: "node-run-123",
    harnessRunId: "run-456",
    planGraphBundleId: "bundle-789",
    graphVersion: 1,
    nodeId: "node-101",
    status: "created",
    attemptCount: 1,
    currentSeq: 1,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };

  assert.equal(nodeRun.nodeRunId, "node-run-123");
  assert.equal(nodeRun.harnessRunId, "run-456");
  assert.equal(nodeRun.planGraphBundleId, "bundle-789");
  assert.equal(nodeRun.graphVersion, 1);
  assert.equal(nodeRun.nodeId, "node-101");
  assert.equal(nodeRun.status, "created");
  assert.equal(nodeRun.attemptCount, 1);
  assert.equal(nodeRun.currentSeq, 1);
  assert.equal(nodeRun.createdAt, "2026-01-01T00:00:00Z");
  assert.equal(nodeRun.updatedAt, "2026-01-01T00:00:00Z");
});

test("NodeRun with lease fields", () => {
  const nodeRun: NodeRun = {
    nodeRunId: "node-run-123",
    harnessRunId: "run-456",
    planGraphBundleId: "bundle-789",
    graphVersion: 2,
    nodeId: "node-101",
    status: "leased",
    attemptCount: 2,
    leaseId: "lease-202",
    fencingToken: "fence-303",
    currentSeq: 5,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:01:00Z",
    terminalReason: "Lease acquired",
  };

  assert.equal(nodeRun.leaseId, "lease-202");
  assert.equal(nodeRun.fencingToken, "fence-303");
  assert.equal(nodeRun.terminalReason, "Lease acquired");
});

test("NodeRun status progression", () => {
  const progression: NodeRunStatus[] = [
    "created",
    "ready",
    "leased",
    "running",
    "succeeded",
  ];

  for (const status of progression) {
    const nodeRun: NodeRun = {
      nodeRunId: `node-${status}`,
      harnessRunId: "run-456",
      planGraphBundleId: "bundle-789",
      graphVersion: 1,
      nodeId: "node-101",
      status,
      attemptCount: 1,
      currentSeq: 1,
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-01-01T00:00:00Z",
    };
    assert.equal(nodeRun.status, status);
  }
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
  for (const type of nodeTypes) {
    assert.equal(typeof type, "string");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// DependencyType Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DependencyType accepts all valid values", () => {
  const depTypes: DependencyType[] = ["hard", "soft", "compensation", "retry", "replan"];

  assert.equal(depTypes.length, 5);
  for (const type of depTypes) {
    assert.equal(typeof type, "string");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// RiskClass Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RiskClass accepts all valid values", () => {
  const riskClasses: RiskClass[] = ["low", "medium", "high", "critical"];

  assert.equal(riskClasses.length, 4);
  for (const riskClass of riskClasses) {
    assert.equal(typeof riskClass, "string");
  }
});

test("RiskClass severity ordering", () => {
  const severityOrder: RiskClass[] = ["low", "medium", "high", "critical"];
  const expectedSeverities = ["low", "medium", "high", "critical"];

  assert.deepEqual(riskClassesToArray(), expectedSeverities);

  function riskClassesToArray(): RiskClass[] {
    return severityOrder;
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// BudgetResourceKind Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BudgetResourceKind accepts all valid values", () => {
  const resourceKinds: BudgetResourceKind[] = [
    "token",
    "tool",
    "api",
    "compute",
    "human",
    "side_effect",
    "other",
  ];

  assert.equal(resourceKinds.length, 7);
  for (const kind of resourceKinds) {
    assert.equal(typeof kind, "string");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// PlanNode Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PlanNode has all required fields", () => {
  const node: PlanNode = {
    nodeId: "node-123",
    nodeType: "tool",
    inputRefs: ["input-1", "input-2"],
    outputSchemaRef: "schema-456",
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
    retryPolicyRef: "retry-policy-789",
    timeoutMs: 30000,
  };

  assert.equal(node.nodeId, "node-123");
  assert.equal(node.nodeType, "tool");
  assert.deepEqual(node.inputRefs, ["input-1", "input-2"]);
  assert.equal(node.outputSchemaRef, "schema-456");
  assert.equal(node.riskClass, "low");
  assert.equal(node.budgetIntent.amount, 1000);
  assert.equal(node.budgetIntent.currency, "USD");
  assert.deepEqual(node.budgetIntent.resourceKinds, ["token"]);
  assert.equal(node.sideEffectProfile.mayCommitExternalEffect, false);
  assert.equal(node.sideEffectProfile.reversible, true);
  assert.equal(node.retryPolicyRef, "retry-policy-789");
  assert.equal(node.timeoutMs, 30000);
});

test("PlanNode with all node types", () => {
  const nodeTypes: PlanNodeType[] = [
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
      nodeId: `node-${nodeType}`,
      nodeType,
      inputRefs: [],
      outputSchemaRef: "schema",
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
      retryPolicyRef: "retry",
      timeoutMs: 10000,
    };
    assert.equal(node.nodeType, nodeType);
  }
});

test("PlanNode with high risk class", () => {
  const node: PlanNode = {
    nodeId: "risky-node",
    nodeType: "llm",
    inputRefs: ["user-input"],
    outputSchemaRef: "response-schema",
    riskClass: "critical",
    budgetIntent: {
      amount: 100000,
      currency: "USD",
      resourceKinds: ["token", "compute"],
    },
    sideEffectProfile: {
      mayCommitExternalEffect: true,
      reversible: false,
    },
    retryPolicyRef: "critical-retry",
    timeoutMs: 60000,
  };

  assert.equal(node.riskClass, "critical");
  assert.equal(node.sideEffectProfile.mayCommitExternalEffect, true);
  assert.equal(node.sideEffectProfile.reversible, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// PlanEdge Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PlanEdge has all required fields", () => {
  const edge: PlanEdge = {
    edgeId: "edge-123",
    fromNodeId: "node-a",
    toNodeId: "node-b",
    condition: null,
    dependencyType: "hard",
  };

  assert.equal(edge.edgeId, "edge-123");
  assert.equal(edge.fromNodeId, "node-a");
  assert.equal(edge.toNodeId, "node-b");
  assert.equal(edge.condition, null);
  assert.equal(edge.dependencyType, "hard");
});

test("PlanEdge with all dependency types", () => {
  const depTypes: DependencyType[] = ["hard", "soft", "compensation", "retry", "replan"];

  for (const depType of depTypes) {
    const edge: PlanEdge = {
      edgeId: `edge-${depType}`,
      fromNodeId: "node-a",
      toNodeId: "node-b",
      condition: null,
      dependencyType: depType,
    };
    assert.equal(edge.dependencyType, depType);
  }
});

test("PlanEdge with conditional edge", () => {
  const edge: PlanEdge = {
    edgeId: "conditional-edge",
    fromNodeId: "router-node",
    toNodeId: "branch-node",
    condition: { type: "regex", pattern: ".*" },
    dependencyType: "soft",
  };

  assert.ok(edge.condition !== null);
  assert.equal(edge.dependencyType, "soft");
});

// ─────────────────────────────────────────────────────────────────────────────
// PlanGraph Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PlanGraph has all required fields", () => {
  const graph: PlanGraph = {
    graphId: "graph-123",
    nodes: [],
    edges: [],
    entryNodeIds: [],
    terminalNodeIds: [],
    joinStrategy: "all",
    graphHash: "hash-abc",
  };

  assert.equal(graph.graphId, "graph-123");
  assert.ok(Array.isArray(graph.nodes));
  assert.ok(Array.isArray(graph.edges));
  assert.ok(Array.isArray(graph.entryNodeIds));
  assert.ok(Array.isArray(graph.terminalNodeIds));
  assert.equal(graph.joinStrategy, "all");
  assert.equal(graph.graphHash, "hash-abc");
});

test("PlanGraph with nodes and edges", () => {
  const graph: PlanGraph = {
    graphId: "graph-with-nodes",
    nodes: [
      {
        nodeId: "start",
        nodeType: "tool",
        inputRefs: [],
        outputSchemaRef: "out",
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
        retryPolicyRef: "retry",
        timeoutMs: 5000,
      },
      {
        nodeId: "end",
        nodeType: "llm",
        inputRefs: ["start"],
        outputSchemaRef: "out",
        riskClass: "medium",
        budgetIntent: {
          amount: 200,
          currency: "USD",
          resourceKinds: ["token"],
        },
        sideEffectProfile: {
          mayCommitExternalEffect: false,
          reversible: true,
        },
        retryPolicyRef: "retry",
        timeoutMs: 10000,
      },
    ],
    edges: [
      {
        edgeId: "e1",
        fromNodeId: "start",
        toNodeId: "end",
        condition: null,
        dependencyType: "hard",
      },
    ],
    entryNodeIds: ["start"],
    terminalNodeIds: ["end"],
    joinStrategy: "all",
    graphHash: "hash-def",
  };

  assert.equal(graph.nodes.length, 2);
  assert.equal(graph.edges.length, 1);
  assert.deepEqual(graph.entryNodeIds, ["start"]);
  assert.deepEqual(graph.terminalNodeIds, ["end"]);
});

test("PlanGraph joinStrategy values", () => {
  const strategies = ["all", "any", "first_success", "policy"] as const;

  for (const strategy of strategies) {
    const graph: PlanGraph = {
      graphId: `graph-${strategy}`,
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

test("ReadyNodeSchedulingPolicy accepts all strategy values", () => {
  const policies: ReadyNodeSchedulingPolicy[] = [
    { policyId: "p1", strategy: "deterministic_fifo" },
    { policyId: "p2", strategy: "priority_then_fifo" },
    { policyId: "p3", strategy: "risk_isolated" },
  ];

  assert.equal(policies.length, 3);
  assert.equal(policies[0].strategy, "deterministic_fifo");
  assert.equal(policies[1].strategy, "priority_then_fifo");
  assert.equal(policies[2].strategy, "risk_isolated");
});

// ─────────────────────────────────────────────────────────────────────────────
// GraphValidationReport Tests
// ─────────────────────────────────────────────────────────────────────────────

test("GraphValidationReport valid graph", () => {
  const report: GraphValidationReport = {
    valid: true,
    findings: [],
  };

  assert.equal(report.valid, true);
  assert.ok(Array.isArray(report.findings));
  assert.equal(report.findings.length, 0);
});

test("GraphValidationReport invalid graph with findings", () => {
  const report: GraphValidationReport = {
    valid: false,
    findings: ["Missing entry node", "Orphaned node detected"],
    normalizedNodeIds: ["node-1", "node-2"],
  };

  assert.equal(report.valid, false);
  assert.equal(report.findings.length, 2);
  assert.deepEqual(report.normalizedNodeIds, ["node-1", "node-2"]);
});

test("GraphValidationReport with normalized node IDs on valid graph", () => {
  const report: GraphValidationReport = {
    valid: true,
    findings: [],
    normalizedNodeIds: ["normalized-1", "normalized-2", "normalized-3"],
  };

  assert.equal(report.valid, true);
  assert.deepEqual(report.normalizedNodeIds, ["normalized-1", "normalized-2", "normalized-3"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// BudgetIntent Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BudgetIntent with multiple resource kinds", () => {
  const intent: BudgetIntent = {
    amount: 50000,
    currency: "USD",
    resourceKinds: ["token", "compute", "api"],
  };

  assert.equal(intent.amount, 50000);
  assert.equal(intent.currency, "USD");
  assert.equal(intent.resourceKinds.length, 3);
});

test("BudgetIntent with zero amount", () => {
  const intent: BudgetIntent = {
    amount: 0,
    currency: "USD",
    resourceKinds: [],
  };

  assert.equal(intent.amount, 0);
  assert.equal(intent.resourceKinds.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// SideEffectProfile Tests
// ─────────────────────────────────────────────────────────────────────────────

test("SideEffectProfile reversible false", () => {
  const profile: SideEffectProfile = {
    mayCommitExternalEffect: true,
    reversible: false,
  };

  assert.equal(profile.mayCommitExternalEffect, true);
  assert.equal(profile.reversible, false);
});

test("SideEffectProfile no external effect", () => {
  const profile: SideEffectProfile = {
    mayCommitExternalEffect: false,
    reversible: true,
  };

  assert.equal(profile.mayCommitExternalEffect, false);
  assert.equal(profile.reversible, true);
});

// ─────────────────────────────────────────────────────────────────────────────
// RiskPreview Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RiskPreview has risk class and reasons", () => {
  const preview: RiskPreview = {
    riskClass: "high",
    reasons: ["External API call", "User data access"],
  };

  assert.equal(preview.riskClass, "high");
  assert.equal(preview.reasons.length, 2);
  assert.equal(preview.reasons[0], "External API call");
});

test("RiskPreview critical risk", () => {
  const preview: RiskPreview = {
    riskClass: "critical",
    reasons: [
      "Writes to production database",
      "Sends email to external parties",
      "Modifies financial records",
    ],
  };

  assert.equal(preview.riskClass, "critical");
  assert.equal(preview.reasons.length, 3);
});

// ─────────────────────────────────────────────────────────────────────────────
// BudgetReservation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BudgetReservation has all required fields", () => {
  const reservation: BudgetReservation = {
    budgetReservationId: "res-123",
    budgetLedgerId: "ledger-456",
    harnessRunId: "run-789",
    amount: 5000,
    resourceKind: "token",
    status: "reserved",
    expiresAt: "2026-01-01T12:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
  };

  assert.equal(reservation.budgetReservationId, "res-123");
  assert.equal(reservation.budgetLedgerId, "ledger-456");
  assert.equal(reservation.harnessRunId, "run-789");
  assert.equal(reservation.nodeRunId, undefined);
  assert.equal(reservation.amount, 5000);
  assert.equal(reservation.resourceKind, "token");
  assert.equal(reservation.status, "reserved");
  assert.equal(reservation.expiresAt, "2026-01-01T12:00:00Z");
  assert.equal(reservation.createdAt, "2026-01-01T00:00:00Z");
});

test("BudgetReservation with nodeRunId", () => {
  const reservation: BudgetReservation = {
    budgetReservationId: "res-123",
    budgetLedgerId: "ledger-456",
    harnessRunId: "run-789",
    nodeRunId: "node-run-101",
    amount: 1000,
    resourceKind: "compute",
    status: "reserved",
    expiresAt: "2026-01-01T12:00:00Z",
    createdAt: "2026-01-01T00:00:00Z",
  };

  assert.equal(reservation.nodeRunId, "node-run-101");
});

test("BudgetReservation all status values", () => {
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
      budgetLedgerId: "ledger",
      harnessRunId: "run",
      amount: 100,
      resourceKind: "token",
      status,
      expiresAt: "2026-01-01T12:00:00Z",
      createdAt: "2026-01-01T00:00:00Z",
    };
    assert.equal(reservation.status, status);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// ArtifactRef Tests
// ─────────────────────────────────────────────────────────────────────────────

test("ArtifactRef with all fields", () => {
  const artifact: ArtifactRef = {
    artifactId: "artifact-123",
    uri: "s3://bucket/path/artifact.json",
    hash: "sha256-abc",
    version: "1.0.0",
  };

  assert.equal(artifact.artifactId, "artifact-123");
  assert.equal(artifact.uri, "s3://bucket/path/artifact.json");
  assert.equal(artifact.hash, "sha256-abc");
  assert.equal(artifact.version, "1.0.0");
});

test("ArtifactRef minimal", () => {
  const artifact: ArtifactRef = {
    artifactId: "minimal-artifact",
    uri: "file:///tmp/artifact",
  };

  assert.equal(artifact.artifactId, "minimal-artifact");
  assert.equal(artifact.uri, "file:///tmp/artifact");
  assert.equal(artifact.hash, undefined);
  assert.equal(artifact.version, undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// JsonValue Tests
// ─────────────────────────────────────────────────────────────────────────────

test("JsonValue null", () => {
  const value: JsonValue = null;
  assert.equal(value, null);
});

test("JsonValue boolean", () => {
  const trueValue: JsonValue = true;
  const falseValue: JsonValue = false;
  assert.equal(trueValue, true);
  assert.equal(falseValue, false);
});

test("JsonValue number", () => {
  const intValue: JsonValue = 42;
  const floatValue: JsonValue = 3.14159;
  const negativeValue: JsonValue = -100;
  assert.equal(intValue, 42);
  assert.equal(floatValue, 3.14159);
  assert.equal(negativeValue, -100);
});

test("JsonValue string", () => {
  const value: JsonValue = "hello world";
  assert.equal(value, "hello world");
});

test("JsonValue array", () => {
  const value: JsonValue = [1, "two", true, null];
  assert.ok(Array.isArray(value));
  assert.equal(value.length, 4);
  assert.equal(value[0], 1);
  assert.equal(value[1], "two");
  assert.equal(value[2], true);
  assert.equal(value[3], null);
});

test("JsonValue object", () => {
  const value: JsonValue = { key: "value", num: 123, nested: { a: 1 } };
  assert.ok(typeof value === "object" && value !== null && !Array.isArray(value));
  const obj = value as { key: string; num: number; nested: { a: number } };
  assert.equal(obj.key, "value");
  assert.equal(obj.num, 123);
  assert.equal(obj.nested.a, 1);
});

test("JsonValue nested structure", () => {
  const value: JsonValue = {
    users: [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ],
    metadata: {
      total: 2,
      page: 1,
    },
  };

  const obj = value as {
    users: readonly { id: number; name: string }[];
    metadata: { total: number; page: number };
  };
  assert.equal(obj.users.length, 2);
  assert.equal(obj.users[0].name, "Alice");
  assert.equal(obj.metadata.total, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// PlanGraphBundle Tests
// ─────────────────────────────────────────────────────────────────────────────

test("PlanGraphBundle has all required fields", () => {
  const bundle: PlanGraphBundle = {
    planGraphBundleId: "bundle-123",
    harnessRunId: "run-456",
    graphVersion: 1,
    graph: {
      graphId: "graph-789",
      nodes: [],
      edges: [],
      entryNodeIds: [],
      terminalNodeIds: [],
      joinStrategy: "all",
      graphHash: "hash-abc",
    },
    schedulerPolicy: {
      policyId: "policy-1",
      strategy: "deterministic_fifo",
    },
    budgetPlanRef: "budget-plan-1",
    riskProfile: {
      riskClass: "low",
      reasons: [],
    },
    validationReport: {
      valid: true,
      findings: [],
    },
    artifactRefs: [],
    createdAt: "2026-01-01T00:00:00Z",
  };

  assert.equal(bundle.planGraphBundleId, "bundle-123");
  assert.equal(bundle.harnessRunId, "run-456");
  assert.equal(bundle.graphVersion, 1);
  assert.ok(bundle.graph !== undefined);
  assert.equal(bundle.schedulerPolicy.policyId, "policy-1");
  assert.equal(bundle.budgetPlanRef, "budget-plan-1");
  assert.equal(bundle.riskProfile.riskClass, "low");
  assert.equal(bundle.validationReport.valid, true);
  assert.ok(Array.isArray(bundle.artifactRefs));
  assert.equal(bundle.createdAt, "2026-01-01T00:00:00Z");
});

test("PlanGraphBundle with artifact refs", () => {
  const bundle: PlanGraphBundle = {
    planGraphBundleId: "bundle-with-artifacts",
    harnessRunId: "run-456",
    graphVersion: 2,
    graph: {
      graphId: "graph-789",
      nodes: [],
      edges: [],
      entryNodeIds: [],
      terminalNodeIds: [],
      joinStrategy: "any",
      graphHash: "hash-def",
    },
    schedulerPolicy: {
      policyId: "policy-2",
      strategy: "priority_then_fifo",
    },
    budgetPlanRef: "budget-plan-2",
    riskProfile: {
      riskClass: "medium",
      reasons: ["User data involved"],
    },
    validationReport: {
      valid: true,
      findings: [],
      normalizedNodeIds: ["node-1"],
    },
    artifactRefs: [
      { artifactId: "artifact-1", uri: "s3://bucket/artifact-1.json" },
      { artifactId: "artifact-2", uri: "s3://bucket/artifact-2.json", hash: "sha256-xyz" },
    ],
    createdAt: "2026-01-01T00:00:00Z",
  };

  assert.equal(bundle.artifactRefs.length, 2);
  assert.equal(bundle.artifactRefs[0].artifactId, "artifact-1");
  assert.equal(bundle.artifactRefs[1].hash, "sha256-xyz");
});

// ─────────────────────────────────────────────────────────────────────────────
// Architecture Manifest Schema Integration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("Architecture manifest schema validation - complete manifest", () => {
  const manifest: PlatformAppManifest = {
    appId: "production-api",
    kind: "api",
    entryModule: "./src/apps/api/production.js",
    defaultPort: 8443,
    healthEndpoint: "/healthz",
    capabilities: ["execution", "monitoring", "logging", "auth"],
    requiredLayers: ["platform", "domains", "org-governance"],
    startupCommand: "npm run start:production",
    startupMode: "daemon",
  };

  assert.ok(manifest.appId.length > 0);
  assert.ok(["api", "console", "worker"].includes(manifest.kind));
  assert.ok(manifest.entryModule.endsWith(".js") || manifest.entryModule.endsWith(".ts"));
  assert.ok(typeof manifest.defaultPort === "number");
  assert.ok(manifest.defaultPort === null || (manifest.defaultPort >= 0 && manifest.defaultPort <= 65535));
  assert.ok(manifest.startupCommand.length > 0);
  assert.ok(["daemon", "job"].includes(manifest.startupMode));
});

test("Architecture manifest schema validation - minimal manifest", () => {
  const manifest: PlatformAppManifest = {
    appId: "minimal",
    kind: "worker",
    entryModule: "./worker.js",
    defaultPort: null,
    healthEndpoint: null,
    capabilities: [],
    requiredLayers: [],
    startupCommand: "node worker.js",
    startupMode: "job",
  };

  assert.equal(manifest.appId, "minimal");
  assert.equal(manifest.kind, "worker");
  assert.ok(manifest.capabilities.length === 0);
  assert.ok(manifest.requiredLayers.length === 0);
});

test("Startup target schema - demo mode", () => {
  const target: PlatformStartupTarget = {
    targetKind: "demo",
    rootEntryModule: "./demo/bootstrap.js",
    description: "Demo environment startup",
    requiredLayers: ["platform", "domains", "interaction"],
    startupCommand: "npm run demo",
    appManifest: null,
  };

  assert.equal(target.targetKind, "demo");
  assert.ok(target.requiredLayers.includes("platform"));
  assert.ok(target.requiredLayers.includes("interaction"));
});

test("Startup target schema - api mode with manifest", () => {
  const manifest: PlatformAppManifest = {
    appId: "startup-api",
    kind: "api",
    entryModule: "./startup-api.js",
    defaultPort: 3000,
    healthEndpoint: "/ready",
    capabilities: ["execution"],
    requiredLayers: ["platform"],
    startupCommand: "npm start",
    startupMode: "daemon",
  };

  const target: PlatformStartupTarget = {
    targetKind: "api",
    rootEntryModule: "./apps/api/index.js",
    description: "API startup",
    requiredLayers: ["platform"],
    startupCommand: "npm start",
    appManifest: manifest,
  };

  assert.equal(target.targetKind, "api");
  assert.notEqual(target.appManifest, null);
  assert.equal(target.appManifest?.appId, "startup-api");
});
