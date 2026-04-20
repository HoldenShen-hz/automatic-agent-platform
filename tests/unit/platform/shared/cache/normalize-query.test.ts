import assert from "node:assert/strict";
import test from "node:test";

import { normalizeQuery, normalizeGrepQuery, normalizeIntentQuery } from "../../../../../src/platform/shared/cache/utils/normalize-query.js";

test("normalizeQuery trims whitespace", () => {
  assert.equal(normalizeQuery("  hello  "), "hello");
  assert.equal(normalizeQuery("\thello\n"), "hello");
});

test("normalizeQuery collapses whitespace", () => {
  assert.equal(normalizeQuery("hello    world"), "hello world");
  assert.equal(normalizeQuery("hello \t \n world"), "hello world");
});

test("normalizeQuery lowercases", () => {
  assert.equal(normalizeQuery("HELLO"), "hello");
  assert.equal(normalizeQuery("HeLLo WoRLD"), "hello world");
});

test("normalizeQuery handles empty string", () => {
  assert.equal(normalizeQuery(""), "");
});

test("normalizeQuery handles single word", () => {
  assert.equal(normalizeQuery("hello"), "hello");
});

test("normalizeGrepQuery trims and collapses whitespace", () => {
  assert.equal(normalizeGrepQuery("  hello    world  "), "hello world");
});

test("normalizeGrepQuery escapes regex special characters", () => {
  assert.equal(normalizeGrepQuery("hello.world"), "hello\\.world");
  assert.equal(normalizeGrepQuery("a+b*c?"), "a\\+b\\*c\\?");
  assert.equal(normalizeGrepQuery("[test]"), "\\[test\\]");
  assert.equal(normalizeGrepQuery("(group)"), "\\(group\\)");
});

test("normalizeGrepQuery handles dots and asterisks", () => {
  // Original implementation escapes all regex special chars
  assert.equal(normalizeGrepQuery("file.*.ts"), "file\\.\\*\\.ts");
  assert.equal(normalizeGrepQuery("a+b"), "a\\+b");
});

test("normalizeGrepQuery handles pipe character", () => {
  assert.equal(normalizeGrepQuery("a|b"), "a\\|b");
});

test("normalizeGrepQuery handles dollar and caret", () => {
  assert.equal(normalizeGrepQuery("^start$"), "\\^start\\$");
});

test("normalizeIntentQuery removes punctuation", () => {
  assert.equal(normalizeIntentQuery("Hello!"), "hello");
  assert.equal(normalizeIntentQuery("What is it?"), "what is it");
});

test("normalizeIntentQuery handles Chinese punctuation", () => {
  assert.equal(normalizeIntentQuery("你好？"), "你好");
  assert.equal(normalizeIntentQuery("测试！"), "测试");
});

test("normalizeIntentQuery collapses whitespace", () => {
  assert.equal(normalizeIntentQuery("hello    world"), "hello world");
});

test("normalizeIntentQuery lowercases", () => {
  assert.equal(normalizeIntentQuery("HELLO"), "hello");
});

test("normalizeIntentQuery handles mixed punctuation", () => {
  assert.equal(normalizeIntentQuery("What's this? It's working!"), "whats this its working");
});

test("normalizeQuery handles tabs and newlines", () => {
  assert.equal(normalizeQuery("hello\t\nworld"), "hello world");
});

test("normalizeGrepQuery handles empty string", () => {
  assert.equal(normalizeGrepQuery(""), "");
});

test("normalizeIntentQuery handles empty string", () => {
  assert.equal(normalizeIntentQuery(""), "");
});

test("normalizeIntentQuery removes Japanese punctuation", () => {
  assert.equal(normalizeIntentQuery("テスト。"), "テスト");
});
