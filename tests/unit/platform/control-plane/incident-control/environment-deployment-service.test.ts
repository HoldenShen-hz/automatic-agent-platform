import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { EnvironmentDeploymentService } from "../../../../../src/platform/five-plane-control-plane/incident-control/environment-deployment-service.js";
import { SecretManagementService } from "../../../../../src/platform/five-plane-control-plane/iam/secret-management-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

const REPO_ROOT = process.cwd();

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "environment-deployment.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, db, store };
}

function createService(harness: ReturnType<typeof createHarness>, useSecretManagement = false) {
  return new EnvironmentDeploymentService(harness.store, {
    repoRootDir: REPO_ROOT,
    ...(useSecretManagement
      ? { secretManagementService: new SecretManagementService(harness.db, harness.store) }
      : {}),
    artifactStoreOptions: {
      rootDir: join(harness.workspace, "artifacts"),
    },
  });
}

function markEnvironmentReady(
  store: AuthoritativeTaskStore,
  environment: "dev" | "test" | "staging" | "pre-prod" | "prod",
  verifiedAt: string,
): void {
  const componentTypes = environment === "test"
    ? (["provider", "sandbox"] as const)
    : environment === "dev"
      ? ([] as const)
      : (["provider", "gateway", "sandbox", "worker_fleet", "artifact_store"] as const);
  for (const componentType of componentTypes) {
    store.upsertEnvironmentReadinessRecord({
      readinessId: `${environment}-${componentType}`,
      environment,
      componentType,
      componentId: `${environment}-${componentType}`,
      credentialReady: 1,
      secondaryGatesJson: JSON.stringify({}),
      owner: "ops.team",
      lastVerifiedAt: verifiedAt,
      isActive: 1,
      notes: null,
    });
  }
}

