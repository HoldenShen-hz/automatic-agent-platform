import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizeQuery,
  normalizeGrepQuery,
  normalizeIntentQuery,
} from "../../../../../../src/platform/shared/cache/utils/normalize-query.js";

test("normalizeQuery trims whitespace", () => {
  assert.equal(normalizeQuery("  hello  "), "hello");
});

test("normalizeQuery collapses multiple spaces", () => {
  assert.equal(normalizeQuery("hello    world"), "hello world");
});

test("normalizeQuery converts to lowercase", () => {
  assert.equal(normalizeQuery("Hello World"), "hello world");
});

test("normalizeQuery handles tabs and newlines", () => {
  assert.equal(normalizeQuery("hello\n\tworld"), "hello world");
});

test("normalizeQuery handles empty string", () => {
  assert.equal(normalizeQuery(""), "");
});

test("normalizeQuery handles only whitespace", () => {
  assert.equal(normalizeQuery("   \t\n  "), "");
});

test("normalizeGrepQuery escapes regex special characters", () => {
  const result = normalizeGrepQuery("hello.world*");
  assert.ok(result.includes("\\."));
  assert.ok(result.includes("\\*"));
});

test("normalizeGrepQuery preserves normal text", () => {
  assert.equal(normalizeGrepQuery("hello world"), "hello world");
});

test("normalizeGrepQuery trims and collapses whitespace", () => {
  assert.equal(normalizeGrepQuery("  hello    world  "), "hello world");
});

test("normalizeGrepQuery escapes brackets", () => {
  const result = normalizeGrepQuery("test[0-9]");
  assert.ok(result.includes("\\["));
  assert.ok(result.includes("\\]"));
});

test("normalizeGrepQuery escapes parentheses", () => {
  const result = normalizeGrepQuery("test(x)");
  assert.ok(result.includes("\\("));
  assert.ok(result.includes("\\)"));
});

test("normalizeIntentQuery removes punctuation", () => {
  assert.equal(normalizeIntentQuery("Hello! How are you?"), "hello how are you");
});

test("normalizeIntentQuery handles Chinese punctuation", () => {
  assert.equal(normalizeIntentQuery("你好？"), "你好");
});

test("normalizeIntentQuery handles apostrophes", () => {
  assert.equal(normalizeIntentQuery("don't worry"), "dont worry");
});

test("normalizeIntentQuery collapses whitespace", () => {
  assert.equal(normalizeIntentQuery("hello    world"), "hello world");
});

test("normalizeIntentQuery converts to lowercase", () => {
  assert.equal(normalizeIntentQuery("HELLO WORLD"), "hello world");
});

test("normalizeIntentQuery handles empty string", () => {
  assert.equal(normalizeIntentQuery(""), "");
});

test("normalizeIntentQuery handles only its specific punctuation", () => {
  // normalizeIntentQuery only removes ?! and Chinese equivalents, not . or ,
  assert.equal(normalizeIntentQuery("!?"), "");
});
