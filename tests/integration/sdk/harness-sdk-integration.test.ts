/**
 * SDK/CLI Integration Tests - Harness SDK
 *
 * Tests the harness SDK: createRun, appendStep, sleep/resume, HITL, durable persistence
 */

import assert from "node:assert/strict";
import test from "node:test";

import { DatabaseSync } from "node:sqlite";
import { HarnessSdk } from "../../../src/sdk/harness-sdk/index.js";
import { SqliteDurableHarnessStore } from "../../../src/platform/orchestration/harness/durable/durable-harness-service.js";
import { nowIso } from "../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createTempWorkspace } from "../../../tests/helpers/fs.js";
import { join } from "node:path";

function makeConstraintPack(): {
  constraintPack: {
    policyIds: readonly string[];
    approvalMode: "none" | "required" | "supervised";
    autonomyMode: "manual" | "supervised" | "auto" | "full_auto";
    toolPolicy: { allowedTools: readonly string[] };
    risk_policy: { maxRiskScore: number; escalationThreshold: number };
    output_policy: { requiredEvidence: readonly string[]; redactSensitiveData: boolean };
    budget: { maxSteps: number; maxCost: number; maxDurationMs: number };
  };
} {
  return {
    constraintPack: {
      policyIds: ["default_policy"],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: ["bash", "read", "write"] },
      risk_policy: { maxRiskScore: 8, escalationThreshold: 7 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 100, maxDurationMs: 300000 },
    },
  };
}

test("harness SDK: createRun produces a run with initial state", () => {
  const sdk = new HarnessSdk();
  const run = sdk.createRun({
    taskId: "task-harness-001",
    domainId: "domain_test",
    ...makeConstraintPack(),
  });

  assert.ok(run.runId);
  assert.equal(run.taskId, "task-harness-001");
  assert.equal(run.domainId, "domain_test");
  assert.equal(run.status, "created");
  assert.equal(run.steps.length, 0);
  assert.ok(run.createdAt);
  assert.equal(run.completedAt, null);
});

test("harness SDK: appendStep adds a step to the run and updates iteration tracking", () => {
  const sdk = new HarnessSdk();
  let run = sdk.createRun({
    taskId: "task-steps-001",
    domainId: "domain_steps",
    ...makeConstraintPack(),
  });

  run = sdk.appendStep(run, {
    role: "planner",
    stage: "plan",
    inputs: { prompt: "Generate a plan" },
    outputs: { plan: "Use tool X" },
    iteration: 1,
  });

  assert.equal(run.steps.length, 1);
  assert.equal(run.steps[0]!.role, "planner");
  assert.equal(run.steps[0]!.stage, "plan");
  assert.equal(run.steps[0]!.iteration, 1);
  assert.equal(run.currentIteration, 1);
});

test("harness SDK: appendStep tracks multiple steps across iterations", () => {
  const sdk = new HarnessSdk();
  let run = sdk.createRun({
    taskId: "task-multi-step",
    domainId: "domain_multi",
    ...makeConstraintPack(),
  });

  run = sdk.appendStep(run, { role: "planner", stage: "plan", inputs: {}, outputs: {} });
  run = sdk.appendStep(run, { role: "generator", stage: "execute", inputs: {}, outputs: {} });
  run = sdk.appendStep(run, { role: "evaluator", stage: "evaluate", inputs: {}, outputs: {} });

  assert.equal(run.steps.length, 3);
  assert.equal(run.steps[0]!.role, "planner");
  assert.equal(run.steps[1]!.role, "generator");
  assert.equal(run.steps[2]!.role, "evaluator");
});

