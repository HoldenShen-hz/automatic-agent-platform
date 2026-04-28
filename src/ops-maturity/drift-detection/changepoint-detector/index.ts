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
  severity: "low" | "medium" | "high" | "none";
  recommendedAction: "observe" | "require_review" | "pause_agent" | "none";
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
    const effectiveBaselineWindow = Math.min(baselineWindow, Math.max(samples.length - recentWindow, 0));
    const baseline = samples.slice(0, effectiveBaselineWindow);
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
        recommendedAction: "none",
      };
    }

    // Fall back to the available pre-recent history when the full baseline window
    // is not available yet, but still require at least one full recent window of
    // baseline samples so comparisons are not made against a trivially small set.
    if (baseline.length < recentWindow) {
      return {
        detected: false,
        baselineMean: average(baseline.map((s) => s.score)),
        recentMean: average(recent.map((s) => s.score)),
        absoluteShift: 0,
        relativeShift: 0,
        reasonCode: "drift.insufficient_data",
        severity: "none",
        recommendedAction: "none",
      };
    }

    const baselineMean = average(baseline.map((s) => s.score));
    const recentMean = average(recent.map((s) => s.score));
    const absoluteShift = recentMean - baselineMean;
    const relativeShift = baselineMean !== 0 ? absoluteShift / baselineMean : 0;

    // §17: Detect -10% change (negative relative shift indicates performance degradation)
    // Use <= with epsilon to handle floating point precision errors
    const EPSILON = 1e-9;
    const detected = relativeShift <= DRIFT_THRESHOLD_RELATIVE + EPSILON;

    const severity = !detected
      ? "none"
      : relativeShift <= -0.25
        ? "high"
        : relativeShift <= -0.15
          ? "medium"
          : "low";
    return {
      detected,
      baselineMean,
      recentMean,
      absoluteShift,
      relativeShift,
      reasonCode: detected ? "drift.changepoint_detected" : "drift.stable",
      severity,
      recommendedAction: severity === "high" ? "pause_agent" : severity === "medium" ? "require_review" : severity === "low" ? "observe" : "none",
    };
  }
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}
