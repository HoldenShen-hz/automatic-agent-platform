import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { ReleasePipelineService } from "../../../../../src/platform/control-plane/incident-control/release-pipeline-service.js";
import { SecretManagementService } from "../../../../../src/platform/control-plane/iam/secret-management-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../..");

class RecordingReleaseRunner {
  public readonly calls: Array<{ step: string; command: string; args: string[] }> = [];

  public run(request: { step: "build_image" | "publish_workflow"; command: string; args: string[] }): {
    step: "build_image" | "publish_workflow";
    command: string;
    args: string[];
    executed: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
    durationMs: number;
  } {
    this.calls.push({
      step: request.step,
      command: request.command,
      args: [...request.args],
    });
    return {
      step: request.step,
      command: request.command,
      args: [...request.args],
      executed: true,
      exitCode: 0,
      stdout: request.step === "publish_workflow"
        ? "Created workflow_dispatch event\nhttps://github.com/automatic-agent/automatic-agent-system/actions/runs/720000001"
        : `ok:${request.step}`,
      stderr: "",
      durationMs: 1,
    };
  }
}

function seedManagedReleaseSecrets(store: AuthoritativeTaskStore, environment: "dev" | "test" | "staging" | "pre-prod" | "prod"): void {
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

test("release pipeline service lists environment configs and builds immutable bundles", async () => {
  const workspace = createTempWorkspace("aa-release-pipeline-");
  try {
    const service = new ReleasePipelineService({
      repoRootDir: REPO_ROOT,
      artifactStoreOptions: { rootDir: join(workspace, "artifacts") },
    });

    const configs = service.listEnvironmentConfigs();
    assert.equal(configs.length, 5);
    assert.equal(configs[0]?.environment, "dev");

    const bundle = await service.buildBundle({
      environment: "staging",
      version: "1.2.3",
      commitSha: "abcdef1234567890",
      rolloutStrategy: "canary",
    });

    assert.equal(bundle.environment, "staging");
    assert.equal(bundle.imageTag, "v1.2.3-abcdef123456");
    assert.match(bundle.imageRef, /^ghcr\.io\/holdenshen-hz\/automatic-agent-system:v1\.2\.3-abcdef123456$/);
    assert.equal(bundle.deployWorkflowPath, ".github/workflows/deploy-environment.yml");
    assert.equal(bundle.registryCredentialRef, "secret://system/registry/ghcr/staging");
    assert.equal(bundle.deploymentCredentialRef, "secret://system/deploy/kubeconfig/staging");
    assert.equal(bundle.configBundleRef, "config-bundle://runtime/staging");
    assert.ok(bundle.recommendedCommands.some((command) => command.includes("registry_secret_ref=secret://system/registry/ghcr/staging")));
    assert.ok(bundle.recommendedCommands.some((command) => command.includes("config_bundle_ref=config-bundle://runtime/staging")));
  } finally {
    cleanupPath(workspace);
  }
});

test("release pipeline export writes json and markdown artifacts", async () => {
  const workspace = createTempWorkspace("aa-release-pipeline-export-");
  const dbPath = join(workspace, "release-pipeline-export.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  try {
    seedManagedReleaseSecrets(store, "dev");
    const service = new ReleasePipelineService({
      repoRootDir: REPO_ROOT,
      artifactStoreOptions: { rootDir: join(workspace, "artifacts") },
      store,
      secretManagementService: new SecretManagementService(db, store),
    });

    const exported = await service.exportBundle({
      environment: "dev",
      version: "v2.0.0",
      commitSha: "0123456789abcdef",
      rolloutStrategy: "rolling",
      taskId: "release_pipeline_task",
    });

    assert.ok(existsSync(exported.jsonArtifact.uri));
    assert.ok(existsSync(exported.markdownArtifact.uri));
    assert.match(readFileSync(exported.markdownArtifact.uri, "utf8"), /# Release Pipeline Bundle/);
    assert.match(readFileSync(exported.jsonArtifact.uri, "utf8"), /"environment": "dev"/);
    const persisted = store.getReleaseBundleRecord(exported.bundle.bundleId);
    assert.equal(persisted?.environment, "dev");
    assert.equal(persisted?.jsonArtifactUri, exported.jsonArtifact.uri);
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("release pipeline validates registry and deploy secret refs through secret management when configured", async () => {
  const workspace = createTempWorkspace("aa-release-pipeline-secret-");
  const dbPath = join(workspace, "release-pipeline.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  seedManagedReleaseSecrets(store, "staging");

  try {
    const service = new ReleasePipelineService({
      repoRootDir: REPO_ROOT,
      artifactStoreOptions: { rootDir: join(workspace, "artifacts") },
      secretManagementService: new SecretManagementService(db, store),
    });

    const bundle = await service.buildBundle({
      environment: "staging",
      version: "2.3.4",
      commitSha: "abcdef1234567890",
      rolloutStrategy: "canary",
    });

    assert.equal(bundle.registryCredentialRef, "secret://system/registry/ghcr/staging");
    assert.equal(bundle.deploymentCredentialRef, "secret://system/deploy/kubeconfig/staging");
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("release pipeline service executes image build and publish workflow with revoked registry lease", async () => {
  const workspace = createTempWorkspace("aa-release-pipeline-execute-");
  const dbPath = join(workspace, "release-pipeline-execute.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const runner = new RecordingReleaseRunner();

  try {
    seedManagedReleaseSecrets(store, "staging");
    const service = new ReleasePipelineService({
      repoRootDir: REPO_ROOT,
      artifactStoreOptions: { rootDir: join(workspace, "artifacts") },
      store,
      secretManagementService: new SecretManagementService(db, store, {
        providerEnv: {
          AA_SECRET_SYSTEM_REGISTRY_GHCR_STAGING: "registry-token-staging-1234",
          AA_SECRET_SYSTEM_DEPLOY_KUBECONFIG_STAGING: "deploy-token-staging-5678",
        },
      }),
      commandRunner: runner,
    });

    const executed = await service.executeAndExport({
      environment: "staging",
      version: "2.3.4",
      commitSha: "abcdef1234567890",
      rolloutStrategy: "canary",
    });

    assert.equal(executed.report.executionMode, "execute");
    assert.equal(executed.report.commandResults.length, 2);
    assert.equal(runner.calls.length, 2);
    assert.equal(runner.calls[0]?.command, "docker");
    assert.equal(runner.calls[1]?.command, "gh");
    assert.equal(executed.report.registrySecret.accessMode, "lease");
    assert.equal(executed.report.registrySecret.leaseStatus, "revoked");
    assert.equal(executed.report.publishWorkflowRunId, "720000001");
    assert.match(executed.report.publishCommand, /image_repository=automatic-agent-system/);
    const persisted = store.getReleaseBundleRecord(executed.bundle.bundleId);
    assert.equal(persisted?.environment, "staging");
    const persistedExecution = store.getReleaseExecutionReportRecord(executed.report.executionId);
    assert.equal(persistedExecution?.bundleId, executed.bundle.bundleId);
    assert.equal(persistedExecution?.registrySecretAccessMode, "lease");
    assert.equal(persistedExecution?.registryLeaseStatus, "revoked");
    assert.equal(persistedExecution?.publishWorkflowRunId, "720000001");
    assert.match(persistedExecution?.publishCommand ?? "", /image_repository=automatic-agent-system/);
    const leases = store.listSecretLeasesBySecretRef("secret://system/registry/ghcr/staging");
    assert.equal(leases.length, 1);
    assert.equal(leases[0]?.status, "revoked");
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});

test("release pipeline service throws when executeAndExport is called without secret management service", async () => {
  const workspace = createTempWorkspace("aa-release-pipeline-no-secret-");
  try {
    const service = new ReleasePipelineService({
      repoRootDir: REPO_ROOT,
      artifactStoreOptions: { rootDir: join(workspace, "artifacts") },
      // No secretManagementService - should fail
    });

    assert.rejects(
      async () =>
        await service.executeAndExport({
          environment: "staging",
          version: "2.3.4",
          commitSha: "abcdef1234567890",
          rolloutStrategy: "canary",
        }),
      (error: unknown) =>
        (error as any)?.code === "release.secret_management_required_for_execute",
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("release pipeline fail-closes staged releases when managed credentials are due for rotation", async () => {
  const workspace = createTempWorkspace("aa-release-pipeline-rotation-");
  const dbPath = join(workspace, "release-pipeline-rotation.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  try {
    const dueAt = "2026-03-01T00:00:00.000Z";
    store.upsertSecretRegistryRecord({
      secretRef: "secret://system/registry/ghcr/staging",
      displayName: "Registry staging",
      category: "tenant_credential",
      providerKind: "vault",
      scopeType: "system",
      scopeRef: "registry.ghcr.staging",
      status: "active",
      rotationPolicyJson: JSON.stringify({ cadenceDays: 7, ttlMinutes: 60, breakGlass: false }),
      metadataJson: null,
      currentVersion: "v1",
      lastRotatedAt: dueAt,
      nextRotationDueAt: "2026-03-08T00:00:00.000Z",
      createdAt: dueAt,
      updatedAt: dueAt,
    });
    store.upsertSecretRegistryRecord({
      secretRef: "secret://system/deploy/kubeconfig/staging",
      displayName: "Deploy staging",
      category: "db_connection_secret",
      providerKind: "vault",
      scopeType: "system",
      scopeRef: "deploy.kubeconfig.staging",
      status: "active",
      rotationPolicyJson: JSON.stringify({ cadenceDays: 7, ttlMinutes: 30, breakGlass: true }),
      metadataJson: null,
      currentVersion: "v1",
      lastRotatedAt: dueAt,
      nextRotationDueAt: "2026-03-08T00:00:00.000Z",
      createdAt: dueAt,
      updatedAt: dueAt,
    });

    const service = new ReleasePipelineService({
      repoRootDir: REPO_ROOT,
      artifactStoreOptions: { rootDir: join(workspace, "artifacts") },
      secretManagementService: new SecretManagementService(db, store, {
        providerEnv: {
          AA_VAULT_SECRETS_JSON: JSON.stringify({
            "secret://system/registry/ghcr/staging": "vault-registry-token-1234",
            "secret://system/deploy/kubeconfig/staging": "vault-deploy-token-5678",
          }),
        },
      }),
    });

    assert.rejects(
      async () =>
        await service.buildBundle({
          environment: "staging",
          version: "2.3.4",
          commitSha: "abcdef1234567890",
          rolloutStrategy: "canary",
        }),
      /release\.secret_rotation_due:staging:registry:secret:\/\/system\/registry\/ghcr\/staging/,
    );
  } finally {
    db.close();
    cleanupPath(workspace);
  }
});
