import assert from "node:assert/strict";
import test from "node:test";

import type {
  ContextSnapshot,
  EvaluationReport,
  FeedbackEnvelope,
  HarnessDecision,
  HarnessLoopInput,
  HarnessStep,
  HarnessTimelineEvent,
  PlanBundle,
  RecoveryCheckpoint,
  WorkProduct,
  WorkflowSleepLease,
} from "../../../../../../src/platform/five-plane-orchestration/harness/protocol/index.js";
import { normalizeConstraintPack } from "../../../../../../src/platform/five-plane-orchestration/harness/index.js";

function createConstraintPack() {
  return normalizeConstraintPack({
    policyIds: ["policy.default"],
    approvalMode: "none",
    autonomyMode: "suggestion",
    tool_policy: { allowedTools: ["read"] },
    risk_policy: { maxRiskScore: 0.4, escalationThreshold: 0.7 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budgetEnvelope: { maxSteps: 5, maxCost: 10, maxDurationMs: 60_000 },
    sandboxRequirement: { sandboxMode: "none", timeoutMs: 60_000 },
    approvalRequirement: {
      requiredForRiskClass: [],
      approverRoles: [],
      escalationTimeoutMs: 60_000,
    },
  });
}

test("protocol index is type-only at runtime", async () => {
  const protocolModule = await import("../../../../../../src/platform/five-plane-orchestration/harness/protocol/index.js");
  assert.deepEqual(Object.keys(protocolModule), []);
});

test("protocol types accept current harness runtime shapes", () => {
  const context: ContextSnapshot = {
    snapshotId: "snapshot-1",
    runId: "run-1",
    domainId: "coding",
    iteration: 1,
    stepCount: 2,
    lastDecisionId: null,
    capturedAt: "2026-05-24T00:00:00.000Z",
  };
  const feedback: FeedbackEnvelope = {
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
      signals: ["task.retry"],
      timestamp: "2026-05-24T00:00:01.000Z",
    }],
    workflowSignals: [{
      phase: "feedback",
      signals: ["workflow.replan"],
      timestamp: "2026-05-24T00:00:01.000Z",
    }],
    systemSignals: [{
      category: "policy",
      signals: ["policy.review_required"],
      timestamp: "2026-05-24T00:00:01.000Z",
    }],
    signals: ["quality.low"],
    learnedActions: ["tighten-schema"],
    createdAt: "2026-05-24T00:00:01.000Z",
  };
  const decision: HarnessDecision = {
    decisionId: "decision-1",
    action: "replan",
    reasonCodes: ["quality.low"],
    confidence: 0.8,
    createdAt: "2026-05-24T00:00:02.000Z",
  };
  const loopInput: HarnessLoopInput = {
    taskId: "task-1",
    domainId: "coding",
    constraintPack: createConstraintPack(),
    iteration: 1,
    requestedTools: ["read"],
    requiresHuman: false,
  };
  const step: HarnessStep = {
    stepId: "step-1",
    role: "planner",
    stage: "plan",
    iteration: 1,
    semanticPhase: "plan",
    inputs: { taskId: "task-1" },
    outputs: { ok: true },
    startedAt: "2026-05-24T00:00:00.000Z",
    completedAt: "2026-05-24T00:00:01.000Z",
  };
  const event: HarnessTimelineEvent = {
    eventId: "event-1",
    runId: "run-1",
    type: "step_completed",
    payload: { stepId: "step-1" },
    recordedAt: "2026-05-24T00:00:01.000Z",
  };
  const planBundle: PlanBundle = {
    planId: "plan-1",
    summary: "single step",
    checkpoints: ["checkpoint-1"],
    policyIds: ["policy.default"],
  };
  const checkpoint: RecoveryCheckpoint = {
    checkpointId: "checkpoint-1",
    runId: "run-1",
    lastCompletedStepId: "step-1",
    statusBeforeRecovery: "running",
    createdAt: "2026-05-24T00:00:01.000Z",
  };
  const workProduct: WorkProduct = {
    artifactRefs: ["artifact:1"],
    output: { summary: "done" },
    promptLineage: ["prompt:v1"],
  };
  const sleepLease: WorkflowSleepLease = {
    leaseId: "lease-1",
    runId: "run-1",
    reason: "awaiting_review",
    resumeAt: "2026-05-24T01:00:00.000Z",
    createdAt: "2026-05-24T00:00:01.000Z",
    retryAttempt: 1,
  };
  const report: EvaluationReport = {
    verdict: "accept",
    score: 0.95,
    evidenceRefs: ["artifact:1"],
    notes: "passed",
  };

  assert.equal(context.runId, "run-1");
  assert.equal(feedback.stepSignals[0]?.role, "evaluator");
  assert.equal(decision.action, "replan");
  assert.equal(loopInput.constraintPack.tool_policy.allowedTools[0], "read");
  assert.equal(step.semanticPhase, "plan");
  assert.equal(event.type, "step_completed");
  assert.equal(planBundle.checkpoints[0], "checkpoint-1");
  assert.equal(checkpoint.lastCompletedStepId, "step-1");
  assert.equal(workProduct.artifactRefs[0], "artifact:1");
  assert.equal(sleepLease.retryAttempt, 1);
  assert.equal(report.verdict, "accept");
});
