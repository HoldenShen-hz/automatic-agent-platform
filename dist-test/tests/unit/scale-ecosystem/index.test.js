/**
 * Unit tests for ScaleEcosystem barrel exports
 *
 * @see src/scale-ecosystem/index.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import * as scaleEcosystem from "../../../src/scale-ecosystem/index.js";
test("scale-ecosystem barrel exports feedback-loop", () => {
    const keys = Object.keys(scaleEcosystem);
    assert.ok(keys.some(k => k.toLowerCase().includes("feedback")), "should export feedback-loop");
});
test("scale-ecosystem barrel exports runtime-governance-service", () => {
    const keys = Object.keys(scaleEcosystem);
    assert.ok(keys.some(k => k.toLowerCase().includes("runtimegovernance") || k.toLowerCase().includes("runtime")), "should export runtime-governance-service");
});
test("scale-ecosystem barrel exports integration", () => {
    const keys = Object.keys(scaleEcosystem);
    assert.ok(keys.some(k => k.toLowerCase().includes("integration") || k.toLowerCase().includes("connector")), "should export integration");
});
test("scale-ecosystem barrel exports marketplace", () => {
    const keys = Object.keys(scaleEcosystem);
    assert.ok(keys.some(k => k.toLowerCase().includes("marketplace") || k.toLowerCase().includes("billing")), "should export marketplace");
});
test("scale-ecosystem barrel exports multi-region", () => {
    const keys = Object.keys(scaleEcosystem);
    assert.ok(keys.some(k => k.toLowerCase().includes("region") || k.toLowerCase().includes("replication")), "should export multi-region");
});
test("scale-ecosystem barrel exports resource-manager", () => {
    const keys = Object.keys(scaleEcosystem);
    assert.ok(keys.some(k => k.toLowerCase().includes("resource") || k.toLowerCase().includes("fair")), "should export resource-manager");
});
test("scale-ecosystem barrel exports scale-baseline-catalog", () => {
    const keys = Object.keys(scaleEcosystem);
    assert.ok(keys.some(k => k.toLowerCase().includes("scalebaseline") || k.toLowerCase().includes("baseline")), "should export scale-baseline-catalog");
});
test("scale-ecosystem barrel exports scale-bootstrap", () => {
    const keys = Object.keys(scaleEcosystem);
    assert.ok(keys.some(k => k.toLowerCase().includes("scalebootstrap") || k.toLowerCase().includes("bootstrap")), "should export scale-bootstrap");
});
test("scale-ecosystem barrel exports sla-engine", () => {
    const keys = Object.keys(scaleEcosystem);
    assert.ok(keys.some(k => k.toLowerCase().includes("sla")), "should export sla-engine");
});
test("scale-ecosystem barrel has multiple exports", () => {
    const keys = Object.keys(scaleEcosystem);
    assert.ok(keys.length > 5, "should have multiple exports from submodules");
});
//# sourceMappingURL=index.test.js.map