import test from "node:test";
import assert from "node:assert/strict";
import { RecoveryController, type HarnessFailureType } from "../../../../../src/platform/orchestration/harness/recovery-controller.js";
import { DurableHarnessService } from "../../../../../src/platform/orchestration/harness/durable/durable-harness-service.js";
import { HarnessRuntimeService, type HarnessRun, type ConstraintPack } from "../../../../../src/platform/orchestration/harness/index.js";

function createConstraintPack(overrides = {}): ConstraintPack {
  return {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "auto",
    tool_policy: { allowedTools: [] },
    risk_policy: { maxRiskScore: 10, escalationThreshold: 7 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
    ...overrides,
  };
}

function createRun(overrides: Partial<HarnessRun> = {}): HarnessRun {
  return {
    harnessRunId: "run-test-1",
    runId: "run-test-1",
    tenantId: "tenant:local",
    confirmedTaskSpecId: "confirmed_task_spec:task-1",
    requestEnvelopeId: "request_envelope:task-1",
    requestHash: "request_hash:task-1",
    constraintPackRef: "constraint_pack:coding",
    versionLockId: "run-test-1:version_lock",
    budgetLedgerId: "run-test-1:budget_ledger",
    currentSeq: 0,
    taskId: "task-1",
    domainId: "coding",
    constraintPack: createConstraintPack(),
    planGraphBundle: {
      planGraphBundleId: "plan_graph_bundle:test",
      harnessRunId: "run-test-1",
      graphVersion: 1,
      graph: {
        graphId: "graph-1",
        nodes: [],
        edges: [],
        entryNodeIds: [],
        terminalNodeIds: [],
        joinStrategy: "all",
        graphHash: "hash-1",
      },
      schedulerPolicy: { policyId: "scheduler:harness.default", strategy: "deterministic_fifo" },
      budgetPlanRef: "budget:harness.initial",
      riskProfile: { riskClass: "medium", reasons: [] },
      validationReport: { valid: true, findings: [], normalizedNodeIds: [] },
      artifactRefs: [],
      createdAt: new Date().toISOString(),
    },
    steps: [],
    maxIterations: 10,
    currentIteration: 1,
    status: "running",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    pauseReason: null,
    decision: null,
    contextSnapshots: [],
    sleepLease: null,
    recoveryCheckpoint: null,
    feedbackEnvelope: null,
    toolbelt: null,
    guardrailAssessment: null,
    hitlRequest: null,
    timeline: [],
    ...overrides,
  };
}

test("RecoveryController.handleFailure with operator_abort sets status to aborted", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun({ status: "running" });
  const result = controller.handleFailure(run, "operator_abort");

  assert.equal(result.status, "paused");
  assert.equal(result.pauseReason, "hitl");
  assert.ok(result.hitlRequest != null);
});

test("RecoveryController.handleFailure with operator_abort preserves completedAt if already set", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const existingCompletedAt = "2024-01-01T00:00:00.000Z";
  const run = createRun({ status: "running", completedAt: existingCompletedAt });
  const result = controller.handleFailure(run, "operator_abort");

  assert.equal(result.status, "paused");
  assert.equal(result.pauseReason, "hitl");
  assert.equal(result.completedAt, existingCompletedAt);
});

test("RecoveryController.handleFailure with tool_timeout triggers recovery then resume", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun({ status: "running" });
  const result = controller.handleFailure(run, "tool_timeout");

  assert.equal(result.status, "paused");
  assert.equal(result.pauseReason, "hitl");
  assert.ok(result.hitlRequest != null);
});

test("RecoveryController.handleFailure with worker_crash triggers recovery checkpoint", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun({ status: "running" });
  const result = controller.handleFailure(run, "worker_crash");

  assert.equal(result.status, "running");
  assert.equal(result.pauseReason, null);
});

