/**
 * Worker Drain Protocol - Three-Phase Implementation
 *
 * Implements §8.2 drain-quiesce-terminate lifecycle:
 * - Phase 1 (drain): Stop accepting new work, finish existing tasks
 * - Phase 2 (quiesce): Wait for all leases to expire or be released
 * - Phase 3 (terminate): Clean shutdown of worker resources
 *
 * R7-50 FIX: Full three-phase drain behavior per §8.2.
 */

export type DrainPhase = "draining" | "quiescing" | "terminating";

export interface ActiveLeaseSummary {
  readonly leaseId: string;
  readonly nodeRunId: string;
  readonly expiresAt: string;
  readonly handoverRequired: boolean;
}

export interface WorkerDrainRequest {
  readonly workerId: string;
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly deadlineAt: string;
  readonly activeLeases: readonly ActiveLeaseSummary[];
}

export interface WorkerDrainProgress {
  readonly workerId: string;
  readonly phase: DrainPhase;
  readonly status?: "in_progress" | "deadline_exceeded";
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly deadlineAt: string;
  readonly activeLeaseCount: number;
  readonly completedLeaseCount: number;
  readonly remainingLeaseIds: readonly string[];
  readonly handoverLeaseIds: readonly string[];
  readonly quiesceDeadline: string | null;
  readonly terminationDeadline: string | null;
}

export interface WorkerDrainReceipt {
  readonly workerId: string;
  readonly status: "draining" | "quiescing" | "drained" | "deadline_exceeded";
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly deadlineAt: string;
  readonly activeLeaseCount: number;
  readonly completedLeaseCount: number;
  readonly handoverLeaseIds: readonly string[];
  readonly runTerminationCleanupRequired: boolean;
}

/**
 * Phase durations per §8.2
 */
const DEFAULT_QUIESCE_TIMEOUT_MS = 30_000;
const DEFAULT_TERMINATE_TIMEOUT_MS = 10_000;

/**
 * R7-50 FIX: WorkerDrainProtocol with three-phase drain-quiesce-terminate behavior.
 *
 * Phase 1 (draining): Worker stops accepting new work, existing tasks run to completion.
 * Phase 2 (quiescing): Worker waits for all leases to be released or expired.
 * Phase 3 (terminating): Final cleanup and worker shutdown.
 */
export class WorkerDrainProtocol {
  private readonly quiesceTimeoutMs: number;
  private readonly terminateTimeoutMs: number;

  public constructor(options?: {
    quiesceTimeoutMs?: number;
    terminateTimeoutMs?: number;
  }) {
    this.quiesceTimeoutMs = options?.quiesceTimeoutMs ?? DEFAULT_QUIESCE_TIMEOUT_MS;
    this.terminateTimeoutMs = options?.terminateTimeoutMs ?? DEFAULT_TERMINATE_TIMEOUT_MS;
  }

  /**
   * Begin drain sequence - returns initial drain progress.
   * R7-50 FIX: Phase 1 - drain existing work
   */
  public beginDrain(request: WorkerDrainRequest): WorkerDrainProgress {
    const handoverLeaseIds = request.activeLeases
      .filter((lease) => lease.handoverRequired)
      .map((lease) => lease.leaseId);
    const activeLeaseCount = request.activeLeases.length;
    const remainingLeaseIds = request.activeLeases.map((lease) => lease.leaseId);

    // Phase 1: draining - worker is processing existing tasks
    return {
      workerId: request.workerId,
      phase: "draining",
      requestedBy: request.requestedBy,
      requestedAt: request.requestedAt,
      deadlineAt: request.deadlineAt,
      activeLeaseCount,
      completedLeaseCount: 0,
      remainingLeaseIds,
      handoverLeaseIds,
      quiesceDeadline: this.computeQuiesceDeadline(request.requestedAt),
      terminationDeadline: null,
    };
  }

