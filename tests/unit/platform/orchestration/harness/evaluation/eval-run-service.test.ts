import assert from "node:assert/strict";
import test from "node:test";

import { EvalRunService } from "../../../../../../src/platform/orchestration/harness/evaluation/eval-run-service.js";
import type { HarnessRun } from "../../../../../../src/platform/orchestration/harness/index.js";

function createMockRun(overrides: Partial<HarnessRun> = {}): HarnessRun {
  return {
    runId: "run-1",
    taskId: "task-1",
    domainId: "domain-1",
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
    decision: null,
    contextSnapshots: [],
    sleepLease: null,
    recoveryCheckpoint: null,
    feedbackEnvelope: null,
    toolbelt: null,
    guardrailAssessment: null,
    hitlRequest: null,
    timeline: [],
    ...overrides,
  };
}

test("EvalRunService evaluates run with passing grade", () => {
  const service = new EvalRunService();
  const run = createMockRun({
    decision: {
      decisionId: "decision-1",
      action: "accept",
      reasonCodes: ["harness.accepted"],
      confidence: 0.85,
      createdAt: "2026-04-23T00:00:30Z",
    },
    feedbackEnvelope: {
      feedbackId: "feedback-1",
      signals: ["evidence-1", "evidence-2"],
      learnedActions: [],
      createdAt: "2026-04-23T00:00:30Z",
    },
  });

  const report = service.evaluate(run);
  assert.equal(report.overallPassed, true);
  assert.equal(report.runId, "run-1");
  assert.equal(report.grade.passed, true);
  assert.equal(report.grade.score, 0.85);
});

test("EvalRunService evaluates run with failing grade due to missing evidence", () => {
  const service = new EvalRunService();
  const run = createMockRun({
    decision: {
      decisionId: "decision-1",
      action: "accept",
      reasonCodes: ["harness.accepted"],
      confidence: 0.85,
      createdAt: "2026-04-23T00:00:30Z",
    },
    feedbackEnvelope: {
      feedbackId: "feedback-1",
      signals: [],
      learnedActions: [],
      createdAt: "2026-04-23T00:00:30Z",
    },
  });

  const report = service.evaluate(run);
  assert.equal(report.overallPassed, false);
  assert.ok(report.grade.findingCodes.includes("harness.eval.missing_evidence:evidence-1"));
});

test("EvalRunService evaluates run with non-accept decision", () => {
  const service = new EvalRunService();
  const run = createMockRun({
    decision: {
      decisionId: "decision-1",
      action: "replan",
      reasonCodes: ["harness.eval_below_replan_threshold"],
      confidence: 0.6,
      createdAt: "2026-04-23T00:00:30Z",
    },
    feedbackEnvelope: {
      feedbackId: "feedback-1",
      signals: [],
      learnedActions: [],
      createdAt: "2026-04-23T00:00:30Z",
    },
  });

  const report = service.evaluate(run);
  assert.equal(report.overallPassed, false);
  assert.ok(report.grade.findingCodes.includes("harness.eval.non_accept_decision:replan"));
});

test("EvalRunService handles run with no decision", () => {
  const service = new EvalRunService();
  const run = createMockRun({
    decision: null,
    feedbackEnvelope: null,
  });

  const report = service.evaluate(run);
  assert.equal(report.overallPassed, false);
  assert.ok(report.grade.findingCodes.includes("harness.eval.non_accept_decision:none"));
});

test("EvalRunService counts steps and timeline events", () => {
  const service = new EvalRunService();
  const run = createMockRun({
    steps: [
      { stepId: "step-1", role: "planner", stage: "plan", iteration: 1, semanticPhase: "plan", inputs: {}, outputs: {}, startedAt: "2026-04-23T00:00:00Z", completedAt: "2026-04-23T00:00:01Z" },
      { stepId: "step-2", role: "generator", stage: "execute", iteration: 1, semanticPhase: "execute", inputs: {}, outputs: {}, startedAt: "2026-04-23T00:00:01Z", completedAt: "2026-04-23T00:00:02Z" },
    ],
    timeline: [
      { eventId: "evt-1", runId: "run-1", type: "run_created", payload: {}, recordedAt: "2026-04-23T00:00:00Z" },
      { eventId: "evt-2", runId: "run-1", type: "step_completed", payload: {}, recordedAt: "2026-04-23T00:00:01Z" },
      { eventId: "evt-3", runId: "run-1", type: "step_completed", payload: {}, recordedAt: "2026-04-23T00:00:02Z" },
    ],
    decision: {
      decisionId: "decision-1",
      action: "accept",
      reasonCodes: [],
      confidence: 0.85,
      createdAt: "2026-04-23T00:00:30Z",
    },
    feedbackEnvelope: {
      feedbackId: "feedback-1",
      signals: ["evidence-1"],
      learnedActions: [],
      createdAt: "2026-04-23T00:00:30Z",
    },
  });

  const report = service.evaluate(run);
  assert.equal(report.stepCount, 2);
  assert.equal(report.timelineEventCount, 3);
});

test("EvalRunService uses custom grader", () => {
  const service = new EvalRunService();
  const run = createMockRun({
    decision: {
      decisionId: "decision-1",
      action: "accept",
      reasonCodes: [],
      confidence: 0.74,
      createdAt: "2026-04-23T00:00:30Z",
    },
    feedbackEnvelope: {
      feedbackId: "feedback-1",
      signals: [],
      learnedActions: [],
      createdAt: "2026-04-23T00:00:30Z",
    },
  });

  const report = service.evaluate(run);
  assert.equal(report.grade.passed, false);
  assert.equal(report.grade.score, 0.74);
});
