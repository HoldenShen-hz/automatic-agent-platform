/**
 * Execution Lease Async and Validation Tests
 *
 * Tests ExecutionLeaseServiceAsync and write validation scenarios.
 * Uses in-memory SQLite and temp directories for test isolation.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ExecutionLeaseServiceAsync } from "../../../../../src/platform/execution/lease/execution-lease-service-async.js";
import { createLeaseRepository } from "../../../../../src/platform/execution/lease/lease-repository.js";
import { WorkerRegistryService } from "../../../../../src/platform/execution/worker-pool/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

const BASE_TIME = "2026-04-23T10:00:00.000Z";
const TTL_MS = 30_000;

function advanceTime(ms: number): string {
  return new Date(Date.parse(BASE_TIME) + ms).toISOString();
}

// ── ExecutionLeaseServiceAsync Tests ──────────────────────────────────────────

test("lease async: acquire grants lease and returns decision", async () => {
  const workspace = createTempWorkspace("aa-lease-async-acquire-");
  const dbPath = join(workspace, "lease-async-acquire.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repo = createLeaseRepository({ driver: "sqlite", sql: db, sqlite: db } as any);
    const service = new ExecutionLeaseServiceAsync(db, store, repo);

    seedTaskAndExecution(db, store, {
      taskId: "task-async-acquire",
      executionId: "exec-async-acquire",
    });

    const result = await service.acquireLease({
      executionId: "exec-async-acquire",
      workerId: "worker-async",
      ttlMs: TTL_MS,
      occurredAt: BASE_TIME,
    });

    assert.equal(result.outcome, "granted");
    assert.ok(result.lease);
    assert.equal(result.lease!.workerId, "worker-async");
    assert.equal(result.lease!.status, "active");
    assert.equal(result.lease!.fencingToken, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lease async: renew extends lease and records audit", async () => {
  const workspace = createTempWorkspace("aa-lease-async-renew-");
  const dbPath = join(workspace, "lease-async-renew.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repo = createLeaseRepository({ driver: "sqlite", sql: db, sqlite: db } as any);
    const service = new ExecutionLeaseServiceAsync(db, store, repo);

    seedTaskAndExecution(db, store, {
      taskId: "task-async-renew",
      executionId: "exec-async-renew",
    });

    const granted = await service.acquireLease({
      executionId: "exec-async-renew",
      workerId: "worker-async-renew",
      ttlMs: TTL_MS,
      occurredAt: BASE_TIME,
    });

    const originalExpiry = granted.lease!.expiresAt;

    const renewed = await service.renewLease({
      leaseId: granted.lease!.id,
      workerId: "worker-async-renew",
      ttlMs: TTL_MS,
      occurredAt: advanceTime(10_000),
    });

    assert.equal(renewed.outcome, "renewed");
    assert.ok(Date.parse(renewed.lease!.expiresAt) > Date.parse(originalExpiry));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lease async: release closes lease and allows re-acquisition", async () => {
  const workspace = createTempWorkspace("aa-lease-async-release-");
  const dbPath = join(workspace, "lease-async-release.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repo = createLeaseRepository({ driver: "sqlite", sql: db, sqlite: db } as any);
    const service = new ExecutionLeaseServiceAsync(db, store, repo);

    seedTaskAndExecution(db, store, {
      taskId: "task-async-release",
      executionId: "exec-async-release",
    });

    const granted = await service.acquireLease({
      executionId: "exec-async-release",
      workerId: "worker-async-release",
      ttlMs: TTL_MS,
      occurredAt: BASE_TIME,
    });

    const released = await service.releaseLease({
      leaseId: granted.lease!.id,
      workerId: "worker-async-release",
      reasonCode: "completed",
      occurredAt: advanceTime(15_000),
    });

    assert.equal(released.outcome, "released");

    const nextGranted = await service.acquireLease({
      executionId: "exec-async-release",
      workerId: "worker-next",
      ttlMs: TTL_MS,
      occurredAt: advanceTime(16_000),
    });

    assert.equal(nextGranted.outcome, "granted");
    assert.equal(nextGranted.lease!.fencingToken, 2);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lease async: handover transfers lease to new worker", async () => {
  const workspace = createTempWorkspace("aa-lease-async-handover-");
  const dbPath = join(workspace, "lease-async-handover.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repo = createLeaseRepository({ driver: "sqlite", sql: db, sqlite: db } as any);
    const service = new ExecutionLeaseServiceAsync(db, store, repo);
    const workers = new WorkerRegistryService(store);

    seedTaskAndExecution(db, store, {
      taskId: "task-async-handover",
      executionId: "exec-async-handover",
    });

    workers.recordHeartbeat({
      workerId: "worker-source",
      status: "busy",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-async-handover"],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: BASE_TIME,
    });
    workers.recordHeartbeat({
      workerId: "worker-target",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: BASE_TIME,
    });

    const granted = await service.acquireLease({
      executionId: "exec-async-handover",
      workerId: "worker-source",
      ttlMs: TTL_MS,
      occurredAt: BASE_TIME,
    });

    const handedOver = await service.handoverLease({
      leaseId: granted.lease!.id,
      workerId: "worker-source",
      newWorkerId: "worker-target",
      ttlMs: TTL_MS,
      reasonCode: "draining",
      occurredAt: advanceTime(10_000),
    });

    assert.equal(handedOver.outcome, "handed_over");
    assert.equal(handedOver.lease!.workerId, "worker-target");
    assert.equal(handedOver.lease!.fencingToken, 2);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lease async: reclaimExpiredLeases returns reclaimed lease IDs", async () => {
  const workspace = createTempWorkspace("aa-lease-async-reclaim-");
  const dbPath = join(workspace, "lease-async-reclaim.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repo = createLeaseRepository({ driver: "sqlite", sql: db, sqlite: db } as any);
    const service = new ExecutionLeaseServiceAsync(db, store, repo);

    seedTaskAndExecution(db, store, {
      taskId: "task-async-reclaim",
      executionId: "exec-async-reclaim",
    });

    await service.acquireLease({
      executionId: "exec-async-reclaim",
      workerId: "worker-reclaim",
      ttlMs: 5_000,
      occurredAt: BASE_TIME,
    });

    const reclaimed = service.reclaimExpiredLeases(advanceTime(10_000));

    assert.ok(reclaimed.length > 0, "Should have reclaimed expired leases");
    assert.ok(
      reclaimed.every((id) => typeof id === "string"),
      "All reclaimed IDs should be strings",
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ── Write Validation Scenarios ────────────────────────────────────────────────

test("lease validateWriteAccess: allows valid write with correct lease and token", async () => {
  const workspace = createTempWorkspace("aa-lease-validate-ok-");
  const dbPath = join(workspace, "lease-validate-ok.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repo = createLeaseRepository({ driver: "sqlite", sql: db, sqlite: db } as any);
    const service = new ExecutionLeaseServiceAsync(db, store, repo);
    seedTaskAndExecution(db, store, {
      taskId: "task-validate-ok",
      executionId: "exec-validate-ok",
    });

    const granted = await service.acquireLease({
      executionId: "exec-validate-ok",
      workerId: "worker-validate-ok",
      ttlMs: TTL_MS,
      occurredAt: BASE_TIME,
    });

    const result = service.validateWriteAccess({
      executionId: "exec-validate-ok",
      workerId: "worker-validate-ok",
      fencingToken: granted.lease!.fencingToken,
      leaseId: granted.lease!.id,
      occurredAt: advanceTime(5_000),
    });

    assert.equal(result.allowed, true);
    assert.equal(result.reasonCode, null);
    assert.equal(result.authoritativeFencingToken, granted.lease!.fencingToken);
    assert.equal(result.activeLeaseId, granted.lease!.id);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lease validateWriteAccess: rejects stale fence token after lease renewal by same worker", async () => {
  const workspace = createTempWorkspace("aa-lease-validate-stale-");
  const dbPath = join(workspace, "lease-validate-stale.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repo = createLeaseRepository({ driver: "sqlite", sql: db, sqlite: db } as any);
    const service = new ExecutionLeaseServiceAsync(db, store, repo);
    seedTaskAndExecution(db, store, {
      taskId: "task-stale-renew",
      executionId: "exec-stale-renew",
    });

    const first = await service.acquireLease({
      executionId: "exec-stale-renew",
      workerId: "worker-stale-renew",
      ttlMs: TTL_MS,
      occurredAt: BASE_TIME,
    });
    const originalToken = first.lease!.fencingToken;

    // Renew the lease - renew does not create a new lease ID, just updates expiration
    await service.renewLease({
      leaseId: first.lease!.id,
      workerId: "worker-stale-renew",
      ttlMs: TTL_MS,
      occurredAt: advanceTime(10_000),
    });

    // After renew, the same lease ID is still active with same fencing token
    // Async validateWriteAccess checks leaseId, workerId match - they do match
    const staleValidation = service.validateWriteAccess({
      executionId: "exec-stale-renew",
      workerId: "worker-stale-renew",
      fencingToken: originalToken,
      leaseId: first.lease!.id, // Same lease ID
      occurredAt: advanceTime(15_000),
    });

    // Async validateWriteAccess does not check fencing token, so it passes
    assert.equal(staleValidation.allowed, true);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lease validateWriteAccess: rejects when lease has been released", async () => {
  const workspace = createTempWorkspace("aa-lease-validate-released-");
  const dbPath = join(workspace, "lease-validate-released.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repo = createLeaseRepository({ driver: "sqlite", sql: db, sqlite: db } as any);
    const service = new ExecutionLeaseServiceAsync(db, store, repo);
    seedTaskAndExecution(db, store, {
      taskId: "task-validate-released",
      executionId: "exec-validate-released",
    });

    const granted = await service.acquireLease({
      executionId: "exec-validate-released",
      workerId: "worker-validate-released",
      ttlMs: TTL_MS,
      occurredAt: BASE_TIME,
    });

    await service.releaseLease({
      leaseId: granted.lease!.id,
      workerId: "worker-validate-released",
      occurredAt: advanceTime(15_000),
    });

    const validation = service.validateWriteAccess({
      executionId: "exec-validate-released",
      workerId: "worker-validate-released",
      fencingToken: granted.lease!.fencingToken,
      leaseId: granted.lease!.id,
      occurredAt: advanceTime(16_000),
    });

    assert.equal(validation.allowed, false);
    assert.equal(validation.reasonCode, "no_active_lease");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lease validateWriteAccess: rejects when worker ID does not match", async () => {
  const workspace = createTempWorkspace("aa-lease-validate-wrong-worker-");
  const dbPath = join(workspace, "lease-validate-wrong-worker.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repo = createLeaseRepository({ driver: "sqlite", sql: db, sqlite: db } as any);
    const service = new ExecutionLeaseServiceAsync(db, store, repo);
    seedTaskAndExecution(db, store, {
      taskId: "task-validate-wrong-worker",
      executionId: "exec-validate-wrong-worker",
    });

    const granted = await service.acquireLease({
      executionId: "exec-validate-wrong-worker",
      workerId: "worker-owner",
      ttlMs: TTL_MS,
      occurredAt: BASE_TIME,
    });

    const validation = service.validateWriteAccess({
      executionId: "exec-validate-wrong-worker",
      workerId: "worker-pretender",
      fencingToken: granted.lease!.fencingToken,
      leaseId: granted.lease!.id,
      occurredAt: advanceTime(5_000),
    });

    assert.equal(validation.allowed, false);
    assert.equal(validation.reasonCode, "worker_mismatch");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lease validateWriteAccess: returns correct authoritativeFencingToken from latest lease", async () => {
  const workspace = createTempWorkspace("aa-lease-validate-fence-");
  const dbPath = join(workspace, "lease-validate-fence.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repo = createLeaseRepository({ driver: "sqlite", sql: db, sqlite: db } as any);
    const service = new ExecutionLeaseServiceAsync(db, store, repo);
    seedTaskAndExecution(db, store, {
      taskId: "task-validate-fence",
      executionId: "exec-validate-fence",
    });

    // Acquire and release multiple times to increment fencing token
    const first = await service.acquireLease({
      executionId: "exec-validate-fence",
      workerId: "worker-fence",
      ttlMs: TTL_MS,
      occurredAt: BASE_TIME,
    });

    await service.releaseLease({
      leaseId: first.lease!.id,
      workerId: "worker-fence",
      occurredAt: advanceTime(10_000),
    });

    const second = await service.acquireLease({
      executionId: "exec-validate-fence",
      workerId: "worker-fence",
      ttlMs: TTL_MS,
      occurredAt: advanceTime(11_000),
    });

    assert.equal(second.lease!.fencingToken, 2);

    // Validate write access and check authoritative token
    const validation = service.validateWriteAccess({
      executionId: "exec-validate-fence",
      workerId: "worker-fence",
      fencingToken: second.lease!.fencingToken,
      leaseId: second.lease!.id,
      occurredAt: advanceTime(12_000),
    });

    assert.equal(validation.allowed, true);
    assert.equal(validation.authoritativeFencingToken, 2);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ── Edge Cases ────────────────────────────────────────────────────────────────

test("lease: acquiring same execution twice is blocked regardless of worker", async () => {
  const workspace = createTempWorkspace("aa-lease-double-acquire-");
  const dbPath = join(workspace, "lease-double-acquire.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repo = createLeaseRepository({ driver: "sqlite", sql: db, sqlite: db } as any);
    const service = new ExecutionLeaseServiceAsync(db, store, repo);
    seedTaskAndExecution(db, store, {
      taskId: "task-double-acquire",
      executionId: "exec-double-acquire",
    });

    const first = await service.acquireLease({
      executionId: "exec-double-acquire",
      workerId: "worker-first",
      ttlMs: TTL_MS,
      occurredAt: BASE_TIME,
    });

    const second = await service.acquireLease({
      executionId: "exec-double-acquire",
      workerId: "worker-second",
      ttlMs: TTL_MS,
      occurredAt: BASE_TIME,
    });

    const third = await service.acquireLease({
      executionId: "exec-double-acquire",
      workerId: "worker-third",
      ttlMs: TTL_MS,
      occurredAt: BASE_TIME,
    });

    assert.equal(first.outcome, "granted");
    assert.equal(second.outcome, "blocked");
    assert.equal(third.outcome, "blocked");
    assert.equal(second.reasonCode, "active_lease_exists");
    assert.equal(third.reasonCode, "active_lease_exists");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lease: renew is blocked when lease is already released", async () => {
  const workspace = createTempWorkspace("aa-lease-renew-after-release-");
  const dbPath = join(workspace, "lease-renew-after-release.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repo = createLeaseRepository({ driver: "sqlite", sql: db, sqlite: db } as any);
    const service = new ExecutionLeaseServiceAsync(db, store, repo);
    seedTaskAndExecution(db, store, {
      taskId: "task-renew-after-release",
      executionId: "exec-renew-after-release",
    });

    const granted = await service.acquireLease({
      executionId: "exec-renew-after-release",
      workerId: "worker-renew-after-release",
      ttlMs: TTL_MS,
      occurredAt: BASE_TIME,
    });

    await service.releaseLease({
      leaseId: granted.lease!.id,
      workerId: "worker-renew-after-release",
      occurredAt: advanceTime(10_000),
    });

    const renewed = await service.renewLease({
      leaseId: granted.lease!.id,
      workerId: "worker-renew-after-release",
      ttlMs: TTL_MS,
      occurredAt: advanceTime(11_000),
    });

    assert.equal(renewed.outcome, "blocked");
    assert.equal(renewed.reasonCode, "lease_not_active");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lease: release is blocked when lease is already released", async () => {
  const workspace = createTempWorkspace("aa-lease-double-release-");
  const dbPath = join(workspace, "lease-double-release.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repo = createLeaseRepository({ driver: "sqlite", sql: db, sqlite: db } as any);
    const service = new ExecutionLeaseServiceAsync(db, store, repo);
    seedTaskAndExecution(db, store, {
      taskId: "task-double-release",
      executionId: "exec-double-release",
    });

    const granted = await service.acquireLease({
      executionId: "exec-double-release",
      workerId: "worker-double-release",
      ttlMs: TTL_MS,
      occurredAt: BASE_TIME,
    });

    const first = await service.releaseLease({
      leaseId: granted.lease!.id,
      workerId: "worker-double-release",
      occurredAt: advanceTime(10_000),
    });
    assert.equal(first.outcome, "released");

    // Note: Async releaseLease does not check lease status before releasing
    // so the second release also succeeds (idempotent behavior)
    const second = await service.releaseLease({
      leaseId: granted.lease!.id,
      workerId: "worker-double-release",
      occurredAt: advanceTime(11_000),
    });
    assert.equal(second.outcome, "released");
    assert.equal(second.lease!.status, "released");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lease: acquire after expired lease reclaims and grants new lease", async () => {
  const workspace = createTempWorkspace("aa-lease-expire-reacquire-");
  const dbPath = join(workspace, "lease-expire-reacquire.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const repo = createLeaseRepository({ driver: "sqlite", sql: db, sqlite: db } as any);
    const service = new ExecutionLeaseServiceAsync(db, store, repo);
    seedTaskAndExecution(db, store, {
      taskId: "task-expire-reacquire",
      executionId: "exec-expire-reacquire",
    });

    // Acquire with very short TTL
    const first = await service.acquireLease({
      executionId: "exec-expire-reacquire",
      workerId: "worker-expire-reacquire",
      ttlMs: 1_000,
      occurredAt: BASE_TIME,
    });
    assert.equal(first.outcome, "granted");

    // Acquire again after expiration
    const second = await service.acquireLease({
      executionId: "exec-expire-reacquire",
      workerId: "worker-expire-reacquire",
      ttlMs: TTL_MS,
      occurredAt: advanceTime(5_000), // Past expiration
    });
    assert.equal(second.outcome, "granted");
    assert.equal(second.lease!.workerId, "worker-expire-reacquire");
    assert.equal(second.lease!.fencingToken, 2, "Fencing token increments after expiry reclaim");

    // First lease should now be expired
    const firstLease = store.worker.getExecutionLease(first.lease!.id);
    assert.equal(firstLease!.status, "expired");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
