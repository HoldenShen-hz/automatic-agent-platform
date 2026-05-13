/**
 * @fileoverview Execution Priority Preemption Service - Preempts lower-priority executions for urgent work.
 *
 * Provides preemption capability for the priority system: when an urgent dispatch request
 * arrives but no workers have available capacity, this service can reclaim a slot by
 * preempting a lower-priority execution.
 *
 * Preemption works by:
 * 1. Finding a compatible worker with a running execution that can be safely paused
 * 2. Reclaiming the active lease from the preempted execution
 * 3. Creating a replacement ticket so the preempted execution can resume later
 * 4. Recording the preemption in agent execution state for recovery
 *
 * Safety constraints enforced:
 * - Cannot preempt urgent executions (would cause priority inversion)
 * - Cannot preempt executions that are not at a recoverable step
 * - Cannot preempt if the worker or execution state doesn't support safe recovery
 * - Respects isolation levels (strict isolation cannot be preempted for lower levels)
 *
 * @see Execution Lease Service: execution-lease-service.ts
 * @see Worker Registry Service: worker-registry-service.ts
 */

import type {
  AgentExecutionRecord,
  DispatchTarget,
  ExecutionLeaseRecord,
  ExecutionRecord,
  ExecutionTicketRecord,
  TaskPriority,
  TaskRecord,
  WorkerIsolationLevel,
  WorkflowStateRecord,
} from "../../contracts/types/domain.js";

import { newId } from "../../contracts/types/ids.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import { resolveRemoteAuthorityBlockReason } from "../worker-pool/remote-session-guard.js";
import { WorkerRegistryService, type RegisteredWorkerView } from "../worker-pool/worker-registry-service.js";
import { ExecutionLeaseService } from "../lease/execution-lease-service.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

/**
 * Request to preempt for an urgent ticket.
 *
 * Captures the urgent ticket requiring preemption, dispatch requirements,
 * and timing information for the preemption operation.
 */
export interface PriorityPreemptionRequest {
  ticket: ExecutionTicketRecord;
  dispatchTarget: DispatchTarget;
  requiredIsolationLevel: WorkerIsolationLevel;
  requiredRepoVersion: string | null;
  requiredCapabilities: string[];
  preferredWorkerId: string | null;
  includeDegraded: boolean;
  occurredAt: string;
}

/**
 * Trace of a preemption attempt, for observability and debugging.
 *
 * Records which execution was preempted (if any), the replacement ticket
 * created for recovery, and the reason code explaining why preemption
 * did or did not occur.
 */
export interface PriorityPreemptionTrace {
  applied: boolean;
  triggerPriority: TaskPriority;
  preemptedExecutionId: string | null;
  preemptedTaskId: string | null;
  preemptedWorkerId: string | null;
  previousTicketId: string | null;
  replacementTicketId: string | null;
  recoveryStepId: string | null;
  reasonCode: string | null;
}

/** Decision result from a preemption attempt. */
export interface PriorityPreemptionDecision {
  outcome: "preempted" | "not_preempted";
  trace: PriorityPreemptionTrace;
}

/**
 * Internal representation of an execution that is a candidate for preemption.
 *
 * Combines worker, execution, workflow, lease, and agent execution data
 * needed to evaluate preemption safety and perform the preemption.
 */
