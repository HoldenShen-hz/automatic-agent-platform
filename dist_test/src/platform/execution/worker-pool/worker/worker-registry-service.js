/**
 * Worker Registry Service
 *
 * ## Overview
 *
 * Maintains the registry of workers available for task execution.
 * Used by ExecutionDispatchService to find eligible workers for dispatch.
 *
 * ## Key Concepts
 *
 * - **Worker**: Execution bearer that can be local or remote
 *   * Not to be confused with 'agent' (intelligent entity) or 'sub-agent' (collaborative entity)
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: worker}
 *
 * - **Heartbeat**: Periodic health/load report from worker
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: heartbeat}
 *
 * - **Stalled**: Process may not be dead but has no valid progress in specified time
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: stalled}
 *
 * ## Tracked State
 *
 * - Worker status: idle, busy, draining, unavailable, degraded, quarantined, offline
 * - Capabilities and capacity (maxConcurrency)
 * - Running executions and queue affinity
 * - Telemetry: CPU, memory, progress
 * - Heartbeat timestamps for stale detection
 *
 * @see Execution Dispatch Service: execution-dispatch-service.ts
 * @see Glossary: docs_zh/governance/glossary_and_terminology.md
 */
import { nowIso } from "../../../contracts/types/ids.js";
import { toWorkerSchedulingStatus } from "./worker-scheduling-status.js";
/**
 * Parses a JSON string as an array, converting all items to strings.
 * Returns empty array if parsing fails or result is not an array.
 */
function parseJsonArray(value) {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
}
/**
 * Normalizes a string array by trimming whitespace, removing empties,
 * removing duplicates, and sorting alphabetically.
 */
function normalizeStringArray(values) {
    return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))).sort();
}
function normalizeRate(value) {
    if (value == null || !Number.isFinite(value)) {
        return null;
    }
    return Math.max(0, Math.min(1, value));
}
function normalizeNonNegativeInt(value, fallback = 0) {
    if (value == null || !Number.isFinite(value)) {
        return fallback;
    }
    return Math.max(0, Math.trunc(value));
}
function normalizeNullableNonNegativeInt(value) {
    if (value == null || !Number.isFinite(value)) {
        return null;
    }
    return Math.max(0, Math.trunc(value));
}
function resolveRemoteSessionStatus(value) {
    switch (value) {
        case "connecting":
        case "connected":
        case "reconnecting":
        case "degraded":
        case "failed":
        case "viewer_only":
            return value;
        default:
            return null;
    }
}
function resolveSessionConsistencyCheckStatus(value) {
    switch (value) {
        case "unknown":
        case "passed":
        case "mismatch":
            return value;
        default:
            return null;
    }
}
function resolveWorkspaceSyncStatus(value) {
    switch (value) {
        case "unknown":
        case "aligned":
        case "conflict":
            return value;
        default:
            return null;
    }
}
/**
 * Subtracts milliseconds from an ISO timestamp, returning a new ISO timestamp.
 */
