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
} from "../../../../../src/platform/orchestration/harness/index.js";

test("ConstraintPack type is valid", () => {
  const pack: ConstraintPack = {
    policyIds: ["policy-1"],
    approvalMode: "required",
    autonomyMode: "supervised",
    toolPolicy: { allowedTools: ["tool-a", "tool-b"] },
    risk_policy: { maxRiskScore: 10, escalationThreshold: 8 },
    output_policy: { requiredEvidence: ["evidence-1"], redactSensitiveData: true },
    budget: { maxSteps: 50, maxCost: 500, maxDurationMs: 30000 },
  };

  assert.equal(pack.policyIds.length, 1);
  assert.equal(pack.approvalMode, "required");
  assert.equal(pack.autonomyMode, "supervised");
  assert.ok(Array.isArray(pack.toolPolicy.allowedTools));
  assert.ok(typeof pack.risk_policy.maxRiskScore === "number");
  assert.ok(typeof pack.output_policy.requiredEvidence === "object");
  assert.equal(pack.budget.maxSteps, 50);
});

test("PlanBundle type is valid", () => {
  const bundle: PlanBundle = {
    planId: "plan-123",
    summary: "Test plan summary",
    checkpoints: ["step-1", "step-2"],
    policyIds: ["policy-a"],
  };

  assert.equal(bundle.planId, "plan-123");
  assert.equal(bundle.summary, "Test plan summary");
  assert.equal(bundle.checkpoints.length, 2);
  assert.equal(bundle.policyIds.length, 1);
});

test("WorkProduct type is valid", () => {
  const product: WorkProduct = {
    artifactRefs: ["artifact-1", "artifact-2"],
    output: { result: "success", data: { key: "value" } },
    promptLineage: ["prompt-1", "prompt-2"],
  };

  assert.equal(product.artifactRefs.length, 2);
  assert.deepEqual(product.output, { result: "success", data: { key: "value" } });
  assert.equal(product.promptLineage.length, 2);
});

test("EvaluationReport type is valid", () => {
  const report: EvaluationReport = {
    verdict: "accept",
    score: 0.85,
    evidenceRefs: ["evidence-1"],
    notes: "Test notes",
  };

  assert.equal(report.verdict, "accept");
  assert.equal(report.score, 0.85);
  assert.equal(report.evidenceRefs.length, 1);
  assert.equal(report.notes, "Test notes");
});

test("FeedbackEnvelope type is valid", () => {
  const envelope: FeedbackEnvelope = {
    feedbackId: "feedback-123",
    signals: ["signal-1", "signal-2"],
    learnedActions: ["action-1"],
    createdAt: "2026-04-23T00:00:00Z",
  };

  assert.equal(envelope.feedbackId, "feedback-123");
  assert.equal(envelope.signals.length, 2);
  assert.equal(envelope.learnedActions.length, 1);
  assert.ok(envelope.createdAt !== undefined);
});

test("ContextSnapshot type is valid", () => {
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
  assert.equal(snapshot.runId, "run-456");
  assert.equal(snapshot.iteration, 1);
  assert.equal(snapshot.stepCount, 5);
});

test("RecoveryCheckpoint type is valid", () => {
  const checkpoint: RecoveryCheckpoint = {
    checkpointId: "checkpoint-123",
    runId: "run-456",
    lastCompletedStepId: "step-001",
    statusBeforeRecovery: "running",
    createdAt: "2026-04-23T00:00:00Z",
  };

  assert.equal(checkpoint.checkpointId, "checkpoint-123");
  assert.equal(checkpoint.runId, "run-456");
  assert.equal(checkpoint.lastCompletedStepId, "step-001");
  assert.equal(checkpoint.statusBeforeRecovery, "running");
});

test("HarnessDecision type is valid", () => {
  const decision: HarnessDecision = {
    decisionId: "decision-123",
    action: "accept",
    reasonCodes: ["code-1", "code-2"],
    confidence: 0.9,
    createdAt: "2026-04-23T00:00:00Z",
  };

  assert.equal(decision.decisionId, "decision-123");
  assert.equal(decision.action, "accept");
  assert.equal(decision.reasonCodes.length, 2);
  assert.ok(typeof decision.confidence === "number");
});

test("HarnessStep type is valid", () => {
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
  assert.equal(step.stage, "plan");
  assert.ok(typeof step.inputs === "object");
  assert.ok(typeof step.outputs === "object");
});

test("HarnessLoopInput type is valid", () => {
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
  assert.ok(typeof input.generatorOutput === "object");
  assert.ok(typeof input.evaluatorOutput === "object");
  assert.ok(typeof input.evaluatorScore === "number");
});

test("HarnessRun type is valid", () => {
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
  assert.equal(run.taskId, "task-456");
  assert.equal(run.status, "created");
  assert.ok(Array.isArray(run.steps));
  assert.ok(Array.isArray(run.timeline));
});
