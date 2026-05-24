import assert from "node:assert/strict";
import test from "node:test";

import { HarnessRuntimeService, type ConstraintPack } from "../../../../../src/platform/five-plane-orchestration/harness/index.js";

function createConstraintPack(): ConstraintPack {
  return {
    policyIds: ["policy.default"],
    approvalMode: "none",
    autonomyMode: "supervised",
    tool_policy: { allowedTools: ["read", "write"] },
    risk_policy: { maxRiskScore: 0.8, escalationThreshold: 0.6 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budgetEnvelope: { maxSteps: 10, maxCost: 50, maxDurationMs: 60_000 },
    sandboxRequirement: { sandboxMode: "ephemeral", timeoutMs: 1_000 },
    approvalRequirement: {
      requiredForRiskClass: ["critical"],
      approverRoles: ["operator"],
      escalationTimeoutMs: 30_000,
    },
  };
}

test("HarnessRuntimeService.createRun seeds canonical runtime state", () => {
  const run = new HarnessRuntimeService().createRun({
    taskId: "task-created",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  assert.equal(run.status, "created");
  assert.equal(run.pauseReason, null);
  assert.equal(run.hitlRequest, null);
  assert.equal(run.loopMetrics?.maxIterations, 10);
  assert.equal(run.timeline[0]?.type, "run_created");
});

test("HarnessRuntimeService.appendStep updates execution state and timeline", () => {
  const runtime = new HarnessRuntimeService();
  const created = runtime.createRun({
    taskId: "task-step",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const updated = runtime.appendStep(created, {
    role: "planner",
    stage: "plan",
    inputs: { taskId: "task-step" },
    outputs: { planId: "plan-1" },
    iteration: 3,
    nodeRunId: "node-run-1",
  });
  const stepEvent = updated.timeline.find((event) => event.type === "step_completed");

  assert.equal(updated.steps.length, 1);
  assert.equal(updated.steps[0]?.role, "planner");
  assert.equal(updated.currentIteration, 3);
  assert.deepEqual(updated.nodeRunIds, ["node-run-1"]);
  assert.equal(stepEvent?.payload.stepId, updated.steps[0]?.stepId);
});

test("HarnessRuntimeService.captureContextSnapshot reflects latest run state", () => {
  const runtime = new HarnessRuntimeService();
  const withStep = runtime.appendStep(
    runtime.createRun({
      taskId: "task-snapshot",
      domainId: "coding",
      constraintPack: createConstraintPack(),
    }),
    {
      role: "evaluator",
      stage: "evaluate",
      inputs: {},
      outputs: { score: 0.9 },
      iteration: 2,
    },
  );

  const snapshot = runtime.captureContextSnapshot(withStep);

  assert.equal(snapshot.iteration, 2);
  assert.equal(snapshot.stepCount, 1);
  assert.equal(snapshot.lastDecisionId, null);
});

test("HarnessRuntimeService sleep and resume manage pause metadata", () => {
  const runtime = new HarnessRuntimeService();
  const created = runtime.createRun({
    taskId: "task-sleep",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const sleeping = runtime.sleep(created, "rate_limit", "2026-04-24T00:00:00.000Z", 2);
  const resumed = runtime.resume(sleeping);

  assert.equal(sleeping.status, "paused");
  assert.equal(sleeping.pauseReason, "sleep");
  assert.equal(sleeping.sleepLease?.retryAttempt, 2);
  assert.equal(resumed.status, "running");
  assert.equal(resumed.pauseReason, null);
  assert.equal(resumed.sleepLease, null);
});

test("HarnessRuntimeService recover stores checkpoint and recovery timeline event", () => {
  const runtime = new HarnessRuntimeService();
  const withStep = runtime.appendStep(
    runtime.createRun({
      taskId: "task-recover",
      domainId: "coding",
      constraintPack: createConstraintPack(),
    }),
    {
      role: "generator",
      stage: "execute",
      inputs: {},
      outputs: { draft: true },
      iteration: 1,
    },
  );

  const recovered = runtime.recover(withStep);
  const recoveryEvent = recovered.timeline.find((event) => event.type === "recovery_started");

  assert.equal(recovered.status, "paused");
  assert.equal(recovered.pauseReason, "recovery");
  assert.equal(recovered.recoveryCheckpoint?.lastCompletedStepId, withStep.steps[0]?.stepId ?? null);
  assert.equal(recoveryEvent?.payload.statusBeforeRecovery, withStep.status);
});

test("HarnessRuntimeService openHitlReview and resolveHitlReview follow current HITL state flow", () => {
  const runtime = new HarnessRuntimeService();
  const created = runtime.createRun({
    taskId: "task-hitl",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const paused = runtime.openHitlReview(created, "requires_human_review", ["artifact-1"]);
  const resolved = runtime.resolveHitlReview(paused, "approved", "operator-1");
  const requestedEvent = paused.timeline.find((event) => event.type === "hitl_requested");
  const resolvedEvent = resolved.timeline.find((event) => event.type === "hitl_resolved");

  assert.equal(paused.status, "paused");
  assert.equal(paused.pauseReason, "hitl");
  assert.equal(paused.hitlRequest?.status, "pending");
  assert.equal(requestedEvent?.payload.evidenceCount, 1);
  assert.equal(resolved.status, "running");
  assert.equal(resolved.pauseReason, null);
  assert.equal(resolved.hitlRequest?.status, "approved");
  assert.equal(resolvedEvent?.payload.actorId, "operator-1");
});
