import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ReleaseRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/release-repository.js";
import { SqliteDatabase } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";

const now = "2026-04-15T10:00:00.000Z";

test("ReleaseRepository insertReleaseBundleRecord and getReleaseBundleRecord", () => {
  const workspace = createTempWorkspace("aa-release-repo-");
  const dbPath = join(workspace, "release-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ReleaseRepository(db);

    repo.insertReleaseBundleRecord({
      bundleId: "bundle-1",
      environment: "staging",
      version: "1.0.0",
      commitSha: "abc123",
      imageTag: "app:1.0.0",
      imageRef: "registry/app:1.0.0",
      rolloutStrategy: "rolling",
      deploymentNamespace: "app-staging",
      clusterName: "cluster-1",
      configPath: "config/staging.yaml",
      configBundleRef: "cfg-1",
      registryCredentialRef: "secret://registry",
      deploymentCredentialRef: "secret://deploy",
      publishWorkflowPath: ".github/workflows/publish.yml",
      deployWorkflowPath: ".github/workflows/deploy.yml",
      requiredReadinessChecksJson: "[]",
      recommendedCommandsJson: "[]",
      taskId: null,
      jsonArtifactUri: null,
      markdownArtifactUri: null,
      generatedAt: now,
      exportedAt: now,
    });

    const result = repo.getReleaseBundleRecord("bundle-1");
    assert.ok(result);
    assert.equal(result.bundleId, "bundle-1");
    assert.equal(result.environment, "staging");
    assert.equal(result.version, "1.0.0");
    assert.equal(result.commitSha, "abc123");
    assert.equal(result.imageTag, "app:1.0.0");
    assert.equal(result.imageRef, "registry/app:1.0.0");
    assert.equal(result.rolloutStrategy, "rolling");
    assert.equal(result.deploymentNamespace, "app-staging");
    assert.equal(result.clusterName, "cluster-1");
    assert.equal(result.configPath, "config/staging.yaml");
  } finally {
    cleanupPath(workspace);
  }
});