interface PreemptionCandidate {
  worker: RegisteredWorkerView;
  execution: ExecutionRecord;
  workflow: WorkflowStateRecord;
  task: TaskRecord;
  taskPriority: TaskPriority;
  activeLease: ExecutionLeaseRecord;
  latestTicket: ExecutionTicketRecord | null;
  agentExecution: AgentExecutionRecord | null;
  recoveryStepId: string;
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

/** Maps task priority to a numeric rank for comparison (higher = more urgent). */
function priorityRank(priority: TaskPriority): number {
  switch (priority) {
    case "urgent":
      return 4;
    case "high":
      return 3;
    case "normal":
      return 2;
    default:
      return 1;
  }
}

/** Maps worker isolation level to a numeric rank (higher = more restrictive). */
function isolationRank(level: WorkerIsolationLevel): number {
  switch (level) {
    case "strict":
      return 2;
    case "hardened":
      return 1;
    default:
      return 0;
  }
}

function resolveCandidatePriority(taskPriority: TaskPriority, latestTicket: ExecutionTicketRecord | null): TaskPriority {
  return latestTicket?.priority ?? taskPriority;
}

function isPreemptionTriggerTicket(ticket: ExecutionTicketRecord): boolean {
  return ticket.priority === "urgent";
}

function isRemoteSessionReadyForDispatch(worker: RegisteredWorkerView): boolean {
  return (
    worker.placement !== "remote"
    || (
      worker.remoteSessionStatus === "connected"
      && resolveRemoteAuthorityBlockReason({
        placement: worker.placement,
        remoteSessionStatus: worker.remoteSessionStatus,
        lastAcknowledgedStreamOffset: worker.lastAcknowledgedStreamOffset,
        sessionConsistencyCheckStatus: worker.sessionConsistencyCheckStatus,
        workspaceSyncStatus: worker.workspaceSyncStatus,
      }) == null
    )
  );
}

/**
 * Service that preempts lower-priority executions to make room for urgent work.
 *
 * Used when an urgent dispatch arrives but all workers are at capacity. The service
 * finds the best candidate for preemption based on priority, isolation requirements,
 * and recovery feasibility.
 */
export class ExecutionPriorityPreemptionService {
  private readonly workers: WorkerRegistryService;
  private readonly leases: ExecutionLeaseService;

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
  ) {
    this.workers = new WorkerRegistryService(store);
    this.leases = new ExecutionLeaseService(db, store);
  }

  /**
   * Attempts to preempt a lower-priority execution to make room for an urgent ticket.
   *
   * Returns immediately if the ticket is not urgent or no safe preemption candidate
   * exists. If preemption is possible, reclaims the lease, creates a replacement ticket,
   * updates workflow state for recovery, and emits preemption events.
   */
  public preemptForUrgentTicket(input: PriorityPreemptionRequest): PriorityPreemptionDecision {
    if (!isPreemptionTriggerTicket(input.ticket)) {
      return {
        outcome: "not_preempted",
        trace: this.buildTrace(input.ticket.priority, null, null, "ticket_not_urgent"),
      };
    }

    const candidate = this.selectCandidate(input);
    if (!candidate) {
      return {
        outcome: "not_preempted",
        trace: this.buildTrace(input.ticket.priority, null, null, "no_safe_preemption_candidate"),
      };
    }

    const trace = this.db.transaction(() => {
      const reclaimedLease = this.leases.reclaimActiveLease(
        candidate.execution.id,
        input.occurredAt,
        "priority_preempted",
      );
      if (!reclaimedLease) {
        return this.buildTrace(input.ticket.priority, candidate, null, "preemption_reclaim_failed");
      }

      this.store.execution.updateExecutionStatus(candidate.execution.id, "blocked", input.occurredAt, null, null, null);
      this.store.workflow.updateWorkflowRecoveryState({
        taskId: candidate.execution.taskId,
        status: "paused",
        currentStepIndex: candidate.workflow.currentStepIndex,
        outputsJson: candidate.workflow.outputsJson,
        updatedAt: input.occurredAt,
        resumableFromStep: candidate.recoveryStepId,
        retryCount: candidate.workflow.retryCount,
        lastErrorCode: candidate.workflow.lastErrorCode,
      });
      this.upsertAgentExecutionRecord(candidate, input.occurredAt);

      const replacementTicket = this.createReplacementTicket(candidate, input.occurredAt);
      this.store.event.insertEvent({
        id: newId("evt"),
        taskId: candidate.execution.taskId,
        executionId: candidate.execution.id,
        eventType: "dispatch:ticket_requeued",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({
          previousTicketId: candidate.latestTicket?.id ?? null,
          replacementTicketId: replacementTicket.id,
          reasonCode: "priority_preempted",
          sourceTicketId: input.ticket.id,
          sourcePriority: input.ticket.priority,
        }),
        traceId: candidate.execution.traceId,
        createdAt: input.occurredAt,
        schemaVersion: "1.0",
        aggregateId: null,
        runId: null,
        sequence: null,
        causationId: null,
        correlationId: null,
        payloadHash: null,
        idempotencyKey: newId("idem"),
        replayBehavior: "replay_as_fact",
        principal: "system",
        evidenceRefs: [] as readonly string[],
      });
      this.store.event.insertEvent({
        id: newId("evt"),
        taskId: candidate.execution.taskId,
        executionId: candidate.execution.id,
        eventType: "dispatch:execution_preempted",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({
          sourceTicketId: input.ticket.id,
          sourceExecutionId: input.ticket.executionId,
          sourcePriority: input.ticket.priority,
          preemptedWorkerId: candidate.worker.workerId,
          preemptedExecutionId: candidate.execution.id,
          preemptedPriority: candidate.taskPriority,
          previousTicketId: candidate.latestTicket?.id ?? null,
          replacementTicketId: replacementTicket.id,
          previousLeaseId: reclaimedLease.id,
          recoveryStepId: candidate.recoveryStepId,
        }),
        traceId: candidate.execution.traceId,
        createdAt: input.occurredAt,
        schemaVersion: "1.0",
        aggregateId: null,
        runId: null,
        sequence: null,
        causationId: null,
        correlationId: null,
        payloadHash: null,
        idempotencyKey: newId("idem"),
        replayBehavior: "replay_as_fact",
        principal: "system",
        evidenceRefs: [] as readonly string[],
      });

      return this.buildTrace(input.ticket.priority, candidate, replacementTicket.id, "priority_preemption_applied");
    });

    return {
      outcome: trace.applied ? "preempted" : "not_preempted",
      trace,
    };
  }

