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

import type {
  RemoteSessionStatus,
  SessionConsistencyCheckStatus,
  WorkspaceSyncStatus,
  WorkerIsolationLevel,
  WorkerPlacement,
  WorkerSchedulingStatus,
  WorkerSnapshotRecord,
} from "../../../contracts/types/domain.js";

import { newId, nowIso } from "../../../contracts/types/ids.js";
import { AuthoritativeTaskStore } from "../../../state-evidence/truth/authoritative-task-store.js";
import { toWorkerSchedulingStatus } from "./worker-scheduling-status.js";

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
 * Parses a JSON string as an array, converting all items to strings.
 * Returns empty array if parsing fails or result is not an array.
 */
function parseJsonArray(value: string): string[] {
  const parsed = JSON.parse(value) as unknown;
  return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
}

/**
 * Normalizes a string array by trimming whitespace, removing empties,
 * removing duplicates, and sorting alphabetically.
 */
function normalizeStringArray(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))).sort();
}

function normalizeRate(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.min(1, value));
}

function normalizeNonNegativeInt(value: number | null | undefined, fallback = 0): number {
  if (value == null || !Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.trunc(value));
}

function normalizeNullableNonNegativeInt(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  return Math.max(0, Math.trunc(value));
}

function resolveRemoteSessionStatus(value: RemoteSessionStatus | null | undefined): RemoteSessionStatus | null {
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

function resolveSessionConsistencyCheckStatus(
  value: SessionConsistencyCheckStatus | null | undefined,
): SessionConsistencyCheckStatus | null {
  switch (value) {
    case "unknown":
    case "passed":
    case "mismatch":
      return value;
    default:
      return null;
  }
}

function resolveWorkspaceSyncStatus(value: WorkspaceSyncStatus | null | undefined): WorkspaceSyncStatus | null {
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
function minusMs(iso: string, ms: number): string {
  return new Date(Date.parse(iso) - ms).toISOString();
}

const ISOLATION_LEVEL_ORDER: Record<WorkerIsolationLevel, number> = {
  standard: 0,
  hardened: 1,
  strict: 2,
};

function resolveIsolationLevel(value: WorkerIsolationLevel | null | undefined): WorkerIsolationLevel {
  switch (value) {
    case "hardened":
    case "strict":
      return value;
    default:
      return "standard";
  }
}

function meetsIsolationRequirement(
  workerIsolationLevel: WorkerIsolationLevel,
  requiredIsolationLevel: WorkerIsolationLevel,
): boolean {
  return ISOLATION_LEVEL_ORDER[workerIsolationLevel] >= ISOLATION_LEVEL_ORDER[requiredIsolationLevel];
}

function resolveRestartSemantics(
  existing: WorkerSnapshotRecord | null,
  input: WorkerRegistryHeartbeatInput,
): Pick<WorkerSnapshotRecord, "runtimeInstanceId" | "restartedFromRuntimeInstanceId" | "restartGeneration"> {
  const runtimeInstanceId =
    input.runtimeInstanceId === undefined ? (existing?.runtimeInstanceId ?? null) : input.runtimeInstanceId;
  const priorRuntimeInstanceId = existing?.runtimeInstanceId ?? null;
  const runtimeInstanceChanged =
    existing !== null &&
    runtimeInstanceId !== null &&
    priorRuntimeInstanceId !== null &&
    runtimeInstanceId !== priorRuntimeInstanceId;

  if (runtimeInstanceChanged) {
    return {
      runtimeInstanceId,
      restartedFromRuntimeInstanceId:
        input.restartedFromRuntimeInstanceId === undefined
          ? priorRuntimeInstanceId
          : input.restartedFromRuntimeInstanceId,
      restartGeneration: (existing?.restartGeneration ?? 0) + 1,
    };
  }

  return {
    runtimeInstanceId,
    restartedFromRuntimeInstanceId:
      input.restartedFromRuntimeInstanceId === undefined
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
  /**
   * Creates a new WorkerRegistryService instance.
   * @param store - AuthoritativeTaskStore for persisting worker snapshots
   */
  public constructor(private readonly store: AuthoritativeTaskStore) {}

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
  public recordHeartbeat(input: WorkerRegistryHeartbeatInput): RegisteredWorkerView {
    const occurredAt = input.occurredAt ?? nowIso();
    const existing = this.store.worker.getWorkerSnapshot(input.workerId) ?? null;
    const restartSemantics = resolveRestartSemantics(existing ?? null, input);
    const placement = input.placement ?? existing?.placement ?? "local";
    const remoteSessionStatus =
      placement === "remote"
        ? resolveRemoteSessionStatus(
            input.remoteSessionStatus === undefined ? (existing?.remoteSessionStatus ?? null) : input.remoteSessionStatus,
          )
        : null;

    // Build snapshot record, merging with existing telemetry values where not provided
    const record: WorkerSnapshotRecord = {
      workerId: input.workerId,
      status: input.status,
      placement,
      isolationLevel: resolveIsolationLevel(input.isolationLevel ?? existing?.isolationLevel ?? "standard"),
      repoVersion: input.repoVersion === undefined ? (existing?.repoVersion ?? null) : input.repoVersion,
      remoteSessionStatus,
      lastAcknowledgedStreamOffset:
        placement === "remote"
          ? input.lastAcknowledgedStreamOffset === undefined
            ? (existing?.lastAcknowledgedStreamOffset ?? null)
            : input.lastAcknowledgedStreamOffset
          : null,
      streamResumeSuccessRate:
        placement === "remote"
          ? normalizeRate(
              input.streamResumeSuccessRate === undefined
                ? (existing?.streamResumeSuccessRate ?? null)
                : input.streamResumeSuccessRate,
            )
          : null,
      credentialRefreshSuccessRate:
        placement === "remote"
          ? normalizeRate(
              input.credentialRefreshSuccessRate === undefined
                ? (existing?.credentialRefreshSuccessRate ?? null)
                : input.credentialRefreshSuccessRate,
            )
          : null,
      sessionConsistencyCheckStatus:
        placement === "remote"
          ? resolveSessionConsistencyCheckStatus(
              input.sessionConsistencyCheckStatus === undefined
                ? (existing?.sessionConsistencyCheckStatus ?? null)
                : input.sessionConsistencyCheckStatus,
            )
          : null,
      sessionConsistencyCheckedAt:
        placement === "remote"
          ? input.sessionConsistencyCheckedAt === undefined
            ? (existing?.sessionConsistencyCheckedAt ?? null)
            : input.sessionConsistencyCheckedAt
          : null,
      workspaceSyncStatus:
        placement === "remote"
          ? resolveWorkspaceSyncStatus(
              input.workspaceSyncStatus === undefined ? (existing?.workspaceSyncStatus ?? null) : input.workspaceSyncStatus,
            )
          : null,
      workspaceSyncCheckedAt:
        placement === "remote"
          ? input.workspaceSyncCheckedAt === undefined
            ? (existing?.workspaceSyncCheckedAt ?? null)
            : input.workspaceSyncCheckedAt
          : null,
      saturation: normalizeRate(input.saturation === undefined ? (existing?.saturation ?? null) : input.saturation),
      activeLeaseCount: normalizeNonNegativeInt(
        input.activeLeaseCount === undefined ? (existing?.activeLeaseCount ?? 0) : input.activeLeaseCount,
      ),
      meanStartupLatencyMs:
        input.meanStartupLatencyMs === undefined
          ? (existing?.meanStartupLatencyMs ?? null)
          : normalizeNullableNonNegativeInt(input.meanStartupLatencyMs),
      sandboxSuccessRate: normalizeRate(
        input.sandboxSuccessRate === undefined ? (existing?.sandboxSuccessRate ?? null) : input.sandboxSuccessRate,
      ),
      repoCacheHitRate:
        placement === "remote"
          ? normalizeRate(
              input.repoCacheHitRate === undefined ? (existing?.repoCacheHitRate ?? null) : input.repoCacheHitRate,
            )
          : null,
      registrationVerifiedAt:
        placement === "remote"
          ? input.registrationVerifiedAt === undefined
            ? (existing?.registrationVerifiedAt ?? null)
            : input.registrationVerifiedAt
          : null,
      registrationChallengeId:
        placement === "remote"
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
      version: (existing?.version ?? 0) + 1,
    };

    this.store.worker.upsertWorkerSnapshot(record);
    return this.toView(record);
  }

  public verifyRemoteWorkerRegistration(input: VerifyRemoteWorkerRegistrationInput): RegisteredWorkerView {
    const occurredAt = input.occurredAt ?? nowIso();
    const existing = this.store.worker.getWorkerSnapshot(input.workerId) ?? null;

    return this.recordHeartbeat({
      workerId: input.workerId,
      status: existing?.status ?? "idle",
      placement: "remote",
      isolationLevel: input.isolationLevel ?? existing?.isolationLevel ?? "standard",
      repoVersion: input.repoVersion === undefined ? (existing?.repoVersion ?? null) : input.repoVersion,
      remoteSessionStatus:
        input.remoteSessionStatus === undefined ? (existing?.remoteSessionStatus ?? "connected") : input.remoteSessionStatus,
      lastAcknowledgedStreamOffset:
        input.lastAcknowledgedStreamOffset === undefined
          ? (existing?.lastAcknowledgedStreamOffset ?? null)
          : input.lastAcknowledgedStreamOffset,
      sessionConsistencyCheckStatus:
        input.sessionConsistencyCheckStatus === undefined
          ? (existing?.sessionConsistencyCheckStatus ?? null)
          : input.sessionConsistencyCheckStatus,
      sessionConsistencyCheckedAt:
        input.sessionConsistencyCheckedAt === undefined
          ? (existing?.sessionConsistencyCheckedAt ?? null)
          : input.sessionConsistencyCheckedAt,
      workspaceSyncStatus:
        input.workspaceSyncStatus === undefined ? (existing?.workspaceSyncStatus ?? null) : input.workspaceSyncStatus,
      workspaceSyncCheckedAt:
        input.workspaceSyncCheckedAt === undefined ? (existing?.workspaceSyncCheckedAt ?? null) : input.workspaceSyncCheckedAt,
      capabilities: input.capabilities,
      runningExecutionIds: parseJsonArray(existing?.runningExecutionsJson ?? "[]"),
      maxConcurrency: input.maxConcurrency,
      queueAffinity: input.queueAffinity === undefined ? (existing?.queueAffinity ?? null) : input.queueAffinity,
      runtimeInstanceId: input.runtimeInstanceId === undefined ? (existing?.runtimeInstanceId ?? null) : input.runtimeInstanceId,
      restartedFromRuntimeInstanceId:
        input.restartedFromRuntimeInstanceId === undefined
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
  public getWorker(workerId: string): RegisteredWorkerView | null {
    const record = this.store.worker.getWorkerSnapshot(workerId);
    if (record) {
      return this.toView(record);
    }

    const snapshot = this.store.worker.listWorkerSnapshots().find((item) => item.workerId === workerId);
    if (snapshot) {
      return this.toView(snapshot);
    }

    const legacyWorker = (this.store.worker as { getWorker?: (workerId: string) => RegisteredWorkerView | null }).getWorker?.(workerId);
    if (legacyWorker) {
      return this.toRegisteredView(legacyWorker);
    }

    const legacyWorkers = (this.store.worker as { listWorkers?: () => RegisteredWorkerView[] }).listWorkers?.() ?? [];
    const fallbackWorker = legacyWorkers.find((worker) => worker.workerId === workerId);
    return fallbackWorker ? this.toRegisteredView(fallbackWorker) : null;
  }

  /**
   * Lists all registered workers.
   * @returns Array of all worker views
   */
  public listWorkers(): RegisteredWorkerView[] {
    const snapshots = this.store.worker.listWorkerSnapshots();
    if (snapshots.length > 0) {
      return snapshots.map((record) => this.toView(record));
    }

    return (
      (this.store.worker as { listWorkers?: () => RegisteredWorkerView[] }).listWorkers?.() ?? []
    ).map((worker: RegisteredWorkerView) => this.toRegisteredView(worker));
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
  public listEligibleWorkers(options: WorkerSelectionOptions = {}): RegisteredWorkerView[] {
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
   * @param heartbeatTtlMs - Maximum age of a heartbeat in milliseconds (default: 30000ms per §14)
   * @returns Array of stale worker views
   */
  public listStaleWorkers(now: string, heartbeatTtlMs: number = 30_000): RegisteredWorkerView[] {
    return this.store
      .listStaleWorkerSnapshots(minusMs(now, heartbeatTtlMs))
      .map((record) => this.toView(record));
  }

  /**
   * Detects workers with stale heartbeats and triggers recovery actions.
   * Per §14: gap > 30s should trigger worker_heartbeat_missing event + lease_reclaim.
   *
   * @param now - Current timestamp to compare against
   * @param heartbeatTtlMs - Maximum age of a heartbeat in milliseconds (default: 30000ms)
   * @returns Array of stale worker IDs that were processed
   */
  public detectStaleHeartbeats(
    now: string,
    heartbeatTtlMs: number = 30_000,
  ): readonly string[] {
    const staleWorkers = this.listStaleWorkers(now, heartbeatTtlMs);
    const processedWorkerIds: string[] = [];

    for (const worker of staleWorkers) {
      // R6-10: Emit worker_heartbeat_missing event for stale worker
      this.store.event.insertEvent({
        id: newId("evt"),
        taskId: null,
        executionId: null,
        eventType: "worker.heartbeat_missing",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({
          workerId: worker.workerId,
          lastHeartbeatAt: worker.lastHeartbeatAt,
          stalenessMs: Date.parse(now) - Date.parse(worker.lastHeartbeatAt),
          thresholdMs: heartbeatTtlMs,
          currentStatus: worker.status,
        }),
        traceId: null,
        createdAt: now,
      });

      // R6-10: Trigger lease_reclaim for affected executions
      const affectedExecutions = worker.runningExecutionIds;
      for (const executionId of affectedExecutions) {
        this.store.event.insertEvent({
          id: newId("evt"),
          taskId: null,
          executionId,
          eventType: "execution.lease_reclaim",
          eventTier: "tier_2",
          payloadJson: JSON.stringify({
            workerId: worker.workerId,
            reason: "worker_heartbeat_stale",
            stalenessMs: Date.parse(now) - Date.parse(worker.lastHeartbeatAt),
          }),
          traceId: null,
          createdAt: now,
        });
      }

      processedWorkerIds.push(worker.workerId);
    }

    return processedWorkerIds;
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
  private toView(record: WorkerSnapshotRecord): RegisteredWorkerView {
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

  private toRegisteredView(worker: RegisteredWorkerView): RegisteredWorkerView {
    return {
      workerId: worker.workerId,
      status: worker.status,
      schedulingStatus: worker.schedulingStatus ?? toWorkerSchedulingStatus(worker.status),
      placement: worker.placement ?? "local",
      isolationLevel: resolveIsolationLevel(worker.isolationLevel ?? "standard"),
      repoVersion: worker.repoVersion ?? null,
      remoteSessionStatus: resolveRemoteSessionStatus(worker.remoteSessionStatus ?? null),
      lastAcknowledgedStreamOffset: worker.lastAcknowledgedStreamOffset ?? null,
      streamResumeSuccessRate: normalizeRate(worker.streamResumeSuccessRate),
      credentialRefreshSuccessRate: normalizeRate(worker.credentialRefreshSuccessRate),
      sessionConsistencyCheckStatus: resolveSessionConsistencyCheckStatus(worker.sessionConsistencyCheckStatus ?? null),
      sessionConsistencyCheckedAt: worker.sessionConsistencyCheckedAt ?? null,
      workspaceSyncStatus: resolveWorkspaceSyncStatus(worker.workspaceSyncStatus ?? null),
      workspaceSyncCheckedAt: worker.workspaceSyncCheckedAt ?? null,
      saturation: normalizeRate(worker.saturation),
      activeLeaseCount: normalizeNonNegativeInt(worker.activeLeaseCount),
      meanStartupLatencyMs: typeof worker.meanStartupLatencyMs === "number" && Number.isFinite(worker.meanStartupLatencyMs)
        ? worker.meanStartupLatencyMs
        : null,
      sandboxSuccessRate: normalizeRate(worker.sandboxSuccessRate),
      repoCacheHitRate: normalizeRate(worker.repoCacheHitRate),
      registrationVerifiedAt: worker.registrationVerifiedAt ?? null,
      registrationChallengeId: worker.registrationChallengeId ?? null,
      trusted: worker.trusted ?? true,
      capabilities: normalizeStringArray(worker.capabilities ?? []),
      runningExecutionIds: normalizeStringArray(worker.runningExecutionIds ?? []),
      maxConcurrency: Math.max(normalizeNonNegativeInt(worker.maxConcurrency, 1), 1),
      queueAffinity: worker.queueAffinity ?? null,
      runtimeInstanceId: worker.runtimeInstanceId ?? null,
      restartedFromRuntimeInstanceId: worker.restartedFromRuntimeInstanceId ?? null,
      restartGeneration: normalizeNonNegativeInt(worker.restartGeneration),
      cpuPct: typeof worker.cpuPct === "number" && Number.isFinite(worker.cpuPct) ? worker.cpuPct : null,
      memoryMb: typeof worker.memoryMb === "number" && Number.isFinite(worker.memoryMb) ? worker.memoryMb : null,
      toolBacklogCount: normalizeNonNegativeInt(worker.toolBacklogCount),
      currentStepId: worker.currentStepId ?? null,
      lastProgressAt: worker.lastProgressAt ?? null,
      lastHeartbeatAt: worker.lastHeartbeatAt ?? nowIso(),
      updatedAt: worker.updatedAt ?? nowIso(),
      availableSlots: Math.max(
        0,
        worker.availableSlots ?? (Math.max(normalizeNonNegativeInt(worker.maxConcurrency, 1), 1) - (worker.runningExecutionIds?.length ?? 0)),
      ),
    };
  }
}
