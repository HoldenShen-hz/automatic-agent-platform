import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";

import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { runBuiltCliExpectFailure } from "../../../helpers/cli.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

const REPO_ROOT = process.cwd();
const CLI_PATH = `${REPO_ROOT}/dist/src/sdk/cli/release-pipeline.js`;

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
  } as import("../../../../src/platform/contracts/types/domain/workspace-types.js").TenantRecord);
}

function seedManagedReleaseSecrets(
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

test("release-pipeline CLI lists environments and exports a release bundle", () => {
  const workspace = createTempWorkspace("aa-release-pipeline-cli-");
  const dbPath = join(workspace, "release-pipeline-cli.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  try {
    for (const environmentId of ["dev", "test", "staging", "pre-prod", "prod"] as const) {
      seedManagedReleaseSecrets(store, environmentId);
    }

    const listed = JSON.parse(
      execFileSync("node", ["--enable-source-maps", CLI_PATH], {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          AA_DB_PATH: dbPath,
          AA_RELEASE_ACTION: "list",
        },
        encoding: "utf8",
      }),
    ) as Array<{ environment: string }>;

    assert.ok(listed.some((item) => item.environment === "prod"));

    const exported = JSON.parse(
      execFileSync("node", ["--enable-source-maps", CLI_PATH], {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          AA_DB_PATH: dbPath,
          AA_RELEASE_ACTION: "export",
          AA_RELEASE_ENVIRONMENT: "pre-prod",
          AA_RELEASE_VERSION: "3.4.5",
          AA_RELEASE_COMMIT_SHA: "abcdef0123456789",
          AA_RELEASE_ROLLOUT_STRATEGY: "blue_green",
        },
        encoding: "utf8",
      }),
    ) as {
      bundle: { bundleId: string; environment: string; rolloutStrategy: string };
      jsonArtifact: { uri: string };
    };

    assert.equal(exported.bundle.environment, "pre-prod");
    assert.equal(exported.bundle.rolloutStrategy, "blue_green");
    assert.match(exported.jsonArtifact.uri, /data\/artifacts\/release_pipeline/);
    const persisted = store.getReleaseBundleRecord(exported.bundle.bundleId);
    assert.equal(persisted?.environment, "pre-prod");
    assert.equal(persisted?.jsonArtifactUri, exported.jsonArtifact.uri);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("release-pipeline CLI can simulate execute publish and trigger deployment execution", () => {
  const workspace = createTempWorkspace("aa-release-pipeline-cli-execute-");
  const dbPath = join(workspace, "release-pipeline-cli-execute.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  try {
    for (const environmentId of ["dev", "test", "staging", "pre-prod", "prod"] as const) {
      seedManagedReleaseSecrets(store, environmentId);
    }
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

    const executed = JSON.parse(
      execFileSync("node", ["--enable-source-maps", CLI_PATH], {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          AA_DB_PATH: dbPath,
          AA_RELEASE_ACTION: "execute",
          AA_RELEASE_RUNNER: "simulate",
          AA_RELEASE_TRIGGER_DEPLOY: "true",
          AA_RELEASE_ENVIRONMENT: "pre-prod",
          AA_RELEASE_VERSION: "3.4.5",
          AA_RELEASE_COMMIT_SHA: "abcdef0123456789",
          AA_RELEASE_ROLLOUT_STRATEGY: "blue_green",
          AA_SECRET_SYSTEM_REGISTRY_GHCR_PRE_PROD: "registry-token-pre-prod-1234",
          AA_SECRET_SYSTEM_DEPLOY_KUBECONFIG_PRE_PROD: "deploy-token-pre-prod-5678",
        },
        encoding: "utf8",
      }),
    ) as {
      release: {
        report: {
          executionMode: string;
          commandResults: Array<{ exitCode: number }>;
          registrySecret: { accessMode: string; leaseStatus: string | null };
          publishWorkflowRunId: string | null;
        };
      };
      deployment: {
        report: {
          executionMode: string;
          commandResults: Array<{ exitCode: number }>;
        };
      };
    };

    assert.equal(executed.release.report.executionMode, "execute");
    assert.equal(executed.release.report.commandResults.length, 2);
    assert.equal(executed.release.report.commandResults[0]?.exitCode, 0);
    assert.equal(executed.release.report.registrySecret.accessMode, "lease");
    assert.equal(executed.release.report.registrySecret.leaseStatus, "revoked");
    assert.equal(executed.release.report.publishWorkflowRunId, "700000001");
    assert.equal(executed.deployment.report.executionMode, "execute");
    assert.equal(executed.deployment.report.commandResults.length, 2);
    const releaseLeases = store.listSecretLeasesBySecretRef("secret://system/registry/ghcr/pre-prod");
    assert.equal(releaseLeases.length >= 1, true);
    assert.equal(releaseLeases[0]?.status, "revoked");
    const releaseExecutionReports = store.listReleaseExecutionReportRecords({ environment: "pre-prod", limit: 5 });
    assert.equal(releaseExecutionReports.length >= 1, true);
    assert.equal(releaseExecutionReports[0]?.registrySecretAccessMode, "lease");
    assert.equal(releaseExecutionReports[0]?.registryLeaseStatus, "revoked");
    assert.equal(releaseExecutionReports[0]?.publishWorkflowRunId, "700000001");
    const deploymentHistory = store.listEnvironmentPromotionHistoryRecords({ targetEnvironment: "pre-prod", limit: 5 });
    assert.equal(deploymentHistory[0]?.decisionStatus, "executed");
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("release-pipeline CLI fail-closes when postgres storage execution is requested", () => {
  const failure = runBuiltCliExpectFailure("release-pipeline.js", {
    AA_RELEASE_ACTION: "list",
    AA_STORAGE_DRIVER: "postgres",
    AA_STORAGE_POSTGRES_DSN: "postgresql://prod-db.example.com/agent_os?sslmode=require",
  });

  assert.notEqual(failure.status, 0);
  assert.match(failure.stderr, /storage\.(cli_sync_shadow_sqlite_required|backend_driver_not_implemented:postgres|backend_config_invalid)/);
});
