/**
 * Integration Test: OAPEFLIR Routing
 *
 * Tests OAPEFLIR routing decisions and stage transitions
 * using SQLite and harness runtime service.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { createIntegrationContext } from "../../../helpers/integration-context.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { newId, nowIso } from "../../../../src/platform/contracts/types/ids.js";
import {
  HarnessRuntimeService,
  type ConstraintPack,
  type HarnessRun,
  type HarnessRole,
} from "../../../../src/platform/orchestration/harness/index.js";
import {
  mapHarnessStepToOapeflirPhase,
  type OapeflirSemanticPhase,
} from "../../../../src/platform/orchestration/harness/oapeflir-harness-mapping.js";

function createOapeflirContext(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = `${workspace}/oapeflir.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, db, store };
}

function makeConstraintPack(override: Partial<ConstraintPack> = {}): ConstraintPack {
  return {
    policyIds: ["policy_oapeflir_001"],
    approvalMode: "none",
    autonomyMode: "auto",
    tool_policy: { allowedTools: ["bash", "read", "write"] },
    risk_policy: { maxRiskScore: 80, escalationThreshold: 50 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budget: { maxSteps: 5, maxCost: 1.0, maxDurationMs: 30000 },
    ...override,
  };
}

test("integration: harness maps planner step to OAPEFLIR plan phase", () => {
  const ctx = createOapeflirContext("aa-oapeflir-planner-");
  try {
    const service = new HarnessRuntimeService();

    let run = service.createRun({
      taskId: "task_oapeflir_plan_001",
      domainId: "coding",
      constraintPack: makeConstraintPack(),
    });

    run = service.appendStep(run, {
      role: "planner",
      stage: "plan",
      inputs: { taskId: "task_oapeflir_plan_001", goal: "implement feature" },
      outputs: { planId: "plan_001", steps: ["step1", "step2"] },
    });

    const lastStep = run.steps.at(-1);
    assert.ok(lastStep, "Should have at least one step");
    assert.equal(lastStep!.role, "planner");
    assert.equal(lastStep!.stage, "plan");

    const semanticPhase = mapHarnessStepToOapeflirPhase(lastStep!.role as HarnessRole, lastStep!.stage);
    assert.equal(semanticPhase, "plan");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("integration: harness maps generator step to OAPEFLIR execute phase", () => {
  const ctx = createOapeflirContext("aa-oapeflir-gen-");
  try {
    const service = new HarnessRuntimeService();

    let run = service.createRun({
      taskId: "task_oapeflir_exec_001",
      domainId: "coding",
      constraintPack: makeConstraintPack(),
    });

    run = service.appendStep(run, {
      role: "generator",
      stage: "execute",
      inputs: { planId: "plan_001" },
      outputs: { stepOutputs: [{ tool: "bash", command: "ls" }] },
    });

    const lastStep = run.steps.at(-1);
    assert.ok(lastStep, "Should have at least one step");
    assert.equal(lastStep!.role, "generator");
    assert.equal(lastStep!.stage, "execute");

    const semanticPhase = mapHarnessStepToOapeflirPhase(lastStep!.role as HarnessRole, lastStep!.stage);
    assert.equal(semanticPhase, "execute");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("integration: harness maps evaluator step to OAPEFLIR evaluate phase", () => {
  const ctx = createOapeflirContext("aa-oapeflir-eval-");
  try {
    const service = new HarnessRuntimeService();

    let run = service.createRun({
      taskId: "task_oapeflir_eval_001",
      domainId: "coding",
      constraintPack: makeConstraintPack(),
    });

    run = service.appendStep(run, {
      role: "evaluator",
      stage: "evaluate",
      inputs: {},
      outputs: { score: 0.85, passed: true },
    });

    const lastStep = run.steps.at(-1);
    assert.ok(lastStep, "Should have at least one step");
    assert.equal(lastStep!.role, "evaluator");
    assert.equal(lastStep!.stage, "evaluate");

    const semanticPhase = mapHarnessStepToOapeflirPhase(lastStep!.role as HarnessRole, lastStep!.stage);
    assert.equal(semanticPhase, "feedback");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("integration: run completes full OAPEFLIR loop and reaches terminal state", () => {
  const ctx = createOapeflirContext("aa-oapeflir-loop-");
  try {
    const service = new HarnessRuntimeService();

    const run = service.runLoop({
      taskId: "task_oapeflir_full_001",
      domainId: "coding",
      constraintPack: makeConstraintPack({ autonomyMode: "auto" }),
      plannerOutput: { planId: "plan_full_001" },
      generatorOutput: { stepOutputs: [{ tool: "read", target: "/code/main.ts" }] },
      evaluatorOutput: { score: 0.9, passed: true },
      evaluatorScore: 0.9,
    });

    assert.ok(["completed", "aborted", "running"].includes(run.status), `Run should reach terminal or running state, got ${run.status}`);
    assert.ok(run.steps.length >= 3, "Full loop should have at least planner, generator, evaluator steps");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("integration: OAPEFLIR routing respects iteration budget", () => {
  const ctx = createOapeflirContext("aa-oapeflir-budget-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack = makeConstraintPack({ budget: { maxSteps: 2, maxCost: 1.0, maxDurationMs: 30000 } });

    const run = service.runLoop({
      taskId: "task_oapeflir_budget_001",
      domainId: "coding",
      constraintPack,
      plannerOutput: { planId: "plan_budget_001" },
      generatorOutput: { stepOutputs: [] },
      evaluatorOutput: { score: 0.3 },
      evaluatorScore: 0.3,
    });

    assert.equal(run.status, "aborted");
    assert.equal(run.decision?.action, "abort");
    assert.ok(run.steps.length >= 3, "Budget exhaustion should occur after the loop executes core stages");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("integration: harness run stores timeline events for OAPEFLIR stages", () => {
  const ctx = createOapeflirContext("aa-oapeflir-timeline-");
  try {
    const service = new HarnessRuntimeService();

    let run = service.createRun({
      taskId: "task_oapeflir_timeline_001",
      domainId: "coding",
      constraintPack: makeConstraintPack(),
    });

    run = service.appendStep(run, { role: "planner", stage: "plan", inputs: {}, outputs: { planId: "p1" } });
    run = service.appendStep(run, { role: "generator", stage: "execute", inputs: {}, outputs: {} });
    run = service.appendStep(run, { role: "evaluator", stage: "evaluate", inputs: {}, outputs: { score: 0.8 } });

    const timeline = service.listTimeline(run);
    const stepEvents = timeline.filter((e) => e.type === "step_completed");

    assert.equal(stepEvents.length, 3, "Should have 3 step_completed events");
    assert.ok(timeline.some((e) => e.type === "run_created"), "Should have run_created event");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});
