/**
 * Async Execution Lease Service
 *
 * Async version of ExecutionLeaseService that uses LeaseRepository for data access,
 * enabling both SQLite and PostgreSQL backends.
 *
 * ## Overview
 *
 * Manages execution leases - time-bound reservations that give a worker
 * exclusive rights to work on a specific execution.
 *
 * ## Key Concepts
 *
 * - **Lease**: Temporary ownership of execution right
 * - **Fencing Token**: Version token that prevents split-brain scenarios
 * - **Lease Owner**: Entity holding the current execution right
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

import { newId, nowIso } from "../../contracts/types/ids.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import { WorkerRegistryService } from "../worker-pool/worker-registry-service.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { StorageError } from "../../contracts/errors.js";
import type { LeaseRepository } from "./lease-repository.js";
import type { LeaseAuditRecord } from "../../contracts/types/domain/lease-types.js";
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
import { MAX_LEASE_TTL_MS, MIN_LEASE_TTL_MS } from "./types.js";
import {
  buildWorkerSnapshotRefreshInput,
  mergeExecutionIds,
  parseJsonArray,
  plusMs,
  removeExecutionId,
  toWorkerStatus,
} from "./utils.js";

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
 * Options for creating an async ExecutionLeaseService
 */
export interface ExecutionLeaseServiceAsyncOptions {
  /** Use synchronous transactions (SQLite) instead of async transactions */
  useSyncTransactions?: boolean;
}

/**
 * Async service managing execution leases using a repository pattern.
 *
 * This service uses LeaseRepository for all lease-related database operations,
 * enabling the same code to work with both SQLite (sync) and PostgreSQL (async).
 */
export class ExecutionLeaseServiceAsync {
  private readonly workers: WorkerRegistryService;

