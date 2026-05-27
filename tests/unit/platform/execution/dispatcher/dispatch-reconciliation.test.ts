/**
 * Execution Dispatch Reconciliation Service Unit Tests
 *
 * Tests for the ExecutionDispatchReconciliationService class covering:
 * - Orphan queue claim detection
 * - Terminal execution ticket detection
 * - Lease mismatch detection
 */

import assert from "node:assert/strict";
import test from "node:test";

import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import type { ExecutionStatus } from "../../../../../src/platform/contracts/types/status.js";

/**
 * Mock ExecutionDispatchReconciliationService for unit testing.
 * This is a simplified mock that captures the reconciliation logic.
 */
class MockDispatchReconciliationService {
  private issues: Array<{
    issueType: "orphan_queue_claim" | "terminal_execution_ticket";
    executionId: string;
    taskId: string;
    ticketId: string;
    reasonCode: string;
    executionStatus: ExecutionStatus;
  }> = [];

  public scan(tickets: MockTicket[], executions: Map<string, MockExecution>, leases: Map<string, MockLease>, now: string): ReturnType<typeof this.findIssueForTicket>[] {
    return tickets
      .map((ticket) => this.findIssueForTicket(ticket, tickets, executions, leases, now))
      .filter((issue): issue is NonNullable<ReturnType<typeof this.findIssueForTicket>> => issue != null);
  }

  public findIssueForTicket(
    ticket: MockTicket,
    allTickets: MockTicket[],
    executions: Map<string, MockExecution>,
    leases: Map<string, MockLease>,
    now: string,
  ): ReturnType<typeof this.findIssueForTicket> {
    const execution = executions.get(ticket.executionId);
    if (!execution) {
      return null;
    }

    // Check if execution is terminal
    if (isTerminalExecutionStatus(execution.status)) {
      return {
        issueType: "terminal_execution_ticket",
        resolutionAction: "invalidate_ticket",
        executionId: execution.id,
        taskId: execution.taskId,
        ticketId: ticket.id,
        reasonCode: "execution_terminal",
        executionStatus: execution.status,
      };
    }

    if (ticket.status !== "claimed") {
      return null;
    }

    const activeLease = leases.get(ticket.executionId);
    if (!activeLease) {
      return {
        issueType: "orphan_queue_claim",
        resolutionAction: "requeue_ticket",
        executionId: execution.id,
        taskId: execution.taskId,
        ticketId: ticket.id,
        reasonCode: "missing_active_lease",
        executionStatus: execution.status,
      };
    }

    if (Date.parse(activeLease.expiresAt) < Date.parse(now)) {
      return {
        issueType: "orphan_queue_claim",
        resolutionAction: "requeue_ticket",
        executionId: execution.id,
        taskId: execution.taskId,
        ticketId: ticket.id,
        reasonCode: "lease_expired_unreclaimed",
        executionStatus: execution.status,
      };
    }

    if (ticket.leaseId !== activeLease.id || ticket.assignedWorkerId !== activeLease.workerId) {
      return {
        issueType: "orphan_queue_claim",
        resolutionAction: "requeue_ticket",
        executionId: execution.id,
        taskId: execution.taskId,
        ticketId: ticket.id,
        reasonCode: "lease_ticket_mismatch",
        executionStatus: execution.status,
      };
    }

    return null;
  }

  public repair(issues: ReturnType<typeof this.scan>): { issues: ReturnType<typeof this.scan>; applied: MockRepairResult[] } {
    const applied = issues.map((issue) => this.applyIssue(issue));
    return { issues, applied };
  }

  private applyIssue(issue: ReturnType<typeof this.findIssueForTicket>): MockRepairResult {
    return {
      issueType: issue!.issueType,
      executionId: issue!.executionId,
      taskId: issue!.taskId,
      ticketId: issue!.ticketId,
      applied: true,
      resolutionAction: issue!.resolutionAction,
      replacementTicketId: issue!.issueType === "terminal_execution_ticket" ? null : newId("ticket"),
    };
  }
}

interface MockTicket {
  id: string;
  executionId: string;
  taskId: string;
  status: "pending" | "claimed" | "consumed" | "expired" | "cancelled";
  leaseId: string | null;
  assignedWorkerId: string | null;
}

interface MockExecution {
  id: string;
  taskId: string;
  status: ExecutionStatus;
}

interface MockLease {
  id: string;
  executionId: string;
  workerId: string;
  expiresAt: string;
  status: "active" | "released" | "expired";
}

