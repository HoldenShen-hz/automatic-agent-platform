import test from "node:test";
import assert from "node:assert/strict";
import {
  DisambiguationHandler,
  detectAmbiguity,
  type DisambiguationConfig,
  type DisambiguationResult,
} from "../../../../src/interaction/nl-gateway/disambiguation-handler/index.js";
import type { DetectedIntent } from "../../../../src/interaction/nl-gateway/index.js";

test("DisambiguationHandler detects ambiguity with low confidence", () => {
  const handler = new DisambiguationHandler();

  assert.equal(handler.requiresClarification(0.5, "帮我处理", 0), true);
  // "创建任务" is 4 chars < 6, so it triggers ambiguity even with high confidence
  assert.equal(handler.requiresClarification(0.8, "帮我创建一个任务", 1), false);
});

test("DisambiguationHandler returns correct confidence levels", () => {
  const handler = new DisambiguationHandler();

  assert.equal(handler.getConfidenceLevel(0.9), "high");
  assert.equal(handler.getConfidenceLevel(0.75), "medium");
  assert.equal(handler.getConfidenceLevel(0.6), "low");
  assert.equal(handler.getConfidenceLevel(0.3), "very_low");
});

test("DisambiguationHandler generates questions for very low confidence", () => {
  const handler = new DisambiguationHandler();

  const intent: DetectedIntent = {
    intentType: "task_create",
    domainHint: null,
    entities: [],
    urgency: "normal",
    confidence: 0.3,
  };

  const result = handler.generateClarification("帮我处理一下", 0.3, intent, []);

  assert.equal(result.requiresClarification, true);
  assert.ok(result.questions.length > 0);
  assert.equal(result.confidenceLevel, "very_low");
});

test("DisambiguationHandler generates entity questions when missing", () => {
  const handler = new DisambiguationHandler();

  const intent: DetectedIntent = {
    intentType: "task_modify",
    domainHint: null,
    entities: [],
    urgency: "normal",
    confidence: 0.65,
  };

  const result = handler.generateClarification("修改一下配置", 0.65, intent, []);

  assert.equal(result.requiresClarification, true);
  assert.ok(result.questions.some((q) => q.entityType !== undefined));
});

test("DisambiguationHandler disambiguates between multiple similar-confidence intents", () => {
  const handler = new DisambiguationHandler();

  const intents: DetectedIntent[] = [
    {
      intentType: "task_create",
      domainHint: null,
      entities: [],
      urgency: "normal",
      confidence: 0.72,
    },
    {
      intentType: "task_query",
      domainHint: null,
      entities: [],
      urgency: "normal",
      confidence: 0.68,
    },
  ];

  const result = handler.disambiguate("帮我处理", 0.72, intents[0]!, intents);

  assert.equal(result.requiresClarification, true);
  assert.ok(result.questions[0]!.options !== undefined);
  assert.equal(result.questions[0]!.options!.length, 2);
});

test("DisambiguationHandler respects maxClarificationQuestions config", () => {
  const config: DisambiguationConfig = {
    threshold: 0.7,
    lowConfidenceThreshold: 0.5,
    maxClarificationQuestions: 2,
    enableProactiveClarification: true,
  };
  const handler = new DisambiguationHandler(config);

  const intent: DetectedIntent = {
    intentType: "task_create",
    domainHint: null,
    entities: [],
    urgency: "normal",
    confidence: 0.3,
  };

  const result = handler.generateClarification("帮我处理一下", 0.3, intent, []);

  assert.ok(result.questions.length <= config.maxClarificationQuestions);
});

test("DisambiguationHandler can be disabled via config", () => {
  const config: DisambiguationConfig = {
    threshold: 0.7,
    lowConfidenceThreshold: 0.5,
    maxClarificationQuestions: 3,
    enableProactiveClarification: false,
  };
  const handler = new DisambiguationHandler(config);

  assert.equal(handler.requiresClarification(0.5, "帮我处理", 0), false);
});

test("detectAmbiguity utility function", () => {
  // Short message
  assert.equal(detectAmbiguity("hi", 0.8, 1, 0), true);

  // Low confidence
  assert.equal(detectAmbiguity("create a task please", 0.5, 1, 0), true);

  // Missing entities
  assert.equal(detectAmbiguity("modify something", 0.8, 1, 0), true);

  // Good case
  assert.equal(detectAmbiguity("create a task for user123", 0.9, 1, 1), false);
});

test("DisambiguationHandler suggests alternative intents", () => {
  const handler = new DisambiguationHandler();

  const intent: DetectedIntent = {
    intentType: "task_create",
    domainHint: null,
    entities: [],
    urgency: "normal",
    confidence: 0.6,
  };

  const result = handler.generateClarification("做一个", 0.6, intent, []);

  assert.ok(result.suggestedIntents !== undefined);
  assert.ok(!result.suggestedIntents!.includes("task_create"));
});

test("DisambiguationHandler generates deploy-specific questions", () => {
  const handler = new DisambiguationHandler();

  const intent: DetectedIntent = {
    intentType: "task_create",
    domainHint: null,
    entities: [],
    urgency: "high",
    confidence: 0.4,
  };

  // Use "发布" which is in our patterns
  const result = handler.generateClarification("发布到生产环境", 0.4, intent, []);

  assert.equal(result.requiresClarification, true);
  assert.ok(result.questions.some((q) => q.entityType === "environment"));
});
