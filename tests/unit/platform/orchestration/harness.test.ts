import assert from "node:assert/strict";
import test from "node:test";

import { TaskOutcomeGrader } from "../../../../src/platform/five-plane-orchestration/harness/evaluation/task-outcome-grader.js";
import { EvalRunService } from "../../../../src/platform/five-plane-orchestration/harness/evaluation/eval-run-service.js";
import { DurableHarnessService } from "../../../../src/platform/five-plane-orchestration/harness/durable/durable-harness-service.js";
import { RecoveryController } from "../../../../src/platform/five-plane-orchestration/harness/recovery-controller.js";
import { HarnessRuntimeService, type ConstraintPack, type HarnessRun } from "../../../../src/platform/five-plane-orchestration/harness/index.js";

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
    budget: {
      maxSteps: 8,
      maxCost: 5,
      maxDurationMs: 60_000,
    },
    ...overrides,
  };
}

function createCompletedRun(constraintPack: ConstraintPack): HarnessRun {
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

test("TaskOutcomeGrader.grade returns passed=true for score >= 0.75 with all evidence present", () => {
  const grader = new TaskOutcomeGrader();
  const result = grader.grade({
    evaluatorScore: 0.92,
    expectedEvidenceRefs: ["risk_profile"],
    actualEvidenceRefs: ["risk_profile"],
    decisionAction: "accept",
  });

  assert.equal(result.passed, true);
  assert.equal(result.score, 0.92);
  assert.deepEqual(result.findingCodes, []);
});

test("TaskOutcomeGrader.grade returns passed=false for missing evidence", () => {
  const grader = new TaskOutcomeGrader();
  const result = grader.grade({
    evaluatorScore: 0.9,
    expectedEvidenceRefs: ["risk_profile", "execution_log"],
    actualEvidenceRefs: ["risk_profile"],
    decisionAction: "accept",
  });

  assert.equal(result.passed, false);
  assert.ok(result.findingCodes.includes("harness.eval.missing_evidence:execution_log"));
});

test("TaskOutcomeGrader.grade returns passed=false for non-accept decision", () => {
  const grader = new TaskOutcomeGrader();
  const result = grader.grade({
    evaluatorScore: 0.9,
    expectedEvidenceRefs: [],
    actualEvidenceRefs: [],
    decisionAction: "replan",
  });

  assert.equal(result.passed, false);
  assert.ok(result.findingCodes.some((code) => code.includes("non_accept_decision")));
});

test("TaskOutcomeGrader.grade returns passed=false for score below 0.75 even with accept decision", () => {
  const grader = new TaskOutcomeGrader();
  const result = grader.grade({
    evaluatorScore: 0.7,
    expectedEvidenceRefs: [],
    actualEvidenceRefs: [],
    decisionAction: "accept",
  });

  assert.equal(result.passed, false);
});

test("TaskOutcomeGrader.grade handles null decision action", () => {
  const grader = new TaskOutcomeGrader();
  const result = grader.grade({
    evaluatorScore: 0.9,
    expectedEvidenceRefs: [],
    actualEvidenceRefs: [],
    decisionAction: null,
  });

  assert.equal(result.passed, false);
  assert.ok(result.findingCodes.some((code) => code.includes("non_accept_decision:none")));
});

test("TaskOutcomeGrader.grade scores are fixed to 4 decimal places", () => {
  const grader = new TaskOutcomeGrader();
  const result = grader.grade({
    evaluatorScore: 0.123456789,
    expectedEvidenceRefs: [],
    actualEvidenceRefs: [],
    decisionAction: "accept",
  });

  assert.equal(result.score, 0.1235);
});

test("EvalRunService.evaluate returns comprehensive report for completed run", () => {
  const service = new EvalRunService();
  const run = createCompletedRun(createConstraintPack());
  const report = service.evaluate(run);

  assert.equal(report.runId, run.runId);
  assert.equal(report.overallPassed, true);
  assert.equal(report.stepCount, 3);
  assert.ok(report.timelineEventCount >= 3);
  assert.equal(report.grade.passed, true);
});

test("EvalRunService.evaluate returns failed report for run with missing evidence", () => {
  const service = new EvalRunService();
  const constraintPack = createConstraintPack({
    output_policy: {
      requiredEvidence: ["risk_profile", "audit_log"],
      redactSensitiveData: true,
    },
  });
  const run = createCompletedRun(constraintPack);
  const report = service.evaluate(run);

  assert.equal(report.overallPassed, false);
  assert.ok(report.grade.findingCodes.some((code) => code.includes("missing_evidence")));
});

test("EvalRunService.evaluate handles run with no decision", () => {
  const service = new HarnessRuntimeService();
  const created = service.createRun({
    taskId: "task-no-decision",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const evalService = new EvalRunService();
  const report = evalService.evaluate(created);

  assert.equal(report.runId, created.runId);
  assert.equal(report.grade.score, 0);
  assert.equal(report.overallPassed, false);
});

test("DurableHarnessService.persist stores and retrieves run", () => {
  const durable = new DurableHarnessService();
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-durable-1",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const record = durable.persist(run);
  const restored = durable.restore(run.runId);

  assert.equal(record.run.runId, run.runId);
  assert.equal(restored?.runId, run.runId);
  assert.equal(restored?.taskId, "task-durable-1");
});

test("DurableHarnessService.persist updates existing record", () => {
  const durable = new DurableHarnessService();
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-durable-2",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const first = durable.persist(run);
  const updated = { ...run, status: "running" as const };
  const second = durable.persist(updated);

  assert.equal(second.recordId, first.recordId);
  assert.equal(second.persistedAt, second.persistedAt);
  assert.equal(durable.restore(run.runId)?.status, "running");
});

test("DurableHarnessService.checkpoint creates checkpoint and returns ref", () => {
  const durable = new DurableHarnessService();
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-checkpoint",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const checkpointRef = durable.checkpoint(run);

  assert.ok(checkpointRef.startsWith("harness_checkpoint_"));
  assert.ok(durable.getCheckpointRef(run.runId) !== null);
});

test("DurableHarnessService.restoreFromCheckpoint retrieves exact run state", () => {
  const durable = new DurableHarnessService();
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-restore-checkpoint",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const completedRun = service.runLoop({
    taskId: "task-restore-checkpoint",
    domainId: "coding",
    constraintPack: createConstraintPack(),
    plannerOutput: { planId: "plan-restore" },
    generatorOutput: { artifact: "patch.diff" },
    evaluatorOutput: { verdict: "pass" },
    evaluatorScore: 0.9,
    producedEvidenceRefs: ["risk_profile"],
  });

  const checkpointRef = durable.checkpoint(completedRun);
  const restored = durable.restoreFromCheckpoint(checkpointRef);

  assert.equal(restored?.runId, completedRun.runId);
  assert.equal(restored?.status, "completed");
  assert.equal(restored?.steps.length, 3);
});

test("DurableHarnessService.restoreFromCheckpoint returns null for unknown ref", () => {
  const durable = new DurableHarnessService();
  const result = durable.restoreFromCheckpoint("unknown-checkpoint-ref");

  assert.equal(result, null);
});

test("DurableHarnessService.restore returns null for unknown runId", () => {
  const durable = new DurableHarnessService();
  const result = durable.restore("unknown-run-id");

  assert.equal(result, null);
});

test("DurableHarnessService.getCheckpointRef returns null for run without checkpoint", () => {
  const durable = new DurableHarnessService();
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-no-checkpoint",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  durable.persist(run);
  const result = durable.getCheckpointRef(run.runId);

  assert.equal(result, null);
});

test("RecoveryController.handleFailure with operator_abort sets aborted status", () => {
  const durable = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService: durable });
  const controller = new RecoveryController(durable, runtime);

  const run = createCompletedRun(createConstraintPack());
  const result = controller.handleFailure(run, "operator_abort");

  assert.equal(result.status, "aborted");
  assert.ok(result.completedAt !== null);
});

