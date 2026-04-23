import assert from "node:assert/strict";
import test from "node:test";
import { listOrchestrationCapabilityBaselines, resolveOrchestrationCapabilityBaseline, } from "../../../../src/platform/orchestration/orchestration-plane-baseline.js";
test("orchestration plane baseline covers orchestration entry modules", () => {
    const baselines = listOrchestrationCapabilityBaselines();
    assert.equal(baselines.length, 8);
    assert.ok(resolveOrchestrationCapabilityBaseline("harness").baselineServices.includes("HarnessRuntimeService"));
    assert.ok(resolveOrchestrationCapabilityBaseline("oapeflir").entryModule.endsWith("/oapeflir/index.ts"));
});
//# sourceMappingURL=orchestration-plane-baseline.test.js.map