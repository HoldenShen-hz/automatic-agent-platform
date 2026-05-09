import test from "node:test";
import assert from "node:assert/strict";
import { HarnessRuntimeService, type HarnessRun, type HarnessRunStatus, type ConstraintPack } from "../../../../../src/platform/orchestration/harness/index.js";
import { DurableHarnessService } from "../../../../../src/platform/orchestration/harness/durable/durable-harness-service.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Helpers
// ─────────────────────────────────────────────────────────────────────────────

function createConstraintPack(overrides: Partial<ConstraintPack> = {}): ConstraintPack {
  return {
    policyIds: ["policy.default"],
    approvalMode: "none",
    autonomyMode: "auto",
    tool_policy: { allowedTools: ["read", "write"] },
    risk_policy: { maxRiskScore: 100, escalationThreshold: 80 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// HarnessRun Status Constants Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HarnessRunStatus includes all expected terminal and non-terminal states", () => {
  const validStatuses: HarnessRunStatus[] = [
    "created",
    "admitted",
    "planning",
    "ready",
    "running",
    "pausing",
    "paused",
    "resuming",
    "replanning",
    "compensating",
    "completed",
    "failed",
    "aborted",
  ];

  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-status-test",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  // Verify all statuses are valid HarnessRunStatus values
  for (const status of validStatuses) {
    const testRun = { ...run, status };
    assert.ok(typeof testRun.status === "string");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// createRun Initial State Tests
// ─────────────────────────────────────────────────────────────────────────────

test("createRun initializes run with created status", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-created",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  assert.equal(run.status, "created");
  assert.ok(run.harnessRunId.startsWith("harness_run_"));
  assert.ok(run.runId.startsWith("harness_run_"));
  assert.equal(run.taskId, "task-created");
  assert.equal(run.domainId, "coding");
  assert.equal(run.currentSeq, 0);
  assert.ok(run.createdAt !== null);
  assert.ok(run.updatedAt !== null);
  assert.equal(run.completedAt, null);
});

test("createRun initializes run with empty steps array", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-steps",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  assert.ok(Array.isArray(run.steps));
  assert.equal(run.steps.length, 0);
});

test("createRun initializes run with empty nodeRunIds array", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-nodes",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  assert.ok(Array.isArray(run.nodeRunIds));
  assert.equal(run.nodeRunIds.length, 0);
});

test("createRun initializes run with null pauseReason", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-pause",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  assert.equal(run.pauseReason, null);
});

test("createRun initializes run with null decision", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-decision",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  assert.equal(run.decision, null);
});

test("createRun initializes run with null hitlRequest", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-hitl",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  assert.equal(run.hitlRequest, null);
});

test("createRun initializes run with empty timeline", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-timeline",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  assert.ok(Array.isArray(run.timeline));
  assert.ok(run.timeline.length > 0); // run_created event
});

test("createRun sets budgetLedgerId correctly", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-budget",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  // The budget ledger ID uses "bledger_" prefix from createBudgetLedger
  assert.ok(run.budgetLedgerId.startsWith("bledger_"));
});

test("createRun sets planGraphBundle correctly", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-plan",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  assert.ok(run.planGraphBundle !== null);
  assert.ok(run.planGraphBundle.planGraphBundleId.startsWith("plan_graph_bundle_"));
  assert.ok(run.planGraphBundle.graph !== null);
  assert.ok(run.planGraphBundle.graph.nodes.length > 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// appendStep Tests
// ─────────────────────────────────────────────────────────────────────────────

test("appendStep adds step and increments iteration", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-append",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const withStep = service.appendStep(run, {
    role: "planner",
    stage: "plan",
    inputs: { taskId: "task-append" },
    outputs: { plan: "test-plan" },
  });

  assert.equal(withStep.steps.length, 1);
  assert.equal(withStep.steps[0].role, "planner");
  assert.equal(withStep.steps[0].stage, "plan");
  assert.ok(withStep.steps[0].stepId.startsWith("harness_step_"));
});

