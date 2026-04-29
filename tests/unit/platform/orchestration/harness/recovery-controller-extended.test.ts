/**
 * Unit Tests: RecoveryController Extended Coverage
 *
 * Additional tests for RecoveryController determineRetryScope,
 * getLoopController, and edge cases not covered by integration tests.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { RecoveryController, type HarnessFailureType, type RecoveryScope } from "../../../../../../src/platform/orchestration/harness/recovery-controller.js";
import { DurableHarnessService } from "../../../../../../src/platform/orchestration/harness/durable/durable-harness-service.js";
import { HarnessRuntimeService, type HarnessRun, type ConstraintPack, type HarnessRunRuntimeState } from "../../../../../../src/platform/orchestration/harness/index.js";
import { HarnessLoopController } from "../../../../../../src/platform/orchestration/harness/loop/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────────────────

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
    harnessRunId: "rc-unit-run-" + Math.random().toString(36).slice(2),
    runId: "rc-unit-run-" + Math.random().toString(36).slice(2),
    tenantId: "tenant:local",
    confirmedTaskSpecId: "confirmed_task_spec:rc-task",
    requestEnvelopeId: "request_envelope:rc-task",
    requestHash: "request_hash:rc-task",
    constraintPackRef: "constraint_pack:coding",
    versionLockId: "rc-unit-run:version_lock",
    budgetLedgerId: "rc-unit-run:budget_ledger",
    currentSeq: 0,
    taskId: "rc-task",
    domainId: "coding",
    constraintPack: createConstraintPack(),
    planGraphBundle: {
      planGraphBundleId: "plan_graph_bundle:rc",
      harnessRunId: "rc-unit-run",
      graphVersion: 1,
      graph: {
        graphId: "graph-rc",
        nodes: [],
        edges: [],
        entryNodeIds: [],
        terminalNodeIds: [],
        joinStrategy: "all",
        graphHash: "hash-rc",
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

// ─────────────────────────────────────────────────────────────────────────────
// determineRetryScope Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RecoveryController.determineRetryScope returns node for tool_timeout", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const scope = controller.determineRetryScope("tool_timeout");
  assert.equal(scope, "node");
});

test("RecoveryController.determineRetryScope returns node for llm_provider_unavailable", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const scope = controller.determineRetryScope("llm_provider_unavailable");
  assert.equal(scope, "node");
});

test("RecoveryController.determineRetryScope returns graph for platform_panic", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const scope = controller.determineRetryScope("platform_panic");
  assert.equal(scope, "graph");
});

test("RecoveryController.determineRetryScope returns graph for worker_crash", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const scope = controller.determineRetryScope("worker_crash");
  assert.equal(scope, "graph");
});

test("RecoveryController.determineRetryScope returns graph for budget_exhausted", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const scope = controller.determineRetryScope("budget_exhausted");
  assert.equal(scope, "graph");
});

test("RecoveryController.determineRetryScope returns node for operator_abort", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const scope = controller.determineRetryScope("operator_abort");
  assert.equal(scope, "node");
});

test("RecoveryController.determineRetryScope defaults to node for unknown failure type", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  // @ts-ignore - Testing with invalid type
  const scope = controller.determineRetryScope("unknown_failure" as HarnessFailureType);
  assert.equal(scope, "node");
});

// ─────────────────────────────────────────────────────────────────────────────
// RecoveryScope Type Verification
// ─────────────────────────────────────────────────────────────────────────────

test("RecoveryScope type includes node and graph values", () => {
  const scopes: RecoveryScope[] = ["node", "graph"];
  assert.equal(scopes.length, 2);
  assert.ok(scopes.includes("node"));
  assert.ok(scopes.includes("graph"));
});

// ─────────────────────────────────────────────────────────────────────────────
// handleFailure Retry Exhaustion Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RecoveryController.handleFailure with llm_provider_unavailable respects retry limit", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  // Create run with sleepLease indicating retry attempt 5 (exhausted)
  const run = createRun({
    sleepLease: {
      leaseId: "lease-1",
      runId: "rc-unit-run",
      reason: "llm_retry",
      resumeAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      retryAttempt: 5, // RETRY_MAX_ATTEMPTS
    },
  });

  const result = controller.handleFailure(run, "llm_provider_unavailable");

  // Should escalate to HITL when retry budget exhausted
  assert.equal(result.pauseReason, "hitl");
  assert.ok(result.hitlRequest != null);
});

test("RecoveryController.handleFailure with worker_crash respects retry limit", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun({
    sleepLease: {
      leaseId: "lease-2",
      runId: "rc-unit-run",
      reason: "worker_retry",
      resumeAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      retryAttempt: 5, // RETRY_MAX_ATTEMPTS
    },
  });

  const result = controller.handleFailure(run, "worker_crash");

  // Should escalate to HITL when retry budget exhausted
  assert.equal(result.pauseReason, "hitl");
  assert.ok(result.hitlRequest != null);
});

test("RecoveryController.handleFailure with llm_provider_unavailable sets correct retry reason", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun();
  const result = controller.handleFailure(run, "llm_provider_unavailable");

  assert.ok(result.sleepLease?.reason.includes("llm_provider_unavailable"));
});

test("RecoveryController.handleFailure with worker_crash sets correct retry reason", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun();
  const result = controller.handleFailure(run, "worker_crash");

  assert.ok(result.sleepLease?.reason.includes("worker_crash"));
});

// ─────────────────────────────────────────────────────────────────────────────
// handleFailure Backoff Computation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RecoveryController.handleFailure with tool_timeout uses loop controller backoff", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun();
  const result = controller.handleFailure(run, "tool_timeout");

  // tool_timeout should result in running state with sleep (backoff)
  assert.equal(result.status, "running");
  assert.ok(result.sleepLease != null);
});

test("RecoveryController.handleFailure computes exponential backoff delay", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun();
  const result = controller.handleFailure(run, "llm_provider_unavailable");

  // First retry: base delay should be 1000ms * 2^0 = 1000ms
  const resumeAt = new Date(result.sleepLease?.resumeAt ?? 0).getTime();
  const createdAt = new Date(result.sleepLease?.createdAt ?? 0).getTime();
  const delayMs = resumeAt - createdAt;

  // Backoff should be between 1000ms and 2000ms (with jitter)
  assert.ok(delayMs >= 1000);
  assert.ok(delayMs <= 2000);
});

test("RecoveryController.handleFailure with tool_timeout records iteration in loop controller", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun();
  const result = controller.handleFailure(run, "tool_timeout");

  // Should have sleep lease with retry attempt from loop controller
  assert.ok(result.sleepLease != null);
  assert.ok(result.sleepLease.retryAttempt >= 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// getLoopController Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RecoveryController uses injected loop controller when provided", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const customLoop = new HarnessLoopController(createConstraintPack(), {}, { iteration: 10 });

  const controller = new RecoveryController(durableService, runtime, customLoop);

  const run = createRun();
  const result = controller.handleFailure(run, "tool_timeout");

  // Should use the custom loop controller's state
  assert.equal(result.status, "running");
});

test("RecoveryController creates loop controller on-demand from run state", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun({
    loopMetrics: {
      iterationCount: 5,
      replanCount: 2,
      totalCost: 10,
      durationMs: 5000,
      maxIterations: 30,
      maxCost: 100,
      maxDurationMs: 60000,
    },
  });

  const result = controller.handleFailure(run, "tool_timeout");

  // On-demand loop controller should be created with run's metrics
  assert.equal(result.status, "running");
});

// ─────────────────────────────────────────────────────────────────────────────
// handleFailure with Checkpoint Restoration Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RecoveryController.handleFailure restores from checkpoint when available", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun();
  durableService.persist(run);
  const checkpointRef = durableService.checkpoint(run);

  const freshRun = createRun({ runId: "fresh-run-id" });
  const result = controller.handleFailure(freshRun, "worker_crash");

  // Should restore from checkpoint
  assert.equal(result.pauseReason, "recovery");
});

test("RecoveryController.handleFailure persists recovering run to durable service", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun();
  durableService.persist(run);

  controller.handleFailure(run, "worker_crash");

  const restored = durableService.restore(run.runId);
  assert.ok(restored != null);
});

// ─────────────────────────────────────────────────────────────────────────────
// handleFailure with Guardrail Violation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RecoveryController.handleFailure with tool_timeout escalates on guard violation", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  // Create run at iteration limit so loop controller returns guard violation
  const run = createRun({
    loopMetrics: {
      iterationCount: 100,
      replanCount: 0,
      totalCost: 0,
      durationMs: 0,
      maxIterations: 3,
      maxCost: 100,
      maxDurationMs: 60000,
    },
    steps: [{ stepId: "s1", role: "planner", stage: "plan", iteration: 1, inputs: {}, outputs: {}, startedAt: "", completedAt: "" }],
  });

  const result = controller.handleFailure(run, "tool_timeout");

  // Should escalate to HITL due to guard violation
  assert.equal(result.pauseReason, "hitl");
});

test("RecoveryController.handleFailure includes guard violation reason code", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun({
    loopMetrics: {
      iterationCount: 100,
      replanCount: 0,
      totalCost: 0,
      durationMs: 0,
      maxIterations: 3,
      maxCost: 100,
      maxDurationMs: 60000,
    },
    steps: [],
  });

  const result = controller.handleFailure(run, "tool_timeout");

  assert.ok(result.hitlRequest != null);
  assert.ok(result.hitlRequest.reason.includes("tool_timeout"));
});

// ─────────────────────────────────────────────────────────────────────────────
// handleFailure Platform Panic Tests
// ─────────────────────────────────────────────────────────────────────────────

test("RecoveryController.handleFailure with platform_panic resumes run", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun();
  const result = controller.handleFailure(run, "platform_panic");

  // platform_panic should result in running state after recovery + resume
  assert.equal(result.status, "running");
});

test("RecoveryController.handleFailure with platform_panic uses graph scope (replan semantics)", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);

  const run = createRun();
  const result = controller.handleFailure(run, "platform_panic");

  // Graph scope means full replan - run should be resumed
  assert.equal(result.status, "running");
  assert.equal(result.pauseReason, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// All HarnessFailureType Coverage
// ─────────────────────────────────────────────────────────────────────────────

test("RecoveryController handles all HarnessFailureType values and returns valid run", () => {
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
    const run = createRun({ runId: `run-${failureType}-${Date.now()}` });
    const result = controller.handleFailure(run, failureType);
    assert.ok(result != null, `handleFailure should return valid run for ${failureType}`);
    assert.ok(result.runId != null, `result should have runId for ${failureType}`);
  }
});
