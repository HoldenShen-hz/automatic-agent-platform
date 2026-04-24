/**
 * Integration Test: Dispatcher Module
 *
 * Tests ExecutionDispatchService with real SQLite database,
 * verifying dispatch decisions, ticket management, and worker coordination.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { ExecutionDispatchService } from "../../../../src/platform/execution/dispatcher/execution-dispatch-service.js";
import { WorkerRegistryService } from "../../../../src/platform/execution/worker-pool/worker-registry-service.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";

function createIntegrationContext(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "dispatcher-test.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, dbPath, db, store, cleanup: () => { db.close(); cleanupPath(workspace); } };
}

test("ExecutionDispatchService creates a ticket for a valid execution", () => {
  const ctx = createIntegrationContext("aa-dispatch-create-");
  try {
    const dispatch = new ExecutionDispatchService(ctx.db, ctx.store);
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-ticket-create",
      executionId: "exec-ticket-create",
      traceId: "trace-ticket-create",
    });

    ctx.db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-ticket-create");

    const result = dispatch.createTicket({
      executionId: "exec-ticket-create",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: nowIso(),
    });

    assert.equal(result.outcome, "created");
    assert.ok(result.ticket);
    assert.equal(result.ticket.executionId, "exec-ticket-create");
    assert.equal(result.ticket.status, "pending");

    ctx.db.close();
  } finally {
    ctx.cleanup();
  }
});

test("ExecutionDispatchService returns exists when ticket already exists", () => {
  const ctx = createIntegrationContext("aa-dispatch-exists-");
  try {
    const dispatch = new ExecutionDispatchService(ctx.db, ctx.store);
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-ticket-exists",
      executionId: "exec-ticket-exists",
      traceId: "trace-ticket-exists",
    });

    ctx.db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-ticket-exists");

    const first = dispatch.createTicket({
      executionId: "exec-ticket-exists",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: nowIso(),
    });

    const second = dispatch.createTicket({
      executionId: "exec-ticket-exists",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: nowIso(),
    });

    assert.equal(first.outcome, "created");
    assert.equal(second.outcome, "exists");
    assert.equal(second.ticket.id, first.ticket.id);

    ctx.db.close();
  } finally {
    ctx.cleanup();
  }
});

test("ExecutionDispatchService dispatches to an eligible idle worker", () => {
  const ctx = createIntegrationContext("aa-dispatch-eligible-");
  try {
    const dispatch = new ExecutionDispatchService(ctx.db, ctx.store);
    const workers = new WorkerRegistryService(ctx.store);

    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-dispatch-eligible",
      executionId: "exec-dispatch-eligible",
      traceId: "trace-dispatch-eligible",
    });

    ctx.db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-eligible");

    workers.recordHeartbeat({
      workerId: "worker-eligible",
      status: "idle",
      capabilities: ["bash", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    dispatch.createTicket({
      executionId: "exec-dispatch-eligible",
      queueName: "default",
      requiredCapabilities: ["bash", "edit"],
      occurredAt: nowIso(),
    });

    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: nowIso(),
    });

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-eligible");

    const tickets = ctx.store.listExecutionTicketsByExecution("exec-dispatch-eligible");
    assert.equal(tickets.length, 1);
    assert.equal(tickets[0]?.status, "claimed");
    assert.equal(tickets[0]?.assignedWorkerId, "worker-eligible");

    ctx.db.close();
  } finally {
    ctx.cleanup();
  }
});

test("ExecutionDispatchService returns no_worker when no eligible workers exist", () => {
  const ctx = createIntegrationContext("aa-dispatch-no-worker-");
  try {
    const dispatch = new ExecutionDispatchService(ctx.db, ctx.store);
    const workers = new WorkerRegistryService(ctx.store);

    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-dispatch-no-worker",
      executionId: "exec-dispatch-no-worker",
      traceId: "trace-dispatch-no-worker",
    });

    ctx.db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-no-worker");

    // Register a worker without the required capability
    workers.recordHeartbeat({
      workerId: "worker-basic",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    dispatch.createTicket({
      executionId: "exec-dispatch-no-worker",
      queueName: "default",
      requiredCapabilities: ["mcp"],
      occurredAt: nowIso(),
    });

    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: nowIso(),
    });

    assert.equal(decision.outcome, "no_worker");

    ctx.db.close();
  } finally {
    ctx.cleanup();
  }
});

test("ExecutionDispatchService returns no_ticket when queue is empty", () => {
  const ctx = createIntegrationContext("aa-dispatch-no-ticket-");
  try {
    const dispatch = new ExecutionDispatchService(ctx.db, ctx.store);
    const workers = new WorkerRegistryService(ctx.store);

    workers.recordHeartbeat({
      workerId: "worker-idle",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: nowIso(),
    });

    assert.equal(decision.outcome, "no_ticket");

    ctx.db.close();
  } finally {
    ctx.cleanup();
  }
});

test("ExecutionDispatchService excludes workers with missing capabilities", () => {
  const ctx = createIntegrationContext("aa-dispatch-capability-");
  try {
    const dispatch = new ExecutionDispatchService(ctx.db, ctx.store);
    const workers = new WorkerRegistryService(ctx.store);

    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-dispatch-capability",
      executionId: "exec-dispatch-capability",
      traceId: "trace-dispatch-capability",
    });

    ctx.db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-capability");

    workers.recordHeartbeat({
      workerId: "worker-missing-cap",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    workers.recordHeartbeat({
      workerId: "worker-has-cap",
      status: "idle",
      capabilities: ["bash", "edit", "read"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    dispatch.createTicket({
      executionId: "exec-dispatch-capability",
      queueName: "default",
      requiredCapabilities: ["edit"],
      occurredAt: nowIso(),
    });

    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: nowIso(),
    });

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-has-cap");

    ctx.db.close();
  } finally {
    ctx.cleanup();
  }
});

test("ExecutionDispatchService excludes workers at capacity", () => {
  const ctx = createIntegrationContext("aa-dispatch-capacity-");
  try {
    const dispatch = new ExecutionDispatchService(ctx.db, ctx.store);
    const workers = new WorkerRegistryService(ctx.store);

    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-dispatch-capacity",
      executionId: "exec-dispatch-capacity",
      traceId: "trace-dispatch-capacity",
    });

    ctx.db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-capacity");

    // Worker at full capacity
    workers.recordHeartbeat({
      workerId: "worker-at-capacity",
      status: "busy",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-other-1", "exec-other-2"],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    // Worker with capacity
    workers.recordHeartbeat({
      workerId: "worker-has-capacity",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    dispatch.createTicket({
      executionId: "exec-dispatch-capacity",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: nowIso(),
    });

    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: nowIso(),
    });

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-has-capacity");

    ctx.db.close();
  } finally {
    ctx.cleanup();
  }
});

test("ExecutionDispatchService excludes draining workers", () => {
  const ctx = createIntegrationContext("aa-dispatch-draining-");
  try {
    const dispatch = new ExecutionDispatchService(ctx.db, ctx.store);
    const workers = new WorkerRegistryService(ctx.store);

    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-dispatch-draining",
      executionId: "exec-dispatch-draining",
      traceId: "trace-dispatch-draining",
    });

    ctx.db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-draining");

    workers.recordHeartbeat({
      workerId: "worker-draining",
      status: "draining",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    dispatch.createTicket({
      executionId: "exec-dispatch-draining",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: nowIso(),
    });

    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: nowIso(),
    });

    assert.equal(decision.outcome, "no_worker");

    ctx.db.close();
  } finally {
    ctx.cleanup();
  }
});

test("ExecutionDispatchService honors dispatch_after delay", () => {
  const ctx = createIntegrationContext("aa-dispatch-delay-");
  try {
    const dispatch = new ExecutionDispatchService(ctx.db, ctx.store);
    const workers = new WorkerRegistryService(ctx.store);

    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-dispatch-delay",
      executionId: "exec-dispatch-delay",
      traceId: "trace-dispatch-delay",
    });

    ctx.db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-delay");

    workers.recordHeartbeat({
      workerId: "worker-delay",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    dispatch.createTicket({
      executionId: "exec-dispatch-delay",
      queueName: "default",
      requiredCapabilities: ["bash"],
      dispatchAfter: "2026-04-24T12:00:00.000Z",
      occurredAt: "2026-04-24T11:00:00.000Z",
    });

    // Try to dispatch before the delay
    const early = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-24T11:30:00.000Z",
    });

    assert.equal(early.outcome, "no_ticket");

    // Dispatch after delay has passed
    const late = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-24T12:00:01.000Z",
    });

    assert.equal(late.outcome, "dispatched");
    assert.equal(late.worker?.workerId, "worker-delay");

    ctx.db.close();
  } finally {
    ctx.cleanup();
  }
});

test("ExecutionDispatchService emits decision events to the event store", () => {
  const ctx = createIntegrationContext("aa-dispatch-events-");
  try {
    const dispatch = new ExecutionDispatchService(ctx.db, ctx.store);
    const workers = new WorkerRegistryService(ctx.store);

    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-dispatch-events",
      executionId: "exec-dispatch-events",
      traceId: "trace-dispatch-events",
    });

    ctx.db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-events");

    workers.recordHeartbeat({
      workerId: "worker-events",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    dispatch.createTicket({
      executionId: "exec-dispatch-events",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: nowIso(),
    });

    dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: nowIso(),
    });

    const events = ctx.store.listEventsForTask("task-dispatch-events");
    assert.ok(events.some((e: { eventType: string }) => e.eventType === "dispatch:ticket_created"));
    assert.ok(events.some((e: { eventType: string }) => e.eventType === "dispatch:decision_recorded"));
    assert.ok(events.some((e: { eventType: string }) => e.eventType === "dispatch:ticket_claimed"));

    ctx.db.close();
  } finally {
    ctx.cleanup();
  }
});

test("ExecutionDispatchService records evaluation trace for debugging", () => {
  const ctx = createIntegrationContext("aa-dispatch-trace-");
  try {
    const dispatch = new ExecutionDispatchService(ctx.db, ctx.store);
    const workers = new WorkerRegistryService(ctx.store);

    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-dispatch-trace",
      executionId: "exec-dispatch-trace",
      traceId: "trace-dispatch-trace",
    });

    ctx.db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", "exec-dispatch-trace");

    workers.recordHeartbeat({
      workerId: "worker-trace",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    dispatch.createTicket({
      executionId: "exec-dispatch-trace",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: nowIso(),
    });

    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: nowIso(),
    });

    assert.ok(decision.trace);
    assert.equal(decision.trace?.outcome, "dispatched");
    assert.ok(decision.trace?.evaluations.length > 0);

    ctx.db.close();
  } finally {
    ctx.cleanup();
  }
});
