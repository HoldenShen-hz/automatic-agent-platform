import assert from "node:assert/strict";
import test from "node:test";

import type {
  TaskOutcomeGradeInput,
  TaskOutcomeGrade,
} from "../../../../../../src/platform/five-plane-orchestration/harness/evaluation/task-outcome-grader.js";
import { TaskOutcomeGrader } from "../../../../../../src/platform/five-plane-orchestration/harness/evaluation/task-outcome-grader.js";

// ─────────────────────────────────────────────────────────────────────────────
// TaskOutcomeGradeInput structure tests
// ─────────────────────────────────────────────────────────────────────────────

test("TaskOutcomeGradeInput structure with all fields", () => {
  const input: TaskOutcomeGradeInput = {
    evaluatorScore: 0.85,
    expectedEvidenceRefs: ["evidence1", "evidence2"],
    actualEvidenceRefs: ["evidence1", "evidence2"],
    decisionAction: "accept",
  };
  assert.equal(input.evaluatorScore, 0.85);
  assert.equal(input.expectedEvidenceRefs.length, 2);
  assert.equal(input.actualEvidenceRefs.length, 2);
  assert.equal(input.decisionAction, "accept");
});

test("TaskOutcomeGradeInput with empty evidence arrays", () => {
  const input: TaskOutcomeGradeInput = {
    evaluatorScore: 0.5,
    expectedEvidenceRefs: [],
    actualEvidenceRefs: [],
    decisionAction: null,
  };
  assert.equal(input.expectedEvidenceRefs.length, 0);
  assert.equal(input.actualEvidenceRefs.length, 0);
  assert.equal(input.decisionAction, null);
});

