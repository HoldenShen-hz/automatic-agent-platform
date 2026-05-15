/**
 * @fileoverview DB Queue Disconnect Repair Service - Repairs executions missing dispatch tickets.
 *
 * When an execution is created but its dispatch ticket is lost or disconnected from the
 * execution record, this service detects the issue and repairs it by creating a new
 * dispatch ticket with the appropriate dispatch requirements.
 *
 * This can happen when:
 * - A database transaction partially commits
 * - A crash occurs between execution creation and ticket creation
 * - Database records are manually modified or corrupted
 *
 * The repair template is recovered from the agent execution plan if available,
 * preserving the original dispatch requirements (priority, queue, isolation, etc.).
 */

import type { DispatchTarget, TaskPriority, WorkerIsolationLevel } from "../../contracts/types/domain.js";

import { newId, nowIso } from "../../contracts/types/ids.js";
import { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/authoritative-sql-database.js";
import { ExecutionDispatchService } from "../dispatcher/execution-dispatch-service.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

/**
 * Internal template for rebuilding a dispatch ticket.
 *
 * Captures all the dispatch requirements that were originally specified
 * when the execution was first created.
 */
interface DispatchRepairTemplate {
  priority?: TaskPriority;
  queueName?: string | null;
  dispatchTarget?: DispatchTarget | null;
  requiredIsolationLevel?: WorkerIsolationLevel | null;
  requiredRepoVersion?: string | null;
  requiredCapabilities?: string[];
  dispatchAfter?: string | null;
}

/**
 * An issue where an execution exists but has no associated dispatch ticket.
 *
 * The execution is in a valid state (created, prechecking, or blocked) but
 * cannot be dispatched because the ticket linking it to the queue is missing.
 * The repairTemplate provides all information needed to recreate the ticket.
 */
export interface DbQueueDisconnectRepairIssue {
  issueType: "missing_dispatch_ticket";
  executionId: string;
  taskId: string;
  executionStatus: "created" | "prechecking" | "blocked";
  reasonCode: "missing_active_dispatch_ticket";
  recoveredFromPlan: boolean;
  repairTemplate: {
    priority: TaskPriority;
    queueName: string | null;
    dispatchTarget: DispatchTarget;
    requiredIsolationLevel: WorkerIsolationLevel;
    requiredRepoVersion: string | null;
    requiredCapabilities: string[];
    dispatchAfter: string | null;
  };
}

/** Result of repairing a queue disconnect issue. */
export interface DbQueueDisconnectRepairResult {
  issueType: DbQueueDisconnectRepairIssue["issueType"];
  executionId: string;
  taskId: string;
  applied: boolean;
  replacementTicketId: string | null;
  recoveredFromPlan: boolean;
}

/** Normalizes a value to a sorted, deduplicated string array. */
function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  return Array.from(
    new Set(
      values
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ),
  ).sort();
}

/** Parses a dispatch target value, returning null if invalid. */
function parseDispatchTarget(value: unknown): DispatchTarget | null {
  switch (value) {
    case "any":
    case "local_only":
    case "prefer_remote":
    case "require_remote":
      return value;
    default:
      return null;
  }
}

/** Parses an isolation level value, returning null if invalid. */
function parseIsolationLevel(value: unknown): WorkerIsolationLevel | null {
  switch (value) {
    case "standard":
    case "hardened":
    case "strict":
      return value;
    default:
      return null;
  }
}

/** Parses a priority value, returning undefined if invalid. */
function parsePriority(value: unknown): TaskPriority | undefined {
  switch (value) {
    case "low":
    case "normal":
    case "high":
    case "urgent":
      return value;
    default:
      return undefined;
  }
}

/**
 * Parses the agent execution plan JSON to extract dispatch requirements.
 *
 * The plan JSON stores dispatch requirements when an execution is created.
 * If the plan is unavailable or invalid, returns an empty template and
 * indicates recovery was not possible from the plan.
 */
