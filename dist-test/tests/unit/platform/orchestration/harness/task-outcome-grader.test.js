import test from "node:test";
import assert from "node:assert/strict";
import { TaskOutcomeGrader } from "../../../../../src/platform/orchestration/harness/evaluation/task-outcome-grader.js";
test("TaskOutcomeGrader.grade returns passed=true when all evidence present and score >= 0.75", () => {
    const grader = new TaskOutcomeGrader();
    const input = {
        evaluatorScore: 0.85,
        expectedEvidenceRefs: ["evidence_1", "evidence_2"],
        actualEvidenceRefs: ["evidence_1", "evidence_2"],
        decisionAction: "accept",
    };
    const grade = grader.grade(input);
    assert.strictEqual(grade.passed, true);
    assert.strictEqual(grade.score, 0.85);
    assert.deepEqual(grade.findingCodes, []);
});
test("TaskOutcomeGrader.grade returns passed=true with score exactly 0.75", () => {
    const grader = new TaskOutcomeGrader();
    const input = {
        evaluatorScore: 0.75,
        expectedEvidenceRefs: [],
        actualEvidenceRefs: [],
        decisionAction: "accept",
    };
    const grade = grader.grade(input);
    assert.strictEqual(grade.passed, true);
    assert.strictEqual(grade.score, 0.75);
});
test("TaskOutcomeGrader.grade returns passed=false when score < 0.75 even with all evidence", () => {
    const grader = new TaskOutcomeGrader();
    const input = {
        evaluatorScore: 0.74,
        expectedEvidenceRefs: ["evidence_1"],
        actualEvidenceRefs: ["evidence_1"],
        decisionAction: "accept",
    };
    const grade = grader.grade(input);
    assert.strictEqual(grade.passed, false);
    assert.strictEqual(grade.score, 0.74);
});
test("TaskOutcomeGrader.grade returns passed=false when missing evidence", () => {
    const grader = new TaskOutcomeGrader();
    const input = {
        evaluatorScore: 0.90,
        expectedEvidenceRefs: ["evidence_1", "evidence_2"],
        actualEvidenceRefs: ["evidence_1"], // missing evidence_2
        decisionAction: "accept",
    };
    const grade = grader.grade(input);
    assert.strictEqual(grade.passed, false);
    assert.ok(grade.findingCodes.some((code) => code.includes("evidence_2")));
});
test("TaskOutcomeGrader.grade reports missing evidence finding codes", () => {
    const grader = new TaskOutcomeGrader();
    const input = {
        evaluatorScore: 0.95,
        expectedEvidenceRefs: ["missing_1", "missing_2"],
        actualEvidenceRefs: [],
        decisionAction: "accept",
    };
    const grade = grader.grade(input);
    assert.strictEqual(grade.findingCodes.length, 2);
    assert.ok(grade.findingCodes.includes("harness.eval.missing_evidence:missing_1"));
    assert.ok(grade.findingCodes.includes("harness.eval.missing_evidence:missing_2"));
});
test("TaskOutcomeGrader.grade reports non-accept decision finding code", () => {
    const grader = new TaskOutcomeGrader();
    const input = {
        evaluatorScore: 0.80,
        expectedEvidenceRefs: [],
        actualEvidenceRefs: [],
        decisionAction: "replan",
    };
    const grade = grader.grade(input);
    assert.strictEqual(grade.passed, false);
    assert.deepEqual(grade.findingCodes, ["harness.eval.non_accept_decision:replan"]);
});
test("TaskOutcomeGrader.grade reports null decision action as 'none'", () => {
    const grader = new TaskOutcomeGrader();
    const input = {
        evaluatorScore: 0.90,
        expectedEvidenceRefs: [],
        actualEvidenceRefs: [],
        decisionAction: null,
    };
    const grade = grader.grade(input);
    assert.strictEqual(grade.passed, false);
    assert.ok(grade.findingCodes.includes("harness.eval.non_accept_decision:none"));
});
test("TaskOutcomeGrader.grade combines missing evidence and non-accept findings", () => {
    const grader = new TaskOutcomeGrader();
    const input = {
        evaluatorScore: 0.70,
        expectedEvidenceRefs: ["evidence_x"],
        actualEvidenceRefs: [],
        decisionAction: "retry_same_plan",
    };
    const grade = grader.grade(input);
    assert.strictEqual(grade.passed, false);
    assert.strictEqual(grade.findingCodes.length, 2);
    assert.ok(grade.findingCodes.includes("harness.eval.missing_evidence:evidence_x"));
    assert.ok(grade.findingCodes.includes("harness.eval.non_accept_decision:retry_same_plan"));
});
test("TaskOutcomeGrader.grade handles empty expected and actual evidence", () => {
    const grader = new TaskOutcomeGrader();
    const input = {
        evaluatorScore: 0.80,
        expectedEvidenceRefs: [],
        actualEvidenceRefs: [],
        decisionAction: "accept",
    };
    const grade = grader.grade(input);
    assert.strictEqual(grade.passed, true);
    assert.deepEqual(grade.findingCodes, []);
});
test("TaskOutcomeGrader.grade handles extra actual evidence (not in expected)", () => {
    const grader = new TaskOutcomeGrader();
    const input = {
        evaluatorScore: 0.85,
        expectedEvidenceRefs: ["required_1"],
        actualEvidenceRefs: ["required_1", "extra_evidence"],
        decisionAction: "accept",
    };
    const grade = grader.grade(input);
    assert.strictEqual(grade.passed, true);
    assert.deepEqual(grade.findingCodes, []);
});
test("TaskOutcomeGrader.grade rounds score to 4 decimal places", () => {
    const grader = new TaskOutcomeGrader();
    const input = {
        evaluatorScore: 0.8555555,
        expectedEvidenceRefs: [],
        actualEvidenceRefs: [],
        decisionAction: "accept",
    };
    const grade = grader.grade(input);
    assert.strictEqual(grade.score, 0.8556);
});
test("TaskOutcomeGrader.grade handles score of 0", () => {
    const grader = new TaskOutcomeGrader();
    const input = {
        evaluatorScore: 0,
        expectedEvidenceRefs: [],
        actualEvidenceRefs: [],
        decisionAction: "accept",
    };
    const grade = grader.grade(input);
    assert.strictEqual(grade.passed, false);
    assert.strictEqual(grade.score, 0);
});
test("TaskOutcomeGrader.grade handles score of 1", () => {
    const grader = new TaskOutcomeGrader();
    const input = {
        evaluatorScore: 1,
        expectedEvidenceRefs: [],
        actualEvidenceRefs: [],
        decisionAction: "accept",
    };
    const grade = grader.grade(input);
    assert.strictEqual(grade.passed, true);
    assert.strictEqual(grade.score, 1);
});
test("TaskOutcomeGrader.grade uses default constructor without arguments", () => {
    const grader = new TaskOutcomeGrader();
    const input = {
        evaluatorScore: 0.9,
        expectedEvidenceRefs: [],
        actualEvidenceRefs: [],
        decisionAction: "accept",
    };
    const grade = grader.grade(input);
    assert.strictEqual(grade.passed, true);
});
//# sourceMappingURL=task-outcome-grader.test.js.map