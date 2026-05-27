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

function createMockStore(workerOverrides: Partial<{
  listWorkerSnapshots: () => WorkerSnapshotRecord[];
  listExecutionTicketsByStatuses: (statuses: string[]) => number;
  listExecutionLeasesByStatuses: (statuses: string[]) => number;
}> = {}, releaseOverrides: Partial<{
  listEnvironmentReadinessRecords: () => any[];
}> = {}, orgOverrides: Partial<{
  listOrganizationRecords: () => any[];
  listWorkspaceRecords: () => any[];
  listTenantRecords: () => any[];
  listDeploymentBindings: () => any[];
  listDataNamespaces: () => any[];
}> = {}) {
  return {
    worker: {
      listWorkerSnapshots: () => [],
      listExecutionTicketsByStatuses: () => 0,
      listExecutionLeasesByStatuses: () => 0,
      ...workerOverrides,
    },
    release: {
      listEnvironmentReadinessRecords: () => [],
      ...releaseOverrides,
    },
    organization: {
      listOrganizationRecords: () => [],
      listWorkspaceRecords: () => [],
      listTenantRecords: () => [],
      listDeploymentBindings: () => [],
      listDataNamespaces: () => [],
      ...orgOverrides,
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

test("PlatformOperatorService can be instantiated [platform-operator]", () => {
  const service = new PlatformOperatorService(createMockDb() as any, createMockStore() as any);
  assert.ok(service);
});

test("PlatformOperatorService buildReport returns valid report structure [platform-operator]", () => {
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

test("PlatformOperatorService buildReport accepts custom targetStatus [platform-operator]", () => {
  const service = new PlatformOperatorService(createMockDb() as any, createMockStore() as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
    targetStatus: "production_ready",
  });

  assert.equal(report.targetStatus, "production_ready");
});

test("PlatformOperatorService buildReport uses provided generatedAt [platform-operator]", () => {
  const service = new PlatformOperatorService(createMockDb() as any, createMockStore() as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
    generatedAt: "2026-04-14T00:00:00.000Z",
  });

  assert.equal(report.generatedAt, "2026-04-14T00:00:00.000Z");
});

test("PlatformOperatorService buildReport throws on invalid generatedAt [platform-operator]", () => {
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

test("PlatformOperatorService buildReport counts workers by scheduling status [platform-operator]", () => {
  // WorkerStatus: idle | busy | draining | degraded | unavailable | quarantined | offline
  // toWorkerSchedulingStatus maps: idle->healthy, busy->degraded, etc.
  const store = createMockStore({
    listWorkerSnapshots: () => [
      { workerId: "w1", status: "idle", maxConcurrency: 5, runningExecutionsJson: "[]", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch1", capabilitiesJson: "[]", queueAffinity: "primary", runtimeInstanceId: "r1", restartedFromRuntimeInstanceId: null, restartGeneration: 0, cpuPct: 10, memoryMb: 128, toolBacklogCount: 0, currentStepId: null, lastProgressAt: new Date().toISOString(), updatedAt: new Date().toISOString(), saturation: 0, activeLeaseCount: 0, meanStartupLatencyMs: 100, sandboxSuccessRate: 1, repoCacheHitRate: 0.9, remoteSessionStatus: null, lastAcknowledgedStreamOffset: null, streamResumeSuccessRate: null, credentialRefreshSuccessRate: null, sessionConsistencyCheckStatus: null, sessionConsistencyCheckedAt: null, workspaceSyncStatus: null, workspaceSyncCheckedAt: null } as WorkerSnapshotRecord,
      { workerId: "w2", status: "busy", maxConcurrency: 3, runningExecutionsJson: "[1]", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch2", capabilitiesJson: "[]", queueAffinity: "primary", runtimeInstanceId: "r2", restartedFromRuntimeInstanceId: null, restartGeneration: 0, cpuPct: 10, memoryMb: 128, toolBacklogCount: 0, currentStepId: null, lastProgressAt: new Date().toISOString(), updatedAt: new Date().toISOString(), saturation: 0, activeLeaseCount: 0, meanStartupLatencyMs: 100, sandboxSuccessRate: 1, repoCacheHitRate: 0.9, remoteSessionStatus: null, lastAcknowledgedStreamOffset: null, streamResumeSuccessRate: null, credentialRefreshSuccessRate: null, sessionConsistencyCheckStatus: null, sessionConsistencyCheckedAt: null, workspaceSyncStatus: null, workspaceSyncCheckedAt: null } as WorkerSnapshotRecord,
      { workerId: "w3", status: "draining", maxConcurrency: 4, runningExecutionsJson: "[]", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch3", capabilitiesJson: "[]", queueAffinity: "primary", runtimeInstanceId: "r3", restartedFromRuntimeInstanceId: null, restartGeneration: 0, cpuPct: 10, memoryMb: 128, toolBacklogCount: 0, currentStepId: null, lastProgressAt: new Date().toISOString(), updatedAt: new Date().toISOString(), saturation: 0, activeLeaseCount: 0, meanStartupLatencyMs: 100, sandboxSuccessRate: 1, repoCacheHitRate: 0.9, remoteSessionStatus: null, lastAcknowledgedStreamOffset: null, streamResumeSuccessRate: null, credentialRefreshSuccessRate: null, sessionConsistencyCheckStatus: null, sessionConsistencyCheckedAt: null, workspaceSyncStatus: null, workspaceSyncCheckedAt: null } as WorkerSnapshotRecord,
    ],
  });

  const service = new PlatformOperatorService(createMockDb() as any, store as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  assert.equal(report.executionPlane.workerCounts.total, 3);
  assert.equal(report.executionPlane.workerCounts.healthy, 2); // idle + busy -> healthy
  assert.equal(report.executionPlane.workerCounts.degraded, 0);
  assert.equal(report.executionPlane.workerCounts.draining, 1);
});

test("PlatformOperatorService buildReport identifies stale workers [platform-operator]", () => {
  const oldHeartbeat = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // 20 minutes ago

  const store = createMockStore({
    listWorkerSnapshots: () => [
      { workerId: "w1", status: "idle", maxConcurrency: 5, runningExecutionsJson: "[]", lastHeartbeatAt: oldHeartbeat, placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch1", capabilitiesJson: "[]", queueAffinity: "primary", runtimeInstanceId: "r1", restartedFromRuntimeInstanceId: null, restartGeneration: 0, cpuPct: 10, memoryMb: 128, toolBacklogCount: 0, currentStepId: null, lastProgressAt: new Date().toISOString(), updatedAt: new Date().toISOString(), saturation: 0, activeLeaseCount: 0, meanStartupLatencyMs: 100, sandboxSuccessRate: 1, repoCacheHitRate: 0.9, remoteSessionStatus: null, lastAcknowledgedStreamOffset: null, streamResumeSuccessRate: null, credentialRefreshSuccessRate: null, sessionConsistencyCheckStatus: null, sessionConsistencyCheckedAt: null, workspaceSyncStatus: null, workspaceSyncCheckedAt: null } as WorkerSnapshotRecord,
    ],
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

test("PlatformOperatorService buildReport identifies untrusted remote workers [platform-operator]", () => {
  const store = createMockStore({
    listWorkerSnapshots: () => [
      { workerId: "w1", status: "idle", maxConcurrency: 5, runningExecutionsJson: "[]", lastHeartbeatAt: new Date().toISOString(), placement: "remote", registrationVerifiedAt: null, registrationChallengeId: null, capabilitiesJson: "[]", queueAffinity: "primary", runtimeInstanceId: "r1", restartedFromRuntimeInstanceId: null, restartGeneration: 0, cpuPct: 10, memoryMb: 128, toolBacklogCount: 0, currentStepId: null, lastProgressAt: new Date().toISOString(), updatedAt: new Date().toISOString(), saturation: 0, activeLeaseCount: 0, meanStartupLatencyMs: 100, sandboxSuccessRate: 1, repoCacheHitRate: 0.9, remoteSessionStatus: null, lastAcknowledgedStreamOffset: null, streamResumeSuccessRate: null, credentialRefreshSuccessRate: null, sessionConsistencyCheckStatus: null, sessionConsistencyCheckedAt: null, workspaceSyncStatus: null, workspaceSyncCheckedAt: null } as WorkerSnapshotRecord,
    ],
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

test("PlatformOperatorService buildReport local workers are always trusted [platform-operator]", () => {
  const store = createMockStore({
    listWorkerSnapshots: () => [
      { workerId: "w1", status: "idle", maxConcurrency: 5, runningExecutionsJson: "[]", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: null, registrationChallengeId: null, capabilitiesJson: "[]", queueAffinity: "primary", runtimeInstanceId: "r1", restartedFromRuntimeInstanceId: null, restartGeneration: 0, cpuPct: 10, memoryMb: 128, toolBacklogCount: 0, currentStepId: null, lastProgressAt: new Date().toISOString(), updatedAt: new Date().toISOString(), saturation: 0, activeLeaseCount: 0, meanStartupLatencyMs: 100, sandboxSuccessRate: 1, repoCacheHitRate: 0.9, remoteSessionStatus: null, lastAcknowledgedStreamOffset: null, streamResumeSuccessRate: null, credentialRefreshSuccessRate: null, sessionConsistencyCheckStatus: null, sessionConsistencyCheckedAt: null, workspaceSyncStatus: null, workspaceSyncCheckedAt: null } as WorkerSnapshotRecord,
    ],
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

test("PlatformOperatorService buildReport counts tickets by status [platform-operator]", () => {
  const store = createMockStore({
    listExecutionTicketsByStatuses: (statuses: string[]) => {
      if (statuses.includes("pending")) return new Array(5).fill("ticket") as any;
      if (statuses.includes("claimed")) return new Array(3).fill("ticket") as any;
      if (statuses.includes("consumed")) return new Array(10).fill("ticket") as any;
      if (statuses.includes("cancelled")) return new Array(2).fill("ticket") as any;
      if (statuses.includes("expired")) return new Array(1).fill("ticket") as any;
      return [] as any;
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

test("PlatformOperatorService buildReport counts leases by status [platform-operator]", () => {
  const store = createMockStore({
    listExecutionLeasesByStatuses: (statuses: string[]) => {
      if (statuses.includes("active")) return new Array(4).fill("lease") as any;
      if (statuses.includes("expired")) return new Array(2).fill("lease") as any;
      if (statuses.includes("released")) return new Array(1).fill("lease") as any;
      if (statuses.includes("reclaimed")) return [] as any;
      if (statuses.includes("handed_over")) return [] as any;
      return [] as any;
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

test("PlatformOperatorService buildReport builds readiness summary per component type [platform-operator]", () => {
  const store = createMockStore({}, {
    listEnvironmentReadinessRecords: () => [
      { componentType: "gateway", credentialReady: 1, secondaryGatesJson: "{}", lastVerifiedAt: new Date().toISOString() },
      { componentType: "gateway", credentialReady: 1, secondaryGatesJson: "{}", lastVerifiedAt: new Date().toISOString() },
      { componentType: "sandbox", credentialReady: 0, secondaryGatesJson: "{}", lastVerifiedAt: new Date().toISOString() },
    ],
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

test("PlatformOperatorService buildReport marks readiness stale when lastVerifiedAt is old [platform-operator]", () => {
  const oldTimestamp = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(); // 48 hours ago

  const store = createMockStore({}, {
    listEnvironmentReadinessRecords: () => [
      { componentType: "provider", credentialReady: 1, secondaryGatesJson: "{}", lastVerifiedAt: oldTimestamp },
    ],
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

test("PlatformOperatorService buildReport collects topology counts [platform-operator]", () => {
  const store = createMockStore({}, {}, {
    listOrganizationRecords: () => [1, 2],
    listWorkspaceRecords: () => [10, 11, 12],
    listTenantRecords: () => [100, 101],
    listDeploymentBindings: () => [200, 201, 202, 203],
    listDataNamespaces: () => [300, 301],
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

test("PlatformOperatorService buildReport calculates totalAvailableSlots from worker concurrency [platform-operator]", () => {
  const store = createMockStore({
    listWorkerSnapshots: () => [
      { workerId: "w1", status: "idle", maxConcurrency: 5, runningExecutionsJson: "[1,2,3]", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch1", capabilitiesJson: "[]", queueAffinity: "primary", runtimeInstanceId: "r1", restartedFromRuntimeInstanceId: null, restartGeneration: 0, cpuPct: 10, memoryMb: 128, toolBacklogCount: 0, currentStepId: null, lastProgressAt: new Date().toISOString(), updatedAt: new Date().toISOString(), saturation: 0, activeLeaseCount: 0, meanStartupLatencyMs: 100, sandboxSuccessRate: 1, repoCacheHitRate: 0.9, remoteSessionStatus: null, lastAcknowledgedStreamOffset: null, streamResumeSuccessRate: null, credentialRefreshSuccessRate: null, sessionConsistencyCheckStatus: null, sessionConsistencyCheckedAt: null, workspaceSyncStatus: null, workspaceSyncCheckedAt: null } as WorkerSnapshotRecord,
      { workerId: "w2", status: "idle", maxConcurrency: 10, runningExecutionsJson: "[]", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch2", capabilitiesJson: "[]", queueAffinity: "primary", runtimeInstanceId: "r2", restartedFromRuntimeInstanceId: null, restartGeneration: 0, cpuPct: 10, memoryMb: 128, toolBacklogCount: 0, currentStepId: null, lastProgressAt: new Date().toISOString(), updatedAt: new Date().toISOString(), saturation: 0, activeLeaseCount: 0, meanStartupLatencyMs: 100, sandboxSuccessRate: 1, repoCacheHitRate: 0.9, remoteSessionStatus: null, lastAcknowledgedStreamOffset: null, streamResumeSuccessRate: null, credentialRefreshSuccessRate: null, sessionConsistencyCheckStatus: null, sessionConsistencyCheckedAt: null, workspaceSyncStatus: null, workspaceSyncCheckedAt: null } as WorkerSnapshotRecord,
    ],
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

test("PlatformOperatorService buildReport handles malformed runningExecutionsJson gracefully [platform-operator]", () => {
  const store = createMockStore({
    listWorkerSnapshots: () => [
      { workerId: "w1", status: "idle", maxConcurrency: 5, runningExecutionsJson: "not valid json", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch1", capabilitiesJson: "[]", queueAffinity: "primary", runtimeInstanceId: "r1", restartedFromRuntimeInstanceId: null, restartGeneration: 0, cpuPct: 10, memoryMb: 128, toolBacklogCount: 0, currentStepId: null, lastProgressAt: new Date().toISOString(), updatedAt: new Date().toISOString(), saturation: 0, activeLeaseCount: 0, meanStartupLatencyMs: 100, sandboxSuccessRate: 1, repoCacheHitRate: 0.9, remoteSessionStatus: null, lastAcknowledgedStreamOffset: null, streamResumeSuccessRate: null, credentialRefreshSuccessRate: null, sessionConsistencyCheckStatus: null, sessionConsistencyCheckedAt: null, workspaceSyncStatus: null, workspaceSyncCheckedAt: null } as WorkerSnapshotRecord,
    ],
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

test("PlatformOperatorService buildReport flags promotion risk when active leases exceed workers [platform-operator]", () => {
  const store = createMockStore({
    listWorkerSnapshots: () => [
      { workerId: "w1", status: "idle", maxConcurrency: 5, runningExecutionsJson: "[]", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch1", capabilitiesJson: "[]", queueAffinity: "primary", runtimeInstanceId: "r1", restartedFromRuntimeInstanceId: null, restartGeneration: 0, cpuPct: 10, memoryMb: 128, toolBacklogCount: 0, currentStepId: null, lastProgressAt: new Date().toISOString(), updatedAt: new Date().toISOString(), saturation: 0, activeLeaseCount: 0, meanStartupLatencyMs: 100, sandboxSuccessRate: 1, repoCacheHitRate: 0.9, remoteSessionStatus: null, lastAcknowledgedStreamOffset: null, streamResumeSuccessRate: null, credentialRefreshSuccessRate: null, sessionConsistencyCheckStatus: null, sessionConsistencyCheckedAt: null, workspaceSyncStatus: null, workspaceSyncCheckedAt: null } as WorkerSnapshotRecord,
    ],
    listExecutionLeasesByStatuses: (statuses: string[]) => {
      if (statuses.includes("active")) return new Array(5).fill("lease") as any; // 5 leases but only 1 worker
      return [] as any;
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

test("PlatformOperatorService buildReport flags promotion risk when deployment bindings exceed tenants [platform-operator]", () => {
  const store = createMockStore({}, {}, {
    listTenantRecords: () => [100],
    listDeploymentBindings: () => [200, 201], // 2 bindings, 1 tenant is suspicious
  });

  const service = new PlatformOperatorService(createMockDb() as any, store as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  assert.ok(report.executionPlane.promotionRisks.some((r) => r.includes("deployment binding count exceeds")));
});

test("PlatformOperatorService buildReport flags promotion risk when data namespaces are fewer than tenants [platform-operator]", () => {
  const store = createMockStore({}, {}, {
    listTenantRecords: () => [100, 101, 102],
    listDataNamespaces: () => [1], // only 1 namespace for 3 tenants
  });

  const service = new PlatformOperatorService(createMockDb() as any, store as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  assert.ok(report.executionPlane.promotionRisks.some((r) => r.includes("data namespaces are incomplete")));
});

test("PlatformOperatorService buildReport marks promoteEligible false when risks exist [platform-operator]", () => {
  const store = createMockStore({
    listWorkerSnapshots: () => [
      { workerId: "w1", status: "idle", maxConcurrency: 5, runningExecutionsJson: "[]", lastHeartbeatAt: new Date().toISOString(), placement: "remote", registrationVerifiedAt: null, registrationChallengeId: null, capabilitiesJson: "[]", queueAffinity: "primary", runtimeInstanceId: "r1", restartedFromRuntimeInstanceId: null, restartGeneration: 0, cpuPct: 10, memoryMb: 128, toolBacklogCount: 0, currentStepId: null, lastProgressAt: new Date().toISOString(), updatedAt: new Date().toISOString(), saturation: 0, activeLeaseCount: 0, meanStartupLatencyMs: 100, sandboxSuccessRate: 1, repoCacheHitRate: 0.9, remoteSessionStatus: null, lastAcknowledgedStreamOffset: null, streamResumeSuccessRate: null, credentialRefreshSuccessRate: null, sessionConsistencyCheckStatus: null, sessionConsistencyCheckedAt: null, workspaceSyncStatus: null, workspaceSyncCheckedAt: null } as WorkerSnapshotRecord,
    ],
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

test("PlatformOperatorService exportReport returns report and artifact refs [platform-operator]", () => {
  const store = createMockStore();

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

test("PlatformOperatorService buildReport adds stale worker to promotion risks [platform-operator]", () => {
  const oldHeartbeat = new Date(Date.now() - 20 * 60 * 1000).toISOString();

  const store = createMockStore({
    listWorkerSnapshots: () => [
      { workerId: "stale-worker", status: "idle", maxConcurrency: 5, runningExecutionsJson: "[]", lastHeartbeatAt: oldHeartbeat, placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch1", capabilitiesJson: "[]", queueAffinity: "primary", runtimeInstanceId: "r1", restartedFromRuntimeInstanceId: null, restartGeneration: 0, cpuPct: 10, memoryMb: 128, toolBacklogCount: 0, currentStepId: null, lastProgressAt: new Date().toISOString(), updatedAt: new Date().toISOString(), saturation: 0, activeLeaseCount: 0, meanStartupLatencyMs: 100, sandboxSuccessRate: 1, repoCacheHitRate: 0.9, remoteSessionStatus: null, lastAcknowledgedStreamOffset: null, streamResumeSuccessRate: null, credentialRefreshSuccessRate: null, sessionConsistencyCheckStatus: null, sessionConsistencyCheckedAt: null, workspaceSyncStatus: null, workspaceSyncCheckedAt: null } as WorkerSnapshotRecord,
    ],
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

test("PlatformOperatorService buildReport readiness allReady is true when no issues [platform-operator]", () => {
  const store = createMockStore({}, {
    listEnvironmentReadinessRecords: () => [
      { componentType: "worker_fleet", credentialReady: 1, secondaryGatesJson: "{}", lastVerifiedAt: new Date().toISOString() },
    ],
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

test("PlatformOperatorService buildReport missing readiness records add promotion risk [platform-operator]", () => {
  // No readiness records at all for a component type
  const store = createMockStore({}, {
    listEnvironmentReadinessRecords: () => [],
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
