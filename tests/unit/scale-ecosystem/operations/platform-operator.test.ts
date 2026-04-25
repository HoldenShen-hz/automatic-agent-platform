import assert from "node:assert/strict";
import test from "node:test";

import {
  PlatformOperatorService,
  type PlatformOperatorBuildInput,
} from "../../../../src/scale-ecosystem/marketplace/platform-operator-service.js";
import type { WorkerSnapshotRecord } from "../../../../src/platform/contracts/types/domain.js";

// ---------------------------------------------------------------------------
// Helper types and builders
// ---------------------------------------------------------------------------

interface MockWorkerMethods {
  listWorkerSnapshots: () => WorkerSnapshotRecord[];
  listExecutionTicketsByStatuses: (statuses: string[]) => number;
  listExecutionLeasesByStatuses: (statuses: string[]) => number;
}

function createMockStore(overrides: Partial<MockWorkerMethods> = {}): MockWorkerMethods & ReturnType<typeof createBaseStore> {
  const base = createBaseStore();
  return {
    ...base,
    worker: {
      listWorkerSnapshots: () => [],
      listExecutionTicketsByStatuses: () => 0,
      listExecutionLeasesByStatuses: () => 0,
      ...overrides.worker,
    },
  };
}

function createBaseStore() {
  return {
    release: {
      listEnvironmentReadinessRecords: () => [],
    },
    organization: {
      listOrganizationRecords: () => [],
      listWorkspaceRecords: () => [],
      listTenantRecords: () => [],
      listDeploymentBindings: () => [],
      listDataNamespaces: () => [],
    },
    task: {
      getTask: () => null,
      insertTask: () => {},
    },
    artifact: {
      insertArtifact: () => {},
    },
  };
}

function createMockDb() {
  return {};
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("PlatformOperatorService can be instantiated", () => {
  const service = new PlatformOperatorService(createMockDb() as any, createMockStore() as any);
  assert.ok(service);
});

test("PlatformOperatorService buildReport returns valid report structure", () => {
  const service = new PlatformOperatorService(createMockDb() as any, createMockStore() as any);

  const input: PlatformOperatorBuildInput = {
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  };

  const report = service.buildReport(input);

  assert.ok(report.reportId);
  assert.equal(report.componentId, "execution_plane");
  assert.ok(report.generatedAt);
  assert.equal(report.environment, "production");
  assert.ok(report.executionPlane);
  assert.ok(report.releasePackage);
  assert.equal(report.promoteEligible, false); // empty store means no approve verdict
});

test("PlatformOperatorService buildReport accepts custom targetStatus", () => {
  const service = new PlatformOperatorService(createMockDb() as any, createMockStore() as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
    targetStatus: "stable",
  });

  assert.equal(report.targetStatus, "stable");
});

test("PlatformOperatorService buildReport uses provided generatedAt", () => {
  const service = new PlatformOperatorService(createMockDb() as any, createMockStore() as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
    generatedAt: "2026-04-14T00:00:00.000Z",
  });

  assert.equal(report.generatedAt, "2026-04-14T00:00:00.000Z");
});

test("PlatformOperatorService buildReport throws on invalid generatedAt", () => {
  const service = new PlatformOperatorService(createMockDb() as any, createMockStore() as any);

  assert.throws(() => {
    service.buildReport({
      environment: "production",
      evidenceRootDir: "/tmp/evidence",
      packageOutputDir: "/tmp/output",
      generatedAt: "not-a-valid-timestamp",
    });
  });
});