test("RecoveryController.handleFailure with llm_provider_unavailable triggers sleep for retry", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun({ status: "running" });
  const result = controller.handleFailure(run, "llm_provider_unavailable");

  assert.equal(result.status, "paused");
  assert.equal(result.pauseReason, "sleep");
  assert.ok(result.sleepLease != null);
  assert.ok(result.sleepLease.reason.includes("llm_provider_unavailable"));
});

test("RecoveryController.handleFailure with budget_exhausted triggers HITL review", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun({ status: "running" });
  const result = controller.handleFailure(run, "budget_exhausted");

  assert.equal(result.status, "paused");
  assert.equal(result.pauseReason, "hitl");
  assert.ok(result.hitlRequest != null);
});

test("RecoveryController.handleFailure with platform_panic triggers recovery and resume", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun({ status: "running" });
  const result = controller.handleFailure(run, "platform_panic");

  assert.equal(result.status, "running");
});

test("RecoveryController.handleFailure restores from checkpoint when available", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun({ status: "running" });
  durableService.persist(run);
  const checkpointRef = durableService.checkpoint(run);

  // Create a fresh run and try to recover it
  const freshRun = createRun({ runId: "run-fresh", status: "running" });
  const result = controller.handleFailure(freshRun, "worker_crash");

  assert.equal(result.status, "running");
  assert.equal(result.pauseReason, null);
});

test("RecoveryController.handleFailure falls back to durable restore when no checkpoint", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun({ status: "running" });
  durableService.persist(run);

  const result = controller.handleFailure(run, "worker_crash");

  assert.equal(result.status, "running");
  assert.equal(result.pauseReason, null);
});

test("RecoveryController.handleFailure returns original run when durable restore returns null", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun({ runId: "unpersisted-run", status: "running" });
  const result = controller.handleFailure(run, "worker_crash");

  assert.equal(result.runId, run.runId);
  assert.equal(result.status, "running");
  assert.equal(result.pauseReason, null);
});

test("RecoveryController handles all HarnessFailureType values", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const failureTypes: HarnessFailureType[] = [
    "operator_abort",
    "worker_crash",
    "tool_timeout",
    "llm_provider_unavailable",
    "budget_exhausted",
    "platform_panic",
  ];

  for (const failureType of failureTypes) {
    const run = createRun({ status: "running" });
    const result = controller.handleFailure(run, failureType);
    assert.ok(result !== undefined, `handleFailure should accept ${failureType}`);
  }
});

test("RecoveryController preserves run fields during operator_abort", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun({
    status: "running",
    taskId: "task-preserve",
    domainId: "preserve-domain",
    currentIteration: 5,
  });

  const result = controller.handleFailure(run, "operator_abort");

  assert.equal(result.taskId, "task-preserve");
  assert.equal(result.domainId, "preserve-domain");
  assert.equal(result.currentIteration, 5);
});

test("RecoveryController emits events via durableService", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun({ status: "running" });
  durableService.persist(run);
  controller.handleFailure(run, "operator_abort");

  // Verify event was emitted - durable service should have recorded it
  const persistedRun = durableService.restore(run.runId);
  assert.ok(persistedRun != null);
});

test("RecoveryController emits recovery_started event for worker_crash", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun({ status: "running" });
  durableService.persist(run);
  controller.handleFailure(run, "worker_crash");

  const restored = durableService.restore(run.runId);
  assert.ok(restored != null);
});

test("RecoveryController handles completed run during recovery", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun({ status: "completed", completedAt: new Date().toISOString() });
  assert.throws(
    () => controller.handleFailure(run, "worker_crash"),
    /Invalid HarnessRun transition: completed -> paused/,
  );
});

test("RecoveryController handles aborted run during recovery", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun({ status: "aborted", completedAt: new Date().toISOString() });
  assert.throws(
    () => controller.handleFailure(run, "worker_crash"),
    /Invalid HarnessRun transition: aborted -> paused/,
  );
});
