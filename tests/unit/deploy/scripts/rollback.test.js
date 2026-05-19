import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "fs";
const ROLLBACK_SCRIPT_PATH = "deploy/scripts/rollback.sh";
test("rollback script exists and is executable", () => {
    assert.ok(existsSync(ROLLBACK_SCRIPT_PATH), `Rollback script should exist at ${ROLLBACK_SCRIPT_PATH}`);
    const content = readFileSync(ROLLBACK_SCRIPT_PATH, "utf-8");
    assert.ok(content.includes("#!/usr/bin/env bash"), "Script should have bash shebang");
    assert.ok(content.includes("set -euo pipefail"), "Script should use strict error handling");
});
test("rollback script supports --dry-run option", () => {
    const content = readFileSync(ROLLBACK_SCRIPT_PATH, "utf-8");
    assert.ok(content.includes("--dry-run") || content.includes('"${DRY_RUN:-false}"'), "Script should support --dry-run option");
    assert.ok(content.includes("[DRY RUN]"), "Script should output DRY RUN message when in dry-run mode");
});
test("rollback script has usage documentation", () => {
    const content = readFileSync(ROLLBACK_SCRIPT_PATH, "utf-8");
    assert.ok(content.includes("Usage:"), "Script should have usage documentation");
    assert.ok(content.includes("environment"), "Usage should document environment argument");
    assert.ok(content.includes("revision"), "Usage should document revision argument");
});
test("rollback script validates environment argument", () => {
    const content = readFileSync(ROLLBACK_SCRIPT_PATH, "utf-8");
    assert.ok(content.includes("dev"), "Should support dev environment");
    assert.ok(content.includes("staging"), "Should support staging environment");
    assert.ok(content.includes("prod"), "Should support prod environment");
});
test("rollback script has logging functions", () => {
    const content = readFileSync(ROLLBACK_SCRIPT_PATH, "utf-8");
    assert.ok(content.includes("info()"), "Should have info logging function");
    assert.ok(content.includes("warn()"), "Should have warn logging function");
    assert.ok(content.includes("error()"), "Should have error logging function");
    assert.ok(content.includes("[INFO]"), "Should have INFO prefix");
    assert.ok(content.includes("[WARN]"), "Should have WARN prefix");
    assert.ok(content.includes("[ERROR]"), "Should have ERROR prefix");
});
test("rollback script checks for helm dependency", () => {
    const content = readFileSync(ROLLBACK_SCRIPT_PATH, "utf-8");
    assert.ok(content.includes("command -v helm"), "Should check for helm installation");
    assert.ok(content.includes("Helm is not installed"), "Should error if helm not found");
});
test("rollback script uses helm rollback command", () => {
    const content = readFileSync(ROLLBACK_SCRIPT_PATH, "utf-8");
    assert.ok(content.includes('"rollback"'), "Should use helm rollback command");
    assert.ok(content.includes("automatic-agent"), "Should rollback automatic-agent release");
    assert.ok(content.includes("--namespace"), "Should specify namespace");
    assert.ok(content.includes("--wait"), "Should wait for rollback");
    assert.ok(content.includes("--timeout"), "Should have timeout");
});
test("rollback script waits for rollout status", () => {
    const content = readFileSync(ROLLBACK_SCRIPT_PATH, "utf-8");
    assert.ok(content.includes("kubectl rollout status"), "Should wait for rollout status");
    assert.ok(content.includes("deployment/"), "Should check deployment status");
    assert.ok(content.includes("timeout"), "Should have timeout");
});
test("rollback script gets current revision before rollback", () => {
    const content = readFileSync(ROLLBACK_SCRIPT_PATH, "utf-8");
    assert.ok(content.includes("helm history"), "Should get helm history");
    assert.ok(content.includes("CURRENT_REVISION") || content.includes("revision"), "Should track current revision");
    assert.ok(content.includes(".status==\"deployed\""), "Should find deployed revision");
});
test("rollback script supports revision argument", () => {
    const content = readFileSync(ROLLBACK_SCRIPT_PATH, "utf-8");
    assert.ok(content.includes("REVISION"), "Should handle revision argument");
    assert.ok(content.includes('"${2:-0}"') || content.includes('${REVISION}'), "Should default to 0 (previous) if no revision specified");
});
test("rollback script uses correct namespace format", () => {
    const content = readFileSync(ROLLBACK_SCRIPT_PATH, "utf-8");
    assert.ok(content.includes("automatic-agent-"), "Should use namespace prefix");
    assert.ok(content.includes("NAMESPACE="), "Should define namespace variable");
});
//# sourceMappingURL=rollback.test.js.map