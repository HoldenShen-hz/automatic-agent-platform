export interface FeedbackAggregateSignal {
  readonly segmentId: string;
  readonly sampleCount: number;
  readonly positiveRatio: number;
  readonly historicalPositiveRatio: number;
}

export interface FeedbackCollectiveAnomaly {
  readonly segmentId: string;
  readonly biasSuspected: boolean;
  readonly delta: number;
  readonly reasonCode: "feedback.normal" | "feedback.bias_suspected";
}

export class FeedbackCollectiveAnomalyDetector {
  public constructor(private readonly minSampleCount: number, private readonly maxAllowedDelta: number) {}

  public evaluate(signal: FeedbackAggregateSignal): FeedbackCollectiveAnomaly {
    const delta = Number((signal.positiveRatio - signal.historicalPositiveRatio).toFixed(4));
    const biasSuspected = signal.sampleCount >= this.minSampleCount && Math.abs(delta) > this.maxAllowedDelta;
    return {
      segmentId: signal.segmentId,
      biasSuspected,
      delta,
      reasonCode: biasSuspected ? "feedback.bias_suspected" : "feedback.normal",
    };
  }
}
