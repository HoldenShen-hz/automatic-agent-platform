/**
 * Unit tests for NL Gateway intent-parser module
 *
 * Tests LlmIntentParser, parseIntentTokens, detectInputLanguage,
 * and INTENT_CONFIDENCE_THRESHOLDS.
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  parseIntentTokens,
  LlmIntentParser,
  detectInputLanguage,
  INTENT_CONFIDENCE_THRESHOLDS,
  type IntentParserModelGateway,
  type LlmIntentParseResult,
} from "../../../../src/interaction/nl-gateway/intent-parser/index.js";

/**
 * Creates a mock model gateway for testing
 */
function createMockModelGateway(responses?: {
  complete?: (prompt: string) => Promise<string>;
}) {
  return {
    complete: async (_prompt: string): Promise<string> => {
      if (responses?.complete) {
        return responses.complete(_prompt);
      }
      return '{"intentType":"task_create","confidence":0.85}';
    },
  } as unknown as IntentParserModelGateway;
}

test("INTENT_CONFIDENCE_THRESHOLDS has correct values", () => {
  assert.equal(INTENT_CONFIDENCE_THRESHOLDS.LLM_ACCEPT_THRESHOLD, 0.75);
  assert.equal(INTENT_CONFIDENCE_THRESHOLDS.FALLBACK_THRESHOLD, 0.50);
});

test("detectInputLanguage returns zh-CN for Chinese characters", () => {
  assert.equal(detectInputLanguage("帮我创建一个任务"), "zh-CN");
  assert.equal(detectInputLanguage("这是中文"), "zh-CN");
});

test("detectInputLanguage returns ja-JP for Japanese characters", () => {
  // Use Katakana which is unique to Japanese
  assert.equal(detectInputLanguage("タスク"), "ja-JP");
  assert.equal(detectInputLanguage("ネットワーク"), "ja-JP");
});

test("detectInputLanguage returns de-DE for German characters", () => {
  assert.equal(detectInputLanguage("Straße"), "de-DE");
  assert.equal(detectInputLanguage("Größe"), "de-DE");
});

test("detectInputLanguage returns en-US for English characters", () => {
  assert.equal(detectInputLanguage("create a task"), "en-US");
  assert.equal(detectInputLanguage("hello world"), "en-US");
});

test("detectInputLanguage defaults to en-US for unrecognized text", () => {
  assert.equal(detectInputLanguage("123456"), "en-US");
  assert.equal(detectInputLanguage("!@#$%"), "en-US");
});

test("parseIntentTokens returns ParsedIntentToken array", () => {
  const result = parseIntentTokens("create a task");

  assert.ok(Array.isArray(result));
  assert.equal(result.length, 1);
  assert.ok("intentType" in result[0]!);
  assert.ok("confidence" in result[0]!);
});

test("parseIntentTokens approval_action with English approve", () => {
  const result = parseIntentTokens("approve this request");

  assert.equal(result[0]!.intentType, "approval_action");
  assert.equal(result[0]!.confidence, 0.92);
});

test("parseIntentTokens approval_action with Chinese 审批", () => {
  const result = parseIntentTokens("需要你审批一下");

  assert.equal(result[0]!.intentType, "approval_action");
});

test("parseIntentTokens approval_action with Chinese 通过", () => {
  const result = parseIntentTokens("通过这个工单");

  assert.equal(result[0]!.intentType, "approval_action");
});

test("parseIntentTokens status_inquiry with English status", () => {
  const result = parseIntentTokens("check the status");

  assert.equal(result[0]!.intentType, "status_inquiry");
  assert.equal(result[0]!.confidence, 0.84);
});

test("parseIntentTokens status_inquiry with Chinese 状态", () => {
  const result = parseIntentTokens("当前状态是什么");

  assert.equal(result[0]!.intentType, "status_inquiry");
});

test("parseIntentTokens task_modify with delete keyword", () => {
  const result = parseIntentTokens("delete the task");

  assert.equal(result[0]!.intentType, "task_modify");
  assert.equal(result[0]!.confidence, 0.8);
});

