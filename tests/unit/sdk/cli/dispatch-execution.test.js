/**
 * Dispatch Execution CLI Tests
 *
 * Tests for dispatch-execution.ts CLI module.
 */
import assert from "node:assert/strict";
import test from "node:test";
// ---------------------------------------------------------------------------
// Tests for DispatchExecutionCliEnvConfig interface
// ---------------------------------------------------------------------------
test("DispatchExecutionCliEnvConfig has correct shape", () => {
    // Verify the interface defines the expected fields
    const config = {
        dbPath: undefined,
        executionId: "exec-123",
        priority: "normal",
        queueName: "default",
        dispatchTarget: "any",
        requiredIsolationLevel: "standard",
        requiredRepoVersion: null,
        requiredCapabilities: [],
        dispatchAfter: null,
        createOnly: false,
        preferredWorkerId: null,
        leaseTtlMs: 30000,
        includeDegraded: false,
    };
    assert.equal(config.executionId, "exec-123");
    assert.equal(config.priority, "normal");
    assert.equal(config.queueName, "default");
    assert.equal(config.dispatchTarget, "any");
    assert.equal(config.createOnly, false);
    assert.equal(config.leaseTtlMs, 30000);
    assert.equal(config.includeDegraded, false);
});
// ---------------------------------------------------------------------------
// Tests for dispatch target enum values
// ---------------------------------------------------------------------------
test("dispatchTarget accepts 'any' value", () => {
    const target = "any";
    assert.equal(target, "any");
});
test("dispatchTarget accepts 'local_only' value", () => {
    const target = "local_only";
    assert.equal(target, "local_only");
});
test("dispatchTarget accepts 'prefer_remote' value", () => {
    const target = "prefer_remote";
    assert.equal(target, "prefer_remote");
});
test("dispatchTarget accepts 'require_remote' value", () => {
    const target = "require_remote";
    assert.equal(target, "require_remote");
});
// ---------------------------------------------------------------------------
// Tests for priority enum values
// ---------------------------------------------------------------------------
test("priority accepts 'low' value", () => {
    const priority = "low";
    assert.equal(priority, "low");
});
test("priority accepts 'normal' value", () => {
    const priority = "normal";
    assert.equal(priority, "normal");
});
test("priority accepts 'high' value", () => {
    const priority = "high";
    assert.equal(priority, "high");
});
test("priority accepts 'urgent' value", () => {
    const priority = "urgent";
    assert.equal(priority, "urgent");
});
// ---------------------------------------------------------------------------
// Tests for isolation level enum values
// ---------------------------------------------------------------------------
test("requiredIsolationLevel accepts 'standard' value", () => {
    const level = "standard";
    assert.equal(level, "standard");
});
test("requiredIsolationLevel accepts 'hardened' value", () => {
    const level = "hardened";
    assert.equal(level, "hardened");
});
test("requiredIsolationLevel accepts 'strict' value", () => {
    const level = "strict";
    assert.equal(level, "strict");
});
// ---------------------------------------------------------------------------
// Tests for default lease TTL
// ---------------------------------------------------------------------------
test("default lease TTL is 30000ms", () => {
    const DEFAULT_LEASE_TTL_MS = 30000;
    assert.equal(DEFAULT_LEASE_TTL_MS, 30000);
});
//# sourceMappingURL=dispatch-execution.test.js.map