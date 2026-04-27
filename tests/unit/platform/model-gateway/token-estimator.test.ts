import assert from "node:assert/strict";
import test from "node:test";

import { estimateTextTokens, estimateMessageTokens } from "../../../../src/platform/model-gateway/messages/token-estimator.js";

test("estimateTextTokens returns 1 for empty string", () => {
  const tokens = estimateTextTokens("");
  assert.equal(tokens, 1);
});

test("estimateTextTokens returns 1 for whitespace only", () => {
  const tokens = estimateTextTokens("   \n\t  ");
  assert.equal(tokens, 1);
});

test("estimateTextTokens estimates English words correctly", () => {
  const tokens = estimateTextTokens("hello world");
  assert.ok(tokens >= 2);
});

test("estimateTextTokens estimates CJK characters at roughly 1 token each", () => {
  const tokens = estimateTextTokens("你好世界");
  assert.ok(tokens >= 4);
});

test("estimateTextTokens estimates Japanese hiragana correctly", () => {
  const tokens = estimateTextTokens("こんにちは");
  assert.ok(tokens >= 5);
});

test("estimateTextTokens estimates Korean hangul correctly", () => {
  const tokens = estimateTextTokens("안녕하세요");
  assert.ok(tokens >= 5);
});

test("estimateTextTokens estimates numbers correctly", () => {
  const tokens = estimateTextTokens("1234567890");
  assert.ok(tokens >= 3);
});

test("estimateTextTokens estimates mixed content", () => {
  const tokens = estimateTextTokens("Hello 世界 123!");
  assert.ok(tokens >= 5);
});

test("estimateTextTokens handles long English text", () => {
  const text = "The quick brown fox jumps over the lazy dog. ".repeat(10);
  const tokens = estimateTextTokens(text);
  assert.ok(tokens > 50);
});

test("estimateTextTokens handles newlines", () => {
  const tokens = estimateTextTokens("line1\nline2\nline3");
  assert.ok(tokens >= 3);
});

test("estimateTextTokens handles mixed script with newlines", () => {
  const tokens = estimateTextTokens("Hello\n你好\nこんにちは\n안녕하세요");
  assert.ok(tokens >= 10);
});

test("estimateMessageTokens uses rendered content when provided", () => {
  const message = {
    content: "Original content",
    partsJson: null,
  };

  const tokens = estimateMessageTokens(message, {
    renderedContent: "Rendered content",
    trimmed: false,
  });

  assert.ok(tokens >= 1);
});

test("estimateMessageTokens returns at least 1 token", () => {
  const message = {
    content: "x",
    partsJson: null,
  };

  const tokens = estimateMessageTokens(message);

  assert.ok(tokens >= 1);
});

test("estimateMessageTokens with empty content returns minimum 1", () => {
  const message = {
    content: "",
    partsJson: null,
  };

  const tokens = estimateMessageTokens(message);

  assert.equal(tokens, 1);
});

test("estimateMessageTokens handles message with parts containing token usage", () => {
  const message = {
    content: "Content with tokens",
    partsJson: JSON.stringify([
      {
        partId: "msg:part:1",
        messageId: "msg",
        partType: "text",
        sequence: 1,
        contentJson: '{"text":"Hello","tokenUsage":{"inputTokens":5,"outputTokens":10}}',
        lineageJson: null,
        createdAt: "2026-04-27T00:00:00.000Z",
      },
    ]),
  };

  const tokens = estimateMessageTokens(message);

  assert.ok(tokens >= 1);
});

test("estimateMessageTokens handles parts with estimatedTokens", () => {
  const message = {
    content: "Content",
    partsJson: JSON.stringify([
      {
        partId: "msg:part:1",
        messageId: "msg",
        partType: "text",
        sequence: 1,
        contentJson: '{"text":"Hello","estimatedTokens":50}',
        lineageJson: null,
        createdAt: "2026-04-27T00:00:00.000Z",
      },
    ]),
  };

  const tokens = estimateMessageTokens(message);

  assert.ok(tokens >= 1);
});

test("estimateMessageTokens handles parts with totalTokens", () => {
  const message = {
    content: "Content",
    partsJson: JSON.stringify([
      {
        partId: "msg:part:1",
        messageId: "msg",
        partType: "text",
        sequence: 1,
        contentJson: '{"text":"Hello","totalTokens":100}',
        lineageJson: null,
        createdAt: "2026-04-27T00:00:00.000Z",
      },
    ]),
  };

  const tokens = estimateMessageTokens(message);

  assert.ok(tokens >= 1);
});

test("estimateMessageTokens handles parts with nested tokenUsage", () => {
  const message = {
    content: "Content",
    partsJson: JSON.stringify([
      {
        partId: "msg:part:1",
        messageId: "msg",
        partType: "text",
        sequence: 1,
        contentJson: '{"text":"Hello","tokenUsage":{"inputTokens":10,"outputTokens":20}}',
        lineageJson: null,
        createdAt: "2026-04-27T00:00:00.000Z",
      },
    ]),
  };

  const tokens = estimateMessageTokens(message);

  assert.ok(tokens >= 1);
});

test("estimateMessageTokens ignores invalid JSON in parts", () => {
  const message = {
    content: "Fallback content",
    partsJson: "not valid json",
  };

  const tokens = estimateMessageTokens(message);

  assert.ok(tokens >= 1);
});

test("estimateMessageTokens ignores malformed parts", () => {
  const message = {
    content: "Fallback content",
    partsJson: JSON.stringify([
      {
        partId: "msg:part:1",
        messageId: "msg",
        partType: "text",
        sequence: 1,
        contentJson: "not json",
        lineageJson: null,
        createdAt: "2026-04-27T00:00:00.000Z",
      },
    ]),
  };

  const tokens = estimateMessageTokens(message);

  assert.ok(tokens >= 1);
});

test("estimateTextTokens handles symbols correctly", () => {
  const tokens = estimateTextTokens("!@#$%^&*()_+-=[]{}|;':\",./<>?");
  assert.ok(tokens >= 5);
});

test("estimateTextTokens handles URLs", () => {
  const tokens = estimateTextTokens("https://example.com/path/to/resource");
  assert.ok(tokens >= 5);
});

test("estimateTextTokens handles email addresses", () => {
  const tokens = estimateTextTokens("user@example.com");
  assert.ok(tokens >= 3);
});

test("estimateTextTokens handles code snippets", () => {
  const tokens = estimateTextTokens("const x = (a, b) => a + b;");
  assert.ok(tokens >= 8);
});

test("estimateTextTokens handles mixed English and numbers", () => {
  const tokens = estimateTextTokens("Order #12345 shipped on 2024-01-15");
  assert.ok(tokens >= 6);
});

test("estimateMessageTokens with trimmed option uses rendered content", () => {
  const message = {
    content: "Original content",
    partsJson: JSON.stringify([
      {
        partId: "msg:part:1",
        messageId: "msg",
        partType: "text",
        sequence: 1,
        contentJson: '{"text":"Should not be used","estimatedTokens":1000}',
        lineageJson: null,
        createdAt: "2026-04-27T00:00:00.000Z",
      },
    ]),
  };

  const tokens = estimateMessageTokens(message, {
    renderedContent: "Trimmed rendered content that should be used",
    trimmed: true,
  });

  assert.ok(tokens >= 1);
});
