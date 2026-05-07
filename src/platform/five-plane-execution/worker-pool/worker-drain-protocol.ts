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

export interface WorkerDrainCheckpointRequest {
  readonly workerId: string;
  readonly runId: string;
  readonly stepId: string;
  readonly deadlineAt: string;
  readonly activeLeaseIds: readonly string[];
  readonly activeNodeRunIds: readonly string[];
}

export interface WorkerDrainCheckpointCoordinator {
  createCheckpoint(request: WorkerDrainCheckpointRequest): boolean | Promise<boolean>;
}

export interface WorkerDrainLeaseReleaseRequest {
  readonly workerId: string;
  readonly leaseId: string;
  readonly nodeRunId: string;
  readonly reason: "completed" | "forced_handoff";
}

export interface WorkerDrainLeaseManager {
  releaseLease(request: WorkerDrainLeaseReleaseRequest): void | Promise<void>;
}

export interface WorkerDrainRecoveryNotification {
  readonly workerId: string;
  readonly deadlineAt: string;
  readonly activeNodeRunIds: readonly string[];
  readonly pendingLeaseIds: readonly string[];
  readonly forcedHandoffLeaseIds: readonly string[];
}

export interface WorkerDrainRecoveryNotifier {
  notifyWorkerDrain(notification: WorkerDrainRecoveryNotification): void | Promise<void>;
}

export interface WorkerDrainProtocolOptions extends Partial<WorkerDrainConfig> {
  readonly checkpointCoordinator?: WorkerDrainCheckpointCoordinator;
  readonly leaseManager?: WorkerDrainLeaseManager;
  readonly recoveryNotifier?: WorkerDrainRecoveryNotifier;
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
  activeLeases: readonly ActiveLeaseSummary[];
  completedLeases: string[];
  handoverLeases: string[];
  forcedHandoffLeases: string[];
  phaseHistory: Array<{
    phase: WorkerDrainPhase;
    enteredAt: string;
    exitedAt: string | null;
    leasesCompleted: number;
  }>;
  currentPhaseStartedAt: string;
  /** Track if we've emitted events for this phase */
  phaseEventEmitted: boolean;
}

// ---------------------------------------------------------------------------
// Drain Phase Events
// ---------------------------------------------------------------------------

/**
 * Events emitted during the three-phase drain protocol per §8.2.
 */
export enum WorkerDrainPhaseEvent {
  /** Phase 1 started: Worker stops accepting new work */
  DRAIN_STARTED = "worker_drain_drain_started",
  /** Phase 1 completed: All existing work finished, moving to quiesce */
  DRAIN_COMPLETED = "worker_drain_drain_completed",
  /** Phase 2 started: Waiting for in-flight work to complete */
  QUIESCE_STARTED = "worker_drain_quiesce_started",
  /** Phase 2 completed: All in-flight work done or timeout exceeded */
  QUIESCE_COMPLETED = "worker_drain_quiesce_completed",
  /** Phase 3 started: Termination initiated */
  TERMINATE_STARTED = "worker_drain_terminate_started",
  /** Phase 3 completed: Worker fully terminated */
  TERMINATE_COMPLETED = "worker_drain_terminate_completed",
  /** All leases released during drain */
  ALL_LEASES_RELEASED = "worker_drain_all_leases_released",
  /** Forced handoff occurred for pending leases */
  FORCED_HANDOFF_OCCURRED = "worker_drain_forced_handoff",
}

/**
 * Payload for drain phase events.
 */
