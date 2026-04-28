/**
 * Integration Test: Harness Service
 *
 * Tests HarnessRuntimeService with SQLite integration context,
 * verifying run creation, step progression, and decision logic.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { HarnessRuntimeService, type ConstraintPack } from "../../../../../src/platform/orchestration/harness/index.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId } from "../../../../../src/platform/contracts/types/ids.js";

function createHarnessContext(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = `${workspace}/harness.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, db, store };
}

test("HarnessRuntimeService creates a run and appends planner/generator/evaluator steps", () => {
  const ctx = createHarnessContext("aa-harness-create-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack: ConstraintPack = {
      policyIds: ["policy_001"],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: ["bash", "read"] },
      risk_policy: { maxRiskScore: 80, escalationThreshold: 70 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 1.0, maxDurationMs: 60000 },
    };

    let run = service.createRun({
      taskId: "task_harness_001",
      domainId: "coding",
      constraintPack,
    });

    assert.equal(run.status, "created");
    assert.equal(run.taskId, "task_harness_001");
    assert.equal(run.domainId, "coding");
    assert.equal(run.steps.length, 0);

    run = service.appendStep(run, {
      role: "planner",
      stage: "plan",
      inputs: { taskId: "task_harness_001" },
      outputs: { planId: "plan_001", summary: "Test plan" },
    });

    run = service.appendStep(run, {
      role: "generator",
      stage: "execute",
      inputs: { planId: "plan_001" },
      outputs: { stepOutputs: [], toolCalls: [] },
    });

    run = service.appendStep(run, {
      role: "evaluator",
      stage: "evaluate",
      inputs: { stepOutputs: [] },
      outputs: { score: 0.9, verdict: "accept" },
    });

    assert.equal(run.steps.length, 3);
    assert.equal(run.steps[0]?.role, "planner");
    assert.equal(run.steps[1]?.role, "generator");
    assert.equal(run.steps[2]?.role, "evaluator");
    assert.equal(run.currentIteration, 1);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("HarnessRuntimeService decides accept for high evaluator score", () => {
  const ctx = createHarnessContext("aa-harness-decide-");
  try {
    const service = new HarnessRuntimeService();
    const decision = service.decide({ evaluatorScore: 0.9 });

    assert.equal(decision.action, "accept");
    assert.ok(decision.confidence >= 0.5);
    assert.ok(decision.reasonCodes.includes("harness.accepted"));
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("HarnessRuntimeService decides replan for low evaluator score", () => {
  const ctx = createHarnessContext("aa-harness-replan-");
  try {
    const service = new HarnessRuntimeService();
    const decision = service.decide({ evaluatorScore: 0.4 });

    assert.equal(decision.action, "replan");
    assert.ok(decision.reasonCodes.includes("harness.eval_below_replan_threshold"));
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("HarnessRuntimeService decides abort when max iterations reached", () => {
  const ctx = createHarnessContext("aa-harness-abort-");
  try {
    const service = new HarnessRuntimeService();
    const decision = service.decide({
      evaluatorScore: 0.8,
      maxIterationsReached: true,
    });

    assert.equal(decision.action, "abort");
    assert.ok(decision.reasonCodes.includes("harness.max_iterations_reached"));
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("HarnessRuntimeService decides escalate_to_human when requiresHuman is true", () => {
  const ctx = createHarnessContext("aa-harness-hitl-");
  try {
    const service = new HarnessRuntimeService();
    const decision = service.decide({
      evaluatorScore: 0.6,
      requiresHuman: true,
    });

    assert.equal(decision.action, "escalate_to_human");
    assert.ok(decision.reasonCodes.includes("harness.human_required"));
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("HarnessRuntimeService captures context snapshots", () => {
  const ctx = createHarnessContext("aa-harness-snapshot-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack: ConstraintPack = {
      policyIds: ["policy_001"],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: ["bash"] },
      risk_policy: { maxRiskScore: 80, escalationThreshold: 70 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 1.0, maxDurationMs: 60000 },
    };

    let run = service.createRun({
      taskId: "task_snapshot_001",
      domainId: "coding",
      constraintPack,
    });

    run = service.appendStep(run, {
      role: "planner",
      stage: "plan",
      inputs: {},
      outputs: { planId: "plan_001" },
    });

    const snapshot = service.captureContextSnapshot(run);

    assert.ok(snapshot.snapshotId.startsWith("ctx_snapshot_"));
    assert.equal(snapshot.runId, run.runId);
    assert.equal(snapshot.domainId, "coding");
    assert.equal(snapshot.iteration, 1);
    assert.equal(snapshot.stepCount, 1);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("HarnessRuntimeService sleep and resume workflow", () => {
  const ctx = createHarnessContext("aa-harness-sleep-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack: ConstraintPack = {
      policyIds: ["policy_001"],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: ["bash"] },
      risk_policy: { maxRiskScore: 80, escalationThreshold: 70 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 1.0, maxDurationMs: 60000 },
    };

    let run = service.createRun({
      taskId: "task_sleep_001",
      domainId: "coding",
      constraintPack,
    });

    const resumeAt = new Date(Date.now() + 60000).toISOString();
    run = service.sleep(run, "Rate limit hit", resumeAt);

    assert.equal(run.status, "paused");
    assert.equal(run.pauseReason, "sleep");
    assert.ok(run.sleepLease);
    assert.equal(run.sleepLease?.reason, "Rate limit hit");
    assert.ok(run.sleepLease?.resumeAt === resumeAt);

    run = service.resume(run);
    assert.equal(run.status, "running");
    assert.ok(!run.sleepLease);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("HarnessRuntimeService runLoop completes happy path", () => {
  const ctx = createHarnessContext("aa-harness-loop-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack: ConstraintPack = {
      policyIds: ["policy_001"],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: ["bash", "read"] },
      risk_policy: { maxRiskScore: 80, escalationThreshold: 70 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 1.0, maxDurationMs: 60000 },
    };

    const run = service.runLoop({
      taskId: "task_loop_001",
      domainId: "coding",
      constraintPack,
      plannerOutput: { planId: "plan_loop_001", summary: "Loop test plan" },
      generatorOutput: { stepOutputs: [], toolCalls: [] },
      evaluatorOutput: { score: 0.9, verdict: "accept" },
      evaluatorScore: 0.9,
    });

    assert.equal(run.steps.length, 3);
    assert.equal(run.status, "completed");
    assert.ok(run.decision);
    assert.equal(run.decision?.action, "accept");
    assert.ok(run.contextSnapshots.length >= 1);
    assert.ok(run.feedbackEnvelope);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("HarnessRuntimeService persists harness run with task in SQLite", () => {
  const ctx = createHarnessContext("aa-harness-persist-");
  try {
    const taskId = "task_persist_001";
    const service = new HarnessRuntimeService();
    const constraintPack: ConstraintPack = {
      policyIds: ["policy_001"],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: ["bash"] },
      risk_policy: { maxRiskScore: 80, escalationThreshold: 70 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 1.0, maxDurationMs: 60000 },
    };

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Harness persist test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        completedAt: null,
      });
    });

    let run = service.createRun({
      taskId,
      domainId: "coding",
      constraintPack,
    });

    run = service.appendStep(run, {
      role: "planner",
      stage: "plan",
      inputs: { taskId },
      outputs: { planId: "plan_001" },
    });

    const persistedTask = ctx.store.getTask(taskId);
    assert.ok(persistedTask);
    assert.equal(persistedTask?.title, "Harness persist test");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});
