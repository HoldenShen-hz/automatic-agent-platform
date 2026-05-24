import assert from "node:assert/strict";
import test from "node:test";

import type {
  ContextSnapshot,
  EvaluationReport,
  FeedbackEnvelope,
  HarnessDecision,
  HarnessDecisionAction,
  HarnessLoopInput,
  HarnessRole,
  HarnessRunStatus,
  HarnessStep,
  HarnessTimelineEvent,
  PlanBundle,
  RecoveryCheckpoint,
  WorkProduct,
  WorkflowSleepLease,
} from "../../../../../src/platform/five-plane-orchestration/harness/protocol/index.js";
import type { ConstraintPack } from "../../../../../src/platform/five-plane-orchestration/harness/index.js";

function createConstraintPack(): ConstraintPack {
  return {
    policyIds: ["policy.default"],
    approvalMode: "none",
    autonomyMode: "supervised",
    tool_policy: { allowedTools: ["read"] },
    risk_policy: { maxRiskScore: 0.8, escalationThreshold: 0.6 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budgetEnvelope: { maxSteps: 10, maxCost: 5, maxDurationMs: 60_000 },
    sandboxRequirement: { sandboxMode: "ephemeral", timeoutMs: 1_000 },
    approvalRequirement: {
      requiredForRiskClass: ["critical"],
      approverRoles: ["operator"],
      escalationTimeoutMs: 30_000,
    },
  };
}

test("protocol exports current feedback, lease, and loop input shapes", () => {
  const envelope: FeedbackEnvelope = {
    feedbackId: "feedback-1",
    stepSignals: [{ stepId: "step-1", role: "planner", signals: ["ok"], timestamp: "2026-04-23T00:00:00.000Z" }],
    taskSignals: [{ taskId: "task-1", iteration: 1, signals: ["stable"], timestamp: "2026-04-23T00:00:00.000Z" }],
    workflowSignals: [{ phase: "plan", signals: ["entered"], timestamp: "2026-04-23T00:00:00.000Z" }],
    systemSignals: [{ category: "policy", signals: ["clean"], timestamp: "2026-04-23T00:00:00.000Z" }],
    signals: ["ok"],
    learnedActions: ["tighten_generator"],
    createdAt: "2026-04-23T00:00:00.000Z",
  };
  const lease: WorkflowSleepLease = {
    leaseId: "lease-1",
    runId: "run-1",
    reason: "retry",
    resumeAt: "2026-04-23T00:01:00.000Z",
    createdAt: "2026-04-23T00:00:00.000Z",
    retryAttempt: 2,
  };
  const input: HarnessLoopInput = {
    taskId: "task-1",
    domainId: "domain-1",
    constraintPack: createConstraintPack(),
    plannerOutput: { outline: "draft" },
    generatorOutput: { draft: "body" },
    evaluatorOutput: { score: 0.9 },
    evaluatorScore: 0.9,
  };

  assert.equal(envelope.systemSignals[0]?.category, "policy");
  assert.equal(lease.retryAttempt, 2);
  assert.equal(input.constraintPack.autonomyMode, "supervised");
});

test("protocol exports current decision, step, status, and role unions", () => {
  const action: HarnessDecisionAction = "replan";
  const role: HarnessRole = "release_manager";
  const status: HarnessRunStatus = "cancelled";
  const decision: HarnessDecision = {
    decisionId: "decision-1",
    action,
    reasonCodes: ["reason-1"],
    confidence: 0.9,
    createdAt: "2026-04-23T00:00:00.000Z",
  };
  const step: HarnessStep = {
    stepId: "step-1",
    role,
    stage: "release",
    iteration: 1,
    semanticPhase: "release",
    inputs: {},
    outputs: {},
    startedAt: "2026-04-23T00:00:00.000Z",
    completedAt: "2026-04-23T00:00:01.000Z",
  };

  assert.equal(decision.action, "replan");
  assert.equal(step.role, "release_manager");
  assert.equal(status, "cancelled");
});

test("protocol exports supporting snapshot, checkpoint, timeline, and report shapes", () => {
  const snapshot: ContextSnapshot = {
    snapshotId: "snapshot-1",
    runId: "run-1",
    domainId: "domain-1",
    iteration: 2,
    stepCount: 3,
    lastDecisionId: "decision-1",
    capturedAt: "2026-04-23T00:00:00.000Z",
  };
  const checkpoint: RecoveryCheckpoint = {
    checkpointId: "checkpoint-1",
    runId: "run-1",
    lastCompletedStepId: "step-1",
    statusBeforeRecovery: "running",
    createdAt: "2026-04-23T00:00:00.000Z",
  };
  const timelineEvent: HarnessTimelineEvent = {
    eventId: "event-1",
    runId: "run-1",
    type: "decision_recorded",
    payload: { action: "accept" },
    recordedAt: "2026-04-23T00:00:00.000Z",
  };
  const bundle: PlanBundle = {
    planId: "plan-1",
    summary: "summary",
    checkpoints: ["checkpoint-1"],
    policyIds: ["policy.default"],
  };
  const product: WorkProduct = {
    artifactRefs: ["artifact-1"],
    output: { summary: "ok" },
    promptLineage: ["prompt-1"],
  };
  const report: EvaluationReport = {
    verdict: "accept",
    score: 0.95,
    evidenceRefs: ["artifact-1"],
  };

  assert.equal(snapshot.lastDecisionId, "decision-1");
  assert.equal(checkpoint.statusBeforeRecovery, "running");
  assert.equal(timelineEvent.type, "decision_recorded");
  assert.equal(bundle.checkpoints.length, 1);
  assert.equal(product.promptLineage[0], "prompt-1");
  assert.equal(report.verdict, "accept");
});
