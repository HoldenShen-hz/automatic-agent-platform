import assert from "node:assert/strict";
import test from "node:test";

import {
  formatToolArgumentCoercionWarnings,
  coerceToolArguments,
  type ToolArgumentCoercionTrace,
} from "../../../../../src/platform/five-plane-execution/tool-executor/tool-argument-coercion.js";

test("formatToolArgumentCoercionWarnings formats single trace [tool-argument-coercion]", () => {
  const traces: ToolArgumentCoercionTrace[] = [
    { fieldPath: "timeoutMs", strategy: "string_to_integer", fromType: "string", toType: "number" },
  ];
  const warnings = formatToolArgumentCoercionWarnings(traces);
  assert.equal(warnings.length, 1);
  assert.ok(warnings[0]!.includes("timeoutMs"));
  assert.ok(warnings[0]!.includes("string_to_integer"));
});

test("formatToolArgumentCoercionWarnings formats multiple traces [tool-argument-coercion]", () => {
  const traces: ToolArgumentCoercionTrace[] = [
    { fieldPath: "timeoutMs", strategy: "string_to_integer", fromType: "string", toType: "number" },
    { fieldPath: "strictMode", strategy: "string_to_boolean", fromType: "string", toType: "boolean" },
  ];
  const warnings = formatToolArgumentCoercionWarnings(traces);
  assert.equal(warnings.length, 2);
});

test("formatToolArgumentCoercionWarnings handles empty traces [tool-argument-coercion]", () => {
  const warnings = formatToolArgumentCoercionWarnings([]);
  assert.deepEqual(warnings, []);
});

test("coerceToolArguments returns unchanged for unknown tool [tool-argument-coercion]", () => {
  const result = coerceToolArguments("unknown_tool", { arg1: "value" });
  assert.deepEqual(result.value, { arg1: "value" });
  assert.deepEqual(result.traces, []);
});

test("coerceToolArguments handles command_exec with numeric timeout [tool-argument-coercion]", () => {
  const result = coerceToolArguments("command_exec", { timeoutMs: "5000" });
  assert.equal(result.value.timeoutMs, 5000);
  assert.ok(result.traces.length > 0);
});

test("coerceToolArguments handles command_exec with string args [tool-argument-coercion]", () => {
  const result = coerceToolArguments("command_exec", { args: '["ls", "-la"]' });
  assert.deepEqual(result.value.args, ["ls", "-la"]);
  assert.ok(result.traces.length > 0);
});

test("coerceToolArguments handles command_exec with non-JSON args [tool-argument-coercion]", () => {
  const result = coerceToolArguments("command_exec", { args: "not-json" });
  // args stays as string since it's not valid JSON array
  assert.equal(result.value.args, "not-json");
});

test("coerceToolArguments handles edit_replace with timeout [tool-argument-coercion]", () => {
  const result = coerceToolArguments("edit_replace", { timeoutMs: "30000" });
  assert.equal(result.value.timeoutMs, 30000);
});

test("coerceToolArguments handles edit_replace with lockTtlMs [tool-argument-coercion]", () => {
  const result = coerceToolArguments("edit_replace", { lockTtlMs: "5000" });
  assert.equal(result.value.lockTtlMs, 5000);
});

test("coerceToolArguments handles edit_batch with timeout [tool-argument-coercion]", () => {
  const result = coerceToolArguments("edit_batch", { timeoutMs: "10000" });
  assert.equal(result.value.timeoutMs, 10000);
});

test("coerceToolArguments handles apply_patch with boolean strings [tool-argument-coercion]", () => {
  const result = coerceToolArguments("apply_patch", { strictMode: "true", allowCreation: "false" });
  assert.equal(result.value.strictMode, true);
  assert.equal(result.value.allowCreation, false);
});

test("coerceToolArguments handles apply_patch with actual booleans [tool-argument-coercion]", () => {
  const result = coerceToolArguments("apply_patch", { strictMode: true, allowCreation: false });
  assert.equal(result.value.strictMode, true);
  assert.equal(result.value.allowCreation, false);
});

test("coerceToolArguments handles question with questionType enum [tool-argument-coercion]", () => {
  const result = coerceToolArguments("question", { questionType: "SINGLE_CHOICE" });
  assert.equal(result.value.questionType, "single_choice");
});

test("coerceToolArguments handles todo_write with operation enum [tool-argument-coercion]", () => {
  const result = coerceToolArguments("todo_write", { operation: "CREATE" });
  assert.equal(result.value.operation, "create");
});

test("coerceToolArguments handles todo_write with status enum [tool-argument-coercion]", () => {
  const result = coerceToolArguments("todo_write", { status: "PENDING" });
  assert.equal(result.value.status, "pending");
});

test("coerceToolArguments handles todo_write with string priority [tool-argument-coercion]", () => {
  const result = coerceToolArguments("todo_write", { priority: "5" });
  assert.equal(result.value.priority, 5);
});

test("coerceToolArguments handles todo_write with invalid priority [tool-argument-coercion]", () => {
  const result = coerceToolArguments("todo_write", { priority: "not-a-number" });
  // Priority stays as string since it's not a valid integer
  assert.equal(result.value.priority, "not-a-number");
});

test("coerceToolArguments handles todo_write with title as number [tool-argument-coercion]", () => {
  const result = coerceToolArguments("todo_write", { title: 42 });
  assert.equal(result.value.title, "42");
});

test("coerceToolArguments returns traces for each coercion [tool-argument-coercion]", () => {
  const result = coerceToolArguments("apply_patch", { strictMode: "true", timeoutMs: "5000" });
  assert.ok(result.traces.length >= 2);
});

test("coerceToolArguments passes through non-coerced fields [tool-argument-coercion]", () => {
  const result = coerceToolArguments("bash", { someOtherField: "value", timeoutMs: "1000" });
  assert.equal(result.value.someOtherField, "value");
  assert.equal(result.value.timeoutMs, 1000);
});
