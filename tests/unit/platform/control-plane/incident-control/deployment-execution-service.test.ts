import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import {
  DeploymentExecutionService,
  type DeploymentCommandRequest,
  type DeploymentCommandResult,
} from "../../../../../src/platform/five-plane-control-plane/incident-control/deployment-execution-service.js";
import { EnvSecretProvider } from "../../../../../src/platform/five-plane-control-plane/iam/env-secret-provider.js";
import { SecretManagementService } from "../../../../../src/platform/five-plane-control-plane/iam/secret-management-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

const REPO_ROOT = process.cwd();

class RecordingRunner {
  public readonly calls: DeploymentCommandRequest[] = [];

  public run(request: DeploymentCommandRequest): DeploymentCommandResult {
    this.calls.push(request);
    const runId = request.step === "publish" ? "730000001" : "730000002";
    return {
      step: request.step,
      command: request.command,
      args: [...request.args],
      executed: true,
      exitCode: 0,
      stdout: `Created workflow_dispatch event\nhttps://github.com/automatic-agent/automatic-agent-system/actions/runs/${runId}`,
      stderr: "",
      durationMs: 1,
    };
  }
}

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

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "deployment-execution.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, db, store };
}

test("deployment execution service builds a masked execution plan for eligible targets", async () => {
  const harness = createHarness("aa-deployment-execution-");
  try {
    const verifiedAt = nowIso();
    seedReadyEnvironment(harness.store, "test", verifiedAt);
    seedReadyEnvironment(harness.store, "staging", verifiedAt);
    seedReadyEnvironment(harness.store, "pre-prod", verifiedAt);
    seedReadyEnvironment(harness.store, "prod", verifiedAt);
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

    const service = new DeploymentExecutionService(harness.store, {
      repoRootDir: REPO_ROOT,
      artifactStoreOptions: { rootDir: join(harness.workspace, "artifacts") },
      secretProvider: new EnvSecretProvider({
        env: {
          AA_SECRET_SYSTEM_REGISTRY_GHCR_PROD: "registry-token-123456",
          AA_SECRET_SYSTEM_DEPLOY_KUBECONFIG_PROD: "deploy-token-abcdef",
        },
      }),
    });

    const report = await service.buildReport({
      environment: "prod",
      version: "7.8.9",
      commitSha: "abcdef0123456789",
      rolloutStrategy: "blue_green",
    });

    assert.equal(report.environment, "prod");
    assert.equal(report.executionMode, "plan");
    assert.equal(report.registrySecret.resolved, true);
    assert.equal(report.registrySecret.maskedValue?.endsWith("3456"), true);
    assert.doesNotMatch(report.registrySecret.maskedValue ?? "", /registry-token-123456/);
    assert.equal(report.commandResults.length, 0);
    assert.match(report.publishCommand, /registry_secret_ref=secret:\/\/system\/registry\/ghcr\/prod/);
    assert.match(report.deployCommand, /config_bundle_ref=config-bundle:\/\/runtime\/prod/);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("deployment execution service executes publish and deploy via injected runner", async () => {
  const harness = createHarness("aa-deployment-execution-runner-");
  try {
    const verifiedAt = nowIso();
    seedReadyEnvironment(harness.store, "test", verifiedAt);
    seedReadyEnvironment(harness.store, "staging", verifiedAt);
    seedReadyEnvironment(harness.store, "pre-prod", verifiedAt);
    seedReadyEnvironment(harness.store, "prod", verifiedAt);
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

    const runner = new RecordingRunner();
    const service = new DeploymentExecutionService(harness.store, {
      repoRootDir: REPO_ROOT,
      artifactStoreOptions: { rootDir: join(harness.workspace, "artifacts") },
      secretProvider: new EnvSecretProvider({
        env: {
          AA_SECRET_SYSTEM_REGISTRY_GHCR_PROD: "registry-token-123456",
          AA_SECRET_SYSTEM_DEPLOY_KUBECONFIG_PROD: "deploy-token-abcdef",
        },
      }),
      commandRunner: runner as any,
    });

    const exported = await service.exportReport({
      environment: "prod",
      version: "7.8.9",
      commitSha: "abcdef0123456789",
      rolloutStrategy: "blue_green",
      execute: true,
      taskId: "deployment_execution_task",
    });

    assert.equal(exported.report.executionMode, "execute");
    assert.equal(exported.report.releaseBundleId.length > 0, true);
    assert.equal(exported.report.commandResults.length, 2);
    assert.equal(exported.report.publishWorkflowRunId, "730000001");
    assert.equal(exported.report.deployWorkflowRunId, "730000002");
    assert.equal(runner.calls.length, 2);
    assert.match(exported.jsonArtifact.uri, /deployment_execution/);
    const persistedExecution = harness.store.getDeploymentExecutionReportRecord(exported.report.executionId);
    assert.equal(persistedExecution?.environment, "prod");
    assert.equal(persistedExecution?.releaseBundleId, exported.report.releaseBundleId);
    assert.equal(persistedExecution?.publishWorkflowRunId, "730000001");
    assert.equal(persistedExecution?.deployWorkflowRunId, "730000002");
    const persistedBundle = harness.store.getReleaseBundleRecord(exported.report.releaseBundleId);
    assert.equal(persistedBundle?.environment, "prod");
    const promotionHistory = harness.store.listEnvironmentPromotionHistoryRecords({ targetEnvironment: "prod", limit: 5 });
    assert.equal(promotionHistory[0]?.decisionStatus, "executed");
    assert.equal(promotionHistory[0]?.deploymentExecutionId, exported.report.executionId);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("deployment execution service resolves vault-backed managed secrets for production execution", async () => {
  const harness = createHarness("aa-deployment-execution-vault-");
  try {
    const verifiedAt = nowIso();
    seedReadyEnvironment(harness.store, "test", verifiedAt);
    seedReadyEnvironment(harness.store, "staging", verifiedAt);
    seedReadyEnvironment(harness.store, "pre-prod", verifiedAt);
    seedReadyEnvironment(harness.store, "prod", verifiedAt);
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

    const createdAt = nowIso();
    for (const environmentId of ["dev", "test", "staging", "pre-prod", "prod"] as const) {
      harness.store.upsertSecretRegistryRecord({
        secretRef: `secret://system/registry/ghcr/${environmentId}`,
        displayName: `GHCR ${environmentId} Push Token`,
        category: "tenant_credential",
        providerKind: "vault",
        scopeType: "system",
        scopeRef: `registry.ghcr.${environmentId}`,
        status: "active",
        rotationPolicyJson: JSON.stringify({ cadenceDays: 30, ttlMinutes: 60, breakGlass: false }),
        metadataJson: null,
        currentVersion: "v4",
        lastRotatedAt: createdAt,
        nextRotationDueAt: null,
        createdAt,
        updatedAt: createdAt,
      });
      harness.store.upsertSecretRegistryRecord({
        secretRef: `secret://system/deploy/kubeconfig/${environmentId}`,
        displayName: `${environmentId} Deployment Credential`,
        category: "db_connection_secret",
        providerKind: "vault",
        scopeType: "system",
        scopeRef: `deploy.kubeconfig.${environmentId}`,
        status: "active",
        rotationPolicyJson: JSON.stringify({ cadenceDays: 14, ttlMinutes: 30, breakGlass: true }),
        metadataJson: null,
        currentVersion: "v4",
        lastRotatedAt: createdAt,
        nextRotationDueAt: null,
        createdAt,
        updatedAt: createdAt,
      });
    }

    const service = new DeploymentExecutionService(harness.store, {
      repoRootDir: REPO_ROOT,
      artifactStoreOptions: { rootDir: join(harness.workspace, "artifacts") },
      secretProvider: new EnvSecretProvider({ env: {} }),
      secretManagementService: new SecretManagementService(harness.db, harness.store, {
        providerEnv: {
          AA_VAULT_SECRETS_JSON: JSON.stringify({
            "secret://system/registry/ghcr/prod": {
              value: "vault-registry-token-123456",
              locator: "vault://kv/release/prod/registry",
            },
            "secret://system/deploy/kubeconfig/prod": {
              value: "vault-deploy-token-abcdef",
              locator: "vault://kv/release/prod/deploy",
            },
          }),
        },
      }),
    });

    const report = await service.buildReport({
      environment: "prod",
      version: "7.8.9",
      commitSha: "abcdef0123456789",
      rolloutStrategy: "blue_green",
    });

    assert.equal(report.registrySecret.providerKind, "vault");
    assert.equal(report.registrySecret.source, "vault");
    assert.equal(report.registrySecret.envName, "vault://kv/release/prod/registry");
    assert.equal(report.registrySecret.accessMode, "describe");
    assert.equal(report.registrySecret.leaseId, null);
    assert.equal(report.deploymentSecret.providerKind, "vault");
    assert.equal(report.deploymentSecret.source, "vault");
    assert.equal(report.deploymentSecret.envName, "vault://kv/release/prod/deploy");
    assert.equal(report.deploymentSecret.accessMode, "describe");
    assert.equal(report.deploymentSecret.leaseId, null);
    assert.equal(harness.store.listSecretUsageAuditsBySecretRef("secret://system/registry/ghcr/prod").length, 0);
    assert.equal(harness.store.listSecretLeasesBySecretRef("secret://system/registry/ghcr/prod").length, 0);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("deployment execution service issues and revokes managed secret leases during execution", async () => {
  const harness = createHarness("aa-deployment-execution-leases-");
  try {
    const verifiedAt = nowIso();
    seedReadyEnvironment(harness.store, "test", verifiedAt);
    seedReadyEnvironment(harness.store, "staging", verifiedAt);
    seedReadyEnvironment(harness.store, "pre-prod", verifiedAt);
    seedReadyEnvironment(harness.store, "prod", verifiedAt);
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

    const createdAt = nowIso();
    for (const environmentId of ["dev", "test", "staging", "pre-prod", "prod"] as const) {
      harness.store.upsertSecretRegistryRecord({
        secretRef: `secret://system/registry/ghcr/${environmentId}`,
        displayName: `GHCR ${environmentId}`,
        category: "tenant_credential",
        providerKind: "environment",
        scopeType: "system",
        scopeRef: `registry.ghcr.${environmentId}`,
        status: "active",
        rotationPolicyJson: JSON.stringify({ cadenceDays: 30, ttlMinutes: 60, breakGlass: false }),
        metadataJson: null,
        currentVersion: "v9",
        lastRotatedAt: createdAt,
        nextRotationDueAt: null,
        createdAt,
        updatedAt: createdAt,
      });
      harness.store.upsertSecretRegistryRecord({
        secretRef: `secret://system/deploy/kubeconfig/${environmentId}`,
        displayName: `Deploy ${environmentId}`,
        category: "db_connection_secret",
        providerKind: "environment",
        scopeType: "system",
        scopeRef: `deploy.kubeconfig.${environmentId}`,
        status: "active",
        rotationPolicyJson: JSON.stringify({ cadenceDays: 14, ttlMinutes: 30, breakGlass: true }),
        metadataJson: null,
        currentVersion: "v9",
        lastRotatedAt: createdAt,
        nextRotationDueAt: null,
        createdAt,
        updatedAt: createdAt,
      });
    }

    const runner = new RecordingRunner();
    const secretManagementService = new SecretManagementService(harness.db, harness.store, {
      providerEnv: {
        AA_SECRET_SYSTEM_REGISTRY_GHCR_PROD: "registry-token-123456",
        AA_SECRET_SYSTEM_DEPLOY_KUBECONFIG_PROD: "deploy-token-abcdef",
      },
    });
    const service = new DeploymentExecutionService(harness.store, {
      repoRootDir: REPO_ROOT,
      artifactStoreOptions: { rootDir: join(harness.workspace, "artifacts") },
      secretProvider: new EnvSecretProvider({ env: {} }),
      secretManagementService,
      commandRunner: runner as any,
    });

    const exported = await service.exportReport({
      environment: "prod",
      version: "7.8.9",
      commitSha: "abcdef0123456789",
      rolloutStrategy: "blue_green",
      execute: true,
    });

    assert.equal(exported.report.registrySecret.accessMode, "lease");
    assert.equal(exported.report.registrySecret.leaseStatus, "revoked");
    assert.equal(typeof exported.report.registrySecret.leaseId, "string");
    assert.equal(exported.report.deploymentSecret.accessMode, "lease");
    assert.equal(exported.report.deploymentSecret.leaseStatus, "revoked");
    assert.equal(typeof exported.report.deploymentSecret.leaseId, "string");
    assert.equal(runner.calls.length, 2);

    const registryLeases = harness.store.listSecretLeasesBySecretRef("secret://system/registry/ghcr/prod");
    const deploymentLeases = harness.store.listSecretLeasesBySecretRef("secret://system/deploy/kubeconfig/prod");
    assert.equal(registryLeases.length, 1);
    assert.equal(registryLeases[0]?.status, "revoked");
    assert.equal(registryLeases[0]?.sourceVersion, "v9");
    assert.equal(registryLeases[0]?.executionId, null);
    assert.match(registryLeases[0]?.metadataJson ?? "", new RegExp(exported.report.executionId));
    assert.equal(deploymentLeases.length, 1);
    assert.equal(deploymentLeases[0]?.status, "revoked");
    assert.equal(deploymentLeases[0]?.executionId, null);
    assert.match(deploymentLeases[0]?.metadataJson ?? "", new RegExp(exported.report.executionId));
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});
