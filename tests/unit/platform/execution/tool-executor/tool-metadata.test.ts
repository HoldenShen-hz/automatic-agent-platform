import assert from "node:assert/strict";
import test from "node:test";

import {
  listBuiltinToolExecutionMetadata,
  resolveToolExecutionMetadata,
  resolveToolTimeoutMs,
  isToolFailureRetryable,
  COMMAND_TOOL_METADATA,
  EDIT_TOOL_METADATA,
  READ_TOOL_METADATA,
  BASH_TOOL_METADATA,
  QUESTION_TOOL_METADATA,
  TODO_WRITE_TOOL_METADATA,
  WEB_SEARCH_TOOL_METADATA,
} from "../../../../../src/platform/execution/tool-executor/tool-metadata.js";

test("listBuiltinToolExecutionMetadata returns all built-in tools", () => {
  const metadata = listBuiltinToolExecutionMetadata();

  assert.ok(metadata.length >= 8);
  const toolNames = metadata.map((m) => m.toolName);
  assert.ok(toolNames.includes("command_exec"));
  assert.ok(toolNames.includes("edit_replace"));
  assert.ok(toolNames.includes("read"));
  assert.ok(toolNames.includes("bash"));
});

test("resolveToolExecutionMetadata returns metadata for known tool", () => {
  const metadata = resolveToolExecutionMetadata("command_exec");

  assert.ok(metadata !== null);
  assert.equal(metadata!.toolName, "command_exec");
  assert.equal(metadata!.riskLevel, "high");
});

test("resolveToolExecutionMetadata returns null for unknown tool", () => {
  const metadata = resolveToolExecutionMetadata("nonexistent_tool");

  assert.equal(metadata, null);
});

test("resolveToolTimeoutMs uses request timeout when valid", () => {
  const result = resolveToolTimeoutMs(5000, null);

  assert.equal(result, 5000);
});

test("resolveToolTimeoutMs uses metadata default when no request timeout", () => {
  const result = resolveToolTimeoutMs(undefined, READ_TOOL_METADATA);

  assert.equal(result, READ_TOOL_METADATA.defaultTimeoutMs);
});

test("resolveToolTimeoutMs uses fallback when no request or metadata", () => {
  const result = resolveToolTimeoutMs(undefined, null);

  assert.equal(result, 30000);
});

test("resolveToolTimeoutMs ignores invalid request timeout", () => {
  const result = resolveToolTimeoutMs(-1000, READ_TOOL_METADATA);

  assert.equal(result, READ_TOOL_METADATA.defaultTimeoutMs);
});

test("resolveToolTimeoutMs ignores zero request timeout", () => {
  const result = resolveToolTimeoutMs(0, READ_TOOL_METADATA);

  assert.equal(result, READ_TOOL_METADATA.defaultTimeoutMs);
});

test("resolveToolTimeoutMs ignores NaN request timeout", () => {
  const result = resolveToolTimeoutMs(NaN, READ_TOOL_METADATA);

  assert.equal(result, READ_TOOL_METADATA.defaultTimeoutMs);
});

test("resolveToolTimeoutMs clamps to minimum of 1", () => {
  const result = resolveToolTimeoutMs(0.5, null);

  assert.equal(result, 1);
});

test("COMMAND_TOOL_METADATA has correct high-risk properties", () => {
  assert.equal(COMMAND_TOOL_METADATA.toolName, "command_exec");
  assert.equal(COMMAND_TOOL_METADATA.riskLevel, "high");
  assert.equal(COMMAND_TOOL_METADATA.readOnly, false);
  assert.equal(COMMAND_TOOL_METADATA.idempotent, false);
  assert.equal(COMMAND_TOOL_METADATA.sideEffectScope, "local_process");
  assert.ok(COMMAND_TOOL_METADATA.highRiskPatterns.length > 0);
});

test("EDIT_TOOL_METADATA has correct properties", () => {
  assert.equal(EDIT_TOOL_METADATA.toolName, "edit_replace");
  assert.equal(EDIT_TOOL_METADATA.riskLevel, "high");
  assert.equal(EDIT_TOOL_METADATA.idempotent, true);
  assert.equal(EDIT_TOOL_METADATA.sideEffectScope, "local_file");
  assert.equal(EDIT_TOOL_METADATA.needsFileLock, "write");
});

test("READ_TOOL_METADATA has correct low-risk properties", () => {
  assert.equal(READ_TOOL_METADATA.toolName, "read");
  assert.equal(READ_TOOL_METADATA.riskLevel, "low");
  assert.equal(READ_TOOL_METADATA.readOnly, true);
  assert.equal(READ_TOOL_METADATA.sideEffectScope, "none");
  assert.equal(READ_TOOL_METADATA.isConcurrencySafe, true);
});

