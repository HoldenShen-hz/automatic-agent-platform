import test from "node:test";
import assert from "node:assert/strict";
import { AsyncHarnessService } from "../../../../../src/platform/orchestration/harness/async-harness-service.js";
import { HarnessRuntimeService, type HarnessLoopInput, type ConstraintPack } from "../../../../../src/platform/orchestration/harness/index.js";

function createConstraintPack(overrides = {}): ConstraintPack {
  return {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "auto",
    toolPolicy: { allowedTools: [] },
    risk_policy: { maxRiskScore: 10, escalationThreshold: 7 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
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

test("AsyncHarnessService.createRun registers run and returns runId", async () => {
  const runtime = new HarnessRuntimeService();
  const service = new AsyncHarnessService(runtime);

  const runId = await service.createRun(createLoopInput());

  assert.equal(typeof runId, "string");
  assert.notEqual(runId, "");
});

test("AsyncHarnessService.createRun creates run in queued state", async () => {
  const runtime = new HarnessRuntimeService();
  const service = new AsyncHarnessService(runtime);

  const runId = await service.createRun(createLoopInput());
  const queued = service.get(runId);

  assert.notEqual(queued, null);
  assert.equal(queued?.status, "queued");
  assert.equal(queued?.runId, runId);
  assert.equal(queued?.input.taskId, "task-1");
});

test("AsyncHarnessService.createRun preserves loop input data", async () => {
  const runtime = new HarnessRuntimeService();
  const service = new AsyncHarnessService(runtime);

  const input = createLoopInput({ taskId: "task-preserved", domainId: "preserved-domain" });
  const runId = await service.createRun(input);
  const queued = service.get(runId);

  assert.equal(queued?.input.taskId, "task-preserved");
  assert.equal(queued?.input.domainId, "preserved-domain");
});

test("AsyncHarnessService.execute transitions run to completed", async () => {
  const runtime = new HarnessRuntimeService();
  const service = new AsyncHarnessService(runtime);

  const runId = await service.createRun(createLoopInput());
  assert.equal(service.get(runId)?.status, "queued");

  const run = await service.execute(runId);
  const queued = service.get(runId);

  assert.equal(queued?.status, "completed");
  assert.ok(run.runId.startsWith("harness_run_"));
});

test("AsyncHarnessService.execute stores result on successful execution", async () => {
  const runtime = new HarnessRuntimeService();
  const service = new AsyncHarnessService(runtime);

  const runId = await service.createRun(createLoopInput({ evaluatorScore: 0.9 }));
  const result = await service.execute(runId);

  assert.notEqual(result, null);
  assert.equal(result.status, "completed");
});

test("AsyncHarnessService.execute throws for unknown runId", async () => {
  const runtime = new HarnessRuntimeService();
  const service = new AsyncHarnessService(runtime);

  const runId = await service.createRun(createLoopInput());

  await assert.rejects(
    async () => service.execute("non-existent-run-id"),
    /harness\.async\.run_not_found/,
  );
});

test("AsyncHarnessService.get returns null for unknown runId", () => {
  const runtime = new HarnessRuntimeService();
  const service = new AsyncHarnessService(runtime);

  const result = service.get("unknown-run-id");
  assert.equal(result, null);
});

test("AsyncHarnessService.getRunStatus returns null for unknown runId", () => {
  const runtime = new HarnessRuntimeService();
  const service = new AsyncHarnessService(runtime);

  const result = service.getRunStatus("unknown-run-id");
  assert.equal(result, null);
});

test("AsyncHarnessService.getRunStatus returns queued status for queued run", async () => {
  const runtime = new HarnessRuntimeService();
  const service = new AsyncHarnessService(runtime);

  const runId = await service.createRun(createLoopInput());
  const status = service.getRunStatus(runId);

  assert.equal(status, "queued");
});

test("AsyncHarnessService.getRunStatus returns completed status after execution", async () => {
  const runtime = new HarnessRuntimeService();
  const service = new AsyncHarnessService(runtime);

  const runId = await service.createRun(createLoopInput());
  await service.execute(runId);
  const status = service.getRunStatus(runId);

  assert.equal(status, "completed");
});

test("AsyncHarnessService.getRunStatus returns run status from result when available", async () => {
  const runtime = new HarnessRuntimeService();
  const service = new AsyncHarnessService(runtime);

  const runId = await service.createRun(createLoopInput({ evaluatorScore: 0.95 }));
  await service.execute(runId);
  const queued = service.get(runId);

  assert.notEqual(queued?.result, null);
  assert.equal(queued?.result?.status, "completed");
});

test("AsyncHarnessService.execute throws for truly nonexistent runId", async () => {
  const runtime = new HarnessRuntimeService();
  const service = new AsyncHarnessService(runtime);

  await assert.rejects(
    async () => service.execute("truly-nonexistent-run"),
    /harness\.async\.run_not_found/,
  );
});

test("AsyncHarnessService stores multiple runs independently", async () => {
  const runtime = new HarnessRuntimeService();
  const service = new AsyncHarnessService(runtime);

  const runId1 = await service.createRun(createLoopInput({ taskId: "task-a" }));
  const runId2 = await service.createRun(createLoopInput({ taskId: "task-b" }));
  const runId3 = await service.createRun(createLoopInput({ taskId: "task-c" }));

  assert.notEqual(runId1, runId2);
  assert.notEqual(runId2, runId3);
  assert.notEqual(runId1, runId3);

  assert.equal(service.get(runId1)?.input.taskId, "task-a");
  assert.equal(service.get(runId2)?.input.taskId, "task-b");
  assert.equal(service.get(runId3)?.input.taskId, "task-c");
});

test("AsyncHarnessService.execute processes runs in correct order", async () => {
  const runtime = new HarnessRuntimeService();
  const service = new AsyncHarnessService(runtime);

  const runId1 = await service.createRun(createLoopInput({ taskId: "first" }));
  const runId2 = await service.createRun(createLoopInput({ taskId: "second" }));

  const result1 = await service.execute(runId1);
  const result2 = await service.execute(runId2);

  assert.equal(service.get(runId1)?.status, "completed");
  assert.equal(service.get(runId2)?.status, "completed");
  assert.equal(result1.taskId, "first");
  assert.equal(result2.taskId, "second");
});

test("AsyncHarnessService.execute preserves constraintPack from input", async () => {
  const runtime = new HarnessRuntimeService();
  const service = new AsyncHarnessService(runtime);

  const input = createLoopInput({
    constraintPack: createConstraintPack({
      budget: { maxSteps: 50, maxCost: 500, maxDurationMs: 300000 },
    }),
  });

  const runId = await service.createRun(input);
  const result = await service.execute(runId);

  assert.equal(result.constraintPack.budget.maxSteps, 50);
});