// @ts-nocheck
/**
 * Integration Tests: Runtime Orchestration
 *
 * Tests orchestration-level integration between the harness runtime service,
 * workflow planner, and multi-step execution engine. Covers harness run creation,
 * step management, decision logic, sleep/resume, HITL escalation, and recovery.
 *
 * Uses SQLite with real storage backend for persistence tests.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { HarnessRuntimeService } from "../../../../src/platform/orchestration/harness/runtime/index.js";
import { WorkflowPlanner } from "../../../../src/platform/orchestration/routing/workflow-planner.js";
import { resetMultiStepToolRegistryForTests, runMultiStepOrchestration } from "../../../../src/platform/execution/execution-engine/multi-step-orchestration.js";
import { createTempWorkspace, cleanupPath } from "../../../helpers/fs.js";

function createOrchestrationDb(prefix) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "runtime-orchestration-integration.db");
  return { workspace, dbPath };
}

function makeConstraintPack(overrides = {}) {
  return {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "auto",
    toolPolicy: { allowedTools: ["tool1", "tool2"] },
    risk_policy: { maxRiskScore: 10, escalationThreshold: 7 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// HarnessRuntimeService lifecycle
// ---------------------------------------------------------------------------

test("createRun produces a HarnessRun with created status", () => {
  const harness = new HarnessRuntimeService();
  const run = harness.createRun({
    taskId: "task_001",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  assert.equal(run.status, "created");
  assert.equal(run.taskId, "task_001");
  assert.equal(run.domainId, "domain_test");
  assert.equal(run.steps.length, 0);
  assert.equal(run.maxIterations, 10);
  assert.equal(run.currentIteration, 0);
  assert.ok(run.runId.startsWith("harness_run_"));
  assert.ok(run.createdAt != null);
});

test("appendStep records step details without mutating lifecycle status", () => {
  const harness = new HarnessRuntimeService();
  let run = harness.createRun({
    taskId: "task_002",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  run = harness.appendStep(run, {
    role: "planner",
    stage: "plan",
    inputs: { taskId: "task_002" },
    outputs: { plan: "step_1_plan" },
  });

  assert.equal(run.status, "created");
  assert.equal(run.steps.length, 1);
  assert.equal(run.steps[0].role, "planner");
  assert.equal(run.steps[0].stage, "plan");
  assert.deepEqual(run.steps[0].inputs, { taskId: "task_002" });
  assert.deepEqual(run.steps[0].outputs, { plan: "step_1_plan" });
  assert.ok(run.timeline.some((e) => e.type === "step_completed"));
});

test("appendStep with explicit iteration uses that iteration value", () => {
  const harness = new HarnessRuntimeService();
  let run = harness.createRun({
    taskId: "task_003",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  run = harness.appendStep(run, {
    role: "generator",
    stage: "execute",
    inputs: {},
    outputs: {},
    iteration: 3,
  });

  assert.equal(run.steps[0].iteration, 3);
  assert.equal(run.currentIteration, 3);
});

test("createRun then appendStep maintains timeline event sequence", () => {
  const harness = new HarnessRuntimeService();
  let run = harness.createRun({
    taskId: "task_004",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  run = harness.appendStep(run, {
    role: "planner",
    stage: "plan",
    inputs: {},
    outputs: {},
  });

  run = harness.appendStep(run, {
    role: "generator",
    stage: "execute",
    inputs: {},
    outputs: {},
  });

  const timelineTypes = run.timeline.map((e) => e.type);
  assert.ok(timelineTypes.includes("run_created"));
  assert.ok(timelineTypes.includes("step_completed"));
  assert.equal(timelineTypes.filter((t) => t === "step_completed").length, 2);
});

// ---------------------------------------------------------------------------
// Decision logic
// ---------------------------------------------------------------------------

test("decide with high evaluatorScore returns accept", () => {
  const harness = new HarnessRuntimeService();
  const decision = harness.decide({ evaluatorScore: 0.9 });

  assert.equal(decision.action, "accept");
  assert.ok(decision.reasonCodes.includes("harness.accepted"));
  assert.ok(decision.confidence >= 0.8);
});

test("decide with medium evaluatorScore returns retry_same_plan", () => {
  const harness = new HarnessRuntimeService();
  const decision = harness.decide({ evaluatorScore: 0.6 });

  assert.equal(decision.action, "retry_same_plan");
  assert.ok(decision.reasonCodes.includes("harness.eval_below_accept_threshold"));
});

test("decide with low evaluatorScore returns replan", () => {
  const harness = new HarnessRuntimeService();
  const decision = harness.decide({ evaluatorScore: 0.3 });

  assert.equal(decision.action, "replan");
  assert.ok(decision.reasonCodes.includes("harness.eval_below_replan_threshold"));
});

test("decide with requiresHuman returns escalate_to_human", () => {
  const harness = new HarnessRuntimeService();
  const decision = harness.decide({ evaluatorScore: 0.8, requiresHuman: true });

  assert.equal(decision.action, "escalate_to_human");
  assert.ok(decision.reasonCodes.includes("harness.human_required"));
});

test("decide with maxIterationsReached returns abort", () => {
  const harness = new HarnessRuntimeService();
  const decision = harness.decide({ evaluatorScore: 0.5, maxIterationsReached: true });

  assert.equal(decision.action, "abort");
  assert.ok(decision.reasonCodes.includes("harness.max_iterations_reached"));
});

// ---------------------------------------------------------------------------
// Sleep and resume
// ---------------------------------------------------------------------------

test("sleep pauses a run and records lease", () => {
  const harness = new HarnessRuntimeService();
  let run = harness.createRun({
    taskId: "task_005",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  run = harness.sleep(run, "rate_limit_cooldown", "2026-04-26T00:00:00.000Z");

  assert.equal(run.status, "paused");
  assert.equal(run.pauseReason, "sleep");
  assert.ok(run.sleepLease != null);
  assert.equal(run.sleepLease.reason, "rate_limit_cooldown");
  assert.equal(run.sleepLease.resumeAt, "2026-04-26T00:00:00.000Z");
  assert.ok(run.timeline.some((e) => e.type === "sleep_started"));
});

test("resume clears sleepLease and returns to running", () => {
  const harness = new HarnessRuntimeService();
  let run = harness.createRun({
    taskId: "task_006",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  run = harness.sleep(run, "brief_pause", "2026-04-25T12:00:00.000Z");
  run = harness.resume(run);

  assert.equal(run.status, "running");
  assert.equal(run.sleepLease, null);
  assert.equal(run.recoveryCheckpoint, null);
});

// ---------------------------------------------------------------------------
// Recovery and checkpoint
// ---------------------------------------------------------------------------

test("recover pauses a run and records checkpoint", () => {
  const harness = new HarnessRuntimeService();
  let run = harness.createRun({
    taskId: "task_007",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  run = harness.appendStep(run, {
    role: "planner",
    stage: "plan",
    inputs: {},
    outputs: { plan: "done" },
  });

  run = harness.recover(run);

  assert.equal(run.status, "paused");
  assert.equal(run.pauseReason, "recovery");
  assert.ok(run.recoveryCheckpoint != null);
  assert.ok(run.recoveryCheckpoint.lastCompletedStepId != null);
  assert.equal(run.recoveryCheckpoint.statusBeforeRecovery, "created");
  assert.ok(run.timeline.some((e) => e.type === "recovery_started"));
});

test("resume after recover clears recoveryCheckpoint", () => {
  const harness = new HarnessRuntimeService();
  let run = harness.createRun({
    taskId: "task_008",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  run = harness.appendStep(run, {
    role: "planner",
    stage: "plan",
    inputs: {},
    outputs: {},
  });

  run = harness.recover(run);
  run = harness.resume(run);

  assert.equal(run.status, "running");
  assert.equal(run.recoveryCheckpoint, null);
});

// ---------------------------------------------------------------------------
// HITL escalation
// ---------------------------------------------------------------------------

test("openHitlReview pauses a run for hitl and records request", () => {
  const harness = new HarnessRuntimeService();
  let run = harness.createRun({
    taskId: "task_009",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  run = harness.openHitlReview(run, "requires_human_approval", ["evidence_ref_1"]);

  assert.equal(run.status, "paused");
  assert.equal(run.pauseReason, "hitl");
  assert.ok(run.hitlRequest != null);
  assert.equal(run.hitlRequest.reason, "requires_human_approval");
  assert.ok(run.timeline.some((e) => e.type === "hitl_requested"));
});

test("resolveHitlReview with approved returns to running", () => {
  const harness = new HarnessRuntimeService();
  let run = harness.createRun({
    taskId: "task_010",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  run = harness.openHitlReview(run, "operator_review", ["evidence_1"]);
  run = harness.resolveHitlReview(run, "approved", "operator_alice");

  assert.equal(run.status, "running");
  assert.ok(run.hitlRequest?.resolvedAt != null);
  assert.ok(run.timeline.some((e) => e.type === "hitl_resolved"));
});

test("resolveHitlReview with rejected transitions to aborted and sets completedAt", () => {
  const harness = new HarnessRuntimeService();
  let run = harness.createRun({
    taskId: "task_011",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  run = harness.openHitlReview(run, "operator_review", ["evidence_1"]);
  run = harness.resolveHitlReview(run, "rejected", "operator_bob");

  assert.equal(run.status, "aborted");
  assert.ok(run.completedAt != null);
});

test("resolveHitlReview throws when run has no hitlRequest", () => {
  const harness = new HarnessRuntimeService();
  let run = harness.createRun({
    taskId: "task_012",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  assert.throws(() => {
    harness.resolveHitlReview(run, "approved", "operator_charlie");
  }, /harness\.hitl\.request_not_found/);
});

// ---------------------------------------------------------------------------
// Context snapshots
// ---------------------------------------------------------------------------

test("captureContextSnapshot produces snapshot with runId and iteration", () => {
  const harness = new HarnessRuntimeService();
  let run = harness.createRun({
    taskId: "task_013",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  run = harness.appendStep(run, {
    role: "planner",
    stage: "plan",
    inputs: {},
    outputs: {},
    iteration: 2,
  });

  const snapshot = harness.captureContextSnapshot(run);

  assert.equal(snapshot.runId, run.runId);
  assert.equal(snapshot.domainId, run.domainId);
  assert.equal(snapshot.iteration, 2);
  assert.equal(snapshot.stepCount, 1);
  assert.ok(snapshot.snapshotId.startsWith("ctx_snapshot_"));
  assert.ok(snapshot.lastDecisionId == null); // no decision yet
});

test("snapshotContext after decision includes decisionId", () => {
  const harness = new HarnessRuntimeService();
  let run = harness.createRun({
    taskId: "task_014",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  const decision = harness.decide({ evaluatorScore: 0.85 });
  run = { ...run, decision };

  const snapshot = harness.captureContextSnapshot(run);
  assert.equal(snapshot.lastDecisionId, decision.decisionId);
});

// ---------------------------------------------------------------------------
// Memory management
// ---------------------------------------------------------------------------

test("writeMemory and readMemory persist data in run namespace", () => {
  const harness = new HarnessRuntimeService();
  let run = harness.createRun({
    taskId: "task_015",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  harness.writeMemory(run, "run", "last_plan", { steps: ["a", "b"] });
  const value = harness.readMemory(run, "run", "last_plan");

  assert.deepEqual(value, { steps: ["a", "b"] });
});

test("writeMemory and readMemory persist data in domain namespace", () => {
  const harness = new HarnessRuntimeService();
  let run = harness.createRun({
    taskId: "task_016",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  harness.writeMemory(run, "domain", "shared_state", "shared_value");
  const value = harness.readMemory(run, "domain", "shared_state");

  assert.equal(value, "shared_value");
});

// ---------------------------------------------------------------------------
// Invariant assertions
// ---------------------------------------------------------------------------

test("assertInvariants returns empty violations for valid run", () => {
  const harness = new HarnessRuntimeService();
  const run = harness.createRun({
    taskId: "task_017",
    domainId: "domain_test",
    constraintPack: makeConstraintPack({ budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 } }),
  });

  const result = harness.assertInvariants(run);
  assert.equal(result.violations.length, 0);
});

test("assertInvariants detects iteration exceeding budget", () => {
  const harness = new HarnessRuntimeService();
  let run = harness.createRun({
    taskId: "task_018",
    domainId: "domain_test",
    constraintPack: makeConstraintPack({ budget: { maxSteps: 5, maxCost: 100, maxDurationMs: 60000 } }),
  });

  run = {
    ...run,
    currentIteration: 10,
    loopMetrics: {
      ...run.loopMetrics,
      iterationCount: 10,
    },
  };

  const result = harness.assertInvariants(run);
  assert.ok(result.violations.some((v) => v.includes("iteration_exceeds_budget")));
});

test("assertInvariants detects replan count exceeding budget", () => {
  const harness = new HarnessRuntimeService();
  let run = harness.createRun({
    taskId: "task_019",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  run = {
    ...run,
    loopMetrics: { iterationCount: 1, replanCount: 5, totalCost: 10, durationMs: 1000, maxIterations: 10, maxCost: 100, maxDurationMs: 60000 },
  };

  const result = harness.assertInvariants(run);
  assert.ok(result.violations.some((v) => v.includes("replan_count_exceeds_budget")));
});

test("assertInvariants detects hitl pause without hitlRequest", () => {
  const harness = new HarnessRuntimeService();
  let run = harness.createRun({
    taskId: "task_020",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  run = { ...run, status: "paused", pauseReason: "hitl", hitlRequest: null };

  const result = harness.assertInvariants(run);
  assert.ok(result.violations.some((v) => v.includes("waiting_hitl_requires_request")));
});

test("assertInvariants detects completed run without completedAt", () => {
  const harness = new HarnessRuntimeService();
  let run = harness.createRun({
    taskId: "task_021",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  run = { ...run, status: "completed", completedAt: null };

  const result = harness.assertInvariants(run);
  assert.ok(result.violations.some((v) => v.includes("final_state_requires_completed_at")));
});

// ---------------------------------------------------------------------------
// WorkflowPlanner integration
// ---------------------------------------------------------------------------

test("WorkflowPlanner.plan produces PlannedWorkflow with executionSteps", () => {
  const planner = new WorkflowPlanner();

  const planned = planner.plan({
    workflowId: "single_agent_minimal",
    request: "Test request",
  });

  assert.ok(planned.workflow != null);
  assert.ok(planned.executionSteps.length >= 1);
  assert.ok(planned.dependencyEdges != null);
  assert.ok(planned.planReason != null);
});

test("WorkflowPlanner.plan with single_agent_minimal produces expected step structure", () => {
  const planner = new WorkflowPlanner();

  const planned = planner.plan({
    workflowId: "single_agent_minimal",
    request: "Analyze this",
  });

  const step = planned.executionSteps[0];
  assert.ok(step.stepId != null);
  assert.ok(step.roleId != null);
  assert.ok(step.agentId.startsWith("agent_"));
  assert.ok(step.outputKey != null);
  assert.ok(typeof step.timeoutMs === "number");
  assert.ok(typeof step.maxAttempts === "number");
});

test("WorkflowPlanner.plan sets dependency edges for multi-step workflows", () => {
  const planner = new WorkflowPlanner();

  const planned = planner.plan({
    workflowId: "single_division_multi_step_orchestration",
    request: "Multi-step request",
  });

  assert.ok(planned.executionSteps.length > 1);
  assert.ok(Array.isArray(planned.dependencyEdges));
  assert.ok(planned.dependencyEdges.length > 0);
});

// ---------------------------------------------------------------------------
// runLoop integration
// ---------------------------------------------------------------------------

test("runLoop with high score completes with accept decision", () => {
  const harness = new HarnessRuntimeService();
  const run = harness.runLoop({
    taskId: "task_022",
    domainId: "domain_test",
    constraintPack: makeConstraintPack({ budget: { maxSteps: 5, maxCost: 50, maxDurationMs: 30000 } }),
    plannerOutput: { plan: "step_plan", costUsd: 5 },
    generatorOutput: { result: "generated", costUsd: 10 },
    evaluatorOutput: { score: 0.95 },
    evaluatorScore: 0.95,
  });

  assert.equal(run.decision?.action, "accept");
  assert.equal(run.status, "completed");
  assert.ok(run.completedAt != null);
});

test("runLoop with repeated low score eventually aborts after exhausting replan guards", () => {
  const harness = new HarnessRuntimeService();
  const run = harness.runLoop({
    taskId: "task_023",
    domainId: "domain_test",
    constraintPack: makeConstraintPack({ budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 } }),
    plannerOutput: { plan: "plan_a", costUsd: 5 },
    generatorOutput: { result: "result_a", costUsd: 10 },
    evaluatorOutput: { score: 0.3 },
    evaluatorScore: 0.3,
  });

  assert.equal(run.status, "aborted");
  assert.equal(run.decision?.action, "abort");
  assert.ok(run.feedbackEnvelope != null);
});

test("runLoop records feedbackEnvelope with signals and learnedActions", () => {
  const harness = new HarnessRuntimeService();
  const run = harness.runLoop({
    taskId: "task_024",
    domainId: "domain_test",
    constraintPack: makeConstraintPack({ budget: { maxSteps: 5, maxCost: 50, maxDurationMs: 30000 } }),
    plannerOutput: { plan: "final_plan", costUsd: 5 },
    generatorOutput: { result: "final_result", costUsd: 10 },
    evaluatorOutput: { score: 0.9 },
    evaluatorScore: 0.9,
    producedEvidenceRefs: ["evidence_1", "evidence_2"],
  });

  assert.ok(run.feedbackEnvelope != null);
  assert.ok(run.feedbackEnvelope.signals.length >= 1);
  assert.ok(run.feedbackEnvelope.learnedActions != null);
});

test("runLoop captures context snapshots", () => {
  const harness = new HarnessRuntimeService();
  const run = harness.runLoop({
    taskId: "task_025",
    domainId: "domain_test",
    constraintPack: makeConstraintPack({ budget: { maxSteps: 5, maxCost: 50, maxDurationMs: 30000 } }),
    plannerOutput: { plan: "snapshot_test", costUsd: 5 },
    generatorOutput: { result: "result", costUsd: 10 },
    evaluatorOutput: { score: 0.85 },
    evaluatorScore: 0.85,
  });

  assert.ok(run.contextSnapshots.length >= 1);
  const snapshot = run.contextSnapshots[0];
  assert.ok(snapshot.snapshotId.startsWith("ctx_snapshot_"));
  assert.equal(snapshot.runId, run.runId);
});

// ---------------------------------------------------------------------------
// Persistence integration
// ---------------------------------------------------------------------------

test("persistRun and restoreRun recover identical run state", () => {
  const harness = new HarnessRuntimeService();
  let run = harness.createRun({
    taskId: "task_026",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  run = harness.appendStep(run, {
    role: "planner",
    stage: "plan",
    inputs: { original: true },
    outputs: { planned: true },
  });

  harness.persistRun(run);
  const restored = harness.restoreRun(run.runId);

  assert.ok(restored != null);
  assert.equal(restored.runId, run.runId);
  assert.equal(restored.steps.length, run.steps.length);
  assert.equal(restored.taskId, run.taskId);
});

test("checkpointRun and restoreRunFromCheckpoint recover run", () => {
  const harness = new HarnessRuntimeService();
  let run = harness.createRun({
    taskId: "task_027",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  run = harness.appendStep(run, {
    role: "generator",
    stage: "execute",
    inputs: {},
    outputs: { generated: true },
  });

  const checkpointRef = harness.checkpointRun(run);
  const restored = harness.restoreFromCheckpoint(checkpointRef);

  assert.ok(restored != null);
  assert.equal(restored.steps.length, run.steps.length);
});

test("persistRun throws on invariant violation", () => {
  const harness = new HarnessRuntimeService();
  let run = harness.createRun({
    taskId: "task_028",
    domainId: "domain_test",
    constraintPack: makeConstraintPack({ budget: { maxSteps: 5, maxCost: 100, maxDurationMs: 60000 } }),
  });

  run = {
    ...run,
    currentIteration: 20,
    loopMetrics: {
      ...run.loopMetrics,
      iterationCount: 20,
    },
  };

  assert.throws(() => {
    harness.persistRun(run);
  }, /harness\.invariant_violation/);
});

// ---------------------------------------------------------------------------
// Timeline queries
// ---------------------------------------------------------------------------

test("listTimeline returns all timeline events in order", () => {
  const harness = new HarnessRuntimeService();
  let run = harness.createRun({
    taskId: "task_029",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  run = harness.appendStep(run, { role: "planner", stage: "plan", inputs: {}, outputs: {} });
  run = harness.appendStep(run, { role: "generator", stage: "execute", inputs: {}, outputs: {} });

  const timeline = harness.listTimeline(run);
  assert.equal(timeline.length, run.timeline.length);
  assert.ok(timeline.every((e) => e.runId === run.runId));
});

// ---------------------------------------------------------------------------
// Multi-step orchestration with harness integration
// ---------------------------------------------------------------------------

test("runMultiStepOrchestration result contains routing and plannedWorkflow for orchestration", async () => {
  resetMultiStepToolRegistryForTests();
  const { workspace, dbPath } = createOrchestrationDb("aa-int-orch-multi-");
  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Orchestration Integration Test",
      request: "Execute and verify orchestration structure",
    });

    assert.ok(result.routing.workflowId != null);
    assert.ok(result.routing.divisionId != null);
    assert.ok(result.plannedWorkflow.executionSteps != null);
    assert.ok(result.plannedWorkflow.dependencyEdges != null);

    // Verify workflow can be used with harness
    const planner = new WorkflowPlanner();
    const planned = planner.plan({
      workflowId: result.routing.workflowId,
      request: "Replan from orchestration",
    });
    assert.ok(planned.executionSteps.length >= 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("runMultiStepOrchestration produces streamFrames for observability", async () => {
  resetMultiStepToolRegistryForTests();
  const { workspace, dbPath } = createOrchestrationDb("aa-int-orch-frames-");
  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Stream Frames Test",
      request: "Generate observable output",
    });

    assert.ok(Array.isArray(result.streamFrames));
  } finally {
    cleanupPath(workspace);
  }
});

test("runMultiStepOrchestration with compaction returns compaction result", async () => {
  resetMultiStepToolRegistryForTests();
  const { workspace, dbPath } = createOrchestrationDb("aa-int-orch-compact-");
  try {
    const result = await runMultiStepOrchestration({
      dbPath,
      title: "Context Compaction Test",
      request: "Test with context budget",
      contextBudgetTokens: 1000,
    });

    // Compaction may be null if not triggered, but result should be present
    assert.ok("compaction" in result);
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Integration: Harness + Multi-step orchestration
// ---------------------------------------------------------------------------

test("HarnessRun can be created from task snapshot of runSingleTaskExecution", async () => {
  const { workspace, dbPath } = createOrchestrationDb("aa-int-orch-harness-from-task-");

  // Import here to avoid cross-import issues
  const { runSingleTaskExecution } = await import("../../../../src/platform/execution/execution-engine/single-task-happy-path.js");

  const snapshot = await runSingleTaskExecution({
    dbPath,
    title: "Harness Task Source",
    request: "Create task for harness mapping",
    stepOutputOverride: { result: "done" },
  });

  const harness = new HarnessRuntimeService();
  let run = harness.createRun({
    taskId: snapshot.task.id,
    domainId: snapshot.task.divisionId,
    constraintPack: makeConstraintPack(),
  });

  run = harness.appendStep(run, {
    role: "planner",
    stage: "plan",
    inputs: { sourceTask: snapshot.task.id },
    outputs: { plan: "from_task_snapshot" },
  });

  assert.equal(run.steps.length, 1);
  assert.equal(run.taskId, snapshot.task.id);

  cleanupPath(workspace);
});

test("HarnessRuntimeService handles tool timeout with graceful recovery", () => {
  const harness = new HarnessRuntimeService();
  let run = harness.createRun({
    taskId: "task_fail_001",
    domainId: "domain_test",
    constraintPack: makeConstraintPack(),
  });

  run = harness.appendStep(run, {
    role: "generator",
    stage: "execute",
    inputs: {},
    outputs: { partial: true },
  });

  const afterFailure = harness.handleFailure(run, "tool_timeout");
  assert.equal(afterFailure.status, "running");
  assert.equal(afterFailure.recoveryCheckpoint, null);
});
