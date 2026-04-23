/**
 * Unit Tests: Multi-Step Tool Definitions
 *
 * Tests for getMultiStepToolDefinitions function.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { getMultiStepToolDefinitions, MULTI_STEP_TOOL_DEFINITIONS, } from "../../../../../src/platform/execution/execution-engine/multi-step-tool-definitions.js";
test("getMultiStepToolDefinitions returns all tools when filter matches all", () => {
    const allToolNames = MULTI_STEP_TOOL_DEFINITIONS.map((t) => t.name);
    const result = getMultiStepToolDefinitions(allToolNames);
    assert.equal(result.length, MULTI_STEP_TOOL_DEFINITIONS.length);
});
test("getMultiStepToolDefinitions returns matching tools by name", () => {
    const result = getMultiStepToolDefinitions(["read", "write"]);
    assert.equal(result.length, 2);
    assert.ok(result.every((tool) => ["read", "write"].includes(tool.name)));
});
test("getMultiStepToolDefinitions returns empty array for non-existent tool", () => {
    const result = getMultiStepToolDefinitions(["non_existent_tool"]);
    assert.equal(result.length, 0);
});
test("getMultiStepToolDefinitions handles single tool", () => {
    const result = getMultiStepToolDefinitions(["todo_write"]);
    assert.equal(result.length, 1);
    assert.equal(result[0].name, "todo_write");
});
test("getMultiStepToolDefinitions preserves tool definition structure", () => {
    const result = getMultiStepToolDefinitions(["question"]);
    assert.equal(result.length, 1);
    const tool = result[0];
    assert.ok(typeof tool.name === "string");
    assert.ok(typeof tool.description === "string");
    assert.ok(typeof tool.inputSchema === "object");
});
test("getMultiStepToolDefinitions handles duplicate names in filter", () => {
    const result = getMultiStepToolDefinitions(["read", "read", "write"]);
    assert.equal(result.length, 2);
});
test("getMultiStepToolDefinitions returns tools with correct inputSchema", () => {
    const result = getMultiStepToolDefinitions(["git"]);
    assert.equal(result.length, 1);
    const tool = result[0];
    assert.ok(tool.inputSchema.properties);
    assert.ok(tool.inputSchema.required);
});
test("MULTI_STEP_TOOL_DEFINITIONS contains expected tools", () => {
    const toolNames = MULTI_STEP_TOOL_DEFINITIONS.map((t) => t.name);
    assert.ok(toolNames.includes("read"));
    assert.ok(toolNames.includes("write"));
    assert.ok(toolNames.includes("edit_replace"));
    assert.ok(toolNames.includes("git"));
    assert.ok(toolNames.includes("grep"));
    assert.ok(toolNames.includes("glob"));
    assert.ok(toolNames.includes("web_search"));
    assert.ok(toolNames.includes("web_fetch"));
    assert.ok(toolNames.includes("spawn-agent"));
    assert.ok(toolNames.includes("question"));
    assert.ok(toolNames.includes("todo_write"));
});
test("MULTI_STEP_TOOL_DEFINITIONS tools have required properties", () => {
    for (const tool of MULTI_STEP_TOOL_DEFINITIONS) {
        assert.ok(tool.name.length > 0, "Tool name should not be empty");
        assert.ok(tool.description.length > 0, "Tool description should not be empty");
        assert.ok(tool.inputSchema, "Tool should have inputSchema");
    }
});
//# sourceMappingURL=multi-step-tool-definitions.test.js.map