export interface WorkerDrainPhaseEventPayload {
  [WorkerDrainPhaseEvent.DRAIN_STARTED]: {
    workerId: string;
    requestedBy: string;
    requestedAt: string;
    deadlineAt: string;
    activeLeaseCount: number;
    handoverLeaseIds: readonly string[];
  };
  [WorkerDrainPhaseEvent.DRAIN_COMPLETED]: {
    workerId: string;
    completedLeaseCount: number;
    transitionedTo: WorkerDrainPhase.QUIESCE;
  };
  [WorkerDrainPhaseEvent.QUIESCE_STARTED]: {
    workerId: string;
    pendingLeaseCount: number;
    deadlineAt: string;
  };
  [WorkerDrainPhaseEvent.QUIESCE_COMPLETED]: {
    workerId: string;
    finalLeaseCount: number;
    transitionedTo: WorkerDrainPhase.TERMINATE;
    deadlineExceeded: boolean;
  };
  [WorkerDrainPhaseEvent.TERMINATE_STARTED]: {
    workerId: string;
    forcedHandoffLeaseIds: readonly string[];
    deadlineExceeded: boolean;
  };
  [WorkerDrainPhaseEvent.TERMINATE_COMPLETED]: {
    workerId: string;
    totalLeasesProcessed: number;
    forcedHandoffCount: number;
    gracefulMs: number;
    forcedMs: number;
  };
  [WorkerDrainPhaseEvent.ALL_LEASES_RELEASED]: {
    workerId: string;
    leaseIds: readonly string[];
  };
  [WorkerDrainPhaseEvent.FORCED_HANDOFF_OCCURRED]: {
    workerId: string;
    forcedHandoffLeaseIds: readonly string[];
  };
}

/**
 * Handler signature for drain phase event subscribers.
 */
export type WorkerDrainPhaseEventHandler = (
  event: WorkerDrainPhaseEvent,
  payload: WorkerDrainPhaseEventPayload[WorkerDrainPhaseEvent],
) => void | Promise<void>;

/**
 * WorkerDrainProtocol implements the three-phase drain behavior per §8.2 with
 * stateful checkpoint coordination, lease release, RecoveryWorker integration,
 * and typed event emission for each phase transition.
 *
 * Phase 1 - DRAIN:
 *   Worker stops accepting new leases but continues processing existing ones.
 *   Transition to QUIESCE when drain timeout expires or all leases completed.
 *   Emits: DRAIN_STARTED → DRAIN_COMPLETED
 *
 * Phase 2 - QUIESCE:
 *   Worker waits for all in-flight work to complete.
 *   Transition to TERMINATE when quiesce timeout expires.
 *   Emits: QUIESCE_STARTED → QUIESCE_COMPLETED
 *
 * Phase 3 - TERMINATE:
 *   Forceful termination if deadline exceeded or quiesce timeout exceeded.
 *   Emits: TERMINATE_STARTED → TERMINATE_COMPLETED
 *
 * §9 Integration:
 *   - Coordinates with CheckpointCoordinator for state snapshots before termination
 *   - Releases leases via LeaseManager.leaseRelease()
 *   - Notifies RecoveryWorker of in-progress runs for resilience handling
 */
export class WorkerDrainProtocol {
  private readonly config: WorkerDrainConfig;
  private readonly checkpointCoordinator: WorkerDrainCheckpointCoordinator | undefined;
  private readonly leaseManager: WorkerDrainLeaseManager | undefined;
  private readonly recoveryNotifier: WorkerDrainRecoveryNotifier | undefined;
  // R20-03: Stateful drain tracking - keyed by workerId
  private readonly drainState = new Map<string, WorkerDrainProtocolState>();
  // Event handlers for phase transitions
  private readonly eventHandlers = new Map<WorkerDrainPhaseEvent, Set<WorkerDrainPhaseEventHandler>>();

  public constructor(options: WorkerDrainProtocolOptions = {}) {
    this.config = {
      drainTimeoutMs: options.drainTimeoutMs ?? DEFAULT_DRAIN_CONFIG.drainTimeoutMs,
      quiesceTimeoutMs: options.quiesceTimeoutMs ?? DEFAULT_DRAIN_CONFIG.quiesceTimeoutMs,
      checkIntervalMs: options.checkIntervalMs ?? DEFAULT_DRAIN_CONFIG.checkIntervalMs,
    };
    this.checkpointCoordinator = options.checkpointCoordinator;
    this.leaseManager = options.leaseManager;
    this.recoveryNotifier = options.recoveryNotifier;
  }