function minusMs(iso, ms) {
    return new Date(Date.parse(iso) - ms).toISOString();
}
const ISOLATION_LEVEL_ORDER = {
    standard: 0,
    hardened: 1,
    strict: 2,
};
function resolveIsolationLevel(value) {
    switch (value) {
        case "hardened":
        case "strict":
            return value;
        default:
            return "standard";
    }
}
function meetsIsolationRequirement(workerIsolationLevel, requiredIsolationLevel) {
    return ISOLATION_LEVEL_ORDER[workerIsolationLevel] >= ISOLATION_LEVEL_ORDER[requiredIsolationLevel];
}
function resolveRestartSemantics(existing, input) {
    const runtimeInstanceId = input.runtimeInstanceId === undefined ? (existing?.runtimeInstanceId ?? null) : input.runtimeInstanceId;
    const priorRuntimeInstanceId = existing?.runtimeInstanceId ?? null;
    const runtimeInstanceChanged = existing !== null &&
        runtimeInstanceId !== null &&
        priorRuntimeInstanceId !== null &&
        runtimeInstanceId !== priorRuntimeInstanceId;
    if (runtimeInstanceChanged) {
        return {
            runtimeInstanceId,
            restartedFromRuntimeInstanceId: input.restartedFromRuntimeInstanceId === undefined
                ? priorRuntimeInstanceId
                : input.restartedFromRuntimeInstanceId,
            restartGeneration: (existing?.restartGeneration ?? 0) + 1,
        };
    }
    return {
        runtimeInstanceId,
        restartedFromRuntimeInstanceId: input.restartedFromRuntimeInstanceId === undefined
            ? (existing?.restartedFromRuntimeInstanceId ?? null)
            : input.restartedFromRuntimeInstanceId,
        restartGeneration: existing?.restartGeneration ?? 0,
    };
}
/**
 * Service for managing the worker registry.
 *
 * Provides an in-memory view of worker state derived from persisted snapshots.
 * Handles heartbeat recording, worker queries, and eligibility filtering.
 */
