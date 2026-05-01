// @ts-nocheck
/**
 * Unit tests for HaProgramService
 *
 * @see src/scale-ecosystem/tenant-platform/ha-program-service.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import { HaProgramService } from "../../../../src/scale-ecosystem/tenant-platform/ha-program-service.js";
import type { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";

function createMockStore(overrides = {}) {
  const defaults = {
    release: {
      listEnvironmentReadinessRecords: () => [],
    },
    worker: {
      listWorkerSnapshots: () => [],
      listExecutionLeasesByStatuses: () => [],
    },
  };
  return { ...defaults, ...overrides } as unknown as AuthoritativeTaskStore;
}

// ---------------------------------------------------------------------------
// Constructor
// ---------------------------------------------------------------------------

test("HaProgramService can be instantiated with a store", () => {
  const store = createMockStore();
  const service = new HaProgramService(store);
  assert.ok(service instanceof HaProgramService);
});

test("HaProgramService accepts optional service options", () => {
  const store = createMockStore();
  const service = new HaProgramService(store, { artifactStoreOptions: { storageDir: "/tmp/artifacts" } });
  assert.ok(service instanceof HaProgramService);
});

// ---------------------------------------------------------------------------
// buildReport - happy path
// ---------------------------------------------------------------------------

test("buildReport returns a valid report structure for empty environment", () => {
  const store = createMockStore();
  const service = new HaProgramService(store);

  const report = service.buildReport({ environment: "staging" });

  assert.ok(report.reportId.startsWith("ha_program_"));
  assert.ok(report.generatedAt);
  assert.equal(report.environment, "staging");
  assert.ok(report.overallStatus);
  assert.equal(typeof report.activeWorkerCount, "number");
  assert.equal(typeof report.activeLeaseCount, "number");
  assert.equal(report.components.length, 4);
  assert.equal(report.rolloutPhases.length, 3);
});

test("buildReport uses custom generatedAt when provided", () => {
  const store = createMockStore();
  const service = new HaProgramService(store);
  const customTime = "2024-06-15T12:00:00.000Z";
  const input = { environment: "staging", generatedAt: customTime };

  const report = service.buildReport(input);

  assert.equal(report.generatedAt, customTime);
});

test("buildReport counts non-offline workers correctly", () => {
  const store = createMockStore({
    worker: {
      listWorkerSnapshots: () => [
        { workerId: "w1", status: "active" },
        { workerId: "w2", status: "busy" },
        { workerId: "w3", status: "offline" },
        { workerId: "w4", status: "draining" },
        { workerId: "w5", status: "offline" },
      ],
      listExecutionLeasesByStatuses: () => [],
    },
  });
  const service = new HaProgramService(store);

  const report = service.buildReport({ environment: "staging" });

  assert.equal(report.activeWorkerCount, 3);
});

test("buildReport counts active execution leases correctly", () => {
  const store = createMockStore({
    worker: {
      listWorkerSnapshots: () => [],
      listExecutionLeasesByStatuses: () => [
        { leaseId: "l1", status: "active" },
        { leaseId: "l2", status: "active" },
      ],
    },
  });
  const service = new HaProgramService(store);

  const report = service.buildReport({ environment: "staging" });

  assert.equal(report.activeLeaseCount, 2);
});

test("buildReport returns pass when all HA components are ready", () => {
  const store = createMockStore({
    release: {
      listEnvironmentReadinessRecords: () => [
        { componentType: "external_service", componentId: "ha_coordinator", status: "ready" },
        { componentType: "external_service", componentId: "postgres_primary", status: "ready" },
        { componentType: "external_service", componentId: "redis_queue", status: "ready" },
        { componentType: "external_service", componentId: "distributed_lock", status: "ready" },
      ],
    },
    worker: {
      listWorkerSnapshots: () => [{ workerId: "w1", status: "active" }],
      listExecutionLeasesByStatuses: () => [{ leaseId: "l1", status: "active" }],
    },
  });
  const service = new HaProgramService(store);

  const report = service.buildReport({ environment: "production" });

  assert.equal(report.overallStatus, "pass");
  assert.ok(report.components.every((c) => c.ready));
});

test("buildReport components have correct currentMode and targetMode", () => {
  const store = createMockStore();
  const service = new HaProgramService(store);

  const report = service.buildReport({ environment: "staging" });

  const coordinator = report.components.find((c) => c.componentId === "coordinator");
  assert.ok(coordinator);
  assert.equal(coordinator.currentMode, "single_node_runtime");
  assert.equal(coordinator.targetMode, "ha_coordinator_epoch");

  const postgres = report.components.find((c) => c.componentId === "postgres");
  assert.ok(postgres);
  assert.equal(postgres.currentMode, "sqlite_authoritative");
  assert.equal(postgres.targetMode, "postgres_authoritative");

  const redisQueue = report.components.find((c) => c.componentId === "redis_queue");
  assert.ok(redisQueue);
  assert.equal(redisQueue.currentMode, "sqlite_outbox_queue");
  assert.equal(redisQueue.targetMode, "redis_queue");

  const distributedLock = report.components.find((c) => c.componentId === "distributed_lock");
  assert.ok(distributedLock);
  assert.equal(distributedLock.currentMode, "sqlite_lease_fencing");
  assert.equal(distributedLock.targetMode, "pg_or_redis_locking");
});

// ---------------------------------------------------------------------------
// buildReport - error cases
// ---------------------------------------------------------------------------

test("buildReport returns fail when coordinator is not ready", () => {
  const store = createMockStore({
    release: {
      listEnvironmentReadinessRecords: () => [
        { componentType: "external_service", componentId: "postgres_primary", status: "ready" },
      ],
    },
    worker: {
      listWorkerSnapshots: () => [],
      listExecutionLeasesByStatuses: () => [],
    },
  });
  const service = new HaProgramService(store);

  const report = service.buildReport({ environment: "staging" });

  assert.equal(report.overallStatus, "fail");
  const coordinator = report.components.find((c) => c.componentId === "coordinator");
  assert.ok(coordinator);
  assert.equal(coordinator.ready, false);
  assert.ok(coordinator.blockers.length > 0);
});

test("buildReport returns fail when postgres is not ready (even if coordinator ready)", () => {
  const store = createMockStore({
    release: {
      listEnvironmentReadinessRecords: () => [
        { componentType: "external_service", componentId: "ha_coordinator", status: "ready" },
        { componentType: "worker_fleet", componentId: "ha_coordinator", status: "ready" },
      ],
    },
    worker: {
      listWorkerSnapshots: () => [],
      listExecutionLeasesByStatuses: () => [],
    },
  });
  const service = new HaProgramService(store);

  const report = service.buildReport({ environment: "staging" });

  assert.equal(report.overallStatus, "fail");
  const postgres = report.components.find((c) => c.componentId === "postgres");
  assert.ok(postgres);
  assert.equal(postgres.ready, false);
});

test("buildReport returns warning when non-critical components are not ready", () => {
  const store = createMockStore({
    release: {
      listEnvironmentReadinessRecords: () => [
        { componentType: "external_service", componentId: "ha_coordinator", status: "ready" },
        { componentType: "worker_fleet", componentId: "ha_coordinator", status: "ready" },
        { componentType: "external_service", componentId: "postgres_primary", status: "ready" },
      ],
    },
    worker: {
      listWorkerSnapshots: () => [],
      listExecutionLeasesByStatuses: () => [],
    },
  });
  const service = new HaProgramService(store);

  const report = service.buildReport({ environment: "staging" });

  assert.equal(report.overallStatus, "warning");
});

test("buildReport accepts worker_fleet readiness for coordinator", () => {
  const store = createMockStore({
    release: {
      listEnvironmentReadinessRecords: () => [
        { componentType: "worker_fleet", componentId: "ha_coordinator", status: "ready" },
        { componentType: "external_service", componentId: "postgres_primary", status: "ready" },
      ],
    },
    worker: {
      listWorkerSnapshots: () => [],
      listExecutionLeasesByStatuses: () => [],
    },
  });
  const service = new HaProgramService(store);

  const report = service.buildReport({ environment: "staging" });

  const coordinator = report.components.find((c) => c.componentId === "coordinator");
  assert.ok(coordinator);
  assert.equal(coordinator.ready, true);
});

// ---------------------------------------------------------------------------
// exportReport
// ---------------------------------------------------------------------------

test("exportReport returns report plus artifact references", () => {
  const store = createMockStore();
  const service = new HaProgramService(store);

  const result = service.exportReport({ environment: "staging" });

  assert.ok(result.report);
  assert.ok(result.jsonArtifact);
  assert.ok(result.markdownArtifact);
  assert.equal(result.jsonArtifact.kind, "ha_transition_program");
  assert.equal(result.markdownArtifact.kind, "ha_transition_program_markdown");
});

test("exportReport json artifact contains valid report content", () => {
  const store = createMockStore();
  const service = new HaProgramService(store);

  const result = service.exportReport({ environment: "staging" });

  assert.equal(result.report.environment, "staging");
  assert.ok(result.report.reportId);
  assert.equal(result.report.components.length, 4);
});

test("exportReport markdown artifact uses correct mimeType", () => {
  const store = createMockStore();
  const service = new HaProgramService(store);

  const result = service.exportReport({ environment: "staging" });

  assert.equal(result.markdownArtifact.mimeType, "text/markdown");
});

test("exportReport passes through custom generatedAt to the report", () => {
  const store = createMockStore();
  const service = new HaProgramService(store);
  const customTime = "2025-01-01T00:00:00.000Z";

  const result = service.exportReport({ environment: "staging", generatedAt: customTime });

  assert.equal(result.report.generatedAt, customTime);
});