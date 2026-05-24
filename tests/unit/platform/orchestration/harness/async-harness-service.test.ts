import assert from "node:assert/strict";
import test from "node:test";

import { AsyncHarnessService } from "../../../../../src/platform/five-plane-orchestration/harness/async-harness-service.js";
import { HarnessRuntimeService, type HarnessLoopInput, type ConstraintPack } from "../../../../../src/platform/five-plane-orchestration/harness/index.js";

function createConstraintPack(overrides: Partial<ConstraintPack> = {}): ConstraintPack {
  return {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "supervised",
    tool_policy: { allowedTools: ["read", "write"] },
    risk_policy: { maxRiskScore: 10, escalationThreshold: 7 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budgetEnvelope: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
    sandboxRequirement: { sandboxMode: "ephemeral", timeoutMs: 1000 },
    approvalRequirement: {
      requiredForRiskClass: ["critical"],
      approverRoles: ["operator"],
      escalationTimeoutMs: 1000,
    },
    ...overrides,
  };
}

function createLoopInput(overrides: Partial<HarnessLoopInput> = {}): HarnessLoopInput {
  return {
    taskId: "task-1",
    domainId: "coding",
    constraintPack: createConstraintPack(),
    plannerOutput: { planId: "plan-1" },
    generatorOutput: { artifact: "result-1" },
    evaluatorOutput: { verdict: "pass" },
    evaluatorScore: 0.85,
    ...overrides,
  };
}

test("AsyncHarnessService queues runs and exposes queued metadata", async () => {
  const service = new AsyncHarnessService(new HarnessRuntimeService());

  const runId = await service.createRun(createLoopInput());
  const queued = service.get(runId);

  assert.ok(runId.length > 0);
  assert.equal(queued?.status, "queued");
  assert.equal(queued?.runId, runId);
  assert.equal(queued?.input.taskId, "task-1");
});

test("AsyncHarnessService executes queued runs to completion", async () => {
  const service = new AsyncHarnessService(new HarnessRuntimeService());
  const runId = await service.createRun(createLoopInput({ evaluatorScore: 0.9 }));

  const result = await service.execute(runId);

  assert.equal(service.get(runId)?.status, "completed");
  assert.equal(service.getRunStatus(runId), "completed");
  assert.equal(result.status, "completed");
  assert.ok(result.runId.startsWith("harness_run_"));
});

test("AsyncHarnessService isolates multiple queued runs", async () => {
  const service = new AsyncHarnessService(new HarnessRuntimeService());

  const runIdA = await service.createRun(createLoopInput({ taskId: "task-a" }));
  const runIdB = await service.createRun(createLoopInput({ taskId: "task-b" }));

  await service.execute(runIdA);

  assert.notEqual(runIdA, runIdB);
  assert.equal(service.get(runIdA)?.input.taskId, "task-a");
  assert.equal(service.get(runIdB)?.input.taskId, "task-b");
  assert.equal(service.getRunStatus(runIdB), "queued");
});

test("AsyncHarnessService preserves constraintPack content through execution", async () => {
  const service = new AsyncHarnessService(new HarnessRuntimeService());
  const runId = await service.createRun(createLoopInput({
    constraintPack: createConstraintPack({
      budgetEnvelope: { maxSteps: 50, maxCost: 500, maxDurationMs: 300000 },
    }),
  }));

  const result = await service.execute(runId);

  assert.equal(result.constraintPack.budgetEnvelope?.maxSteps, 50);
});

test("AsyncHarnessService rejects unknown run ids", async () => {
  const service = new AsyncHarnessService(new HarnessRuntimeService());

  assert.equal(service.get("unknown-run-id"), null);
  assert.equal(service.getRunStatus("unknown-run-id"), null);
  await assert.rejects(
    service.execute("truly-nonexistent-run"),
    /harness\.async\.run_not_found/,
  );
});
