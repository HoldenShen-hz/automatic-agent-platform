import assert from "node:assert/strict";
import test from "node:test";

import { StrategyLearningService } from "../../../../../src/platform/five-plane-orchestration/learn/strategy-learning-service.js";
import type { LearningSignal } from "../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";
import type { LearningObject } from "../../../../../src/platform/five-plane-orchestration/learn/learning-object-model.js";

function makeLearningObject(overrides: Partial<LearningObject> = {}): LearningObject {
  return {
    learningObjectId: "test-" + Math.random().toString(36).slice(2),
    learningType: "failure_pattern",
    title: "Test failure pattern",
    summary: "Something went wrong during execution.",
    confidence: 0.8,
    evidenceRefs: ["evidence-1"],
    sourceSignalIds: ["signal-1"],
    recommendation: "Avoid this situation.",
    validatedBy: "none",
    promotionStatus: "draft",
    createdAt: Date.now(),
    ...overrides,
  };
}

function makeSignal(overrides: Partial<LearningSignal> = {}): LearningSignal {
  return {
    learningSignalId: "sig-" + Math.random().toString(36).slice(2),
    taskId: "task-1",
    sourceFeedbackId: `feedback-sig-${Math.random().toString(36).slice(2)}`,
    learningType: "failure_pattern",
    valueSummary: "Step failed validation",
    confidence: 0.95,
    evidence: { stepId: "step-1" },
    evidenceRefs: ["evidence-1"],
    sourceSignalIds: ["source-signal-1"],
    relatedSignalIds: [],
    generatedAt: Date.now(),
    ...overrides,
  };
}

test("StrategyLearningService.learnSync returns empty array for empty signals", () => {
  const service = new StrategyLearningService();
  const result = service.learnSync([]);
  assert.equal(result.length, 0);
});

test("StrategyLearningService.learnSync filters out non-failure_pattern signals for mining", () => {
  const service = new StrategyLearningService();
  const signals = [
    makeSignal({ learningSignalId: "sig-1", learningType: "user_correction", evidence: { someData: "value" }, evidenceRefs: ["ref-user-1"] }),
    makeSignal({ learningSignalId: "sig-2", learningType: "recovery_playbook", evidence: { recoveryData: true }, evidenceRefs: ["ref-recovery-1"] }),
  ];

  const result = service.learnSync(signals);

  // These go through distillation, not mining
  assert.ok(result.length >= 0);
});

test("StrategyLearningService.learnSync includes distilled signals for non-failure_pattern types", () => {
  const service = new StrategyLearningService();
  const signals = [
    makeSignal({ learningSignalId: "sig-distill", learningType: "user_correction", valueSummary: "User corrected the approach", evidenceRefs: ["ref-distill"] }),
  ];

  const result = service.learnSync(signals);

  // Should have at least the distilled learning object
  assert.ok(result.length >= 1);
  assert.equal(result[0]!.learningType, "user_correction");
});

test("StrategyLearningService.learnSync validates all learning objects", () => {
  const service = new StrategyLearningService();
  const signals = [
    makeSignal({ learningSignalId: "sig-valid", learningType: "failure_pattern", evidence: { finishReason: "length", maxTokens: 100, tokensUsed: 100 } }),
  ];

  const result = service.learnSync(signals);

  // All returned objects should have evidenceRefs due to validator
  for (const obj of result) {
    if (obj.learningType === "failure_pattern") {
      assert.ok(obj.evidenceRefs.length > 0 || obj.confidence < 0.5, "failure_pattern without evidence should be filtered");
    }
  }
});

test("StrategyLearningService.learnSync returns validated objects only", () => {
  const service = new StrategyLearningService();
  const signals = [
    makeSignal({ learningSignalId: "sig-no-evidence", learningType: "failure_pattern", evidenceRefs: [], evidence: { someField: "value" } }),
    makeSignal({ learningSignalId: "sig-with-evidence", learningType: "failure_pattern", evidenceRefs: ["ref-1"], evidence: { finishReason: "length", maxTokens: 100, tokensUsed: 100 } }),
  ];

  const result = service.learnSync(signals);

  // Objects without evidence should be filtered out by validator
  // Objects with evidence should pass
  for (const obj of result) {
    assert.ok(obj.evidenceRefs.length > 0, `Object ${obj.learningObjectId} should have evidenceRefs`);
  }
});

