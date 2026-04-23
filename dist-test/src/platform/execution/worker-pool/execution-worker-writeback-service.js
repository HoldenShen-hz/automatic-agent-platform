/**
 * @fileoverview Execution Worker Writeback Service - Handles result reporting from workers.
 *
 * When a worker completes or fails an execution, it reports back to the system through
 * this writeback service. The service validates the writeback request (ensuring the worker
 * still holds a valid lease), updates all affected records, and manages the lease lifecycle.
 *
 * Key responsibilities:
 * - Validate writeback requests against current execution/lease state
 * - Check for resource ceiling violations before accepting writebacks
 * - Verify remote session authority for remote workers
 * - Apply terminal state transitions to task, workflow, session, and execution
 * - Release execution leases and update worker snapshots
 * - Record heartbeat snapshots and remote logs
 *
 * The writeback flow is critical for maintaining consistency between workers and the
 * authoritative database, especially in distributed/multi-region deployments.
 *
 * @see Execution Lease Service: execution-lease-service.ts
 * @see Transition Service: transition-service.ts
 */
import { newId, nowIso } from "../../contracts/types/ids.js";
import { ExecutionLeaseService } from "../lease/execution-lease-service.js";
import { ExecutionResourceCeilingGuard } from "../dispatcher/execution-resource-ceiling-guard.js";
import { resolveRemoteAuthorityBlockReason } from "./remote-session-guard.js";
import { TransitionService } from "../state-transition/transition-service.js";
import { WorkerRegistryService } from "./worker-registry-service.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { buildAgentExecutionRecord, parseJsonArray, persistRemoteLogs, removeExecutionId, toExecutionTerminalStatus, toWorkerStatus, } from "./execution-worker-writeback-support.js";
const logger = new StructuredLogger({ retentionLimit: 100 });
/**
 * Service for handling execution result writebacks from workers.
 *
 * Accepts writeback requests that report execution completion (done, failed, cancelled),
 * validates them thoroughly, and applies the resulting state changes to the authoritative
 * database. Rejections are issued with detailed reason codes for debugging.
 */
