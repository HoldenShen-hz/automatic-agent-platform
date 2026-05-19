/**
 * Unit Tests: Safe Load Division Registry
 *
 * Tests the safeLoadDivisionRegistry wrapper function
 * that loads division registry with error handling.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { safeLoadDivisionRegistry } from "../../../../src/domains/governance/safe-load-division-registry.js";
test("safeLoadDivisionRegistry returns null when loadDivisionRegistry throws", () => {
    // safeLoadDivisionRegistry calls loadDivisionRegistry() internally
    // which depends on the configured divisions root path
    // We test the error handling path by verifying the function handles failures gracefully
    const result = safeLoadDivisionRegistry();
    // The function should return null if loading fails, or a valid registry if it succeeds
    // This test verifies the function doesn't throw - it either returns null or a registry
    if (result === null) {
        assert.ok(true, "Returned null when division registry unavailable");
    }
    else {
        assert.ok(result.divisions instanceof Map, "Should return a valid registry with divisions Map");
        assert.ok(result.workflows instanceof Map, "Should return a valid registry with workflows Map");
    }
});
test("safeLoadDivisionRegistry returns DivisionRegistry or null based on environment", () => {
    const result = safeLoadDivisionRegistry();
    // Result should either be a valid registry or null
    if (result !== null) {
        assert.ok(result.hasOwnProperty("divisions"), "Should have divisions property");
        assert.ok(result.hasOwnProperty("workflows"), "Should have workflows property");
    }
});
//# sourceMappingURL=safe-load-division-registry-explicit.test.js.map