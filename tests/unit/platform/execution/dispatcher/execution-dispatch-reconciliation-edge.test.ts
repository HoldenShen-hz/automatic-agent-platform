import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionDispatchReconciliationService, type DispatchReconciliationIssue } from "../../../../../src/platform/execution/dispatcher/execution-dispatch-reconciliation-service.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";

// ---------------------------------------------------------------------------
// Helper types and builders
// ---------------------------------------------------------------------------

type TicketStatus = "pending" | "claimed" | "consumed" | "expired" | "cancelled" | "invalidated";

interface MockTicket {
  id: string;
  executionId: string;
  status: TicketStatus;
  leaseId: string | null;
  assignedWorkerId: string | null;
  priority?: string;
  queueName?: string | null;
  dispatchTarget?: string;
  requiredIsolationLevel?: string;
  requiredRepoVersion?: string | null;
  requiredCapabilitiesJson?: string;
  dispatchAfter?: string | null;
  taskId?: string;
}

interface MockExecution {
  id: string;
  taskId: string;
  status: string;
  traceId?: string;
  attempt?: number;
  agentId?: string;
  workflowId?: string | null;
  roleId?: string | null;
  runKind?: string;
  lastErrorCode?: string | null;
}

interface MockLease {
  id: string;
  executionId: string;
  workerId: string;
  expiresAt: string;
}

function createMockStore(
  tickets: MockTicket[] = [],
  executions: Map<string, MockExecution> = new Map(),
  leases: Map<string, MockLease> = new Map(),
): AuthoritativeTaskStore {
  const agentExecutions = new Map<string, unknown>();
  return {
    worker: {
      listExecutionTicketsByStatuses: (statuses: string[]) =>
        tickets.filter(t => statuses.includes(t.status)),
      listExecutionTicketsByStatusesPaginated: (statuses: string[], _limit: number, _offset: number) =>
        tickets.filter(t => statuses.includes(t.status)),
      getExecutionTicket: (id: string) => tickets.find(t => t.id === id) ?? null,
      getActiveExecutionTicket: (executionId: string) => tickets.find(t => t.executionId === executionId && t.status !== "expired" && t.status !== "cancelled") ?? null,
      getActiveExecutionLease: (executionId: string) => leases.get(executionId) ?? null,
      getWorkerSnapshot: (_workerId: string) => null,
      getAgentExecutionRecord: (executionId: string) => agentExecutions.get(executionId) ?? null,
      upsertAgentExecutionRecord: (record: { executionId: string }) => {
        agentExecutions.set(record.executionId, record);
      },
      insertExecutionTicket: (ticket: MockTicket) => {
        tickets.push(ticket);
      },
      invalidateExecutionTicket: (_params: { ticketId: string; status: string; invalidatedAt: string }) => { /* noop */ },
    },
    operations: {
      loadExecutionAuthoritativeView: (executionId: string) => {
        const execution = executions.get(executionId);
        if (!execution) {
          return null;
        }
        return {
          execution: {
            id: execution.id,
            taskId: execution.taskId,
            status: execution.status,
            traceId: execution.traceId ?? null,
            attempt: execution.attempt ?? 1,
            workflowId: execution.workflowId ?? null,
            roleId: execution.roleId ?? null,
            runKind: execution.runKind ?? "standard",
            agentId: execution.agentId ?? "agent-test",
            lastErrorCode: execution.lastErrorCode ?? null,
          },
          task: {
            id: execution.taskId,
            priority: "normal",
          },
        };
      },
    },
    dispatch: {
      getExecution: (id: string) => executions.get(id) ?? null,
    },
    event: {
      insertEvent: (_event: unknown) => { /* noop */ },
    },
  } as unknown as AuthoritativeTaskStore;
}

function createMockDb(): AuthoritativeSqlDatabase {
  return {
    transaction: <T>(fn: () => T) => fn(),
  } as unknown as AuthoritativeSqlDatabase;
}

// ---------------------------------------------------------------------------
// Edge cases for repair with requeue_ticket
// ---------------------------------------------------------------------------

