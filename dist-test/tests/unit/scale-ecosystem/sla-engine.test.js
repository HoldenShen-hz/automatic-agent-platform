/**
 * Unit tests for SLAEngine barrel exports
 *
 * @see src/scale-ecosystem/sla-engine/index.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import * as slaEngine from "../../../src/scale-ecosystem/sla-engine/index.js";
test("sla-engine barrel exports breach-detector", () => {
    const keys = Object.keys(slaEngine);
    assert.ok(keys.some(k => k.toLowerCase().includes("breach")), "should export breach-detector");
});
test("sla-engine barrel exports resource allocation functions", () => {
    const keys = Object.keys(slaEngine);
    assert.ok(keys.some(k => k.toLowerCase().includes("allocate") || k.toLowerCase().includes("reserved")), "should export resource allocation functions");
});
test("sla-engine barrel exports sla-operations-service", () => {
    const keys = Object.keys(slaEngine);
    assert.ok(keys.some(k => k.toLowerCase().includes("slaoperations") || k.toLowerCase().includes("operations")), "should export sla-operations-service");
});
test("sla-engine barrel exports tier-resolver", () => {
    const keys = Object.keys(slaEngine);
    assert.ok(keys.some(k => k.toLowerCase().includes("tier")), "should export tier-resolver");
});
test("sla-engine barrel has multiple exports", () => {
    const keys = Object.keys(slaEngine);
    assert.ok(keys.length >= 3, "should have multiple exports (breach, allocator, tier)");
});
//# sourceMappingURL=sla-engine.test.js.map