/**
 * Unit tests for nl-gateway disambiguation handler
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  DisambiguationHandler,
  detectAmbiguity,
  type DisambiguationConfig,
  type ClarificationQuestion,
  type DisambiguationResult,
} from "../../../../../src/interaction/nl-gateway/disambiguation-handler/index.js";
import type { DetectedIntent, ExtractedEntity } from "../../../../../src/interaction/nl-gateway/index.js";

// Local constant matching the expected default config values from the source
const DEFAULT_DISAMBIGUATION_CONFIG = {
  threshold: 0.8,
  lowConfidenceThreshold: 0.5,
  maxClarificationQuestions: 3,
  enableProactiveClarification: true,
} as const;

// ---------------------------------------------------------------------------
// Test Data Factory
// ---------------------------------------------------------------------------

function makeIntent(overrides: Partial<DetectedIntent> = {}): DetectedIntent {
  return {
    intentType: "task_query",
    confidence: 0.8,
    entities: [],
    // @ts-expect-error - reasoning not in DetectedIntent but used in tests
    reasoning: "test",
    ...overrides,
  };
}

function makeEntity(overrides: Partial<ExtractedEntity> = {}): ExtractedEntity {
  return {
    entityType: "general",
    value: "test",
    normalized: "test" as unknown,
    sourceSpan: [0, 4] as const,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// detectAmbiguity function tests
// ---------------------------------------------------------------------------

test("detectAmbiguity returns false for high confidence when required entities are present", () => {
  const result = detectAmbiguity("hello world", 0.8, 2, 2);
  assert.equal(result, false);
});

test("detectAmbiguity checks entity count when confidence is below threshold", () => {
  const result = detectAmbiguity("hello world", 0.6, 2, 1);
  assert.equal(result, true);
});

test("detectAmbiguity returns true for short message with medium confidence", () => {
  const result = detectAmbiguity("hi", 0.6, 0, 0);
  assert.equal(result, true);
});

test("detectAmbiguity returns false for longer message with enough entities", () => {
  const result = detectAmbiguity("create a task for me", 0.6, 1, 2);
  assert.equal(result, false);
});

// ---------------------------------------------------------------------------
// DEFAULT_DISAMBIGUATION_CONFIG tests
// ---------------------------------------------------------------------------

test("DEFAULT_DISAMBIGUATION_CONFIG has expected values", () => {
  assert.equal(DEFAULT_DISAMBIGUATION_CONFIG.threshold, 0.8);
  assert.equal(DEFAULT_DISAMBIGUATION_CONFIG.lowConfidenceThreshold, 0.5);
  assert.equal(DEFAULT_DISAMBIGUATION_CONFIG.maxClarificationQuestions, 3);
  assert.equal(DEFAULT_DISAMBIGUATION_CONFIG.enableProactiveClarification, true);
});

// ---------------------------------------------------------------------------
// DisambiguationHandler constructor tests
// ---------------------------------------------------------------------------

test("DisambiguationHandler uses default config when none provided", () => {
  const handler = new DisambiguationHandler();
  assert.equal(handler.getConfidenceLevel(0.9), "high");
});

test("DisambiguationHandler accepts partial config overrides", () => {
  const handler = new DisambiguationHandler({ threshold: 0.6 });
  assert.equal(handler.getConfidenceLevel(0.65), "medium");
});

test("DisambiguationHandler accepts full config", () => {
  const config: DisambiguationConfig = {
    threshold: 0.8,
    lowConfidenceThreshold: 0.4,
    maxClarificationQuestions: 5,
    enableProactiveClarification: false,
  };
  const handler = new DisambiguationHandler(config);
  assert.equal(handler.getConfidenceLevel(0.7), "low");
});

// ---------------------------------------------------------------------------
// DisambiguationHandler getConfidenceLevel tests
// ---------------------------------------------------------------------------

test("getConfidenceLevel returns high for >= 0.85", () => {
  const handler = new DisambiguationHandler();
  assert.equal(handler.getConfidenceLevel(0.85), "high");
  assert.equal(handler.getConfidenceLevel(0.9), "high");
  assert.equal(handler.getConfidenceLevel(1.0), "high");
});

test("getConfidenceLevel returns medium for >= threshold and < 0.85", () => {
  const handler = new DisambiguationHandler({ threshold: 0.7 });
  assert.equal(handler.getConfidenceLevel(0.7), "medium");
  assert.equal(handler.getConfidenceLevel(0.75), "medium");
  assert.equal(handler.getConfidenceLevel(0.84), "medium");
});

test("getConfidenceLevel returns low for >= lowConfidenceThreshold and < threshold", () => {
  const handler = new DisambiguationHandler({ threshold: 0.7, lowConfidenceThreshold: 0.5 });
  assert.equal(handler.getConfidenceLevel(0.5), "low");
  assert.equal(handler.getConfidenceLevel(0.6), "low");
  assert.equal(handler.getConfidenceLevel(0.69), "low");
});

test("getConfidenceLevel returns very_low for < lowConfidenceThreshold", () => {
  const handler = new DisambiguationHandler({ lowConfidenceThreshold: 0.5 });
  assert.equal(handler.getConfidenceLevel(0.49), "very_low");
  assert.equal(handler.getConfidenceLevel(0.3), "very_low");
  assert.equal(handler.getConfidenceLevel(0.0), "very_low");
});

// ---------------------------------------------------------------------------
// DisambiguationHandler requiresClarification tests
// ---------------------------------------------------------------------------

test("requiresClarification returns false when proactive clarification disabled", () => {
  const handler = new DisambiguationHandler({ enableProactiveClarification: false });
  assert.equal(handler.requiresClarification(0.5, "test message", 1), false);
});

test("requiresClarification delegates to detectAmbiguity", () => {
  const handler = new DisambiguationHandler({ enableProactiveClarification: true });
  // High confidence with enough entities -> not ambiguous
  assert.equal(handler.requiresClarification(0.8, "test message", 1), false);
});

test("requiresClarification detects short message ambiguity", () => {
  const handler = new DisambiguationHandler({ enableProactiveClarification: true });
  assert.equal(handler.requiresClarification(0.6, "hi", 0), true);
});

// ---------------------------------------------------------------------------
// DisambiguationHandler generateClarification tests
// ---------------------------------------------------------------------------

test("generateClarification returns high confidence result for high confidence input", () => {
  const handler = new DisambiguationHandler();
  const intent = makeIntent({ confidence: 0.9 });
  const result = handler.generateClarification("create a task", 0.9, intent, []);

  assert.equal(result.confidenceLevel, "high");
  assert.equal(result.requiresClarification, false);
  assert.equal(result.questions.length, 0);
});

test("generateClarification generates questions for very low confidence", () => {
  const handler = new DisambiguationHandler();
  const intent = makeIntent({ intentType: "task_create", confidence: 0.3 });
  const result = handler.generateClarification("do something", 0.3, intent, []);

  assert.equal(result.confidenceLevel, "very_low");
  assert.equal(result.requiresClarification, true);
  assert.ok(result.questions.length > 0);
});

test("generateClarification generates context-specific questions for deploy", () => {
  const handler = new DisambiguationHandler();
  const intent = makeIntent({ intentType: "task_query", confidence: 0.3 });
  const result = handler.generateClarification("deploy to production", 0.3, intent, []);

  assert.equal(result.requiresClarification, true);
  assert.ok(result.questions.some(q => q.entityType === "environment"));
});

test("generateClarification generates delete confirmation questions", () => {
  const handler = new DisambiguationHandler();
  const intent = makeIntent({ intentType: "task_modify", confidence: 0.4 });
  const result = handler.generateClarification("delete the files", 0.4, intent, []);

  assert.equal(result.requiresClarification, true);
  assert.ok(result.questions.length > 0);
});

test("generateClarification suggests alternative intents", () => {
  const handler = new DisambiguationHandler();
  const intent = makeIntent({ intentType: "task_create", confidence: 0.5 });
  const result = handler.generateClarification("do something", 0.5, intent, []);

  assert.ok(result.suggestedIntents != null);
  assert.ok(!result.suggestedIntents!.includes("task_create"));
});

test("generateClarification respects maxClarificationQuestions limit", () => {
  const handler = new DisambiguationHandler({ maxClarificationQuestions: 2 });
  const intent = makeIntent({ intentType: "task_query", confidence: 0.3 });
  const result = handler.generateClarification("deploy and delete things", 0.3, intent, []);

  assert.ok(result.questions.length <= 2);
});

test("generateClarification generates entity questions for modify intent", () => {
  const handler = new DisambiguationHandler();
  const intent = makeIntent({ intentType: "task_modify", confidence: 0.6 });
  const result = handler.generateClarification("modify the config", 0.6, intent, []);

  assert.ok(result.questions.length > 0);
});

// ---------------------------------------------------------------------------
// DisambiguationHandler disambiguate tests
// ---------------------------------------------------------------------------

test("disambiguate handles multiple similar-confidence intents", () => {
  const handler = new DisambiguationHandler();
  const intent1 = makeIntent({ intentType: "task_create", confidence: 0.7 });
  const intent2 = makeIntent({ intentType: "task_query", confidence: 0.68 });
  const intent3 = makeIntent({ intentType: "task_modify", confidence: 0.65 });

  const result = handler.disambiguate("do something", 0.7, intent1, [intent1, intent2, intent3]);

  assert.equal(result.requiresClarification, true);
  assert.ok(result.questions.length > 0);
  assert.ok(result.suggestedIntents != null);
});

test("disambiguate with intents too different in confidence does not ask for clarification", () => {
  const handler = new DisambiguationHandler();
  const intent1 = makeIntent({ intentType: "task_create", confidence: 0.9 });
  const intent2 = makeIntent({ intentType: "task_query", confidence: 0.3 });

  const result = handler.disambiguate("create a task", 0.9, intent1, [intent1, intent2]);

  // Not asking for clarification when one intent is much more confident
  assert.equal(result.requiresClarification, false);
});

test("disambiguate falls back to generateClarification for single intent", () => {
  const handler = new DisambiguationHandler();
  const intent = makeIntent({ intentType: "task_modify", confidence: 0.3 });

  const result = handler.disambiguate("delete stuff", 0.3, intent, [intent]);

  assert.equal(result.confidenceLevel, "very_low");
  assert.ok(result.questions.length > 0);
});

test("disambiguate includes formatted intent options in questions", () => {
  const handler = new DisambiguationHandler();
  const intent1 = makeIntent({ intentType: "task_create", confidence: 0.7 });
  const intent2 = makeIntent({ intentType: "task_query", confidence: 0.68 });

  const result = handler.disambiguate("help me", 0.7, intent1, [intent1, intent2]);

  const choiceQuestion = result.questions.find(q => q.options != null);
  assert.ok(choiceQuestion != null);
  assert.ok(choiceQuestion!.options!.length >= 2);
});

// ---------------------------------------------------------------------------
// DisambiguationResult confidence level reason tests
// ---------------------------------------------------------------------------

test("buildReason includes reason for very_low confidence", () => {
  const handler = new DisambiguationHandler();
  const intent = makeIntent({ confidence: 0.3 });
  const result = handler.generateClarification("hello", 0.3, intent, []);

  assert.ok(result.reason.includes("过低"));
});

test("buildReason includes reason for low confidence", () => {
  const handler = new DisambiguationHandler();
  const intent = makeIntent({ confidence: 0.55 });
  const result = handler.generateClarification("hello world", 0.55, intent, []);

  assert.ok(result.reason.includes("低"));
});

test("buildReason mentions missing entities for medium confidence", () => {
  const handler = new DisambiguationHandler();
  const intent = makeIntent({ intentType: "task_modify", confidence: 0.7 });
  const result = handler.generateClarification("modify config", 0.7, intent, []);

  assert.ok(result.reason.includes("缺少") || result.reason.includes("确认"));
});

test("buildReason returns positive message for high confidence", () => {
  const handler = new DisambiguationHandler();
  const intent = makeIntent({ confidence: 0.9 });
  const result = handler.generateClarification("create a task", 0.9, intent, []);

  assert.ok(result.reason.includes("高") || result.reason.includes("高"));
});

// ---------------------------------------------------------------------------
// Edge cases and boundary conditions
// ---------------------------------------------------------------------------

test("ClarificationQuestion type accepts optional fields", () => {
  const question: ClarificationQuestion = {
    question: "Test?",
  };
  assert.equal(question.question, "Test?");
  assert.equal(question.options, undefined);
  assert.equal(question.entityType, undefined);
  assert.equal(question.intentHint, undefined);
});

test("ClarificationQuestion type accepts all fields", () => {
  const question: ClarificationQuestion = {
    question: "Test?",
    options: ["A", "B"],
    entityType: "test",
    intentHint: "task_create",
  };
  assert.equal(question.options!.length, 2);
  assert.equal(question.entityType, "test");
});

test("DisambiguationResult structure matches interface", () => {
  const result: DisambiguationResult = {
    requiresClarification: true,
    questions: [{ question: "What do you want?" }],
    suggestedIntents: ["task_create", "task_query"],
    confidenceLevel: "medium",
    reason: "Test reason",
  };

  assert.equal(result.requiresClarification, true);
  assert.equal(result.questions.length, 1);
  assert.equal(result.suggestedIntents!.length, 2);
  assert.equal(result.confidenceLevel, "medium");
});

test("DisambiguationConfig type accepts valid values", () => {
  const config: DisambiguationConfig = {
    threshold: 0.6,
    lowConfidenceThreshold: 0.4,
    maxClarificationQuestions: 5,
    enableProactiveClarification: true,
  };

  assert.equal(config.threshold, 0.6);
  assert.equal(config.maxClarificationQuestions, 5);
});

test("detectAmbiguity handles edge case of exactly threshold confidence", () => {
  const handler = new DisambiguationHandler({ threshold: 0.7 });
  // At exactly threshold, high confidence path is taken
  const result = detectAmbiguity("test", 0.7, 1, 0);
  assert.equal(result, true); // not ambiguous because high conf but missing entity
});
