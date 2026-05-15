import type {
  AgentExecutionRecord,
  DispatchTarget,
  DispatchDecisionTrace,
  DispatchWorkerEvaluation,
  DispatchWorkerRejectionReason,
  ExecutionTicketRecord,
  RemoteAvailability,
  WorkerIsolationLevel,
} from "../../contracts/types/domain.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import type { HealthReportProvider } from "../../contracts/types/health.js";
import { createNoOpHealthReportProvider } from "../../contracts/types/health.js";
import type { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AdmissionBackpressureSnapshot } from "./admission-controller.js";
import { ExecutionLeaseService, type ExecutionLeaseDecision } from "../lease/execution-lease-service.js";
import { MAX_LEASE_TTL_MS, MIN_LEASE_TTL_MS } from "../lease/types.js";
import { ExecutionPriorityPreemptionService } from "./execution-priority-preemption-service.js";
import {
  computeEffectiveActiveLeaseCount,
  computeWorkerLoadScore,
  summarizeWorkerLoadSkew,
} from "../worker-pool/worker-load-balancing.js";
import { WorkerRegistryService, type RegisteredWorkerView } from "../worker-pool/worker-registry-service.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { StorageError } from "../../contracts/errors.js";
import type { FailureCategory } from "../../five-plane-state-evidence/events/dlq-service.js";
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
import {
  hashDispatchSeed,
  interleaveTicketsByTenant,
  sortTicketsForDeterministicDispatch,
} from "./execution-dispatch-ordering.js";
const logger = new StructuredLogger({ retentionLimit: 100 });

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
  private readonly healthService: HealthReportProvider;
  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
    private readonly backpressureSnapshot: (() => AdmissionBackpressureSnapshot | null) | null = null,
    private readonly queueAvailabilitySnapshot: (() => DispatchQueueAvailabilitySnapshot | null) | null = null,
    healthProvider: HealthReportProvider | null = null,
    private readonly dlqService: {
      enqueue(input: {
        sourceEventId: string;
        consumerId: string;
        errorCode: string;
        payloadJson: string;
        originalTimestamp?: string | null;
        failureCategory?: FailureCategory | "poison_pill" | null;
      }): unknown;
    } | null = null,
    private readonly poisonPillMaxAgeMs: number | null = null,
  ) {
    this.leases = new ExecutionLeaseService(db, store);
    this.preemption = new ExecutionPriorityPreemptionService(db, store);
    this.workers = new WorkerRegistryService(store);
    this.healthService = healthProvider ?? createNoOpHealthReportProvider();
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
        tenantId: task.tenantId ?? "default",
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
    let tickets = this.store.worker.listDispatchableExecutionTickets(occurredAt, options.queueName ?? null);
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

    tickets = sortTicketsForDeterministicDispatch(tickets);
    tickets = interleaveTicketsByTenant(tickets);

    const queueAvailability = this.queueAvailabilitySnapshot?.();
    if (queueAvailability?.state === "unavailable") {
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
            });

      return {
        outcome: "blocked",
        reasonCode,
        ticket,
        worker: null,
        leaseId: null,
        trace,
      };
    }

    let blockedReason: string | null = null;
    let lastTrace: DispatchDecisionTrace | null = null;
    const backpressure =
      this.backpressureSnapshot?.() ??
      this.healthService.getReport();

    for (const ticket of tickets) {
      const dispatchTarget = resolveDispatchTarget(ticket.dispatchTarget);
      const requiredIsolationLevel = resolveRequiredIsolationLevel(ticket.requiredIsolationLevel);
      const requiredRepoVersion = resolveRequiredRepoVersion(ticket.requiredRepoVersion);
      const blockedByBackpressure = resolveDispatchBackpressureReason(ticket, backpressure);
      if (blockedByBackpressure) {
        blockedReason = blockedByBackpressure;
        lastTrace = this.recordDecisionEvent(ticket, occurredAt, {
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
        });
        this.enqueueDispatchDlq(ticket, occurredAt, blockedByBackpressure, lastTrace);
        this.db.transaction(() => {
          const execution = this.store.dispatch.getExecution(ticket.executionId);
          this.store.event.insertEvent({
            id: newId("evt"),
            taskId: ticket.taskId,
            executionId: ticket.executionId,
            eventType: "dispatch:backpressure_rejected",
            eventTier: "tier_2",
            payloadJson: JSON.stringify({
              ticketId: ticket.id,
              executionId: ticket.executionId,
              taskId: ticket.taskId,
              queueName: ticket.queueName,
              priority: ticket.priority,
              riskClass: ticket.riskClass,
              reasonCode: blockedByBackpressure,
              backpressureSnapshot: backpressure,
            }),
            traceId: execution?.traceId ?? null,
            createdAt: occurredAt,
          });
          this.store.event.insertEvent({
            id: newId("evt"),
            taskId: ticket.taskId,
            executionId: ticket.executionId,
            eventType: "dispatch.backpressure_rejected",
            eventTier: "tier_2",
            payloadJson: JSON.stringify({
              ticketId: ticket.id,
              executionId: ticket.executionId,
              taskId: ticket.taskId,
              queueName: ticket.queueName,
              priority: ticket.priority,
              riskClass: ticket.riskClass,
              reasonCode: blockedByBackpressure,
              backpressureSnapshot: backpressure,
            }),
            traceId: execution?.traceId ?? null,
            createdAt: occurredAt,
          });
        });
        continue;
      }

      const requiredCapabilities = parseJsonArray(ticket.requiredCapabilitiesJson);
      let evaluations = this.evaluateWorkersForTicket(
        ticket,
        options,
        requiredCapabilities,
        requiredIsolationLevel,
        requiredRepoVersion,
        occurredAt,
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
      // R6-5: Emergency lane for critical/urgent NodeRun - allow preemption for both urgent priority AND critical risk class
      const emergencyLaneRequested =
        ticket.priority === "critical"
        || ticket.priority === "urgent"
        || ticket.priority === "high"
        || ticket.riskClass === "critical";
      if (eligibleWorkers.length === 0 && emergencyLaneRequested) {
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
            occurredAt,
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
        if (this.shouldInvalidatePoisonPill(ticket, occurredAt)) {
          const trace = this.invalidatePoisonPillTicket(ticket, occurredAt, evaluations);
          return {
            outcome: "blocked",
            reasonCode: "dispatch.poison_pill_abandoned",
            ticket,
            worker: null,
            leaseId: null,
            trace,
          };
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
        const noEmergencyWorkerReason = ticket.priority === "critical" || ticket.priority === "urgent" || ticket.priority === "high"
          ? "dispatch.no_emergency_worker_available"
          : null;
        if (remoteBlockReason || noEmergencyWorkerReason) {
          blockedReason = remoteBlockReason ?? noEmergencyWorkerReason;
        }
        lastTrace = this.recordDecisionEvent(ticket, occurredAt, {
          dispatchTarget,
          remoteAvailability,
          requiredIsolationLevel,
          requiredRepoVersion,
          preferredWorkerId: options.preferredWorkerId ?? null,
          requiredCapabilities,
          outcome: remoteBlockReason || noEmergencyWorkerReason ? "blocked" : "no_worker",
          reasonCode: remoteBlockReason ?? noEmergencyWorkerReason,
          selectedWorkerId: null,
          leaseId: null,
          fallbackApplied: false,
          preemption: preemptionTrace,
          evaluations,
        });
        if (remoteBlockReason || noEmergencyWorkerReason) {
          this.enqueueDispatchDlq(ticket, occurredAt, remoteBlockReason ?? noEmergencyWorkerReason, lastTrace);
        }
        continue;
      }

      const selectedWorker = eligibleWorkers[0]!;
      let leaseResult: ExecutionLeaseDecision = {
        outcome: "blocked",
        reasonCode: "lease_grant_failed",
        lease: null,
      };
      // Issue 1900 fix: Keep lease acquisition and claim in the same transaction boundary.
      this.db.transaction(() => {
        leaseResult = this.leases.acquireLeaseWithinTransaction({
          executionId: ticket.executionId,
          workerId: selectedWorker.workerId,
          ttlMs: Math.min(Math.max(options.leaseTtlMs, MIN_LEASE_TTL_MS), MAX_LEASE_TTL_MS),
          queueName: ticket.queueName,
          occurredAt,
        });
        if (leaseResult.outcome !== "granted" || !leaseResult.lease) {
          return;
        }

        this.store.worker.claimExecutionTicket({
          ticketId: ticket.id,
          assignedWorkerId: selectedWorker.workerId,
          leaseId: leaseResult.lease.id,
          claimedAt: occurredAt,
        });
        const workerSnapshot = this.store.worker.getWorkerSnapshot(selectedWorker.workerId);
        if (workerSnapshot) {
          const runningExecutionIds = new Set(parseJsonArray(workerSnapshot.runningExecutionsJson));
          runningExecutionIds.add(ticket.executionId);
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
            leaseId: leaseResult.lease.id,
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
      });

      const resolvedLeaseResult = leaseResult;
      const grantedLease = resolvedLeaseResult.lease;
      if (resolvedLeaseResult.outcome !== "granted" || grantedLease == null) {
        blockedReason = resolvedLeaseResult.reasonCode ?? "lease_grant_failed";
        lastTrace = this.recordDecisionEvent(ticket, occurredAt, {
          dispatchTarget,
          remoteAvailability,
          requiredIsolationLevel,
          requiredRepoVersion,
          preferredWorkerId: options.preferredWorkerId ?? null,
          requiredCapabilities,
          outcome: "blocked",
          reasonCode: resolvedLeaseResult.reasonCode ?? "lease_grant_failed",
          selectedWorkerId: selectedWorker.workerId,
          leaseId: grantedLease?.id ?? null,
          fallbackApplied: selection.fallbackApplied,
          preemption: preemptionTrace,
          evaluations,
        });
        continue;
      }

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
        leaseId: grantedLease.id,
        fallbackApplied: selection.fallbackApplied,
        preemption: preemptionTrace,
        evaluations,
      });

      return {
        outcome: "dispatched",
        reasonCode: selection.reasonCode,
        ticket: this.store.worker.getExecutionTicket(ticket.id) ?? null,
        worker: selectedWorker,
        leaseId: grantedLease.id,
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
    occurredAt: string,
  ): DispatchWorkerEvaluation[] {
    const queueAffinity = ticket.queueName ?? null;
    const dispatchTarget = resolveDispatchTarget(ticket.dispatchTarget);

    const candidates =
      options.preferredWorkerId == null
        ? this.listCandidateWorkers()
        : [this.getCandidateWorker(options.preferredWorkerId)].filter((worker): worker is RegisteredWorkerView => worker != null);

    return candidates.map((worker) => {
        // R6-10: Check heartbeat staleness - reject workers with stale heartbeats (>30s per §14)
        const heartbeatStalenessThresholdMs = 30_000; // 30 seconds per §14 gap detection
        const lastHeartbeatAgeMs = Date.parse(occurredAt) - Date.parse(worker.lastHeartbeatAt);
        if (lastHeartbeatAgeMs > heartbeatStalenessThresholdMs) {
          return this.toWorkerEvaluation(worker, false, "worker_heartbeat_missing", []);
        }

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
      .map((evaluation) => this.getCandidateWorker(evaluation.workerId))
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
      .map((evaluation) => this.getCandidateWorker(evaluation.workerId))
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
    ticket: { id?: string; executionId?: string; taskId?: string },
    eligibleWorkers: readonly { workerId: string }[],
    evaluations: readonly { workerId: string; accepted: boolean; dispatchScore: number }[],
  ): { workerId: string } {
    const acceptedById = new Map(evaluations.filter((item) => item.accepted).map((item) => [item.workerId, item]));
    const candidates = eligibleWorkers
      .filter((worker) => acceptedById.has(worker.workerId))
      .sort((left, right) => {
        const leftScore = acceptedById.get(left.workerId)?.dispatchScore ?? 0;
        const rightScore = acceptedById.get(right.workerId)?.dispatchScore ?? 0;
        if (rightScore !== leftScore) {
          return rightScore - leftScore;
        }
        return left.workerId.localeCompare(right.workerId);
      });
    if (candidates.length === 0) {
      throw new Error("dispatch.no_eligible_worker");
    }
    const seed = `${ticket.id ?? ""}:${ticket.executionId ?? ""}:${ticket.taskId ?? ""}`;
    return candidates[hashDispatchSeed(seed) % candidates.length]!;
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
    // R6-7: Build ready_set and selected_node_ids from evaluations for trace
    const readySet = input.outcome === "dispatched" && input.evaluations.length > 0
      ? input.evaluations.map((e) => e.workerId)
      : [ticket.id];
    const selectedNodeIds = input.selectedWorkerId ? [input.selectedWorkerId] : [];
    const orderingPolicyVersion = "dispatch.partial-deterministic.v2"; // R6-7: Version of ordering policy per §14.9

    const trace: DispatchDecisionTrace = {
      ticketId: ticket.id,
      executionId: ticket.executionId,
      taskId: ticket.taskId,
      queueName: ticket.queueName,
      ...input,
      // R6-7: Add scheduler event fields per §14.9
      readySet,
      selectedNodeIds,
      orderingPolicyVersion,
      workerPoolSnapshotRef: `worker_pool://dispatch/${ticket.queueName ?? "default"}/snapshot/${occurredAt}`,
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

  private categorizeFailure(reasonCode: string | null): FailureCategory | "poison_pill" {
    if (reasonCode == null) return "unknown";
    if (reasonCode.includes("read_only_mode")) return "configuration";
    if (reasonCode.includes("pause_non_critical")) return "transient";
    if (reasonCode.includes("poison_pill")) return "poison_pill";
    if (reasonCode.includes("starvation_protection")) return "resource";
    if (reasonCode.includes("queue_only")) return "transient";
    if (reasonCode.includes("budget")) return "resource";
    return "unknown";
  }

  private listCandidateWorkers(): RegisteredWorkerView[] {
    const workerStore = this.store.worker as unknown as {
      listWorkers?: () => RegisteredWorkerView[];
    };
    const directWorkers = workerStore.listWorkers?.();
    if (directWorkers && directWorkers.length > 0) {
      return directWorkers;
    }
    return this.workers.listWorkers();
  }

  private getCandidateWorker(workerId: string): RegisteredWorkerView | null {
    const workerStore = this.store.worker as unknown as {
      getWorker?: (id: string) => RegisteredWorkerView | null;
      listWorkers?: () => RegisteredWorkerView[];
    };
    const directWorker = workerStore.getWorker?.(workerId) ?? null;
    if (directWorker) {
      return directWorker;
    }
    const listedWorker = workerStore.listWorkers?.().find((worker) => worker.workerId === workerId) ?? null;
    return listedWorker ?? this.workers.getWorker(workerId);
  }

  private enqueueDispatchDlq(
    ticket: ExecutionTicketRecord,
    occurredAt: string,
    reasonCode: string | null,
    trace: DispatchDecisionTrace | null,
  ): void {
    if (!this.dlqService || !reasonCode) {
      return;
    }
    this.dlqService.enqueue({
      sourceEventId: ticket.id,
      consumerId: "execution-dispatch-service",
      errorCode: reasonCode,
      payloadJson: JSON.stringify({ ticket, trace }),
      originalTimestamp: ticket.createdAt,
      failureCategory: this.categorizeFailure(reasonCode),
    });
    const execution = this.store.dispatch.getExecution(ticket.executionId);
    this.store.event.insertEvent({
      id: newId("evt"),
      taskId: ticket.taskId,
      executionId: ticket.executionId,
      eventType: "dispatch.dlq_enqueue",
      eventTier: "tier_2",
      payloadJson: JSON.stringify({ ticketId: ticket.id, reasonCode }),
      traceId: execution?.traceId ?? null,
      createdAt: occurredAt,
    });
  }

  private shouldInvalidatePoisonPill(ticket: ExecutionTicketRecord, occurredAt: string): boolean {
    if (this.poisonPillMaxAgeMs == null || this.poisonPillMaxAgeMs < 0) {
      return false;
    }
    const ageMs = Date.parse(occurredAt) - Date.parse(ticket.updatedAt || ticket.createdAt);
    return Number.isFinite(ageMs) && ageMs > this.poisonPillMaxAgeMs;
  }

  private invalidatePoisonPillTicket(
    ticket: ExecutionTicketRecord,
    occurredAt: string,
    evaluations: DispatchWorkerEvaluation[],
  ): DispatchDecisionTrace {
    this.store.worker.invalidateExecutionTicket?.({
      ticketId: ticket.id,
      status: "cancelled",
      invalidatedAt: occurredAt,
    });
    this.store.execution.updateExecutionStatus(ticket.executionId, "failed", "dispatch.poison_pill_abandoned", occurredAt);
    const trace = this.recordDecisionEvent(ticket, occurredAt, {
      dispatchTarget: resolveDispatchTarget(ticket.dispatchTarget),
      remoteAvailability: null,
      requiredIsolationLevel: resolveRequiredIsolationLevel(ticket.requiredIsolationLevel),
      requiredRepoVersion: resolveRequiredRepoVersion(ticket.requiredRepoVersion),
      preferredWorkerId: null,
      requiredCapabilities: parseJsonArray(ticket.requiredCapabilitiesJson),
      outcome: "blocked",
      reasonCode: "dispatch.poison_pill_detected",
      selectedWorkerId: null,
      leaseId: null,
      fallbackApplied: false,
      evaluations,
    });
    const execution = this.store.dispatch.getExecution(ticket.executionId);
    this.store.event.insertEvent({
      id: newId("evt"),
      taskId: ticket.taskId,
      executionId: ticket.executionId,
      eventType: "dispatch:poison_pill_detected",
      eventTier: "tier_2",
      payloadJson: JSON.stringify({ ticketId: ticket.id, reasonCode: "dispatch.poison_pill_abandoned" }),
      traceId: execution?.traceId ?? null,
      createdAt: occurredAt,
    });
    this.enqueueDispatchDlq(ticket, occurredAt, "dispatch.poison_pill_abandoned", trace);
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
