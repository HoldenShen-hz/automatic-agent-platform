import test from "node:test";
import assert from "node:assert/strict";

import { FeedbackQualityGrader } from "../../../../src/scale-ecosystem/feedback-loop/quality-grader.js";
import type { FeedbackSignal } from "../../../../src/platform/orchestration/oapeflir/types/feedback-signal.js";

function createSignal(overrides: Partial<FeedbackSignal> = {}): FeedbackSignal {
  return {
    signalId: "sig_test_1",
    taskId: "task_1",
    source: "execution",
    category: "failure",
    severity: "error",
    payload: {},
    stepOutputRefs: [],
    timestamp: Date.now(),
    ...overrides,
  };
}

test("FeedbackQualityGrader assigns high grade to human correction feedback", () => {
  const grader = new FeedbackQualityGrader();
  const signals = [
    createSignal({
      signalId: "sig_1",
      source: "user",
      category: "correction",
      severity: "critical",
      payload: { reasonCode: "wrong_output", summary: "User corrected the model's output" },
      stepOutputRefs: ["step:1", "step:2"],
    }),
  ];

  const grade = grader.gradeSignals(signals);

  assert.ok(grade.grade === "high" || grade.grade === "medium");
  assert.ok(grade.score.overall > 0.6);
  assert.ok(grade.score.signalQuality > 0.5);
});

test("FeedbackQualityGrader assigns low grade to low-diversity info-only signals", () => {
  const grader = new FeedbackQualityGrader();
  const signals = [
    createSignal({
      signalId: "sig_1",
      source: "system",
      category: "success",
      severity: "info",
      payload: {},
      stepOutputRefs: [],
    }),
    createSignal({
      signalId: "sig_2",
      source: "system",
      category: "success",
      severity: "info",
      payload: {},
      stepOutputRefs: [],
    }),
  ];

  const grade = grader.gradeSignals(signals);

  assert.ok(grade.grade === "discard" || grade.score.overall < 0.6);
});

test("FeedbackQualityGrader filters signals below minOverallScore", () => {
  const grader = new FeedbackQualityGrader({ minOverallScore: 0.8 });
  const signals = [
    createSignal({
      source: "system",
      category: "success",
      severity: "info",
      payload: {},
    }),
  ];

  const grade = grader.gradeSignals(signals);

  assert.equal(grade.grade, "discard");
});

test("FeedbackQualityGrader requires human source when option set", () => {
  const grader = new FeedbackQualityGrader({ requireHumanSource: true });
  const signals = [
    createSignal({
      signalId: "sig_1",
      source: "execution",
      category: "failure",
      severity: "error",
    }),
  ];

  const grade = grader.gradeSignals(signals);

  assert.ok(grade.reasons.some((r) => r.includes("human")));
});

test("FeedbackQualityGrader grades empty signal list as discard", () => {
  const grader = new FeedbackQualityGrader();
  const grade = grader.gradeSignals([]);

  assert.equal(grade.grade, "discard");
  assert.ok(grade.reasons.includes("No signals provided"));
});

test("FeedbackQualityGrader filterByGrade returns empty for discard grade", () => {
  const grader = new FeedbackQualityGrader();
  const signals = [
    createSignal({
      source: "system",
      category: "success",
      severity: "info",
    }),
  ];

  const filtered = grader.filterByGrade(signals, "high");

  assert.equal(filtered.length, 0);
});

test("FeedbackQualityGrader scores vary with severity and category", () => {
  const grader = new FeedbackQualityGrader();

  const criticalCorrection = grader.gradeSignals([
    createSignal({ source: "user", category: "correction", severity: "critical" }),
  ]);

  const infoSuccess = grader.gradeSignals([
    createSignal({ source: "system", category: "success", severity: "info" }),
  ]);

  assert.ok(criticalCorrection.score.overall > infoSuccess.score.overall);
});

test("FeedbackQualityGrader maxAgeDays filter works", () => {
  const grader = new FeedbackQualityGrader({ maxAgeDays: 7 });
  const oldSignal = createSignal({
    timestamp: Date.now() - 8 * 24 * 60 * 60 * 1000,
    source: "user",
    category: "correction",
  });

  const grade = grader.gradeSignals([oldSignal]);

  assert.ok(grade.reasons.some((r) => r.includes("max age")));
});

test("FeedbackQualityGrader with custom options applies correctly", () => {
  const grader = new FeedbackQualityGrader({
    minOverallScore: 0.3,
    minSignalQuality: 0.2,
    requireHumanSource: false,
    maxAgeDays: 60,
  });

  const grade = grader.gradeSignals([
    createSignal({
      source: "user",
      category: "correction",
      severity: "error",
      payload: { reasonCode: "code", summary: "summary text here" },
      stepOutputRefs: ["step:1"],
    }),
  ]);

  assert.ok(grade.score.overall >= 0.3);
});