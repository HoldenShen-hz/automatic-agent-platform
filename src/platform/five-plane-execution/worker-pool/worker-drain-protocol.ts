/**
 * Worker Drain Protocol
 *
 * Implements §8.2 three-phase worker drain behavior:
 * - Phase 1 (DRAIN): Stop accepting new work, finish existing work
 * - Phase 2 (QUIESCE): Wait for in-flight work to complete
 * - Phase 3 (TERMINATE): Forcefully terminate if quiesce timeout exceeded
 *
 * This ensures graceful worker shutdown without losing in-flight tasks.
 */

import { nowIso } from "../../contracts/types/ids.js";

/**
 * Worker drain phases per §8.2.
 */
export enum WorkerDrainPhase {
  /** Phase 1: Stop accepting new work */
  DRAIN = "drain",
  /** Phase 2: Wait for in-flight work to complete */
  QUIESCE = "quiesce",
  /** Phase 3: Terminate if quiesce timeout exceeded */
  TERMINATE = "terminate",
}

/**
 * Active lease information for a worker.
 */
export interface ActiveLeaseSummary {
  readonly leaseId: string;
  readonly nodeRunId: string;
  readonly expiresAt: string;
  readonly handoverRequired: boolean;
}

/**
 * Worker drain request.
 */
export interface WorkerDrainRequest {
  readonly workerId: string;
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly deadlineAt: string;
  readonly activeLeases: readonly ActiveLeaseSummary[];
  /** R20-11: Reason for drain (graceful_shutdown, node_replacement, incident, etc.) - now required */
  readonly drainReason: string;
}

/**
 * Worker drain receipt with three-phase status.
 */
export interface WorkerDrainReceipt {
  readonly workerId: string;
  readonly status: "draining" | "quiescing" | "drained" | "deadline_exceeded" | "terminated";
  readonly phase: WorkerDrainPhase;
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly deadlineAt: string;
  readonly activeLeaseCount: number;
  readonly completedLeaseCount: number;
  readonly handoverLeaseIds: readonly string[];
  readonly runTerminationCleanupRequired: boolean;
  /** R20-11: Number of leases forcibly handed off after deadline exceeded */
  readonly forcedHandoffCount: number;
  /** R20-11: Cleanup result for run termination */
  readonly cleanupResult?: {
    runsTerminated: number;
    gracefulMs: number;
    forcedMs: number;
  };
  readonly phaseHistory: readonly {
    phase: WorkerDrainPhase;
    enteredAt: string;
    exitedAt: string | null;
    leasesCompleted: number;
  }[];
}

/**
 * Worker drain configuration.
 */
export interface WorkerDrainConfig {
  /** Time to wait in DRAIN phase before moving to QUIESCE */
  drainTimeoutMs: number;
  /** Time to wait in QUIESCE phase before moving to TERMINATE */
  quiesceTimeoutMs: number;
  /** Check interval for lease completion */
  checkIntervalMs: number;
}

/**
 * Default drain configuration per §8.2.
 */
export const DEFAULT_DRAIN_CONFIG: WorkerDrainConfig = {
  drainTimeoutMs: 10_000, // 10 seconds to finish current work
  quiesceTimeoutMs: 30_000, // 30 seconds for in-flight to complete
  checkIntervalMs: 1_000, // Check every second
};

/**
 * WorkerDrainProtocolState tracks the state of a drain operation.
 */
interface WorkerDrainProtocolState {
  phase: WorkerDrainPhase;
  startedAt: string;
  deadlineAt: string;
  activeLeases: readonly string[];
  completedLeases: string[];
  handoverLeases: string[];
  phaseHistory: Array<{
    phase: WorkerDrainPhase;
    enteredAt: string;
    exitedAt: string | null;
    leasesCompleted: number;
  }>;
  currentPhaseStartedAt: string;
}

/**
 * WorkerDrainProtocol implements the three-phase drain behavior per §8.2.
 *
 * Phase 1 - DRAIN:
 *   Worker stops accepting new leases but continues processing existing ones.
 *   Transition to QUIESCE when drain timeout expires or all leases completed.
 *
 * Phase 2 - QUIESCE:
 *   Worker waits for all in-flight work to complete.
 *   Transition to TERMINATE when quiesce timeout expires.
 *
 * Phase 3 - TERMINATE:
 *   Forceful termination if deadline exceeded or quiesce timeout exceeded.
 */
