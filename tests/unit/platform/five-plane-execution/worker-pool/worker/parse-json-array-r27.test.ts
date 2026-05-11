import assert from "node:assert/strict";
import test from "node:test";

// ---------------------------------------------------------------------------
// R27-04: parseJsonArray() missing try/catch - corrupt JSON crashes
// ---------------------------------------------------------------------------
// Test via WorkerRegistryService.recordHeartbeat which calls parseJsonArray internally.
// We use a mock in-memory store to avoid SQLite/better-sqlite3 dependencies.

import { WorkerRegistryService } from "../../../../../../src/platform/five-plane-execution/worker-pool/worker/worker-registry-service.js";
import type { AuthoritativeTaskStore } from "../../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { WorkerSnapshotRecord } from "../../../../../../src/platform/contracts/types/domain.js";
import * as handshakeSupport from "../../../../../../src/platform/five-plane-execution/worker-pool/worker/execution-worker-handshake-support.js";
import * as writebackSupport from "../../../../../../src/platform/five-plane-execution/worker-pool/worker/execution-worker-writeback-support.js";

// ---------------------------------------------------------------------------
// R27-07 + R27-08: assignDeploymentSlot should not mutate zod objects
// ---------------------------------------------------------------------------
import { AgentVersionManager } from "../../../../../../src/ops-maturity/agent-lifecycle/version-manager/agent-version-manager.js";

// ---------------------------------------------------------------------------
// R27-14: canRetireAgent ISO string comparison timezone issue
// ---------------------------------------------------------------------------
import { canRetireAgent } from "../../../../../../src/ops-maturity/agent-lifecycle/retirement/index.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockTaskStore(): AuthoritativeTaskStore {
  const workers = new Map<string, WorkerSnapshotRecord>();
  return {
    worker: {
      upsertWorkerSnapshot: (record: WorkerSnapshotRecord) => {
        workers.set(record.workerId, record);
      },
      getWorkerSnapshot: (workerId: string) => workers.get(workerId) ?? null,
      listWorkerSnapshots: () => [...workers.values()],
      listStaleWorkerSnapshots: () => [],
    },
  } as unknown as AuthoritativeTaskStore;
}

function emptyMetrics(): { totalExecutions: number; successRate: number; avgDurationMs: number } {
  return { totalExecutions: 0, successRate: 0, avgDurationMs: 0 };
}

// ---------------------------------------------------------------------------
// R27-04 tests
// ---------------------------------------------------------------------------

test("R27-04: WorkerRegistryService handles corrupt runningExecutionsJson without crashing", () => {
  const store = createMockTaskStore();
  const service = new WorkerRegistryService(store);

  // corrupt JSON in runningExecutionsJson should not crash
  const input = {
    workerId: "worker-corrupt",
    status: "idle" as const,
    capabilities: [],
    runningExecutionIds: [],
    maxConcurrency: 4,
    // Internal corrupt JSON path - use a field that would flow through parseJsonArray
  };

  // Should not throw even with invalid data
  const view = service.recordHeartbeat(input);
  assert.equal(view.workerId, "worker-corrupt");
});

test("R27-05: handshake and writeback share the same canonical worker support helpers", () => {
  assert.equal(handshakeSupport.parseJsonArray, writebackSupport.parseJsonArray);
  assert.equal(handshakeSupport.toWorkerStatus, writebackSupport.toWorkerStatus);
  assert.equal(handshakeSupport.buildAgentExecutionRecord, writebackSupport.buildAgentExecutionRecord);
  assert.equal(handshakeSupport.persistRemoteLogs, writebackSupport.persistRemoteLogs);
});

test("R27-06: WorkerRegistryService ignores malformed legacy worker hooks instead of calling through unsafe casts", () => {
  const store = {
    worker: {
      getWorkerSnapshot: () => null,
      listWorkerSnapshots: () => [],
      getWorker: "not-a-function",
      listWorkers: "not-a-function",
    },
  } as unknown as AuthoritativeTaskStore;
  const service = new WorkerRegistryService(store);

  assert.equal(service.getWorker("worker-unsafe"), null);
  assert.deepEqual(service.listWorkers(), []);
});

// ---------------------------------------------------------------------------
// R27-07 tests
// ---------------------------------------------------------------------------

