import assert from "node:assert/strict";
import test from "node:test";

import {
  PlatformOperatorService,
  type PlatformOperatorBuildInput,
  type PlatformOperatorReport,
} from "../../../src/scale-ecosystem/operations/platform-operator-service.js";
import { createTempWorkspace, cleanupPath } from "../../helpers/fs.js";
import { createFile } from "../../helpers/fs.js";

// Mock store factory for PlatformOperatorService tests
function createMockStore() {
  return {
    worker: {
      listWorkerSnapshots: () => [],
      listExecutionTicketsByStatuses: () => [] as string[],
      listExecutionLeasesByStatuses: () => [] as string[],
    },
    release: {
      listEnvironmentReadinessRecords: () => [],
    },
    organization: {
      listOrganizationRecords: () => [],
      listWorkspaceRecords: () => [] as string[],
      listTenantRecords: () => [] as string[],
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

test("operations: PlatformOperatorService can be instantiated with mock dependencies", () => {
  const service = new PlatformOperatorService(createMockDb() as any, createMockStore() as any);
  assert.ok(service);
});

test("operations: PlatformOperatorService buildReport returns complete report structure", () => {
  const mockStore = createMockStore();
  const service = new PlatformOperatorService(createMockDb() as any, mockStore as any);

  const input: PlatformOperatorBuildInput = {
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  };

  const report = service.buildReport(input);

  assert.ok(report.reportId);
  assert.equal(report.componentId, "execution_plane");
  assert.equal(report.environment, "production");
  assert.ok(report.generatedAt);
  assert.ok(report.targetStatus);
  assert.ok(report.currentStatus);
  assert.ok(report.overallVerdict);
  assert.ok(typeof report.promoteEligible === "boolean");
  assert.ok(report.executionPlane);
  assert.ok(report.releasePackage);
});

test("operations: PlatformOperatorService buildReport with custom generatedAt preserves timestamp", () => {
  const mockStore = createMockStore();
  const service = new PlatformOperatorService(createMockDb() as any, mockStore as any);

  const customTime = "2026-04-20T12:00:00.000Z";
  const report = service.buildReport({
    environment: "staging",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
    generatedAt: customTime,
  });

  assert.equal(report.generatedAt, customTime);
});

test("operations: PlatformOperatorService buildReport with canary target status", () => {
  const mockStore = createMockStore();
  const service = new PlatformOperatorService(createMockDb() as any, mockStore as any);

  const report = service.buildReport({
    environment: "canary",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
    targetStatus: "canary",
  });

  assert.equal(report.targetStatus, "canary");
});

test("operations: PlatformOperatorService counts workers by scheduling status", () => {
  const mockStore = createMockStore();
  mockStore.worker.listWorkerSnapshots = () => [
    { workerId: "w1", status: "healthy", maxConcurrency: 5, runningExecutionsJson: "[]", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch1" },
    { workerId: "w2", status: "healthy", maxConcurrency: 5, runningExecutionsJson: "[]", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch2" },
    { workerId: "w3", status: "degraded", maxConcurrency: 3, runningExecutionsJson: "[]", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch3" },
    { workerId: "w4", status: "draining", maxConcurrency: 4, runningExecutionsJson: "[]", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch4" },
  ] as any;
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

  assert.equal(report.executionPlane.workerCounts.total, 4);
  assert.equal(report.executionPlane.workerCounts.healthy, 2);
  assert.equal(report.executionPlane.workerCounts.degraded, 1);
  assert.equal(report.executionPlane.workerCounts.draining, 1);
});

test("operations: PlatformOperatorService detects stale workers based on heartbeat age", () => {
  const mockStore = createMockStore();
  const recentHeartbeat = new Date().toISOString();
  const oldHeartbeat = new Date(Date.now() - 15 * 60 * 1000).toISOString(); // 15 minutes ago

  mockStore.worker.listWorkerSnapshots = () => [
    { workerId: "w1", status: "healthy", maxConcurrency: 5, runningExecutionsJson: "[]", lastHeartbeatAt: recentHeartbeat, placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch1" },
    { workerId: "w2", status: "healthy", maxConcurrency: 5, runningExecutionsJson: "[]", lastHeartbeatAt: oldHeartbeat, placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch2" },
  ] as any;
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
  assert.equal(report.executionPlane.staleWorkerIds[0], "w2");
  assert.equal(report.executionPlane.workerCounts.stale, 1);
});

test("operations: PlatformOperatorService detects untrusted remote workers", () => {
  const mockStore = createMockStore();
  mockStore.worker.listWorkerSnapshots = () => [
    { workerId: "w1", status: "healthy", maxConcurrency: 5, runningExecutionsJson: "[]", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch1" },
    { workerId: "w2", status: "healthy", maxConcurrency: 5, runningExecutionsJson: "[]", lastHeartbeatAt: new Date().toISOString(), placement: "remote", registrationVerifiedAt: null, registrationChallengeId: null },
    { workerId: "w3", status: "healthy", maxConcurrency: 5, runningExecutionsJson: "[]", lastHeartbeatAt: new Date().toISOString(), placement: "remote", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch3" },
  ] as any;
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
  assert.equal(report.executionPlane.untrustedWorkerIds[0], "w2");
  assert.equal(report.executionPlane.workerCounts.untrusted, 1);
});

test("operations: PlatformOperatorService counts execution tickets by status", () => {
  const mockStore = createMockStore();
  mockStore.worker.listWorkerSnapshots = () => [];
  mockStore.worker.listExecutionTicketsByStatuses = ((statuses: string[]) => {
    if (statuses.includes("pending")) return { length: 5 };
    if (statuses.includes("claimed")) return { length: 3 };
    if (statuses.includes("consumed")) return { length: 10 };
    if (statuses.includes("cancelled")) return { length: 2 };
    if (statuses.includes("expired")) return { length: 1 };
    return { length: 0 };
  }) as any;
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
  assert.equal(report.executionPlane.ticketCounts.cancelled, 2);
  assert.equal(report.executionPlane.ticketCounts.expired, 1);
});

test("operations: PlatformOperatorService counts execution leases by status", () => {
  const mockStore = createMockStore();
  mockStore.worker.listWorkerSnapshots = () => [];
  mockStore.worker.listExecutionTicketsByStatuses = () => [];
  mockStore.worker.listExecutionLeasesByStatuses = ((statuses: string[]) => {
    if (statuses.includes("active")) return { length: 4 };
    if (statuses.includes("expired")) return { length: 2 };
    if (statuses.includes("released")) return { length: 1 };
    if (statuses.includes("reclaimed")) return { length: 0 };
    if (statuses.includes("handed_over")) return { length: 0 };
    return { length: 0 };
  }) as any;
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
  assert.equal(report.executionPlane.leaseCounts.released, 1);
});

test("operations: PlatformOperatorService builds readiness summary per component type", () => {
  const mockStore = createMockStore();
  mockStore.worker.listWorkerSnapshots = () => [];
  mockStore.worker.listExecutionTicketsByStatuses = () => [];
  mockStore.worker.listExecutionLeasesByStatuses = () => [];
  mockStore.release.listEnvironmentReadinessRecords = () => [
    { componentType: "provider", credentialReady: 1, secondaryGatesJson: '{"gate1":true}', lastVerifiedAt: new Date().toISOString() },
    { componentType: "provider", credentialReady: 1, secondaryGatesJson: '{"gate1":true}', lastVerifiedAt: new Date().toISOString() },
    { componentType: "gateway", credentialReady: 1, secondaryGatesJson: '{"gate1":true}', lastVerifiedAt: new Date().toISOString() },
    { componentType: "gateway", credentialReady: 0, secondaryGatesJson: '{"gate1":false}', lastVerifiedAt: new Date().toISOString() },
    { componentType: "sandbox", credentialReady: 1, secondaryGatesJson: '{"gate1":true}', lastVerifiedAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString() }, // stale
    { componentType: "worker_fleet", credentialReady: 1, secondaryGatesJson: '{"gate1":true}', lastVerifiedAt: new Date().toISOString() },
    { componentType: "artifact_store", credentialReady: 1, secondaryGatesJson: '{"gate1":true}', lastVerifiedAt: new Date().toISOString() },
  ] as any;
  mockStore.organization.listOrganizationRecords = () => [];
  mockStore.organization.listWorkspaceRecords = () => [];
  mockStore.organization.listTenantRecords = () => [];
  mockStore.organization.listDeploymentBindings = () => [];
  mockStore.organization.listDataNamespaces = () => [];

  const service = new PlatformOperatorService(createMockDb() as any, mockStore as any, {
    readinessStaleThresholdMs: 24 * 60 * 60 * 1000,
  });

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  const providerSummary = report.executionPlane.readinessSummary.find((r) => r.componentType === "provider");
  assert.ok(providerSummary);
  assert.equal(providerSummary.total, 2);
  assert.equal(providerSummary.ready, 2);
  assert.equal(providerSummary.notReady, 0);
  assert.equal(providerSummary.stale, 0);
  assert.equal(providerSummary.allReady, true);

  const gatewaySummary = report.executionPlane.readinessSummary.find((r) => r.componentType === "gateway");
  assert.ok(gatewaySummary);
  assert.equal(gatewaySummary.total, 2);
  assert.equal(gatewaySummary.ready, 1);
  assert.equal(gatewaySummary.notReady, 1);
  assert.equal(gatewaySummary.allReady, false);

  const sandboxSummary = report.executionPlane.readinessSummary.find((r) => r.componentType === "sandbox");
  assert.ok(sandboxSummary);
  assert.equal(sandboxSummary.total, 1);
  assert.equal(sandboxSummary.stale, 1);
  assert.equal(sandboxSummary.allReady, false);
});

test("operations: PlatformOperatorService collects topology counts", () => {
  const mockStore = createMockStore();
  mockStore.worker.listWorkerSnapshots = () => [];
  mockStore.worker.listExecutionTicketsByStatuses = () => [];
  mockStore.worker.listExecutionLeasesByStatuses = () => [];
  mockStore.release.listEnvironmentReadinessRecords = () => [];
  mockStore.organization.listOrganizationRecords = () => [1, 2, 3] as any;
  mockStore.organization.listWorkspaceRecords = () => [10, 11, 12, 13] as any;
  mockStore.organization.listTenantRecords = () => [20, 21] as any;
  mockStore.organization.listDeploymentBindings = () => [100, 101, 102] as any;
  mockStore.organization.listDataNamespaces = () => [200, 201] as any;

  const service = new PlatformOperatorService(createMockDb() as any, mockStore as any);
  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  assert.equal(report.executionPlane.topology.organizations, 3);
  assert.equal(report.executionPlane.topology.workspaces, 4);
  assert.equal(report.executionPlane.topology.tenants, 2);
  assert.equal(report.executionPlane.topology.deploymentBindings, 3);
  assert.equal(report.executionPlane.topology.dataNamespaces, 2);
});

test("operations: PlatformOperatorService calculates available worker slots correctly", () => {
  const mockStore = createMockStore();
  mockStore.worker.listWorkerSnapshots = () => [
    { workerId: "w1", status: "healthy", maxConcurrency: 10, runningExecutionsJson: "[1,2,3]", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch1" },
    { workerId: "w2", status: "healthy", maxConcurrency: 5, runningExecutionsJson: "[1,2]", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch2" },
    { workerId: "w3", status: "healthy", maxConcurrency: 8, runningExecutionsJson: "[]", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch3" },
  ] as any;
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

  // w1: 10 max - 3 running = 7 available
  // w2: 5 max - 2 running = 3 available
  // w3: 8 max - 0 running = 8 available
  // Total: 18
  assert.equal(report.executionPlane.workerCounts.totalAvailableSlots, 18);
});

test("operations: PlatformOperatorService identifies promotion risks", () => {
  const mockStore = createMockStore();
  const oldHeartbeat = new Date(Date.now() - 20 * 60 * 1000).toISOString();

  mockStore.worker.listWorkerSnapshots = () => [
    { workerId: "w1", status: "healthy", maxConcurrency: 5, runningExecutionsJson: "[]", lastHeartbeatAt: oldHeartbeat, placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch1" },
    { workerId: "w2", status: "healthy", maxConcurrency: 5, runningExecutionsJson: "[]", lastHeartbeatAt: new Date().toISOString(), placement: "remote", registrationVerifiedAt: null, registrationChallengeId: null },
  ] as any;
  mockStore.worker.listExecutionTicketsByStatuses = () => [];
  mockStore.worker.listExecutionLeasesByStatuses = () => [];
  mockStore.release.listEnvironmentReadinessRecords = () => [
    { componentType: "gateway", credentialReady: 0, secondaryGatesJson: "{}", lastVerifiedAt: new Date().toISOString() },
  ] as any;
  mockStore.organization.listOrganizationRecords = () => [];
  mockStore.organization.listWorkspaceRecords = () => [];
  mockStore.organization.listTenantRecords = () => [];
  mockStore.organization.listDeploymentBindings = () => [];
  mockStore.organization.listDataNamespaces = () => [];

  const service = new PlatformOperatorService(createMockDb() as any, mockStore as any, {
    staleWorkerThresholdMs: 10 * 60 * 1000,
  });

  const report = service.buildReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  assert.ok(report.executionPlane.promotionRisks.length > 0);
  assert.ok(report.executionPlane.promotionRisks.some((r) => r.includes("stale worker")));
  assert.ok(report.executionPlane.promotionRisks.some((r) => r.includes("untrusted worker")));
  assert.ok(report.executionPlane.promotionRisks.some((r) => r.includes("gateway")));
});

test("operations: PlatformOperatorService exportReport produces JSON and Markdown artifacts", () => {
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

  const result = service.exportReport({
    environment: "production",
    evidenceRootDir: "/tmp/evidence",
    packageOutputDir: "/tmp/output",
  });

  assert.ok(result.report);
  assert.ok(result.jsonArtifact);
  assert.ok(result.markdownArtifact);
  assert.equal(result.report.componentId, "execution_plane");
  assert.equal(result.jsonArtifact.kind, "platform_operator_report");
  assert.equal(result.markdownArtifact.kind, "platform_operator_summary");
});

test("operations: PlatformOperatorService handles missing readiness records as promotion risk", () => {
  const mockStore = createMockStore();
  mockStore.worker.listWorkerSnapshots = () => [];
  mockStore.worker.listExecutionTicketsByStatuses = () => [];
  mockStore.worker.listExecutionLeasesByStatuses = () => [];
  mockStore.release.listEnvironmentReadinessRecords = () => [
    { componentType: "provider", credentialReady: 1, secondaryGatesJson: '{"gate1":true}', lastVerifiedAt: new Date().toISOString() },
    // Missing records for gateway, sandbox, worker_fleet, artifact_store
  ] as any;
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

  assert.ok(report.executionPlane.promotionRisks.some((r) => r.includes("missing readiness records")));
});

test("operations: PlatformOperatorService lease count exceeding worker count is a promotion risk", () => {
  const mockStore = createMockStore();
  mockStore.worker.listWorkerSnapshots = () => [
    { workerId: "w1", status: "healthy", maxConcurrency: 5, runningExecutionsJson: "[]", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch1" },
  ] as any;
  mockStore.worker.listExecutionTicketsByStatuses = () => [];
  mockStore.worker.listExecutionLeasesByStatuses = ((statuses: string[]) => {
    if (statuses.includes("active")) return { length: 10 }; // More active leases than workers
    return { length: 0 };
  }) as any;
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

  assert.ok(report.executionPlane.promotionRisks.some((r) => r.includes("active lease count exceeds")));
});

test("operations: PlatformOperatorService with zero workers handles gracefully", () => {
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

  assert.equal(report.executionPlane.workerCounts.total, 0);
  assert.equal(report.executionPlane.workerCounts.totalAvailableSlots, 0);
  assert.deepEqual(report.executionPlane.staleWorkerIds, []);
  assert.deepEqual(report.executionPlane.untrustedWorkerIds, []);
});

test("operations: PlatformOperatorService malformed runningExecutionsJson treated as zero", () => {
  const mockStore = createMockStore();
  mockStore.worker.listWorkerSnapshots = () => [
    { workerId: "w1", status: "healthy", maxConcurrency: 5, runningExecutionsJson: "not valid json", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch1" },
    { workerId: "w2", status: "healthy", maxConcurrency: 10, runningExecutionsJson: "also not valid", lastHeartbeatAt: new Date().toISOString(), placement: "local", registrationVerifiedAt: new Date().toISOString(), registrationChallengeId: "ch2" },
  ] as any;
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

  // Malformed JSON treated as 0 running, so all slots available
  assert.equal(report.executionPlane.workerCounts.totalAvailableSlots, 15); // 5 + 10
});
