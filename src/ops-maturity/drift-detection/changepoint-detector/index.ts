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

/**
 * ChangepointDetectorConfig - per-window-type detection thresholds.
 * Supports multiple window types with independent thresholds.
 */
export const DRIFT_DETECTION_WINDOWS: Record<DriftWindowType, {
  baselineHours: number;
  recentHours: number;
  defaultThreshold: number;
  severityThresholds: { low: number; medium: number; high: number };
}> = {
  "1h": {
    baselineHours: 1,
    recentHours: 15,       // 15min baseline vs 5min recent
    defaultThreshold: -0.05,
    severityThresholds: { low: -0.05, medium: -0.10, high: -0.20 },
  },
  "6h": {
    baselineHours: 6,
    recentHours: 1,        // 6h baseline vs 1h recent
    defaultThreshold: -0.08,
    severityThresholds: { low: -0.08, medium: -0.15, high: -0.25 },
  },
  "24h": {
    baselineHours: 24,
    recentHours: 3,        // 24h baseline vs 3h recent
    defaultThreshold: -0.10,
    severityThresholds: { low: -0.10, medium: -0.15, high: -0.25 },
  },
  "7d": {
    baselineHours: 168,   // 7 days
    recentHours: 24,       // 24h recent window
    defaultThreshold: -0.12,
    severityThresholds: { low: -0.12, medium: -0.20, high: -0.30 },
  },
};

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
   * Detects changepoints across multiple window types.
   * Returns results for all configured windows (1h, 6h, 24h, 7d).
   *
   * @param samples Time-ordered drift samples (oldest first)
   * @param windowTypes Which windows to evaluate (defaults to all)
   * @returns ChangepointDetectionResult[] with results per window
   */
  public detectAll(samples: DriftSample[], windowTypes: DriftWindowType[] = ["1h", "6h", "24h", "7d"]): readonly ChangepointDetectionResult[] {
    const results: ChangepointDetectionResult[] = [];
    for (const windowType of windowTypes) {
      const windowConfig = DRIFT_DETECTION_WINDOWS[windowType];
      const baselineSamples = Math.floor(windowConfig.baselineHours * this.config.samplesPerHour);
      const recentSamples = Math.floor(windowConfig.recentHours * this.config.samplesPerHour);
      const result = this.detect(samples, baselineSamples, recentSamples, windowType, windowConfig.defaultThreshold);
      results.push(result);
    }
    return results;
  }

  /**
   * Detects changepoints using configured window parameters.
   *
   * @param samples Time-ordered drift samples (oldest first)
   * @param baselineWindow Number of samples for baseline
   * @param recentWindow Number of samples for recent window
   * @param windowType Window type for severity thresholds
   * @param threshold Override detection threshold
   * @returns ChangepointDetectionResult with SEV3 severity if drift detected
   */
  public detect(
    samples: DriftSample[],
    baselineWindow: number = BASELINE_WINDOW_HOURS,
    recentWindow: number = RECENT_WINDOW_HOURS,
    windowType: DriftWindowType = "24h",
    threshold: number = DRIFT_THRESHOLD_RELATIVE,
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

    // Detect using window-specific threshold
    const windowConfig = DRIFT_DETECTION_WINDOWS[windowType];
    const EPSILON = 1e-9;
    const detected = relativeShift <= (threshold ?? windowConfig.defaultThreshold) + EPSILON;

    const suppressedByWindow = detected
      && this.lastAlertSampleIndex != null
      && (samples.length - this.lastAlertSampleIndex) < this.config.minSamplesBetweenAlerts;
    const finalDetected = detected && !suppressedByWindow;
    if (finalDetected) {
      this.lastAlertSampleIndex = samples.length;
    }
    const severity = !finalDetected
      ? "none"
      : relativeShift <= windowConfig.severityThresholds.high
        ? "high"
        : relativeShift <= windowConfig.severityThresholds.medium
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
        ? relativeShift <= windowConfig.severityThresholds.high - 0.10 ? "freeze" : "rollback"
        : severity === "medium"
          ? relativeShift <= (windowConfig.severityThresholds.medium - 0.05) ? "downgrade" : "throttle"
          : severity === "low"
            ? "observe"
            : "none",
      sampleSize: samples.length,
      minSampleSize: this.config.minSampleSize,
      distributionAssumption: this.config.distributionAssumption,
      falsePositiveRate: this.config.falsePositiveRate,
    };
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
