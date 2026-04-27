/**
 * Integration Test: Worker Pool with Dispatch Integration
 *
 * Tests worker registration, heartbeat tracking, load balancing,
 * and dispatch decisions using SQLite-backed storage.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { WorkerRegistryService } from "../../../../src/platform/execution/worker-pool/worker-registry-service.js";
import { ExecutionDispatchService } from "../../../../src/platform/execution/dispatcher/execution-dispatch-service.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";

function createWorkerDispatchContext(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "worker-dispatch.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, dbPath, db, store };
}

function seedTaskAndExecution(
  db: SqliteDatabase,
  store: AuthoritativeTaskStore,
  taskId: string,
  executionId: string,
  traceId: string,
  status: string = "created",
): void {
  const now = nowIso();
  db.transaction(() => {
    store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      title: `Task ${taskId}`,
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
    store.insertExecution({
      id: executionId,
      taskId,
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-1",
      roleId: "general_executor",
      runKind: "task_run",
      status,
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
}

test("WorkerPool: workers register via heartbeat and can be retrieved", () => {
  const ctx = createWorkerDispatchContext("aa-worker-reg-");
  try {
    const workers = new WorkerRegistryService(ctx.store);

    workers.recordHeartbeat({
      workerId: "worker-reg-001",
      status: "idle",
      capabilities: ["bash", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    const worker = workers.getWorker("worker-reg-001");
    assert.ok(worker !== null);
    assert.equal(worker?.workerId, "worker-reg-001");
    assert.equal(worker?.status, "idle");
    assert.deepEqual(worker?.capabilities, ["bash", "edit"]);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("WorkerPool: workers can be listed with filtering", () => {
  const ctx = createWorkerDispatchContext("aa-worker-list-");
  try {
    const workers = new WorkerRegistryService(ctx.store);

    workers.recordHeartbeat({
      workerId: "worker-a",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });
    workers.recordHeartbeat({
      workerId: "worker-b",
      status: "idle",
      capabilities: ["bash", "edit"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    const eligible = workers.listEligibleWorkers({
      requiredCapabilities: ["edit"],
      queueAffinity: "default",
    });

    assert.equal(eligible.length, 1);
    assert.equal(eligible[0]?.workerId, "worker-b");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("WorkerPool: degraded workers can be included with flag", () => {
  const ctx = createWorkerDispatchContext("aa-worker-degraded-");
  try {
    const workers = new WorkerRegistryService(ctx.store);

    workers.recordHeartbeat({
      workerId: "worker-degraded",
      status: "degraded",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      occurredAt: nowIso(),
    });

    const withoutDegraded = workers.listEligibleWorkers({
      requiredCapabilities: ["bash"],
    });
    assert.equal(withoutDegraded.length, 0);

    const withDegraded = workers.listEligibleWorkers({
      requiredCapabilities: ["bash"],
      includeDegraded: true,
    });
    assert.equal(withDegraded.length, 1);
    assert.equal(withDegraded[0]?.workerId, "worker-degraded");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("WorkerPool: worker isolation levels satisfy requirements", () => {
  const ctx = createWorkerDispatchContext("aa-worker-isol-");
  try {
    const workers = new WorkerRegistryService(ctx.store);

    workers.recordHeartbeat({
      workerId: "worker-standard",
      status: "idle",
      isolationLevel: "standard",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      occurredAt: nowIso(),
    });
    workers.recordHeartbeat({
      workerId: "worker-hardened",
      status: "idle",
      isolationLevel: "hardened",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      occurredAt: nowIso(),
    });

    const standardEligible = workers.listEligibleWorkers({
      requiredCapabilities: ["bash"],
      requiredIsolationLevel: "standard",
    });
    const hardenedEligible = workers.listEligibleWorkers({
      requiredCapabilities: ["bash"],
      requiredIsolationLevel: "hardened",
    });

    assert.equal(standardEligible.length, 2);
    assert.equal(hardenedEligible.length, 1);
    assert.equal(hardenedEligible[0]?.workerId, "worker-hardened");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("WorkerPool: stale workers are detected by heartbeat age", () => {
  const ctx = createWorkerDispatchContext("aa-worker-stale-");
  try {
    const workers = new WorkerRegistryService(ctx.store);

    workers.recordHeartbeat({
      workerId: "worker-old",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      occurredAt: "2026-04-01T10:00:00.000Z",
    });
    workers.recordHeartbeat({
      workerId: "worker-fresh",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      occurredAt: "2026-04-01T10:10:00.000Z",
    });

    const staleWorkers = workers.listStaleWorkers("2026-04-01T10:12:00.000Z", 60 * 1000);
    assert.equal(staleWorkers.length, 1);
    assert.equal(staleWorkers[0]?.workerId, "worker-old");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("WorkerPool: runtime restarts increment restart generation", () => {
  const ctx = createWorkerDispatchContext("aa-worker-restart-");
  try {
    const workers = new WorkerRegistryService(ctx.store);

    workers.recordHeartbeat({
      workerId: "worker-restart-test",
      status: "busy",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-1"],
      maxConcurrency: 1,
      runtimeInstanceId: "runtime-v1",
      occurredAt: "2026-04-01T10:00:00.000Z",
    });

    const restarted = workers.recordHeartbeat({
      workerId: "worker-restart-test",
      status: "busy",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-1"],
      maxConcurrency: 1,
      runtimeInstanceId: "runtime-v2",
      occurredAt: "2026-04-01T10:05:00.000Z",
    });

    assert.equal(restarted.restartGeneration, 1);
    assert.equal(restarted.restartedFromRuntimeInstanceId, "runtime-v1");
    assert.equal(restarted.runtimeInstanceId, "runtime-v2");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("WorkerPool: dispatch creates ticket and assigns worker", () => {
  const ctx = createWorkerDispatchContext("aa-dispatch-assign-");
  try {
    const dispatch = new ExecutionDispatchService(ctx.db, ctx.store);
    const workers = new WorkerRegistryService(ctx.store);

    seedTaskAndExecution(ctx.db, ctx.store, "task-dispatch-001", "exec-dispatch-001", "trace-dispatch-001");

    workers.recordHeartbeat({
      workerId: "worker-assign-001",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    dispatch.createTicket({
      executionId: "exec-dispatch-001",
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
    assert.equal(decision.worker?.workerId, "worker-assign-001");

    const tickets = ctx.store.listExecutionTicketsByExecution("exec-dispatch-001");
    assert.equal(tickets.length, 1);
    assert.equal(tickets[0]?.status, "claimed");
    assert.equal(tickets[0]?.assignedWorkerId, "worker-assign-001");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("WorkerPool: dispatch returns no_worker when capability missing", () => {
  const ctx = createWorkerDispatchContext("aa-dispatch-cap-");
  try {
    const dispatch = new ExecutionDispatchService(ctx.db, ctx.store);
    const workers = new WorkerRegistryService(ctx.store);

    seedTaskAndExecution(ctx.db, ctx.store, "task-cap-001", "exec-cap-001", "trace-cap-001");

    workers.recordHeartbeat({
      workerId: "worker-cap-basic",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    dispatch.createTicket({
      executionId: "exec-cap-001",
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
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("WorkerPool: dispatch honors dispatch_after delay", () => {
  const ctx = createWorkerDispatchContext("aa-dispatch-delay-");
  try {
    const dispatch = new ExecutionDispatchService(ctx.db, ctx.store);
    const workers = new WorkerRegistryService(ctx.store);

    seedTaskAndExecution(ctx.db, ctx.store, "task-delay-001", "exec-delay-001", "trace-delay-001");

    workers.recordHeartbeat({
      workerId: "worker-delay-001",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    dispatch.createTicket({
      executionId: "exec-delay-001",
      queueName: "default",
      requiredCapabilities: ["bash"],
      dispatchAfter: "2026-04-26T12:00:00.000Z",
      occurredAt: "2026-04-26T11:00:00.000Z",
    });

    const early = dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: "2026-04-26T11:30:00.000Z",
    });

    assert.equal(early.outcome, "no_ticket");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("WorkerPool: dispatch emits decision events", () => {
  const ctx = createWorkerDispatchContext("aa-dispatch-evts-");
  try {
    const dispatch = new ExecutionDispatchService(ctx.db, ctx.store);
    const workers = new WorkerRegistryService(ctx.store);

    seedTaskAndExecution(ctx.db, ctx.store, "task-evts-001", "exec-evts-001", "trace-evts-001");

    workers.recordHeartbeat({
      workerId: "worker-evts-001",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    dispatch.createTicket({
      executionId: "exec-evts-001",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: nowIso(),
    });

    dispatch.dispatchNext({
      queueName: "default",
      leaseTtlMs: 30_000,
      occurredAt: nowIso(),
    });

    const events = ctx.store.listEventsForTask("task-evts-001");
    assert.ok(events.some((e) => e.eventType === "dispatch:ticket_created"));
    assert.ok(events.some((e) => e.eventType === "dispatch:ticket_claimed"));
    assert.ok(events.some((e) => e.eventType === "dispatch:decision_recorded"));
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("WorkerPool: dispatch excludes draining workers", () => {
  const ctx = createWorkerDispatchContext("aa-dispatch-draining-");
  try {
    const dispatch = new ExecutionDispatchService(ctx.db, ctx.store);
    const workers = new WorkerRegistryService(ctx.store);

    seedTaskAndExecution(ctx.db, ctx.store, "task-draining-001", "exec-draining-001", "trace-draining-001");

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
      executionId: "exec-draining-001",
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
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("WorkerPool: dispatch excludes workers at capacity", () => {
  const ctx = createWorkerDispatchContext("aa-dispatch-capacity-");
  try {
    const dispatch = new ExecutionDispatchService(ctx.db, ctx.store);
    const workers = new WorkerRegistryService(ctx.store);

    seedTaskAndExecution(ctx.db, ctx.store, "task-capacity-001", "exec-capacity-001", "trace-capacity-001");

    workers.recordHeartbeat({
      workerId: "worker-at-capacity",
      status: "busy",
      capabilities: ["bash"],
      runningExecutionIds: ["exec-other-1", "exec-other-2"],
      maxConcurrency: 2,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

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
      executionId: "exec-capacity-001",
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
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("WorkerPool: lease is created on successful dispatch", () => {
  const ctx = createWorkerDispatchContext("aa-dispatch-lease-");
  try {
    const dispatch = new ExecutionDispatchService(ctx.db, ctx.store);
    const workers = new WorkerRegistryService(ctx.store);

    seedTaskAndExecution(ctx.db, ctx.store, "task-lease-001", "exec-lease-001", "trace-lease-001");

    workers.recordHeartbeat({
      workerId: "worker-lease-001",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    dispatch.createTicket({
      executionId: "exec-lease-001",
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
    assert.ok(decision.leaseId !== null);
    assert.ok(decision.leaseId!.length > 0);

    const leases = ctx.store.listLeasesByExecution("exec-lease-001");
    assert.equal(leases.length, 1);
    assert.equal(leases[0]?.workerId, "worker-lease-001");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("WorkerPool: duplicate ticket returns exists outcome", () => {
  const ctx = createWorkerDispatchContext("aa-dispatch-dup-");
  try {
    const dispatch = new ExecutionDispatchService(ctx.db, ctx.store);

    seedTaskAndExecution(ctx.db, ctx.store, "task-dup-001", "exec-dup-001", "trace-dup-001");

    const first = dispatch.createTicket({
      executionId: "exec-dup-001",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: nowIso(),
    });

    const second = dispatch.createTicket({
      executionId: "exec-dup-001",
      queueName: "default",
      requiredCapabilities: ["bash"],
      occurredAt: nowIso(),
    });

    assert.equal(first.outcome, "created");
    assert.equal(second.outcome, "exists");
    assert.equal(second.ticket.id, first.ticket.id);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("WorkerPool: dispatch decision includes trace for debugging", () => {
  const ctx = createWorkerDispatchContext("aa-dispatch-trace-");
  try {
    const dispatch = new ExecutionDispatchService(ctx.db, ctx.store);
    const workers = new WorkerRegistryService(ctx.store);

    seedTaskAndExecution(ctx.db, ctx.store, "task-trace-001", "exec-trace-001", "trace-trace-001");

    workers.recordHeartbeat({
      workerId: "worker-trace-001",
      status: "idle",
      capabilities: ["bash"],
      runningExecutionIds: [],
      maxConcurrency: 1,
      queueAffinity: "default",
      occurredAt: nowIso(),
    });

    dispatch.createTicket({
      executionId: "exec-trace-001",
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
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});