  /**
   * Selects the best preemption candidate from available workers.
   *
   * Filters workers to find those compatible with the urgent ticket's requirements,
   * converts them to preemption candidates, and sorts by priority (lowest first)
   * and progress (oldest first) to minimize disruption.
   */
  private selectCandidate(input: PriorityPreemptionRequest): PreemptionCandidate | null {
    const candidates = this.workers
      .listWorkers()
      .filter((worker) => this.isCompatibleFullWorker(worker, input))
      .map((worker) => this.toCandidate(worker, input.ticket.executionId))
      .filter((candidate): candidate is PreemptionCandidate => candidate != null)
      .sort((left, right) => {
        const priorityCompare = priorityRank(left.taskPriority) - priorityRank(right.taskPriority);
        if (priorityCompare !== 0) {
          return priorityCompare;
        }
        const progressCompare = left.activeLease.leasedAt.localeCompare(right.activeLease.leasedAt);
        if (progressCompare !== 0) {
          return progressCompare;
        }
        return left.worker.workerId.localeCompare(right.worker.workerId);
      });

    return candidates[0] ?? null;
  }

  /**
   * Checks if a worker is a compatible candidate for preemption.
   *
   * Validates multiple constraints:
   * - Preferred worker match
   * - Slot availability (must be at capacity)
   * - Dispatch target compatibility (local/remote)
   * - Worker status (not offline, quarantined, etc.)
   * - Remote session readiness (for remote workers)
   * - Queue affinity match
   * - Isolation level meets requirements
   * - Repo version compatibility
   * - Capability requirements
   */
  private isCompatibleFullWorker(worker: RegisteredWorkerView, input: PriorityPreemptionRequest): boolean {
    if (input.preferredWorkerId != null && worker.workerId !== input.preferredWorkerId) {
      return false;
    }
    if (worker.availableSlots > 0) {
      return false;
    }
    if (worker.maxConcurrency !== 1 || worker.runningExecutionIds.length !== 1) {
      return false;
    }
    if (input.dispatchTarget === "local_only" && worker.placement === "remote") {
      return false;
    }
    if (input.dispatchTarget === "require_remote" && worker.placement !== "remote") {
      return false;
    }
    if (worker.status === "unavailable" || worker.status === "quarantined" || worker.status === "offline" || worker.status === "draining") {
      return false;
    }
    if (!input.includeDegraded && worker.status === "degraded") {
      return false;
    }
    if (worker.placement === "remote" && !worker.trusted) {
      return false;
    }
    if (!isRemoteSessionReadyForDispatch(worker)) {
      return false;
    }
    if (input.ticket.queueName && worker.queueAffinity && worker.queueAffinity !== input.ticket.queueName) {
      return false;
    }
    if (isolationRank(worker.isolationLevel) < isolationRank(input.requiredIsolationLevel)) {
      return false;
    }
    if (input.requiredRepoVersion != null && worker.repoVersion !== input.requiredRepoVersion) {
      return false;
    }
    return input.requiredCapabilities.every((capability) => worker.capabilities.includes(capability));
  }

