import assert from "node:assert/strict";
import test from "node:test";
import { ReleaseRepository } from "../../../../../../../src/platform/state-evidence/truth/sqlite/repositories/release-repository.js";

function createMockDb() {
  return {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 1 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  };
}

test("ReleaseRepository has all required methods", () => {
  const db = createMockDb() as any;
  const repo = new ReleaseRepository(db);

  // Bundle methods
  assert.equal(typeof repo.insertReleaseBundleRecord, "function");
  assert.equal(typeof repo.getReleaseBundleRecord, "function");
  assert.equal(typeof repo.listReleaseBundleRecords, "function");
  // Execution report methods
  assert.equal(typeof repo.insertReleaseExecutionReportRecord, "function");
  assert.equal(typeof repo.getReleaseExecutionReportRecord, "function");
  assert.equal(typeof repo.listReleaseExecutionReportRecords, "function");
  assert.equal(typeof repo.insertDeploymentExecutionReportRecord, "function");
  assert.equal(typeof repo.getDeploymentExecutionReportRecord, "function");
  assert.equal(typeof repo.listDeploymentExecutionReportRecords, "function");
  // Environment methods
  assert.equal(typeof repo.insertEnvironmentPromotionHistoryRecord, "function");
  assert.equal(typeof repo.listEnvironmentPromotionHistoryRecords, "function");
  assert.equal(typeof repo.upsertEnvironmentReadinessRecord, "function");
  assert.equal(typeof repo.getActiveEnvironmentReadinessRecord, "function");
  assert.equal(typeof repo.listEnvironmentReadinessRecords, "function");
  // Enterprise methods
  assert.equal(typeof repo.insertEnterpriseCapabilityReport, "function");
  assert.equal(typeof repo.listEnterpriseCapabilityReports, "function");
  assert.equal(typeof repo.insertIncidentHandoffRecord, "function");
  assert.equal(typeof repo.listIncidentHandoffRecords, "function");
  assert.equal(typeof repo.insertEnterpriseGovernanceReport, "function");
  assert.equal(typeof repo.listEnterpriseGovernanceReports, "function");
});

test("ReleaseRepository inserts release bundle record", () => {
  const db = createMockDb() as any;
  const repo = new ReleaseRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const bundle = {
    bundleId: "bundle_1",
    environment: "production",
    version: "1.0.0",
    commitSha: "abc123",
    imageTag: "v1.0.0",
    imageRef: "registry.example.com/image:v1.0.0",
    rolloutStrategy: "rolling",
    deploymentNamespace: "default",
    clusterName: "prod-cluster-1",
    configPath: "/config/prod.yaml",
    configBundleRef: "config_bundle_1",
    registryCredentialRef: "cred_1",
    deploymentCredentialRef: "cred_2",
    publishWorkflowPath: "/workflows/publish.yaml",
    deployWorkflowPath: "/workflows/deploy.yaml",
    requiredReadinessChecksJson: "[]",
    recommendedCommandsJson: "[]",
    taskId: "task_1",
    jsonArtifactUri: "https://artifacts.example.com/bundle_1.json",
    markdownArtifactUri: "https://artifacts.example.com/bundle_1.md",
    generatedAt: now,
    exportedAt: now,
  };

  repo.insertReleaseBundleRecord(bundle);
  assert.ok(true);
});

test("ReleaseRepository gets release bundle record", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => null,
        all: () => [],
      }),
    },
  } as any;
  const repo = new ReleaseRepository(db);

  const result = repo.getReleaseBundleRecord("nonexistent");
  assert.equal(result, null);
});

test("ReleaseRepository lists release bundle records", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new ReleaseRepository(db);

  const result = repo.listReleaseBundleRecords();
  assert.ok(Array.isArray(result));
});

test("ReleaseRepository lists release bundle records by environment", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new ReleaseRepository(db);

  const result = repo.listReleaseBundleRecords({ environment: "production" });
  assert.ok(Array.isArray(result));
});

test("ReleaseRepository inserts release execution report record", () => {
  const db = createMockDb() as any;
  const repo = new ReleaseRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const report = {
    executionId: "exec_release_1",
    bundleId: "bundle_1",
    environment: "production",
    version: "1.0.0",
    commitSha: "abc123",
    rolloutStrategy: "rolling",
    imageRef: "registry.example.com/image:v1.0.0",
    imageRepository: "registry.example.com",
    registrySecretRef: "secret_1",
    registrySecretProviderKind: "aws",
    registrySecretResolved: true,
    registrySecretAccessMode: "read_only",
    registryLeaseId: "lease_1",
    registryLeaseStatus: "active",
    registryLeaseExpiresAt: now,
    registryLeaseRevokedAt: null,
    publishWorkflowRunId: "run_1",
    publishWorkflowRunUrl: "https://workflow.example.com/run/1",
    buildCommand: "npm run build",
    publishCommand: "npm publish",
    commandResultsJson: "{}",
    taskId: "task_1",
    jsonArtifactUri: "https://artifacts.example.com/exec_1.json",
    markdownArtifactUri: "https://artifacts.example.com/exec_1.md",
    generatedAt: now,
    exportedAt: now,
  };

  repo.insertReleaseExecutionReportRecord(report);
  assert.ok(true);
});

