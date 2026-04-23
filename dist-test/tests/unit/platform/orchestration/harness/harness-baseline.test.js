import assert from "node:assert/strict";
import test from "node:test";
import * as harnessModule from "../../../../../src/platform/orchestration/harness/index.js";
import { HARNESS_CAPABILITY_BASELINES, listHarnessCapabilityBaselines, resolveHarnessCapabilityBaseline, } from "../../../../../src/platform/orchestration/harness/harness-baseline.js";
test("harness baseline covers phase 8a-8c orchestration services", () => {
    const baselines = listHarnessCapabilityBaselines();
    assert.deepEqual(baselines.map((item) => item.capabilityId), ["constraint-pack", "planner-generator-evaluator-loop", "hitl", "governance"]);
    assert.equal(resolveHarnessCapabilityBaseline("governance").entryModule, "src/platform/orchestration/harness/index.ts");
});
test("harness baseline service names resolve from the canonical harness entry", () => {
    for (const baseline of listHarnessCapabilityBaselines()) {
        for (const serviceName of baseline.baselineServices) {
            assert.equal(serviceName in harnessModule, true, `expected ${serviceName} to be exported by ${baseline.entryModule}`);
        }
    }
});
test("listHarnessCapabilityBaselines returns frozen array with all capability baselines", () => {
    const baselines = listHarnessCapabilityBaselines();
    assert.equal(Array.isArray(baselines), true);
    assert.equal(baselines.length, 4);
    // The array itself is frozen (Object.freeze on the const)
    assert.equal(Object.isFrozen(baselines), true);
    // The returned array is the same frozen reference as HARNESS_CAPABILITY_BASELINES
    assert.equal(baselines, HARNESS_CAPABILITY_BASELINES);
});
test("HARNESS_CAPABILITY_BASELINES contains all expected capability IDs", () => {
    const expectedIds = ["constraint-pack", "planner-generator-evaluator-loop", "hitl", "governance"];
    assert.equal(HARNESS_CAPABILITY_BASELINES.length, expectedIds.length);
    for (const id of expectedIds) {
        assert.equal(HARNESS_CAPABILITY_BASELINES.some(b => b.capabilityId === id), true);
    }
});
test("each capability baseline has valid entryModule and description", () => {
    for (const baseline of HARNESS_CAPABILITY_BASELINES) {
        assert.ok(baseline.entryModule.startsWith("src/"));
        assert.ok(baseline.description.length > 0);
        assert.ok(baseline.baselineServices.length > 0);
    }
});
test("resolveHarnessCapabilityBaseline returns correct baseline for each capabilityId", () => {
    const constraintPack = resolveHarnessCapabilityBaseline("constraint-pack");
    assert.equal(constraintPack.capabilityId, "constraint-pack");
    assert.equal(constraintPack.entryModule, "src/platform/orchestration/harness/index.ts");
    assert.deepEqual(constraintPack.baselineServices, ["HarnessRuntimeService"]);
    const loop = resolveHarnessCapabilityBaseline("planner-generator-evaluator-loop");
    assert.equal(loop.capabilityId, "planner-generator-evaluator-loop");
    const hitl = resolveHarnessCapabilityBaseline("hitl");
    assert.equal(hitl.capabilityId, "hitl");
    const governance = resolveHarnessCapabilityBaseline("governance");
    assert.equal(governance.capabilityId, "governance");
});
test("resolveHarnessCapabilityBaseline throws for unknown capabilityId", () => {
    assert.throws(() => resolveHarnessCapabilityBaseline("unknown-capability"), /harness_capability\.not_found/);
});
test("resolveHarnessCapabilityBaseline throws with correct error message", () => {
    try {
        resolveHarnessCapabilityBaseline("invalid-id");
        assert.fail("expected error to be thrown");
    }
    catch (err) {
        assert.ok(err instanceof Error);
        assert.equal(err.message, "harness_capability.not_found:invalid-id");
    }
});
//# sourceMappingURL=harness-baseline.test.js.map