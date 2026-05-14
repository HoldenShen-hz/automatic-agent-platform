export enum WorkerDrainPhase {
  DRAIN = "drain",
  QUIESCE = "quiesce",
  TERMINATE = "terminate",
}

export type DrainPhase = WorkerDrainPhase | "draining" | "quiescing" | "terminating";

export const DEFAULT_DRAIN_CONFIG = {
  drainTimeoutMs: 10_000,
  quiesceTimeoutMs: 30_000,
  checkIntervalMs: 1_000,
  terminateTimeoutMs: 10_000,
} as const;

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
  readonly drainReason?: string;
  readonly activeLeases: readonly ActiveLeaseSummary[];
}

export interface WorkerDrainProgress {
  readonly workerId: string;
  readonly phase: DrainPhase;
  readonly status?: "in_progress" | "deadline_exceeded" | "draining" | "quiescing" | "terminated" | "drained";
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly deadlineAt: string;
  readonly activeLeaseCount: number;
  readonly completedLeaseCount: number;
  readonly remainingLeaseIds: readonly string[];
  readonly handoverLeaseIds: readonly string[];
  readonly quiesceDeadline: string | null;
  readonly terminationDeadline: string | null;
  readonly runTerminationCleanupRequired: boolean;
  readonly forcedHandoffCount: number;
  readonly phaseHistory: readonly {
    readonly phase: WorkerDrainPhase;
    readonly at: string;
    readonly enteredAt: string;
    readonly exitedAt: string | null;
    readonly leasesCompleted: number;
  }[];
}

export type WorkerDrainReceipt = WorkerDrainProgress;

export class WorkerDrainProtocol {
  private readonly drainTimeoutMs: number;
  private readonly quiesceTimeoutMs: number;
  private readonly terminateTimeoutMs: number;
  private readonly activeRequests = new Map<string, WorkerDrainRequest>();

  public constructor(private readonly options: {
    drainTimeoutMs?: number;
    quiesceTimeoutMs?: number;
    checkIntervalMs?: number;
    terminateTimeoutMs?: number;
    checkpointCoordinator?: {
      createCheckpoint(request: Record<string, unknown>): boolean | Promise<boolean>;
    };
    leaseManager?: {
      releaseLease(request: Record<string, string>): void;
    };
    recoveryNotifier?: {
      notifyWorkerDrain(notification: Record<string, unknown>): void;
    };
  } = {}) {
    this.drainTimeoutMs = options.drainTimeoutMs ?? DEFAULT_DRAIN_CONFIG.drainTimeoutMs;
    this.quiesceTimeoutMs = options.quiesceTimeoutMs ?? DEFAULT_DRAIN_CONFIG.quiesceTimeoutMs;
    this.terminateTimeoutMs = options.terminateTimeoutMs ?? DEFAULT_DRAIN_CONFIG.terminateTimeoutMs;
  }

  public beginDrain(request: WorkerDrainRequest): WorkerDrainProgress {
    this.activeRequests.set(request.workerId, request);
    return this.createProgress(request, WorkerDrainPhase.DRAIN, "draining", request.requestedAt);
  }

  public computeDrainProgress(
    request: WorkerDrainRequest,
    progress: WorkerDrainProgress,
    now: string,
  ): WorkerDrainProgress {
    if (this.isDeadlineExceeded(progress, now)) {
      return this.terminateProgress(request, progress, now, "deadline_exceeded");
    }
    const remainingLeaseIds = request.activeLeases
      .filter((lease) => new Date(lease.expiresAt).getTime() >= new Date(now).getTime())
      .map((lease) => lease.leaseId);
    if (remainingLeaseIds.length === 0 && progress.phase !== WorkerDrainPhase.TERMINATE) {
      return {
        ...progress,
        phase: WorkerDrainPhase.QUIESCE,
        status: "quiescing",
        completedLeaseCount: request.activeLeases.length,
        remainingLeaseIds,
        terminationDeadline: this.addMs(now, this.terminateTimeoutMs),
        phaseHistory: this.appendPhase(progress, WorkerDrainPhase.QUIESCE, now),
      };
    }
    return {
      ...progress,
      completedLeaseCount: request.activeLeases.length - remainingLeaseIds.length,
      remainingLeaseIds,
    };
  }

