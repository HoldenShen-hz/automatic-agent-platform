import test from "node:test";
import assert from "node:assert/strict";
import { HarnessRuntimeService, type ConstraintPack } from "../../../../../src/platform/five-plane-orchestration/harness/index.js";
import { DurableHarnessService } from "../../../../../src/platform/five-plane-orchestration/harness/durable/durable-harness-service.js";

function createConstraintPack(overrides = {}): ConstraintPack {
  return {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "auto",
    tool_policy: { allowedTools: ["bash", "read"] },
    risk_policy: { maxRiskScore: 10, escalationThreshold: 7 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
    ...overrides,
  };
}

test("HarnessRuntimeService.createRun initializes run with correct initial state", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  const run = service.createRun({
    taskId: "task-001",
    domainId: "coding",
    constraintPack,
  });

  assert.equal(run.status, "created");
  assert.equal(run.taskId, "task-001");
  assert.equal(run.domainId, "coding");
  assert.equal(run.steps.length, 0);
  assert.equal(run.nodeRunIds.length, 0);
  assert.equal(run.currentIteration, 0);
  assert.equal(run.maxIterations, 10);
  assert.ok(run.harnessRunId.startsWith("harness_run_"));
  assert.ok(run.timeline.length > 0);
  assert.equal(run.timeline[0].type, "run_created");
});

test("HarnessRuntimeService.createRun creates budget ledger with correct hard cap", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack({ budget: { maxSteps: 5, maxCost: 50, maxDurationMs: 30000 } });

  const run = service.createRun({
    taskId: "task-002",
    domainId: "coding",
    constraintPack,
  });

  assert.ok(run.budgetLedgerId.startsWith("bledger_"));
});

test("HarnessRuntimeService.appendStep adds step to run", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "task-003",
    domainId: "coding",
    constraintPack,
  });

  run = service.appendStep(run, {
    role: "planner",
    stage: "plan",
    inputs: { taskId: "task-003" },
    outputs: { planId: "plan-001" },
  });

  assert.equal(run.steps.length, 1);
  assert.equal(run.steps[0].role, "planner");
  assert.equal(run.steps[0].stage, "plan");
  assert.ok(run.steps[0].stepId.startsWith("harness_step_"));
});

test("HarnessRuntimeService.appendStep appends nodeRunId when provided", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "task-004",
    domainId: "coding",
    constraintPack,
  });

  run = service.appendStep(run, {
    role: "generator",
    stage: "execute",
    inputs: {},
    outputs: {},
    nodeRunId: "node_run_123",
  });

  assert.equal(run.nodeRunIds.length, 1);
  assert.equal(run.nodeRunIds[0], "node_run_123");
});

test("HarnessRuntimeService.appendStep increments iteration based on input", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "task-005",
    domainId: "coding",
    constraintPack,
  });

  run = service.appendStep(run, {
    role: "planner",
    stage: "plan",
    inputs: {},
    outputs: {},
    iteration: 3,
  });

  assert.equal(run.currentIteration, 3);
});

test("HarnessRuntimeService.appendStep adds timeline event", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "task-006",
    domainId: "coding",
    constraintPack,
  });

  const timelineLengthBefore = run.timeline.length;
  run = service.appendStep(run, {
    role: "evaluator",
    stage: "evaluate",
    inputs: {},
    outputs: { score: 0.8 },
  });

  assert.ok(run.timeline.length > timelineLengthBefore);
  const stepEvent = run.timeline.find((e) => e.type === "step_completed");
  assert.ok(stepEvent != null);
});

test("HarnessRuntimeService.appendStep rejects non-accept decisions without feedback envelope", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  const run = service.createRun({
    taskId: "task-006b",
    domainId: "coding",
    constraintPack,
  });

  assert.throws(
    () =>
      service.appendStep({
        ...run,
        decision: {
          decisionId: "decision-1",
          action: "replan",
        } as any,
        feedbackEnvelope: null,
      }, {
        role: "planner",
        stage: "plan",
        inputs: {},
        outputs: {},
      }),
    /harness\.feedback\.required_for_non_accept_decision/,
  );
});

