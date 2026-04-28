/**
 * Execution Lease Service
 *
 * ## Overview
 *
 * Manages execution leases - time-bound reservations that give a worker
 * exclusive rights to work on a specific execution.
 *
 * ## Key Concepts
 *
 * - **Lease**: Temporary ownership of execution right
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: lease}
 *
 * - **Fencing Token**: Version token that prevents split-brain scenarios
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: fencing token}
 *
 * - **Lease Owner**: Entity holding the current execution right
 *   * See: {@link https://github.com/automatic-agent/automatic_agent_platform/blob/main/docs_zh/governance/glossary_and_terminology.md | Glossary: lease owner}
 *
 * ## Operations
 *
 * - acquireLease: Grant a new lease for an execution to a worker
 * - renewLease: Extend the TTL of an existing active lease
 * - releaseLease: Voluntarily release a lease before it expires
 * - reclaimExpiredLeases: Systematically close leases that have exceeded their TTL
 * - validateWriteAccess: Check if a worker has valid lease to write to an execution
 *
 * All operations are transactional and create audit records (lease_audits table).
 *
 * @see Runtime Execution Contract: docs_zh/contracts/runtime_execution_contract.md
 * @see Glossary: docs_zh/governance/glossary_and_terminology.md
 */

import type { ExecutionLeaseRecord, LeaseAuditRecord, WorkerSnapshotRecord } from "../../contracts/types/domain.js";

import { newId, nowIso } from "../../contracts/types/ids.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import { WorkerRegistryService } from "../worker-pool/worker-registry-service.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { StorageError } from "../../contracts/errors.js";
import type {
  AcquireExecutionLeaseInput,
  ExecutionLeaseDecision,
  ExecutionLeaseHandoverDecision,
  ExecutionWriteValidationResult,
  HandoverExecutionLeaseInput,
  ReleaseExecutionLeaseInput,
  RenewExecutionLeaseInput,
  ValidateExecutionWriteInput,
} from "./types.js";
import {
  buildWorkerSnapshotRefreshInput,
  mergeExecutionIds,
  parseJsonArray,
  plusMs,
  removeExecutionId,
  toWorkerStatus,
} from "./utils.js";
import { MIN_LEASE_TTL_MS, MAX_LEASE_TTL_MS } from "./types.js";

const logger = new StructuredLogger({ retentionLimit: 100 });
export type {
  AcquireExecutionLeaseInput,
  ExecutionLeaseDecision,
  ExecutionLeaseHandoverDecision,
  ExecutionWriteValidationResult,
  HandoverExecutionLeaseInput,
  ReleaseExecutionLeaseInput,
  RenewExecutionLeaseInput,
  ValidateExecutionWriteInput,
} from "./types.js";

/**
 * Service managing execution leases - time-bound exclusive rights for workers to execute tasks.
 *
 * Leases ensure that only one worker can work on an execution at a time, even across
 * system restarts or network partitions. The fencing token mechanism prevents split-brain
 * scenarios where a second worker might start work before learning about the first worker's
 * lease.
 *
 * This service is used by:
 * - ExecutionDispatchService: to acquire leases during ticket dispatch
 * - ExecutionWorkerHandshakeService: to validate and renew leases during execution
 */
export class ExecutionLeaseService {
  private readonly workers: WorkerRegistryService;

