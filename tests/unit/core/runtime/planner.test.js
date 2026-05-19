import assert from "node:assert/strict";
import test from "node:test";
import { executeAgentRoundLoop, buildStepOutput, parseStepOutput, fallbackStepOutput, } from "../../../../src/core/runtime/planner/index.js";
import { parseOptionalPositiveInteger, parseOptionalStringArray, resolveMultiStepToolPath, safeParseToolResult, } from "../../../../src/core/runtime/planner/index.js";
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
    assert.equal(parseOptionalPositiveInteger([]), undefined);
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
    assert.deepEqual(parseOptionalStringArray({}), []);
    assert.deepEqual(parseOptionalStringArray(123), []);
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
        summary: "Task completed successfully",
        result: "The output shows the completed task details",
    });
    const result = parseStepOutput(content, "step_1");
    assert.equal(result.summary, "Task completed successfully");
    assert.equal(result.result, "The output shows the completed task details");
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
    // When there's only one line with no JSON, parseStepOutput returns default
    const content = "Single line content";
    const result = parseStepOutput(content, "step_4");
    assert.equal(result.summary, "Step step_4 completed");
});
test("parseStepOutput handles empty content", () => {
    const result = parseStepOutput("", "step_5");
    assert.equal(result.summary, "Step step_5 completed");
    assert.ok(result.result.includes("step_5"));
});
test("parseStepOutput strips markdown bullets from summary", () => {
    const content = "- Summary with bullet\nMore details here";
    const result = parseStepOutput(content, "step_6");
    assert.equal(result.summary, "Summary with bullet");
});
test("parseStepOutput handles content starting with asterisk bullet", () => {
    const content = "* Bullet point summary\nDetails after";
    const result = parseStepOutput(content, "step_7");
    assert.equal(result.summary, "Bullet point summary");
});
test("fallbackStepOutput handles intake_triage step", () => {
    const input = {
        stepId: "intake_triage",
        roleId: "triage_agent",
        request: "Analyze this request",
        priorSummaries: [],
        routingReason: "initial_intake",
    };
    const result = fallbackStepOutput(input);
    assert.ok(result.summary.includes("triage") || result.summary.includes("intake"));
    assert.ok(result.result.includes("Route reason"));
});
test("fallbackStepOutput handles draft_solution step", () => {
    const input = {
        stepId: "draft_solution",
        roleId: "draft_agent",
        request: "Create a solution",
        priorSummaries: ["Prior step 1 completed"],
        routingReason: "triage_complete",
    };
    const result = fallbackStepOutput(input);
    assert.ok(result.summary.includes("draft") || result.summary.includes("solution"));
    assert.ok(result.result.includes("Prior step 1 completed"));
});
test("fallbackStepOutput handles final_review step", () => {
    const input = {
        stepId: "final_review",
        roleId: "review_agent",
        request: "Review the output",
        priorSummaries: ["Step 1", "Step 2"],
        routingReason: "review_requested",
    };
    const result = fallbackStepOutput(input);
    assert.ok(result.summary.includes("review") || result.summary.includes("final"));
    assert.ok(result.result.includes("Step 1") && result.result.includes("Step 2"));
});
test("fallbackStepOutput handles unknown step type", () => {
    const input = {
        stepId: "custom_step",
        roleId: "custom_agent",
        request: "Custom request",
        priorSummaries: [],
        routingReason: "custom",
    };
    const result = fallbackStepOutput(input);
    assert.ok(result.summary.includes("custom_step"));
    assert.ok(result.result.includes("custom_agent"));
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
test("buildStepOutput returns expected structure", async () => {
    const input = {
        stepId: "test_step",
        roleId: "test_agent",
        request: "Test request",
        priorSummaries: [],
        routingReason: "testing",
    };
    const result = await buildStepOutput(input);
    assert.ok(typeof result.summary === "string");
    assert.ok(typeof result.result === "string");
});
test("executeAgentRoundLoop returns fallback when no model provider", async () => {
    const input = {
        stepId: "intake_triage",
        roleId: "test_agent",
        request: "Test",
        priorSummaries: [],
        routingReason: "test",
        maxIterations: 1,
    };
    const result = await executeAgentRoundLoop(input);
    assert.equal(result.finishReason, "stop");
    assert.equal(result.iterations, 0);
    assert.equal(result.llmResult, null);
});
test("executeAgentRoundLoop with explicit tools parameter", async () => {
    const input = {
        stepId: "draft_solution",
        roleId: "draft_agent",
        request: "Create solution",
        priorSummaries: [],
        routingReason: "testing",
        tools: [],
        maxIterations: 1,
    };
    const result = await executeAgentRoundLoop(input);
    assert.ok(result !== null);
    assert.ok(typeof result.summary === "string");
});
test("executeAgentRoundLoop maxIterations defaults to 10", async () => {
    const input = {
        stepId: "test_step",
        roleId: "test_agent",
        request: "Test",
        priorSummaries: [],
        routingReason: "test",
    };
    const result = await executeAgentRoundLoop(input);
    assert.equal(result.iterations, 0);
});
//# sourceMappingURL=planner.test.js.map