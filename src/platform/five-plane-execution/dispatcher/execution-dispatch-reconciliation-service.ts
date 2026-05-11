/**
 * Execution Dispatch Reconciliation Service
 *
 * Reconciles execution dispatch tickets with actual execution state to detect
 * and repair orphaned or inconsistent dispatch records. This service identifies
 * tickets that reference terminal executions, lack valid leases, or have lease
 * mismatches.
 *
 * The service scans for issues and can apply repairs including requeuing tickets
 * and invalidating orphaned claims. All reconciliation actions emit audit events.
 *
 * @see {@link docs_zh/contracts/runtime_execution_contract.md}
 * @see {@link docs_zh/contracts/task_lease_and_fencing_contract.md}
 * @see {@link docs_zh/architecture/00-platform-architecture.md}
 * @see {@link docs_zh/governance/glossary_and_terminology.md}
 */

import type { ExecutionTicketRecord } from "../../contracts/types/domain.js";
import type { ExecutionStatus } from "../../contracts/types/status.js";

import { newId, nowIso } from "../../contracts/types/ids.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import { ExecutionDispatchService } from "./execution-dispatch-service.js";
import { buildWorkerSnapshotRefreshInput, removeExecutionId } from "../lease/utils.js";
import { WorkerRegistryService } from "../worker-pool/worker-registry-service.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

/**
 * Default page size for reconciliation scans to prevent OOM on large ticket sets.
 * Issue #1910 P1: scan() without pagination can cause OOM when scanning all tickets.
 */
const DEFAULT_RECONCILIATION_PAGE_SIZE = 100;

export interface DispatchReconciliationIssue {
  issueType: "orphan_queue_claim" | "terminal_execution_ticket";
  resolutionAction: "requeue_ticket" | "invalidate_ticket";
  executionId: string;
  taskId: string;
  ticketId: string;
  reasonCode: "missing_active_lease" | "lease_ticket_mismatch" | "lease_expired_unreclaimed" | "execution_terminal";
  executionStatus: ExecutionStatus;
}

export interface DispatchReconciliationRepairResult {
  issueType: DispatchReconciliationIssue["issueType"];
  executionId: string;
  taskId: string;
  ticketId: string;
  applied: boolean;
  resolutionAction: DispatchReconciliationIssue["resolutionAction"];
  replacementTicketId: string | null;
}

function parseJsonArray(value: string | null | undefined): string[] {
  if (value == null || value.length === 0) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch (err) {
    logger.log({
      level: "warn",
      message: "Failed to parse JSON array",
      data: { error: err instanceof Error ? err.message : String(err), value: value.substring(0, 100) },
    });
    return [];
  }
}

function isTerminalExecutionStatus(status: ExecutionStatus): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled" || status === "superseded";
}

