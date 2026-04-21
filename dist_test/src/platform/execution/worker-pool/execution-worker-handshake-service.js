import { newId, nowIso } from "../../contracts/types/ids.js";
import { ExecutionLeaseService } from "../lease/execution-lease-service.js";
import { ExecutionResourceCeilingGuard } from "../dispatcher/execution-resource-ceiling-guard.js";
import { resolveRemoteAuthorityBlockReason } from "./remote-session-guard.js";
import { WorkerRegistryService } from "./worker-registry-service.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { buildAgentExecutionRecord, mergeExecutionIds, normalizeLeaseReason, parseJsonArray, persistRemoteLogs, recordRejectedEvent, toWorkerStatus, } from "./execution-worker-handshake-support.js";
const logger = new StructuredLogger({ retentionLimit: 100 });
export class ExecutionWorkerHandshakeService {
    db;
    store;
    leases;
    workers;
    resourceCeilingGuard;
    /**
     * Creates a new ExecutionWorkerHandshakeService instance.
     * @param db - SQLite database instance for transactional operations
     * @param store - AuthoritativeTaskStore for data access operations
     */
    constructor(db, store, options = {}) {
        this.db = db;
        this.store = store;
        this.leases = new ExecutionLeaseService(db, store);
        this.workers = new WorkerRegistryService(store);
        this.resourceCeilingGuard = options.resourceCeilingGuard ?? new ExecutionResourceCeilingGuard();
    }
    /**
     * Handles a worker's request to claim an execution ticket.
     *
     * Validates in order:
     * 1. Ticket exists
     * 2. Worker is registered in the system
     * 3. Ticket status is "claimed" (dispatch completed)
     * 4. Ticket is assigned to this worker
     * 5. Lease ID matches
     * 6. Write access is allowed (fencing token valid, lease active)
     * 7. Execution record exists
     *
     * On success: consumes the ticket, updates execution status to "executing",
     * records initial telemetry, and updates worker snapshot.
     *
     * @param input - Claim parameters including ticket ID, worker ID, lease, and fencing token
     * @returns Decision indicating acceptance or rejection with reason code
     */
    claimExecution(input) {
        const occurredAt = input.occurredAt ?? nowIso();
        const ticket = this.store.worker.getExecutionTicket(input.ticketId);
        if (!ticket) {
            return {
                accepted: false,
                reasonCode: "ticket_not_found",
                executionId: null,
                ticketId: input.ticketId,
                leaseId: input.leaseId,
            };
        }
        const workerSnapshot = this.store.worker.getWorkerSnapshot(input.workerId);
        if (!workerSnapshot) {
            recordRejectedEvent(this.store, "worker:claim_rejected", ticket.taskId, ticket.executionId, occurredAt, {
                ticketId: input.ticketId,
                workerId: input.workerId,
                leaseId: input.leaseId,
                reasonCode: "worker_not_registered",
            });
            return {
                accepted: false,
                reasonCode: "worker_not_registered",
                executionId: ticket.executionId,
                ticketId: ticket.id,
                leaseId: input.leaseId,
            };
        }
        if ((workerSnapshot.placement ?? "local") === "remote" && workerSnapshot.registrationVerifiedAt == null) {
            recordRejectedEvent(this.store, "worker:claim_rejected", ticket.taskId, ticket.executionId, occurredAt, {
                ticketId: input.ticketId,
                workerId: input.workerId,
                leaseId: input.leaseId,
                reasonCode: "worker_not_trusted",
            });
            return {
                accepted: false,
                reasonCode: "worker_not_trusted",
                executionId: ticket.executionId,
                ticketId: ticket.id,
                leaseId: input.leaseId,
            };
        }
        if (ticket.status !== "claimed") {
            recordRejectedEvent(this.store, "worker:claim_rejected", ticket.taskId, ticket.executionId, occurredAt, {
                ticketId: input.ticketId,
                workerId: input.workerId,
                leaseId: input.leaseId,
                reasonCode: "ticket_not_claimed",
            });
            return {
                accepted: false,
                reasonCode: "ticket_not_claimed",
                executionId: ticket.executionId,
                ticketId: ticket.id,
                leaseId: input.leaseId,
            };
        }
        if (ticket.assignedWorkerId !== input.workerId) {
            recordRejectedEvent(this.store, "worker:claim_rejected", ticket.taskId, ticket.executionId, occurredAt, {
                ticketId: input.ticketId,
                workerId: input.workerId,
                leaseId: input.leaseId,
                reasonCode: "worker_mismatch",
            });
            return {
                accepted: false,
                reasonCode: "worker_mismatch",
                executionId: ticket.executionId,
                ticketId: ticket.id,
                leaseId: input.leaseId,
            };
        }
        if (ticket.leaseId !== input.leaseId) {
            recordRejectedEvent(this.store, "worker:claim_rejected", ticket.taskId, ticket.executionId, occurredAt, {
                ticketId: input.ticketId,
                workerId: input.workerId,
                leaseId: input.leaseId,
                reasonCode: "lease_mismatch",
            });
            return {
                accepted: false,
                reasonCode: "lease_mismatch",
                executionId: ticket.executionId,
                ticketId: ticket.id,
                leaseId: input.leaseId,
            };
        }
        const validation = this.leases.validateWriteAccess({
            executionId: ticket.executionId,
            workerId: input.workerId,
            fencingToken: input.fencingToken,
            leaseId: input.leaseId,
            occurredAt,
        });
        if (!validation.allowed) {
            recordRejectedEvent(this.store, "worker:claim_rejected", ticket.taskId, ticket.executionId, occurredAt, {
                ticketId: input.ticketId,
                workerId: input.workerId,
                leaseId: input.leaseId,
                reasonCode: validation.reasonCode,
            });
            return {
                accepted: false,
                reasonCode: validation.reasonCode,
                executionId: ticket.executionId,
                ticketId: ticket.id,
                leaseId: input.leaseId,
            };
        }
        const remoteAuthorityBlockReason = resolveRemoteAuthorityBlockReason({
            placement: workerSnapshot.placement ?? null,
            remoteSessionStatus: input.remoteSessionStatus === undefined ? (workerSnapshot.remoteSessionStatus ?? null) : input.remoteSessionStatus,
            lastAcknowledgedStreamOffset: input.lastAcknowledgedStreamOffset === undefined
                ? (workerSnapshot.lastAcknowledgedStreamOffset ?? null)
                : input.lastAcknowledgedStreamOffset,
            sessionConsistencyCheckStatus: input.sessionConsistencyCheckStatus === undefined
                ? (workerSnapshot.sessionConsistencyCheckStatus ?? null)
                : input.sessionConsistencyCheckStatus,
            workspaceSyncStatus: input.workspaceSyncStatus === undefined ? (workerSnapshot.workspaceSyncStatus ?? null) : input.workspaceSyncStatus,
        });
        if (remoteAuthorityBlockReason) {
            recordRejectedEvent(this.store, "worker:claim_rejected", ticket.taskId, ticket.executionId, occurredAt, {
                ticketId: input.ticketId,
                workerId: input.workerId,
                leaseId: input.leaseId,
                remoteSessionStatus: input.remoteSessionStatus === undefined ? (workerSnapshot.remoteSessionStatus ?? null) : input.remoteSessionStatus,
                lastAcknowledgedStreamOffset: input.lastAcknowledgedStreamOffset === undefined
                    ? (workerSnapshot.lastAcknowledgedStreamOffset ?? null)
                    : input.lastAcknowledgedStreamOffset,
                sessionConsistencyCheckStatus: input.sessionConsistencyCheckStatus === undefined
                    ? (workerSnapshot.sessionConsistencyCheckStatus ?? null)
                    : input.sessionConsistencyCheckStatus,
                workspaceSyncStatus: input.workspaceSyncStatus === undefined ? (workerSnapshot.workspaceSyncStatus ?? null) : input.workspaceSyncStatus,
                reasonCode: remoteAuthorityBlockReason,
            });
            return {
                accepted: false,
                reasonCode: remoteAuthorityBlockReason,
                executionId: ticket.executionId,
                ticketId: ticket.id,
                leaseId: input.leaseId,
            };
        }
        const execution = this.store.dispatch.getExecution(ticket.executionId);
        if (!execution) {
            return {
                accepted: false,
                reasonCode: "execution_not_found",
                executionId: ticket.executionId,
                ticketId: ticket.id,
                leaseId: input.leaseId,
            };
        }
        const claimResourceFinding = this.resourceCeilingGuard.firstFinding({
            executionId: execution.id,
            taskId: execution.taskId,
            agentId: input.workerId,
            status: execution.status,
            runtimeInstanceId: input.runtimeInstanceId ?? workerSnapshot.runtimeInstanceId ?? null,
            currentStepId: input.currentStepId ?? null,
            toolCallCount: input.toolCallCount ?? 0,
            memoryMb: input.memoryMb ?? workerSnapshot.memoryMb ?? null,
            startedAt: execution.startedAt ?? execution.createdAt,
            now: occurredAt,
        });
        if (claimResourceFinding) {
            recordRejectedEvent(this.store, "worker:claim_rejected", ticket.taskId, ticket.executionId, occurredAt, {
                ticketId: input.ticketId,
                workerId: input.workerId,
                leaseId: input.leaseId,
                reasonCode: "resource_limit_exceeded",
                resourceLimit: claimResourceFinding,
            });
            return {
                accepted: false,
                reasonCode: "resource_limit_exceeded",
                executionId: ticket.executionId,
                ticketId: ticket.id,
                leaseId: input.leaseId,
            };
        }
        this.db.transaction(() => {
            this.store.worker.consumeExecutionTicket(ticket.id, occurredAt);
            this.store.execution.updateExecutionAgent(execution.id, input.workerId, occurredAt);
            if (execution.status === "created" || execution.status === "prechecking" || execution.status === "blocked") {
                this.store.execution.updateExecutionStatus(execution.id, "executing", occurredAt, occurredAt, null, null);
            }
            const workerView = this.refreshWorkerSnapshot(workerSnapshot, execution.id, occurredAt, {
                progressMessage: input.progressMessage ?? null,
                ...(input.runtimeInstanceId !== undefined ? { runtimeInstanceId: input.runtimeInstanceId } : {}),
                ...(input.restartedFromRuntimeInstanceId !== undefined
                    ? { restartedFromRuntimeInstanceId: input.restartedFromRuntimeInstanceId }
                    : {}),
                cpuPct: input.cpuPct ?? null,
                memoryMb: input.memoryMb ?? null,
                ...(input.remoteSessionStatus !== undefined ? { remoteSessionStatus: input.remoteSessionStatus } : {}),
                ...(input.lastAcknowledgedStreamOffset !== undefined
                    ? { lastAcknowledgedStreamOffset: input.lastAcknowledgedStreamOffset }
                    : {}),
                ...(input.streamResumeSuccessRate !== undefined ? { streamResumeSuccessRate: input.streamResumeSuccessRate } : {}),
                ...(input.credentialRefreshSuccessRate !== undefined
                    ? { credentialRefreshSuccessRate: input.credentialRefreshSuccessRate }
                    : {}),
                ...(input.sessionConsistencyCheckStatus !== undefined
                    ? { sessionConsistencyCheckStatus: input.sessionConsistencyCheckStatus }
                    : {}),
                ...(input.sessionConsistencyCheckedAt !== undefined
                    ? { sessionConsistencyCheckedAt: input.sessionConsistencyCheckedAt }
                    : {}),
                ...(input.workspaceSyncStatus !== undefined ? { workspaceSyncStatus: input.workspaceSyncStatus } : {}),
                ...(input.workspaceSyncCheckedAt !== undefined ? { workspaceSyncCheckedAt: input.workspaceSyncCheckedAt } : {}),
                ...(input.saturation !== undefined ? { saturation: input.saturation } : {}),
                ...(input.activeLeaseCount !== undefined ? { activeLeaseCount: input.activeLeaseCount } : {}),
                ...(input.meanStartupLatencyMs !== undefined ? { meanStartupLatencyMs: input.meanStartupLatencyMs } : {}),
                ...(input.sandboxSuccessRate !== undefined ? { sandboxSuccessRate: input.sandboxSuccessRate } : {}),
                ...(input.repoCacheHitRate !== undefined ? { repoCacheHitRate: input.repoCacheHitRate } : {}),
                ...(input.toolBacklogCount !== undefined ? { toolBacklogCount: input.toolBacklogCount } : {}),
                ...(input.currentStepId !== undefined ? { currentStepId: input.currentStepId } : {}),
                ...(input.lastProgressAt !== undefined ? { lastProgressAt: input.lastProgressAt } : {}),
            });
            this.store.worker.insertHeartbeatSnapshot({
                id: newId("hb"),
                executionId: execution.id,
                agentId: input.workerId,
                runtimeInstanceId: workerView.runtimeInstanceId,
                restartGeneration: workerView.restartGeneration,
                status: "executing",
                progressMessage: input.progressMessage ?? "worker claim accepted",
                cpuPct: input.cpuPct ?? null,
                memoryMb: input.memoryMb ?? null,
                sampledAt: occurredAt,
            });
            this.upsertAgentExecutionRecord(execution, occurredAt, {
                agentId: input.workerId,
                runtimeInstanceId: workerView.runtimeInstanceId,
                restartedFromRuntimeInstanceId: workerView.restartedFromRuntimeInstanceId,
                restartGeneration: workerView.restartGeneration,
                status: "executing",
                currentStepId: input.currentStepId === undefined ? (this.store.worker.getAgentExecutionRecord(execution.id)?.currentStepId ?? null) : input.currentStepId,
                lastToolName: input.lastToolName === undefined ? (this.store.worker.getAgentExecutionRecord(execution.id)?.lastToolName ?? null) : input.lastToolName,
                toolCallCount: input.toolCallCount === undefined
                    ? (this.store.worker.getAgentExecutionRecord(execution.id)?.toolCallCount ?? 0)
                    : input.toolCallCount,
                progressMessage: input.progressMessage ?? "worker claim accepted",
                lastErrorCode: execution.lastErrorCode,
                startedAt: occurredAt,
                completedAt: null,
            });
            this.store.event.insertEvent({
                id: newId("evt"),
                taskId: execution.taskId,
                executionId: execution.id,
                eventType: "worker:claim_accepted",
                eventTier: "tier_2",
                payloadJson: JSON.stringify({
                    ticketId: ticket.id,
                    workerId: input.workerId,
                    leaseId: input.leaseId,
                    fencingToken: input.fencingToken,
                }),
                traceId: execution.traceId,
                createdAt: occurredAt,
            });
            persistRemoteLogs(this.store, execution.taskId, execution.id, execution.traceId, input.workerId, workerView.runtimeInstanceId, input.remoteLogs, occurredAt);
        });
        return {
            accepted: true,
            reasonCode: null,
            executionId: execution.id,
            ticketId: ticket.id,
            leaseId: input.leaseId,
        };
    }
    /**
     * Records a heartbeat from a worker during execution.
     *
     * Validates:
     * 1. Execution exists
     * 2. Worker is registered
     * 3. Write access is allowed (fencing token and lease valid)
     * 4. Lease can be renewed
     *
     * On success: extends the lease TTL, records telemetry, and updates worker snapshot.
     *
     * @param input - Heartbeat parameters including execution ID, worker, lease, and telemetry
     * @returns Decision indicating acceptance or rejection with reason code
     */
    recordHeartbeat(input) {
        const occurredAt = input.occurredAt ?? nowIso();
        const execution = this.store.dispatch.getExecution(input.executionId);
        if (!execution) {
            return {
                accepted: false,
                reasonCode: "execution_not_found",
                executionId: input.executionId,
                ticketId: null,
                leaseId: input.leaseId,
            };
        }
        const workerSnapshot = this.store.worker.getWorkerSnapshot(input.workerId);
        if (!workerSnapshot) {
            recordRejectedEvent(this.store, "worker:heartbeat_rejected", execution.taskId, execution.id, occurredAt, {
                workerId: input.workerId,
                leaseId: input.leaseId,
                reasonCode: "worker_not_registered",
            });
            return {
                accepted: false,
                reasonCode: "worker_not_registered",
                executionId: input.executionId,
                ticketId: null,
                leaseId: input.leaseId,
            };
        }
        if ((workerSnapshot.placement ?? "local") === "remote" && workerSnapshot.registrationVerifiedAt == null) {
            recordRejectedEvent(this.store, "worker:heartbeat_rejected", execution.taskId, execution.id, occurredAt, {
                workerId: input.workerId,
                leaseId: input.leaseId,
                reasonCode: "worker_not_trusted",
            });
            return {
                accepted: false,
                reasonCode: "worker_not_trusted",
                executionId: input.executionId,
                ticketId: null,
                leaseId: input.leaseId,
            };
        }
        const validation = this.leases.validateWriteAccess({
            executionId: input.executionId,
            workerId: input.workerId,
            fencingToken: input.fencingToken,
            leaseId: input.leaseId,
            occurredAt,
        });
        if (!validation.allowed) {
            recordRejectedEvent(this.store, "worker:heartbeat_rejected", execution.taskId, execution.id, occurredAt, {
                workerId: input.workerId,
                leaseId: input.leaseId,
                reasonCode: validation.reasonCode,
            });
            return {
                accepted: false,
                reasonCode: validation.reasonCode,
                executionId: input.executionId,
                ticketId: null,
                leaseId: input.leaseId,
            };
        }
        const remoteAuthorityBlockReason = resolveRemoteAuthorityBlockReason({
            placement: workerSnapshot.placement ?? null,
            remoteSessionStatus: input.remoteSessionStatus === undefined ? (workerSnapshot.remoteSessionStatus ?? null) : input.remoteSessionStatus,
            lastAcknowledgedStreamOffset: input.lastAcknowledgedStreamOffset === undefined
                ? (workerSnapshot.lastAcknowledgedStreamOffset ?? null)
                : input.lastAcknowledgedStreamOffset,
            sessionConsistencyCheckStatus: input.sessionConsistencyCheckStatus === undefined
                ? (workerSnapshot.sessionConsistencyCheckStatus ?? null)
                : input.sessionConsistencyCheckStatus,
            workspaceSyncStatus: input.workspaceSyncStatus === undefined ? (workerSnapshot.workspaceSyncStatus ?? null) : input.workspaceSyncStatus,
        });
        if (remoteAuthorityBlockReason) {
            recordRejectedEvent(this.store, "worker:heartbeat_rejected", execution.taskId, execution.id, occurredAt, {
                workerId: input.workerId,
                leaseId: input.leaseId,
                remoteSessionStatus: input.remoteSessionStatus === undefined ? (workerSnapshot.remoteSessionStatus ?? null) : input.remoteSessionStatus,
                lastAcknowledgedStreamOffset: input.lastAcknowledgedStreamOffset === undefined
                    ? (workerSnapshot.lastAcknowledgedStreamOffset ?? null)
                    : input.lastAcknowledgedStreamOffset,
                sessionConsistencyCheckStatus: input.sessionConsistencyCheckStatus === undefined
                    ? (workerSnapshot.sessionConsistencyCheckStatus ?? null)
                    : input.sessionConsistencyCheckStatus,
                workspaceSyncStatus: input.workspaceSyncStatus === undefined ? (workerSnapshot.workspaceSyncStatus ?? null) : input.workspaceSyncStatus,
                reasonCode: remoteAuthorityBlockReason,
            });
            return {
                accepted: false,
                reasonCode: remoteAuthorityBlockReason,
                executionId: input.executionId,
                ticketId: null,
                leaseId: input.leaseId,
            };
        }
        const existingAgentExecution = this.store.worker.getAgentExecutionRecord(execution.id);
        const heartbeatResourceFinding = this.resourceCeilingGuard.firstFinding({
            executionId: execution.id,
            taskId: execution.taskId,
            agentId: input.workerId,
            status: execution.status,
            runtimeInstanceId: input.runtimeInstanceId ?? existingAgentExecution?.runtimeInstanceId ?? workerSnapshot.runtimeInstanceId ?? null,
            currentStepId: input.currentStepId === undefined ? (existingAgentExecution?.currentStepId ?? null) : input.currentStepId,
            toolCallCount: input.toolCallCount === undefined ? (existingAgentExecution?.toolCallCount ?? 0) : input.toolCallCount,
            memoryMb: input.memoryMb ?? workerSnapshot.memoryMb ?? null,
            startedAt: existingAgentExecution?.startedAt ?? execution.startedAt ?? execution.createdAt,
            now: occurredAt,
        });
        if (heartbeatResourceFinding) {
            if (existingAgentExecution) {
                this.upsertAgentExecutionRecord(execution, occurredAt, {
                    agentId: input.workerId,
                    runtimeInstanceId: input.runtimeInstanceId ?? existingAgentExecution.runtimeInstanceId ?? workerSnapshot.runtimeInstanceId ?? null,
                    restartedFromRuntimeInstanceId: input.restartedFromRuntimeInstanceId ?? existingAgentExecution.restartedFromRuntimeInstanceId ?? null,
                    restartGeneration: existingAgentExecution.restartGeneration,
                    status: execution.status,
                    currentStepId: input.currentStepId === undefined ? existingAgentExecution.currentStepId : input.currentStepId,
                    lastToolName: input.lastToolName === undefined ? existingAgentExecution.lastToolName : input.lastToolName,
                    toolCallCount: input.toolCallCount === undefined ? existingAgentExecution.toolCallCount : input.toolCallCount,
                    progressMessage: input.progressMessage ?? existingAgentExecution.progressMessage,
                    lastErrorCode: heartbeatResourceFinding.reasonCode,
                });
            }
            recordRejectedEvent(this.store, "worker:heartbeat_rejected", execution.taskId, execution.id, occurredAt, {
                workerId: input.workerId,
                leaseId: input.leaseId,
                reasonCode: "resource_limit_exceeded",
                resourceLimit: heartbeatResourceFinding,
            });
            return {
                accepted: false,
                reasonCode: "resource_limit_exceeded",
                executionId: input.executionId,
                ticketId: null,
                leaseId: input.leaseId,
            };
        }
        const renewal = this.leases.renewLease({
            leaseId: input.leaseId,
            workerId: input.workerId,
            ttlMs: input.ttlMs,
            occurredAt,
        });
        if (renewal.outcome !== "renewed") {
            const reasonCode = normalizeLeaseReason(renewal.reasonCode);
            recordRejectedEvent(this.store, "worker:heartbeat_rejected", execution.taskId, execution.id, occurredAt, {
                workerId: input.workerId,
                leaseId: input.leaseId,
                reasonCode,
            });
            return {
                accepted: false,
                reasonCode,
                executionId: input.executionId,
                ticketId: null,
                leaseId: input.leaseId,
            };
        }
        this.db.transaction(() => {
            const workerView = this.refreshWorkerSnapshot(workerSnapshot, input.executionId, occurredAt, {
                progressMessage: input.progressMessage ?? null,
                ...(input.runtimeInstanceId !== undefined ? { runtimeInstanceId: input.runtimeInstanceId } : {}),
                ...(input.restartedFromRuntimeInstanceId !== undefined
                    ? { restartedFromRuntimeInstanceId: input.restartedFromRuntimeInstanceId }
                    : {}),
                cpuPct: input.cpuPct ?? null,
                memoryMb: input.memoryMb ?? null,
                ...(input.remoteSessionStatus !== undefined ? { remoteSessionStatus: input.remoteSessionStatus } : {}),
                ...(input.lastAcknowledgedStreamOffset !== undefined
                    ? { lastAcknowledgedStreamOffset: input.lastAcknowledgedStreamOffset }
                    : {}),
                ...(input.streamResumeSuccessRate !== undefined ? { streamResumeSuccessRate: input.streamResumeSuccessRate } : {}),
                ...(input.credentialRefreshSuccessRate !== undefined
                    ? { credentialRefreshSuccessRate: input.credentialRefreshSuccessRate }
                    : {}),
                ...(input.sessionConsistencyCheckStatus !== undefined
                    ? { sessionConsistencyCheckStatus: input.sessionConsistencyCheckStatus }
                    : {}),
                ...(input.sessionConsistencyCheckedAt !== undefined
                    ? { sessionConsistencyCheckedAt: input.sessionConsistencyCheckedAt }
                    : {}),
                ...(input.workspaceSyncStatus !== undefined ? { workspaceSyncStatus: input.workspaceSyncStatus } : {}),
                ...(input.workspaceSyncCheckedAt !== undefined ? { workspaceSyncCheckedAt: input.workspaceSyncCheckedAt } : {}),
                ...(input.saturation !== undefined ? { saturation: input.saturation } : {}),
                ...(input.activeLeaseCount !== undefined ? { activeLeaseCount: input.activeLeaseCount } : {}),
                ...(input.meanStartupLatencyMs !== undefined ? { meanStartupLatencyMs: input.meanStartupLatencyMs } : {}),
                ...(input.sandboxSuccessRate !== undefined ? { sandboxSuccessRate: input.sandboxSuccessRate } : {}),
                ...(input.repoCacheHitRate !== undefined ? { repoCacheHitRate: input.repoCacheHitRate } : {}),
                ...(input.toolBacklogCount !== undefined ? { toolBacklogCount: input.toolBacklogCount } : {}),
                ...(input.currentStepId !== undefined ? { currentStepId: input.currentStepId } : {}),
                ...(input.lastProgressAt !== undefined ? { lastProgressAt: input.lastProgressAt } : {}),
            });
            this.store.worker.insertHeartbeatSnapshot({
                id: newId("hb"),
                executionId: input.executionId,
                agentId: input.workerId,
                runtimeInstanceId: workerView.runtimeInstanceId,
                restartGeneration: workerView.restartGeneration,
                status: execution.status,
                progressMessage: input.progressMessage ?? "heartbeat recorded",
                cpuPct: input.cpuPct ?? null,
                memoryMb: input.memoryMb ?? null,
                sampledAt: occurredAt,
            });
            this.upsertAgentExecutionRecord(execution, occurredAt, {
                agentId: input.workerId,
                runtimeInstanceId: workerView.runtimeInstanceId,
                restartedFromRuntimeInstanceId: workerView.restartedFromRuntimeInstanceId,
                restartGeneration: workerView.restartGeneration,
                status: execution.status,
                currentStepId: input.currentStepId === undefined ? (this.store.worker.getAgentExecutionRecord(execution.id)?.currentStepId ?? null) : input.currentStepId,
                lastToolName: input.lastToolName === undefined ? (this.store.worker.getAgentExecutionRecord(execution.id)?.lastToolName ?? null) : input.lastToolName,
                toolCallCount: input.toolCallCount === undefined
                    ? (this.store.worker.getAgentExecutionRecord(execution.id)?.toolCallCount ?? 0)
                    : input.toolCallCount,
                progressMessage: input.progressMessage ?? "heartbeat recorded",
                lastErrorCode: execution.lastErrorCode,
            });
            this.store.event.insertEvent({
                id: newId("evt"),
                taskId: execution.taskId,
                executionId: execution.id,
                eventType: "worker:heartbeat_recorded",
                eventTier: "tier_2",
                payloadJson: JSON.stringify({
                    workerId: input.workerId,
                    leaseId: input.leaseId,
                    fencingToken: input.fencingToken,
                    ttlMs: input.ttlMs,
                }),
                traceId: execution.traceId,
                createdAt: occurredAt,
            });
            persistRemoteLogs(this.store, execution.taskId, execution.id, execution.traceId, input.workerId, workerView.runtimeInstanceId, input.remoteLogs, occurredAt);
        });
        return {
            accepted: true,
            reasonCode: null,
            executionId: input.executionId,
            ticketId: null,
            leaseId: input.leaseId,
        };
    }
    /**
     * Updates a worker's snapshot with new telemetry and running execution information.
     *
     * Adds the execution to the worker's running executions list and recalculates
     * the worker's effective status based on its base status and workload.
     *
     * @param snapshot - Current worker snapshot to update
     * @param executionId - ID of the execution being started/run
     * @param occurredAt - Timestamp of this refresh
     * @param telemetry - Updated telemetry values (optional, merges with existing)
     */
    refreshWorkerSnapshot(snapshot, executionId, occurredAt, telemetry = {}) {
        const runningExecutionIds = mergeExecutionIds(parseJsonArray(snapshot.runningExecutionsJson), executionId);
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
            ...(telemetry.remoteSessionStatus !== undefined ? { remoteSessionStatus: telemetry.remoteSessionStatus } : {}),
            ...(telemetry.lastAcknowledgedStreamOffset !== undefined
                ? { lastAcknowledgedStreamOffset: telemetry.lastAcknowledgedStreamOffset }
                : {}),
            ...(telemetry.streamResumeSuccessRate !== undefined
                ? { streamResumeSuccessRate: telemetry.streamResumeSuccessRate }
                : {}),
            ...(telemetry.credentialRefreshSuccessRate !== undefined
                ? { credentialRefreshSuccessRate: telemetry.credentialRefreshSuccessRate }
                : {}),
            ...(telemetry.sessionConsistencyCheckStatus !== undefined
                ? { sessionConsistencyCheckStatus: telemetry.sessionConsistencyCheckStatus }
                : {}),
            ...(telemetry.sessionConsistencyCheckedAt !== undefined
                ? { sessionConsistencyCheckedAt: telemetry.sessionConsistencyCheckedAt }
                : {}),
            ...(telemetry.workspaceSyncStatus !== undefined ? { workspaceSyncStatus: telemetry.workspaceSyncStatus } : {}),
            ...(telemetry.workspaceSyncCheckedAt !== undefined ? { workspaceSyncCheckedAt: telemetry.workspaceSyncCheckedAt } : {}),
            ...(telemetry.saturation !== undefined ? { saturation: telemetry.saturation } : {}),
            ...(telemetry.activeLeaseCount !== undefined ? { activeLeaseCount: telemetry.activeLeaseCount } : {}),
            ...(telemetry.meanStartupLatencyMs !== undefined ? { meanStartupLatencyMs: telemetry.meanStartupLatencyMs } : {}),
            ...(telemetry.sandboxSuccessRate !== undefined ? { sandboxSuccessRate: telemetry.sandboxSuccessRate } : {}),
            ...(telemetry.repoCacheHitRate !== undefined ? { repoCacheHitRate: telemetry.repoCacheHitRate } : {}),
            toolBacklogCount: telemetry.toolBacklogCount ?? snapshot.toolBacklogCount,
            currentStepId: telemetry.currentStepId === undefined ? snapshot.currentStepId : telemetry.currentStepId,
            lastProgressAt: telemetry.lastProgressAt ?? (telemetry.progressMessage ? occurredAt : snapshot.lastProgressAt),
            occurredAt,
        });
    }
    /**
     * Records a claim rejection event for audit purposes.
     * Used to track why a worker's claim attempt was denied.
     *
     * @param taskId - The task ID for the event
     * @param executionId - The execution ID for the event
     * @param occurredAt - Timestamp of the rejection
     * @param payload - Details about the rejection including worker, ticket, and reason
     */
    upsertAgentExecutionRecord(execution, occurredAt, updates) {
        const record = buildAgentExecutionRecord(this.store, execution, occurredAt, updates);
        this.store.worker.upsertAgentExecutionRecord(record);
        return record;
    }
}
//# sourceMappingURL=execution-worker-handshake-service.js.map