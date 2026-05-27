import assert from "node:assert/strict";
import test from "node:test";

// Re-export test for barrel file
import {
  isToolCallSuccessful,
  type ToolCallStatus,
  type ToolCallErrorSource,
  type ToolCallError,
  type ToolCallResult,
} from "../../../../../src/platform/five-plane-execution/tool-executor/tool-call-result.js";

test("ToolCallStatus type accepts valid values [index]", () => {
  const statuses: ToolCallStatus[] = ["succeeded", "failed", "timed_out", "blocked", "cancelled"];
  assert.equal(statuses.length, 5);
});

test("ToolCallErrorSource type accepts valid values [index]", () => {
  const sources: ToolCallErrorSource[] = ["provider", "tool", "network", "security", "validation", "system"];
  assert.equal(sources.length, 6);
});

test("isToolCallSuccessful returns true for succeeded [index]", () => {
  assert.equal(isToolCallSuccessful("succeeded"), true);
});

test("isToolCallSuccessful returns false for other statuses [index]", () => {
  assert.equal(isToolCallSuccessful("failed"), false);
  assert.equal(isToolCallSuccessful("timed_out"), false);
  assert.equal(isToolCallSuccessful("blocked"), false);
  assert.equal(isToolCallSuccessful("cancelled"), false);
});

test("ToolCallError structure is correct [index]", () => {
  const error: ToolCallError = {
    code: "tool.execution_failed",
    message: "Tool execution failed",
    retryable: true,
    source: "tool",
  };
  assert.equal(error.code, "tool.execution_failed");
  assert.equal(error.retryable, true);
  assert.equal(error.source, "tool");
});

test("ToolCallResult structure is correct [index]", () => {
  const result: ToolCallResult<string> = {
    callId: "call_1",
    toolName: "read",
    status: "succeeded",
    success: true,
    output: "file content",
    data: null,
    metadata: null,
    artifacts: [],
    durationMs: 100,
    error: null,
    executionReceipt: "receipt_1",
  };
  assert.equal(result.callId, "call_1");
  assert.equal(result.toolName, "read");
  assert.equal(result.status, "succeeded");
  assert.equal(result.success, true);
});

test("ToolCallResult with error [index]", () => {
  const result: ToolCallResult<string> = {
    callId: "call_2",
    toolName: "read",
    status: "failed",
    success: false,
    output: "",
    data: null,
    metadata: null,
    artifacts: [],
    durationMs: 50,
    error: {
      code: "tool.execution_failed",
      message: "File not found",
      retryable: false,
      source: "tool",
    },
    executionReceipt: null,
  };
  assert.equal(result.status, "failed");
  assert.equal(result.success, false);
  assert.ok(result.error !== null);
  assert.equal(result.error!.code, "tool.execution_failed");
});
