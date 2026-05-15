/**
 * Execution Dispatch Service Integration Tests
 *
 * Tests the ExecutionDispatchService with real SQLite database and store.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ExecutionDispatchService } from "../../../../../src/platform/five-plane-execution/dispatcher/execution-dispatch-service.js";
import { WorkerRegistryService } from "../../../../../src/platform/five-plane-execution/worker-pool/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

test("dispatch service creates ticket and dispatches to worker with lease", () => {
  const workspace = createTempWorkspace("aa-dispatch-integration-");
  const dbPath = join(workspace, "dispatch.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-dispatch-int",
      executionId: "exec-dispatch-int",
      traceId: "trace-dispatch-int",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-int");

    workers.recordHeartbeat({
      workerId: "worker-dispatch",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: "2026-04-04T10:00:00.000Z",
    });

    const created = dispatch.createTicket({
      executionId: "exec-dispatch-int",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-04T10:00:05.000Z",
    });

    const dispatched = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T10:00:06.000Z",
    });

    const tickets = store.listExecutionTicketsByExecution("exec-dispatch-int");
    const lease = dispatched.leaseId ? store.getExecutionLease(dispatched.leaseId) : null;

    assert.equal(created.outcome, "created");
    assert.equal(dispatched.outcome, "dispatched");
    assert.equal(tickets[0]?.status, "claimed");
    assert.equal(tickets[0]?.assignedWorkerId, "worker-dispatch");
    assert.equal(lease?.workerId, "worker-dispatch");
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("dispatch service blocks when no workers available", () => {
  const workspace = createTempWorkspace("aa-dispatch-no-worker-");
  const dbPath = join(workspace, "dispatch-no-worker.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const dispatch = new ExecutionDispatchService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-no-worker",
      executionId: "exec-no-worker",
      traceId: "trace-no-worker",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-no-worker");

    dispatch.createTicket({
      executionId: "exec-no-worker",
      queueName: "default",
      occurredAt: "2026-04-04T11:00:00.000Z",
    });

    const dispatched = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T11:00:01.000Z",
    });

    assert.equal(dispatched.outcome, "no_worker");
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("dispatch service selects worker based on capabilities match", () => {
  const workspace = createTempWorkspace("aa-dispatch-caps-");
  const dbPath = join(workspace, "dispatch-caps.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-caps",
      executionId: "exec-caps",
      traceId: "trace-caps",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-caps");

    workers.recordHeartbeat({
      workerId: "worker-partial",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: "2026-04-04T12:00:00.000Z",
    });

    workers.recordHeartbeat({
      workerId: "worker-full",
      status: "idle",
      capabilities: ["bash", "python", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: "2026-04-04T12:00:00.000Z",
    });

    dispatch.createTicket({
      executionId: "exec-caps",
      queueName: "default",
      requiredCapabilities: ["bash", "python"],
      occurredAt: "2026-04-04T12:00:05.000Z",
    });

    const dispatched = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-04T12:00:06.000Z",
    });

    assert.equal(dispatched.outcome, "dispatched");
    assert.equal(dispatched.worker?.workerId, "worker-full");
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("dispatch service handles critical priority with emergency lane", () => {
  const workspace = createTempWorkspace("aa-dispatch-critical-");
  const dbPath = join(workspace, "dispatch-critical.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-critical",
      executionId: "exec-critical",
      traceId: "trace-critical",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-critical");

    workers.recordHeartbeat({
      workerId: "worker-critical",
      status: "idle",
      capabilities: ["bash"],
      placement: "local",
      availableSlots: 1,
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-04T13:00:00.000Z",
    });

    const created = dispatch.createTicket({
      executionId: "exec-critical",
      queueName: "default",
      priority: "critical",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-04T13:00:05.000Z",
    });

    assert.equal(created.outcome, "created");
    assert.equal(created.ticket?.priority, "critical");
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("dispatch service returns existing ticket on duplicate create", () => {
  const workspace = createTempWorkspace("aa-dispatch-exists-");
  const dbPath = join(workspace, "dispatch-exists.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const dispatch = new ExecutionDispatchService(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-exists",
      executionId: "exec-exists",
      traceId: "trace-exists",
    });

    db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-exists");

    const first = dispatch.createTicket({
      executionId: "exec-exists",
      queueName: "default",
      occurredAt: "2026-04-04T14:00:00.000Z",
    });

    const second = dispatch.createTicket({
      executionId: "exec-exists",
      queueName: "default",
      occurredAt: "2026-04-04T14:00:01.000Z",
    });

    assert.equal(first.outcome, "created");
    assert.equal(second.outcome, "exists");
    assert.equal(second.ticket?.id, first.ticket?.id);
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});