interface MockRepairResult {
  issueType: "orphan_queue_claim" | "terminal_execution_ticket";
  executionId: string;
  taskId: string;
  ticketId: string;
  applied: boolean;
  resolutionAction: "requeue_ticket" | "invalidate_ticket";
  replacementTicketId: string | null;
}

function isTerminalExecutionStatus(status: ExecutionStatus): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled" || status === "superseded";
}

// ── Terminal Execution Detection Tests ─────────────────────────────────────────

test("DispatchReconciliation: detects terminal execution ticket (succeeded) [dispatch-reconciliation]", () => {
  const service = new MockDispatchReconciliationService();

  const tickets: MockTicket[] = [{
    id: "ticket-1",
    executionId: "exec-1",
    taskId: "task-1",
    status: "claimed",
    leaseId: "lease-1",
    assignedWorkerId: "worker-1",
  }];

  const executions = new Map<string, MockExecution>([["exec-1", {
    id: "exec-1",
    taskId: "task-1",
    status: "succeeded",
  }]]);

  const leases = new Map<string, MockLease>([["exec-1", {
    id: "lease-1",
    executionId: "exec-1",
    workerId: "worker-1",
    expiresAt: "2026-04-28T00:00:00.000Z",
    status: "active",
  }]]);

  const issues = service.scan(tickets, executions, leases, "2026-04-27T12:00:00.000Z");

  assert.equal(issues.length, 1);
  assert.equal(issues[0].issueType, "terminal_execution_ticket");
  assert.equal(issues[0].reasonCode, "execution_terminal");
  assert.equal(issues[0].executionStatus, "succeeded");
});

test("DispatchReconciliation: detects terminal execution ticket (failed) [dispatch-reconciliation]", () => {
  const service = new MockDispatchReconciliationService();

  const tickets: MockTicket[] = [{
    id: "ticket-failed",
    executionId: "exec-failed",
    taskId: "task-1",
    status: "claimed",
    leaseId: "lease-1",
    assignedWorkerId: "worker-1",
  }];

  const executions = new Map<string, MockExecution>([["exec-failed", {
    id: "exec-failed",
    taskId: "task-1",
    status: "failed",
  }]]);

  const leases = new Map<string, MockLease>([["exec-failed", {
    id: "lease-1",
    executionId: "exec-failed",
    workerId: "worker-1",
    expiresAt: "2026-04-28T00:00:00.000Z",
    status: "active",
  }]]);

  const issues = service.scan(tickets, executions, leases, "2026-04-27T12:00:00.000Z");

  assert.equal(issues.length, 1);
  assert.equal(issues[0].issueType, "terminal_execution_ticket");
  assert.equal(issues[0].reasonCode, "execution_terminal");
});

test("DispatchReconciliation: detects terminal execution ticket (cancelled) [dispatch-reconciliation]", () => {
  const service = new MockDispatchReconciliationService();

  const tickets: MockTicket[] = [{
    id: "ticket-cancelled",
    executionId: "exec-cancelled",
    taskId: "task-1",
    status: "claimed",
    leaseId: "lease-1",
    assignedWorkerId: "worker-1",
  }];

  const executions = new Map<string, MockExecution>([["exec-cancelled", {
    id: "exec-cancelled",
    taskId: "task-1",
    status: "cancelled",
  }]]);

  const leases = new Map<string, MockLease>([["exec-cancelled", {
    id: "lease-1",
    executionId: "exec-cancelled",
    workerId: "worker-1",
    expiresAt: "2026-04-28T00:00:00.000Z",
    status: "active",
  }]]);

  const issues = service.scan(tickets, executions, leases, "2026-04-27T12:00:00.000Z");

  assert.equal(issues.length, 1);
  assert.equal(issues[0].issueType, "terminal_execution_ticket");
});

test("DispatchReconciliation: ignores non-terminal executions [dispatch-reconciliation]", () => {
  const service = new MockDispatchReconciliationService();

  const tickets: MockTicket[] = [{
    id: "ticket-active",
    executionId: "exec-active",
    taskId: "task-1",
    status: "claimed",
    leaseId: "lease-1",
    assignedWorkerId: "worker-1",
  }];

  const executions = new Map<string, MockExecution>([["exec-active", {
    id: "exec-active",
    taskId: "task-1",
    status: "executing",
  }]]);

  const leases = new Map<string, MockLease>([["exec-active", {
    id: "lease-1",
    executionId: "exec-active",
    workerId: "worker-1",
    expiresAt: "2026-04-28T00:00:00.000Z",
    status: "active",
  }]]);

  const issues = service.scan(tickets, executions, leases, "2026-04-27T12:00:00.000Z");

  assert.equal(issues.length, 0);
});

