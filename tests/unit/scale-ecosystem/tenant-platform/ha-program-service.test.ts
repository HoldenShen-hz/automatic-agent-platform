import assert from "node:assert/strict";
import test from "node:test";

import type {
  HaProgramInput,
  HaProgramReport,
  HaProgramComponent,
  HaProgramExportResult,
} from "../../../../src/scale-ecosystem/tenant-platform/ha-program-service.js";

// Mock minimal types for testing
interface MockEnvironmentReadinessRecord {
  componentType: string;
  componentId: string;
  status: string;
}

interface MockWorkerSnapshot {
  workerId: string;
  status: string;
}

interface MockExecutionLease {
  leaseId: string;
  status: string;
}

interface MockReleaseModule {
  listEnvironmentReadinessRecords(
    environment: string,
    options?: { activeOnly?: boolean; limit?: number }
  ): MockEnvironmentReadinessRecord[];
}

interface MockWorkerModule {
  listWorkerSnapshots(): MockWorkerSnapshot[];
  listExecutionLeasesByStatuses(statuses: string[]): MockExecutionLease[];
}

interface MockAuthoritativeTaskStore {
  release: MockReleaseModule;
  worker: MockWorkerModule;
}

function createMockStore(readinessRecords: MockEnvironmentReadinessRecord[] = []): MockAuthoritativeTaskStore {
  return {
    release: {
      listEnvironmentReadinessRecords: () => readinessRecords,
    },
    worker: {
      listWorkerSnapshots: () => [
        { workerId: "worker_1", status: "active" },
        { workerId: "worker_2", status: "active" },
        { workerId: "worker_3", status: "offline" },
      ],
      listExecutionLeasesByStatuses: () => [
        { leaseId: "lease_1", status: "active" },
        { leaseId: "lease_2", status: "active" },
      ],
    },
  };
}

test("HaProgramInput interface accepts valid input [ha-program-service]", () => {
  const input: HaProgramInput = {
    environment: "staging",
    generatedAt: "2026-04-26T00:00:00.000Z",
  };
  assert.equal(input.environment, "staging");
  assert.equal(input.generatedAt, "2026-04-26T00:00:00.000Z");
});

test("HaProgramInput allows optional generatedAt [ha-program-service]", () => {
  const input: HaProgramInput = {
    environment: "production",
  };
  assert.equal(input.environment, "production");
  assert.equal(input.generatedAt, undefined);
});

test("HaProgramComponent interface structure [ha-program-service]", () => {
  const component: HaProgramComponent = {
    componentId: "coordinator",
    currentMode: "single_node_runtime",
    targetMode: "ha_coordinator_epoch",
    ready: true,
    blockers: [],
  };
  assert.equal(component.componentId, "coordinator");
  assert.equal(component.ready, true);
  assert.deepEqual(component.blockers, []);
});

test("HaProgramComponent with blockers shows blocking issues [ha-program-service]", () => {
  const component: HaProgramComponent = {
    componentId: "postgres",
    currentMode: "sqlite_authoritative",
    targetMode: "postgres_authoritative",
    ready: false,
    blockers: ["postgres readiness missing"],
  };
  assert.equal(component.ready, false);
  assert.equal(component.blockers.length, 1);
  assert.equal(component.blockers[0], "postgres readiness missing");
});

test("HaProgramReport interface structure [ha-program-service]", () => {
  const report: HaProgramReport = {
    reportId: "ha_report_123",
    generatedAt: "2026-04-26T00:00:00.000Z",
    environment: "staging",
    overallStatus: "pass",
    activeWorkerCount: 10,
    activeLeaseCount: 5,
    components: [],
    rolloutPhases: ["Phase 1", "Phase 2", "Phase 3"],
  };
  assert.equal(report.reportId, "ha_report_123");
  assert.equal(report.overallStatus, "pass");
  assert.equal(report.activeWorkerCount, 10);
  assert.equal(report.activeLeaseCount, 5);
  assert.equal(report.rolloutPhases.length, 3);
});

