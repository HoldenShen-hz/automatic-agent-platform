import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeWhitespace,
  normalizeIndentationAware,
  stripCommonIndent,
  detectCommonIndent,
  trimTerminalEmptyLine,
  preserveTrailingNewline,
} from "../../../../../../src/platform/five-plane-execution/tool-executor/edit-replacement/string-utils.js";

test("normalizeWhitespace collapses spaces and tabs [string-utils]", () => {
  assert.equal(normalizeWhitespace("  hello   world  "), "hello world");
});

test("normalizeWhitespace handles multiple lines [string-utils]", () => {
  assert.equal(normalizeWhitespace("  hello\n  world  "), "hello\n world");
});

test("normalizeWhitespace trims each line [string-utils]", () => {
  assert.equal(normalizeWhitespace("  hello  \n  world  "), "hello\n world");
});

test("normalizeWhitespace handles Windows line endings [string-utils]", () => {
  assert.equal(normalizeWhitespace("hello\r\nworld"), "hello\nworld");
});

test("normalizeWhitespace handles empty string [string-utils]", () => {
  assert.equal(normalizeWhitespace(""), "");
});

test("normalizeWhitespace handles only whitespace [string-utils]", () => {
  assert.equal(normalizeWhitespace("   \t  "), "");
});

test("normalizeWhitespace preserves single spaces between words [string-utils]", () => {
  assert.equal(normalizeWhitespace("a b c"), "a b c");
});

test("stripCommonIndent removes common leading indent [string-utils]", () => {
  const input = "  line1\n  line2\n  line3";
  assert.equal(stripCommonIndent(input), "line1\nline2\nline3");
});

test("stripCommonIndent handles mixed indentation [string-utils]", () => {
  const input = "  line1\n    line2\n  line3";
  assert.equal(stripCommonIndent(input), "line1\n  line2\nline3");
});

test("stripCommonIndent handles tab indentation [string-utils]", () => {
  const input = "\t\tline1\n\t\tline2";
  assert.equal(stripCommonIndent(input), "line1\nline2");
});

test("stripCommonIndent handles empty lines [string-utils]", () => {
  const input = "  line1\n\n  line2";
  assert.equal(stripCommonIndent(input), "line1\n\nline2");
});

test("stripCommonIndent handles no indentation [string-utils]", () => {
  const input = "line1\nline2";
  assert.equal(stripCommonIndent(input), "line1\nline2");
});

test("stripCommonIndent handles all empty lines [string-utils]", () => {
  const input = "  \n  \n  ";
  assert.equal(stripCommonIndent(input), "  \n  \n  ");
});

test("stripCommonIndent removes partial common indent [string-utils]", () => {
  const input = "  line1\n   line2\n    line3";
  assert.equal(stripCommonIndent(input), "line1\n line2\n  line3");
});

test("detectCommonIndent finds 2-space indent [string-utils]", () => {
  const input = "  line1\n  line2";
  assert.equal(detectCommonIndent(input), "  ");
});

test("detectCommonIndent finds tab indent [string-utils]", () => {
  const input = "\t\tline1\n\t\tline2";
  assert.equal(detectCommonIndent(input), "\t\t");
});

test("detectCommonIndent handles mixed spaces and tabs [string-utils]", () => {
  const input = " \tline1\n \tline2";
  assert.equal(detectCommonIndent(input), " \t");
});

test("detectCommonIndent returns empty for no indentation [string-utils]", () => {
  const input = "line1\nline2";
  assert.equal(detectCommonIndent(input), "");
});

test("detectCommonIndent returns empty for empty input [string-utils]", () => {
  assert.equal(detectCommonIndent(""), "");
});

test("detectCommonIndent returns empty for only empty lines [string-utils]", () => {
  assert.equal(detectCommonIndent("  \n  "), "");
});

test("detectCommonIndent finds shortest common prefix [string-utils]", () => {
  const input = "  line1\n  line2\n    line3";
  assert.equal(detectCommonIndent(input), "  ");
});

test("detectCommonIndent handles lines with different indent patterns [string-utils]", () => {
  const input = "  line1\n    line2\n   line3";
  assert.equal(detectCommonIndent(input), "  ");
});

test("trimTerminalEmptyLine removes trailing empty line [string-utils]", () => {
  assert.deepEqual(trimTerminalEmptyLine(["a", "b", ""]), ["a", "b"]);
});

test("trimTerminalEmptyLine keeps non-empty trailing line [string-utils]", () => {
  assert.deepEqual(trimTerminalEmptyLine(["a", "b", "c"]), ["a", "b", "c"]);
});

test("trimTerminalEmptyLine handles single empty line [string-utils]", () => {
  assert.deepEqual(trimTerminalEmptyLine([""]), []);
});

test("trimTerminalEmptyLine handles empty array [string-utils]", () => {
  assert.deepEqual(trimTerminalEmptyLine([]), []);
});

test("trimTerminalEmptyLine keeps multiple trailing non-empty lines [string-utils]", () => {
  assert.deepEqual(trimTerminalEmptyLine(["a", "", "b", ""]), ["a", "", "b"]);
});

test("preserveTrailingNewline adds newline when missing [string-utils]", () => {
  assert.equal(preserveTrailingNewline("hello", "world\n"), "hello\n");
});

test("preserveTrailingNewline keeps existing newline [string-utils]", () => {
  assert.equal(preserveTrailingNewline("hello\n", "world\n"), "hello\n");
});

test("preserveTrailingNewline handles empty strings [string-utils]", () => {
  assert.equal(preserveTrailingNewline("", ""), "");
  assert.equal(preserveTrailingNewline("", "\n"), "\n");
});

test("preserveTrailingNewline handles matchedText without trailing newline [string-utils]", () => {
  assert.equal(preserveTrailingNewline("hello", "world"), "hello");
});

test("normalizeIndentationAware combines strip and normalize [string-utils]", () => {
  const input = "  hello\n  world  ";
  assert.equal(normalizeIndentationAware(input), "hello\nworld");
});

test("normalizeIndentationAware handles deeply nested indent [string-utils]", () => {
  const input = "    deeply\n      nested\n        content";
  assert.equal(normalizeIndentationAware(input), "deeply\n nested\n content");
});
