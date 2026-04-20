import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { SqliteDatabase } from "../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { ExecutionLeaseService } from "../../../src/platform/execution/lease/execution-lease-service.js";
import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";
import { createTempWorkspace, cleanupPath } from "../../helpers/fs.js";

/**
 * Helper to create a minimal execution for lease testing.
 */
function createTestExecution(store: AuthoritativeTaskStore, db: SqliteDatabase, executionId: string, taskId: string, now: string): void {
  db.transaction(() => {
    store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "test_division",
      title: "Test task",
      status: "queued",
      source: "system",
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
    store.insertExecution({
      id: executionId,
      taskId,
      workflowId: "test_workflow",
      parentExecutionId: null,
      agentId: "test_agent",
      roleId: "test_role",
      runKind: "task_run",
      status: "created",
      inputRef: null,
      traceId: "trace-" + executionId,
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
      startedAt: null,
      finishedAt: null,
      createdAt: now,
      updatedAt: now,
    });
  });
}

/**
 * Helper to create a worker snapshot for handover tests.
 */
function createTestWorker(store: AuthoritativeTaskStore, workerId: string, now: string, maxConcurrency: number = 4): void {
  store.upsertWorkerSnapshot({
    workerId,
    status: "idle",
    placement: null,
    isolationLevel: null,
    repoVersion: null,
    remoteSessionStatus: null,
    lastAcknowledgedStreamOffset: null,
    streamResumeSuccessRate: null,
    credentialRefreshSuccessRate: null,
    sessionConsistencyCheckStatus: null,
    sessionConsistencyCheckedAt: null,
    saturation: null,
    activeLeaseCount: 0,
    meanStartupLatencyMs: null,
    sandboxSuccessRate: null,
    repoCacheHitRate: null,
    capabilitiesJson: "[]",
    runningExecutionsJson: "[]",
    maxConcurrency,
    queueAffinity: null,
    runtimeInstanceId: null,
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    cpuPct: 0,
    memoryMb: 0,
    toolBacklogCount: 0,
    currentStepId: null,
    lastProgressAt: null,
    lastHeartbeatAt: now,
    updatedAt: now,
  });
}

// =============================================================================
// Lease Acquisition Tests
// =============================================================================

test("acquireLease grants a new lease to a worker", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    createTestExecution(store, db, executionId, taskId, now);

    const result = service.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 30000,
      occurredAt: now,
    });

    assert.equal(result.outcome, "granted");
    assert.equal(result.reasonCode, null);
    assert.notEqual(result.lease, null);
    assert.equal(result.lease!.executionId, executionId);
    assert.equal(result.lease!.workerId, "worker-a");
    assert.equal(result.lease!.status, "active");
    assert.ok(result.lease!.fencingToken >= 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("acquireLease blocks when an active lease already exists", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    createTestExecution(store, db, executionId, taskId, now);

    // First worker acquires lease
    const firstResult = service.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 30000,
      occurredAt: now,
    });
    assert.equal(firstResult.outcome, "granted");

    // Second worker is blocked
    const secondResult = service.acquireLease({
      executionId,
      workerId: "worker-b",
      ttlMs: 30000,
      occurredAt: now,
    });
    assert.equal(secondResult.outcome, "blocked");
    assert.equal(secondResult.reasonCode, "active_lease_exists");
    assert.equal(secondResult.lease!.workerId, "worker-a");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("acquireLease throws when execution not found", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();

    assert.throws(() => {
      service.acquireLease({
        executionId: "nonexistent-exec",
        workerId: "worker-a",
        ttlMs: 30000,
        occurredAt: now,
      });
    }, /Execution not found/);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("acquireLease increments fencing token for each new lease", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    createTestExecution(store, db, executionId, taskId, now);

    const result1 = service.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 30000,
      occurredAt: now,
    });
    assert.equal(result1.lease!.fencingToken, 1);

    // Release the lease first
    service.releaseLease({
      leaseId: result1.lease!.id,
      workerId: "worker-a",
      reasonCode: "test",
      occurredAt: now,
    });

    const laterTime = new Date(Date.parse(now) + 1000).toISOString();
    const result2 = service.acquireLease({
      executionId,
      workerId: "worker-b",
      ttlMs: 30000,
      occurredAt: laterTime,
    });
    assert.equal(result2.lease!.fencingToken, 2);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// Lease Renewal Tests