export class WorkerDrainProtocol {
  private readonly config: WorkerDrainConfig;

  public constructor(config: Partial<WorkerDrainConfig> = {}) {
    this.config = { ...DEFAULT_DRAIN_CONFIG, ...config };
  }

  /**
   * Begin drain operation for a worker.
   * Returns initial receipt showing DRAIN phase.
   */
  public beginDrain(request: WorkerDrainRequest): WorkerDrainReceipt {
    const handoverLeaseIds = request.activeLeases
      .filter((lease) => lease.handoverRequired)
      .map((lease) => lease.leaseId);

    const phaseHistory: WorkerDrainProtocolState["phaseHistory"] = [{
      phase: WorkerDrainPhase.DRAIN,
      enteredAt: nowIso(),
      exitedAt: null,
      leasesCompleted: 0,
    }];

    return {
      workerId: request.workerId,
      status: "draining",
      phase: WorkerDrainPhase.DRAIN,
      requestedBy: request.requestedBy,
      requestedAt: request.requestedAt,
      deadlineAt: request.deadlineAt,
      activeLeaseCount: request.activeLeases.length,
      completedLeaseCount: 0,
      handoverLeaseIds,
      runTerminationCleanupRequired: false,
      forcedHandoffCount: 0,
      phaseHistory,
    };
  }

  /**
   * Transition to next drain phase.
   * @param currentReceipt Current drain receipt
   * @param observedAt Current timestamp
   * @returns Updated receipt with new phase
   */
  public advancePhase(
    currentReceipt: WorkerDrainReceipt,
    observedAt: string,
  ): WorkerDrainReceipt {
    const elapsed = new Date(observedAt).getTime() - new Date(currentReceipt.requestedAt).getTime();
    const deadlineExceeded = new Date(observedAt).getTime() > new Date(currentReceipt.deadlineAt).getTime();

    // Update phase history - mark current phase as exited
    const updatedHistory = currentReceipt.phaseHistory.map((entry, index) => {
      if (index === currentReceipt.phaseHistory.length - 1 && entry.exitedAt == null) {
        return { ...entry, exitedAt: observedAt };
      }
      return entry;
    });

    let newPhase: WorkerDrainPhase;
    let newStatus: WorkerDrainReceipt["status"];
    let newStatusText: string;

    switch (currentReceipt.phase) {
      case WorkerDrainPhase.DRAIN:
        // Transition to QUIESCE
        newPhase = WorkerDrainPhase.QUIESCE;
        newStatus = "quiescing";
        newStatusText = "draining";
        break;

      case WorkerDrainPhase.QUIESCE:
        // Transition to TERMINATE
        newPhase = WorkerDrainPhase.TERMINATE;
        newStatus = deadlineExceeded ? "deadline_exceeded" : "terminated";
        newStatusText = "deadline_exceeded";
        break;

      case WorkerDrainPhase.TERMINATE:
        // Already in terminal phase
        return currentReceipt;

      default:
        // Unknown phase, stay in current state
        return currentReceipt;
    }

    // Add new phase to history
    updatedHistory.push({
      phase: newPhase,
      enteredAt: observedAt,
      exitedAt: null,
      leasesCompleted: currentReceipt.completedLeaseCount,
    });

    return {
      ...currentReceipt,
      status: newStatus,
      phase: newPhase,
      runTerminationCleanupRequired: deadlineExceeded || currentReceipt.handoverLeaseIds.length > 0,
      forcedHandoffCount: deadlineExceeded ? currentReceipt.completedLeaseCount : currentReceipt.forcedHandoffCount,
      phaseHistory: updatedHistory,
    };
  }

