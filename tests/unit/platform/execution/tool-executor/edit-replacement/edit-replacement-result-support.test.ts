import assert from "node:assert/strict";
import test from "node:test";

import {
  formatRange,
  findAlreadyAppliedRange,
} from "../../../../../../src/platform/execution/tool-executor/edit-replacement/edit-replacement-result-support.js";

// Note: This file tests the pure utility functions in edit-replacement-result-support.
// buildEditReplacementResult and buildEditBatchResult create complex result objects
// with many dependencies and Date.now() calls, making them harder to unit test.
// The primary testable pure functions are formatRange and findAlreadyAppliedRange.

test("formatRange returns correct range string for single line", () => {
  const result = formatRange("hello world", 0, 5);
  assert.equal(result, "L1:C1-L1:C6");
});

test("formatRange returns correct range string spanning two lines", () => {
  const content = "hello\nworld";
  // "hello" is at offset 0-5, "world" starts at offset 6
  const result = formatRange(content, 0, 10);
  assert.ok(result.startsWith("L1:C1-"));
  assert.ok(result.includes("L2:"));
});

test("formatRange returns correct range string for empty content", () => {
  const result = formatRange("", 0, 0);
  assert.equal(result, "L1:C1-L1:C1");
});

test("findAlreadyAppliedRange returns null when content already contains oldString", () => {
  const result = findAlreadyAppliedRange("hello world", {
    oldString: "hello",
    newString: "goodbye",
  });
  assert.equal(result, null);
});

test("findAlreadyAppliedRange returns null when oldString equals newString", () => {
  const result = findAlreadyAppliedRange("hello world", {
    oldString: "hello",
    newString: "hello",
  });
  assert.equal(result, null);
});

test("findAlreadyAppliedRange returns candidate when oldString missing but newString found", () => {
  const result = findAlreadyAppliedRange("say goodbye world", {
    oldString: "hello",
    newString: "goodbye",
  });
  assert.ok(result !== null);
  assert.equal(result?.text, "goodbye");
  assert.equal(result?.startOffset, 4);
  assert.equal(result?.endOffset, 11);
});

test("findAlreadyAppliedRange returns null when neither old nor new string in content", () => {
  const result = findAlreadyAppliedRange("completely different", {
    oldString: "hello",
    newString: "goodbye",
  });
  assert.equal(result, null);
});

test("findAlreadyAppliedRange returns null when newString has multiple occurrences", () => {
  // If there are multiple matches for newString, it can't be a unique "already applied" indicator
  const result = findAlreadyAppliedRange("foo bar foo", {
    oldString: "old",
    newString: "foo",
  });
  assert.equal(result, null);
});

test("findAlreadyAppliedRange returns candidate with correct offset", () => {
  const result = findAlreadyAppliedRange("prefix hello suffix", {
    oldString: "goodbye",
    newString: "hello",
  });
  assert.ok(result !== null);
  assert.equal(result?.startOffset, 7);
  assert.equal(result?.endOffset, 12);
  assert.equal(result?.text, "hello");
});
