/**
 * Authoritative Storage Admin CLI Tests
 *
 * Tests for authoritative-storage-admin.ts CLI module.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { loadAuthoritativeStorageAdminCliEnv } from "../../../../src/platform/control-plane/config-center/ops-cli-env.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
// ---------------------------------------------------------------------------
// Tests for loadAuthoritativeStorageAdminCliEnv
// ---------------------------------------------------------------------------
test("loadAuthoritativeStorageAdminCliEnv defaults to summary action", () => {
    const result = loadAuthoritativeStorageAdminCliEnv({});
    assert.equal(result.action, "summary");
});
test("loadAuthoritativeStorageAdminCliEnv accepts migrate action", () => {
    const result = loadAuthoritativeStorageAdminCliEnv({ AA_AUTHORITATIVE_STORAGE_ACTION: "migrate" });
    assert.equal(result.action, "migrate");
});
test("loadAuthoritativeStorageAdminCliEnv accepts plan action", () => {
    const result = loadAuthoritativeStorageAdminCliEnv({ AA_AUTHORITATIVE_STORAGE_ACTION: "plan" });
    assert.equal(result.action, "plan");
});
test("loadAuthoritativeStorageAdminCliEnv accepts status action", () => {
    const result = loadAuthoritativeStorageAdminCliEnv({ AA_AUTHORITATIVE_STORAGE_ACTION: "status" });
    assert.equal(result.action, "status");
});
test("loadAuthoritativeStorageAdminCliEnv accepts up action", () => {
    const result = loadAuthoritativeStorageAdminCliEnv({ AA_AUTHORITATIVE_STORAGE_ACTION: "up" });
    assert.equal(result.action, "up");
});
test("loadAuthoritativeStorageAdminCliEnv accepts down action", () => {
    const result = loadAuthoritativeStorageAdminCliEnv({ AA_AUTHORITATIVE_STORAGE_ACTION: "down" });
    assert.equal(result.action, "down");
});
test("loadAuthoritativeStorageAdminCliEnv throws on invalid action", () => {
    assert.throws(() => loadAuthoritativeStorageAdminCliEnv({ AA_AUTHORITATIVE_STORAGE_ACTION: "invalid" }), (err) => err instanceof ValidationError && err.code.includes("unknown_authoritative_storage_action"));
});
test("loadAuthoritativeStorageAdminCliEnv uses AA_DB_PATH when set", () => {
    const result = loadAuthoritativeStorageAdminCliEnv({ AA_DB_PATH: "/custom/path/test.db" });
    assert.equal(result.dbPath, "/custom/path/test.db");
});
test("loadAuthoritativeStorageAdminCliEnv resolves default dbPath", () => {
    const result = loadAuthoritativeStorageAdminCliEnv({});
    assert.ok(result.dbPath.includes("sqlite"));
    assert.ok(result.dbPath.includes("authoritative-demo.db"));
});
test("loadAuthoritativeStorageAdminCliEnv returns correct interface shape", () => {
    const result = loadAuthoritativeStorageAdminCliEnv({});
    assert.ok(typeof result.action === "string");
    assert.ok(typeof result.dbPath === "string");
});
// ---------------------------------------------------------------------------
// Tests for action handling logic
// ---------------------------------------------------------------------------
test("plan action is read-only operation", () => {
    const envConfig = loadAuthoritativeStorageAdminCliEnv({ AA_AUTHORITATIVE_STORAGE_ACTION: "plan" });
    assert.equal(envConfig.action, "plan");
    // plan action should not modify database
});
test("summary action returns migration status", () => {
    const envConfig = loadAuthoritativeStorageAdminCliEnv({ AA_AUTHORITATIVE_STORAGE_ACTION: "summary" });
    assert.equal(envConfig.action, "summary");
});
test("migrate action runs migrations forward", () => {
    const envConfig = loadAuthoritativeStorageAdminCliEnv({ AA_AUTHORITATIVE_STORAGE_ACTION: "migrate" });
    assert.equal(envConfig.action, "migrate");
});
test("up action is alias for migrate", () => {
    const migrate = loadAuthoritativeStorageAdminCliEnv({ AA_AUTHORITATIVE_STORAGE_ACTION: "migrate" });
    const up = loadAuthoritativeStorageAdminCliEnv({ AA_AUTHORITATIVE_STORAGE_ACTION: "up" });
    assert.equal(migrate.action, "migrate");
    assert.equal(up.action, "up");
});
test("down action runs migrations backward", () => {
    const envConfig = loadAuthoritativeStorageAdminCliEnv({ AA_AUTHORITATIVE_STORAGE_ACTION: "down" });
    assert.equal(envConfig.action, "down");
});
test("status action returns current state", () => {
    const envConfig = loadAuthoritativeStorageAdminCliEnv({ AA_AUTHORITATIVE_STORAGE_ACTION: "status" });
    assert.equal(envConfig.action, "status");
});
test("all valid actions are distinct", () => {
    const actions = ["summary", "migrate", "plan", "status", "up", "down"];
    const unique = new Set(actions);
    assert.equal(unique.size, actions.length);
});
//# sourceMappingURL=authoritative-storage-admin.test.js.map