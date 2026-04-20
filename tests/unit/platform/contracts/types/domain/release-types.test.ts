import assert from "node:assert/strict";
import test from "node:test";

import type {
  ReleaseBundleRecord,
  ReleaseExecutionReportRecord,
  DeploymentExecutionReportRecord,
  EnvironmentPromotionHistoryRecord,
} from "../../../../../../src/platform/contracts/types/domain/release-types.js";

test("ReleaseBundleRecord structure is correct", () => {
  const record: ReleaseBundleRecord = {
    bundleId: "bundle_123",
    environment: "prod",
    version: "1.0.0",
    commitSha: "abc123def456",
    imageTag: "v1.0.0",
    imageRef: "registry.example.com/app:v1.0.0",
    rolloutStrategy: "rolling",
    deploymentNamespace: "default",
    clusterName: "prod-cluster-1",
    configPath: "/config/release.yaml",
    configBundleRef: "config-bundle-123",
    registryCredentialRef: "registry-cred-123",
    deploymentCredentialRef: "deploy-cred-123",
    publishWorkflowPath: "/workflows/publish.yaml",
    deployWorkflowPath: "/workflows/deploy.yaml",
    requiredReadinessChecksJson: "[]",
    recommendedCommandsJson: "[]",
    taskId: null,
    jsonArtifactUri: null,
    markdownArtifactUri: null,
    generatedAt: "2026-04-14T00:00:00.000Z",
    exportedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.bundleId, "bundle_123");
  assert.equal(record.environment, "prod");
  assert.equal(record.rolloutStrategy, "rolling");
  assert.equal(record.taskId, null);
});

test("ReleaseBundleRecord accepts all rollout strategies", () => {
  const rolling: ReleaseBundleRecord = { rolloutStrategy: "rolling" } as ReleaseBundleRecord;
  const canary: ReleaseBundleRecord = { rolloutStrategy: "canary" } as ReleaseBundleRecord;
  const blueGreen: ReleaseBundleRecord = { rolloutStrategy: "blue_green" } as ReleaseBundleRecord;
  assert.equal(rolling.rolloutStrategy, "rolling");
  assert.equal(canary.rolloutStrategy, "canary");
  assert.equal(blueGreen.rolloutStrategy, "blue_green");
});

test("ReleaseExecutionReportRecord structure is correct", () => {
  const record: ReleaseExecutionReportRecord = {
    executionId: "exec_123",
    bundleId: "bundle_456",
    environment: "staging",
    version: "2.0.0",
    commitSha: "xyz789",
    rolloutStrategy: "canary",
    imageRef: "registry.example.com/app:v2.0.0",
    imageRepository: "app",
    registrySecretRef: "secret-ref",
    registrySecretProviderKind: "secret_manager",
    registrySecretResolved: 1,
    registrySecretAccessMode: "lease",
    registryLeaseId: "lease_123",
    registryLeaseStatus: "active",
    registryLeaseExpiresAt: "2026-04-15T00:00:00.000Z",
    registryLeaseRevokedAt: null,
    publishWorkflowRunId: "run_123",
    publishWorkflowRunUrl: "https://workflow.example.com/run/123",
    buildCommand: "npm run build",
    publishCommand: "npm run publish",
    commandResultsJson: "{}",
    taskId: "task_789",
    jsonArtifactUri: "https://artifacts.example.com/release.json",
    markdownArtifactUri: "https://artifacts.example.com/release.md",
    generatedAt: "2026-04-14T00:00:00.000Z",
    exportedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.executionId, "exec_123");
  assert.equal(record.registrySecretResolved, 1);
  assert.equal(record.registryLeaseStatus, "active");
});

test("DeploymentExecutionReportRecord structure is correct", () => {
  const record: DeploymentExecutionReportRecord = {
    executionId: "deploy_exec_123",
    environment: "prod",
    version: "1.0.0",
    commitSha: "abc123",
    rolloutStrategy: "blue_green",
    targetEligible: 1,
    configBundleRef: "config-ref",
    configVersionId: "config_v1",
    registrySecretRef: "registry-secret",
    registrySecretProviderKind: "secret_manager",
    registrySecretResolved: 1,
    deploymentSecretRef: "deploy-secret",
    deploymentSecretProviderKind: "vault",
    deploymentSecretResolved: 1,
    publishWorkflowRunId: "run_1",
    publishWorkflowRunUrl: "https://example.com/run/1",
    deployWorkflowRunId: "run_2",
    deployWorkflowRunUrl: "https://example.com/run/2",
    executionMode: "execute",
    publishCommand: "make publish",
    deployCommand: "make deploy",
    commandResultsJson: "{}",
    releaseBundleId: "bundle_123",
    taskId: null,
    jsonArtifactUri: null,
    markdownArtifactUri: null,
    generatedAt: "2026-04-14T00:00:00.000Z",
    exportedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.targetEligible, 1);
  assert.equal(record.executionMode, "execute");
  assert.equal(record.releaseBundleId, "bundle_123");
});

test("EnvironmentPromotionHistoryRecord structure is correct", () => {
  const record: EnvironmentPromotionHistoryRecord = {
    promotionId: "promo_123",
    sourceEnvironment: "staging",
    targetEnvironment: "prod",
    version: "1.0.0",
    commitSha: "abc123",
    rolloutStrategy: "rolling",
    decisionType: "execute",
    decisionStatus: "executed",
    releaseBundleId: "bundle_456",
    deploymentExecutionId: "deploy_exec_789",
    reasonCode: "manual_approval",
    actor: "user@example.com",
    metadataJson: '{"approved_by":"admin"}',
    recordedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.promotionId, "promo_123");
  assert.equal(record.sourceEnvironment, "staging");
  assert.equal(record.decisionStatus, "executed");
  assert.equal(record.metadataJson, '{"approved_by":"admin"}');
});

test("EnvironmentPromotionHistoryRecord allows null sourceEnvironment", () => {
  const record: EnvironmentPromotionHistoryRecord = {
    promotionId: "promo_initial",
    sourceEnvironment: null,
    targetEnvironment: "prod",
    version: "1.0.0",
    commitSha: "abc123",
    rolloutStrategy: "canary",
    decisionType: "plan",
    decisionStatus: "planned",
    releaseBundleId: null,
    deploymentExecutionId: null,
    reasonCode: "initial_deployment",
    actor: "system",
    metadataJson: null,
    recordedAt: "2026-04-14T00:00:00.000Z",
  };
  assert.equal(record.sourceEnvironment, null);
  assert.equal(record.releaseBundleId, null);
});
