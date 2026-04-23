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
}

interface MockExecution {
  id: string;
  taskId: string;
  status: string;
  traceId?: string;
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
  return {
    worker: {
      listExecutionTicketsByStatuses: (statuses: string[]) =>
        tickets.filter(t => statuses.includes(t.status)),
      getExecutionTicket: (id: string) => tickets.find(t => t.id === id) ?? null,
      getActiveExecutionLease: (executionId: string) => leases.get(executionId) ?? null,
      invalidateExecutionTicket: (_params: { ticketId: string; status: string; invalidatedAt: string }) => { /* noop */ },
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
// isTerminalExecutionStatus (via scan)
// ---------------------------------------------------------------------------

test("ExecutionDispatchReconciliationService.scan returns empty when no tickets", () => {
  const store = createMockStore([]);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issues = service.scan();
  assert.equal(issues.length, 0);
});

test("ExecutionDispatchReconciliationService.scan returns empty when only consumed tickets", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "consumed", leaseId: null, assignedWorkerId: null },
  ];
  const store = createMockStore(tickets);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issues = service.scan();
  assert.equal(issues.length, 0);
});

test("ExecutionDispatchReconciliationService.scan detects terminal execution ticket", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "pending", leaseId: null, assignedWorkerId: null },
  ];
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "succeeded" }],
  ]);
  const store = createMockStore(tickets, executions);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issues = service.scan();
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.issueType, "terminal_execution_ticket");
  assert.equal(issues[0]!.reasonCode, "execution_terminal");
});

test("ExecutionDispatchReconciliationService.scan detects missing active lease", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "claimed", leaseId: "lease-1", assignedWorkerId: "worker-1" },
  ];
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "executing" }],
  ]);
  // No lease in leases map
  const store = createMockStore(tickets, executions, new Map());
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issues = service.scan();
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.issueType, "orphan_queue_claim");
  assert.equal(issues[0]!.reasonCode, "missing_active_lease");
});

test("ExecutionDispatchReconciliationService.scan detects expired lease", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "claimed", leaseId: "lease-1", assignedWorkerId: "worker-1" },
  ];
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "executing" }],
  ]);
  const pastTime = new Date(Date.now() - 60000).toISOString(); // 1 minute ago
  const leases = new Map([
    ["exec-1", { id: "lease-1", executionId: "exec-1", workerId: "worker-1", expiresAt: pastTime }],
  ]);
  const store = createMockStore(tickets, executions, leases);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issues = service.scan();
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.issueType, "orphan_queue_claim");
  assert.equal(issues[0]!.reasonCode, "lease_expired_unreclaimed");
});

test("ExecutionDispatchReconciliationService.scan detects lease/ticket mismatch", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "claimed", leaseId: "different-lease", assignedWorkerId: "worker-1" },
  ];
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "executing" }],
  ]);
  const futureTime = new Date(Date.now() + 60000).toISOString(); // 1 minute from now
  const leases = new Map([
    ["exec-1", { id: "lease-1", executionId: "exec-1", workerId: "worker-2", expiresAt: futureTime }],
  ]);
  const store = createMockStore(tickets, executions, leases);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issues = service.scan();
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.issueType, "orphan_queue_claim");
  assert.equal(issues[0]!.reasonCode, "lease_ticket_mismatch");
});

test("ExecutionDispatchReconciliationService.scan skips pending tickets with valid execution", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "pending", leaseId: null, assignedWorkerId: null },
  ];
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "executing" }],
  ]);
  const store = createMockStore(tickets, executions, new Map());
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issues = service.scan();
  assert.equal(issues.length, 0);
});

test("ExecutionDispatchReconciliationService.scan handles multiple tickets", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "pending", leaseId: null, assignedWorkerId: null },
    { id: "ticket-2", executionId: "exec-2", status: "pending", leaseId: null, assignedWorkerId: null }, // Changed to pending (claimed triggers lease check)
  ];
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "executing" }],
    ["exec-2", { id: "exec-2", taskId: "task-2", status: "executing" }],
  ]);
  const store = createMockStore(tickets, executions, new Map());
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issues = service.scan();
  assert.equal(issues.length, 0);
});

// ---------------------------------------------------------------------------
// findIssueByTicketId
// ---------------------------------------------------------------------------

test("ExecutionDispatchReconciliationService.findIssueByTicketId returns null for nonexistent ticket", () => {
  const store = createMockStore([]);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issue = service.findIssueByTicketId("nonexistent");
  assert.equal(issue, null);
});

test("ExecutionDispatchReconciliationService.findIssueByTicketId returns null for consumed ticket", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "consumed", leaseId: null, assignedWorkerId: null },
  ];
  const store = createMockStore(tickets);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issue = service.findIssueByTicketId("ticket-1");
  assert.equal(issue, null);
});

// ---------------------------------------------------------------------------
// repair
// ---------------------------------------------------------------------------

test("ExecutionDispatchReconciliationService.repair returns issues and applied repairs", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "pending", leaseId: null, assignedWorkerId: null },
  ];
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "succeeded" }],
  ]);
  const store = createMockStore(tickets, executions);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const result = service.repair();
  assert.equal(result.issues.length, 1);
  assert.equal(result.applied.length, 1);
  assert.equal(result.applied[0]!.applied, true);
  assert.equal(result.applied[0]!.resolutionAction, "invalidate_ticket");
});

test("ExecutionDispatchReconciliationService.repairTicket returns null for nonexistent ticket", () => {
  const store = createMockStore([]);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const result = service.repairTicket("nonexistent");
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// Helper function tests (via service behavior)
// ---------------------------------------------------------------------------

test("ExecutionDispatchReconciliationService handles failed terminal execution", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "pending", leaseId: null, assignedWorkerId: null },
  ];
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "failed" }],
  ]);
  const store = createMockStore(tickets, executions);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issues = service.scan();
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.executionStatus, "failed");
});

test("ExecutionDispatchReconciliationService handles cancelled terminal execution", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "pending", leaseId: null, assignedWorkerId: null },
  ];
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "cancelled" }],
  ]);
  const store = createMockStore(tickets, executions);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issues = service.scan();
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.issueType, "terminal_execution_ticket");
});

test("ExecutionDispatchReconciliationService handles superseded terminal execution", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "pending", leaseId: null, assignedWorkerId: null },
  ];
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "superseded" }],
  ]);
  const store = createMockStore(tickets, executions);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issues = service.scan();
  assert.equal(issues.length, 1);
  assert.equal(issues[0]!.issueType, "terminal_execution_ticket");
});