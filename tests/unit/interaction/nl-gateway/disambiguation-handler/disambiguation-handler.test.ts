/**
 * Unit tests for DisambiguationHandler class
 */

import assert from "node:assert/strict";
import test from "node:test";
import { DisambiguationHandler } from "../../../../../src/interaction/nl-gateway/disambiguation-handler/index.js";

function createMockIntent(intentType = "task_create" as const, confidence = 0.85) {
  return {
    intentType,
    confidence,
    reasoning: "test reasoning",
    entities: [],
  };
}

test("DisambiguationHandler requiresClarification returns false when proactive clarification disabled", () => {
  const handler = new DisambiguationHandler({ enableProactiveClarification: false });
  assert.equal(handler.requiresClarification(0.6, "hello", 1), false);
});

test("DisambiguationHandler requiresClarification delegates to detectAmbiguity", () => {
  const handler = new DisambiguationHandler({ enableProactiveClarification: true });
  // Short message with low confidence should require clarification
  assert.equal(handler.requiresClarification(0.5, "ab", 0), true);
  // Long message with high confidence should not
  assert.equal(handler.requiresClarification(0.9, "a longer message here", 2), false);
});

test("DisambiguationHandler getConfidenceLevel returns high for confidence >= 0.85", () => {
  const handler = new DisambiguationHandler();
  assert.equal(handler.getConfidenceLevel(0.85), "high");
  assert.equal(handler.getConfidenceLevel(0.9), "high");
  assert.equal(handler.getConfidenceLevel(1.0), "high");
});

test("DisambiguationHandler getConfidenceLevel returns medium for confidence >= 0.7 and < 0.85", () => {
  const handler = new DisambiguationHandler({ threshold: 0.7 });
  assert.equal(handler.getConfidenceLevel(0.7), "medium");
  assert.equal(handler.getConfidenceLevel(0.75), "medium");
  assert.equal(handler.getConfidenceLevel(0.84), "medium");
});

test("DisambiguationHandler getConfidenceLevel returns low for confidence >= 0.5 and < 0.7", () => {
  const handler = new DisambiguationHandler({ threshold: 0.7, lowConfidenceThreshold: 0.5 });
  assert.equal(handler.getConfidenceLevel(0.5), "low");
  assert.equal(handler.getConfidenceLevel(0.6), "low");
  assert.equal(handler.getConfidenceLevel(0.69), "low");
});

test("DisambiguationHandler getConfidenceLevel returns very_low for confidence < 0.5", () => {
  const handler = new DisambiguationHandler({ lowConfidenceThreshold: 0.5 });
  assert.equal(handler.getConfidenceLevel(0.49), "very_low");
  assert.equal(handler.getConfidenceLevel(0.3), "very_low");
  assert.equal(handler.getConfidenceLevel(0.0), "very_low");
});

test("DisambiguationHandler generateClarification generates very low confidence questions", () => {
  const handler = new DisambiguationHandler();
  const intent = createMockIntent("task_create", 0.3);
  const result = handler.generateClarification("deploy to prod", 0.3, intent, []);

  assert.equal(result.requiresClarification, true);
  assert.ok(result.questions.length > 0);
  assert.equal(result.confidenceLevel, "very_low");
  assert.equal(result.reason, "意图置信度过低，无法自动处理");
});

test("DisambiguationHandler generateClarification generates low confidence questions", () => {
  const handler = new DisambiguationHandler();
  const intent = createMockIntent("task_create", 0.6);
  const result = handler.generateClarification("帮我处理一下", 0.6, intent, []);

  assert.equal(result.requiresClarification, true);
  assert.ok(result.questions.length > 0);
  assert.equal(result.confidenceLevel, "low");
  assert.equal(result.reason, "意图置信度较低，需要您确认");
});

test("DisambiguationHandler generateClarification generates entity questions when entities missing", () => {
  const handler = new DisambiguationHandler();
  const intent = createMockIntent("task_modify", 0.8);
  const result = handler.generateClarification("deploy to prod", 0.8, intent, []);

  assert.equal(result.requiresClarification, true);
  assert.ok(result.questions.length > 0);
  assert.equal(result.confidenceLevel, "medium");
  assert.equal(result.reason, "缺少必要参数，需要补充信息");
});

test("DisambiguationHandler generateClarification handles deploy context for very low confidence", () => {
  const handler = new DisambiguationHandler();
  const intent = createMockIntent("task_create", 0.3);
  const result = handler.generateClarification("deploy to production", 0.3, intent, []);

  assert.equal(result.requiresClarification, true);
  const questions = result.questions.map((q) => q.question);
  assert.ok(questions.some((q) => q.includes("部署到哪个环境")));
});

