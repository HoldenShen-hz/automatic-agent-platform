import assert from "node:assert/strict";
import test from "node:test";
import { isToolCallSuccessful, } from "../../../../../src/platform/execution/tool-executor/tool-call-result.js";
test("isToolCallSuccessful returns true for succeeded status", () => {
    assert.equal(isToolCallSuccessful("succeeded"), true);
});
test("isToolCallSuccessful returns false for failed status", () => {
    assert.equal(isToolCallSuccessful("failed"), false);
});
test("isToolCallSuccessful returns false for timed_out status", () => {
    assert.equal(isToolCallSuccessful("timed_out"), false);
});
test("isToolCallSuccessful returns false for blocked status", () => {
    assert.equal(isToolCallSuccessful("blocked"), false);
});
test("isToolCallSuccessful returns false for cancelled status", () => {
    assert.equal(isToolCallSuccessful("cancelled"), false);
});
test("ToolCallStatus type accepts all valid values", () => {
    const statuses = ["succeeded", "failed", "timed_out", "blocked", "cancelled"];
    assert.equal(statuses.length, 5);
});
test("ToolCallErrorSource type accepts all valid values", () => {
    const sources = ["provider", "tool", "network", "security", "validation", "system"];
    assert.equal(sources.length, 6);
});
test("ToolCallError type accepts valid structure", () => {
    const error = {
        code: "test.error",
        message: "Test error message",
        retryable: true,
        source: "tool",
    };
    assert.equal(error.code, "test.error");
    assert.equal(error.retryable, true);
    assert.equal(error.source, "tool");
});
test("ToolCallError type accepts optional details", () => {
    const error = {
        code: "test.error",
        message: "Test error message",
        retryable: false,
        source: "validation",
        details: { field: "name", reason: "required" },
    };
    assert.deepEqual(error.details, { field: "name", reason: "required" });
});
//# sourceMappingURL=tool-call-result.test.js.map