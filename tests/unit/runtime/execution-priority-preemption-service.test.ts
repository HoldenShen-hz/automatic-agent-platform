import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ExecutionDispatchService } from "../../../src/platform/five-plane-execution/dispatcher/execution-dispatch-service.js";
import { ExecutionLeaseService } from "../../../src/platform/five-plane-execution/lease/execution-lease-service.js";
import { ExecutionPriorityPreemptionService } from "../../../src/platform/five-plane-execution/dispatcher/execution-priority-preemption-service.js";
import { WorkerRegistryService } from "../../../src/platform/five-plane-execution/worker-pool/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";
import { seedTaskAndExecution } from "../../helpers/seed.js";

function seedWorkflowState(
  store: AuthoritativeTaskStore,
  input: {
    taskId: string;
    currentStepIndex: number;
    resumableFromStep: string | null;
    status?: "running" | "paused";
    occurredAt: string;
  },
): void {
  store.insertWorkflowState({
    taskId: input.taskId,
    divisionId: "general_ops",
    workflowId: "single_division_multi_step_orchestration",
    currentStepIndex: input.currentStepIndex,
    status: input.status ?? "running",
    outputsJson: JSON.stringify({}),
    lastErrorCode: null,
    retryCount: 0,
    resumableFromStep: input.resumableFromStep,
    startedAt: input.occurredAt,
    updatedAt: input.occurredAt,
  });
}

function seedPreemptionFixture(
  db: SqliteDatabase,
  store: AuthoritativeTaskStore,
  input: {
    lowExecutionId: string;
    lowTaskId: string;
    urgentExecutionId: string;
    urgentTaskId: string;
    workerCurrentStepId: string | null;
    resumableFromStep: string | null;
  },
): {
  urgentTicketId: string;
} {
  const workers = new WorkerRegistryService(store);
  const dispatch = new ExecutionDispatchService(db, store);
  const leases = new ExecutionLeaseService(db, store);

  seedTaskAndExecution(db, store, {
    taskId: input.lowTaskId,
    executionId: input.lowExecutionId,
    traceId: `trace-${input.lowExecutionId}`,
  });
  seedTaskAndExecution(db, store, {
    taskId: input.urgentTaskId,
    executionId: input.urgentExecutionId,
    traceId: `trace-${input.urgentExecutionId}`,
  });

  db.connection.prepare(`UPDATE tasks SET priority = ? WHERE id = ?`).run("low", input.lowTaskId);
  db.connection.prepare(`UPDATE tasks SET priority = ? WHERE id = ?`).run("urgent", input.urgentTaskId);
  db.connection.prepare(`UPDATE executions SET status = ? WHERE id = ?`).run("created", input.urgentExecutionId);

  seedWorkflowState(store, {
    taskId: input.lowTaskId,
    currentStepIndex: 1,
    resumableFromStep: input.resumableFromStep,
    occurredAt: "2026-04-07T09:00:00.000Z",
  });

  const lowTicket = dispatch.createTicket({
    executionId: input.lowExecutionId,
    priority: "low",
    queueName: "default",
    requiredCapabilities: ["bash"],
    occurredAt: "2026-04-07T09:00:05.000Z",
  }).ticket;
  store.consumeExecutionTicket(lowTicket.id, "2026-04-07T09:00:06.000Z");
  const lease = leases.acquireLease({
    executionId: input.lowExecutionId,
    workerId: "worker-preemption",
    ttlMs: 30_000,
    queueName: "default",
    occurredAt: "2026-04-07T09:00:07.000Z",
  });
  assert.equal(lease.outcome, "granted");

  workers.recordHeartbeat({
    workerId: "worker-preemption",
    status: "busy",
    capabilities: ["bash"],
    runningExecutionIds: [input.lowExecutionId],
    maxConcurrency: 1,
    queueAffinity: "default",
    currentStepId: input.workerCurrentStepId,
    lastProgressAt: "2026-04-07T09:00:08.000Z",
    occurredAt: "2026-04-07T09:00:08.000Z",
  });

  const lowExecution = store.getExecution(input.lowExecutionId);
  assert.ok(lowExecution);
  store.upsertAgentExecutionRecord({
    executionId: input.lowExecutionId,
    taskId: input.lowTaskId,
    agentId: lowExecution.agentId,
    workflowId: lowExecution.workflowId,
    roleId: lowExecution.roleId,
    runKind: lowExecution.runKind,
    runtimeInstanceId: "runtime-preemption",
    restartedFromRuntimeInstanceId: null,
    restartGeneration: 0,
    status: "executing",
    planJson: JSON.stringify({ workflowId: lowExecution.workflowId }),
    currentStepId: input.workerCurrentStepId,
    lastToolName: "bash",
    toolCallCount: 1,
    lastDecisionJson: null,
    lastErrorCode: null,
    retryCount: 0,
    progressMessage: "working",
    startedAt: "2026-04-07T09:00:00.000Z",
    createdAt: "2026-04-07T09:00:00.000Z",
    updatedAt: "2026-04-07T09:00:08.000Z",
    completedAt: null,
  });

  const urgentTicket = dispatch.createTicket({
    executionId: input.urgentExecutionId,
    priority: "urgent",
    queueName: "default",
    requiredCapabilities: ["bash"],
    occurredAt: "2026-04-07T09:00:09.000Z",
  }).ticket;

  return {
    urgentTicketId: urgentTicket.id,
  };
}

