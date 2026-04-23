import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { ReleasePipelineService } from "../../../../src/platform/control-plane/incident-control/release-pipeline-service.js";
import { SecretManagementService } from "../../../../src/platform/control-plane/iam/secret-management-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
const REPO_ROOT = process.cwd();
class FailAfterBuildRunner {
    invocationCount = 0;
    async run(request) {
        this.invocationCount += 1;
        if (this.invocationCount === 1) {
            return {
                step: request.step,
                command: request.command,
                args: [...request.args],
                executed: true,
                exitCode: 0,
                stdout: "ok:build",
                stderr: "",
                durationMs: 1,
            };
        }
        return {
            step: request.step,
            command: request.command,
            args: [...request.args],
            executed: true,
            exitCode: 1,
            stdout: "",
            stderr: "publish failed",
            durationMs: 1,
        };
    }
}
function seedManagedReleaseSecrets(store, environment) {
    const createdAt = "2026-04-09T12:00:00.000Z";
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
test("release pipeline fail-closes unknown environments", async () => {
    const workspace = createTempWorkspace("aa-release-boundary-");
    try {
        const service = new ReleasePipelineService({
            repoRootDir: REPO_ROOT,
            artifactStoreOptions: { rootDir: `${workspace}/artifacts` },
        });
        await assert.rejects(() => service.buildBundle({
            environment: "prodx",
            version: "1.0.0",
            commitSha: "abcdef1234567",
            rolloutStrategy: "canary",
        }), /release\.environment_not_found:prodx/);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("release pipeline fail-closes forbidden prod rolling deployment", async () => {
    const workspace = createTempWorkspace("aa-release-boundary-");
    try {
        const service = new ReleasePipelineService({
            repoRootDir: REPO_ROOT,
            artifactStoreOptions: { rootDir: `${workspace}/artifacts` },
        });
        await assert.rejects(() => service.buildBundle({
            environment: "prod",
            version: "1.0.0",
            commitSha: "abcdef1234567",
            rolloutStrategy: "rolling",
        }), /release\.rollout_not_allowed:prod:rolling/);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("release pipeline fail-closes malformed registry credential refs in environment config", async () => {
    const workspace = createTempWorkspace("aa-release-boundary-config-");
    try {
        const configDir = join(workspace, "config", "environments");
        mkdirSync(configDir, { recursive: true });
        const source = readFileSync(join(REPO_ROOT, "config", "environments", "staging.json"), "utf8");
        writeFileSync(join(configDir, "staging.json"), source.replace('"registryCredentialRef": "secret://system/registry/ghcr/staging"', '"registryCredentialRef": "plaintext-staging-secret"'));
        const service = new ReleasePipelineService({
            repoRootDir: REPO_ROOT,
            configRootDir: configDir,
            artifactStoreOptions: { rootDir: `${workspace}/artifacts` },
        });
        await assert.rejects(() => service.buildBundle({
            environment: "staging",
            version: "1.0.0",
            commitSha: "abcdef1234567",
            rolloutStrategy: "canary",
        }), /release\.invalid_registry_credential_ref:plaintext-staging-secret/);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("release pipeline fail-closes when secret refs are not registered in secret management", async () => {
    const workspace = createTempWorkspace("aa-release-boundary-secret-registry-");
    const dbPath = join(workspace, "release-boundary.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    try {
        const service = new ReleasePipelineService({
            repoRootDir: REPO_ROOT,
            artifactStoreOptions: { rootDir: `${workspace}/artifacts` },
            secretManagementService: new SecretManagementService(db, store),
        });
        await assert.rejects(() => service.buildBundle({
            environment: "staging",
            version: "1.0.0",
            commitSha: "abcdef1234567",
            rolloutStrategy: "canary",
        }), /secret\.registry_not_found:secret:\/\/system\/registry\/ghcr\/staging/);
    }
    finally {
        db.close();
        cleanupPath(workspace);
    }
});
test("release pipeline fail-closes when managed staging credentials are rotation-due", async () => {
    const workspace = createTempWorkspace("aa-release-boundary-rotation-");
    const dbPath = join(workspace, "release-boundary-rotation.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const createdAt = "2026-03-01T00:00:00.000Z";
    try {
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
            lastRotatedAt: createdAt,
            nextRotationDueAt: "2026-03-08T00:00:00.000Z",
            createdAt,
            updatedAt: createdAt,
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
            lastRotatedAt: createdAt,
            nextRotationDueAt: "2026-03-08T00:00:00.000Z",
            createdAt,
            updatedAt: createdAt,
        });
        const service = new ReleasePipelineService({
            repoRootDir: REPO_ROOT,
            artifactStoreOptions: { rootDir: `${workspace}/artifacts` },
            secretManagementService: new SecretManagementService(db, store, {
                providerEnv: {
                    AA_VAULT_SECRETS_JSON: JSON.stringify({
                        "secret://system/registry/ghcr/staging": "vault-registry-token-1234",
                        "secret://system/deploy/kubeconfig/staging": "vault-deploy-token-5678",
                    }),
                },
            }),
        });
        await assert.rejects(() => service.buildBundle({
            environment: "staging",
            version: "1.0.0",
            commitSha: "abcdef1234567",
            rolloutStrategy: "canary",
        }), /release\.secret_rotation_due:staging:registry:secret:\/\/system\/registry\/ghcr\/staging/);
    }
    finally {
        db.close();
        cleanupPath(workspace);
    }
});
test("release pipeline execute fail-closes publish failures and revokes issued registry lease", async () => {
    const workspace = createTempWorkspace("aa-release-boundary-execute-");
    const dbPath = join(workspace, "release-boundary-execute.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    try {
        seedManagedReleaseSecrets(store, "staging");
        const service = new ReleasePipelineService({
            repoRootDir: REPO_ROOT,
            artifactStoreOptions: { rootDir: `${workspace}/artifacts` },
            secretManagementService: new SecretManagementService(db, store, {
                providerEnv: {
                    AA_SECRET_SYSTEM_REGISTRY_GHCR_STAGING: "registry-token-staging-1234",
                    AA_SECRET_SYSTEM_DEPLOY_KUBECONFIG_STAGING: "deploy-token-staging-5678",
                },
            }),
            store,
            commandRunner: new FailAfterBuildRunner(),
        });
        await assert.rejects(() => service.executeAndExport({
            environment: "staging",
            version: "1.0.0",
            commitSha: "abcdef1234567",
            rolloutStrategy: "canary",
        }), /release\.publish_failed:1/);
        const leases = store.listSecretLeasesBySecretRef("secret://system/registry/ghcr/staging");
        assert.equal(leases.length, 1);
        assert.equal(leases[0]?.status, "revoked");
        assert.equal(leases[0]?.revocationReasonCode, "publish_failed");
        assert.equal(store.listReleaseExecutionReportRecords({ environment: "staging", limit: 5 }).length, 0);
    }
    finally {
        db.close();
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=release-pipeline-boundary.test.js.map