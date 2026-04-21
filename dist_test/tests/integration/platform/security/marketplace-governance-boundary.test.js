import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import test from "node:test";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
function runCli(env) {
    return execFileSync(process.execPath, [join(process.cwd(), "dist", "src", "cli", "marketplace.js")], {
        cwd: process.cwd(),
        env: {
            ...process.env,
            ...env,
        },
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
    });
}
test("marketplace CLI fail-closes on invalid manifest checksum", () => {
    const workspace = createTempWorkspace("aa-marketplace-security-");
    const dbPath = join(workspace, "marketplace.db");
    try {
        assert.throws(() => runCli({
            AA_DB_PATH: dbPath,
            AA_MARKETPLACE_ACTION: "register_package",
            AA_EXTENSION_ID: "plugin.release-audit",
            AA_PACKAGE_TYPE: "plugin",
            AA_DISPLAY_NAME: "Release Audit Plugin",
            AA_VERSION: "1.2.0",
            AA_OWNER: "ecosystem.team",
            AA_TRUST_LEVEL: "verified",
            AA_SOURCE_URI: "registry://plugins/release-audit",
            AA_CAPABILITIES_JSON: JSON.stringify(["audit_export"]),
            AA_PERMISSIONS_JSON: JSON.stringify(["read.audit"]),
            AA_COMPATIBILITY_JSON: JSON.stringify({
                apiContract: "^1.0.0",
                permissionSurface: "^1.0.0",
                runtimeCapability: "^1.0.0",
            }),
            AA_SIGNATURE_VERIFIED: "true",
            AA_MANIFEST_CHECKSUM: "not-a-checksum",
        }), /marketplace\.invalid_manifest_checksum/);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("marketplace CLI fail-closes when publishing an unsigned community package", () => {
    const workspace = createTempWorkspace("aa-marketplace-security-");
    const dbPath = join(workspace, "marketplace.db");
    try {
        const pkg = JSON.parse(runCli({
            AA_DB_PATH: dbPath,
            AA_MARKETPLACE_ACTION: "register_package",
            AA_EXTENSION_ID: "plugin.community-example",
            AA_PACKAGE_TYPE: "plugin",
            AA_DISPLAY_NAME: "Community Plugin",
            AA_VERSION: "0.1.0",
            AA_OWNER: "community.owner",
            AA_TRUST_LEVEL: "community",
            AA_SOURCE_URI: "registry://plugins/community-example",
            AA_CAPABILITIES_JSON: JSON.stringify(["custom_tool"]),
            AA_PERMISSIONS_JSON: JSON.stringify(["write.workspace"]),
            AA_COMPATIBILITY_JSON: JSON.stringify({
                apiContract: "^1.0.0",
                permissionSurface: "^1.0.0",
                runtimeCapability: "^1.0.0",
            }),
            AA_SIGNATURE_VERIFIED: "false",
            AA_MANIFEST_CHECKSUM: "d".repeat(64),
        }));
        const review = JSON.parse(runCli({
            AA_DB_PATH: dbPath,
            AA_MARKETPLACE_ACTION: "submit_review",
            AA_PACKAGE_ID: pkg.packageId,
            AA_SUBMITTER: "community.owner",
        }));
        runCli({
            AA_DB_PATH: dbPath,
            AA_MARKETPLACE_ACTION: "decide_review",
            AA_REVIEW_ID: review.reviewId,
            AA_REVIEW_STATUS: "approved",
            AA_REVIEWER: "review.board",
            AA_REASON_CODE: "approved_for_publish",
        });
        assert.throws(() => runCli({
            AA_DB_PATH: dbPath,
            AA_MARKETPLACE_ACTION: "publish",
            AA_PACKAGE_ID: pkg.packageId,
            AA_REVIEW_ID: review.reviewId,
        }), /marketplace\.signature_required/);
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=marketplace-governance-boundary.test.js.map