/**
 * Runtime Repair Service
 *
 * Applies repair actions identified by the startup consistency checker to fix
 * various runtime inconsistencies. This service is responsible for executing
 * recovery operations such as requeueing executions, reconciling dispatch
 * tickets, releasing stale locks, and rebuilding missing acknowledgements.
 *
 * The service operates transactionally where possible, ensuring that repair
 * operations are atomic and leave the system in a consistent state. Each
 * repair action generates a "recovery:repair_applied" event for audit trails.
 *
 * This service is typically invoked during startup or scheduled recovery
 * sweeps to automatically fix known consistency issues.
 *
 * @see {@link docs_zh/contracts/startup_consistency_and_recovery_drill_contract.md}
 * @see {@link docs_zh/contracts/runtime_state_machine_contract.md}
 * @see {@link docs_zh/contracts/runtime_execution_contract.md}
 * @see {@link docs_zh/contracts/event_bus_contract.md}
 * @see {@link docs_zh/architecture/00-platform-architecture.md}
 * @see {@link docs_zh/governance/glossary_and_terminology.md}
 */

import type { RepairAction, StartupConsistencyReport } from "../startup/startup-consistency-checker.js";

import { EventOpsService } from "../../state-evidence/events/event-ops-service.js";
import { getRegisteredConsumers, hasEventSchema } from "../../state-evidence/events/event-registry.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import { ExecutionDispatchService } from "../dispatcher/execution-dispatch-service.js";
import { ExecutionDispatchReconciliationService } from "../dispatcher/execution-dispatch-reconciliation-service.js";
import { ExecutionLeaseService } from "../lease/execution-lease-service.js";
import { createRecoverySession, isSessionTerminalStatus, isTaskActiveStatus } from "../execution-engine/session-lifecycle.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

/**
 * Result of applying a single repair action, including whether
 * the repair was successfully applied and details about the outcome.
 */
export interface RepairExecutionResult {
  /** The type of repair action that was applied */
  action: RepairAction["action"];
  /** The target entity ID the action was applied to */
  targetId: string;
  /** Whether the repair was successfully applied */
  applied: boolean;
  /** Human-readable description of the result */
  detail: string;
}

