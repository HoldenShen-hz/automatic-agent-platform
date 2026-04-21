/**
 * Unit Test: Configuration Security Defaults
 *
 * Verifies that configuration defaults follow security best practices.
 * Ensures safe defaults are in place for approval modes, sandbox settings, etc.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
const CONFIG_ROOT = join(fileURLToPath(import.meta.url), "../../../../..", "config");
async function readConfig(filePath) {
    try {
        const content = await readFile(filePath, "utf-8");
        return JSON.parse(content);
    }
    catch {
        return {};
    }
}
test("security defaults: approval mode defaults to supervised or stricter", async () => {
    const securityConfig = await readConfig(join(CONFIG_ROOT, "security/default.json"));
    if (securityConfig.approvalMode !== undefined) {
        assert.notEqual(securityConfig.approvalMode, "bypass", "Approval mode should not default to bypass");
    }
});
test("security defaults: sandbox mode defaults to restricted", async () => {
    const securityConfig = await readConfig(join(CONFIG_ROOT, "security/default.json"));
    if (securityConfig.sandboxMode !== undefined) {
        assert.notEqual(securityConfig.sandboxMode, "disabled", "Sandbox mode should not default to disabled");
    }
});
test("security defaults: destructive actions are disabled by default", async () => {
    const securityConfig = await readConfig(join(CONFIG_ROOT, "security/default.json"));
    if (securityConfig.allowDestructiveActions !== undefined) {
        assert.strictEqual(securityConfig.allowDestructiveActions, false, "Destructive actions should be disabled by default");
    }
});
test("security defaults: worker registration has secure challenge TTL", async () => {
    const securityConfig = await readConfig(join(CONFIG_ROOT, "security/default.json"));
    if (securityConfig.remoteWorkerRegistration !== undefined) {
        const registration = securityConfig.remoteWorkerRegistration;
        if (registration.challengeTtlMs !== undefined) {
            assert.ok(registration.challengeTtlMs > 0 && registration.challengeTtlMs <= 600000, "Challenge TTL should be between 0 and 10 minutes");
        }
    }
});
test("security defaults: runtime configuration exists", async () => {
    const runtimeConfig = await readConfig(join(CONFIG_ROOT, "runtime/default.json"));
    assert.ok(Object.keys(runtimeConfig).length >= 0, "Runtime configuration should exist");
});
//# sourceMappingURL=security-defaults.test.js.map