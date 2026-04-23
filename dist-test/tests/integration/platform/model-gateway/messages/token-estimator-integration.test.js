/**
 * Integration Test: Token Estimator
 *
 * Verifies token estimation for messages and text content.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { estimateTextTokens, estimateMessageTokens, } from "../../../../../src/platform/model-gateway/messages/token-estimator.js";
test("TokenEstimator: empty text returns 1 token", () => {
    assert.equal(estimateTextTokens(""), 1);
    assert.equal(estimateTextTokens("   "), 1);
});
test("TokenEstimator: English text estimation", () => {
    const text = "Hello world";
    const tokens = estimateTextTokens(text);
    // "Hello world" has 11 chars, English estimation ~4 chars/token
    assert.ok(tokens >= 2 && tokens <= 4, `Expected 2-4 tokens, got ${tokens}`);
});
test("TokenEstimator: Chinese characters estimated at 1 token each", () => {
    const text = "你好世界"; // 4 Chinese characters
    const tokens = estimateTextTokens(text);
    assert.equal(tokens, 4, "Chinese characters should be ~1 token each");
});
test("TokenEstimator: Japanese characters estimated at 1 token each", () => {
    const text = "こんにちは世界"; // Japanese greeting
    const tokens = estimateTextTokens(text);
    // Hiragana/Katakana estimated at 1 token per character
    assert.ok(tokens >= 5 && tokens <= 7, `Expected 5-7 tokens for Japanese, got ${tokens}`);
});
test("TokenEstimator: Korean characters estimated at 1 token each", () => {
    const text = "안녕하세요"; // Korean greeting
    const tokens = estimateTextTokens(text);
    assert.ok(tokens >= 4 && tokens <= 6, `Expected 4-6 tokens for Korean, got ${tokens}`);
});
test("TokenEstimator: mixed CJK and English", () => {
    const text = "Hello 你好 world 世界";
    const tokens = estimateTextTokens(text);
    // 5 English words (~5 tokens) + 4 CJK characters (4 tokens)
    assert.ok(tokens >= 7 && tokens <= 12, `Expected 7-12 tokens, got ${tokens}`);
});
test("TokenEstimator: numbers estimated at ~3 chars per token", () => {
    const text = "1234567890";
    const tokens = estimateTextTokens(text);
    assert.ok(tokens >= 3 && tokens <= 4, `Expected 3-4 tokens for 10 digits, got ${tokens}`);
});
test("TokenEstimator: code blocks with symbols", () => {
    const code = "function hello() { return 42; }";
    const tokens = estimateTextTokens(code);
    // Code with symbols should still estimate
    assert.ok(tokens > 5, `Expected >5 tokens for code, got ${tokens}`);
});
test("TokenEstimator: newlines are estimated", () => {
    const text = "line1\nline2\nline3";
    const tokens = estimateTextTokens(text);
    assert.ok(tokens >= 3, `Expected >=3 tokens for multiline text, got ${tokens}`);
});
test("TokenEstimator: symbols estimated at ~2 chars per token", () => {
    const text = "!@#$%^&*()";
    const tokens = estimateTextTokens(text);
    // 10 symbols ~2 chars/token = 5 tokens
    assert.ok(tokens >= 2 && tokens <= 6, `Expected 2-6 tokens for symbols, got ${tokens}`);
});
test("TokenEstimator: long text scales proportionally", () => {
    const short = "short";
    const long = "This is a much longer piece of text that should require more tokens";
    const shortTokens = estimateTextTokens(short);
    const longTokens = estimateTextTokens(long);
    assert.ok(longTokens > shortTokens, "Longer text should have more tokens");
});
test("TokenEstimator: repeated words increase token count", () => {
    const single = "hello";
    const repeated = "hello hello hello hello hello";
    const singleTokens = estimateTextTokens(single);
    const repeatedTokens = estimateTextTokens(repeated);
    assert.ok(repeatedTokens > singleTokens, "Repeated words should have more tokens");
});
test("MessageTokenEstimator: message with partsJson extracts token usage", () => {
    const message = {
        content: "Test message",
        partsJson: JSON.stringify([
            {
                partId: "msg_123:part:1",
                messageId: "msg_123",
                partType: "text",
                sequence: 1,
                contentJson: JSON.stringify({ usage: { inputTokens: 100, outputTokens: 50 } }),
                lineageJson: null,
                createdAt: "2024-01-01T00:00:00.000Z",
            },
        ]),
    };
    const tokens = estimateMessageTokens(message);
    // Should extract 100 + 50 = 150 from usage
    assert.equal(tokens, 150, "Should extract token usage from partsJson");
});
test("MessageTokenEstimator: message without partsJson falls back to text estimation", () => {
    const message = {
        content: "Hello world",
        partsJson: null,
    };
    const tokens = estimateMessageTokens(message);
    assert.ok(tokens >= 2, `Should estimate tokens from content, got ${tokens}`);
});
test("MessageTokenEstimator: message with empty partsJson falls back to text", () => {
    const message = {
        content: "Test content",
        partsJson: "",
    };
    const tokens = estimateMessageTokens(message);
    assert.ok(tokens >= 1, `Should estimate tokens from content, got ${tokens}`);
});
test("MessageTokenEstimator: message with invalid partsJson falls back to text", () => {
    const message = {
        content: "Valid content",
        partsJson: "not valid json",
    };
    const tokens = estimateMessageTokens(message);
    assert.ok(tokens >= 1, `Should estimate tokens from content, got ${tokens}`);
});
test("MessageTokenEstimator: trimmed option skips partsJson token extraction", () => {
    const message = {
        content: "Trimmed content",
        partsJson: JSON.stringify([
            {
                partId: "msg_123:part:1",
                messageId: "msg_123",
                partType: "text",
                sequence: 1,
                contentJson: JSON.stringify({ usage: { inputTokens: 100, outputTokens: 50 } }),
                lineageJson: null,
                createdAt: "2024-01-01T00:00:00.000Z",
            },
        ]),
    };
    const tokens = estimateMessageTokens(message, { trimmed: true });
    // Should use text estimation, not partsJson
    assert.ok(tokens >= 1, `Should estimate from content, got ${tokens}`);
});
test("MessageTokenEstimator: renderedContent option used when provided with trimmed", () => {
    const message = {
        content: "Original content",
        partsJson: JSON.stringify([
            {
                partId: "msg_123:part:1",
                messageId: "msg_123",
                partType: "text",
                sequence: 1,
                contentJson: JSON.stringify({ usage: { inputTokens: 100 } }),
                lineageJson: null,
                createdAt: "2024-01-01T00:00:00.000Z",
            },
        ]),
    };
    const tokens = estimateMessageTokens(message, {
        trimmed: true,
        renderedContent: "Rendered longer content here",
    });
    // Should use renderedContent for estimation
    assert.ok(tokens >= 5, `Should estimate from renderedContent, got ${tokens}`);
});
test("MessageTokenEstimator: direct token keys in contentJson", () => {
    const message = {
        content: "Test",
        partsJson: JSON.stringify([
            {
                partId: "msg_123:part:1",
                messageId: "msg_123",
                partType: "text",
                sequence: 1,
                contentJson: JSON.stringify({ estimatedTokens: 500 }),
                lineageJson: null,
                createdAt: "2024-01-01T00:00:00.000Z",
            },
        ]),
    };
    const tokens = estimateMessageTokens(message);
    assert.equal(tokens, 500, "Should extract estimatedTokens");
});
test("MessageTokenEstimator: tokenCount key in contentJson", () => {
    const message = {
        content: "Test",
        partsJson: JSON.stringify([
            {
                partId: "msg_123:part:1",
                messageId: "msg_123",
                partType: "text",
                sequence: 1,
                contentJson: JSON.stringify({ tokenCount: 250 }),
                lineageJson: null,
                createdAt: "2024-01-01T00:00:00.000Z",
            },
        ]),
    };
    const tokens = estimateMessageTokens(message);
    assert.equal(tokens, 250, "Should extract tokenCount");
});
test("MessageTokenEstimator: totalTokens key in contentJson", () => {
    const message = {
        content: "Test",
        partsJson: JSON.stringify([
            {
                partId: "msg_123:part:1",
                messageId: "msg_123",
                partType: "text",
                sequence: 1,
                contentJson: JSON.stringify({ totalTokens: 300 }),
                lineageJson: null,
                createdAt: "2024-01-01T00:00:00.000Z",
            },
        ]),
    };
    const tokens = estimateMessageTokens(message);
    assert.equal(tokens, 300, "Should extract totalTokens");
});
test("MessageTokenEstimator: multiple parts accumulate token usage", () => {
    const message = {
        content: "Test",
        partsJson: JSON.stringify([
            {
                partId: "msg_123:part:1",
                messageId: "msg_123",
                partType: "text",
                sequence: 1,
                contentJson: JSON.stringify({ usage: { inputTokens: 100, outputTokens: 50 } }),
                lineageJson: null,
                createdAt: "2024-01-01T00:00:00.000Z",
            },
            {
                partId: "msg_123:part:2",
                messageId: "msg_123",
                partType: "text",
                sequence: 2,
                contentJson: JSON.stringify({ usage: { inputTokens: 200, outputTokens: 100 } }),
                lineageJson: null,
                createdAt: "2024-01-01T00:00:01.000Z",
            },
        ]),
    };
    const tokens = estimateMessageTokens(message);
    // Should sum: (100+50) + (200+100) = 450
    assert.equal(tokens, 450, "Should sum token usage from all parts");
});
//# sourceMappingURL=token-estimator-integration.test.js.map