test("DisambiguationHandler generateClarification handles delete context for very low confidence", () => {
  const handler = new DisambiguationHandler();
  const intent = createMockIntent("task_modify", 0.3);
  const result = handler.generateClarification("delete all records", 0.3, intent, []);

  assert.equal(result.requiresClarification, true);
  const questions = result.questions.map((q) => q.question);
  assert.ok(questions.some((q) => q.includes("删除操作不可恢复")));
});

test("DisambiguationHandler generateClarification limits questions to maxClarificationQuestions", () => {
  const handler = new DisambiguationHandler({ maxClarificationQuestions: 2 });
  const intent = createMockIntent("task_create", 0.3);
  const result = handler.generateClarification("deploy to prod", 0.3, intent, []);

  assert.ok(result.questions.length <= 2);
});

test("DisambiguationHandler disambiguate detects multiple intents with similar confidence", () => {
  const handler = new DisambiguationHandler();
  const intent1 = createMockIntent("task_create", 0.75);
  const intent2 = createMockIntent("task_query", 0.72);
  const intent3 = createMockIntent("task_modify", 0.70);

  const result = handler.disambiguate("帮我处理一下", 0.75, intent1, [intent1, intent2, intent3]);

  assert.equal(result.requiresClarification, true);
  assert.equal(result.questions[0]?.question, "我需要确认您的意图：");
  assert.ok(result.questions[0]?.options);
  assert.ok(result.questions[0]?.options!.length === 3);
});

test("DisambiguationHandler disambiguate does not trigger for distant confidence levels", () => {
  const handler = new DisambiguationHandler();
  const intent1 = createMockIntent("task_create", 0.85);
  const intent2 = createMockIntent("task_query", 0.50);

  const result = handler.disambiguate("create a task", 0.85, intent1, [intent1, intent2]);

  // High confidence leading intent with distant second should not trigger disambiguation
  assert.equal(result.requiresClarification, false);
});

test("DisambiguationHandler disambiguate includes suggested intents", () => {
  const handler = new DisambiguationHandler();
  const intent = createMockIntent("task_create", 0.3);
  const result = handler.disambiguate("deploy", 0.3, intent, [intent]);

  assert.ok(result.suggestedIntents);
  assert.ok(result.suggestedIntents!.length > 0);
  assert.ok(!result.suggestedIntents!.includes("task_create"));
});

test("DisambiguationHandler disambiguate falls back to generateClarification for single intent", () => {
  const handler = new DisambiguationHandler();
  const intent = createMockIntent("task_create", 0.3);
  const result = handler.disambiguate("deploy to prod", 0.3, intent, [intent]);

  assert.equal(result.confidenceLevel, "very_low");
  assert.ok(result.questions.length > 0);
});

test("DisambiguationHandler generateClarification with vague action message", () => {
  const handler = new DisambiguationHandler();
  const intent = createMockIntent("task_create", 0.6);
  const result = handler.generateClarification("帮我处理", 0.6, intent, []);

  assert.equal(result.requiresClarification, true);
  const questions = result.questions.map((q) => q.question);
  assert.ok(questions.some((q) => q.includes("先查询现状") || q.includes("创建新任务")));
});

test("DisambiguationHandler generateClarification with vague scope message", () => {
  const handler = new DisambiguationHandler();
  // Use a message with low confidence to enter generateLowConfidenceQuestions path
  // and use English patterns to avoid parseIntentTokens interference
  const intent = createMockIntent("task_create", 0.55);
  const result = handler.generateClarification("some request", 0.55, intent, []);

  assert.equal(result.requiresClarification, true);
  // Low confidence with "some" triggers scope question via isVagueScope
  assert.ok(result.questions.length > 0);
});

test("DisambiguationHandler generateClarification with high confidence and no entities", () => {
  const handler = new DisambiguationHandler();
  const intent = createMockIntent("task_create", 0.85);
  const result = handler.generateClarification("some message", 0.85, intent, []);

  // High confidence with no entities - should still generate entity questions for intents that require entities
  assert.equal(result.confidenceLevel, "high");
});

test("DisambiguationHandler uses custom config thresholds", () => {
  const handler = new DisambiguationHandler({
    threshold: 0.8,
    lowConfidenceThreshold: 0.6,
  });

  assert.equal(handler.getConfidenceLevel(0.79), "low");
  assert.equal(handler.getConfidenceLevel(0.8), "medium");
});

test("DisambiguationHandler default config values", () => {
  const handler = new DisambiguationHandler();
  assert.equal(handler.getConfidenceLevel(0.8), "medium");
  assert.equal(handler.getConfidenceLevel(0.5), "low");
});

test("DisambiguationHandler disambiguate handles English messages", () => {
  const handler = new DisambiguationHandler();
  const intent = createMockIntent("task_create", 0.3);
  const result = handler.disambiguate("do the report", 0.3, intent, [intent]);

  assert.equal(result.confidenceLevel, "very_low");
  assert.ok(result.questions.length > 0);
});

