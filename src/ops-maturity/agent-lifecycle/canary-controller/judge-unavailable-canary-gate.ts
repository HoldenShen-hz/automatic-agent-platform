export interface JudgeAvailabilitySignal {
  readonly judgeProviderId: string;
  readonly available: boolean;
  readonly checkedAt: string;
}

export interface CanaryGateDecision {
  readonly canIncreaseTraffic: boolean;
  readonly paused: boolean;
  readonly reasonCode: "canary.judge_available" | "canary.judge_unavailable";
}

export class JudgeUnavailableCanaryGate {
  public evaluate(signal: JudgeAvailabilitySignal): CanaryGateDecision {
    return {
      canIncreaseTraffic: signal.available,
      paused: !signal.available,
      reasonCode: signal.available ? "canary.judge_available" : "canary.judge_unavailable",
    };
  }
}