// =============================================================================

test("renewLease extends the lease expiration time", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    createTestExecution(store, db, executionId, taskId, now);

    const acquireResult = service.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 10000,
      occurredAt: now,
    });
    const originalExpiresAt = acquireResult.lease!.expiresAt;

    // Wait a moment and renew
    const laterTime = new Date(Date.parse(now) + 5000).toISOString();
    const renewResult = service.renewLease({
      leaseId: acquireResult.lease!.id,
      workerId: "worker-a",
      ttlMs: 30000,
      occurredAt: laterTime,
    });

    assert.equal(renewResult.outcome, "renewed");
    assert.notEqual(renewResult.lease, null);
    assert.ok(renewResult.lease!.expiresAt > originalExpiresAt);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("renewLease blocked when lease not found", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();

    const result = service.renewLease({
      leaseId: "nonexistent-lease",
      workerId: "worker-a",
      ttlMs: 30000,
      occurredAt: now,
    });

    assert.equal(result.outcome, "blocked");
    assert.equal(result.reasonCode, "lease_not_found");
    assert.equal(result.lease, null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("renewLease blocked when worker ID does not match lease owner", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    createTestExecution(store, db, executionId, taskId, now);

    const acquireResult = service.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 30000,
      occurredAt: now,
    });

    const renewResult = service.renewLease({
      leaseId: acquireResult.lease!.id,
      workerId: "worker-b", // Wrong worker
      ttlMs: 30000,
      occurredAt: now,
    });

    assert.equal(renewResult.outcome, "blocked");
    assert.equal(renewResult.reasonCode, "worker_mismatch");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("renewLease blocked when lease is not active (already released)", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    createTestExecution(store, db, executionId, taskId, now);

    const acquireResult = service.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 30000,
      occurredAt: now,
    });

    // Release the lease
    service.releaseLease({
      leaseId: acquireResult.lease!.id,
      workerId: "worker-a",
      reasonCode: "test",
      occurredAt: now,
    });

    // Try to renew after release
    const renewResult = service.renewLease({
      leaseId: acquireResult.lease!.id,
      workerId: "worker-a",
      ttlMs: 30000,
      occurredAt: now,
    });

    assert.equal(renewResult.outcome, "blocked");
    assert.equal(renewResult.reasonCode, "lease_not_active");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("renewLease blocked when lease has already expired", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    createTestExecution(store, db, executionId, taskId, now);

    // Acquire lease with very short TTL
    const acquireResult = service.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 1000, // 1 second
      occurredAt: now,
    });

    // Try to renew after lease would have expired
    const expiredTime = new Date(Date.parse(now) + 5000).toISOString();
    const renewResult = service.renewLease({
      leaseId: acquireResult.lease!.id,
      workerId: "worker-a",
      ttlMs: 30000,
      occurredAt: expiredTime,
    });

    assert.equal(renewResult.outcome, "blocked");
    assert.equal(renewResult.reasonCode, "lease_expired");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// Lease Release Tests
// =============================================================================

test("releaseLease releases an active lease", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    createTestExecution(store, db, executionId, taskId, now);

    const acquireResult = service.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 30000,
      occurredAt: now,
    });

    const releaseResult = service.releaseLease({
      leaseId: acquireResult.lease!.id,
      workerId: "worker-a",
      reasonCode: "completed",
      occurredAt: now,
    });

    assert.equal(releaseResult.outcome, "released");
    assert.equal(releaseResult.lease!.status, "released");
    assert.equal(releaseResult.lease!.reasonCode, "completed");

    // Verify lease is no longer active
    const activeLease = store.getActiveExecutionLease(executionId);
    assert.equal(activeLease, null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("releaseLease blocked when lease not found", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();

    const result = service.releaseLease({
      leaseId: "nonexistent-lease",
      workerId: "worker-a",
      reasonCode: "test",
      occurredAt: now,
    });

    assert.equal(result.outcome, "blocked");
    assert.equal(result.reasonCode, "lease_not_found");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("releaseLease blocked when worker ID does not match", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    createTestExecution(store, db, executionId, taskId, now);

    const acquireResult = service.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 30000,
      occurredAt: now,
    });

    const releaseResult = service.releaseLease({
      leaseId: acquireResult.lease!.id,
      workerId: "worker-b", // Wrong worker
      reasonCode: "test",
      occurredAt: now,
    });

    assert.equal(releaseResult.outcome, "blocked");
    assert.equal(releaseResult.reasonCode, "worker_mismatch");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("releaseLease blocked when lease is not active", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    createTestExecution(store, db, executionId, taskId, now);

    const acquireResult = service.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 30000,
      occurredAt: now,
    });

    // Release once
    service.releaseLease({
      leaseId: acquireResult.lease!.id,
      workerId: "worker-a",
      reasonCode: "first_release",
      occurredAt: now,
    });

    // Try to release again
    const secondRelease = service.releaseLease({
      leaseId: acquireResult.lease!.id,
      workerId: "worker-a",
      reasonCode: "second_release",
      occurredAt: now,
    });

    assert.equal(secondRelease.outcome, "blocked");
    assert.equal(secondRelease.reasonCode, "lease_not_active");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// Lease Timeout / Expiration Tests
