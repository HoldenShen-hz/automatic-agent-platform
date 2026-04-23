import assert from "node:assert/strict";
import test from "node:test";

import { TaskOutcomeGrader, type TaskOutcomeGradeInput } from "../../../../../../src/platform/orchestration/harness/evaluation/task-outcome-grader.js";

test("TaskOutcomeGrader grades with all evidence and accept decision", () => {
  const grader = new TaskOutcomeGrader();
  const input: TaskOutcomeGradeInput = {
    evaluatorScore: 0.85,
    expectedEvidenceRefs: ["evidence-1", "evidence-2"],
    actualEvidenceRefs: ["evidence-1", "evidence-2"],
    decisionAction: "accept",
  };

  const grade = grader.grade(input);
  assert.equal(grade.passed, true);
  assert.equal(grade.score, 0.85);
  assert.deepEqual(grade.findingCodes, []);
});

test("TaskOutcomeGrader detects missing evidence", () => {
  const grader = new TaskOutcomeGrader();
  const input: TaskOutcomeGradeInput = {
    evaluatorScore: 0.9,
    expectedEvidenceRefs: ["evidence-1", "evidence-2", "evidence-3"],
    actualEvidenceRefs: ["evidence-1"],
    decisionAction: "accept",
  };

  const grade = grader.grade(input);
  assert.equal(grade.passed, false);
  assert.ok(grade.findingCodes.includes("harness.eval.missing_evidence:evidence-2"));
  assert.ok(grade.findingCodes.includes("harness.eval.missing_evidence:evidence-3"));
});

test("TaskOutcomeGrader detects non-accept decision", () => {
  const grader = new TaskOutcomeGrader();
  const input: TaskOutcomeGradeInput = {
    evaluatorScore: 0.85,
    expectedEvidenceRefs: [],
    actualEvidenceRefs: [],
    decisionAction: "replan",
  };

  const grade = grader.grade(input);
  assert.equal(grade.passed, false);
  assert.ok(grade.findingCodes.includes("harness.eval.non_accept_decision:replan"));
});

test("TaskOutcomeGrader fails when score below 0.75 even with all evidence", () => {
  const grader = new TaskOutcomeGrader();
  const input: TaskOutcomeGradeInput = {
    evaluatorScore: 0.74,
    expectedEvidenceRefs: ["evidence-1"],
    actualEvidenceRefs: ["evidence-1"],
    decisionAction: "accept",
  };

  const grade = grader.grade(input);
  assert.equal(grade.passed, false);
});

test("TaskOutcomeGrader fails when score below 0.75 even with non-accept decision", () => {
  const grader = new TaskOutcomeGrader();
  const input: TaskOutcomeGradeInput = {
    evaluatorScore: 0.5,
    expectedEvidenceRefs: ["evidence-1"],
    actualEvidenceRefs: ["evidence-1"],
    decisionAction: "replan",
  };

  const grade = grader.grade(input);
  assert.equal(grade.passed, false);
  assert.ok(grade.findingCodes.includes("harness.eval.non_accept_decision:replan"));
  // Note: evidence-1 is present, so missing_evidence is not reported
});

test("TaskOutcomeGrader handles null decision action", () => {
  const grader = new TaskOutcomeGrader();
  const input: TaskOutcomeGradeInput = {
    evaluatorScore: 0.85,
    expectedEvidenceRefs: [],
    actualEvidenceRefs: [],
    decisionAction: null,
  };

  const grade = grader.grade(input);
  assert.equal(grade.passed, false);
  assert.ok(grade.findingCodes.includes("harness.eval.non_accept_decision:none"));
});

test("TaskOutcomeGrader rounds score to 4 decimal places", () => {
  const grader = new TaskOutcomeGrader();
  const input: TaskOutcomeGradeInput = {
    evaluatorScore: 0.8555555,
    expectedEvidenceRefs: [],
    actualEvidenceRefs: [],
    decisionAction: "accept",
  };

  const grade = grader.grade(input);
  assert.equal(grade.score, 0.8556);
});

test("TaskOutcomeGrader passes with score exactly 0.75 and all evidence", () => {
  const grader = new TaskOutcomeGrader();
  const input: TaskOutcomeGradeInput = {
    evaluatorScore: 0.75,
    expectedEvidenceRefs: ["evidence-1"],
    actualEvidenceRefs: ["evidence-1"],
    decisionAction: "accept",
  };

  const grade = grader.grade(input);
  assert.equal(grade.passed, true);
});