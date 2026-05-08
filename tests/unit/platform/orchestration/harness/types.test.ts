import test from "node:test";
import assert from "node:assert/strict";
import type {
  ConstraintPack,
  ContextSnapshot,
  EvaluationReport,
  FeedbackEnvelope,
  HarnessDecision,
  HarnessLoopInput,
  HarnessRun,
  HarnessStep,
  PlanBundle,
  RecoveryCheckpoint,
  WorkProduct,
  WorkflowSleepLease,
} from "../../../../../src/platform/orchestration/harness/types/index.js";

test("types/index.ts exports ConstraintPack", () => {
  const pack: ConstraintPack = {
    policyIds: ["policy-1"],
    approvalMode: "none",
    autonomyMode: "auto",
    toolPolicy: { allowedTools: ["tool-a"] },
    risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budget: { maxSteps: 100, maxCost: 1000, maxDurationMs: 60000 },
  };
  assert.equal(pack.policyIds.length, 1);
});

test("types/index.ts exports EvaluationReport", () => {
  const report: EvaluationReport = {
    verdict: "accept",
    score: 0.85,
    evidenceRefs: ["evidence-1"],
    notes: "Test notes",
  };
  assert.equal(report.verdict, "accept");
  assert.equal(report.score, 0.85);
});

test("types/index.ts exports FeedbackEnvelope", () => {
  const envelope: FeedbackEnvelope = {
    feedbackId: "feedback-123",
    signals: ["signal-1", "signal-2"],
    learnedActions: ["action-1"],
    createdAt: "2026-04-23T00:00:00Z",
  };
  assert.equal(envelope.feedbackId, "feedback-123");
  assert.equal(envelope.signals.length, 2);
  assert.equal(envelope.learnedActions.length, 1);
});

test("types/index.ts exports HarnessDecision", () => {
  const decision: HarnessDecision = {
    decisionId: "decision-123",
    action: "accept",
    reasonCodes: ["code-1", "code-2"],
    confidence: 0.9,
    createdAt: "2026-04-23T00:00:00Z",
  };
  assert.equal(decision.decisionId, "decision-123");
  assert.equal(decision.action, "accept");
  assert.ok(typeof decision.confidence === "number");
});

test("types/index.ts exports HarnessStep", () => {
  const step: HarnessStep = {
    stepId: "step-123",
    role: "planner",
    stage: "plan",
    iteration: 1,
    semanticPhase: "plan",
    inputs: { taskId: "task-1" },
    outputs: { plan: "test-plan" },
    startedAt: "2026-04-23T00:00:00Z",
    completedAt: "2026-04-23T00:00:01Z",
  };
  assert.equal(step.stepId, "step-123");
  assert.equal(step.role, "planner");
});

test("types/index.ts exports ContextSnapshot", () => {
  const snapshot: ContextSnapshot = {
    snapshotId: "snapshot-123",
    runId: "run-456",
    domainId: "domain-789",
    iteration: 1,
    stepCount: 5,
    lastDecisionId: "decision-001",
    capturedAt: "2026-04-23T00:00:00Z",
  };
  assert.equal(snapshot.snapshotId, "snapshot-123");
  assert.equal(snapshot.iteration, 1);
});

test("types/index.ts exports HarnessRun", () => {
  const run: HarnessRun = {
    runId: "run-123",
    taskId: "task-456",
    domainId: "domain-789",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 100, maxCost: 1000, maxDurationMs: 60000 },
    },
    steps: [],
    maxIterations: 100,
    currentIteration: 0,
    status: "created",
    createdAt: "2026-04-23T00:00:00Z",
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
  assert.equal(run.runId, "run-123");
  assert.ok(Array.isArray(run.steps));
});

test("types/index.ts exports PlanBundle", () => {
  const bundle: PlanBundle = {
    planId: "plan-123",
    summary: "Test plan summary",
    checkpoints: ["step-1", "step-2"],
    policyIds: ["policy-a"],
  };
  assert.equal(bundle.planId, "plan-123");
  assert.equal(bundle.checkpoints.length, 2);
});

test("types/index.ts exports WorkProduct", () => {
  const product: WorkProduct = {
    artifactRefs: ["artifact-1", "artifact-2"],
    output: { result: "success" },
    promptLineage: ["prompt-1"],
  };
  assert.equal(product.artifactRefs.length, 2);
  assert.ok(typeof product.output === "object");
});

test("types/index.ts exports RecoveryCheckpoint", () => {
  const checkpoint: RecoveryCheckpoint = {
    checkpointId: "checkpoint-123",
    runId: "run-456",
    lastCompletedStepId: "step-001",
    statusBeforeRecovery: "running",
    createdAt: "2026-04-23T00:00:00Z",
  };
  assert.equal(checkpoint.checkpointId, "checkpoint-123");
  assert.equal(checkpoint.statusBeforeRecovery, "running");
});

test("types/index.ts exports WorkflowSleepLease", () => {
  const lease: WorkflowSleepLease = {
    leaseId: "lease-123",
    runId: "run-456",
    reason: "Rate limit",
    resumeAt: "2026-04-23T00:01:00Z",
    createdAt: "2026-04-23T00:00:00Z",
  };
  assert.equal(lease.leaseId, "lease-123");
  assert.ok(typeof lease.resumeAt === "string");
});

test("types/index.ts exports HarnessLoopInput", () => {
  const input: HarnessLoopInput = {
    taskId: "task-123",
    domainId: "domain-456",
    constraintPack: {
      policyIds: [],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: [] },
      risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 100, maxCost: 1000, maxDurationMs: 60000 },
    },
    plannerOutput: { plan: "test" },
    generatorOutput: { result: "generated" },
    evaluatorOutput: { score: 0.85 },
    evaluatorScore: 0.85,
  };
  assert.equal(input.taskId, "task-123");
  assert.ok(typeof input.plannerOutput === "object");
});