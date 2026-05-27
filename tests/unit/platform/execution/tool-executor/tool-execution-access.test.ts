import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveExecutionAllowedTools,
  isExecutionToolAllowed,
  resolveExecutionAllowedPathRoots,
  type ExecutionAllowedToolsResolution,
  type ExecutionAllowedPathRootsResolution,
} from "../../../../../src/platform/five-plane-execution/tool-executor/tool-execution-access.js";

test("resolveExecutionAllowedTools uses request-level allowlist when provided [tool-execution-access]", () => {
  const result = resolveExecutionAllowedTools({
    execution: { allowedToolsJson: null },
    executionRequired: false,
    requestAllowedTools: ["tool_a", "tool_b"],
  });

  assert.deepEqual(result.allowedTools, ["tool_a", "tool_b"]);
  assert.equal(result.errorCode, null);
});

test("resolveExecutionAllowedTools returns undefined when no restrictions [tool-execution-access]", () => {
  const result = resolveExecutionAllowedTools({
    execution: null,
    executionRequired: false,
  });

  assert.equal(result.allowedTools, undefined);
  assert.equal(result.errorCode, null);
});

test("resolveExecutionAllowedTools returns error when execution required but missing [tool-execution-access]", () => {
  const result = resolveExecutionAllowedTools({
    execution: null,
    executionRequired: true,
  });

  assert.deepEqual(result.allowedTools, []);
  assert.equal(result.errorCode, "tool.execution_missing");
});

test("resolveExecutionAllowedTools parses execution-level allowlist [tool-execution-access]", () => {
  const result = resolveExecutionAllowedTools({
    execution: { allowedToolsJson: '["exec_tool_a","exec_tool_b"]' },
    executionRequired: true,
  });

  assert.deepEqual(result.allowedTools, ["exec_tool_a", "exec_tool_b"]);
  assert.equal(result.errorCode, null);
});

test("resolveExecutionAllowedTools returns error for invalid JSON [tool-execution-access]", () => {
  const result = resolveExecutionAllowedTools({
    execution: { allowedToolsJson: "not valid json" },
    executionRequired: true,
  });

  assert.deepEqual(result.allowedTools, []);
  assert.equal(result.errorCode, "tool.execution_allowed_tools_invalid");
});

test("resolveExecutionAllowedTools returns error for non-array JSON [tool-execution-access]", () => {
  const result = resolveExecutionAllowedTools({
    execution: { allowedToolsJson: '"just a string"' },
    executionRequired: true,
  });

  assert.deepEqual(result.allowedTools, []);
  assert.equal(result.errorCode, "tool.execution_allowed_tools_invalid");
});

test("resolveExecutionAllowedTools fail-closes on invalid stored allowlist [tool-execution-access]", () => {
  const result = resolveExecutionAllowedTools({
    execution: { allowedToolsJson: '["read", 1]' },
    executionRequired: true,
  });

  assert.deepEqual(result.allowedTools, []);
  assert.equal(isExecutionToolAllowed("read", result.allowedTools), false);
});

test("resolveExecutionAllowedTools normalizes whitespace in allowlist [tool-execution-access]", () => {
  const result = resolveExecutionAllowedTools({
    execution: { allowedToolsJson: null },
    executionRequired: false,
    requestAllowedTools: ["  tool_a  ", "tool_b", "  tool_a  "], // duplicate with whitespace
  });

  assert.deepEqual(result.allowedTools, ["tool_a", "tool_b"]);
});

test("resolveExecutionAllowedTools filters empty strings [tool-execution-access]", () => {
  const result = resolveExecutionAllowedTools({
    execution: { allowedToolsJson: null },
    executionRequired: false,
    requestAllowedTools: ["tool_a", "", "  ", "tool_b"],
  });

  assert.deepEqual(result.allowedTools, ["tool_a", "tool_b"]);
});

test("isExecutionToolAllowed returns true when allowlist is undefined [tool-execution-access]", () => {
  assert.equal(isExecutionToolAllowed("any_tool", undefined), true);
});