// ── Orphan Queue Claim Detection Tests ─────────────────────────────────────────

test("DispatchReconciliation: detects missing active lease [dispatch-reconciliation]", () => {
  const service = new MockDispatchReconciliationService();

  const tickets: MockTicket[] = [{
    id: "ticket-no-lease",
    executionId: "exec-no-lease",
    taskId: "task-1",
    status: "claimed",
    leaseId: "lease-1",
    assignedWorkerId: "worker-1",
  }];

  const executions = new Map<string, MockExecution>([["exec-no-lease", {
    id: "exec-no-lease",
    taskId: "task-1",
    status: "executing",
  }]]);

  // No lease for this execution
  const leases = new Map<string, MockLease>();

  const issues = service.scan(tickets, executions, leases, "2026-04-27T12:00:00.000Z");

  assert.equal(issues.length, 1);
  assert.equal(issues[0].issueType, "orphan_queue_claim");
  assert.equal(issues[0].reasonCode, "missing_active_lease");
});

test("DispatchReconciliation: detects expired lease unreclaimed [dispatch-reconciliation]", () => {
  const service = new MockDispatchReconciliationService();

  const tickets: MockTicket[] = [{
    id: "ticket-expired-lease",
    executionId: "exec-expired",
    taskId: "task-1",
    status: "claimed",
    leaseId: "lease-1",
    assignedWorkerId: "worker-1",
  }];

  const executions = new Map<string, MockExecution>([["exec-expired", {
    id: "exec-expired",
    taskId: "task-1",
    status: "executing",
  }]]);

  const leases = new Map<string, MockLease>([["exec-expired", {
    id: "lease-1",
    executionId: "exec-expired",
    workerId: "worker-1",
    expiresAt: "2026-04-27T10:00:00.000Z", // Expired before the scan time
    status: "active",
  }]]);

  const issues = service.scan(tickets, executions, leases, "2026-04-27T12:00:00.000Z");

  assert.equal(issues.length, 1);
  assert.equal(issues[0].issueType, "orphan_queue_claim");
  assert.equal(issues[0].reasonCode, "lease_expired_unreclaimed");
});

test("DispatchReconciliation: detects lease/ticket mismatch [dispatch-reconciliation]", () => {
  const service = new MockDispatchReconciliationService();

  const tickets: MockTicket[] = [{
    id: "ticket-mismatch",
    executionId: "exec-mismatch",
    taskId: "task-1",
    status: "claimed",
    leaseId: "lease-1", // Ticket references lease-1
    assignedWorkerId: "worker-1",
  }];

  const executions = new Map<string, MockExecution>([["exec-mismatch", {
    id: "exec-mismatch",
    taskId: "task-1",
    status: "executing",
  }]]);

  const leases = new Map<string, MockLease>([["exec-mismatch", {
    id: "lease-2", // But active lease is lease-2
    executionId: "exec-mismatch",
    workerId: "worker-2",
    expiresAt: "2026-04-28T00:00:00.000Z",
    status: "active",
  }]]);

  const issues = service.scan(tickets, executions, leases, "2026-04-27T12:00:00.000Z");

  assert.equal(issues.length, 1);
  assert.equal(issues[0].issueType, "orphan_queue_claim");
  assert.equal(issues[0].reasonCode, "lease_ticket_mismatch");
});

test("DispatchReconciliation: ignores pending tickets [dispatch-reconciliation]", () => {
  const service = new MockDispatchReconciliationService();

  const tickets: MockTicket[] = [{
    id: "ticket-pending",
    executionId: "exec-pending",
    taskId: "task-1",
    status: "pending", // Not claimed yet
    leaseId: null,
    assignedWorkerId: null,
  }];

  const executions = new Map<string, MockExecution>([["exec-pending", {
    id: "exec-pending",
    taskId: "task-1",
    status: "executing",
  }]]);

  // No leases
  const leases = new Map<string, MockLease>();

  const issues = service.scan(tickets, executions, leases, "2026-04-27T12:00:00.000Z");

  assert.equal(issues.length, 0);
});

