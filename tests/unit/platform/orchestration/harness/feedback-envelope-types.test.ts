import assert from "node:assert/strict";
import test from "node:test";

import {
  HarnessRuntimeService,
  getConstraintOutputPolicy,
  getConstraintRiskPolicy,
  mapHarnessStepToOapeflirPhase,
  normalizeConstraintPack,
  toCanonicalHarnessRun,
  type ConstraintPack,
  type FeedbackEnvelope,
  type HarnessStep,
} from "../../../../../src/platform/five-plane-orchestration/harness/index.js";

function createConstraintPack(): ConstraintPack {
  return normalizeConstraintPack({
    policyIds: ["policy.default"],
    approvalMode: "supervised",
    autonomyMode: "semi_auto",
    tool_policy: { allowedTools: ["read", "apply_patch"] },
    risk_policy: { maxRiskScore: 0.6, escalationThreshold: 0.8 },
    output_policy: { requiredEvidence: ["artifact:risk"], redactSensitiveData: true },
    budgetEnvelope: { maxSteps: 8, maxCost: 20, maxDurationMs: 90_000 },
    sandboxRequirement: { sandboxMode: "ephemeral", timeoutMs: 90_000 },
    approvalRequirement: {
      requiredForRiskClass: ["high", "critical"],
      approverRoles: ["reviewer"],
      escalationTimeoutMs: 300_000,
    },
  });
}

test("FeedbackEnvelope uses structured feedback channels", () => {
  const envelope: FeedbackEnvelope = {
    feedbackId: "feedback-1",
    stepSignals: [{
      stepId: "step-1",
      role: "evaluator",
      signals: ["quality.low"],
      timestamp: "2026-05-24T00:00:01.000Z",
    }],
    taskSignals: [{
      taskId: "task-1",
      iteration: 1,
      signals: ["task.replan"],
      timestamp: "2026-05-24T00:00:01.000Z",
    }],
    workflowSignals: [{
      phase: "feedback",
      signals: ["workflow.pause"],
      timestamp: "2026-05-24T00:00:01.000Z",
    }],
    systemSignals: [{
      category: "policy",
      signals: ["policy.review_required"],
      timestamp: "2026-05-24T00:00:01.000Z",
    }],
    signals: ["quality.low", "policy.review_required"],
    learnedActions: ["tighten-validation"],
    createdAt: "2026-05-24T00:00:01.000Z",
  };

  assert.equal(envelope.systemSignals[0]?.category, "policy");
  assert.equal(envelope.learnedActions[0], "tighten-validation");
});

test("harness semantic phase mapping matches current OAPEFLIR phases", () => {
  assert.equal(mapHarnessStepToOapeflirPhase("planner", "plan"), "plan");
  assert.equal(mapHarnessStepToOapeflirPhase("generator", "execute"), "execute");
  assert.equal(mapHarnessStepToOapeflirPhase("evaluator", "evaluate"), "feedback");
  assert.equal(mapHarnessStepToOapeflirPhase("learner", "learn"), "learn");
});

test("constraint helpers expose normalized risk and output policies", () => {
  const constraintPack = createConstraintPack();

  assert.equal(getConstraintRiskPolicy(constraintPack).maxRiskScore, 0.6);
  assert.equal(getConstraintOutputPolicy(constraintPack).requiredEvidence[0], "artifact:risk");
});

test("toCanonicalHarnessRun projects runtime state into contract shape", () => {
  const runtime = new HarnessRuntimeService();
  const run = runtime.createRun({
    taskId: "task-canonical",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });
  const canonical = toCanonicalHarnessRun(run);

  assert.equal(canonical.harnessRunId, run.runId);
  assert.equal(canonical.taskId, "task-canonical");
  assert.equal(canonical.constraintPackRef, run.constraintPackRef);
});

test("HarnessStep uses current semanticPhase union", () => {
  const step: HarnessStep = {
    stepId: "step-1",
    role: "loop_controller",
    stage: "stability",
    iteration: 2,
    semanticPhase: "improve",
    inputs: { feedbackCount: 3 },
    outputs: { action: "replan" },
    startedAt: "2026-05-24T00:00:00.000Z",
    completedAt: "2026-05-24T00:00:02.000Z",
    nextAction: "replan",
  };

  assert.equal(step.semanticPhase, "improve");
  assert.equal(step.nextAction, "replan");
});