  /**
   * Creates a new ExecutionLeaseService instance.
   * @param db - SQLite database instance for transactional operations
   * @param store - AuthoritativeTaskStore for data access operations
   */
  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
  ) {
    this.workers = new WorkerRegistryService(store);
  }

  /**
   * Acquires a new lease for an execution, granting exclusive work rights to a worker.
   *
   * This is called during the dispatch process after a worker has been selected.
   * If an active lease already exists for the execution, the request is blocked.
   * The fencing token is initialized based on the latest lease for this execution.
   *
   * @param input - Lease acquisition parameters
   * @returns Decision indicating if lease was granted or blocked
   * @throws Error if execution not found
   */
  public acquireLease(input: AcquireExecutionLeaseInput): ExecutionLeaseDecision {
    const occurredAt = input.occurredAt ?? nowIso();

    return this.db.transaction(() => {
      const execution = this.store.dispatch.getExecution(input.executionId);
      if (!execution) {
        throw new StorageError("storage.execution_not_found", `Execution not found: ${input.executionId}`, {
          details: { executionId: input.executionId },
          executionId: input.executionId,
        });
      }

      // First expire any lease that has already passed its expiration time
      this.expireActiveLeaseIfNeeded(input.executionId, occurredAt, "lease_expired");

      // Check for existing active lease (would block new acquisition)
      const activeLease = this.store.worker.getActiveExecutionLease(input.executionId);
      if (activeLease) {
        return {
          outcome: "blocked",
          reasonCode: "active_lease_exists",
          lease: activeLease,
        };
      }

      // Enforce TTL bounds (§8.3)
      if (input.ttlMs < MIN_LEASE_TTL_MS || input.ttlMs > MAX_LEASE_TTL_MS) {
        return {
          outcome: "blocked",
          reasonCode: "ttl_out_of_bounds",
          lease: null,
        };
      }

      // Create new lease with incremented fencing token
      const lease: ExecutionLeaseRecord = {
        id: newId("lease"),
        executionId: input.executionId,
        workerId: input.workerId,
        attempt: execution.attempt,
        // Fencing token prevents split-brain: each grant increments it
        fencingToken: this.getLatestFencingToken(input.executionId) + 1,
        queueName: input.queueName ?? null,
        status: "active",
        leasedAt: occurredAt,
        expiresAt: plusMs(occurredAt, input.ttlMs),
        lastHeartbeatAt: occurredAt,
        releasedAt: null,
        reasonCode: null,
      };

      this.store.worker.insertExecutionLease(lease);
      // Record audit trail for debugging lease state changes
      this.insertLeaseAudit({
        executionId: lease.executionId,
        leaseId: lease.id,
        workerId: lease.workerId,
        fencingToken: lease.fencingToken,
        eventType: "lease_granted",
        reasonCode: null,
        recordedAt: occurredAt,
      });

      return {
        outcome: "granted",
        reasonCode: null,
        lease,
      };
    });
  }

  /**
   * Renews an existing lease, extending its expiration time.
   *
   * Workers call this periodically via heartbeat to keep their lease alive.
   * Validates that:
   * - Lease exists
   * - Worker ID matches (only the lease owner can renew)
   * - Lease is still active (not expired or released)
   * - Lease hasn't already expired at the time of renewal
   *
   * @param input - Renewal parameters including lease ID and new TTL
   * @returns Decision indicating if renewal succeeded or blocked
   */
  public renewLease(input: RenewExecutionLeaseInput): ExecutionLeaseDecision {
    const occurredAt = input.occurredAt ?? nowIso();

    return this.db.transaction(() => {
      const lease = this.store.worker.getExecutionLease(input.leaseId);
      if (!lease) {
        return {
          outcome: "blocked",
          reasonCode: "lease_not_found",
          lease: null,
        };
      }

      // Only the lease owner can renew
      if (lease.workerId !== input.workerId) {
        return {
          outcome: "blocked",
          reasonCode: "worker_mismatch",
          lease: lease ?? null,
        };
      }

      // Can only renew active leases
      if (lease.status !== "active") {
        return {
          outcome: "blocked",
          reasonCode: "lease_not_active",
          lease: lease ?? null,
        };
      }

      // Check if lease has already expired at the current time
      if (Date.parse(lease.expiresAt) < Date.parse(occurredAt)) {
        this.store.worker.closeExecutionLease({
          leaseId: lease.id,
          status: "expired",
          releasedAt: occurredAt,
          reasonCode: "lease_expired",
        });
        this.insertLeaseAudit({
          executionId: lease.executionId,
          leaseId: lease.id,
          workerId: lease.workerId,
          fencingToken: lease.fencingToken,
          eventType: "lease_expired",
          reasonCode: "lease_expired",
          recordedAt: occurredAt,
        });

        return {
          outcome: "blocked",
          reasonCode: "lease_expired",
          lease: this.store.worker.getExecutionLease(lease.id) ?? null,
        };
      }

      // Extend expiration time and record renewal
      const expiresAt = plusMs(occurredAt, input.ttlMs);
      this.store.worker.renewExecutionLease(lease.id, expiresAt, occurredAt);
      this.insertLeaseAudit({
        executionId: lease.executionId,
        leaseId: lease.id,
        workerId: lease.workerId,
        fencingToken: lease.fencingToken,
        eventType: "lease_renewed",
        reasonCode: null,
        recordedAt: occurredAt,
      });

      return {
        outcome: "renewed",
        reasonCode: null,
        lease: this.store.worker.getExecutionLease(lease.id) ?? null,
      };
    });
  }

  /**
   * Releases a lease voluntarily before it expires.
   *
   * Workers call this when they complete work or need to give up the lease.
   * Validates that:
   * - Lease exists
   * - Worker ID matches (only the lease owner can release)
   * - Lease is still active
   *
   * @param input - Release parameters including lease ID and optional reason
   * @returns Decision indicating if release succeeded or blocked
   */
  public releaseLease(input: ReleaseExecutionLeaseInput): ExecutionLeaseDecision {
    const occurredAt = input.occurredAt ?? nowIso();

    return this.db.transaction(() => {
      const lease = this.store.worker.getExecutionLease(input.leaseId);
      if (!lease) {
        return {
          outcome: "blocked",
          reasonCode: "lease_not_found",
          lease: null,
        };
      }

      // Only the lease owner can release
      if (lease.workerId !== input.workerId) {
        return {
          outcome: "blocked",
          reasonCode: "worker_mismatch",
          lease: lease ?? null,
        };
      }

      // Can only release active leases
      if (lease.status !== "active") {
        return {
          outcome: "blocked",
          reasonCode: "lease_not_active",
          lease: lease ?? null,
        };
      }

      // Close the lease with released status
      this.store.worker.closeExecutionLease({
        leaseId: lease.id,
        status: "released",
        releasedAt: occurredAt,
        reasonCode: input.reasonCode ?? null,
      });
      this.insertLeaseAudit({
        executionId: lease.executionId,
        leaseId: lease.id,
        workerId: lease.workerId,
        fencingToken: lease.fencingToken,
        eventType: "lease_released",
        reasonCode: input.reasonCode ?? null,
        recordedAt: occurredAt,
      });

      return {
        outcome: "released",
        reasonCode: null,
        lease: this.store.worker.getExecutionLease(lease.id) ?? null,
      };
    });
  }

  public handoverLease(input: HandoverExecutionLeaseInput): ExecutionLeaseHandoverDecision {
    const occurredAt = input.occurredAt ?? nowIso();

    return this.db.transaction(() => {
      const previousLease = this.store.worker.getExecutionLease(input.leaseId);
      if (!previousLease) {
        return {
          outcome: "blocked",
          reasonCode: "lease_not_found",
          previousLease: null,
          lease: null,
        };
      }

      if (previousLease.workerId !== input.workerId) {
        return {
          outcome: "blocked",
          reasonCode: "worker_mismatch",
          previousLease: previousLease ?? null,
          lease: null,
        };
      }

      if (previousLease.status !== "active") {
        return {
          outcome: "blocked",
          reasonCode: "lease_not_active",
          previousLease: previousLease ?? null,
          lease: null,
        };
      }

      if (Date.parse(previousLease.expiresAt) < Date.parse(occurredAt)) {
        this.store.worker.closeExecutionLease({
          leaseId: previousLease.id,
          status: "expired",
          releasedAt: occurredAt,
          reasonCode: "lease_expired",
        });
        this.insertLeaseAudit({
          executionId: previousLease.executionId,
          leaseId: previousLease.id,
          workerId: previousLease.workerId,
          fencingToken: previousLease.fencingToken,
          eventType: "lease_expired",
          reasonCode: "lease_expired",
          recordedAt: occurredAt,
        });
        return {
          outcome: "blocked",
          reasonCode: "lease_expired",
          previousLease: this.store.worker.getExecutionLease(previousLease.id) ?? null,
          lease: null,
        };
      }

      if (input.newWorkerId === previousLease.workerId) {
        return {
          outcome: "blocked",
          reasonCode: "handover_same_worker",
          previousLease: previousLease ?? null,
          lease: null,
        };
      }

      const execution = this.store.dispatch.getExecution(previousLease.executionId);
      if (!execution) {
        throw new StorageError("storage.execution_not_found", `Execution not found: ${previousLease.executionId}`, {
          details: { executionId: previousLease.executionId },
          executionId: previousLease.executionId,
        });
      }

      const nextWorker = this.store.worker.getWorkerSnapshot(input.newWorkerId);
      if (!nextWorker) {
        return {
          outcome: "blocked",
          reasonCode: "worker_not_registered",
          previousLease: previousLease ?? null,
          lease: null,
        };
      }

      const nextWorkerRunningExecutionIds = parseJsonArray(nextWorker.runningExecutionsJson, logger);
      if (
        !nextWorkerRunningExecutionIds.includes(previousLease.executionId)
        && nextWorkerRunningExecutionIds.length >= nextWorker.maxConcurrency
      ) {
        return {
          outcome: "blocked",
          reasonCode: "worker_capacity_full",
          previousLease: previousLease ?? null,
          lease: null,
        };
      }

      const handoverReason = input.reasonCode ?? "lease_handover";
      this.store.worker.closeExecutionLease({
        leaseId: previousLease.id,
        status: "released",
        releasedAt: occurredAt,
        reasonCode: handoverReason,
      });
      this.insertLeaseAudit({
        executionId: previousLease.executionId,
        leaseId: previousLease.id,
        workerId: previousLease.workerId,
        fencingToken: previousLease.fencingToken,
        eventType: "lease_released",
        reasonCode: handoverReason,
        recordedAt: occurredAt,
      });

      const lease: ExecutionLeaseRecord = {
        id: newId("lease"),
        executionId: previousLease.executionId,
        workerId: input.newWorkerId,
        attempt: execution.attempt,
        fencingToken: this.getLatestFencingToken(previousLease.executionId) + 1,
        queueName: previousLease.queueName,
        status: "active",
        leasedAt: occurredAt,
        expiresAt: plusMs(occurredAt, input.ttlMs),
        lastHeartbeatAt: occurredAt,
        releasedAt: null,
        reasonCode: null,
      };
      this.store.worker.insertExecutionLease(lease);
      this.insertLeaseAudit({
        executionId: lease.executionId,
        leaseId: lease.id,
        workerId: lease.workerId,
        fencingToken: lease.fencingToken,
        eventType: "lease_granted",
        reasonCode: handoverReason,
        recordedAt: occurredAt,
      });
      this.insertLeaseAudit({
        executionId: lease.executionId,
        leaseId: lease.id,
        workerId: lease.workerId,
        fencingToken: lease.fencingToken,
        eventType: "lease_handover",
        reasonCode: handoverReason,
        recordedAt: occurredAt,
      });
      this.store.execution.updateExecutionAgent(execution.id, input.newWorkerId, occurredAt);
      this.updateAgentExecutionOwnership(execution.id, input.newWorkerId, occurredAt, handoverReason);
      this.updateWorkerExecutionOwnership(previousLease.workerId, input.newWorkerId, execution.id, occurredAt);
      this.store.event.insertEvent({
        id: newId("evt"),
        taskId: execution.taskId,
        executionId: execution.id,
        eventType: "lease:handover_recorded",
        eventTier: "tier_2",
        payloadJson: JSON.stringify({
          previousLeaseId: previousLease.id,
          leaseId: lease.id,
          previousWorkerId: previousLease.workerId,
          workerId: lease.workerId,
          previousFencingToken: previousLease.fencingToken,
          fencingToken: lease.fencingToken,
          reasonCode: handoverReason,
          lineage: {
            transferKind: "handover",
            sourceLeaseId: previousLease.id,
            sourceWorkerId: previousLease.workerId,
          },
        }),
        traceId: execution.traceId,
        createdAt: occurredAt,
      });

      return {
        outcome: "handed_over",
        reasonCode: null,
        previousLease: this.store.worker.getExecutionLease(previousLease.id) ?? null,
        lease: this.store.worker.getExecutionLease(lease.id) ?? null,
      };
    });
  }

  /**
   * Reclaims all leases that have expired as of the given time.
   *
   * Called during system maintenance to clean up expired leases
   * and update their status to "reclaimed".
   *
   * @param now - Current timestamp to check against (defaults to now)
   * @returns Array of lease records that were reclaimed
   */
  public reclaimExpiredLeases(now: string = nowIso()): ExecutionLeaseRecord[] {
    return this.db.transaction(() => {
      // Get all leases that have passed their expiration time
      const expiredLeases = this.store.worker.listExpiredExecutionLeases(now);

      return expiredLeases
        .map((lease) => this.reclaimActiveLeaseInternal(lease.executionId, now, "lease_reclaimed"))
        .filter((lease): lease is ExecutionLeaseRecord => lease != null);
    });
  }

  public reclaimActiveLease(
    executionId: string,
    occurredAt: string = nowIso(),
    reasonCode: string = "lease_reclaimed",
  ): ExecutionLeaseRecord | null {
    return this.db.transaction(() => this.reclaimActiveLeaseInternal(executionId, occurredAt, reasonCode));
  }

  /**
   * Validates whether a worker has write access to an execution.
   *
   * This is the primary mechanism for preventing stale writes:
   * - Checks that a lease exists and is active
   * - Verifies the fencing token matches (detects if lease was renewed by another worker)
   * - Confirms the worker ID matches (prevents cross-worker writes)
   * - Optionally validates the lease ID (detects lease replacement)
   *
   * Used before any execution state modification to ensure the worker
   * still holds a valid lease.
   *
   * @param input - Validation parameters including execution, worker, and fencing token
   * @returns Validation result indicating if write is allowed
   */
  public validateWriteAccess(input: ValidateExecutionWriteInput): ExecutionWriteValidationResult {
    const occurredAt = input.occurredAt ?? nowIso();

    return this.db.transaction(() => {
      // Get the latest lease record for this execution
      const latestLease = this.store.worker.getLatestExecutionLease(input.executionId);
      if (!latestLease) {
        return {
          allowed: false,
          reasonCode: "lease_not_found",
          authoritativeFencingToken: 0,
          activeLeaseId: null,
        };
      }

      // Get the currently active lease (if any)
      const activeLease = this.store.worker.getActiveExecutionLease(input.executionId);
      // The authoritative fencing token is always from the latest lease
      const authoritativeFencingToken = latestLease.fencingToken;

      // Reject if no active lease exists
      if (!activeLease) {
        this.insertLeaseAudit({
          executionId: latestLease.executionId,
          leaseId: latestLease.id,
          workerId: input.workerId,
          fencingToken: input.fencingToken,
          eventType: "stale_write_rejected",
          reasonCode: "no_active_lease",
          recordedAt: occurredAt,
        });

        return {
          allowed: false,
          reasonCode: "no_active_lease",
          authoritativeFencingToken,
          activeLeaseId: null,
        };
      }

      // Check fencing token matches - rejects stale writes from previous lease holders
      if (input.fencingToken !== activeLease.fencingToken) {
        this.insertLeaseAudit({
          executionId: activeLease.executionId,
          leaseId: activeLease.id,
          workerId: input.workerId,
          fencingToken: input.fencingToken,
          eventType: "stale_write_rejected",
          reasonCode: "stale_fencing_token",
          recordedAt: occurredAt,
        });

        return {
          allowed: false,
          reasonCode: "stale_fencing_token",
          authoritativeFencingToken,
          activeLeaseId: activeLease.id,
        };
      }

      // Verify the worker is the lease owner
      if (activeLease.workerId !== input.workerId) {
        this.insertLeaseAudit({
          executionId: activeLease.executionId,
          leaseId: activeLease.id,
          workerId: input.workerId,
          fencingToken: input.fencingToken,
          eventType: "stale_write_rejected",
          reasonCode: "worker_mismatch",
          recordedAt: occurredAt,
        });

        return {
          allowed: false,
          reasonCode: "worker_mismatch",
          authoritativeFencingToken,
          activeLeaseId: activeLease.id,
        };
      }

      // Check if lease has expired
      if (Date.parse(activeLease.expiresAt) < Date.parse(occurredAt)) {
        this.insertLeaseAudit({
          executionId: activeLease.executionId,
          leaseId: activeLease.id,
          workerId: input.workerId,
          fencingToken: input.fencingToken,
          eventType: "stale_write_rejected",
          reasonCode: "lease_expired",
          recordedAt: occurredAt,
        });

        return {
          allowed: false,
          reasonCode: "lease_expired",
          authoritativeFencingToken,
          activeLeaseId: activeLease.id,
        };
      }

      // Optionally validate the lease ID matches
      if (input.leaseId && input.leaseId !== activeLease.id) {
        this.insertLeaseAudit({
          executionId: activeLease.executionId,
          leaseId: activeLease.id,
          workerId: input.workerId,
          fencingToken: input.fencingToken,
          eventType: "stale_write_rejected",
          reasonCode: "lease_mismatch",
          recordedAt: occurredAt,
        });

        return {
          allowed: false,
          reasonCode: "lease_mismatch",
          authoritativeFencingToken,
          activeLeaseId: activeLease.id,
        };
      }

      // All checks passed - write access granted
      return {
        allowed: true,
        reasonCode: null,
        authoritativeFencingToken,
        activeLeaseId: activeLease.id,
      };
    });
  }

  /**
   * Expires an active lease if it has passed its expiration time.
   * Used internally before acquiring a new lease to ensure clean state.
   *
   * @param executionId - The execution whose lease to check
   * @param occurredAt - Current timestamp to compare against
   * @param reasonCode - Reason code to set on the expired lease
   */
  private expireActiveLeaseIfNeeded(executionId: string, occurredAt: string, reasonCode: string): void {
    const activeLease = this.store.worker.getActiveExecutionLease(executionId);
    // Only expire if exists AND has passed its expiration time
    if (!activeLease || Date.parse(activeLease.expiresAt) >= Date.parse(occurredAt)) {
      return;
    }

    this.store.worker.closeExecutionLease({
      leaseId: activeLease.id,
      status: "expired",
      releasedAt: occurredAt,
      reasonCode,
    });
    this.insertLeaseAudit({
      executionId: activeLease.executionId,
      leaseId: activeLease.id,
      workerId: activeLease.workerId,
      fencingToken: activeLease.fencingToken,
      eventType: "lease_expired",
      reasonCode,
      recordedAt: occurredAt,
    });
  }

  /**
   * Inserts a lease audit record for tracking lease state changes.
   * Used for debugging and monitoring lease lifecycle events.
   *
   * @param input - Audit record data (without the auto-generated ID)
   */
  private insertLeaseAudit(input: Omit<LeaseAuditRecord, "id">): void {
    this.store.worker.insertLeaseAudit({
      id: newId("laudit"),
      ...input,
    });
  }

  private updateWorkerExecutionOwnership(
    previousWorkerId: string,
    nextWorkerId: string,
    executionId: string,
    occurredAt: string,
  ): void {
    const previousWorker = this.store.worker.getWorkerSnapshot(previousWorkerId);
    if (previousWorker) {
      const runningExecutionIds = removeExecutionId(parseJsonArray(previousWorker.runningExecutionsJson, logger), executionId);
      this.workers.recordHeartbeat(buildWorkerSnapshotRefreshInput(previousWorker, runningExecutionIds, occurredAt, logger));
    }

    const nextWorker = this.store.worker.getWorkerSnapshot(nextWorkerId);
    if (nextWorker) {
      const runningExecutionIds = mergeExecutionIds(parseJsonArray(nextWorker.runningExecutionsJson, logger), executionId);
      this.workers.recordHeartbeat(buildWorkerSnapshotRefreshInput(nextWorker, runningExecutionIds, occurredAt, logger));
    }
  }

  private clearWorkerExecutionOwnership(
    workerId: string,
    executionId: string,
    occurredAt: string,
  ): void {
    const worker = this.store.worker.getWorkerSnapshot(workerId);
    if (!worker) {
      return;
    }

    const runningExecutionIds = removeExecutionId(parseJsonArray(worker.runningExecutionsJson, logger), executionId);
    this.workers.recordHeartbeat({
      ...buildWorkerSnapshotRefreshInput(worker, runningExecutionIds, occurredAt, logger),
      activeLeaseCount: Math.max(0, runningExecutionIds.length),
      currentStepId: runningExecutionIds.length === 0 ? null : worker.currentStepId,
      lastProgressAt: runningExecutionIds.length === 0 ? occurredAt : worker.lastProgressAt,
    });
  }

  private reclaimActiveLeaseInternal(
    executionId: string,
    occurredAt: string,
    reasonCode: string,
  ): ExecutionLeaseRecord | null {
    const activeLease = this.store.worker.getActiveExecutionLease(executionId);
    if (!activeLease) {
      return null;
    }

    this.store.worker.closeExecutionLease({
      leaseId: activeLease.id,
      status: "reclaimed",
      releasedAt: occurredAt,
      reasonCode,
    });
    this.insertLeaseAudit({
      executionId: activeLease.executionId,
      leaseId: activeLease.id,
      workerId: activeLease.workerId,
      fencingToken: activeLease.fencingToken,
      eventType: "lease_reclaimed",
      reasonCode,
      recordedAt: occurredAt,
    });
    this.clearWorkerExecutionOwnership(activeLease.workerId, activeLease.executionId, occurredAt);

    return this.store.worker.getExecutionLease(activeLease.id) ?? null;
  }

  private updateAgentExecutionOwnership(
    executionId: string,
    agentId: string,
    occurredAt: string,
    handoverReason: string,
  ): void {
    const existing = this.store.worker.getAgentExecutionRecord(executionId);
    if (!existing) {
      return;
    }
    this.store.worker.upsertAgentExecutionRecord({
      ...existing,
      agentId,
      progressMessage: `lease handover accepted: ${handoverReason}`,
      updatedAt: occurredAt,
    });
  }

  private getLatestFencingToken(executionId: string): number {
    const workerStore = this.store.worker as typeof this.store.worker & {
      getLatestFencingToken?: (executionId: string) => number;
    };
    return workerStore.getLatestFencingToken?.(executionId) ?? 0;
  }
}
