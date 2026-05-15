/**
 * Integration Test: Memory Retrieval Service
 *
 * Tests the MemoryRetrievalService including FTS5 query building,
 * text extraction, snippet creation, and search result reranking.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFtsMatchQuery,
  extractSearchableText,
  createSnippet,
} from "../../../../../src/platform/five-plane-state-evidence/memory/memory-retrieval-service.js";

test("integration: buildFtsMatchQuery handles complex search queries", () => {
  // Multi-word query
  const result1 = buildFtsMatchQuery("hello world test");
  assert.ok(result1.includes('"hello"'));
  assert.ok(result1.includes('"world"'));
  assert.ok(result1.includes('"test"'));
  assert.ok(result1.includes(" AND "));

  // Query with special characters
  const result2 = buildFtsMatchQuery("code-review");
  assert.ok(result2.includes("code"));
  assert.ok(result2.includes("review"));

  // Empty query returns empty phrase
  const result3 = buildFtsMatchQuery("");
  assert.equal(result3, '""');

  // Unicode query
  const result4 = buildFtsMatchQuery("日本語テスト");
  assert.ok(result4.includes("日本語テスト"));
});

test("integration: extractSearchableText extracts from structured memory content", () => {
  const structuredContent = JSON.stringify({
    workContext: "Working on task implementation",
    topOfMind: ["Remember to refactor", "Check tests"],
    recentHistory: ["Completed feature A", "Fixed bug B"],
    longTermBackground: ["Project started in 2024"],
    facts: [
      { content: "Important fact 1", category: "info" },
      { content: "Important fact 2", category: "info" },
    ],
  });

  const text = extractSearchableText(structuredContent);

  assert.ok(text.includes("Working on task implementation"));
  assert.ok(text.includes("Remember to refactor"));
  assert.ok(text.includes("Completed feature A"));
  assert.ok(text.includes("Important fact 1"));
  assert.ok(text.includes("Important fact 2"));
});

test("integration: extractSearchableText handles plain string content", () => {
  const plainText = "This is just a plain text memory without JSON structure";

  const result = extractSearchableText(plainText);

  assert.equal(result, plainText);
});

test("integration: extractSearchableText handles JSON strings that are not objects", () => {
  const jsonString = '"just a quoted string"';

  const result = extractSearchableText(jsonString);

  // A JSON string value is returned as-is
  assert.ok(result.includes("just a quoted string"));
});

test("integration: extractSearchableText handles malformed JSON gracefully", () => {
  const malformedJson = '{"incomplete": {"nested';

  const result = extractSearchableText(malformedJson);

  // Should return empty string on JSON parse error
  assert.equal(result, "");
});

test("integration: createSnippet creates highlight snippets around matches", () => {
  const fullText = "This is a longer text that contains the keyword we are searching for in the middle of the content.";
  const queryTerms = ["keyword"];

  const snippet = createSnippet(fullText, queryTerms, 50);

  // Snippet may be slightly longer than maxLength due to word boundary adjustment
  assert.ok(snippet.length <= 70);
  assert.ok(snippet.includes("keyword") || snippet.startsWith("..."));
});

test("integration: createSnippet handles no match by truncating", () => {
  const longText = "This is a very long text that does not contain the search term at all and should be truncated";
  const queryTerms = ["nonexistent"];

  const snippet = createSnippet(longText, queryTerms, 30);

  assert.ok(snippet.length <= 33); // 30 + "..."
  assert.ok(snippet.endsWith("..."));
});

test("integration: createSnippet handles short text that fits within maxLength", () => {
  const shortText = "Short text";
  const queryTerms = ["text"];

  const snippet = createSnippet(shortText, queryTerms, 100);

  assert.equal(snippet, shortText);
});

test("integration: createSnippet adjusts boundaries to avoid word cutting", () => {
  const text = "Hello world this is a test of the snippet boundary adjustment";
  const queryTerms = ["test"];

  const snippet = createSnippet(text, queryTerms, 40);

  // Should not cut words awkwardly
  assert.ok(snippet.includes("test"));
  // If start is not 0, should start after a space
  if (!snippet.startsWith("Hello")) {
    assert.ok(snippet.startsWith("...") || text.includes(" " + snippet.slice(0, -3)));
  }
});

test("integration: buildFtsMatchQuery preserves underscores in terms", () => {
  const result = buildFtsMatchQuery("my_variable test_function");

  assert.ok(result.includes("my_variable"));
  assert.ok(result.includes("test_function"));
});

test("integration: extractSearchableText extracts from nested facts", () => {
  const structuredContent = JSON.stringify({
    workContext: "Task execution",
    facts: [
      {
        content: "Nested fact content",
        category: "observation",
        confidence: 0.9,
        provenanceSource: "test",
      },
    ],
  });

  const text = extractSearchableText(structuredContent);

  assert.ok(text.includes("Nested fact content"));
  assert.ok(text.includes("Task execution"));
});

test("integration: extractSearchableText handles empty structured content arrays", () => {
  const structuredContent = JSON.stringify({
    workContext: "Test",
    topOfMind: [],
    recentHistory: [],
    longTermBackground: [],
    facts: [],
  });

  const text = extractSearchableText(structuredContent);

  assert.ok(text.includes("Test"));
});

test("integration: createSnippet handles multiple query terms", () => {
  const text = "The quick brown fox jumps over the lazy dog";
  const queryTerms = ["quick", "fox", "dog"];

  const snippet = createSnippet(text, queryTerms, 40);

  assert.ok(snippet.includes("quick") || snippet.includes("fox") || snippet.includes("dog"));
});

test("integration: buildFtsMatchQuery splits on various delimiters", () => {
  // Test with multiple delimiters
  const result = buildFtsMatchQuery("term1, term2; term3: term4");

  assert.ok(result.includes("term1"));
  assert.ok(result.includes("term2"));
  assert.ok(result.includes("term3"));
  assert.ok(result.includes("term4"));
});

test("integration: extractSearchableText handles content with unicode", () => {
  const structuredContent = JSON.stringify({
    workContext: "Working with unicode: 日本語 и українська мова",
    topOfMind: ["Unicode support is important"],
  });

  const text = extractSearchableText(structuredContent);

  assert.ok(text.includes("日本語"));
  assert.ok(text.includes("українська"));
  assert.ok(text.includes("Unicode support is important"));
});

test("integration: createSnippet with exact match position", () => {
  const text = "Find the exact match here in this text";
  const queryTerms = ["exact"];

  const snippet = createSnippet(text, queryTerms, 100);

  assert.ok(snippet.includes("exact"));
});

test("integration: buildFtsMatchQuery handles numbers", () => {
  const result = buildFtsMatchQuery("test123 version4.2");

  assert.ok(result.includes("test123"));
  assert.ok(result.includes("version4"));
  assert.ok(result.includes("2"));
});

test("integration: extractSearchableText filters non-string array items", () => {
  const structuredContent = JSON.stringify({
    topOfMind: ["valid string", 123, null, { nested: "object" }, "another string"],
  });

  const text = extractSearchableText(structuredContent);

  assert.ok(text.includes("valid string"));
  assert.ok(text.includes("another string"));
  assert.ok(!text.includes("123"));
});

test("integration: createSnippet trims snippet at boundaries properly", () => {
  const text = "Start of text middle content end of text";
  const queryTerms = ["middle"];

  const snippet = createSnippet(text, queryTerms, 15);

  // Should try to show "middle" with context
  assert.ok(snippet.includes("middle") || snippet.length < text.length);
});

test("integration: buildFtsMatchQuery with single character terms", () => {
  const result = buildFtsMatchQuery("a b c");

  // Single characters should still be wrapped in quotes
  assert.ok(result.includes('"a"'));
  assert.ok(result.includes('"b"'));
  assert.ok(result.includes('"c"'));
});
