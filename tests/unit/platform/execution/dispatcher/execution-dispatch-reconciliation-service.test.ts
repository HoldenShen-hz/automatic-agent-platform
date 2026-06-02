import assert from "node:assert/strict";
import test from "node:test";

import { ExecutionDispatchReconciliationService, type DispatchReconciliationIssue } from "../../../../../src/platform/five-plane-execution/dispatcher/execution-dispatch-reconciliation-service.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";

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
      listExecutionTicketsByStatusesPaginated: (statuses: string[], _pageSize: number, offset: number) =>
        tickets.filter(t => statuses.includes(t.status)).slice(offset, offset + (_pageSize ?? 100)),
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

test("ExecutionDispatchReconciliationService.scan returns empty when no tickets [execution-dispatch-reconciliation-service]", () => {
  const store = createMockStore([]);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issues = service.scan();
  assert.equal(issues.length, 0);
});

test("ExecutionDispatchReconciliationService.scan returns empty when only consumed tickets [execution-dispatch-reconciliation-service]", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "consumed", leaseId: null, assignedWorkerId: null },
  ];
  const store = createMockStore(tickets);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issues = service.scan();
  assert.equal(issues.length, 0);
});

test("ExecutionDispatchReconciliationService.scan detects terminal execution ticket [execution-dispatch-reconciliation-service]", () => {
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

test("ExecutionDispatchReconciliationService.scan detects missing active lease [execution-dispatch-reconciliation-service]", () => {
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

test("ExecutionDispatchReconciliationService.scan detects expired lease [execution-dispatch-reconciliation-service]", () => {
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

test("ExecutionDispatchReconciliationService.scan detects lease/ticket mismatch [execution-dispatch-reconciliation-service]", () => {
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

test("ExecutionDispatchReconciliationService.scan skips pending tickets with valid execution [execution-dispatch-reconciliation-service]", () => {
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

test("ExecutionDispatchReconciliationService.scan handles multiple tickets [execution-dispatch-reconciliation-service]", () => {
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

test("ExecutionDispatchReconciliationService.repairTicket allocates a fresh replacement attempt [execution-dispatch-reconciliation-service]", () => {
  const insertedTickets: MockTicket[] = [];
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "claimed", leaseId: "lease-1", assignedWorkerId: "worker-1" },
    { id: "ticket-older", executionId: "exec-1", status: "expired", leaseId: null, assignedWorkerId: null, attempt: 2 } as MockTicket & { attempt: number },
  ];
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "executing", traceId: "trace-1" }],
  ]);
  const store = {
    worker: {
      listExecutionTicketsByStatuses: (statuses: string[]) =>
        [...tickets, ...insertedTickets].filter((ticket) => statuses.includes(ticket.status)),
      getExecutionTicket: (id: string) => [...tickets, ...insertedTickets].find((ticket) => ticket.id === id) ?? null,
      getActiveExecutionLease: () => null,
      invalidateExecutionTicket: () => {},
      insertExecutionTicket: (ticket: MockTicket & { attempt: number }) => {
        insertedTickets.push(ticket);
      },
      getWorkerSnapshot: () => null,
    },
    dispatch: {
      getExecution: (id: string) => executions.get(id) ?? null,
    },
    event: {
      insertEvent: () => {},
    },
  } as unknown as AuthoritativeTaskStore;
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);

  const repaired = service.repairTicket("ticket-1", new Date().toISOString());

  assert.equal(repaired?.applied, true);
  assert.equal(insertedTickets.length, 1);
  assert.equal((insertedTickets[0] as { attempt: number }).attempt, 3);
});

// ---------------------------------------------------------------------------
// findIssueByTicketId
// ---------------------------------------------------------------------------

test("ExecutionDispatchReconciliationService.findIssueByTicketId returns null for nonexistent ticket [execution-dispatch-reconciliation-service]", () => {
  const store = createMockStore([]);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issue = service.findIssueByTicketId("nonexistent");
  assert.equal(issue, null);
});

test("ExecutionDispatchReconciliationService.findIssueByTicketId returns null for consumed ticket [execution-dispatch-reconciliation-service]", () => {
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

test("ExecutionDispatchReconciliationService.repair returns issues and applied repairs [execution-dispatch-reconciliation-service]", () => {
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

test("ExecutionDispatchReconciliationService.repairTicket returns null for nonexistent ticket [execution-dispatch-reconciliation-service]", () => {
  const store = createMockStore([]);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const result = service.repairTicket("nonexistent");
  assert.equal(result, null);
});

// ---------------------------------------------------------------------------
// Helper function tests (via service behavior)
// ---------------------------------------------------------------------------

test("ExecutionDispatchReconciliationService handles failed terminal execution [execution-dispatch-reconciliation-service]", () => {
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

test("ExecutionDispatchReconciliationService handles cancelled terminal execution [execution-dispatch-reconciliation-service]", () => {
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

test("ExecutionDispatchReconciliationService handles superseded terminal execution [execution-dispatch-reconciliation-service]", () => {
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

// ---------------------------------------------------------------------------
// Additional repair scenarios
// ---------------------------------------------------------------------------

test("ExecutionDispatchReconciliationService repairTicket applies invalidate for terminal execution [execution-dispatch-reconciliation-service]", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "pending", leaseId: null, assignedWorkerId: null },
  ];
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "succeeded" }],
  ]);
  const store = createMockStore(tickets, executions);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const result = service.repairTicket("ticket-1");
  assert.ok(result != null);
  assert.equal(result.applied, true);
  assert.equal(result.resolutionAction, "invalidate_ticket");
  assert.equal(result.replacementTicketId, null);
});

test("ExecutionDispatchReconciliationService repairTicket returns null for invalid ticket id [execution-dispatch-reconciliation-service]", () => {
  const store = createMockStore([]);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const result = service.repairTicket("nonexistent-ticket");
  assert.equal(result, null);
});

test("ExecutionDispatchReconciliationService repairTicket returns null when no issue found [execution-dispatch-reconciliation-service]", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "pending", leaseId: null, assignedWorkerId: null },
  ];
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "executing" }],
  ]);
  const store = createMockStore(tickets, executions);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const result = service.repairTicket("ticket-1");
  assert.equal(result, null);
});

test("ExecutionDispatchReconciliationService findIssueByTicketId returns issue for expired lease [execution-dispatch-reconciliation-service]", () => {
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
  const issue = service.findIssueByTicketId("ticket-1");
  assert.ok(issue != null);
  assert.equal(issue.issueType, "orphan_queue_claim");
  assert.equal(issue.reasonCode, "lease_expired_unreclaimed");
});

test("ExecutionDispatchReconciliationService findIssueByTicketId returns issue for missing active lease [execution-dispatch-reconciliation-service]", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "claimed", leaseId: "lease-1", assignedWorkerId: "worker-1" },
  ];
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "executing" }],
  ]);
  // No lease in map
  const store = createMockStore(tickets, executions, new Map());
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issue = service.findIssueByTicketId("ticket-1");
  assert.ok(issue != null);
  assert.equal(issue.issueType, "orphan_queue_claim");
  assert.equal(issue.reasonCode, "missing_active_lease");
});