export function parseDbQueueDisconnectRepairTemplate(planJson: string | null | undefined): {
  template: DispatchRepairTemplate;
  recoveredFromPlan: boolean;
} {
  if (typeof planJson !== "string" || planJson.trim().length === 0) {
    return {
      template: {},
      recoveredFromPlan: false,
    };
  }

  try {
    const parsed = JSON.parse(planJson) as Record<string, unknown>;
    const template: DispatchRepairTemplate = {};
    const priority = parsePriority(parsed.priority);
    if (priority !== undefined) template.priority = priority;
    const queueName = typeof parsed.queueName === "string" ? parsed.queueName : parsed.queueName === null ? null : undefined;
    if (queueName !== undefined) template.queueName = queueName;
    const dispatchTarget = parseDispatchTarget(parsed.dispatchTarget);
    if (dispatchTarget !== null) template.dispatchTarget = dispatchTarget;
    const requiredIsolationLevel = parseIsolationLevel(parsed.requiredIsolationLevel);
    if (requiredIsolationLevel !== null) template.requiredIsolationLevel = requiredIsolationLevel;
    const requiredRepoVersion =
      typeof parsed.requiredRepoVersion === "string"
        ? parsed.requiredRepoVersion
        : parsed.requiredRepoVersion === null
          ? null
          : undefined;
    if (requiredRepoVersion !== undefined) template.requiredRepoVersion = requiredRepoVersion;
    template.requiredCapabilities = normalizeStringArray(parsed.requiredCapabilities);
    const dispatchAfter =
      typeof parsed.dispatchAfter === "string" ? parsed.dispatchAfter : parsed.dispatchAfter === null ? null : undefined;
    if (dispatchAfter !== undefined) template.dispatchAfter = dispatchAfter;
    const recoveredFromPlan =
      template.priority !== undefined ||
      template.queueName !== undefined ||
      template.dispatchTarget !== undefined ||
      template.requiredIsolationLevel !== undefined ||
      template.requiredRepoVersion !== undefined ||
      template.requiredCapabilities !== undefined ||
      template.dispatchAfter !== undefined;

    return {
      template,
      recoveredFromPlan,
    };
  } catch (err) {
    logger.log({
      level: "warn",
      message: "Failed to parse dispatch queue disconnect repair template",
      data: { error: err instanceof Error ? err.message : String(err), planJson: planJson?.substring(0, 100) },
    });
    return {
      template: {},
      recoveredFromPlan: false,
    };
  }
}

/**
 * Service for repairing executions that have lost their dispatch tickets.
 *
 * Scans for executions in created/prechecking/blocked state that have no
 * associated dispatch ticket, then repairs them by creating new tickets
 * with recovered dispatch requirements.
 */