test("PlatformOperatorService buildReport counts workers by scheduling status", () => {
  const store = createMockStore({
    worker: {
      listWorkerSnapshots: () => [
        { workerId: "w1", status: "healthy", maxConcurrency: 5, runningExecutionsJson: "[]", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch1" } as WorkerSnapshotRecord,
        { workerId: "w2", status: "degraded", maxConcurrency: 3, runningExecutionsJson: "[1]", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch2" } as WorkerSnapshotRecord,
        { workerId: "w3", status: "draining", maxConcurrency: 4, runningExecutionsJson: "[]", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch3" } as WorkerSnapshotRecord,
      ],
    },
  });

  const service = new PlatformOperatorService(createMockDb() as any, store as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  assert.equal(report.executionPlane.workerCounts.total, 3);
  assert.equal(report.executionPlane.workerCounts.healthy, 1);
  assert.equal(report.executionPlane.workerCounts.degraded, 1);
  assert.equal(report.executionPlane.workerCounts.draining, 1);
});

test("PlatformOperatorService buildReport identifies stale workers", () => {
  const oldHeartbeat = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // 20 minutes ago

  const store = createMockStore({
    worker: {
      listWorkerSnapshots: () => [
        { workerId: "w1", status: "healthy", maxConcurrency: 5, runningExecutionsJson: "[]", lastHeartbeatAt: oldHeartbeat, placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch1" } as WorkerSnapshotRecord,
      ],
    },
  });

  const service = new PlatformOperatorService(createMockDb() as any, store as any, {
    staleWorkerThresholdMs: 10 * 60 * 1000, // 10 minutes
  });

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  assert.equal(report.executionPlane.staleWorkerIds.length, 1);
  assert.equal(report.executionPlane.staleWorkerIds[0], "w1");
  assert.equal(report.executionPlane.workerCounts.stale, 1);
});

test("PlatformOperatorService buildReport identifies untrusted remote workers", () => {
  const store = createMockStore({
    worker: {
      listWorkerSnapshots: () => [
        { workerId: "w1", status: "healthy", maxConcurrency: 5, runningExecutionsJson: "[]", lastHeartbeatAt: new Date().toISOString(), placement: "remote", registrationVerifiedAt: null, registrationChallengeId: null } as WorkerSnapshotRecord,
      ],
    },
  });

  const service = new PlatformOperatorService(createMockDb() as any, store as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  assert.equal(report.executionPlane.untrustedWorkerIds.length, 1);
  assert.equal(report.executionPlane.workerCounts.untrusted, 1);
});

test("PlatformOperatorService buildReport local workers are always trusted", () => {
  const store = createMockStore({
    worker: {
      listWorkerSnapshots: () => [
        { workerId: "w1", status: "healthy", maxConcurrency: 5, runningExecutionsJson: "[]", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: null, registrationChallengeId: null } as WorkerSnapshotRecord,
      ],
    },
  });

  const service = new PlatformOperatorService(createMockDb() as any, store as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  assert.equal(report.executionPlane.untrustedWorkerIds.length, 0);
  assert.equal(report.executionPlane.workerCounts.untrusted, 0);
});

test("PlatformOperatorService buildReport counts tickets by status", () => {
  const store = createMockStore({
    worker: {
      listExecutionTicketsByStatuses: (statuses: string[]) => {
        if (statuses.includes("pending")) return 5;
        if (statuses.includes("claimed")) return 3;
        if (statuses.includes("consumed")) return 10;
        if (statuses.includes("cancelled")) return 2;
        if (statuses.includes("expired")) return 1;
        return 0;
      },
    },
  });

  const service = new PlatformOperatorService(createMockDb() as any, store as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  assert.equal(report.executionPlane.ticketCounts.pending, 5);
  assert.equal(report.executionPlane.ticketCounts.claimed, 3);
  assert.equal(report.executionPlane.ticketCounts.consumed, 10);
  assert.equal(report.executionPlane.ticketCounts.cancelled, 2);
  assert.equal(report.executionPlane.ticketCounts.expired, 1);
});

test("PlatformOperatorService buildReport counts leases by status", () => {
  const store = createMockStore({
    worker: {
      listExecutionLeasesByStatuses: (statuses: string[]) => {
        if (statuses.includes("active")) return 4;
        if (statuses.includes("expired")) return 2;
        if (statuses.includes("released")) return 1;
        if (statuses.includes("reclaimed")) return 0;
        if (statuses.includes("handed_over")) return 0;
        return 0;
      },
    },
  });

  const service = new PlatformOperatorService(createMockDb() as any, store as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  assert.equal(report.executionPlane.leaseCounts.active, 4);
  assert.equal(report.executionPlane.leaseCounts.expired, 2);
  assert.equal(report.executionPlane.leaseCounts.released, 1);
});

test("PlatformOperatorService buildReport builds readiness summary per component type", () => {
  const store = createMockStore({
    worker: {},
    release: {
      listEnvironmentReadinessRecords: () => [
        { componentType: "gateway", credentialReady: 1, secondaryGatesJson: "{}", lastVerifiedAt: new Date().toISOString() } as any,
        { componentType: "gateway", credentialReady: 1, secondaryGatesJson: "{}", lastVerifiedAt: new Date().toISOString() } as any,
        { componentType: "sandbox", credentialReady: 0, secondaryGatesJson: "{}", lastVerifiedAt: new Date().toISOString() } as any,
      ],
    },
  });

  const service = new PlatformOperatorService(createMockDb() as any, store as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  const gatewaySummary = report.executionPlane.readinessSummary.find((r) => r.componentType === "gateway");
  assert.ok(gatewaySummary);
  assert.equal(gatewaySummary.total, 2);
  assert.equal(gatewaySummary.ready, 2);
  assert.equal(gatewaySummary.notReady, 0);

  const sandboxSummary = report.executionPlane.readinessSummary.find((r) => r.componentType === "sandbox");
  assert.ok(sandboxSummary);
  assert.equal(sandboxSummary.total, 1);
  assert.equal(sandboxSummary.notReady, 1);
  assert.equal(sandboxSummary.allReady, false);
});

test("PlatformOperatorService buildReport marks readiness stale when lastVerifiedAt is old", () => {
  const oldTimestamp = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(); // 48 hours ago

  const store = createMockStore({
    release: {
      listEnvironmentReadinessRecords: () => [
        { componentType: "provider", credentialReady: 1, secondaryGatesJson: "{}", lastVerifiedAt: oldTimestamp } as any,
      ],
    },
  });

  const service = new PlatformOperatorService(createMockDb() as any, store as any, {
    readinessStaleThresholdMs: 24 * 60 * 60 * 1000, // 24 hours
  });

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  const providerSummary = report.executionPlane.readinessSummary.find((r) => r.componentType === "provider");
  assert.ok(providerSummary);
  assert.equal(providerSummary.stale, 1);
  assert.equal(providerSummary.allReady, false);
});

test("PlatformOperatorService buildReport collects topology counts", () => {
  const store = createMockStore({
    organization: {
      listOrganizationRecords: () => [1, 2] as any,
      listWorkspaceRecords: () => [10, 11, 12] as any,
      listTenantRecords: () => [100, 101] as any,
      listDeploymentBindings: () => [200, 201, 202, 203] as any,
      listDataNamespaces: () => [300, 301] as any,
    },
  });

  const service = new PlatformOperatorService(createMockDb() as any, store as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  assert.equal(report.executionPlane.topology.organizations, 2);
  assert.equal(report.executionPlane.topology.workspaces, 3);
  assert.equal(report.executionPlane.topology.tenants, 2);
  assert.equal(report.executionPlane.topology.deploymentBindings, 4);
  assert.equal(report.executionPlane.topology.dataNamespaces, 2);
});

test("PlatformOperatorService buildReport calculates totalAvailableSlots from worker concurrency", () => {
  const store = createMockStore({
    worker: {
      listWorkerSnapshots: () => [
        { workerId: "w1", status: "healthy", maxConcurrency: 5, runningExecutionsJson: "[1,2,3]", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch1" } as WorkerSnapshotRecord,
        { workerId: "w2", status: "healthy", maxConcurrency: 10, runningExecutionsJson: "[]", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch2" } as WorkerSnapshotRecord,
      ],
    },
  });

  const service = new PlatformOperatorService(createMockDb() as any, store as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  // w1: max=5, running=3, available=2; w2: max=10, running=0, available=10
  assert.equal(report.executionPlane.workerCounts.totalAvailableSlots, 12);
});

test("PlatformOperatorService buildReport handles malformed runningExecutionsJson gracefully", () => {
  const store = createMockStore({
    worker: {
      listWorkerSnapshots: () => [
        { workerId: "w1", status: "healthy", maxConcurrency: 5, runningExecutionsJson: "not valid json", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch1" } as WorkerSnapshotRecord,
      ],
    },
  });

  const service = new PlatformOperatorService(createMockDb() as any, store as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  // malformed JSON treated as 0 running, so available = maxConcurrency = 5
  assert.equal(report.executionPlane.workerCounts.totalAvailableSlots, 5);
});

test("PlatformOperatorService buildReport flags promotion risk when active leases exceed workers", () => {
  const store = createMockStore({
    worker: {
      listWorkerSnapshots: () => [
        { workerId: "w1", status: "healthy", maxConcurrency: 5, runningExecutionsJson: "[]", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch1" } as WorkerSnapshotRecord,
      ],
      listExecutionLeasesByStatuses: (statuses: string[]) => {
        if (statuses.includes("active")) return 5; // 5 leases but only 1 worker
        return 0;
      },
    },
  });

  const service = new PlatformOperatorService(createMockDb() as any, store as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  assert.ok(report.executionPlane.promotionRisks.some((r) => r.includes("lease count exceeds")));
});

test("PlatformOperatorService buildReport flags promotion risk when deployment bindings exceed tenants", () => {
  const store = createMockStore({
    organization: {
      listTenantRecords: () => [100] as any,
      listDeploymentBindings: () => [200, 201] as any, // 2 bindings, 1 tenant is suspicious
    },
  });

  const service = new PlatformOperatorService(createMockDb() as any, store as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  assert.ok(report.executionPlane.promotionRisks.some((r) => r.includes("deployment binding count exceeds")));
});

test("PlatformOperatorService buildReport flags promotion risk when data namespaces are fewer than tenants", () => {
  const store = createMockStore({
    organization: {
      listTenantRecords: () => [100, 101, 102] as any,
      listDataNamespaces: () => [1] as any, // only 1 namespace for 3 tenants
    },
  });

  const service = new PlatformOperatorService(createMockDb() as any, store as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  assert.ok(report.executionPlane.promotionRisks.some((r) => r.includes("data namespaces are incomplete")));
});

test("PlatformOperatorService buildReport marks promoteEligible false when risks exist", () => {
  const store = createMockStore({
    worker: {
      listWorkerSnapshots: () => [
        { workerId: "w1", status: "healthy", maxConcurrency: 5, runningExecutionsJson: "[]", lastHeartbeatAt: new Date().toISOString(), placement: "remote", registrationVerifiedAt: null, registrationChallengeId: null } as WorkerSnapshotRecord,
      ],
    },
  });

  const service = new PlatformOperatorService(createMockDb() as any, store as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  // untrusted worker present = promotion risk
  assert.ok(report.executionPlane.promotionRisks.length > 0);
  assert.equal(report.promoteEligible, false);
});

test("PlatformOperatorService exportReport returns report and artifact refs", () => {
  const store = createMockStore({
    task: {
      getTask: () => null,
      insertTask: () => {},
    },
  });

  const service = new PlatformOperatorService(createMockDb() as any, store as any);

  const result = service.exportReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  assert.ok(result.report);
  assert.ok(result.jsonArtifact);
  assert.ok(result.markdownArtifact);
  assert.equal(result.jsonArtifact.kind, "platform_operator_report");
  assert.equal(result.markdownArtifact.kind, "platform_operator_summary");
});

test("PlatformOperatorService buildReport adds stale worker to promotion risks", () => {
  const oldHeartbeat = new Date(Date.now() - 20 * 60 * 1000).toISOString();

  const store = createMockStore({
    worker: {
      listWorkerSnapshots: () => [
        { workerId: "stale-worker", status: "healthy", maxConcurrency: 5, runningExecutionsJson: "[]", lastHeartbeatAt: oldHeartbeat, placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch1" } as WorkerSnapshotRecord,
      ],
    },
  });

  const service = new PlatformOperatorService(createMockDb() as any, store as any, {
    staleWorkerThresholdMs: 10 * 60 * 1000,
  });

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  assert.ok(report.executionPlane.promotionRisks.some((r) => r.includes("stale worker snapshots")));
  assert.ok(report.executionPlane.staleWorkerIds.includes("stale-worker"));
});

test("PlatformOperatorService buildReport readiness allReady is true when no issues", () => {
  const store = createMockStore({
    release: {
      listEnvironmentReadinessRecords: () => [
        { componentType: "worker_fleet", credentialReady: 1, secondaryGatesJson: "{}", lastVerifiedAt: new Date().toISOString() } as any,
      ],
    },
  });

  const service = new PlatformOperatorService(createMockDb() as any, store as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  const fleetSummary = report.executionPlane.readinessSummary.find((r) => r.componentType === "worker_fleet");
  assert.ok(fleetSummary);
  assert.equal(fleetSummary.allReady, true);
});

test("PlatformOperatorService buildReport missing readiness records add promotion risk", () => {
  // No readiness records at all for a component type
  const store = createMockStore({
    release: {
      listEnvironmentReadinessRecords: () => [],
    },
  });

  const service = new PlatformOperatorService(createMockDb() as any, store as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  const providerSummary = report.executionPlane.readinessSummary.find((r) => r.componentType === "provider");
  assert.ok(providerSummary);
  assert.equal(providerSummary.total, 0);
  assert.ok(report.executionPlane.promotionRisks.some((r) => r.includes("missing readiness records")));
});