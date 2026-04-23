import test from "node:test";
import assert from "node:assert/strict";
import { EvalRunService } from "../../../../../src/platform/orchestration/harness/evaluation/eval-run-service.js";
import { TaskOutcomeGrader } from "../../../../../src/platform/orchestration/harness/evaluation/task-outcome-grader.js";
import type { HarnessRun } from "../../../../../src/platform/orchestration/harness/index.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

// Helper to create a minimal HarnessRun
function createMinimalRun(overrides: Partial<{
  runId: string;
  decision: { confidence: number; action: string } | null;
  constraintPack: { output_policy: { requiredEvidence: string[] } };
  feedbackEnvelope: { signals: string[] } | null;
  steps: unknown[];
  timeline: unknown[];
}> = {}): HarnessRun {
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
      output_policy: { requiredEvidence: overrides.constraintPack?.output_policy?.requiredEvidence ?? [] },
      budget: { maxSteps: 10, maxCost: 1000, maxDurationMs: 60000 },
    },
    steps: (overrides.steps ?? []) as HarnessRun["steps"],
    maxIterations: 10,
    currentIteration: 1,
    status: "completed",
    createdAt: nowIso(),
    completedAt: nowIso(),
    decision: (overrides.decision ?? null) as HarnessRun["decision"],
    contextSnapshots: [],
    sleepLease: null,
    recoveryCheckpoint: null,
    feedbackEnvelope: (overrides.feedbackEnvelope ?? null) as HarnessRun["feedbackEnvelope"],
    toolbelt: null,
    guardrailAssessment: null,
    hitlRequest: null,
    timeline: (overrides.timeline ?? []) as HarnessRun["timeline"],
  };
}

test("EvalRunService.evaluate returns overallPassed=true for passing grade", () => {
  const service = new EvalRunService();
  const run = createMinimalRun({
    runId: "run_pass",
    decision: { confidence: 0.85, action: "accept" },
    constraintPack: { output_policy: { requiredEvidence: [] } },
    feedbackEnvelope: { signals: [], learnedActions: [], createdAt: nowIso(), feedbackId: newId("fb") },
    steps: [{}] as HarnessRun["steps"],
    timeline: [{}] as HarnessRun["timeline"],
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
    decision: { confidence: 0.50, action: "replan" }, // score too low
    constraintPack: { output_policy: { requiredEvidence: ["missing"] } },
    feedbackEnvelope: { signals: ["missing"], learnedActions: [], createdAt: nowIso(), feedbackId: newId("fb") },
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
    decision: { confidence: 0.92, action: "accept" },
    feedbackEnvelope: { signals: [], learnedActions: [], createdAt: nowIso(), feedbackId: newId("fb") },
  });

  const report = service.evaluate(run);

  assert.strictEqual(report.grade.score, 0.92);
});

test("EvalRunService.evaluate defaults confidence to 0 when decision is null", () => {
  const service = new EvalRunService();
  const run = createMinimalRun({
    decision: null,
    feedbackEnvelope: { signals: [], learnedActions: [], createdAt: nowIso(), feedbackId: newId("fb") },
  });

  const report = service.evaluate(run);

  // Score should be 0 since no decision confidence
  assert.strictEqual(report.grade.score, 0);
  assert.strictEqual(report.overallPassed, false);
});

test("EvalRunService.evaluate uses constraintPack.requiredEvidence for expectedEvidenceRefs", () => {
  const service = new EvalRunService();
  const run = createMinimalRun({
    constraintPack: { output_policy: { requiredEvidence: ["evidence_a", "evidence_b"] } },
    feedbackEnvelope: { signals: ["evidence_a"], learnedActions: [], createdAt: nowIso(), feedbackId: newId("fb") },
  });

  const report = service.evaluate(run);

  // Should have missing evidence finding for evidence_b
  assert.ok(report.grade.findingCodes.some((code) => code.includes("evidence_b")));
});

test("EvalRunService.evaluate uses feedbackEnvelope.signals as actualEvidenceRefs", () => {
  const service = new EvalRunService();
  const run = createMinimalRun({
    constraintPack: { output_policy: { requiredEvidence: ["evidence_1"] } },
    feedbackEnvelope: { signals: ["evidence_1", "evidence_2"], learnedActions: [], createdAt: nowIso(), feedbackId: newId("fb") },
  });

  const report = service.evaluate(run);

  // evidence_1 is present, only evidence_b missing
  assert.strictEqual(report.grade.findingCodes.length, 1);
  assert.ok(report.grade.findingCodes.some((code) => code.includes("evidence_1") && code.includes("missing")));
});

test("EvalRunService.evaluate handles null feedbackEnvelope", () => {
  const service = new EvalRunService();
  const run = createMinimalRun({
    decision: { confidence: 0.9, action: "accept" },
    feedbackEnvelope: null,
    constraintPack: { output_policy: { requiredEvidence: [] } },
  });

  const report = service.evaluate(run);

  assert.strictEqual(report.grade.passed, true);
});

test("EvalRunService.evaluate uses decision.action for grading", () => {
  const service = new EvalRunService();
  const run = createMinimalRun({
    decision: { confidence: 0.90, action: "escalate_to_human" },
    feedbackEnvelope: { signals: [], learnedActions: [], createdAt: nowIso(), feedbackId: newId("fb") },
    constraintPack: { output_policy: { requiredEvidence: [] } },
  });

  const report = service.evaluate(run);

  assert.strictEqual(report.overallPassed, false);
  assert.ok(report.grade.findingCodes.some((code) => code.includes("escalate_to_human")));
});

test("EvalRunService.evaluate counts steps and timeline events", () => {
  const service = new EvalRunService();
  const run = createMinimalRun({
    steps: [{}, {}, {}] as HarnessRun["steps"],
    timeline: [{}, {}, {}, {}, {}] as HarnessRun["timeline"],
  });

  const report = service.evaluate(run);

  assert.strictEqual(report.stepCount, 3);
  assert.strictEqual(report.timelineEventCount, 5);
});

test("EvalRunService.evaluate with custom grader", () => {
  const customGrader = new TaskOutcomeGrader();
  const service = new EvalRunService(customGrader);
  const run = createMinimalRun({
    decision: { confidence: 0.88, action: "accept" },
    constraintPack: { output_policy: { requiredEvidence: [] } },
    feedbackEnvelope: { signals: [], learnedActions: [], createdAt: nowIso(), feedbackId: newId("fb") },
  });

  const report = service.evaluate(run);

  assert.strictEqual(report.grade.passed, true);
});

test("EvalRunService constructor allows custom grader", () => {
  const customGrader = new TaskOutcomeGrader();
  const service = new EvalRunService(customGrader);

  assert.ok((service as unknown as { grader: TaskOutcomeGrader }).grader === customGrader);
});

test("EvalRunService defaults to TaskOutcomeGrader when no argument provided", () => {
  const service = new EvalRunService();

  assert.ok((service as unknown as { grader: TaskOutcomeGrader }).grader instanceof TaskOutcomeGrader);
});