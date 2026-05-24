import assert from "node:assert/strict";
import test from "node:test";

import { HarnessRuntimeService, type ConstraintPack } from "../../../../../src/platform/five-plane-orchestration/harness/index.js";

function createConstraintPack(): ConstraintPack {
  return {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "supervised",
    tool_policy: { allowedTools: [] },
    risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budgetEnvelope: { maxSteps: 30, maxCost: 100, maxDurationMs: 60_000 },
    sandboxRequirement: { sandboxMode: "ephemeral", timeoutMs: 1000 },
    approvalRequirement: {
      requiredForRiskClass: ["critical"],
      approverRoles: ["operator"],
      escalationTimeoutMs: 1000,
    },
  };
}

test("HarnessRuntimeService creates runs with current runtime state metadata", () => {
  const runtime = new HarnessRuntimeService();
  const run = runtime.createRun({
    taskId: "task-123",
    domainId: "domain-456",
    constraintPack: createConstraintPack(),
  });

  assert.equal(run.taskId, "task-123");
  assert.equal(run.domainId, "domain-456");
  assert.equal(run.status, "created");
  assert.equal(run.steps.length, 0);
  assert.ok(run.runId.startsWith("harness_run_"));
});

test("HarnessRuntimeService appendStep captureContextSnapshot and listTimeline reflect runtime changes", () => {
  const runtime = new HarnessRuntimeService();
  const created = runtime.createRun({
    taskId: "task-append",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });
  const stepped = runtime.appendStep(created, {
    role: "planner",
    stage: "plan",
    inputs: { taskId: "task-append" },
    outputs: { plan: "test-plan" },
    iteration: 1,
    nodeRunId: "node_run_123",
  });
  const snapshot = runtime.captureContextSnapshot(stepped);
  const timeline = runtime.listTimeline(stepped);

  assert.equal(stepped.steps.length, 1);
  assert.equal(stepped.nodeRunIds[0], "node_run_123");
  assert.equal(snapshot.iteration, 1);
  assert.equal(snapshot.stepCount, 1);
  assert.ok(timeline.some((event) => event.type === "step_completed"));
});

test("HarnessRuntimeService decide sleep resume and recover follow the current runtime contract", () => {
  const runtime = new HarnessRuntimeService();
  const created = runtime.createRun({
    taskId: "task-flow",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });
  const accepted = runtime.decide({ evaluatorScore: 0.9 });
  const replan = runtime.decide({ evaluatorScore: 0.3 });
  const sleeping = runtime.sleep(created, "waiting", "2026-04-24T00:00:00Z");
  const resumed = runtime.resume(sleeping);
  const recovered = runtime.recover(created);

  assert.equal(accepted.action, "accept");
  assert.equal(replan.action, "replan");
  assert.equal(sleeping.pauseReason, "sleep");
  assert.equal(resumed.status, "running");
  assert.equal(recovered.pauseReason, "recovery");
});
