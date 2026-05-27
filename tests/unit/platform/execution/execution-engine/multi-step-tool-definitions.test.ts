/**
 * Unit Tests: Multi-Step Tool Definitions
 *
 * Tests for getMultiStepToolDefinitions function.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  getMultiStepToolDefinitions,
  MULTI_STEP_TOOL_DEFINITIONS,
} from "../../../../../src/platform/five-plane-execution/execution-engine/multi-step-tool-definitions.js";

test("getMultiStepToolDefinitions returns all tools when filter matches all [multi-step-tool-definitions]", () => {
  const allToolNames = MULTI_STEP_TOOL_DEFINITIONS.map((t) => t.name);
  const result = getMultiStepToolDefinitions(allToolNames);
  assert.equal(result.length, MULTI_STEP_TOOL_DEFINITIONS.length);
});

test("getMultiStepToolDefinitions returns matching tools by name [multi-step-tool-definitions]", () => {
  const result = getMultiStepToolDefinitions(["read", "write"]);
  assert.equal(result.length, 2);
  assert.ok(result.every((tool) => ["read", "write"].includes(tool.name)));
});

test("getMultiStepToolDefinitions returns empty array for non-existent tool [multi-step-tool-definitions]", () => {
  const result = getMultiStepToolDefinitions(["non_existent_tool"]);
  assert.equal(result.length, 0);
});

test("getMultiStepToolDefinitions handles single tool [multi-step-tool-definitions]", () => {
  const result = getMultiStepToolDefinitions(["todo_write"]);
  assert.equal(result.length, 1);
  assert.equal(result[0]!.name, "todo_write");
});

test("getMultiStepToolDefinitions preserves tool definition structure [multi-step-tool-definitions]", () => {
  const result = getMultiStepToolDefinitions(["question"]);
  assert.equal(result.length, 1);
  const tool = result[0]!;
  assert.ok(typeof tool.name === "string");
  assert.ok(typeof tool.description === "string");
  assert.ok(typeof tool.inputSchema === "object");
});

test("getMultiStepToolDefinitions handles duplicate names in filter [multi-step-tool-definitions]", () => {
  const result = getMultiStepToolDefinitions(["read", "read", "write"]);
  assert.equal(result.length, 2);
});

test("getMultiStepToolDefinitions returns tools with correct inputSchema [multi-step-tool-definitions]", () => {
  const result = getMultiStepToolDefinitions(["git"]);
  assert.equal(result.length, 1);
  const tool = result[0]!;
  assert.ok(tool.inputSchema.properties);
  assert.ok(tool.inputSchema.required);
});

test("MULTI_STEP_TOOL_DEFINITIONS contains expected tools [multi-step-tool-definitions]", () => {
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

test("MULTI_STEP_TOOL_DEFINITIONS tools have required properties [multi-step-tool-definitions]", () => {
  for (const tool of MULTI_STEP_TOOL_DEFINITIONS) {
    assert.ok(tool.name.length > 0, "Tool name should not be empty");
    assert.ok(tool.description.length > 0, "Tool description should not be empty");
    assert.ok(tool.inputSchema, "Tool should have inputSchema");
  }
});

test("MULTI_STEP_TOOL_DEFINITIONS tools have valid inputSchema structure [multi-step-tool-definitions]", () => {
  for (const tool of MULTI_STEP_TOOL_DEFINITIONS) {
    assert.equal(tool.inputSchema.type, "object", `Tool ${tool.name} should have object inputSchema`);
    assert.ok(typeof tool.inputSchema.properties === "object", `Tool ${tool.name} should have properties object`);
  }
});

test("MULTI_STEP_TOOL_DEFINITIONS git tool has correct required fields [multi-step-tool-definitions]", () => {
  const gitTool = MULTI_STEP_TOOL_DEFINITIONS.find((t) => t.name === "git");
  assert.ok(gitTool, "git tool should exist");
  assert.deepEqual(gitTool.inputSchema.required, ["args"], "git tool should require args");
});

test("MULTI_STEP_TOOL_DEFINITIONS web_search tool has correct required fields [multi-step-tool-definitions]", () => {
  const webSearchTool = MULTI_STEP_TOOL_DEFINITIONS.find((t) => t.name === "web_search");
  assert.ok(webSearchTool, "web_search tool should exist");
  assert.deepEqual(webSearchTool.inputSchema.required, ["query"], "web_search tool should require query");
});

test("MULTI_STEP_TOOL_DEFINITIONS web_fetch tool has correct required fields [multi-step-tool-definitions]", () => {
  const webFetchTool = MULTI_STEP_TOOL_DEFINITIONS.find((t) => t.name === "web_fetch");
  assert.ok(webFetchTool, "web_fetch tool should exist");
  assert.deepEqual(webFetchTool.inputSchema.required, ["url"], "web_fetch tool should require url");
});

test("MULTI_STEP_TOOL_DEFINITIONS edit_replace tool has correct required fields [multi-step-tool-definitions]", () => {
  const editTool = MULTI_STEP_TOOL_DEFINITIONS.find((t) => t.name === "edit_replace");
  assert.ok(editTool, "edit_replace tool should exist");
  assert.ok(editTool.inputSchema.required.includes("filePath"), "edit_replace should require filePath");
  assert.ok(editTool.inputSchema.required.includes("oldString"), "edit_replace should require oldString");
  assert.ok(editTool.inputSchema.required.includes("newString"), "edit_replace should require newString");
});

test("MULTI_STEP_TOOL_DEFINITIONS spawn-agent tool allows additionalProperties [multi-step-tool-definitions]", () => {
  const spawnTool = MULTI_STEP_TOOL_DEFINITIONS.find((t) => t.name === "spawn-agent");
  assert.ok(spawnTool, "spawn-agent tool should exist");
  assert.strictEqual(spawnTool.inputSchema.additionalProperties, true, "spawn-agent should allow additional properties");
});

test("MULTI_STEP_TOOL_DEFINITIONS read tool has correct properties [multi-step-tool-definitions]", () => {
  const readTool = MULTI_STEP_TOOL_DEFINITIONS.find((t) => t.name === "read");
  assert.ok(readTool, "read tool should exist");
  assert.ok(readTool.inputSchema.required.includes("path"), "read should require path");
  assert.ok(readTool.inputSchema.properties.path, "read should have path property");
  assert.ok(readTool.inputSchema.properties.offset, "read should have offset property");
  assert.ok(readTool.inputSchema.properties.limit, "read should have limit property");
});

test("MULTI_STEP_TOOL_DEFINITIONS write tool has correct properties [multi-step-tool-definitions]", () => {
  const writeTool = MULTI_STEP_TOOL_DEFINITIONS.find((t) => t.name === "write");
  assert.ok(writeTool, "write tool should exist");
  assert.ok(writeTool.inputSchema.required.includes("path"), "write should require path");
  assert.ok(writeTool.inputSchema.required.includes("content"), "write should require content");
  assert.ok(writeTool.inputSchema.properties.path, "write should have path property");
  assert.ok(writeTool.inputSchema.properties.content, "write should have content property");
  assert.ok(writeTool.inputSchema.properties.append, "write should have append property");
});

test("MULTI_STEP_TOOL_DEFINITIONS grep tool has correct properties [multi-step-tool-definitions]", () => {
  const grepTool = MULTI_STEP_TOOL_DEFINITIONS.find((t) => t.name === "grep");
  assert.ok(grepTool, "grep tool should exist");
  assert.ok(grepTool.inputSchema.required.includes("pattern"), "grep should require pattern");
  assert.ok(grepTool.inputSchema.required.includes("path"), "grep should require path");
  assert.ok(grepTool.inputSchema.properties.pattern, "grep should have pattern property");
  assert.ok(grepTool.inputSchema.properties.path, "grep should have path property");
  assert.ok(grepTool.inputSchema.properties.isRegex, "grep should have isRegex property");
  assert.ok(grepTool.inputSchema.properties.caseSensitive, "grep should have caseSensitive property");
  assert.ok(grepTool.inputSchema.properties.matchAll, "grep should have matchAll property");
});

test("MULTI_STEP_TOOL_DEFINITIONS glob tool has correct properties [multi-step-tool-definitions]", () => {
  const globTool = MULTI_STEP_TOOL_DEFINITIONS.find((t) => t.name === "glob");
  assert.ok(globTool, "glob tool should exist");
  assert.ok(globTool.inputSchema.required.includes("pattern"), "glob should require pattern");
  assert.ok(globTool.inputSchema.properties.pattern, "glob should have pattern property");
  assert.ok(globTool.inputSchema.properties.basePath, "glob should have basePath property");
});

test("MULTI_STEP_TOOL_DEFINITIONS repo_map tool has correct properties [multi-step-tool-definitions]", () => {
  const repoMapTool = MULTI_STEP_TOOL_DEFINITIONS.find((t) => t.name === "repo-map");
  assert.ok(repoMapTool, "repo-map tool should exist");
  assert.ok(repoMapTool.inputSchema.required.includes("query"), "repo-map should require query");
  assert.ok(repoMapTool.inputSchema.properties.query, "repo-map should have query property");
  assert.ok(repoMapTool.inputSchema.properties.rootPath, "repo-map should have rootPath property");
  assert.ok(repoMapTool.inputSchema.properties.currentFile, "repo-map should have currentFile property");
  assert.ok(repoMapTool.inputSchema.properties.limit, "repo-map should have limit property");
});

test("MULTI_STEP_TOOL_DEFINITIONS todo_write tool has correct properties [multi-step-tool-definitions]", () => {
  const todoTool = MULTI_STEP_TOOL_DEFINITIONS.find((t) => t.name === "todo_write");
  assert.ok(todoTool, "todo_write tool should exist");
  assert.ok(todoTool.inputSchema.properties.operation, "todo_write should have operation property");
  assert.ok(todoTool.inputSchema.properties.sessionId, "todo_write should have sessionId property");
  assert.ok(todoTool.inputSchema.properties.todoId, "todo_write should have todoId property");
  assert.ok(todoTool.inputSchema.properties.title, "todo_write should have title property");
  assert.ok(todoTool.inputSchema.properties.description, "todo_write should have description property");
  assert.ok(todoTool.inputSchema.properties.status, "todo_write should have status property");
  assert.ok(todoTool.inputSchema.properties.priority, "todo_write should have priority property");
});

test("MULTI_STEP_TOOL_DEFINITIONS question tool has correct properties [multi-step-tool-definitions]", () => {
  const questionTool = MULTI_STEP_TOOL_DEFINITIONS.find((t) => t.name === "question");
  assert.ok(questionTool, "question tool should exist");
  assert.ok(questionTool.inputSchema.properties.question, "question should have question property");
  assert.ok(questionTool.inputSchema.properties.context, "question should have context property");
});

test("MULTI_STEP_TOOL_DEFINITIONS batch_edit_replace tool has correct properties [multi-step-tool-definitions]", () => {
  const batchEditTool = MULTI_STEP_TOOL_DEFINITIONS.find((t) => t.name === "batch_edit_replace");
  assert.ok(batchEditTool, "batch_edit_replace tool should exist");
  assert.ok(batchEditTool.inputSchema.required.includes("filePath"), "batch_edit_replace should require filePath");
  assert.ok(batchEditTool.inputSchema.required.includes("edits"), "batch_edit_replace should require edits");
});

test("MULTI_STEP_TOOL_DEFINITIONS multifile_edit_replace tool has correct properties [multi-step-tool-definitions]", () => {
  const multiFileTool = MULTI_STEP_TOOL_DEFINITIONS.find((t) => t.name === "multifile_edit_replace");
  assert.ok(multiFileTool, "multifile_edit_replace tool should exist");
  assert.ok(multiFileTool.inputSchema.required.includes("edits"), "multifile_edit_replace should require edits");
});

test("getMultiStepToolDefinitions handles empty string in toolNames array [multi-step-tool-definitions]", () => {
  const result = getMultiStepToolDefinitions(["read", "", "write"]);
  assert.equal(result.length, 2, "Should return only matching tools");
});

test("getMultiStepToolDefinitions handles whitespace-only strings in toolNames array [multi-step-tool-definitions]", () => {
  const result = getMultiStepToolDefinitions(["read", "   ", "write"]);
  assert.equal(result.length, 2, "Should filter out whitespace-only strings");
});

test("getMultiStepToolDefinitions returns tools in original order [multi-step-tool-definitions]", () => {
  const result = getMultiStepToolDefinitions(["write", "read", "edit_replace"]);
  assert.equal(result[0]!.name, "edit_replace");
  assert.equal(result[1]!.name, "read");
  assert.equal(result[2]!.name, "write");
});

test("MULTI_STEP_TOOL_DEFINITIONS contains 14 tools [multi-step-tool-definitions]", () => {
  assert.equal(MULTI_STEP_TOOL_DEFINITIONS.length, 14, "Should have exactly 14 tools defined");
});

test("MULTI_STEP_TOOL_DEFINITIONS tools have unique names [multi-step-tool-definitions]", () => {
  const names = MULTI_STEP_TOOL_DEFINITIONS.map((t) => t.name);
  const uniqueNames = new Set(names);
  assert.equal(uniqueNames.size, names.length, "All tool names should be unique");
});
