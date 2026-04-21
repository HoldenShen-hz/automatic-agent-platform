import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { runBuiltCliExpectFailure } from "../../../helpers/cli.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_PATH = `${REPO_ROOT}/dist/src/cli/deployment-execution.js`;
function seedReadyEnvironment(store, environment, verifiedAt) {
    const componentTypes = environment === "test"
        ? ["provider", "sandbox"]
        : ["provider", "gateway", "sandbox", "worker_fleet", "artifact_store"];
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
function upsertTenantForEnvironment(store, environmentId) {
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
function seedManagedDeploymentSecrets(store, environment) {
    const createdAt = nowIso();
    store.upsertSecretRegistryRecord({
        secretRef: `secret://system/registry/ghcr/${environment}`,
        displayName: `GHCR ${environment} Push Token`,
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
        displayName: `${environment} Deployment Credential`,
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
test("deployment-execution CLI exports masked deployment plan and can simulate execution", () => {
    const workspace = createTempWorkspace("aa-deployment-execution-cli-");
    const dbPath = join(workspace, "deployment-execution-cli.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    try {
        const verifiedAt = nowIso();
        seedReadyEnvironment(store, "test", verifiedAt);
        seedReadyEnvironment(store, "staging", verifiedAt);
        seedReadyEnvironment(store, "pre-prod", verifiedAt);
        seedReadyEnvironment(store, "prod", verifiedAt);
        for (const environmentId of ["staging", "pre-prod", "prod"]) {
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
        for (const environmentId of ["dev", "test", "staging", "pre-prod", "prod"]) {
            seedManagedDeploymentSecrets(store, environmentId);
        }
        const summary = JSON.parse(execFileSync("node", ["--enable-source-maps", CLI_PATH], {
            cwd: REPO_ROOT,
            env: {
                ...process.env,
                AA_DB_PATH: dbPath,
                AA_DEPLOYMENT_ENVIRONMENT: "prod",
                AA_DEPLOYMENT_VERSION: "7.8.9",
                AA_DEPLOYMENT_COMMIT_SHA: "abcdef0123456789",
                AA_DEPLOYMENT_ROLLOUT_STRATEGY: "blue_green",
                AA_SECRET_SYSTEM_REGISTRY_GHCR_PROD: "registry-token-123456",
                AA_SECRET_SYSTEM_DEPLOY_KUBECONFIG_PROD: "deploy-token-abcdef",
            },
            encoding: "utf8",
        }));
        assert.equal(summary.executionMode, "plan");
        assert.equal(summary.registrySecret.resolved, true);
        const executed = JSON.parse(execFileSync("node", ["--enable-source-maps", CLI_PATH], {
            cwd: REPO_ROOT,
            env: {
                ...process.env,
                AA_DB_PATH: dbPath,
                AA_DEPLOYMENT_EXECUTION_ACTION: "export",
                AA_DEPLOYMENT_EXECUTE: "true",
                AA_DEPLOYMENT_RUNNER: "simulate",
                AA_DEPLOYMENT_ENVIRONMENT: "prod",
                AA_DEPLOYMENT_VERSION: "7.8.9",
                AA_DEPLOYMENT_COMMIT_SHA: "abcdef0123456789",
                AA_DEPLOYMENT_ROLLOUT_STRATEGY: "blue_green",
                AA_SECRET_SYSTEM_REGISTRY_GHCR_PROD: "registry-token-123456",
                AA_SECRET_SYSTEM_DEPLOY_KUBECONFIG_PROD: "deploy-token-abcdef",
            },
            encoding: "utf8",
        }));
        assert.equal(executed.report.executionMode, "execute");
        assert.equal(executed.report.commandResults.length, 2);
        assert.equal(executed.report.commandResults[0]?.exitCode, 0);
        assert.equal(executed.report.registrySecret.accessMode, "lease");
        assert.equal(executed.report.registrySecret.leaseStatus, "revoked");
        assert.equal(typeof executed.report.registrySecret.leaseId, "string");
        assert.equal(executed.report.deploymentSecret.accessMode, "lease");
        assert.equal(executed.report.deploymentSecret.leaseStatus, "revoked");
        assert.equal(executed.report.publishWorkflowRunId, "710000001");
        assert.equal(executed.report.deployWorkflowRunId, "710000002");
        const persistedExecution = store.getDeploymentExecutionReportRecord(executed.report.executionId);
        assert.equal(persistedExecution?.environment, "prod");
        assert.equal(persistedExecution?.publishWorkflowRunId, "710000001");
        assert.equal(persistedExecution?.deployWorkflowRunId, "710000002");
        const registryLeases = store.listSecretLeasesBySecretRef("secret://system/registry/ghcr/prod");
        const deploymentLeases = store.listSecretLeasesBySecretRef("secret://system/deploy/kubeconfig/prod");
        assert.equal(registryLeases.length, 1);
        assert.equal(registryLeases[0]?.status, "revoked");
        assert.equal(deploymentLeases.length, 1);
        assert.equal(deploymentLeases[0]?.status, "revoked");
        const promotionHistory = store.listEnvironmentPromotionHistoryRecords({ targetEnvironment: "prod", limit: 5 });
        assert.equal(promotionHistory[0]?.decisionStatus, "executed");
    }
    finally {
        db.close();
        cleanupPath(workspace);
    }
});
test("deployment-execution CLI resolves vault-backed credentials without leaking plaintext", () => {
    const workspace = createTempWorkspace("aa-deployment-execution-cli-vault-");
    const dbPath = join(workspace, "deployment-execution-cli-vault.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    try {
        const verifiedAt = nowIso();
        seedReadyEnvironment(store, "test", verifiedAt);
        seedReadyEnvironment(store, "staging", verifiedAt);
        seedReadyEnvironment(store, "pre-prod", verifiedAt);
        seedReadyEnvironment(store, "prod", verifiedAt);
        for (const environmentId of ["staging", "pre-prod", "prod"]) {
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
        for (const environmentId of ["dev", "test", "staging", "pre-prod", "prod"]) {
            store.upsertSecretRegistryRecord({
                secretRef: `secret://system/registry/ghcr/${environmentId}`,
                displayName: `GHCR ${environmentId}`,
                category: "tenant_credential",
                providerKind: "vault",
                scopeType: "system",
                scopeRef: `registry.ghcr.${environmentId}`,
                status: "active",
                rotationPolicyJson: JSON.stringify({ cadenceDays: 30, ttlMinutes: 60, breakGlass: false }),
                metadataJson: null,
                currentVersion: "v2",
                lastRotatedAt: createdAt,
                nextRotationDueAt: null,
                createdAt,
                updatedAt: createdAt,
            });
            store.upsertSecretRegistryRecord({
                secretRef: `secret://system/deploy/kubeconfig/${environmentId}`,
                displayName: `Deploy ${environmentId}`,
                category: "db_connection_secret",
                providerKind: "vault",
                scopeType: "system",
                scopeRef: `deploy.kubeconfig.${environmentId}`,
                status: "active",
                rotationPolicyJson: JSON.stringify({ cadenceDays: 14, ttlMinutes: 30, breakGlass: true }),
                metadataJson: null,
                currentVersion: "v2",
                lastRotatedAt: createdAt,
                nextRotationDueAt: null,
                createdAt,
                updatedAt: createdAt,
            });
        }
        const output = execFileSync("node", ["--enable-source-maps", CLI_PATH], {
            cwd: REPO_ROOT,
            env: {
                ...process.env,
                AA_DB_PATH: dbPath,
                AA_DEPLOYMENT_ENVIRONMENT: "prod",
                AA_DEPLOYMENT_VERSION: "7.8.9",
                AA_DEPLOYMENT_COMMIT_SHA: "abcdef0123456789",
                AA_DEPLOYMENT_ROLLOUT_STRATEGY: "blue_green",
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
            encoding: "utf8",
        });
        assert.doesNotMatch(output, /vault-registry-token-123456/);
        assert.doesNotMatch(output, /vault-deploy-token-abcdef/);
        const summary = JSON.parse(output);
        assert.equal(summary.registrySecret.providerKind, "vault");
        assert.equal(summary.registrySecret.source, "vault");
        assert.equal(summary.registrySecret.maskedValue?.endsWith("3456"), true);
        assert.equal(summary.registrySecret.accessMode, "describe");
        assert.equal(summary.registrySecret.leaseId, null);
        assert.equal(summary.deploymentSecret.providerKind, "vault");
        assert.equal(summary.deploymentSecret.source, "vault");
        assert.equal(summary.deploymentSecret.accessMode, "describe");
    }
    finally {
        db.close();
        cleanupPath(workspace);
    }
});
test("deployment-execution CLI fail-closes when postgres storage execution is requested", () => {
    const failure = runBuiltCliExpectFailure("deployment-execution.js", {
        AA_DB_PATH: "/tmp/deployment-execution-postgres.db",
        AA_DEPLOYMENT_ENVIRONMENT: "prod",
        AA_DEPLOYMENT_VERSION: "7.8.9",
        AA_DEPLOYMENT_COMMIT_SHA: "abcdef0123456789",
        AA_DEPLOYMENT_ROLLOUT_STRATEGY: "blue_green",
        AA_STORAGE_DRIVER: "postgres",
        AA_STORAGE_POSTGRES_DSN: "postgresql://prod-db.example.com/agent_os?sslmode=require",
    });
    assert.notEqual(failure.status, 0);
    assert.match(failure.stderr, /storage\.(cli_sync_shadow_sqlite_required|backend_driver_not_implemented:postgres|backend_config_invalid)/);
});
//# sourceMappingURL=deployment-execution-cli.test.js.map