import assert from "node:assert/strict";
import test from "node:test";

// OAPEFLIR Learn barrel test - imports from the learn module index
import * as Learn from "../../../../../../src/platform/orchestration/oapeflir/learn/index.js";

test("Learn module is exported", () => {
  assert.ok(Learn !== undefined);
  assert.equal(typeof Learn, "object");
});

test("ExperienceDistillationService is exported", () => {
  assert.equal(typeof Learn.ExperienceDistillationService, "function");
});

test("FailurePatternMiner is exported", () => {
  assert.equal(typeof Learn.FailurePatternMiner, "function");
});

test("KnowledgePromotionService is exported", () => {
  assert.equal(typeof Learn.KnowledgePromotionService, "function");
});

test("LLMImprovementGenerationService is exported", () => {
  assert.equal(typeof Learn.LLMImprovementGenerationService, "function");
});

test("LearningArtifactSchema is exported", () => {
  assert.ok(Learn.LearningArtifactSchema !== undefined);
});

test("LearningFeedbackOrchestrationService is exported", () => {
  assert.equal(typeof Learn.LearningFeedbackOrchestrationService, "function");
});

test("LearningObjectSchema is exported", () => {
  assert.ok(Learn.LearningObjectSchema !== undefined);
});

test("LearningObjectValidator is exported", () => {
  assert.equal(typeof Learn.LearningObjectValidator, "function");
});

test("StrategyLearningService is exported", () => {
  assert.equal(typeof Learn.StrategyLearningService, "function");
});

test("createLearningArtifact is exported as function", () => {
  assert.equal(typeof Learn.createLearningArtifact, "function");
});

test("detectLlmTruncation is exported as function", () => {
  assert.equal(typeof Learn.detectLlmTruncation, "function");
});

test("detectModelHallucination is exported as function", () => {
  assert.equal(typeof Learn.detectModelHallucination, "function");
});

test("detectSchemaValidationLoop is exported as function", () => {
  assert.equal(typeof Learn.detectSchemaValidationLoop, "function");
});

test("detectToolPermissionDenial is exported as function", () => {
  assert.equal(typeof Learn.detectToolPermissionDenial, "function");
});

test("parseLearningArtifact is exported as function", () => {
  assert.equal(typeof Learn.parseLearningArtifact, "function");
});

test("parseLearningObject is exported as function", () => {
  assert.equal(typeof Learn.parseLearningObject, "function");
});

test("ArtifactFormatSchema is exported", () => {
  assert.ok(Learn.ArtifactFormatSchema !== undefined);
});

test("FailurePatternSchema is exported", () => {
  assert.ok(Learn.FailurePatternSchema !== undefined);
});

test("FailurePatternTypeSchema is exported", () => {
  assert.ok(Learn.FailurePatternTypeSchema !== undefined);
});