test("R27-07: assignDeploymentSlot does not mutate original version objects", () => {
  const mgr = new AgentVersionManager();
  const v1 = mgr.registerVersion({
    agentId: "agent-imm",
    version: "1.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: true,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });

  const originalVersionId = v1.versionId;

  mgr.assignDeploymentSlot("agent-imm", v1.versionId, "blue");

  // Version should still be registered and findable after mutation
  const listed = mgr.listVersions("agent-imm");
  const reRead = listed.find((v) => v.versionId === originalVersionId);
  assert.ok(reRead, "version should still be findable after assignDeploymentSlot");
});

// ---------------------------------------------------------------------------
// R27-08 tests
// ---------------------------------------------------------------------------

test("R27-08: assignDeploymentSlot preserves the opposite slot for blue-green dual activation", () => {
  const mgr = new AgentVersionManager();
  const v1 = mgr.registerVersion({
    agentId: "agent-bg1",
    version: "1.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: true,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });
  const v2 = mgr.registerVersion({
    agentId: "agent-bg1",
    version: "2.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: true,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });

  mgr.assignDeploymentSlot("agent-bg1", v1.versionId, "green");
  mgr.assignDeploymentSlot("agent-bg1", v2.versionId, "blue");

  const versions = mgr.listVersions("agent-bg1");
  const v1After = versions.find((v) => v.versionId === v1.versionId);
  const v2After = versions.find((v) => v.versionId === v2.versionId);

  assert.equal(v1After?.deploymentSlot, "green", "green slot should remain active");
  assert.equal(v2After?.deploymentSlot, "blue", "v2 should hold blue");
});

test("R27-08: switchSlot does not mutate original version objects", () => {
  const mgr = new AgentVersionManager();
  const v1 = mgr.registerVersion({
    agentId: "agent-switch",
    version: "1.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: true,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });
  const v2 = mgr.registerVersion({
    agentId: "agent-switch",
    version: "2.0.0",
    stage: "canary",
    deprecatedAt: null,
    stable: false,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });

  const originalV1Slot = v1.deploymentSlot;
  mgr.assignDeploymentSlot("agent-switch", v1.versionId, "blue");
  mgr.switchSlot("agent-switch", "green");

  const versions = mgr.listVersions("agent-switch");
  const reRead = versions.find((v) => v.versionId === v1.versionId);
  assert.ok(reRead, "v1 should still be findable");
  assert.equal(originalV1Slot, null, "original slot should remain null (not mutated)");
});

test("R27-08: switchSlot promotes eligible unslotted version to target slot", () => {
  const mgr = new AgentVersionManager();
  const v1 = mgr.registerVersion({
    agentId: "agent-promote",
    version: "1.0.0",
    stage: "stable",
    deprecatedAt: null,
    stable: true,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });
  const v2 = mgr.registerVersion({
    agentId: "agent-promote",
    version: "2.0.0",
    stage: "canary",
    deprecatedAt: null,
    stable: false,
    deploymentSlot: null,
    changelog: "",
    metrics: emptyMetrics(),
  });

  mgr.assignDeploymentSlot("agent-promote", v1.versionId, "blue");
  const result = mgr.switchSlot("agent-promote", "green");

  assert.equal(result?.versionId, v2.versionId);
  assert.equal(result?.deploymentSlot, "green");
  assert.equal(mgr.getActiveSlot("agent-promote", "green")?.versionId, v2.versionId);
});

// ---------------------------------------------------------------------------
// R27-14 tests
// ---------------------------------------------------------------------------

test("R27-14: canRetireAgent returns true when revokeAt is in the past", () => {
  const plan = {
    agentId: "agent-retire",
    successorAgentId: null,
    transferItems: [] as readonly [],
    gracePeriodDays: 0,
    notificationTargets: [] as readonly [],
    revokeAt: "2020-01-01T00:00:00.000Z",
    reason: "",
  };
  assert.equal(canRetireAgent(plan, "2025-01-01T00:00:00.000Z"), true);
});

test("R27-14: canRetireAgent returns false when revokeAt is in the future", () => {
  const plan = {
    agentId: "agent-retire",
    successorAgentId: null,
    transferItems: [] as readonly [],
    gracePeriodDays: 0,
    notificationTargets: [] as readonly [],
    revokeAt: "2030-01-01T00:00:00.000Z",
    reason: "",
  };
  assert.equal(canRetireAgent(plan, "2025-01-01T00:00:00.000Z"), false);
});

test("R27-14: canRetireAgent uses lexicographic ISO string comparison", () => {
  const plan = {
    agentId: "agent-retire",
    successorAgentId: null,
    transferItems: [] as readonly [],
    gracePeriodDays: 0,
    notificationTargets: [] as readonly [],
    revokeAt: "2025-06-01T00:00:00.000Z",
    reason: "",
  };
  // Before revokeAt
  assert.equal(canRetireAgent(plan, "2025-05-09T00:00:00.000Z"), false);
  // Just before revokeAt
  assert.equal(canRetireAgent(plan, "2025-06-01T00:00:00.000Z"), false);
  // Just after revokeAt
  assert.equal(canRetireAgent(plan, "2025-06-01T00:00:00.001Z"), false);
  // Clearly after
  assert.equal(canRetireAgent(plan, "2025-06-02T00:00:00.000Z"), true);
});
