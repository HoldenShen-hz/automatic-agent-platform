/**
 * Integration Tests: RecoveryController
 *
 * Tests RecoveryController with durable service and runtime integration.
 */

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
    toolPolicy: { allowedTools: ["bash", "read"] },
    risk_policy: { maxRiskScore: 10, escalationThreshold: 7 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
    ...overrides,
  };
}

function createRun(overrides: Partial<HarnessRun> = {}): HarnessRun {
  return {
    harnessRunId: "int-run-" + Math.random().toString(36).slice(2),
    runId: "int-run-" + Math.random().toString(36).slice(2),
    tenantId: "tenant:local",
    confirmedTaskSpecId: "confirmed_task_spec:int-task",
    requestEnvelopeId: "request_envelope:int-task",
    requestHash: "request_hash:int-task",
    constraintPackRef: "constraint_pack:coding",
    versionLockId: "int-run:version_lock",
    budgetLedgerId: "int-run:budget_ledger",
    currentSeq: 0,
    taskId: "int-task",
    domainId: "coding",
    constraintPack: createConstraintPack(),
    planGraphBundle: {
      planGraphBundleId: "plan_graph_bundle:int",
      harnessRunId: "int-run",
      graphVersion: 1,
      graph: {
        graphId: "graph-int",
        nodes: [],
        edges: [],
        entryNodeIds: [],
        terminalNodeIds: [],
        joinStrategy: "all",
        graphHash: "hash-int",
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

test("RecoveryController integration: operator_abort sets aborted status", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun();
  const result = controller.handleFailure(run, "operator_abort");

  assert.equal(result.status, "aborted");
  assert.ok(result.completedAt != null);
});

test("RecoveryController integration: operator_abort preserves existing completedAt", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const existingCompletedAt = "2024-01-01T00:00:00.000Z";
  const run = createRun({ completedAt: existingCompletedAt });
  const result = controller.handleFailure(run, "operator_abort");

  assert.equal(result.completedAt, existingCompletedAt);
});

test("RecoveryController integration: tool_timeout triggers recovery then resume", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun();
  const result = controller.handleFailure(run, "tool_timeout");

  assert.equal(result.status, "running");
  assert.equal(result.pauseReason, null);
});

test("RecoveryController integration: worker_crash triggers recovery checkpoint", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun();
  const result = controller.handleFailure(run, "worker_crash");

  assert.equal(result.status, "paused");
  assert.equal(result.pauseReason, "recovery");
  assert.ok(result.recoveryCheckpoint != null);
});

test("RecoveryController integration: llm_provider_unavailable triggers sleep with retry", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun();
  const result = controller.handleFailure(run, "llm_provider_unavailable");

  assert.equal(result.status, "paused");
  assert.equal(result.pauseReason, "sleep");
  assert.ok(result.sleepLease != null);
  assert.ok(result.sleepLease.reason.includes("llm_provider_unavailable"));
});

test("RecoveryController integration: budget_exhausted opens HITL review", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun();
  const result = controller.handleFailure(run, "budget_exhausted");

  assert.equal(result.status, "paused");
  assert.equal(result.pauseReason, "hitl");
  assert.ok(result.hitlRequest != null);
  assert.ok(result.hitlRequest.requestId.startsWith("hitl_request_"));
});

test("RecoveryController integration: platform_panic triggers recovery and resume", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun();
  const result = controller.handleFailure(run, "platform_panic");

  assert.equal(result.status, "running");
});

test("RecoveryController integration: recovers from persisted checkpoint", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  // Create and persist a run with steps
  let run = createRun();
  run = runtime.appendStep(run, {
    role: "planner",
    stage: "plan",
    inputs: {},
    outputs: { planId: "plan-001" },
  });

  const checkpointRef = durableService.checkpoint(run);
  assert.ok(checkpointRef != null);

  // Create fresh run and recover
  const freshRun = createRun();
  const result = controller.handleFailure(freshRun, "worker_crash");

  assert.equal(result.status, "paused");
  assert.equal(result.pauseReason, "recovery");
});

test("RecoveryController integration: falls back to durable restore when no checkpoint", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun();
  durableService.persist(run);

  const result = controller.handleFailure(run, "worker_crash");

  assert.equal(result.status, "paused");
  assert.equal(result.pauseReason, "recovery");
});

test("RecoveryController integration: returns original run when not persisted", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun({ runId: "unpersisted-int-run" });
  const result = controller.handleFailure(run, "worker_crash");

  assert.equal(result.runId, run.runId);
  assert.equal(result.status, "paused");
  assert.equal(result.pauseReason, "recovery");
});

test("RecoveryController integration: handles all failure types", () => {
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
    const run = createRun();
    const result = controller.handleFailure(run, failureType);
    assert.ok(result !== undefined, `handleFailure should process ${failureType}`);
  }
});

test("RecoveryController integration: preserves run fields during abort", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun({
    taskId: "preserve-task",
    domainId: "preserve-domain",
    currentIteration: 5,
    toolbelt: { allowedTools: ["bash"], grantedTools: ["bash"], blockedTools: [], requiredEvidence: [] },
  });

  const result = controller.handleFailure(run, "operator_abort");

  assert.equal(result.taskId, "preserve-task");
  assert.equal(result.domainId, "preserve-domain");
  assert.equal(result.currentIteration, 5);
  assert.ok(result.completedAt != null);
});

test("RecoveryController integration: persists run to durable service on abort", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun();
  controller.handleFailure(run, "operator_abort");

  const persistedRun = durableService.restore(run.runId);
  assert.ok(persistedRun != null);
  assert.equal(persistedRun.status, "aborted");
});

test("RecoveryController integration: handles completed run recovery", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun({ status: "completed", completedAt: new Date().toISOString() });
  const result = controller.handleFailure(run, "worker_crash");

  assert.equal(result.status, "paused");
  assert.equal(result.pauseReason, "recovery");
});

test("RecoveryController integration: handles aborted run recovery", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun({ status: "aborted", completedAt: new Date().toISOString() });
  const result = controller.handleFailure(run, "worker_crash");

  assert.equal(result.status, "paused");
  assert.equal(result.pauseReason, "recovery");
});

test("RecoveryController integration: recovery checkpoint captures last step", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  let run = createRun();
  run = runtime.appendStep(run, {
    role: "planner",
    stage: "plan",
    inputs: {},
    outputs: { planId: "plan-001" },
  });

  const result = controller.handleFailure(run, "worker_crash");

  assert.ok(result.recoveryCheckpoint != null);
  assert.ok(result.recoveryCheckpoint.lastCompletedStepId != null);
});

test("RecoveryController integration: recovers from terminal state to paused", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun({ status: "completed", completedAt: new Date().toISOString() });
  const result = controller.handleFailure(run, "worker_crash");

  // Even completed runs can be recovered
  assert.equal(result.pauseReason, "recovery");
  assert.ok(result.recoveryCheckpoint != null);
});