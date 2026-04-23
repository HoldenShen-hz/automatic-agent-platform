import test from "node:test";
import assert from "node:assert/strict";
import { EvalRunService, TaskOutcomeGrader } from "../../../../../src/platform/orchestration/harness/eval-harness/index.js";
import type { HarnessRun } from "../../../../../src/platform/orchestration/harness/index.js";

test("EvalRunService is exported and can be instantiated", () => {
  const service = new EvalRunService();
  assert.ok(service !== undefined);
  assert.equal(typeof service.evaluate, "function");
});

test("TaskOutcomeGrader is exported and can be instantiated", () => {
  const grader = new TaskOutcomeGrader();
  assert.ok(grader !== undefined);
  assert.equal(typeof grader.grade, "function");
});

test("TaskOutcomeGrader.grade returns passed when all conditions met", () => {
  const grader = new TaskOutcomeGrader();
  const result = grader.grade({
    evaluatorScore: 0.8,
    expectedEvidenceRefs: ["evidence-1"],
    actualEvidenceRefs: ["evidence-1"],
    decisionAction: "accept",
  });

  assert.equal(result.passed, true);
  assert.ok(result.score >= 0.75);
  assert.equal(result.findingCodes.length, 0);
});

test("TaskOutcomeGrader.grade records missing evidence findings", () => {
  const grader = new TaskOutcomeGrader();
  const result = grader.grade({
    evaluatorScore: 0.9,
    expectedEvidenceRefs: ["evidence-1", "evidence-2"],
    actualEvidenceRefs: ["evidence-1"],
    decisionAction: "accept",
  });

  assert.equal(result.passed, false);
  assert.ok(result.findingCodes.some((code) => code.includes("missing_evidence")));
});

test("TaskOutcomeGrader.grade records non-accept decision findings", () => {
  const grader = new TaskOutcomeGrader();
  const result = grader.grade({
    evaluatorScore: 0.8,
    expectedEvidenceRefs: [],
    actualEvidenceRefs: [],
    decisionAction: "replan",
  });

  assert.equal(result.passed, false);
  assert.ok(result.findingCodes.some((code) => code.includes("non_accept_decision")));
});

test("TaskOutcomeGrader.grade fails for low evaluator score", () => {
  const grader = new TaskOutcomeGrader();
  const result = grader.grade({
    evaluatorScore: 0.5,
    expectedEvidenceRefs: [],
    actualEvidenceRefs: [],
    decisionAction: "accept",
  });

  assert.equal(result.passed, false);
});

test("TaskOutcomeGrader.grade handles null decisionAction", () => {
  const grader = new TaskOutcomeGrader();
  const result = grader.grade({
    evaluatorScore: 0.8,
    expectedEvidenceRefs: [],
    actualEvidenceRefs: [],
    decisionAction: null,
  });

  assert.equal(result.passed, false);
  assert.ok(result.findingCodes.length > 0);
});

test("EvalRunService.evaluate evaluates a HarnessRun", () => {
  const service = new EvalRunService();
  const run: HarnessRun = {
    runId: "run-123",
    taskId: "task-456",
    domainId: "domain-789",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
      output_policy: { requiredEvidence: ["evidence-1"], redactSensitiveData: false },
      budget: { maxSteps: 100, maxCost: 1000, maxDurationMs: 60000 },
    },
    steps: [],
    maxIterations: 100,
    currentIteration: 1,
    status: "completed",
    createdAt: "2026-04-23T00:00:00Z",
    completedAt: "2026-04-23T00:01:00Z",
    decision: {
      decisionId: "decision-123",
      action: "accept",
      reasonCodes: ["accepted"],
      confidence: 0.85,
      createdAt: "2026-04-23T00:00:30Z",
    },
    contextSnapshots: [],
    sleepLease: null,
    recoveryCheckpoint: null,
    feedbackEnvelope: {
      feedbackId: "feedback-123",
      signals: ["evidence-1"],
      learnedActions: [],
      createdAt: "2026-04-23T00:00:45Z",
    },
    toolbelt: null,
    guardrailAssessment: null,
    hitlRequest: null,
    timeline: [],
  };

  const report = service.evaluate(run);

  assert.equal(report.runId, "run-123");
  assert.equal(report.stepCount, 0);
  assert.equal(report.timelineEventCount, 0);
  assert.equal(typeof report.overallPassed, "boolean");
  assert.ok(report.grade !== undefined);
});

test("EvalRunService.evaluate handles run without decision", () => {
  const service = new EvalRunService();
  const run: HarnessRun = {
    runId: "run-123",
    taskId: "task-456",
    domainId: "domain-789",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 100, maxCost: 1000, maxDurationMs: 60000 },
    },
    steps: [],
    maxIterations: 100,
    currentIteration: 0,
    status: "created",
    createdAt: "2026-04-23T00:00:00Z",
    completedAt: null,
    decision: null,
    contextSnapshots: [],
    sleepLease: null,
    recoveryCheckpoint: null,
    feedbackEnvelope: null,
    toolbelt: null,
    guardrailAssessment: null,
    hitlRequest: null,
    timeline: [],
  };

  const report = service.evaluate(run);

  assert.equal(report.runId, "run-123");
  // Should use default score of 0 when decision is null
  assert.equal(report.grade.score, 0);
});