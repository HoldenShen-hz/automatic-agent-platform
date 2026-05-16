/**
 * Integration Tests: HarnessRuntimeService
 *
 * Tests HarnessRuntimeService with SQLite integration context,
 * verifying run creation, step progression, sleep/resume, HITL, and durable persistence.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { HarnessRuntimeService, type ConstraintPack } from "../../../../../src/platform/five-plane-orchestration/harness/index.js";
import { DurableHarnessService } from "../../../../../src/platform/five-plane-orchestration/harness/durable/durable-harness-service.js";
import { SqliteDurableHarnessStore } from "../../../../../src/platform/five-plane-orchestration/harness/durable/durable-harness-service.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import { DatabaseSync } from "node:sqlite";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

function createConstraintPack(overrides = {}): ConstraintPack {
  return {
    policyIds: [],
    approvalMode: "none",
    autonomyMode: "auto",
    tool_policy: { allowedTools: ["bash", "read", "write"] },
    risk_policy: { maxRiskScore: 10, escalationThreshold: 7 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 60000 },
    ...overrides,
  };
}

test("HarnessRuntimeService integration: create run with plan graph bundle", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  const run = service.createRun({
    taskId: "int-task-001",
    domainId: "coding",
    constraintPack,
  });

  assert.equal(run.status, "created");
  assert.ok(run.planGraphBundle != null);
  assert.ok(run.planGraphBundle.graph.nodes.length >= 3); // planner, generator, evaluator
  assert.equal(run.planGraphBundle.harnessRunId, run.harnessRunId);
});

test("HarnessRuntimeService integration: appendStep creates timeline events", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "int-task-002",
    domainId: "coding",
    constraintPack,
  });

  const timelineLengthBefore = run.timeline.length;
  run = service.appendStep(run, {
    role: "planner",
    stage: "plan",
    inputs: { taskId: "int-task-002" },
    outputs: { planId: "plan-001" },
  });

  assert.ok(run.timeline.length > timelineLengthBefore);
  const stepEvent = run.timeline.find((e) => e.type === "step_completed");
  assert.ok(stepEvent != null);
  assert.equal(stepEvent.payload.role, "planner");
});

test("HarnessRuntimeService integration: sleep creates pause with lease", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "int-task-003",
    domainId: "coding",
    constraintPack,
  });

  const resumeAt = new Date(Date.now() + 30000).toISOString();
  run = service.sleep(run, "Rate limited by external API", resumeAt);

  assert.equal(run.status, "paused");
  assert.equal(run.pauseReason, "sleep");
  assert.ok(run.sleepLease != null);
  assert.equal(run.sleepLease.reason, "Rate limited by external API");
  assert.ok(run.sleepLease.leaseId.startsWith("sleep_lease_"));
});

test("HarnessRuntimeService integration: resume clears sleep state", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "int-task-004",
    domainId: "coding",
    constraintPack,
  });

  const resumeAt = new Date(Date.now() + 30000).toISOString();
  run = service.sleep(run, "Temporary hold", resumeAt);
  assert.equal(run.status, "paused");

  run = service.resume(run);
  assert.equal(run.status, "running");
  assert.equal(run.pauseReason, null);
  assert.equal(run.sleepLease, null);
});

test("HarnessRuntimeService integration: recover creates checkpoint", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "int-task-005",
    domainId: "coding",
    constraintPack,
  });

  run = service.recover(run);

  assert.equal(run.status, "paused");
  assert.equal(run.pauseReason, "recovery");
  assert.ok(run.recoveryCheckpoint != null);
  assert.ok(run.recoveryCheckpoint.checkpointId.startsWith("harness_checkpoint_"));
  assert.equal(run.recoveryCheckpoint.runId, run.runId);
});

test("HarnessRuntimeService integration: openHitlReview pauses with HITL request", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "int-task-006",
    domainId: "coding",
    constraintPack,
  });

  run = service.openHitlReview(run, "Manual approval required for production deployment", ["evidence-1", "evidence-2"]);

  assert.equal(run.status, "paused");
  assert.equal(run.pauseReason, "hitl");
  assert.ok(run.hitlRequest != null);
  assert.equal(run.hitlRequest.requestId.startsWith("hitl_request_"), true);
  assert.equal(run.hitlRequest.reason, "Manual approval required for production deployment");
});

test("HarnessRuntimeService integration: resolveHitlReview approved resumes execution", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "int-task-007",
    domainId: "coding",
    constraintPack,
  });

  run = service.openHitlReview(run, "Need approval", ["evidence-1"]);
  run = service.resolveHitlReview(run, "approved", "operator-001");

  assert.equal(run.status, "running");
  assert.equal(run.pauseReason, null);
  assert.equal(run.hitlRequest?.status, "approved");
  assert.equal(run.hitlRequest?.resolvedBy, "operator-001");
});

test("HarnessRuntimeService integration: resolveHitlReview rejected aborts execution", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "int-task-008",
    domainId: "coding",
    constraintPack,
  });

  run = service.openHitlReview(run, "Need approval", ["evidence-1"]);
  run = service.resolveHitlReview(run, "rejected", "operator-002");

  assert.equal(run.status, "cancelled");
  assert.ok(run.completedAt != null);
});

test("HarnessRuntimeService integration: persistRun saves to durable service", () => {
  const durableService = new DurableHarnessService();
  const service = new HarnessRuntimeService({ durableService });
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "int-task-009",
    domainId: "coding",
    constraintPack,
  });

  run = service.appendStep(run, {
    role: "planner",
    stage: "plan",
    inputs: {},
    outputs: { planId: "plan-001" },
  });

  const record = service.persistRun(run);
  assert.ok(record != null);

  const restored = service.restoreRun(run.runId);
  assert.ok(restored != null);
  assert.equal(restored.runId, run.runId);
  assert.equal(restored.steps.length, run.steps.length);
});

test("HarnessRuntimeService integration: checkpointRun creates recoverable checkpoint", () => {
  const durableService = new DurableHarnessService();
  const service = new HarnessRuntimeService({ durableService });
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "int-task-010",
    domainId: "coding",
    constraintPack,
  });

  run = service.appendStep(run, {
    role: "planner",
    stage: "plan",
    inputs: {},
    outputs: { planId: "plan-001" },
  });

  run = service.appendStep(run, {
    role: "generator",
    stage: "execute",
    inputs: {},
    outputs: {},
  });

  const checkpointRef = service.checkpointRun(run);
  assert.ok(checkpointRef.startsWith("harness_checkpoint_"));

  const restored = service.restoreFromCheckpoint(checkpointRef);
  assert.ok(restored != null);
  assert.equal(restored.runId, run.runId);
  assert.equal(restored.steps.length, run.steps.length);
});

test("HarnessRuntimeService integration: handleFailure with operator_abort", () => {
  const durableService = new DurableHarnessService();
  const service = new HarnessRuntimeService({ durableService });
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "int-task-011",
    domainId: "coding",
    constraintPack,
  });

  const result = service.handleFailure(run, "operator_abort");

  assert.equal(result.status, "aborted");
  assert.ok(result.completedAt != null);
});

test("HarnessRuntimeService integration: decide method with various inputs", () => {
  const service = new HarnessRuntimeService();

  // High score -> accept
  const decision1 = service.decide({ evaluatorScore: 0.9 });
  assert.equal(decision1.action, "accept");

  // Medium score -> retry
  const decision2 = service.decide({ evaluatorScore: 0.6 });
  assert.equal(decision2.action, "retry_same_plan");

  // Low score -> replan
  const decision3 = service.decide({ evaluatorScore: 0.3 });
  assert.equal(decision3.action, "replan");

  // Human required
  const decision4 = service.decide({ evaluatorScore: 0.8, requiresHuman: true });
  assert.equal(decision4.action, "escalate_to_human");

  // Max iterations reached
  const decision5 = service.decide({ evaluatorScore: 0.9, maxIterationsReached: true });
  assert.equal(decision5.action, "abort");
});

test("HarnessRuntimeService integration: runLoop completes happy path", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack({ budget: { maxSteps: 20, maxCost: 10, maxDurationMs: 120000 } });

  const result = service.runLoop({
    taskId: "int-task-loop-001",
    domainId: "coding",
    constraintPack,
    plannerOutput: { planId: "plan-loop-001" },
    generatorOutput: { stepOutputs: [], toolCalls: [] },
    evaluatorOutput: { score: 0.9, verdict: "accept" },
    evaluatorScore: 0.9,
  });

  assert.equal(result.status, "completed");
  assert.ok(result.steps.length >= 3); // planner, generator, evaluator
  assert.ok(result.decision != null);
  assert.equal(result.decision?.action, "accept");
});

test("HarnessRuntimeService integration: memory write and read", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "int-task-012",
    domainId: "coding",
    constraintPack,
  });

  service.writeMemory(run, "run", "counter", 42);
  service.writeMemory(run, "run", "state", { active: true });

  const counter = service.readMemory(run, "run", "counter");
  const state = service.readMemory(run, "run", "state");

  assert.equal(counter, 42);
  assert.deepEqual(state, { active: true });
});

test("HarnessRuntimeService integration: assertInvariants validates run state", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "int-task-013",
    domainId: "coding",
    constraintPack,
  });

  // Valid run should have no violations
  const result = service.assertInvariants(run);
  assert.ok(result.violations.length === 0, `Expected no violations, got: ${result.violations.join(", ")}`);
});

test("HarnessRuntimeService integration: evaluateRun delegates to eval service", () => {
  const service = new HarnessRuntimeService();
  const constraintPack = createConstraintPack();

  let run = service.createRun({
    taskId: "int-task-014",
    domainId: "coding",
    constraintPack,
  });

  run = service.appendStep(run, {
    role: "planner",
    stage: "plan",
    inputs: {},
    outputs: {},
  });

  const result = service.evaluateRun(run);
  assert.ok(result != null);
});

test("HarnessRuntimeService integration: createAsyncService returns functional async service", () => {
  const service = new HarnessRuntimeService();
  const asyncService = service.createAsyncService();

  assert.ok(asyncService != null);
  assert.equal(typeof asyncService.createRun, "function");
  assert.equal(typeof asyncService.execute, "function");
});
