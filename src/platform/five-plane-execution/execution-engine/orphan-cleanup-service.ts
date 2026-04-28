/**
 * @fileoverview Orphan Cleanup Service - Detects and repairs orphaned database records.
 *
 * An "orphan" in this context is a database record that references other records
 * that no longer exist or are in an inconsistent state. Examples:
 * - A session whose task no longer exists
 * - A dispatch ticket claimed by a worker but with no valid active lease
 * - A worker snapshot referencing executions that have terminated or belong to another worker
 *
 * The service operates in two modes:
 * - preview(): Scans for orphans without making changes
 * - enforce(): Scans and applies repair actions
 *
 * Repair actions include closing orphan sessions, requeuing orphan tickets,
 * and cleaning invalid execution references from worker snapshots.
 */

import type { WorkerSnapshotRecord } from "../../contracts/types/domain.js";

import { newId, nowIso } from "../../contracts/types/ids.js";
import { ExecutionDispatchReconciliationService } from "../dispatcher/execution-dispatch-reconciliation-service.js";
import { WorkerRegistryService } from "../worker-pool/worker-registry-service.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

/** Types of orphan issues that can be detected. */
export type OrphanCleanupIssueType = "orphan_session" | "orphan_queue_claim" | "worker_execution_reference_orphan";

/**
 * Represents a worker execution reference that points to an invalid execution.
 *
 * Tracks which execution is referenced, why it's invalid, and the current
 * state of that execution and its lease if any.
 */
export interface WorkerExecutionReferenceOrphan {
  executionId: string;
  taskId: string | null;
  reasonCode: "execution_missing" | "execution_terminal" | "missing_active_lease" | "owned_by_another_worker";
  executionStatus: string | null;
  activeLeaseWorkerId: string | null;
}

/**
 * An issue detected by the orphan cleanup scanner.
 *
 * Describes the type of orphan, which entity is affected, and provides
 * detail about the inconsistency. For worker execution reference orphans,
 * includes the specific orphan references found.
 */
export interface OrphanCleanupIssue {
  issueType: OrphanCleanupIssueType;
  entityType: "session" | "ticket" | "worker";
  entityId: string;
  taskId: string | null;
  executionId: string | null;
  workerId: string | null;
  detail: string;
  orphanExecutionRefs?: WorkerExecutionReferenceOrphan[];
}

/** Result of applying a repair action for an orphan issue. */
export interface OrphanCleanupResult {
  action: "close_orphan_session" | "requeue_ticket" | "clean_worker_execution_refs";
  entityId: string;
  applied: boolean;
  detail: string;
}

/** Report from an orphan cleanup scan and optional enforcement. */
export interface OrphanCleanupReport {
  checkedAt: string;
  issues: OrphanCleanupIssue[];
  applied?: OrphanCleanupResult[];
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

function dedupe<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function isTerminalExecutionStatus(status: string): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled" || status === "superseded";
}

function resolveWorkerStatus(snapshot: WorkerSnapshotRecord, runningExecutionIds: string[]): WorkerSnapshotRecord["status"] {
  switch (snapshot.status) {
    case "unavailable":
    case "quarantined":
    case "offline":
    case "draining":
    case "degraded":
      return snapshot.status;
    default:
      return runningExecutionIds.length > 0 ? "busy" : "idle";
  }
}

/**
 * Service for detecting and repairing orphaned database records.
 *
 * Scans for inconsistencies between related records (sessions, tasks, tickets,
 * workers, executions) and can apply repair actions to resolve the orphans.
 */