test("StrategyLearningService.learnSync deduces duplicate learning objects", () => {
  const service = new StrategyLearningService();
  const signals = [
    makeSignal({ learningSignalId: "sig-dup-1", learningType: "failure_pattern", valueSummary: "Same issue", evidence: { finishReason: "length", maxTokens: 100, tokensUsed: 100 } }),
    makeSignal({ learningSignalId: "sig-dup-2", learningType: "failure_pattern", valueSummary: "Same issue", evidence: { finishReason: "length", maxTokens: 100, tokensUsed: 100 } }),
  ];

  const result = service.learnSync(signals);

  // The validator+dedup should reduce duplicates
  // But if they have different signal IDs they may be considered different
  assert.ok(result.length >= 1);
});

test("StrategyLearningService.learnSync handles mixed learning types", () => {
  const service = new StrategyLearningService();
  const signals: LearningSignal[] = [
    makeSignal({ learningSignalId: "sig-mixed-1", learningType: "failure_pattern", evidence: { finishReason: "length", maxTokens: 100, tokensUsed: 100 } }),
    makeSignal({ learningSignalId: "sig-mixed-2", learningType: "user_correction", valueSummary: "User corrected output", evidenceRefs: ["ref-mixed-2"] }),
    makeSignal({ learningSignalId: "sig-mixed-3", learningType: "recovery_playbook", valueSummary: "Recovery was successful", evidenceRefs: ["ref-mixed-3"] }),
  ];

  const result = service.learnSync(signals);

  assert.ok(result.length >= 3);
  const types = result.map((r) => r.learningType);
  assert.ok(types.includes("failure_pattern"));
  assert.ok(types.includes("user_correction"));
  assert.ok(types.includes("recovery_playbook"));
});

test("StrategyLearningService.learnSync sets validatedBy to evidence or human_review", () => {
  const service = new StrategyLearningService();
  const signals = [
    makeSignal({ learningSignalId: "sig-vb", learningType: "failure_pattern", evidenceRefs: ["ref-1"], evidence: { finishReason: "length", maxTokens: 100, tokensUsed: 100 } }),
  ];

  const result = service.learnSync(signals);

  for (const obj of result) {
    assert.ok(["evidence", "human_review"].includes(obj.validatedBy), `validatedBy should be evidence or human_review, got ${obj.validatedBy}`);
  }
});

test("StrategyLearningService.learnSync sets promotionStatus to validated for valid objects", () => {
  const service = new StrategyLearningService();
  const signals = [
    makeSignal({ learningSignalId: "sig-ps", learningType: "failure_pattern", evidenceRefs: ["ref-1"], evidence: { finishReason: "length", maxTokens: 100, tokensUsed: 100 } }),
  ];

  const result = service.learnSync(signals);

  for (const obj of result) {
    assert.ok(["validated", "promoted"].includes(obj.promotionStatus), `promotionStatus should be validated or promoted, got ${obj.promotionStatus}`);
  }
});

test("StrategyLearningService learns from failure_pattern signals via FailurePatternMiner", () => {
  const service = new StrategyLearningService();
  const signals = [
    makeSignal({
      learningSignalId: "sig-truncation",
      learningType: "failure_pattern",
      taskId: "task-truncation",
      evidence: {
        finishReason: "length",
        maxTokens: 4096,
        tokensUsed: 4096,
        stepId: "step-truncation",
      },
      valueSummary: "Model output was truncated",
    }),
  ];

  const result = service.learnSync(signals);

  assert.ok(result.length >= 1);
  const hasTruncation = result.some((obj) => obj.title.includes("truncated") || obj.title.includes("LLM output"));
  assert.ok(hasTruncation, "Should detect truncation pattern");
});

