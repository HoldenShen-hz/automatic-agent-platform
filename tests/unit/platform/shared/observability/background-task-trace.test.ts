import test from "node:test";
import assert from "node:assert/strict";

import {
  createBackgroundTaskTraceContext,
  type BackgroundTaskTraceContext,
} from "../../../../../src/platform/shared/observability/background-task-trace.js";

test("createBackgroundTaskTraceContext generates valid context", () => {
  const context = createBackgroundTaskTraceContext("test-operation");

  assert.ok(typeof context.traceId === "string");
  assert.ok(context.traceId.length > 0);
  assert.ok(typeof context.correlationId === "string");
  assert.ok(context.correlationId.length > 0);
  assert.ok(context.correlationId.startsWith("test-operation:"));
});

test("createBackgroundTaskTraceContext includes parts in correlationId", () => {
  const context = createBackgroundTaskTraceContext("task-execution", ["task-123", "step-5"]);

  assert.ok(context.correlationId.includes("task-123"));
  assert.ok(context.correlationId.includes("step-5"));
  assert.ok(context.correlationId.startsWith("task-execution:"));
});

test("createBackgroundTaskTraceContext filters null parts", () => {
  const context = createBackgroundTaskTraceContext("operation", ["valid", null, undefined, "", "  ", "another"]);

  assert.ok(context.correlationId.includes("valid"));
  assert.ok(context.correlationId.includes("another"));
  assert.ok(!context.correlationId.includes("null"));
  assert.ok(!context.correlationId.includes("undefined"));
});

test("createBackgroundTaskTraceContext filters empty string parts", () => {
  const context = createBackgroundTaskTraceContext("op", ["", "value", ""]);

  assert.ok(context.correlationId.includes("value"));
  assert.ok(context.correlationId.split(":").length === 3); // op, value, and possibly empty filtered
});

test("createBackgroundTaskTraceContext filters whitespace-only parts", () => {
  const context = createBackgroundTaskTraceContext("op", ["  ", "value", "  "]);

  assert.ok(context.correlationId.includes("value"));
  assert.ok(!context.correlationId.includes("  "));
});

test("createBackgroundTaskTraceContext handles empty parts array", () => {
  const context = createBackgroundTaskTraceContext("operation", []);

  assert.ok(context.correlationId === "operation");
});

test("createBackgroundTaskTraceContext handles all null parts", () => {
  const context = createBackgroundTaskTraceContext("operation", [null, null, null]);

  assert.ok(context.correlationId === "operation");
});

test("createBackgroundTaskTraceContext trims part values", () => {
  const context = createBackgroundTaskTraceContext("op", ["  trimmed  "]);

  assert.ok(context.correlationId.includes("trimmed"));
  assert.ok(!context.correlationId.includes("  "));
});

test("createBackgroundTaskTraceContext traceId starts with trace prefix", () => {
  const context = createBackgroundTaskTraceContext("test");

  assert.ok(context.traceId.startsWith("trace_"));
});

test("createBackgroundTaskTraceContext generates unique traceIds", () => {
  const context1 = createBackgroundTaskTraceContext("test");
  const context2 = createBackgroundTaskTraceContext("test");

  assert.notStrictEqual(context1.traceId, context2.traceId);
});

test("createBackgroundTaskTraceContext correlationId format", () => {
  const context = createBackgroundTaskTraceContext("complex-operation", ["part1", "part2", "part3"]);

  const parts = context.correlationId.split(":");
  assert.strictEqual(parts[0], "complex-operation");
  assert.strictEqual(parts.length, 4); // operation + 3 parts
});

test("BackgroundTaskTraceContext interface structure", () => {
  const context: BackgroundTaskTraceContext = {
    traceId: "trace_abc123",
    correlationId: "operation:part1:part2",
  };

  assert.strictEqual(typeof context.traceId, "string");
  assert.strictEqual(typeof context.correlationId, "string");
});

test("createBackgroundTaskTraceContext handles numeric parts", () => {
  const context = createBackgroundTaskTraceContext("index", [1, 2, 3]);

  assert.ok(context.correlationId.includes("1"));
  assert.ok(context.correlationId.includes("2"));
  assert.ok(context.correlationId.includes("3"));
});

test("createBackgroundTaskTraceContext with mixed type parts", () => {
  const context = createBackgroundTaskTraceContext("mixed", ["string", 42, null, true]);

  assert.ok(context.correlationId.includes("string"));
  assert.ok(context.correlationId.includes("42"));
  // null and true are filtered
});

test("createBackgroundTaskTraceContext all parts are trimmed", () => {
  const context = createBackgroundTaskTraceContext("trim", ["  a  ", "  b  "]);

  // Should contain 'a' and 'b' without extra spaces
  assert.ok(context.correlationId.includes("a"));
  assert.ok(context.correlationId.includes("b"));
});

test("createBackgroundTaskTraceContext generates different correlationIds for different operations", () => {
  const context1 = createBackgroundTaskTraceContext("op1");
  const context2 = createBackgroundTaskTraceContext("op2");

  assert.notStrictEqual(context1.correlationId, context2.correlationId);
});