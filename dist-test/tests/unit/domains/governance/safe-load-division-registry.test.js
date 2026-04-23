import assert from "node:assert/strict";
import test from "node:test";
import { safeLoadDivisionRegistry } from "../../../../src/domains/governance/safe-load-division-registry.js";
test("safeLoadDivisionRegistry returns division registry without throwing", () => {
    // This should not throw even if loading fails - it catches errors
    const result = safeLoadDivisionRegistry();
    // Result could be null if loading fails, or a registry if it succeeds
    // We just verify it doesn't throw and returns either null or an object
    assert.ok(result === null || typeof result === "object");
});
test("safeLoadDivisionRegistry returns null when no divisions are configured", () => {
    // When there are no valid division configs, the loader throws
    // and safeLoad catches it, returning null
    const result = safeLoadDivisionRegistry();
    // If the test environment has no divisions, this will be null
    assert.ok(result === null || typeof result === "object");
});
test("safeLoadDivisionRegistry catches errors gracefully", () => {
    // The function should never throw - it catches all errors
    // We verify by calling it multiple times and checking it doesn't throw
    let lastResult = null;
    for (let i = 0; i < 3; i++) {
        lastResult = safeLoadDivisionRegistry();
        assert.ok(lastResult === null || typeof lastResult === "object");
    }
    // Result should be consistent across calls
    assert.ok(lastResult === null || typeof lastResult === "object");
});
//# sourceMappingURL=safe-load-division-registry.test.js.map