test("ExecutionDispatchReconciliationService repair handles orphan_queue_claim with requeue", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "claimed", leaseId: "lease-1", assignedWorkerId: "worker-1" },
  ];
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "executing" }],
  ]);
  // Lease is expired
  const pastTime = new Date(Date.now() - 60000).toISOString();
  const leases = new Map([
    ["exec-1", { id: "lease-1", executionId: "exec-1", workerId: "worker-1", expiresAt: pastTime }],
  ]);
  const store = createMockStore(tickets, executions, leases);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const result = service.repair();

  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]!.issueType, "orphan_queue_claim");
  assert.equal(result.issues[0]!.resolutionAction, "requeue_ticket");
  assert.equal(result.applied[0]!.applied, true);
  assert.ok(result.applied[0]!.replacementTicketId != null);
});

test("ExecutionDispatchReconciliationService repair handles missing active lease with requeue", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "claimed", leaseId: "lease-1", assignedWorkerId: "worker-1" },
  ];
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "executing" }],
  ]);
  // No lease at all
  const store = createMockStore(tickets, executions, new Map());
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const result = service.repair();

  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]!.issueType, "orphan_queue_claim");
  assert.equal(result.issues[0]!.reasonCode, "missing_active_lease");
});

test("ExecutionDispatchReconciliationService repair handles lease_ticket_mismatch with requeue", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "claimed", leaseId: "different-lease", assignedWorkerId: "worker-1" },
  ];
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "executing" }],
  ]);
  const futureTime = new Date(Date.now() + 60000).toISOString();
  const leases = new Map([
    ["exec-1", { id: "lease-1", executionId: "exec-1", workerId: "worker-2", expiresAt: futureTime }],
  ]);
  const store = createMockStore(tickets, executions, leases);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const result = service.repair();

  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]!.reasonCode, "lease_ticket_mismatch");
  assert.equal(result.applied[0]!.resolutionAction, "requeue_ticket");
});

// ---------------------------------------------------------------------------
// repairTicket with orphan_queue_claim
// ---------------------------------------------------------------------------

test("ExecutionDispatchReconciliationService repairTicket applies requeue for orphan claim", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "claimed", leaseId: "lease-1", assignedWorkerId: "worker-1" },
  ];
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "executing" }],
  ]);
  const pastTime = new Date(Date.now() - 60000).toISOString();
  const leases = new Map([
    ["exec-1", { id: "lease-1", executionId: "exec-1", workerId: "worker-1", expiresAt: pastTime }],
  ]);
  const store = createMockStore(tickets, executions, leases);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const result = service.repairTicket("ticket-1");

  assert.ok(result != null);
  assert.equal(result.applied, true);
  assert.equal(result.resolutionAction, "requeue_ticket");
  assert.ok(result.replacementTicketId != null);
});

// ---------------------------------------------------------------------------
// Multiple tickets with different issues
// ---------------------------------------------------------------------------

test("ExecutionDispatchReconciliationService scan detects multiple issues across tickets", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-terminal", executionId: "exec-1", status: "pending", leaseId: null, assignedWorkerId: null },
    { id: "ticket-orphan", executionId: "exec-2", status: "claimed", leaseId: "lease-1", assignedWorkerId: "worker-1" },
  ];
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "succeeded" }],
    ["exec-2", { id: "exec-2", taskId: "task-2", status: "executing" }],
  ]);
  // ticket-orphan has no lease
  const store = createMockStore(tickets, executions, new Map());
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issues = service.scan();

  assert.equal(issues.length, 2);
  assert.ok(issues.some(i => i.issueType === "terminal_execution_ticket"));
  assert.ok(issues.some(i => i.issueType === "orphan_queue_claim"));
});

// ---------------------------------------------------------------------------
// repair with terminal_execution_ticket
// ---------------------------------------------------------------------------

test("ExecutionDispatchReconciliationService repair applies invalidate for terminal execution", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "pending", leaseId: null, assignedWorkerId: null },
  ];
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "failed" }],
  ]);
  const store = createMockStore(tickets, executions);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const result = service.repair();

  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]!.issueType, "terminal_execution_ticket");
  assert.equal(result.applied[0]!.resolutionAction, "invalidate_ticket");
  assert.equal(result.applied[0]!.applied, true);
  assert.equal(result.applied[0]!.replacementTicketId, null);
});

