import test from "node:test";
import assert from "node:assert/strict";
import { EvalRunService } from "../../../../../src/platform/orchestration/harness/evaluation/eval-run-service.js";
import { TaskOutcomeGrader } from "../../../../../src/platform/orchestration/harness/evaluation/task-outcome-grader.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
// Helper to create a minimal HarnessRun
function createMinimalRun(overrides = {}) {
    return {
        runId: overrides.runId ?? newId("harness_run"),
        taskId: newId("task"),
        domainId: newId("domain"),
        constraintPack: {
            policyIds: [],
            approvalMode: "none",
            autonomyMode: "auto",
            toolPolicy: { allowedTools: [] },
            risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
            output_policy: {
                requiredEvidence: overrides.constraintPack?.output_policy?.requiredEvidence ?? [],
                redactSensitiveData: overrides.constraintPack?.output_policy?.redactSensitiveData ?? false,
            },
            budget: { maxSteps: 10, maxCost: 1000, maxDurationMs: 60000 },
        },
        steps: overrides.steps ?? [],
        maxIterations: 10,
        currentIteration: 1,
        status: "completed",
        createdAt: nowIso(),
        completedAt: nowIso(),
        decision: overrides.decision ?? null,
        contextSnapshots: [],
        sleepLease: null,
        recoveryCheckpoint: null,
        feedbackEnvelope: overrides.feedbackEnvelope ?? null,
        toolbelt: null,
        guardrailAssessment: null,
        hitlRequest: null,
        timeline: overrides.timeline ?? [],
    };
}
// Helper to create a step
function makeStep(id) {
    return {
        stepId: id,
        role: "planner",
        stage: "plan",
        iteration: 1,
        semanticPhase: "plan",
        inputs: {},
        outputs: {},
        startedAt: nowIso(),
        completedAt: nowIso(),
    };
}
// Helper to create a timeline event
function makeEvent(id) {
    return {
        eventId: id,
        runId: "run",
        type: "run_created",
        payload: {},
        recordedAt: nowIso(),
    };
}
test("EvalRunService.evaluate returns overallPassed=true for passing grade", () => {
    const service = new EvalRunService();
    const run = createMinimalRun({
        runId: "run_pass",
        decision: { decisionId: "d1", confidence: 0.85, action: "accept", reasonCodes: [], createdAt: nowIso() },
        constraintPack: { output_policy: { requiredEvidence: [] } },
        feedbackEnvelope: { feedbackId: newId("fb"), signals: [], learnedActions: [], createdAt: nowIso() },
        steps: [makeStep("step1")],
        timeline: [makeEvent("evt1")],
    });
    const report = service.evaluate(run);
    assert.strictEqual(report.runId, "run_pass");
    assert.strictEqual(report.overallPassed, true);
    assert.strictEqual(report.grade.passed, true);
    assert.strictEqual(report.stepCount, 1);
    assert.strictEqual(report.timelineEventCount, 1);
});
test("EvalRunService.evaluate returns overallPassed=false for failing grade", () => {
    const service = new EvalRunService();
    const run = createMinimalRun({
        runId: "run_fail",
        decision: { decisionId: "d1", confidence: 0.50, action: "replan", reasonCodes: [], createdAt: nowIso() },
        constraintPack: { output_policy: { requiredEvidence: ["missing"] } },
        feedbackEnvelope: { feedbackId: newId("fb"), signals: ["missing"], learnedActions: [], createdAt: nowIso() },
        steps: [],
        timeline: [],
    });
    const report = service.evaluate(run);
    assert.strictEqual(report.overallPassed, false);
    assert.strictEqual(report.grade.passed, false);
});
test("EvalRunService.evaluate uses decision.confidence as evaluatorScore", () => {
    const service = new EvalRunService();
    const run = createMinimalRun({
        decision: { decisionId: "d1", confidence: 0.92, action: "accept", reasonCodes: [], createdAt: nowIso() },
        feedbackEnvelope: { feedbackId: newId("fb"), signals: [], learnedActions: [], createdAt: nowIso() },
    });
    const report = service.evaluate(run);
    assert.strictEqual(report.grade.score, 0.92);
    assert.strictEqual(report.grade.passed, true);
});
test("EvalRunService.evaluate defaults confidence to 0 when decision is null", () => {
    const service = new EvalRunService();
    const run = createMinimalRun({
        decision: null,
        feedbackEnvelope: { feedbackId: newId("fb"), signals: [], learnedActions: [], createdAt: nowIso() },
    });
    const report = service.evaluate(run);
    assert.strictEqual(report.grade.score, 0);
    assert.strictEqual(report.overallPassed, false);
});
test("EvalRunService.evaluate uses constraintPack.requiredEvidence for expectedEvidenceRefs", () => {
    const service = new EvalRunService();
    const run = createMinimalRun({
        constraintPack: { output_policy: { requiredEvidence: ["evidence_a", "evidence_b"] } },
        feedbackEnvelope: { feedbackId: newId("fb"), signals: ["evidence_a"], learnedActions: [], createdAt: nowIso() },
    });
    const report = service.evaluate(run);
    assert.ok(report.grade.findingCodes.some((code) => code.includes("evidence_b")));
});
test("EvalRunService.evaluate uses feedbackEnvelope.signals as actualEvidenceRefs", () => {
    const service = new EvalRunService();
    const run = createMinimalRun({
        decision: { decisionId: "d1", confidence: 0.91, action: "accept", reasonCodes: [], createdAt: nowIso() },
        constraintPack: { output_policy: { requiredEvidence: ["evidence_1"] } },
        feedbackEnvelope: { feedbackId: newId("fb"), signals: ["evidence_1", "evidence_2"], learnedActions: [], createdAt: nowIso() },
    });
    const report = service.evaluate(run);
    // evidence_1 is satisfied by the feedback signals, and extra actual evidence
    // should not create missing-evidence findings.
    assert.ok(!report.grade.findingCodes.some((code) => code.includes("missing_evidence:evidence_1")));
    assert.ok(!report.grade.findingCodes.some((code) => code.includes("missing_evidence:evidence_2")));
    assert.strictEqual(report.grade.findingCodes.length, 0);
});
test("EvalRunService.evaluate handles null feedbackEnvelope", () => {
    const service = new EvalRunService();
    const run = createMinimalRun({
        decision: { decisionId: "d1", confidence: 0.9, action: "accept", reasonCodes: [], createdAt: nowIso() },
        feedbackEnvelope: null,
        constraintPack: { output_policy: { requiredEvidence: [] } },
    });
    const report = service.evaluate(run);
    assert.strictEqual(report.grade.passed, true);
});
test("EvalRunService.evaluate uses decision.action for grading", () => {
    const service = new EvalRunService();
    const run = createMinimalRun({
        decision: { decisionId: "d1", confidence: 0.90, action: "escalate_to_human", reasonCodes: [], createdAt: nowIso() },
        feedbackEnvelope: { feedbackId: newId("fb"), signals: [], learnedActions: [], createdAt: nowIso() },
        constraintPack: { output_policy: { requiredEvidence: [] } },
    });
    const report = service.evaluate(run);
    assert.strictEqual(report.overallPassed, false);
    assert.ok(report.grade.findingCodes.some((code) => code.includes("escalate_to_human")));
});
test("EvalRunService.evaluate counts steps and timeline events", () => {
    const service = new EvalRunService();
    const run = createMinimalRun({
        steps: [makeStep("s1"), makeStep("s2"), makeStep("s3")],
        timeline: [makeEvent("e1"), makeEvent("e2"), makeEvent("e3"), makeEvent("e4"), makeEvent("e5")],
    });
    const report = service.evaluate(run);
    assert.strictEqual(report.stepCount, 3);
    assert.strictEqual(report.timelineEventCount, 5);
});
test("EvalRunService.evaluate with custom grader", () => {
    const customGrader = new TaskOutcomeGrader();
    const service = new EvalRunService(customGrader);
    const run = createMinimalRun({
        decision: { decisionId: "d1", confidence: 0.88, action: "accept", reasonCodes: [], createdAt: nowIso() },
        constraintPack: { output_policy: { requiredEvidence: [] } },
        feedbackEnvelope: { feedbackId: newId("fb"), signals: [], learnedActions: [], createdAt: nowIso() },
    });
    const report = service.evaluate(run);
    assert.strictEqual(report.grade.passed, true);
});
test("EvalRunService constructor allows custom grader", () => {
    const customGrader = new TaskOutcomeGrader();
    const service = new EvalRunService(customGrader);
    assert.ok(service.grader === customGrader);
});
test("EvalRunService defaults to TaskOutcomeGrader when no argument provided", () => {
    const service = new EvalRunService();
    assert.ok(service.grader instanceof TaskOutcomeGrader);
});
//# sourceMappingURL=eval-run-service.test.js.map