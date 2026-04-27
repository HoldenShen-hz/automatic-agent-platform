/**
 * Integration Test: Failure Pattern Miner
 *
 * Tests the FailurePatternMiner service which detects failure patterns
 * from learning signals and transforms them into LearningObjects.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createSeededIntegrationContext } from "../../../../helpers/integration-context.js";
import { FailurePatternMiner } from "../../../../../src/platform/orchestration/learn/failure-pattern-miner.js";
import type { LearningSignal } from "../../../../../src/scale-ecosystem/feedback-loop/collector/feedback-model.js";

function makeSignal(overrides: Partial<LearningSignal> & { learningSignalId: string; taskId: string }): LearningSignal {
  return {
    learningSignalId: overrides.learningSignalId,
    taskId: overrides.taskId,
    sourceFeedbackId: `feedback-${overrides.learningSignalId}`,
    learningType: "failure_pattern",
    valueSummary: overrides.valueSummary ?? "test failure",
    confidence: overrides.confidence ?? 0.8,
    generatedAt: overrides.generatedAt ?? Date.now(),
    evidence: overrides.evidence ?? {},
    evidenceRefs: overrides.evidenceRefs ?? [],
    sourceSignalIds: overrides.sourceSignalIds ?? [],
    relatedSignalIds: overrides.relatedSignalIds ?? [],
  };
}

test("FailurePatternMiner integrates with signal store via context", () => {
  const ctx = createSeededIntegrationContext("aa-fpm-signal-");
  try {
    const miner = new FailurePatternMiner();

    // Mine from signals that would be stored/retrieved in real scenarios
    const signals: LearningSignal[] = [
      makeSignal({
        learningSignalId: "sig-fpm-1",
        taskId: ctx.store instanceof Function ? "task-fpm-1" : "task-seeded-001",
        evidence: { finishReason: "length", maxTokens: 1000, tokensUsed: 1000 },
      }),
    ];

    const results = miner.mine(signals);

    assert.ok(results.length >= 1);
    assert.equal(results[0]!.learningType, "failure_pattern");
    assert.ok(results[0]!.title.length > 0);
    assert.ok(results[0]!.summary.length > 0);
  } finally {
    ctx.cleanup();
  }
});

test("FailurePatternMiner handles multiple signals from same task", () => {
  const ctx = createSeededIntegrationContext("aa-fpm-multi-");
  try {
    const miner = new FailurePatternMiner();

    const signals: LearningSignal[] = [
      makeSignal({
        learningSignalId: "sig-fpm-multi-1",
        taskId: "task-fpm-multi",
        learningType: "failure_pattern",
        evidence: { finishReason: "length", maxTokens: 1000, tokensUsed: 1000 },
      }),
      makeSignal({
        learningSignalId: "sig-fpm-multi-2",
        taskId: "task-fpm-multi",
        learningType: "failure_pattern",
        evidence: { evalScore: 0.2, modelId: "gpt-4o" },
      }),
      makeSignal({
        learningSignalId: "sig-fpm-multi-3",
        taskId: "task-fpm-multi",
        learningType: "failure_pattern",
        valueSummary: "permission denied",
        evidence: { toolName: "bash", operation: "execute" },
      }),
    ];

    const results = miner.mine(signals);

    assert.ok(results.length >= 3);
    // Should have detected truncation, hallucination, and permission denial
    const titles = results.map((r) => r.title.toLowerCase());
    assert.ok(titles.some((t) => t.includes("truncat") || t.includes("token") || t.includes("limit")));
    assert.ok(titles.some((t) => t.includes("hallucin") || t.includes("quality") || t.includes("eval")));
    assert.ok(titles.some((t) => t.includes("permission") || t.includes("sandbox")));
  } finally {
    ctx.cleanup();
  }
});

test("FailurePatternMiner produces valid LearningObjects", () => {
  const ctx = createSeededIntegrationContext("aa-fpm-valid-");
  try {
    const miner = new FailurePatternMiner();

    const signal = makeSignal({
      learningSignalId: "sig-fpm-valid",
      taskId: "task-fpm-valid",
      evidence: { finishReason: "length", maxTokens: 1000, tokensUsed: 1000 },
    });

    const results = miner.mine([signal]);

    assert.equal(results.length, 1);
    const obj = results[0]!;

    // Verify LearningObject structure
    assert.ok(obj.learningObjectId.startsWith("learning_"));
    assert.equal(obj.learningType, "failure_pattern");
    assert.ok(obj.title.length > 0);
    assert.ok(obj.summary.length > 0);
    assert.ok(obj.confidence >= 0 && obj.confidence <= 1);
    assert.ok(Array.isArray(obj.evidenceRefs));
    assert.ok(Array.isArray(obj.sourceSignalIds));
    assert.ok(obj.recommendation.length > 0);
    assert.ok(["none", "evidence", "human_review"].includes(obj.validatedBy));
    assert.ok(["draft", "validated", "promoted"].includes(obj.promotionStatus));
    assert.ok(obj.createdAt > 0);
  } finally {
    ctx.cleanup();
  }
});

test("FailurePatternMiner handles schema validation loop across signals", () => {
  const ctx = createSeededIntegrationContext("aa-fpm-loop-");
  try {
    const miner = new FailurePatternMiner();

    // Multiple signals indicating a validation loop
    const signals: LearningSignal[] = [];
    for (let i = 0; i < 3; i++) {
      signals.push(
        makeSignal({
          learningSignalId: `sig-fpm-loop-${i}`,
          taskId: "task-fpm-loop",
          evidence: {
            stepId: "step-validation",
            repairAttempt: i + 1,
          },
        }),
      );
    }

    const results = miner.mine(signals);

    // Should detect the schema validation loop pattern
    const hasSchemaLoop = results.some(
      (r) => r.title.includes("Schema validation loop") || r.title.includes("schema validation"),
    );
    assert.ok(hasSchemaLoop, "Should detect schema validation loop pattern");
  } finally {
    ctx.cleanup();
  }
});

test("FailurePatternMiner handles empty signal list", () => {
  const ctx = createSeededIntegrationContext("aa-fpm-empty-");
  try {
    const miner = new FailurePatternMiner();
    const results = miner.mine([]);
    assert.deepEqual(results, []);
  } finally {
    ctx.cleanup();
  }
});

test("FailurePatternMiner filters non-failure_pattern signals", () => {
  const ctx = createSeededIntegrationContext("aa-fpm-filter-");
  try {
    const miner = new FailurePatternMiner();

    const signals: LearningSignal[] = [
      makeSignal({
        learningSignalId: "sig-fpm-filter-1",
        taskId: "task-fpm-filter",
        learningType: "user_correction",
        valueSummary: "User corrected the approach",
      }),
      makeSignal({
        learningSignalId: "sig-fpm-filter-2",
        taskId: "task-fpm-filter",
        learningType: "recovery_playbook",
        valueSummary: "Recovery was successful",
      }),
    ];

    const results = miner.mine(signals);

    // Non-failure_pattern signals should be filtered out
    assert.equal(results.length, 0);
  } finally {
    ctx.cleanup();
  }
});

test("FailurePatternMiner assigns generic failure for unmatched patterns", () => {
  const ctx = createSeededIntegrationContext("aa-fpm-generic-");
  try {
    const miner = new FailurePatternMiner();

    const signal = makeSignal({
      learningSignalId: "sig-fpm-generic",
      taskId: "task-fpm-generic",
      learningType: "failure_pattern",
      valueSummary: "Some unknown failure",
      evidence: {}, // No recognizable pattern
    });

    const results = miner.mine([signal]);

    assert.equal(results.length, 1);
    assert.ok(results[0]!.recommendation.includes("replanning"));
  } finally {
    ctx.cleanup();
  }
});