test("harness SDK: decide produces decision based on evaluator score", () => {
  const sdk = new HarnessSdk();

  const acceptDecision = sdk.decide({ evaluatorScore: 0.9 });
  assert.equal(acceptDecision.action, "accept");
  assert.ok(acceptDecision.confidence > 0);

  const replanDecision = sdk.decide({ evaluatorScore: 0.4 });
  assert.equal(replanDecision.action, "replan");

  const abortDecision = sdk.decide({ evaluatorScore: 0.3, maxIterationsReached: true });
  assert.equal(abortDecision.action, "abort");

  const humanDecision = sdk.decide({ evaluatorScore: 0.8, requiresHuman: true });
  assert.equal(humanDecision.action, "escalate_to_human");
});

test("harness SDK: sleep/resume cycle transitions run through paused sleep and back to running", () => {
  const sdk = new HarnessSdk();
  let run = sdk.createRun({
    taskId: "task-sleep-001",
    domainId: "domain_sleep",
    ...makeConstraintPack(),
  });

  const resumeAt = new Date(Date.now() + 60000).toISOString();
  run = sdk.sleep(run, "waiting_for_resource", resumeAt);

  assert.equal(run.status, "paused");
  assert.equal(run.pauseReason, "sleep");
  assert.ok(run.sleepLease);
  assert.equal(run.sleepLease.reason, "waiting_for_resource");
  assert.equal(run.sleepLease.resumeAt, resumeAt);

  run = sdk.resume(run);
  assert.equal(run.status, "running");
  assert.equal(run.sleepLease, null);
});

test("harness SDK: requestHumanReview/resolveReview round-trip through paused hitl", () => {
  const sdk = new HarnessSdk();
  let run = sdk.createRun({
    taskId: "task-hitl-001",
    domainId: "domain_hitl",
    ...makeConstraintPack(),
  });

  run = sdk.requestHumanReview(run, "cost_exceeds_threshold", ["artifact://cost-report"]);
  assert.equal(run.status, "paused");
  assert.equal(run.pauseReason, "hitl");
  assert.ok(run.hitlRequest);
  assert.equal(run.hitlRequest.reason, "cost_exceeds_threshold");

  const resolvedRun = sdk.resolveReview(run, "approved", "reviewer-001");
  assert.equal(resolvedRun.status, "running");
  assert.ok(resolvedRun.hitlRequest!.resolvedAt);
  assert.equal(resolvedRun.hitlRequest!.status, "approved");

  // Test rejected resolution
  let run2 = sdk.createRun({
    taskId: "task-hitl-002",
    domainId: "domain_hitl",
    ...makeConstraintPack(),
  });
  run2 = sdk.requestHumanReview(run2, "security_concern", []);
  run2 = sdk.resolveReview(run2, "rejected", "reviewer-002");
  assert.equal(run2.status, "aborted");
});

test("harness SDK: getTimeline returns recorded events", () => {
  const sdk = new HarnessSdk();
  let run = sdk.createRun({
    taskId: "task-timeline-001",
    domainId: "domain_timeline",
    ...makeConstraintPack(),
  });

  run = sdk.appendStep(run, { role: "planner", stage: "plan", inputs: {}, outputs: {} });
  const timeline = sdk.getTimeline(run);

  assert.ok(timeline.length >= 1);
  const runCreatedEvents = timeline.filter((e) => e.type === "run_created");
  assert.equal(runCreatedEvents.length, 1);
});

test("harness SDK: persist and restore round-trip through in-memory store", () => {
  const sdk = new HarnessSdk();
  let run = sdk.createRun({
    taskId: "task-persist-001",
    domainId: "domain_persist",
    ...makeConstraintPack(),
  });

  run = sdk.appendStep(run, { role: "planner", stage: "plan", inputs: {}, outputs: {} });
  run = sdk.persist(run);

  const restored = sdk.restore(run.runId);
  assert.ok(restored !== null);
  assert.equal(restored.runId, run.runId);
  assert.equal(restored.steps.length, 1);
});

