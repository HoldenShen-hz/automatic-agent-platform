/**
 * Unit tests for golden test utilities
 */

import assert from "node:assert/strict";
import test from "node:test";

import { assertGolden, assertGoldenContains, assertGoldenMatches } from "../../helpers/golden.js";

test("assertGolden validates matching snapshot", () => {
  assertGolden("test-golden-match", { value: 42 });
});

test("assertGolden throws on mismatch", () => {
  assert.throws(
    () => assertGolden("test-golden-mismatch", { value: 99 }),
    /Golden snapshot mismatch/,
  );
});

test("assertGoldenContains validates substring match", () => {
  assertGoldenContains("test-golden-contains", "quick brown");
});

test("assertGoldenContains throws on missing substring", () => {
  assert.throws(
    () => assertGoldenContains("test-golden-contains-missing", "lazy dog"),
    /does not contain/,
  );
});

test("assertGoldenMatches validates regex pattern", () => {
  assertGoldenMatches("test-golden-matches", "ERROR: something failed at line 42", /ERROR:.*at line \d+/);
});

test("assertGoldenMatches throws on no match", () => {
  assert.throws(
    () => assertGoldenMatches("test-golden-matches-no", "Success: all good", /ERROR:/),
    /does not match/,
  );
});
