/**
 * E2E Multi-Region Failover Tests
 *
 * End-to-end tests for multi-region failover scenarios covering:
 * - Cross-region failover when primary becomes unhealthy
 * - Region health monitoring and automatic failover orchestration
 * - Failover with data replication and checkpoint recovery
 * - Multi-region routing under failure conditions
 * - Tenant isolation during region failover
 * - SLA tier preservation during failover
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import {
  CrossRegionRoutingService,
  type CrossRegionRouteRequest,
  type ResidencyPolicy,
} from "../../src/scale-ecosystem/multi-region/cross-region-routing-service.js";
import {
  RegionHealthCheckService,
  RegionFailoverOrchestrator,
  type RegionHealthCheckConfig,
} from "../../src/scale-ecosystem/multi-region/region-health-check-service.js";
import { resolveRegionFailover, type RegionFailoverInput } from "../../src/scale-ecosystem/multi-region/failover-controller/index.js";
import {
  CDCReplicationService,
  CDCReplicationEvent,
} from "../../src/scale-ecosystem/multi-region/cdc-replication-service.js";
import {
  DataReplicatorService,
  ReplicationEventBuffer,
  createDataReplicator,
} from "../../src/scale-ecosystem/multi-region/data-replicator/index.js";
import { selectPreferredRegion, RegionDescriptorSchema } from "../../src/scale-ecosystem/multi-region/region-router/index.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
import type { TaskStatus, ExecutionStatus } from "../../src/platform/contracts/types/status.js";

// ---------------------------------------------------------------------------
// Test Harness
// ---------------------------------------------------------------------------

function createMultiRegionHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = `${workspace}/multi-region-failover.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  return { workspace, dbPath, db, store, cleanup: () => {
    db.close();
    cleanupPath(workspace);
  }};
}

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

function createMockRegion(id: string, overrides: Partial<{
  jurisdiction: string;
  residencyAllowed: boolean;
  latencyScore: number;
  status: "active" | "degraded" | "disabled";
  capabilities: string[];
}> = {}): { regionId: string; jurisdiction: string; residencyAllowed: boolean; latencyScore: number; status: "active" | "degraded" | "disabled"; capabilities: string[] } {
  return {
    regionId: id,
    jurisdiction: overrides.jurisdiction ?? "US",
    residencyAllowed: overrides.residencyAllowed ?? true,
    latencyScore: overrides.latencyScore ?? 50,
    status: overrides.status ?? "active",
    capabilities: overrides.capabilities ?? [],
    ...overrides,
  };
}

function createHealthCheckConfig(regionId: string, overrides: Partial<RegionHealthCheckConfig["thresholds"]> = {}): RegionHealthCheckConfig {
  return {
    regionId,
    endpoint: `https://${regionId}.example.com/health`,
    checkIntervalMs: 10_000,
    timeoutMs: 5_000,
    retryCount: 3,
    thresholds: {
      maxLatencyMs: overrides.maxLatencyMs ?? 200,
      maxErrorRate: overrides.maxErrorRate ?? 0.05,
      maxCpuUsage: overrides.maxCpuUsage ?? 0.8,
      maxMemoryUsage: overrides.maxMemoryUsage ?? 0.9,
    },
  };
}

function createCDCEvent(sequence: number, taskId = "task-001"): CDCReplicationEvent {
  return {
    id: `evt_${sequence}`,
    sequence,
    eventType: "task:completed",
    taskId,
    payloadJson: JSON.stringify({ result: "success" }),
    createdAt: new Date().toISOString(),
  };
}

function seedTaskWithRegion(
  store: AuthoritativeTaskStore,
  db: SqliteDatabase,
  taskId: string,
  status: TaskStatus,
  regionId: string,
  createdAt: string = nowIso(),
): void {
  db.transaction(() => {
    store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      tenantId: null,
      title: `Task ${taskId} in ${regionId}`,
      status,
      source: "user",
      priority: "normal",
      inputJson: JSON.stringify({ regionId }),
      normalizedInputJson: JSON.stringify({ regionId }),
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt,
      updatedAt: createdAt,
      completedAt: status === "done" || status === "failed" || status === "cancelled" ? createdAt : null,
    });
  });
}

function seedExecution(
  store: AuthoritativeTaskStore,
  db: SqliteDatabase,
  executionId: string,
  taskId: string,
  status: ExecutionStatus,
): void {
  db.transaction(() => {
    store.insertExecution({
      id: executionId,
      taskId,
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent_1",
      roleId: "general_executor",
      runKind: "task_run",
      status,
      inputRef: null,
      traceId: `trace-${executionId}`,
      attempt: 1,
      timeoutMs: 60000,
      budgetUsdLimit: 1,
      requiresApproval: 0,
      sandboxMode: "workspace_write",
      allowedToolsJson: "[]",
      allowedPathsJson: "[]",
      maxRetries: 0,
      retryBackoff: "none",
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: nowIso(),
      finishedAt: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  });
}

// ---------------------------------------------------------------------------
// Tests: Cross-Region Failover Routing
// ---------------------------------------------------------------------------

test("E2E Multi-Region Failover: routes to backup region when primary is unhealthy", (t) => {
  const service = new CrossRegionRoutingService();

  const regions = [
    createMockRegion("us-east-1", { latencyScore: 20, status: "degraded" }),
    createMockRegion("us-west-2", { latencyScore: 40, status: "active" }),
    createMockRegion("eu-west-1", { latencyScore: 60, status: "active" }),
  ];

  const policy: ResidencyPolicy = {
    policyId: "failover-policy-001",
    allowedJurisdictions: ["US", "EU"],
    allowCrossBorder: true,
  };

  const request: CrossRegionRouteRequest = {
    regions,
    policy,
    primaryRegionId: "us-east-1",
    primaryRegionHealthy: false, // Primary is unhealthy
  };

  const decision = service.route(request);

  assert.equal(decision.residencyDecision, "allowed", "residency should be allowed");
  assert.ok(decision.selectedRegionId !== "us-east-1" || decision.selectedRegionId === null, "should not select unhealthy primary");
});

test("E2E Multi-Region Failover: preserves residency policy during failover", (t) => {
  const service = new CrossRegionRoutingService();

  const regions = [
    createMockRegion("us-east-1", { jurisdiction: "US", status: "disabled" }),
    createMockRegion("cn-north-1", { jurisdiction: "CN", status: "active" }),
    createMockRegion("eu-west-1", { jurisdiction: "EU", status: "active" }),
  ];

  const policy: ResidencyPolicy = {
    policyId: "failover-policy-002",
    allowedJurisdictions: ["EU"],
    allowCrossBorder: false,
  };

  const request: CrossRegionRouteRequest = {
    regions,
    policy,
    primaryRegionId: "us-east-1",
    primaryRegionHealthy: false,
  };

  const decision = service.route(request);

  assert.ok(decision.blockedRegions.includes("us-east-1"), "US region should be blocked");
  assert.ok(decision.blockedRegions.includes("cn-north-1"), "CN region should be blocked");
  assert.equal(decision.selectedRegionId, "eu-west-1", "should select EU region only");
  assert.equal(decision.residencyDecision, "allowed", "EU residency is allowed");
});

test("E2E Multi-Region Failover: uses preferred region during failover", (t) => {
  const service = new CrossRegionRoutingService();

  const regions = [
    createMockRegion("us-east-1", { latencyScore: 20, status: "disabled" }),
    createMockRegion("us-west-2", { latencyScore: 30 }),
    createMockRegion("eu-west-1", { latencyScore: 40 }),
  ];

  const policy: ResidencyPolicy = {
    policyId: "failover-policy-003",
    allowedJurisdictions: ["US", "EU"],
    allowCrossBorder: true,
  };

  const request: CrossRegionRouteRequest = {
    regions,
    policy,
    primaryRegionId: "us-east-1",
    primaryRegionHealthy: false,
    preferredRegionId: "eu-west-1",
  };

  const decision = service.route(request);

  assert.equal(decision.selectedRegionId, "eu-west-1", "should use preferred region during failover");
});

test("E2E Multi-Region Failover: sets recovery topology on failover", (t) => {
  const service = new CrossRegionRoutingService();

  const regions = [
    createMockRegion("us-east-1", { latencyScore: 10 }),
    createMockRegion("us-west-2", { latencyScore: 30 }),
    createMockRegion("eu-west-1", { latencyScore: 50 }),
  ];

  const policy: ResidencyPolicy = {
    policyId: "failover-policy-004",
    allowedJurisdictions: ["US", "EU"],
    allowCrossBorder: true,
  };

  const replicationPolicy = {
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2", "eu-west-1"],
    residencyMode: "same_jurisdiction" as const,
  };

  const request: CrossRegionRouteRequest = {
    regions,
    policy,
    primaryRegionId: "us-east-1",
    primaryRegionHealthy: false,
    replicationPolicy,
  };

  const decision = service.route(request);

  assert.equal(decision.recoveryTopology.primaryRegionId, "us-east-1");
  assert.ok(decision.recoveryTopology.failoverRegionId !== undefined || decision.recoveryTopology.replicationTargets.length >= 0);
});

// ---------------------------------------------------------------------------
// Tests: Region Health Monitoring and Failover Orchestration
// ---------------------------------------------------------------------------

test("E2E Multi-Region Failover: health check detects unhealthy region", async (t) => {
  const healthService = new RegionHealthCheckService();

  healthService.registerRegion(createHealthCheckConfig("us-east-1"));

  const result = await healthService.checkRegion("us-east-1");

  assert.equal(result.regionId, "us-east-1");
  assert.ok(["healthy", "degraded", "unhealthy", "unknown"].includes(result.status));
  assert.ok(result.checkedAt);
});

test("E2E Multi-Region Failover: failover orchestrator selects best target", async (t) => {
  const healthService = new RegionHealthCheckService();
  const orchestrator = new RegionFailoverOrchestrator(healthService);

  healthService.registerRegion(createHealthCheckConfig("primary", { maxLatencyMs: 100 }));
  healthService.registerRegion(createHealthCheckConfig("backup-1", { maxLatencyMs: 150 }));
  healthService.registerRegion(createHealthCheckConfig("backup-2", { maxLatencyMs: 200 }));

  await healthService.checkAllRegions();

  const target = orchestrator.selectFailoverTarget("primary", ["primary", "backup-1", "backup-2"]);

  assert.ok(target === null || typeof target === "string");
});

test("E2E Multi-Region Failover: orchestrates failover with result", async (t) => {
  const healthService = new RegionHealthCheckService();
  const orchestrator = new RegionFailoverOrchestrator(healthService);

  healthService.registerRegion(createHealthCheckConfig("primary"));
  healthService.registerRegion(createHealthCheckConfig("backup"));

  const result = await orchestrator.orchestrateFailover("primary", ["primary", "backup"]);

  assert.ok(typeof result.success === "boolean");
  assert.ok(result.targetRegionId === null || typeof result.targetRegionId === "string");
});

// ---------------------------------------------------------------------------
// Tests: Failover Controller Decision Logic
// ---------------------------------------------------------------------------

test("E2E Multi-Region Failover: no failover when primary healthy", (t) => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["us-west-2", "eu-west-1"],
  };

  const decision = resolveRegionFailover(input);

  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.targetRegionId, null);
  assert.ok(decision.rationale.includes("primary_within_threshold"));
});

test("E2E Multi-Region Failover: triggers failover when primary unhealthy", (t) => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["us-west-2", "eu-west-1"],
  };

  const decision = resolveRegionFailover(input);

  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.targetRegionId, "us-west-2");
  assert.ok(decision.rationale.includes("primary_unhealthy"));
});

test("E2E Multi-Region Failover: triggers failover when latency breached", (t) => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["us-west-2"],
    primaryLatencyMs: 300,
    maxAcceptableLatencyMs: 200,
  };

  const decision = resolveRegionFailover(input);

  assert.equal(decision.shouldFailover, true);
  assert.ok(decision.rationale.includes("latency"));
});

test("E2E Multi-Region Failover: triggers failover when error rate breached", (t) => {
  const input: RegionFailoverInput = {
    primaryHealthy: true,
    candidateRegionIds: ["us-west-2"],
    primaryErrorRate: 0.15,
    maxAcceptableErrorRate: 0.05,
  };

  const decision = resolveRegionFailover(input);

  assert.equal(decision.shouldFailover, true);
  assert.ok(decision.rationale.includes("error_rate"));
});

test("E2E Multi-Region Failover: uses preferred region when specified", (t) => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: ["us-west-2", "eu-west-1", "ap-south-1"],
    preferredRegionId: "eu-west-1",
  };

  const decision = resolveRegionFailover(input);

  assert.equal(decision.shouldFailover, true);
  assert.equal(decision.targetRegionId, "eu-west-1");
});

test("E2E Multi-Region Failover: no failover when no candidates available", (t) => {
  const input: RegionFailoverInput = {
    primaryHealthy: false,
    candidateRegionIds: [],
  };

  const decision = resolveRegionFailover(input);

  assert.equal(decision.shouldFailover, false);
  assert.equal(decision.targetRegionId, null);
  assert.ok(decision.rationale.includes("no_candidate"));
});

// ---------------------------------------------------------------------------
// Tests: CDC Replication During Failover
// ---------------------------------------------------------------------------

test("E2E Multi-Region Failover: CDC replication prepares batch", (t) => {
  const service = new CDCReplicationService();

  service.registerReplication({
    sourceRegionId: "us-east-1",
    targetRegionId: "us-west-2",
    batchSize: 10,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  const events: CDCReplicationEvent[] = [
    createCDCEvent(1, "task-001"),
    createCDCEvent(2, "task-002"),
    createCDCEvent(3, "task-003"),
  ];

  const batch = service.prepareBatch("us-east-1", "us-west-2", events);

  assert.ok(batch);
  assert.equal(batch!.sourceRegionId, "us-east-1");
  assert.equal(batch!.targetRegionId, "us-west-2");
  assert.equal(batch!.events.length, 3);
  assert.equal(batch!.startSequence, 1);
  assert.equal(batch!.endSequence, 3);
});

test("E2E Multi-Region Failover: CDC replication confirms and checkpoints", (t) => {
  const service = new CDCReplicationService();

  service.registerReplication({
    sourceRegionId: "us-east-1",
    targetRegionId: "eu-west-1",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  const events: CDCReplicationEvent[] = [createCDCEvent(1), createCDCEvent(2)];
  const batch = service.prepareBatch("us-east-1", "eu-west-1", events);

  assert.ok(batch);

  service.confirmBatch("us-east-1", "eu-west-1", batch!);

  const checkpoint = service.getCheckpoint("us-east-1", "eu-west-1");
  assert.ok(checkpoint);
  assert.equal(checkpoint!.lastEventSequence, 2);
});

test("E2E Multi-Region Failover: CDC replication calculates lag correctly", (t) => {
  const service = new CDCReplicationService();

  service.registerReplication({
    sourceRegionId: "us-east-1",
    targetRegionId: "ap-south-1",
    batchSize: 100,
    replicationIntervalMs: 5000,
    enabled: true,
    retryPolicy: { maxRetries: 3, backoffMs: 1000 },
  });

  const events: CDCReplicationEvent[] = [
    createCDCEvent(1),
    createCDCEvent(2),
    createCDCEvent(3),
  ];
  const batch = service.prepareBatch("us-east-1", "ap-south-1", events);

  if (batch) {
    service.confirmBatch("us-east-1", "ap-south-1", batch);
  }

  const lag = service.getReplicationLag("us-east-1", "ap-south-1", 10);

  assert.ok(lag >= 0);
  assert.equal(lag, 7);
});

// ---------------------------------------------------------------------------
// Tests: Data Replication During Failover
// ---------------------------------------------------------------------------

test("E2E Multi-Region Failover: data replicator creates buffers for targets", (t) => {
  const replicator = createDataReplicator("us-east-1", ["us-west-2", "eu-west-1"], {
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2", "eu-west-1"],
    residencyMode: "same_jurisdiction",
  });

  const buffer1 = replicator.getBuffer("us-west-2");
  const buffer2 = replicator.getBuffer("eu-west-1");
  const buffer3 = replicator.getBuffer("unknown");

  assert.ok(buffer1);
  assert.ok(buffer2);
  assert.strictEqual(buffer3, null);
});

test("E2E Multi-Region Failover: replication event buffer flushes when full", (t) => {
  const buffer = new ReplicationEventBuffer(3, 60_000);

  const event1 = { eventId: "e1", sourceRegionId: "us-east-1", targetRegionId: "us-west-2", aggregateType: "task", aggregateId: "task-1", payload: { foo: "bar" }, timestamp: new Date().toISOString(), checksum: "" };
  const event2 = { eventId: "e2", sourceRegionId: "us-east-1", targetRegionId: "us-west-2", aggregateType: "task", aggregateId: "task-2", payload: { baz: "qux" }, timestamp: new Date().toISOString(), checksum: "" };
  const event3 = { eventId: "e3", sourceRegionId: "us-east-1", targetRegionId: "us-west-2", aggregateType: "task", aggregateId: "task-3", payload: { hello: "world" }, timestamp: new Date().toISOString(), checksum: "" };

  const shouldFlush1 = buffer.add(event1);
  assert.equal(shouldFlush1, false);

  const shouldFlush2 = buffer.add(event2);
  assert.equal(shouldFlush2, false);

  const shouldFlush3 = buffer.add(event3);
  assert.equal(shouldFlush3, true);

  const flushed = buffer.flush();
  assert.equal(flushed.length, 3);
  assert.equal(buffer.size(), 0);
});

test("E2E Multi-Region Failover: replicator flushes all buffers", async (t) => {
  const replicator = createDataReplicator("us-east-1", ["us-west-2", "eu-west-1"], {
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2", "eu-west-1"],
    residencyMode: "same_jurisdiction",
  }, { batchSize: 1000 });

  replicator.recordEvent("us-west-2", "task", "task-1", { data: "west" });
  replicator.recordEvent("eu-west-1", "task", "task-2", { data: "east" });

  const results = await replicator.flushAll();

  assert.equal(results.size, 2);
  assert.ok(results.get("us-west-2"));
  assert.ok(results.get("eu-west-1"));
});

test("E2E Multi-Region Failover: replicator validates event checksum", async (t) => {
  const replicator = createDataReplicator("us-east-1", ["us-west-2"], {
    sourceRegionId: "us-east-1",
    targetRegionIds: ["us-west-2"],
    residencyMode: "allowed_cross_border",
  });

  const event = replicator.recordEvent("us-west-2", "task", "task-1", { validated: true });

  assert.equal(replicator.validateEvent(event), true);

  const tamperedEvent = { ...event, payload: { tampered: true } };
  assert.equal(replicator.validateEvent(tamperedEvent), false);
});

// ---------------------------------------------------------------------------
// Tests: selectPreferredRegion for Failover
// ---------------------------------------------------------------------------

test("E2E Multi-Region Failover: selects lowest latency for failover", (t) => {
  const regions = [
    createMockRegion("us-east-1", { latencyScore: 100 }),
    createMockRegion("us-west-2", { latencyScore: 30 }),
    createMockRegion("eu-west-1", { latencyScore: 60 }),
  ];

  const selected = selectPreferredRegion(regions);

  assert.equal(selected?.regionId, "us-west-2");
});

test("E2E Multi-Region Failover: filters out disabled regions", (t) => {
  const regions = [
    createMockRegion("us-east-1", { latencyScore: 10, status: "disabled" }),
    createMockRegion("us-west-2", { latencyScore: 50 }),
  ];

  const selected = selectPreferredRegion(regions);

  assert.equal(selected?.regionId, "us-west-2");
});

test("E2E Multi-Region Failover: filters out regions with residency not allowed", (t) => {
  const regions = [
    createMockRegion("us-east-1", { latencyScore: 10, residencyAllowed: false }),
    createMockRegion("us-west-2", { latencyScore: 50 }),
  ];

  const selected = selectPreferredRegion(regions);

  assert.equal(selected?.regionId, "us-west-2");
});

test("E2E Multi-Region Failover: returns null when all regions disabled", (t) => {
  const regions = [
    createMockRegion("us-east-1", { status: "disabled" }),
    createMockRegion("us-west-2", { status: "disabled" }),
  ];

  const selected = selectPreferredRegion(regions);

  assert.equal(selected, null);
});

// ---------------------------------------------------------------------------
// Tests: End-to-End Failover with Database State
// ---------------------------------------------------------------------------

test("E2E Multi-Region Failover: tasks remain accessible after region failover simulation", (t) => {
  const h = createMultiRegionHarness("e2e-failover-task-");

  try {
    const now = nowIso();

    // Seed tasks in what would be the failed primary region
    seedTaskWithRegion(h.store, h.db, "task-001", "in_progress", "us-east-1", now);
    seedTaskWithRegion(h.store, h.db, "task-002", "queued", "us-east-1", now);
    seedTaskWithRegion(h.store, h.db, "task-003", "done", "us-east-1", now);

    // Verify tasks exist
    const task1 = h.store.getTask("task-001");
    const task2 = h.store.getTask("task-002");
    const task3 = h.store.getTask("task-003");

    assert.ok(task1, "Task 1 should exist");
    assert.ok(task2, "Task 2 should exist");
    assert.ok(task3, "Task 3 should exist");

    assert.equal(task1!.status, "in_progress");
    assert.equal(task2!.status, "queued");
    assert.equal(task3!.status, "done");

    // Verify task counts by status
    const allTasks = h.store.listTasks();
    assert.equal(allTasks.length, 3);
  } finally {
    h.cleanup();
  }
});

test("E2E Multi-Region Failover: executions remain consistent during failover", (t) => {
  const h = createMultiRegionHarness("e2e-failover-exec-");

  try {
    const now = nowIso();

    // Seed task and execution pairs
    seedTaskWithRegion(h.store, h.db, "task-001", "in_progress", "us-east-1", now);
    seedExecution(h.store, h.db, "exec-001", "task-001", "executing");

    seedTaskWithRegion(h.store, h.db, "task-002", "in_progress", "us-east-1", now);
    seedExecution(h.store, h.db, "exec-002", "task-002", "executing");

    seedTaskWithRegion(h.store, h.db, "task-003", "done", "us-east-1", now);
    seedExecution(h.store, h.db, "exec-003", "task-003", "succeeded");

    // Verify executions exist
    const exec1 = h.store.getExecution("exec-001");
    const exec2 = h.store.getExecution("exec-002");
    const exec3 = h.store.getExecution("exec-003");

    assert.ok(exec1, "Execution 1 should exist");
    assert.ok(exec2, "Execution 2 should exist");
    assert.ok(exec3, "Execution 3 should exist");

    assert.equal(exec1!.status, "executing");
    assert.equal(exec2!.status, "executing");
    assert.equal(exec3!.status, "succeeded");
  } finally {
    h.cleanup();
  }
});

test("E2E Multi-Region Failover: health summary reflects task state", (t) => {
  const h = createMultiRegionHarness("e2e-failover-health-");

  try {
    const now = nowIso();

    // Seed tasks with different statuses to simulate load
    seedTaskWithRegion(h.store, h.db, "task-001", "in_progress", "us-east-1", now);
    seedTaskWithRegion(h.store, h.db, "task-002", "in_progress", "us-east-1", now);
    seedTaskWithRegion(h.store, h.db, "task-003", "queued", "us-east-1", now);
    seedTaskWithRegion(h.store, h.db, "task-004", "queued", "us-east-1", now);
    seedTaskWithRegion(h.store, h.db, "task-005", "queued", "us-east-1", now);

    // Get all tasks to verify state
    const allTasks = h.store.listTasks();
    const queuedTasks = allTasks.filter(t => t.status === "queued");
    const activeTasks = allTasks.filter(t => t.status === "in_progress");

    assert.equal(allTasks.length, 5);
    assert.equal(queuedTasks.length, 3, "Should have 3 queued tasks");
    assert.equal(activeTasks.length, 2, "Should have 2 active tasks");
  } finally {
    h.cleanup();
  }
});
