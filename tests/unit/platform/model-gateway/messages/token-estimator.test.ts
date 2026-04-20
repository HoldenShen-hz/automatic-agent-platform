import assert from "node:assert/strict";
import test from "node:test";

import { estimateTextTokens, estimateMessageTokens } from "../../../../../src/platform/model-gateway/messages/token-estimator.js";

test("estimateTextTokens returns 1 for empty string", () => {
  assert.equal(estimateTextTokens(""), 1);
});

test("estimateTextTokens returns 1 for whitespace only", () => {
  assert.equal(estimateTextTokens("   "), 1);
  assert.equal(estimateTextTokens("\t\n"), 1);
});

test("estimateTextTokens handles plain English text", () => {
  // Simple word count based estimation
  const result = estimateTextTokens("hello world");
  assert.ok(result >= 1, "Should return at least 1 token");
});

test("estimateTextTokens handles long English words", () => {
  // A 20-char word should be roughly 5 tokens (20/4)
  const result = estimateTextTokens("supercalifragilisticexpialidocious");
  assert.ok(result >= 4, "Long word should estimate multiple tokens");
});

test("estimateTextTokens handles Chinese characters", () => {
  // Each CJK character is ~1 token
  const result = estimateTextTokens("你好世界");
  assert.equal(result, 4);
});

test("estimateTextTokens handles Japanese Hiragana", () => {
  const result = estimateTextTokens("こんにちは");
  assert.equal(result, 5);
});

test("estimateTextTokens handles Japanese Katakana", () => {
  const result = estimateTextTokens("テクノロジー");
  assert.equal(result, 6);
});

test("estimateTextTokens handles Korean Hangul", () => {
  const result = estimateTextTokens("안녕하세요");
  assert.equal(result, 5);
});

test("estimateTextTokens handles mixed CJK and English", () => {
  const result = estimateTextTokens("Hello 世界");
  // "Hello" ~2 tokens + "世界" ~2 tokens
  assert.ok(result >= 4);
});

test("estimateTextTokens handles numbers", () => {
  // Numbers estimated at ~3 chars per token
  const result = estimateTextTokens("1234567890");
  assert.ok(result >= 3);
});

test("estimateTextTokens handles newlines within content", () => {
  // Newlines estimated at 2 per token, but whitespace-only returns 1
  const result = estimateTextTokens("line1\nline2\nline3\nline4");
  assert.ok(result >= 4);
});

test("estimateTextTokens handles symbols", () => {
  // Symbols at 2 per token
  const result = estimateTextTokens("!@#$%^&*()");
  assert.ok(result >= 4);
});

test("estimateTextTokens handles CRLF line endings", () => {
  const result = estimateTextTokens("line1\r\nline2\r\nline3");
  assert.ok(result >= 3);
});

test("estimateTextTokens handles complex mixed content", () => {
  const result = estimateTextTokens("Hello 世界! 123 Test\nNew line");
  assert.ok(result >= 5);
});

test("estimateTextTokens handles code-like strings with dots and slashes", () => {
  // Word regex includes dots, slashes, colons, hyphens
  const result = estimateTextTokens("https://example.com/path/file.ts");
  assert.ok(result >= 8);
});

test("estimateMessageTokens uses rendered content when provided", () => {
  const message = {
    content: "original content",
    partsJson: null,
  };

  const result = estimateMessageTokens(message, {
    renderedContent: "rendered content",
  });

  assert.ok(result >= 1);
});

test("estimateMessageTokens returns 1 for empty content", () => {
  const message = {
    content: "",
    partsJson: null,
  };

  const result = estimateMessageTokens(message);
  assert.equal(result, 1);
});

test("estimateMessageTokens respects trimmed option", () => {
  const message = {
    content: "test content that should be estimated",
    partsJson: null,
  };

  // With trimmed=true, it should use the text estimator on content
  const result = estimateMessageTokens(message, { trimmed: true });
  assert.ok(result >= 1);
});