  public advancePhase(progress: WorkerDrainProgress, now: string): WorkerDrainProgress {
    if (progress.phase === WorkerDrainPhase.TERMINATE) {
      return progress;
    }
    const request = this.activeRequests.get(progress.workerId) ?? this.requestFromProgress(progress);
    if (this.isDeadlineExceeded(progress, now)) {
      return this.terminateProgress(request, progress, now, "deadline_exceeded");
    }
    if (progress.phase === WorkerDrainPhase.DRAIN || progress.phase === "draining") {
      return {
        ...progress,
        phase: WorkerDrainPhase.QUIESCE,
        status: "quiescing",
        runTerminationCleanupRequired: request.activeLeases.some((lease) => lease.handoverRequired),
        phaseHistory: this.appendPhase(progress, WorkerDrainPhase.QUIESCE, now),
      };
    }
    return this.terminateProgress(request, progress, now, "terminated");
  }

  public isDrainComplete(progress: Pick<WorkerDrainProgress, "phase" | "status">): boolean {
    return progress.phase === WorkerDrainPhase.TERMINATE
      || progress.phase === "terminating"
      || progress.status === "deadline_exceeded"
      || progress.status === "terminated"
      || progress.status === "drained";
  }

  public isDeadlineExceeded(progress: Pick<WorkerDrainProgress, "deadlineAt">, now: string): boolean {
    return new Date(now).getTime() > new Date(progress.deadlineAt).getTime();
  }

  public createReceipt(request: WorkerDrainRequest, observedAt = request.requestedAt): WorkerDrainReceipt {
    const elapsedMs = new Date(observedAt).getTime() - new Date(request.requestedAt).getTime();
    if (new Date(observedAt).getTime() > new Date(request.deadlineAt).getTime()) {
      return this.terminateProgress(request, this.createProgress(request, WorkerDrainPhase.DRAIN, "draining", request.requestedAt), observedAt, "deadline_exceeded");
    }
    const longObservationMs = this.drainTimeoutMs + this.quiesceTimeoutMs + this.terminateTimeoutMs;
    if (elapsedMs > longObservationMs && request.activeLeases.length === 0) {
      return this.createProgress(request, WorkerDrainPhase.QUIESCE, "drained", observedAt);
    }
    if (elapsedMs > longObservationMs && request.activeLeases.every((lease) => !lease.handoverRequired)) {
      return this.createProgress(request, WorkerDrainPhase.DRAIN, "draining", observedAt);
    }
    if (request.activeLeases.some((lease) => lease.handoverRequired) && elapsedMs >= this.drainTimeoutMs + this.quiesceTimeoutMs) {
      return this.terminateProgress(request, this.createProgress(request, WorkerDrainPhase.QUIESCE, "quiescing", request.requestedAt), observedAt, "terminated");
    }
    if (elapsedMs >= this.drainTimeoutMs + this.quiesceTimeoutMs) {
      return this.terminateProgress(request, this.createProgress(request, WorkerDrainPhase.QUIESCE, "quiescing", request.requestedAt), observedAt, "terminated");
    }
    if (elapsedMs >= this.drainTimeoutMs) {
      return this.createProgress(request, WorkerDrainPhase.QUIESCE, "quiescing", observedAt);
    }
    return this.createProgress(request, WorkerDrainPhase.DRAIN, "draining", observedAt);
  }

  public getHandoverLeases(request: WorkerDrainRequest): readonly string[] {
    return request.activeLeases.filter((lease) => lease.handoverRequired).map((lease) => lease.leaseId);
  }

  public async coordinateCheckpoint(workerId: string, input: { runId: string; stepId: string }): Promise<boolean> {
    const request = this.activeRequests.get(workerId);
    if (request == null || this.options.checkpointCoordinator == null) {
      return false;
    }
    return Boolean(await this.options.checkpointCoordinator.createCheckpoint({
      workerId,
      runId: input.runId,
      stepId: input.stepId,
      deadlineAt: request.deadlineAt,
      activeLeaseIds: request.activeLeases.map((lease) => lease.leaseId),
      activeNodeRunIds: request.activeLeases.map((lease) => lease.nodeRunId),
    }));
  }

  public releaseLease(workerId: string, leaseId: string, reason = "completed"): void {
    const request = this.activeRequests.get(workerId);
    const lease = request?.activeLeases.find((item) => item.leaseId === leaseId);
    if (lease == null) {
      return;
    }
    this.options.leaseManager?.releaseLease({
      workerId,
      leaseId,
      nodeRunId: lease.nodeRunId,
      reason,
    });
  }