test("ExecutionDispatchReconciliationService findIssueByTicketId returns issue for lease mismatch [execution-dispatch-reconciliation-service]", () => {
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
  const issue = service.findIssueByTicketId("ticket-1");
  assert.ok(issue != null);
  assert.equal(issue.issueType, "orphan_queue_claim");
  assert.equal(issue.reasonCode, "lease_ticket_mismatch");
});

test("ExecutionDispatchReconciliationService handles mixed terminal statuses [execution-dispatch-reconciliation-service]", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-failed", executionId: "exec-failed", status: "pending", leaseId: null, assignedWorkerId: null },
    { id: "ticket-cancelled", executionId: "exec-cancelled", status: "pending", leaseId: null, assignedWorkerId: null },
    { id: "ticket-superseded", executionId: "exec-superseded", status: "pending", leaseId: null, assignedWorkerId: null },
  ];
  const executions = new Map([
    ["exec-failed", { id: "exec-failed", taskId: "task-1", status: "failed" }],
    ["exec-cancelled", { id: "exec-cancelled", taskId: "task-2", status: "cancelled" }],
    ["exec-superseded", { id: "exec-superseded", taskId: "task-3", status: "superseded" }],
  ]);
  const store = createMockStore(tickets, executions);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issues = service.scan();
  assert.equal(issues.length, 3);
  assert.ok(issues.every(i => i.issueType === "terminal_execution_ticket"));
});

test("ExecutionDispatchReconciliationService handles empty execution map [execution-dispatch-reconciliation-service]", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "pending", leaseId: null, assignedWorkerId: null },
  ];
  const executions = new Map();
  const store = createMockStore(tickets, executions);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issues = service.scan();
  // No execution found, so no issue detected
  assert.equal(issues.length, 0);
});

test("ExecutionDispatchReconciliationService findIssueByTicketId returns null for consumed status [execution-dispatch-reconciliation-service]", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-1", executionId: "exec-1", status: "consumed", leaseId: null, assignedWorkerId: null },
  ];
  const store = createMockStore(tickets);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issue = service.findIssueByTicketId("ticket-1");
  assert.equal(issue, null);
});

test("ExecutionDispatchReconciliationService scan includes all pending and claimed tickets [execution-dispatch-reconciliation-service]", () => {
  const tickets: MockTicket[] = [
    { id: "ticket-pending", executionId: "exec-1", status: "pending", leaseId: null, assignedWorkerId: null },
    { id: "ticket-claimed", executionId: "exec-2", status: "claimed", leaseId: "lease-1", assignedWorkerId: "worker-1" },
    { id: "ticket-consumed", executionId: "exec-3", status: "consumed", leaseId: null, assignedWorkerId: null },
    { id: "ticket-expired", executionId: "exec-4", status: "expired", leaseId: null, assignedWorkerId: null },
  ];
  const executions = new Map([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "executing" }],
    ["exec-2", { id: "exec-2", taskId: "task-2", status: "executing" }],
    ["exec-3", { id: "exec-3", taskId: "task-3", status: "executing" }],
    ["exec-4", { id: "exec-4", taskId: "task-4", status: "executing" }],
  ]);
  // Add the lease for exec-2 so the claimed ticket is valid
  const futureTime = new Date(Date.now() + 60000).toISOString();
  const leases = new Map([
    ["exec-2", { id: "lease-1", executionId: "exec-2", workerId: "worker-1", expiresAt: futureTime }],
  ]);
  const store = createMockStore(tickets, executions, leases);
  const service = new ExecutionDispatchReconciliationService(createMockDb(), store);
  const issues = service.scan();
  // Only pending and claimed tickets are scanned
  // ticket-pending: no issue (execution not terminal, pending status)
  // ticket-claimed: no issue (valid lease exists)
  // consumed and expired are filtered out
  assert.equal(issues.length, 0);
});
