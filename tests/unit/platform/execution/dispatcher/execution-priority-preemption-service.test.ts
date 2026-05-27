import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionPriorityPreemptionService, type PriorityPreemptionRequest } from "../../../../../src/platform/five-plane-execution/dispatcher/execution-priority-preemption-service.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
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
      listWorkerSnapshots: () => [],
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

function createPreemptionRequest(ticket: ExecutionTicketRecord): PriorityPreemptionRequest {
  return {
    ticket,
    dispatchTarget: "any",
    requiredIsolationLevel: "standard",
    requiredRepoVersion: null,
    requiredCapabilities: [],
    preferredWorkerId: null,
    includeDegraded: false,
    occurredAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// ExecutionPriorityPreemptionService construction
// ---------------------------------------------------------------------------

test("ExecutionPriorityPreemptionService can be instantiated [execution-priority-preemption-service]", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionPriorityPreemptionService(db, store);
  assert.ok(service instanceof ExecutionPriorityPreemptionService);
});

// ---------------------------------------------------------------------------
// preemptForUrgentTicket returns not_preempted for non-urgent ticket
// ---------------------------------------------------------------------------

test("preemptForUrgentTicket returns not_preempted for normal priority ticket [execution-priority-preemption-service]", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionPriorityPreemptionService(db, store);

  const ticket = createMockTicket("normal");
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "ticket_not_urgent");
});

test("preemptForUrgentTicket returns not_preempted for high priority ticket [execution-priority-preemption-service]", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionPriorityPreemptionService(db, store);

  const ticket = createMockTicket("high");
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "ticket_not_urgent");
});

test("preemptForUrgentTicket returns not_preempted for low priority ticket [execution-priority-preemption-service]", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionPriorityPreemptionService(db, store);

  const ticket = createMockTicket("low");
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "ticket_not_urgent");
});

// ---------------------------------------------------------------------------
// preemptForUrgentTicket returns not_preempted when no safe candidate
// ---------------------------------------------------------------------------

test("preemptForUrgentTicket returns not_preempted with no_safe_preemption_candidate for urgent ticket [execution-priority-preemption-service]", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionPriorityPreemptionService(db, store);

  const ticket = createMockTicket("urgent");
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.reasonCode, "no_safe_preemption_candidate");
});

// ---------------------------------------------------------------------------
// preemptForUrgentTicket trace properties
// ---------------------------------------------------------------------------

test("preemptForUrgentTicket trace has correct triggerPriority for urgent ticket [execution-priority-preemption-service]", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionPriorityPreemptionService(db, store);

  const ticket = createMockTicket("urgent");
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.trace.triggerPriority, "urgent");
});

test("preemptForUrgentTicket trace has null preempted fields when not preempted [execution-priority-preemption-service]", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionPriorityPreemptionService(db, store);

  const ticket = createMockTicket("urgent");
  const request = createPreemptionRequest(ticket);
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.trace.applied, false);
  assert.equal(decision.trace.preemptedExecutionId, null);
  assert.equal(decision.trace.preemptedTaskId, null);
  assert.equal(decision.trace.preemptedWorkerId, null);
  assert.equal(decision.trace.previousTicketId, null);
  assert.equal(decision.trace.replacementTicketId, null);
  assert.equal(decision.trace.recoveryStepId, null);
});

// ---------------------------------------------------------------------------
// preemptForUrgentTicket with different dispatch targets
// ---------------------------------------------------------------------------

test("preemptForUrgentTicket handles local_only dispatch target [execution-priority-preemption-service]", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionPriorityPreemptionService(db, store);

  const ticket = createMockTicket("urgent");
  const request: PriorityPreemptionRequest = {
    ...createPreemptionRequest(ticket),
    dispatchTarget: "local_only",
  };
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
});

test("preemptForUrgentTicket handles require_remote dispatch target [execution-priority-preemption-service]", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionPriorityPreemptionService(db, store);

  const ticket = createMockTicket("urgent");
  const request: PriorityPreemptionRequest = {
    ...createPreemptionRequest(ticket),
    dispatchTarget: "require_remote",
  };
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
});

