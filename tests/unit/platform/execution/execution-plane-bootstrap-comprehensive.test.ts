/**
 * @fileoverview Unit tests for Execution Plane Bootstrap
 * Tests: buildExecutionPlaneBootstrap, resolveExecutionCapabilityBaseline
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildExecutionPlaneBootstrap,
  EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID,
  EXECUTION_PLANE_CATALOG_SERVICE_ID,
  registerExecutionPlaneBootstrap,
} from "../../../../src/platform/five-plane-execution/execution-plane-bootstrap.js";
import {
  listExecutionCapabilityBaselines,
  resolveExecutionCapabilityBaseline,
} from "../../../../src/platform/five-plane-execution/execution-plane-baseline.js";
import type { ExecutionCapabilityId } from "../../../../src/platform/five-plane-execution/execution-plane-baseline.js";

// ---------------------------------------------------------------------------
// Execution Plane Bootstrap - basic construction
// ---------------------------------------------------------------------------

test("buildExecutionPlaneBootstrap returns correct planeId", () => {
  const bootstrap = buildExecutionPlaneBootstrap();
  assert.equal(bootstrap.planeId, "execution");
});

test("buildExecutionPlaneBootstrap returns catalog with 14 capabilities", () => {
  const bootstrap = buildExecutionPlaneBootstrap();
  assert.equal(bootstrap.catalog.length, 14);
});

test("buildExecutionPlaneBootstrap returns registeredServiceIds in correct order", () => {
  const bootstrap = buildExecutionPlaneBootstrap();
  assert.deepEqual(bootstrap.registeredServiceIds, [
    EXECUTION_PLANE_CATALOG_SERVICE_ID,
    EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID,
  ]);
});

test("buildExecutionPlaneBootstrap catalog contains all expected capability IDs", () => {
  const bootstrap = buildExecutionPlaneBootstrap();
  const capabilityIds = bootstrap.catalog.map((c) => c.capabilityId);
  const expectedIds: ExecutionCapabilityId[] = [
    "dispatcher",
    "distributed-lock",
    "execution-engine",
    "ha",
    "hot-upgrade",
    "lease",
    "plugin-executor",
    "queue",
    "recovery",
    "resource",
    "startup",
    "state-transition",
    "tool-executor",
    "worker-pool",
  ];
  for (const id of expectedIds) {
    assert.ok(capabilityIds.includes(id), `Missing capability: ${id}`);
  }
});

// ---------------------------------------------------------------------------
// Execution Plane Bootstrap - catalog entry properties
// ---------------------------------------------------------------------------

test("each catalog entry has capabilityId that matches the entry", () => {
  const bootstrap = buildExecutionPlaneBootstrap();
  for (const entry of bootstrap.catalog) {
    assert.ok(entry.entryModule.includes(entry.capabilityId), `Entry ${entry.capabilityId} module path mismatch`);
  }
});

test("each catalog entry has non-empty description", () => {
  const bootstrap = buildExecutionPlaneBootstrap();
  for (const entry of bootstrap.catalog) {
    assert.ok(entry.description.length > 0, `Entry ${entry.capabilityId} has empty description`);
  }
});

test("each catalog entry has at least one baseline service", () => {
  const bootstrap = buildExecutionPlaneBootstrap();
  for (const entry of bootstrap.catalog) {
    assert.ok(entry.baselineServices.length > 0, `Entry ${entry.capabilityId} has no baseline services`);
  }
});

test("catalog is frozen to prevent modification", () => {
  const bootstrap = buildExecutionPlaneBootstrap();
  assert.ok(Object.isFrozen(bootstrap.catalog), "Catalog should be frozen");
  for (const entry of bootstrap.catalog) {
    assert.ok(Object.isFrozen(entry), `Entry ${entry.capabilityId} should be frozen`);
  }
});

// ---------------------------------------------------------------------------
// listExecutionCapabilityBaselines
// ---------------------------------------------------------------------------

test("listExecutionCapabilityBaselines returns frozen array", () => {
  const baselines = listExecutionCapabilityBaselines();
  assert.ok(Object.isFrozen(baselines));
});

test("listExecutionCapabilityBaselines returns all 14 capabilities", () => {
  const baselines = listExecutionCapabilityBaselines();
  assert.equal(baselines.length, 14);
});

test("listExecutionCapabilityBaselines returns dispatcher capability", () => {
  const baselines = listExecutionCapabilityBaselines();
  const dispatcher = baselines.find((b) => b.capabilityId === "dispatcher");
  assert.ok(dispatcher);
  assert.ok(dispatcher!.baselineServices.includes("executeToolCall"));
});

test("listExecutionCapabilityBaselines returns worker-pool capability", () => {
  const baselines = listExecutionCapabilityBaselines();
  const workerPool = baselines.find((b) => b.capabilityId === "worker-pool");
  assert.ok(workerPool);
  assert.ok(workerPool!.baselineServices.includes("WorkerRegistryService"));
});

test("listExecutionCapabilityBaselines returns ha capability with HaCoordinatorService", () => {
  const baselines = listExecutionCapabilityBaselines();
  const ha = baselines.find((b) => b.capabilityId === "ha");
  assert.ok(ha);
  assert.ok(ha!.baselineServices.includes("HaCoordinatorService"));
});

test("listExecutionCapabilityBaselines returns lease capability with ExecutionLeaseService", () => {
  const baselines = listExecutionCapabilityBaselines();
  const lease = baselines.find((b) => b.capabilityId === "lease");
  assert.ok(lease);
  assert.ok(lease!.baselineServices.includes("ExecutionLeaseService"));
});

test("listExecutionCapabilityBaselines returns state-transition capability with TransitionService", () => {
  const baselines = listExecutionCapabilityBaselines();
  const stateTransition = baselines.find((b) => b.capabilityId === "state-transition");
  assert.ok(stateTransition);
  assert.ok(stateTransition!.baselineServices.includes("TransitionService"));
});

test("listExecutionCapabilityBaselines returns tool-executor capability", () => {
  const baselines = listExecutionCapabilityBaselines();
  const toolExecutor = baselines.find((b) => b.capabilityId === "tool-executor");
  assert.ok(toolExecutor);
  assert.ok(toolExecutor!.baselineServices.includes("CommandExecutor"));
  assert.ok(toolExecutor!.baselineServices.includes("ToolExecutor"));
});

test("listExecutionCapabilityBaselines returns recovery capability", () => {
  const baselines = listExecutionCapabilityBaselines();
  const recovery = baselines.find((b) => b.capabilityId === "recovery");
  assert.ok(recovery);
  assert.ok(recovery!.baselineServices.includes("RecoveryService"));
});

test("listExecutionCapabilityBaselines returns queue capability", () => {
  const baselines = listExecutionCapabilityBaselines();
  const queue = baselines.find((b) => b.capabilityId === "queue");
  assert.ok(queue);
  assert.ok(queue!.baselineServices.includes("RedisQueueAdapter"));
});

test("listExecutionCapabilityBaselines returns distributed-lock capability", () => {
  const baselines = listExecutionCapabilityBaselines();
  const distLock = baselines.find((b) => b.capabilityId === "distributed-lock");
  assert.ok(distLock);
  assert.ok(distLock!.baselineServices.includes("DistributedLockService"));
});

test("listExecutionCapabilityBaselines returns plugin-executor capability", () => {
  const baselines = listExecutionCapabilityBaselines();
  const pluginExecutor = baselines.find((b) => b.capabilityId === "plugin-executor");
  assert.ok(pluginExecutor);
  assert.ok(pluginExecutor!.baselineServices.includes("PluginExecutorService"));
});

test("listExecutionCapabilityBaselines returns execution-engine capability", () => {
  const baselines = listExecutionCapabilityBaselines();
  const execEngine = baselines.find((b) => b.capabilityId === "execution-engine");
  assert.ok(execEngine);
  assert.ok(execEngine!.baselineServices.includes("AgentExecutor"));
});

// ---------------------------------------------------------------------------
// resolveExecutionCapabilityBaseline
// ---------------------------------------------------------------------------

test("resolveExecutionCapabilityBaseline returns baseline for dispatcher", () => {
  const baseline = resolveExecutionCapabilityBaseline("dispatcher");
  assert.equal(baseline.capabilityId, "dispatcher");
  assert.ok(baseline.entryModule.includes("dispatcher"));
});

test("resolveExecutionCapabilityBaseline returns baseline for worker-pool", () => {
  const baseline = resolveExecutionCapabilityBaseline("worker-pool");
  assert.equal(baseline.capabilityId, "worker-pool");
});

test("resolveExecutionCapabilityBaseline works for all 14 capability IDs", () => {
  const ids: ExecutionCapabilityId[] = [
    "dispatcher",
    "distributed-lock",
    "execution-engine",
    "ha",
    "hot-upgrade",
    "lease",
    "plugin-executor",
    "queue",
    "recovery",
    "resource",
    "startup",
    "state-transition",
    "tool-executor",
    "worker-pool",
  ];
  for (const id of ids) {
    const baseline = resolveExecutionCapabilityBaseline(id);
    assert.equal(baseline.capabilityId, id, `Failed for ${id}`);
  }
});

test("resolveExecutionCapabilityBaseline throws for unknown capability", () => {
  assert.throws(
    () => resolveExecutionCapabilityBaseline("unknown" as ExecutionCapabilityId),
    (err: unknown) => err instanceof Error && err.message.includes("execution_capability.not_found"),
  );
});

test("resolveExecutionCapabilityBaseline throws with correct error code format", () => {
  try {
    resolveExecutionCapabilityBaseline("invalid" as ExecutionCapabilityId);
    assert.fail("Expected error to be thrown");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes("execution_capability.not_found:invalid"));
  }
});

// ---------------------------------------------------------------------------
// Service ID constants
// ---------------------------------------------------------------------------

test("EXECUTION_PLANE_CATALOG_SERVICE_ID is a string", () => {
  assert.equal(typeof EXECUTION_PLANE_CATALOG_SERVICE_ID, "string");
});

test("EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID is a string", () => {
  assert.equal(typeof EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID, "string");
});

test("EXECUTION_PLANE_CATALOG_SERVICE_ID does not equal BOOTSTRAP_SERVICE_ID", () => {
  assert.notEqual(EXECUTION_PLANE_CATALOG_SERVICE_ID, EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID);
});

test("EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID is meaningful string", () => {
  assert.ok(EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID.includes("execution"));
});

test("EXECUTION_PLANE_CATALOG_SERVICE_ID is meaningful string", () => {
  assert.ok(EXECUTION_PLANE_CATALOG_SERVICE_ID.includes("execution"));
});

// ---------------------------------------------------------------------------
// Registered service IDs in bootstrap
// ---------------------------------------------------------------------------

test("buildExecutionPlaneBootstrap registeredServiceIds contains both service IDs", () => {
  const bootstrap = buildExecutionPlaneBootstrap();
  assert.ok(bootstrap.registeredServiceIds.includes(EXECUTION_PLANE_CATALOG_SERVICE_ID));
  assert.ok(bootstrap.registeredServiceIds.includes(EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID));
});

test("buildExecutionPlaneBootstrap has readonly registeredServiceIds", () => {
  const bootstrap = buildExecutionPlaneBootstrap();
  assert.ok(Array.isArray(bootstrap.registeredServiceIds));
  // The tuple is readonly
  assert.equal(bootstrap.registeredServiceIds.length, 2);
});

// ---------------------------------------------------------------------------
// Edge cases for catalog entry modules
// ---------------------------------------------------------------------------

test("all catalog entry modules end with /index.ts", () => {
  const bootstrap = buildExecutionPlaneBootstrap();
  for (const entry of bootstrap.catalog) {
    assert.ok(entry.entryModule.endsWith("/index.ts"), `${entry.capabilityId}: ${entry.entryModule}`);
  }
});

test("all catalog entry modules start with src/platform/five-plane-execution/", () => {
  const bootstrap = buildExecutionPlaneBootstrap();
  for (const entry of bootstrap.catalog) {
    assert.ok(entry.entryModule.startsWith("src/platform/five-plane-execution/"), `${entry.capabilityId}: ${entry.entryModule}`);
  }
});