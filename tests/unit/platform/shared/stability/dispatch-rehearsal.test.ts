/**
 * Unit tests for the Stable Dispatch Rehearsal Module.
 *
 * Tests the dispatch service behavior through scenario-based validation:
 * - Worker selection based on capabilities
 * - Dispatch timing constraints (dispatch_after)
 * - Capability gap handling
 * - Queue affinity load balancing
 */

import { rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { ExecutionDispatchService } from "../../../../../src/platform/five-plane-execution/dispatcher/execution-dispatch-service.js";
import { WorkerRegistryService } from "../../../../../src/platform/five-plane-execution/worker-pool/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";

function createTempDb(): { db: SqliteDatabase; store: AuthoritativeTaskStore; cleanup: () => void } {
  const dbPath = join("/tmp", `dispatch-test-${Date.now()}.db`);
  rmSync(dbPath, { force: true });
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return {
    db,
    store,
    cleanup: () => {
      db.close();
      rmSync(dbPath, { force: true });
    },
  };
}

function seedTaskAndExecution(
  db: SqliteDatabase,
  store: AuthoritativeTaskStore,
  taskId: string,
  executionId: string,
  traceId: string,
): void {
  const now = new Date().toISOString();
  db.transaction(() => {
    store.task.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      title: "Test task",
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
    store.execution.insertExecution({
      id: executionId,
      taskId,
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-test",
      roleId: "general_executor",
      runKind: "task_run",
      status: "created",
      inputRef: null,
      traceId,
      attempt: 1,
      timeoutMs: 1_000,
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
    } as any);
  });
}

test("dispatch creates a ticket successfully", (t, done) => {
  const { db, store, cleanup } = createTempDb();
  const dispatch = new ExecutionDispatchService(db, store);

  seedTaskAndExecution(db, store, "task-ticket-1", "exec-ticket-1", "trace-ticket-1");

  const ticket = dispatch.createTicket({
    executionId: "exec-ticket-1",
    queueName: "default",
    requiredCapabilities: ["bash"],
    occurredAt: "2026-04-10T10:00:00.000Z",
  });

  t.after(() => cleanup());

  if (ticket.ticket.status !== "pending") {
    throw new Error(`Expected ticket status to be pending, got ${ticket.ticket.status}`);
  }
  done();
});

test("dispatch selects worker with matching capabilities", (t, done) => {
  const { db, store, cleanup } = createTempDb();
  const workers = new WorkerRegistryService(store);
  const dispatch = new ExecutionDispatchService(db, store);

  seedTaskAndExecution(db, store, "task-capable-1", "exec-capable-1", "trace-capable-1");

  // Register a capable worker
  workers.recordHeartbeat({
    workerId: "worker-bash",
    status: "idle",
    capabilities: ["bash"],
    runningExecutionIds: [],
    maxConcurrency: 1,
    queueAffinity: "default",
    occurredAt: "2026-04-10T10:00:00.000Z",
  });

  dispatch.createTicket({
    executionId: "exec-capable-1",
    queueName: "default",
    requiredCapabilities: ["bash"],
    occurredAt: "2026-04-10T10:00:05.000Z",
  });

  const decision = dispatch.dispatchNext({
    queueName: "default",
    leaseTtlMs: 30_000,
    occurredAt: "2026-04-10T10:00:06.000Z",
  });

  t.after(() => cleanup());

  if (decision.outcome !== "dispatched") {
    throw new Error(`Expected dispatched, got ${decision.outcome}`);
  }
  if (decision.worker?.workerId !== "worker-bash") {
    throw new Error(`Expected worker-bash, got ${decision.worker?.workerId}`);
  }
  done();
});

test("dispatch rejects worker with missing capabilities", (t, done) => {
  const { db, store, cleanup } = createTempDb();
  const workers = new WorkerRegistryService(store);
  const dispatch = new ExecutionDispatchService(db, store);

  seedTaskAndExecution(db, store, "task-missing-1", "exec-missing-1", "trace-missing-1");

  // Register a worker with only bash capability
  workers.recordHeartbeat({
    workerId: "worker-bash-only",
    status: "idle",
    capabilities: ["bash"],
    runningExecutionIds: [],
    maxConcurrency: 1,
    queueAffinity: "default",
    occurredAt: "2026-04-10T10:00:00.000Z",
  });

  // Create a ticket requiring mcp capability
  dispatch.createTicket({
    executionId: "exec-missing-1",
    queueName: "default",
    requiredCapabilities: ["mcp"],
    occurredAt: "2026-04-10T10:00:05.000Z",
  });

  const decision = dispatch.dispatchNext({
    queueName: "default",
    leaseTtlMs: 30_000,
    occurredAt: "2026-04-10T10:00:06.000Z",
  });

  t.after(() => cleanup());

  if (decision.outcome !== "no_worker") {
    throw new Error(`Expected no_worker, got ${decision.outcome}`);
  }
  done();
});

test("dispatch respects dispatch_after timing constraint", (t, done) => {
  const { db, store, cleanup } = createTempDb();
  const workers = new WorkerRegistryService(store);
  const dispatch = new ExecutionDispatchService(db, store);

  seedTaskAndExecution(db, store, "task-after-1", "exec-after-1", "trace-after-1");

  workers.recordHeartbeat({
    workerId: "worker-after",
    status: "idle",
    capabilities: ["bash"],
    runningExecutionIds: [],
    maxConcurrency: 1,
    queueAffinity: "default",
    occurredAt: "2026-04-10T10:00:00.000Z",
  });

  // Create a ticket with dispatch_after in the future
  dispatch.createTicket({
    executionId: "exec-after-1",
    queueName: "default",
    requiredCapabilities: ["bash"],
    dispatchAfter: "2026-04-10T11:00:00.000Z",
    occurredAt: "2026-04-10T10:00:05.000Z",
  });

  // Try to dispatch before dispatch_after time
  const earlyDecision = dispatch.dispatchNext({
    queueName: "default",
    leaseTtlMs: 30_000,
    occurredAt: "2026-04-10T10:30:00.000Z",
  });

  t.after(() => cleanup());

  if (earlyDecision.outcome !== "no_ticket") {
    throw new Error(`Expected no_ticket for early dispatch, got ${earlyDecision.outcome}`);
  }
  done();
});

test("dispatch returns no_worker when no capable workers exist", (t, done) => {
  const { db, store, cleanup } = createTempDb();
  const dispatch = new ExecutionDispatchService(db, store);

  seedTaskAndExecution(db, store, "task-empty-1", "exec-empty-1", "trace-empty-1");

  // No workers registered
  dispatch.createTicket({
    executionId: "exec-empty-1",
    queueName: "default",
    requiredCapabilities: ["bash"],
    occurredAt: "2026-04-10T10:00:05.000Z",
  });

  const decision = dispatch.dispatchNext({
    queueName: "default",
    leaseTtlMs: 30_000,
    occurredAt: "2026-04-10T10:00:06.000Z",
  });

  t.after(() => cleanup());

  if (decision.outcome !== "no_worker") {
    throw new Error(`Expected no_worker, got ${decision.outcome}`);
  }
  done();
});

test("multiple workers are evaluated in dispatch decision", (t, done) => {
  const { db, store, cleanup } = createTempDb();
  const workers = new WorkerRegistryService(store);
  const dispatch = new ExecutionDispatchService(db, store);

  seedTaskAndExecution(db, store, "task-multi-1", "exec-multi-1", "trace-multi-1");

  // Register two workers
  workers.recordHeartbeat({
    workerId: "worker-capable-1",
    status: "idle",
    capabilities: ["bash", "edit"],
    runningExecutionIds: [],
    maxConcurrency: 1,
    queueAffinity: "default",
    occurredAt: "2026-04-10T10:00:00.000Z",
  });

  workers.recordHeartbeat({
    workerId: "worker-capable-2",
    status: "idle",
    capabilities: ["bash"],
    runningExecutionIds: [],
    maxConcurrency: 1,
    queueAffinity: "default",
    occurredAt: "2026-04-10T10:00:00.000Z",
  });

  // Ticket requires edit capability
  dispatch.createTicket({
    executionId: "exec-multi-1",
    queueName: "default",
    requiredCapabilities: ["bash", "edit"],
    occurredAt: "2026-04-10T10:00:05.000Z",
  });

  const decision = dispatch.dispatchNext({
    queueName: "default",
    leaseTtlMs: 30_000,
    occurredAt: "2026-04-10T10:00:06.000Z",
  });

  t.after(() => cleanup());

  if (decision.outcome !== "dispatched") {
    throw new Error(`Expected dispatched, got ${decision.outcome}`);
  }
  if (decision.worker?.workerId !== "worker-capable-1") {
    throw new Error(`Expected worker-capable-1, got ${decision.worker?.workerId}`);
  }
  done();
});
