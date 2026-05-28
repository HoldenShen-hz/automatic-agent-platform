/**
 * Unit Tests: Multi-step tool definitions public surface
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  MULTI_STEP_TOOL_DEFINITIONS,
  getMultiStepToolDefinitions,
  type MultiStepToolDefinition,
} from "../../../../../src/platform/five-plane-execution/execution-engine/multi-step-tool-definitions.js";

test("MULTI_STEP_TOOL_DEFINITIONS is a readonly array [phase1b-tool-definitions]", () => {
  assert.ok(Array.isArray(MULTI_STEP_TOOL_DEFINITIONS));
  assert.ok(MULTI_STEP_TOOL_DEFINITIONS.length > 0);
});

test("MULTI_STEP_TOOL_DEFINITIONS contains expected tool names [phase1b-tool-definitions]", () => {
  const toolNames = MULTI_STEP_TOOL_DEFINITIONS.map((t) => t.name);
  assert.ok(toolNames.includes("todo_write"));
  assert.ok(toolNames.includes("question"));
  assert.ok(toolNames.includes("web_search"));
  assert.ok(toolNames.includes("web_fetch"));
  assert.ok(toolNames.includes("git"));
  assert.ok(toolNames.includes("repo-map"));
  assert.ok(toolNames.includes("spawn-agent"));
  assert.ok(toolNames.includes("edit_replace"));
  assert.ok(toolNames.includes("batch_edit_replace"));
  assert.ok(toolNames.includes("multifile_edit_replace"));
  assert.ok(toolNames.includes("read"));
  assert.ok(toolNames.includes("glob"));
  assert.ok(toolNames.includes("grep"));
  assert.ok(toolNames.includes("write"));
});

test("MULTI_STEP_TOOL_DEFINITIONS tools have required properties [phase1b-tool-definitions]", () => {
  for (const tool of MULTI_STEP_TOOL_DEFINITIONS) {
    assert.ok(typeof tool.name === "string");
    assert.ok(typeof tool.description === "string");
    assert.ok(typeof tool.inputSchema === "object");
  }
});

test("legacy Phase1B tool-definition aliases are absent [phase1b-tool-definitions]", async () => {
  const mod = await import("../../../../../src/platform/five-plane-execution/execution-engine/multi-step-tool-definitions.js");
  assert.equal("PHASE1B_TOOL_DEFINITIONS" in mod, false);
  assert.equal("getPhase1BToolDefinitions" in mod, false);
});

test("getMultiStepToolDefinitions returns filtered tools by name [phase1b-tool-definitions]", () => {
  const result = getMultiStepToolDefinitions(["todo_write", "question"]);
  assert.equal(result.length, 2);
  assert.equal(result[0].name, "todo_write");
  assert.equal(result[1].name, "question");
});

test("getMultiStepToolDefinitions returns empty array for empty input [phase1b-tool-definitions]", () => {
  const result = getMultiStepToolDefinitions([]);
  assert.equal(result.length, 0);
});

test("getMultiStepToolDefinitions returns all tools when given all names [phase1b-tool-definitions]", () => {
  const allNames = MULTI_STEP_TOOL_DEFINITIONS.map((t) => t.name);
  const result = getMultiStepToolDefinitions(allNames);
  assert.equal(result.length, MULTI_STEP_TOOL_DEFINITIONS.length);
});

test("getMultiStepToolDefinitions ignores unknown tool names [phase1b-tool-definitions]", () => {
  const result = getMultiStepToolDefinitions(["todo_write", "unknown_tool", "question"]);
  assert.equal(result.length, 2);
});

test("getMultiStepToolDefinitions returns tools in same order as source [phase1b-tool-definitions]", () => {
  const result = getMultiStepToolDefinitions(["web_fetch", "web_search", "git"]);
  assert.equal(result[0].name, "web_search");
  assert.equal(result[1].name, "web_fetch");
  assert.equal(result[2].name, "git");
});

// =============================================================================
// Phase1BToolDefinition type alias tests
// =============================================================================

test("MultiStepToolDefinition can be used as a type [phase1b-tool-definitions]", () => {
  const toolDef: MultiStepToolDefinition = {
    name: "test_tool",
    description: "A test tool",
    inputSchema: { type: "object", properties: {} },
  };
  assert.equal(toolDef.name, "test_tool");
  assert.equal(toolDef.description, "A test tool");
});

test("MultiStepToolDefinition structure matches canonical contract [phase1b-tool-definitions]", () => {
  const phase1bDef: MultiStepToolDefinition = {
    name: "custom_tool",
    description: "Custom description",
    inputSchema: { type: "object" },
  };
  const multiStepDef = {
    name: "custom_tool",
    description: "Custom description",
    inputSchema: { type: "object" },
  };
  assert.deepEqual(phase1bDef, multiStepDef);
});
