export interface DriftSample {
  observedAt: string;
  score: number;
}

export interface ChangepointDetectionResult {
  detected: boolean;
  baselineMean: number;
  recentMean: number;
  absoluteShift: number;
  reasonCode: string;
}

export class ChangepointDetectorService {
  public detect(samples: DriftSample[], baselineWindow: number = 3, recentWindow: number = 3): ChangepointDetectionResult {
    const baseline = samples.slice(0, baselineWindow);
    const recent = samples.slice(-recentWindow);
    const baselineMean = average(baseline.map((sample) => sample.score));
    const recentMean = average(recent.map((sample) => sample.score));
    const absoluteShift = Math.abs(recentMean - baselineMean);
    return {
      detected: absoluteShift >= 0.15,
      baselineMean,
      recentMean,
      absoluteShift,
      reasonCode: absoluteShift >= 0.15 ? "drift.changepoint_detected" : "drift.stable",
    };
  }
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}
