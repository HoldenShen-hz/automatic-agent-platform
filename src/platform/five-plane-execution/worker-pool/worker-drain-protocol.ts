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

export interface WorkerDrainReceipt {
  readonly workerId: string;
  readonly status: "draining" | "drained" | "deadline_exceeded";
  readonly requestedBy: string;
  readonly requestedAt: string;
  readonly deadlineAt: string;
  readonly activeLeaseCount: number;
  readonly handoverLeaseIds: readonly string[];
  readonly runTerminationCleanupRequired: boolean;
}

export class WorkerDrainProtocol {
  public createReceipt(request: WorkerDrainRequest, observedAt = request.requestedAt): WorkerDrainReceipt {
    const handoverLeaseIds = request.activeLeases
      .filter((lease) => lease.handoverRequired)
      .map((lease) => lease.leaseId);
    const deadlineExceeded = observedAt > request.deadlineAt;

    return {
      workerId: request.workerId,
      status: deadlineExceeded
        ? "deadline_exceeded"
        : request.activeLeases.length === 0
          ? "drained"
          : "draining",
      requestedBy: request.requestedBy,
      requestedAt: request.requestedAt,
      deadlineAt: request.deadlineAt,
      activeLeaseCount: request.activeLeases.length,
      handoverLeaseIds,
      runTerminationCleanupRequired: deadlineExceeded || handoverLeaseIds.length > 0,
    };
  }
}
