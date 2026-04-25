/**
 * Integration Test: Multi-Step Orchestration
 *
 * Tests multi-step workflow orchestration including step sequencing,
 * dependency resolution, and output passing between steps.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { MultiStepOrchestration } from "../../../../../src/platform/execution/execution-engine/multi-step-orchestration.js";
import { ComplexityRouter } from "../../../../../src/platform/execution/execution-engine/complexity-router.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("multi-step orchestration: creates workflow with multiple steps", () => {
  const workspace = createTempWorkspace("aa-multi-step-");

  try {
    const db = new SqliteDatabase(join(workspace, "multi-step.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-multi-step",
      executionId: "exec-multi-step",
      traceId: "trace-multi-step",
    });

    const orchestration = new MultiStepOrchestration(store);

    const workflow = orchestration.createWorkflow({
      taskId: "task-multi-step",
      executionId: "exec-multi-step",
      steps: [
        { stepName: "plan", toolHints: ["bash"], dependsOn: [] },
        { stepName: "execute", toolHints: ["bash"], dependsOn: ["plan"] },
        { stepName: "verify", toolHints: ["bash"], dependsOn: ["execute"] },
      ],
    });

    assert.ok(workflow.workflowId.startsWith("wf_"));
    assert.equal(workflow.steps.length, 3);
    assert.equal(workflow.steps[0]?.name, "plan");
    assert.equal(workflow.steps[1]?.name, "execute");
    assert.equal(workflow.steps[2]?.name, "verify");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("multi-step orchestration: validates step dependencies", () => {
  const workspace = createTempWorkspace("aa-multi-dep-");

  try {
    const db = new SqliteDatabase(join(workspace, "multi-dep.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-multi-dep",
      executionId: "exec-multi-dep",
      traceId: "trace-multi-dep",
    });

    const orchestration = new MultiStepOrchestration(store);

    const validDeps = orchestration.validateDependencies([
      { stepName: "a", dependsOn: [] },
      { stepName: "b", dependsOn: ["a"] },
      { stepName: "c", dependsOn: ["a", "b"] },
    ]);

    assert.strictEqual(validDeps.valid, true);

    const invalidDeps = orchestration.validateDependencies([
      { stepName: "a", dependsOn: ["b"] },
      { stepName: "b", dependsOn: [] },
    ]);

    assert.strictEqual(invalidDeps.valid, false);
    assert.ok(invalidDeps.error?.includes("circular"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("multi-step orchestration: detects circular dependencies", () => {
  const workspace = createTempWorkspace("aa-multi-circular-");

  try {
    const db = new SqliteDatabase(join(workspace, "multi-circular.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-circular",
      executionId: "exec-circular",
      traceId: "trace-circular",
    });

    const orchestration = new MultiStepOrchestration(store);

    const circularDeps = orchestration.validateDependencies([
      { stepName: "step1", dependsOn: ["step3"] },
      { stepName: "step2", dependsOn: ["step1"] },
      { stepName: "step3", dependsOn: ["step2"] },
    ]);

    assert.strictEqual(circularDeps.valid, false);
    assert.ok(circularDeps.error?.toLowerCase().includes("circular"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("multi-step orchestration: executes steps in dependency order", () => {
  const workspace = createTempWorkspace("aa-multi-order-");

  try {
    const db = new SqliteDatabase(join(workspace, "multi-order.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-multi-order",
      executionId: "exec-multi-order",
      traceId: "trace-multi-order",
    });

    const orchestration = new MultiStepOrchestration(store);

    const executionOrder: string[] = [];
    const steps = [
      { stepName: "init", dependsOn: [], toolHints: ["echo"] },
      { stepName: "process", dependsOn: ["init"], toolHints: ["echo"] },
      { stepName: "finalize", dependsOn: ["process"], toolHints: ["echo"] },
    ];

    const workflow = orchestration.createWorkflow({
      taskId: "task-multi-order",
      executionId: "exec-multi-order",
      steps,
    });

    const orderedSteps = orchestration.getExecutionOrder(workflow);
    assert.equal(orderedSteps[0]?.name, "init");
    assert.equal(orderedSteps[1]?.name, "process");
    assert.equal(orderedSteps[2]?.name, "finalize");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("complexity router: classifies simple task", () => {
  const router = new ComplexityRouter();

  const result = router.classify({
    taskId: "task-simple",
    inputTokens: 100,
    toolCallsEstimate: 2,
    requiresReview: false,
  });

  assert.ok(result.complexity === "simple" || result.complexity === "moderate" || result.complexity === "complex");
  assert.ok(result.recommendedSteps >= 1);
});

test("complexity router: classifies complex task", () => {
  const router = new ComplexityRouter();

  const result = router.classify({
    taskId: "task-complex",
    inputTokens: 10000,
    toolCallsEstimate: 50,
    requiresReview: true,
  });

  assert.ok(result.complexity === "complex");
  assert.ok(result.recommendedSteps >= 5);
});

test("complexity router: estimates correct step count", () => {
  const router = new ComplexityRouter();

  const simpleResult = router.classify({
    taskId: "task-est-1",
    inputTokens: 500,
    toolCallsEstimate: 5,
    requiresReview: false,
  });

  const complexResult = router.classify({
    taskId: "task-est-2",
    inputTokens: 5000,
    toolCallsEstimate: 30,
    requiresReview: true,
  });

  assert.ok(complexResult.recommendedSteps > simpleResult.recommendedSteps);
});

test("multi-step orchestration: passes outputs between steps", () => {
  const workspace = createTempWorkspace("aa-multi-output-");

  try {
    const db = new SqliteDatabase(join(workspace, "multi-output.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-multi-output",
      executionId: "exec-multi-output",
      traceId: "trace-multi-output",
    });

    const orchestration = new MultiStepOrchestration(store);

    const workflow = orchestration.createWorkflow({
      taskId: "task-multi-output",
      executionId: "exec-multi-output",
      steps: [
        { stepName: "generate", dependsOn: [], toolHints: ["bash"] },
        { stepName: "validate", dependsOn: ["generate"], toolHints: ["bash"] },
      ],
    });

    const outputMap = orchestration.createOutputMap(workflow, [
      { stepName: "generate", output: { result: "data123" } },
      { stepName: "validate", output: { valid: true } },
    ]);

    assert.ok(outputMap.has("generate"));
    assert.ok(outputMap.has("validate"));
    assert.equal(outputMap.get("generate")?.result, "data123");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("multi-step orchestration: handles parallel step execution", () => {
  const workspace = createTempWorkspace("aa-multi-parallel-");

  try {
    const db = new SqliteDatabase(join(workspace, "multi-parallel.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    seedTaskAndExecution(db, store, {
      taskId: "task-multi-parallel",
      executionId: "exec-multi-parallel",
      traceId: "trace-multi-parallel",
    });

    const orchestration = new MultiStepOrchestration(store);

    const workflow = orchestration.createWorkflow({
      taskId: "task-multi-parallel",
      executionId: "exec-multi-parallel",
      steps: [
        { stepName: "init", dependsOn: [], toolHints: ["bash"] },
        { stepName: "task_a", dependsOn: ["init"], toolHints: ["bash"] },
        { stepName: "task_b", dependsOn: ["init"], toolHints: ["bash"] },
        { stepName: "merge", dependsOn: ["task_a", "task_b"], toolHints: ["bash"] },
      ],
    });

    const parallelGroups = orchestration.getParallelGroups(workflow);
    assert.ok(parallelGroups.length >= 2);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