test("BASH_TOOL_METADATA is alias for command_exec", () => {
  assert.equal(BASH_TOOL_METADATA.toolName, "bash");
  assert.equal(BASH_TOOL_METADATA.riskLevel, "high");
  assert.equal(BASH_TOOL_METADATA.sideEffectScope, "local_process");
});

test("QUESTION_TOOL_METADATA has correct properties", () => {
  assert.equal(QUESTION_TOOL_METADATA.toolName, "question");
  assert.equal(QUESTION_TOOL_METADATA.riskLevel, "low");
  assert.equal(QUESTION_TOOL_METADATA.readOnly, true);
  assert.equal(QUESTION_TOOL_METADATA.recoveryStrategy, "retry_safe");
});

test("TODO_WRITE_TOOL_METADATA has correct medium-risk properties", () => {
  assert.equal(TODO_WRITE_TOOL_METADATA.toolName, "todo_write");
  assert.equal(TODO_WRITE_TOOL_METADATA.riskLevel, "medium");
  assert.equal(TODO_WRITE_TOOL_METADATA.sideEffectScope, "org_state");
  assert.equal(TODO_WRITE_TOOL_METADATA.recoveryStrategy, "manual_resume_required");
});

test("WEB_SEARCH_TOOL_METADATA has correct properties", () => {
  assert.equal(WEB_SEARCH_TOOL_METADATA.toolName, "web_search");
  assert.equal(WEB_SEARCH_TOOL_METADATA.riskLevel, "medium");
  assert.equal(WEB_SEARCH_TOOL_METADATA.sideEffectScope, "remote_api");
  assert.equal(WEB_SEARCH_TOOL_METADATA.supportsCancellation, true);
});

test("isToolFailureRetryable returns false for succeeded status", () => {
  const result = isToolFailureRetryable({
    metadata: COMMAND_TOOL_METADATA,
    status: "succeeded",
  });

  assert.equal(result, false);
});

test("isToolFailureRetryable returns false for blocked status", () => {
  const result = isToolFailureRetryable({
    metadata: COMMAND_TOOL_METADATA,
    status: "blocked",
  });

  assert.equal(result, false);
});

test("isToolFailureRetryable returns false for cancelled status", () => {
  const result = isToolFailureRetryable({
    metadata: COMMAND_TOOL_METADATA,
    status: "cancelled",
  });

  assert.equal(result, false);
});

test("isToolFailureRetryable returns false when manual_resume_required", () => {
  const result = isToolFailureRetryable({
    metadata: TODO_WRITE_TOOL_METADATA,
    status: "failed",
    errorCode: "tool.execution_failed",
  });

  assert.equal(result, false);
});

test("isToolFailureRetryable returns true for retry_safe with non-security error", () => {
  const result = isToolFailureRetryable({
    metadata: READ_TOOL_METADATA,
    status: "failed",
    errorCode: "tool.execution_failed",
    source: "provider",
  });

  assert.equal(result, true);
});

test("isToolFailureRetryable returns false for security source with retry_safe", () => {
  const result = isToolFailureRetryable({
    metadata: READ_TOOL_METADATA,
    status: "failed",
    errorCode: "unknown_error",
    source: "security",
  });

  assert.equal(result, false);
});

test("isToolFailureRetryable respects retryableErrorCodes allowlist", () => {
  const result = isToolFailureRetryable({
    metadata: COMMAND_TOOL_METADATA,
    status: "failed",
    errorCode: "tool.timeout",
  });

  assert.equal(result, true);
});

test("isToolFailureRetryable rejects when requestedRetryable is false", () => {
  const result = isToolFailureRetryable({
    metadata: READ_TOOL_METADATA,
    status: "failed",
    errorCode: "tool.execution_failed",
    requestedRetryable: false,
  });

  assert.equal(result, false);
});

test("isToolFailureRetryable allows when requestedRetryable is true and error code in allowlist", () => {
  const result = isToolFailureRetryable({
    metadata: null,
    status: "failed",
    errorCode: "tool.timeout",
    requestedRetryable: true,
  });

  assert.equal(result, true);
});

test("isToolFailureRetryable blocks retry for sandbox errors", () => {
  const result = isToolFailureRetryable({
    metadata: COMMAND_TOOL_METADATA,
    status: "failed",
    errorCode: "sandbox.access_denied",
    requestedRetryable: true,
  });

  assert.equal(result, false);
});

test("isToolFailureRetryable blocks retry for validation errors", () => {
  const result = isToolFailureRetryable({
    metadata: COMMAND_TOOL_METADATA,
    status: "failed",
    errorCode: "validation.invalid_input",
    requestedRetryable: true,
  });

  assert.equal(result, false);
});