  /**
   * Create receipt from drain request and observed state.
   * Implements the three-phase logic based on elapsed time and lease state.
   */
  public createReceipt(
    request: WorkerDrainRequest,
    observedAt = request.requestedAt,
  ): WorkerDrainReceipt {
    const handoverLeaseIds = request.activeLeases
      .filter((lease) => lease.handoverRequired)
      .map((lease) => lease.leaseId);

    const deadlineExceeded = new Date(observedAt).getTime() > new Date(request.deadlineAt).getTime();
    const elapsed = new Date(observedAt).getTime() - new Date(request.requestedAt).getTime();

    // Determine current phase based on elapsed time
    let phase: WorkerDrainPhase;
    let statusText: WorkerDrainReceipt["status"];

    if (elapsed < this.config.drainTimeoutMs) {
      phase = WorkerDrainPhase.DRAIN;
      statusText = "draining";
    } else if (elapsed < this.config.drainTimeoutMs + this.config.quiesceTimeoutMs) {
      phase = WorkerDrainPhase.QUIESCE;
      statusText = "quiescing";
    } else {
      phase = WorkerDrainPhase.TERMINATE;
      statusText = deadlineExceeded ? "deadline_exceeded" : "terminated";
    }

    // Build phase history
    const phaseHistory: Array<{
      phase: WorkerDrainPhase;
      enteredAt: string;
      exitedAt: string | null;
      leasesCompleted: number;
    }> = [];

    // DRAIN phase
    const drainExitTime = Math.min(elapsed, this.config.drainTimeoutMs);
    phaseHistory.push({
      phase: WorkerDrainPhase.DRAIN,
      enteredAt: request.requestedAt,
      exitedAt: drainExitTime < elapsed ? new Date(
        new Date(request.requestedAt).getTime() + this.config.drainTimeoutMs,
      ).toISOString() : null,
      leasesCompleted: 0,
    });

    // QUIESCE phase (if elapsed > drainTimeoutMs)
    if (elapsed > this.config.drainTimeoutMs) {
      const quiesceElapsed = elapsed - this.config.drainTimeoutMs;
      const quiesceExitTime = Math.min(quiesceElapsed, this.config.quiesceTimeoutMs);
      phaseHistory.push({
        phase: WorkerDrainPhase.QUIESCE,
        enteredAt: new Date(
          new Date(request.requestedAt).getTime() + this.config.drainTimeoutMs,
        ).toISOString(),
        exitedAt: quiesceExitTime < quiesceElapsed ? new Date(
          new Date(request.requestedAt).getTime() + this.config.drainTimeoutMs + this.config.quiesceTimeoutMs,
        ).toISOString() : null,
        leasesCompleted: Math.floor(
          (request.activeLeases.length * quiesceElapsed) / this.config.quiesceTimeoutMs,
        ),
      });
    }

    // TERMINATE phase (if elapsed > drainTimeoutMs + quiesceTimeoutMs)
    if (elapsed > this.config.drainTimeoutMs + this.config.quiesceTimeoutMs) {
      phaseHistory.push({
        phase: WorkerDrainPhase.TERMINATE,
        enteredAt: new Date(
          new Date(request.requestedAt).getTime() + this.config.drainTimeoutMs + this.config.quiesceTimeoutMs,
        ).toISOString(),
        exitedAt: null,
        leasesCompleted: request.activeLeases.length,
      });
    }

    const completedLeaseCount = Math.min(
      request.activeLeases.length,
      Math.floor(
        (request.activeLeases.length * elapsed) / (this.config.drainTimeoutMs + this.config.quiesceTimeoutMs),
      ),
    );

    return {
      workerId: request.workerId,
      status: statusText,
      phase,
      requestedBy: request.requestedBy,
      requestedAt: request.requestedAt,
      deadlineAt: request.deadlineAt,
      activeLeaseCount: request.activeLeases.length,
      completedLeaseCount,
      handoverLeaseIds,
      runTerminationCleanupRequired: deadlineExceeded || handoverLeaseIds.length > 0,
      forcedHandoffCount: deadlineExceeded ? request.activeLeases.length - completedLeaseCount : 0,
      phaseHistory,
    };
  }

  /**
   * Check if drain is complete (all leases handled).
   */
  public isDrainComplete(receipt: WorkerDrainReceipt): boolean {
    return (
      receipt.completedLeaseCount >= receipt.activeLeaseCount
      || receipt.phase === WorkerDrainPhase.TERMINATE
    );
  }

  /**
   * Check if deadline has been exceeded.
   */
  public isDeadlineExceeded(receipt: WorkerDrainReceipt, observedAt: string): boolean {
    return new Date(observedAt).getTime() > new Date(receipt.deadlineAt).getTime();
  }
}
