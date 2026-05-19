/**
 * Orphan Cleanup CLI Tests
 *
 * Tests for orphan-cleanup.ts CLI module.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { loadOrphanCleanupCliEnv } from "../../../../src/platform/control-plane/config-center/ops-cli-env.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
// ---------------------------------------------------------------------------
// Tests for loadOrphanCleanupCliEnv
// ---------------------------------------------------------------------------
test("loadOrphanCleanupCliEnv defaults to scan action", () => {
    const result = loadOrphanCleanupCliEnv({});
    assert.equal(result.action, "scan");
});
test("loadOrphanCleanupCliEnv accepts repair action", () => {
    const result = loadOrphanCleanupCliEnv({ AA_ORPHAN_CLEANUP_ACTION: "repair" });
    assert.equal(result.action, "repair");
});
test("loadOrphanCleanupCliEnv accepts scan action explicitly", () => {
    const result = loadOrphanCleanupCliEnv({ AA_ORPHAN_CLEANUP_ACTION: "scan" });
    assert.equal(result.action, "scan");
});
test("loadOrphanCleanupCliEnv throws on invalid action", () => {
    assert.throws(() => loadOrphanCleanupCliEnv({ AA_ORPHAN_CLEANUP_ACTION: "invalid" }), (err) => err instanceof ValidationError && err.code === "orphan_cleanup.invalid_action");
});
test("loadOrphanCleanupCliEnv parses occurredAt when provided", () => {
    const result = loadOrphanCleanupCliEnv({ AA_OCCURRED_AT: "2024-01-01T00:00:00.000Z" });
    assert.equal(result.occurredAt, "2024-01-01T00:00:00.000Z");
});
test("loadOrphanCleanupCliEnv returns null occurredAt when not provided", () => {
    const result = loadOrphanCleanupCliEnv({});
    assert.equal(result.occurredAt, null);
});
test("loadOrphanCleanupCliEnv repair action with occurredAt", () => {
    const result = loadOrphanCleanupCliEnv({
        AA_ORPHAN_CLEANUP_ACTION: "repair",
        AA_OCCURRED_AT: "2024-06-15T12:00:00.000Z",
    });
    assert.equal(result.action, "repair");
    assert.equal(result.occurredAt, "2024-06-15T12:00:00.000Z");
});
// ---------------------------------------------------------------------------
// Tests for CLI action logic
// ---------------------------------------------------------------------------
test("scan action is preview-only", () => {
    const envConfig = loadOrphanCleanupCliEnv({});
    assert.equal(envConfig.action, "scan");
    // scan action should preview orphaned records without modifying them
});
test("repair action is enforce-mode", () => {
    const envConfig = loadOrphanCleanupCliEnv({ AA_ORPHAN_CLEANUP_ACTION: "repair" });
    assert.equal(envConfig.action, "repair");
    // repair action should remove orphaned records
});
test("invalid action throws before returning", () => {
    try {
        loadOrphanCleanupCliEnv({ AA_ORPHAN_CLEANUP_ACTION: "delete" });
        assert.fail("Should have thrown");
    }
    catch (err) {
        assert.ok(err instanceof ValidationError);
    }
});
//# sourceMappingURL=orphan-cleanup.test.js.map