// =============================================================================

test("acquireLease expires an existing lease that has passed its expiration time", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    createTestExecution(store, db, executionId, taskId, now);

    // Acquire first lease with very short TTL
    const firstResult = service.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 1000, // 1 second
      occurredAt: now,
    });
    assert.equal(firstResult.outcome, "granted");

    // Wait until the lease expires
    const expiredTime = new Date(Date.parse(now) + 5000).toISOString();

    // Acquiring a new lease should expire the old one first
    const secondResult = service.acquireLease({
      executionId,
      workerId: "worker-b",
      ttlMs: 30000,
      occurredAt: expiredTime,
    });

    assert.equal(secondResult.outcome, "granted");
    assert.equal(secondResult.lease!.workerId, "worker-b");

    // Verify old lease is expired
    const firstLease = store.getExecutionLease(firstResult.lease!.id);
    assert.equal(firstLease!.status, "expired");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("reclaimExpiredLeases reclaims leases past their expiration", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    createTestExecution(store, db, executionId, taskId, now);

    // Acquire lease with short TTL
    const acquireResult = service.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 1000, // 1 second
      occurredAt: now,
    });
    assert.equal(acquireResult.outcome, "granted");

    // Wait for expiration
    const expiredTime = new Date(Date.parse(now) + 5000).toISOString();

    // Reclaim expired leases
    const reclaimed = service.reclaimExpiredLeases(expiredTime);

    assert.ok(reclaimed.length >= 1);
    const reclaimedLease = reclaimed.find((l) => l.id === acquireResult.lease!.id);
    assert.notEqual(reclaimedLease, undefined);
    assert.equal(reclaimedLease!.status, "reclaimed");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("reclaimActiveLease reclaims an active lease by execution ID", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    createTestExecution(store, db, executionId, taskId, now);

    const acquireResult = service.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 30000,
      occurredAt: now,
    });
    assert.equal(acquireResult.outcome, "granted");

    // Reclaim the active lease
    const reclaimed = service.reclaimActiveLease(executionId, now, "forced_reclaim");

    assert.notEqual(reclaimed, null);
    assert.equal(reclaimed!.status, "reclaimed");
    assert.equal(reclaimed!.reasonCode, "forced_reclaim");

    // Verify no active lease remains
    const activeLease = store.getActiveExecutionLease(executionId);
    assert.equal(activeLease, null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// Concurrent Lease Acquisition Tests
// =============================================================================

test("concurrent acquireLease - only first worker succeeds", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    createTestExecution(store, db, executionId, taskId, now);

    // Simulate concurrent acquisition attempts at the same timestamp
    const results = [
      service.acquireLease({ executionId, workerId: "worker-a", ttlMs: 30000, occurredAt: now }),
      service.acquireLease({ executionId, workerId: "worker-b", ttlMs: 30000, occurredAt: now }),
      service.acquireLease({ executionId, workerId: "worker-c", ttlMs: 30000, occurredAt: now }),
    ];

    // Only one should succeed
    const granted = results.filter((r) => r.outcome === "granted");
    const blocked = results.filter((r) => r.outcome === "blocked");

    assert.equal(granted.length, 1);
    assert.equal(blocked.length, 2);
    assert.equal(granted[0]!.lease!.workerId, "worker-a"); // First in order

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("after release, new worker can acquire lease", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    createTestExecution(store, db, executionId, taskId, now);

    // First worker acquires
    const firstResult = service.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 30000,
      occurredAt: now,
    });
    assert.equal(firstResult.outcome, "granted");

    // First worker releases
    service.releaseLease({
      leaseId: firstResult.lease!.id,
      workerId: "worker-a",
      reasonCode: "done",
      occurredAt: now,
    });

    // Second worker can now acquire
    const secondResult = service.acquireLease({
      executionId,
      workerId: "worker-b",
      ttlMs: 30000,
      occurredAt: now,
    });
    assert.equal(secondResult.outcome, "granted");
    assert.equal(secondResult.lease!.workerId, "worker-b");
    assert.equal(secondResult.lease!.fencingToken, 2);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// Write Access Validation Tests
// =============================================================================

test("validateWriteAccess allows write with valid lease and fencing token", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    createTestExecution(store, db, executionId, taskId, now);

    const acquireResult = service.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 30000,
      occurredAt: now,
    });

    const validation = service.validateWriteAccess({
      executionId,
      workerId: "worker-a",
      fencingToken: acquireResult.lease!.fencingToken,
      leaseId: acquireResult.lease!.id,
      occurredAt: now,
    });

    assert.equal(validation.allowed, true);
    assert.equal(validation.reasonCode, null);
    assert.equal(validation.activeLeaseId, acquireResult.lease!.id);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("validateWriteAccess denies write with stale fencing token", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    createTestExecution(store, db, executionId, taskId, now);

    const acquireResult = service.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 30000,
      occurredAt: now,
    });

    const validation = service.validateWriteAccess({
      executionId,
      workerId: "worker-a",
      fencingToken: acquireResult.lease!.fencingToken - 1, // Stale token
      occurredAt: now,
    });

    assert.equal(validation.allowed, false);
    assert.equal(validation.reasonCode, "stale_fencing_token");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("validateWriteAccess denies write when worker ID does not match", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    createTestExecution(store, db, executionId, taskId, now);

    const acquireResult = service.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 30000,
      occurredAt: now,
    });

    const validation = service.validateWriteAccess({
      executionId,
      workerId: "worker-b", // Different worker
      fencingToken: acquireResult.lease!.fencingToken,
      occurredAt: now,
    });

    assert.equal(validation.allowed, false);
    assert.equal(validation.reasonCode, "worker_mismatch");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("validateWriteAccess denies write when no active lease exists", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    createTestExecution(store, db, executionId, taskId, now);

    // No lease acquired - validation should fail
    const validation = service.validateWriteAccess({
      executionId,
      workerId: "worker-a",
      fencingToken: 1,
      occurredAt: now,
    });

    assert.equal(validation.allowed, false);
    assert.equal(validation.reasonCode, "lease_not_found");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("validateWriteAccess denies write after lease is released", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    createTestExecution(store, db, executionId, taskId, now);

    const acquireResult = service.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 30000,
      occurredAt: now,
    });

    // Release the lease
    service.releaseLease({
      leaseId: acquireResult.lease!.id,
      workerId: "worker-a",
      reasonCode: "done",
      occurredAt: now,
    });

    // Validate write should now fail
    const validation = service.validateWriteAccess({
      executionId,
      workerId: "worker-a",
      fencingToken: acquireResult.lease!.fencingToken,
      leaseId: acquireResult.lease!.id,
      occurredAt: now,
    });

    assert.equal(validation.allowed, false);
    assert.equal(validation.reasonCode, "no_active_lease");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("validateWriteAccess denies write when lease ID does not match", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    createTestExecution(store, db, executionId, taskId, now);

    const acquireResult = service.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 30000,
      occurredAt: now,
    });

    const validation = service.validateWriteAccess({
      executionId,
      workerId: "worker-a",
      fencingToken: acquireResult.lease!.fencingToken,
      leaseId: "wrong-lease-id", // Lease ID mismatch
      occurredAt: now,
    });

    assert.equal(validation.allowed, false);
    assert.equal(validation.reasonCode, "lease_mismatch");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// Handover Tests
