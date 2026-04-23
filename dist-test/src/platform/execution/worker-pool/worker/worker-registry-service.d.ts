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
import type { RemoteSessionStatus, SessionConsistencyCheckStatus, WorkspaceSyncStatus, WorkerIsolationLevel, WorkerPlacement, WorkerSchedulingStatus, WorkerSnapshotRecord } from "../../../contracts/types/domain.js";
import { AuthoritativeTaskStore } from "../../../state-evidence/truth/authoritative-task-store.js";
/**
 * Input data for recording a worker's heartbeat.
 * Contains all state that workers report about themselves.
 */
export interface WorkerRegistryHeartbeatInput {
    /** Unique identifier for the worker */
    workerId: string;
    /** Current operational status of the worker */
    status: WorkerSnapshotRecord["status"];
    /** Whether this worker executes locally or via a remote bridge */
    placement?: WorkerPlacement | null;
    /** The sandbox or runtime isolation strength this worker can guarantee */
    isolationLevel?: WorkerIsolationLevel | null;
    /** Repo or workspace version currently mounted by the worker */
    repoVersion?: string | null;
    /** Current remote bridge/session state when this worker is backed by a remote transport */
    remoteSessionStatus?: RemoteSessionStatus | null;
    /** Last acknowledged stream offset used for remote resume/replay */
    lastAcknowledgedStreamOffset?: string | null;
    /** Rolling success rate for remote stream resume attempts */
    streamResumeSuccessRate?: number | null;
    /** Rolling success rate for bridge credential refresh attempts */
    credentialRefreshSuccessRate?: number | null;
    /** Result of the latest reconnect/session consistency validation */
    sessionConsistencyCheckStatus?: SessionConsistencyCheckStatus | null;
    /** Timestamp when the latest reconnect/session consistency validation ran */
    sessionConsistencyCheckedAt?: string | null;
    /** Result of the latest workspace sync ownership validation */
    workspaceSyncStatus?: WorkspaceSyncStatus | null;
    /** Timestamp when the latest workspace sync ownership validation ran */
    workspaceSyncCheckedAt?: string | null;
    /** Saturation ratio in [0, 1] for this worker */
    saturation?: number | null;
    /** Number of active leases currently held by this worker */
    activeLeaseCount?: number;
    /** Rolling mean startup latency in milliseconds */
    meanStartupLatencyMs?: number | null;
    /** Rolling sandbox success rate for this worker */
    sandboxSuccessRate?: number | null;
    /** Rolling repo cache hit rate for this worker */
    repoCacheHitRate?: number | null;
    /** ISO timestamp when this remote worker was last registration-verified */
    registrationVerifiedAt?: string | null;
    /** Challenge identifier that most recently verified this remote worker */
    registrationChallengeId?: string | null;
    /** List of capabilities this worker supports */
    capabilities: string[];
    /** IDs of executions currently being run by this worker */
    runningExecutionIds: string[];
    /** Maximum number of concurrent executions this worker supports */
    maxConcurrency: number;
    /** Optional queue affinity - worker prefers executions from this queue */
    queueAffinity?: string | null;
    /** Runtime instance identifier for this worker process incarnation */
    runtimeInstanceId?: string | null;
    /** Explicit parent runtime instance when this heartbeat represents a restart */
    restartedFromRuntimeInstanceId?: string | null;
    /** Optional progress message describing current work */
    progressMessage?: string | null;
    /** Current CPU usage percentage */
    cpuPct?: number | null;
    /** Current memory usage in megabytes */
    memoryMb?: number | null;
    /** Number of tools waiting in the backlog */
    toolBacklogCount?: number;
    /** ID of the currently executing step */
    currentStepId?: string | null;
    /** ISO timestamp of last meaningful progress */
    lastProgressAt?: string | null;
    /** ISO timestamp of when the heartbeat occurred (defaults to now) */
    occurredAt?: string;
}
/**
 * Options for filtering workers when listing eligible candidates.
 */
export interface WorkerSelectionOptions {
    /** Workers must have all these capabilities */
    requiredCapabilities?: string[];
    /** Workers must meet or exceed this isolation level */
    requiredIsolationLevel?: WorkerIsolationLevel | null;
    /** Filter to workers with this queue affinity (null means any) */
    queueAffinity?: string | null;
    /** Include degraded workers in results (default: false) */
    includeDegraded?: boolean;
}
/**
 * A view of a worker's state suitable for dispatch decisions.
 * Derived from WorkerSnapshotRecord but with parsed JSON fields and computed available slots.
 */