  /**
   * Subscribe to drain phase events.
   */
  public on(event: WorkerDrainPhaseEvent, handler: WorkerDrainPhaseEventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(handler);
  }

  /**
   * Unsubscribe from drain phase events.
   */
  public off(event: WorkerDrainPhaseEvent, handler: WorkerDrainPhaseEventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  /**
   * Emit a drain phase event to all registered handlers.
   */
  private emitPhaseEvent<K extends WorkerDrainPhaseEvent>(
    event: K,
    payload: WorkerDrainPhaseEventPayload[K],
  ): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      // Iterate over a copy to avoid issues if handler modifies the set
      const handlerArray = Array.from(handlers);
      for (const handler of handlerArray) {
        try {
          const result = handler(event, payload);
          if (result instanceof Promise) {
            void result.catch((err) => {
              console.error(`Error in drain event handler for ${event}:`, err);
            });
          }
        } catch (err) {
          console.error(`Error invoking drain event handler for ${event}:`, err);
        }
      }
    }
  }

  /**
   * Begin drain operation for a worker.
   * Returns initial receipt showing DRAIN phase.
   * §9: Coordinates checkpoint creation before drain begins.
   */
  public beginDrain(request: WorkerDrainRequest): WorkerDrainReceipt {
    const handoverLeaseIds = request.activeLeases
      .filter((lease) => lease.handoverRequired)
      .map((lease) => lease.leaseId);

    const startedAt = nowIso();
    const phaseHistory: WorkerDrainProtocolState["phaseHistory"] = [{
      phase: WorkerDrainPhase.DRAIN,
      enteredAt: startedAt,
      exitedAt: null,
      leasesCompleted: 0,
    }];

    // R20-03: Store state for stateful drain coordination
    this.drainState.set(request.workerId, {
      phase: WorkerDrainPhase.DRAIN,
      startedAt,
      deadlineAt: request.deadlineAt,
      activeLeases: request.activeLeases,
      completedLeases: [],
      handoverLeases: handoverLeaseIds,
      forcedHandoffLeases: [],
      phaseHistory,
      currentPhaseStartedAt: startedAt,
      phaseEventEmitted: false,
    });

    // Emit DRAIN_STARTED event
    this.emitPhaseEvent(WorkerDrainPhaseEvent.DRAIN_STARTED, {
      workerId: request.workerId,
      requestedBy: request.requestedBy,
      requestedAt: request.requestedAt,
      deadlineAt: request.deadlineAt,
      activeLeaseCount: request.activeLeases.length,
      handoverLeaseIds,
    });

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
   * §9: Release leases for a completed step during drain.
   * Coordinates with LeaseManager to releaseleaseId after step completion.
   */
  public releaseLease(workerId: string, leaseId: string): void {
    const state = this.drainState.get(workerId);
    if (!state) return;

    if (!state.completedLeases.includes(leaseId)) {
      state.completedLeases.push(leaseId);
    }

    const activeLease = state.activeLeases.find((lease) => lease.leaseId === leaseId);
    if (activeLease != null) {
      void this.leaseManager?.releaseLease({
        workerId,
        leaseId,
        nodeRunId: activeLease.nodeRunId,
        reason: "completed",
      });
    }

    // Update phase history with completed lease count
    const currentPhase = state.phaseHistory[state.phaseHistory.length - 1];
    if (currentPhase) {
      currentPhase.leasesCompleted = state.completedLeases.length;
    }

    // Emit ALL_LEASES_RELEASED if all leases are now complete
    if (state.completedLeases.length === state.activeLeases.length) {
      this.emitPhaseEvent(WorkerDrainPhaseEvent.ALL_LEASES_RELEASED, {
        workerId,
        leaseIds: state.completedLeases,
      });
    }
  }

  /**
   * §9: Checkpoint coordination before termination.
   * Coordinates with CheckpointCoordinator to create state snapshots for all active leases.
   * Returns true if checkpoint was successfully created for all active runs.
   */
  public async coordinateCheckpoint(
    workerId: string,
    checkpointCtx: { runId: string; stepId: string },
  ): Promise<boolean> {
    const state = this.drainState.get(workerId);
    if (!state) return false;

    // If no checkpointCoordinator is provided, this is a no-op stub
    if (this.checkpointCoordinator == null) {
      return false;
    }

    // R20-03: Actually invoke the CheckpointCoordinator service
    const checkpointResult = await this.checkpointCoordinator.createCheckpoint({
      workerId,
      runId: checkpointCtx.runId,
      stepId: checkpointCtx.stepId,
      deadlineAt: state.deadlineAt,
      activeLeaseIds: state.activeLeases.map((lease) => lease.leaseId),
      activeNodeRunIds: state.activeLeases.map((lease) => lease.nodeRunId),
    });

    return checkpointResult;
  }

  /**
   * §9: Notify RecoveryWorker of runs needing resilience handling.
   * Called when drain enters TERMINATE phase with active leases.
   * R20-03: Actually invokes the RecoveryWorker notification service to handle
   * in-progress runs that need to be picked up by other workers.
   */
  public notifyRecoveryWorker(workerId: string): void {
    const state = this.drainState.get(workerId);
    if (!state) return;

    // R20-03: No-op if recovery notifier is not provided
    if (this.recoveryNotifier == null) {
      return;
    }

    const pendingLeases = state.activeLeases
      .filter((lease) => !state.completedLeases.includes(lease.leaseId));

    // R20-03: Actually invoke the RecoveryWorker service with full context
    void this.recoveryNotifier.notifyWorkerDrain({
      workerId,
      deadlineAt: state.deadlineAt,
      activeNodeRunIds: pendingLeases.map((lease) => lease.nodeRunId),
      pendingLeaseIds: pendingLeases.map((lease) => lease.leaseId),
      forcedHandoffLeaseIds: state.forcedHandoffLeases,
    });
  }

  /**
   * Get current drain state for a worker (for Testing/debugging).
   */
  public getDrainState(workerId: string): WorkerDrainProtocolState | undefined {
    return this.drainState.get(workerId);
  }

  /**
   * Clear drain state for a worker after drain completes.
   */
  public clearDrainState(workerId: string): void {
    this.drainState.delete(workerId);
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

    const state = this.getDrainState(currentReceipt.workerId);
    const wasEventEmittedForCurrentPhase = state?.phaseEventEmitted ?? false;

    switch (currentReceipt.phase) {
      case WorkerDrainPhase.DRAIN:
        // Transition to QUIESCE: emit DRAIN_COMPLETED and QUIESCE_STARTED
        if (!wasEventEmittedForCurrentPhase && state) {
          // Emit DRAIN_COMPLETED
          this.emitPhaseEvent(WorkerDrainPhaseEvent.DRAIN_COMPLETED, {
            workerId: currentReceipt.workerId,
            completedLeaseCount: currentReceipt.completedLeaseCount,
            transitionedTo: WorkerDrainPhase.QUIESCE,
          });
          // Emit QUIESCE_STARTED
          const pendingLeases = state.activeLeases.filter(
            (lease) => !state.completedLeases.includes(lease.leaseId),
          );
          this.emitPhaseEvent(WorkerDrainPhaseEvent.QUIESCE_STARTED, {
            workerId: currentReceipt.workerId,
            pendingLeaseCount: pendingLeases.length,
            deadlineAt: state.deadlineAt,
          });
          state.phaseEventEmitted = true;
        }
        newPhase = WorkerDrainPhase.QUIESCE;
        newStatus = "quiescing";
        break;

      case WorkerDrainPhase.QUIESCE:
        // Transition to TERMINATE: emit QUIESCE_COMPLETED and TERMINATE_STARTED
        if (!wasEventEmittedForCurrentPhase && state) {
          // Emit QUIESCE_COMPLETED
          this.emitPhaseEvent(WorkerDrainPhaseEvent.QUIESCE_COMPLETED, {
            workerId: currentReceipt.workerId,
            finalLeaseCount: currentReceipt.completedLeaseCount,
            transitionedTo: WorkerDrainPhase.TERMINATE,
            deadlineExceeded,
          });
          // Perform forced handoff before terminate
          this.forceHandoffPendingLeases(currentReceipt.workerId);
          // Emit TERMINATE_STARTED
          this.emitPhaseEvent(WorkerDrainPhaseEvent.TERMINATE_STARTED, {
            workerId: currentReceipt.workerId,
            forcedHandoffLeaseIds: state.forcedHandoffLeases,
            deadlineExceeded,
          });
          // Notify recovery worker
          this.notifyRecoveryWorker(currentReceipt.workerId);
          state.phaseEventEmitted = true;
        }
        newPhase = WorkerDrainPhase.TERMINATE;
        newStatus = deadlineExceeded ? "deadline_exceeded" : "terminated";
        break;

      case WorkerDrainPhase.TERMINATE:
        // Already in terminal phase - emit TERMINATE_COMPLETED if not yet emitted
        if (!wasEventEmittedForCurrentPhase && state) {
          const gracefulMs = new Date(observedAt).getTime() - new Date(state.startedAt).getTime();
          this.emitPhaseEvent(WorkerDrainPhaseEvent.TERMINATE_COMPLETED, {
            workerId: currentReceipt.workerId,
            totalLeasesProcessed: state.completedLeases.length + state.forcedHandoffLeases.length,
            forcedHandoffCount: state.forcedHandoffLeases.length,
            gracefulMs,
            forcedMs: 0,
          });
          state.phaseEventEmitted = true;
        }
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

    // Update state with new phase and reset event flag
    if (state) {
      state.phase = newPhase;
      state.phaseHistory = updatedHistory;
      state.currentPhaseStartedAt = observedAt;
      state.phaseEventEmitted = false;
    }

    return {
      ...currentReceipt,
      status: newStatus,
      phase: newPhase,
      runTerminationCleanupRequired: deadlineExceeded || currentReceipt.handoverLeaseIds.length > 0,
      forcedHandoffCount: state?.forcedHandoffLeases.length
        ?? (deadlineExceeded ? currentReceipt.completedLeaseCount : currentReceipt.forcedHandoffCount),
      ...(currentReceipt.cleanupResult !== undefined && { cleanupResult: currentReceipt.cleanupResult }),
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

  private forceHandoffPendingLeases(workerId: string): void {
    const state = this.drainState.get(workerId);
    if (state == null) {
      return;
    }

    for (const lease of state.activeLeases) {
      if (state.completedLeases.includes(lease.leaseId)) {
        continue;
      }
      if (!lease.handoverRequired) {
        continue;
      }
      if (!state.forcedHandoffLeases.includes(lease.leaseId)) {
        state.forcedHandoffLeases.push(lease.leaseId);
      }
      void this.leaseManager?.releaseLease({
        workerId,
        leaseId: lease.leaseId,
        nodeRunId: lease.nodeRunId,
        reason: "forced_handoff",
      });
    }

    // Emit FORCED_HANDOFF_OCCURRED if any forced handoffs were performed
    if (state.forcedHandoffLeases.length > 0) {
      this.emitPhaseEvent(WorkerDrainPhaseEvent.FORCED_HANDOFF_OCCURRED, {
        workerId,
        forcedHandoffLeaseIds: state.forcedHandoffLeases,
      });
    }
  }
}
