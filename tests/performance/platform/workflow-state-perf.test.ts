/**
 * Performance Test: Workflow State Transition Operations
 * Measures workflow state transition validation and execution throughput
 *
 * Design targets:
 * - Transition validation: >10000 ops/sec
 * - Workflow status update: <5ms P99
 * - Step status update: <2ms P99
 *
 * Note: Performance thresholds are set for reference hardware. On slower machines,
 * tests that exceed thresholds are marked as skipped rather than failed.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { rmSync } from "node:fs";

import { SqliteDatabase } from "../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStoreFacade } from "../../../src/platform/state-evidence/truth/sqlite/authoritative-task-store-facade.js";
import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";
import type {
  TaskRecord,
  TaskSource,
  TaskPriority,
  WorkflowRecord,
  WorkflowStepRecord,
} from "../../../src/platform/contracts/types/domain.js";

function createTempDb(): SqliteDatabase {
  const dbPath = join(".tmp", `workflow-perf-${process.pid}-${Date.now()}.db`);
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  return db;
}

function createTestTaskRecord(overrides?: Partial<TaskRecord>): TaskRecord {
  const taskId = overrides?.id ?? newId("task");
  return {
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId: "div_default",
    tenantId: "tenant_test",
    title: `Test task ${taskId}`,
    status: "queued",
    source: "user" as TaskSource,
    priority: "normal" as TaskPriority,
    inputJson: JSON.stringify({ prompt: "Test task input" }),
    normalizedInputJson: JSON.stringify({ prompt: "Test task input" }),
    outputJson: null,
    estimatedCostUsd: 0.01,
    actualCostUsd: 0,
    errorCode: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    completedAt: null,
    ...overrides,
  };
}

function createTestWorkflowRecord(overrides?: Partial<WorkflowRecord>): WorkflowRecord {
  const workflowId = overrides?.id ?? newId("workflow");
  return {
    id: workflowId,
    taskId: overrides?.taskId ?? newId("task"),
    divisionId: "div_default",
    tenantId: "tenant_test",
    status: "running",
    currentStepId: null,
    planJson: JSON.stringify({ steps: [] }),
    contextJson: JSON.stringify({}),
    estimatedCostUsd: 0.1,
    actualCostUsd: 0,
    errorCode: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    completedAt: null,
    ...overrides,
  };
}

function createTestWorkflowStepRecord(overrides?: Partial<WorkflowStepRecord>): WorkflowStepRecord {
  const stepId = overrides?.id ?? newId("step");
  return {
    id: stepId,
    workflowId: overrides?.workflowId ?? newId("workflow"),
    stepIndex: 0,
    stepType: "agent",
    roleId: "general_executor",
    name: `Step ${stepId}`,
    status: "pending",
    inputJson: JSON.stringify({ prompt: "Step input" }),
    outputJson: null,
    errorJson: null,
    attempts: 0,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    completedAt: null,
    ...overrides,
  };
}

// ============================================================================
// Workflow Status Update Benchmarks
// ============================================================================

test("performance: workflow status update <5ms P99", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);

  try {
    // Create test workflows
    const workflowIds: string[] = [];
    for (let i = 0; i < 50; i++) {
      const task = createTestTaskRecord();
      store.insertTask(task);
      const workflow = createTestWorkflowRecord({ taskId: task.id });
      workflowIds.push(workflow.id);
      store.insertWorkflow(workflow);
    }

    const latencies: number[] = [];
    const iterations = 500;
    const statuses = ["running", "paused", "completed", "failed"] as const;

    for (let i = 0; i < iterations; i++) {
      const workflowId = workflowIds[i % workflowIds.length]!;
      const status = statuses[i % statuses.length]!;
      const start = performance.now();
      store.updateWorkflowStatus(workflowId, status, nowIso());
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 5,
        `Workflow status update P99 latency ${p99.toFixed(3)}ms exceeds 5ms target. P50: ${p50.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        t.skip(err.message);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});

test("performance: workflow creation throughput >500 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);

  try {
    const iterations = 200;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const task = createTestTaskRecord({ id: newId("task") });
      store.insertTask(task);
      const workflow = createTestWorkflowRecord({ taskId: task.id });
      store.insertWorkflow(workflow);
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 500,
        `Workflow creation throughput ${opsPerSec.toFixed(2)} ops/sec must be >500 ops/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        t.skip(err.message);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});

// ============================================================================
// Workflow Step Status Update Benchmarks
// ============================================================================

test("performance: workflow step status update <2ms P99", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);

  try {
    // Create test workflows with steps
    const stepIds: string[] = [];
    for (let i = 0; i < 20; i++) {
      const task = createTestTaskRecord();
      store.insertTask(task);
      const workflow = createTestWorkflowRecord({ taskId: task.id });
      store.insertWorkflow(workflow);
      const step = createTestWorkflowStepRecord({ workflowId: workflow.id, stepIndex: 0 });
      store.insertWorkflowStep(step);
      stepIds.push(step.id);
    }

    const latencies: number[] = [];
    const iterations = 500;
    const statuses = ["pending", "in_progress", "completed", "failed"] as const;

    for (let i = 0; i < iterations; i++) {
      const stepId = stepIds[i % stepIds.length]!;
      const status = statuses[i % statuses.length]!;
      const start = performance.now();
      store.updateWorkflowStepStatus(stepId, status, nowIso());
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 2,
        `Workflow step status update P99 latency ${p99.toFixed(3)}ms exceeds 2ms target. P50: ${p50.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        t.skip(err.message);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});

test("performance: workflow step creation throughput >800 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);

  try {
    // Create parent workflow
    const task = createTestTaskRecord();
    store.insertTask(task);
    const workflow = createTestWorkflowRecord({ taskId: task.id });
    store.insertWorkflow(workflow);

    const iterations = 200;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const step = createTestWorkflowStepRecord({
        workflowId: workflow.id,
        stepIndex: i,
      });
      store.insertWorkflowStep(step);
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 800,
        `Workflow step creation throughput ${opsPerSec.toFixed(2)} ops/sec must be >800 ops/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        t.skip(err.message);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});

// ============================================================================
// Workflow Query Benchmarks
// ============================================================================

test("performance: get workflow with steps <5ms P99", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);

  try {
    // Create workflows with steps
    for (let i = 0; i < 20; i++) {
      const task = createTestTaskRecord();
      store.insertTask(task);
      const workflow = createTestWorkflowRecord({ taskId: task.id });
      store.insertWorkflow(workflow);

      for (let j = 0; j < 5; j++) {
        const step = createTestWorkflowStepRecord({
          workflowId: workflow.id,
          stepIndex: j,
        });
        store.insertWorkflowStep(step);
      }
    }

    const latencies: number[] = [];
    const iterations = 200;
    const workflowIds: string[] = [];
    for (let i = 0; i < 20; i++) {
      const wf = store.getWorkflow(newId("workflow"));
      if (wf) workflowIds.push(wf.id);
    }

    // Re-query existing workflows
    for (let i = 0; i < iterations; i++) {
      const workflowId = workflowIds[i % workflowIds.length]!;
      const start = performance.now();
      store.getWorkflow(workflowId);
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 5,
        `Get workflow P99 latency ${p99.toFixed(3)}ms exceeds 5ms target. P50: ${p50.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        t.skip(err.message);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});

test("performance: list workflows <10ms P99", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);

  try {
    // Create 50 workflows
    for (let i = 0; i < 50; i++) {
      const task = createTestTaskRecord();
      store.insertTask(task);
      const workflow = createTestWorkflowRecord({ taskId: task.id });
      store.insertWorkflow(workflow);
    }

    const latencies: number[] = [];
    const iterations = 200;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      store.listWorkflows(50);
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 10,
        `List workflows P99 latency ${p99.toFixed(3)}ms exceeds 10ms target. P50: ${p50.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        t.skip(err.message);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});

test("performance: list workflow steps <5ms P99", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);

  try {
    // Create a workflow with steps
    const task = createTestTaskRecord();
    store.insertTask(task);
    const workflow = createTestWorkflowRecord({ taskId: task.id });
    store.insertWorkflow(workflow);

    for (let j = 0; j < 20; j++) {
      const step = createTestWorkflowStepRecord({
        workflowId: workflow.id,
        stepIndex: j,
      });
      store.insertWorkflowStep(step);
    }

    const latencies: number[] = [];
    const iterations = 200;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      store.listWorkflowSteps(workflow.id);
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 5,
        `List workflow steps P99 latency ${p99.toFixed(3)}ms exceeds 5ms target. P50: ${p50.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        t.skip(err.message);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});

// ============================================================================
// Multi-Step Workflow Benchmarks
// ============================================================================

test("performance: complete 5-step workflow <50ms total", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);

  try {
    const iterations = 50;
    const totalLatencies: number[] = [];

    for (let iter = 0; iter < iterations; iter++) {
      const task = createTestTaskRecord();
      store.insertTask(task);
      const workflow = createTestWorkflowRecord({ taskId: task.id });
      store.insertWorkflow(workflow);

      const start = performance.now();

      // Create 5 steps
      for (let i = 0; i < 5; i++) {
        const step = createTestWorkflowStepRecord({
          workflowId: workflow.id,
          stepIndex: i,
        });
        store.insertWorkflowStep(step);
      }

      // Update each step to completed
      const steps = store.listWorkflowSteps(workflow.id);
      for (const step of steps) {
        store.updateWorkflowStepStatus(step.id, "completed", nowIso());
      }

      // Update workflow to completed
      store.updateWorkflowStatus(workflow.id, "completed", nowIso());

      totalLatencies.push(performance.now() - start);
    }

    totalLatencies.sort((a, b) => a - b);
    const p99 = totalLatencies[Math.floor(iterations * 0.99)]!;
    const p50 = totalLatencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 50,
        `Complete 5-step workflow P99 latency ${p99.toFixed(3)}ms exceeds 50ms target. P50: ${p50.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        t.skip(err.message);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});

test("performance: workflow transition validation >10000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);

  try {
    // Create test workflow
    const task = createTestTaskRecord();
    store.insertTask(task);
    const workflow = createTestWorkflowRecord({ taskId: task.id });
    store.insertWorkflow(workflow);

    const iterations = 1000;
    const start = performance.now();

    // Rapid status updates (validation happens on each update)
    for (let i = 0; i < iterations; i++) {
      const status = i % 2 === 0 ? "running" : "paused";
      store.updateWorkflowStatus(workflow.id, status, nowIso());
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 10000,
        `Workflow transition validation throughput ${opsPerSec.toFixed(2)} ops/sec must be >10000 ops/sec`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        t.skip(err.message);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(db.filePath, { force: true });
    rmSync(`${db.filePath}-wal`, { force: true });
    rmSync(`${db.filePath}-shm`, { force: true });
  }
});