test("execution priority preemption service requeues a safe low-priority execution for an urgent ticket", () => {
  const workspace = createTempWorkspace("aa-preemption-unit-");
  const dbPath = join(workspace, "execution-priority-preemption.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const preemption = new ExecutionPriorityPreemptionService(db, store);
    const fixture = seedPreemptionFixture(db, store, {
      lowExecutionId: "exec-low-preempt",
      lowTaskId: "task-low-preempt",
      urgentExecutionId: "exec-urgent-preempt",
      urgentTaskId: "task-urgent-preempt",
      workerCurrentStepId: "draft_solution",
      resumableFromStep: "draft_solution",
    });

    const urgentTicket = store.getExecutionTicket(fixture.urgentTicketId);
    assert.ok(urgentTicket);
    const decision = preemption.preemptForUrgentTicket({
      ticket: urgentTicket,
      dispatchTarget: "any",
      requiredIsolationLevel: "standard",
      requiredRepoVersion: null,
      requiredCapabilities: ["bash"],
      preferredWorkerId: null,
      includeDegraded: false,
      occurredAt: "2026-04-07T09:00:10.000Z",
    });
    const lowExecution = store.getExecution("exec-low-preempt");
    const workflow = store.getWorkflowState("task-low-preempt");
    const worker = new WorkerRegistryService(store).getWorker("worker-preemption");
    const leases = store.listExecutionLeases("exec-low-preempt");
    const replacementTickets = store.listExecutionTicketsByExecution("exec-low-preempt");
    const events = store.listEventsForTask("task-low-preempt");
    const agentExecution = store.getAgentExecutionRecord("exec-low-preempt");
    db.close();

    assert.equal(decision.outcome, "preempted");
    assert.equal(decision.trace.applied, true);
    assert.equal(decision.trace.preemptedExecutionId, "exec-low-preempt");
    assert.equal(decision.trace.preemptedWorkerId, "worker-preemption");
    assert.equal(decision.trace.recoveryStepId, "draft_solution");
    assert.equal(lowExecution?.status, "blocked");
    assert.equal(workflow?.status, "paused");
    assert.equal(workflow?.resumableFromStep, "draft_solution");
    assert.equal(worker?.availableSlots, 1);
    assert.deepEqual(worker?.runningExecutionIds, []);
    assert.equal(leases.at(-1)?.status, "reclaimed");
    assert.equal(leases.at(-1)?.reasonCode, "priority_preempted");
    assert.equal(replacementTickets.length, 2);
    assert.equal(replacementTickets.at(-1)?.status, "pending");
    assert.equal(agentExecution?.status, "priority_preempted");
    assert.equal(agentExecution?.currentStepId, "draft_solution");
    assert.ok(events.some((event) => event.eventType === "dispatch:execution_preempted"));
    assert.ok(events.some((event) => event.eventType === "dispatch:ticket_requeued"));
  } finally {
    cleanupPath(workspace);
  }
});

test("execution priority preemption service refuses to preempt when the worker is not at a resumable step boundary", () => {
  const workspace = createTempWorkspace("aa-preemption-unit-");
  const dbPath = join(workspace, "execution-priority-preemption-boundary.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const preemption = new ExecutionPriorityPreemptionService(db, store);
    const fixture = seedPreemptionFixture(db, store, {
      lowExecutionId: "exec-low-no-boundary",
      lowTaskId: "task-low-no-boundary",
      urgentExecutionId: "exec-urgent-no-boundary",
      urgentTaskId: "task-urgent-no-boundary",
      workerCurrentStepId: "implement_change",
      resumableFromStep: "draft_solution",
    });

    const urgentTicket = store.getExecutionTicket(fixture.urgentTicketId);
    assert.ok(urgentTicket);
    const decision = preemption.preemptForUrgentTicket({
      ticket: urgentTicket,
      dispatchTarget: "any",
      requiredIsolationLevel: "standard",
      requiredRepoVersion: null,
      requiredCapabilities: ["bash"],
      preferredWorkerId: null,
      includeDegraded: false,
      occurredAt: "2026-04-07T09:10:10.000Z",
    });
    const lowExecution = store.getExecution("exec-low-no-boundary");
    const workflow = store.getWorkflowState("task-low-no-boundary");
    const worker = new WorkerRegistryService(store).getWorker("worker-preemption");
    const tickets = store.listExecutionTicketsByExecution("exec-low-no-boundary");
    db.close();

    assert.equal(decision.outcome, "not_preempted");
    assert.equal(decision.trace.applied, false);
    assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
    assert.equal(lowExecution?.status, "executing");
    assert.equal(workflow?.status, "running");
    assert.deepEqual(worker?.runningExecutionIds, ["exec-low-no-boundary"]);
    assert.equal(tickets.length, 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("execution priority preemption service ignores non-urgent source tickets", () => {
  const workspace = createTempWorkspace("aa-preemption-unit-");
  const dbPath = join(workspace, "execution-priority-preemption-non-urgent.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const preemption = new ExecutionPriorityPreemptionService(db, store);
    const fixture = seedPreemptionFixture(db, store, {
      lowExecutionId: "exec-low-non-urgent",
      lowTaskId: "task-low-non-urgent",
      urgentExecutionId: "exec-high-source",
      urgentTaskId: "task-high-source",
      workerCurrentStepId: "draft_solution",
      resumableFromStep: "draft_solution",
    });
    const highTicket = store.getExecutionTicket(fixture.urgentTicketId);
    assert.ok(highTicket);

    const decision = preemption.preemptForUrgentTicket({
      ticket: {
        ...highTicket,
        priority: "high",
      },
      dispatchTarget: "any",
      requiredIsolationLevel: "standard",
      requiredRepoVersion: null,
      requiredCapabilities: ["bash"],
      preferredWorkerId: null,
      includeDegraded: false,
      occurredAt: "2026-04-07T09:20:10.000Z",
    });
    db.close();

    assert.equal(decision.outcome, "not_preempted");
    assert.equal(decision.trace.reasonCode, "ticket_not_urgent");
  } finally {
    cleanupPath(workspace);
  }
});
