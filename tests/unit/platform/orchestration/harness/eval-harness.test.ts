import assert from "node:assert/strict";
import test from "node:test";

import { EvalRunService, TaskOutcomeGrader } from "../../../../../src/platform/five-plane-orchestration/harness/eval-harness/index.js";
import { HarnessRuntimeService, type ConstraintPack } from "../../../../../src/platform/five-plane-orchestration/harness/index.js";

function createConstraintPack(): ConstraintPack {
  return {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "supervised",
    tool_policy: { allowedTools: [] },
    risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
    output_policy: { requiredEvidence: ["evidence-1"], redactSensitiveData: false },
    budgetEnvelope: { maxSteps: 100, maxCost: 1000, maxDurationMs: 60000 },
    sandboxRequirement: { sandboxMode: "ephemeral", timeoutMs: 1000 },
    approvalRequirement: {
      requiredForRiskClass: ["critical"],
      approverRoles: ["operator"],
      escalationTimeoutMs: 1000,
    },
  };
}

function createCompletedRun() {
  return new HarnessRuntimeService().runLoop({
    taskId: "task-456",
    domainId: "domain-789",
    constraintPack: createConstraintPack(),
    plannerOutput: { planId: "plan-1" },
    generatorOutput: { artifact: "patch.diff" },
    evaluatorOutput: { verdict: "pass" },
    evaluatorScore: 0.85,
    producedEvidenceRefs: ["evidence-1"],
  });
}

test("eval harness exports grader and service", () => {
  assert.equal(typeof new EvalRunService().evaluate, "function");
  assert.equal(typeof new TaskOutcomeGrader().grade, "function");
});

test("TaskOutcomeGrader handles pass missing evidence and non-accept decisions", () => {
  const grader = new TaskOutcomeGrader();
  const passed = grader.grade({
    evaluatorScore: 0.8,
    expectedEvidenceRefs: ["evidence-1"],
    actualEvidenceRefs: ["evidence-1"],
    decisionAction: "accept",
  });
  const missing = grader.grade({
    evaluatorScore: 0.9,
    expectedEvidenceRefs: ["evidence-1", "evidence-2"],
    actualEvidenceRefs: ["evidence-1"],
    decisionAction: "accept",
  });
  const replan = grader.grade({
    evaluatorScore: 0.8,
    expectedEvidenceRefs: [],
    actualEvidenceRefs: [],
    decisionAction: "replan",
  });

  assert.equal(passed.passed, true);
  assert.equal(missing.passed, false);
  assert.ok(missing.findingCodes.some((code) => code.includes("missing_evidence")));
  assert.equal(replan.passed, false);
});

test("EvalRunService evaluates a real HarnessRunRuntimeState", () => {
  const report = new EvalRunService().evaluate(createCompletedRun());

  assert.equal(report.runId.length > 0, true);
  assert.equal(report.overallPassed, true);
  assert.equal(report.grade.passed, true);
});
