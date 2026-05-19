import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { runBuiltCliExpectFailure } from "../../../helpers/cli.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
const repoRoot = process.cwd();
function runCli(env) {
    const stdout = execFileSync(process.execPath, [join(repoRoot, "dist", "src", "sdk", "cli", "tenant-platform.js")], {
        cwd: repoRoot,
        env: {
            ...process.env,
            ...env,
        },
        encoding: "utf8",
    });
    return JSON.parse(stdout);
}
test("tenant platform CLI creates a scoped topology and prints summary", () => {
    const workspace = createTempWorkspace("aa-tenant-platform-cli-");
    const dbPath = join(workspace, "tenant-platform-cli.db");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        db.close();
        runCli({
            AA_DB_PATH: dbPath,
            AA_TENANT_ACTION: "create_organization",
            AA_ORGANIZATION_ID: "org-cli",
            AA_DISPLAY_NAME: "CLI Org",
        });
        runCli({
            AA_DB_PATH: dbPath,
            AA_TENANT_ACTION: "create_workspace",
            AA_WORKSPACE_ID: "ws-cli",
            AA_OWNER_ID: "user-cli",
            AA_DISPLAY_NAME: "CLI Workspace",
            AA_PLAN_ID: "enterprise",
            AA_ORGANIZATION_ID: "org-cli",
        });
        runCli({
            AA_DB_PATH: dbPath,
            AA_TENANT_ACTION: "create_tenant",
            AA_TENANT_ID: "tenant-cli",
            AA_ORGANIZATION_ID: "org-cli",
            AA_STORAGE_SCOPE: "tenant-cli.storage",
            AA_IDENTITY_SCOPE: "tenant-cli.identity",
            AA_POLICY_SCOPE: "tenant-cli.policy",
            AA_ARTIFACT_SCOPE: "tenant-cli.artifact",
            AA_SET_DEFAULT_TENANT: "true",
        });
        runCli({
            AA_DB_PATH: dbPath,
            AA_TENANT_ACTION: "create_namespace",
            AA_NAMESPACE_ID: "ns-cli-memory",
            AA_PLANE: "memory_archive",
            AA_WORKSPACE_ID: "ws-cli",
            AA_TENANT_ID: "tenant-cli",
            AA_RETENTION_POLICY: "archive_365d",
            AA_ENCRYPTION_POLICY: "kms:tenant-cli",
        });
        const topology = runCli({
            AA_DB_PATH: dbPath,
            AA_TENANT_ACTION: "topology",
        });
        assert.equal(topology.counts.organizations, 1);
        assert.equal(topology.counts.workspaces, 1);
        assert.equal(topology.counts.tenants, 1);
        assert.equal(topology.counts.dataNamespaces, 1);
        assert.equal(topology.organizations[0]?.defaultTenantId, "tenant-cli");
        assert.equal(topology.workspaces[0]?.workspaceId, "ws-cli");
        assert.equal(topology.tenants[0]?.tenantId, "tenant-cli");
    }
    finally {
        cleanupPath(workspace);
    }
});
test("tenant platform CLI fail-closes when postgres storage execution is requested", () => {
    const failure = runBuiltCliExpectFailure("tenant-platform.js", {
        AA_DB_PATH: "/tmp/tenant-platform-postgres.db",
        AA_TENANT_ACTION: "topology",
        AA_STORAGE_DRIVER: "postgres",
        AA_STORAGE_POSTGRES_DSN: "postgresql://prod-db.example.com/agent_os?sslmode=require",
    });
    assert.notEqual(failure.status, 0);
    assert.match(failure.stderr, /storage\.(cli_sync_shadow_sqlite_required|backend_driver_not_implemented:postgres|backend_config_invalid)/);
});
//# sourceMappingURL=tenant-platform-cli.test.js.map