test("HarnessRuntimeService.captureContextSnapshot creates snapshot with correct fields", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "task-007",
    domainId: "coding",
    constraintPack,
  });

  run = service.appendStep(run, {
    role: "planner",
    stage: "plan",
    inputs: {},
    outputs: { planId: "plan-001" },
  });

  const snapshot = service.captureContextSnapshot(run);

  assert.ok(snapshot.snapshotId.startsWith("ctx_snapshot_"));
  assert.equal(snapshot.runId, run.runId);
  assert.equal(snapshot.domainId, "coding");
  assert.equal(snapshot.iteration, 1);
  assert.equal(snapshot.stepCount, 1);
});

test("HarnessRuntimeService.sleep pauses run with sleep lease", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "task-008",
    domainId: "coding",
    constraintPack,
  });

  const resumeAt = new Date(Date.now() + 60000).toISOString();
  run = service.sleep(run, "Rate limit", resumeAt);

  assert.equal(run.status, "paused");
  assert.equal(run.pauseReason, "sleep");
  assert.ok(run.sleepLease != null);
  assert.equal(run.sleepLease.reason, "Rate limit");
  assert.equal(run.sleepLease.resumeAt, resumeAt);
});

test("HarnessRuntimeService.resume restarts paused run", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "task-009",
    domainId: "coding",
    constraintPack,
  });

  const resumeAt = new Date(Date.now() + 60000).toISOString();
  run = service.sleep(run, "Rate limit", resumeAt);
  assert.equal(run.status, "paused");

  run = service.resume(run);
  assert.equal(run.status, "running");
  assert.equal(run.pauseReason, null);
  assert.equal(run.sleepLease, null);
});

test("HarnessRuntimeService.recover pauses run for recovery", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "task-010",
    domainId: "coding",
    constraintPack,
  });

  run = service.recover(run);

  assert.equal(run.status, "paused");
  assert.equal(run.pauseReason, "recovery");
  assert.ok(run.recoveryCheckpoint != null);
  assert.equal(run.recoveryCheckpoint.runId, run.runId);
});

test("HarnessRuntimeService.openHitlReview pauses run with HITL request", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "task-011",
    domainId: "coding",
    constraintPack,
  });

  run = service.openHitlReview(run, "Manual approval needed", ["evidence-1"]);

  assert.equal(run.status, "paused");
  assert.equal(run.pauseReason, "hitl");
  assert.ok(run.hitlRequest != null);
  assert.equal(run.hitlRequest.reason, "Manual approval needed");
});

test("HarnessRuntimeService.resolveHitlReview approves run and resumes", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "task-012",
    domainId: "coding",
    constraintPack,
  });

  run = service.openHitlReview(run, "Manual approval needed", ["evidence-1"]);
  run = service.resolveHitlReview(run, "approved", "operator-1");

  assert.equal(run.status, "running");
  assert.equal(run.pauseReason, null);
  assert.ok(run.hitlRequest != null);
});

test("HarnessRuntimeService.resolveHitlReview rejects and cancels run", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "task-013",
    domainId: "coding",
    constraintPack,
  });

  run = service.openHitlReview(run, "Manual approval needed", ["evidence-1"]);
  run = service.resolveHitlReview(run, "rejected", "operator-1");

  assert.equal(run.status, "cancelled");
  assert.ok(run.completedAt != null);
});

test("HarnessRuntimeService.resolveHitlReview throws when no HITL request", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "task-014",
    domainId: "coding",
    constraintPack,
  });

  assert.throws(
    () => service.resolveHitlReview(run, "approved", "operator-1"),
    /harness.hitl.request_not_found/,
  );
});

test("HarnessRuntimeService.writeMemory and readMemory work correctly", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "task-015",
    domainId: "coding",
    constraintPack,
  });

  service.writeMemory(run, "run", "key1", { value: "test" });
  const result = service.readMemory(run, "run", "key1");

  assert.deepEqual(result, { value: "test" });
});

test("HarnessRuntimeService.listTimeline returns timeline events", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "task-016",
    domainId: "coding",
    constraintPack,
  });

  run = service.appendStep(run, {
    role: "planner",
    stage: "plan",
    inputs: {},
    outputs: {},
  });

  const timeline = service.listTimeline(run);
  assert.ok(timeline.length >= 2);
  assert.ok(timeline.some((e) => e.type === "run_created"));
  assert.ok(timeline.some((e) => e.type === "step_completed"));
});

