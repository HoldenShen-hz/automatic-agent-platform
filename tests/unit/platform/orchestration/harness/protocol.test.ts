import test from "node:test";
import assert from "node:assert/strict";

// protocol/index.ts exports types, not constants
import type {
  ContextSnapshot,
  EvaluationReport,
  FeedbackEnvelope,
  HarnessDecision,
  HarnessDecisionAction,
  HarnessLoopInput,
  HarnessRole,
  HarnessRun,
  HarnessRunStatus,
  HarnessStep,
  HarnessTimelineEvent,
  PlanBundle,
  RecoveryCheckpoint,
  WorkProduct,
  WorkflowSleepLease,
} from "../../../../../src/platform/five-plane-orchestration/harness/protocol/index.js";

test("protocol exports HarnessDecisionAction type", () => {
  const action: HarnessDecisionAction = "accept";
  assert.equal(action, "accept");
});

test("protocol exports HarnessRole type", () => {
  const role: HarnessRole = "evaluator";
  assert.equal(role, "evaluator");
});

test("protocol exports HarnessRunStatus type", () => {
  const status: HarnessRunStatus = "created";
  assert.equal(status, "created");
});

test("protocol exports FeedbackEnvelope type", () => {
  const envelope: FeedbackEnvelope = {
    feedbackId: "test-123",
    signals: ["signal-1"],
    learnedActions: [],
    createdAt: "2026-04-23T00:00:00Z",
  };
  assert.equal(envelope.feedbackId, "test-123");
  assert.ok(Array.isArray(envelope.signals));
});

test("protocol exports HarnessDecision type", () => {
  const decision: HarnessDecision = {
    decisionId: "dec-1",
    action: "accept",
    reasonCodes: ["code-1"],
    confidence: 0.85,
    createdAt: "2026-04-23T00:00:00Z",
  };
  assert.equal(decision.action, "accept");
});

test("protocol exports HarnessStep type", () => {
  const step: HarnessStep = {
    stepId: "step-1",
    role: "planner",
    stage: "plan",
    iteration: 1,
    semanticPhase: "plan",
    inputs: {},
    outputs: {},
    startedAt: "2026-04-23T00:00:00Z",
    completedAt: "2026-04-23T00:00:01Z",
  };
  assert.equal(step.role, "planner");
});

test("protocol exports ContextSnapshot type", () => {
  const snapshot: ContextSnapshot = {
    snapshotId: "snap-1",
    runId: "run-1",
    domainId: "domain-1",
    iteration: 1,
    stepCount: 5,
    lastDecisionId: null,
    capturedAt: "2026-04-23T00:00:00Z",
  };
  assert.equal(snapshot.iteration, 1);
});

test("protocol exports RecoveryCheckpoint type", () => {
  const checkpoint: RecoveryCheckpoint = {
    checkpointId: "cp-1",
    runId: "run-1",
    lastCompletedStepId: null,
    statusBeforeRecovery: "running",
    createdAt: "2026-04-23T00:00:00Z",
  };
  assert.equal(checkpoint.statusBeforeRecovery, "running");
});

test("protocol exports WorkflowSleepLease type", () => {
  const lease: WorkflowSleepLease = {
    leaseId: "lease-1",
    runId: "run-1",
    reason: "test",
    resumeAt: "2026-04-23T00:01:00Z",
    createdAt: "2026-04-23T00:00:00Z",
  };
  assert.equal(lease.leaseId, "lease-1");
});

test("protocol exports HarnessTimelineEvent type", () => {
  const event: HarnessTimelineEvent = {
    eventId: "event-1",
    runId: "run-1",
    type: "run_created",
    payload: {},
    recordedAt: "2026-04-23T00:00:00Z",
  };
  assert.equal(event.type, "run_created");
});

test("protocol exports HarnessLoopInput type", () => {
  const input: HarnessLoopInput = {
    taskId: "task-1",
    domainId: "domain-1",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 100, maxCost: 1000, maxDurationMs: 60000 },
    },
    plannerOutput: {},
    generatorOutput: {},
    evaluatorOutput: {},
    evaluatorScore: 0.85,
  };
  assert.equal(input.taskId, "task-1");
});

test("protocol exports PlanBundle type", () => {
  const bundle: PlanBundle = {
    planId: "plan-1",
    summary: "Test plan",
    checkpoints: ["step-1"],
    policyIds: [],
  };
  assert.equal(bundle.planId, "plan-1");
});

test("protocol exports WorkProduct type", () => {
  const product: WorkProduct = {
    artifactRefs: ["artifact-1"],
    output: { result: "ok" },
    promptLineage: [],
  };
  assert.ok(Array.isArray(product.artifactRefs));
});

test("protocol exports EvaluationReport type", () => {
  const report: EvaluationReport = {
    verdict: "accept",
    score: 0.9,
    evidenceRefs: [],
  };
  assert.equal(report.verdict, "accept");
});