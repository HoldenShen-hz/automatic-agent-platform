/**
 * @fileoverview Worker Types - Worker, agent, and coordinator records.
 *
 * Contains records related to worker management, agent execution state,
 * heartbeat tracking, and file locking.
 *
 * Part of the domain.ts split (see src/core/types/domain/index.ts).
 */

import type {
  RunKind,
  WorkerStatus,
  WorkerPlacement,
  WorkerIsolationLevel,
  RemoteSessionStatus,
  SessionConsistencyCheckStatus,
  WorkspaceSyncStatus,
  CoordinatorInstanceStatus,
  Timestamp,
} from "./primitives.js";

// ---------------------------------------------------------------------------
// Agent execution record
// ---------------------------------------------------------------------------

/**
 * Agent execution record - detailed execution state for agent orchestration.
 *
 * Tracks the agent's progress through a workflow: current step, tool calls made,
 * decision context, and retry state. This supports the plan-execute-observe loop
 * and enables recovery from worker failures without losing progress.
 */
export interface AgentExecutionRecord {
  executionId: string;
  taskId: string;
  agentId: string;
  workflowId: string | null;
  roleId: string | null;
  runKind: RunKind;
  runtimeInstanceId: string | null;
  restartedFromRuntimeInstanceId: string | null;
  restartGeneration: number;
  status: string;
  planJson: string;
  currentStepId: string | null;
  lastToolName: string | null;
  toolCallCount: number;
  lastDecisionJson: string | null;
  lastErrorCode: string | null;
  retryCount: number;
  progressMessage: string | null;
  startedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  completedAt: Timestamp | null;
}

// ---------------------------------------------------------------------------
// Worker snapshot record
// ---------------------------------------------------------------------------

/**
 * Worker snapshot record - current state of a registered worker for dispatch decisions.
 *
 * Workers register heartbeats to advertise their availability, capabilities,
 * and current load. The scheduler uses this snapshot to select the best
 * worker for a task based on capacity, affinity, and capability matching.
 *
 * placement distinguishes local workers (same process) from remote workers
 * (connected via bridge). Remote workers have additional session/sync state.
 *
 * version supports optimistic concurrency control (CAS) per §25.3/§25.10.
 * The version is incremented on each update. Callers can detect concurrent
 * modifications by checking if the version changed since their last read.
 */
export interface WorkerSnapshotRecord {
  workerId: string;
  status: WorkerStatus;
  placement?: WorkerPlacement | null;
  isolationLevel?: WorkerIsolationLevel | null;
  repoVersion?: string | null;
  remoteSessionStatus?: RemoteSessionStatus | null;
  lastAcknowledgedStreamOffset?: string | null;
  streamResumeSuccessRate?: number | null;
  credentialRefreshSuccessRate?: number | null;
  sessionConsistencyCheckStatus?: SessionConsistencyCheckStatus | null;
  sessionConsistencyCheckedAt?: Timestamp | null;
  workspaceSyncStatus?: WorkspaceSyncStatus | null;
  workspaceSyncCheckedAt?: Timestamp | null;
  saturation?: number | null;
  activeLeaseCount?: number;
  meanStartupLatencyMs?: number | null;
  sandboxSuccessRate?: number | null;
  repoCacheHitRate?: number | null;
  registrationVerifiedAt?: Timestamp | null;
  registrationChallengeId?: string | null;
  /** Service identity for mTLS authentication per §8.2 */
  serviceIdentity?: string | null;
  /** mTLS peer fingerprint for worker identity verification per §8.2 */
  mtlsPeerFingerprint?: string | null;
  /** Allowed tenant IDs for node run claims per §8.2 */
  allowedNodeRunTenants?: readonly string[] | null;
  capabilitiesJson: string;
  runningExecutionsJson: string;
  maxConcurrency: number;
  queueAffinity: string | null;
  runtimeInstanceId: string | null;
  restartedFromRuntimeInstanceId: string | null;
  restartGeneration: number;
  cpuPct: number | null;
  memoryMb: number | null;
  toolBacklogCount: number;
  currentStepId: string | null;
  lastProgressAt: Timestamp | null;
  lastHeartbeatAt: Timestamp;
  updatedAt: Timestamp;
  /**
   * Version number for optimistic concurrency control.
   * Incremented on each update. Use compare-and-swap (CAS) patterns
   * to detect concurrent modifications.
   */
  version: number;
}

// ---------------------------------------------------------------------------
// Coordinator instance record
// ---------------------------------------------------------------------------

/**
 * Coordinator instance record - tracks a scheduler coordinator's state.
 *
 * Coordinators manage task distribution across workers. Multiple coordinators
 * can exist in different regions for HA. The load balancing service
 * selects coordinators based on region affinity and current backlog.
 */
export interface CoordinatorInstanceRecord {
  coordinatorId: string;
  region: string;
  role: string;
  queueAffinity: string | null;
  status: CoordinatorInstanceStatus;
  maxConcurrentDispatches: number;
  activeDispatchCount: number;
  backlogCount: number;
  cpuPct: number | null;
  shardJson: string;
  lastHeartbeatAt: Timestamp;
  metadataJson: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Worker registration challenge record
// ---------------------------------------------------------------------------

/**
 * Worker registration challenge record - temporary token for secure worker registration.
 *
 * When a remote worker connects, it must complete a challenge-response handshake
 * to prove identity and negotiate allowed capabilities. The challenge expires
 * after a configurable TTL to prevent replay attacks.
 */
export interface WorkerRegistrationChallengeRecord {
  id: string;
  workerId: string;
  /** SHA-256 hash of the challenge token (token itself is only shown once) */
  challengeTokenHash: string;
  allowedCapabilitiesJson: string;
  expiresAt: Timestamp;
  usedAt: Timestamp | null;
  createdAt: Timestamp;
}

// ---------------------------------------------------------------------------
// File lock record
// ---------------------------------------------------------------------------

/**
 * File lock record - manages distributed file locking for workspace isolation.
 *
 * Prevents concurrent access to the same workspace files from multiple workers.
 * Locks have expiration times to auto-release if workers crash.
 * lockMode indicates the type of lock (shared, exclusive, etc.).
 */
export interface FileLockRecord {
  id: string;
  taskId: string | null;
  executionId: string | null;
  lockScope: string;
  resourcePath: string;
  lockMode: string;
  ownerId: string;
  expiresAt: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ---------------------------------------------------------------------------
// Heartbeat snapshot record
// ---------------------------------------------------------------------------

/**
 * Heartbeat snapshot record - periodic health report from an executing agent.
 *
 * Workers emit heartbeats during execution to confirm liveness and report
 * resource utilization. cpuPct and memoryMb enable load balancing decisions.
 * The snapshot is used to detect stalled or crashed executions.
 */
export interface HeartbeatSnapshotRecord {
  id: string;
  executionId: string;
  agentId: string;
  runtimeInstanceId: string | null;
  restartGeneration: number;
  status: string;
  progressMessage: string | null;
  cpuPct: number | null;
  memoryMb: number | null;
  sampledAt: Timestamp;
}
