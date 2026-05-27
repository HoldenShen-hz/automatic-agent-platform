import assert from "node:assert/strict";
import test from "node:test";

import {
  MULTI_STEP_TOOL_DEFINITIONS,
  getMultiStepToolDefinitions,
  type MultiStepToolDefinition,
} from "../../../../src/platform/five-plane-execution/execution-engine/multi-step-tool-definitions.js";

test("MULTI_STEP_TOOL_DEFINITIONS should contain all expected tools [multi-step-tool-definitions]", () => {
  const toolNames = MULTI_STEP_TOOL_DEFINITIONS.map((t) => t.name);

  assert.ok(toolNames.includes("todo_write"), "should include todo_write tool");
  assert.ok(toolNames.includes("question"), "should include question tool");
  assert.ok(toolNames.includes("web_search"), "should include web_search tool");
  assert.ok(toolNames.includes("web_fetch"), "should include web_fetch tool");
  assert.ok(toolNames.includes("git"), "should include git tool");
  assert.ok(toolNames.includes("repo-map"), "should include repo-map tool");
  assert.ok(toolNames.includes("spawn-agent"), "should include spawn-agent tool");
  assert.ok(toolNames.includes("edit_replace"), "should include edit_replace tool");
  assert.ok(toolNames.includes("batch_edit_replace"), "should include batch_edit_replace tool");
  assert.ok(toolNames.includes("multifile_edit_replace"), "should include multifile_edit_replace tool");
  assert.ok(toolNames.includes("read"), "should include read tool");
  assert.ok(toolNames.includes("glob"), "should include glob tool");
  assert.ok(toolNames.includes("grep"), "should include grep tool");
  assert.ok(toolNames.includes("write"), "should include write tool");
});

test("MULTI_STEP_TOOL_DEFINITIONS should have valid input schemas [multi-step-tool-definitions]", () => {
  for (const tool of MULTI_STEP_TOOL_DEFINITIONS) {
    assert.ok(typeof tool.name === "string" && tool.name.length > 0, `tool ${tool.name} should have a name`);
    assert.ok(typeof tool.description === "string", `tool ${tool.name} should have a description`);
    assert.ok(
      typeof tool.inputSchema === "object" && tool.inputSchema !== null,
      `tool ${tool.name} should have an inputSchema object`,
    );
    assert.ok(tool.inputSchema.type === "object", `tool ${tool.name} should have object type inputSchema`);
    assert.ok(
      typeof tool.inputSchema.properties === "object" && tool.inputSchema.properties !== null,
      `tool ${tool.name} should have properties object`,
    );
  }
});

test("todo_write tool should have correct schema structure [multi-step-tool-definitions]", () => {
  const todoTool = MULTI_STEP_TOOL_DEFINITIONS.find((t) => t.name === "todo_write");
  assert.ok(todoTool !== undefined, "todo_write tool should exist");

  const props = todoTool.inputSchema.properties as Record<string, unknown>;
  assert.ok(props.operation, "todo_write should have operation property");
  assert.ok(props.sessionId, "todo_write should have sessionId property");
  assert.ok(props.todoId, "todo_write should have todoId property");
  assert.ok(props.title, "todo_write should have title property");
  assert.ok(props.description, "todo_write should have description property");
  assert.ok(props.status, "todo_write should have status property");
  assert.ok(props.priority, "todo_write should have priority property");
});

test("web_search tool should have required query field [multi-step-tool-definitions]", () => {
  const webSearchTool = MULTI_STEP_TOOL_DEFINITIONS.find((t) => t.name === "web_search");
  assert.ok(webSearchTool !== undefined, "web_search tool should exist");

  const props = webSearchTool.inputSchema.properties as Record<string, unknown>;
  assert.ok(props.query, "web_search should have query property");
  assert.deepEqual(webSearchTool.inputSchema.required, ["query"], "query should be required");
});

test("git tool should have required args field [multi-step-tool-definitions]", () => {
  const gitTool = MULTI_STEP_TOOL_DEFINITIONS.find((t) => t.name === "git");
  assert.ok(gitTool !== undefined, "git tool should exist");

  assert.deepEqual(gitTool.inputSchema.required, ["args"], "args should be required");
  assert.equal(gitTool.inputSchema.additionalProperties, false, "git should not allow additional properties");
});

test("repo-map tool should have required query field [multi-step-tool-definitions]", () => {
  const repoMapTool = MULTI_STEP_TOOL_DEFINITIONS.find((t) => t.name === "repo-map");
  assert.ok(repoMapTool !== undefined, "repo-map tool should exist");

  assert.deepEqual(repoMapTool.inputSchema.required, ["query"], "query should be required");
  assert.equal(repoMapTool.inputSchema.additionalProperties, false, "repo-map should not allow additional properties");
});

test("spawn-agent tool should allow additional properties [multi-step-tool-definitions]", () => {
  const spawnAgentTool = MULTI_STEP_TOOL_DEFINITIONS.find((t) => t.name === "spawn-agent");
  assert.ok(spawnAgentTool !== undefined, "spawn-agent tool should exist");

  assert.ok(spawnAgentTool.inputSchema.additionalProperties, "spawn-agent should allow additional properties");
});