  /**
   * Converts a worker to a preemption candidate if the running execution can be safely preempted.
   *
   * Validates:
   * - Worker has exactly one running execution
   * - Execution is in "executing" status
   * - Workflow is in "running" status
   * - Active lease exists and is held by this worker
   * - Candidate priority is not urgent (cannot preempt urgent)
   * - Workflow has a recovery step
   * - Worker and agent execution are at the recovery step
   */
  private toCandidate(worker: RegisteredWorkerView, sourceExecutionId: string): PreemptionCandidate | null {
    const executionId = worker.runningExecutionIds[0];
    if (!executionId || executionId === sourceExecutionId) {
      return null;
    }

    const execution = this.store.dispatch.getExecution(executionId);
    if (!execution || execution.status !== "executing") {
      return null;
    }

    const task = this.store.task.getTask(execution.taskId);
    const workflow = this.store.workflow.getWorkflowState(execution.taskId);
    const activeLease = this.store.worker.getActiveExecutionLease(execution.id);
    if (!task || !workflow || workflow.status !== "running" || !activeLease || activeLease.workerId !== worker.workerId) {
      return null;
    }

    const latestTicket = this.store.worker.listExecutionTicketsByExecution(execution.id).at(-1) ?? null;
    const candidatePriority = resolveCandidatePriority(task.priority, latestTicket);
    if (candidatePriority === "urgent") {
      return null;
    }

    const agentExecution = this.store.worker.getAgentExecutionRecord(execution.id);
    const recoveryStepId = workflow.resumableFromStep;
    if (!recoveryStepId) {
      return null;
    }
    if (worker.currentStepId != null && worker.currentStepId !== recoveryStepId) {
      return null;
    }
    if (agentExecution?.currentStepId != null && agentExecution.currentStepId !== recoveryStepId) {
      return null;
    }

    return {
      worker,
      execution,
      workflow,
      task,
      taskPriority: candidatePriority,
      activeLease,
      latestTicket,
      agentExecution: agentExecution ?? null,
      recoveryStepId,
    };
  }

  /**
   * Creates a replacement ticket for the preempted execution.
   *
   * The replacement ticket allows the preempted execution to resume later
   * from the recovery step. Inherits requirements from the original ticket
   * but preserves the original execution ID so it can be resumed.
   */
  private createReplacementTicket(candidate: PreemptionCandidate, occurredAt: string): ExecutionTicketRecord {
    const requiredCapabilitiesJson =
      candidate.latestTicket?.requiredCapabilitiesJson
      ?? JSON.stringify([]);
    const ticket: ExecutionTicketRecord = {
      id: newId("ticket"),
      executionId: candidate.execution.id,
      taskId: candidate.execution.taskId,
      tenantId: candidate.task.tenantId ?? "global",
      priority: candidate.latestTicket?.priority ?? candidate.taskPriority,
      queueName: candidate.latestTicket?.queueName ?? null,
      dispatchTarget: candidate.latestTicket?.dispatchTarget ?? "any",
      requiredIsolationLevel: candidate.latestTicket?.requiredIsolationLevel ?? "standard",
      requiredRepoVersion: candidate.latestTicket?.requiredRepoVersion ?? null,
      requiredCapabilitiesJson,
      dispatchAfter: candidate.latestTicket?.dispatchAfter ?? null,
      attempt: candidate.execution.attempt,
      status: "pending",
      assignedWorkerId: null,
      leaseId: null,
      claimedAt: null,
      consumedAt: null,
      invalidatedAt: null,
      createdAt: occurredAt,
      updatedAt: occurredAt,
    };
    this.store.worker.insertExecutionTicket(ticket);
    return ticket;
  }

