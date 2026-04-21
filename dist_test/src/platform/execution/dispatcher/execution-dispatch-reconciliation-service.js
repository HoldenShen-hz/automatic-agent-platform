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
import { newId, nowIso } from "../../contracts/types/ids.js";
import { ExecutionDispatchService } from "./execution-dispatch-service.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
const logger = new StructuredLogger({ retentionLimit: 100 });
function parseJsonArray(value) {
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
    }
    catch (err) {
        logger.log({
            level: "warn",
            message: "Failed to parse JSON array",
            data: { error: err instanceof Error ? err.message : String(err), value: value.substring(0, 100) },
        });
        return [];
    }
}
function isTerminalExecutionStatus(status) {
    return status === "succeeded" || status === "failed" || status === "cancelled" || status === "superseded";
}
export class ExecutionDispatchReconciliationService {
    db;
    store;
    dispatch;
    constructor(db, store) {
        this.db = db;
        this.store = store;
        this.dispatch = new ExecutionDispatchService(db, store);
    }
    scan(now = nowIso()) {
        const tickets = this.store.worker.listExecutionTicketsByStatuses(["pending", "claimed"]);
        return tickets
            .map((ticket) => this.findIssueForTicket(ticket, now))
            .filter((issue) => issue != null);
    }
    findIssueByTicketId(ticketId, now = nowIso()) {
        const ticket = this.store.worker.getExecutionTicket(ticketId);
        if (!ticket || (ticket.status !== "pending" && ticket.status !== "claimed")) {
            return null;
        }
        return this.findIssueForTicket(ticket, now);
    }
    repair(now = nowIso()) {
        const issues = this.scan(now);
        const applied = issues.map((issue) => this.applyIssue(issue, now));
        return {
            issues,
            applied,
        };
    }
    repairTicket(ticketId, now = nowIso()) {
        const issue = this.findIssueByTicketId(ticketId, now);
        if (!issue) {
            return null;
        }
        return this.applyIssue(issue, now);
    }
    findIssueForTicket(ticket, now) {
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
    applyIssue(issue, occurredAt) {
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
        this.db.transaction(() => {
            this.store.worker.invalidateExecutionTicket({
                ticketId: ticket.id,
                status: "expired",
                invalidatedAt: occurredAt,
            });
            this.recordReconciledEvent(ticket, issue, occurredAt, null);
        });
        const replacement = this.dispatch.createTicket({
            executionId: ticket.executionId,
            priority: ticket.priority,
            queueName: ticket.queueName,
            dispatchTarget: ticket.dispatchTarget ?? "any",
            requiredIsolationLevel: ticket.requiredIsolationLevel ?? "standard",
            requiredCapabilities: parseJsonArray(ticket.requiredCapabilitiesJson),
            dispatchAfter: ticket.dispatchAfter,
            occurredAt,
        });
        this.db.transaction(() => {
            this.store.event.insertEvent({
                id: newId("evt"),
                taskId: ticket.taskId,
                executionId: ticket.executionId,
                eventType: "dispatch:ticket_requeued",
                eventTier: "tier_2",
                payloadJson: JSON.stringify({
                    previousTicketId: ticket.id,
                    replacementTicketId: replacement.ticket.id,
                    reasonCode: issue.reasonCode,
                }),
                traceId: this.store.dispatch.getExecution(ticket.executionId)?.traceId ?? null,
                createdAt: occurredAt,
            });
        });
        return {
            issueType: issue.issueType,
            executionId: issue.executionId,
            taskId: issue.taskId,
            ticketId: issue.ticketId,
            applied: true,
            resolutionAction: issue.resolutionAction,
            replacementTicketId: replacement.ticket.id,
        };
    }
    recordReconciledEvent(ticket, issue, occurredAt, replacementTicketId) {
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
//# sourceMappingURL=execution-dispatch-reconciliation-service.js.map