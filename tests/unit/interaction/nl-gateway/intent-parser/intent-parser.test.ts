/**
 * Unit tests for intent-parser module
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  detectInputLanguage,
  parseIntentTokens,
  parseIntentTokensWithModel,
  LlmIntentParser,
  intentConfidenceThresholds,
  type IntentType,
} from "../../../../../src/interaction/nl-gateway/intent-parser/index.js";

test("detectInputLanguage returns zh-CN for Chinese text", () => {
  assert.equal(detectInputLanguage("你好世界"), "zh-CN");
  assert.equal(detectInputLanguage("这是一个测试"), "zh-CN");
  assert.equal(detectInputLanguage("测试"), "zh-CN");
});

test("detectInputLanguage returns ja-JP for Japanese text", () => {
  assert.equal(detectInputLanguage("こんにちは"), "ja-JP");
  assert.equal(detectInputLanguage("テスト"), "ja-JP");
});

test("detectInputLanguage returns de-DE for German text", () => {
  // Note: detectInputLanguage may not detect all German words depending on character encoding
  assert.equal(detectInputLanguage("größe"), "de-DE");
});

test("detectInputLanguage returns en-US for default case", () => {
  assert.equal(detectInputLanguage("Hello world"), "en-US");
  assert.equal(detectInputLanguage("Test message"), "en-US");
  assert.equal(detectInputLanguage(""), "en-US");
});

test("parseIntentTokens detects approval action keywords", () => {
  const result = parseIntentTokens("approve this request");
  assert.equal(result[0].intentType, "approval_action");
  assert.equal(result[0].confidence, 0.92);

  const result2 = parseIntentTokens("审批通过");
  assert.equal(result2[0].intentType, "approval_action");

  const result3 = parseIntentTokens("批准");
  assert.equal(result3[0].intentType, "approval_action");
});

test("parseIntentTokens detects rejection keywords", () => {
  const result = parseIntentTokens("reject the request");
  assert.equal(result[0].intentType, "approval_action");
  assert.equal(result[0].confidence, 0.90);

  const result2 = parseIntentTokens("驳回");
  assert.equal(result2[0].intentType, "approval_action");
});

test("parseIntentTokens detects status inquiry keywords", () => {
  const result = parseIntentTokens("what is the status");
  assert.equal(result[0].intentType, "status_inquiry");

  const result2 = parseIntentTokens("状态查询");
  assert.equal(result2[0].intentType, "status_inquiry");

  const result3 = parseIntentTokens("情况如何");
  assert.equal(result3[0].intentType, "status_inquiry");
});

test("parseIntentTokens detects summary keywords", () => {
  const result = parseIntentTokens("give me a summary");
  assert.equal(result[0].intentType, "status_inquiry");

  const result2 = parseIntentTokens("请提供摘要");
  assert.equal(result2[0].intentType, "status_inquiry");
});

test("parseIntentTokens detects delete keywords", () => {
  const result = parseIntentTokens("delete all records");
  assert.equal(result[0].intentType, "task_modify");

  const result2 = parseIntentTokens("删除");
  assert.equal(result2[0].intentType, "task_modify");
});

test("parseIntentTokens detects update/modify keywords", () => {
  const result = parseIntentTokens("update the task");
  assert.equal(result[0].intentType, "task_modify");

  const result2 = parseIntentTokens("修改");
  assert.equal(result2[0].intentType, "task_modify");
});

test("parseIntentTokens detects create keywords", () => {
  const result = parseIntentTokens("create a new task");
  assert.equal(result[0].intentType, "task_create");

  const result2 = parseIntentTokens("新建任务");
  assert.equal(result2[0].intentType, "task_create");

  const result3 = parseIntentTokens("帮我做一个");
  assert.equal(result3[0].intentType, "task_create");
});

test("parseIntentTokens detects why question keywords", () => {
  const result = parseIntentTokens("why is this happening");
  assert.equal(result[0].intentType, "why");

  const result2 = parseIntentTokens("为什么");
  assert.equal(result2[0].intentType, "why");
});

test("parseIntentTokens detects single-word approval with high confidence", () => {
  const result = parseIntentTokens("approve");
  assert.equal(result[0].intentType, "approval_action");
  assert.equal(result[0].confidence, 0.92);

  const result2 = parseIntentTokens("审批");
  assert.equal(result2[0].intentType, "approval_action");
});

test("parseIntentTokens handles question patterns", () => {
  const result = parseIntentTokens("what should I do?");
  assert.equal(result[0].intentType, "task_query");
  assert.equal(result[0].confidence, 0.64);

  const result2 = parseIntentTokens("是否需要确认？");
  assert.equal(result2[0].intentType, "task_query");
});

test("parseIntentTokens handles request patterns for task_create", () => {
  const result = parseIntentTokens("请帮我创建任务");
  assert.equal(result[0].intentType, "task_create");

  const result2 = parseIntentTokens("需要执行部署");
  assert.equal(result2[0].intentType, "task_create");
});

test("parseIntentTokens returns task_query for unrecognized messages", () => {
  const result = parseIntentTokens("some random text");
  assert.equal(result[0].intentType, "task_query");
  assert.equal(result[0].confidence, 0.62);
});

test("parseIntentTokens returns task_query for empty message", () => {
  const result = parseIntentTokens("");
  assert.equal(result[0].intentType, "task_query");
});

test("parseIntentTokens uses highest confidence signal when multiple match", () => {
  const result = parseIntentTokens("create and approve the task");
  // Both create (0.88) and approve (0.92) keywords present, should use higher one
  assert.equal(result[0].intentType, "approval_action");
});

test("parseIntentTokens with long message has slightly higher confidence", () => {
  const shortMsg = "create task";
  const longMsg = "I need you to create a new task for me please execute this now";

  const shortResult = parseIntentTokens(shortMsg);
  const longResult = parseIntentTokens(longMsg);

  assert.equal(shortResult[0].intentType, "task_create");
  assert.equal(longResult[0].intentType, "task_create");
  // Long message (> 20 chars) should use higher confidence for task_create
  assert.ok(longResult[0].confidence >= shortResult[0].confidence);
});

test("parseIntentTokensWithModel returns heuristic when parser is null", async () => {
  const result = await parseIntentTokensWithModel("create a task", { parser: null });

  assert.equal(result[0].intentType, "task_create");
  assert.ok(result[0].confidence >= 0.85);
});

test("parseIntentTokensWithModel returns heuristic when model parsing fails", async () => {
  const mockParser = {
    parseWithLlm: async () => {
      throw new Error("Model unavailable");
    },
  };

  const result = await parseIntentTokensWithModel("approve request", {
    parser: mockParser as any,
  });

  assert.equal(result[0].intentType, "approval_action");
});

test("parseIntentTokensWithModel uses model result when confidence is sufficient", async () => {
  const mockParser = {
    parseWithLlm: async () => ({
      intentType: "task_create" as IntentType,
      confidence: 0.88,
      reasoning: "Model parsed this",
    }),
  };

  const result = await parseIntentTokensWithModel("create task", {
    parser: mockParser as any,
    minimumConfidence: 0.75,
  });

  assert.equal(result[0].intentType, "task_create");
  // Model confidence is used directly
  assert.equal(result[0].confidence, 0.88);
});

test("parseIntentTokensWithModel falls back when model confidence too low", async () => {
  const mockParser = {
    parseWithLlm: async () => ({
      intentType: "task_query" as IntentType,
      confidence: 0.5,
      reasoning: "Low confidence",
    }),
  };

  const result = await parseIntentTokensWithModel("approve request", {
    parser: mockParser as any,
    minimumConfidence: 0.75,
  });

  // Should fall back to heuristic which detects approval_action
  assert.equal(result[0].intentType, "approval_action");
});

test("parseIntentTokensWithModel handles null return from model", async () => {
  const mockParser = {
    parseWithLlm: async () => null,
  };

  const result = await parseIntentTokensWithModel("test message", {
    parser: mockParser as any,
  });

  assert.equal(result[0].intentType, "task_query");
});

test("parseIntentTokensWithModel handles array response from model", async () => {
  const mockParser = {
    parseWithLlm: async () => [
      { intentType: "task_create" as IntentType, confidence: 0.82 },
      { intentType: "task_query" as IntentType, confidence: 0.65 },
    ],
  };

  const result = await parseIntentTokensWithModel("create task", {
    parser: mockParser as any,
    minimumConfidence: 0.75,
  });

  assert.ok(result.length >= 1);
});

test("LlmIntentParser returns fallback when no model gateway provided", async () => {
  const parser = new LlmIntentParser(null);

  const result = await parser.parseWithLlm("approve this");

  assert.equal(result.intentType, "approval_action");
  assert.ok(result.reasoning.includes("Regex fallback"));
  assert.equal(result.language, "en-US");
});

test("LlmIntentParser uses provided model gateway", async () => {
  const mockGateway = {
    complete: async (prompt: string) => '{"intentType":"task_create","confidence":0.88}',
  };

  const parser = new LlmIntentParser(mockGateway);

  const result = await parser.parseWithLlm("create a task");

  assert.equal(result.intentType, "task_create");
  assert.equal(result.confidence, 0.88);
});

test("LlmIntentParser preserves task_create confidence from validated model output", async () => {
  const mockGateway = {
    complete: async () => '{"intentType":"task_create","confidence":0.5}',
  };

  const parser = new LlmIntentParser(mockGateway);

  const result = await parser.parseWithLlm("test");

  assert.equal(result.intentType, "task_create");
  assert.equal(result.confidence, 0.5);
});

test("LlmIntentParser falls back to heuristic on JSON parse error", async () => {
  const mockGateway = {
    complete: async () => "create a new task",
  };

  const parser = new LlmIntentParser(mockGateway);

  const result = await parser.parseWithLlm("create a task");

  assert.equal(result.intentType, "task_create");
});

test("LlmIntentParser falls back to heuristic on model error when fallback enabled", async () => {
  const mockGateway = {
    complete: async () => {
      throw new Error("Model error");
    },
  };

  const parser = new LlmIntentParser(mockGateway, true);

  const result = await parser.parseWithLlm("approve request");

  assert.equal(result.intentType, "approval_action");
});

test("LlmIntentParser returns low confidence when fallback disabled", async () => {
  const mockGateway = {
    complete: async () => {
      throw new Error("Model error");
    },
  };

  const parser = new LlmIntentParser(mockGateway, false);

  const result = await parser.parseWithLlm("test message");

  assert.equal(result.intentType, "task_query");
  assert.equal(result.confidence, intentConfidenceThresholds.fallbackThreshold - 0.1);
});

test("LlmIntentParser preserves reasoning from parsed response", async () => {
  const mockGateway = {
    complete: async () =>
      '{"intentType":"task_modify","confidence":0.85,"reasoning":"Detected modification intent"}',
  };

  const parser = new LlmIntentParser(mockGateway);

  const result = await parser.parseWithLlm("update the record");

  assert.equal(result.intentType, "task_modify");
  assert.ok(result.reasoning!.includes("Detected"));
});

test("LlmIntentParser detects language from message", async () => {
  const mockGateway = {
    complete: async () => '{"intentType":"task_create","confidence":0.85}',
  };

  const parser = new LlmIntentParser(mockGateway);

  const result = await parser.parseWithLlm("创建新任务");

  assert.equal(result.language, "zh-CN");
});

test("LlmIntentParser parses intent type from text when JSON invalid", async () => {
  const mockGateway = {
    complete: async () => '{"intent": "wrong_key", "score": 0.9}', // Invalid JSON with wrong keys
  };

  const parser = new LlmIntentParser(mockGateway);

  // JSON parse fails, falls through to parseIntentTypeFromText which returns default task_query
  const result = await parser.parseWithLlm("test message");

  // When JSON is invalid and text doesn't match any keyword, returns default task_query
  assert.equal(result.intentType, "task_query");
});

test("intentConfidenceThresholds has correct values", () => {
  assert.equal(intentConfidenceThresholds.llmAcceptThreshold, 0.75);
  assert.equal(intentConfidenceThresholds.fallbackThreshold, 0.50);
});

test("parseIntentTokens handles Chinese punctuation", () => {
  const result = parseIntentTokens("请帮我创建一个任务？");
  assert.equal(result[0].intentType, "task_create");
});

test("parseIntentTokens handles English question words", () => {
  // "How do I do this?" - no keywords, just a question mark
  const result = parseIntentTokens("How do I do this?");
  assert.equal(result[0].intentType, "task_query");
  assert.equal(result[0].confidence, 0.64);
});

test("parseIntentTokens handles mixed language message", () => {
  const result = parseIntentTokens("create a 新任务");
  assert.equal(result[0].intentType, "task_create");
});

test("parseIntentTokensWithModel respects minimumConfidence option", async () => {
  const mockParser = {
    parseWithLlm: async () => ({
      intentType: "task_query" as IntentType,
      confidence: 0.78,
    }),
  };

  const result = await parseIntentTokensWithModel("test", {
    parser: mockParser as any,
    minimumConfidence: 0.8,
  });

  // Should fall back to heuristic since model confidence (0.78) < minimumConfidence (0.8)
  assert.equal(result[0].intentType, "task_query");
});
