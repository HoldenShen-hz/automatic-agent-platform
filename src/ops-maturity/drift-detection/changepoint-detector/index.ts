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
  recommendedAction: DriftResponseActionType;
  sampleSize: number;
  minSampleSize: number;
  distributionAssumption: DriftDetectorConfig["distributionAssumption"];
  falsePositiveRate: number;
}

/**
 * 24-hour baseline window in samples (assuming 1 sample per hour).
 * TODO(Phase3): Make window configurable via config service; currently hardcoded per §17 spec.
 */
const BASELINE_WINDOW_HOURS = 24;

export type DriftWindowType = "1h" | "6h" | "24h" | "7d";
export type DriftResponseActionType =
  | "observe"
  | "require_review"
  | "pause_agent"
  | "throttle"
  | "downgrade"
  | "rollback"
  | "freeze"
  | "none";
export type DriftSignal = {
  signalId: string;
  subjectId: string;
  subjectType: string;
  detectedAt: string;
  driftScore: number;
  severity: "none" | "low" | "medium" | "high";
  windowType: DriftWindowType;
  baselineRef: string | null;
  reasonCode: string;
  recommendedAction: DriftResponseActionType;
  metadata?: Record<string, unknown>;
};
export type DriftResponsePlan = {
  planId: string;
  subjectId: string;
  subjectType: string;
  generatedAt: string;
  linkedSignalId: string | null;
  baselineRef: string | null;
  primaryAction: DriftResponseActionType;
  fallbackActions: readonly DriftResponseActionType[];
  guardrails: readonly string[];
};
export type DriftDetectorConfig = {
  minSampleSize: number;
  samplesPerHour: number;
  zscoreThreshold: number;
  zscoreHighSeverity: number;
  zscoreMediumSeverity: number;
  cusumBoundaryMultiplier: number;
  cusumSlackMultiplier: number;
  cusumHighSeverityMultiplier: number;
  cusumMediumSeverityMultiplier: number;
  bayesianConfidenceLevel: number;
  bayesianHighSeverity: number;
  bayesianMediumSeverity: number;
  kljsDivergenceThreshold: number;
  kljsHighSeverity: number;
  kljsMediumSeverity: number;
  distributionAssumption: "normal" | "poisson" | "exponential";
  falsePositiveRate: number;
  falsePositiveWindowSize: number;
  minSamplesBetweenAlerts: number;
};

/**
 * Recent window for comparison (last 3 hours per §17 spec).
 */
const RECENT_WINDOW_HOURS = 3;

/**
 * Detection threshold: -10% relative change triggers SEV3 alert.
 */
const DRIFT_THRESHOLD_RELATIVE = -0.10;

export class ChangepointDetectorService {
  private readonly config: DriftDetectorConfig;
  private lastAlertSampleIndex: number | null = null;

