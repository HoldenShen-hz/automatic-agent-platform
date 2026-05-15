import assert from "node:assert/strict";
import test from "node:test";

// Learn module barrel
import {
  ArtifactFormatSchema,
  ExperienceDistillationService,
  FailurePatternMiner,
  FailurePatternSchema,
  FailurePatternTypeSchema,
  KnowledgePromotionService,
  LLMImprovementGenerationService,
  LearningArtifactSchema,
  LearningFeedbackOrchestrationService,
  LearningObjectSchema,
  LearningObjectValidator,
  StrategyLearningService,
  createLearningArtifact,
  detectLlmTruncation,
  detectModelHallucination,
  detectSchemaValidationLoop,
  detectToolPermissionDenial,
  parseLearningArtifact,
  parseLearningObject,
} from "../../../../../src/platform/five-plane-orchestration/learn/index.js";

test("ExperienceDistillationService is exported", () => {
  assert.equal(typeof ExperienceDistillationService, "function");
});

test("FailurePatternMiner is exported", () => {
  assert.equal(typeof FailurePatternMiner, "function");
});

test("KnowledgePromotionService is exported", () => {
  assert.equal(typeof KnowledgePromotionService, "function");
});

test("LLMImprovementGenerationService is exported", () => {
  assert.equal(typeof LLMImprovementGenerationService, "function");
});

test("LearningArtifactSchema is exported", () => {
  assert.ok(LearningArtifactSchema !== undefined);
});

test("LearningFeedbackOrchestrationService is exported", () => {
  assert.equal(typeof LearningFeedbackOrchestrationService, "function");
});

test("LearningObjectSchema is exported", () => {
  assert.ok(LearningObjectSchema !== undefined);
});

test("LearningObjectValidator is exported", () => {
  assert.equal(typeof LearningObjectValidator, "function");
});

test("StrategyLearningService is exported", () => {
  assert.equal(typeof StrategyLearningService, "function");
});

test("createLearningArtifact is exported as function", () => {
  assert.equal(typeof createLearningArtifact, "function");
});

test("detectLlmTruncation is exported as function", () => {
  assert.equal(typeof detectLlmTruncation, "function");
});

test("detectModelHallucination is exported as function", () => {
  assert.equal(typeof detectModelHallucination, "function");
});

test("detectSchemaValidationLoop is exported as function", () => {
  assert.equal(typeof detectSchemaValidationLoop, "function");
});

test("detectToolPermissionDenial is exported as function", () => {
  assert.equal(typeof detectToolPermissionDenial, "function");
});

test("parseLearningArtifact is exported as function", () => {
  assert.equal(typeof parseLearningArtifact, "function");
});

test("parseLearningObject is exported as function", () => {
  assert.equal(typeof parseLearningObject, "function");
});

test("ArtifactFormatSchema is exported", () => {
  assert.ok(ArtifactFormatSchema !== undefined);
});

test("FailurePatternSchema is exported", () => {
  assert.ok(FailurePatternSchema !== undefined);
});

test("FailurePatternTypeSchema is exported", () => {
  assert.ok(FailurePatternTypeSchema !== undefined);
});

test("LearningObjectValidator can be instantiated", () => {
  const validator = new LearningObjectValidator();
  assert.ok(validator !== undefined);
});

test("FailurePatternMiner can be instantiated", () => {
  const miner = new FailurePatternMiner();
  assert.ok(miner !== undefined);
});