// =============================================================================

test("handoverLease transfers lease from one worker to another", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    createTestExecution(store, db, executionId, taskId, now);
    createTestWorker(store, "worker-a", now);
    createTestWorker(store, "worker-b", now);

    const acquireResult = service.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 30000,
      occurredAt: now,
    });
    assert.equal(acquireResult.outcome, "granted");
    const originalFencingToken = acquireResult.lease!.fencingToken;

    const handoverResult = service.handoverLease({
      leaseId: acquireResult.lease!.id,
      workerId: "worker-a",
      newWorkerId: "worker-b",
      ttlMs: 30000,
      reasonCode: "worker_retiring",
      occurredAt: now,
    });

    assert.equal(handoverResult.outcome, "handed_over");
    assert.equal(handoverResult.previousLease!.status, "released");
    assert.equal(handoverResult.lease!.workerId, "worker-b");
    assert.ok(handoverResult.lease!.fencingToken > originalFencingToken);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("handoverLease blocked when worker ID does not match", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    createTestExecution(store, db, executionId, taskId, now);
    createTestWorker(store, "worker-a", now);
    createTestWorker(store, "worker-b", now);

    const acquireResult = service.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 30000,
      occurredAt: now,
    });

    const handoverResult = service.handoverLease({
      leaseId: acquireResult.lease!.id,
      workerId: "worker-b", // Wrong worker
      newWorkerId: "worker-a",
      ttlMs: 30000,
      occurredAt: now,
    });

    assert.equal(handoverResult.outcome, "blocked");
    assert.equal(handoverResult.reasonCode, "worker_mismatch");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("handoverLease blocked when new worker is at capacity", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    createTestExecution(store, db, executionId, taskId, now);
    createTestWorker(store, "worker-a", now);
    // worker-b has maxConcurrency of 0 (cannot run any executions)
    createTestWorker(store, "worker-b", now, 0);

    const acquireResult = service.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 30000,
      occurredAt: now,
    });

    const handoverResult = service.handoverLease({
      leaseId: acquireResult.lease!.id,
      workerId: "worker-a",
      newWorkerId: "worker-b",
      ttlMs: 30000,
      occurredAt: now,
    });

    assert.equal(handoverResult.outcome, "blocked");
    assert.equal(handoverResult.reasonCode, "worker_capacity_full");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("handoverLease blocked when trying to handover to same worker", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    createTestExecution(store, db, executionId, taskId, now);
    createTestWorker(store, "worker-a", now);

    const acquireResult = service.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 30000,
      occurredAt: now,
    });

    const handoverResult = service.handoverLease({
      leaseId: acquireResult.lease!.id,
      workerId: "worker-a",
      newWorkerId: "worker-a", // Same worker
      ttlMs: 30000,
      occurredAt: now,
    });

    assert.equal(handoverResult.outcome, "blocked");
    assert.equal(handoverResult.reasonCode, "handover_same_worker");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// Audit Trail Tests
