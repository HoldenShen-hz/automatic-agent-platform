import assert from "node:assert/strict";
import test from "node:test";

import { HarnessRuntimeService, type ConstraintPack } from "../../../../../src/platform/five-plane-orchestration/harness/index.js";

function createConstraintPack(): ConstraintPack {
  return {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "supervised",
    tool_policy: { allowedTools: ["bash", "read"] },
    risk_policy: { maxRiskScore: 10, escalationThreshold: 7 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budgetEnvelope: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
    sandboxRequirement: { sandboxMode: "ephemeral", timeoutMs: 1000 },
    approvalRequirement: {
      requiredForRiskClass: ["critical"],
      approverRoles: ["operator"],
      escalationTimeoutMs: 1000,
    },
  };
}

test("HarnessRuntimeService.createRun initializes canonical runtime fields", () => {
  const run = new HarnessRuntimeService().createRun({
    taskId: "task-001",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  assert.equal(run.status, "created");
  assert.equal(run.nodeRunIds.length, 0);
  assert.equal(run.maxIterations, 10);
  assert.ok(run.harnessRunId.startsWith("harness_run_"));
  assert.equal(run.timeline[0]?.type, "run_created");
});

test("HarnessRuntimeService appendStep and captureContextSnapshot reflect step execution", () => {
  const runtime = new HarnessRuntimeService();
  const created = runtime.createRun({
    taskId: "task-003",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });
  const updated = runtime.appendStep(created, {
    role: "planner",
    stage: "plan",
    inputs: { taskId: "task-003" },
    outputs: { planId: "plan-001" },
    iteration: 3,
    nodeRunId: "node_run_123",
  });
  const snapshot = runtime.captureContextSnapshot(updated);

  assert.equal(updated.steps.length, 1);
  assert.equal(updated.nodeRunIds[0], "node_run_123");
  assert.equal(updated.currentIteration, 3);
  assert.equal(snapshot.stepCount, 1);
});

test("HarnessRuntimeService sleep resume and recover expose pause metadata", () => {
  const runtime = new HarnessRuntimeService();
  const created = runtime.createRun({
    taskId: "task-008",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const sleeping = runtime.sleep(created, "Rate limit", "2026-04-24T00:00:00Z");
  const resumed = runtime.resume(sleeping);
  const recovered = runtime.recover(created);

  assert.equal(sleeping.pauseReason, "sleep");
  assert.equal(resumed.status, "running");
  assert.equal(recovered.pauseReason, "recovery");
});
