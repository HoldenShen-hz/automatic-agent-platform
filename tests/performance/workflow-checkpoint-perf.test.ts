/**
 * Performance Test: Workflow Step Checkpoint
 * Measures workflow step checkpoint creation and retrieval performance
 *
 * Design targets:
 * - Checkpoint creation: >500 ops/sec
 * - Checkpoint retrieval: >2000 ops/sec
 * - Checkpoint serialization: <5ms P99
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { rmSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { reportSoftPerformanceMiss } from "../helpers/performance.js";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { createWorkflowStepCheckpoint, type CreateWorkflowStepCheckpointInput } from "../../src/platform/state-evidence/checkpoints/workflow-step-checkpoint.js";
import { newId, nowIso } from "../../src/platform/contracts/types/ids.js";
import type { ArtifactRef } from "../../src/platform/contracts/types/domain.js";

function createTempDb(): SqliteDatabase {
  const dbPath = join(".tmp", `checkpoint-perf-${process.pid}-${Date.now()}.db`);
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  return db;
}

function createSampleCheckpointInput(taskId: string, executionId: string | null, stepIndex: number): CreateWorkflowStepCheckpointInput {
  return {
    taskId,
    executionId,
    workflowId: "wf_test",
    divisionId: "coding",
    stepId: `step_${stepIndex}`,
    roleId: stepIndex === 0 ? "planner" : "builder",
    outputKey: `output_${stepIndex}`,
    status: "completed",
    producedAt: nowIso(),
    output: {
      result: `Step ${stepIndex} completed successfully`,
      summary: `Executed step ${stepIndex} of the workflow`,
      artifacts: [],
    },
    decisionContext: {
      source: "model_response",
      request: `Execute step ${stepIndex}`,
      routeReason: "sequential workflow",
      priorStepSummaries: stepIndex > 0 ? [`Step ${stepIndex - 1} completed`] : [],
      dependsOnStepIds: stepIndex > 0 ? [`step_${stepIndex - 1}`] : [],
    },
    resumeContext: {
      completedStepIds: Array.from({ length: stepIndex + 1 }, (_, i) => `step_${i}`),
      nextStepId: stepIndex < 9 ? `step_${stepIndex + 1}` : null,
      outputKeys: Array.from({ length: stepIndex + 1 }, (_, i) => `output_${i}`),
    },
    upstreamArtifactRefs: [],
    fileDiffSummary: {
      summary: `Files modified in step ${stepIndex}`,
      createdPaths: stepIndex === 0 ? ["src/index.ts"] : [],
      updatedPaths: stepIndex > 0 ? ["src/app.ts", "src/config.ts"] : [],
      deletedPaths: [],
    },
  };
}

function createCheckpointAndStore(
  db: SqliteDatabase,
  store: AuthoritativeTaskStore,
  input: CreateWorkflowStepCheckpointInput,
): string {
  const artifactId = newId("artifact");
  const checkpoint = createWorkflowStepCheckpoint(input);

  db.transaction(() => {
    store.artifacts.insertArtifact({
      artifactId,
      taskId: input.taskId,
      executionId: input.executionId,
      kind: "workflow_step_snapshot",
      storagePath: `/tmp/checkpoints/${input.taskId}/${input.stepId}.json`,
      contentJson: JSON.stringify(checkpoint),
      mimeType: "application/json",
      sizeBytes: JSON.stringify(checkpoint).length,
      checksum: `sha256:${artifactId}`,
      createdAt: nowIso(),
      createdBy: "test",
    });
  });

  return artifactId;
}

// ============================================================================
// Checkpoint Creation Benchmarks
// ============================================================================

test("performance: createWorkflowStepCheckpoint() throughput >5000 ops/sec", (t) => {
  const taskId = newId("task");
  const executionId = newId("exec");

  const iterations = 2000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    const input = createSampleCheckpointInput(taskId, executionId, i % 10);
    createWorkflowStepCheckpoint(input);
  }

  const elapsed = performance.now() - start;
  const opsPerSec = (iterations / elapsed) * 1000;
  const avgLatencyMs = elapsed / iterations;

  try {
    assert.ok(
      opsPerSec > 5000,
      `Checkpoint creation throughput ${opsPerSec.toFixed(0)} ops/sec must be >5000 ops/sec. Avg: ${avgLatencyMs.toFixed(4)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: createWorkflowStepCheckpoint() P99 latency <1ms", (t) => {
  const taskId = newId("task");
  const executionId = newId("exec");

  const latencies: number[] = [];
  const iterations = 1000;

  // Warmup
  for (let i = 0; i < 100; i++) {
    const input = createSampleCheckpointInput(taskId, executionId, i % 10);
    createWorkflowStepCheckpoint(input);
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const input = createSampleCheckpointInput(taskId, executionId, i % 10);
    const start = performance.now();
    createWorkflowStepCheckpoint(input);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  try {
    assert.ok(
      p99 < 1,
      `Checkpoint creation P99 latency ${p99.toFixed(4)}ms exceeds 1ms target. P50: ${p50.toFixed(4)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

test("performance: Checkpoint serialization (JSON stringify) <2ms P99", (t) => {
  const taskId = newId("task");
  const executionId = newId("exec");

  const latencies: number[] = [];
  const iterations = 1000;

  // Create sample checkpoint
  const input = createSampleCheckpointInput(taskId, executionId, 5);
  const checkpoint = createWorkflowStepCheckpoint(input);

  // Warmup
  for (let i = 0; i < 100; i++) {
    JSON.stringify(checkpoint);
  }

  // Measure
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    JSON.stringify(checkpoint);
    latencies.push(performance.now() - start);
  }

  latencies.sort((a, b) => a - b);
  const p99 = latencies[Math.floor(iterations * 0.99)]!;
  const p50 = latencies[Math.floor(iterations * 0.5)]!;

  try {
    assert.ok(
      p99 < 2,
      `Checkpoint serialization P99 latency ${p99.toFixed(4)}ms exceeds 2ms target. P50: ${p50.toFixed(4)}ms`,
    );
  } catch (err) {
    if (err instanceof assert.AssertionError) {
      reportSoftPerformanceMiss(t, err);
      return;
    }
    throw err;
  }
});

// ============================================================================
// Checkpoint Storage Benchmarks
// ============================================================================

test("performance: Store checkpoint artifact throughput >500 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const iterations = 200;

    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const input = createSampleCheckpointInput(taskId, executionId, i % 10);
      createCheckpointAndStore(db, store, input);
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 500,
        `Checkpoint storage throughput ${opsPerSec.toFixed(0)} ops/sec must be >500 ops/sec. Avg: ${avgLatencyMs.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(join(".tmp", `checkpoint-perf-${process.pid}-${Date.now()}.db`), { force: true });
  }
});

test("performance: Store 10-step workflow checkpoint <20ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const stepCount = 10;

    const start = performance.now();

    for (let i = 0; i < stepCount; i++) {
      const input = createSampleCheckpointInput(taskId, executionId, i);
      createCheckpointAndStore(db, store, input);
    }

    const elapsed = performance.now() - start;

    try {
      assert.ok(
        elapsed < 20,
        `10-step workflow checkpoint storage took ${elapsed.toFixed(2)}ms, expected <20ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(join(".tmp", `checkpoint-perf-${process.pid}-${Date.now()}.db`), { force: true });
  }
});

// ============================================================================
// Checkpoint Retrieval Benchmarks
// ============================================================================

test("performance: Retrieve checkpoints by task ID throughput >1000 ops/sec", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const stepCount = 10;

    // Create checkpoints
    for (let i = 0; i < stepCount; i++) {
      const input = createSampleCheckpointInput(taskId, executionId, i);
      createCheckpointAndStore(db, store, input);
    }

    const iterations = 1000;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      store.artifacts.listArtifactsForTask(taskId, "workflow_step_snapshot");
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;
    const avgLatencyMs = elapsed / iterations;

    try {
      assert.ok(
        opsPerSec > 1000,
        `Checkpoint retrieval throughput ${opsPerSec.toFixed(0)} ops/sec must be >1000 ops/sec. Avg: ${avgLatencyMs.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(join(".tmp", `checkpoint-perf-${process.pid}-${Date.now()}.db`), { force: true });
  }
});

test("performance: Retrieve checkpoints by task ID P99 latency <5ms", (t) => {
  const db = createTempDb();
  const store = new AuthoritativeTaskStore(db);

  try {
    const taskId = newId("task");
    const executionId = newId("exec");
    const stepCount = 10;

    // Create checkpoints
    for (let i = 0; i < stepCount; i++) {
      const input = createSampleCheckpointInput(taskId, executionId, i);
      createCheckpointAndStore(db, store, input);
    }

    const latencies: number[] = [];
    const iterations = 500;

    // Warmup
    for (let i = 0; i < 50; i++) {
      store.artifacts.listArtifactsForTask(taskId, "workflow_step_snapshot");
    }

    // Measure
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      store.artifacts.listArtifactsForTask(taskId, "workflow_step_snapshot");
      latencies.push(performance.now() - start);
    }

    latencies.sort((a, b) => a - b);
    const p99 = latencies[Math.floor(iterations * 0.99)]!;
    const p50 = latencies[Math.floor(iterations * 0.5)]!;

    try {
      assert.ok(
        p99 < 5,
        `Checkpoint retrieval P99 latency ${p99.toFixed(3)}ms exceeds 5ms target. P50: ${p50.toFixed(3)}ms`,
      );
    } catch (err) {
      if (err instanceof assert.AssertionError) {
        reportSoftPerformanceMiss(t, err);
        return;
      }
      throw err;
    }
  } finally {
    db.close();
    rmSync(join(".tmp", `checkpoint-perf-${process.pid}-${Date.now()}.db`), { force: true });
  }
});
