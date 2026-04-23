import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { runBuiltCliExpectFailure } from "../../../helpers/cli.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
function runCli(env) {
    const stdout = execFileSync(process.execPath, [join(process.cwd(), "dist", "src", "sdk", "cli", "marketplace.js")], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            ...env,
        },
        encoding: "utf8",
    });
    return JSON.parse(stdout);
}
test("marketplace CLI supports package registration, review, publish, revoke, and export", () => {
    const workspace = createTempWorkspace("aa-marketplace-cli-");
    const dbPath = join(workspace, "marketplace.db");
    const artifactRoot = join(workspace, "artifacts");
    try {
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        db.close();
        const pkg = runCli({
            AA_DB_PATH: dbPath,
            AA_MARKETPLACE_ACTION: "register_package",
            AA_EXTENSION_ID: "plugin.release-audit",
            AA_PACKAGE_TYPE: "plugin",
            AA_DISPLAY_NAME: "Release Audit Plugin",
            AA_VERSION: "1.2.0",
            AA_OWNER: "ecosystem.team",
            AA_TRUST_LEVEL: "verified",
            AA_SOURCE_URI: "registry://plugins/release-audit",
            AA_CAPABILITIES_JSON: JSON.stringify(["audit_export", "incident_console"]),
            AA_PERMISSIONS_JSON: JSON.stringify(["read.audit", "write.report"]),
            AA_COMPATIBILITY_JSON: JSON.stringify({
                apiContract: "^1.0.0",
                permissionSurface: "^1.0.0",
                runtimeCapability: "^1.0.0",
            }),
            AA_SIGNATURE_VERIFIED: "true",
            AA_MANIFEST_CHECKSUM: "c".repeat(64),
        });
        assert.ok(pkg.packageId.length > 0);
        const review = runCli({
            AA_DB_PATH: dbPath,
            AA_MARKETPLACE_ACTION: "submit_review",
            AA_PACKAGE_ID: pkg.packageId,
            AA_SUBMITTER: "ecosystem.submitter",
            AA_FINDINGS_JSON: JSON.stringify(["lint_ok", "signature_ok"]),
        });
        const approved = runCli({
            AA_DB_PATH: dbPath,
            AA_MARKETPLACE_ACTION: "decide_review",
            AA_REVIEW_ID: review.reviewId,
            AA_REVIEW_STATUS: "approved",
            AA_REVIEWER: "review.board",
            AA_REASON_CODE: "approved_for_publish",
            AA_FINDINGS_JSON: JSON.stringify(["permission_surface_ok"]),
        });
        assert.equal(approved.status, "approved");
        const publication = runCli({
            AA_DB_PATH: dbPath,
            AA_MARKETPLACE_ACTION: "publish",
            AA_PACKAGE_ID: pkg.packageId,
            AA_REVIEW_ID: review.reviewId,
            AA_CHANNEL: "marketplace_public",
        });
        assert.equal(publication.status, "published");
        const summary = runCli({
            AA_DB_PATH: dbPath,
            AA_MARKETPLACE_ACTION: "summary",
        });
        assert.equal(summary.report.summary.overallVerdict, "ready");
        assert.equal(summary.report.summary.packagesReady, 1);
        const exported = runCli({
            AA_DB_PATH: dbPath,
            AA_MARKETPLACE_ACTION: "export",
            AA_ARTIFACT_ROOT: artifactRoot,
        });
        assert.ok(existsSync(exported.jsonArtifact.uri));
        assert.ok(existsSync(exported.markdownArtifact.uri));
        const revoked = runCli({
            AA_DB_PATH: dbPath,
            AA_MARKETPLACE_ACTION: "revoke",
            AA_PUBLICATION_ID: publication.publicationId,
            AA_REASON_CODE: "security_recall",
        });
        assert.equal(revoked.status, "revoked");
        assert.equal(revoked.revocationReasonCode, "security_recall");
        const db2 = new SqliteDatabase(dbPath);
        db2.migrate();
        const store = new AuthoritativeTaskStore(db2);
        assert.equal(store.listExtensionPackages(10).length, 1);
        assert.equal(store.listMarketplaceReviews(10).length, 1);
        assert.equal(store.listMarketplacePublications(10).length, 1);
        assert.equal(store.listMarketplaceGovernanceReports(10).length >= 1, true);
        db2.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("marketplace CLI fail-closes when postgres storage execution is requested", () => {
    const failure = runBuiltCliExpectFailure("marketplace.js", {
        AA_DB_PATH: "/tmp/marketplace-postgres.db",
        AA_MARKETPLACE_ACTION: "list_packages",
        AA_STORAGE_DRIVER: "postgres",
        AA_STORAGE_POSTGRES_DSN: "postgresql://prod-db.example.com/agent_os?sslmode=require",
    });
    assert.notEqual(failure.status, 0);
    assert.match(failure.stderr, /storage\.(cli_sync_shadow_sqlite_required|backend_driver_not_implemented:postgres|backend_config_invalid)/);
});
//# sourceMappingURL=marketplace-cli.test.js.map