/**
 * Unit tests for FeedbackEnvelope and related types
 *
 * @see src/platform/orchestration/harness/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import type {
  FeedbackEnvelope,
  HarnessTimelineEvent,
  HarnessStep,
  HarnessDecision,
  HarnessRun,
  ConstraintPack,
} from "../../../../../src/platform/orchestration/harness/index.js";

function createMockConstraintPack(overrides: Partial<ConstraintPack> = {}): ConstraintPack {
  return {
    policyIds: ["policy_1", "policy_2"],
    approvalMode: "none",
    autonomyMode: "auto",
    toolPolicy: {
      allowedTools: ["tool_a", "tool_b"],
    },
    risk_policy: {
      maxRiskScore: 80,
      escalationThreshold: 60,
    },
    output_policy: {
      requiredEvidence: ["evidence_1"],
      redactSensitiveData: true,
    },
    budget: {
      maxSteps: 10,
      maxCost: 100,
      maxDurationMs: 60000,
    },
    ...overrides,
  };
}

function createMockFeedbackEnvelope(overrides: Partial<FeedbackEnvelope> = {}): FeedbackEnvelope {
  return {
    feedbackId: "feedback_test_1",
    signals: ["signal_1", "signal_2"],
    learnedActions: ["learned_action_1"],
    createdAt: "2026-04-26T00:00:00.000Z",
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// FeedbackEnvelope Tests
// ─────────────────────────────────────────────────────────────────────────────

test("FeedbackEnvelope has all required fields", () => {
  const envelope = createMockFeedbackEnvelope();

  assert.equal(typeof envelope.feedbackId, "string");
  assert.ok(Array.isArray(envelope.signals));
  assert.ok(Array.isArray(envelope.learnedActions));
  assert.equal(typeof envelope.createdAt, "string");
});

test("FeedbackEnvelope with empty signals", () => {
  const envelope = createMockFeedbackEnvelope({
    signals: [],
  });

  assert.ok(Array.isArray(envelope.signals));
  assert.equal(envelope.signals.length, 0);
});

test("FeedbackEnvelope with empty learnedActions", () => {
  const envelope = createMockFeedbackEnvelope({
    learnedActions: [],
  });

  assert.ok(Array.isArray(envelope.learnedActions));
  assert.equal(envelope.learnedActions.length, 0);
});

test("FeedbackEnvelope with many signals", () => {
  const envelope = createMockFeedbackEnvelope({
    signals: ["signal_1", "signal_2", "signal_3", "signal_4", "signal_5"],
    learnedActions: ["action_1", "action_2"],
  });

  assert.equal(envelope.signals.length, 5);
  assert.equal(envelope.learnedActions.length, 2);
});

test("FeedbackEnvelope can have no learned actions", () => {
  const envelope = createMockFeedbackEnvelope({
    learnedActions: [],
  });

  assert.equal(envelope.learnedActions.length, 0);
});

test("FeedbackEnvelope createdAt is ISO timestamp", () => {
  const now = new Date().toISOString();
  const envelope = createMockFeedbackEnvelope({
    createdAt: now,
  });

  assert.equal(envelope.createdAt, now);
});

test("FeedbackEnvelope feedbackId is unique", () => {
  const envelope1 = createMockFeedbackEnvelope({ feedbackId: "feedback_1" });
  const envelope2 = createMockFeedbackEnvelope({ feedbackId: "feedback_2" });

  assert.notEqual(envelope1.feedbackId, envelope2.feedbackId);
});

// ─────────────────────────────────────────────────────────────────────────────
// HarnessTimelineEvent Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HarnessTimelineEvent with run_created type", () => {
  const event: HarnessTimelineEvent = {
    eventId: "event_1",
    runId: "run_1",
    type: "run_created",
    payload: { taskId: "task_1" },
    recordedAt: "2026-04-26T00:00:00.000Z",
  };

  assert.equal(event.type, "run_created");
  assert.equal(event.eventId, "event_1");
  assert.equal(typeof event.payload, "object");
});

test("HarnessTimelineEvent with step_completed type", () => {
  const event: HarnessTimelineEvent = {
    eventId: "event_2",
    runId: "run_1",
    type: "step_completed",
    payload: { stepId: "step_1", role: "planner" },
    recordedAt: "2026-04-26T00:00:01.000Z",
  };

  assert.equal(event.type, "step_completed");
});

test("HarnessTimelineEvent with guardrails_evaluated type", () => {
  const event: HarnessTimelineEvent = {
    eventId: "event_3",
    runId: "run_1",
    type: "guardrails_evaluated",
    payload: { passed: true, requiresHuman: false },
    recordedAt: "2026-04-26T00:00:02.000Z",
  };

  assert.equal(event.type, "guardrails_evaluated");
  assert.ok(event.payload.passed === true);
});

test("HarnessTimelineEvent with decision_recorded type", () => {
  const event: HarnessTimelineEvent = {
    eventId: "event_4",
    runId: "run_1",
    type: "decision_recorded",
    payload: { action: "accept", confidence: 0.95 },
    recordedAt: "2026-04-26T00:00:03.000Z",
  };

  assert.equal(event.type, "decision_recorded");
  assert.equal(event.payload.action, "accept");
});

test("HarnessTimelineEvent with sleep_started type", () => {
  const event: HarnessTimelineEvent = {
    eventId: "event_5",
    runId: "run_1",
    type: "sleep_started",
    payload: { reason: "rate_limit", resumeAt: "2026-04-26T00:01:00.000Z" },
    recordedAt: "2026-04-26T00:00:04.000Z",
  };

  assert.equal(event.type, "sleep_started");
  assert.equal(event.payload.reason, "rate_limit");
});

test("HarnessTimelineEvent with recovery_started type", () => {
  const event: HarnessTimelineEvent = {
    eventId: "event_6",
    runId: "run_1",
    type: "recovery_started",
    payload: { statusBeforeRecovery: "running" },
    recordedAt: "2026-04-26T00:00:05.000Z",
  };

  assert.equal(event.type, "recovery_started");
});

test("HarnessTimelineEvent with hitl_requested type", () => {
  const event: HarnessTimelineEvent = {
    eventId: "event_7",
    runId: "run_1",
    type: "hitl_requested",
    payload: { reason: "human_required", evidenceCount: 3 },
    recordedAt: "2026-04-26T00:00:06.000Z",
  };

  assert.equal(event.type, "hitl_requested");
});

test("HarnessTimelineEvent with hitl_resolved type", () => {
  const event: HarnessTimelineEvent = {
    eventId: "event_8",
    runId: "run_1",
    type: "hitl_resolved",
    payload: { resolution: "approved", actorId: "human_1" },
    recordedAt: "2026-04-26T00:00:07.000Z",
  };

  assert.equal(event.type, "hitl_resolved");
  assert.equal(event.payload.resolution, "approved");
});

test("HarnessTimelineEvent can have empty payload", () => {
  const event: HarnessTimelineEvent = {
    eventId: "event_9",
    runId: "run_1",
    type: "run_created",
    payload: {},
    recordedAt: "2026-04-26T00:00:08.000Z",
  };

  assert.ok(event.payload !== null);
  assert.equal(Object.keys(event.payload).length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// HarnessStep Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HarnessStep has all required fields", () => {
  const step: HarnessStep = {
    stepId: "step_1",
    role: "planner",
    stage: "plan",
    iteration: 1,
    semanticPhase: "planning",
    inputs: { taskId: "task_1" },
    outputs: { plan: "test_plan" },
    startedAt: "2026-04-26T00:00:00.000Z",
    completedAt: "2026-04-26T00:00:01.000Z",
  };

  assert.equal(step.stepId, "step_1");
  assert.equal(step.role, "planner");
  assert.equal(step.stage, "plan");
  assert.equal(step.iteration, 1);
  assert.ok(typeof step.inputs === "object");
  assert.ok(typeof step.outputs === "object");
  assert.equal(typeof step.startedAt, "string");
  assert.equal(typeof step.completedAt, "string");
});

test("HarnessStep role can be generator", () => {
  const step: HarnessStep = {
    stepId: "step_2",
    role: "generator",
    stage: "execute",
    iteration: 1,
    semanticPhase: "execution",
    inputs: {},
    outputs: { result: "executed" },
    startedAt: "2026-04-26T00:00:00.000Z",
    completedAt: "2026-04-26T00:00:02.000Z",
  };

  assert.equal(step.role, "generator");
  assert.equal(step.stage, "execute");
});

test("HarnessStep role can be evaluator", () => {
  const step: HarnessStep = {
    stepId: "step_3",
    role: "evaluator",
    stage: "evaluate",
    iteration: 1,
    semanticPhase: "evaluation",
    inputs: {},
    outputs: { score: 0.85 },
    startedAt: "2026-04-26T00:00:00.000Z",
    completedAt: "2026-04-26T00:00:01.000Z",
  };

  assert.equal(step.role, "evaluator");
});

test("HarnessStep role can be hitl_operator", () => {
  const step: HarnessStep = {
    stepId: "step_4",
    role: "hitl_operator",
    stage: "review",
    iteration: 1,
    semanticPhase: "hitl",
    inputs: { requestId: "req_1" },
    outputs: { resolution: "approved" },
    startedAt: "2026-04-26T00:00:00.000Z",
    completedAt: "2026-04-26T00:00:03.000Z",
  };

  assert.equal(step.role, "hitl_operator");
});

test("HarnessStep role can be loop_controller", () => {
  const step: HarnessStep = {
    stepId: "step_5",
    role: "loop_controller",
    stage: "loop",
    iteration: 2,
    semanticPhase: "execution",
    inputs: {},
    outputs: { shouldContinue: true },
    startedAt: "2026-04-26T00:00:00.000Z",
    completedAt: "2026-04-26T00:00:01.000Z",
  };

  assert.equal(step.role, "loop_controller");
});

test("HarnessStep with empty inputs and outputs", () => {
  const step: HarnessStep = {
    stepId: "step_6",
    role: "planner",
    stage: "plan",
    iteration: 1,
    semanticPhase: "planning",
    inputs: {},
    outputs: {},
    startedAt: "2026-04-26T00:00:00.000Z",
    completedAt: "2026-04-26T00:00:01.000Z",
  };

  assert.ok(Object.keys(step.inputs).length === 0);
  assert.ok(Object.keys(step.outputs).length === 0);
});

test("HarnessStep with high iteration number", () => {
  const step: HarnessStep = {
    stepId: "step_7",
    role: "evaluator",
    stage: "evaluate",
    iteration: 100,
    semanticPhase: "evaluation",
    inputs: {},
    outputs: { score: 0.9 },
    startedAt: "2026-04-26T00:00:00.000Z",
    completedAt: "2026-04-26T00:00:01.000Z",
  };

  assert.equal(step.iteration, 100);
});

test("HarnessStep completedAt after startedAt", () => {
  const step: HarnessStep = {
    stepId: "step_8",
    role: "planner",
    stage: "plan",
    iteration: 1,
    semanticPhase: "planning",
    inputs: {},
    outputs: {},
    startedAt: "2026-04-26T00:00:00.000Z",
    completedAt: "2026-04-26T00:00:05.000Z",
  };

  assert.ok(new Date(step.completedAt) > new Date(step.startedAt));
});

// ─────────────────────────────────────────────────────────────────────────────
// HarnessDecision Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HarnessDecision with accept action", () => {
  const decision: HarnessDecision = {
    decisionId: "decision_1",
    action: "accept",
    reasonCodes: ["harness.accepted"],
    confidence: 0.95,
    createdAt: "2026-04-26T00:00:00.000Z",
  };

  assert.equal(decision.action, "accept");
  assert.ok(decision.confidence >= 0 && decision.confidence <= 1);
});

test("HarnessDecision with retry_same_plan action", () => {
  const decision: HarnessDecision = {
    decisionId: "decision_2",
    action: "retry_same_plan",
    reasonCodes: ["harness.eval_below_accept_threshold"],
    confidence: 0.65,
    createdAt: "2026-04-26T00:00:00.000Z",
  };

  assert.equal(decision.action, "retry_same_plan");
});

test("HarnessDecision with replan action", () => {
  const decision: HarnessDecision = {
    decisionId: "decision_3",
    action: "replan",
    reasonCodes: ["harness.eval_below_replan_threshold"],
    confidence: 0.4,
    createdAt: "2026-04-26T00:00:00.000Z",
  };

  assert.equal(decision.action, "replan");
});

test("HarnessDecision with escalate_to_human action", () => {
  const decision: HarnessDecision = {
    decisionId: "decision_4",
    action: "escalate_to_human",
    reasonCodes: ["harness.human_required"],
    confidence: 1.0,
    createdAt: "2026-04-26T00:00:00.000Z",
  };

  assert.equal(decision.action, "escalate_to_human");
});

test("HarnessDecision with downgrade_mode action", () => {
  const decision: HarnessDecision = {
    decisionId: "decision_5",
    action: "downgrade_mode",
    reasonCodes: ["harness.mode_downgrade"],
    confidence: 0.75,
    createdAt: "2026-04-26T00:00:00.000Z",
  };

  assert.equal(decision.action, "downgrade_mode");
});

test("HarnessDecision with abort action", () => {
  const decision: HarnessDecision = {
    decisionId: "decision_6",
    action: "abort",
    reasonCodes: ["harness.max_iterations_reached"],
    confidence: 0.5,
    createdAt: "2026-04-26T00:00:00.000Z",
  };

  assert.equal(decision.action, "abort");
});

test("HarnessDecision confidence is bounded 0-1", () => {
  const lowConfidence: HarnessDecision = {
    decisionId: "decision_7",
    action: "accept",
    reasonCodes: [],
    confidence: 0.0,
    createdAt: "2026-04-26T00:00:00.000Z",
  };

  const highConfidence: HarnessDecision = {
    decisionId: "decision_8",
    action: "accept",
    reasonCodes: [],
    confidence: 1.0,
    createdAt: "2026-04-26T00:00:00.000Z",
  };

  assert.equal(lowConfidence.confidence, 0);
  assert.equal(highConfidence.confidence, 1);
});

test("HarnessDecision with multiple reasonCodes", () => {
  const decision: HarnessDecision = {
    decisionId: "decision_9",
    action: "replan",
    reasonCodes: [
      "harness.eval_below_replan_threshold",
      "harness.guardrail.failed",
      "harness.risk.high",
    ],
    confidence: 0.3,
    createdAt: "2026-04-26T00:00:00.000Z",
  };

  assert.equal(decision.reasonCodes.length, 3);
});

test("HarnessDecision with empty reasonCodes", () => {
  const decision: HarnessDecision = {
    decisionId: "decision_10",
    action: "accept",
    reasonCodes: [],
    confidence: 0.9,
    createdAt: "2026-04-26T00:00:00.000Z",
  };

  assert.ok(Array.isArray(decision.reasonCodes));
  assert.equal(decision.reasonCodes.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// HarnessRun Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HarnessRun has all required fields with minimal data", () => {
  const run: HarnessRun = {
    runId: "run_1",
    taskId: "task_1",
    domainId: "domain_1",
    constraintPack: createMockConstraintPack(),
    steps: [],
    maxIterations: 10,
    currentIteration: 0,
    status: "created",
    createdAt: "2026-04-26T00:00:00.000Z",
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

  assert.equal(run.runId, "run_1");
  assert.equal(run.taskId, "task_1");
  assert.equal(run.status, "created");
  assert.equal(run.completedAt, null);
  assert.equal(run.decision, null);
});

test("HarnessRun with all optional fields populated", () => {
  const feedbackEnvelope = createMockFeedbackEnvelope();
  const decision: HarnessDecision = {
    decisionId: "decision_1",
    action: "accept",
    reasonCodes: ["harness.accepted"],
    confidence: 0.95,
    createdAt: "2026-04-26T00:00:00.000Z",
  };

  const run: HarnessRun = {
    runId: "run_2",
    taskId: "task_2",
    domainId: "domain_2",
    constraintPack: createMockConstraintPack(),
    steps: [],
    maxIterations: 10,
    currentIteration: 5,
    status: "completed",
    createdAt: "2026-04-26T00:00:00.000Z",
    completedAt: "2026-04-26T00:05:00.000Z",
    decision,
    contextSnapshots: [],
    sleepLease: null,
    recoveryCheckpoint: null,
    feedbackEnvelope,
    toolbelt: null,
    guardrailAssessment: null,
    hitlRequest: null,
    timeline: [],
    loopMetrics: {
      iterationCount: 5,
      replanCount: 0,
      totalCost: 25,
      durationMs: 300000,
      maxIterations: 10,
      maxCost: 100,
      maxDurationMs: 600000,
    },
  };

  assert.equal(run.status, "completed");
  assert.notEqual(run.completedAt, null);
  assert.notEqual(run.decision, null);
  assert.notEqual(run.feedbackEnvelope, null);
  assert.ok(run.loopMetrics !== undefined);
  assert.equal(run.loopMetrics?.iterationCount, 5);
});

test("HarnessRun with running status", () => {
  const run: HarnessRun = {
    runId: "run_3",
    taskId: "task_3",
    domainId: "domain_3",
    constraintPack: createMockConstraintPack(),
    steps: [],
    maxIterations: 10,
    currentIteration: 3,
    status: "running",
    createdAt: "2026-04-26T00:00:00.000Z",
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

  assert.equal(run.status, "running");
  assert.equal(run.completedAt, null);
});

test("HarnessRun with paused HITL status", () => {
  const run: HarnessRun = {
    runId: "run_4",
    taskId: "task_4",
    domainId: "domain_4",
    constraintPack: createMockConstraintPack(),
    steps: [],
    maxIterations: 10,
    currentIteration: 7,
    status: "paused",
    createdAt: "2026-04-26T00:00:00.000Z",
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

  assert.equal(run.status, "paused");
});

test("HarnessRun with paused sleep-lease status", () => {
  const run: HarnessRun = {
    runId: "run_5",
    taskId: "task_5",
    domainId: "domain_5",
    constraintPack: createMockConstraintPack(),
    steps: [],
    maxIterations: 10,
    currentIteration: 2,
    status: "paused",
    createdAt: "2026-04-26T00:00:00.000Z",
    completedAt: null,
    decision: null,
    contextSnapshots: [],
    sleepLease: {
      leaseId: "lease_1",
      runId: "run_5",
      reason: "rate_limit",
      resumeAt: "2026-04-26T00:01:00.000Z",
      createdAt: "2026-04-26T00:00:30.000Z",
    },
    recoveryCheckpoint: null,
    feedbackEnvelope: null,
    toolbelt: null,
    guardrailAssessment: null,
    hitlRequest: null,
    timeline: [],
  };

  assert.equal(run.status, "paused");
  assert.notEqual(run.sleepLease, null);
});

test("HarnessRun with replanning status", () => {
  const run: HarnessRun = {
    runId: "run_6",
    taskId: "task_6",
    domainId: "domain_6",
    constraintPack: createMockConstraintPack(),
    steps: [],
    maxIterations: 10,
    currentIteration: 4,
    status: "replanning",
    createdAt: "2026-04-26T00:00:00.000Z",
    completedAt: null,
    decision: null,
    contextSnapshots: [],
    sleepLease: null,
    recoveryCheckpoint: {
      checkpointId: "checkpoint_1",
      runId: "run_6",
      lastCompletedStepId: "step_3",
      statusBeforeRecovery: "running",
      createdAt: "2026-04-26T00:02:00.000Z",
    },
    feedbackEnvelope: null,
    toolbelt: null,
    guardrailAssessment: null,
    hitlRequest: null,
    timeline: [],
  };

  assert.equal(run.status, "replanning");
  assert.notEqual(run.recoveryCheckpoint, null);
});

test("HarnessRun with aborted status", () => {
  const run: HarnessRun = {
    runId: "run_7",
    taskId: "task_7",
    domainId: "domain_7",
    constraintPack: createMockConstraintPack(),
    steps: [],
    maxIterations: 10,
    currentIteration: 10,
    status: "aborted",
    createdAt: "2026-04-26T00:00:00.000Z",
    completedAt: "2026-04-26T00:10:00.000Z",
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

  assert.equal(run.status, "aborted");
  assert.notEqual(run.completedAt, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("FeedbackEnvelope with very long signal strings", () => {
  const longSignal = "a".repeat(1000);
  const envelope = createMockFeedbackEnvelope({
    signals: [longSignal],
  });

  assert.ok(envelope.signals[0]!.length === 1000);
});

test("HarnessDecision confidence with decimal precision", () => {
  const decision: HarnessDecision = {
    decisionId: "decision_11",
    action: "accept",
    reasonCodes: [],
    confidence: 0.8765,
    createdAt: "2026-04-26T00:00:00.000Z",
  };

  assert.equal(decision.confidence, 0.8765);
});

test("HarnessRun with zero maxIterations", () => {
  const run: HarnessRun = {
    runId: "run_8",
    taskId: "task_8",
    domainId: "domain_8",
    constraintPack: createMockConstraintPack({ budget: { maxSteps: 0, maxCost: 0, maxDurationMs: 0 } }),
    steps: [],
    maxIterations: 0,
    currentIteration: 0,
    status: "created",
    createdAt: "2026-04-26T00:00:00.000Z",
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

  assert.equal(run.maxIterations, 0);
});

test("ConstraintPack with empty policyIds", () => {
  const constraintPack = createMockConstraintPack({
    policyIds: [],
  });

  assert.ok(Array.isArray(constraintPack.policyIds));
  assert.equal(constraintPack.policyIds.length, 0);
});

test("ConstraintPack with zero maxRiskScore", () => {
  const constraintPack = createMockConstraintPack({
    risk_policy: {
      maxRiskScore: 0,
      escalationThreshold: 50,
    },
  });

  assert.equal(constraintPack.risk_policy.maxRiskScore, 0);
});