test("harness SDK: checkpoint and restoreFromCheckpoint round-trip", () => {
  const sdk = new HarnessSdk();
  let run = sdk.createRun({
    taskId: "task-checkpoint-001",
    domainId: "domain_checkpoint",
    ...makeConstraintPack(),
  });

  run = sdk.appendStep(run, { role: "planner", stage: "plan", inputs: {}, outputs: {} });
  run = sdk.appendStep(run, { role: "generator", stage: "execute", inputs: {}, outputs: {} });

  const checkpointRef = sdk.checkpoint(run);
  assert.ok(checkpointRef);

  const restored = sdk.restoreFromCheckpoint(checkpointRef);
  assert.ok(restored !== null);
  assert.equal(restored.runId, run.runId);
  assert.equal(restored.steps.length, 2);
});

test("harness SDK: assertInvariants returns empty violations for valid run", () => {
  const sdk = new HarnessSdk();
  let run = sdk.createRun({
    taskId: "task-assert-001",
    domainId: "domain_assert",
    ...makeConstraintPack(),
  });

  run = sdk.appendStep(run, { role: "planner", stage: "plan", inputs: {}, outputs: {} });

  const result = sdk.assertInvariants(run);
  assert.deepEqual(result.violations, []);
});

test("harness SDK: assertInvariants reports violations for runs exceeding budget", () => {
  const sdk = new HarnessSdk();
  let run = sdk.createRun({
    taskId: "task-violation-001",
    domainId: "domain_violation",
    ...makeConstraintPack(),
  });

  // Simulate a run with exceeded iteration count by patching
  run = sdk.appendStep(run, { role: "planner", stage: "plan", inputs: {}, outputs: {} });
  run = sdk.appendStep(run, { role: "generator", stage: "execute", inputs: {}, outputs: {} });
  run = sdk.appendStep(run, { role: "evaluator", stage: "evaluate", inputs: {}, outputs: {} });

  // Modify loopMetrics to exceed budget
  run = {
    ...run,
    loopMetrics: {
      iterationCount: 100,
      replanCount: 10,
      totalCost: 1000,
      durationMs: 1000000,
      maxIterations: 10,
      maxCost: 100,
      maxDurationMs: 300000,
    },
  };

  const result = sdk.assertInvariants(run);
  assert.ok(result.violations.length > 0);
  assert.ok(result.violations.some((v) => v.includes("iteration_exceeds_budget") || v.includes("total_cost_exceeds_budget")));
});

test("harness SDK: durable store integration - SqliteDurableHarnessStore persist and restore", () => {
  const workspace = createTempWorkspace("aa-harness-durable-");
  const dbPath = join(workspace, "harness-durable.db");

  try {
    const db = new DatabaseSync(dbPath);
    const store = new SqliteDurableHarnessStore(db);

    const sdk = new HarnessSdk();
    let run = sdk.createRun({
      taskId: "task-durable-sqlite",
      domainId: "domain_durable_sqlite",
      ...makeConstraintPack(),
    });

    run = sdk.appendStep(run, { role: "planner", stage: "plan", inputs: {}, outputs: {} });
    run = sdk.appendStep(run, { role: "generator", stage: "execute", inputs: {}, outputs: {} });

    // Persist via direct store (SDK persist uses its own store, test the underlying store directly)
    store.saveRecord({
      recordId: "rec_001",
      run,
      checkpointRef: null,
      persistedAt: nowIso(),
    });

    const restored = store.getRecord(run.runId);
    assert.ok(restored !== null);
    assert.equal(restored.run.runId, run.runId);
    assert.equal(restored.run.steps.length, 2);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("harness SDK: restore returns null for unknown runId", () => {
  const sdk = new HarnessSdk();
  const restored = sdk.restore("nonexistent-run-id");
  assert.equal(restored, null);
});

test("harness SDK: restoreFromCheckpoint returns null for unknown checkpoint", () => {
  const sdk = new HarnessSdk();
  const restored = sdk.restoreFromCheckpoint("nonexistent-checkpoint");
  assert.equal(restored, null);
});