export class ExecutionDbQueueDisconnectRepairService {
  private readonly dispatch: ExecutionDispatchService;

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
  ) {
    this.dispatch = new ExecutionDispatchService(db, store);
  }

  /**
   * Scans for executions with missing dispatch tickets.
   *
   * Checks all executions in created, prechecking, or blocked status to see
   * if they have an active ticket. An execution is considered to have a
   * disconnect if it has no ticket and no active lease.
   */
  public scan(): DbQueueDisconnectRepairIssue[] {
    const executions = this.store.dispatch.listExecutionsByStatuses(["created", "prechecking", "blocked"]);
    return executions
      .map((execution) => {
        if (this.store.worker.getActiveExecutionTicket(execution.id, execution.attempt)) {
          return null;
        }
        if (this.store.worker.getActiveExecutionLease(execution.id)) {
          return null;
        }

        const view = this.store.operations.loadExecutionAuthoritativeView(execution.id);
        if (!view?.task) {
          return null;
        }
        if (view.task.status === "done" || view.task.status === "failed" || view.task.status === "cancelled") {
          return null;
        }

        const agentExecution = this.store.worker.getAgentExecutionRecord(execution.id);
        const parsed = parseDbQueueDisconnectRepairTemplate(agentExecution?.planJson);
        return {
          issueType: "missing_dispatch_ticket",
          executionId: execution.id,
          taskId: execution.taskId,
          executionStatus: execution.status as "created" | "prechecking" | "blocked",
          reasonCode: "missing_active_dispatch_ticket",
          recoveredFromPlan: parsed.recoveredFromPlan,
          repairTemplate: {
            priority: parsed.template.priority ?? view.task.priority,
            queueName: parsed.template.queueName ?? null,
            dispatchTarget: parsed.template.dispatchTarget ?? "any",
            requiredIsolationLevel: parsed.template.requiredIsolationLevel ?? "standard",
            requiredRepoVersion: parsed.template.requiredRepoVersion ?? null,
            requiredCapabilities: parsed.template.requiredCapabilities ?? [],
            dispatchAfter: parsed.template.dispatchAfter ?? null,
          },
        } satisfies DbQueueDisconnectRepairIssue;
      })
      .filter((issue): issue is DbQueueDisconnectRepairIssue => issue != null);
  }

  /**
   * Repairs all executions with queue disconnect issues.
   *
   * Scans for issues and applies repairs to each, returning both the
   * issues found and the repair results.
   */
  public repair(now: string = nowIso()): { issues: DbQueueDisconnectRepairIssue[]; applied: DbQueueDisconnectRepairResult[] } {
    const issues = this.scan();
    return {
      issues,
      applied: issues.map((issue) => this.applyIssue(issue, now)),
    };
  }

  /**
   * Repairs a single execution by ID if it has a queue disconnect issue.
   *
   * Returns null if the execution doesn't exist or doesn't have an issue.
   */
  public repairExecution(executionId: string, now: string = nowIso()): DbQueueDisconnectRepairResult | null {
    const issue = this.scan().find((item) => item.executionId === executionId) ?? null;
    return issue ? this.applyIssue(issue, now) : null;
  }

  /**
   * Applies the repair for a single queue disconnect issue.
   *
   * Creates a new dispatch ticket using the repair template recovered from
   * the agent execution plan. Emits an event recording the repair.
   */
  private applyIssue(issue: DbQueueDisconnectRepairIssue, occurredAt: string): DbQueueDisconnectRepairResult {
    const execution = this.store.dispatch.getExecution(issue.executionId);
    if (!execution || this.store.worker.getActiveExecutionTicket(issue.executionId, execution.attempt) || this.store.worker.getActiveExecutionLease(issue.executionId)) {
      return {
        issueType: issue.issueType,
        executionId: issue.executionId,
        taskId: issue.taskId,
        applied: false,
        replacementTicketId: null,
        recoveredFromPlan: issue.recoveredFromPlan,
      };
    }

    const replacement = this.dispatch.createTicket({
      executionId: issue.executionId,
      priority: issue.repairTemplate.priority,
      queueName: issue.repairTemplate.queueName,
      dispatchTarget: issue.repairTemplate.dispatchTarget,
      requiredIsolationLevel: issue.repairTemplate.requiredIsolationLevel,
      requiredRepoVersion: issue.repairTemplate.requiredRepoVersion,
      requiredCapabilities: issue.repairTemplate.requiredCapabilities,
      dispatchAfter: issue.repairTemplate.dispatchAfter,
      occurredAt,
    });

    this.db.transaction(() => {
      this.store.event.insertEvent({
        id: newId("evt"),
        taskId: issue.taskId,
        executionId: issue.executionId,
        eventType: "dispatch:ticket_rebuilt",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({
          replacementTicketId: replacement.ticket.id,
          reasonCode: issue.reasonCode,
          recoveredFromPlan: issue.recoveredFromPlan,
          repairTemplate: issue.repairTemplate,
        }),
        traceId: execution.traceId,
        createdAt: occurredAt,
      });
    });

    return {
      issueType: issue.issueType,
      executionId: issue.executionId,
      taskId: issue.taskId,
      applied: true,
      replacementTicketId: replacement.ticket.id,
      recoveredFromPlan: issue.recoveredFromPlan,
    };
  }
}
