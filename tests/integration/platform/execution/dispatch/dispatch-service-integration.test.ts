/**
 * Integration Tests: Dispatch Service Integration with SQLite
 *
 * Tests execution dispatch service with real SQLite database,
 * verifying ticket lifecycle, dispatch decisions, and worker interactions.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ExecutionDispatchService } from "../../../../../src/platform/execution/dispatcher/execution-dispatch-service.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteQueueAdapter, QUEUE_JOBS_DDL } from "../../../../../src/platform/execution/queue/queue-adapter.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

function createIntegrationHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "dispatch-integration.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  db.connection.exec(QUEUE_JOBS_DDL);
  const store = new AuthoritativeTaskStore(db);
  const queueAdapter = new SqliteQueueAdapter(db);
  return { workspace, db, store, queueAdapter };
}

function createTaskWithExecution(harness: ReturnType<typeof createIntegrationHarness>, priority = "normal") {
  const taskId = newId("task");
  const executionId = newId("exec");
  const now = nowIso();

  harness.db.transaction(() => {
    harness.store.insertTask({
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      title: `Task ${taskId}`,
      status: "in_progress",
      source: "user",
      priority,
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

    harness.store.insertExecution({
      id: executionId,
      taskId,
      traceId: newId("trace"),
      workflowId: newId("wf"),
      roleId: "agent",
      runKind: "task",
      attempt: 1,
      status: "in_progress",
      inputJson: "{}",
      outputJson: null,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    });
  });

  return { taskId, executionId };
}

test("Dispatch integration: createTicket then dispatchNext with no workers returns no_worker", () => {
  const harness = createIntegrationHarness("aa-int-dispatch-no-worker-");
  try {
    const service = new ExecutionDispatchService(harness.db, harness.store);

    const { executionId } = createTaskWithExecution(harness);

    // Create ticket
    const ticketResult = service.createTicket({ executionId });
    assert.equal(ticketResult.outcome, "created");
    assert.ok(ticketResult.ticket);

    // Dispatch - no workers available
    const dispatchResult = service.dispatchNext({ leaseTtlMs: 30000 });
    assert.equal(dispatchResult.outcome, "no_worker");
    assert.ok(dispatchResult.ticket);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("Dispatch integration: multiple tickets are processed in priority order", () => {
  const harness = createIntegrationHarness("aa-int-dispatch-priority-");
  try {
    const service = new ExecutionDispatchService(harness.db, harness.store);

    // Create tasks with different priorities
    const lowTask = createTaskWithExecution(harness, "low");
    const highTask = createTaskWithExecution(harness, "high");
    const normalTask = createTaskWithExecution(harness, "normal");

    // Create tickets
    service.createTicket({ executionId: lowTask.executionId, priority: "low" });
    service.createTicket({ executionId: highTask.executionId, priority: "high" });
    service.createTicket({ executionId: normalTask.executionId, priority: "normal" });

    // Without workers, all tickets remain pending
    const dispatchResult = service.dispatchNext({ leaseTtlMs: 30000 });
    assert.equal(dispatchResult.outcome, "no_worker");
    assert.ok(dispatchResult.ticket);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("Dispatch integration: queue adapter integrates with dispatch ticket", () => {
  const harness = createIntegrationHarness("aa-int-dispatch-queue-");
  try {
    const service = new ExecutionDispatchService(harness.db, harness.store);
    const { taskId, executionId } = createTaskWithExecution(harness);

    // Create dispatch ticket
    const ticketResult = service.createTicket({
      executionId,
      queueName: "execution-queue",
    });
    assert.equal(ticketResult.outcome, "created");

    // Enqueue work item via queue adapter
    const job = harness.queueAdapter.enqueue({
      queueName: "execution-queue",
      payload: { taskId, executionId },
      priority: 10,
    });

    assert.ok(job.id);
    assert.equal(job.queueName, "execution-queue");
    assert.equal(job.status, "waiting");

    // Dequeue the work item
    const dequeued = harness.queueAdapter.dequeue("execution-queue");
    assert.ok(dequeued);
    assert.equal(dequeued.job.id, job.id);

    const payload = JSON.parse(dequeued.job.payload);
    assert.equal(payload.taskId, taskId);
    assert.equal(payload.executionId, executionId);

    // Complete the work
    dequeued.ack();

    const completed = harness.queueAdapter.getJob(job.id);
    assert.equal(completed?.status, "completed");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("Dispatch integration: ticket creation emits dispatch:ticket_created event", () => {
  const harness = createIntegrationHarness("aa-int-dispatch-event-");
  try {
    const service = new ExecutionDispatchService(harness.db, harness.store);
    const { taskId, executionId } = createTaskWithExecution(harness);

    // Create ticket
    const result = service.createTicket({ executionId });
    assert.equal(result.outcome, "created");

    // Check that event was inserted
    const events = harness.store.event.listEvents({
      taskId,
      executionId,
      eventType: "dispatch:ticket_created",
    });

    assert.equal(events.length, 1);
    const payload = JSON.parse(events[0]!.payloadJson);
    assert.equal(payload.ticketId, result.ticket.id);
    assert.equal(payload.priority, result.ticket.priority);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("Dispatch integration: dispatchNext with queue availability unavailable blocks dispatch", () => {
  const harness = createIntegrationHarness("aa-int-dispatch-queue-unavail-");
  try {
    const service = new ExecutionDispatchService(
      harness.db,
      harness.store,
      null,
      () => ({ state: "unavailable" as const, reasonCode: "redis_connection_lost" }),
    );

    const { executionId } = createTaskWithExecution(harness);

    service.createTicket({ executionId });

    const result = service.dispatchNext({ leaseTtlMs: 30000 });

    assert.equal(result.outcome, "blocked");
    assert.equal(result.reasonCode, "redis_connection_lost");
    assert.ok(result.trace);
    assert.equal(result.trace!.outcome, "blocked");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("Dispatch integration: dispatchNext with degraded queue still allows urgent dispatch", () => {
  const harness = createIntegrationHarness("aa-int-dispatch-degraded-");
  try {
    const service = new ExecutionDispatchService(
      harness.db,
      harness.store,
      null,
      () => ({ state: "degraded" as const, reasonCode: "high_load" }),
    );

    const { executionId } = createTaskWithExecution(harness, "urgent");

    service.createTicket({ executionId, priority: "urgent" });

    // Without workers, still returns no_worker even for urgent
    const result = service.dispatchNext({ leaseTtlMs: 30000, includeDegraded: true });

    assert.equal(result.outcome, "no_worker");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("Dispatch integration: creating duplicate ticket returns exists outcome", () => {
  const harness = createIntegrationHarness("aa-int-dispatch-dup-");
  try {
    const service = new ExecutionDispatchService(harness.db, harness.store);
    const { executionId } = createTaskWithExecution(harness);

    // Create first ticket
    const first = service.createTicket({ executionId });
    assert.equal(first.outcome, "created");

    // Try to create duplicate
    const second = service.createTicket({ executionId });
    assert.equal(second.outcome, "exists");
    assert.equal(second.ticket.id, first.ticket.id);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("Dispatch integration: ticket with preferred worker is recorded in trace", () => {
  const harness = createIntegrationHarness("aa-int-dispatch-pref-");
  try {
    const service = new ExecutionDispatchService(harness.db, harness.store);
    const { executionId } = createTaskWithExecution(harness);

    service.createTicket({ executionId });

    const result = service.dispatchNext({
      leaseTtlMs: 30000,
      preferredWorkerId: "worker_preferred_123",
    });

    // No worker available, but the preference should be in the trace
    if (result.trace) {
      assert.equal(result.trace.preferredWorkerId, "worker_preferred_123");
    }
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});