export class WorkerRegistryService {
    store;
    /**
     * Creates a new WorkerRegistryService instance.
     * @param store - AuthoritativeTaskStore for persisting worker snapshots
     */
    constructor(store) {
        this.store = store;
    }
    /**
     * Records a heartbeat from a worker, updating its snapshot in the registry.
     *
     * Creates a new snapshot if the worker is new, or updates existing snapshot.
     * Telemetry fields (cpuPct, memoryMb, etc.) are merged with existing values
     * if not explicitly provided. The lastProgressAt timestamp is only updated
     * if a new progressMessage is provided.
     *
     * @param input - Heartbeat data from the worker
     * @returns The updated worker view
     */
    recordHeartbeat(input) {
        const occurredAt = input.occurredAt ?? nowIso();
        const existing = this.store.worker.getWorkerSnapshot(input.workerId) ?? null;
        const restartSemantics = resolveRestartSemantics(existing ?? null, input);
        const placement = input.placement ?? existing?.placement ?? "local";
        const remoteSessionStatus = placement === "remote"
            ? resolveRemoteSessionStatus(input.remoteSessionStatus === undefined ? (existing?.remoteSessionStatus ?? null) : input.remoteSessionStatus)
            : null;
        // Build snapshot record, merging with existing telemetry values where not provided
        const record = {
            workerId: input.workerId,
            status: input.status,
            placement,
            isolationLevel: resolveIsolationLevel(input.isolationLevel ?? existing?.isolationLevel ?? "standard"),
            repoVersion: input.repoVersion === undefined ? (existing?.repoVersion ?? null) : input.repoVersion,
            remoteSessionStatus,
            lastAcknowledgedStreamOffset: placement === "remote"
                ? input.lastAcknowledgedStreamOffset === undefined
                    ? (existing?.lastAcknowledgedStreamOffset ?? null)
                    : input.lastAcknowledgedStreamOffset
                : null,
            streamResumeSuccessRate: placement === "remote"
                ? normalizeRate(input.streamResumeSuccessRate === undefined
                    ? (existing?.streamResumeSuccessRate ?? null)
                    : input.streamResumeSuccessRate)
                : null,
            credentialRefreshSuccessRate: placement === "remote"
                ? normalizeRate(input.credentialRefreshSuccessRate === undefined
                    ? (existing?.credentialRefreshSuccessRate ?? null)
                    : input.credentialRefreshSuccessRate)
                : null,
            sessionConsistencyCheckStatus: placement === "remote"
                ? resolveSessionConsistencyCheckStatus(input.sessionConsistencyCheckStatus === undefined
                    ? (existing?.sessionConsistencyCheckStatus ?? null)
                    : input.sessionConsistencyCheckStatus)
                : null,
            sessionConsistencyCheckedAt: placement === "remote"
                ? input.sessionConsistencyCheckedAt === undefined
                    ? (existing?.sessionConsistencyCheckedAt ?? null)
                    : input.sessionConsistencyCheckedAt
                : null,
            workspaceSyncStatus: placement === "remote"
                ? resolveWorkspaceSyncStatus(input.workspaceSyncStatus === undefined ? (existing?.workspaceSyncStatus ?? null) : input.workspaceSyncStatus)
                : null,
            workspaceSyncCheckedAt: placement === "remote"
                ? input.workspaceSyncCheckedAt === undefined
                    ? (existing?.workspaceSyncCheckedAt ?? null)
                    : input.workspaceSyncCheckedAt
                : null,
            saturation: normalizeRate(input.saturation === undefined ? (existing?.saturation ?? null) : input.saturation),
            activeLeaseCount: normalizeNonNegativeInt(input.activeLeaseCount === undefined ? (existing?.activeLeaseCount ?? 0) : input.activeLeaseCount),
            meanStartupLatencyMs: input.meanStartupLatencyMs === undefined
                ? (existing?.meanStartupLatencyMs ?? null)
                : normalizeNullableNonNegativeInt(input.meanStartupLatencyMs),
            sandboxSuccessRate: normalizeRate(input.sandboxSuccessRate === undefined ? (existing?.sandboxSuccessRate ?? null) : input.sandboxSuccessRate),
            repoCacheHitRate: placement === "remote"
                ? normalizeRate(input.repoCacheHitRate === undefined ? (existing?.repoCacheHitRate ?? null) : input.repoCacheHitRate)
                : null,
            registrationVerifiedAt: placement === "remote"
                ? input.registrationVerifiedAt === undefined
                    ? (existing?.registrationVerifiedAt ?? null)
                    : input.registrationVerifiedAt
                : null,
            registrationChallengeId: placement === "remote"
                ? input.registrationChallengeId === undefined
                    ? (existing?.registrationChallengeId ?? null)
                    : input.registrationChallengeId
                : null,
            capabilitiesJson: JSON.stringify(normalizeStringArray(input.capabilities)),
            runningExecutionsJson: JSON.stringify(normalizeStringArray(input.runningExecutionIds)),
            maxConcurrency: input.maxConcurrency,
            queueAffinity: input.queueAffinity ?? null,
            runtimeInstanceId: restartSemantics.runtimeInstanceId,
            restartedFromRuntimeInstanceId: restartSemantics.restartedFromRuntimeInstanceId,
            restartGeneration: restartSemantics.restartGeneration,
            // Preserve existing telemetry if not provided
            cpuPct: input.cpuPct ?? existing?.cpuPct ?? null,
            memoryMb: input.memoryMb ?? existing?.memoryMb ?? null,
            toolBacklogCount: Math.max(0, Math.trunc(input.toolBacklogCount ?? existing?.toolBacklogCount ?? 0)),
            currentStepId: input.currentStepId === undefined ? (existing?.currentStepId ?? null) : input.currentStepId,
            // Update lastProgressAt only if new progress message provided
            lastProgressAt: input.lastProgressAt ?? (input.progressMessage ? occurredAt : existing?.lastProgressAt ?? null),
            lastHeartbeatAt: occurredAt,
            updatedAt: occurredAt,
        };
        this.store.worker.upsertWorkerSnapshot(record);
        return this.toView(record);
    }
    verifyRemoteWorkerRegistration(input) {
        const occurredAt = input.occurredAt ?? nowIso();
        const existing = this.store.worker.getWorkerSnapshot(input.workerId) ?? null;
        return this.recordHeartbeat({
            workerId: input.workerId,
            status: existing?.status ?? "idle",
            placement: "remote",
            isolationLevel: input.isolationLevel ?? existing?.isolationLevel ?? "standard",
            repoVersion: input.repoVersion === undefined ? (existing?.repoVersion ?? null) : input.repoVersion,
            remoteSessionStatus: input.remoteSessionStatus === undefined ? (existing?.remoteSessionStatus ?? "connected") : input.remoteSessionStatus,
            lastAcknowledgedStreamOffset: input.lastAcknowledgedStreamOffset === undefined
                ? (existing?.lastAcknowledgedStreamOffset ?? null)
                : input.lastAcknowledgedStreamOffset,
            sessionConsistencyCheckStatus: input.sessionConsistencyCheckStatus === undefined
                ? (existing?.sessionConsistencyCheckStatus ?? null)
                : input.sessionConsistencyCheckStatus,
            sessionConsistencyCheckedAt: input.sessionConsistencyCheckedAt === undefined
                ? (existing?.sessionConsistencyCheckedAt ?? null)
                : input.sessionConsistencyCheckedAt,
            workspaceSyncStatus: input.workspaceSyncStatus === undefined ? (existing?.workspaceSyncStatus ?? null) : input.workspaceSyncStatus,
            workspaceSyncCheckedAt: input.workspaceSyncCheckedAt === undefined ? (existing?.workspaceSyncCheckedAt ?? null) : input.workspaceSyncCheckedAt,
            capabilities: input.capabilities,
            runningExecutionIds: parseJsonArray(existing?.runningExecutionsJson ?? "[]"),
            maxConcurrency: input.maxConcurrency,
            queueAffinity: input.queueAffinity === undefined ? (existing?.queueAffinity ?? null) : input.queueAffinity,
            runtimeInstanceId: input.runtimeInstanceId === undefined ? (existing?.runtimeInstanceId ?? null) : input.runtimeInstanceId,
            restartedFromRuntimeInstanceId: input.restartedFromRuntimeInstanceId === undefined
                ? (existing?.restartedFromRuntimeInstanceId ?? null)
                : input.restartedFromRuntimeInstanceId,
            registrationVerifiedAt: input.registrationVerifiedAt ?? occurredAt,
            registrationChallengeId: input.registrationChallengeId,
            occurredAt,
        });
    }
    /**
     * Retrieves a single worker by ID.
     * @param workerId - The worker to look up
     * @returns Worker view if found, null otherwise
     */
    getWorker(workerId) {
        const record = this.store.worker.getWorkerSnapshot(workerId);
        return record ? this.toView(record) : null;
    }
    /**
     * Lists all registered workers.
     * @returns Array of all worker views
     */
    listWorkers() {
        return this.store.worker.listWorkerSnapshots().map((record) => this.toView(record));
    }
    /**
     * Lists workers eligible to handle a task with specific requirements.
     *
     * Filters out workers that are:
     * - unavailable or draining (administrative states)
     * - degraded (unless includeDegraded is true)
     * - at capacity (availableSlots <= 0)
     * - queue affinity mismatch
     * - missing required capabilities
     *
     * @param options - Filtering options including capabilities, queue, and degraded flag
     * @returns Array of eligible worker views (unfiltered list)
     */
    listEligibleWorkers(options = {}) {
        const requiredCapabilities = normalizeStringArray(options.requiredCapabilities ?? []);
        const requiredIsolationLevel = resolveIsolationLevel(options.requiredIsolationLevel ?? "standard");
        const queueAffinity = options.queueAffinity ?? null;
        return this.listWorkers().filter((worker) => {
            // Administrative states are never eligible
            if (worker.status === "unavailable" || worker.status === "quarantined" || worker.status === "offline") {
                return false;
            }
            if (worker.status === "draining") {
                return false;
            }
            if (worker.placement === "remote" && !worker.trusted) {
                return false;
            }
            // Degraded workers excluded unless explicitly requested
            if (!options.includeDegraded && worker.status === "degraded") {
                return false;
            }
            // Must have capacity for more work
            if (worker.availableSlots <= 0) {
                return false;
            }
            // Queue affinity check if worker has a preference
            if (queueAffinity && worker.queueAffinity && worker.queueAffinity !== queueAffinity) {
                return false;
            }
            if (!meetsIsolationRequirement(worker.isolationLevel, requiredIsolationLevel)) {
                return false;
            }
            // Must have all required capabilities
            return requiredCapabilities.every((capability) => worker.capabilities.includes(capability));
        });
    }
    /**
     * Lists workers whose heartbeat is stale (older than heartbeatTtlMs).
     *
     * @param now - Current timestamp to compare against
     * @param heartbeatTtlMs - Maximum age of a heartbeat in milliseconds
     * @returns Array of stale worker views
     */
    listStaleWorkers(now, heartbeatTtlMs) {
        return this.store
            .listStaleWorkerSnapshots(minusMs(now, heartbeatTtlMs))
            .map((record) => this.toView(record));
    }
    /**
     * Converts a raw worker snapshot record into a RegisteredWorkerView.
     *
     * Parses JSON-stored fields (capabilities, runningExecutions) and
     * computes availableSlots as maxConcurrency - runningExecutionIds.length.
     *
     * @param record - Raw snapshot record from storage
     * @returns Parsed and computed worker view
     */
    toView(record) {
        const runningExecutionIds = parseJsonArray(record.runningExecutionsJson);
        return {
            workerId: record.workerId,
            status: record.status,
            schedulingStatus: toWorkerSchedulingStatus(record.status),
            placement: record.placement ?? "local",
            isolationLevel: resolveIsolationLevel(record.isolationLevel ?? "standard"),
            repoVersion: record.repoVersion ?? null,
            remoteSessionStatus: resolveRemoteSessionStatus(record.remoteSessionStatus ?? null),
            lastAcknowledgedStreamOffset: record.lastAcknowledgedStreamOffset ?? null,
            streamResumeSuccessRate: normalizeRate(record.streamResumeSuccessRate ?? null),
            credentialRefreshSuccessRate: normalizeRate(record.credentialRefreshSuccessRate ?? null),
            sessionConsistencyCheckStatus: resolveSessionConsistencyCheckStatus(record.sessionConsistencyCheckStatus ?? null),
            sessionConsistencyCheckedAt: record.sessionConsistencyCheckedAt ?? null,
            workspaceSyncStatus: resolveWorkspaceSyncStatus(record.workspaceSyncStatus ?? null),
            workspaceSyncCheckedAt: record.workspaceSyncCheckedAt ?? null,
            saturation: normalizeRate(record.saturation ?? null),
            activeLeaseCount: normalizeNonNegativeInt(record.activeLeaseCount ?? 0),
            meanStartupLatencyMs: normalizeNullableNonNegativeInt(record.meanStartupLatencyMs),
            sandboxSuccessRate: normalizeRate(record.sandboxSuccessRate ?? null),
            repoCacheHitRate: normalizeRate(record.repoCacheHitRate ?? null),
            registrationVerifiedAt: record.registrationVerifiedAt ?? null,
            registrationChallengeId: record.registrationChallengeId ?? null,
            trusted: (record.placement ?? "local") !== "remote" || record.registrationVerifiedAt != null,
            capabilities: parseJsonArray(record.capabilitiesJson),
            runningExecutionIds,
            maxConcurrency: record.maxConcurrency,
            queueAffinity: record.queueAffinity,
            runtimeInstanceId: record.runtimeInstanceId,
            restartedFromRuntimeInstanceId: record.restartedFromRuntimeInstanceId,
            restartGeneration: record.restartGeneration,
            cpuPct: record.cpuPct,
            memoryMb: record.memoryMb,
            toolBacklogCount: record.toolBacklogCount,
            currentStepId: record.currentStepId,
            lastProgressAt: record.lastProgressAt,
            lastHeartbeatAt: record.lastHeartbeatAt,
            updatedAt: record.updatedAt,
            // Available slots = capacity minus current workload
            availableSlots: Math.max(record.maxConcurrency - runningExecutionIds.length, 0),
        };
    }
}
//# sourceMappingURL=worker-registry-service.js.map