export interface RegisteredWorkerView {
    /** Unique identifier for the worker */
    workerId: string;
    /** Current operational status */
    status: WorkerSnapshotRecord["status"];
    /** Scheduling-friendly projection of the worker's current health */
    schedulingStatus: WorkerSchedulingStatus;
    /** Whether this worker executes locally or remotely */
    placement: WorkerPlacement;
    /** The guaranteed sandbox/runtime isolation strength */
    isolationLevel: WorkerIsolationLevel;
    /** Repo or workspace version currently mounted by the worker */
    repoVersion: string | null;
    /** Current remote bridge/session state when this worker is backed by a remote transport */
    remoteSessionStatus: RemoteSessionStatus | null;
    /** Last acknowledged stream offset used for remote resume/replay */
    lastAcknowledgedStreamOffset: string | null;
    /** Rolling success rate for remote stream resume attempts */
    streamResumeSuccessRate: number | null;
    /** Rolling success rate for bridge credential refresh attempts */
    credentialRefreshSuccessRate: number | null;
    /** Result of the latest reconnect/session consistency validation */
    sessionConsistencyCheckStatus: SessionConsistencyCheckStatus | null;
    /** Timestamp when the latest reconnect/session consistency validation ran */
    sessionConsistencyCheckedAt: string | null;
    /** Result of the latest workspace sync ownership validation */
    workspaceSyncStatus: WorkspaceSyncStatus | null;
    /** Timestamp when the latest workspace sync ownership validation ran */
    workspaceSyncCheckedAt: string | null;
    /** Saturation ratio in [0, 1] */
    saturation: number | null;
    /** Number of active leases currently held by this worker */
    activeLeaseCount: number;
    /** Rolling mean startup latency in milliseconds */
    meanStartupLatencyMs: number | null;
    /** Rolling sandbox success rate */
    sandboxSuccessRate: number | null;
    /** Rolling repo cache hit rate */
    repoCacheHitRate: number | null;
    /** ISO timestamp when this remote worker last completed trusted registration */
    registrationVerifiedAt: string | null;
    /** Challenge identifier that established the current trusted registration */
    registrationChallengeId: string | null;
    /** Whether this worker can be trusted for execution ownership decisions */
    trusted: boolean;
    /** Parsed list of capabilities */
    capabilities: string[];
    /** Parsed list of running execution IDs */
    runningExecutionIds: string[];
    /** Maximum concurrent executions supported */
    maxConcurrency: number;
    /** Worker's queue affinity preference (null if none) */
    queueAffinity: string | null;
    /** Runtime instance identifier for the current worker process incarnation */
    runtimeInstanceId: string | null;
    /** Immediate parent runtime instance when this worker has restarted */
    restartedFromRuntimeInstanceId: string | null;
    /** Monotonic restart generation for this logical worker ID */
    restartGeneration: number;
    /** Current CPU usage percentage */
    cpuPct: number | null;
    /** Current memory usage in MB */
    memoryMb: number | null;
    /** Number of tools in backlog */
    toolBacklogCount: number;
    /** ID of currently executing step */
    currentStepId: string | null;
    /** ISO timestamp of last progress update */
    lastProgressAt: string | null;
    /** ISO timestamp of last heartbeat received */
    lastHeartbeatAt: string;
    /** ISO timestamp of last state update */
    updatedAt: string;
    /** Computed: maxConcurrency - runningExecutionIds.length */
    availableSlots: number;
}
export interface VerifyRemoteWorkerRegistrationInput {
    workerId: string;
    capabilities: string[];
    maxConcurrency: number;
    queueAffinity?: string | null;
    isolationLevel?: WorkerIsolationLevel | null;
    repoVersion?: string | null;
    runtimeInstanceId?: string | null;
    restartedFromRuntimeInstanceId?: string | null;
    remoteSessionStatus?: RemoteSessionStatus | null;
    lastAcknowledgedStreamOffset?: string | null;
    sessionConsistencyCheckStatus?: SessionConsistencyCheckStatus | null;
    sessionConsistencyCheckedAt?: string | null;
    workspaceSyncStatus?: WorkspaceSyncStatus | null;
    workspaceSyncCheckedAt?: string | null;
    registrationVerifiedAt?: string;
    registrationChallengeId: string;
    occurredAt?: string;
}
/**
 * Service for managing the worker registry.
 *
 * Provides an in-memory view of worker state derived from persisted snapshots.
 * Handles heartbeat recording, worker queries, and eligibility filtering.
 */
export declare class WorkerRegistryService {
    private readonly store;
    /**
     * Creates a new WorkerRegistryService instance.
     * @param store - AuthoritativeTaskStore for persisting worker snapshots
     */
    constructor(store: AuthoritativeTaskStore);
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
    recordHeartbeat(input: WorkerRegistryHeartbeatInput): RegisteredWorkerView;
    verifyRemoteWorkerRegistration(input: VerifyRemoteWorkerRegistrationInput): RegisteredWorkerView;
    /**
     * Retrieves a single worker by ID.
     * @param workerId - The worker to look up
     * @returns Worker view if found, null otherwise
     */
    getWorker(workerId: string): RegisteredWorkerView | null;
    /**
     * Lists all registered workers.
     * @returns Array of all worker views
     */
    listWorkers(): RegisteredWorkerView[];
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
    listEligibleWorkers(options?: WorkerSelectionOptions): RegisteredWorkerView[];
    /**
     * Lists workers whose heartbeat is stale (older than heartbeatTtlMs).
     *
     * @param now - Current timestamp to compare against
     * @param heartbeatTtlMs - Maximum age of a heartbeat in milliseconds
     * @returns Array of stale worker views
     */
    listStaleWorkers(now: string, heartbeatTtlMs: number): RegisteredWorkerView[];
    /**
     * Converts a raw worker snapshot record into a RegisteredWorkerView.
     *
     * Parses JSON-stored fields (capabilities, runningExecutions) and
     * computes availableSlots as maxConcurrency - runningExecutionIds.length.
     *
     * @param record - Raw snapshot record from storage
     * @returns Parsed and computed worker view
     */
    private toView;
}
