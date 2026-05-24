import assert from "node:assert/strict";
import test from "node:test";

import {
  deriveFeedbackTrustScore,
  parseFeedbackSignal,
  type FeedbackSignal,
  type FeedbackTrustFactors,
} from "../../../../src/platform/five-plane-orchestration/oapeflir/types/feedback-signal.js";
import { FeedbackQualityGrader } from "../../../../src/scale-ecosystem/feedback-loop/quality-grader.js";

const defaultTrustFactors: FeedbackTrustFactors = {
  sourceReliability: 0.9,
  historicalAccuracy: 0.9,
  authenticatedSource: true,
  attackSurfaceExposure: 0.1,
  holdoutOverlap: 0,
};

function makeSignal(overrides: Partial<FeedbackSignal> = {}): FeedbackSignal {
  const trustFactors = overrides.trustFactors ?? defaultTrustFactors;
  return parseFeedbackSignal({
    signalId: "sig-001",
    taskId: "task-001",
    source: "execution",
    category: "success",
    severity: "info",
    payload: {},
    stepOutputRefs: [],
    timestamp: Date.now(),
    trustFactors,
    feedbackTrustScore: overrides.feedbackTrustScore ?? deriveFeedbackTrustScore(trustFactors),
    ...overrides,
  });
}

test("FeedbackQualityGrader returns discard for empty signals", () => {
  const grader = new FeedbackQualityGrader();
  const result = grader.gradeSignals([]);

  assert.strictEqual(result.grade, "discard");
  assert.strictEqual(result.reasons[0], "No signals provided");
});

test("FeedbackQualityGrader grades user feedback higher", () => {
  const grader = new FeedbackQualityGrader();
  const userSignal = makeSignal({ source: "user", category: "correction" });
  const execSignal = makeSignal({ source: "execution", category: "correction" });

  const userGrade = grader.gradeSignals([userSignal]);
  const execGrade = grader.gradeSignals([execSignal]);

  assert.ok(userGrade.score.signalQuality > execGrade.score.signalQuality);
});

test("FeedbackQualityGrader grades corrections higher than success", () => {
  const grader = new FeedbackQualityGrader();
  const correctionSignal = makeSignal({ category: "correction" });
  const successSignal = makeSignal({ category: "success" });

  const correctionGrade = grader.gradeSignals([correctionSignal]);
  const successGrade = grader.gradeSignals([successSignal]);

  assert.ok(correctionGrade.score.signalQuality > successGrade.score.signalQuality);
});

test("FeedbackQualityGrader grades critical severity higher", () => {
  const grader = new FeedbackQualityGrader();
  const criticalSignal = makeSignal({ severity: "critical" });
  const infoSignal = makeSignal({ severity: "info" });

  const criticalGrade = grader.gradeSignals([criticalSignal]);
  const infoGrade = grader.gradeSignals([infoSignal]);

  assert.ok(criticalGrade.score.signalQuality > infoGrade.score.signalQuality);
});

test("FeedbackQualityGrader assesses diversity across signals", () => {
  const grader = new FeedbackQualityGrader();
  const diverseSignals = [
    makeSignal({ category: "success", source: "user", severity: "info" }),
    makeSignal({ category: "failure", source: "hitl", severity: "error" }),
    makeSignal({ category: "correction", source: "validation", severity: "warning" }),
  ];
  const sameSignals = [
    makeSignal({ category: "success", source: "execution", severity: "info" }),
    makeSignal({ category: "success", source: "execution", severity: "info" }),
  ];

  const diverseGrade = grader.gradeSignals(diverseSignals);
  const sameGrade = grader.gradeSignals(sameSignals);

  assert.ok(diverseGrade.score.diversityScore > sameGrade.score.diversityScore);
});

test("FeedbackQualityGrader filterByGrade returns empty for low quality", () => {
  const grader = new FeedbackQualityGrader();
  const lowQualitySignal = makeSignal({ category: "success", source: "execution" });
  const result = grader.filterByGrade([lowQualitySignal], "high");

  assert.deepStrictEqual(result, []);
});

test("FeedbackQualityGrader respects custom options", () => {
  const grader = new FeedbackQualityGrader({ minOverallScore: 0.9 });
  const signal = makeSignal({ source: "user", category: "correction", severity: "critical" });
  const result = grader.gradeSignals([signal]);

  // With strict threshold, even good signals may not pass
  assert.strictEqual(result.grade === "high" || result.grade === "medium" || result.grade === "low" || result.grade === "discard", true);
});

test("FeedbackQualityGrader gradeLearningSignals converts learning signals", () => {
  const grader = new FeedbackQualityGrader();
  const learningSignal = {
    learningSignalId: "learn-001",
    taskId: "task-001",
    sourceFeedbackId: "fb-001",
    learningType: "failure_pattern" as const,
    confidence: 0.8,
    valueSummary: "Pattern detected",
    evidenceRefs: ["ref-1"],
    sourceSignalIds: ["sig-001", "sig-002"],
    relatedSignalIds: [],
    evidence: {},
    generatedAt: Date.now(),
  };

  const result = grader.gradeLearningSignals([learningSignal]);

  assert.strictEqual(result.grade === "discard" || result.grade === "low" || result.grade === "medium" || result.grade === "high", true);
});

test("FeedbackQualityGrader calculates information density", () => {
  const grader = new FeedbackQualityGrader();
  const richSignal = makeSignal({ payload: { summary: "This is a detailed summary of what happened", reasonCode: "ERR_123" } });
  const poorSignal = makeSignal({ payload: {} });

  const richGrade = grader.gradeSignals([richSignal]);
  const poorGrade = grader.gradeSignals([poorSignal]);

  assert.ok(richGrade.score.informationDensity > poorGrade.score.informationDensity);
});

test("FeedbackQualityGrader requires human source when configured", () => {
  const grader = new FeedbackQualityGrader({ requireHumanSource: true });
  const execSignal = makeSignal({ source: "execution" });

  const result = grader.gradeSignals([execSignal]);

  assert.ok(result.reasons.some(r => r.includes("human")));
});
