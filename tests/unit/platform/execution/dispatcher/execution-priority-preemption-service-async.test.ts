import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionPriorityPreemptionServiceAsync } from "../../../../../src/platform/execution/dispatcher/execution-priority-preemption-service-async.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";
import type { ExecutionTicketRecord, TaskPriority } from "../../../../../src/platform/contracts/types/domain.js";

// ---------------------------------------------------------------------------
// Helper types
// ---------------------------------------------------------------------------

function createMockStore(): AuthoritativeTaskStore {
  return {
    operations: {
      loadExecutionAuthoritativeView: () => null,
      listActiveExecutionActivity: () => [],
    },
    task: {
      countQueuedTasks: () => 0,
      getTask: () => null,
    },
    execution: {
      countActiveExecutions: () => 0,
      getExecution: () => null,
      updateExecutionStatus: () => {},
    },
    event: {
      countPendingTier1Acks: () => 0,
      insertEvent: () => {},
    },
    worker: {
      getActiveExecutionTicket: () => null,
      insertExecutionTicket: () => {},
      listDispatchableExecutionTickets: () => [],
      claimExecutionTicket: () => {},
      getExecutionTicket: () => null,
      getAgentExecutionRecord: () => null,
      upsertAgentExecutionRecord: () => {},
      getActiveExecutionLease: () => null,
      listExecutionTicketsByStatuses: () => [],
      listWorkers: () => [],
      getWorker: () => null,
      listExecutionTicketsByExecution: () => [],
      listWorkerSnapshots: () => [], // Required by WorkerRegistryService
    },
    dispatch: {
      getExecution: () => null,
    },
    workflow: {
      getWorkflowState: () => null,
      updateWorkflowRecoveryState: () => {},
    },
  } as unknown as AuthoritativeTaskStore;
}

function createMockDb(): AuthoritativeSqlDatabase {
  return {
    transaction: <T>(fn: () => T) => fn(),
  } as unknown as AuthoritativeSqlDatabase;
}

function createMockTicket(priority: TaskPriority = "normal"): ExecutionTicketRecord {
  return {
    id: "ticket-1",
    executionId: "exec-1",
    taskId: "task-1",
    priority,
    queueName: null,
    dispatchTarget: "any",
    requiredIsolationLevel: "standard",
    requiredRepoVersion: null,
    requiredCapabilitiesJson: "[]",
    dispatchAfter: null,
    attempt: 1,
    status: "pending",
    assignedWorkerId: null,
    leaseId: null,
    claimedAt: null,
    consumedAt: null,
    invalidatedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// ExecutionPriorityPreemptionServiceAsync construction
// ---------------------------------------------------------------------------

test("ExecutionPriorityPreemptionServiceAsync can be instantiated", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionPriorityPreemptionServiceAsync(db, store);
  assert.ok(service instanceof ExecutionPriorityPreemptionServiceAsync);
});

// ---------------------------------------------------------------------------
// ExecutionPriorityPreemptionServiceAsync.preemptForUrgentTicket returns Promise
// ---------------------------------------------------------------------------

test("ExecutionPriorityPreemptionServiceAsync.preemptForUrgentTicket returns a Promise", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionPriorityPreemptionServiceAsync(db, store);

  const ticket = createMockTicket("urgent");
  const result = service.preemptForUrgentTicket({
    ticket,
    dispatchTarget: "any",
    requiredIsolationLevel: "standard",
    requiredRepoVersion: null,
    requiredCapabilities: [],
    preferredWorkerId: null,
    includeDegraded: false,
    occurredAt: new Date().toISOString(),
  });

  assert.ok(result instanceof Promise);
});

test("ExecutionPriorityPreemptionServiceAsync.preemptForUrgentTicket resolves with not_preempted for non-urgent", async () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionPriorityPreemptionServiceAsync(db, store);

  const ticket = createMockTicket("normal"); // Not urgent
  const decision = await service.preemptForUrgentTicket({
    ticket,
    dispatchTarget: "any",
    requiredIsolationLevel: "standard",
    requiredRepoVersion: null,
    requiredCapabilities: [],
    preferredWorkerId: null,
    includeDegraded: false,
    occurredAt: new Date().toISOString(),
  });

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "ticket_not_urgent");
});

test("ExecutionPriorityPreemptionServiceAsync.preemptForUrgentTicket resolves with not_preempted when no candidate", async () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionPriorityPreemptionServiceAsync(db, store);

  const ticket = createMockTicket("urgent");
  const decision = await service.preemptForUrgentTicket({
    ticket,
    dispatchTarget: "any",
    requiredIsolationLevel: "standard",
    requiredRepoVersion: null,
    requiredCapabilities: [],
    preferredWorkerId: null,
    includeDegraded: false,
    occurredAt: new Date().toISOString(),
  });

  // No workers available, so no preemption
  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

test("ExecutionPriorityPreemptionServiceAsync.preemptForUrgentTicket preserves trace properties", async () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionPriorityPreemptionServiceAsync(db, store);

  const ticket = createMockTicket("urgent");
  const decision = await service.preemptForUrgentTicket({
    ticket,
    dispatchTarget: "any",
    requiredIsolationLevel: "standard",
    requiredRepoVersion: null,
    requiredCapabilities: [],
    preferredWorkerId: null,
    includeDegraded: false,
    occurredAt: new Date().toISOString(),
  });

  assert.equal(decision.trace.triggerPriority, "urgent");
  assert.equal(decision.trace.applied, false);
  assert.equal(decision.trace.preemptedExecutionId, null);
  assert.equal(decision.trace.preemptedTaskId, null);
  assert.equal(decision.trace.preemptedWorkerId, null);
  assert.equal(decision.trace.previousTicketId, null);
  assert.equal(decision.trace.replacementTicketId, null);
  assert.equal(decision.trace.recoveryStepId, null);
});

test("ExecutionPriorityPreemptionServiceAsync preemptForUrgentTicket with high priority ticket", async () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionPriorityPreemptionServiceAsync(db, store);

  const ticket = createMockTicket("high");
  const decision = await service.preemptForUrgentTicket({
    ticket,
    dispatchTarget: "any",
    requiredIsolationLevel: "standard",
    requiredRepoVersion: null,
    requiredCapabilities: [],
    preferredWorkerId: null,
    includeDegraded: false,
    occurredAt: new Date().toISOString(),
  });

  // Only "urgent" triggers preemption attempt
  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "ticket_not_urgent");
});

// ---------------------------------------------------------------------------
// Verify Promise resolution order is preserved
// ---------------------------------------------------------------------------

test("ExecutionPriorityPreemptionServiceAsync returns Promise that resolves in correct order", async () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionPriorityPreemptionServiceAsync(db, store);

  let resolved = false;
  const ticket = createMockTicket("urgent");
  const promise = service.preemptForUrgentTicket({
    ticket,
    dispatchTarget: "any",
    requiredIsolationLevel: "standard",
    requiredRepoVersion: null,
    requiredCapabilities: [],
    preferredWorkerId: null,
    includeDegraded: false,
    occurredAt: new Date().toISOString(),
  }).then(() => {
    resolved = true;
    return true;
  });

  assert.equal(resolved, false);
  await promise;
  assert.equal(resolved, true);
});