test("HarnessRuntimeService.decide returns accept for high score", () => {
  const service = new HarnessRuntimeService();
  const decision = service.decide({ evaluatorScore: 0.9 });

  assert.equal(decision.action, "accept");
});

test("HarnessRuntimeService.decide returns abort for max iterations reached", () => {
  const service = new HarnessRuntimeService();
  const decision = service.decide({ evaluatorScore: 0.9, maxIterationsReached: true });

  assert.equal(decision.action, "abort");
});

test("HarnessRuntimeService.assertInvariants returns violations", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack({
    budget: { maxSteps: 1, maxCost: 1, maxDurationMs: 1 },
  });

  let run = service.createRun({
    taskId: "task-017",
    domainId: "coding",
    constraintPack,
  });

  // Set completed status without completedAt - should trigger invariant violation
  const result = service.assertInvariants({ ...run, status: "completed", completedAt: null });
  assert.ok(result.violations.includes("INV-5:harness.invariant.final_state_requires_completed_at"));
});

test("HarnessRuntimeService.assertInvariants flags blocked tools for active runs", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  const run = service.createRun({
    taskId: "task-017b",
    domainId: "coding",
    constraintPack,
  });

  const result = service.assertInvariants({
    ...run,
    status: "running",
    toolbelt: {
      allowedTools: ["read"],
      grantedTools: ["read"],
      blockedTools: ["delete"],
      requiredEvidence: [],
    },
  });

  assert.ok(result.violations.includes("INV-10:harness.invariant.blocked_tool_requested"));
});

test("HarnessRuntimeService.persistRun persists run to durable service", () => {
  const durableService = new DurableHarnessService();
  const service = new HarnessRuntimeService({ durableService });
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "task-018",
    domainId: "coding",
    constraintPack,
  });

  const record = service.persistRun(run);
  assert.ok(record != null);
  assert.equal(record.run.runId, run.runId);
});

test("HarnessRuntimeService.checkpointRun creates checkpoint", () => {
  const durableService = new DurableHarnessService();
  const service = new HarnessRuntimeService({ durableService });
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "task-019",
    domainId: "coding",
    constraintPack,
  });

  const checkpointRef = service.checkpointRun(run);
  assert.ok(checkpointRef.startsWith("harness_checkpoint_"));

  const restored = service.restoreFromCheckpoint(checkpointRef);
  assert.ok(restored != null);
  assert.equal(restored.runId, run.runId);
});

test("HarnessRuntimeService.restoreRun restores persisted run", () => {
  const durableService = new DurableHarnessService();
  const service = new HarnessRuntimeService({ durableService });
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "task-020",
    domainId: "coding",
    constraintPack,
  });

  service.persistRun(run);
  const restored = service.restoreRun(run.runId);

  assert.ok(restored != null);
  assert.equal(restored.runId, run.runId);
});

test("HarnessRuntimeService.restoreRun returns null for non-existent run", () => {
  const service = new HarnessRuntimeService();
  const restored = service.restoreRun("non-existent-run-id");

  assert.equal(restored, null);
});

test("HarnessRuntimeService.handleFailure delegates to recovery controller", () => {
  const durableService = new DurableHarnessService();
  const service = new HarnessRuntimeService({ durableService });
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "task-021",
    domainId: "coding",
    constraintPack,
  });

  const result = service.handleFailure(run, "operator_abort");

  assert.equal(result.status, "aborted");
});

test("HarnessRuntimeService.evaluateRun delegates to eval service", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "task-022",
    domainId: "coding",
    constraintPack,
  });

  const result = service.evaluateRun(run);
  assert.ok(result !== undefined);
});

test("HarnessRuntimeService.createAsyncService returns AsyncHarnessService", () => {
  const service = new HarnessRuntimeService();
  const asyncService = service.createAsyncService();

  assert.ok(asyncService != null);
  assert.equal(typeof asyncService.createRun, "function");
  assert.equal(typeof asyncService.execute, "function");
  assert.equal(typeof asyncService.get, "function");
});
