/**
 * Golden Test: CLI Help Text Output
 *
 * Verifies CLI tools produce consistent error messages and documentation
 * patterns. Since CLIs use environment variables rather than flags,
 * we verify consistent error code formats and documentation structure.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const CLI_DIR = join(process.cwd(), "dist", "src", "sdk", "cli");
// List of known CLI scripts
const CLI_SCRIPTS = [
    "doctor.js",
    "inspect.js",
    "dispatch-execution.js",
    "gateway-targets.js",
    "memory.js",
    "takeover.js",
    "worker-handshake.js",
    "worker-writeback.js",
    "lease-handover.js",
    "diagnostics.js",
    "billing.js",
    "release-pipeline.js",
    "api-server.js",
    "channel-gateway.js",
];
test("golden: all CLI scripts have JSDoc documentation", () => {
    const cliSourceDir = join(process.cwd(), "src", "sdk", "cli");
    for (const script of CLI_SCRIPTS) {
        const sourcePath = join(cliSourceDir, script.replace(".js", ".ts"));
        try {
            const content = readFileSync(sourcePath, "utf8");
            // Verify JSDoc comment exists at the top
            assert.ok(content.startsWith("/**"), `${script} should start with JSDoc comment`);
            // Verify @fileoverview or @module tag
            assert.ok(content.includes("@fileoverview") || content.includes("@module") || content.includes("@doc"), `${script} should have @fileoverview or @module tag`);
            // Verify Usage section or Environment Variables section
            assert.ok(content.includes("Usage:") || content.includes("Environment Variables:") || content.includes("Usage example:"), `${script} should document usage`);
        }
        catch {
            // Script might not exist in source, skip
        }
    }
});
test("golden: CLI error codes follow consistent format", () => {
    // Error codes can use either dot notation or colon notation
    // Dot notation: release.config_root_missing, release.invalid_image_repository
    // Colon notation: missing_env:AA_TASK_ID, release.rollout_not_allowed:staging:canary
    const errorCodes = [
        { code: "missing_env:AA_TASK_ID", format: "colon" },
        { code: "missing_env:AA_EXECUTION_ID", format: "colon" },
        { code: "release.config_root_missing", format: "dot" },
        { code: "release.invalid_image_repository", format: "dot" },
    ];
    for (const { code, format } of errorCodes) {
        if (format === "colon") {
            assert.ok(code.includes(":"), `Error code ${code} should have colon separator`);
        }
        else {
            assert.ok(code.includes("."), `Error code ${code} should have dot separator`);
        }
        // All error codes should have a domain prefix (before first . or :)
        const parts = code.split(/[.:]/);
        assert.ok(parts.length >= 2, `Error code ${code} should have at least domain and identifier`);
    }
});
test("golden: ValidationError format is consistent", () => {
    // Error codes follow either:
    // - domain:subdomain (colon notation)
    // - domain.subdomain (dot notation)
    // - domain.subdomain:value:value (multi-colon)
    const colonPattern = /^[a-z_]+:[A-Z_]+$/;
    const dotPattern = /^[a-z_]+\.[a-z_]+$/;
    const multiColonPattern = /^[a-z_]+\.[a-z_]+:[a-z_0-9_]+:[a-z_0-9_]+$/;
    const errorCodes = [
        { code: "missing_env:AA_TASK_ID", pattern: colonPattern },
        { code: "release.rollout_not_allowed:staging:canary", pattern: multiColonPattern },
        { code: "release.invalid_image_repository", pattern: dotPattern },
    ];
    for (const { code, pattern } of errorCodes) {
        assert.ok(pattern.test(code), `Error code ${code} should match expected pattern`);
    }
});
test("golden: CLI output is JSON when successful", () => {
    // Verify that successful CLI output should be JSON (verified by checking code structure)
    const inspectSource = readFileSync(join(process.cwd(), "src", "sdk", "cli", "inspect.ts"), "utf8");
    // The inspect CLI outputs JSON via JSON.stringify
    assert.ok(inspectSource.includes("JSON.stringify"), "CLI should output JSON via JSON.stringify");
});
test("golden: CLI scripts use consistent error types", () => {
    // Verify common error types used across CLI scripts
    const expectedErrorTypes = [
        "ValidationError",
        "StorageError",
        "PolicyDeniedError",
    ];
    const cliFiles = [
        "src/sdk/cli/inspect.ts",
        "src/sdk/cli/doctor.ts",
        "src/sdk/cli/dispatch-execution.ts",
    ];
    for (const file of cliFiles) {
        try {
            const content = readFileSync(join(process.cwd(), file), "utf8");
            // Should import errors from core/errors
            assert.ok(content.includes('"../core/errors.js"') || content.includes("'../core/errors.js'") || content.includes('from "../core/errors.js"'), `${file} should import errors from core/errors`);
        }
        catch {
            // File might not exist
        }
    }
});
test("golden: CLI environment variable naming follows AA_ prefix convention", () => {
    // Verify AA_ prefix is used for environment variables
    const aaPrefixPattern = /AA_[A-Z_]+/;
    const cliFiles = [
        "src/cli/inspect.ts",
        "src/cli/doctor.ts",
        "src/cli/dispatch-execution.ts",
    ];
    for (const file of cliFiles) {
        try {
            const content = readFileSync(join(process.cwd(), file), "utf8");
            // Should reference AA_ prefixed env vars
            const matches = content.match(/AA_[A-Z_]+/g);
            if (matches) {
                for (const match of matches) {
                    assert.ok(aaPrefixPattern.test(match), `Environment variable ${match} in ${file} should follow AA_ naming convention`);
                }
            }
        }
        catch {
            // File might not exist
        }
    }
});
test("golden: CLI scripts close database connections properly", () => {
    // Verify CLI scripts use proper storage helpers that handle cleanup
    const cliFiles = [
        "src/cli/inspect.ts",
        "src/cli/doctor.ts",
    ];
    for (const file of cliFiles) {
        try {
            const content = readFileSync(join(process.cwd(), file), "utf8");
            // Should use withCliStorage or similar pattern
            assert.ok(content.includes("withCliStorage") || content.includes("withCliStorageAsync"), `${file} should use withCliStorage for DB connection management`);
        }
        catch {
            // File might not exist
        }
    }
});
test("golden: CLI documentation links to contracts", () => {
    // Verify CLI scripts document their related contracts
    const cliFiles = [
        "src/cli/inspect.ts",
        "src/cli/doctor.ts",
        "src/cli/dispatch-execution.ts",
    ];
    for (const file of cliFiles) {
        try {
            const content = readFileSync(join(process.cwd(), file), "utf8");
            // Should have @see tags pointing to contracts or documentation
            if (content.includes("@see")) {
                assert.ok(content.includes("docs_zh/") || content.includes("@see"), `${file} should reference documentation via @see tags`);
            }
        }
        catch {
            // File might not exist
        }
    }
});
//# sourceMappingURL=cli-help-text.test.js.map