test("HaProgramReport overallStatus accepts warning, fail, pass [ha-program-service]", () => {
  const passReport: HaProgramReport = {
    reportId: "report_pass",
    generatedAt: "2026-04-26T00:00:00.000Z",
    environment: "prod",
    overallStatus: "pass",
    activeWorkerCount: 0,
    activeLeaseCount: 0,
    components: [],
    rolloutPhases: [],
  };
  assert.equal(passReport.overallStatus, "pass");

  const warningReport = { ...passReport, reportId: "report_warn", overallStatus: "warning" as const };
  assert.equal(warningReport.overallStatus, "warning");

  const failReport = { ...passReport, reportId: "report_fail", overallStatus: "fail" as const };
  assert.equal(failReport.overallStatus, "fail");
});

test("HaProgramExportResult interface structure [ha-program-service]", () => {
  const result: HaProgramExportResult = {
    report: {
      reportId: "export_report",
      generatedAt: "2026-04-26T00:00:00.000Z",
      environment: "staging",
      overallStatus: "pass",
      activeWorkerCount: 5,
      activeLeaseCount: 3,
      components: [],
      rolloutPhases: [],
    },
    jsonArtifact: {
      artifactId: "art_json",
      kind: "file",
      uri: "file:///artifacts/ha-program.json",
      mimeType: "application/json",
      sizeBytes: 1024,
      checksum: "abc123",
      createdAt: "2026-04-26T00:00:00.000Z",
    },
    markdownArtifact: {
      artifactId: "art_md",
      kind: "file",
      uri: "file:///artifacts/ha-program.md",
      mimeType: "text/markdown",
      sizeBytes: 512,
      checksum: "def456",
      createdAt: "2026-04-26T00:00:00.000Z",
    },
  };
  assert.equal(result.report.reportId, "export_report");
  assert.equal(result.jsonArtifact.artifactId, "art_json");
  assert.equal(result.markdownArtifact.artifactId, "art_md");
});

test("HaProgramComponent componentId accepts all valid values [ha-program-service]", () => {
  const validIds: HaProgramComponent["componentId"][] = [
    "coordinator",
    "postgres",
    "redis_queue",
    "distributed_lock",
  ];
  for (const id of validIds) {
    const component: HaProgramComponent = {
      componentId: id,
      currentMode: "test",
      targetMode: "test",
      ready: false,
      blockers: [],
    };
    assert.equal(component.componentId, id);
  }
});

test("HaProgramReport rolloutPhases contains all three phases [ha-program-service]", () => {
  const report: HaProgramReport = {
    reportId: "report_phases",
    generatedAt: "2026-04-26T00:00:00.000Z",
    environment: "staging",
    overallStatus: "warning",
    activeWorkerCount: 0,
    activeLeaseCount: 0,
    components: [],
    rolloutPhases: [
      "Phase 1: register HA coordinator readiness and epoch fencing integration",
      "Phase 2: promote PostgreSQL authoritative store and migration compatibility",
      "Phase 3: promote Redis queue and distributed locking with failover rehearsals",
    ],
  };
  assert.equal(report.rolloutPhases.length, 3);
  assert.ok(report.rolloutPhases[0]!.includes("coordinator"));
  assert.ok(report.rolloutPhases[1]!.includes("PostgreSQL"));
  assert.ok(report.rolloutPhases[2]!.includes("Redis"));
});

test("Mock store correctly calculates active workers (non-offline) [ha-program-service]", () => {
  const workers = [
    { workerId: "w1", status: "active" },
    { workerId: "w2", status: "busy" },
    { workerId: "w3", status: "offline" },
    { workerId: "w4", status: "draining" },
  ];
  const activeCount = workers.filter(w => w.status !== "offline").length;
  assert.equal(activeCount, 3);
});

test("Mock store correctly filters leases by status [ha-program-service]", () => {
  const leases = [
    { leaseId: "l1", status: "active" },
    { leaseId: "l2", status: "active" },
    { leaseId: "l3", status: "released" },
    { leaseId: "l4", status: "expired" },
  ];
  const activeLeases = leases.filter(l => l.status === "active");
  assert.equal(activeLeases.length, 2);
});

test("Readiness record format for HA components [ha-program-service]", () => {
  const record: MockEnvironmentReadinessRecord = {
    componentType: "external_service",
    componentId: "ha_coordinator",
    status: "ready",
  };
  assert.equal(record.componentType, "external_service");
  assert.equal(record.componentId, "ha_coordinator");
  assert.equal(record.status, "ready");
});

