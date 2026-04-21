import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { runBuiltCliExpectFailure } from "../../../helpers/cli.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../../..");
const CLI_PATH = `${REPO_ROOT}/dist/src/cli/secret-management.js`;
test("secret-management CLI registers, resolves, rotates, and summarizes managed secrets", () => {
    const workspace = createTempWorkspace("aa-secret-management-cli-");
    const dbPath = join(workspace, "secret-management-cli.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    try {
        const registered = JSON.parse(execFileSync("node", ["--enable-source-maps", CLI_PATH], {
            cwd: REPO_ROOT,
            env: {
                ...process.env,
                AA_DB_PATH: dbPath,
                AA_SECRET_ACTION: "register",
                AA_SECRET_REF: "secret://system/registry/ghcr/prod",
                AA_SECRET_DISPLAY_NAME: "GHCR Production Push Token",
                AA_SECRET_CATEGORY: "tenant_credential",
                AA_SECRET_PROVIDER_KIND: "environment",
                AA_SECRET_SCOPE_TYPE: "system",
                AA_SECRET_SCOPE_REF: "registry.ghcr.prod",
                AA_SECRET_ROTATION_CADENCE_DAYS: "30",
                AA_SECRET_TTL_MINUTES: "60",
                AA_SECRET_CURRENT_VERSION: "v1",
            },
            encoding: "utf8",
        }));
        assert.equal(registered.secretRef, "secret://system/registry/ghcr/prod");
        assert.equal(registered.status, "active");
        const resolved = JSON.parse(execFileSync("node", ["--enable-source-maps", CLI_PATH], {
            cwd: REPO_ROOT,
            env: {
                ...process.env,
                AA_DB_PATH: dbPath,
                AA_SECRET_ACTION: "resolve",
                AA_SECRET_REF: "secret://system/registry/ghcr/prod",
                AA_SECRET_REQUESTED_BY: "ops.release",
                AA_SECRET_GRANTED_TO: "deploy-worker",
                AA_SECRET_USAGE_PURPOSE: "publish_image",
                AA_SECRET_SYSTEM_REGISTRY_GHCR_PROD: "registry-token-123456",
            },
            encoding: "utf8",
        }));
        assert.equal(resolved.metadata.resolved, true);
        assert.equal(resolved.metadata.maskedValue.endsWith("3456"), true);
        assert.equal(typeof resolved.metadata.auditId, "string");
        const rotation = JSON.parse(execFileSync("node", ["--enable-source-maps", CLI_PATH], {
            cwd: REPO_ROOT,
            env: {
                ...process.env,
                AA_DB_PATH: dbPath,
                AA_SECRET_ACTION: "rotate",
                AA_SECRET_REF: "secret://system/registry/ghcr/prod",
                AA_SECRET_ROTATION_MODE: "scheduled",
                AA_SECRET_ROTATION_STATUS: "completed",
                AA_SECRET_ROTATION_REASON_CODE: "rotation_applied",
                AA_SECRET_REQUESTED_BY: "ops.rotation",
                AA_SECRET_PREVIOUS_VERSION: "v1",
                AA_SECRET_NEXT_VERSION: "v2",
            },
            encoding: "utf8",
        }));
        assert.equal(rotation.nextVersion, "v2");
        const leaseIssued = JSON.parse(execFileSync("node", ["--enable-source-maps", CLI_PATH], {
            cwd: REPO_ROOT,
            env: {
                ...process.env,
                AA_DB_PATH: dbPath,
                AA_SECRET_ACTION: "issue",
                AA_SECRET_REF: "secret://system/registry/ghcr/prod",
                AA_SECRET_REQUESTED_BY: "ops.release",
                AA_SECRET_GRANTED_TO: "publish-worker",
                AA_SECRET_USAGE_PURPOSE: "publish_image",
                AA_SECRET_LEASE_TTL_MINUTES: "10",
                AA_SECRET_SYSTEM_REGISTRY_GHCR_PROD: "registry-token-123456",
            },
            encoding: "utf8",
        }));
        assert.equal(typeof leaseIssued.metadata.leaseId, "string");
        assert.equal(leaseIssued.metadata.leaseStatus, "active");
        assert.equal(leaseIssued.metadata.leaseId, leaseIssued.lease.leaseId);
        const leaseList = JSON.parse(execFileSync("node", ["--enable-source-maps", CLI_PATH], {
            cwd: REPO_ROOT,
            env: {
                ...process.env,
                AA_DB_PATH: dbPath,
                AA_SECRET_ACTION: "leases",
                AA_SECRET_REF: "secret://system/registry/ghcr/prod",
            },
            encoding: "utf8",
        }));
        assert.equal(leaseList.leases.length, 1);
        assert.equal(leaseList.leases[0]?.status, "active");
        const revoked = JSON.parse(execFileSync("node", ["--enable-source-maps", CLI_PATH], {
            cwd: REPO_ROOT,
            env: {
                ...process.env,
                AA_DB_PATH: dbPath,
                AA_SECRET_ACTION: "revoke",
                AA_SECRET_LEASE_ID: leaseIssued.lease.leaseId,
                AA_SECRET_REQUESTED_BY: "ops.release",
                AA_SECRET_ROTATION_REASON_CODE: "publish_complete",
            },
            encoding: "utf8",
        }));
        assert.equal(revoked.status, "revoked");
        assert.equal(revoked.revocationReasonCode, "publish_complete");
        const summary = JSON.parse(execFileSync("node", ["--enable-source-maps", CLI_PATH], {
            cwd: REPO_ROOT,
            env: {
                ...process.env,
                AA_DB_PATH: dbPath,
                AA_SECRET_ACTION: "summary",
                AA_SECRET_REF: "secret://system/registry/ghcr/prod",
            },
            encoding: "utf8",
        }));
        assert.equal(summary.registry.currentVersion, "v2");
        assert.equal(summary.usageAudits.length, 1);
        assert.equal(summary.rotationEvents.length, 1);
        assert.equal(summary.leases.length, 1);
    }
    finally {
        db.close();
        cleanupPath(workspace);
    }
});
test("secret-management CLI can issue provider-backed short-lived leases without local TTL fallback", () => {
    const workspace = createTempWorkspace("aa-secret-management-cli-provider-lease-");
    const dbPath = join(workspace, "secret-management-cli-provider-lease.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    try {
        execFileSync("node", ["--enable-source-maps", CLI_PATH], {
            cwd: REPO_ROOT,
            env: {
                ...process.env,
                AA_DB_PATH: dbPath,
                AA_SECRET_ACTION: "register",
                AA_SECRET_REF: "secret://system/registry/ghcr/prod",
                AA_SECRET_DISPLAY_NAME: "GHCR Production Push Token",
                AA_SECRET_CATEGORY: "tenant_credential",
                AA_SECRET_PROVIDER_KIND: "vault",
                AA_SECRET_SCOPE_TYPE: "system",
                AA_SECRET_SCOPE_REF: "registry.ghcr.prod",
            },
            encoding: "utf8",
        });
        const issued = JSON.parse(execFileSync("node", ["--enable-source-maps", CLI_PATH], {
            cwd: REPO_ROOT,
            env: {
                ...process.env,
                AA_DB_PATH: dbPath,
                AA_SECRET_ACTION: "issue",
                AA_SECRET_REF: "secret://system/registry/ghcr/prod",
                AA_SECRET_REQUESTED_BY: "ops.release",
                AA_SECRET_GRANTED_TO: "publish-worker",
                AA_SECRET_USAGE_PURPOSE: "publish_image",
                AA_VAULT_SECRETS_JSON: JSON.stringify({
                    "secret://system/registry/ghcr/prod": {
                        value: "vault-registry-token-123456",
                        locator: "vault://kv/release/prod/registry",
                        issued_lease: {
                            value: "vault-issued-lease-token-654321",
                            locator: "vault://lease/release/prod/registry",
                            lease_id: "vault-lease-001",
                            expires_at: "2099-01-01T00:00:00.000Z",
                            renewable: true,
                            issued_by: "vault.dynamic.release",
                        },
                    },
                }),
            },
            encoding: "utf8",
        }));
        assert.equal(issued.metadata.leaseSource, "provider_issued");
        assert.equal(issued.metadata.providerLeaseId, "vault-lease-001");
        assert.equal(issued.metadata.renewable, true);
    }
    finally {
        db.close();
        cleanupPath(workspace);
    }
});
test("secret-management CLI refreshes provider metadata and requests due rotations", () => {
    const workspace = createTempWorkspace("aa-secret-management-cli-refresh-");
    const dbPath = join(workspace, "secret-management-cli-refresh.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    try {
        execFileSync("node", ["--enable-source-maps", CLI_PATH], {
            cwd: REPO_ROOT,
            env: {
                ...process.env,
                AA_DB_PATH: dbPath,
                AA_SECRET_ACTION: "register",
                AA_SECRET_REF: "secret://system/refresh/cli",
                AA_SECRET_DISPLAY_NAME: "CLI Refresh Secret",
                AA_SECRET_CATEGORY: "provider_api_key",
                AA_SECRET_PROVIDER_KIND: "environment",
                AA_SECRET_SCOPE_TYPE: "system",
                AA_SECRET_SCOPE_REF: "system.refresh.cli",
                AA_SECRET_ROTATION_CADENCE_DAYS: "7",
                AA_SECRET_CURRENT_VERSION: "v1",
            },
            encoding: "utf8",
        });
        const refreshed = JSON.parse(execFileSync("node", ["--enable-source-maps", CLI_PATH], {
            cwd: REPO_ROOT,
            env: {
                ...process.env,
                AA_DB_PATH: dbPath,
                AA_SECRET_ACTION: "refresh",
                AA_SECRET_REF: "secret://system/refresh/cli",
                AA_SECRET_SYSTEM_REFRESH_CLI: "cli-refresh-token-1234",
            },
            encoding: "utf8",
        }));
        assert.equal(refreshed.metadata.providerKind, "environment");
        assert.equal(refreshed.metadata.auditId, null);
        execFileSync("node", ["--enable-source-maps", CLI_PATH], {
            cwd: REPO_ROOT,
            env: {
                ...process.env,
                AA_DB_PATH: dbPath,
                AA_SECRET_ACTION: "rotate",
                AA_SECRET_REF: "secret://system/refresh/cli",
                AA_SECRET_ROTATION_MODE: "scheduled",
                AA_SECRET_ROTATION_STATUS: "completed",
                AA_SECRET_ROTATION_REASON_CODE: "rotation_complete",
                AA_SECRET_REQUESTED_BY: "ops.rotation",
                AA_SECRET_PREVIOUS_VERSION: "v1",
                AA_SECRET_NEXT_VERSION: "v2",
            },
            encoding: "utf8",
        });
        const requestedDue = JSON.parse(execFileSync("node", ["--enable-source-maps", CLI_PATH], {
            cwd: REPO_ROOT,
            env: {
                ...process.env,
                AA_DB_PATH: dbPath,
                AA_SECRET_ACTION: "request_due",
                AA_SECRET_AS_OF: "2099-01-01T00:00:00.000Z",
                AA_SECRET_REQUESTED_BY: "ops.rotation",
            },
            encoding: "utf8",
        }));
        assert.equal(requestedDue.events.length, 1);
        assert.equal(requestedDue.events[0]?.status, "requested");
        assert.equal(requestedDue.events[0]?.reasonCode, "secret.rotation_due");
    }
    finally {
        db.close();
        cleanupPath(workspace);
    }
});
test("secret-management CLI fail-closes when postgres storage execution is requested", () => {
    const failure = runBuiltCliExpectFailure("secret-management.js", {
        AA_DB_PATH: "/tmp/secret-management-postgres.db",
        AA_SECRET_ACTION: "summary",
        AA_SECRET_REF: "secret://system/registry/ghcr/prod",
        AA_STORAGE_DRIVER: "postgres",
        AA_STORAGE_POSTGRES_DSN: "postgresql://prod-db.example.com/agent_os?sslmode=require",
    });
    assert.notEqual(failure.status, 0);
    assert.match(failure.stderr, /storage\.(cli_sync_shadow_sqlite_required|backend_driver_not_implemented:postgres|backend_config_invalid)/);
});
//# sourceMappingURL=secret-management-cli.test.js.map