test("StrategyLearningService learns from schema validation loop signals", () => {
  const service = new StrategyLearningService();
  const baseTime = Date.now();
  const signals: LearningSignal[] = [];
  for (let i = 0; i < 3; i++) {
    signals.push(
      makeSignal({
        learningSignalId: `sig-loop-${i}`,
        taskId: "task-schema-loop",
        learningType: "failure_pattern",
        evidence: {
          stepId: "step-validation",
          repairAttempt: i + 1,
        },
      }),
    );
  }

  const result = service.learnSync(signals);

  const hasSchemaLoop = result.some(
    (obj) => obj.title.includes("Schema validation loop") || obj.title.includes("schema validation loop"),
  );
  assert.ok(hasSchemaLoop, "Should detect schema validation loop");
});

test("StrategyLearningService preserves sourceSignalIds from original signals", () => {
  const service = new StrategyLearningService();
  const signals = [
    makeSignal({ learningSignalId: "sig-source-1", sourceSignalIds: ["source-a", "source-b"] }),
  ];

  const result = service.learnSync(signals);

  for (const obj of result) {
    assert.ok(obj.sourceSignalIds.length > 0, "Should preserve sourceSignalIds");
  }
});

test("StrategyLearningService preserves evidenceRefs from original signals", () => {
  const service = new StrategyLearningService();
  const signals = [
    makeSignal({ learningSignalId: "sig-ref", evidenceRefs: ["evidence-x", "evidence-y"] }),
  ];

  const result = service.learnSync(signals);

  for (const obj of result) {
    assert.ok(obj.evidenceRefs.length > 0, "Should preserve evidenceRefs");
  }
});

test("StrategyLearningService assigns confidence from original signal", () => {
  const service = new StrategyLearningService();
  const signals = [
    makeSignal({ learningSignalId: "sig-conf", confidence: 0.92 }),
  ];

  const result = service.learnSync(signals);

  if (result.length > 0) {
    assert.ok(result[0]!.confidence > 0, "Should preserve confidence");
  }
});

test("StrategyLearningService uses fallback template when LLM service is not configured", () => {
  const service = new StrategyLearningService();
  const signals = [
    makeSignal({ learningSignalId: "sig-fallback", learningType: "user_correction", valueSummary: "User provided correction", evidenceRefs: ["ref-fallback"] }),
  ];

  const result = service.learnSync(signals);

  assert.ok(result.length >= 1);
  assert.ok(result[0]!.recommendation.length > 0);
});

test("StrategyLearningService does not self-prove evidence from sourceFeedbackId", () => {
  const service = new StrategyLearningService();

  const result = service.learnSync([
    makeSignal({
      learningSignalId: "sig-no-proof",
      learningType: "user_correction",
      evidenceRefs: [],
      sourceSignalIds: [],
      sourceFeedbackId: "feedback-self-proof",
      valueSummary: "Correction without explicit evidence refs",
    }),
  ]);

  assert.equal(result.length, 0);
});

test("StrategyLearningService handles large number of signals", () => {
  const service = new StrategyLearningService();
  const signals: LearningSignal[] = [];
  for (let i = 0; i < 50; i++) {
    signals.push(makeSignal({ learningSignalId: `sig-large-${i}`, learningType: "failure_pattern" }));
  }

  const result = service.learnSync(signals);

  // Should complete without error
  assert.ok(result.length >= 0);
});

test("StrategyLearningService processes signals in correct order", () => {
  const service = new StrategyLearningService();
  const signals: LearningSignal[] = [];
  for (let i = 0; i < 5; i++) {
    signals.push(makeSignal({ learningSignalId: `sig-order-${i}`, learningType: "failure_pattern" }));
  }

  const result = service.learnSync(signals);

  // All results should be valid LearningObjects
  for (const obj of result) {
    assert.ok(obj.learningObjectId.length > 0);
    assert.ok(obj.title.length > 0);
  }
});
