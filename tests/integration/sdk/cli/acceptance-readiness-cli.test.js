import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
const REPO_ROOT = process.cwd();
const CLI_PATH = `${REPO_ROOT}/dist/src/sdk/cli/acceptance-readiness.js`;
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
function writeEvidenceState(evidenceRoot) {
    mkdirSync(evidenceRoot, { recursive: true });
    writeFileSync(join(evidenceRoot, "stable-evidence-sequence-state.json"), JSON.stringify({
        sequenceId: "stable_evidence_sequence_test",
        evidenceRootDir: evidenceRoot,
        profileNames: ["24h", "72h"],
        activeProfileName: "72h",
        completed: false,
        blocked: false,
        blockReason: null,
        startedAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-15T00:00:00.000Z",
        profiles: [
            {
                profileName: "24h",
                outputDir: join(evidenceRoot, "24h"),
                campaignStatePath: join(evidenceRoot, "24h", "stable-evidence-campaign-state.json"),
                finalEvidenceReportPath: join(evidenceRoot, "24h", "stable-evidence-report.json"),
                startedAt: "2026-04-14T00:00:00.000Z",
                updatedAt: "2026-04-14T12:00:00.000Z",
                completed: true,
                passed: true,
                accumulatedDurationMs: 1000,
                remainingDurationMs: 0,
                accumulatedWallClockDurationMs: 1000,
                remainingWallClockDurationMs: 0,
                segmentCount: 2,
            },
            {
                profileName: "72h",
                outputDir: join(evidenceRoot, "72h"),
                campaignStatePath: join(evidenceRoot, "72h", "stable-evidence-campaign-state.json"),
                finalEvidenceReportPath: join(evidenceRoot, "72h", "stable-evidence-report.json"),
                startedAt: "2026-04-15T00:00:00.000Z",
                updatedAt: "2026-04-15T08:00:00.000Z",
                completed: false,
                passed: null,
                accumulatedDurationMs: 500,
                remainingDurationMs: 500,
                accumulatedWallClockDurationMs: 500,
                remainingWallClockDurationMs: 500,
                segmentCount: 1,
            },
        ],
    }, null, 2));
}
test("acceptance-readiness CLI summarizes and exports the current remaining mainline work", () => {
    const workspace = createTempWorkspace("aa-acceptance-readiness-cli-");
    const dbPath = join(workspace, "acceptance-readiness-cli.db");
    const evidenceRoot = join(workspace, "stable-evidence");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    try {
        writeEvidenceState(evidenceRoot);
        const verifiedAt = "2026-04-15T08:00:00.000Z";
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
                AA_ACCEPTANCE_READINESS_ACTION: "summary",
                AA_ACCEPTANCE_READINESS_EVIDENCE_ROOT: evidenceRoot,
                AA_ACCEPTANCE_READINESS_TARGET_ENVIRONMENT: "prod",
            },
            encoding: "utf8",
        }));
        assert.equal(summary.overallStatus, "blocked");
        assert.equal(summary.currentFocusItemId, "P1A-EVID-72");
        assert.equal(summary.stableEvidence.status, "in_progress");
        const exported = JSON.parse(execFileSync("node", ["--enable-source-maps", CLI_PATH], {
            cwd: REPO_ROOT,
            env: {
                ...process.env,
                AA_DB_PATH: dbPath,
                AA_ACCEPTANCE_READINESS_ACTION: "export",
                AA_ACCEPTANCE_READINESS_EVIDENCE_ROOT: evidenceRoot,
                AA_ACCEPTANCE_READINESS_TARGET_ENVIRONMENT: "prod",
            },
            encoding: "utf8",
        }));
        assert.match(exported.jsonArtifact.uri, /acceptance_readiness|acceptance-readiness/);
        assert.equal(exported.report.registryPublish.status, "blocked_on_external_infra");
    }
    finally {
        db.close();
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=acceptance-readiness-cli.test.js.map