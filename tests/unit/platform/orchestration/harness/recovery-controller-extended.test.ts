import assert from "node:assert/strict";
import test from "node:test";

import { DurableHarnessService } from "../../../../../src/platform/five-plane-orchestration/harness/durable/durable-harness-service.js";
import { HarnessRuntimeService, type ConstraintPack, type HarnessRunRuntimeState } from "../../../../../src/platform/five-plane-orchestration/harness/index.js";
import { HarnessLoopController } from "../../../../../src/platform/five-plane-orchestration/harness/loop/index.js";
import { RecoveryController } from "../../../../../src/platform/five-plane-orchestration/harness/recovery-controller.js";

function createConstraintPack(): ConstraintPack {
  return {
    policyIds: ["policy.default"],
    approvalMode: "none",
    autonomyMode: "supervised",
    tool_policy: { allowedTools: ["read", "write"] },
    risk_policy: { maxRiskScore: 0.8, escalationThreshold: 0.6 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budgetEnvelope: { maxSteps: 10, maxCost: 25, maxDurationMs: 60_000 },
    sandboxRequirement: { sandboxMode: "ephemeral", timeoutMs: 1_000 },
    approvalRequirement: {
      requiredForRiskClass: ["critical"],
      approverRoles: ["operator"],
      escalationTimeoutMs: 30_000,
    },
  };
}

function createFixture() {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const controller = new RecoveryController(durableService, runtime);
  return { durableService, runtime, controller };
}

function createRun(runtime: HarnessRuntimeService, overrides: Partial<HarnessRunRuntimeState> = {}): HarnessRunRuntimeState {
  return {
    ...runtime.createRun({
      taskId: "task-recovery",
      domainId: "coding",
      constraintPack: createConstraintPack(),
    }),
    ...overrides,
  };
}

test("RecoveryController.determineRetryScope matches current failure policy", () => {
  const { controller } = createFixture();

  assert.equal(controller.determineRetryScope("tool_timeout"), "node");
  assert.equal(controller.determineRetryScope("llm_provider_unavailable"), "node");
  assert.equal(controller.determineRetryScope("operator_abort"), "node");
  assert.equal(controller.determineRetryScope("budget_exhausted"), "graph");
  assert.equal(controller.determineRetryScope("worker_crash"), "graph");
  assert.equal(controller.determineRetryScope("platform_panic"), "graph");
});

test("RecoveryController.handleFailure escalates exhausted llm retries to HITL", () => {
  const { runtime, controller } = createFixture();
  const run = createRun(runtime, {
    sleepLease: {
      leaseId: "lease-1",
      runId: "run-1",
      reason: "llm_provider_unavailable_retry",
      resumeAt: "2026-04-23T00:01:00.000Z",
      createdAt: "2026-04-23T00:00:00.000Z",
      retryAttempt: 5,
    },
  });

  const result = controller.handleFailure(run, "llm_provider_unavailable");

  assert.equal(result.pauseReason, "hitl");
  assert.equal(result.hitlRequest?.reason, "llm_provider_retry_exhausted");
  assert.equal(result.hitlRequest?.status, "pending");
});

test("RecoveryController.handleFailure pauses operator aborts as terminal aborted runs", () => {
  const { runtime, controller } = createFixture();
  const run = createRun(runtime);

  const result = controller.handleFailure(run, "operator_abort");

  assert.equal(result.status, "aborted");
  assert.equal(result.pauseReason, null);
  assert.ok(result.completedAt !== null);
});

test("RecoveryController.handleFailure schedules tool timeout retry through sleep", () => {
  const durableService = new DurableHarnessService();
  const runtime = new HarnessRuntimeService({ durableService });
  const loopController = new HarnessLoopController(createConstraintPack(), {}, {
    retryAttempt: 1,
    lastRetryAt: Date.now() - 5_000,
  });
  const controller = new RecoveryController(durableService, runtime, loopController);
  const run = createRun(runtime);

  const result = controller.handleFailure(run, "tool_timeout");

  assert.equal(result.status, "paused");
  assert.equal(result.pauseReason, "sleep");
  assert.equal(result.sleepLease?.reason, "tool_timeout_retry");
  assert.ok(typeof result.sleepLease?.retryAttempt === "number");
});

test("RecoveryController.handleFailure keeps initial worker crashes in recovery pause when no retry lease exists", () => {
  const { runtime, controller } = createFixture();
  const run = createRun(runtime);

  const result = controller.handleFailure(run, "worker_crash");

  assert.equal(result.status, "paused");
  assert.equal(result.pauseReason, "recovery");
  assert.equal(result.sleepLease, null);
  assert.ok(result.recoveryCheckpoint !== null);
});

test("RecoveryController.handleFailure escalates exhausted platform panic retries", () => {
  const { runtime, controller } = createFixture();
  const run = createRun(runtime, {
    sleepLease: {
      leaseId: "lease-2",
      runId: "run-2",
      reason: "platform_panic_retry",
      resumeAt: "2026-04-23T00:01:00.000Z",
      createdAt: "2026-04-23T00:00:00.000Z",
      retryAttempt: 5,
    },
  });

  const result = controller.handleFailure(run, "platform_panic");

  assert.equal(result.pauseReason, "hitl");
  assert.equal(result.hitlRequest?.reason, "platform_panic_retry_exhausted");
  assert.equal(result.hitlRequest?.status, "pending");
});
