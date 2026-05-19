import assert from "node:assert/strict";
import test from "node:test";
import { executeAgentRoundLoop, buildStepOutput, parseStepOutput, fallbackStepOutput, parseOptionalPositiveInteger, parseOptionalStringArray, resolveMultiStepToolPath, safeParseToolResult, } from "../../../../../src/core/runtime/planner/index.js";
test("core/runtime/planner shim exports executeAgentRoundLoop", () => {
    assert.equal(typeof executeAgentRoundLoop, "function", "executeAgentRoundLoop should be a function");
});
test("core/runtime/planner shim exports buildStepOutput", () => {
    assert.equal(typeof buildStepOutput, "function", "buildStepOutput should be a function");
});
test("core/runtime/planner shim exports parseStepOutput", () => {
    assert.equal(typeof parseStepOutput, "function", "parseStepOutput should be a function");
});
test("core/runtime/planner shim exports fallbackStepOutput", () => {
    assert.equal(typeof fallbackStepOutput, "function", "fallbackStepOutput should be a function");
});
test("core/runtime/planner shim exports parseOptionalPositiveInteger", () => {
    assert.equal(typeof parseOptionalPositiveInteger, "function", "parseOptionalPositiveInteger should be a function");
});
test("core/runtime/planner shim exports parseOptionalStringArray", () => {
    assert.equal(typeof parseOptionalStringArray, "function", "parseOptionalStringArray should be a function");
});
test("core/runtime/planner shim exports resolveMultiStepToolPath", () => {
    assert.equal(typeof resolveMultiStepToolPath, "function", "resolveMultiStepToolPath should be a function");
});
test("core/runtime/planner shim exports safeParseToolResult", () => {
    assert.equal(typeof safeParseToolResult, "function", "safeParseToolResult should be a function");
});
test("core/runtime/planner shim re-exports same implementation as platform", async () => {
    const shim = await import("../../../../../src/core/runtime/planner/index.js");
    const platform = await import("../../../../../src/platform/execution/execution-engine/multi-step-agent-round-loop.js");
    assert.equal(shim.executeAgentRoundLoop, platform.executeAgentRoundLoop, "executeAgentRoundLoop should point to platform implementation");
    assert.equal(shim.buildStepOutput, platform.buildStepOutput, "buildStepOutput should point to platform implementation");
});
test("parseOptionalPositiveInteger returns value for valid positive integers", () => {
    assert.equal(parseOptionalPositiveInteger(1), 1);
    assert.equal(parseOptionalPositiveInteger(42), 42);
    assert.equal(parseOptionalPositiveInteger(1000), 1000);
});
test("parseOptionalPositiveInteger returns undefined for non-positive numbers", () => {
    assert.equal(parseOptionalPositiveInteger(0), undefined);
    assert.equal(parseOptionalPositiveInteger(-1), undefined);
    assert.equal(parseOptionalPositiveInteger(-100), undefined);
});
test("parseOptionalPositiveInteger returns undefined for non-finite numbers", () => {
    assert.equal(parseOptionalPositiveInteger(Infinity), undefined);
    assert.equal(parseOptionalPositiveInteger(-Infinity), undefined);
    assert.equal(parseOptionalPositiveInteger(NaN), undefined);
});
test("parseOptionalPositiveInteger returns undefined for non-number inputs", () => {
    assert.equal(parseOptionalPositiveInteger("1"), undefined);
    assert.equal(parseOptionalPositiveInteger(null), undefined);
    assert.equal(parseOptionalPositiveInteger(undefined), undefined);
    assert.equal(parseOptionalPositiveInteger({}), undefined);
});
test("parseOptionalPositiveInteger truncates floating point numbers", () => {
    assert.equal(parseOptionalPositiveInteger(1.5), 1);
    assert.equal(parseOptionalPositiveInteger(2.9), 2);
    assert.equal(parseOptionalPositiveInteger(10.99), 10);
});
test("parseOptionalStringArray returns valid string array", () => {
    assert.deepEqual(parseOptionalStringArray(["a", "b", "c"]), ["a", "b", "c"]);
    assert.deepEqual(parseOptionalStringArray(["hello", "world"]), ["hello", "world"]);
});
test("parseOptionalStringArray filters out non-strings", () => {
    assert.deepEqual(parseOptionalStringArray(["a", 123, "b"]), ["a", "b"]);
    assert.deepEqual(parseOptionalStringArray([1, 2]), []);
});
test("parseOptionalStringArray filters out empty and whitespace strings", () => {
    assert.deepEqual(parseOptionalStringArray(["", "a", "  "]), ["a"]);
    assert.deepEqual(parseOptionalStringArray(["", "", ""]), []);
});
test("parseOptionalStringArray returns empty array for non-array inputs", () => {
    assert.deepEqual(parseOptionalStringArray("abc"), []);
    assert.deepEqual(parseOptionalStringArray(null), []);
    assert.deepEqual(parseOptionalStringArray(undefined), []);
});
test("resolveMultiStepToolPath returns resolved path for valid input", () => {
    const rootPath = "/workspace";
    const result = resolveMultiStepToolPath(rootPath, "subdir/file.txt");
    assert.ok(result.endsWith("subdir/file.txt"));
    assert.ok(result.startsWith(rootPath));
});
test("resolveMultiStepToolPath returns rootPath for null input", () => {
    const rootPath = "/workspace";
    const result = resolveMultiStepToolPath(rootPath, null);
    assert.equal(result, rootPath);
});
test("resolveMultiStepToolPath returns rootPath for undefined input", () => {
    const rootPath = "/workspace";
    const result = resolveMultiStepToolPath(rootPath, undefined);
    assert.equal(result, rootPath);
});
test("resolveMultiStepToolPath throws for path outside workspace", () => {
    const rootPath = "/workspace";
    assert.throws(() => resolveMultiStepToolPath(rootPath, "/etc/passwd"), /path_outside_workspace/);
    assert.throws(() => resolveMultiStepToolPath(rootPath, "../../../etc/passwd"), /path_outside_workspace/);
});
test("safeParseToolResult parses valid JSON", () => {
    const result = safeParseToolResult('{"key": "value", "num": 42}');
    assert.deepEqual(result, { key: "value", num: 42 });
});
test("safeParseToolResult returns raw string for invalid JSON", () => {
    const raw = "not valid json {";
    const result = safeParseToolResult(raw);
    assert.equal(result, raw);
});
test("safeParseToolResult returns raw string for empty input", () => {
    const result = safeParseToolResult("");
    assert.equal(result, "");
});
test("parseStepOutput parses JSON with summary and result", () => {
    const content = JSON.stringify({
        summary: "Task completed",
        result: "Output details",
    });
    const result = parseStepOutput(content, "step_1");
    assert.equal(result.summary, "Task completed");
    assert.equal(result.result, "Output details");
});
test("parseStepOutput falls back to line parsing for invalid JSON", () => {
    const content = "Summary line\nSecond line\nThird line";
    const result = parseStepOutput(content, "step_2");
    assert.equal(result.summary, "Summary line");
    assert.equal(result.result, "Second line\nThird line");
});
test("parseStepOutput falls back for JSON that parses but lacks fields", () => {
    const content = JSON.stringify({ other: "field" });
    const result = parseStepOutput(content, "step_3");
    assert.equal(result.summary, "Step step_3 completed");
});
test("parseStepOutput handles content without newlines", () => {
    const content = "Single line content";
    const result = parseStepOutput(content, "step_4");
    assert.equal(result.summary, "Step step_4 completed");
});
test("parseStepOutput handles empty content", () => {
    const result = parseStepOutput("", "step_5");
    assert.equal(result.summary, "Step step_5 completed");
    assert.ok(result.result.includes("step_5"));
});
test("fallbackStepOutput handles intake_triage step", () => {
    const input = {
        stepId: "intake_triage",
        roleId: "triage_agent",
        request: "Analyze request",
        priorSummaries: [],
        routingReason: "initial_intake",
    };
    const result = fallbackStepOutput(input);
    assert.ok(typeof result.summary === "string");
    assert.ok(typeof result.result === "string");
    assert.equal(result.llmResult, null);
    assert.deepEqual(result.toolCalls, []);
});
test("fallbackStepOutput handles draft_solution step", () => {
    const input = {
        stepId: "draft_solution",
        roleId: "draft_agent",
        request: "Create solution",
        priorSummaries: ["Prior step completed"],
        routingReason: "triage_complete",
    };
    const result = fallbackStepOutput(input);
    assert.ok(result.summary.includes("draft") || result.summary.includes("solution"));
    assert.ok(result.result.includes("Prior step completed"));
});
test("fallbackStepOutput handles final_review step", () => {
    const input = {
        stepId: "final_review",
        roleId: "review_agent",
        request: "Review output",
        priorSummaries: ["Step 1", "Step 2"],
        routingReason: "review_requested",
    };
    const result = fallbackStepOutput(input);
    assert.ok(result.summary.includes("review") || result.summary.includes("final"));
    assert.ok(result.result.includes("Step 1") && result.result.includes("Step 2"));
});
test("fallbackStepOutput returns correct structure", () => {
    const input = {
        stepId: "test_step",
        roleId: "test_agent",
        request: "Test",
        priorSummaries: [],
        routingReason: "test",
    };
    const result = fallbackStepOutput(input);
    assert.ok(typeof result.summary === "string");
    assert.ok(typeof result.result === "string");
    assert.equal(result.llmResult, null);
    assert.deepEqual(result.toolCalls, []);
    assert.equal(result.iterations, 0);
    assert.equal(result.finishReason, "stop");
});
test("AgentRoundLoopInput type is usable", () => {
    const input = {
        stepId: "test",
        roleId: "agent",
        request: "request",
        priorSummaries: [],
        routingReason: "reason",
    };
    assert.equal(input.stepId, "test");
    assert.equal(input.roleId, "agent");
});
test("BuildStepOutputInput type is usable", () => {
    const input = {
        stepId: "test",
        roleId: "agent",
        request: "request",
        priorSummaries: [],
        routingReason: "reason",
    };
    assert.equal(input.stepId, "test");
});
//# sourceMappingURL=index.test.js.map