export class ExecutionWorkerWritebackService {
    db;
    store;
    leases;
    transitions;
    workers;
    resourceCeilingGuard;
    constructor(db, store, options = {}) {
        this.db = db;
        this.store = store;
        this.leases = new ExecutionLeaseService(db, store);
        this.transitions = new TransitionService(db, store);
        this.workers = new WorkerRegistryService(store);
        this.resourceCeilingGuard = options.resourceCeilingGuard ?? new ExecutionResourceCeilingGuard();
    }
    /**
     * Processes a worker writeback request.
     *
     * This is the main entry point for worker result reporting. The method:
     * 1. Validates the execution, task, workflow, session exist
     * 2. Validates the execution is in "executing" status
     * 3. Validates the lease is still valid and owned by this worker
     * 4. Checks for resource ceiling violations
     * 5. For remote workers, validates session authority
     * 6. If all checks pass, applies terminal state transitions and releases lease
     * 7. If any check fails, rejects with a detailed reason code
     */
    recordWriteback(input) {
        const occurredAt = input.occurredAt ?? nowIso();
        const view = this.store.operations.loadExecutionAuthoritativeView(input.executionId);
        if (!view) {
            return {
                accepted: false,
                reasonCode: "execution_not_found",
                executionId: input.executionId,
                leaseId: input.leaseId,
                taskId: null,
                terminalStatus: input.terminalStatus,
            };
        }
        const { execution, task, workflow, session } = view;
        if (!task) {
            this.recordRejectedEvent(execution.taskId, execution.id, occurredAt, {
                workerId: input.workerId,
                leaseId: input.leaseId,
                fencingToken: input.fencingToken,
                terminalStatus: input.terminalStatus,
                reasonCode: "task_not_found",
            });
            return {
                accepted: false,
                reasonCode: "task_not_found",
                executionId: execution.id,
                leaseId: input.leaseId,
                taskId: execution.taskId,
                terminalStatus: input.terminalStatus,
            };
        }
        if (!workflow) {
            this.recordRejectedEvent(task.id, execution.id, occurredAt, {
                workerId: input.workerId,
                leaseId: input.leaseId,
                fencingToken: input.fencingToken,
                terminalStatus: input.terminalStatus,
                reasonCode: "workflow_not_found",
            });
            return {
                accepted: false,
                reasonCode: "workflow_not_found",
                executionId: execution.id,
                leaseId: input.leaseId,
                taskId: task.id,
                terminalStatus: input.terminalStatus,
            };
        }
        if (!session) {
            this.recordRejectedEvent(task.id, execution.id, occurredAt, {
                workerId: input.workerId,
                leaseId: input.leaseId,
                fencingToken: input.fencingToken,
                terminalStatus: input.terminalStatus,
                reasonCode: "session_not_found",
            });
            return {
                accepted: false,
                reasonCode: "session_not_found",
                executionId: execution.id,
                leaseId: input.leaseId,
                taskId: task.id,
                terminalStatus: input.terminalStatus,
            };
        }
        if (execution.status !== "executing") {
            this.recordRejectedEvent(task.id, execution.id, occurredAt, {
                workerId: input.workerId,
                leaseId: input.leaseId,
                fencingToken: input.fencingToken,
                terminalStatus: input.terminalStatus,
                reasonCode: "execution_not_executing",
            });
            return {
                accepted: false,
                reasonCode: "execution_not_executing",
                executionId: execution.id,
                leaseId: input.leaseId,
                taskId: task.id,
                terminalStatus: input.terminalStatus,
            };
        }
        const validation = this.leases.validateWriteAccess({
            executionId: execution.id,
            workerId: input.workerId,
            fencingToken: input.fencingToken,
            leaseId: input.leaseId,
            occurredAt,
        });
        if (!validation.allowed) {
            this.recordRejectedEvent(task.id, execution.id, occurredAt, {
                workerId: input.workerId,
                leaseId: input.leaseId,
                fencingToken: input.fencingToken,
                terminalStatus: input.terminalStatus,
                reasonCode: validation.reasonCode,
            });
            return {
                accepted: false,
                reasonCode: validation.reasonCode,
                executionId: execution.id,
                leaseId: input.leaseId,
                taskId: task.id,
                terminalStatus: input.terminalStatus,
            };
        }
        const lease = this.store.worker.getExecutionLease(input.leaseId);
        if (!lease) {
            this.recordRejectedEvent(task.id, execution.id, occurredAt, {
                workerId: input.workerId,
                leaseId: input.leaseId,
                fencingToken: input.fencingToken,
                terminalStatus: input.terminalStatus,
                reasonCode: "lease_not_found",
            });
            return {
                accepted: false,
                reasonCode: "lease_not_found",
                executionId: execution.id,
                leaseId: input.leaseId,
                taskId: task.id,
                terminalStatus: input.terminalStatus,
            };
        }
        if (Date.parse(lease.expiresAt) < Date.parse(occurredAt)) {
            this.db.transaction(() => {
                this.store.worker.closeExecutionLease({
                    leaseId: lease.id,
                    status: "expired",
                    releasedAt: occurredAt,
                    reasonCode: "lease_expired",
                });
                this.store.worker.insertLeaseAudit({
                    id: newId("laudit"),
                    executionId: execution.id,
                    leaseId: lease.id,
                    workerId: input.workerId,
                    fencingToken: input.fencingToken,
                    eventType: "lease_expired",
                    reasonCode: "lease_expired",
                    recordedAt: occurredAt,
                });
            });
            this.recordRejectedEvent(task.id, execution.id, occurredAt, {
                workerId: input.workerId,
                leaseId: input.leaseId,
                fencingToken: input.fencingToken,
                terminalStatus: input.terminalStatus,
                reasonCode: "lease_expired",
            });
            return {
                accepted: false,
                reasonCode: "lease_expired",
                executionId: execution.id,
                leaseId: input.leaseId,
                taskId: task.id,
                terminalStatus: input.terminalStatus,
            };
        }
        const taskOutputJson = input.taskOutputJson ?? task.outputJson ?? "{}";
        const outputsJson = input.outputsJson ?? workflow.outputsJson;
        const releaseReason = `worker_writeback_${input.terminalStatus}`;
        const transitionReasonCode = input.reasonCode ?? `worker.writeback.${input.terminalStatus}`;
        const executionTerminalStatus = toExecutionTerminalStatus(input.terminalStatus);
        const workerSnapshot = this.store.worker.getWorkerSnapshot(input.workerId);
        if ((workerSnapshot?.placement ?? "local") === "remote" && workerSnapshot?.registrationVerifiedAt == null) {
            this.recordRejectedEvent(task.id, execution.id, occurredAt, {
                workerId: input.workerId,
                leaseId: input.leaseId,
                fencingToken: input.fencingToken,
                terminalStatus: input.terminalStatus,
                reasonCode: "worker_not_trusted",
            });
            return {
                accepted: false,
                reasonCode: "worker_not_trusted",
                executionId: execution.id,
                leaseId: input.leaseId,
                taskId: task.id,
                terminalStatus: input.terminalStatus,
            };
        }
        const remoteAuthorityBlockReason = workerSnapshot == null
            ? null
            : resolveRemoteAuthorityBlockReason({
                placement: workerSnapshot.placement ?? null,
                remoteSessionStatus: workerSnapshot.remoteSessionStatus ?? null,
                lastAcknowledgedStreamOffset: workerSnapshot.lastAcknowledgedStreamOffset ?? null,
                sessionConsistencyCheckStatus: workerSnapshot.sessionConsistencyCheckStatus ?? null,
                workspaceSyncStatus: input.workspaceSyncStatus === undefined ? (workerSnapshot.workspaceSyncStatus ?? null) : input.workspaceSyncStatus,
            });
        if (remoteAuthorityBlockReason) {
            this.recordRejectedEvent(task.id, execution.id, occurredAt, {
                workerId: input.workerId,
                leaseId: input.leaseId,
                fencingToken: input.fencingToken,
                terminalStatus: input.terminalStatus,
                remoteSessionStatus: workerSnapshot?.remoteSessionStatus ?? null,
                lastAcknowledgedStreamOffset: workerSnapshot?.lastAcknowledgedStreamOffset ?? null,
                sessionConsistencyCheckStatus: workerSnapshot?.sessionConsistencyCheckStatus ?? null,
                workspaceSyncStatus: input.workspaceSyncStatus === undefined ? (workerSnapshot?.workspaceSyncStatus ?? null) : input.workspaceSyncStatus,
                reasonCode: remoteAuthorityBlockReason,
            });
            return {
                accepted: false,
                reasonCode: remoteAuthorityBlockReason,
                executionId: execution.id,
                leaseId: input.leaseId,
                taskId: task.id,
                terminalStatus: input.terminalStatus,
            };
        }
        const existingAgentExecution = this.store.worker.getAgentExecutionRecord(execution.id);
        const writebackResourceFinding = this.resourceCeilingGuard.firstFinding({
            executionId: execution.id,
            taskId: execution.taskId,
            agentId: input.workerId,
            status: execution.status,
            runtimeInstanceId: input.runtimeInstanceId ?? existingAgentExecution?.runtimeInstanceId ?? workerSnapshot?.runtimeInstanceId ?? null,
            currentStepId: input.currentStepId === undefined ? (existingAgentExecution?.currentStepId ?? null) : input.currentStepId,
            toolCallCount: input.toolCallCount === undefined ? (existingAgentExecution?.toolCallCount ?? 0) : input.toolCallCount,
            memoryMb: input.memoryMb ?? workerSnapshot?.memoryMb ?? null,
            startedAt: existingAgentExecution?.startedAt ?? execution.startedAt ?? execution.createdAt,
            now: occurredAt,
        });
        if (writebackResourceFinding) {
            if (existingAgentExecution) {
                this.upsertAgentExecutionRecord(execution, occurredAt, {
                    agentId: input.workerId,
                    runtimeInstanceId: input.runtimeInstanceId ?? existingAgentExecution.runtimeInstanceId ?? workerSnapshot?.runtimeInstanceId ?? null,
                    restartedFromRuntimeInstanceId: input.restartedFromRuntimeInstanceId ?? existingAgentExecution.restartedFromRuntimeInstanceId ?? null,
                    restartGeneration: existingAgentExecution.restartGeneration,
                    status: execution.status,
                    currentStepId: input.currentStepId === undefined ? existingAgentExecution.currentStepId : input.currentStepId,
                    lastToolName: input.lastToolName === undefined ? existingAgentExecution.lastToolName : input.lastToolName,
                    toolCallCount: input.toolCallCount === undefined ? existingAgentExecution.toolCallCount : input.toolCallCount,
                    progressMessage: input.progressMessage ?? existingAgentExecution.progressMessage,
                    lastErrorCode: writebackResourceFinding.reasonCode,
                    completedAt: null,
                });
            }
            this.recordRejectedEvent(task.id, execution.id, occurredAt, {
                workerId: input.workerId,
                leaseId: input.leaseId,
                fencingToken: input.fencingToken,
                terminalStatus: input.terminalStatus,
                reasonCode: "resource_limit_exceeded",
                resourceLimit: writebackResourceFinding,
            });
            return {
                accepted: false,
                reasonCode: "resource_limit_exceeded",
                executionId: execution.id,
                leaseId: input.leaseId,
                taskId: task.id,
                terminalStatus: input.terminalStatus,
            };
        }
        try {
            this.db.transaction(() => {
                this.transitions.applyTaskTerminalState({
                    taskId: task.id,
                    sessionId: session.id,
                    executionId: execution.id,
                    currentTaskStatus: task.status,
                    currentWorkflowStatus: workflow.status,
                    currentSessionStatus: session.status,
                    currentExecutionStatus: execution.status,
                    terminalStatus: input.terminalStatus,
                    taskOutputJson,
                    outputsJson,
                    context: {
                        traceId: execution.traceId,
                        reasonCode: transitionReasonCode,
                        actorType: "agent",
                        actorId: input.workerId,
                        occurredAt,
                        metadataJson: JSON.stringify({
                            leaseId: lease.id,
                            fencingToken: input.fencingToken,
                        }),
                    },
                });
                const workerView = workerSnapshot
                    ? this.refreshWorkerSnapshot(workerSnapshot, execution.id, occurredAt, {
                        progressMessage: input.progressMessage ?? null,
                        ...(input.runtimeInstanceId !== undefined ? { runtimeInstanceId: input.runtimeInstanceId } : {}),
                        ...(input.restartedFromRuntimeInstanceId !== undefined
                            ? { restartedFromRuntimeInstanceId: input.restartedFromRuntimeInstanceId }
                            : {}),
                        cpuPct: input.cpuPct ?? null,
                        memoryMb: input.memoryMb ?? null,
                        ...(input.toolBacklogCount !== undefined ? { toolBacklogCount: input.toolBacklogCount } : {}),
                        ...(input.currentStepId !== undefined ? { currentStepId: input.currentStepId } : {}),
                        ...(input.lastProgressAt !== undefined ? { lastProgressAt: input.lastProgressAt } : {}),
                        ...(input.workspaceSyncStatus !== undefined ? { workspaceSyncStatus: input.workspaceSyncStatus } : {}),
                        ...(input.workspaceSyncCheckedAt !== undefined ? { workspaceSyncCheckedAt: input.workspaceSyncCheckedAt } : {}),
                    })
                    : null;
                this.store.worker.insertHeartbeatSnapshot({
                    id: newId("hb"),
                    executionId: execution.id,
                    agentId: input.workerId,
                    runtimeInstanceId: workerView?.runtimeInstanceId ?? workerSnapshot?.runtimeInstanceId ?? null,
                    restartGeneration: workerView?.restartGeneration ?? workerSnapshot?.restartGeneration ?? 0,
                    status: executionTerminalStatus,
                    progressMessage: input.progressMessage ?? `worker writeback ${input.terminalStatus}`,
                    cpuPct: input.cpuPct ?? null,
                    memoryMb: input.memoryMb ?? null,
                    sampledAt: occurredAt,
                });
                this.upsertAgentExecutionRecord(execution, occurredAt, {
                    agentId: input.workerId,
                    runtimeInstanceId: workerView?.runtimeInstanceId ?? workerSnapshot?.runtimeInstanceId ?? null,
                    restartedFromRuntimeInstanceId: workerView?.restartedFromRuntimeInstanceId ?? workerSnapshot?.restartedFromRuntimeInstanceId ?? null,
                    restartGeneration: workerView?.restartGeneration ?? workerSnapshot?.restartGeneration ?? 0,
                    status: executionTerminalStatus,
                    currentStepId: input.currentStepId === undefined
                        ? (this.store.worker.getAgentExecutionRecord(execution.id)?.currentStepId ?? null)
                        : input.currentStepId,
                    lastToolName: input.lastToolName === undefined
                        ? (this.store.worker.getAgentExecutionRecord(execution.id)?.lastToolName ?? null)
                        : input.lastToolName,
                    toolCallCount: input.toolCallCount === undefined
                        ? (this.store.worker.getAgentExecutionRecord(execution.id)?.toolCallCount ?? 0)
                        : input.toolCallCount,
                    progressMessage: input.progressMessage ?? `worker writeback ${input.terminalStatus}`,
                    lastErrorCode: input.reasonCode ?? execution.lastErrorCode,
                    completedAt: occurredAt,
                });
                this.store.worker.closeExecutionLease({
                    leaseId: lease.id,
                    status: "released",
                    releasedAt: occurredAt,
                    reasonCode: releaseReason,
                });
                this.store.worker.insertLeaseAudit({
                    id: newId("laudit"),
                    executionId: execution.id,
                    leaseId: lease.id,
                    workerId: input.workerId,
                    fencingToken: input.fencingToken,
                    eventType: "lease_released",
                    reasonCode: releaseReason,
                    recordedAt: occurredAt,
                });
                this.store.event.insertEvent({
                    id: newId("evt"),
                    taskId: task.id,
                    executionId: execution.id,
                    eventType: "worker:writeback_recorded",
                    eventTier: "tier_2",
                    payloadJson: JSON.stringify({
                        workerId: input.workerId,
                        leaseId: lease.id,
                        fencingToken: input.fencingToken,
                        terminalStatus: input.terminalStatus,
                        reasonCode: input.reasonCode ?? null,
                    }),
                    traceId: execution.traceId,
                    createdAt: occurredAt,
                });
                this.store.event.insertEvent({
                    id: newId("evt"),
                    taskId: task.id,
                    executionId: execution.id,
                    eventType: "worker:lease_released_after_writeback",
                    eventTier: "tier_2",
                    payloadJson: JSON.stringify({
                        workerId: input.workerId,
                        leaseId: lease.id,
                        fencingToken: input.fencingToken,
                        releaseReason,
                    }),
                    traceId: execution.traceId,
                    createdAt: occurredAt,
                });
                this.persistRemoteLogs(task.id, execution.id, execution.traceId, input.workerId, workerView?.runtimeInstanceId ?? workerSnapshot?.runtimeInstanceId ?? null, input.remoteLogs, occurredAt);
            });
        }
        catch (error) {
            const reasonCode = error instanceof Error && error.message.includes("invalid_transition")
                ? "invalid_terminal_transition"
                : "authoritative_store_unavailable";
            this.recordRejectedEvent(task.id, execution.id, occurredAt, {
                workerId: input.workerId,
                leaseId: input.leaseId,
                fencingToken: input.fencingToken,
                terminalStatus: input.terminalStatus,
                reasonCode,
            });
            return {
                accepted: false,
                reasonCode,
                executionId: execution.id,
                leaseId: input.leaseId,
                taskId: task.id,
                terminalStatus: input.terminalStatus,
            };
        }
        return {
            accepted: true,
            reasonCode: null,
            executionId: execution.id,
            leaseId: input.leaseId,
            taskId: task.id,
            terminalStatus: input.terminalStatus,
        };
    }
    /**
     * Refreshes a worker snapshot after an execution completes.
     *
     * Removes the completed execution from the worker's running list,
     * updates telemetry (CPU, memory, etc.), and recalculates status
     * based on remaining running executions.
     */
    refreshWorkerSnapshot(snapshot, executionId, occurredAt, telemetry = {}) {
        const runningExecutionIds = removeExecutionId(parseJsonArray(snapshot.runningExecutionsJson), executionId);
        return this.workers.recordHeartbeat({
            workerId: snapshot.workerId,
            status: toWorkerStatus(snapshot, runningExecutionIds),
            capabilities: parseJsonArray(snapshot.capabilitiesJson),
            runningExecutionIds,
            maxConcurrency: snapshot.maxConcurrency,
            queueAffinity: snapshot.queueAffinity,
            progressMessage: telemetry.progressMessage ?? null,
            ...(telemetry.runtimeInstanceId !== undefined ? { runtimeInstanceId: telemetry.runtimeInstanceId } : {}),
            ...(telemetry.restartedFromRuntimeInstanceId !== undefined
                ? { restartedFromRuntimeInstanceId: telemetry.restartedFromRuntimeInstanceId }
                : {}),
            cpuPct: telemetry.cpuPct ?? snapshot.cpuPct,
            memoryMb: telemetry.memoryMb ?? snapshot.memoryMb,
            toolBacklogCount: telemetry.toolBacklogCount ?? (runningExecutionIds.length === 0 ? 0 : snapshot.toolBacklogCount),
            currentStepId: telemetry.currentStepId === undefined ? (runningExecutionIds.length === 0 ? null : snapshot.currentStepId) : telemetry.currentStepId,
            ...(telemetry.workspaceSyncStatus !== undefined ? { workspaceSyncStatus: telemetry.workspaceSyncStatus } : {}),
            ...(telemetry.workspaceSyncCheckedAt !== undefined ? { workspaceSyncCheckedAt: telemetry.workspaceSyncCheckedAt } : {}),
            lastProgressAt: telemetry.lastProgressAt ??
                (telemetry.progressMessage ? occurredAt : runningExecutionIds.length === 0 ? occurredAt : snapshot.lastProgressAt),
            occurredAt,
        });
    }
    /**
     * Records an event when a writeback is rejected.
     *
     * Emits a tier-2 event with details about the rejection for
     * observability and debugging.
     */
    recordRejectedEvent(taskId, executionId, occurredAt, payload) {
        const execution = this.store.dispatch.getExecution(executionId);
        this.store.event.insertEvent({
            id: newId("evt"),
            taskId,
            executionId,
            eventType: "worker:writeback_rejected",
            eventTier: "tier_2",
            payloadJson: JSON.stringify(payload),
            traceId: execution?.traceId ?? null,
            createdAt: occurredAt,
        });
    }
    /**
     * Updates or inserts an agent execution record.
     *
     * Preserves existing fields from any prior record (like planJson and
     * lastDecisionJson) while updating the current execution state,
     * progress, and telemetry.
     */
    upsertAgentExecutionRecord(execution, occurredAt, updates) {
        const record = buildAgentExecutionRecord(this.store, execution, execution.id, occurredAt, updates);
        this.store.worker.upsertAgentExecutionRecord(record);
        return record;
    }
    /**
     * Persists remote log entries from the worker.
     *
     * Writes each log entry to the store with correlation context
     * for traceability across task, execution, worker, and trace.
     */
    persistRemoteLogs(taskId, executionId, traceId, workerId, runtimeInstanceId, remoteLogs, defaultOccurredAt) {
        persistRemoteLogs(this.store, taskId, executionId, traceId, workerId, runtimeInstanceId, remoteLogs, defaultOccurredAt);
    }
}
//# sourceMappingURL=execution-worker-writeback-service.js.map