test("isExecutionToolAllowed returns true when tool is in allowlist [tool-execution-access]", () => {
  assert.equal(isExecutionToolAllowed("allowed_tool", ["allowed_tool", "other_tool"]), true);
});

test("isExecutionToolAllowed returns false when tool is not in allowlist [tool-execution-access]", () => {
  assert.equal(isExecutionToolAllowed("blocked_tool", ["allowed_tool"]), false);
});

test("isExecutionToolAllowed is case-sensitive [tool-execution-access]", () => {
  assert.equal(isExecutionToolAllowed("Tool_A", ["tool_a"]), false);
});

test("isExecutionToolAllowed handles empty allowlist [tool-execution-access]", () => {
  // Empty allowlist technically means no tools allowed, but undefined means all allowed
  assert.equal(isExecutionToolAllowed("any_tool", []), false);
});

test("resolveExecutionAllowedPathRoots uses request-level paths when provided [tool-execution-access]", () => {
  const result = resolveExecutionAllowedPathRoots({
    execution: { allowedPathsJson: null },
    executionRequired: false,
    requestAllowedPathRoots: ["/path/a", "/path/b"],
  });

  assert.ok(result.allowedPathRoots != null);
  // normalizeToolPathScopeRoots adds trailing separator
  assert.ok(result.allowedPathRoots!.some(p => p.startsWith("/path/a")));
  assert.equal(result.errorCode, null);
});

test("resolveExecutionAllowedPathRoots returns undefined when no restrictions [tool-execution-access]", () => {
  const result = resolveExecutionAllowedPathRoots({
    execution: null,
    executionRequired: false,
  });

  assert.equal(result.allowedPathRoots, undefined);
  assert.equal(result.errorCode, null);
});

test("resolveExecutionAllowedPathRoots returns error when execution required but missing [tool-execution-access]", () => {
  const result = resolveExecutionAllowedPathRoots({
    execution: null,
    executionRequired: true,
  });

  assert.equal(result.allowedPathRoots, undefined);
  assert.equal(result.errorCode, "tool.execution_missing");
});

test("resolveExecutionAllowedPathRoots parses execution-level paths [tool-execution-access]", () => {
  const result = resolveExecutionAllowedPathRoots({
    execution: { allowedPathsJson: '["/exec/path/a","/exec/path/b"]' },
    executionRequired: true,
  });

  assert.ok(result.allowedPathRoots != null);
  // normalizeToolPathScopeRoots adds trailing separator
  assert.ok(result.allowedPathRoots!.some(p => p.startsWith("/exec/path/a")));
  assert.equal(result.errorCode, null);
});

test("resolveExecutionAllowedPathRoots returns error for invalid JSON [tool-execution-access]", () => {
  const result = resolveExecutionAllowedPathRoots({
    execution: { allowedPathsJson: "invalid json" },
    executionRequired: true,
  });

  assert.equal(result.allowedPathRoots, undefined);
  assert.equal(result.errorCode, "tool.execution_allowed_paths_invalid");
});

test("ExecutionAllowedToolsResolution interface structure [tool-execution-access]", () => {
  const result: ExecutionAllowedToolsResolution = {
    allowedTools: ["tool1", "tool2"],
    errorCode: null,
  };

  assert.deepEqual(result.allowedTools, ["tool1", "tool2"]);
  assert.equal(result.errorCode, null);
});

test("ExecutionAllowedToolsResolution interface with undefined allowedTools [tool-execution-access]", () => {
  const result: ExecutionAllowedToolsResolution = {
    allowedTools: undefined,
    errorCode: null,
  };

  assert.equal(result.allowedTools, undefined);
});

test("ExecutionAllowedPathRootsResolution interface structure [tool-execution-access]", () => {
  const result: ExecutionAllowedPathRootsResolution = {
    allowedPathRoots: ["/root/a", "/root/b"],
    errorCode: null,
  };

  assert.deepEqual(result.allowedPathRoots, ["/root/a", "/root/b"]);
});
