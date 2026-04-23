import assert from "node:assert/strict";
import test from "node:test";
import { listExecutionCapabilityBaselines, resolveExecutionCapabilityBaseline, } from "../../../../src/platform/execution/execution-plane-baseline.js";
test("execution plane baseline covers execution entry modules", () => {
    const baselines = listExecutionCapabilityBaselines();
    assert.equal(baselines.length, 14);
    assert.ok(resolveExecutionCapabilityBaseline("lease").baselineServices.includes("ExecutionLeaseService"));
    assert.ok(resolveExecutionCapabilityBaseline("worker-pool").entryModule.endsWith("/worker-pool/index.ts"));
});
//# sourceMappingURL=execution-plane-baseline.test.js.map