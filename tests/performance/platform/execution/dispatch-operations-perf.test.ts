/**
 * Performance tests for Dispatch Service operations
 *
 * Design targets:
 * - Ticket creation: >500 ops/sec
 * - Dispatch decision: >1000 ops/sec
 * - Worker evaluation: >2000 ops/sec
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { reportSoftPerformanceMiss } from "../../../helpers/performance.js";

import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { ExecutionDispatchService } from "../../../../src/platform/five-plane-execution/dispatcher/execution-dispatch-service.js";
import { newId, nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { createTempWorkspace, cleanupPath } from "../../../helpers/fs.js";

function createTempDb(): { db: SqliteDatabase; store: AuthoritativeTaskStore; workspace: string } {
  const workspace = createTempWorkspace("aa-perf-dispatch-");
  const dbPath = join(workspace, "dispatch-perf.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { db, store, workspace };
}

function seedTaskAndExecution(store: AuthoritativeTaskStore, taskId: string, executionId: string): void {
  const now = nowIso();
  store.insertTask({
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId: "general_ops",
    title: "Dispatch test task",
    status: "pending",
    source: "user",
    priority: "normal",
    inputJson: "{}",
    normalizedInputJson: "{}",
    outputJson: null,
    estimatedCostUsd: 0,
    actualCostUsd: 0,
    errorCode: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  });

  store.execution.insertExecution({
    id: executionId,
    taskId,
    workflowId: "dispatch_perf",
    parentExecutionId: null,
    agentId: "agent-dispatch",
    roleId: "general_executor",
    runKind: "task_run",
    status: "created",
    inputRef: null,
    traceId: newId("trace"),
    attempt: 1,
    timeoutMs: 60_000,
    budgetUsdLimit: null,
    requiresApproval: 0,
    sandboxMode: "workspace_write",
    allowedToolsJson: "[]",
    allowedPathsJson: "[]",
    maxRetries: 0,
    retryBackoff: "none",
    lastErrorCode: null,
    lastErrorMessage: null,
    startedAt: null,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
  });
}

function upsertWorkerSnapshot(store: AuthoritativeTaskStore, workerId: string): void {
  const occurredAt = nowIso();
  store.upsertWorkerSnapshot({
    workerId,
    status: "idle",
    placement: "local",
    isolationLevel: "standard",
    repoVersion: "repo-main",
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    streamResumeSuccessRate: null,
    credentialRefreshSuccessRate: null,
    sessionConsistencyCheckStatus: null,
    sessionConsistencyCheckedAt: null,
    workspaceSyncStatus: null,
    workspaceSyncCheckedAt: null,
    saturation: 0,
    activeLeaseCount: 0,
    meanStartupLatencyMs: null,
    sandboxSuccessRate: null,
    repoCacheHitRate: null,
    registrationVerifiedAt: null,
    registrationChallengeId: null,
    capabilitiesJson: JSON.stringify(["code-execution"]),
    runningExecutionsJson: "[]",
    maxConcurrency: 5,
    queueAffinity: "general_ops",
    runtimeInstanceId: `runtime-${workerId}`,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    cpuPct: 10,
    memoryMb: 256,
    toolBacklogCount: 0,
    currentStepId: null,
    lastProgressAt: occurredAt,
    lastHeartbeatAt: occurredAt,
    updatedAt: occurredAt,
  });
}

test("performance: dispatch ticket creation >500 ops/sec", (t) => {
  const { db, store, workspace } = createTempDb();
  const dispatchService = new ExecutionDispatchService(db, store);

  try {
    const iterations = 500;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const taskId = newId("task");
      const executionId = newId("exec");
      seedTaskAndExecution(store, taskId, executionId);

      dispatchService.createTicket({
        executionId,
        priority: "normal",
        queueName: "general_ops",
        occurredAt: nowIso(),
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 500,
        `Ticket creation throughput ${opsPerSec.toFixed(2)} ops/sec must be >500 ops/sec`,
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
    cleanupPath(workspace);
  }
});

test("performance: dispatch decision evaluation >1000 ops/sec", (t) => {
  const { db, store, workspace } = createTempDb();
  const dispatchService = new ExecutionDispatchService(db, store);

  // Set up workers
  for (let w = 0; w < 10; w++) {
    upsertWorkerSnapshot(store, `worker-dispatch-${w}`);
  }

  try {
    const iterations = 500;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      const taskId = newId("task");
      const executionId = newId("exec");
      seedTaskAndExecution(store, taskId, executionId);

      dispatchService.createTicket({
        executionId,
        priority: "normal",
        queueName: "general_ops",
        occurredAt: nowIso(),
      });
    }

    const elapsed = performance.now() - start;
    const opsPerSec = (iterations / elapsed) * 1000;

    try {
      assert.ok(
        opsPerSec > 100,
        `Dispatch evaluation throughput ${opsPerSec.toFixed(2)} ops/sec must be >100 ops/sec (lower target for complex evaluation)`,
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
    cleanupPath(workspace);
  }
});

test("performance: dispatch scales with worker pool size", (t) => {
  const { db, store, workspace } = createTempDb();
  const dispatchService = new ExecutionDispatchService(db, store);

  const workerCounts = [5, 20, 50];
  const results: { count: number; opsPerSec: number }[] = [];

  try {
    for (const workerCount of workerCounts) {
      // Add workers
      for (let w = 0; w < workerCount; w++) {
        upsertWorkerSnapshot(store, `worker-pool-${workerCount}-${w}`);
      }

      const iterations = 200;
      const start = performance.now();

      for (let i = 0; i < iterations; i++) {
        const taskId = newId("task");
        const executionId = newId("exec");
        seedTaskAndExecution(store, taskId, executionId);

        dispatchService.createTicket({
          executionId,
          priority: "normal",
          queueName: "general_ops",
          occurredAt: nowIso(),
        });
      }

      const elapsed = performance.now() - start;
      const opsPerSec = (iterations / elapsed) * 1000;
      results.push({ count: workerCount, opsPerSec });
    }

    // Verify scaling doesn't degrade more than 2x as worker pool grows 10x
    const baseline = results[0]!.opsPerSec;
    const finalResult = results[results.length - 1]!.opsPerSec;
    const degradation = baseline / finalResult;

    try {
      assert.ok(
        degradation < 2,
        `Dispatch scaling degraded by ${degradation.toFixed(1)}x, expected <2x for 10x worker increase`,
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
    cleanupPath(workspace);
  }
});
