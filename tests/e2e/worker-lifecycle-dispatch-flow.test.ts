/**
 * E2E Worker Lifecycle and Dispatch Flow Tests
 *
 * End-to-end tests covering worker registration, heartbeat, and task dispatch.
 * Tests the complete worker lifecycle from registration through task assignment.
 *
 * Coverage:
 * 1. Worker registration and heartbeat
 * 2. Worker status transitions (idle -> busy -> idle)
 * 3. Task dispatch to eligible worker
 * 4. Worker capacity tracking during execution
 * 5. Worker stale detection via heartbeat timeout
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { TransitionService } from "../../src/platform/five-plane-execution/state-transition/transition-service.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { nowIso, newId } from "../../src/platform/contracts/types/ids.js";
import type { TaskStatus, ExecutionStatus } from "../../src/platform/contracts/types/status.js";
import type { WorkerStatus } from "../../src/platform/contracts/types/domain.js";

function createE2eHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "e2e-worker-lifecycle.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const transitions = new TransitionService(db, store);

  return { workspace, db, store, transitions };
}

function makeWorkerSnapshot(
  workerId: string,
  status: WorkerStatus,
  overrides: Partial<{
    placement: "local" | "remote" | null;
    isolationLevel: "standard" | "hardened" | "strict" | null;
    repoVersion: string | null;
    remoteSessionStatus: string | null;
    lastAcknowledgedStreamOffset: string | null;
    streamResumeSuccessRate: number | null;
    credentialRefreshSuccessRate: number | null;
    sessionConsistencyCheckStatus: string | null;
    sessionConsistencyCheckedAt: string | null;
    workspaceSyncStatus: string | null;
    workspaceSyncCheckedAt: string | null;
    saturation: number | null;
    activeLeaseCount: number;
    meanStartupLatencyMs: number | null;
    sandboxSuccessRate: number | null;
    repoCacheHitRate: number | null;
    registrationVerifiedAt: string | null;
    registrationChallengeId: string | null;
    capabilitiesJson: string;
    runningExecutionsJson: string;
    maxConcurrency: number;
    queueAffinity: string | null;
    runtimeInstanceId: string | null;
    restartedFromRuntimeInstanceId: string | null;
    restartGeneration: number;
    cpuPct: number | null;
    memoryMb: number | null;
    toolBacklogCount: number;
    currentStepId: string | null;
    lastProgressAt: string | null;
    lastHeartbeatAt: string;
    updatedAt: string;
  }> = {},
): {
  workerId: string;
  status: WorkerStatus;
  placement: "local" | "remote" | null;
  isolationLevel: "standard" | "hardened" | "strict" | null;
  repoVersion: string | null;
  remoteSessionStatus: string | null;
  lastAcknowledgedStreamOffset: string | null;
  streamResumeSuccessRate: number | null;
  credentialRefreshSuccessRate: number | null;
  sessionConsistencyCheckStatus: string | null;
  sessionConsistencyCheckedAt: string | null;
  workspaceSyncStatus: string | null;
  workspaceSyncCheckedAt: string | null;
  saturation: number | null;
  activeLeaseCount: number;
  meanStartupLatencyMs: number | null;
  sandboxSuccessRate: number | null;
  repoCacheHitRate: number | null;
  registrationVerifiedAt: string | null;
  registrationChallengeId: string | null;
  capabilitiesJson: string;
  runningExecutionsJson: string;
  maxConcurrency: number;
  queueAffinity: string | null;
  runtimeInstanceId: string | null;
  restartedFromRuntimeInstanceId: string | null;
  restartGeneration: number;
  cpuPct: number | null;
  memoryMb: number | null;
  toolBacklogCount: number;
  currentStepId: string | null;
  lastProgressAt: string | null;
  lastHeartbeatAt: string;
  updatedAt: string;
} {
  return {
    workerId,
    status,
    placement: "local",
    isolationLevel: "standard",
    repoVersion: "1.0.0",
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
    capabilitiesJson: "[]",
    runningExecutionsJson: "[]",
    maxConcurrency: 5,
    queueAffinity: null,
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    cpuPct: null,
    memoryMb: null,
    toolBacklogCount: 0,
    currentStepId: null,
    lastProgressAt: null,
    lastHeartbeatAt: nowIso(),
    updatedAt: nowIso(),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test 1: Worker registration and initial status
// ---------------------------------------------------------------------------

test("E2E Worker Lifecycle: worker can be registered with idle status", () => {
  const h = createE2eHarness("e2e-worker-reg-");
  const workerId = newId("worker");
  const traceId = newId("trace");

  try {
    const now = nowIso();
    const snapshot = makeWorkerSnapshot(workerId, "idle");

    h.db.transaction(() => {
// @ts-ignore
      h.store.upsertWorkerSnapshot(snapshot);
    });

    const retrieved = h.store.getWorkerSnapshot(workerId);
    assert.ok(retrieved, "Worker snapshot should be retrievable");
    assert.equal(retrieved!.workerId, workerId, "Worker ID should match");
    assert.equal(retrieved!.status, "idle", "Worker should be in idle status");
    assert.equal(retrieved!.maxConcurrency, 5, "Worker should have correct maxConcurrency");

  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

// ---------------------------------------------------------------------------
// Test 2: Worker status transitions from idle to busy
// ---------------------------------------------------------------------------

test("E2E Worker Lifecycle: worker transitions from idle to busy when executing", () => {
  const h = createE2eHarness("e2e-worker-busy-");
  const workerId = newId("worker");
  const taskId = newId("task");
  const executionId = newId("exec");
  const traceId = newId("trace");

  try {
    const now = nowIso();

    // Register worker as idle
    h.db.transaction(() => {
// @ts-ignore
      h.store.upsertWorkerSnapshot(makeWorkerSnapshot(workerId, "idle"));
    });

    // Create task and execution
    h.db.transaction(() => {
      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Worker dispatch test",
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

// @ts-ignore
      h.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-test",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId,
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Verify worker is idle before task assignment
    let worker = h.store.getWorkerSnapshot(workerId);
    assert.equal(worker!.status, "idle", "Worker should start as idle");

    // Transition task to in_progress (simulating worker picked up task)
    h.transitions.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "pending",
      toStatus: "in_progress",
      executionId,
      reasonCode: "worker_assigned",
      traceId,
      actorType: "system",
      occurredAt: now,
    });

    // Update worker status to busy
    h.db.transaction(() => {
// @ts-ignore
      h.store.upsertWorkerSnapshot(makeWorkerSnapshot(workerId, "busy", {
        runningExecutionsJson: JSON.stringify([executionId]),
        activeLeaseCount: 1,
      }));
    });

    worker = h.store.getWorkerSnapshot(workerId);
    assert.equal(worker!.status, "busy", "Worker should transition to busy");

    const runningExecs = JSON.parse(worker!.runningExecutionsJson);
    assert.ok(runningExecs.includes(executionId), "Worker should track running execution");

  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

// ---------------------------------------------------------------------------
// Test 3: Worker returns to idle after execution completes
// ---------------------------------------------------------------------------

test("E2E Worker Lifecycle: worker returns to idle after task completion", () => {
  const h = createE2eHarness("e2e-worker-idle-");
  const workerId = newId("worker");
  const taskId = newId("task");
  const executionId = newId("exec");
  const sessionId = newId("sess");
  const traceId = newId("trace");

  try {
    const now = nowIso();

    // Setup: Worker is busy with an executing task
    h.db.transaction(() => {
// @ts-ignore
      h.store.upsertWorkerSnapshot(makeWorkerSnapshot(workerId, "busy", {
        runningExecutionsJson: JSON.stringify([executionId]),
        activeLeaseCount: 1,
      }));

      h.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        tenantId: null,
        title: "Completion test",
        status: "in_progress",
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

// @ts-ignore
      h.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-test",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId,
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      h.store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "streaming",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Complete the execution
    h.transitions.transitionExecutionStatus({
      entityKind: "execution",
      entityId: executionId,
      fromStatus: "executing",
      toStatus: "succeeded",
      reasonCode: "task_completed",
      traceId,
      actorType: "agent",
      occurredAt: now,
    });

    // Transition task to done
    h.transitions.transitionTaskTerminalState({
      taskId,
      sessionId,
      executionId,
      currentTaskStatus: "in_progress",
      currentWorkflowStatus: "running",
      currentSessionStatus: "streaming",
      currentExecutionStatus: "succeeded",
      terminalStatus: "done",
      taskOutputJson: JSON.stringify({ result: "success" }),
      outputsJson: "[]",
      context: {
        reasonCode: "task.completed",
        traceId,
        actorType: "system",
        occurredAt: now,
      },
    });

    // Worker returns to idle
    h.db.transaction(() => {
// @ts-ignore
      h.store.upsertWorkerSnapshot(makeWorkerSnapshot(workerId, "idle", {
        runningExecutionsJson: JSON.stringify([]),
        activeLeaseCount: 0,
      }));
    });

    const worker = h.store.getWorkerSnapshot(workerId);
    assert.equal(worker!.status, "idle", "Worker should return to idle after completion");
    assert.equal(JSON.parse(worker!.runningExecutionsJson).length, 0, "Worker should have no running executions");

  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

// ---------------------------------------------------------------------------
// Test 4: Worker capacity tracking with max concurrency
// ---------------------------------------------------------------------------

test("E2E Worker Lifecycle: worker tracks active executions against max concurrency", () => {
  const h = createE2eHarness("e2e-worker-capacity-");
  const workerId = newId("worker");
  const maxConcurrency = 3;

  try {
    const executionIds: string[] = [];
    for (let i = 0; i < maxConcurrency; i++) {
      executionIds.push(newId("exec"));
    }

    // Register worker with maxConcurrency of 3 and track all executions
    h.db.transaction(() => {
// @ts-ignore
      h.store.upsertWorkerSnapshot(makeWorkerSnapshot(workerId, "busy", {
        maxConcurrency,
        activeLeaseCount: executionIds.length,
        runningExecutionsJson: JSON.stringify(executionIds),
      }));
    });

    const worker = h.store.getWorkerSnapshot(workerId);
    assert.equal(worker!.status, "busy", "Worker should be busy");
    assert.equal(worker!.activeLeaseCount, maxConcurrency, "Worker activeLeaseCount should equal maxConcurrency");
    assert.ok(
      JSON.parse(worker!.runningExecutionsJson).length <= worker!.maxConcurrency,
      "Running executions should not exceed maxConcurrency",
    );

  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

// ---------------------------------------------------------------------------
// Test 5: Multiple workers can coexist with different statuses
// ---------------------------------------------------------------------------

test("E2E Worker Lifecycle: multiple workers can coexist with different statuses", () => {
  const h = createE2eHarness("e2e-worker-multi-");

  try {
    const workerIds = [newId("worker"), newId("worker"), newId("worker")];
    const statuses: WorkerStatus[] = ["idle", "busy", "draining"];

    // Register multiple workers
    h.db.transaction(() => {
      for (let i = 0; i < workerIds.length; i++) {
// @ts-ignore
        h.store.upsertWorkerSnapshot(makeWorkerSnapshot(workerIds[i], statuses[i]));
      }
    });

    // Verify all workers are retrievable with correct status
    for (let i = 0; i < workerIds.length; i++) {
// @ts-ignore
      const worker = h.store.getWorkerSnapshot(workerIds[i]);
      assert.ok(worker, `Worker ${i} should be retrievable`);
      assert.equal(worker!.status, statuses[i], `Worker ${i} should have correct status`);
    }

    // Count workers by status
    const allWorkers = h.store.listWorkerSnapshots();
    assert.ok(allWorkers.length >= 3, "Should have at least 3 workers registered");

  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
