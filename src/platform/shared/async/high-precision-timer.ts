export interface HighPrecisionTimerRequest {
  readonly timerId: string;
  readonly scheduledAtNs: bigint;
  readonly deadlineAtNs: bigint;
  readonly firedAtNs: bigint;
}

export interface HighPrecisionTimerReceipt {
  readonly timerId: string;
  readonly precision: "nanosecond";
  readonly driftNs: bigint;
  readonly withinDeadline: boolean;
}

export class HighPrecisionTimer {
  public buildReceipt(request: HighPrecisionTimerRequest): HighPrecisionTimerReceipt {
    return {
      timerId: request.timerId,
      precision: "nanosecond",
      driftNs: request.firedAtNs - request.scheduledAtNs,
      withinDeadline: request.firedAtNs <= request.deadlineAtNs,
    };
  }
}
