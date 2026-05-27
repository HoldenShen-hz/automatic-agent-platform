import assert from "node:assert/strict";
import test from "node:test";

import {
  expandToolNames,
  inferPromotedToolNames,
  extractKeywords,
} from "../../../../../src/platform/five-plane-execution/tool-executor/tool-recommend-service.js";

test("expandToolNames returns empty for empty input [tool-recommend-service]", () => {
  const result = expandToolNames([]);
  assert.deepEqual(result.resolvedToolNames, []);
  assert.deepEqual(result.unresolvedToolNames, []);
});

test("expandToolNames returns same tool for known tool [tool-recommend-service]", () => {
  const result = expandToolNames(["read"]);
  assert.deepEqual(result.resolvedToolNames, ["read"]);
  assert.deepEqual(result.unresolvedToolNames, []);
});

test("expandToolNames expands command to bash and command_exec [tool-recommend-service]", () => {
  const result = expandToolNames(["command"]);
  assert.ok(result.resolvedToolNames.includes("command_exec"));
  assert.ok(result.resolvedToolNames.includes("bash"));
});

test("expandToolNames expands edit to edit_replace, edit_batch, apply_patch [tool-recommend-service]", () => {
  const result = expandToolNames(["edit"]);
  assert.ok(result.resolvedToolNames.includes("edit_replace"));
  assert.ok(result.resolvedToolNames.includes("edit_batch"));
  assert.ok(result.resolvedToolNames.includes("apply_patch"));
});

test("expandToolNames expands shell to bash [tool-recommend-service]", () => {
  const result = expandToolNames(["shell"]);
  assert.ok(result.resolvedToolNames.includes("bash"));
});

test("expandToolNames expands write to edit_replace, edit_batch, apply_patch [tool-recommend-service]", () => {
  const result = expandToolNames(["write"]);
  assert.ok(result.resolvedToolNames.includes("edit_replace"));
  assert.ok(result.resolvedToolNames.includes("edit_batch"));
  assert.ok(result.resolvedToolNames.includes("apply_patch"));
});

test("expandToolNames expands patch to apply_patch [tool-recommend-service]", () => {
  const result = expandToolNames(["patch"]);
  assert.ok(result.resolvedToolNames.includes("apply_patch"));
});

test("expandToolNames marks unknown tools as unresolved [tool-recommend-service]", () => {
  const result = expandToolNames(["unknown_tool"]);
  assert.deepEqual(result.resolvedToolNames, []);
  assert.deepEqual(result.unresolvedToolNames, ["unknown_tool"]);
});

test("expandToolNames handles mixed resolved and unresolved [tool-recommend-service]", () => {
  const result = expandToolNames(["read", "unknown"]);
  assert.deepEqual(result.resolvedToolNames, ["read"]);
  assert.deepEqual(result.unresolvedToolNames, ["unknown"]);
});

test("expandToolNames handles multiple aliases [tool-recommend-service]", () => {
  const result = expandToolNames(["read", "bash", "command"]);
  assert.ok(result.resolvedToolNames.includes("read"));
  assert.ok(result.resolvedToolNames.includes("bash"));
  assert.ok(result.resolvedToolNames.includes("command_exec"));
});

test("inferPromotedToolNames returns empty for no match [tool-recommend-service]", () => {
  const result = inferPromotedToolNames("hello world", ["read", "bash"]);
  assert.deepEqual(result, []);
});

test("inferPromotedToolNames promotes apply_patch for patch keyword [tool-recommend-service]", () => {
  const result = inferPromotedToolNames("apply a patch", ["apply_patch"]);
  assert.deepEqual(result, ["apply_patch"]);
});

test("inferPromotedToolNames promotes edit tools for edit keyword [tool-recommend-service]", () => {
  const result = inferPromotedToolNames("edit the file", ["edit_replace"]);
  assert.ok(result.includes("edit_replace"));
});

test("inferPromotedToolNames promotes bash for command keyword [tool-recommend-service]", () => {
  const result = inferPromotedToolNames("run a command", ["bash", "read"]);
  assert.ok(result.includes("bash"));
});

test("inferPromotedToolNames promotes read for read keyword [tool-recommend-service]", () => {
  const result = inferPromotedToolNames("read the file", ["read", "bash"]);
  assert.ok(result.includes("read"));
});

test("inferPromotedToolNames promotes question for question keyword [tool-recommend-service]", () => {
  const result = inferPromotedToolNames("ask a question", ["question"]);
  assert.ok(result.includes("question"));
});

test("inferPromotedToolNames promotes todo_write for todo keyword [tool-recommend-service]", () => {
  const result = inferPromotedToolNames("update the todo list", ["todo_write"]);
  assert.ok(result.includes("todo_write"));
});

test("extractKeywords removes stop words [tool-recommend-service]", () => {
  const result = extractKeywords("the quick brown fox");
  assert.ok(!result.includes("the"));
  // "quick" is 5 chars, not a stop word, so it should be included
  assert.ok(result.includes("quick"));
});

test("extractKeywords returns empty for stop words only [tool-recommend-service]", () => {
  const result = extractKeywords("the a is are");
  assert.deepEqual(result, []);
});

test("extractKeywords keeps significant words [tool-recommend-service]", () => {
  const result = extractKeywords("read the file");
  assert.ok(result.includes("read"));
  assert.ok(result.includes("file"));
});

test("extractKeywords handles case insensitivity [tool-recommend-service]", () => {
  const result = extractKeywords("READ the FILE");
  assert.ok(result.includes("read"));
  assert.ok(result.includes("file"));
});

test("extractKeywords removes punctuation [tool-recommend-service]", () => {
  const result = extractKeywords("hello, world! how are you?");
  assert.ok(!result.includes(","));
  assert.ok(!result.includes("!"));
});

test("extractKeywords filters short words [tool-recommend-service]", () => {
  const result = extractKeywords("a b c d e read");
  assert.ok(!result.includes("a"));
  assert.ok(!result.includes("b"));
  assert.ok(result.includes("read"));
});