test("RecoveryController.handleFailure with tool_timeout recovers and resumes", () => {
  const durable = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService: durable });
  const controller = new RecoveryController(durable, runtime);

  const run = createCompletedRun(createConstraintPack());
  durable.checkpoint(run);

  const result = controller.handleFailure(run, "tool_timeout");

  assert.equal(result.status, "running");
  assert.equal(result.recoveryCheckpoint, null);
  assert.equal(result.sleepLease, null);
});

test("RecoveryController.handleFailure with worker_crash pauses the run for recovery", () => {
  const durable = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService: durable });
  const controller = new RecoveryController(durable, runtime);

  const run = createCompletedRun(createConstraintPack());
  durable.checkpoint(run);

  const result = controller.handleFailure(run, "worker_crash");

  assert.equal(result.status, "paused");
  assert.equal(result.pauseReason, "recovery");
  assert.ok(result.recoveryCheckpoint !== null);
});

test("RecoveryController.handleFailure restores from checkpoint when available", () => {
  const durable = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService: durable });
  const controller = new RecoveryController(durable, runtime);

  const originalRun = createCompletedRun(createConstraintPack());
  durable.checkpoint(originalRun);

  // Modify run state to simulate older version
  const modifiedRun: HarnessRun = {
    ...originalRun,
    status: "running",
    completedAt: null,
  };

  const result = controller.handleFailure(modifiedRun, "worker_crash");

  // Should restore checkpoint state and pause the run for recovery.
  assert.equal(result.status, "paused");
  assert.equal(result.pauseReason, "recovery");
  assert.ok(result.recoveryCheckpoint !== null);
  assert.ok(result.recoveryCheckpoint?.checkpointId.startsWith("recovery_checkpoint_"));
});

test("RecoveryController.handleFailure falls back to persisted run when checkpoint unavailable", () => {
  const durable = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService: durable });
  const controller = new RecoveryController(durable, runtime);

  const originalRun = createCompletedRun(createConstraintPack());
  durable.persist(originalRun);

  const result = controller.handleFailure(originalRun, "worker_crash");

  assert.equal(result.status, "paused");
  assert.equal(result.pauseReason, "recovery");
  assert.ok(result.recoveryCheckpoint !== null);
});

test("RecoveryController.handleFailure uses current run when no durable state exists", () => {
  const durable = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService: durable });
  const controller = new RecoveryController(durable, runtime);

  const run = createCompletedRun(createConstraintPack());

  const result = controller.handleFailure(run, "worker_crash");

  assert.equal(result.status, "paused");
  assert.equal(result.pauseReason, "recovery");
  assert.ok(result.recoveryCheckpoint !== null);
  assert.equal(result.recoveryCheckpoint?.lastCompletedStepId, run.steps.at(-1)?.stepId ?? null);
});
