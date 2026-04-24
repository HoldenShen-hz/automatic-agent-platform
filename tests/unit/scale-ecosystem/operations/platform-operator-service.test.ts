import assert from "node:assert/strict";
import test from "node:test";

import {
  PlatformOperatorService,
  type PlatformOperatorBuildInput,
} from "../../../../src/scale-ecosystem/operations/platform-operator-service.js";

// Mock stores and db
function createMockStore(): any {
  return {
    worker: {
      listWorkerSnapshots: () => [],
      listExecutionTicketsByStatuses: () => [],
      listExecutionLeasesByStatuses: () => [],
    },
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

function createMockDb(): any {
  return {};
}

function createCountArray(count: number): unknown[] {
  return Array.from({ length: count }, () => ({}));
}

test("PlatformOperatorService can be instantiated", () => {
  const service = new PlatformOperatorService(createMockDb() as any, createMockStore() as any);

  assert.ok(service);
});

test("PlatformOperatorService buildReport returns valid report structure", () => {
  const mockStore = createMockStore();
  mockStore.worker.listWorkerSnapshots = () => [];
  mockStore.worker.listExecutionTicketsByStatuses = () => [];
  mockStore.worker.listExecutionLeasesByStatuses = () => [];
  mockStore.release.listEnvironmentReadinessRecords = () => [];
  mockStore.organization.listOrganizationRecords = () => [];
  mockStore.organization.listWorkspaceRecords = () => [];
  mockStore.organization.listTenantRecords = () => [];
  mockStore.organization.listDeploymentBindings = () => [];
  mockStore.organization.listDataNamespaces = () => [];

  const service = new PlatformOperatorService(createMockDb() as any, mockStore as any);

  const input: PlatformOperatorBuildInput = {
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  };

  const report = service.buildReport(input);

  assert.ok(report.reportId);
  assert.ok(report.componentId);
  assert.ok(report.generatedAt);
  assert.ok(report.environment);
  assert.ok(report.executionPlane);
  assert.ok(report.releasePackage);
});

test("PlatformOperatorService buildReport with custom target status", () => {
  const mockStore = createMockStore();
  mockStore.worker.listWorkerSnapshots = () => [];
  mockStore.worker.listExecutionTicketsByStatuses = () => [];
  mockStore.worker.listExecutionLeasesByStatuses = () => [];
  mockStore.release.listEnvironmentReadinessRecords = () => [];
  mockStore.organization.listOrganizationRecords = () => [];
  mockStore.organization.listWorkspaceRecords = () => [];
  mockStore.organization.listTenantRecords = () => [];
  mockStore.organization.listDeploymentBindings = () => [];
  mockStore.organization.listDataNamespaces = () => [];

  const service = new PlatformOperatorService(createMockDb() as any, mockStore as any);

  const input: PlatformOperatorBuildInput = {
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
    targetStatus: "production_ready",
  };

  const report = service.buildReport(input);

  assert.equal(report.targetStatus, "production_ready");
});

test("PlatformOperatorService buildReport validates generatedAt", () => {
  const mockStore = createMockStore();
  mockStore.worker.listWorkerSnapshots = () => [];
  mockStore.worker.listExecutionTicketsByStatuses = () => [];
  mockStore.worker.listExecutionLeasesByStatuses = () => [];
  mockStore.release.listEnvironmentReadinessRecords = () => [];
  mockStore.organization.listOrganizationRecords = () => [];
  mockStore.organization.listWorkspaceRecords = () => [];
  mockStore.organization.listTenantRecords = () => [];
  mockStore.organization.listDeploymentBindings = () => [];
  mockStore.organization.listDataNamespaces = () => [];

  const service = new PlatformOperatorService(createMockDb() as any, mockStore as any);

  const input: PlatformOperatorBuildInput = {
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
    generatedAt: "2026-04-14T00:00:00.000Z",
  };

  const report = service.buildReport(input);

  assert.equal(report.generatedAt, "2026-04-14T00:00:00.000Z");
});

test("PlatformOperatorService buildReport throws on invalid generatedAt", () => {
  const mockStore = createMockStore();
  mockStore.worker.listWorkerSnapshots = () => [];
  mockStore.worker.listExecutionTicketsByStatuses = () => [];
  mockStore.worker.listExecutionLeasesByStatuses = () => [];
  mockStore.release.listEnvironmentReadinessRecords = () => [];
  mockStore.organization.listOrganizationRecords = () => [];
  mockStore.organization.listWorkspaceRecords = () => [];
  mockStore.organization.listTenantRecords = () => [];
  mockStore.organization.listDeploymentBindings = () => [];
  mockStore.organization.listDataNamespaces = () => [];

  const service = new PlatformOperatorService(createMockDb() as any, mockStore as any);

  const input: PlatformOperatorBuildInput = {
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
    generatedAt: "invalid-date",
  } as any;

  assert.throws(() => {
    service.buildReport(input);
  });
});

test("PlatformOperatorService buildReport counts workers correctly", () => {
  const mockStore = createMockStore();
  mockStore.worker.listWorkerSnapshots = () => [
    { workerId: "w1", status: "healthy", maxConcurrency: 5, runningExecutionsJson: "[]", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch1" },
    { workerId: "w2", status: "degraded", maxConcurrency: 3, runningExecutionsJson: "[1]", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch2" },
  ];
  mockStore.worker.listExecutionTicketsByStatuses = () => [];
  mockStore.worker.listExecutionLeasesByStatuses = () => [];
  mockStore.release.listEnvironmentReadinessRecords = () => [];
  mockStore.organization.listOrganizationRecords = () => [];
  mockStore.organization.listWorkspaceRecords = () => [];
  mockStore.organization.listTenantRecords = () => [];
  mockStore.organization.listDeploymentBindings = () => [];
  mockStore.organization.listDataNamespaces = () => [];

  const service = new PlatformOperatorService(createMockDb() as any, mockStore as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  assert.equal(report.executionPlane.workerCounts.total, 2);
  assert.equal(report.executionPlane.workerCounts.healthy, 1);
  assert.equal(report.executionPlane.workerCounts.degraded, 1);
});

test("PlatformOperatorService buildReport identifies stale workers", () => {
  const mockStore = createMockStore();
  const oldHeartbeat = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // 20 minutes ago
  mockStore.worker.listWorkerSnapshots = () => [
    { workerId: "w1", status: "healthy", maxConcurrency: 5, runningExecutionsJson: "[]", lastHeartbeatAt: oldHeartbeat, placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch1" },
  ];
  mockStore.worker.listExecutionTicketsByStatuses = () => [];
  mockStore.worker.listExecutionLeasesByStatuses = () => [];
  mockStore.release.listEnvironmentReadinessRecords = () => [];
  mockStore.organization.listOrganizationRecords = () => [];
  mockStore.organization.listWorkspaceRecords = () => [];
  mockStore.organization.listTenantRecords = () => [];
  mockStore.organization.listDeploymentBindings = () => [];
  mockStore.organization.listDataNamespaces = () => [];

  const service = new PlatformOperatorService(createMockDb() as any, mockStore as any, {
    staleWorkerThresholdMs: 10 * 60 * 1000, // 10 minutes
  });

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  assert.equal(report.executionPlane.staleWorkerIds.length, 1);
  assert.equal(report.executionPlane.workerCounts.stale, 1);
});

test("PlatformOperatorService buildReport identifies untrusted workers", () => {
  const mockStore = createMockStore();
  mockStore.worker.listWorkerSnapshots = () => [
    { workerId: "w1", status: "healthy", maxConcurrency: 5, runningExecutionsJson: "[]", lastHeartbeatAt: new Date().toISOString(), placement: "remote", registrationVerifiedAt: null, registrationChallengeId: null },
  ];
  mockStore.worker.listExecutionTicketsByStatuses = () => [];
  mockStore.worker.listExecutionLeasesByStatuses = () => [];
  mockStore.release.listEnvironmentReadinessRecords = () => [];
  mockStore.organization.listOrganizationRecords = () => [];
  mockStore.organization.listWorkspaceRecords = () => [];
  mockStore.organization.listTenantRecords = () => [];
  mockStore.organization.listDeploymentBindings = () => [];
  mockStore.organization.listDataNamespaces = () => [];

  const service = new PlatformOperatorService(createMockDb() as any, mockStore as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  assert.equal(report.executionPlane.untrustedWorkerIds.length, 1);
  assert.equal(report.executionPlane.workerCounts.untrusted, 1);
});

test("PlatformOperatorService buildReport counts tickets by status", () => {
  const mockStore = createMockStore();
  mockStore.worker.listWorkerSnapshots = () => [];
  mockStore.worker.listExecutionTicketsByStatuses = (statuses: string[]) => {
    if (statuses.includes("pending")) return createCountArray(5);
    if (statuses.includes("claimed")) return createCountArray(3);
    if (statuses.includes("consumed")) return createCountArray(10);
    return [];
  };
  mockStore.worker.listExecutionLeasesByStatuses = () => [];
  mockStore.release.listEnvironmentReadinessRecords = () => [];
  mockStore.organization.listOrganizationRecords = () => [];
  mockStore.organization.listWorkspaceRecords = () => [];
  mockStore.organization.listTenantRecords = () => [];
  mockStore.organization.listDeploymentBindings = () => [];
  mockStore.organization.listDataNamespaces = () => [];

  const service = new PlatformOperatorService(createMockDb() as any, mockStore as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  assert.equal(report.executionPlane.ticketCounts.pending, 5);
  assert.equal(report.executionPlane.ticketCounts.claimed, 3);
  assert.equal(report.executionPlane.ticketCounts.consumed, 10);
});

test("PlatformOperatorService buildReport counts leases by status", () => {
  const mockStore = createMockStore();
  mockStore.worker.listWorkerSnapshots = () => [];
  mockStore.worker.listExecutionTicketsByStatuses = () => [];
  mockStore.worker.listExecutionLeasesByStatuses = (statuses: string[]) => {
    if (statuses.includes("active")) return createCountArray(4);
    if (statuses.includes("expired")) return createCountArray(2);
    return [];
  };
  mockStore.release.listEnvironmentReadinessRecords = () => [];
  mockStore.organization.listOrganizationRecords = () => [];
  mockStore.organization.listWorkspaceRecords = () => [];
  mockStore.organization.listTenantRecords = () => [];
  mockStore.organization.listDeploymentBindings = () => [];
  mockStore.organization.listDataNamespaces = () => [];

  const service = new PlatformOperatorService(createMockDb() as any, mockStore as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  assert.equal(report.executionPlane.leaseCounts.active, 4);
  assert.equal(report.executionPlane.leaseCounts.expired, 2);
});

test("PlatformOperatorService buildReport readiness summary", () => {
  const mockStore = createMockStore();
  mockStore.worker.listWorkerSnapshots = () => [];
  mockStore.worker.listExecutionTicketsByStatuses = () => [];
  mockStore.worker.listExecutionLeasesByStatuses = () => [];
  mockStore.release.listEnvironmentReadinessRecords = () => [
    { componentType: "gateway", credentialReady: 1, secondaryGatesJson: "{}", lastVerifiedAt: new Date().toISOString() },
    { componentType: "gateway", credentialReady: 1, secondaryGatesJson: "{}", lastVerifiedAt: new Date().toISOString() },
    { componentType: "sandbox", credentialReady: 0, secondaryGatesJson: "{}", lastVerifiedAt: new Date().toISOString() },
  ];
  mockStore.organization.listOrganizationRecords = () => [];
  mockStore.organization.listWorkspaceRecords = () => [];
  mockStore.organization.listTenantRecords = () => [];
  mockStore.organization.listDeploymentBindings = () => [];
  mockStore.organization.listDataNamespaces = () => [];

  const service = new PlatformOperatorService(createMockDb() as any, mockStore as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  const gatewaySummary = report.executionPlane.readinessSummary.find(r => r.componentType === "gateway");
  assert.ok(gatewaySummary);
  assert.equal(gatewaySummary.total, 2);
  assert.equal(gatewaySummary.ready, 2);

  const sandboxSummary = report.executionPlane.readinessSummary.find(r => r.componentType === "sandbox");
  assert.ok(sandboxSummary);
  assert.equal(sandboxSummary.total, 1);
  assert.equal(sandboxSummary.notReady, 1);
});

test("PlatformOperatorService buildReport topology counts", () => {
  const mockStore = createMockStore();
  mockStore.worker.listWorkerSnapshots = () => [];
  mockStore.worker.listExecutionTicketsByStatuses = () => [];
  mockStore.worker.listExecutionLeasesByStatuses = () => [];
  mockStore.release.listEnvironmentReadinessRecords = () => [];
  mockStore.organization.listOrganizationRecords = () => [1, 2, 3] as any;
  mockStore.organization.listWorkspaceRecords = (opts: any) => [10, 11, 12, 13] as any;
  mockStore.organization.listTenantRecords = (opts: any) => [20, 21] as any;
  mockStore.organization.listDeploymentBindings = () => [100, 101] as any;
  mockStore.organization.listDataNamespaces = () => [200, 201, 202] as any;

  const service = new PlatformOperatorService(createMockDb() as any, mockStore as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  assert.equal(report.executionPlane.topology.organizations, 3);
  assert.equal(report.executionPlane.topology.workspaces, 4);
  assert.equal(report.executionPlane.topology.tenants, 2);
  assert.equal(report.executionPlane.topology.deploymentBindings, 2);
  assert.equal(report.executionPlane.topology.dataNamespaces, 3);
});

test("PlatformOperatorService exportReport returns artifacts", () => {
  const mockStore = createMockStore();
  mockStore.worker.listWorkerSnapshots = () => [];
  mockStore.worker.listExecutionTicketsByStatuses = () => [];
  mockStore.worker.listExecutionLeasesByStatuses = () => [];
  mockStore.release.listEnvironmentReadinessRecords = () => [];
  mockStore.organization.listOrganizationRecords = () => [];
  mockStore.organization.listWorkspaceRecords = () => [];
  mockStore.organization.listTenantRecords = () => [];
  mockStore.organization.listDeploymentBindings = () => [];
  mockStore.organization.listDataNamespaces = () => [];
  mockStore.task.getTask = () => null;
  mockStore.task.insertTask = () => {};

  const service = new PlatformOperatorService(createMockDb() as any, mockStore as any);

  const result = service.exportReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  assert.ok(result.jsonArtifact);
  assert.ok(result.markdownArtifact);
  assert.ok(result.report);
});

test("PlatformOperatorService available slots calculation", () => {
  const mockStore = createMockStore();
  mockStore.worker.listWorkerSnapshots = () => [
    { workerId: "w1", status: "healthy", maxConcurrency: 5, runningExecutionsJson: "[1,2,3]", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch1" },
    { workerId: "w2", status: "healthy", maxConcurrency: 10, runningExecutionsJson: "[]", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch2" },
  ];
  mockStore.worker.listExecutionTicketsByStatuses = () => [];
  mockStore.worker.listExecutionLeasesByStatuses = () => [];
  mockStore.release.listEnvironmentReadinessRecords = () => [];
  mockStore.organization.listOrganizationRecords = () => [];
  mockStore.organization.listWorkspaceRecords = () => [];
  mockStore.organization.listTenantRecords = () => [];
  mockStore.organization.listDeploymentBindings = () => [];
  mockStore.organization.listDataNamespaces = () => [];

  const service = new PlatformOperatorService(createMockDb() as any, mockStore as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  // w1 has 5 max, 3 running = 2 available
  // w2 has 10 max, 0 running = 10 available
  assert.equal(report.executionPlane.workerCounts.totalAvailableSlots, 12);
});

test("PlatformOperatorService handles malformed runningExecutionsJson", () => {
  const mockStore = createMockStore();
  mockStore.worker.listWorkerSnapshots = () => [
    { workerId: "w1", status: "healthy", maxConcurrency: 5, runningExecutionsJson: "not valid json", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch1" },
  ];
  mockStore.worker.listExecutionTicketsByStatuses = () => [];
  mockStore.worker.listExecutionLeasesByStatuses = () => [];
  mockStore.release.listEnvironmentReadinessRecords = () => [];
  mockStore.organization.listOrganizationRecords = () => [];
  mockStore.organization.listWorkspaceRecords = () => [];
  mockStore.organization.listTenantRecords = () => [];
  mockStore.organization.listDeploymentBindings = () => [];
  mockStore.organization.listDataNamespaces = () => [];

  const service = new PlatformOperatorService(createMockDb() as any, mockStore as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  // Should treat malformed JSON as 0 running executions
  assert.equal(report.executionPlane.workerCounts.totalAvailableSlots, 5);
});

test("PlatformOperatorService promotion eligibility", () => {
  const mockStore = createMockStore();
  mockStore.worker.listWorkerSnapshots = () => [];
  mockStore.worker.listExecutionTicketsByStatuses = () => [];
  mockStore.worker.listExecutionLeasesByStatuses = () => [];
  mockStore.release.listEnvironmentReadinessRecords = () => [];
  mockStore.organization.listOrganizationRecords = () => [];
  mockStore.organization.listWorkspaceRecords = () => [];
  mockStore.organization.listTenantRecords = () => [];
  mockStore.organization.listDeploymentBindings = () => [];
  mockStore.organization.listDataNamespaces = () => [];

  const service = new PlatformOperatorService(createMockDb() as any, mockStore as any);

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  // With no release package verdict being promote_approved, promoteEligible will be false
  assert.equal(typeof report.promoteEligible, "boolean");
});
