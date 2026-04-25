import assert from "node:assert/strict";
import test from "node:test";

import {
  getMultiStepToolDefinitions,
  MULTI_STEP_TOOL_DEFINITIONS,
} from "../../../../../src/core/runtime/planner/index.js";

import type { MultiStepToolDefinition } from "../../../../../src/core/runtime/planner/index.js";

test("core/runtime/planner shim exports getMultiStepToolDefinitions", () => {
  assert.equal(typeof getMultiStepToolDefinitions, "function", "getMultiStepToolDefinitions should be a function");
});

test("core/runtime/planner shim exports MULTI_STEP_TOOL_DEFINITIONS", () => {
  assert.ok(Array.isArray(MULTI_STEP_TOOL_DEFINITIONS), "MULTI_STEP_TOOL_DEFINITIONS should be an array");
  assert.ok(MULTI_STEP_TOOL_DEFINITIONS.length > 0, "MULTI_STEP_TOOL_DEFINITIONS should not be empty");
});

test("MULTI_STEP_TOOL_DEFINITIONS contains tool definitions with required fields", () => {
  for (const tool of MULTI_STEP_TOOL_DEFINITIONS) {
    assert.equal(typeof tool.name, "string", `Tool name should be a string`);
    assert.ok(tool.name.length > 0, `Tool name should not be empty`);
    assert.equal(typeof tool.description, "string", `Tool description should be a string`);
    assert.ok(tool.description.length > 0, `Tool description should not be empty`);
    assert.ok(typeof tool.inputSchema === "object" && tool.inputSchema !== null, `Tool inputSchema should be an object`);
    assert.equal(typeof tool.inputSchema.type, "string", `Tool inputSchema.type should be a string`);
  }
});

test("MULTI_STEP_TOOL_DEFINITIONS contains expected tool names", () => {
  const toolNames = MULTI_STEP_TOOL_DEFINITIONS.map((t) => t.name);
  assert.ok(toolNames.includes("todo_write"), "Should contain todo_write");
  assert.ok(toolNames.includes("question"), "Should contain question");
  assert.ok(toolNames.includes("web_search"), "Should contain web_search");
  assert.ok(toolNames.includes("web_fetch"), "Should contain web_fetch");
  assert.ok(toolNames.includes("git"), "Should contain git");
  assert.ok(toolNames.includes("repo-map"), "Should contain repo-map");
  assert.ok(toolNames.includes("spawn-agent"), "Should contain spawn-agent");
  assert.ok(toolNames.includes("edit_replace"), "Should contain edit_replace");
  assert.ok(toolNames.includes("batch_edit_replace"), "Should contain batch_edit_replace");
  assert.ok(toolNames.includes("multifile_edit_replace"), "Should contain multifile_edit_replace");
  assert.ok(toolNames.includes("read"), "Should contain read");
  assert.ok(toolNames.includes("glob"), "Should contain glob");
  assert.ok(toolNames.includes("grep"), "Should contain grep");
  assert.ok(toolNames.includes("write"), "Should contain write");
});

test("getMultiStepToolDefinitions returns all tools for empty array input", () => {
  const result = getMultiStepToolDefinitions([]);
  assert.deepEqual(result, [], "Empty input should return empty array");
});

test("getMultiStepToolDefinitions returns matching tools by name", () => {
  const result = getMultiStepToolDefinitions(["read", "write"]);
  assert.equal(result.length, 2, "Should return 2 tools");
  assert.deepEqual(result.map((t) => t.name), ["read", "write"]);
});

test("getMultiStepToolDefinitions returns empty array when no names match", () => {
  const result = getMultiStepToolDefinitions(["nonexistent_tool"]);
  assert.deepEqual(result, [], "Non-matching tool names should return empty array");
});

test("getMultiStepToolDefinitions returns tools in the order they appear in input array", () => {
  const result = getMultiStepToolDefinitions(["write", "read", "git"]);
  assert.equal(result.length, 3);
  assert.deepEqual(result.map((t) => t.name), ["git", "read", "write"]);
});

test("getMultiStepToolDefinitions handles duplicate names", () => {
  const result = getMultiStepToolDefinitions(["read", "read", "write"]);
  assert.equal(result.length, 2, "Duplicates should be returned once each");
  assert.deepEqual(result.map((t) => t.name), ["read", "write"]);
});

test("getMultiStepToolDefinitions returns canonical tool definitions", () => {
  const result = getMultiStepToolDefinitions(["read"]);
  assert.equal(result[0], MULTI_STEP_TOOL_DEFINITIONS.find((tool) => tool.name === "read"));
});

test("MULTI_STEP_TOOL_DEFINITIONS remains the canonical exported array", () => {
  assert.ok(Array.isArray(MULTI_STEP_TOOL_DEFINITIONS));
  assert.ok(MULTI_STEP_TOOL_DEFINITIONS.length > 0);
});

test("MultiStepToolDefinition interface is usable as a type", () => {
  const tool: MultiStepToolDefinition = {
    name: "test_tool",
    description: "A test tool",
    inputSchema: {
      type: "object",
      properties: {
        arg1: { type: "string" },
      },
    },
  };
  assert.equal(tool.name, "test_tool");
  assert.equal(tool.description, "A test tool");
  assert.deepEqual(tool.inputSchema.properties?.arg1, { type: "string" });
});

test("getMultiStepToolDefinitions returns tools with full structure", () => {
  const result = getMultiStepToolDefinitions(["todo_write"]);
  assert.equal(result.length, 1);
  const tool = result[0];
  assert.equal(tool.name, "todo_write");
  assert.ok(tool.description.length > 0);
  assert.ok(typeof tool.inputSchema === "object");
  assert.equal(tool.inputSchema.type, "object");
});

test("planner shim re-exports getMultiStepToolDefinitions from canonical platform", async () => {
  const shim = await import("../../../../../src/core/runtime/planner/index.js");
  const platform = await import("../../../../../src/platform/execution/execution-engine/multi-step-tool-definitions.js");

  assert.equal(shim.getMultiStepToolDefinitions, platform.getMultiStepToolDefinitions, "getMultiStepToolDefinitions should point to platform implementation");
  assert.equal(shim.MULTI_STEP_TOOL_DEFINITIONS, platform.MULTI_STEP_TOOL_DEFINITIONS, "MULTI_STEP_TOOL_DEFINITIONS should point to platform implementation");
});

test("planner shim re-exports MultiStepToolDefinition interface", () => {
  const tool: MultiStepToolDefinition = {
    name: "test",
    description: "test",
    inputSchema: { type: "object" },
  };
  assert.ok(tool.name === "test");
});
