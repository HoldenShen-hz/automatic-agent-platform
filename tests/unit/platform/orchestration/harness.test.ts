import assert from "node:assert/strict";
import test from "node:test";

import { DurableHarnessService } from "../../../../src/platform/five-plane-orchestration/harness/durable/durable-harness-service.js";
import { EvalRunService } from "../../../../src/platform/five-plane-orchestration/harness/evaluation/eval-run-service.js";
import { TaskOutcomeGrader } from "../../../../src/platform/five-plane-orchestration/harness/evaluation/task-outcome-grader.js";
import { HarnessRuntimeService, type ConstraintPack } from "../../../../src/platform/five-plane-orchestration/harness/index.js";

function createConstraintPack(overrides: Partial<ConstraintPack> = {}): ConstraintPack {
  return {
    policyIds: ["policy.default"],
    approvalMode: "supervised",
    autonomyMode: "supervised",
    tool_policy: {
      allowedTools: ["read", "summarize"],
    },
    risk_policy: {
      maxRiskScore: 70,
      escalationThreshold: 55,
    },
    output_policy: {
      requiredEvidence: ["risk_profile"],
      redactSensitiveData: true,
    },
    budgetEnvelope: {
      maxSteps: 8,
      maxCost: 5,
      maxDurationMs: 60000,
    },
    sandboxRequirement: {
      sandboxMode: "ephemeral",
      timeoutMs: 1000,
    },
    approvalRequirement: {
      requiredForRiskClass: ["high", "critical"],
      approverRoles: ["operator"],
      escalationTimeoutMs: 5000,
    },
    ...overrides,
  };
}

function createCompletedRun(constraintPack: ConstraintPack) {
  const service = new HarnessRuntimeService();
  return service.runLoop({
    taskId: "task-grade-test",
    domainId: "coding",
    constraintPack,
    plannerOutput: { planId: "plan-1" },
    generatorOutput: { artifact: "patch.diff" },
    evaluatorOutput: { verdict: "pass" },
    evaluatorScore: 0.92,
    producedEvidenceRefs: ["risk_profile"],
  });
}

test("TaskOutcomeGrader grades accept decisions with complete evidence", () => {
  const result = new TaskOutcomeGrader().grade({
    evaluatorScore: 0.92,
    expectedEvidenceRefs: ["risk_profile"],
    actualEvidenceRefs: ["risk_profile"],
    decisionAction: "accept",
  });

  assert.equal(result.passed, true);
  assert.equal(result.score, 0.92);
  assert.deepEqual(result.findingCodes, []);
});

test("TaskOutcomeGrader reports missing evidence and non-accept decisions", () => {
  const grader = new TaskOutcomeGrader();
  const missingEvidence = grader.grade({
    evaluatorScore: 0.9,
    expectedEvidenceRefs: ["risk_profile", "execution_log"],
    actualEvidenceRefs: ["risk_profile"],
    decisionAction: "accept",
  });
  const rejected = grader.grade({
    evaluatorScore: 0.9,
    expectedEvidenceRefs: [],
    actualEvidenceRefs: [],
    decisionAction: "replan",
  });

  assert.equal(missingEvidence.passed, false);
  assert.ok(missingEvidence.findingCodes.some((code) => code.includes("missing_evidence")));
  assert.equal(rejected.passed, false);
  assert.ok(rejected.findingCodes.some((code) => code.includes("non_accept_decision")));
});

test("EvalRunService evaluates completed runs against the normalized constraint pack", () => {
  const run = createCompletedRun(createConstraintPack());
  const report = new EvalRunService().evaluate(run);

  assert.equal(report.runId, run.runId);
  assert.equal(report.overallPassed, true);
  assert.equal(report.grade.passed, true);
  assert.ok(report.timelineEventCount >= 3);
});

test("DurableHarnessService persists restores and checkpoints HarnessRunRuntimeState", () => {
  const durable = new DurableHarnessService();
  const runtime = new HarnessRuntimeService();
  const run = runtime.createRun({
    taskId: "task-durable-1",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const record = durable.persist(run);
  const restored = durable.restore(run.runId);
  const checkpointRef = durable.checkpoint(run);
  const checkpointRestored = durable.restoreFromCheckpoint(checkpointRef);

  assert.equal(record.run.runId, run.runId);
  assert.equal(restored?.runId, run.runId);
  assert.ok(checkpointRef.startsWith("harness_checkpoint_"));
  assert.equal(checkpointRestored?.runId, run.runId);
});