function upsertTenantForEnvironment(store: AuthoritativeTaskStore, environmentId: string): void {
  const timestamp = nowIso();
  store.upsertOrganizationRecord({
    organizationId: `org-${environmentId}`,
    displayName: `Organization ${environmentId}`,
    billingAccountId: null,
    defaultTenantId: null,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  store.upsertTenantRecord({
    tenantId: `tenant-${environmentId}`,
    organizationId: `org-${environmentId}`,
    storageScope: `tenant.${environmentId}.storage`,
    identityScope: `tenant.${environmentId}.identity`,
    policyScope: `tenant.${environmentId}.policy`,
    artifactScope: `tenant.${environmentId}.artifact`,
    isolationMode: "shared_hard_scoped",
    deploymentMode: "private_cloud",
    createdAt: timestamp,
    updatedAt: timestamp,
  });
}

function seedManagedEnvironmentSecrets(
  store: AuthoritativeTaskStore,
  environment: "dev" | "test" | "staging" | "pre-prod" | "prod",
): void {
  const createdAt = nowIso();
  store.upsertSecretRegistryRecord({
    secretRef: `secret://system/registry/ghcr/${environment}`,
    displayName: `Registry ${environment}`,
    category: "tenant_credential",
    providerKind: "environment",
    scopeType: "system",
    scopeRef: `registry.ghcr.${environment}`,
    status: "active",
    rotationPolicyJson: JSON.stringify({ cadenceDays: 30, ttlMinutes: 60, breakGlass: false }),
    metadataJson: null,
    currentVersion: "v1",
    lastRotatedAt: createdAt,
    nextRotationDueAt: null,
    createdAt,
    updatedAt: createdAt,
  });
  store.upsertSecretRegistryRecord({
    secretRef: `secret://system/deploy/kubeconfig/${environment}`,
    displayName: `Deploy ${environment}`,
    category: "db_connection_secret",
    providerKind: "environment",
    scopeType: "system",
    scopeRef: `deploy.kubeconfig.${environment}`,
    status: "active",
    rotationPolicyJson: JSON.stringify({ cadenceDays: 14, ttlMinutes: 30, breakGlass: true }),
    metadataJson: null,
    currentVersion: "v1",
    lastRotatedAt: createdAt,
    nextRotationDueAt: null,
    createdAt,
    updatedAt: createdAt,
  });
}

test("environment deployment service builds a multi-environment matrix with overlayed config highlights", async () => {
  const harness = createHarness("aa-environment-deployment-");
  try {
    const service = createService(harness);
    const generatedAt = "2026-04-09T09:00:00.000Z";
    markEnvironmentReady(harness.store, "test", generatedAt);
    markEnvironmentReady(harness.store, "staging", generatedAt);
    markEnvironmentReady(harness.store, "pre-prod", generatedAt);
    upsertTenantForEnvironment(harness.store, "staging");
    upsertTenantForEnvironment(harness.store, "pre-prod");
    harness.store.upsertDeploymentBindingRecord({
      bindingId: "binding-staging",
      tenantId: "tenant-staging",
      environmentId: "staging",
      deploymentMode: "private_cloud",
      region: "cn-shanghai-1",
      networkBoundary: "vpc-staging",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
    harness.store.upsertDeploymentBindingRecord({
      bindingId: "binding-preprod",
      tenantId: "tenant-pre-prod",
      environmentId: "pre-prod",
      deploymentMode: "private_cloud",
      region: "cn-shanghai-1",
      networkBoundary: "vpc-preprod",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });

    const report = await service.buildReport({
      generatedAt,
    });

    const devEntry = report.entries.find((item) => item.environment === "dev");
    const prodEntry = report.entries.find((item) => item.environment === "prod");
    assert.equal(devEntry?.configHighlights.maxConcurrentTasks, 1);
    assert.equal(prodEntry?.configHighlights.maxConcurrentTasks, 8);
    assert.equal(prodEntry?.configHighlights.approvalMode, "strict");
    assert.equal(prodEntry?.secretInjection.registryCredentialRef, "secret://system/registry/ghcr/prod");
    assert.equal(prodEntry?.secretInjection.deploymentCredentialRef, "secret://system/deploy/kubeconfig/prod");
    assert.equal(prodEntry?.secretInjection.configBundleRef, "config-bundle://runtime/prod");
    assert.equal(prodEntry?.secretInjection.ready, true);
    assert.equal(report.highestReadyEnvironment, "pre-prod");
    assert.equal(report.targetEligible, false);
    assert.ok(prodEntry?.blockers.includes("deployment_binding_missing"));
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("environment deployment service exports a target-ready release plan once prerequisites are satisfied", async () => {
  const harness = createHarness("aa-environment-deployment-export-");
  try {
    for (const environmentId of ["dev", "test", "staging", "pre-prod", "prod"] as const) {
      seedManagedEnvironmentSecrets(harness.store, environmentId);
    }
    const service = createService(harness, true);
    const generatedAt = "2026-04-09T10:00:00.000Z";
    markEnvironmentReady(harness.store, "test", generatedAt);
    markEnvironmentReady(harness.store, "staging", generatedAt);
    markEnvironmentReady(harness.store, "pre-prod", generatedAt);
    markEnvironmentReady(harness.store, "prod", generatedAt);

    for (const environmentId of ["staging", "pre-prod", "prod"] as const) {
      upsertTenantForEnvironment(harness.store, environmentId);
      harness.store.upsertDeploymentBindingRecord({
        bindingId: `binding-${environmentId}`,
        tenantId: `tenant-${environmentId}`,
        environmentId,
        deploymentMode: "private_cloud",
        region: "cn-shanghai-1",
        networkBoundary: `vpc-${environmentId}`,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }

    const exported = await service.exportReport({
      generatedAt,
      targetEnvironment: "prod",
      version: "4.5.6",
      commitSha: "abcdef1234567890",
      rolloutStrategy: "blue_green",
      taskId: "environment_deployment_task",
    });

    assert.equal(exported.report.targetEnvironment, "prod");
    assert.equal(exported.report.targetEligible, true);
    assert.equal(exported.report.targetReleaseBundle?.environment, "prod");
    assert.equal(exported.report.targetReleaseBundle?.registryCredentialRef, "secret://system/registry/ghcr/prod");
    assert.equal(exported.report.targetReleaseBundle?.configBundleRef, "config-bundle://runtime/prod");
    assert.equal(
      exported.report.entries.find((entry) => entry.environment === "prod")?.secretInjection.registryCredentialRegistered,
      true,
    );
    assert.match(exported.jsonArtifact.uri, /environment_deployment/);
    assert.match(exported.markdownArtifact.uri, /environment_deployment/);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("environment deployment fail-closes secret injection readiness when release secrets are not registered", async () => {
  const harness = createHarness("aa-environment-deployment-secret-boundary-");
  try {
    const service = createService(harness, true);
    const generatedAt = "2026-04-09T10:00:00.000Z";
    markEnvironmentReady(harness.store, "test", generatedAt);
    markEnvironmentReady(harness.store, "staging", generatedAt);
    markEnvironmentReady(harness.store, "pre-prod", generatedAt);
    markEnvironmentReady(harness.store, "prod", generatedAt);

    for (const environmentId of ["staging", "pre-prod", "prod"] as const) {
      upsertTenantForEnvironment(harness.store, environmentId);
      harness.store.upsertDeploymentBindingRecord({
        bindingId: `binding-${environmentId}`,
        tenantId: `tenant-${environmentId}`,
        environmentId,
        deploymentMode: "private_cloud",
        region: "cn-shanghai-1",
        networkBoundary: `vpc-${environmentId}`,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      });
    }

    const report = await service.buildReport({
      generatedAt,
      targetEnvironment: "prod",
    });
    const prodEntry = report.entries.find((entry) => entry.environment === "prod");
    assert.equal(prodEntry?.secretInjection.ready, false);
    assert.equal(prodEntry?.secretInjection.registryCredentialRegistered, false);
    assert.ok(prodEntry?.blockers.includes("registry_credential_unregistered"));
    assert.ok(prodEntry?.blockers.includes("deployment_credential_unregistered"));
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});
