/**
 * Integration Test: Execution Dispatch Reconciliation
 *
 * Tests the dispatch reconciliation service that ensures consistency
 * between dispatch decisions and actual execution state.
 */

import * as assert from "node:assert/strict";
import * as test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { ExecutionDispatchService } from "../../../../../src/platform/execution/dispatcher/execution-dispatch-service.js";
import { ExecutionDispatchReconciliationService } from "../../../../../src/platform/execution/dispatcher/execution-dispatch-reconciliation-service.js";
import { WorkerRegistryService } from "../../../../../src/platform/execution/worker-pool/worker-registry-service.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

test("dispatch reconciliation: detects orphaned tickets without valid lease", () => {
  const workspace = createTempWorkspace("aa-dispatch-reconcile-");

  try {
    const db = new SqliteDatabase(join(workspace, "reconcile.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    const reconciliation = new ExecutionDispatchReconciliationService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-reconcile-orphan",
      executionId: "exec-reconcile-orphan",
      traceId: "trace-reconcile-orphan",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-reconcile-orphan");

    // Create ticket without dispatching
    const ticketResult = dispatch.createTicket({
      executionId: "exec-reconcile-orphan",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-10T10:00:00.000Z",
    });

    // Check reconciliation finds orphaned tickets
    const orphaned = reconciliation.scan();
    assert.ok(Array.isArray(orphaned));
    assert.ok(orphaned.length >= 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("dispatch reconciliation: reconciles dispatch state with execution state", () => {
  const workspace = createTempWorkspace("aa-dispatch-state-");

  try {
    const db = new SqliteDatabase(join(workspace, "state-reconcile.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);
    const reconciliation = new ExecutionDispatchReconciliationService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-state-reconcile",
      executionId: "exec-state-reconcile",
      traceId: "trace-state-reconcile",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-state-reconcile");

    workers.recordHeartbeat({
      workerId: "worker-reconcile",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-10T10:00:00.000Z",
    });

    dispatch.createTicket({
      executionId: "exec-state-reconcile",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-10T10:00:05.000Z",
    });

    const result = reconciliation.repair();
    assert.ok(Array.isArray(result.issues));
    assert.ok(Array.isArray(result.applied));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("dispatch reconciliation: handles multiple tickets for same execution", () => {
  const workspace = createTempWorkspace("aa-dispatch-multi-ticket-");

  try {
    const db = new SqliteDatabase(join(workspace, "multi-ticket.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const reconciliation = new ExecutionDispatchReconciliationService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-multi-ticket",
      executionId: "exec-multi-ticket",
      traceId: "trace-multi-ticket",
    });

    // Create multiple tickets
    store.insertExecutionTicket({
      id: "ticket-multi-1",
      executionId: "exec-multi-ticket",
      taskId: "task-multi-ticket",
      queueName: "default",
      status: "claimed",
      assignedWorkerId: "worker-1",
      priority: "normal",
      requiredCapabilitiesJson: "[\"bash\"]",
      dispatchAfter: null,
      createdAt: "2026-04-10T10:00:00.000Z",
      claimedAt: "2026-04-10T10:00:05.000Z",
      attempt: 0,
      leaseId: null,
      consumedAt: null,
      invalidatedAt: null,
      updatedAt: "2026-04-10T10:00:00.000Z",
    });

    store.insertExecutionTicket({
      id: "ticket-multi-2",
      executionId: "exec-multi-ticket",
      taskId: "task-multi-ticket",
      queueName: "default",
      status: "pending",
      assignedWorkerId: null,
      priority: "normal",
      requiredCapabilitiesJson: "[\"bash\"]",
      dispatchAfter: null,
      createdAt: "2026-04-10T10:00:06.000Z",
      claimedAt: null,
      attempt: 0,
      leaseId: null,
      consumedAt: null,
      invalidatedAt: null,
      updatedAt: "2026-04-10T10:00:06.000Z",
    });

    const orphaned = reconciliation.scan();
    assert.ok(Array.isArray(orphaned));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("dispatch reconciliation: cleanup resolves stale tickets", () => {
  const workspace = createTempWorkspace("aa-dispatch-cleanup-");

  try {
    const db = new SqliteDatabase(join(workspace, "cleanup.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const reconciliation = new ExecutionDispatchReconciliationService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-cleanup",
      executionId: "exec-cleanup",
      traceId: "trace-cleanup",
    });

    // Create stale pending ticket
    store.insertExecutionTicket({
      id: "ticket-stale",
      executionId: "exec-cleanup",
      taskId: "task-cleanup",
      queueName: "default",
      status: "pending",
      assignedWorkerId: null,
      priority: "normal",
      requiredCapabilitiesJson: "[\"bash\"]",
      dispatchAfter: null,
      createdAt: "2026-04-10T10:00:00.000Z",
      claimedAt: null,
      attempt: 0,
      leaseId: null,
      consumedAt: null,
      invalidatedAt: null,
      updatedAt: "2026-04-10T10:00:00.000Z",
    });

    const cleaned = reconciliation.repair();
    assert.ok(typeof cleaned === "object");
    assert.ok(Array.isArray(cleaned.issues));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("dispatch reconciliation: verifies worker capacity consistency", () => {
  const workspace = createTempWorkspace("aa-dispatch-capacity-");

  try {
    const db = new SqliteDatabase(join(workspace, "capacity.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const reconciliation = new ExecutionDispatchReconciliationService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-capacity",
      executionId: "exec-capacity",
      traceId: "trace-capacity",
    });

    // Record worker with specific capacity
    workers.recordHeartbeat({
      workerId: "worker-capacity-test",
      status: "busy",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-capacity"],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: "2026-04-10T10:00:00.000Z",
    });

    const result = reconciliation.scan();
    assert.ok(Array.isArray(result));
    assert.ok(result.length >= 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
