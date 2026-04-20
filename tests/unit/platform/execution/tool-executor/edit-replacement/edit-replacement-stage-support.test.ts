import assert from "node:assert/strict";
import test from "node:test";

import { evaluateEditStages } from "../../../../../../src/platform/execution/tool-executor/edit-replacement/edit-replacement-stage-support.js";

test("evaluateEditStages returns exact match on first stage", () => {
  const content = "hello world";
  const request = { oldString: "hello", newString: "hi" };

  const result = evaluateEditStages(content, request);

  assert.equal(result.matchedCandidate !== null, true);
  assert.equal(result.attempts.length, 1);
  assert.equal(result.attempts[0]!.attemptLevel, "exact");
  assert.equal(result.errorCode, null);
});

test("evaluateEditStages proceeds to whitespace_normalized when exact fails", () => {
  const content = "hello   world";
  const request = { oldString: "hello world", newString: "hi" };

  const result = evaluateEditStages(content, request);

  assert.ok(result.attempts.length >= 2);
  assert.equal(result.attempts[1]!.attemptLevel, "whitespace_normalized");
});

test("evaluateEditStages proceeds to indentation_normalized when whitespace fails", () => {
  const content = "  hello\n  world";
  const request = { oldString: "hello\nworld", newString: "hi" };

  const result = evaluateEditStages(content, request);

  assert.ok(result.attempts.length >= 3);
  assert.equal(result.attempts[2]!.attemptLevel, "indentation_normalized");
});

test("evaluateEditStages returns multiple_candidates error when multiple exact matches", () => {
  const content = "foo hello bar foo hello baz";
  const request = { oldString: "hello", newString: "hi" };

  const result = evaluateEditStages(content, request);

  assert.equal(result.matchedCandidate, null);
  assert.equal(result.errorCode, "tool.edit_multiple_candidates");
  assert.equal(result.attempts.length, 1);
  assert.equal(result.attempts[0]!.attemptLevel, "exact");
});

test("evaluateEditStages returns not_found when no match exists anywhere", () => {
  const content = "foo bar baz";
  const request = { oldString: "xyz", newString: "hi" };

  const result = evaluateEditStages(content, request);

  assert.equal(result.matchedCandidate, null);
  assert.equal(result.errorCode, "tool.edit_target_not_found");
});

test("evaluateEditStages returns similarity_too_low when content is too different", () => {
  const content = "completely different text here";
  const request = { oldString: "nonexistent content", newString: "hi" };

  const result = evaluateEditStages(content, request);

  assert.equal(result.matchedCandidate, null);
  assert.ok(["tool.edit_similarity_too_low", "tool.edit_target_not_found"].includes(result.errorCode ?? ""));
});

test("evaluateEditStages works with empty content", () => {
  const content = "";
  const request = { oldString: "hello", newString: "hi" };

  const result = evaluateEditStages(content, request);

  assert.equal(result.matchedCandidate, null);
});

test("evaluateEditStages proceeds through all stages when content is somewhat similar", () => {
  const content = "foo bar baz";
  const request = { oldString: "foo baz", newString: "hi" };

  const result = evaluateEditStages(content, request);

  // Should have tried multiple stages
  assert.ok(result.attempts.length >= 3);
});

test("evaluateEditStages exact match returns immediately", () => {
  const content = "prefix hello suffix";
  const request = { oldString: "hello", newString: "hi" };

  const result = evaluateEditStages(content, request);

  assert.equal(result.matchedCandidate !== null, true);
  assert.equal(result.attempts.length, 1);
  assert.equal(result.errorCode, null);
});

test("evaluateEditStages with multiline content", () => {
  const content = "line1\nline2\nline3";
  const request = { oldString: "line2", newString: "new" };

  const result = evaluateEditStages(content, request);

  // Exact should find "line2"
  assert.equal(result.matchedCandidate !== null, true);
  assert.equal(result.attempts.length, 1);
});
