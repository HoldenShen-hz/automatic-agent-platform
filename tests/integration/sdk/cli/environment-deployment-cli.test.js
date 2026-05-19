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
const CLI_PATH = `${REPO_ROOT}/dist/src/sdk/cli/environment-deployment.js`;
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
function seedManagedEnvironmentSecrets(store, environment) {
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
test("environment-deployment CLI summarizes and exports a target-ready environment matrix", () => {
    const workspace = createTempWorkspace("aa-environment-deployment-cli-");
    const dbPath = join(workspace, "environment-deployment-cli.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    try {
        const verifiedAt = nowIso();
        for (const environmentId of ["dev", "test", "staging", "pre-prod", "prod"]) {
            seedManagedEnvironmentSecrets(store, environmentId);
        }
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
        const summary = JSON.parse(execFileSync("node", ["--enable-source-maps", CLI_PATH], {
            cwd: REPO_ROOT,
            env: {
                ...process.env,
                AA_DB_PATH: dbPath,
                AA_DEPLOYMENT_ACTION: "summary",
                AA_DEPLOYMENT_TARGET_ENVIRONMENT: "prod",
                AA_DEPLOYMENT_VERSION: "5.6.7",
                AA_DEPLOYMENT_COMMIT_SHA: "abcdef0123456789",
                AA_DEPLOYMENT_ROLLOUT_STRATEGY: "blue_green",
            },
            encoding: "utf8",
        }));
        assert.equal(summary.targetEligible, true);
        assert.equal(summary.targetReleaseBundle?.environment, "prod");
        assert.equal(summary.targetReleaseBundle.registryCredentialRef, "secret://system/registry/ghcr/prod");
        const exported = JSON.parse(execFileSync("node", ["--enable-source-maps", CLI_PATH], {
            cwd: REPO_ROOT,
            env: {
                ...process.env,
                AA_DB_PATH: dbPath,
                AA_DEPLOYMENT_ACTION: "export",
                AA_DEPLOYMENT_TARGET_ENVIRONMENT: "prod",
                AA_DEPLOYMENT_VERSION: "5.6.7",
                AA_DEPLOYMENT_COMMIT_SHA: "abcdef0123456789",
                AA_DEPLOYMENT_ROLLOUT_STRATEGY: "blue_green",
            },
            encoding: "utf8",
        }));
        assert.match(exported.jsonArtifact.uri, /environment_deployment/);
        assert.equal(exported.report.highestReadyEnvironment, "prod");
        assert.equal(exported.report.entries?.find((entry) => entry.environment === "prod")?.secretInjection.ready, true);
    }
    finally {
        db.close();
        cleanupPath(workspace);
    }
});
test("environment-deployment CLI fail-closes when postgres storage execution is requested", () => {
    const failure = runBuiltCliExpectFailure("environment-deployment.js", {
        AA_DB_PATH: "/tmp/environment-deployment-postgres.db",
        AA_DEPLOYMENT_ACTION: "summary",
        AA_STORAGE_DRIVER: "postgres",
        AA_STORAGE_POSTGRES_DSN: "postgresql://prod-db.example.com/agent_os?sslmode=require",
    });
    assert.notEqual(failure.status, 0);
    assert.match(failure.stderr, /storage\.(cli_sync_shadow_sqlite_required|backend_driver_not_implemented:postgres|backend_config_invalid)/);
});
test("environment-deployment CLI fail-closes on invalid rollout strategy env", () => {
    const failure = runBuiltCliExpectFailure("environment-deployment.js", {
        AA_DB_PATH: "/tmp/environment-deployment-invalid.db",
        AA_DEPLOYMENT_ACTION: "summary",
        AA_DEPLOYMENT_ROLLOUT_STRATEGY: "full-send",
    });
    assert.notEqual(failure.status, 0);
    assert.match(failure.stderr, /invalid_env:AA_DEPLOYMENT_ROLLOUT_STRATEGY/);
});
//# sourceMappingURL=environment-deployment-cli.test.js.map