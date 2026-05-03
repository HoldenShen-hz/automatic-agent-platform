
import type {
  AgentExecutionRecord,
  DispatchTarget,
  DispatchDecisionTrace,
  DispatchWorkerEvaluation,
  DispatchWorkerRejectionReason,
  ExecutionTicketRecord,
  RemoteAvailability,
  TaskPriority,
  WorkerIsolationLevel,
} from "../../contracts/types/domain.js";

import { newId, nowIso } from "../../contracts/types/ids.js";
import { HealthService } from "../../shared/observability/health-service.js";
import { DeadLetterQueueService } from "../../state-evidence/dlq/index.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import { SqliteDeadLetterQueueRepository } from "../../state-evidence/truth/sqlite/repositories/dlq-repository.js";
import type { AdmissionBackpressureSnapshot } from "./admission-controller.js";
import { ExecutionLeaseService } from "../lease/execution-lease-service.js";
import { ExecutionPriorityPreemptionService } from "./execution-priority-preemption-service.js";
import {
  computeEffectiveActiveLeaseCount,
  computeWorkerLoadScore,
  summarizeWorkerLoadSkew,
} from "../worker-pool/worker-load-balancing.js";
import { WorkerRegistryService, type RegisteredWorkerView } from "../worker-pool/worker-registry-service.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { StorageError, AppError } from "../../contracts/errors.js";
import {
  AFFINITY_SELECTION_BONUS,
  buildDispatchAgentExecutionRecord,
  DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS,
  isElevatedPriority,
  isRemoteSessionReadyForDispatch,
  LOAD_SKEW_SELECTION_PENALTY,
  meetsIsolationRequirement,
  normalizeStringArray,
  parseJsonArray,
  resolveDispatchTarget,
  resolveDispatchBackpressureReason,
  resolveRemoteAvailability,
  resolveRemoteRepoVersionReason,
  resolveRemoteSessionReason,
  resolveRemoteTrustReason,
  resolveRequiredIsolationLevel,
  resolveRequiredRepoVersion,
  selectWorkersForDispatch,
  toWorkerEvaluation,
  type CreateExecutionTicketInput,
  type DispatchExecutionDecision,
  type DispatchExecutionOptions,
  type DispatchQueueAvailabilitySnapshot,
  type ExecutionTicketDecision,
} from "./execution-dispatch-support.js";
import { HorizontalScalingController, DEFAULT_SCALING_POLICY } from "../../shared/scaling/horizontal-scaling-controller.js";
import { nowIso as nowDate } from "../../contracts/types/ids.js";
import type { HealthReportProvider } from "../../contracts/types/health.js";

const logger = new StructuredLogger({ retentionLimit: 100 });
const DISPATCH_ORDERING_POLICY_VERSION = "dispatch.partial-deterministic.v2";
const DISPATCH_DLQ_CONSUMER_ID = "execution_dispatch_service";

type DispatchDeadLetterQueue = Pick<DeadLetterQueueService, "enqueue">;

/**
 * Error thrown when lease acquisition fails during dispatch.
 * Used internally to break out of the dispatch transaction and continue to next ticket.
 */
class DispatchLeaseBlockedError extends Error {
  public readonly reasonCode: string | null;
  public readonly leaseId: string | null;
  constructor(reasonCode: string | null, leaseId: string | null) {
    super(`Lease blocked: ${reasonCode}`);
    this.name = "DispatchLeaseBlockedError";
    this.reasonCode = reasonCode;
    this.leaseId = leaseId;
  }
}

export type {
  CreateExecutionTicketInput,
  DispatchExecutionDecision,
  DispatchExecutionOptions,
  DispatchQueueAvailabilitySnapshot,
  ExecutionTicketDecision,
} from "./execution-dispatch-support.js";