test("edit_replace tool should require filePath, oldString, and newString [multi-step-tool-definitions]", () => {
  const editTool = MULTI_STEP_TOOL_DEFINITIONS.find((t) => t.name === "edit_replace");
  assert.ok(editTool !== undefined, "edit_replace tool should exist");

  assert.deepEqual(
    editTool.inputSchema.required,
    ["filePath", "oldString", "newString"],
    "edit_replace should require filePath, oldString, and newString",
  );
});

test("read tool should have required path field [multi-step-tool-definitions]", () => {
  const readTool = MULTI_STEP_TOOL_DEFINITIONS.find((t) => t.name === "read");
  assert.ok(readTool !== undefined, "read tool should exist");

  assert.deepEqual(readTool.inputSchema.required, ["path"], "path should be required");
});

test("write tool should require path and content [multi-step-tool-definitions]", () => {
  const writeTool = MULTI_STEP_TOOL_DEFINITIONS.find((t) => t.name === "write");
  assert.ok(writeTool !== undefined, "write tool should exist");

  assert.deepEqual(writeTool.inputSchema.required, ["path", "content"], "write should require path and content");
});

test("grep tool should require pattern and path [multi-step-tool-definitions]", () => {
  const grepTool = MULTI_STEP_TOOL_DEFINITIONS.find((t) => t.name === "grep");
  assert.ok(grepTool !== undefined, "grep tool should exist");

  assert.deepEqual(grepTool.inputSchema.required, ["pattern", "path"], "grep should require pattern and path");
});

test("glob tool should require pattern [multi-step-tool-definitions]", () => {
  const globTool = MULTI_STEP_TOOL_DEFINITIONS.find((t) => t.name === "glob");
  assert.ok(globTool !== undefined, "glob tool should exist");

  assert.deepEqual(globTool.inputSchema.required, ["pattern"], "glob should require pattern");
});

test("getMultiStepToolDefinitions should filter by tool names [multi-step-tool-definitions]", () => {
  const result = getMultiStepToolDefinitions(["read", "write", "nonexistent"]);

  assert.equal(result.length, 2, "should return only existing tools");
  assert.ok(result.some((t) => t.name === "read"), "should include read tool");
  assert.ok(result.some((t) => t.name === "write"), "should include write tool");
  assert.ok(!result.some((t) => t.name === "nonexistent"), "should not include nonexistent tool");
});

test("getMultiStepToolDefinitions should return empty array for empty input [multi-step-tool-definitions]", () => {
  const result = getMultiStepToolDefinitions([]);
  assert.equal(result.length, 0, "should return empty array for empty input");
});

test("getMultiStepToolDefinitions should return empty array when no tools match [multi-step-tool-definitions]", () => {
  const result = getMultiStepToolDefinitions(["nonexistent1", "nonexistent2"]);
  assert.equal(result.length, 0, "should return empty array when no tools match");
});

test("MULTI_STEP_TOOL_DEFINITIONS should be readonly [multi-step-tool-definitions]", () => {
  assert.ok(
    Object.isFrozen(MULTI_STEP_TOOL_DEFINITIONS),
    "MULTI_STEP_TOOL_DEFINITIONS should be frozen",
  );
  assert.ok(
    Object.isFrozen(MULTI_STEP_TOOL_DEFINITIONS[0]),
    "each tool definition should be frozen",
  );
});

test("batch_edit_replace tool should require filePath and edits [multi-step-tool-definitions]", () => {
  const tool = MULTI_STEP_TOOL_DEFINITIONS.find((t) => t.name === "batch_edit_replace");
  assert.ok(tool !== undefined, "batch_edit_replace tool should exist");

  assert.deepEqual(tool.inputSchema.required, ["filePath", "edits"], "should require filePath and edits");
});

test("multifile_edit_replace tool should require edits [multi-step-tool-definitions]", () => {
  const tool = MULTI_STEP_TOOL_DEFINITIONS.find((t) => t.name === "multifile_edit_replace");
  assert.ok(tool !== undefined, "multifile_edit_replace tool should exist");

  assert.deepEqual(tool.inputSchema.required, ["edits"], "should require edits");
});

test("web_fetch tool should require url [multi-step-tool-definitions]", () => {
  const tool = MULTI_STEP_TOOL_DEFINITIONS.find((t) => t.name === "web_fetch");
  assert.ok(tool !== undefined, "web_fetch tool should exist");

  assert.deepEqual(tool.inputSchema.required, ["url"], "should require url");
});

test("question tool should have question and context properties [multi-step-tool-definitions]", () => {
  const tool = MULTI_STEP_TOOL_DEFINITIONS.find((t) => t.name === "question");
  assert.ok(tool !== undefined, "question tool should exist");

  const props = tool.inputSchema.properties as Record<string, unknown>;
  assert.ok(props.question, "question tool should have question property");
  assert.ok(props.context, "question tool should have context property");
});