test("DisambiguationHandler disambiguate handles optimize/fix keywords", () => {
  const handler = new DisambiguationHandler();
  const intent = createMockIntent("task_create", 0.6);
  const result = handler.generateClarification("optimize this", 0.6, intent, []);

  assert.equal(result.requiresClarification, true);
});

test("DisambiguationHandler disambiguate handles task_modify entities requirement", () => {
  const handler = new DisambiguationHandler();
  const intent = createMockIntent("task_modify", 0.8);
  const result = handler.generateClarification("modify the task", 0.8, intent, []);

  assert.equal(result.requiresClarification, true);
  const questions = result.questions.map((q) => q.entityType);
  assert.ok(questions.includes("target"));
});

test("DisambiguationHandler disambiguate handles approval_action entities requirement", () => {
  const handler = new DisambiguationHandler();
  const intent = createMockIntent("approval_action", 0.55); // low confidence triggers clarification
  const result = handler.generateClarification("approve the request", 0.55, intent, []);

  // Low confidence approval_action should trigger clarification
  assert.equal(result.requiresClarification, true);
});

test("DisambiguationHandler disambiguate does not ask entity questions for task_create", () => {
  const handler = new DisambiguationHandler();
  const intent = createMockIntent("task_create", 0.8);
  const result = handler.generateClarification("create a task", 0.8, intent, []);

  // task_create does not require entities
  assert.equal(result.requiresClarification, false);
});

test("DisambiguationHandler disambiguate handles medium confidence with no entities", () => {
  const handler = new DisambiguationHandler();
  const intent = createMockIntent("task_query", 0.8);
  const result = handler.generateClarification("some query", 0.8, intent, []);

  // Medium confidence with no entities - reason depends on whether requiresEntities returns true
  assert.equal(result.confidenceLevel, "medium");
  // task_query may or may not require entities, so reason could vary
});

test("DisambiguationHandler disambiguate handles status_inquiry intent", () => {
  const handler = new DisambiguationHandler();
  const intent = createMockIntent("status_inquiry", 0.8);
  const result = handler.generateClarification("what is the status", 0.8, intent, []);

  assert.equal(result.confidenceLevel, "medium");
});

test("DisambiguationHandler disambiguate returns correct reason strings", () => {
  const handler = new DisambiguationHandler();
  const intent = createMockIntent("task_create", 0.3);

  const veryLowResult = handler.generateClarification("test", 0.3, intent, []);
  assert.equal(veryLowResult.reason, "意图置信度过低，无法自动处理");

  const lowResult = handler.generateClarification("test", 0.6, intent, []);
  assert.equal(lowResult.reason, "意图置信度较低，需要您确认");

  const mediumResultNoEntities = handler.generateClarification("test", 0.8, intent, []);
  assert.equal(mediumResultNoEntities.reason, "缺少必要参数，需要补充信息");

  const mediumResultWithEntities = handler.generateClarification("test", 0.8, intent, [{ entityType: "test", value: "test", normalized: "test" }]);
  assert.equal(mediumResultWithEntities.reason, "意图基本明确，但可以确认");
});

test("DisambiguationHandler formatIntentOption returns correct labels", () => {
  const handler = new DisambiguationHandler();
  // Access via disambiguate which uses formatIntentOption
  const intent1 = createMockIntent("task_create", 0.75);
  const intent2 = createMockIntent("task_query", 0.72);
  const result = handler.disambiguate("test", 0.75, intent1, [intent1, intent2]);

  const options = result.questions[0]?.options;
  assert.ok(options);
  assert.ok(options!.includes("创建新任务"));
  assert.ok(options!.includes("查询/获取信息"));
});

test("DisambiguationHandler formatIntentOption handles unknown intent type", () => {
  const handler = new DisambiguationHandler();
  const intent1 = createMockIntent("task_create" as const, 0.75);
  const intent2 = { ...createMockIntent("task_create" as const, 0.72), intentType: "unknown_type" as const };
  const result = handler.disambiguate("test", 0.75, intent1, [intent1, intent2]);

  const options = result.questions[0]?.options;
  assert.ok(options);
  // Unknown type should fall back to itself
  assert.ok(options!.includes("unknown_type"));
});

test("DisambiguationHandler disambiguate handles all standard intent types in options", () => {
  const handler = new DisambiguationHandler();
  const intents = [
    createMockIntent("task_create", 0.75),
    createMockIntent("task_query", 0.72),
    createMockIntent("task_modify", 0.70),
  ];
  const result = handler.disambiguate("test", 0.75, intents[0], intents);

  const options = result.questions[0]?.options;
  assert.ok(options!.includes("创建新任务"));
  assert.ok(options!.includes("查询/获取信息"));
  assert.ok(options!.includes("修改/更新已有内容"));
});
