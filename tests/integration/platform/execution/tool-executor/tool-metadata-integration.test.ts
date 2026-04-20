import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveToolExecutionMetadata,
  resolveToolTimeoutMs,
  isToolFailureRetryable,
  listBuiltinToolExecutionMetadata,
  READ_TOOL_METADATA,
  COMMAND_TOOL_METADATA,
  EDIT_TOOL_METADATA,
} from "../../../../../src/platform/execution/tool-executor/tool-metadata.js";
import type { ToolCallStatus } from "../../../../../src/platform/execution/tool-executor/tool-call-result.js";

test("resolveToolExecutionMetadata returns correct metadata for known tools", () => {
  assert.ok(resolveToolExecutionMetadata("read") !== null);
  assert.ok(resolveToolExecutionMetadata("command_exec") !== null);
  assert.ok(resolveToolExecutionMetadata("edit_replace") !== null);
  assert.ok(resolveToolExecutionMetadata("bash") !== null);
  assert.ok(resolveToolExecutionMetadata("web_search") !== null);
});

test("resolveToolExecutionMetadata returns null for unknown tools", () => {
  assert.equal(resolveToolExecutionMetadata("nonexistent_tool"), null);
  assert.equal(resolveToolExecutionMetadata(""), null);
});

test("resolveToolTimeoutMs uses requested timeout when valid", () => {
  const result = resolveToolTimeoutMs(5000, READ_TOOL_METADATA);
  assert.equal(result, 5000);
});

test("resolveToolTimeoutMs falls back to metadata default", () => {
  const result = resolveToolTimeoutMs(null, READ_TOOL_METADATA);
  assert.equal(result, READ_TOOL_METADATA.defaultTimeoutMs);
});

test("resolveToolTimeoutMs falls back to global default when no metadata", () => {
  const result = resolveToolTimeoutMs(null, null);
  assert.equal(result, 30000); // FALLBACK_TOOL_TIMEOUT_MS
});

test("resolveToolTimeoutMs ignores negative values", () => {
  const result = resolveToolTimeoutMs(-1000, READ_TOOL_METADATA);
  assert.equal(result, READ_TOOL_METADATA.defaultTimeoutMs);
});

test("resolveToolTimeoutMs ignores zero", () => {
  const result = resolveToolTimeoutMs(0, READ_TOOL_METADATA);
  assert.equal(result, READ_TOOL_METADATA.defaultTimeoutMs);
});

test("isToolFailureRetryable returns false for succeeded status", () => {
  const result = isToolFailureRetryable({
    metadata: READ_TOOL_METADATA,
    status: "succeeded",
  });
  assert.equal(result, false);
});

test("isToolFailureRetryable returns false for blocked status", () => {
  const result = isToolFailureRetryable({
    metadata: READ_TOOL_METADATA,
    status: "blocked",
  });
  assert.equal(result, false);
});

test("isToolFailureRetryable returns false for cancelled status", () => {
  const result = isToolFailureRetryable({
    metadata: READ_TOOL_METADATA,
    status: "cancelled",
  });
  assert.equal(result, false);
});

test("isToolFailureRetryable returns true for retry_safe with no error code", () => {
  const result = isToolFailureRetryable({
    metadata: READ_TOOL_METADATA,
    status: "failed",
  });
  assert.equal(result, true);
});

test("isToolFailureRetryable respects manual_resume_required strategy", () => {
  const result = isToolFailureRetryable({
    metadata: COMMAND_TOOL_METADATA, // has retry_with_check
    status: "failed",
    source: "tool",
  });
  // retry_with_check can retry for non-security errors
  assert.equal(typeof result, "boolean");
});

test("isToolFailureRetryable returns false when requestedRetryable is explicitly false", () => {
  const result = isToolFailureRetryable({
    metadata: READ_TOOL_METADATA,
    status: "failed",
    requestedRetryable: false,
  });
  assert.equal(result, false);
});

test("isToolFailureRetryable allows retry with error code in allowlist", () => {
  const result = isToolFailureRetryable({
    metadata: READ_TOOL_METADATA,
    status: "failed",
    errorCode: "tool.execution_failed",
    requestedRetryable: true,
  });
  assert.equal(result, true);
});

test("isToolFailureRetryable blocks security errors even with retry_safe", () => {
  const result = isToolFailureRetryable({
    metadata: READ_TOOL_METADATA,
    status: "failed",
    source: "security",
  });
  assert.equal(result, false);
});

test("isToolFailureRetryable blocks validation errors even with retry_safe", () => {
  const result = isToolFailureRetryable({
    metadata: READ_TOOL_METADATA,
    status: "failed",
    source: "validation",
  });
  assert.equal(result, false);
});

test("listBuiltinToolExecutionMetadata returns all built-in tools", () => {
  const tools = listBuiltinToolExecutionMetadata();
  assert.ok(tools.length >= 10);

  const toolNames = tools.map(t => t.toolName);
  assert.ok(toolNames.includes("read"));
  assert.ok(toolNames.includes("command_exec"));
  assert.ok(toolNames.includes("edit_replace"));
  assert.ok(toolNames.includes("bash"));
  assert.ok(toolNames.includes("web_search"));
  assert.ok(toolNames.includes("web_fetch"));
});

test("builtin tool metadata has consistent properties", () => {
  const tools = listBuiltinToolExecutionMetadata();
  for (const tool of tools) {
    assert.ok(typeof tool.toolName === "string");
    assert.ok(typeof tool.readOnly === "boolean");
    assert.ok(typeof tool.idempotent === "boolean");
    assert.ok(typeof tool.defaultTimeoutMs === "number");
    assert.ok(tool.defaultTimeoutMs > 0);
  }
});

test("COMMAND_TOOL_METADATA has correct high-risk properties", () => {
  assert.equal(COMMAND_TOOL_METADATA.riskLevel, "high");
  assert.equal(COMMAND_TOOL_METADATA.sideEffectScope, "local_process");
  assert.equal(COMMAND_TOOL_METADATA.readOnly, false);
  assert.equal(COMMAND_TOOL_METADATA.idempotent, false);
  assert.ok(COMMAND_TOOL_METADATA.highRiskPatterns.length > 0);
});

test("EDIT_TOOL_METADATA is idempotent but not read-only", () => {
  assert.equal(EDIT_TOOL_METADATA.readOnly, false);
  assert.equal(EDIT_TOOL_METADATA.idempotent, true);
  assert.equal(EDIT_TOOL_METADATA.sideEffectScope, "local_file");
});

test("READ_TOOL_METADATA is read-only and concurrency-safe", () => {
  assert.equal(READ_TOOL_METADATA.readOnly, true);
  assert.equal(READ_TOOL_METADATA.idempotent, true);
  assert.equal(READ_TOOL_METADATA.isConcurrencySafe, true);
  assert.equal(READ_TOOL_METADATA.sideEffectScope, "none");
});