function parseJsonArray(value: string): string[] {
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

/**
 * Service responsible for applying repair actions to fix runtime
 * inconsistencies. Maintains an audit trail by emitting events
 * for each repair operation.
 *
 * The service uses a command pattern where each repair action type
 * has a dedicated handler method. All operations are transactional
 * where supported.
 */
export class RuntimeRepairService {
  private readonly eventOps: EventOpsService;
  private readonly dispatch: ExecutionDispatchService;
  private readonly dispatchReconciliation: ExecutionDispatchReconciliationService;
  private readonly leases: ExecutionLeaseService;

  /**
   * Creates a new RuntimeRepairService instance.
   * @param db - SQLite database for transaction support
   * @param store - AuthoritativeTaskStore for data access and modifications
   */
  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
  ) {
    // Initialize event operations service for consumer drainage
    this.eventOps = new EventOpsService(db, store);
    this.dispatch = new ExecutionDispatchService(db, store);
    // Initialize dispatch reconciliation for ticket repair
    this.dispatchReconciliation = new ExecutionDispatchReconciliationService(db, store);
    this.leases = new ExecutionLeaseService(db, store);
  }

  /**
   * Applies all repair actions from a startup consistency report.
   * Processes actions sequentially and returns results for each.
   *
   * @param report - The consistency report containing repair actions
   * @returns Array of results for each repair action that was attempted
   */
  public async apply(report: StartupConsistencyReport): Promise<RepairExecutionResult[]> {
    const results: RepairExecutionResult[] = [];

    // Process each repair action in order
    for (const action of report.repairActions) {
      results.push(await this.applyAction(action));
    }

    return results;
  }

  /**
   * Routes an action to the appropriate handler method based on action type.
   * Each action type has a dedicated private method for execution.
   *
   * @param action - The repair action to apply
   * @returns Result of the repair attempt
   */
  private async applyAction(action: RepairAction): Promise<RepairExecutionResult> {
    const occurredAt = nowIso();

    switch (action.action) {
      case "requeue_execution":
        return this.requeueExecution(action, occurredAt);
      case "reconcile_dispatch_ticket":
        return this.reconcileDispatchTicket(action, occurredAt);
      case "reconcile_terminal_state":
        return this.reconcileTerminalState(action, occurredAt);
      case "close_orphan_session":
        return this.closeOrphanSession(action, occurredAt);
      case "replace_terminal_session":
        return this.replaceTerminalSession(action, occurredAt);
      case "release_stale_lock":
        return this.releaseStaleLock(action, occurredAt);
      case "rebuild_ack":
        return this.rebuildAck(action, occurredAt);
      case "manual_intervention_required":
        // Cannot automatically repair - requires human operator
        return {
          action: action.action,
          targetId: action.targetId,
          applied: false,
          detail: "manual intervention required",
        };
    }
  }

  /**
   * Requeues an execution that was found to be in an inconsistent state.
   * Resets the execution to "created" status, updates the task to "pending",
   * restores workflow state if applicable, and reopens any closed sessions.
   *
   * @param action - The repair action targeting an execution
   * @param occurredAt - Timestamp for the operation
   * @returns Result indicating whether requeue was applied
   */
  private requeueExecution(action: RepairAction, occurredAt: string): RepairExecutionResult {
    const execution = this.store.dispatch.getExecution(action.targetId);
    if (!execution) {
      return {
        action: action.action,
        targetId: action.targetId,
        applied: false,
        detail: "execution missing",
      };
    }

    this.leases.reclaimActiveLease(execution.id, occurredAt, "stale_worker_requeue");

    // Perform all state changes in a transaction for atomicity
    this.db.transaction(() => {
      // Reset execution status to allow reprocessing
      this.store.execution.updateExecutionStatus(execution.id, "created", occurredAt, null, null, null);
      // Reset task to pending state
      this.store.task.setTaskState({
        taskId: execution.taskId,
        status: "pending",
        updatedAt: occurredAt,
        errorCode: null,
        completedAt: null,
      });

      // Restore workflow state if execution was part of a workflow
      const snapshot = this.store.operations.loadTaskSnapshot(execution.taskId);
      if (snapshot.workflow) {
        this.store.workflow.updateWorkflowRecoveryState({
          taskId: execution.taskId,
          status: "running",
          currentStepIndex: snapshot.workflow.currentStepIndex,
          outputsJson: snapshot.workflow.outputsJson,
          updatedAt: occurredAt,
          resumableFromStep: snapshot.workflow.resumableFromStep,
          retryCount: snapshot.workflow.retryCount,
          lastErrorCode: null,
        });
      }

      // Reopen sessions that were in terminal state (completed/failed/cancelled)
      // so they can be reused for the retry
      if (snapshot.session) {
        if (isSessionTerminalStatus(snapshot.session.status)) {
          this.store.session.insertSession(createRecoverySession(snapshot.session, occurredAt));
        } else if (snapshot.session.status !== "open") {
          this.store.session.updateSessionStatus(snapshot.session.id, "open", occurredAt);
        }
      }

      // Emit audit event for the repair
      this.store.event.insertEvent({
        id: newId("evt"),
        taskId: execution.taskId,
        executionId: execution.id,
        eventType: "recovery:repair_applied",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({
          repairAction: action.action,
          targetId: action.targetId,
        }),
        traceId: newId("trace"),
        createdAt: occurredAt,
      });
    });

    this.ensurePendingDispatchTicket(execution.id, occurredAt);

    return {
      action: action.action,
      targetId: action.targetId,
      applied: true,
      detail: "execution requeued",
    };
  }

  private ensurePendingDispatchTicket(executionId: string, occurredAt: string): string | null {
    const execution = this.store.dispatch.getExecution(executionId);
    if (!execution) {
      return null;
    }
    const task = this.store.task.getTask(execution.taskId);

    const activeTicket = this.store.worker.getActiveExecutionTicket(execution.id, execution.attempt);
    if (activeTicket?.status === "pending") {
      return activeTicket.id;
    }
    if (activeTicket?.status === "claimed") {
      const repaired = this.dispatchReconciliation.repairTicket(activeTicket.id, occurredAt);
      return repaired?.replacementTicketId ?? null;
    }

    const latestTicket = this.store
      .listExecutionTicketsByExecution(execution.id)
      .filter((ticket) => ticket.attempt === execution.attempt)
      .at(-1) ?? null;
    const created = this.dispatch.createTicket({
      executionId: execution.id,
      priority: latestTicket?.priority ?? task?.priority ?? "normal",
      queueName: latestTicket?.queueName ?? null,
      dispatchTarget: latestTicket?.dispatchTarget ?? "any",
      requiredIsolationLevel: latestTicket?.requiredIsolationLevel ?? "standard",
      requiredRepoVersion: latestTicket?.requiredRepoVersion ?? null,
      requiredCapabilities: parseJsonArray(latestTicket?.requiredCapabilitiesJson ?? "[]"),
      occurredAt,
    });
    return created.ticket.id;
  }

  /**
   * Reconciles a dispatch ticket that is out of sync with the execution state.
   * Delegates to the ExecutionDispatchReconciliationService which determines
   * the appropriate resolution (requeue or invalidate).
   *
   * @param action - The repair action targeting a dispatch ticket
   * @param occurredAt - Timestamp for the operation
   * @returns Result with details about ticket reconciliation
   */
  private reconcileDispatchTicket(action: RepairAction, occurredAt: string): RepairExecutionResult {
    const repaired = this.dispatchReconciliation.repairTicket(action.targetId, occurredAt);
    if (!repaired) {
      return {
        action: action.action,
        targetId: action.targetId,
        applied: false,
        detail: "dispatch ticket already healthy or missing",
      };
    }

    return {
      action: action.action,
      targetId: action.targetId,
      applied: repaired.applied,
      // Provide descriptive detail based on what resolution was taken
      detail:
        repaired.resolutionAction === "requeue_ticket"
          ? `dispatch ticket requeued${repaired.replacementTicketId ? ` as ${repaired.replacementTicketId}` : ""}`
          : "dispatch ticket invalidated",
    };
  }

  private reconcileTerminalState(action: RepairAction, occurredAt: string): RepairExecutionResult {
    const snapshot = this.store.operations.loadTaskSnapshot(action.targetId);
    if (!snapshot.workflow) {
      return {
        action: action.action,
        targetId: action.targetId,
        applied: false,
        detail: "workflow missing",
      };
    }

    if (
      snapshot.workflow.status !== "completed"
      && snapshot.workflow.status !== "failed"
      && snapshot.workflow.status !== "cancelled"
    ) {
      return {
        action: action.action,
        targetId: action.targetId,
        applied: false,
        detail: "workflow not terminal",
      };
    }

    const taskTerminalStatus = snapshot.workflow.status === "completed" ? "done" : snapshot.workflow.status;
    const sessionTerminalStatus = snapshot.workflow.status === "completed" ? "completed" : snapshot.workflow.status;

    let repaired = false;
    this.db.transaction(() => {
      if (snapshot.task.status !== taskTerminalStatus) {
        this.store.task.setTaskState({
          taskId: snapshot.task.id,
          status: taskTerminalStatus,
          updatedAt: occurredAt,
          errorCode: taskTerminalStatus === "failed" ? (snapshot.workflow?.lastErrorCode ?? snapshot.task.errorCode) : null,
          completedAt: occurredAt,
        });
        repaired = true;
      }

      if (snapshot.session && snapshot.session.status !== sessionTerminalStatus) {
        this.store.session.updateSessionStatus(snapshot.session.id, sessionTerminalStatus, occurredAt);
        repaired = true;
      }

      if (repaired) {
        this.store.event.insertEvent({
          id: newId("evt"),
          taskId: snapshot.task.id,
          executionId: snapshot.execution?.id ?? null,
          eventType: "recovery:repair_applied",
          eventTier: "tier_2",
          payloadJson: JSON.stringify({
            repairAction: action.action,
            targetId: action.targetId,
            workflowStatus: snapshot.workflow?.status,
            taskStatus: taskTerminalStatus,
            sessionStatus: snapshot.session ? sessionTerminalStatus : null,
          }),
          traceId: newId("trace"),
          createdAt: occurredAt,
        });
      }
    });

    return {
      action: action.action,
      targetId: action.targetId,
      applied: repaired,
      detail: repaired ? "terminal state reconciled" : "terminal state already consistent",
    };
  }

  /**
   * Closes an orphan session that has no associated active execution.
   * An orphan session is one that was left in a non-terminal state
   * after its execution ended.
   *
   * @param action - The repair action targeting a session
   * @param occurredAt - Timestamp for the operation
   * @returns Result indicating whether session was closed
   */
  private closeOrphanSession(action: RepairAction, occurredAt: string): RepairExecutionResult {
    const session = this.store.dispatch.getSession(action.targetId);
    if (!session) {
      return {
        action: action.action,
        targetId: action.targetId,
        applied: false,
        detail: "session missing",
      };
    }

    this.db.transaction(() => {
      // Mark the orphan session as completed to clean up the state
      this.store.session.updateSessionStatus(session.id, "completed", occurredAt);
      // Emit audit event
      this.store.event.insertEvent({
        id: newId("evt"),
        taskId: session.taskId,
        executionId: null,
        eventType: "recovery:repair_applied",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({
          repairAction: action.action,
          targetId: action.targetId,
        }),
        traceId: newId("trace"),
        createdAt: occurredAt,
      });
    });

    return {
      action: action.action,
      targetId: action.targetId,
      applied: true,
      detail: "orphan session closed",
    };
  }

  private replaceTerminalSession(action: RepairAction, occurredAt: string): RepairExecutionResult {
    const session = this.store.dispatch.getSession(action.targetId);
    if (!session) {
      return {
        action: action.action,
        targetId: action.targetId,
        applied: false,
        detail: "session missing",
      };
    }

    const task = this.store.task.getTask(session.taskId);
    if (!task || !isTaskActiveStatus(task.status)) {
      return {
        action: action.action,
        targetId: action.targetId,
        applied: false,
        detail: "task no longer active",
      };
    }

    const snapshot = this.store.operations.loadTaskSnapshot(session.taskId);
    if (!snapshot.session) {
      return {
        action: action.action,
        targetId: action.targetId,
        applied: false,
        detail: "latest session missing",
      };
    }

    if (snapshot.session.id !== session.id && !isSessionTerminalStatus(snapshot.session.status)) {
      return {
        action: action.action,
        targetId: action.targetId,
        applied: false,
        detail: "replacement session already exists",
      };
    }

    if (!isSessionTerminalStatus(snapshot.session.status)) {
      return {
        action: action.action,
        targetId: action.targetId,
        applied: false,
        detail: "latest session already active",
      };
    }

    const replacementSession = createRecoverySession(snapshot.session, occurredAt);
    this.db.transaction(() => {
      this.store.session.insertSession(replacementSession);
      this.store.event.insertEvent({
        id: newId("evt"),
        taskId: session.taskId,
        executionId: null,
        eventType: "recovery:repair_applied",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({
          repairAction: action.action,
          targetId: action.targetId,
          replacementSessionId: replacementSession.id,
        }),
        traceId: newId("trace"),
        createdAt: occurredAt,
      });
    });

    return {
      action: action.action,
      targetId: action.targetId,
      applied: true,
      detail: `replacement session created: ${replacementSession.id}`,
    };
  }

  /**
   * Releases a stale file lock that was left behind by a crashed worker.
   * File locks prevent concurrent access to resources and must be
   * released when workers crash to avoid resource leaks.
   *
   * @param action - The repair action targeting a file lock
   * @param occurredAt - Timestamp for the operation
   * @returns Result indicating whether lock was released
   */
  private releaseStaleLock(action: RepairAction, occurredAt: string): RepairExecutionResult {
    this.db.transaction(() => {
      // Delete the stale lock from the database
      this.store.lock.deleteFileLock(action.targetId);
      // Emit audit event (no task/execution association for lock events)
      this.store.event.insertEvent({
        id: newId("evt"),
        taskId: null,
        executionId: null,
        eventType: "recovery:repair_applied",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({
          repairAction: action.action,
          targetId: action.targetId,
        }),
        traceId: newId("trace"),
        createdAt: occurredAt,
      });
    });

    return {
      action: action.action,
      targetId: action.targetId,
      applied: true,
      detail: "stale lock released",
    };
  }

  /**
   * Rebuilds missing acknowledgements for tier-1 events. Tier-1 events
   * require explicit acknowledgement from registered consumers. If a
   * consumer crashed before acknowledging, this repair ensures the
   * acknowledgement is pending again so it can be processed.
   *
   * The repair drains the default consumers after rebuilding acks to
   * ensure pending work is processed.
   *
   * @param action - The repair action targeting an event
   * @param occurredAt - Timestamp for the operation
   * @returns Result with before/after pending acknowledgement counts
   */
  private async rebuildAck(action: RepairAction, occurredAt: string): Promise<RepairExecutionResult> {
    const event = this.store.event.getEvent(action.targetId);
    // Only rebuild acks for tier-1 events with registered schemas
    if (event && event.eventTier === "tier_1" && hasEventSchema(event.eventType)) {
      // Re-create pending ack records for all registered consumers
      for (const consumerId of getRegisteredConsumers(event.eventType)) {
        this.store.event.ensureEventConsumerAckPending(event.id, consumerId);
      }
    }

    // Count pending acks before drainage
    const beforePending = this.store.event.countPendingTier1Acks();
    // Trigger consumer drainage to process any newly available acks
    await this.eventOps.drainDefaultConsumers();
    // Count remaining pending acks after drainage
    const afterPending = this.store.event.countPendingTier1Acks();

    // Record the repair with before/after counts for monitoring
    this.db.transaction(() => {
      this.store.event.insertEvent({
        id: newId("evt"),
        taskId: null,
        executionId: null,
        eventType: "recovery:repair_applied",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({
          repairAction: action.action,
          targetId: action.targetId,
          beforePending,
          afterPending,
        }),
        traceId: newId("trace"),
        createdAt: occurredAt,
      });
    });

    return {
      action: action.action,
      targetId: action.targetId,
      // Consider applied if we managed to drain at least some pending acks
      applied: afterPending < beforePending,
      detail: `pending acknowledgements drained from ${beforePending} to ${afterPending}`,
    };
  }
}
