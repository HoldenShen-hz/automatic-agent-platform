import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { TenantPlatformService } from "../../../../src/scale-ecosystem/marketplace/tenant-platform-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { runBuiltCliExpectFailure } from "../../../helpers/cli.js";
import { cleanupPath } from "../../../helpers/fs.js";
const repoRoot = fileURLToPath(new URL("../../../..", import.meta.url));
function runCli(env) {
    const stdout = execFileSync(process.execPath, [join(repoRoot, "dist", "src", "cli", "compliance-program.js")], {
        cwd: repoRoot,
        env: {
            ...process.env,
            ...env,
        },
        encoding: "utf8",
    });
    return JSON.parse(stdout);
}
test("compliance-program CLI exports residency and audit package", () => {
    const sandboxRoot = join(repoRoot, "data", "test-artifacts");
    mkdirSync(sandboxRoot, { recursive: true });
    const workspace = mkdtempSync(join(sandboxRoot, "aa-compliance-program-cli-"));
    try {
        const dbPath = join(workspace, "compliance-program.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const store = new AuthoritativeTaskStore(db);
        const tenantPlatform = new TenantPlatformService(db, store);
        tenantPlatform.createOrganization({
            organizationId: "org-compliance-cli",
            displayName: "Compliance CLI Org",
            billingAccountId: null,
            defaultTenantId: null,
        });
        tenantPlatform.createWorkspace({
            workspaceId: "ws-compliance-cli",
            displayName: "Compliance CLI Workspace",
            ownerId: "owner-compliance-cli",
            planId: "enterprise",
            defaultPolicySet: "strict",
            organizationId: "org-compliance-cli",
        });
        tenantPlatform.createTenant({
            tenantId: "tenant-compliance-cli",
            organizationId: "org-compliance-cli",
            storageScope: "tenant-compliance-cli",
            identityScope: "tenant-compliance-cli",
            policyScope: "tenant-compliance-cli",
            artifactScope: "tenant-compliance-cli",
            isolationMode: "shared_hard_scoped",
            deploymentMode: "private_cloud",
        });
        tenantPlatform.createDataNamespace({
            namespaceId: "namespace-compliance-cli",
            plane: "transactional",
            tenantId: "tenant-compliance-cli",
            organizationId: "org-compliance-cli",
            workspaceId: "ws-compliance-cli",
            retentionPolicy: "default",
            encryptionPolicy: "aes256",
            residencyPolicy: "cn-mainland",
        });
        db.close();
        const artifactRoot = join(workspace, "artifacts");
        const report = runCli({
            AA_DB_PATH: dbPath,
            AA_COMPLIANCE_PROGRAM_ACTION: "export",
            AA_COMPLIANCE_PROGRAM_ARTIFACT_ROOT: artifactRoot,
        });
        assert.ok(report.jsonArtifact?.artifactId);
        assert.ok((report.report?.complianceControls.length ?? 0) >= 3);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("compliance-program CLI fail-closes when postgres storage execution is requested", () => {
    const failure = runBuiltCliExpectFailure("compliance-program.js", {
        AA_DB_PATH: "/tmp/compliance-postgres.db",
        AA_COMPLIANCE_PROGRAM_ACTION: "summary",
        AA_STORAGE_DRIVER: "postgres",
        AA_STORAGE_POSTGRES_DSN: "postgresql://prod-db.example.com/agent_os?sslmode=require",
    });
    assert.notEqual(failure.status, 0);
    assert.match(failure.stderr, /storage\.(cli_sync_shadow_sqlite_required|backend_driver_not_implemented:postgres|backend_config_invalid)/);
});
//# sourceMappingURL=compliance-program-cli.test.js.map