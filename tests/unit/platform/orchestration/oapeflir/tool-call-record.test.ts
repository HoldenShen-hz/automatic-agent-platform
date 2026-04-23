import assert from "node:assert/strict";
import test from "node:test";

import type { ToolCallRecord } from "../../../../../src/platform/orchestration/oapeflir/tool-call-record.js";

function createToolCallRecord(overrides: Partial<ToolCallRecord> = {}): ToolCallRecord {
  return {
    callId: "call-1",
    toolName: "test-tool",
    inputArgs: { arg1: "value1" },
    rawOutput: "raw output",
    parsedOutput: { result: "success" },
    success: true,
    errorCode: null,
    errorMessage: null,
    durationMs: 100,
    tokenUsage: { input: 50, output: 100 },
    sandboxViolation: false,
    retryAttempt: 0,
    outputRef: null,
    ...overrides,
  };
}

test("ToolCallRecord has all required fields", () => {
  const record = createToolCallRecord();
  assert.equal(record.callId, "call-1");
  assert.equal(record.toolName, "test-tool");
  assert.deepEqual(record.inputArgs, { arg1: "value1" });
  assert.equal(record.rawOutput, "raw output");
  assert.deepEqual(record.parsedOutput, { result: "success" });
  assert.equal(record.success, true);
  assert.equal(record.errorCode, null);
  assert.equal(record.errorMessage, null);
  assert.equal(record.durationMs, 100);
  assert.deepEqual(record.tokenUsage, { input: 50, output: 100 });
  assert.equal(record.sandboxViolation, false);
  assert.equal(record.retryAttempt, 0);
  assert.equal(record.outputRef, null);
});

test("ToolCallRecord captures failed call", () => {
  const record = createToolCallRecord({
    success: false,
    errorCode: "ERR_TOOL_NOT_FOUND",
    errorMessage: "Tool not found: unknown-tool",
    parsedOutput: null,
  });

  assert.equal(record.success, false);
  assert.equal(record.errorCode, "ERR_TOOL_NOT_FOUND");
  assert.equal(record.errorMessage, "Tool not found: unknown-tool");
  assert.equal(record.parsedOutput, null);
});

test("ToolCallRecord captures retry attempt", () => {
  const record = createToolCallRecord({
    retryAttempt: 2,
    durationMs: 250,
  });

  assert.equal(record.retryAttempt, 2);
  assert.equal(record.durationMs, 250);
});

test("ToolCallRecord captures sandbox violation", () => {
  const record = createToolCallRecord({
    sandboxViolation: true,
  });

  assert.equal(record.sandboxViolation, true);
});

test("ToolCallRecord with output ref", () => {
  const outputRef = "artifact:code-1";
  const record = createToolCallRecord({
    outputRef,
  });

  assert.equal(record.outputRef, outputRef);
});

test("ToolCallRecord with empty input args", () => {
  const record = createToolCallRecord({
    inputArgs: {},
  });

  assert.deepEqual(record.inputArgs, {});
});

test("ToolCallRecord with complex parsed output", () => {
  const record = createToolCallRecord({
    parsedOutput: {
      items: [{ id: "1" }, { id: "2" }],
      count: 2,
      metadata: { source: "test" },
    },
  });

  assert.deepEqual(record.parsedOutput, {
    items: [{ id: "1" }, { id: "2" }],
    count: 2,
    metadata: { source: "test" },
  });
});