test("preemptForUrgentTicket handles prefer_remote dispatch target [execution-priority-preemption-service]", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionPriorityPreemptionService(db, store);

  const ticket = createMockTicket("urgent");
  const request: PriorityPreemptionRequest = {
    ...createPreemptionRequest(ticket),
    dispatchTarget: "prefer_remote",
  };
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
});

// ---------------------------------------------------------------------------
// preemptForUrgentTicket with different isolation levels
// ---------------------------------------------------------------------------

test("preemptForUrgentTicket handles hardened isolation requirement [execution-priority-preemption-service]", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionPriorityPreemptionService(db, store);

  const ticket = createMockTicket("urgent");
  const request: PriorityPreemptionRequest = {
    ...createPreemptionRequest(ticket),
    requiredIsolationLevel: "hardened",
  };
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
});

test("preemptForUrgentTicket handles strict isolation requirement [execution-priority-preemption-service]", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionPriorityPreemptionService(db, store);

  const ticket = createMockTicket("urgent");
  const request: PriorityPreemptionRequest = {
    ...createPreemptionRequest(ticket),
    requiredIsolationLevel: "strict",
  };
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
});

// ---------------------------------------------------------------------------
// preemptForUrgentTicket with required capabilities
// ---------------------------------------------------------------------------

test("preemptForUrgentTicket handles empty required capabilities [execution-priority-preemption-service]", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionPriorityPreemptionService(db, store);

  const ticket = createMockTicket("urgent");
  const request = createPreemptionRequest(ticket);
  request.requiredCapabilities = [];
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
});

test("preemptForUrgentTicket handles non-empty required capabilities [execution-priority-preemption-service]", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionPriorityPreemptionService(db, store);

  const ticket = createMockTicket("urgent");
  const request: PriorityPreemptionRequest = {
    ...createPreemptionRequest(ticket),
    requiredCapabilities: ["gpu", "large_memory"],
  };
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
});

// ---------------------------------------------------------------------------
// preemptForUrgentTicket with includeDegraded option
// ---------------------------------------------------------------------------

test("preemptForUrgentTicket handles includeDegraded true [execution-priority-preemption-service]", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionPriorityPreemptionService(db, store);

  const ticket = createMockTicket("urgent");
  const request: PriorityPreemptionRequest = {
    ...createPreemptionRequest(ticket),
    includeDegraded: true,
  };
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
});

test("preemptForUrgentTicket handles preferredWorkerId [execution-priority-preemption-service]", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionPriorityPreemptionService(db, store);

  const ticket = createMockTicket("urgent");
  const request: PriorityPreemptionRequest = {
    ...createPreemptionRequest(ticket),
    preferredWorkerId: "worker-42",
  };
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
  assert.equal(decision.trace.preemptedExecutionId, null);
});

// ---------------------------------------------------------------------------
// preemptForUrgentTicket with requiredRepoVersion
// ---------------------------------------------------------------------------

test("preemptForUrgentTicket handles null requiredRepoVersion [execution-priority-preemption-service]", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionPriorityPreemptionService(db, store);

  const ticket = createMockTicket("urgent");
  const request: PriorityPreemptionRequest = {
    ...createPreemptionRequest(ticket),
    requiredRepoVersion: null,
  };
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
});

test("preemptForUrgentTicket handles non-null requiredRepoVersion [execution-priority-preemption-service]", () => {
  const db = createMockDb();
  const store = createMockStore();
  const service = new ExecutionPriorityPreemptionService(db, store);

  const ticket = createMockTicket("urgent");
  const request: PriorityPreemptionRequest = {
    ...createPreemptionRequest(ticket),
    requiredRepoVersion: "v1.2.3",
  };
  const decision = service.preemptForUrgentTicket(request);

  assert.equal(decision.outcome, "not_preempted");
});