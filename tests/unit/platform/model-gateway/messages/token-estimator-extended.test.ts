/**
 * Extended unit tests for token-estimator module
 * Tests estimateTextTokens and estimateMessageTokens
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { estimateTextTokens, estimateMessageTokens } from "../../../../../src/platform/model-gateway/messages/token-estimator.js";

function createMockMessageRecord(overrides: Partial<{
  content: string;
  partsJson: string | null;
}> = {}) {
  return {
    id: "msg-123",
    messageType: "user",
    content: overrides.content ?? "Hello, world!",
    createdAt: "2026-04-26T00:00:00.000Z",
    partsJson: overrides.partsJson ?? null,
    ...overrides,
  };
}

function createMockMessagePart(overrides: Partial<{
  partId: string;
  messageId: string;
  partType: string;
  sequence: number;
  contentJson: string;
  lineageJson: string | null;
  createdAt: string;
}> = {}) {
  return {
    partId: overrides.partId ?? "msg-123:part:1",
    messageId: overrides.messageId ?? "msg-123",
    partType: overrides.partType ?? "text",
    sequence: overrides.sequence ?? 1,
    contentJson: overrides.contentJson ?? '{"text":"test"}',
    lineageJson: overrides.lineageJson ?? null,
    createdAt: overrides.createdAt ?? "2026-04-26T00:00:00.000Z",
    ...overrides,
  };
}

describe("estimateTextTokens", () => {
  test("returns 1 for empty string", () => {
    const tokens = estimateTextTokens("");
    assert.equal(tokens, 1);
  });

  test("returns 1 for whitespace-only string", () => {
    const tokens = estimateTextTokens("   \n\t  ");
    assert.equal(tokens, 1);
  });

  test("estimates CJK characters at roughly 1 token per character", () => {
    const tokens = estimateTextTokens("你好世界");
    assert.equal(tokens, 4); // 4 CJK characters
  });

  test("estimates Japanese Hiragana/Katakana correctly", () => {
    const tokens = estimateTextTokens("こんにちは");
    assert.equal(tokens, 5); // 5 characters
  });

  test("estimates Korean Hangul correctly", () => {
    const tokens = estimateTextTokens("안녕하세요");
    assert.equal(tokens, 5); // 5 characters
  });

  test("estimates English words at ~4 characters per token", () => {
    const tokens = estimateTextTokens("hello world");
    // "hello" = 5 chars -> ceil(5/4) = 2 tokens, "world" = 5 chars -> ceil(5/4) = 2 tokens
    assert.ok(tokens >= 4);
  });

  test("estimates long English words correctly", () => {
    const tokens = estimateTextTokens("pneumonoultramicroscopicsilicovolcanoconiosis");
    // Long word - should be multiple tokens
    assert.ok(tokens > 10);
  });

  test("estimates numbers at ~3 characters per token", () => {
    const tokens = estimateTextTokens("123456789");
    // 9 digits -> ceil(9/3) = 3 tokens
    assert.equal(tokens, 3);
  });

  test("estimates numbers with separators", () => {
    const tokens = estimateTextTokens("1,234,567.89");
    assert.ok(tokens >= 3);
  });

  test("estimates newlines at ~2 per token", () => {
    const tokens = estimateTextTokens("\n\n\n\n");
    // 4 newlines -> ceil(4/2) = 2 tokens, but might be less due to regex handling
    assert.ok(tokens >= 1);
  });

  test("estimates mixed CJK and English", () => {
    const tokens = estimateTextTokens("Hello 你好 World 世界");
    assert.ok(tokens >= 6); // At least some tokens for each word/char
  });

  test("estimates symbols at ~2 per token", () => {
    const tokens = estimateTextTokens("!@#$%^&*()");
    // 10 symbols -> ceil(10/2) = 5 tokens
    assert.equal(tokens, 5);
  });

  test("handles mixed content with all types", () => {
    const content = "Hello 世界! 123\nTest 代码.";
    const tokens = estimateTextTokens(content);
    assert.ok(tokens > 5);
    assert.ok(tokens < 100); // Reasonable upper bound
  });

  test("handles URL-like strings", () => {
    const tokens = estimateTextTokens("https://example.com/path/to/resource");
    assert.ok(tokens > 5);
  });

  test("handles code snippets", () => {
    const tokens = estimateTextTokens("const x = 42;");
    assert.ok(tokens >= 3);
  });

  test("handles markdown-like content", () => {
    const tokens = estimateTextTokens("# Title\n## Subtitle\n- List item");
    assert.ok(tokens >= 5);
  });

  test("handles very long strings", () => {
    const longString = "a".repeat(1000);
    const tokens = estimateTextTokens(longString);
    // 1000 chars -> ceil(1000/4) = 250 tokens
    assert.equal(tokens, 250);
  });

  test("handles unicode special characters", () => {
    const tokens = estimateTextTokens("🏆🎉✨");
    assert.ok(tokens >= 3);
  });

  test("handles mixed English and numbers", () => {
    const tokens = estimateTextTokens("Order 12345 for $49.99");
    assert.ok(tokens >= 5);
  });

  test("handles file paths", () => {
    const tokens = estimateTextTokens("/Users/name/Documents/project/file.ts");
    assert.ok(tokens >= 8);
  });

  test("removes carriage return for newline handling", () => {
    const withCR = "line1\r\nline2\r\nline3";
    const tokens = estimateTextTokens(withCR);
    // Should treat \r\n as just \n
    assert.ok(tokens >= 3);
  });
});

describe("estimateMessageTokens", () => {
  test("extracts tokens from partsJson when not trimmed", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ contentJson: '{"estimatedTokens":50}' }),
    ]);

    const record = createMockMessageRecord({
      content: "Content should not be used",
      partsJson,
    });

    const tokens = estimateMessageTokens(record);
    assert.equal(tokens, 50);
  });

  test("uses tokenCount from partsJson", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ contentJson: '{"tokenCount":100}' }),
    ]);

    const record = createMockMessageRecord({ partsJson });
    const tokens = estimateMessageTokens(record);

    assert.equal(tokens, 100);
  });

  test("uses totalTokens from partsJson", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ contentJson: '{"totalTokens":75}' }),
    ]);

    const record = createMockMessageRecord({ partsJson });
    const tokens = estimateMessageTokens(record);

    assert.equal(tokens, 75);
  });

  test("sums inputTokens and outputTokens from partsJson", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ contentJson: '{"inputTokens":30,"outputTokens":20}' }),
    ]);

    const record = createMockMessageRecord({ partsJson });
    const tokens = estimateMessageTokens(record);

    assert.equal(tokens, 50);
  });

  test("reads nested tokenUsage from partsJson", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ contentJson: '{"tokenUsage":{"inputTokens":15,"outputTokens":25}}' }),
    ]);

    const record = createMockMessageRecord({ partsJson });
    const tokens = estimateMessageTokens(record);

    assert.equal(tokens, 40);
  });

  test("reads nested usage from partsJson", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ contentJson: '{"usage":{"totalTokens":60}}' }),
    ]);

    const record = createMockMessageRecord({ partsJson });
    const tokens = estimateMessageTokens(record);

    assert.equal(tokens, 60);
  });

  test("sums tokens from multiple parts", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ partId: "p1", contentJson: '{"estimatedTokens":10}' }),
      createMockMessagePart({ partId: "p2", contentJson: '{"estimatedTokens":20}' }),
      createMockMessagePart({ partId: "p3", contentJson: '{"estimatedTokens":30}' }),
    ]);

    const record = createMockMessageRecord({ partsJson });
    const tokens = estimateMessageTokens(record);

    assert.equal(tokens, 60);
  });

  test("ignores parts with invalid JSON", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ partId: "p1", contentJson: '{"estimatedTokens":10}' }),
      createMockMessagePart({ partId: "p2", contentJson: 'not valid json' }),
      createMockMessagePart({ partId: "p3", contentJson: '{"estimatedTokens":30}' }),
    ]);

    const record = createMockMessageRecord({ partsJson });
    const tokens = estimateMessageTokens(record);

    assert.equal(tokens, 40); // Only valid parts counted
  });

  test("ignores parts with non-record contentJson", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ contentJson: '{"estimatedTokens":10}' }),
      createMockMessagePart({ contentJson: '123' }), // number, not record
    ]);

    const record = createMockMessageRecord({ partsJson });
    const tokens = estimateMessageTokens(record);

    assert.equal(tokens, 10);
  });

  test("falls back to text estimation when no explicit usage found", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ contentJson: '{"text":"hello"}' }),
    ]);

    const record = createMockMessageRecord({
      content: "fallback content",
      partsJson,
    });

    const tokens = estimateMessageTokens(record);
    assert.ok(tokens >= 2); // Some tokens estimated from text
  });

  test("uses renderedContent when provided and no explicit usage", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ contentJson: '{"text":"original"}' }),
    ]);

    const record = createMockMessageRecord({
      content: "original content",
      partsJson,
    });

    const tokens = estimateMessageTokens(record, { renderedContent: "Rendered content here is much longer than before" });
    assert.ok(tokens >= 5);
  });

  test("uses text estimation when trimmed is true", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ contentJson: '{"estimatedTokens":1000}' }),
    ]);

    const record = createMockMessageRecord({
      content: "This should be used",
      partsJson,
    });

    const tokens = estimateMessageTokens(record, { trimmed: true });
    assert.ok(tokens < 1000); // Should use text estimation, not explicit
  });

  test("returns minimum 1 token when no explicit usage and empty content", () => {
    const record = createMockMessageRecord({
      content: "",
      partsJson: null,
    });

    const tokens = estimateMessageTokens(record);
    assert.ok(tokens >= 1);
  });

  test("returns minimum 1 token even with null partsJson", () => {
    const record = createMockMessageRecord({
      content: "hello",
      partsJson: null,
    });

    const tokens = estimateMessageTokens(record);
    assert.ok(tokens >= 1);
  });

  test("handles parts with zero values gracefully", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ contentJson: '{"estimatedTokens":0}' }),
    ]);

    const record = createMockMessageRecord({ partsJson });
    const tokens = estimateMessageTokens(record);

    // 0 explicit should fall back to text estimation
    assert.ok(tokens >= 1);
  });

  test("handles parts with negative values as invalid", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ contentJson: '{"estimatedTokens":-50}' }),
    ]);

    const record = createMockMessageRecord({ partsJson });
    const tokens = estimateMessageTokens(record);

    // Negative should be treated as invalid, fall back to text
    assert.ok(tokens >= 1);
  });

  test("handles mixed explicit usage types across parts", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ contentJson: '{"estimatedTokens":10}' }),
      createMockMessagePart({ contentJson: '{"tokenCount":20}' }),
      createMockMessagePart({ contentJson: '{"inputTokens":15,"outputTokens":25}' }), // 40
      createMockMessagePart({ contentJson: '{"usage":{"totalTokens":100}}' }),
    ]);

    const record = createMockMessageRecord({ partsJson });
    const tokens = estimateMessageTokens(record);

    assert.equal(tokens, 170); // 10 + 20 + 40 + 100
  });

  test("prefers explicit tokens over text when available", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ contentJson: '{"estimatedTokens":5}' }),
    ]);

    const record = createMockMessageRecord({
      content: "This is much longer and would estimate to many more tokens if used",
      partsJson,
    });

    const tokens = estimateMessageTokens(record);
    assert.equal(tokens, 5); // Should use explicit value
  });

  test("handles non-numeric token values as invalid", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ contentJson: '{"estimatedTokens":"fifty"}' }),
    ]);

    const record = createMockMessageRecord({ partsJson });
    const tokens = estimateMessageTokens(record);

    assert.ok(tokens >= 1); // Fallback to text estimation
  });

  test("handles Infinity values as invalid", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ contentJson: '{"estimatedTokens":Infinity}' }),
    ]);

    const record = createMockMessageRecord({ partsJson });
    const tokens = estimateMessageTokens(record);

    assert.ok(tokens >= 1); // Fallback
  });

  test("handles NaN values as invalid", () => {
    const partsJson = JSON.stringify([
      createMockMessagePart({ contentJson: '{"estimatedTokens":NaN}' }),
    ]);

    const record = createMockMessageRecord({ partsJson });
    const tokens = estimateMessageTokens(record);

    assert.ok(tokens >= 1); // Fallback
  });
});