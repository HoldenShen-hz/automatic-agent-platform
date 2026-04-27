/**
 * Unit Tests: Phase1B Tool Definitions
 *
 * Tests for Phase1B aliases in phase1b-tool-definitions.ts:
 * - PHASE1B_TOOL_DEFINITIONS (alias for MULTI_STEP_TOOL_DEFINITIONS)
 * - getPhase1BToolDefinitions (alias for getMultiStepToolDefinitions)
 * - Phase1BToolDefinition type (alias for MultiStepToolDefinition)
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  MULTI_STEP_TOOL_DEFINITIONS,
  getMultiStepToolDefinitions,
} from "../../../../../src/platform/execution/execution-engine/multi-step-tool-definitions.js";
import {
  PHASE1B_TOOL_DEFINITIONS,
  getPhase1BToolDefinitions,
  type Phase1BToolDefinition,
} from "../../../../../src/platform/execution/execution-engine/phase1b-tool-definitions.js";

// =============================================================================
// PHASE1B_TOOL_DEFINITIONS alias tests
// =============================================================================

test("PHASE1B_TOOL_DEFINITIONS is identical to MULTI_STEP_TOOL_DEFINITIONS", () => {
  assert.strictEqual(PHASE1B_TOOL_DEFINITIONS, MULTI_STEP_TOOL_DEFINITIONS);
});

test("PHASE1B_TOOL_DEFINITIONS is a readonly array", () => {
  assert.ok(Array.isArray(PHASE1B_TOOL_DEFINITIONS));
  assert.equal(PHASE1B_TOOL_DEFINITIONS.length, MULTI_STEP_TOOL_DEFINITIONS.length);
});

test("PHASE1B_TOOL_DEFINITIONS contains expected tool names", () => {
  const toolNames = PHASE1B_TOOL_DEFINITIONS.map((t) => t.name);
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

test("PHASE1B_TOOL_DEFINITIONS tools have required properties", () => {
  for (const tool of PHASE1B_TOOL_DEFINITIONS) {
    assert.ok(typeof tool.name === "string");
    assert.ok(typeof tool.description === "string");
    assert.ok(typeof tool.inputSchema === "object");
  }
});

test("PHASE1B_TOOL_DEFINITIONS length matches source", () => {
  assert.equal(PHASE1B_TOOL_DEFINITIONS.length, MULTI_STEP_TOOL_DEFINITIONS.length);
});

// =============================================================================
// getPhase1BToolDefinitions alias tests
// =============================================================================

test("getPhase1BToolDefinitions is identical to getMultiStepToolDefinitions", () => {
  assert.strictEqual(getPhase1BToolDefinitions, getMultiStepToolDefinitions);
});

test("getPhase1BToolDefinitions returns filtered tools by name", () => {
  const result = getPhase1BToolDefinitions(["todo_write", "question"]);
  assert.equal(result.length, 2);
  assert.equal(result[0].name, "todo_write");
  assert.equal(result[1].name, "question");
});

test("getPhase1BToolDefinitions returns empty array for empty input", () => {
  const result = getPhase1BToolDefinitions([]);
  assert.equal(result.length, 0);
});

test("getPhase1BToolDefinitions returns all tools when given all names", () => {
  const allNames = MULTI_STEP_TOOL_DEFINITIONS.map((t) => t.name);
  const result = getPhase1BToolDefinitions(allNames);
  assert.equal(result.length, MULTI_STEP_TOOL_DEFINITIONS.length);
});

test("getPhase1BToolDefinitions ignores unknown tool names", () => {
  const result = getPhase1BToolDefinitions(["todo_write", "unknown_tool", "question"]);
  assert.equal(result.length, 2);
});

test("getPhase1BToolDefinitions returns tools in same order as source", () => {
  const result = getPhase1BToolDefinitions(["web_fetch", "web_search", "git"]);
  assert.equal(result[0].name, "web_fetch");
  assert.equal(result[1].name, "web_search");
  assert.equal(result[2].name, "git");
});

// =============================================================================
// Phase1BToolDefinition type alias tests
// =============================================================================

test("Phase1BToolDefinition can be used as a type", () => {
  const toolDef: Phase1BToolDefinition = {
    name: "test_tool",
    description: "A test tool",
    inputSchema: { type: "object", properties: {} },
  };
  assert.equal(toolDef.name, "test_tool");
  assert.equal(toolDef.description, "A test tool");
});

test("Phase1BToolDefinition structure matches MultiStepToolDefinition", () => {
  const phase1bDef: Phase1BToolDefinition = {
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