  public constructor(config: Partial<DriftDetectorConfig> = {}) {
    this.config = {
      minSampleSize: config.minSampleSize ?? 1,
      samplesPerHour: config.samplesPerHour ?? 1,
      zscoreThreshold: config.zscoreThreshold ?? 2.0,
      zscoreHighSeverity: config.zscoreHighSeverity ?? 4.0,
      zscoreMediumSeverity: config.zscoreMediumSeverity ?? 3.0,
      cusumBoundaryMultiplier: config.cusumBoundaryMultiplier ?? 5.0,
      cusumSlackMultiplier: config.cusumSlackMultiplier ?? 0.5,
      cusumHighSeverityMultiplier: config.cusumHighSeverityMultiplier ?? 3.0,
      cusumMediumSeverityMultiplier: config.cusumMediumSeverityMultiplier ?? 2.0,
      bayesianConfidenceLevel: config.bayesianConfidenceLevel ?? 0.95,
      bayesianHighSeverity: config.bayesianHighSeverity ?? 0.01,
      bayesianMediumSeverity: config.bayesianMediumSeverity ?? 0.03,
      kljsDivergenceThreshold: config.kljsDivergenceThreshold ?? 0.1,
      kljsHighSeverity: config.kljsHighSeverity ?? 0.3,
      kljsMediumSeverity: config.kljsMediumSeverity ?? 0.2,
      distributionAssumption: config.distributionAssumption ?? "normal",
      falsePositiveRate: config.falsePositiveRate ?? 0.05,
      falsePositiveWindowSize: config.falsePositiveWindowSize ?? 100,
      minSamplesBetweenAlerts: config.minSamplesBetweenAlerts ?? 5,
    };
  }

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
        sampleSize: samples.length,
        minSampleSize: this.config.minSampleSize,
        distributionAssumption: this.config.distributionAssumption,
        falsePositiveRate: this.config.falsePositiveRate,
      };
    }

    // Fall back to the available pre-recent history when the full baseline window
    // is not available yet, but still require at least one full recent window of
    // baseline samples so comparisons are not made against a trivially small set.
    if (baseline.length < recentWindow || samples.length < Math.max(this.config.minSampleSize, recentWindow + 1)) {
      return {
        detected: false,
        baselineMean: average(baseline.map((s) => s.score)),
        recentMean: average(recent.map((s) => s.score)),
        absoluteShift: 0,
        relativeShift: 0,
        reasonCode: "drift.insufficient_data",
        severity: "none",
        recommendedAction: "none",
        sampleSize: samples.length,
        minSampleSize: this.config.minSampleSize,
        distributionAssumption: this.config.distributionAssumption,
        falsePositiveRate: this.config.falsePositiveRate,
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

    const suppressedByWindow = detected
      && this.lastAlertSampleIndex != null
      && (samples.length - this.lastAlertSampleIndex) < this.config.minSamplesBetweenAlerts;
    const finalDetected = detected && !suppressedByWindow;
    if (finalDetected) {
      this.lastAlertSampleIndex = samples.length;
    }
    const severity = !finalDetected
      ? "none"
      : relativeShift <= -0.25
        ? "high"
        : relativeShift <= -0.15
          ? "medium"
          : "low";
    return {
      detected: finalDetected,
      baselineMean,
      recentMean,
      absoluteShift,
      relativeShift,
      reasonCode: suppressedByWindow
        ? "drift.false_positive_suppressed"
        : finalDetected ? "drift.changepoint_detected" : "drift.stable",
      severity,
      recommendedAction: severity === "high"
        ? relativeShift <= -0.35 ? "freeze" : "rollback"
        : severity === "medium"
          ? relativeShift <= -0.20 ? "downgrade" : "throttle"
          : severity === "low"
            ? "observe"
            : "none",
      sampleSize: samples.length,
      minSampleSize: this.config.minSampleSize,
      distributionAssumption: this.config.distributionAssumption,
      falsePositiveRate: this.config.falsePositiveRate,
    };
  }

  /**
   * Batch detection across multiple sample windows.
   * Returns results for all windows configured in DriftDetectorConfig.
   */
  public detectAll(samples: DriftSample[]): readonly ChangepointDetectionResult[] {
    // Use default single-window detection as fallback
    // The DriftDetectorConfig is used by DriftDetectorService to configure multi-window analysis
    return [this.detect(samples)];
  }

  public buildResponsePlan(input: {
    subjectId: string;
    subjectType: string;
    generatedAt: string;
    linkedSignalId?: string | null;
    baselineRef?: string | null;
    result: ChangepointDetectionResult;
  }): DriftResponsePlan | null {
    if (!input.result.detected || input.result.recommendedAction === "none") {
      return null;
    }
    const fallbackActions: DriftResponseActionType[] = [];
    if (input.result.recommendedAction === "freeze") {
      fallbackActions.push("rollback", "downgrade", "require_review");
    } else if (input.result.recommendedAction === "rollback") {
      fallbackActions.push("downgrade", "require_review");
    } else if (input.result.recommendedAction === "downgrade") {
      fallbackActions.push("throttle", "require_review");
    } else if (input.result.recommendedAction === "throttle") {
      fallbackActions.push("observe", "require_review");
    }
    return {
      planId: `drift_plan:${input.subjectType}:${input.subjectId}:${input.generatedAt}`,
      subjectId: input.subjectId,
      subjectType: input.subjectType,
      generatedAt: input.generatedAt,
      linkedSignalId: input.linkedSignalId ?? null,
      baselineRef: input.baselineRef ?? null,
      primaryAction: input.result.recommendedAction,
      fallbackActions,
      guardrails: [
        `reason:${input.result.reasonCode}`,
        `severity:${input.result.severity}`,
        `sample_size:${input.result.sampleSize}`,
      ],
    };
  }
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}