export class ExecutionDispatchReconciliationService {
  private readonly dispatch: ExecutionDispatchService;
  private readonly workers: WorkerRegistryService;

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
  ) {
    this.dispatch = new ExecutionDispatchService(db, store);
    this.workers = new WorkerRegistryService(store);
  }

  public scan(now: string = nowIso()): DispatchReconciliationIssue[] {
    return this.scanPaginated(DEFAULT_RECONCILIATION_PAGE_SIZE, now);
  }

  /**
   * Paginated scan to prevent OOM when reconciling large ticket sets.
   * Issue #1910 P1: Full scan without pagination can cause OOM.
   */
  public scanPaginated(pageSize: number = DEFAULT_RECONCILIATION_PAGE_SIZE, now: string = nowIso()): DispatchReconciliationIssue[] {
    const issues: DispatchReconciliationIssue[] = [];
    let offset = 0;
    while (true) {
      const tickets = this.getTicketsPage(pageSize, offset);
      if (tickets.length === 0) {
        break;
      }
      for (const ticket of tickets) {
        const issue = this.findIssueForTicket(ticket, now);
        if (issue) {
          issues.push(issue);
        }
      }
      if (tickets.length < pageSize) {
        break;
      }
      offset += pageSize;
    }
    return issues;
  }

  private getTicketsPage(pageSize: number, offset: number): ExecutionTicketRecord[] {
    const allTickets = this.store.worker.listExecutionTicketsByStatuses(["pending", "claimed"]);
    return allTickets.slice(offset, offset + pageSize);
  }

  public findIssueByTicketId(ticketId: string, now: string = nowIso()): DispatchReconciliationIssue | null {
    const ticket = this.store.worker.getExecutionTicket(ticketId);
    if (!ticket || (ticket.status !== "pending" && ticket.status !== "claimed")) {
      return null;
    }

    return this.findIssueForTicket(ticket, now);
  }

  public repair(now: string = nowIso()): { issues: DispatchReconciliationIssue[]; applied: DispatchReconciliationRepairResult[] } {
    const issues = this.scan(now);
    const applied = issues.map((issue) => this.applyIssue(issue, now));
    return {
      issues,
      applied,
    };
  }

  public repairTicket(ticketId: string, now: string = nowIso()): DispatchReconciliationRepairResult | null {
    const issue = this.findIssueByTicketId(ticketId, now);
    if (!issue) {
      return null;
    }

    return this.applyIssue(issue, now);
  }

  private findIssueForTicket(ticket: ExecutionTicketRecord, now: string): DispatchReconciliationIssue | null {
    const execution = this.store.dispatch.getExecution(ticket.executionId);
    if (!execution) {
      return null;
    }

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

    const activeLease = this.store.worker.getActiveExecutionLease(ticket.executionId);
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

  private applyIssue(issue: DispatchReconciliationIssue, occurredAt: string): DispatchReconciliationRepairResult {
    const ticket = this.store.worker.getExecutionTicket(issue.ticketId);
    if (!ticket) {
      return {
        issueType: issue.issueType,
        executionId: issue.executionId,
        taskId: issue.taskId,
        ticketId: issue.ticketId,
        applied: false,
        resolutionAction: issue.resolutionAction,
        replacementTicketId: null,
      };
    }

    if (issue.issueType === "terminal_execution_ticket") {
      this.db.transaction(() => {
        this.store.worker.invalidateExecutionTicket({
          ticketId: ticket.id,
          status: "cancelled",
          invalidatedAt: occurredAt,
        });
        this.recordReconciledEvent(ticket, issue, occurredAt, null);
      });

      return {
        issueType: issue.issueType,
        executionId: issue.executionId,
        taskId: issue.taskId,
        ticketId: issue.ticketId,
        applied: true,
        resolutionAction: issue.resolutionAction,
        replacementTicketId: null,
      };
    }

    const replacementTicket = this.db.transaction(() => {
      this.store.worker.invalidateExecutionTicket({
        ticketId: ticket.id,
        status: "expired",
        invalidatedAt: occurredAt,
      });
      this.releaseWorkerExecutionReference(ticket, occurredAt);
      const replacement = this.createReplacementTicketRecord(ticket, occurredAt);
      this.recordReconciledEvent(ticket, issue, occurredAt, replacement.id);
      this.store.event.insertEvent({
        id: newId("evt"),
        taskId: ticket.taskId,
        executionId: ticket.executionId,
        eventType: "dispatch:ticket_requeued",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({
          previousTicketId: ticket.id,
          replacementTicketId: replacement.id,
          reasonCode: issue.reasonCode,
        }),
        traceId: this.store.dispatch.getExecution(ticket.executionId)?.traceId ?? null,
        createdAt: occurredAt,
      });
      return replacement;
    });

    return {
      issueType: issue.issueType,
      executionId: issue.executionId,
      taskId: issue.taskId,
      ticketId: issue.ticketId,
      applied: true,
      resolutionAction: issue.resolutionAction,
      replacementTicketId: replacementTicket.id,
    };
  }

  private createReplacementTicketRecord(ticket: ExecutionTicketRecord, occurredAt: string): ExecutionTicketRecord {
    const replacement: ExecutionTicketRecord = {
      id: newId("ticket"),
      executionId: ticket.executionId,
      taskId: ticket.taskId,
      tenantId: ticket.tenantId,
      priority: ticket.priority,
      queueName: ticket.queueName,
      dispatchTarget: ticket.dispatchTarget,
      requiredIsolationLevel: ticket.requiredIsolationLevel,
      requiredRepoVersion: ticket.requiredRepoVersion,
      requiredCapabilitiesJson: ticket.requiredCapabilitiesJson,
      dispatchAfter: ticket.dispatchAfter,
      attempt: ticket.attempt,
      status: "pending",
      assignedWorkerId: null,
      leaseId: null,
      claimedAt: null,
      consumedAt: null,
      invalidatedAt: null,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    };
    this.store.worker.insertExecutionTicket(replacement);
    return replacement;
  }

  private releaseWorkerExecutionReference(ticket: ExecutionTicketRecord, occurredAt: string): void {
    if (ticket.assignedWorkerId == null) {
      return;
    }

    const workerStore = this.store.worker as {
      getWorkerSnapshot?: (workerId: string) => ReturnType<AuthoritativeTaskStore["worker"]["getWorkerSnapshot"]>;
    };
    if (typeof workerStore.getWorkerSnapshot !== "function") {
      return;
    }

    const snapshot = workerStore.getWorkerSnapshot(ticket.assignedWorkerId);
    if (!snapshot) {
      return;
    }

    const nextExecutionIds = removeExecutionId(parseJsonArray(snapshot.runningExecutionsJson), ticket.executionId);
    const nextActiveLeaseCount = Math.max(0, nextExecutionIds.length);
    this.workers.recordHeartbeat({
      ...buildWorkerSnapshotRefreshInput(snapshot, nextExecutionIds, occurredAt, logger),
      activeLeaseCount: nextActiveLeaseCount,
      currentStepId: nextExecutionIds.length === 0 ? null : snapshot.currentStepId,
      lastProgressAt: nextExecutionIds.length === 0 ? occurredAt : snapshot.lastProgressAt,
    });
  }

  private recordReconciledEvent(
    ticket: ExecutionTicketRecord,
    issue: DispatchReconciliationIssue,
    occurredAt: string,
    replacementTicketId: string | null,
  ): void {
    this.store.event.insertEvent({
      id: newId("evt"),
      taskId: ticket.taskId,
      executionId: ticket.executionId,
      eventType: "dispatch:ticket_reconciled",
      eventTier: "tier_2",
      payloadJson: JSON.stringify({
        ticketId: ticket.id,
        issueType: issue.issueType,
        reasonCode: issue.reasonCode,
        resolutionAction: issue.resolutionAction,
        replacementTicketId,
      }),
      traceId: this.store.dispatch.getExecution(ticket.executionId)?.traceId ?? null,
      createdAt: occurredAt,
    });
  }
}