  private createProgress(
    request: WorkerDrainRequest,
    phase: WorkerDrainPhase,
    status: NonNullable<WorkerDrainProgress["status"]>,
    at: string,
  ): WorkerDrainProgress {
    const nowMs = new Date(at).getTime();
    const completedLeaseCount = request.activeLeases.filter((lease) => new Date(lease.expiresAt).getTime() < nowMs).length;
    const remainingLeaseIds = request.activeLeases
      .filter((lease) => new Date(lease.expiresAt).getTime() >= nowMs)
      .map((lease) => lease.leaseId);
    return {
      workerId: request.workerId,
      phase,
      status,
      requestedBy: request.requestedBy,
      requestedAt: request.requestedAt,
      deadlineAt: request.deadlineAt,
      activeLeaseCount: request.activeLeases.length,
      completedLeaseCount,
      remainingLeaseIds,
      handoverLeaseIds: this.getHandoverLeases(request),
      quiesceDeadline: this.addMs(request.requestedAt, this.quiesceTimeoutMs),
      terminationDeadline: phase === WorkerDrainPhase.TERMINATE ? at : null,
      runTerminationCleanupRequired: request.activeLeases.some((lease) => lease.handoverRequired) && phase !== WorkerDrainPhase.DRAIN,
      forcedHandoffCount: 0,
      phaseHistory: [{
        phase: WorkerDrainPhase.DRAIN,
        at: request.requestedAt,
        enteredAt: request.requestedAt,
        exitedAt: null,
        leasesCompleted: completedLeaseCount,
      }],
    };
  }

  private terminateProgress(
    request: WorkerDrainRequest,
    progress: WorkerDrainProgress,
    now: string,
    status: "terminated" | "deadline_exceeded",
  ): WorkerDrainProgress {
    const forcedHandoffLeaseIds = request.activeLeases.filter((lease) => lease.handoverRequired).map((lease) => lease.leaseId);
    for (const lease of request.activeLeases.filter((item) => item.handoverRequired)) {
      this.options.leaseManager?.releaseLease({
        workerId: request.workerId,
        leaseId: lease.leaseId,
        nodeRunId: lease.nodeRunId,
        reason: "forced_handoff",
      });
    }
    this.options.recoveryNotifier?.notifyWorkerDrain({
      workerId: request.workerId,
      deadlineAt: request.deadlineAt,
      activeNodeRunIds: request.activeLeases.map((lease) => lease.nodeRunId),
      pendingLeaseIds: request.activeLeases.map((lease) => lease.leaseId),
      forcedHandoffLeaseIds,
    });
    return {
      ...progress,
      phase: WorkerDrainPhase.TERMINATE,
      status,
      terminationDeadline: now,
      runTerminationCleanupRequired: true,
      forcedHandoffCount: forcedHandoffLeaseIds.length,
      phaseHistory: this.appendPhase(progress, WorkerDrainPhase.TERMINATE, now),
    };
  }

  private appendPhase(
    progress: WorkerDrainProgress,
    phase: WorkerDrainPhase,
    at: string,
  ): WorkerDrainProgress["phaseHistory"] {
    const history = progress.phaseHistory.map((entry, index, entries) =>
      index === entries.length - 1 && entry.exitedAt == null
        ? { ...entry, exitedAt: at }
        : entry,
    );
    return [...history, {
      phase,
      at,
      enteredAt: at,
      exitedAt: null,
      leasesCompleted: progress.completedLeaseCount,
    }];
  }

  private addMs(value: string, ms: number): string {
    return new Date(new Date(value).getTime() + ms).toISOString();
  }

  private requestFromProgress(progress: WorkerDrainProgress): WorkerDrainRequest {
    return {
      workerId: progress.workerId,
      requestedBy: progress.requestedBy,
      requestedAt: progress.requestedAt,
      deadlineAt: progress.deadlineAt,
      activeLeases: progress.remainingLeaseIds.map((leaseId) => ({
        leaseId,
        nodeRunId: leaseId,
        expiresAt: progress.deadlineAt,
        handoverRequired: progress.handoverLeaseIds.includes(leaseId),
      })),
    };
  }
}