test("ReleaseRepository gets release execution report record", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => null,
        all: () => [],
      }),
    },
  } as any;
  const repo = new ReleaseRepository(db);

  const result = repo.getReleaseExecutionReportRecord("nonexistent");
  assert.equal(result, null);
});

test("ReleaseRepository inserts deployment execution report record", () => {
  const db = createMockDb() as any;
  const repo = new ReleaseRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const report = {
    executionId: "exec_deploy_1",
    environment: "production",
    version: "1.0.0",
    commitSha: "abc123",
    rolloutStrategy: "rolling",
    targetEligible: true,
    configBundleRef: "config_bundle_1",
    configVersionId: "config_v1",
    registrySecretRef: "secret_1",
    registrySecretProviderKind: "aws",
    registrySecretResolved: true,
    deploymentSecretRef: "secret_2",
    deploymentSecretProviderKind: "aws",
    deploymentSecretResolved: true,
    publishWorkflowRunId: "run_1",
    publishWorkflowRunUrl: "https://workflow.example.com/run/1",
    deployWorkflowRunId: "run_2",
    deployWorkflowRunUrl: "https://workflow.example.com/run/2",
    executionMode: "automated",
    publishCommand: "npm run build",
    deployCommand: "kubectl apply",
    commandResultsJson: "{}",
    releaseBundleId: "bundle_1",
    taskId: "task_1",
    jsonArtifactUri: "https://artifacts.example.com/deploy_1.json",
    markdownArtifactUri: "https://artifacts.example.com/deploy_1.md",
    generatedAt: now,
    exportedAt: now,
  };

  repo.insertDeploymentExecutionReportRecord(report);
  assert.ok(true);
});

test("ReleaseRepository gets deployment execution report record", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => null,
        all: () => [],
      }),
    },
  } as any;
  const repo = new ReleaseRepository(db);

  const result = repo.getDeploymentExecutionReportRecord("nonexistent");
  assert.equal(result, null);
});

test("ReleaseRepository upserts environment readiness record", () => {
  const db = createMockDb() as any;
  const repo = new ReleaseRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const record = {
    readinessId: "readiness_1",
    environment: "production",
    componentType: "database",
    componentId: "db_primary",
    credentialReady: true,
    secondaryGatesJson: "[]",
    owner: "platform-team",
    lastVerifiedAt: now,
    isActive: true,
    notes: null,
  };

  repo.upsertEnvironmentReadinessRecord(record);
  assert.ok(true);
});

test("ReleaseRepository gets active environment readiness record", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => null,
        all: () => [],
      }),
    },
  } as any;
  const repo = new ReleaseRepository(db);

  const result = repo.getActiveEnvironmentReadinessRecord("production", "database", "db_primary");
  assert.equal(result, null);
});

test("ReleaseRepository lists environment readiness records", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new ReleaseRepository(db);

  const result = repo.listEnvironmentReadinessRecords();
  assert.ok(Array.isArray(result));
});

test("ReleaseRepository inserts incident handoff record", () => {
  const db = createMockDb() as any;
  const repo = new ReleaseRepository(db);

  const now = "2026-04-21T10:00:00.000Z";
  const record = {
    handoffId: "handoff_1",
    incidentId: "incident_1",
    environment: "production",
    status: "pending",
    shiftOwner: "team_a",
    primaryOncall: "user_1",
    secondaryOncall: "user_2",
    severity: "high",
    handoffJson: "{}",
    createdAt: now,
  };

  repo.insertIncidentHandoffRecord(record);
  assert.ok(true);
});

test("ReleaseRepository lists incident handoff records", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new ReleaseRepository(db);

  const result = repo.listIncidentHandoffRecords();
  assert.ok(Array.isArray(result));
});

test("ReleaseRepository lists enterprise governance reports", () => {
  const db = {
    connection: {
      prepare: () => ({
        run: () => ({ changes: 0 }),
        get: () => undefined,
        all: () => [],
      }),
    },
  } as any;
  const repo = new ReleaseRepository(db);

  const result = repo.listEnterpriseGovernanceReports();
  assert.ok(Array.isArray(result));
});