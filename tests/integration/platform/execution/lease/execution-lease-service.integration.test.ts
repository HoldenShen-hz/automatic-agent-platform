/**
 * Execution Lease Service Integration Tests
 *
 * Tests lease lifecycle with real SQLite database.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ExecutionLeaseService } from "../../../../../src/platform/five-plane-execution/lease/execution-lease-service.js";
import { WorkerRegistryService } from "../../../../../src/platform/five-plane-execution/worker-pool/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

test("ExecutionLeaseService acquires and releases lease", () => {
  const workspace = createTempWorkspace("aa-lease-int-");
  const dbPath = join(workspace, "lease-int.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-lease-int",
      executionId: "exec-lease-int",
    });

    const granted = service.acquireLease({
      executionId: "exec-lease-int",
      workerId: "worker-lease",
      ttlMs: 30_000,
      occurredAt: "2026-04-03T10:00:00.000Z",
    });

    assert.equal(granted.outcome, "granted");
    assert.ok(granted.lease);
    assert.equal(granted.lease?.fencingToken, 1);
    assert.equal(granted.lease?.workerId, "worker-lease");

    const released = service.releaseLease({
      leaseId: granted.lease!.id,
      workerId: "worker-lease",
      fencingToken: granted.lease!.fencingToken,
      occurredAt: "2026-04-03T10:00:30.000Z",
    });

    assert.equal(released.outcome, "released");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionLeaseService blocks second worker while lease active", () => {
  const workspace = createTempWorkspace("aa-lease-block-");
  const dbPath = join(workspace, "lease-block.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-lease-block",
      executionId: "exec-lease-block",
    });

    const first = service.acquireLease({
      executionId: "exec-lease-block",
      workerId: "worker-first",
      ttlMs: 30_000,
      occurredAt: "2026-04-03T11:00:00.000Z",
    });

    const second = service.acquireLease({
      executionId: "exec-lease-block",
      workerId: "worker-second",
      ttlMs: 30_000,
      occurredAt: "2026-04-03T11:00:05.000Z",
    });

    assert.equal(first.outcome, "granted");
    assert.equal(second.outcome, "blocked");
    assert.equal(second.reasonCode, "active_lease_exists");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionLeaseService renews lease", () => {
  const workspace = createTempWorkspace("aa-lease-renew-");
  const dbPath = join(workspace, "lease-renew.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-lease-renew",
      executionId: "exec-lease-renew",
    });

    const granted = service.acquireLease({
      executionId: "exec-lease-renew",
      workerId: "worker-renew",
      ttlMs: 30_000,
      occurredAt: "2026-04-03T12:00:00.000Z",
    });

    const renewed = service.renewLease({
      leaseId: granted.lease!.id,
      workerId: "worker-renew",
      ttlMs: 30_000,
      occurredAt: "2026-04-03T12:00:15.000Z",
    });

    assert.equal(renewed.outcome, "renewed");
    assert.ok(renewed.lease);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionLeaseService validates write access with correct token", () => {
  const workspace = createTempWorkspace("aa-lease-validate-");
  const dbPath = join(workspace, "lease-validate.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-lease-validate",
      executionId: "exec-lease-validate",
    });

    const granted = service.acquireLease({
      executionId: "exec-lease-validate",
      workerId: "worker-validate",
      ttlMs: 30_000,
      occurredAt: "2026-04-03T13:00:00.000Z",
    });

    const valid = service.validateWriteAccess({
      executionId: "exec-lease-validate",
      workerId: "worker-validate",
      fencingToken: granted.lease!.fencingToken,
      leaseId: granted.lease!.id,
      occurredAt: "2026-04-03T13:00:05.000Z",
    });

    assert.equal(valid.allowed, true);
    assert.equal(valid.reasonCode, null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionLeaseService rejects stale write access", () => {
  const workspace = createTempWorkspace("aa-lease-stale-");
  const dbPath = join(workspace, "lease-stale.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-lease-stale",
      executionId: "exec-lease-stale",
    });

    const first = service.acquireLease({
      executionId: "exec-lease-stale",
      workerId: "worker-first",
      ttlMs: 30_000,
      occurredAt: "2026-04-03T14:00:00.000Z",
    });

    service.releaseLease({
      leaseId: first.lease!.id,
      workerId: "worker-first",
      fencingToken: first.lease!.fencingToken,
      occurredAt: "2026-04-03T14:00:30.000Z",
    });

    const second = service.acquireLease({
      executionId: "exec-lease-stale",
      workerId: "worker-second",
      ttlMs: 30_000,
      occurredAt: "2026-04-03T14:00:35.000Z",
    });

    const stale = service.validateWriteAccess({
      executionId: "exec-lease-stale",
      workerId: "worker-first",
      fencingToken: first.lease!.fencingToken,
      leaseId: first.lease!.id,
      occurredAt: "2026-04-03T14:00:40.000Z",
    });

    assert.equal(stale.allowed, false);
    assert.equal(stale.reasonCode, "stale_fencing_token");

    const current = service.validateWriteAccess({
      executionId: "exec-lease-stale",
      workerId: "worker-second",
      fencingToken: second.lease!.fencingToken,
      leaseId: second.lease!.id,
      occurredAt: "2026-04-03T14:00:40.000Z",
    });

    assert.equal(current.allowed, true);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionLeaseService reclaims expired leases", () => {
  const workspace = createTempWorkspace("aa-lease-reclaim-");
  const dbPath = join(workspace, "lease-reclaim.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-lease-reclaim",
      executionId: "exec-lease-reclaim",
    });

    service.acquireLease({
      executionId: "exec-lease-reclaim",
      workerId: "worker-reclaim",
      ttlMs: 10_000,
      occurredAt: "2026-04-03T15:00:00.000Z",
    });

    const reclaimed = service.reclaimExpiredLeases("2026-04-03T15:01:00.000Z");

    assert.ok(reclaimed.length > 0);
    assert.equal(reclaimed[0]?.status, "reclaimed");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("ExecutionLeaseService handover transfers to new worker", () => {
  const workspace = createTempWorkspace("aa-lease-handover-");
  const dbPath = join(workspace, "lease-handover.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const service = new ExecutionLeaseService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-lease-handover",
      executionId: "exec-lease-handover",
    });

    workers.recordHeartbeat({
      workerId: "worker-old",
      status: "busy",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-lease-handover"],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: "2026-04-03T16:00:00.000Z",
    });

    workers.recordHeartbeat({
      workerId: "worker-new",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: "2026-04-03T16:00:00.000Z",
    });

    const original = service.acquireLease({
      executionId: "exec-lease-handover",
      workerId: "worker-old",
      ttlMs: 30_000,
      occurredAt: "2026-04-03T16:00:05.000Z",
    });

    const handedOver = service.handoverLease({
      leaseId: original.lease!.id,
      workerId: "worker-old",
      newWorkerId: "worker-new",
      ttlMs: 30_000,
      occurredAt: "2026-04-03T16:00:10.000Z",
    });

    assert.equal(handedOver.outcome, "handed_over");
    assert.equal(handedOver.lease?.workerId, "worker-new");
    assert.ok(handedOver.lease!.fencingToken > original.lease!.fencingToken);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