export class ExecutionDispatchService {
  private readonly leases: ExecutionLeaseService;
  private readonly preemption: ExecutionPriorityPreemptionService;
  private readonly workers: WorkerRegistryService;
  private cachedHealthService: HealthService | null = null;
  private readonly scalingController: HorizontalScalingController;
  private readonly dispatchDeadLetterQueue: DispatchDeadLetterQueue | null;
  // R9-5: §14.2 poison-pill detection - max time a ticket can wait before being considered abandoned
  private readonly maxQueueAgeMs: number;
  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
    private readonly backpressureSnapshot: (() => AdmissionBackpressureSnapshot | null) | null = null,
    private readonly queueAvailabilitySnapshot: (() => DispatchQueueAvailabilitySnapshot | null) | null = null,
    private readonly healthReportProvider: HealthReportProvider | null = null,
    dispatchDeadLetterQueue: DispatchDeadLetterQueue | null = null,
    maxQueueAgeMs: number = 3600000,
  ) {
    this.leases = new ExecutionLeaseService(db, store);
    this.preemption = new ExecutionPriorityPreemptionService(db, store);
    this.workers = new WorkerRegistryService(store);
    this.scalingController = new HorizontalScalingController("default", DEFAULT_SCALING_POLICY);
    this.dispatchDeadLetterQueue = dispatchDeadLetterQueue ?? this.createDispatchDeadLetterQueue();
    this.maxQueueAgeMs = maxQueueAgeMs;
  }

  private getOrCreateHealthService(occurredAt: string): HealthService {
    if (this.cachedHealthService === null) {
      this.cachedHealthService = new HealthService(this.db, this.store, {
        ...DEFAULT_RUNTIME_BACKPRESSURE_HEALTH_OPTIONS,
        nowMsSupplier: () => Date.parse(occurredAt),
      });
    }
    return this.cachedHealthService;
  }

  /**
   * Returns the backpressure snapshot, using healthReportProvider if available.
   * This avoids P4 directly instantiating HealthService with P5 internals.
   */
  private getBackpressureSnapshot(): { status: string; degradationMode: string; queueGovernance: { starvationDetected: boolean }; findings: string[] } | null {
    const snapshot = this.backpressureSnapshot?.();
    if (snapshot) return snapshot;
    if (this.healthReportProvider) {
      const report = this.healthReportProvider.getReport();
      return {
        status: report.status,
        degradationMode: report.degradationMode,
        queueGovernance: { starvationDetected: report.queueGovernance.starvationDetected },
        findings: [...report.findings],
      };
    }
    return null;
  }

  private createDispatchDeadLetterQueue(): DispatchDeadLetterQueue | null {
    if (this.db.backendType !== "sqlite") {
      return null;
    }
    return new DeadLetterQueueService(new SqliteDeadLetterQueueRepository(this.db.connection));
  }

  private buildWorkerPoolSnapshotRef(
    ticket: ExecutionTicketRecord,
    occurredAt: string,
    selectedWorkerId: string | null,
  ): string {
    if (selectedWorkerId != null) {
      return `worker_pool://${selectedWorkerId}/snapshot/${occurredAt}`;
    }
    return `worker_pool://dispatch/${ticket.queueName ?? "default"}/snapshot/${occurredAt}`;
  }

  private buildSchedulerTraceFields(
    ticket: ExecutionTicketRecord,
    occurredAt: string,
    readySet: readonly string[],
    selectedNodeIds: readonly string[],
    selectedWorkerId: string | null,
  ): Pick<DispatchDecisionTrace, "readySet" | "selectedNodeIds" | "orderingPolicyVersion" | "workerPoolSnapshotRef"> {
    return {
      readySet,
      selectedNodeIds,
      orderingPolicyVersion: DISPATCH_ORDERING_POLICY_VERSION,
      workerPoolSnapshotRef: this.buildWorkerPoolSnapshotRef(ticket, occurredAt, selectedWorkerId),
    };
  }

  private isBackpressureBlockedReason(reasonCode: string | null): boolean {
    return reasonCode === "queue_unavailable" || (reasonCode != null && reasonCode.startsWith("backpressure."));
  }

  private recordBlockedDispatchArtifacts(
    ticket: ExecutionTicketRecord,
    occurredAt: string,
    trace: DispatchDecisionTrace,
    failureCategory: string,
  ): void {
    if (this.isBackpressureBlockedReason(trace.reasonCode)) {
      this.store.event.insertEvent({
        id: newId("evt"),
        taskId: ticket.taskId,
        executionId: ticket.executionId,
        eventType: "dispatch.backpressure_rejected",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({
          ticketId: ticket.id,
          priority: ticket.priority,
          reasonCode: trace.reasonCode,
          readySet: trace.readySet ?? [],
          selectedNodeIds: trace.selectedNodeIds ?? [],
          orderingPolicyVersion: trace.orderingPolicyVersion ?? null,
          workerPoolSnapshotRef: trace.workerPoolSnapshotRef ?? null,
        }),
        traceId: null,
        createdAt: occurredAt,
      });
    }

    if (this.dispatchDeadLetterQueue == null) {
      return;
    }

    const deadLetter = this.dispatchDeadLetterQueue.enqueue({
      sourceEventId: `dispatch:${ticket.id}:${trace.reasonCode ?? trace.outcome}`,
      consumerId: DISPATCH_DLQ_CONSUMER_ID,
      errorCode: trace.reasonCode ?? "dispatch.blocked",
      payloadJson: JSON.stringify({
        ticketId: ticket.id,
        executionId: ticket.executionId,
        taskId: ticket.taskId,
        priority: ticket.priority,
        queueName: ticket.queueName,
        trace,
      }),
      originalTimestamp: occurredAt,
      failureCategory,
    });

    this.store.event.insertEvent({
      id: newId("evt"),
      taskId: ticket.taskId,
      executionId: ticket.executionId,
      eventType: "dispatch.dlq_enqueue",
      eventTier: "tier_2",
      payloadJson: JSON.stringify({
        ticketId: ticket.id,
        executionId: ticket.executionId,
        deadLetterId: deadLetter.deadLetterId,
        consumerId: DISPATCH_DLQ_CONSUMER_ID,
        reasonCode: trace.reasonCode,
        failureCategory,
      }),
      traceId: null,
      createdAt: occurredAt,
    });
  }
  public createTicket(input: CreateExecutionTicketInput): ExecutionTicketDecision {
    const occurredAt = input.occurredAt ?? nowIso();

    return this.db.transaction(() => {
      const view = this.store.operations.loadExecutionAuthoritativeView(input.executionId);
      if (!view) {
        throw new StorageError("storage.execution_not_found", `Execution not found: ${input.executionId}`, {
          details: { executionId: input.executionId },
          executionId: input.executionId,
        });
      }
      const { execution, task } = view;

      const existing = this.store.worker.getActiveExecutionTicket(input.executionId, execution.attempt);
      if (existing) {
        return {
          outcome: "exists",
          ticket: existing,
        };
      }

      if (!task) {
        throw new StorageError("storage.task_not_found", `Task not found: ${execution.taskId}`, {
          details: { taskId: execution.taskId },
          taskId: execution.taskId,
        });
      }

      const ticket: ExecutionTicketRecord = {
        id: newId("ticket"),
        executionId: execution.id,
        taskId: execution.taskId,
        priority: input.priority ?? task.priority,
        queueName: input.queueName ?? null,
        dispatchTarget: resolveDispatchTarget(input.dispatchTarget),
        requiredIsolationLevel: resolveRequiredIsolationLevel(input.requiredIsolationLevel),
        requiredRepoVersion: resolveRequiredRepoVersion(input.requiredRepoVersion),
        requiredCapabilitiesJson: JSON.stringify(normalizeStringArray(input.requiredCapabilities ?? [])),
        dispatchAfter: input.dispatchAfter ?? null,
        attempt: execution.attempt,
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
      this.upsertAgentExecutionRecord(execution, occurredAt, {
        taskId: task.id,
        status: "ticket_pending",
          planJson: JSON.stringify({
            workflowId: execution.workflowId,
            roleId: execution.roleId,
            runKind: execution.runKind,
            priority: input.priority ?? task.priority,
            queueName: ticket.queueName,
            dispatchTarget: ticket.dispatchTarget ?? "any",
            requiredIsolationLevel: ticket.requiredIsolationLevel ?? "standard",
            requiredRepoVersion: ticket.requiredRepoVersion ?? null,
            requiredCapabilities: parseJsonArray(ticket.requiredCapabilitiesJson),
            dispatchAfter: ticket.dispatchAfter,
          }),
        progressMessage: "execution ticket created",
      });
      this.store.event.insertEvent({
        id: newId("evt"),
        taskId: ticket.taskId,
        executionId: ticket.executionId,
        eventType: "dispatch:ticket_created",
        eventTier: "tier_2",
          payloadJson: JSON.stringify({
            ticketId: ticket.id,
            queueName: ticket.queueName,
            dispatchTarget: ticket.dispatchTarget ?? "any",
            requiredIsolationLevel: ticket.requiredIsolationLevel ?? "standard",
            requiredRepoVersion: ticket.requiredRepoVersion ?? null,
            attempt: ticket.attempt,
            priority: ticket.priority,
            requiredCapabilities: parseJsonArray(ticket.requiredCapabilitiesJson),
        }),
        traceId: execution.traceId,
        createdAt: occurredAt,
      });

      return {
        outcome: "created",
        ticket,
      };
    });
  }
  public dispatchNext(options: DispatchExecutionOptions): DispatchExecutionDecision {
    const occurredAt = options.occurredAt ?? nowIso();
    const tickets = this.store.worker.listDispatchableExecutionTickets(occurredAt, options.queueName ?? null);

    // R6-7: Capture ready_set for scheduler event (all pending tickets considered)
    const readySet = tickets.map((t) => t.id);

    if (tickets.length === 0) {
      return {
        outcome: "no_ticket",
        reasonCode: null,
        ticket: null,
        worker: null,
        leaseId: null,
        trace: null,
      };
    }

    if (this.queueAvailabilitySnapshot?.()?.state === "unavailable") {
      const queueAvailability = this.queueAvailabilitySnapshot?.()!;
      const ticket = tickets[0] ?? null;
      const reasonCode = queueAvailability.reasonCode?.trim() || "queue_unavailable";
      const trace =
        ticket == null
          ? null
          : this.recordDecisionEvent(ticket, occurredAt, {
              dispatchTarget: resolveDispatchTarget(ticket.dispatchTarget),
              remoteAvailability: null,
              requiredIsolationLevel: resolveRequiredIsolationLevel(ticket.requiredIsolationLevel),
              requiredRepoVersion: resolveRequiredRepoVersion(ticket.requiredRepoVersion),
              preferredWorkerId: options.preferredWorkerId ?? null,
              requiredCapabilities: parseJsonArray(ticket.requiredCapabilitiesJson),
              outcome: "blocked",
              reasonCode,
              selectedWorkerId: null,
              leaseId: null,
              fallbackApplied: false,
              evaluations: [],
              ...this.buildSchedulerTraceFields(ticket, occurredAt, readySet, [], null),
            });
      if (ticket != null && trace != null) {
        this.recordBlockedDispatchArtifacts(ticket, occurredAt, trace, "queue_availability");
      }

      return {
        outcome: "blocked",
        reasonCode,
        ticket,
        worker: null,
        leaseId: null,
        trace,
      };
    }

    // R9-10 fix: Compute backpressure once outside ticket loop (was O(n) health scans per ticket)
    const backpressure = this.getBackpressureSnapshot();

    // R13-18: §8.1 Queue backlog > threshold → emit scale_up/scale_down signals
    const queueAvailability = this.queueAvailabilitySnapshot?.();
    const pendingTickets = tickets.length;
    const activeWorkers = this.workers.listWorkers().filter((w) => w.status !== "offline" && w.status !== "unavailable").length;
    const busyWorkers = this.workers.listWorkers().filter((w) => w.status === "busy").length;
    const utilizationPercent = activeWorkers > 0 ? (busyWorkers / activeWorkers) * 100 : 0;
    const scaleEvent = this.scalingController.processMetrics(
      {
        queueName: options.queueName ?? "default",
        waiting: pendingTickets,
        delayed: 0,
        active: busyWorkers,
        completed: 0,
        failed: 0,
        deadLetter: 0,
      },
      {
        activeWorkers,
        busyWorkers,
        utilizationPercent,
        queueDepth: pendingTickets,
        avgLatencyMs: 0,
      },
    );
    if (scaleEvent) {
      this.store.event.insertEvent({
        id: newId("evt"),
        taskId: null,
        executionId: null,
        eventType: `worker_pool:${scaleEvent.eventType}`,
        eventTier: "tier_2",
        payloadJson: JSON.stringify({
          workerPool: scaleEvent.workerPool,
          action: scaleEvent.action,
          cooldownRemainingMs: scaleEvent.cooldownRemainingMs,
        }),
        traceId: null,
        createdAt: occurredAt,
      });
    }

    let blockedReason: string | null = null;
    let lastTrace: DispatchDecisionTrace | null = null;

    for (const ticket of tickets) {
      const dispatchTarget = resolveDispatchTarget(ticket.dispatchTarget);
      const requiredIsolationLevel = resolveRequiredIsolationLevel(ticket.requiredIsolationLevel);
      const requiredRepoVersion = resolveRequiredRepoVersion(ticket.requiredRepoVersion);
      const blockedByBackpressure = resolveDispatchBackpressureReason(ticket, backpressure);

      // R9-5: §14.2 poison-pill detection - detect abandoned tickets that have been queued too long
      const ticketCreatedAt = ticket.createdAt;
      const ticketAgeMs = Date.parse(occurredAt) - Date.parse(ticketCreatedAt);
      if (ticketAgeMs > this.maxQueueAgeMs) {
        const poisonPillReason = "dispatch.poison_pill_detected";
        const trace = this.recordDecisionEvent(ticket, occurredAt, {
          dispatchTarget,
          remoteAvailability: null,
          requiredIsolationLevel,
          requiredRepoVersion,
          preferredWorkerId: options.preferredWorkerId ?? null,
          requiredCapabilities: parseJsonArray(ticket.requiredCapabilitiesJson),
          outcome: "blocked",
          reasonCode: poisonPillReason,
          selectedWorkerId: null,
          leaseId: null,
          fallbackApplied: false,
          evaluations: [],
          ...this.buildSchedulerTraceFields(ticket, occurredAt, readySet, [], null),
        });
        // Invalidate the poison-pill ticket and fail the associated execution
        this.store.worker.invalidateExecutionTicket({
          ticketId: ticket.id,
          status: "cancelled",
          invalidatedAt: occurredAt,
        });
        // Transition execution to failed status with poison-pill reason
        this.store.execution.updateExecutionStatus(
          ticket.executionId,
          "failed",
          "dispatch.poison_pill_abandoned",
          occurredAt,
        );
        this.store.event.insertEvent({
          id: newId("evt"),
          taskId: ticket.taskId,
          executionId: ticket.executionId,
          eventType: "dispatch:poison_pill_detected",
          eventTier: "tier_2",
          payloadJson: JSON.stringify({
            ticketId: ticket.id,
            executionId: ticket.executionId,
            queueName: ticket.queueName,
            priority: ticket.priority,
            queueAgeMs: ticketAgeMs,
            maxQueueAgeMs: this.maxQueueAgeMs,
          }),
          traceId: null,
          createdAt: occurredAt,
        });
        this.recordBlockedDispatchArtifacts(ticket, occurredAt, trace, "poison_pill");
        lastTrace = trace;
        continue;
      }

      if (blockedByBackpressure) {
        blockedReason = blockedByBackpressure;
        const trace = this.recordDecisionEvent(ticket, occurredAt, {
          dispatchTarget,
          remoteAvailability: null,
          requiredIsolationLevel,
          requiredRepoVersion,
          preferredWorkerId: options.preferredWorkerId ?? null,
          requiredCapabilities: parseJsonArray(ticket.requiredCapabilitiesJson),
          outcome: "blocked",
          reasonCode: blockedByBackpressure,
          selectedWorkerId: null,
          leaseId: null,
          fallbackApplied: false,
          evaluations: [],
          ...this.buildSchedulerTraceFields(ticket, occurredAt, readySet, [], null),
        });
        this.recordBlockedDispatchArtifacts(ticket, occurredAt, trace, "dispatch_backpressure");
        lastTrace = trace;
        continue;
      }

      const requiredCapabilities = parseJsonArray(ticket.requiredCapabilitiesJson);
      let evaluations = this.evaluateWorkersForTicket(
        ticket,
        options,
        requiredCapabilities,
        requiredIsolationLevel,
        requiredRepoVersion,
      );
      let remoteAvailability = resolveRemoteAvailability(dispatchTarget, evaluations);
      let remoteRepoVersionReason = resolveRemoteRepoVersionReason(
        dispatchTarget,
        evaluations,
        requiredRepoVersion,
      );
      let remoteTrustReason = resolveRemoteTrustReason(dispatchTarget, evaluations);
      let remoteSessionReason = resolveRemoteSessionReason(dispatchTarget, evaluations);
      let selection = this.selectWorkersForDispatch(
        ticket,
        dispatchTarget,
        evaluations,
        remoteAvailability,
        remoteTrustReason,
        remoteSessionReason,
        remoteRepoVersionReason,
      );
      let eligibleWorkers = selection.workers;
      let preemptionTrace: DispatchDecisionTrace["preemption"] = null;
      // Issue #1908 P1: Preemption should trigger for high and critical priorities,
      // not just critical. Previously only checked ticket.priority === "critical".
      if (eligibleWorkers.length === 0 && isElevatedPriority(ticket.priority)) {
        const preemption = this.preemption.preemptForUrgentTicket({
          ticket,
          dispatchTarget,
          requiredIsolationLevel,
          requiredRepoVersion,
          requiredCapabilities,
          preferredWorkerId: options.preferredWorkerId ?? null,
          includeDegraded: options.includeDegraded ?? false,
          occurredAt,
        });
        if (preemption.trace.applied) {
          evaluations = this.evaluateWorkersForTicket(
            ticket,
            options,
            requiredCapabilities,
            requiredIsolationLevel,
            requiredRepoVersion,
          );
          remoteAvailability = resolveRemoteAvailability(dispatchTarget, evaluations);
          remoteRepoVersionReason = resolveRemoteRepoVersionReason(
            dispatchTarget,
            evaluations,
            requiredRepoVersion,
          );
          remoteTrustReason = resolveRemoteTrustReason(dispatchTarget, evaluations);
          remoteSessionReason = resolveRemoteSessionReason(dispatchTarget, evaluations);
          selection = this.selectWorkersForDispatch(
            ticket,
            dispatchTarget,
            evaluations,
            remoteAvailability,
            remoteTrustReason,
            remoteSessionReason,
            remoteRepoVersionReason,
          );
          eligibleWorkers = selection.workers;
          preemptionTrace = preemption.trace;
        }
      }
      if (eligibleWorkers.length === 0) {
        // R6-5: Emergency lane for critical priority NodeRuns
        if (ticket.priority === "critical") {
          // Critical NodeRun needs independent channel - try emergency worker pool
          const emergencyWorkers = this.workers.listWorkers().filter(
            (w) => w.status === "idle" && w.placement === "local" && w.availableSlots > 0,
          );
          if (emergencyWorkers.length > 0) {
            const emergencyWorker = emergencyWorkers[0]!;
            const lease = this.leases.acquireLease({
              executionId: ticket.executionId,
              workerId: emergencyWorker.workerId,
              ttlMs: options.leaseTtlMs,
              queueName: "emergency_lane",
              occurredAt,
            });
            if (lease.outcome === "granted" && lease.lease) {
              // Dispatch via emergency lane
              // Note: Do NOT wrap in a transaction - acquireLease already opened one
              // and SQLite does not support nested transactions/SAVEPOINT
              this.store.worker.claimExecutionTicket({
                ticketId: ticket.id,
                assignedWorkerId: emergencyWorker.workerId,
                leaseId: lease.lease.id,
                claimedAt: occurredAt,
              });
              this.store.event.insertEvent({
                id: newId("evt"),
                taskId: ticket.taskId,
                executionId: ticket.executionId,
                eventType: "dispatch.emergency_lane_used",
                eventTier: "tier_2",
                payloadJson: JSON.stringify({
                  ticketId: ticket.id,
                  workerId: emergencyWorker.workerId,
                  leaseId: lease.lease.id,
                }),
                traceId: null,
                createdAt: occurredAt,
              });
              return {
                outcome: "dispatched",
                reasonCode: "dispatch.emergency_lane",
                ticket: this.store.worker.getExecutionTicket(ticket.id) ?? null,
                worker: emergencyWorker,
                leaseId: lease.lease.id,
                trace: this.recordDecisionEvent(ticket, occurredAt, {
                  dispatchTarget,
                  remoteAvailability: null,
                  requiredIsolationLevel,
                  requiredRepoVersion,
                  preferredWorkerId: options.preferredWorkerId ?? null,
                  requiredCapabilities,
                  outcome: "dispatched",
                  reasonCode: "dispatch.emergency_lane",
                  selectedWorkerId: emergencyWorker.workerId,
                  leaseId: lease.lease.id,
                  fallbackApplied: true,
                  preemption: preemptionTrace,
                  evaluations,
                  ...this.buildSchedulerTraceFields(
                    ticket,
                    occurredAt,
                    readySet,
                    [ticket.executionId],
                    emergencyWorker.workerId,
                  ),
                }),
              };
            }
          }
          blockedReason = "dispatch.no_emergency_worker_available";
        }

        const remoteBlockReason =
          dispatchTarget === "require_remote"
            ? remoteTrustReason
              ?? remoteSessionReason
              ?? remoteRepoVersionReason
              ?? (
                remoteAvailability === "unavailable"
                  ? "remote.unavailable"
                  : remoteAvailability === "degraded"
                    ? "remote.degraded"
                    : remoteAvailability === "partial_available"
                      ? "remote.partial_available"
                    : null
              )
            : null;
        if (remoteBlockReason) {
          blockedReason = remoteBlockReason;
        }
        const trace = this.recordDecisionEvent(ticket, occurredAt, {
          dispatchTarget,
          remoteAvailability,
          requiredIsolationLevel,
          requiredRepoVersion,
          preferredWorkerId: options.preferredWorkerId ?? null,
          requiredCapabilities,
          outcome: blockedReason ? "blocked" : "no_worker",
          reasonCode: blockedReason,
          selectedWorkerId: null,
          leaseId: null,
          fallbackApplied: false,
          preemption: preemptionTrace,
          evaluations,
          ...this.buildSchedulerTraceFields(ticket, occurredAt, readySet, [], null),
        });
        if (trace.outcome === "blocked") {
          this.recordBlockedDispatchArtifacts(ticket, occurredAt, trace, "worker_selection_blocked");
        }
        lastTrace = trace;
        continue;
      }

      const selectedWorker = this.selectDeterministicWorker(eligibleWorkers, evaluations);

      // Issue #1900 P1: Move lease acquisition inside transaction to ensure atomic
      // lease+claim. Previously lease was acquired outside (TOCTOU race), now we
      // acquire and claim within the same transaction using savepoints for safety.
      const dispatchResult = this.db.transaction(() => {
        const lease = this.leases.acquireLease({
          executionId: ticket.executionId,
          workerId: selectedWorker.workerId,
          ttlMs: options.leaseTtlMs,
          queueName: ticket.queueName,
          occurredAt,
        });

        if (lease.outcome !== "granted" || !lease.lease) {
          throw new DispatchLeaseBlockedError(lease.reasonCode, null);
        }

        this.store.worker.claimExecutionTicket({
          ticketId: ticket.id,
          assignedWorkerId: selectedWorker.workerId,
          leaseId: lease.lease.id,
          claimedAt: occurredAt,
        });
        const workerSnapshot = this.store.worker.getWorkerSnapshot(selectedWorker.workerId);
        if (workerSnapshot) {
          const runningExecutionIds = new Set(parseJsonArray(workerSnapshot.runningExecutionsJson));
          runningExecutionIds.add(ticket.executionId);
          // Issue #1905 P1: activeLeaseCount should be the actual count, not Math.max.
          // Using Math.max never decreases the count when executions complete.
          // Fixed to use runningExecutionIds.size which accurately reflects current load.
          this.store.worker.upsertWorkerSnapshot({
            ...workerSnapshot,
            status: "busy",
            activeLeaseCount: runningExecutionIds.size,
            runningExecutionsJson: JSON.stringify([...runningExecutionIds].sort()),
            updatedAt: occurredAt,
          });
        }
        const execution = this.store.dispatch.getExecution(ticket.executionId);
        this.store.event.insertEvent({
          id: newId("evt"),
          taskId: ticket.taskId,
          executionId: ticket.executionId,
          eventType: "dispatch:ticket_claimed",
          eventTier: "tier_2",
          payloadJson: JSON.stringify({
            ticketId: ticket.id,
            workerId: selectedWorker.workerId,
            leaseId: lease.lease.id,
            queueName: ticket.queueName,
            dispatchTarget,
            remoteAvailability,
            requiredIsolationLevel,
            requiredRepoVersion,
            fallbackApplied: selection.fallbackApplied,
            requiredCapabilities: parseJsonArray(ticket.requiredCapabilitiesJson),
          }),
          traceId: execution?.traceId ?? null,
          createdAt: occurredAt,
        });

        return { lease, execution };
      });

      const trace = this.recordDecisionEvent(ticket, occurredAt, {
        dispatchTarget,
        remoteAvailability,
        requiredIsolationLevel,
        requiredRepoVersion,
        preferredWorkerId: options.preferredWorkerId ?? null,
        requiredCapabilities,
        outcome: "dispatched",
        reasonCode: selection.reasonCode,
        selectedWorkerId: selectedWorker.workerId,
        leaseId: dispatchResult.lease.lease!.id,
        fallbackApplied: selection.fallbackApplied,
        preemption: preemptionTrace,
        evaluations,
        ...this.buildSchedulerTraceFields(
          ticket,
          occurredAt,
          readySet,
          [ticket.executionId],
          selectedWorker.workerId,
        ),
      });

      return {
        outcome: "dispatched",
        reasonCode: selection.reasonCode,
        ticket: this.store.worker.getExecutionTicket(ticket.id) ?? null,
        worker: selectedWorker,
        leaseId: dispatchResult.lease.lease!.id,
        trace,
      };
    }

    return {
      outcome: blockedReason ? "blocked" : "no_worker",
      reasonCode: blockedReason,
      ticket: tickets[0] ?? null,
      worker: null,
      leaseId: null,
      trace: lastTrace,
    };
  }
  private evaluateWorkersForTicket(
    ticket: ExecutionTicketRecord,
    options: DispatchExecutionOptions,
    requiredCapabilities: string[],
    requiredIsolationLevel: WorkerIsolationLevel,
    requiredRepoVersion: string | null,
  ): DispatchWorkerEvaluation[] {
    const queueAffinity = ticket.queueName ?? null;
    const dispatchTarget = resolveDispatchTarget(ticket.dispatchTarget);

    const candidates =
      options.preferredWorkerId == null
        ? this.workers.listWorkers()
        : [this.workers.getWorker(options.preferredWorkerId)].filter((worker): worker is RegisteredWorkerView => worker != null);

    return candidates.map((worker) => {
        if (dispatchTarget === "local_only" && worker.placement === "remote") {
          return this.toWorkerEvaluation(worker, false, "worker_placement_mismatch", []);
        }
        if (dispatchTarget === "require_remote" && worker.placement !== "remote") {
          return this.toWorkerEvaluation(worker, false, "worker_placement_mismatch", []);
        }
        if (worker.status === "unavailable") {
          return this.toWorkerEvaluation(worker, false, "worker_unavailable", []);
        }
        if (worker.status === "quarantined") {
          return this.toWorkerEvaluation(worker, false, "worker_quarantined", []);
        }
        if (worker.status === "offline") {
          return this.toWorkerEvaluation(worker, false, "worker_offline", []);
        }
        if (worker.status === "draining") {
          return this.toWorkerEvaluation(worker, false, "worker_draining", []);
        }
        if (worker.placement === "remote" && !worker.trusted) {
          return this.toWorkerEvaluation(worker, false, "worker_untrusted", []);
        }
        if (!options.includeDegraded && worker.status === "degraded") {
          return this.toWorkerEvaluation(worker, false, "worker_degraded_filtered", []);
        }
        if (worker.availableSlots <= 0) {
          return this.toWorkerEvaluation(worker, false, "worker_capacity_full", []);
        }
        if (queueAffinity && worker.queueAffinity && worker.queueAffinity !== queueAffinity) {
          return this.toWorkerEvaluation(worker, false, "queue_affinity_mismatch", []);
        }
        if (!meetsIsolationRequirement(worker.isolationLevel, requiredIsolationLevel)) {
          return this.toWorkerEvaluation(worker, false, "worker_isolation_mismatch", []);
        }
        if (requiredRepoVersion != null && worker.repoVersion !== requiredRepoVersion) {
          return this.toWorkerEvaluation(worker, false, "worker_repo_version_mismatch", []);
        }
        if (!isRemoteSessionReadyForDispatch(worker)) {
          return this.toWorkerEvaluation(worker, false, "worker_remote_session_unready", []);
        }

        const missingCapabilities = requiredCapabilities.filter((capability) => !worker.capabilities.includes(capability));
        if (missingCapabilities.length > 0) {
          return this.toWorkerEvaluation(worker, false, "missing_capabilities", missingCapabilities);
        }

        return this.toWorkerEvaluation(worker, true, null, []);
      });
  }
  private rankWorkerEvaluations(
    ticket: ExecutionTicketRecord,
    evaluations: DispatchWorkerEvaluation[],
  ): DispatchWorkerEvaluation[] {
    const acceptedSignals = evaluations
      .filter((evaluation) => evaluation.accepted)
      .map((evaluation) => this.workers.getWorker(evaluation.workerId))
      .filter((worker): worker is RegisteredWorkerView => worker != null)
      .map((worker) => ({
        worker,
        affinityMatched: ticket.queueName != null && worker.queueAffinity === ticket.queueName,
        effectiveActiveLeaseCount: computeEffectiveActiveLeaseCount({
          workerId: worker.workerId,
          queueAffinity: worker.queueAffinity,
          maxConcurrency: worker.maxConcurrency,
          availableSlots: worker.availableSlots,
          activeLeaseCount: worker.activeLeaseCount,
          runningExecutionCount: worker.runningExecutionIds.length,
          saturation: worker.saturation,
          toolBacklogCount: worker.toolBacklogCount,
          cpuPct: worker.cpuPct,
        }),
        loadScore: computeWorkerLoadScore({
          workerId: worker.workerId,
          queueAffinity: worker.queueAffinity,
          maxConcurrency: worker.maxConcurrency,
          availableSlots: worker.availableSlots,
          activeLeaseCount: worker.activeLeaseCount,
          runningExecutionCount: worker.runningExecutionIds.length,
          saturation: worker.saturation,
          toolBacklogCount: worker.toolBacklogCount,
          cpuPct: worker.cpuPct,
        }),
      }));
    const loadSkew = summarizeWorkerLoadSkew(
      acceptedSignals.map(({ worker }) => ({
        workerId: worker.workerId,
        queueAffinity: worker.queueAffinity,
        maxConcurrency: worker.maxConcurrency,
        availableSlots: worker.availableSlots,
        activeLeaseCount: worker.activeLeaseCount,
        runningExecutionCount: worker.runningExecutionIds.length,
        saturation: worker.saturation,
        toolBacklogCount: worker.toolBacklogCount,
        cpuPct: worker.cpuPct,
      })),
    );
    const rankedAccepted = new Map(
      acceptedSignals.map(({ worker, affinityMatched, effectiveActiveLeaseCount, loadScore }) => {
        const activeLeaseShare =
          loadSkew.totalActiveLeaseCount > 0 ? effectiveActiveLeaseCount / loadSkew.totalActiveLeaseCount : null;
        const capacityScore = worker.availableSlots / Math.max(worker.maxConcurrency, 1);
        const idleBonus = worker.status === "idle" ? 0.1 : 0;
        const affinityBonus = affinityMatched ? AFFINITY_SELECTION_BONUS : 0;
        const loadSkewPenaltyApplied = loadSkew.skewedWorkerIds.includes(worker.workerId);
        const dispatchScore =
          capacityScore +
          idleBonus +
          affinityBonus -
          loadScore -
          (loadSkewPenaltyApplied ? LOAD_SKEW_SELECTION_PENALTY : 0);
        return [
          worker.workerId,
          {
            worker,
            affinityMatched,
            loadScore,
            activeLeaseShare,
            dispatchScore,
            loadSkewPenaltyApplied,
          },
        ] as const;
      }),
    );

    return [...evaluations]
      .map((evaluation) => {
        const ranked = rankedAccepted.get(evaluation.workerId);
        if (!ranked) {
          return evaluation;
        }
        return {
          ...evaluation,
          affinityMatched: ranked.affinityMatched,
          activeLeaseCount: ranked.worker.activeLeaseCount,
          runningExecutionCount: ranked.worker.runningExecutionIds.length,
          saturation: ranked.worker.saturation,
          toolBacklogCount: ranked.worker.toolBacklogCount,
          loadScore: Math.round(ranked.loadScore * 1000) / 1000,
          activeLeaseShare: ranked.activeLeaseShare == null ? null : Math.round(ranked.activeLeaseShare * 1000) / 1000,
          dispatchScore: Math.round(ranked.dispatchScore * 1000) / 1000,
          loadSkewPenaltyApplied: ranked.loadSkewPenaltyApplied,
        } satisfies DispatchWorkerEvaluation;
      })
      .sort((left, right) => {
        if (Number(right.accepted) !== Number(left.accepted)) {
          return Number(right.accepted) - Number(left.accepted);
        }
        if ((right.dispatchScore ?? Number.NEGATIVE_INFINITY) !== (left.dispatchScore ?? Number.NEGATIVE_INFINITY)) {
          return (right.dispatchScore ?? Number.NEGATIVE_INFINITY) - (left.dispatchScore ?? Number.NEGATIVE_INFINITY);
        }
        if (right.availableSlots !== left.availableSlots) {
          return right.availableSlots - left.availableSlots;
        }
        if (left.status !== right.status) {
          return left.status === "idle" ? -1 : 1;
        }
        return left.workerId.localeCompare(right.workerId);
      });
  }

  private selectWorkersForDispatch(
    ticket: ExecutionTicketRecord,
    dispatchTarget: DispatchTarget,
    evaluations: DispatchWorkerEvaluation[],
    remoteAvailability: RemoteAvailability | null,
    remoteTrustReason: string | null,
    remoteSessionReason: string | null,
    remoteRepoVersionReason: string | null,
  ): {
    workers: RegisteredWorkerView[];
    reasonCode: string | null;
    fallbackApplied: boolean;
  } {
    const rankedEvaluations = this.rankWorkerEvaluations(ticket, evaluations);
    evaluations.splice(0, evaluations.length, ...rankedEvaluations);
    const eligibleWorkers = rankedEvaluations
      .filter((evaluation) => evaluation.accepted)
      .map((evaluation) => this.workers.getWorker(evaluation.workerId))
      .filter((worker): worker is RegisteredWorkerView => worker != null);
    if (dispatchTarget !== "prefer_remote") {
      return {
        workers: eligibleWorkers,
        reasonCode: null,
        fallbackApplied: false,
      };
    }

    const remoteWorkers = eligibleWorkers.filter((worker) => worker.placement === "remote");
    if (remoteWorkers.length > 0) {
      return {
        workers: remoteWorkers,
        reasonCode: null,
        fallbackApplied: false,
      };
    }

    return selectWorkersForDispatch(
      dispatchTarget,
      eligibleWorkers,
      remoteAvailability,
      remoteTrustReason,
      remoteSessionReason,
      remoteRepoVersionReason,
    );
  }

  private selectDeterministicWorker(
    eligibleWorkers: readonly RegisteredWorkerView[],
    evaluations: readonly DispatchWorkerEvaluation[],
  ): RegisteredWorkerView {
    const acceptedEvaluations = new Map(
      evaluations
        .filter((evaluation) => evaluation.accepted)
        .map((evaluation) => [evaluation.workerId, evaluation] as const),
    );
    return [...eligibleWorkers].sort((left, right) => {
      const leftEvaluation = acceptedEvaluations.get(left.workerId);
      const rightEvaluation = acceptedEvaluations.get(right.workerId);
      const leftScore = leftEvaluation?.dispatchScore ?? Number.NEGATIVE_INFINITY;
      const rightScore = rightEvaluation?.dispatchScore ?? Number.NEGATIVE_INFINITY;
      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      if (right.availableSlots !== left.availableSlots) {
        return right.availableSlots - left.availableSlots;
      }

      const leftActiveLeaseCount = leftEvaluation?.activeLeaseCount ?? left.activeLeaseCount;
      const rightActiveLeaseCount = rightEvaluation?.activeLeaseCount ?? right.activeLeaseCount;
      if ((leftActiveLeaseCount ?? 0) !== (rightActiveLeaseCount ?? 0)) {
        return (leftActiveLeaseCount ?? 0) - (rightActiveLeaseCount ?? 0);
      }

      const leftRunningExecutionCount =
        leftEvaluation?.runningExecutionCount ?? (Array.isArray(left.runningExecutionIds) ? left.runningExecutionIds.length : 0);
      const rightRunningExecutionCount =
        rightEvaluation?.runningExecutionCount ?? (Array.isArray(right.runningExecutionIds) ? right.runningExecutionIds.length : 0);
      if (leftRunningExecutionCount !== rightRunningExecutionCount) {
        return leftRunningExecutionCount - rightRunningExecutionCount;
      }

      const leftToolBacklogCount = leftEvaluation?.toolBacklogCount ?? left.toolBacklogCount;
      const rightToolBacklogCount = rightEvaluation?.toolBacklogCount ?? right.toolBacklogCount;
      if ((leftToolBacklogCount ?? 0) !== (rightToolBacklogCount ?? 0)) {
        return (leftToolBacklogCount ?? 0) - (rightToolBacklogCount ?? 0);
      }

      return left.workerId.localeCompare(right.workerId);
    })[0]!;
  }

  private toWorkerEvaluation(
    worker: RegisteredWorkerView,
    accepted: boolean,
    rejectionReason: DispatchWorkerRejectionReason | null,
    missingCapabilities: string[],
  ): DispatchWorkerEvaluation {
    return toWorkerEvaluation(worker, accepted, rejectionReason, missingCapabilities);
  }
  private recordDecisionEvent(
    ticket: ExecutionTicketRecord,
    occurredAt: string,
    input: Omit<DispatchDecisionTrace, "ticketId" | "executionId" | "taskId" | "queueName">,
  ): DispatchDecisionTrace {
    const trace: DispatchDecisionTrace = {
      ticketId: ticket.id,
      executionId: ticket.executionId,
      taskId: ticket.taskId,
      queueName: ticket.queueName,
      ...input,
    };
    const execution = this.store.dispatch.getExecution(ticket.executionId);

    this.db.transaction(() => {
      if (execution) {
        this.upsertAgentExecutionRecord(execution, occurredAt, {
          taskId: ticket.taskId,
          status: trace.outcome === "dispatched" ? "dispatch_claimed" : `dispatch_${trace.outcome}`,
          lastDecisionJson: JSON.stringify(trace),
          progressMessage: `dispatch ${trace.outcome}`,
        });
      }
      this.store.event.insertEvent({
        id: newId("evt"),
        taskId: ticket.taskId,
        executionId: ticket.executionId,
        eventType: "dispatch:decision_recorded",
        eventTier: "tier_2",
        payloadJson: JSON.stringify(trace),
        traceId: execution?.traceId ?? null,
        createdAt: occurredAt,
      });
    });

    return trace;
  }

  private upsertAgentExecutionRecord(
    execution: NonNullable<ReturnType<AuthoritativeTaskStore["getExecution"]>>,
    occurredAt: string,
    updates: {
      taskId: string;
      status?: string;
      planJson?: string;
      lastDecisionJson?: string | null;
      progressMessage?: string | null;
    },
  ): AgentExecutionRecord {
    const record: AgentExecutionRecord = buildDispatchAgentExecutionRecord(this.store, execution, occurredAt, updates);
    this.store.worker.upsertAgentExecutionRecord(record);
    return record;
  }
}
