/**
 * Performance Test: Workflow State Operations
 *
 * These are performance smoke tests for the current workflow-state storage API.
 * They intentionally use generous thresholds so they validate regressions
 * without becoming flaky across different developer machines.
 */

import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";
import type {
  StepOutputRecord,
  TaskRecord,
  WorkflowStateRecord,
} from "../../../src/platform/contracts/types/domain.js";
import { SqliteDatabase } from "../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStoreFacade } from "../../../src/platform/state-evidence/truth/sqlite/authoritative-task-store-facade.js";

function createTempDb(): SqliteDatabase {
  mkdirSync(".tmp", { recursive: true });
  const dbPath = join(".tmp", `workflow-perf-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  return db;
}

function cleanupDb(db: SqliteDatabase): void {
  db.close();
  rmSync(db.filePath, { force: true });
  rmSync(`${db.filePath}-wal`, { force: true });
  rmSync(`${db.filePath}-shm`, { force: true });
}

function createTestTaskRecord(overrides: Partial<TaskRecord> = {}): TaskRecord {
  const taskId = overrides.id ?? newId("task");
  const timestamp = nowIso();
  return {
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId: "general_ops",
    tenantId: "tenant_perf",
    title: `Workflow perf task ${taskId}`,
    status: "in_progress",
    source: "user",
    priority: "normal",
    inputJson: JSON.stringify({ prompt: "workflow performance test" }),
    normalizedInputJson: JSON.stringify({ prompt: "workflow performance test" }),
    outputJson: null,
    estimatedCostUsd: 0,
    actualCostUsd: 0,
    errorCode: null,
    createdAt: timestamp,
    updatedAt: timestamp,
    completedAt: null,
    ...overrides,
  };
}

function createWorkflowStateRecord(taskId: string, overrides: Partial<WorkflowStateRecord> = {}): WorkflowStateRecord {
  const timestamp = nowIso();
  return {
    taskId,
    divisionId: "general_ops",
    workflowId: "single_division_multi_step_orchestration",
    currentStepIndex: 0,
    status: "running",
    outputsJson: "{}",
    lastErrorCode: null,
    retryCount: 0,
    resumableFromStep: null,
    startedAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function createStepOutputRecord(taskId: string, stepIndex: number, overrides: Partial<StepOutputRecord> = {}): StepOutputRecord {
  return {
    id: overrides.id ?? newId("step_output"),
    taskId,
    stepId: overrides.stepId ?? `step_${stepIndex}`,
    roleId: "general_executor",
    status: "succeeded",
    dataJson: JSON.stringify({ stepIndex, ok: true }),
    summary: `step ${stepIndex} completed`,
    artifactsJson: "[]",
    tokenCost: 0,
    durationMs: 10,
    validationJson: null,
    producedAt: nowIso(),
    ...overrides,
  };
}

function calculateP99(latencies: number[]): number {
  const sorted = [...latencies].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length * 0.99)] ?? 0;
}

function assertP99Below(latencies: number[], maxMs: number): void {
  const p99 = calculateP99(latencies);
  assert.ok(
    p99 < maxMs,
    `P99 latency ${p99.toFixed(3)}ms exceeds ${maxMs}ms budget`,
  );
}

function assertOpsAbove(iterations: number, elapsedMs: number, minOpsPerSec: number): void {
  const opsPerSec = (iterations / elapsedMs) * 1000;
  assert.ok(
    opsPerSec > minOpsPerSec,
    `Throughput ${opsPerSec.toFixed(2)} ops/sec must exceed ${minOpsPerSec} ops/sec`,
  );
}

function seedWorkflowStates(
  store: AuthoritativeTaskStoreFacade,
  count: number,
): string[] {
  const taskIds: string[] = [];
  for (let i = 0; i < count; i++) {
    const task = createTestTaskRecord();
    taskIds.push(task.id);
    store.insertTask(task);
    store.insertWorkflowState(createWorkflowStateRecord(task.id));
  }
  return taskIds;
}

function listStepOutputsByTask(store: AuthoritativeTaskStoreFacade, taskId: string): StepOutputRecord[] {
  return store.withConnection((connection) => connection
    .prepare(
      `SELECT
        id,
        task_id AS taskId,
        step_id AS stepId,
        role_id AS roleId,
        status,
        data_json AS dataJson,
        summary,
        artifacts_json AS artifactsJson,
        token_cost AS tokenCost,
        duration_ms AS durationMs,
        validation_json AS validationJson,
        produced_at AS producedAt
       FROM workflow_step_outputs
       WHERE task_id = ?
       ORDER BY produced_at ASC`,
    )
    .all(taskId) as unknown as StepOutputRecord[]);
}

test("performance-smoke: workflow state updates stay responsive", () => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);

  try {
    const taskIds = seedWorkflowStates(store, 40);
    const latencies: number[] = [];
    const iterations = 400;
    const statuses: WorkflowStateRecord["status"][] = ["running", "paused", "resuming", "completed"];

    for (let i = 0; i < iterations; i++) {
      const taskId = taskIds[i % taskIds.length]!;
      const status = statuses[i % statuses.length]!;
      const start = performance.now();
      store.updateWorkflowState(taskId, status, i % 5, JSON.stringify({ iteration: i, status }), nowIso(), null);
      latencies.push(performance.now() - start);
    }

    assertP99Below(latencies, 50);
    assert.ok(store.getWorkflowState(taskIds[0]!) != null);
  } finally {
    cleanupDb(db);
  }
});

test("performance-smoke: workflow state creation sustains healthy throughput", () => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);

  try {
    const iterations = 200;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const task = createTestTaskRecord();
      store.insertTask(task);
      store.insertWorkflowState(createWorkflowStateRecord(task.id));
    }

    const elapsed = performance.now() - start;
    assertOpsAbove(iterations, elapsed, 200);
    assert.equal(store.listWorkflowStates().length, iterations);
  } finally {
    cleanupDb(db);
  }
});

test("performance-smoke: step output inserts stay responsive", () => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);

  try {
    const task = createTestTaskRecord();
    store.insertTask(task);
    store.insertWorkflowState(createWorkflowStateRecord(task.id));

    const latencies: number[] = [];
    const iterations = 300;
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      store.insertStepOutput(createStepOutputRecord(task.id, i));
      latencies.push(performance.now() - start);
    }

    assertP99Below(latencies, 20);
    assert.equal(listStepOutputsByTask(store, task.id).length, iterations);
  } finally {
    cleanupDb(db);
  }
});

test("performance-smoke: step output creation sustains healthy throughput", () => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);

  try {
    const task = createTestTaskRecord();
    store.insertTask(task);
    store.insertWorkflowState(createWorkflowStateRecord(task.id));

    const iterations = 250;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      store.insertStepOutput(createStepOutputRecord(task.id, i));
    }

    const elapsed = performance.now() - start;
    assertOpsAbove(iterations, elapsed, 300);
  } finally {
    cleanupDb(db);
  }
});

test("performance-smoke: get workflow state remains responsive", () => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);

  try {
    const taskIds = seedWorkflowStates(store, 30);
    const latencies: number[] = [];
    const iterations = 300;

    for (let i = 0; i < iterations; i++) {
      const taskId = taskIds[i % taskIds.length]!;
      const start = performance.now();
      const workflow = store.getWorkflowState(taskId);
      latencies.push(performance.now() - start);
      assert.ok(workflow);
    }

    assertP99Below(latencies, 20);
  } finally {
    cleanupDb(db);
  }
});

test("performance-smoke: list workflow states remains responsive", () => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);

  try {
    seedWorkflowStates(store, 60);
    const latencies: number[] = [];
    const iterations = 200;

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const workflows = store.listWorkflowStates();
      latencies.push(performance.now() - start);
      assert.equal(workflows.length, 60);
    }

    assertP99Below(latencies, 30);
  } finally {
    cleanupDb(db);
  }
});

test("performance-smoke: querying step outputs by task remains responsive", () => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);

  try {
    const task = createTestTaskRecord();
    store.insertTask(task);
    store.insertWorkflowState(createWorkflowStateRecord(task.id));
    for (let i = 0; i < 20; i++) {
      store.insertStepOutput(createStepOutputRecord(task.id, i));
    }

    const latencies: number[] = [];
    const iterations = 200;
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      const outputs = listStepOutputsByTask(store, task.id);
      latencies.push(performance.now() - start);
      assert.equal(outputs.length, 20);
    }

    assertP99Below(latencies, 20);
  } finally {
    cleanupDb(db);
  }
});

test("performance-smoke: complete 5-step workflow round-trip remains responsive", () => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);

  try {
    const iterations = 40;
    const latencies: number[] = [];

    for (let iter = 0; iter < iterations; iter++) {
      const task = createTestTaskRecord();
      store.insertTask(task);
      store.insertWorkflowState(createWorkflowStateRecord(task.id));

      const start = performance.now();
      for (let stepIndex = 0; stepIndex < 5; stepIndex++) {
        store.insertStepOutput(createStepOutputRecord(task.id, stepIndex));
        store.updateWorkflowState(
          task.id,
          stepIndex === 4 ? "completed" : "running",
          stepIndex,
          JSON.stringify({ lastCompletedStep: stepIndex }),
          nowIso(),
          stepIndex === 4 ? null : `step_${stepIndex + 1}`,
        );
      }
      latencies.push(performance.now() - start);
    }

    assertP99Below(latencies, 100);
  } finally {
    cleanupDb(db);
  }
});

test("performance-smoke: workflow transition loop sustains healthy throughput", () => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStoreFacade(db);

  try {
    const task = createTestTaskRecord();
    store.insertTask(task);
    store.insertWorkflowState(createWorkflowStateRecord(task.id));

    const iterations = 1000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const status: WorkflowStateRecord["status"] = i % 2 === 0 ? "running" : "paused";
      store.updateWorkflowState(task.id, status, i % 3, JSON.stringify({ iteration: i }), nowIso(), null);
    }

    const elapsed = performance.now() - start;
    assertOpsAbove(iterations, elapsed, 500);
  } finally {
    cleanupDb(db);
  }
});
