import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { DeploymentExecutionService, type DeploymentCommandResult } from "../../../../src/platform/control-plane/incident-control/deployment-execution-service.js";
import { EnvSecretProvider } from "../../../../src/platform/control-plane/iam/env-secret-provider.js";
import { SecretManagementService } from "../../../../src/platform/control-plane/iam/secret-management-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

const REPO_ROOT = process.cwd();

function seedReadyEnvironment(store: AuthoritativeTaskStore, environment: "test" | "staging" | "pre-prod" | "prod", verifiedAt: string): void {
  const componentTypes = environment === "test"
    ? (["provider", "sandbox"] as const)
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

test("deployment execution fail-closes when secret refs are unresolved", async () => {
  const workspace = createTempWorkspace("aa-deployment-execution-boundary-");
  const dbPath = join(workspace, "deployment-execution-boundary.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  try {
    const verifiedAt = nowIso();
    seedReadyEnvironment(store, "test", verifiedAt);
    seedReadyEnvironment(store, "staging", verifiedAt);
    seedReadyEnvironment(store, "pre-prod", verifiedAt);
    seedReadyEnvironment(store, "prod", verifiedAt);
    for (const environmentId of ["staging", "pre-prod", "prod"] as const) {
      upsertTenantForEnvironment(store, environmentId);
      store.upsertDeploymentBindingRecord({
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

    const service = new DeploymentExecutionService(store, {
      repoRootDir: REPO_ROOT,
      artifactStoreOptions: { rootDir: join(workspace, "artifacts") },
      secretProvider: new EnvSecretProvider({ env: {} }),
    });

    await assert.rejects(
      () =>
        service.buildReport({
          environment: "prod",
          version: "7.8.9",
          commitSha: "abcdef0123456789",
          rolloutStrategy: "blue_green",
        }),
      /secret\.missing_value:secret:\/\/system\/registry\/ghcr\/prod/,
    );
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("deployment execution revokes issued managed secret leases when command execution fails", async () => {
  const workspace = createTempWorkspace("aa-deployment-execution-boundary-lease-");
  const dbPath = join(workspace, "deployment-execution-boundary-lease.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  try {
    const verifiedAt = nowIso();
    seedReadyEnvironment(store, "test", verifiedAt);
    seedReadyEnvironment(store, "staging", verifiedAt);
    seedReadyEnvironment(store, "pre-prod", verifiedAt);
    seedReadyEnvironment(store, "prod", verifiedAt);
    for (const environmentId of ["staging", "pre-prod", "prod"] as const) {
      upsertTenantForEnvironment(store, environmentId);
      store.upsertDeploymentBindingRecord({
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

    const createdAt = nowIso();
    for (const environmentId of ["dev", "test", "staging", "pre-prod", "prod"] as const) {
      store.upsertSecretRegistryRecord({
        secretRef: `secret://system/registry/ghcr/${environmentId}`,
        displayName: `GHCR ${environmentId}`,
        category: "tenant_credential",
        providerKind: "environment",
        scopeType: "system",
        scopeRef: `registry.ghcr.${environmentId}`,
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
        secretRef: `secret://system/deploy/kubeconfig/${environmentId}`,
        displayName: `Deploy ${environmentId}`,
        category: "db_connection_secret",
        providerKind: "environment",
        scopeType: "system",
        scopeRef: `deploy.kubeconfig.${environmentId}`,
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

    const service = new DeploymentExecutionService(store, {
      repoRootDir: REPO_ROOT,
      artifactStoreOptions: { rootDir: join(workspace, "artifacts") },
      secretProvider: new EnvSecretProvider({ env: {} }),
      secretManagementService: new SecretManagementService(db, store, {
        providerEnv: {
          AA_SECRET_SYSTEM_REGISTRY_GHCR_PROD: "registry-token-123456",
          AA_SECRET_SYSTEM_DEPLOY_KUBECONFIG_PROD: "deploy-token-abcdef",
        },
      }),
      commandRunner: {
        run(request): Promise<DeploymentCommandResult> {
          return Promise.resolve({
            step: request.step,
            command: request.command,
            args: request.args,
            executed: true,
            exitCode: request.step === "publish" ? 9 : 0,
            stdout: "",
            stderr: "failed",
            durationMs: 1,
          });
        },
      },
    });

    await assert.rejects(
      () =>
        service.buildReport({
          environment: "prod",
          version: "7.8.9",
          commitSha: "abcdef0123456789",
          rolloutStrategy: "blue_green",
          execute: true,
        }),
      /deployment_execution\.publish_failed:9/,
    );
    const registryLeases = store.listSecretLeasesBySecretRef("secret://system/registry/ghcr/prod");
    const deploymentLeases = store.listSecretLeasesBySecretRef("secret://system/deploy/kubeconfig/prod");
    assert.equal(registryLeases.length, 1);
    assert.equal(registryLeases[0]?.status, "revoked");
    assert.equal(registryLeases[0]?.revocationReasonCode, "publish_failed");
    assert.equal(deploymentLeases.length, 0);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});
