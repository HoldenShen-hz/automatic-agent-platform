import assert from "node:assert/strict";
import test from "node:test";

import { EvalRunService } from "../../../../../../src/platform/five-plane-orchestration/harness/evaluation/eval-run-service.js";
import { HarnessRuntimeService, type ConstraintPack } from "../../../../../../src/platform/five-plane-orchestration/harness/index.js";

function createConstraintPack(requiredEvidence: readonly string[] = ["evidence-1"]): ConstraintPack {
  return {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "supervised",
    tool_policy: { allowedTools: [] },
    risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
    output_policy: { requiredEvidence: [...requiredEvidence], redactSensitiveData: false },
    budgetEnvelope: { maxSteps: 100, maxCost: 1000, maxDurationMs: 60000 },
    sandboxRequirement: { sandboxMode: "ephemeral", timeoutMs: 1000 },
    approvalRequirement: {
      requiredForRiskClass: ["critical"],
      approverRoles: ["operator"],
      escalationTimeoutMs: 1000,
    },
  };
}

function createRun(evaluatorScore: number, producedEvidenceRefs: readonly string[]) {
  const runtime = new HarnessRuntimeService();
  let run = runtime.createRun({
    taskId: "task-1",
    domainId: "domain-1",
    constraintPack: createConstraintPack(),
  });
  run = runtime.appendStep(run, {
    role: "generator",
    inputs: { request: "test" },
    outputs: { artifact: "patch.diff" },
    evidenceRefs: [...producedEvidenceRefs],
    iteration: 1,
  });
  return {
    ...run,
    decision: {
      decisionId: "decision-1",
      harnessDecisionId: "decision-1",
      decisionInputBundleId: "dib-1",
      decisionKind: "accept",
      decision: "accept",
      deciderType: "system",
      deciderRef: "test",
      reasonCode: "accept",
      action: "accept" as const,
      reasonCodes: ["accept"],
      confidence: evaluatorScore,
      createdAt: "2026-01-01T00:00:00.000Z",
    },
    feedbackEnvelope: {
      feedbackId: "feedback-1",
      stepSignals: [],
      taskSignals: [],
      workflowSignals: [],
      systemSignals: [],
      signals: [...producedEvidenceRefs],
      learnedActions: [],
      createdAt: "2026-01-01T00:00:00.000Z",
    },
  };
}

test("EvalRunService reports passing runs with complete evidence", () => {
  const report = new EvalRunService().evaluate(createRun(0.85, ["evidence-1"]));

  assert.equal(report.overallPassed, true);
  assert.equal(report.grade.passed, true);
  assert.equal(report.grade.score, 0.85);
});

test("EvalRunService reports failures for missing evidence or low score", () => {
  const missingEvidenceRun = new HarnessRuntimeService().runLoop({
    taskId: "task-1",
    domainId: "domain-1",
    constraintPack: createConstraintPack(["evidence-1", "evidence-2"]),
    plannerOutput: { planId: "plan-1" },
    generatorOutput: { artifact: "patch.diff" },
    evaluatorOutput: { verdict: "pass" },
    evaluatorScore: 0.85,
    producedEvidenceRefs: ["evidence-1"],
  });
  const lowScoreRun = createRun(0.74, ["evidence-1"]);

  assert.equal(new EvalRunService().evaluate(missingEvidenceRun).overallPassed, false);
  assert.equal(new EvalRunService().evaluate(lowScoreRun).grade.passed, false);
});

test("EvalRunService does not treat feedback signals as evidence refs", () => {
  const run = createRun(0.85, []);
  const pollutedSignalsRun = {
    ...run,
    feedbackEnvelope: run.feedbackEnvelope == null
      ? null
      : {
          ...run.feedbackEnvelope,
          signals: ["evidence-1", ...run.feedbackEnvelope.signals],
        },
  };

  const report = new EvalRunService().evaluate(pollutedSignalsRun);

  assert.equal(report.overallPassed, false);
  assert.ok(report.grade.findingCodes.includes("harness.eval.missing_evidence:evidence-1"));
});
