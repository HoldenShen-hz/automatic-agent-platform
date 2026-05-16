import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ExecutionLeaseService } from "../../../../../src/platform/five-plane-execution/lease/execution-lease-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

const BASE_TIME = "2026-04-23T10:00:00.000Z";
const TTL_MS = 30_000;

test("lease: acquire throws when execution not found", () => {
  const workspace = createTempWorkspace("aa-lease-notfound-");
  const dbPath = join(workspace, "lease-notfound.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);

    assert.throws(
      () =>
        service.acquireLease({
          executionId: "non-existent-execution",
          workerId: "worker-notfound",
          ttlMs: TTL_MS,
          occurredAt: BASE_TIME,
        }),
      /Execution not found/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lease: renew and release are blocked when lease not found", () => {
  const workspace = createTempWorkspace("aa-lease-notfound-ops-");
  const dbPath = join(workspace, "lease-notfound-ops.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);

    const renewBlocked = service.renewLease({
      leaseId: "non-existent-lease",
      workerId: "worker-x",
      ttlMs: TTL_MS,
      occurredAt: BASE_TIME,
    });
    assert.equal(renewBlocked.outcome, "blocked");
    assert.equal(renewBlocked.reasonCode, "lease_not_found");

    const releaseBlocked = service.releaseLease({
      leaseId: "non-existent-lease",
      workerId: "worker-x",
      occurredAt: BASE_TIME,
    });
    assert.equal(releaseBlocked.outcome, "blocked");
    assert.equal(releaseBlocked.reasonCode, "lease_not_found");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lease: multiple leases for same execution are not allowed", () => {
  const workspace = createTempWorkspace("aa-lease-no-duplicate-");
  const dbPath = join(workspace, "lease-no-duplicate.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const service = new ExecutionLeaseService(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-no-dup",
      executionId: "exec-no-dup",
    });

    service.acquireLease({
      executionId: "exec-no-dup",
      workerId: "worker-dup-1",
      ttlMs: TTL_MS,
      occurredAt: BASE_TIME,
    });

    const secondAcquisition = service.acquireLease({
      executionId: "exec-no-dup",
      workerId: "worker-dup-2",
      ttlMs: TTL_MS,
      occurredAt: BASE_TIME,
    });

    assert.equal(secondAcquisition.outcome, "blocked");
    assert.equal(secondAcquisition.reasonCode, "active_lease_exists");

    const activeLeases = store.worker.listExecutionLeases("exec-no-dup").filter((lease) => lease.status === "active");
    assert.equal(activeLeases.length, 1);
    assert.equal(activeLeases[0]!.workerId, "worker-dup-1");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
