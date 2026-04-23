import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { ExecutionDispatchService } from "../../../../src/platform/execution/dispatcher/execution-dispatch-service.js";
import { ExecutionLeaseService } from "../../../../src/platform/execution/lease/execution-lease-service.js";
import { WorkerRegistryService } from "../../../../src/platform/execution/worker-pool/worker/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";

test("integration: execution dispatch creates ticket and dispatches to eligible worker with lease", () => {
  const workspace = createTempWorkspace("aa-exec-flow-");
  const dbPath = join(workspace, "exec-flow.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const dispatch = new ExecutionDispatchService(db, store);
    const leases = new ExecutionLeaseService(db, store);
    const workers = new WorkerRegistryService(store);

    seedTaskAndExecution(db, store, {
      taskId: "task-exec-flow-001",
      executionId: "exec-exec-flow-001",
      traceId: "trace-exec-flow-001",
    });

    db.connection.prepare("UPDATE executions SET status = ? WHERE id = ?").run("created", "exec-exec-flow-001");
    workers.recordHeartbeat({
      workerId: "worker-exec-flow",
      status: "idle",
      capabilities: ["bash", "edit", "read"],
      runningExecutionIds: [],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: "2026-04-10T10:00:00.000Z",
    });

    const ticket = dispatch.createTicket({
      executionId: "exec-exec-flow-001",
      queueName: "default",
      requiredCapabilities: ["bash", "edit"],
      occurredAt: "2026-04-10T10:00:05.000Z",
    });

    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-10T10:00:06.000Z",
    });

    const persistedTicket = store.getExecutionTicket(ticket.ticket.id);
    const persistedLease = decision.leaseId ? store.getExecutionLease(decision.leaseId) : null;
    db.close();

    assert.equal(ticket.outcome, "created");
    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-exec-flow");
    assert.equal(persistedTicket?.status, "claimed");
    assert.equal(persistedTicket?.assignedWorkerId, "worker-exec-flow");
    assert.equal(persistedLease?.workerId, "worker-exec-flow");
    assert.ok(decision.leaseId != null);
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: execution dispatch records ticket_created, ticket_claimed, and decision_recorded events", () => {
  const workspace = createTempWorkspace("aa-exec-events-");
  const dbPath = join(workspace, "exec-events.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const dispatch = new ExecutionDispatchService(db, store);
    const workers = new WorkerRegistryService(store);

    seedTaskAndExecution(db, store, {
      taskId: "task-exec-events-001",
      executionId: "exec-exec-events-001",
      traceId: "trace-exec-events-001",
    });

    db.connection.prepare("UPDATE executions SET status = ? WHERE id = ?").run("created", "exec-exec-events-001");
    workers.recordHeartbeat({
      workerId: "worker-events",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-10T10:00:00.000Z",
    });

    dispatch.createTicket({
      executionId: "exec-exec-events-001",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-10T10:00:05.000Z",
    });
    dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-10T10:00:06.000Z",
    });

    const events = store.listEventsForTask("task-exec-events-001");
    db.close();

    assert.ok(events.some((e) => e.eventType === "dispatch:ticket_created"), "expected ticket_created event");
    assert.ok(events.some((e) => e.eventType === "dispatch:ticket_claimed"), "expected ticket_claimed event");
    assert.ok(events.some((e) => e.eventType === "dispatch:decision_recorded"), "expected decision_recorded event");
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: execution dispatch preempts low-priority execution for urgent task when worker is busy but resumable", () => {
  const workspace = createTempWorkspace("aa-exec-preempt-");
  const dbPath = join(workspace, "exec-preempt.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const dispatch = new ExecutionDispatchService(db, store);
    const leases = new ExecutionLeaseService(db, store);
    const workers = new WorkerRegistryService(store);

    seedTaskAndExecution(db, store, {
      taskId: "task-preempt-low",
      executionId: "exec-preempt-low",
      traceId: "trace-preempt-low",
    });
    seedTaskAndExecution(db, store, {
      taskId: "task-preempt-urgent",
      executionId: "exec-preempt-urgent",
      traceId: "trace-preempt-urgent",
    });

    db.connection.prepare("UPDATE tasks SET priority = ? WHERE id = ?").run("low", "task-preempt-low");
    db.connection.prepare("UPDATE tasks SET priority = ? WHERE id = ?").run("urgent", "task-preempt-urgent");
    db.connection.prepare("UPDATE executions SET status = ? WHERE id = ?").run("created", "exec-preempt-urgent");

    store.insertWorkflowState({
      taskId: "task-preempt-low",
      divisionId: "general_ops",
      workflowId: "single_division_multi_step_orchestration",
      currentStepIndex: 1,
      status: "running",
      outputsJson: JSON.stringify({}),
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: "draft_solution",
      startedAt: "2026-04-10T09:00:00.000Z",
      updatedAt: "2026-04-10T09:00:00.000Z",
    });

    const lowTicket = dispatch.createTicket({
      executionId: "exec-preempt-low",
      priority: "low",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-10T09:00:05.000Z",
    }).ticket;
    store.consumeExecutionTicket(lowTicket.id, "2026-04-10T09:00:06.000Z");
    leases.acquireLease({
      executionId: "exec-preempt-low",
      workerId: "worker-preempt",
      ttlMs: 30_000,
      queueName: "default",
      occurredAt: "2026-04-10T09:00:07.000Z",
    });

    workers.recordHeartbeat({
      workerId: "worker-preempt",
      status: "busy",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-preempt-low"],
      maxConcurrency: 1,
      queueAffinity: "default",
      currentStepId: "draft_solution",
      lastProgressAt: "2026-04-10T09:00:08.000Z",
      occurredAt: "2026-04-10T09:00:08.000Z",
    });

    const lowExecution = store.getExecution("exec-preempt-low");
    store.upsertAgentExecutionRecord({
      executionId: "exec-preempt-low",
      taskId: "task-preempt-low",
      agentId: lowExecution!.agentId,
      workflowId: lowExecution!.workflowId,
      roleId: lowExecution!.roleId,
      runKind: lowExecution!.runKind,
      runtimeInstanceId: "runtime-preempt",
      restartedFromRuntimeInstanceId: null,
      restartGeneration: 0,
      status: "executing",
      planJson: JSON.stringify({ workflowId: lowExecution!.workflowId }),
      currentStepId: "draft_solution",
      lastToolName: "bash",
      toolCallCount: 1,
      lastDecisionJson: null,
      lastErrorCode: null,
      retryCount: 0,
      progressMessage: "working",
      startedAt: "2026-04-10T09:00:00.000Z",
      createdAt: "2026-04-10T09:00:00.000Z",
      updatedAt: "2026-04-10T09:00:08.000Z",
      completedAt: null,
    });

    dispatch.createTicket({
      executionId: "exec-preempt-urgent",
      priority: "urgent",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-10T09:00:09.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-10T09:00:10.000Z",
    });

    const preemptedExecution = store.getExecution("exec-preempt-low");
    const preemptedWorkflow = store.getWorkflowState("task-preempt-low");
    db.close();

    assert.equal(decision.outcome, "dispatched");
    assert.equal(decision.worker?.workerId, "worker-preempt");
    assert.equal(decision.trace?.preemption?.applied, true);
    assert.equal(decision.trace?.preemption?.preemptedExecutionId, "exec-preempt-low");
    assert.equal(preemptedExecution?.status, "blocked");
    assert.equal(preemptedWorkflow?.status, "paused");
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: execution dispatch blocks ticket when no worker satisfies capability contract", () => {
  const workspace = createTempWorkspace("aa-exec-no-worker-");
  const dbPath = join(workspace, "exec-no-worker.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const dispatch = new ExecutionDispatchService(db, store);
    const workers = new WorkerRegistryService(store);

    seedTaskAndExecution(db, store, {
      taskId: "task-no-worker",
      executionId: "exec-no-worker",
      traceId: "trace-no-worker",
    });

    db.connection.prepare("UPDATE executions SET status = ? WHERE id = ?").run("created", "exec-no-worker");
    workers.recordHeartbeat({
      workerId: "worker-basic",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-10T10:00:00.000Z",
    });

    const ticket = dispatch.createTicket({
      executionId: "exec-no-worker",
      queueName: "default",
      requiredCapabilities: ["mcp"],
      occurredAt: "2026-04-10T10:00:05.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-10T10:00:06.000Z",
    });

    const persistedTicket = store.getExecutionTicket(ticket.ticket.id);
    db.close();

    assert.equal(decision.outcome, "no_worker");
    assert.equal(persistedTicket?.status, "pending");
    assert.equal(persistedTicket?.assignedWorkerId, null);
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: execution dispatch honors dispatch_after delay before routing tickets", () => {
  const workspace = createTempWorkspace("aa-exec-delay-");
  const dbPath = join(workspace, "exec-delay.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const dispatch = new ExecutionDispatchService(db, store);
    const workers = new WorkerRegistryService(store);

    seedTaskAndExecution(db, store, {
      taskId: "task-delay",
      executionId: "exec-delay",
      traceId: "trace-delay",
    });

    db.connection.prepare("UPDATE executions SET status = ? WHERE id = ?").run("created", "exec-delay");
    workers.recordHeartbeat({
      workerId: "worker-delay",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-10T10:00:00.000Z",
    });

    dispatch.createTicket({
      executionId: "exec-delay",
      queueName: "default",
      requiredCapabilities: ["bash"],
      dispatchAfter: "2026-04-10T10:05:00.000Z",
      occurredAt: "2026-04-10T10:00:05.000Z",
    });

    const early = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-10T10:01:00.000Z",
    });
    const later = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-10T10:05:01.000Z",
    });

    db.close();

    assert.equal(early.outcome, "no_ticket");
    assert.equal(later.outcome, "dispatched");
    assert.equal(later.worker?.workerId, "worker-delay");
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: execution dispatch degrades gracefully when queue is unavailable", () => {
  const workspace = createTempWorkspace("aa-exec-queue-degrade-");
  const dbPath = join(workspace, "exec-queue-degrade.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const workers = new WorkerRegistryService(store);
    const dispatch = new ExecutionDispatchService(
      db,
      store,
      null,
      () => ({
        state: "unavailable",
        reasonCode: "queue_unavailable",
      }),
    );

    seedTaskAndExecution(db, store, {
      taskId: "task-queue-degrade",
      executionId: "exec-queue-degrade",
      traceId: "trace-queue-degrade",
    });

    db.connection.prepare("UPDATE executions SET status = ? WHERE id = ?").run("created", "exec-queue-degrade");
    workers.recordHeartbeat({
      workerId: "worker-queue-degrade",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: "2026-04-10T10:00:00.000Z",
    });

    const ticket = dispatch.createTicket({
      executionId: "exec-queue-degrade",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: "2026-04-10T10:00:05.000Z",
    });
    const decision = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-10T10:00:06.000Z",
    });

    const persistedTicket = store.getExecutionTicket(ticket.ticket.id);
    db.close();

    assert.equal(decision.outcome, "blocked");
    assert.equal(decision.reasonCode, "queue_unavailable");
    assert.equal(persistedTicket?.status, "pending");
  } finally {
    cleanupPath(workspace);
  }
});