export class OrphanCleanupService {
  private readonly dispatchReconciliation: ExecutionDispatchReconciliationService;
  private readonly workers: WorkerRegistryService;

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
  ) {
    this.dispatchReconciliation = new ExecutionDispatchReconciliationService(db, store);
    this.workers = new WorkerRegistryService(store);
  }

  /**
   * Scans for orphan issues without applying repairs.
   *
   * Returns a report listing all detected issues but making no changes.
   * Useful for monitoring and alerting on data consistency problems.
   */
  public preview(checkedAt: string = nowIso()): OrphanCleanupReport {
    return {
      checkedAt,
      issues: this.collectIssues(checkedAt),
    };
  }

  /**
   * Scans for orphan issues and applies repair actions.
   *
   * Returns a report with all detected issues and the results of applying
   * repair actions. Each issue is handled based on its type:
   * - orphan_session: Close the orphan session
   * - orphan_queue_claim: Requeue the orphan ticket
   * - worker_execution_reference_orphan: Clean invalid references from worker
   */
  public enforce(checkedAt: string = nowIso()): OrphanCleanupReport {
    const issues = this.collectIssues(checkedAt);
    const applied: OrphanCleanupResult[] = [];

    for (const issue of issues) {
      switch (issue.issueType) {
        case "orphan_session":
          applied.push(this.closeOrphanSession(issue, checkedAt));
          break;
        case "orphan_queue_claim":
          applied.push(this.requeueOrphanTicket(issue, checkedAt));
          break;
        case "worker_execution_reference_orphan":
          applied.push(this.cleanWorkerExecutionRefs(issue, checkedAt));
          break;
      }
    }

    return {
      checkedAt,
      issues,
      applied,
    };
  }

  /**
   * Collects all orphan issues by scanning different entity types.
   *
   * Scans for orphan sessions, orphan queue claims, and worker execution
   * reference orphans, then returns a combined list.
   */
  private collectIssues(checkedAt: string): OrphanCleanupIssue[] {
    const orphanSessions = this.store.operations.listOrphanSessions().map((record) => ({
      issueType: "orphan_session" as const,
      entityType: "session" as const,
      entityId: record.sessionId,
      taskId: record.taskId,
      executionId: null,
      workerId: null,
      detail: `Session ${record.sessionId} is ${record.sessionStatus} while task ${record.taskId} is ${record.taskStatus}`,
    }));
    const orphanQueueClaims = this.dispatchReconciliation.scan(checkedAt).flatMap((issue) =>
      issue.issueType === "orphan_queue_claim"
        ? [
            {
              issueType: "orphan_queue_claim" as const,
              entityType: "ticket" as const,
              entityId: issue.ticketId,
              taskId: issue.taskId,
              executionId: issue.executionId,
              workerId: null,
              detail: `Dispatch ticket ${issue.ticketId} is claimed without a valid active lease (${issue.reasonCode})`,
            },
          ]
        : [],
    );

    return [...orphanSessions, ...orphanQueueClaims, ...this.scanWorkerExecutionReferenceOrphans()];
  }

  /**
   * Scans worker snapshots for execution references that point to invalid executions.
   *
   * For each worker, checks if the running execution IDs in the snapshot actually
   * correspond to valid, non-terminal executions with active leases owned by this worker.
   * Any invalid references are collected into a single issue.
   */
  private scanWorkerExecutionReferenceOrphans(): OrphanCleanupIssue[] {
    return this.store.worker.listWorkerSnapshots().flatMap((snapshot) => {
      const orphanRefs: WorkerExecutionReferenceOrphan[] = [];

      for (const executionId of parseJsonArray(snapshot.runningExecutionsJson)) {
        const execution = this.store.dispatch.getExecution(executionId);
        if (!execution) {
          orphanRefs.push({
            executionId,
            taskId: null,
            reasonCode: "execution_missing",
            executionStatus: null,
            activeLeaseWorkerId: null,
          });
          continue;
        }

        if (isTerminalExecutionStatus(execution.status)) {
          orphanRefs.push({
            executionId,
            taskId: execution.taskId,
            reasonCode: "execution_terminal",
            executionStatus: execution.status,
            activeLeaseWorkerId: null,
          });
          continue;
        }

        const activeLease = this.store.worker.getActiveExecutionLease(executionId);
        if (!activeLease) {
          orphanRefs.push({
            executionId,
            taskId: execution.taskId,
            reasonCode: "missing_active_lease",
            executionStatus: execution.status,
            activeLeaseWorkerId: null,
          });
          continue;
        }

        if (activeLease.workerId !== snapshot.workerId) {
          orphanRefs.push({
            executionId,
            taskId: execution.taskId,
            reasonCode: "owned_by_another_worker",
            executionStatus: execution.status,
            activeLeaseWorkerId: activeLease.workerId,
          });
        }
      }

      if (orphanRefs.length === 0) {
        return [];
      }

      return [
        {
          issueType: "worker_execution_reference_orphan" as const,
          entityType: "worker" as const,
          entityId: snapshot.workerId,
          taskId: null,
          executionId: null,
          workerId: snapshot.workerId,
          detail: `Worker ${snapshot.workerId} tracks orphan execution references: ${orphanRefs.map((item) => item.executionId).join(", ")}`,
          orphanExecutionRefs: orphanRefs,
        },
      ];
    });
  }

  /**
   * Closes an orphan session by marking it as completed.
   *
   * Only applies if the session is not already in a terminal state.
   * Emits an event to record the cleanup action.
   */
  private closeOrphanSession(issue: OrphanCleanupIssue, occurredAt: string): OrphanCleanupResult {
    const session = this.store.dispatch.getSession(issue.entityId);
    if (!session) {
      return {
        action: "close_orphan_session",
        entityId: issue.entityId,
        applied: false,
        detail: "session missing",
      };
    }

    if (session.status === "completed" || session.status === "failed" || session.status === "cancelled") {
      return {
        action: "close_orphan_session",
        entityId: issue.entityId,
        applied: false,
        detail: "session already terminal",
      };
    }

    this.db.transaction(() => {
      this.store.session.updateSessionStatus(session.id, "completed", occurredAt);
      this.store.event.insertEvent({
        id: newId("evt"),
        taskId: session.taskId,
        executionId: null,
        eventType: "maintenance:orphan_cleanup_applied",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({
          issueType: issue.issueType,
          action: "close_orphan_session",
          sessionId: session.id,
        }),
        traceId: newId("trace"),
        createdAt: occurredAt,
      });
    });

    return {
      action: "close_orphan_session",
      entityId: issue.entityId,
      applied: true,
      detail: "orphan session closed",
    };
  }

  /**
   * Requeues an orphan dispatch ticket using the reconciliation service.
   *
   * The reconciliation service either creates a replacement ticket or
   * invalidates the orphan ticket depending on the issue type.
   */
  private requeueOrphanTicket(issue: OrphanCleanupIssue, occurredAt: string): OrphanCleanupResult {
    const repaired = this.dispatchReconciliation.repairTicket(issue.entityId, occurredAt);
    if (!repaired) {
      return {
        action: "requeue_ticket",
        entityId: issue.entityId,
        applied: false,
        detail: "dispatch ticket already healthy or missing",
      };
    }

    return {
      action: "requeue_ticket",
      entityId: issue.entityId,
      applied: repaired.applied,
      detail:
        repaired.replacementTicketId == null
          ? "dispatch ticket invalidated"
          : `dispatch ticket requeued as ${repaired.replacementTicketId}`,
    };
  }

  /**
   * Cleans invalid execution references from a worker snapshot.
   *
   * Updates the worker's running execution IDs to remove orphan references,
   * recalculates the worker's status, and emits an event recording the cleanup.
   */
  private cleanWorkerExecutionRefs(issue: OrphanCleanupIssue, occurredAt: string): OrphanCleanupResult {
    const snapshot = this.store.worker.getWorkerSnapshot(issue.entityId);
    if (!snapshot) {
      return {
        action: "clean_worker_execution_refs",
        entityId: issue.entityId,
        applied: false,
        detail: "worker snapshot missing",
      };
    }

    const orphanExecutionIds = new Set(issue.orphanExecutionRefs?.map((item) => item.executionId) ?? []);
    const runningExecutionIds = parseJsonArray(snapshot.runningExecutionsJson);
    const nextExecutionIds = runningExecutionIds.filter((executionId) => !orphanExecutionIds.has(executionId));

    if (nextExecutionIds.length === runningExecutionIds.length) {
      return {
        action: "clean_worker_execution_refs",
        entityId: issue.entityId,
        applied: false,
        detail: "worker snapshot already clean",
      };
    }

    this.db.transaction(() => {
      this.workers.recordHeartbeat({
        workerId: snapshot.workerId,
        status: resolveWorkerStatus(snapshot, nextExecutionIds),
        placement: snapshot.placement ?? "local",
        isolationLevel: snapshot.isolationLevel ?? "standard",
        repoVersion: snapshot.repoVersion ?? null,
        remoteSessionStatus: snapshot.remoteSessionStatus ?? null,
        lastAcknowledgedStreamOffset: snapshot.lastAcknowledgedStreamOffset ?? null,
        streamResumeSuccessRate: snapshot.streamResumeSuccessRate ?? null,
        credentialRefreshSuccessRate: snapshot.credentialRefreshSuccessRate ?? null,
        sessionConsistencyCheckStatus: snapshot.sessionConsistencyCheckStatus ?? null,
        sessionConsistencyCheckedAt: snapshot.sessionConsistencyCheckedAt ?? null,
        saturation: snapshot.saturation ?? null,
        activeLeaseCount: nextExecutionIds.length,
        meanStartupLatencyMs: snapshot.meanStartupLatencyMs ?? null,
        sandboxSuccessRate: snapshot.sandboxSuccessRate ?? null,
        repoCacheHitRate: snapshot.repoCacheHitRate ?? null,
        registrationVerifiedAt: snapshot.registrationVerifiedAt ?? null,
        registrationChallengeId: snapshot.registrationChallengeId ?? null,
        capabilities: parseJsonArray(snapshot.capabilitiesJson),
        runningExecutionIds: nextExecutionIds,
        maxConcurrency: snapshot.maxConcurrency,
        queueAffinity: snapshot.queueAffinity,
        runtimeInstanceId: snapshot.runtimeInstanceId,
        restartedFromRuntimeInstanceId: snapshot.restartedFromRuntimeInstanceId,
        cpuPct: snapshot.cpuPct,
        memoryMb: snapshot.memoryMb,
        toolBacklogCount: snapshot.toolBacklogCount,
        currentStepId: nextExecutionIds.length > 0 ? snapshot.currentStepId : null,
        lastProgressAt: snapshot.lastProgressAt,
        occurredAt,
      });
      this.store.event.insertEvent({
        id: newId("evt"),
        taskId: null,
        executionId: null,
        eventType: "maintenance:worker_execution_refs_cleaned",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({
          workerId: snapshot.workerId,
          removedExecutionIds: dedupe(issue.orphanExecutionRefs?.map((item) => item.executionId) ?? []),
          remainingExecutionIds: nextExecutionIds,
        }),
        traceId: newId("trace"),
        createdAt: occurredAt,
      });
    });

    return {
      action: "clean_worker_execution_refs",
      entityId: issue.entityId,
      applied: true,
      detail: `removed orphan execution refs: ${dedupe(issue.orphanExecutionRefs?.map((item) => item.executionId) ?? []).join(", ")}`,
    };
  }
}