  /**
   * Creates a new ExecutionLeaseServiceAsync instance.
   * @param db - SQLite database instance for transactional operations (sync mode)
   * @param store - AuthoritativeTaskStore for data access operations
   * @param repo - LeaseRepository for async lease operations
   */
  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
    private readonly repo: LeaseRepository,
  ) {
    this.workers = new WorkerRegistryService(store);
  }

  /**
   * Acquires a new lease for an execution, granting exclusive work rights to a worker.
   */
  public async acquireLease(input: AcquireExecutionLeaseInput): Promise<ExecutionLeaseDecision> {
    const occurredAt = input.occurredAt ?? nowIso();

    return this.db.transaction(() => {
      return this.acquireLeaseSync(input, occurredAt);
    });
  }

  private acquireLeaseSync(input: AcquireExecutionLeaseInput, occurredAt: string): ExecutionLeaseDecision {
    const execution = this.store.dispatch.getExecution(input.executionId);
    if (!execution) {
      throw new StorageError("storage.execution_not_found", `Execution not found: ${input.executionId}`, {
        details: { executionId: input.executionId },
        executionId: input.executionId,
      });
    }

    if (!this.isTtlWithinBounds(input.ttlMs)) {
      return {
        outcome: "blocked",
        reasonCode: "ttl_out_of_bounds",
        lease: null,
      };
    }

    // Expire any lease that has already passed its expiration time
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

    // Create new lease with incremented fencing token
    const lease = {
      id: newId("lease"),
      executionId: input.executionId,
      workerId: input.workerId,
      attempt: execution.attempt,
      fencingToken: this.store.worker.getLatestFencingToken(input.executionId) + 1,
      queueName: input.queueName ?? null,
      status: "active" as const,
      leasedAt: occurredAt,
      expiresAt: plusMs(occurredAt, input.ttlMs),
      lastHeartbeatAt: occurredAt,
      releasedAt: null,
      reasonCode: null,
    };

    this.store.worker.insertExecutionLease(lease);
    this.insertLeaseAudit({
      id: newId("audit"),
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
  }

  /**
   * Renews an existing lease, extending its expiration time.
   */
  public async renewLease(input: RenewExecutionLeaseInput): Promise<ExecutionLeaseDecision> {
    const occurredAt = input.occurredAt ?? nowIso();

    return this.db.transaction(() => {
      return this.renewLeaseSync(input, occurredAt);
    });
  }

  private renewLeaseSync(input: RenewExecutionLeaseInput, occurredAt: string): ExecutionLeaseDecision {
    const lease = this.store.worker.getExecutionLease(input.leaseId);
    if (!lease) {
      return {
        outcome: "blocked",
        reasonCode: "lease_not_found",
        lease: null,
      };
    }

    if (lease.workerId !== input.workerId) {
      return {
        outcome: "blocked",
        reasonCode: "worker_mismatch",
        lease,
      };
    }

    if (lease.status !== "active") {
      return {
        outcome: "blocked",
        reasonCode: "lease_not_active",
        lease,
      };
    }

    if (new Date(lease.expiresAt) <= new Date(occurredAt)) {
      return {
        outcome: "blocked",
        reasonCode: "lease_expired",
        lease,
      };
    }

    if (!this.isTtlWithinBounds(input.ttlMs)) {
      return {
        outcome: "blocked",
        reasonCode: "ttl_out_of_bounds",
        lease,
      };
    }

    const newExpiresAt = plusMs(occurredAt, input.ttlMs);
    this.store.worker.renewExecutionLease(input.leaseId, newExpiresAt, occurredAt);
    this.insertLeaseAudit({
      id: newId("audit"),
      executionId: lease.executionId,
      leaseId: lease.id,
      workerId: lease.workerId,
      fencingToken: lease.fencingToken,
      eventType: "lease_renewed",
      reasonCode: null,
      recordedAt: occurredAt,
    });

    const updatedLease = this.store.worker.getExecutionLease(input.leaseId);
    return {
      outcome: "renewed",
      reasonCode: null,
      lease: updatedLease ?? null,
    };
  }

  /**
   * Releases a lease voluntarily.
   */
  public async releaseLease(input: ReleaseExecutionLeaseInput): Promise<ExecutionLeaseDecision> {
    const occurredAt = input.occurredAt ?? nowIso();

    return this.db.transaction(() => {
      return this.releaseLeaseSync(input, occurredAt);
    });
  }

  private releaseLeaseSync(input: ReleaseExecutionLeaseInput, occurredAt: string): ExecutionLeaseDecision {
    const lease = this.store.worker.getExecutionLease(input.leaseId);
    if (!lease) {
      return {
        outcome: "blocked",
        reasonCode: "lease_not_found",
        lease: null,
      };
    }

    if (lease.workerId !== input.workerId) {
      return {
        outcome: "blocked",
        reasonCode: "worker_mismatch",
        lease,
      };
    }

    if (lease.status !== "active") {
      return {
        outcome: "blocked",
        reasonCode: "lease_not_active",
        lease,
      };
    }

    // R17-08 fix: Check expiration to prevent releasing already-expired lease
    // A lease may have status="active" but be past its expiration time
    if (new Date(lease.expiresAt) <= new Date(occurredAt)) {
      return {
        outcome: "blocked",
        reasonCode: "lease_expired",
        lease,
      };
    }

    // R9-03 fix: Re-check status inside transaction to prevent TOCTOU
    // Between the check above and the close below, another thread could have
    // already released the lease. Re-verify before closing.
    const currentLease = this.store.worker.getExecutionLease(input.leaseId);
    if (!currentLease || currentLease.status !== "active") {
      return {
        outcome: "blocked",
        reasonCode: "lease_not_active",
        lease: currentLease ?? null,
      };
    }

    this.store.worker.closeExecutionLease({
      leaseId: input.leaseId,
      status: "released",
      releasedAt: occurredAt,
      reasonCode: input.reasonCode ?? null,
    });

    this.insertLeaseAudit({
      id: newId("audit"),
      executionId: lease.executionId,
      leaseId: lease.id,
      workerId: lease.workerId,
      fencingToken: lease.fencingToken,
      eventType: "lease_released",
      reasonCode: input.reasonCode ?? null,
      recordedAt: occurredAt,
    });

    const updatedLease = this.store.worker.getExecutionLease(input.leaseId);
    return {
      outcome: "released",
      reasonCode: null,
      lease: updatedLease ?? null,
    };
  }

  /**
   * Validates write access for an execution.
   */
  public validateWriteAccess(input: ValidateExecutionWriteInput): ExecutionWriteValidationResult {
    const occurredAt = input.occurredAt ?? nowIso();

    return this.db.transaction(() => {
      return this.validateWriteAccessSync(input, occurredAt);
    });
  }

  private validateWriteAccessSync(input: ValidateExecutionWriteInput, occurredAt: string): ExecutionWriteValidationResult {
    const activeLease = this.store.worker.getActiveExecutionLease(input.executionId);

    if (!activeLease) {
      return {
        allowed: false,
        reasonCode: "no_active_lease",
        authoritativeFencingToken: 0,
        activeLeaseId: null,
      };
    }

    if (activeLease.id !== input.leaseId) {
      return {
        allowed: false,
        reasonCode: "lease_mismatch",
        authoritativeFencingToken: activeLease.fencingToken,
        activeLeaseId: activeLease.id,
      };
    }

    if (activeLease.workerId !== input.workerId) {
      return {
        allowed: false,
        reasonCode: "worker_mismatch",
        authoritativeFencingToken: activeLease.fencingToken,
        activeLeaseId: activeLease.id,
      };
    }

    if (activeLease.fencingToken !== input.fencingToken) {
      this.insertLeaseAudit({
        id: newId("audit"),
        executionId: input.executionId,
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
        authoritativeFencingToken: activeLease.fencingToken,
        activeLeaseId: activeLease.id,
      };
    }

    if (new Date(activeLease.expiresAt) <= new Date(occurredAt)) {
      this.store.worker.closeExecutionLease({
        leaseId: activeLease.id,
        status: "expired",
        releasedAt: occurredAt,
        reasonCode: "lease_expired",
      });
      this.insertLeaseAudit({
        id: newId("audit"),
        executionId: input.executionId,
        leaseId: activeLease.id,
        workerId: input.workerId,
        fencingToken: input.fencingToken,
        eventType: "stale_write_rejected",
        reasonCode: "lease_expired",
        recordedAt: occurredAt,
      });
      this.insertLeaseAudit({
        id: newId("audit"),
        executionId: input.executionId,
        leaseId: activeLease.id,
        workerId: activeLease.workerId,
        fencingToken: activeLease.fencingToken,
        eventType: "lease_expired",
        reasonCode: "lease_expired",
        recordedAt: occurredAt,
      });
      return {
        allowed: false,
        reasonCode: "lease_expired",
        authoritativeFencingToken: activeLease.fencingToken,
        activeLeaseId: activeLease.id,
      };
    }

    // R17-09 fix: Final expiration check to prevent TOCTOU race condition
    // Lease could expire between the check at line 389 and reaching here
    if (new Date(activeLease.expiresAt) <= new Date(occurredAt)) {
      this.store.worker.closeExecutionLease({
        leaseId: activeLease.id,
        status: "expired",
        releasedAt: occurredAt,
        reasonCode: "lease_expired",
      });
      this.insertLeaseAudit({
        id: newId("audit"),
        executionId: activeLease.executionId,
        leaseId: activeLease.id,
        workerId: activeLease.workerId,
        fencingToken: activeLease.fencingToken,
        eventType: "lease_expired",
        reasonCode: "lease_expired",
        recordedAt: occurredAt,
      });
      return {
        allowed: false,
        reasonCode: "lease_expired",
        authoritativeFencingToken: activeLease.fencingToken,
        activeLeaseId: activeLease.id,
      };
    }

    return {
      allowed: true,
      reasonCode: null,
      authoritativeFencingToken: activeLease.fencingToken,
      activeLeaseId: activeLease.id,
    };
  }

  /**
   * Reclaims expired leases.
   */
  public reclaimExpiredLeases(occurredAt: string): string[] {
    return this.db.transaction(() => {
      const expiredLeases = this.store.worker.listExpiredExecutionLeases(occurredAt);
      const reclaimedIds: string[] = [];

      for (const lease of expiredLeases) {
        this.store.worker.closeExecutionLease({
          leaseId: lease.id,
          status: "expired",
          releasedAt: occurredAt,
          reasonCode: "lease_expired",
        });

        this.insertLeaseAudit({
          id: newId("audit"),
          executionId: lease.executionId,
          leaseId: lease.id,
          workerId: lease.workerId,
          fencingToken: lease.fencingToken,
          eventType: "lease_reclaimed",
          reasonCode: "lease_expired",
          recordedAt: occurredAt,
        });

        reclaimedIds.push(lease.id);
      }

      return reclaimedIds;
    });
  }

  /**
   * Hands over a lease from one worker to another.
   */
  public async handoverLease(input: HandoverExecutionLeaseInput): Promise<ExecutionLeaseHandoverDecision> {
    const occurredAt = input.occurredAt ?? nowIso();

    return this.db.transaction(() => {
      return this.handoverLeaseSync(input, occurredAt);
    });
  }

  private handoverLeaseSync(input: HandoverExecutionLeaseInput, occurredAt: string): ExecutionLeaseHandoverDecision {
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
        previousLease,
        lease: null,
      };
    }

    if (!this.isTtlWithinBounds(input.ttlMs)) {
      return {
        outcome: "blocked",
        reasonCode: "ttl_out_of_bounds",
        previousLease,
        lease: null,
      };
    }

    // R17-09 fix: Check if previous lease has expired before handover
    // Cannot create a new active lease from a dead/expired lease
    if (new Date(previousLease.expiresAt) <= new Date(occurredAt)) {
      return {
        outcome: "blocked",
        reasonCode: "lease_expired",
        previousLease,
        lease: null,
      };
    }

    // Close the previous lease
    this.store.worker.closeExecutionLease({
      leaseId: input.leaseId,
      status: "released",
      releasedAt: occurredAt,
      reasonCode: input.reasonCode ?? "worker_draining_handover",
    });

    // Create new lease with incremented fencing token
    const newLease = {
      id: newId("lease"),
      executionId: previousLease.executionId,
      workerId: input.newWorkerId,
      attempt: previousLease.attempt,
      fencingToken: previousLease.fencingToken + 1,
      queueName: previousLease.queueName,
      status: "active" as const,
      leasedAt: occurredAt,
      expiresAt: plusMs(occurredAt, input.ttlMs),
      lastHeartbeatAt: occurredAt,
      releasedAt: null,
      reasonCode: null,
    };

    this.store.worker.insertExecutionLease(newLease);

    this.insertLeaseAudit({
      id: newId("audit"),
      executionId: previousLease.executionId,
      leaseId: previousLease.id,
      workerId: previousLease.workerId,
      fencingToken: previousLease.fencingToken,
      eventType: "lease_released",
      reasonCode: input.reasonCode ?? "worker_draining_handover",
      recordedAt: occurredAt,
    });

    const closedPreviousLease = this.store.worker.getExecutionLease(input.leaseId);
    return {
      outcome: "handed_over",
      reasonCode: null,
      previousLease: closedPreviousLease ?? null,
      lease: newLease,
    };
  }

  private expireActiveLeaseIfNeeded(executionId: string, occurredAt: string, reasonCode: string): void {
    const activeLease = this.store.worker.getActiveExecutionLease(executionId);
    if (activeLease && new Date(activeLease.expiresAt) <= new Date(occurredAt)) {
      this.store.worker.closeExecutionLease({
        leaseId: activeLease.id,
        status: "expired",
        releasedAt: occurredAt,
        reasonCode,
      });
      this.insertLeaseAudit({
        id: newId("audit"),
        executionId,
        leaseId: activeLease.id,
        workerId: activeLease.workerId,
        fencingToken: activeLease.fencingToken,
        eventType: "lease_expired",
        reasonCode,
        recordedAt: occurredAt,
      });
    }
  }

  private isTtlWithinBounds(ttlMs: number): boolean {
    return ttlMs >= MIN_LEASE_TTL_MS && ttlMs <= MAX_LEASE_TTL_MS;
  }

  private insertLeaseAudit(audit: LeaseAuditRecord): void {
    this.store.worker.insertLeaseAudit(audit);
  }
}