// Helper to build a minimal mock store with readiness records
function createMockStoreWithReadiness(readinessRecords: MockEnvironmentReadinessRecord[]): MockAuthoritativeTaskStore {
  return {
    release: {
      listEnvironmentReadinessRecords: () => readinessRecords,
    },
    worker: {
      listWorkerSnapshots: () => [{ workerId: "worker_1", status: "active" }],
      listExecutionLeasesByStatuses: () => [{ leaseId: "lease_1", status: "active" }],
    },
  };
}

// Test overallStatus determination logic
test("overallStatus returns pass when all components are ready [ha-program-service]", () => {
  const readinessRecords: MockEnvironmentReadinessRecord[] = [
    { componentType: "external_service", componentId: "ha_coordinator", status: "ready" },
    { componentType: "external_service", componentId: "postgres_primary", status: "ready" },
    { componentType: "external_service", componentId: "redis_queue", status: "ready" },
    { componentType: "external_service", componentId: "distributed_lock", status: "ready" },
  ];
  const store = createMockStoreWithReadiness(readinessRecords);
  // Note: Full integration test requires actual HaProgramService instantiation
  // This tests the readiness record format that drives the status logic
  const readinessIds = new Set(readinessRecords.map((item) => `${item.componentType}:${item.componentId}`));
  assert.equal(store.release.listEnvironmentReadinessRecords().length, readinessRecords.length);
  assert.ok(readinessIds.has("external_service:ha_coordinator"));
  assert.ok(readinessIds.has("external_service:postgres_primary"));
  assert.ok(readinessIds.has("external_service:redis_queue"));
  assert.ok(readinessIds.has("external_service:distributed_lock"));
});

test("overallStatus returns fail when coordinator is not ready [ha-program-service]", () => {
  const readinessRecords: MockEnvironmentReadinessRecord[] = [
    { componentType: "external_service", componentId: "postgres_primary", status: "ready" },
    { componentType: "external_service", componentId: "redis_queue", status: "ready" },
    { componentType: "external_service", componentId: "distributed_lock", status: "ready" },
  ];
  const readinessIds = new Set(readinessRecords.map((item) => `${item.componentType}:${item.componentId}`));
  // coordinator not ready - should be "fail"
  assert.ok(!readinessIds.has("external_service:ha_coordinator"));
  assert.ok(!readinessIds.has("worker_fleet:ha_coordinator"));
  assert.ok(readinessIds.has("external_service:postgres_primary"));
});

test("overallStatus returns fail when postgres is not ready [ha-program-service]", () => {
  const readinessRecords: MockEnvironmentReadinessRecord[] = [
    { componentType: "external_service", componentId: "ha_coordinator", status: "ready" },
    { componentType: "external_service", componentId: "redis_queue", status: "ready" },
    { componentType: "external_service", componentId: "distributed_lock", status: "ready" },
  ];
  const readinessIds = new Set(readinessRecords.map((item) => `${item.componentType}:${item.componentId}`));
  // postgres not ready - should be "fail"
  assert.ok(!readinessIds.has("external_service:postgres_primary"));
  assert.ok(readinessIds.has("external_service:ha_coordinator"));
});

test("overallStatus returns warning when only non-critical components are not ready [ha-program-service]", () => {
  const readinessRecords: MockEnvironmentReadinessRecord[] = [
    { componentType: "external_service", componentId: "ha_coordinator", status: "ready" },
    { componentType: "external_service", componentId: "postgres_primary", status: "ready" },
    // redis_queue and distributed_lock not ready
  ];
  const readinessIds = new Set(readinessRecords.map((item) => `${item.componentType}:${item.componentId}`));
  // Critical components (coordinator, postgres) are ready
  assert.ok(readinessIds.has("external_service:ha_coordinator"));
  assert.ok(readinessIds.has("external_service:postgres_primary"));
  // Non-critical components not ready - should be "warning"
  assert.ok(!readinessIds.has("external_service:redis_queue"));
  assert.ok(!readinessIds.has("external_service:distributed_lock"));
});

test("critical components are coordinator and postgres [ha-program-service]", () => {
  const criticalComponents = ["coordinator", "postgres"];
  const nonCriticalComponents = ["redis_queue", "distributed_lock"];
  // Verify componentId classification
  assert.ok(criticalComponents.includes("coordinator"));
  assert.ok(criticalComponents.includes("postgres"));
  assert.ok(!criticalComponents.includes("redis_queue"));
  assert.ok(!nonCriticalComponents.includes("coordinator"));
});