// =============================================================================

test("lease operations create audit records", () => {
  const workspace = createTempWorkspace("aa-lease-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    const now = nowIso();
    const executionId = newId("exec");
    const taskId = newId("task");

    createTestExecution(store, db, executionId, taskId, now);

    // Acquire lease
    const acquireResult = service.acquireLease({
      executionId,
      workerId: "worker-a",
      ttlMs: 30000,
      occurredAt: now,
    });

    // Renew lease
    service.renewLease({
      leaseId: acquireResult.lease!.id,
      workerId: "worker-a",
      ttlMs: 30000,
      occurredAt: now,
    });

    // Release lease
    service.releaseLease({
      leaseId: acquireResult.lease!.id,
      workerId: "worker-a",
      reasonCode: "done",
      occurredAt: now,
    });

    // Check audit records
    const audits = store.listLeaseAudits(executionId);
    assert.ok(audits.length >= 3);

    const grantAudit = audits.find((a) => a.eventType === "lease_granted");
    assert.notEqual(grantAudit, undefined);

    const renewAudit = audits.find((a) => a.eventType === "lease_renewed");
    assert.notEqual(renewAudit, undefined);

    const releaseAudit = audits.find((a) => a.eventType === "lease_released");
    assert.notEqual(releaseAudit, undefined);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