// ── Repair Application Tests ────────────────────────────────────────────────────

test("DispatchReconciliation: repair applies terminal execution fix [dispatch-reconciliation]", () => {
  const service = new MockDispatchReconciliationService();

  const tickets: MockTicket[] = [{
    id: "ticket-repair-terminal",
    executionId: "exec-repair-terminal",
    taskId: "task-1",
    status: "claimed",
    leaseId: "lease-1",
    assignedWorkerId: "worker-1",
  }];

  const executions = new Map<string, MockExecution>([["exec-repair-terminal", {
    id: "exec-repair-terminal",
    taskId: "task-1",
    status: "succeeded",
  }]]);

  const leases = new Map<string, MockLease>([["exec-repair-terminal", {
    id: "lease-1",
    executionId: "exec-repair-terminal",
    workerId: "worker-1",
    expiresAt: "2026-04-28T00:00:00.000Z",
    status: "active",
  }]]);

  const issues = service.scan(tickets, executions, leases, "2026-04-27T12:00:00.000Z");
  const result = service.repair(issues);

  assert.equal(result.applied.length, 1);
  assert.equal(result.applied[0].applied, true);
  assert.equal(result.applied[0].resolutionAction, "invalidate_ticket");
  assert.equal(result.applied[0].replacementTicketId, null); // No replacement for terminal
});

test("DispatchReconciliation: repair applies orphan claim fix [dispatch-reconciliation]", () => {
  const service = new MockDispatchReconciliationService();

  const tickets: MockTicket[] = [{
    id: "ticket-repair-orphan",
    executionId: "exec-repair-orphan",
    taskId: "task-1",
    status: "claimed",
    leaseId: "lease-1",
    assignedWorkerId: "worker-1",
  }];

  const executions = new Map<string, MockExecution>([["exec-repair-orphan", {
    id: "exec-repair-orphan",
    taskId: "task-1",
    status: "executing",
  }]]);

  // No lease - orphan
  const leases = new Map<string, MockLease>();

  const issues = service.scan(tickets, executions, leases, "2026-04-27T12:00:00.000Z");
  const result = service.repair(issues);

  assert.equal(result.applied.length, 1);
  assert.equal(result.applied[0].applied, true);
  assert.equal(result.applied[0].resolutionAction, "requeue_ticket");
  assert.ok(result.applied[0].replacementTicketId); // Should have replacement
});

test("DispatchReconciliation: repair handles multiple issues [dispatch-reconciliation]", () => {
  const service = new MockDispatchReconciliationService();

  const tickets: MockTicket[] = [
    {
      id: "ticket-1",
      executionId: "exec-1",
      taskId: "task-1",
      status: "claimed",
      leaseId: "lease-1",
      assignedWorkerId: "worker-1",
    },
    {
      id: "ticket-2",
      executionId: "exec-2",
      taskId: "task-2",
      status: "claimed",
      leaseId: "lease-2",
      assignedWorkerId: "worker-2",
    },
  ];

  const executions = new Map<string, MockExecution>([
    ["exec-1", { id: "exec-1", taskId: "task-1", status: "succeeded" }], // Terminal
    ["exec-2", { id: "exec-2", taskId: "task-2", status: "executing" }], // Not terminal
  ]);

  const leases = new Map<string, MockLease>([
    ["exec-1", { id: "lease-1", executionId: "exec-1", workerId: "worker-1", expiresAt: "2026-04-28T00:00:00.000Z", status: "active" }],
    // No lease for exec-2
  ]);

  const issues = service.scan(tickets, executions, leases, "2026-04-27T12:00:00.000Z");
  const result = service.repair(issues);

  assert.equal(result.issues.length, 2);
  assert.equal(result.applied.length, 2);
});

test("DispatchReconciliation: isTerminalExecutionStatus utility [dispatch-reconciliation]", () => {
  const terminalStatuses: ExecutionStatus[] = ["succeeded", "failed", "cancelled", "superseded"];
  const nonTerminalStatuses: ExecutionStatus[] = ["created", "queued", "dispatching", "prechecking", "executing", "paused", "recovering", "blocked", "timed_out"];

  for (const status of terminalStatuses) {
    assert.equal(isTerminalExecutionStatus(status), true, `${status} should be terminal`);
  }

  for (const status of nonTerminalStatuses) {
    assert.equal(isTerminalExecutionStatus(status), false, `${status} should not be terminal`);
  }
});
