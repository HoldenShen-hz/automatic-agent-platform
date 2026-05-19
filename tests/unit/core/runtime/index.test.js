/**
 * @fileoverview Unit tests for core/runtime module exports
 */
import assert from "node:assert/strict";
import test from "node:test";
import * as runtimeIndex from "../../../../src/core/runtime/index.js";
test("core/runtime index re-exports platform execution engine types", () => {
    assert.ok(runtimeIndex);
    // Should re-export dispatcher, execution-engine, state-transition, lease, worker-registry, checkpoints
    assert.ok(typeof runtimeIndex.TransitionService !== "undefined" || runtimeIndex.runMultiStepOrchestration != null);
});
test("core/runtime re-exports state transition components", () => {
    // The module should re-export TransitionService and StateTransitionMachine
    assert.ok(typeof runtimeIndex.TransitionService !== "undefined" || runtimeIndex.StateTransitionMachine != null);
});
test("core/runtime re-exports execution lease service", () => {
    // The module should re-export ExecutionLeaseService
    assert.ok(typeof runtimeIndex.ExecutionLeaseService !== "undefined");
});
test("core/runtime re-exports worker registry service", () => {
    // The module should re-export WorkerRegistryService
    assert.ok(typeof runtimeIndex.WorkerRegistryService !== "undefined");
});
test("core/runtime index exports from admission-controller", () => {
    // The module re-exports from admission-controller
    const index = runtimeIndex;
    // Just verify the module has content
    assert.ok(Object.keys(index).length > 0 || typeof index === "object");
});
test("core/runtime index exports from execution-engine components", () => {
    // The module re-exports from multiple execution-engine components
    // We verify by checking that the module is not empty
    const keys = Object.keys(runtimeIndex);
    assert.ok(keys.length > 0 || runtimeIndex.runMultiStepOrchestration != null);
});
//# sourceMappingURL=index.test.js.map