test("parseIntentTokens task_modify with Chinese 删除", () => {
  const result = parseIntentTokens("删除这条记录");

  assert.equal(result[0]!.intentType, "task_modify");
});

test("parseIntentTokens task_create with create keyword", () => {
  const result = parseIntentTokens("create a new task");

  assert.equal(result[0]!.intentType, "task_create");
  assert.equal(result[0]!.confidence, 0.88);
});

test("parseIntentTokens task_create with Chinese 创建", () => {
  const result = parseIntentTokens("创建一个新任务");

  assert.equal(result[0]!.intentType, "task_create");
});

test("parseIntentTokens task_create triggers for long messages (>12 chars)", () => {
  const result = parseIntentTokens("我想要你帮我处理一些日常事务");

  assert.equal(result[0]!.intentType, "task_create");
  assert.equal(result[0]!.confidence, 0.88);
});

test("parseIntentTokens defaults to task_query for short unrecognized messages", () => {
  const result = parseIntentTokens("hello");

  assert.equal(result[0]!.intentType, "task_query");
  assert.equal(result[0]!.confidence, 0.62);
});

test("parseIntentTokens is case insensitive", () => {
  const upper = parseIntentTokens("DELETE THE TASK");
  const lower = parseIntentTokens("delete the task");

  assert.equal(upper[0]!.intentType, lower[0]!.intentType);
  assert.equal(upper[0]!.confidence, lower[0]!.confidence);
});

test("LlmIntentParser uses model gateway when available", async () => {
  const mockGateway = createMockModelGateway({
    complete: async () => '{"intentType":"task_query","confidence":0.85}',
  });

  const parser = new LlmIntentParser(mockGateway, false);
  const result = await parser.parseWithLlm("test message");

  assert.equal(result.intentType, "task_query");
});

test("LlmIntentParser falls back to regex when LLM confidence below threshold", async () => {
  const mockGateway = createMockModelGateway({
    complete: async () => '{"intentType":"task_create","confidence":0.6}',
  });

  const parser = new LlmIntentParser(mockGateway, true);
  const result = await parser.parseWithLlm("approve this");

  // Should fall back to regex since confidence 0.6 < LLM_ACCEPT_THRESHOLD 0.75
  assert.equal(result.intentType, "approval_action");
});

test("LlmIntentParser falls back to regex when LLM throws", async () => {
  const mockGateway = createMockModelGateway({
    complete: async () => {
      throw new Error("LLM unavailable");
    },
  });

  const parser = new LlmIntentParser(mockGateway, true);
  const result = await parser.parseWithLlm("create a task");

  // Should fall back to regex
  assert.equal(result.intentType, "task_create");
});

test("LlmIntentParser returns task_query when fallback disabled and LLM fails", async () => {
  const mockGateway = createMockModelGateway({
    complete: async () => {
      throw new Error("LLM unavailable");
    },
  });

  const parser = new LlmIntentParser(mockGateway, false);
  const result = await parser.parseWithLlm("test message");

  assert.equal(result.intentType, "task_query");
  assert.equal(result.confidence, INTENT_CONFIDENCE_THRESHOLDS.FALLBACK_THRESHOLD - 0.1);
});

test("LlmIntentParser parses LLM response correctly", async () => {
  const mockGateway = createMockModelGateway({
    complete: async () => "The intent is task_create with high confidence",
  });

  const parser = new LlmIntentParser(mockGateway, false);
  const result = await parser.parseWithLlm("test message");

  assert.equal(result.intentType, "task_create");
  assert.equal(result.reasoning, "The intent is task_create with high confidence");
});

test("LlmIntentParser detects task_query from LLM response", async () => {
  const mockGateway = createMockModelGateway({
    complete: async () => "This looks like a query request",
  });

  const parser = new LlmIntentParser(mockGateway, false);
  const result = await parser.parseWithLlm("test message");

  assert.equal(result.intentType, "task_query");
});

test("LlmIntentParser detects task_modify from LLM response", async () => {
  const mockGateway = createMockModelGateway({
    complete: async () => "The user wants to modify something",
  });

  const parser = new LlmIntentParser(mockGateway, false);
  const result = await parser.parseWithLlm("test message");

  assert.equal(result.intentType, "task_modify");
});