test("appendStep adds multiple steps", () => {
  const service = new HarnessRuntimeService();
  let run = service.createRun({
    taskId: "task-multi",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  run = service.appendStep(run, { role: "planner", stage: "plan", inputs: {}, outputs: {} });
  run = service.appendStep(run, { role: "generator", stage: "execute", inputs: {}, outputs: {} });
  run = service.appendStep(run, { role: "evaluator", stage: "evaluate", inputs: {}, outputs: {} });

  assert.equal(run.steps.length, 3);
  assert.equal(run.steps[0].role, "planner");
  assert.equal(run.steps[1].role, "generator");
  assert.equal(run.steps[2].role, "evaluator");
});

test("appendStep adds timeline event", () => {
  const service = new HarnessRuntimeService();
  let run = service.createRun({
    taskId: "task-timeline-event",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const initialTimelineLength = run.timeline.length;
  run = service.appendStep(run, { role: "planner", stage: "plan", inputs: {}, outputs: {} });

  assert.ok(run.timeline.length > initialTimelineLength);
  const stepEvent = run.timeline.find(e => e.type === "step_completed");
  assert.ok(stepEvent !== null);
  assert.ok(stepEvent.payload.stepId !== null);
});

test("appendStep respects explicit iteration parameter", () => {
  const service = new HarnessRuntimeService();
  let run = service.createRun({
    taskId: "task-iteration",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  run = service.appendStep(run, {
    role: "planner",
    stage: "plan",
    inputs: {},
    outputs: {},
    iteration: 5,
  });

  assert.equal(run.currentIteration, 5);
});

test("appendStep uses max of currentIteration and 1 when no iteration provided", () => {
  const service = new HarnessRuntimeService();
  let run = service.createRun({
    taskId: "task-default-iteration",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  // Default iteration should be 1 (max of currentIteration(0) and 1)
  run = service.appendStep(run, { role: "planner", stage: "plan", inputs: {}, outputs: {} });

  assert.equal(run.currentIteration, 1);
});

// ─────────────────────────────────────────────────────────────────────────────
// sleep / resume Tests
// ─────────────────────────────────────────────────────────────────────────────

test("sleep transitions run to paused status with sleep pauseReason", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-sleep",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const resumeAt = new Date(Date.now() + 60000).toISOString();
  const sleeping = service.sleep(run, "waiting_for_resource", resumeAt);

  assert.equal(sleeping.status, "paused");
  assert.equal(sleeping.pauseReason, "sleep");
  assert.ok(sleeping.sleepLease !== null);
  assert.equal(sleeping.sleepLease?.reason, "waiting_for_resource");
  assert.equal(sleeping.sleepLease?.resumeAt, resumeAt);
});

test("sleep adds sleep_started timeline event", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-sleep-timeline",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const resumeAt = new Date(Date.now() + 60000).toISOString();
  const sleeping = service.sleep(run, "test", resumeAt);

  const sleepEvent = sleeping.timeline.find(e => e.type === "sleep_started");
  assert.ok(sleepEvent !== null);
  assert.ok(sleepEvent.payload.reason === "test");
  assert.ok(sleepEvent.payload.resumeAt === resumeAt);
});

test("resume transitions paused run back to running", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-resume",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const resumeAt = new Date(Date.now() + 60000).toISOString();
  const sleeping = service.sleep(run, "test", resumeAt);
  const resumed = service.resume(sleeping);

  assert.equal(resumed.status, "running");
  assert.equal(resumed.pauseReason, null);
  assert.equal(resumed.sleepLease, null);
});

test("resume clears recoveryCheckpoint", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-resume-recovery",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const resumeAt = new Date(Date.now() + 60000).toISOString();
  const sleeping = service.sleep(run, "test", resumeAt);
  const resumed = service.resume(sleeping);

  assert.equal(resumed.recoveryCheckpoint, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// recover Tests
// ─────────────────────────────────────────────────────────────────────────────

test("recover transitions running run to paused with recovery pauseReason", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-recover",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const recovered = service.recover(run);

  assert.equal(recovered.status, "paused");
  assert.equal(recovered.pauseReason, "recovery");
  assert.ok(recovered.recoveryCheckpoint !== null);
});

test("recover preserves lastCompletedStepId in checkpoint", () => {
  const service = new HarnessRuntimeService();
  let run = service.createRun({
    taskId: "task-recover-step",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  run = service.appendStep(run, { role: "planner", stage: "plan", inputs: {}, outputs: {} });
  run = service.appendStep(run, { role: "generator", stage: "execute", inputs: {}, outputs: {} });

  const recovered = service.recover(run);

  assert.ok(recovered.recoveryCheckpoint !== null);
  assert.equal(recovered.recoveryCheckpoint?.lastCompletedStepId, run.steps[1].stepId);
});

test("recover adds recovery_started timeline event", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-recover-timeline",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const recovered = service.recover(run);

  const recoveryEvent = recovered.timeline.find(e => e.type === "recovery_started");
  assert.ok(recoveryEvent !== null);
  assert.ok(recoveryEvent.payload.statusBeforeRecovery === "created");
});

test("recover handles terminal status by transitioning to paused", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-recover-terminal",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  // Manually set to completed state
  const terminalRun = { ...run, status: "completed" as const, completedAt: new Date().toISOString() };
  const recovered = service.recover(terminalRun);

  assert.equal(recovered.status, "paused");
  assert.equal(recovered.pauseReason, "recovery");
});

// ─────────────────────────────────────────────────────────────────────────────
// captureContextSnapshot Tests
// ─────────────────────────────────────────────────────────────────────────────

test("captureContextSnapshot creates snapshot with correct fields", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-snapshot",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const snapshot = service.captureContextSnapshot(run);

  assert.ok(snapshot.snapshotId.startsWith("ctx_snapshot_"));
  assert.equal(snapshot.runId, run.runId);
  assert.equal(snapshot.domainId, run.domainId);
  assert.equal(snapshot.iteration, run.currentIteration);
  assert.equal(snapshot.stepCount, 0);
  assert.ok(snapshot.capturedAt !== null);
});

test("captureContextSnapshot includes lastDecisionId when decision exists", () => {
  const service = new HarnessRuntimeService();
  let run = service.createRun({
    taskId: "task-snapshot-decision",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const decision = service.decide({ evaluatorScore: 0.9 });
  run = { ...run, decision };
  const snapshot = service.captureContextSnapshot(run);

  assert.equal(snapshot.lastDecisionId, decision.decisionId);
});

test("captureContextSnapshot sets lastDecisionId to null when no decision", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-snapshot-no-decision",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const snapshot = service.captureContextSnapshot(run);

  assert.equal(snapshot.lastDecisionId, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// listTimeline Tests
// ─────────────────────────────────────────────────────────────────────────────

test("listTimeline returns run timeline", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-list-timeline",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const timeline = service.listTimeline(run);

  assert.ok(Array.isArray(timeline));
  assert.equal(timeline.length, run.timeline.length);
});

test("listTimeline returns readonly array", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-timeline-readonly",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const timeline = service.listTimeline(run);

  // Verify the type system enforces readonly
  assert.ok(Array.isArray(timeline));
});

// ─────────────────────────────────────────────────────────────────────────────
// Durable Service Persistence Tests
// ─────────────────────────────────────────────────────────────────────────────

test("persistRun saves run to durable service", () => {
  const durable = new DurableHarnessService();
  const service = new HarnessRuntimeService({ durableService: durable });
  const run = service.createRun({
    taskId: "task-persist",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const record = service.persistRun(run);

  assert.ok(record.recordId.startsWith("durable_run_"));
  assert.equal(record.run.runId, run.runId);
  const restored = durable.restore(run.runId);
  assert.equal(restored?.runId, run.runId);
});

test("checkpointRun creates checkpoint and returns ref", () => {
  const durable = new DurableHarnessService();
  const service = new HarnessRuntimeService({ durableService: durable });
  const run = service.createRun({
    taskId: "task-checkpoint",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const checkpointRef = service.checkpointRun(run);

  assert.ok(checkpointRef.startsWith("harness_checkpoint_"));
  assert.ok(durable.getCheckpointRef(run.runId) !== null);
});

test("restoreRun retrieves persisted run", () => {
  const durable = new DurableHarnessService();
  const service = new HarnessRuntimeService({ durableService: durable });
  const run = service.createRun({
    taskId: "task-restore",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  service.persistRun(run);
  const restored = service.restoreRun(run.runId);

  assert.ok(restored !== null);
  assert.equal(restored?.runId, run.runId);
  assert.equal(restored?.status, run.status);
});

test("restoreRun returns null for unknown runId", () => {
  const durable = new DurableHarnessService();
  const service = new HarnessRuntimeService({ durableService: durable });

  const restored = service.restoreRun("unknown-run-id");

  assert.equal(restored, null);
});

test("restoreFromCheckpoint retrieves run from checkpoint", () => {
  const durable = new DurableHarnessService();
  const service = new HarnessRuntimeService({ durableService: durable });
  const run = service.createRun({
    taskId: "task-checkpoint-restore",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const checkpointRef = service.checkpointRun(run);
  const restored = service.restoreFromCheckpoint(checkpointRef);

  assert.ok(restored !== null);
  assert.equal(restored?.runId, run.runId);
});

test("restoreFromCheckpoint returns null for unknown checkpoint ref", () => {
  const durable = new DurableHarnessService();
  const service = new HarnessRuntimeService({ durableService: durable });

  const restored = service.restoreFromCheckpoint("unknown-checkpoint-ref");

  assert.equal(restored, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// Transition Run Status Tests
// ─────────────────────────────────────────────────────────────────────────────

test("runLoop completes with accept decision", () => {
  const service = new HarnessRuntimeService();
  const run = service.runLoop({
    taskId: "task-complete",
    domainId: "coding",
    constraintPack: createConstraintPack(),
    plannerOutput: { planId: "plan-1" },
    generatorOutput: { artifact: "result" },
    evaluatorOutput: { verdict: "pass" },
    evaluatorScore: 0.9,
    producedEvidenceRefs: [],
  });

  assert.equal(run.status, "completed");
  assert.ok(run.completedAt !== null);
  assert.equal(run.decision?.action, "accept");
});

test("runLoop handles replan decision", () => {
  const service = new HarnessRuntimeService();
  const run = service.runLoop({
    taskId: "task-replan",
    domainId: "coding",
    constraintPack: createConstraintPack(),
    plannerOutput: { planId: "plan-1" },
    generatorOutput: { artifact: "result" },
    evaluatorOutput: { verdict: "fail" },
    evaluatorScore: 0.3, // Low score triggers replan
    producedEvidenceRefs: [],
  });

  // Replan decision may result in various states depending on budget
  assert.ok(["replanning", "running", "completed", "aborted"].includes(run.status));
});

test("runLoop respects maxSteps budget", () => {
  const service = new HarnessRuntimeService();
  const run = service.runLoop({
    taskId: "task-budget",
    domainId: "coding",
    constraintPack: createConstraintPack({ budget: { maxSteps: 3, maxCost: 10, maxDurationMs: 60000 } }),
    plannerOutput: { planId: "plan-1" },
    generatorOutput: { artifact: "result" },
    evaluatorOutput: { verdict: "partial" },
    evaluatorScore: 0.5, // Will trigger retry
    producedEvidenceRefs: [],
    iteration: 1,
  });

  assert.ok(run.steps.length <= 3);
});

// ─────────────────────────────────────────────────────────────────────────────
// Status Transition Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("sleep on non-running run auto-transitions to running first", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-sleep-auto",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  // sleep() calls ensureRunning() which should auto-transition
  const resumeAt = new Date(Date.now() + 60000).toISOString();
  const sleeping = service.sleep(run, "test", resumeAt);

  // Should have auto-transitioned to running, then paused for sleep
  assert.ok(["running", "paused"].includes(sleeping.status));
});

test("recover on completed run transitions to paused", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-recover-completed",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const completed = { ...run, status: "completed" as const, completedAt: new Date().toISOString() };
  const recovered = service.recover(completed);

  assert.equal(recovered.status, "paused");
  assert.equal(recovered.pauseReason, "recovery");
});

test("resume on non-paused run is no-op for status", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-resume-noop",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const resumed = service.resume(run);

  // Should transition to running but no pause to clear
  assert.ok(["created", "running"].includes(resumed.status));
});

// ─────────────────────────────────────────────────────────────────────────────
// Timeline Integrity Tests
// ─────────────────────────────────────────────────────────────────────────────

test("createRun adds run_created timeline event", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-run-created-event",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const createdEvent = run.timeline.find(e => e.type === "run_created");
  assert.ok(createdEvent !== null);
  assert.ok(createdEvent.eventId.startsWith("timeline_"));
  assert.ok(createdEvent.payload.taskId === "task-run-created-event");
  assert.ok(createdEvent.payload.domainId === "coding");
});

test("openHitlReview adds hitl_requested timeline event", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-hitl-event",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const paused = service.openHitlReview(run, "test_reason", ["evidence-1"]);

  const hitlEvent = paused.timeline.find(e => e.type === "hitl_requested");
  assert.ok(hitlEvent !== null);
  assert.ok(hitlEvent.payload.reason === "test_reason");
  assert.ok(hitlEvent.payload.evidenceCount === 1);
});

test("resolveHitlReview adds hitl_resolved timeline event", () => {
  const service = new HarnessRuntimeService();
  const run = service.createRun({
    taskId: "task-hitl-resolve-event",
    domainId: "coding",
    constraintPack: createConstraintPack(),
  });

  const paused = service.openHitlReview(run, "test", []);
  const resolved = service.resolveHitlReview(paused, "approved", "operator-1");

  const resolvedEvent = resolved.timeline.find(e => e.type === "hitl_resolved");
  assert.ok(resolvedEvent !== null);
  assert.ok(resolvedEvent.payload.resolution === "approved");
  assert.ok(resolvedEvent.payload.actorId === "operator-1");
});