test("ReleaseRepository insertReleaseBundleRecord and listReleaseBundleRecords", () => {
  const workspace = createTempWorkspace("aa-release-repo-list-");
  const dbPath = join(workspace, "release-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ReleaseRepository(db);

    repo.insertReleaseBundleRecord({
      bundleId: "bundle-list-1",
      environment: "prod",
      version: "2.0.0",
      commitSha: "def456",
      imageTag: "app:2.0.0",
      imageRef: "registry/app:2.0.0",
      rolloutStrategy: "canary",
      deploymentNamespace: "app-prod",
      clusterName: "cluster-prod",
      configPath: "config/prod.yaml",
      configBundleRef: "cfg-prod",
      registryCredentialRef: "secret://registry-prod",
      deploymentCredentialRef: "secret://deploy-prod",
      publishWorkflowPath: ".github/workflows/publish-prod.yml",
      deployWorkflowPath: ".github/workflows/deploy-prod.yml",
      requiredReadinessChecksJson: "[]",
      recommendedCommandsJson: "[]",
      taskId: null,
      jsonArtifactUri: null,
      markdownArtifactUri: null,
      generatedAt: now,
      exportedAt: now,
    });

    const all = repo.listReleaseBundleRecords();
    assert.equal(all.length, 1);
    assert.equal(all[0]?.bundleId, "bundle-list-1");
    assert.equal(all[0]?.environment, "prod");

    const filtered = repo.listReleaseBundleRecords({ environment: "prod" });
    assert.equal(filtered.length, 1);

    const empty = repo.listReleaseBundleRecords({ environment: "staging" });
    assert.equal(empty.length, 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("ReleaseRepository insertReleaseExecutionReportRecord and getReleaseExecutionReportRecord", () => {
  const workspace = createTempWorkspace("aa-release-exec-repo-");
  const dbPath = join(workspace, "release-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ReleaseRepository(db);

    repo.insertReleaseExecutionReportRecord({
      executionId: "release-exec-1",
      bundleId: "bundle-1",
      environment: "staging",
      version: "1.0.0",
      commitSha: "abc123",
      rolloutStrategy: "rolling",
      imageRef: "registry/app:1.0.0",
      imageRepository: "registry/app",
      registrySecretRef: "secret://registry",
      registrySecretProviderKind: "vault",
      registrySecretResolved: 1,
      registrySecretAccessMode: "lease",
      registryLeaseId: null,
      registryLeaseStatus: null,
      registryLeaseExpiresAt: null,
      registryLeaseRevokedAt: null,
      publishWorkflowRunId: "wf-1",
      publishWorkflowRunUrl: "https://example/publish/1",
      buildCommand: "npm run build",
      publishCommand: "docker push",
      commandResultsJson: "{}",
      taskId: null,
      jsonArtifactUri: null,
      markdownArtifactUri: null,
      generatedAt: now,
      exportedAt: now,
    });

    const result = repo.getReleaseExecutionReportRecord("release-exec-1");
    assert.ok(result);
    assert.equal(result?.executionId, "release-exec-1");
    assert.equal(result?.bundleId, "bundle-1");
    assert.equal(result?.environment, "staging");
    assert.equal(result?.version, "1.0.0");
    assert.equal(result?.registrySecretProviderKind, "vault");
    assert.equal(result?.registrySecretResolved, 1);
    assert.equal(result?.publishWorkflowRunId, "wf-1");
  } finally {
    cleanupPath(workspace);
  }
});

test("ReleaseRepository listReleaseExecutionReportRecords filters by environment", () => {
  const workspace = createTempWorkspace("aa-release-exec-list-");
  const dbPath = join(workspace, "release-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ReleaseRepository(db);

    repo.insertReleaseExecutionReportRecord({
      executionId: "release-exec-staging",
      bundleId: "bundle-1",
      environment: "staging",
      version: "1.0.0",
      commitSha: "abc123",
      rolloutStrategy: "rolling",
      imageRef: "registry/app:1.0.0",
      imageRepository: "registry/app",
      registrySecretRef: "secret://registry",
      registrySecretProviderKind: "vault",
      registrySecretResolved: 1,
      registrySecretAccessMode: "lease",
      registryLeaseId: null,
      registryLeaseStatus: null,
      registryLeaseExpiresAt: null,
      registryLeaseRevokedAt: null,
      publishWorkflowRunId: "wf-1",
      publishWorkflowRunUrl: "https://example/publish/1",
      buildCommand: "npm run build",
      publishCommand: "docker push",
      commandResultsJson: "{}",
      taskId: null,
      jsonArtifactUri: null,
      markdownArtifactUri: null,
      generatedAt: now,
      exportedAt: now,
    });

    const all = repo.listReleaseExecutionReportRecords();
    assert.equal(all.length, 1);

    const staging = repo.listReleaseExecutionReportRecords({ environment: "staging" });
    assert.equal(staging.length, 1);

    const prod = repo.listReleaseExecutionReportRecords({ environment: "production" });
    assert.equal(prod.length, 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("ReleaseRepository insertDeploymentExecutionReportRecord and getDeploymentExecutionReportRecord", () => {
  const workspace = createTempWorkspace("aa-deploy-exec-repo-");
  const dbPath = join(workspace, "release-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ReleaseRepository(db);

    repo.insertDeploymentExecutionReportRecord({
      executionId: "deploy-exec-1",
      environment: "staging",
      version: "1.0.0",
      commitSha: "abc123",
      rolloutStrategy: "rolling",
      targetEligible: 1,
      configBundleRef: "cfg-1",
      configVersionId: null,
      registrySecretRef: "secret://registry",
      registrySecretProviderKind: "vault",
      registrySecretResolved: 1,
      deploymentSecretRef: "secret://deploy",
      deploymentSecretProviderKind: "vault",
      deploymentSecretResolved: 1,
      publishWorkflowRunId: "wf-1",
      publishWorkflowRunUrl: "https://example/publish/1",
      deployWorkflowRunId: "wf-2",
      deployWorkflowRunUrl: "https://example/deploy/1",
      executionMode: "execute",
      publishCommand: "docker push",
      deployCommand: "kubectl apply -f",
      commandResultsJson: "{}",
      releaseBundleId: "bundle-1",
      taskId: null,
      jsonArtifactUri: null,
      markdownArtifactUri: null,
      generatedAt: now,
      exportedAt: now,
    });

    const result = repo.getDeploymentExecutionReportRecord("deploy-exec-1");
    assert.ok(result);
    assert.equal(result?.executionId, "deploy-exec-1");
    assert.equal(result?.environment, "staging");
    assert.equal(result?.version, "1.0.0");
    assert.equal(result?.rolloutStrategy, "rolling");
    assert.equal(result?.targetEligible, 1);
    assert.equal(result?.executionMode, "execute");
    assert.equal(result?.releaseBundleId, "bundle-1");
  } finally {
    cleanupPath(workspace);
  }
});

test("ReleaseRepository listDeploymentExecutionReportRecords filters by environment", () => {
  const workspace = createTempWorkspace("aa-deploy-exec-list-");
  const dbPath = join(workspace, "release-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ReleaseRepository(db);

    repo.insertDeploymentExecutionReportRecord({
      executionId: "deploy-exec-prod",
      environment: "prod",
      version: "2.0.0",
      commitSha: "def456",
      rolloutStrategy: "canary",
      targetEligible: 0,
      configBundleRef: "cfg-prod",
      configVersionId: "v2",
      registrySecretRef: "secret://registry-prod",
      registrySecretProviderKind: "vault",
      registrySecretResolved: 1,
      deploymentSecretRef: "secret://deploy-prod",
      deploymentSecretProviderKind: "vault",
      deploymentSecretResolved: 1,
      publishWorkflowRunId: "wf-prod-1",
      publishWorkflowRunUrl: "https://example/publish-prod/1",
      deployWorkflowRunId: "wf-prod-2",
      deployWorkflowRunUrl: "https://example/deploy-prod/1",
      executionMode: "plan",
      publishCommand: "docker push",
      deployCommand: "kubectl apply -f",
      commandResultsJson: "{}",
      releaseBundleId: "bundle-prod",
      taskId: null,
      jsonArtifactUri: null,
      markdownArtifactUri: null,
      generatedAt: now,
      exportedAt: now,
    });

    const all = repo.listDeploymentExecutionReportRecords();
    assert.equal(all.length, 1);

    const prod = repo.listDeploymentExecutionReportRecords({ environment: "prod" });
    assert.equal(prod.length, 1);
    assert.equal(prod[0]?.executionMode, "plan");

    const staging = repo.listDeploymentExecutionReportRecords({ environment: "staging" });
    assert.equal(staging.length, 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("ReleaseRepository insertEnvironmentPromotionHistoryRecord and listEnvironmentPromotionHistoryRecords", () => {
  const workspace = createTempWorkspace("aa-promotion-repo-");
  const dbPath = join(workspace, "release-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ReleaseRepository(db);

    repo.insertEnvironmentPromotionHistoryRecord({
      promotionId: "promotion-1",
      sourceEnvironment: "dev",
      targetEnvironment: "staging",
      version: "1.0.0",
      commitSha: "abc123",
      rolloutStrategy: "rolling",
      decisionType: "execute",
      decisionStatus: "executed",
      releaseBundleId: "bundle-1",
      deploymentExecutionId: "deploy-exec-1",
      reasonCode: "ready",
      actor: "ops-1",
      metadataJson: null,
      recordedAt: now,
    });

    const all = repo.listEnvironmentPromotionHistoryRecords();
    assert.equal(all.length, 1);
    assert.equal(all[0]?.promotionId, "promotion-1");
    assert.equal(all[0]?.sourceEnvironment, "dev");
    assert.equal(all[0]?.targetEnvironment, "staging");
    assert.equal(all[0]?.decisionType, "execute");
    assert.equal(all[0]?.decisionStatus, "executed");

    const filtered = repo.listEnvironmentPromotionHistoryRecords({ targetEnvironment: "staging" });
    assert.equal(filtered.length, 1);

    const prod = repo.listEnvironmentPromotionHistoryRecords({ targetEnvironment: "prod" });
    assert.equal(prod.length, 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("ReleaseRepository upsertEnvironmentReadinessRecord and getActiveEnvironmentReadinessRecord", () => {
  const workspace = createTempWorkspace("aa-readiness-repo-");
  const dbPath = join(workspace, "release-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ReleaseRepository(db);

    repo.upsertEnvironmentReadinessRecord({
      readinessId: "ready-1",
      environment: "staging",
      componentType: "external_service",
      componentId: "registry",
      credentialReady: 1,
      secondaryGatesJson: "[]",
      owner: "ops-1",
      lastVerifiedAt: now,
      isActive: 1,
      notes: null,
    });

    const result = repo.getActiveEnvironmentReadinessRecord("staging", "external_service", "registry");
    assert.ok(result);
    assert.equal(result?.readinessId, "ready-1");
    assert.equal(result?.environment, "staging");
    assert.equal(result?.componentType, "external_service");
    assert.equal(result?.componentId, "registry");
    assert.equal(result?.credentialReady, 1);
    assert.equal(result?.owner, "ops-1");
  } finally {
    cleanupPath(workspace);
  }
});

test("ReleaseRepository upsertEnvironmentReadinessRecord updates existing record", () => {
  const workspace = createTempWorkspace("aa-readiness-upsert-");
  const dbPath = join(workspace, "release-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ReleaseRepository(db);

    // Insert first record
    repo.upsertEnvironmentReadinessRecord({
      readinessId: "ready-1",
      environment: "staging",
      componentType: "external_service",
      componentId: "registry",
      credentialReady: 1,
      secondaryGatesJson: "[]",
      owner: "ops-1",
      lastVerifiedAt: now,
      isActive: 1,
      notes: null,
    });

    // Update the same record (upsert should update)
    repo.upsertEnvironmentReadinessRecord({
      readinessId: "ready-2",
      environment: "staging",
      componentType: "external_service",
      componentId: "registry",
      credentialReady: 0,
      secondaryGatesJson: '["gate1"]',
      owner: "ops-2",
      lastVerifiedAt: now,
      isActive: 1,
      notes: "updated",
    });

    // Should get the updated record
    const result = repo.getActiveEnvironmentReadinessRecord("staging", "external_service", "registry");
    assert.ok(result);
    assert.equal(result?.readinessId, "ready-2");
    assert.equal(result?.credentialReady, 0);
    assert.equal(result?.owner, "ops-2");
    assert.equal(result?.notes, "updated");
  } finally {
    cleanupPath(workspace);
  }
});

test("ReleaseRepository listEnvironmentReadinessRecords with activeOnly filter", () => {
  const workspace = createTempWorkspace("aa-readiness-list-");
  const dbPath = join(workspace, "release-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ReleaseRepository(db);

    repo.upsertEnvironmentReadinessRecord({
      readinessId: "ready-active",
      environment: "staging",
      componentType: "external_service",
      componentId: "primary",
      credentialReady: 1,
      secondaryGatesJson: "[]",
      owner: "ops-1",
      lastVerifiedAt: now,
      isActive: 1,
      notes: null,
    });

    repo.upsertEnvironmentReadinessRecord({
      readinessId: "ready-inactive",
      environment: "staging",
      componentType: "external_service",
      componentId: "replica",
      credentialReady: 1,
      secondaryGatesJson: "[]",
      owner: "ops-1",
      lastVerifiedAt: now,
      isActive: 0,
      notes: null,
    });

    // Without activeOnly specified, defaults to activeOnly=true (filters to is_active=1 only)
    const defaultFilter = repo.listEnvironmentReadinessRecords("staging");
    assert.equal(defaultFilter.length, 1);
    assert.equal(defaultFilter[0]?.readinessId, "ready-active");

    // Explicitly set activeOnly=false to get all records
    const all = repo.listEnvironmentReadinessRecords("staging", { activeOnly: false });
    assert.equal(all.length, 2);

    // activeOnly=true should only return active records
    const activeOnly = repo.listEnvironmentReadinessRecords("staging", { activeOnly: true });
    assert.equal(activeOnly.length, 1);
    assert.equal(activeOnly[0]?.readinessId, "ready-active");
  } finally {
    cleanupPath(workspace);
  }
});

test("ReleaseRepository insertEnterpriseCapabilityReport and listEnterpriseCapabilityReports", () => {
  const workspace = createTempWorkspace("aa-capability-repo-");
  const dbPath = join(workspace, "release-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ReleaseRepository(db);

    repo.insertEnterpriseCapabilityReport({
      reportId: "cap-1",
      accountId: null,
      workspaceId: null,
      tenantId: null,
      environment: "staging",
      deploymentMode: "private_cloud",
      summaryJson: '{"features":["a","b"]}',
      reportJson: '{"details":"test"}',
      generatedAt: now,
    });

    const results = repo.listEnterpriseCapabilityReports(10);
    assert.equal(results.length, 1);
    assert.equal(results[0]?.reportId, "cap-1");
    assert.equal(results[0]?.environment, "staging");
    assert.equal(results[0]?.deploymentMode, "private_cloud");
    assert.equal(results[0]?.summaryJson, '{"features":["a","b"]}');
  } finally {
    cleanupPath(workspace);
  }
});

test("ReleaseRepository insertIncidentHandoffRecord and listIncidentHandoffRecords", () => {
  const workspace = createTempWorkspace("aa-handoff-repo-");
  const dbPath = join(workspace, "release-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ReleaseRepository(db);

    repo.insertIncidentHandoffRecord({
      handoffId: "handoff-1",
      incidentId: null,
      environment: "staging",
      status: "ready",
      shiftOwner: "ops-1",
      primaryOncall: "user-a",
      secondaryOncall: "user-b",
      severity: null,
      handoffJson: '{"notes":"critical system"}',
      createdAt: now,
    });

    const results = repo.listIncidentHandoffRecords(10);
    assert.equal(results.length, 1);
    assert.equal(results[0]?.handoffId, "handoff-1");
    assert.equal(results[0]?.environment, "staging");
    assert.equal(results[0]?.status, "ready");
    assert.equal(results[0]?.shiftOwner, "ops-1");
    assert.equal(results[0]?.primaryOncall, "user-a");
    assert.equal(results[0]?.secondaryOncall, "user-b");
  } finally {
    cleanupPath(workspace);
  }
});

test("ReleaseRepository insertEnterpriseGovernanceReport and listEnterpriseGovernanceReports", () => {
  const workspace = createTempWorkspace("aa-governance-repo-");
  const dbPath = join(workspace, "release-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ReleaseRepository(db);

    // Governance report has FK to handoff record, so insert handoff first
    repo.insertIncidentHandoffRecord({
      handoffId: "handoff-1",
      incidentId: null,
      environment: "staging",
      status: "ready",
      shiftOwner: "ops-1",
      primaryOncall: "user-a",
      secondaryOncall: "user-b",
      severity: null,
      handoffJson: "{}",
      createdAt: now,
    });

    repo.insertEnterpriseGovernanceReport({
      reportId: "gov-1",
      taskId: null,
      environment: "staging",
      status: "pass",
      shiftOwner: "ops-1",
      summaryJson: '{"checks":5}',
      reportJson: '{"findings":[]}',
      generatedAt: now,
      handoffId: "handoff-1",
    });

    const results = repo.listEnterpriseGovernanceReports(10);
    assert.equal(results.length, 1);
    assert.equal(results[0]?.reportId, "gov-1");
    assert.equal(results[0]?.environment, "staging");
    assert.equal(results[0]?.status, "pass");
    assert.equal(results[0]?.shiftOwner, "ops-1");
    assert.equal(results[0]?.handoffId, "handoff-1");
  } finally {
    cleanupPath(workspace);
  }
});

test("ReleaseRepository getReleaseBundleRecord returns null for non-existent", () => {
  const workspace = createTempWorkspace("aa-release-repo-null-");
  const dbPath = join(workspace, "release-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ReleaseRepository(db);

    const result = repo.getReleaseBundleRecord("nonexistent");
    assert.equal(result, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("ReleaseRepository getDeploymentExecutionReportRecord returns null for non-existent", () => {
  const workspace = createTempWorkspace("aa-deploy-exec-null-");
  const dbPath = join(workspace, "release-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ReleaseRepository(db);

    const result = repo.getDeploymentExecutionReportRecord("nonexistent");
    assert.equal(result, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("ReleaseRepository getActiveEnvironmentReadinessRecord returns null for non-existent", () => {
  const workspace = createTempWorkspace("aa-readiness-null-");
  const dbPath = join(workspace, "release-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ReleaseRepository(db);

    const result = repo.getActiveEnvironmentReadinessRecord("prod", "external_service", "primary");
    assert.equal(result, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("ReleaseRepository listReleaseBundleRecords respects limit", () => {
  const workspace = createTempWorkspace("aa-release-limit-");
  const dbPath = join(workspace, "release-repo.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new ReleaseRepository(db);

    // Insert 5 bundles
    for (let i = 1; i <= 5; i++) {
      repo.insertReleaseBundleRecord({
        bundleId: `bundle-${i}`,
        environment: "staging",
        version: `${i}.0.0`,
        commitSha: `sha${i}`,
        imageTag: `app:${i}.0.0`,
        imageRef: `registry/app:${i}.0.0`,
        rolloutStrategy: "rolling",
        deploymentNamespace: `ns-${i}`,
        clusterName: `cluster-${i}`,
        configPath: `config/${i}.yaml`,
        configBundleRef: `cfg-${i}`,
        registryCredentialRef: `secret://reg-${i}`,
        deploymentCredentialRef: `secret://dep-${i}`,
        publishWorkflowPath: `.github/workflows/pub-${i}.yml`,
        deployWorkflowPath: `.github/workflows/dep-${i}.yml`,
        requiredReadinessChecksJson: "[]",
        recommendedCommandsJson: "[]",
        taskId: null,
        jsonArtifactUri: null,
        markdownArtifactUri: null,
        generatedAt: now,
        exportedAt: now,
      });
    }

    const limited = repo.listReleaseBundleRecords({ environment: "staging", limit: 3 });
    assert.equal(limited.length, 3);

    const all = repo.listReleaseBundleRecords({ environment: "staging" });
    assert.equal(all.length, 5);
  } finally {
    cleanupPath(workspace);
  }
});
