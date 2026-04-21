/**
 * Drift detection thresholds: 24-hour sliding window with -10% relative change.
 * Emits SEV3 event when drift is detected.
 */

export interface DriftSample {
  observedAt: string;
  score: number;
}

export interface ChangepointDetectionResult {
  detected: boolean;
  baselineMean: number;
  recentMean: number;
  absoluteShift: number;
  relativeShift: number;
  reasonCode: string;
  severity: "SEV3" | "none";
}

/**
 * 24-hour baseline window in samples (assuming 1 sample per hour).
 * TODO(Phase3): Make window configurable via config service; currently hardcoded per §17 spec.
 */
const BASELINE_WINDOW_HOURS = 24;

/**
 * Recent window for comparison (last 3 hours per §17 spec).
 */
const RECENT_WINDOW_HOURS = 3;

/**
 * Detection threshold: -10% relative change triggers SEV3 alert.
 */
const DRIFT_THRESHOLD_RELATIVE = -0.10;

export class ChangepointDetectorService {
  /**
   * Detects changepoints using 24h sliding window and -10% relative threshold.
   *
   * @param samples Time-ordered drift samples (oldest first)
   * @param baselineWindow Number of samples for baseline (default 24 for 24h)
   * @param recentWindow Number of samples for recent window (default 3)
   * @returns ChangepointDetectionResult with SEV3 severity if drift detected
   */
  public detect(
    samples: DriftSample[],
    baselineWindow: number = BASELINE_WINDOW_HOURS,
    recentWindow: number = RECENT_WINDOW_HOURS,
  ): ChangepointDetectionResult {
    const baseline = samples.slice(0, baselineWindow);
    const recent = samples.slice(-recentWindow);

    if (baseline.length === 0 || recent.length === 0) {
      return {
        detected: false,
        baselineMean: 0,
        recentMean: 0,
        absoluteShift: 0,
        relativeShift: 0,
        reasonCode: "drift.insufficient_data",
        severity: "none",
      };
    }

    const baselineMean = average(baseline.map((s) => s.score));
    const recentMean = average(recent.map((s) => s.score));
    const absoluteShift = recentMean - baselineMean;
    const relativeShift = baselineMean !== 0 ? absoluteShift / baselineMean : 0;

    // §17: Detect -10% change (negative relative shift indicates performance degradation)
    const detected = relativeShift <= DRIFT_THRESHOLD_RELATIVE;

    return {
      detected,
      baselineMean,
      recentMean,
      absoluteShift,
      relativeShift,
      reasonCode: detected ? "drift.changepoint_detected" : "drift.stable",
      severity: detected ? "SEV3" : "none",
    };
  }
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}