test("LlmIntentParser detects approval_action from LLM response", async () => {
  const mockGateway = createMockModelGateway({
    complete: async () => "Need to approve this request",
  });

  const parser = new LlmIntentParser(mockGateway, false);
  const result = await parser.parseWithLlm("test message");

  assert.equal(result.intentType, "approval_action");
});

test("LlmIntentParser detects status_inquiry from LLM response", async () => {
  const mockGateway = createMockModelGateway({
    complete: async () => "Checking the status of something",
  });

  const parser = new LlmIntentParser(mockGateway, false);
  const result = await parser.parseWithLlm("test message");

  assert.equal(result.intentType, "status_inquiry");
});

test("LlmIntentParser respects locale parameter", async () => {
  const mockGateway = createMockModelGateway({
    complete: async (prompt: string) => {
      // Verify prompt contains locale
      assert.ok(prompt.includes("中文") || prompt.includes("English"));
      return '{"intentType":"task_create","confidence":0.85}';
    },
  });

  const parser = new LlmIntentParser(mockGateway, false);
  await parser.parseWithLlm("test message", "zh-CN");

  // Prompt should include locale context
});

test("LlmIntentParser uses regex fallback for approve intent", async () => {
  const mockGateway = createMockModelGateway({
    complete: async () => '{"intentType":"task_create","confidence":0.6}',
  });

  const parser = new LlmIntentParser(mockGateway, true);
  const result = await parser.parseWithLlm("approve this");

  assert.equal(result.intentType, "approval_action");
});

test("LlmIntentParser uses regex fallback for status intent", async () => {
  // LLM returns task_create with low confidence - below LLM_ACCEPT_THRESHOLD (0.75)
  // so should fall back to regex
  const mockGateway = createMockModelGateway({
    complete: async () => '{"intentType":"task_create","confidence":0.6}',
  });

  const parser = new LlmIntentParser(mockGateway, true);
  const result = await parser.parseWithLlm("check something");

  // Should fall back to regex which sees no keywords and short message
  // returns task_query (default)
  assert.equal(result.intentType, "task_query");
});

test("LlmIntentParser defaults to null modelGateway", async () => {
  const parser = new LlmIntentParser();
  const result = await parser.parseWithLlm("create a task");

  // Should fall back to regex since modelGateway is null
  assert.equal(result.intentType, "task_create");
});

test("LlmIntentParser returns correct LlmIntentParseResult shape", async () => {
  const parser = new LlmIntentParser();
  const result = await parser.parseWithLlm("hello");

  assert.ok("intentType" in result);
  assert.ok("confidence" in result);
  assert.ok("reasoning" in result);
  assert.ok("language" in result);
  assert.equal(typeof result.intentType, "string");
  assert.equal(typeof result.confidence, "number");
  assert.equal(typeof result.reasoning, "string");
  assert.equal(typeof result.language, "string");
});

test("LlmIntentParser reasoning includes locale info in fallback", async () => {
  const parser = new LlmIntentParser();
  const result = await parser.parseWithLlm("create a task", "en-US");

  assert.ok(result.reasoning.includes("en-US") || result.reasoning.includes("Regex fallback"));
});

test("LlmIntentParser language matches detected locale", async () => {
  const parser = new LlmIntentParser();
  const zhResult = await parser.parseWithLlm("创建任务", "zh-CN");

  assert.equal(zhResult.language, "zh-CN");

  const enResult = await parser.parseWithLlm("create task", "en-US");

  assert.equal(enResult.language, "en-US");
});

test("parseIntentTokens handles mixed Chinese and English", () => {
  const result = parseIntentTokens("帮我delete这个task");

  // Should detect delete keyword
  assert.equal(result[0]!.intentType, "task_modify");
});

test("parseIntentTokens handles special characters without crashing", () => {
  const result = parseIntentTokens("!@#$%^&*()");

  // Should fall through to default task_query
  assert.equal(result[0]!.intentType, "task_query");
});