test("ExecutionDispatchReconciliationService repair applies invalidate for cancelled execution", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "pending", leaseId: null, assignedWorkerId: null },
  ];
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "cancelled" }],
  ]);
  const store = createMockStore(tickets, executions);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const result = service.repair();

  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]!.issueType, "terminal_execution_ticket");
  assert.equal(result.applied[0]!.resolutionAction, "invalidate_ticket");
});

test("ExecutionDispatchReconciliationService repair applies invalidate for superseded execution", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "pending", leaseId: null, assignedWorkerId: null },
  ];
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "superseded" }],
  ]);
  const store = createMockStore(tickets, executions);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const result = service.repair();

  assert.equal(result.issues.length, 1);
  assert.equal(result.issues[0]!.issueType, "terminal_execution_ticket");
  assert.equal(result.applied[0]!.resolutionAction, "invalidate_ticket");
});

// ---------------------------------------------------------------------------
// Issue details are correctly populated
// ---------------------------------------------------------------------------

test("ExecutionDispatchReconciliationService issue contains correct executionId and taskId", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-123", status: "pending", leaseId: null, assignedWorkerId: null, taskId: "task-456" },
  ];
  const executions = new Map([
    ["exec-123", { id: "exec-123", taskId: "task-456", status: "succeeded" }],
  ]);
  const store = createMockStore(tickets, executions);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issues = service.scan();

  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.executionId, "exec-123");
  assert.equal(issues[0]!.taskId, "task-456");
  assert.equal(issues[0]!.ticketId, "ticket-1");
  assert.equal(issues[0]!.executionStatus, "succeeded");
});

test("ExecutionDispatchReconciliationService repair result contains correct fields", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "pending", leaseId: null, assignedWorkerId: null },
  ];
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "succeeded" }],
  ]);
  const store = createMockStore(tickets, executions);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const result = service.repair();

  assert.equal(result.applied[0]!.issueType, "terminal_execution_ticket");
  assert.equal(result.applied[0]!.executionId, "exec-1");
  assert.equal(result.applied[0]!.taskId, "task-1");
  assert.equal(result.applied[0]!.ticketId, "ticket-1");
});

// ---------------------------------------------------------------------------
// Edge case: execution not found during repair
// ---------------------------------------------------------------------------

test("ExecutionDispatchReconciliationService repair handles execution not found", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "nonexistent", status: "pending", leaseId: null, assignedWorkerId: null },
  ];
  const executions = new Map();
  const store = createMockStore(tickets, executions);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const result = service.repair();

  // No issues found because execution doesn't exist
  assert.equal(result.issues.length, 0);
  assert.equal(result.applied.length, 0);
});

// ---------------------------------------------------------------------------
// Edge case: scan with expired and valid leases mixed
// ---------------------------------------------------------------------------

test("ExecutionDispatchReconciliationService scan distinguishes expired from valid leases", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-expired", executionId: "exec-1", status: "claimed", leaseId: "lease-1", assignedWorkerId: "worker-1" },
    { id: "ticket-valid", executionId: "exec-2", status: "claimed", leaseId: "lease-2", assignedWorkerId: "worker-2" },
  ];
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "executing" }],
    ["exec-2", { id: "exec-2", taskId: "task-2", status: "executing" }],
  ]);
  const pastTime = new Date(Date.now() - 60000).toISOString();
  const futureTime = new Date(Date.now() + 60000).toISOString();
  const leases = new Map([
    ["exec-1", { id: "lease-1", executionId: "exec-1", workerId: "worker-1", expiresAt: pastTime }],
    ["exec-2", { id: "lease-2", executionId: "exec-2", workerId: "worker-2", expiresAt: futureTime }],
  ]);
  const store = createMockStore(tickets, executions, leases);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issues = service.scan();

  // Only the expired lease ticket should have an issue
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.ticketId, "ticket-expired");
  assert.equal(issues[0]!.reasonCode, "lease_expired_unreclaimed");
});

// ---------------------------------------------------------------------------
// Edge case: scan only processes pending and claimed
// ---------------------------------------------------------------------------

