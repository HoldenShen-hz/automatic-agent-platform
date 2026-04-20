import assert from "node:assert/strict";
import test from "node:test";

import {
  reindentBlock,
  reindentBlockToMatch,
} from "../../../../../../src/platform/execution/tool-executor/edit-replacement/apply.js";

// reindentBlock tests

test("reindentBlock reindents with 2-space indent", () => {
  const input = "function foo() {\n  return 1;\n}";
  const result = reindentBlock(input, "  ");
  assert.equal(result, "  function foo() {\n    return 1;\n  }");
});

test("reindentBlock handles empty string", () => {
  const result = reindentBlock("", "  ");
  assert.equal(result, "");
});

test("reindentBlock handles single line", () => {
  const result = reindentBlock("hello", "    ");
  assert.equal(result, "    hello");
});

test("reindentBlock strips common indent before reindenting", () => {
  const input = "    line1\n    line2\n    line3";
  const result = reindentBlock(input, "");
  assert.equal(result, "line1\nline2\nline3");
});

test("reindentBlock normalizes CRLF to LF", () => {
  const input = "line1\r\nline2";
  const result = reindentBlock(input, "");
  assert.equal(result, "line1\nline2");
});

test("reindentBlock preserves empty lines", () => {
  const input = "line1\n\nline3";
  const result = reindentBlock(input, "  ");
  assert.equal(result, "  line1\n\n  line3");
});

// reindentBlockToMatch tests

test("reindentBlockToMatch matches single line indentation", () => {
  const value = "return 42;";
  const matchedText = "    return 0;";
  const result = reindentBlockToMatch(value, matchedText);
  assert.equal(result, "    return 42;");
});

test("reindentBlockToMatch matches multiple line indentation", () => {
  const value = "function foo() {\n  return 1;\n}";
  const matchedText = "  function bar() {\n    return 2;\n  }";
  const result = reindentBlockToMatch(value, matchedText);
  // Each line should match the indentation of the corresponding matched line
  assert.ok(result.startsWith("  function foo()"));
});

test("reindentBlockToMatch falls back to common indent for different line counts", () => {
  const value = "a\nb";
  const matchedText = "    a\n    b\n    c";
  const result = reindentBlockToMatch(value, matchedText);
  // Fallback uses common indent of matchedText
  assert.ok(result.startsWith("    "));
});

test("reindentBlockToMatch handles empty value", () => {
  const result = reindentBlockToMatch("", "  hello");
  assert.equal(result, "");
});
