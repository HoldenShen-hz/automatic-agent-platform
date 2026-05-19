// @ts-nocheck
/**
 * Tests for marketplace human-takeover-service re-export
 *
 * Verifies the re-export from runtime-services works correctly.
 */
import assert from "node:assert/strict";
import test from "node:test";
import * as HumanTakeoverService from "../../../../src/scale-ecosystem/marketplace/human-takeover-service.js";
test("human-takeover-service exports HumanTakeoverService", () => {
    assert.ok(HumanTakeoverService.HumanTakeoverService !== undefined);
});
//# sourceMappingURL=human-takeover-service.test.js.map