  /**
   * Updates agent execution record to reflect preemption.
   *
   * Records that the execution was preempted, stores the recovery step ID
   * so execution can resume from the correct point, and preserves execution
   * metadata for the eventual retry.
   */
  private upsertAgentExecutionRecord(candidate: PreemptionCandidate, occurredAt: string): void {
    const existing = candidate.agentExecution;
    const record: AgentExecutionRecord = {
      executionId: candidate.execution.id,
      taskId: candidate.execution.taskId,
      agentId: existing?.agentId ?? candidate.execution.agentId,
      workflowId: candidate.execution.workflowId,
      roleId: candidate.execution.roleId,
      runKind: candidate.execution.runKind,
      runtimeInstanceId: existing?.runtimeInstanceId ?? candidate.worker.runtimeInstanceId,
      restartedFromRuntimeInstanceId:
        existing?.restartedFromRuntimeInstanceId ?? candidate.worker.restartedFromRuntimeInstanceId,
      restartGeneration: existing?.restartGeneration ?? candidate.worker.restartGeneration,
      status: "priority_preempted",
      planJson:
        existing?.planJson
        ?? JSON.stringify({
          workflowId: candidate.execution.workflowId,
          roleId: candidate.execution.roleId,
          runKind: candidate.execution.runKind,
          priority: candidate.taskPriority,
          queueName: candidate.latestTicket?.queueName ?? null,
          dispatchTarget: candidate.latestTicket?.dispatchTarget ?? "any",
          requiredIsolationLevel: candidate.latestTicket?.requiredIsolationLevel ?? "standard",
          requiredRepoVersion: candidate.latestTicket?.requiredRepoVersion ?? null,
          requiredCapabilities: parseJsonArray(candidate.latestTicket?.requiredCapabilitiesJson ?? "[]"),
        }),
      currentStepId: candidate.recoveryStepId,
      lastToolName: existing?.lastToolName ?? null,
      toolCallCount: existing?.toolCallCount ?? 0,
      lastDecisionJson:
        JSON.stringify({
          decision: "priority_preempted",
          workerId: candidate.worker.workerId,
          recoveryStepId: candidate.recoveryStepId,
          previousLeaseId: candidate.activeLease.id,
        }),
      lastErrorCode: existing?.lastErrorCode ?? null,
      retryCount: existing?.retryCount ?? Math.max(candidate.execution.attempt - 1, 0),
      progressMessage: `preempted by urgent dispatch at ${candidate.recoveryStepId}`,
      startedAt: existing?.startedAt ?? candidate.execution.startedAt ?? candidate.execution.createdAt,
      createdAt: existing?.createdAt ?? occurredAt,
      updatedAt: occurredAt,
      completedAt: null,
    };
    this.store.worker.upsertAgentExecutionRecord(record);
  }

  private buildTrace(
    triggerPriority: TaskPriority,
    candidate: PreemptionCandidate | null,
    replacementTicketId: string | null,
    reasonCode: string,
  ): PriorityPreemptionTrace {
    return {
      applied: reasonCode === "priority_preemption_applied",
      triggerPriority,
      preemptedExecutionId: candidate?.execution.id ?? null,
      preemptedTaskId: candidate?.execution.taskId ?? null,
      preemptedWorkerId: candidate?.worker.workerId ?? null,
      previousTicketId: candidate?.latestTicket?.id ?? null,
      replacementTicketId,
      recoveryStepId: candidate?.recoveryStepId ?? null,
      reasonCode,
    };
  }
}
