import assert from "node:assert/strict";
import test from "node:test";

import { ReleaseRepository } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/release-repository.js";

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

test("ReleaseRepository exposes the current release and ops repository surface", () => {
  const repo = new ReleaseRepository(createMockDb() as never);

  assert.equal(typeof repo.insertReleaseBundleRecord, "function");
  assert.equal(typeof repo.getReleaseBundleRecord, "function");
  assert.equal(typeof repo.listReleaseBundleRecords, "function");
  assert.equal(typeof repo.insertReleaseExecutionReportRecord, "function");
  assert.equal(typeof repo.getReleaseExecutionReportRecord, "function");
  assert.equal(typeof repo.insertDeploymentExecutionReportRecord, "function");
  assert.equal(typeof repo.upsertEnvironmentReadinessRecord, "function");
  assert.equal(typeof repo.getActiveEnvironmentReadinessRecord, "function");
  assert.equal(typeof repo.insertIncidentHandoffRecord, "function");
  assert.equal(typeof repo.listIncidentHandoffRecords, "function");
});

test("ReleaseRepository accepts current release record contracts", () => {
  const repo = new ReleaseRepository(createMockDb() as never);
  const now = "2026-04-21T10:00:00.000Z";

  repo.insertReleaseBundleRecord({
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
  });

  repo.insertReleaseExecutionReportRecord({
    executionId: "exec_release_1",
    bundleId: "bundle_1",
    environment: "production",
    version: "1.0.0",
    commitSha: "abc123",
    rolloutStrategy: "rolling",
    imageRef: "registry.example.com/image:v1.0.0",
    imageRepository: "registry.example.com",
    registrySecretRef: "secret_1",
    registrySecretProviderKind: "vault",
    registrySecretResolved: 1,
    registrySecretAccessMode: "lease",
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
  });

  repo.insertDeploymentExecutionReportRecord({
    executionId: "exec_deploy_1",
    environment: "production",
    version: "1.0.0",
    commitSha: "abc123",
    rolloutStrategy: "rolling",
    targetEligible: 1,
    configBundleRef: "config_bundle_1",
    configVersionId: "config_v1",
    registrySecretRef: "secret_1",
    registrySecretProviderKind: "vault",
    registrySecretResolved: 1,
    deploymentSecretRef: "secret_2",
    deploymentSecretProviderKind: "vault",
    deploymentSecretResolved: 1,
    publishWorkflowRunId: "run_1",
    publishWorkflowRunUrl: "https://workflow.example.com/run/1",
    deployWorkflowRunId: "run_2",
    deployWorkflowRunUrl: "https://workflow.example.com/run/2",
    executionMode: "execute",
    publishCommand: "npm run build",
    deployCommand: "kubectl apply",
    commandResultsJson: "{}",
    releaseBundleId: "bundle_1",
    taskId: "task_1",
    jsonArtifactUri: "https://artifacts.example.com/deploy_1.json",
    markdownArtifactUri: "https://artifacts.example.com/deploy_1.md",
    generatedAt: now,
    exportedAt: now,
  });

  assert.ok(true);
});

test("ReleaseRepository accepts current environment readiness and incident handoff contracts", () => {
  const repo = new ReleaseRepository(createMockDb() as never);
  const now = "2026-04-21T10:00:00.000Z";

  repo.upsertEnvironmentReadinessRecord({
    readinessId: "readiness_1",
    environment: "production",
    componentType: "provider",
    componentId: "provider_primary",
    credentialReady: 1,
    secondaryGatesJson: "[]",
    owner: "platform-team",
    lastVerifiedAt: now,
    isActive: 1,
    notes: null,
  });

  repo.insertIncidentHandoffRecord({
    handoffId: "handoff_1",
    incidentId: "incident_1",
    environment: "production",
    status: "warning",
    shiftOwner: "team_a",
    primaryOncall: "user_1",
    secondaryOncall: "user_2",
    severity: "high",
    handoffJson: "{}",
    createdAt: now,
  });

  assert.equal(repo.getReleaseBundleRecord("missing"), null);
  assert.equal(repo.getReleaseExecutionReportRecord("missing"), null);
  assert.equal(repo.getDeploymentExecutionReportRecord("missing"), null);
  assert.equal(repo.getActiveEnvironmentReadinessRecord("production", "provider", "provider_primary"), null);
  assert.ok(Array.isArray(repo.listIncidentHandoffRecords()));
});
