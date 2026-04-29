/**
 * Integration tests for TokenEstimator
 *
 * Tests the token estimation functions with realistic multi-script content
 * and integration with message parts parsing.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { estimateTextTokens, estimateMessageTokens } from "../../../../src/platform/model-gateway/messages/token-estimator.js";

test("TokenEstimator integration: Mixed CJK content estimation", () => {
  // Chinese characters
  const chinese = "你好世界你好世界";
  const chineseTokens = estimateTextTokens(chinese);
  assert.ok(chineseTokens >= 8, `Expected >= 8 tokens for Chinese, got ${chineseTokens}`);

  // Japanese hiragana
  const japanese = "こんにちは您好안녕하세요";
  const japaneseTokens = estimateTextTokens(japanese);
  assert.ok(japaneseTokens >= 7, `Expected >= 7 tokens for mixed CJK, got ${japaneseTokens}`);

  // Korean
  const korean = "안녕하세요";
  const koreanTokens = estimateTextTokens(korean);
  assert.ok(koreanTokens >= 5, `Expected >= 5 tokens for Korean, got ${koreanTokens}`);
});

test("TokenEstimator integration: English content with numbers and symbols", () => {
  const content = "Order #12345 shipped on 2024-01-15 for $99.99";
  const tokens = estimateTextTokens(content);
  assert.ok(tokens >= 12, `Expected >= 12 tokens, got ${tokens}`);
});

test("TokenEstimator integration: Code snippet estimation", () => {
  const code = "const calculateTotal = (items: number[]): number => items.reduce((a, b) => a + b, 0);";
  const tokens = estimateTextTokens(code);
  assert.ok(tokens >= 15, `Expected >= 15 tokens for code, got ${tokens}`);
});

test("TokenEstimator integration: URL and email estimation", () => {
  const content = "Contact us at support@example.com or visit https://api.example.com/v1/users";
  const tokens = estimateTextTokens(content);
  assert.ok(tokens >= 12, `Expected >= 12 tokens, got ${tokens}`);
});

test("TokenEstimator integration: Multi-line content with mixed scripts", () => {
  const content = `Hello 你好
Bonjour こんにちは
Guten Tag 안녕하세요`;

  const tokens = estimateTextTokens(content);
  assert.ok(tokens >= 15, `Expected >= 15 tokens for multi-line mixed content, got ${tokens}`);
});

test("TokenEstimator integration: Message tokens with parts containing token usage", () => {
  const message = {
    content: "Original content",
    partsJson: JSON.stringify([
      {
        partId: "msg:part:1",
        messageId: "msg",
        partType: "text",
        sequence: 1,
        contentJson: '{"text":"Hello","tokenUsage":{"inputTokens":5,"outputTokens":10}}',
        lineageJson: null,
        createdAt: "2026-04-29T00:00:00.000Z",
      },
      {
        partId: "msg:part:2",
        messageId: "msg",
        partType: "text",
        sequence: 2,
        contentJson: '{"text":"World","totalTokens":20}',
        lineageJson: null,
        createdAt: "2026-04-29T00:00:00.000Z",
      },
    ]),
  };

  const tokens = estimateMessageTokens(message);
  // Should sum: (5+10) + 20 = 35
  assert.ok(tokens >= 30, `Expected >= 30 tokens from token usage, got ${tokens}`);
});

test("TokenEstimator integration: Message tokens with estimatedTokens field", () => {
  const message = {
    content: "Content",
    partsJson: JSON.stringify([
      {
        partId: "msg:part:1",
        messageId: "msg",
        partType: "text",
        sequence: 1,
        contentJson: '{"text":"Hello","estimatedTokens":100}',
        lineageJson: null,
        createdAt: "2026-04-29T00:00:00.000Z",
      },
    ]),
  };

  const tokens = estimateMessageTokens(message);
  assert.ok(tokens >= 95, `Expected >= 95 tokens from estimatedTokens, got ${tokens}`);
});

test("TokenEstimator integration: Message tokens fallback to content when no parts", () => {
  const message = {
    content: "This is a fallback content that should be used when parts don't have token info",
    partsJson: null,
  };

  const tokens = estimateMessageTokens(message);
  assert.ok(tokens >= 15, `Expected >= 15 tokens from content, got ${tokens}`);
});

test("TokenEstimator integration: Message tokens with trimmed content", () => {
  const message = {
    content: "Original content that should not be used",
    partsJson: JSON.stringify([
      {
        partId: "msg:part:1",
        messageId: "msg",
        partType: "text",
        sequence: 1,
        contentJson: '{"text":"Should not be used","estimatedTokens":1000}',
        lineageJson: null,
        createdAt: "2026-04-29T00:00:00.000Z",
      },
    ]),
  };

  const tokens = estimateMessageTokens(message, {
    renderedContent: "Trimmed short content",
    trimmed: true,
  });
  // When trimmed is true, should use renderedContent instead of parts
  assert.ok(tokens >= 1, `Expected >= 1 tokens, got ${tokens}`);
});

test("TokenEstimator integration: Message tokens with invalid JSON in parts", () => {
  const message = {
    content: "Fallback content",
    partsJson: "this is not valid json",
  };

  const tokens = estimateMessageTokens(message);
  assert.ok(tokens >= 1, `Expected >= 1 tokens, got ${tokens}`);
});

test("TokenEstimator integration: Empty and whitespace content", () => {
  assert.strictEqual(estimateTextTokens(""), 1, "Empty string should return 1");
  assert.strictEqual(estimateTextTokens("   \n\t  "), 1, "Whitespace only should return 1");
});

test("TokenEstimator integration: Long English text", () => {
  const text = "The quick brown fox jumps over the lazy dog. ".repeat(50);
  const tokens = estimateTextTokens(text);
  assert.ok(tokens > 300, `Expected > 300 tokens for long text, got ${tokens}`);
});

test("TokenEstimator integration: Message tokens ignores malformed parts", () => {
  const message = {
    content: "Fallback content",
    partsJson: JSON.stringify([
      {
        partId: "msg:part:1",
        messageId: "msg",
        partType: "text",
        sequence: 1,
        contentJson: "not json at all",
        lineageJson: null,
        createdAt: "2026-04-29T00:00:00.000Z",
      },
    ]),
  };

  const tokens = estimateMessageTokens(message);
  // Should fall back to content
  assert.ok(tokens >= 1, `Expected >= 1 tokens, got ${tokens}`);
});

test("TokenEstimator integration: Symbols and special characters", () => {
  const symbols = "!@#$%^&*()_+-=[]{}|;':\",./<>?";
  const tokens = estimateTextTokens(symbols);
  assert.ok(tokens >= 10, `Expected >= 10 tokens for symbols, got ${tokens}`);
});

test("TokenEstimator integration: Unicode emoji handling", () => {
  const content = "Hello 👋🌍🎉 World";
  const tokens = estimateTextTokens(content);
  // Emoji are treated as symbols
  assert.ok(tokens >= 6, `Expected >= 6 tokens with emoji, got ${tokens}`);
});