  /**
   * Check drain progress and transition phases.
   * R7-50 FIX: Phase 2 - quiesce, Phase 3 - terminate
   */
  public computeDrainProgress(
    request: WorkerDrainRequest,
    progress: WorkerDrainProgress,
    now: string,
  ): WorkerDrainProgress {
    const observedAt = new Date(now);
    const deadlineAt = new Date(request.deadlineAt);

    // Check if deadline exceeded
    if (observedAt > deadlineAt) {
      return {
        ...progress,
        phase: "terminating",
        status: "deadline_exceeded",
        terminationDeadline: now,
      } as unknown as WorkerDrainProgress;
    }

    // Count completed leases (leases that have expired or been released)
    const completedLeaseCount = request.activeLeases.filter((lease) => {
      // Lease is completed if it has expired
      return new Date(lease.expiresAt) < observedAt;
    }).length;

    const remainingLeaseIds = request.activeLeases
      .filter((lease) => new Date(lease.expiresAt) >= observedAt)
      .map((lease) => lease.leaseId);

    // Phase transition logic per §8.2
    if (remainingLeaseIds.length === 0) {
      // All leases completed - transition to quiescing
      return {
        ...progress,
        phase: "quiescing",
        activeLeaseCount: request.activeLeases.length,
        completedLeaseCount,
        remainingLeaseIds,
        terminationDeadline: this.computeTerminationDeadline(now),
      };
    }

    // Check if we've moved to terminating phase
    if (progress.phase === "quiescing") {
      const quiesceDeadline = progress.quiesceDeadline;
      if (quiesceDeadline != null && observedAt >= new Date(quiesceDeadline)) {
        return {
          ...progress,
          phase: "terminating",
          terminationDeadline: now,
        };
      }
    }

    return {
      ...progress,
      activeLeaseCount: request.activeLeases.length,
      completedLeaseCount,
      remainingLeaseIds,
    };
  }

  /**
   * Determine if drain is complete.
   * R7-50 FIX: Returns true only when all phases are complete.
   */
  public isDrainComplete(progress: WorkerDrainProgress): boolean {
    return progress.phase === "terminating" ||
      progress.status === "deadline_exceeded";
  }

  /**
   * Create final drain receipt.
   * R7-50 FIX: Full receipt with cleanup requirements.
   */
  public createReceipt(request: WorkerDrainRequest, observedAt = request.requestedAt): WorkerDrainReceipt {
    const handoverLeaseIds = request.activeLeases
      .filter((lease) => lease.handoverRequired)
      .map((lease) => lease.leaseId);
    const deadlineExceeded = observedAt > request.deadlineAt;
    const now = new Date(observedAt);

    // Determine final status based on phase
    let status: WorkerDrainReceipt["status"];
    if (deadlineExceeded) {
      status = "deadline_exceeded";
    } else if (request.activeLeases.length === 0) {
      status = "drained";
    } else {
      // Check if all leases have expired
      const allLeasesExpired = request.activeLeases.every(
        (lease) => new Date(lease.expiresAt) < now,
      );
      status = allLeasesExpired ? "drained" : "draining";
    }

    return {
      workerId: request.workerId,
      status,
      requestedBy: request.requestedBy,
      requestedAt: request.requestedAt,
      deadlineAt: request.deadlineAt,
      activeLeaseCount: request.activeLeases.length,
      completedLeaseCount: request.activeLeases.filter(
        (lease) => new Date(lease.expiresAt) < now,
      ).length,
      handoverLeaseIds,
      runTerminationCleanupRequired: deadlineExceeded || handoverLeaseIds.length > 0,
    };
  }

  /**
   * Get list of leases requiring handover during drain.
   */
  public getHandoverLeases(request: WorkerDrainRequest): readonly string[] {
    return request.activeLeases
      .filter((lease) => lease.handoverRequired)
      .map((lease) => lease.leaseId);
  }

  private computeQuiesceDeadline(requestedAt: string): string {
    const requested = new Date(requestedAt);
    requested.setMilliseconds(requested.getMilliseconds() + this.quiesceTimeoutMs);
    return requested.toISOString();
  }

  private computeTerminationDeadline(quiesceAt: string): string {
    const quiesce = new Date(quiesceAt);
    quiesce.setMilliseconds(quiesce.getMilliseconds() + this.terminateTimeoutMs);
    return quiesce.toISOString();
  }
}