test("TaskOutcomeGradeInput with partial evidence match", () => {
  const input: TaskOutcomeGradeInput = {
    evaluatorScore: 0.9,
    expectedEvidenceRefs: ["audit_log", "approval"],
    actualEvidenceRefs: ["audit_log"],
    decisionAction: "accept",
  };
  assert.equal(input.expectedEvidenceRefs.length, 2);
  assert.equal(input.actualEvidenceRefs.length, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// TaskOutcomeGrade structure tests
// ─────────────────────────────────────────────────────────────────────────────

test("TaskOutcomeGrade structure - passed", () => {
  const grade: TaskOutcomeGrade = {
    score: 0.85,
    passed: true,
    findingCodes: [],
  };
  assert.equal(grade.score, 0.85);
  assert.ok(grade.passed);
  assert.equal(grade.findingCodes.length, 0);
});

test("TaskOutcomeGrade structure - failed", () => {
  const grade: TaskOutcomeGrade = {
    score: 0.5,
    passed: false,
    findingCodes: ["harness.eval.missing_evidence:audit_log"],
  };
  assert.equal(grade.score, 0.5);
  assert.ok(!grade.passed);
  assert.equal(grade.findingCodes.length, 1);
});

test("TaskOutcomeGrade score is rounded to 4 decimal places", () => {
  const grade: TaskOutcomeGrade = {
    score: 0.3333,
    passed: false,
    findingCodes: [],
  };
  assert.equal(grade.score, 0.3333);
});

// ─────────────────────────────────────────────────────────────────────────────
// TaskOutcomeGrader.grade() tests
// ─────────────────────────────────────────────────────────────────────────────

test("TaskOutcomeGrader passes when all evidence present and score >= 0.75", () => {
  const grader = new TaskOutcomeGrader();
  const input: TaskOutcomeGradeInput = {
    evaluatorScore: 0.8,
    expectedEvidenceRefs: ["audit_log", "approval"],
    actualEvidenceRefs: ["audit_log", "approval"],
    decisionAction: "accept",
  };

  const result = grader.grade(input);

  assert.ok(result.passed);
  assert.ok(result.findingCodes.length === 0);
  assert.equal(result.score, 0.8);
});

test("TaskOutcomeGrader fails when score < 0.75 despite complete evidence", () => {
  const grader = new TaskOutcomeGrader();
  const input: TaskOutcomeGradeInput = {
    evaluatorScore: 0.7,
    expectedEvidenceRefs: ["evidence1"],
    actualEvidenceRefs: ["evidence1"],
    decisionAction: "accept",
  };

  const result = grader.grade(input);

  assert.ok(!result.passed);
  assert.equal(result.score, 0.7);
});

test("TaskOutcomeGrader fails when evidence missing", () => {
  const grader = new TaskOutcomeGrader();
  const input: TaskOutcomeGradeInput = {
    evaluatorScore: 0.9,
    expectedEvidenceRefs: ["audit_log", "approval", "review"],
    actualEvidenceRefs: ["audit_log"],
    decisionAction: "accept",
  };

  const result = grader.grade(input);

  assert.ok(!result.passed);
  assert.ok(result.findingCodes.length >= 2); // missing approval and review
  assert.ok(result.findingCodes.some((code) => code.includes("approval")));
  assert.ok(result.findingCodes.some((code) => code.includes("review")));
});

test("TaskOutcomeGrader fails when decision action is not accept", () => {
  const grader = new TaskOutcomeGrader();
  const input: TaskOutcomeGradeInput = {
    evaluatorScore: 0.9,
    expectedEvidenceRefs: [],
    actualEvidenceRefs: [],
    decisionAction: "reject",
  };

  const result = grader.grade(input);

  assert.ok(!result.passed);
  assert.ok(result.findingCodes.includes("harness.eval.non_accept_decision:reject"));
});

test("TaskOutcomeGrader fails when decision action is null", () => {
  const grader = new TaskOutcomeGrader();
  const input: TaskOutcomeGradeInput = {
    evaluatorScore: 0.9,
    expectedEvidenceRefs: [],
    actualEvidenceRefs: [],
    decisionAction: null,
  };

  const result = grader.grade(input);

  assert.ok(!result.passed);
  assert.ok(result.findingCodes.includes("harness.eval.non_accept_decision:none"));
});

test("TaskOutcomeGrader combines missing evidence and non-accept decision", () => {
  const grader = new TaskOutcomeGrader();
  const input: TaskOutcomeGradeInput = {
    evaluatorScore: 0.8,
    expectedEvidenceRefs: ["missing1", "missing2"],
    actualEvidenceRefs: [],
    decisionAction: "escalate",
  };

  const result = grader.grade(input);

  assert.ok(!result.passed);
  assert.ok(result.findingCodes.length >= 3); // missing1, missing2, non_accept
  assert.ok(result.findingCodes.some((code) => code.includes("missing_evidence:missing1")));
  assert.ok(result.findingCodes.some((code) => code.includes("missing_evidence:missing2")));
  assert.ok(result.findingCodes.some((code) => code.includes("non_accept_decision:escalate")));
});

test("TaskOutcomeGrader passes with score exactly 0.75 and complete evidence", () => {
  const grader = new TaskOutcomeGrader();
  const input: TaskOutcomeGradeInput = {
    evaluatorScore: 0.75,
    expectedEvidenceRefs: ["evidence"],
    actualEvidenceRefs: ["evidence"],
    decisionAction: "accept",
  };

  const result = grader.grade(input);

  assert.ok(result.passed);
  assert.equal(result.score, 0.75);
});

test("TaskOutcomeGrader fails with score just below 0.75", () => {
  const grader = new TaskOutcomeGrader();
  const input: TaskOutcomeGradeInput = {
    evaluatorScore: 0.749,
    expectedEvidenceRefs: ["evidence"],
    actualEvidenceRefs: ["evidence"],
    decisionAction: "accept",
  };

  const result = grader.grade(input);

  assert.ok(!result.passed);
});

test("TaskOutcomeGrader rounds score to 4 decimal places", () => {
  const grader = new TaskOutcomeGrader();
  const input: TaskOutcomeGradeInput = {
    evaluatorScore: 0.8888888,
    expectedEvidenceRefs: [],
    actualEvidenceRefs: [],
    decisionAction: "accept",
  };

  const result = grader.grade(input);

  assert.equal(result.score, 0.8889);
});

test("TaskOutcomeGrader with high score but missing evidence", () => {
  const grader = new TaskOutcomeGrader();
  const input: TaskOutcomeGradeInput = {
    evaluatorScore: 0.95,
    expectedEvidenceRefs: ["critical_audit"],
    actualEvidenceRefs: [], // missing critical evidence
    decisionAction: "accept",
  };

  const result = grader.grade(input);

  assert.ok(!result.passed);
  assert.ok(result.findingCodes.some((code) => code.includes("critical_audit")));
});

test("TaskOutcomeGrader with complete evidence and non-accept action", () => {
  const grader = new TaskOutcomeGrader();
  const input: TaskOutcomeGradeInput = {
    evaluatorScore: 0.85,
    expectedEvidenceRefs: [],
    actualEvidenceRefs: [],
    decisionAction: "retry",
  };

  const result = grader.grade(input);

  assert.ok(!result.passed);
  assert.ok(result.findingCodes.includes("harness.eval.non_accept_decision:retry"));
});
