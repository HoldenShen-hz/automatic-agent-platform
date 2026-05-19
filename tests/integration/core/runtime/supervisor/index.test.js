/**
 * Integration tests for Core Runtime supervisor barrel module
 *
 * Tests the full re-export chain from core/runtime/supervisor/index.ts
 * which delegates to platform/execution/execution-engine/multi-step-supervisor.js
 */
import assert from "node:assert/strict";
import test from "node:test";
import { executeStepLoop, buildStepFailureSummary, } from "../../../../../src/core/runtime/supervisor/index.js";
test("supervisor barrel exports executeStepLoop function", () => {
    assert.ok(typeof executeStepLoop === "function", "executeStepLoop should be a function");
});
test("supervisor barrel exports buildStepFailureSummary function", () => {
    assert.ok(typeof buildStepFailureSummary === "function", "buildStepFailureSummary should be a function");
});
test("supervisor barrel module re-exports from multi-step-supervisor", async () => {
    const mod = await import("../../../../../src/core/runtime/supervisor/index.js");
    assert.ok("executeStepLoop" in mod, "Should re-export executeStepLoop");
    assert.ok("buildStepFailureSummary" in mod, "Should re-export buildStepFailureSummary");
});
test("supervisor buildStepFailureSummary builds valid summary string", () => {
    const decision = {
        action: "retry",
        errorCode: "tool.execution_failed",
        failureClass: "transient",
        retryable: true,
        backoff: "exponential",
        retryDelayMs: 1000,
    };
    const result = buildStepFailureSummary("step_1", decision);
    assert.ok(result.includes("step_1"));
    assert.ok(result.includes("retry") || result.includes("tool.execution_failed"));
});
//# sourceMappingURL=index.test.js.map