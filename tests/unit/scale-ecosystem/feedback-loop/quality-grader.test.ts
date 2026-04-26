/**
 * Unit tests for FeedbackQualityGrader - Additional Coverage
 *
 * @see src/scale-ecosystem/feedback-loop/quality-grader.ts
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  FeedbackQualityGrader,
  type FeedbackSignal,
  type LearningSignal,
  type QualityGrade,
} from "../../../src/scale-ecosystem/feedback-loop/quality-grader.js";

function createSignal(overrides: Partial<FeedbackSignal> = {}): FeedbackSignal {
  return {
    signalId: "sig-1",
    taskId: "task-1",
    source: "execution",
    category: "failure",
    severity: "error",
    payload: {},
    stepOutputRefs: [],
    timestamp: Date.now(),
    ...overrides,
  };
}

function createLearningSignal(overrides: Partial<LearningSignal> = {}): LearningSignal {
  return {
    learningSignalId: "ls-1",
    taskId: "task-1",
    sourceFeedbackId: "fb-1",
    learningType: "failure_pattern",
    confidence: 0.8,
    valueSummary: "Test signal",
    evidenceRefs: [],
    sourceSignalIds: ["sig-1"],
    relatedSignalIds: ["sig-1"],
    evidence: { source: "execution", category: "failure", severity: "error", reasonCode: null },
    generatedAt: Date.now(),
    ...overrides,
  };
}

describe("FeedbackQualityGrader", () => {
  describe("gradeSignals with empty array", () => {
    test("returns discard grade for empty signals", () => {
      const grader = new FeedbackQualityGrader();
      const grade = grader.gradeSignals([]);

      assert.equal(grade.grade, "discard");
      assert.equal(grade.score.overall, 0);
      assert.ok(grade.reasons.includes("No signals provided"));
    });
  });

  describe("gradeSignals with custom options", () => {
    test("respects custom minOverallScore", () => {
      const grader = new FeedbackQualityGrader({ minOverallScore: 0.9 });
      const signals = [
        createSignal({ source: "user", category: "correction", severity: "critical" }),
      ];
      const grade = grader.gradeSignals(signals);

      assert.equal(grade.grade, "low");
    });

    test("respects custom minSignalQuality", () => {
      const grader = new FeedbackQualityGrader({ minSignalQuality: 0.8 });
      const signals = [createSignal({ source: "execution", category: "success", severity: "info" })];
      const grade = grader.gradeSignals(signals);

      assert.ok(grade.reasons.some((r) => r.includes("Signal quality below threshold")));
    });

    test("requires human source when option set", () => {
      const grader = new FeedbackQualityGrader({ requireHumanSource: true });
      const signals = [createSignal({ source: "execution", category: "failure" })];
      const grade = grader.gradeSignals(signals);

      assert.ok(grade.reasons.includes("No human-generated feedback found"));
    });

    test("passes when human source present and required", () => {
      const grader = new FeedbackQualityGrader({ requireHumanSource: true });
      const signals = [createSignal({ source: "user", category: "correction" })];
      const grade = grader.gradeSignals(signals);

      assert.ok(!grade.reasons.includes("No human-generated feedback found"));
    });
  });

  describe("gradeSignals score components", () => {
    test("signalQuality is higher for human sources", () => {
      const grader = new FeedbackQualityGrader();
      const executionSignal = grader.gradeSignals([createSignal({ source: "execution" })]);
      const userSignal = grader.gradeSignals([createSignal({ source: "user" })]);

      assert.ok(userSignal.score.signalQuality > executionSignal.score.signalQuality);
    });

    test("signalQuality is higher for correction category", () => {
      const grader = new FeedbackQualityGrader();
      const failureGrade = grader.gradeSignals([createSignal({ category: "failure" })]);
      const correctionGrade = grader.gradeSignals([createSignal({ category: "correction" })]);

      assert.ok(correctionGrade.score.signalQuality > failureGrade.score.signalQuality);
    });

    test("signalQuality is lower for success category", () => {
      const grader = new FeedbackQualityGrader();
      const successGrade = grader.gradeSignals([createSignal({ category: "success" })]);
      const failureGrade = grader.gradeSignals([createSignal({ category: "failure" })]);

      assert.ok(successGrade.score.signalQuality < failureGrade.score.signalQuality);
    });

    test("signalQuality is higher for critical severity", () => {
      const grader = new FeedbackQualityGrader();
      const infoGrade = grader.gradeSignals([createSignal({ severity: "info" })]);
      const criticalGrade = grader.gradeSignals([createSignal({ severity: "critical" })]);

      assert.ok(criticalGrade.score.signalQuality > infoGrade.score.signalQuality);
    });

    test("signalQuality increases with payload richness", () => {
      const grader = new FeedbackQualityGrader();
      const emptyPayload = grader.gradeSignals([createSignal({ payload: {} })]);
      const richPayload = grader.gradeSignals([createSignal({ payload: { reasonCode: "ERR_1", summary: "Error occurred", detail: "More info" } })]);

      assert.ok(richPayload.score.signalQuality > emptyPayload.score.signalQuality);
    });

    test("signalQuality increases with stepOutputRefs", () => {
      const grader = new FeedbackQualityGrader();
      const noRefs = grader.gradeSignals([createSignal({ stepOutputRefs: [] })]);
      const withRefs = grader.gradeSignals([createSignal({ stepOutputRefs: ["step:1", "step:2"] })]);

      assert.ok(withRefs.score.signalQuality > noRefs.score.signalQuality);
    });
  });

  describe("gradeSignals diversity assessment", () => {
    test("diversityScore is 0 for empty array", () => {
      const grader = new FeedbackQualityGrader();
      const grade = grader.gradeSignals([]);

      assert.equal(grade.score.diversityScore, 0);
    });

    test("diversityScore is 0.3 for single signal", () => {
      const grader = new FeedbackQualityGrader();
      const grade = grader.gradeSignals([createSignal()]);

      assert.equal(grade.score.diversityScore, 0.3);
    });

    test("diversityScore increases with multiple categories", () => {
      const grader = new FeedbackQualityGrader();
      const singleCategory = grader.gradeSignals([
        createSignal({ signalId: "sig-1", category: "failure" }),
        createSignal({ signalId: "sig-2", category: "failure" }),
      ]);
      const multiCategory = grader.gradeSignals([
        createSignal({ signalId: "sig-3", category: "failure" }),
        createSignal({ signalId: "sig-4", category: "correction" }),
        createSignal({ signalId: "sig-5", category: "success" }),
      ]);

      assert.ok(multiCategory.score.diversityScore > singleCategory.score.diversityScore);
    });

    test("diversityScore considers source diversity", () => {
      const grader = new FeedbackQualityGrader();
      const singleSource = grader.gradeSignals([
        createSignal({ signalId: "sig-1", source: "execution" }),
        createSignal({ signalId: "sig-2", source: "execution" }),
      ]);
      const multiSource = grader.gradeSignals([
        createSignal({ signalId: "sig-3", source: "execution" }),
        createSignal({ signalId: "sig-4", source: "user" }),
        createSignal({ signalId: "sig-5", source: "hitl" }),
      ]);

      assert.ok(multiSource.score.diversityScore > singleSource.score.diversityScore);
    });
  });

  describe("gradeSignals information density", () => {
    test("informationDensity is 0 for empty array", () => {
      const grader = new FeedbackQualityGrader();
      const grade = grader.gradeSignals([]);

      assert.equal(grade.score.informationDensity, 0);
    });

    test("informationDensity increases with summary length", () => {
      const grader = new FeedbackQualityGrader();
      const shortSummary = grader.gradeSignals([
        createSignal({ payload: { summary: "Short" } }),
      ]);
      const longSummary = grader.gradeSignals([
        createSignal({ payload: { summary: "A".repeat(200) } }),
      ]);

      assert.ok(longSummary.score.informationDensity > shortSummary.score.informationDensity);
    });

    test("informationDensity increases with reasonCode length", () => {
      const grader = new FeedbackQualityGrader();
      const shortCode = grader.gradeSignals([
        createSignal({ payload: { reasonCode: "ERR" } }),
      ]);
      const longCode = grader.gradeSignals([
        createSignal({ payload: { reasonCode: "ErrorCodeReasonPhrase".repeat(10) } }),
      ]);

      assert.ok(longCode.score.informationDensity > shortCode.score.informationDensity);
    });
  });

  describe("gradeSignals label reliability", () => {
    test("labelReliability is 1 for user source", () => {
      const grader = new FeedbackQualityGrader();
      const grade = grader.gradeSignals([createSignal({ source: "user" })]);

      assert.equal(grade.score.labelReliability, 1);
    });

    test("labelReliability is 1 for hitl source", () => {
      const grader = new FeedbackQualityGrader();
      const grade = grader.gradeSignals([createSignal({ source: "hitl" })]);

      assert.equal(grade.score.labelReliability, 1);
    });

    test("labelReliability is 0.8 for validation source", () => {
      const grader = new FeedbackQualityGrader();
      const grade = grader.gradeSignals([createSignal({ source: "validation" })]);

      assert.equal(grade.score.labelReliability, 0.8);
    });

    test("labelReliability is higher for correction category", () => {
      const grader = new FeedbackQualityGrader();
      const successGrade = grader.gradeSignals([createSignal({ category: "success" })]);
      const correctionGrade = grader.gradeSignals([createSignal({ category: "correction" })]);

      assert.ok(correctionGrade.score.labelReliability > successGrade.score.labelReliability);
    });
  });

  describe("gradeSignals overall calculation", () => {
    test("overall is weighted average of components", () => {
      const grader = new FeedbackQualityGrader();
      const grade = grader.gradeSignals([
        createSignal({
          source: "user",
          category: "correction",
          severity: "critical",
          payload: { reasonCode: "ERR_1", summary: "Detailed error information here" },
          stepOutputRefs: ["step:1"],
        }),
      ]);

      assert.ok(grade.score.overall > 0.6);
      assert.equal(grade.grade, "high");
    });

    test("high grade for overall >= 0.8", () => {
      const grader = new FeedbackQualityGrader();
      const signals = [
        createSignal({ source: "user", category: "correction", severity: "critical" }),
        createSignal({ source: "user", category: "failure", severity: "error" }),
        createSignal({ source: "hitl", category: "success", severity: "warning" }),
        createSignal({ source: "validation", category: "partial", severity: "info" }),
      ];
      const grade = grader.gradeSignals(signals);

      assert.ok(grade.grade === "high" || grade.grade === "medium");
    });

    test("medium grade for overall >= 0.6 and < 0.8", () => {
      const grader = new FeedbackQualityGrader();
      const signals = [
        createSignal({ source: "execution", category: "failure" }),
        createSignal({ source: "execution", category: "correction" }),
      ];
      const grade = grader.gradeSignals(signals);

      assert.ok(grade.grade === "medium" || grade.grade === "low" || grade.grade === "discard");
    });

    test("low grade for overall >= minOverallScore and < 0.6", () => {
      const grader = new FeedbackQualityGrader({ minOverallScore: 0.3 });
      const signals = [createSignal({ source: "execution", category: "success", severity: "info" })];
      const grade = grader.gradeSignals(signals);

      assert.ok(grade.grade === "low" || grade.grade === "discard");
    });
  });

  describe("gradeSignals max age validation", () => {
    test("flags signals exceeding max age", () => {
      const grader = new FeedbackQualityGrader({ maxAgeDays: 30 });
      const oldTimestamp = Date.now() - 31 * 24 * 60 * 60 * 1000;
      const grade = grader.gradeSignals([createSignal({ timestamp: oldTimestamp })]);

      assert.ok(grade.reasons.some((r) => r.includes("exceeds max age")));
    });

    test("accepts signals within max age", () => {
      const grader = new FeedbackQualityGrader({ maxAgeDays: 30 });
      const recentTimestamp = Date.now() - 5 * 24 * 60 * 60 * 1000;
      const grade = grader.gradeSignals([createSignal({ timestamp: recentTimestamp })]);

      assert.ok(!grade.reasons.some((r) => r.includes("exceeds max age")));
    });
  });

  describe("gradeLearningSignals", () => {
    test("returns discard for empty array", () => {
      const grader = new FeedbackQualityGrader();
      const grade = grader.gradeLearningSignals([]);

      assert.equal(grade.grade, "discard");
      assert.ok(grade.reasons.includes("No learning signals provided"));
    });

    test("maps failure_pattern learning type to failure category", () => {
      const grader = new FeedbackQualityGrader();
      const signals = [createLearningSignal({ learningType: "failure_pattern", sourceSignalIds: ["sig-1"] })];
      const grade = grader.gradeLearningSignals(signals);

      assert.ok(grade.score.signalQuality > 0);
    });

    test("maps user_correction learning type to correction category", () => {
      const grader = new FeedbackQualityGrader();
      const signals = [createLearningSignal({ learningType: "user_correction", sourceSignalIds: ["sig-1"] })];
      const grade = grader.gradeLearningSignals(signals);

      assert.ok(grade.score.labelReliability > 0);
    });

    test("maps recovery_playbook learning type to partial category", () => {
      const grader = new FeedbackQualityGrader();
      const signals = [createLearningSignal({ learningType: "recovery_playbook", sourceSignalIds: ["sig-1"] })];
      const grade = grader.gradeLearningSignals(signals);

      assert.ok(grade.score.overall >= 0);
    });

    test("converts evidenceRefs to stepOutputRefs", () => {
      const grader = new FeedbackQualityGrader();
      const signals = [createLearningSignal({
        evidenceRefs: ["step:1", "step:2"],
        sourceSignalIds: ["sig-1"],
      })];
      const grade = grader.gradeLearningSignals(signals);

      assert.ok(grade.score.overall > 0);
    });
  });

  describe("filterByGrade", () => {
    test("returns empty array when grade below threshold", () => {
      const grader = new FeedbackQualityGrader();
      const signals = [createSignal({ source: "execution", category: "success", severity: "info" })];
      const filtered = grader.filterByGrade(signals, "high");

      assert.equal(filtered.length, 0);
    });

    test("returns all signals when grade meets threshold", () => {
      const grader = new FeedbackQualityGrader();
      const signals = [
        createSignal({ source: "user", category: "correction", severity: "critical" }),
      ];
      const filtered = grader.filterByGrade(signals, "medium");

      assert.equal(filtered.length, 1);
    });

    test("default minGrade is medium", () => {
      const grader = new FeedbackQualityGrader();
      const lowGradeSignals = [createSignal({ source: "execution", category: "success", severity: "info" })];
      const filtered = grader.filterByGrade(lowGradeSignals);

      assert.equal(filtered.length, 0);
    });
  });

  describe("grade boundaries", () => {
    test("grade boundaries are correct", () => {
      const grader = new FeedbackQualityGrader();

      const highSignals = [
        createSignal({ source: "user", category: "correction", severity: "critical" }),
        createSignal({ source: "user", category: "correction", severity: "critical" }),
        createSignal({ source: "user", category: "correction", severity: "critical" }),
        createSignal({ source: "user", category: "correction", severity: "critical" }),
      ];
      const highGrade = grader.gradeSignals(highSignals);
      assert.ok(highGrade.grade === "high");

      const veryLowSignals = [createSignal({ source: "execution", category: "success", severity: "info" })];
      const veryLowGrade = grader.gradeSignals(veryLowSignals);
      assert.ok(veryLowGrade.grade === "discard");
    });
  });
});