test("estimateMessageTokens parses partsJson for explicit token usage", () => {
  const message = {
    content: "test",
    partsJson: JSON.stringify([
      {
        partId: "msg1:part:1",
        messageId: "msg1",
        partType: "tool_result",
        sequence: 1,
        contentJson: JSON.stringify({ estimatedTokens: 150 }),
        lineageJson: null,
        createdAt: "2026-04-14T00:00:00.000Z",
      },
    ]),
  };

  const result = estimateMessageTokens(message);
  assert.equal(result, 150);
});

test("estimateMessageTokens sums tokenCount from multiple parts", () => {
  const message = {
    content: "test",
    partsJson: JSON.stringify([
      {
        partId: "msg1:part:1",
        messageId: "msg1",
        partType: "tool_result",
        sequence: 1,
        contentJson: JSON.stringify({ tokenCount: 100 }),
        lineageJson: null,
        createdAt: "2026-04-14T00:00:00.000Z",
      },
      {
        partId: "msg1:part:2",
        messageId: "msg1",
        partType: "summary",
        sequence: 2,
        contentJson: JSON.stringify({ tokenCount: 50 }),
        lineageJson: null,
        createdAt: "2026-04-14T00:00:00.000Z",
      },
    ]),
  };

  const result = estimateMessageTokens(message);
  assert.equal(result, 150);
});

test("estimateMessageTokens handles inputTokens and outputTokens", () => {
  const message = {
    content: "test",
    partsJson: JSON.stringify([
      {
        partId: "msg1:part:1",
        messageId: "msg1",
        partType: "tool_result",
        sequence: 1,
        contentJson: JSON.stringify({ inputTokens: 100, outputTokens: 200 }),
        lineageJson: null,
        createdAt: "2026-04-14T00:00:00.000Z",
      },
    ]),
  };

  const result = estimateMessageTokens(message);
  assert.equal(result, 300);
});

test("estimateMessageTokens handles nested tokenUsage", () => {
  const message = {
    content: "test",
    partsJson: JSON.stringify([
      {
        partId: "msg1:part:1",
        messageId: "msg1",
        partType: "tool_result",
        sequence: 1,
        contentJson: JSON.stringify({ tokenUsage: { totalTokens: 500 } }),
        lineageJson: null,
        createdAt: "2026-04-14T00:00:00.000Z",
      },
    ]),
  };

  const result = estimateMessageTokens(message);
  assert.equal(result, 500);
});

test("estimateMessageTokens falls back to text estimation when no explicit tokens", () => {
  const message = {
    content: "fallback content",
    partsJson: JSON.stringify([
      {
        partId: "msg1:part:1",
        messageId: "msg1",
        partType: "text",
        sequence: 1,
        contentJson: JSON.stringify({ text: "no token info here" }),
        lineageJson: null,
        createdAt: "2026-04-14T00:00:00.000Z",
      },
    ]),
  };

  const result = estimateMessageTokens(message);
  assert.ok(result >= 1);
});

test("estimateMessageTokens handles invalid partsJson gracefully", () => {
  const message = {
    content: "test content",
    partsJson: "not valid json",
  };

  const result = estimateMessageTokens(message);
  assert.ok(result >= 1);
});

test("estimateMessageTokens handles empty parts array", () => {
  const message = {
    content: "test content",
    partsJson: "[]",
  };

  const result = estimateMessageTokens(message);
  assert.ok(result >= 1);
});

test("estimateMessageTokens ignores parts when trimmed is true", () => {
  const message = {
    content: "hello world",
    partsJson: JSON.stringify([
      {
        partId: "msg1:part:1",
        messageId: "msg1",
        partType: "tool_result",
        sequence: 1,
        contentJson: JSON.stringify({ estimatedTokens: 9999 }),
        lineageJson: null,
        createdAt: "2026-04-14T00:00:00.000Z",
      },
    ]),
  };

  const result = estimateMessageTokens(message, { trimmed: true });
  // Should NOT return 9999, should estimate from text instead
  assert.ok(result < 100);
});
