/**
 * Unit tests for intent-parser index.ts - LlmIntentParser and helper functions
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  detectInputLanguage,
  parseIntentTokensWithModel,
  LlmIntentParser,
  INTENT_CONFIDENCE_THRESHOLDS,
  type IntentParserModelGateway,
  type ParsedIntentToken,
  type IntentParserContext,
} from "../../../../../src/interaction/nl-gateway/intent-parser/index.js";

test("detectInputLanguage returns zh-CN for Chinese text", () => {
  assert.equal(detectInputLanguage("帮我创建一个任务"), "zh-CN");
  assert.equal(detectInputLanguage("这是测试"), "zh-CN");
});

test.skip("detectInputLanguage returns ja-JP for Japanese text", () => {
  assert.equal(detectInputLanguage("レポートを作成"), "ja-JP");
  assert.equal(detectInputLanguage("テストです"), "ja-JP");
});

test("detectInputLanguage returns de-DE for German text", () => {
  assert.equal(detectInputLanguage("Ich möchte einen Bericht"), "de-DE");
  assert.equal(detectInputLanguage("Überprüfung"), "de-DE");
});

test("detectInputLanguage returns en-US for English text", () => {
  assert.equal(detectInputLanguage("Create a task"), "en-US");
  assert.equal(detectInputLanguage("Hello world"), "en-US");
});

test("INTENT_CONFIDENCE_THRESHOLDS has correct values", () => {
  assert.equal(INTENT_CONFIDENCE_THRESHOLDS.LLM_ACCEPT_THRESHOLD, 0.75);
  assert.equal(INTENT_CONFIDENCE_THRESHOLDS.FALLBACK_THRESHOLD, 0.50);
});

test("LlmIntentParser constructor works with null modelGateway", () => {
  const parser = new LlmIntentParser(null);
  assert.ok(parser !== undefined);
});

test("LlmIntentParser constructor works with modelGateway", () => {
  const mockGateway: IntentParserModelGateway = {
    complete: async () => '{"intentType": "task_create", "confidence": 0.9}',
  };
  const parser = new LlmIntentParser(mockGateway);
  assert.ok(parser !== undefined);
});

test("LlmIntentParser.parseWithLlm uses heuristic when no model gateway", async () => {
  const parser = new LlmIntentParser(null);

  const result = await parser.parseWithLlm("创建任务");

  assert.equal(result.intentType, "task_create");
  assert.ok(result.confidence >= INTENT_CONFIDENCE_THRESHOLDS.FALLBACK_THRESHOLD);
  assert.equal(result.language, "zh-CN");
});

test("LlmIntentParser.parseWithLlm returns reasoning indicating regex fallback", async () => {
  const parser = new LlmIntentParser(null);

  const result = await parser.parseWithLlm("创建一个新任务");

  assert.ok(result.reasoning.includes("Regex fallback"));
});

test("LlmIntentParser.parseWithLlm uses model when available and confidence is high enough", async () => {
  const mockGateway: IntentParserModelGateway = {
    complete: async () => '{"intentType": "task_create", "confidence": 0.9, "reasoning": "Model parsed"}',
  };
  const parser = new LlmIntentParser(mockGateway);

  const result = await parser.parseWithLlm("create a task");

  assert.equal(result.intentType, "task_create");
  assert.equal(result.confidence, 0.9);
  assert.equal(result.language, "en-US");
});

test("LlmIntentParser.parseWithLlm preserves model confidence when response is valid", async () => {
  const mockGateway: IntentParserModelGateway = {
    complete: async () => '{"intentType": "task_create", "confidence": 0.4}',
  };
  const parser = new LlmIntentParser(mockGateway);

  const result = await parser.parseWithLlm("create a task");

  assert.equal(result.confidence, 0.4);
});

test.skip("LlmIntentParser.parseWithLlm extracts intent from text response when JSON parse fails", async () => {
  const mockGateway: IntentParserModelGateway = {
    complete: async () => "The user wants to create a task",
  };
  const parser = new LlmIntentParser(mockGateway);

  const result = await parser.parseWithLlm("create task please");

  // Should use text parsing fallback
  assert.equal(result.intentType, "task_query");
});

test("LlmIntentParser.parseWithLlm handles model exception gracefully", async () => {
  const mockGateway: IntentParserModelGateway = {
    complete: async () => {
      throw new Error("Model unavailable");
    },
  };
  const parser = new LlmIntentParser(mockGateway, true);

  const result = await parser.parseWithLlm("帮我做一下");

  // Should fall back to regex parsing
  assert.equal(result.intentType, "task_create");
});

test("LlmIntentParser.parseWithLlm does not fall back when fallbackToRegex is false", async () => {
  const mockGateway: IntentParserModelGateway = {
    complete: async () => {
      throw new Error("Model unavailable");
    },
  };
  const parser = new LlmIntentParser(mockGateway, false);

  const result = await parser.parseWithLlm("帮我做一下");

  // Should return low confidence without fallback
  assert.ok(result.confidence < INTENT_CONFIDENCE_THRESHOLDS.FALLBACK_THRESHOLD);
});

test("LlmIntentParser.parseWithLlm preserves task_create confidence from model output", async () => {
  const mockGateway: IntentParserModelGateway = {
    complete: async () => '{"intentType": "task_create", "confidence": 0.5}',
  };
  const parser = new LlmIntentParser(mockGateway);

  const result = await parser.parseWithLlm("create something");

  assert.equal(result.confidence, 0.5);
});

test("parseIntentTokensWithModel returns heuristic when no parser provided", async () => {
  const result = await parseIntentTokensWithModel("创建一个任务");

  assert.ok(result.length > 0);
  assert.equal(result[0]!.intentType, "task_create");
});

test("parseIntentTokensWithModel returns heuristic when parser throws", async () => {
  const failingParser = {
    parseWithLlm: async () => {
      throw new Error("Parser error");
    },
  };

  const result = await parseIntentTokensWithModel("create a task", {
    parser: failingParser,
  });

  // Should return heuristic result
  assert.ok(result.length > 0);
});

test("parseIntentTokensWithModel uses parser result when confidence is high enough", async () => {
  const highConfidenceParser = {
    parseWithLlm: async () => ({
      intentType: "task_query" as const,
      confidence: 0.9,
    }),
  };

  const result = await parseIntentTokensWithModel("what is the status", {
    parser: highConfidenceParser,
    minimumConfidence: 0.75,
  });

  assert.ok(result.length > 0);
  assert.equal(result[0]!.intentType, "task_query");
});

test("parseIntentTokensWithModel respects minimumConfidence parameter", async () => {
  const lowConfidenceParser = {
    parseWithLlm: async () => ({
      intentType: "task_query" as const,
      confidence: 0.6,
    }),
  };

  const result = await parseIntentTokensWithModel("create task", {
    parser: lowConfidenceParser,
    minimumConfidence: 0.8,
  });

  // Heuristic task_create (0.88) > 0.8 minimumConfidence, so heuristic should be returned
  assert.equal(result[0]!.intentType, "task_create");
});

test("parseIntentTokensWithModel handles array response from parser", async () => {
  const multiIntentParser = {
    parseWithLlm: async () => [
      { intentType: "task_create" as const, confidence: 0.9 },
      { intentType: "task_query" as const, confidence: 0.7 },
    ],
  };

  const result = await parseIntentTokensWithModel("create a task", {
    parser: multiIntentParser,
    minimumConfidence: 0.5,
  });

  assert.ok(result.length >= 1);
  assert.equal(result[0]!.intentType, "task_create");
});

test("parseIntentTokensWithModel handles empty array from parser", async () => {
  const emptyParser = {
    parseWithLlm: async () => [],
  };

  const result = await parseIntentTokensWithModel("create task", {
    parser: emptyParser,
  });

  // Should return heuristic when parser returns empty
  assert.ok(result.length > 0);
});

test("parseIntentTokensWithModel accepts locale option", async () => {
  const parser = {
    parseWithLlm: async (input: { message: string; locale: string }) => {
      assert.equal(input.locale, "ja-JP");
      return { intentType: "task_create" as const, confidence: 0.9 };
    },
  };

  await parseIntentTokensWithModel("タスクを作成", {
    parser,
    locale: "ja-JP",
  });
});

test.skip("LlmIntentParser uses detected input language", async () => {
  const mockGateway: IntentParserModelGateway = {
    complete: async (prompt: string) => {
      // Verify the prompt contains locale information
      assert.ok(prompt.includes("日本語") || prompt.includes("Japanese"));
      return '{"intentType": "task_create", "confidence": 0.9}';
    },
  };
  const parser = new LlmIntentParser(mockGateway);

  // Message with Japanese characters
  const result = await parser.parseWithLlm("レポートを作成");

  assert.equal(result.language, "ja-JP");
});

test("LlmIntentParser handles text response containing intent type keywords", async () => {
  const mockGateway: IntentParserModelGateway = {
    complete: async () => "Based on the message, I think this is a task_create intent",
  };
  const parser = new LlmIntentParser(mockGateway);

  const result = await parser.parseWithLlm("make a report");

  assert.equal(result.intentType, "task_create");
});

test("LlmIntentParser handles text response with why intent", async () => {
  const mockGateway: IntentParserModelGateway = {
    complete: async () => "This is a why question about the system behavior",
  };
  const parser = new LlmIntentParser(mockGateway);

  const result = await parser.parseWithLlm("why did this happen");

  assert.equal(result.intentType, "why");
});

test("LlmIntentParser uses reasoning from model when available", async () => {
  const mockGateway: IntentParserModelGateway = {
    complete: async () => '{"intentType": "task_modify", "confidence": 0.85, "reasoning": "Detected update keywords"}',
  };
  const parser = new LlmIntentParser(mockGateway);

  const result = await parser.parseWithLlm("update the config");

  assert.ok(result.reasoning.includes("Detected update keywords"));
});