test("ExecutionDispatchReconciliationService scan ignores expired tickets", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-pending", executionId: "exec-1", status: "pending", leaseId: null, assignedWorkerId: null },
    { id: "ticket-expired", executionId: "exec-2", status: "expired", leaseId: null, assignedWorkerId: null },
  ];
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "executing" }],
    ["exec-2", { id: "exec-2", taskId: "task-2", status: "executing" }],
  ]);
  const store = createMockStore(tickets, executions);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issues = service.scan();

  // Only pending should be scanned (pending tickets without issues are fine)
  assert.equal(issues.length, 0);
});

// ---------------------------------------------------------------------------
// Edge case: terminal execution with various statuses
// ---------------------------------------------------------------------------

test("ExecutionDispatchReconciliationService handles all terminal statuses", () => {
  const terminalStatuses = ["succeeded", "failed", "cancelled", "superseded"] as const;

  for (const status of terminalStatuses) {
    const tickets: MockTicket[] = [
      { id: `ticket-${status}`, executionId: `exec-${status}`, status: "pending", leaseId: null, assignedWorkerId: null },
    ];
    const executions = new Map([
      [`exec-${status}`, { id: `exec-${status}`, taskId: `task-${status}`, status }],
    ]);
    const store = createMockStore(tickets, executions);
    const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
    const issues = service.scan();

    assert.equal(issues.length, 1, `Expected issue for ${status}`);
    assert.equal(issues[0]!.issueType, "terminal_execution_ticket", `Expected terminal_execution_ticket for ${status}`);
    assert.equal(issues[0]!.executionStatus, status, `Expected executionStatus ${status}`);
  }
});

// ---------------------------------------------------------------------------
// Edge case: findIssueByTicketId returns null for expired ticket
// ---------------------------------------------------------------------------

test("ExecutionDispatchReconciliationService findIssueByTicketId returns null for expired status", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "expired", leaseId: null, assignedWorkerId: null },
  ];
  const store = createMockStore(tickets);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issue = service.findIssueByTicketId("ticket-1");

  // Expired tickets are not processed
  assert.equal(issue, null);
});

// ---------------------------------------------------------------------------
// Edge case: findIssueByTicketId returns null for invalidated ticket
// ---------------------------------------------------------------------------

test("ExecutionDispatchReconciliationService findIssueByTicketId returns null for invalidated status", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "invalidated", leaseId: null, assignedWorkerId: null },
  ];
  const store = createMockStore(tickets);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issue = service.findIssueByTicketId("ticket-1");

  assert.equal(issue, null);
});

// ---------------------------------------------------------------------------
// Edge case: repair with ticket that no longer exists
// ---------------------------------------------------------------------------

test("ExecutionDispatchReconciliationService repairTicket returns not applied when ticket gone", () => {
  const tickets: MockTicket[] = [];
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "succeeded" }],
  ]);
  const store = createMockStore(tickets, executions);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const result = service.repairTicket("nonexistent-ticket");

  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// Edge case: scan with no executions in map
// ---------------------------------------------------------------------------

test("ExecutionDispatchReconciliationService scan handles ticket with missing execution", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "pending", leaseId: null, assignedWorkerId: null },
  ];
  const executions = new Map(); // Empty
  const store = createMockStore(tickets, executions);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issues = service.scan();

  // No execution found means no issue detected
  assert.equal(issues.length, 0);
});

// ---------------------------------------------------------------------------
// Edge case: valid claimed ticket with valid lease
// ---------------------------------------------------------------------------

test("ExecutionDispatchReconciliationService scan returns no issue for valid claimed ticket", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "claimed", leaseId: "lease-1", assignedWorkerId: "worker-1" },
  ];
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "executing" }],
  ]);
  const futureTime = new Date(Date.now() + 60000).toISOString();
  const leases = new Map([
    ["exec-1", { id: "lease-1", executionId: "exec-1", workerId: "worker-1", expiresAt: futureTime }],
  ]);
  const store = createMockStore(tickets, executions, leases);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issues = service.scan();

  // No issue - everything is valid
  assert.equal(issues.length, 0);
});
