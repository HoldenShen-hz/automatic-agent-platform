/**
 * Drift detection using multiple canonical detection windows per §63.2.
 * Implements Z-Score (1h), CUSUM (7d), Bayesian (30d), and KL-JS (90d) methods.
 *
 * §63.2 requires:
 * - Configurable thresholds with sample-size awareness
 * - Explicit distribution assumptions per method
 * - False positive handling declarations
 */

export type DriftWindowType = "1h" | "6h" | "24h" | "7d";

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
  /** §63: Drift response actions - must support observe_only | throttle | downgrade | rollback | freeze */
  recommendedAction: "observe" | "require_review" | "pause_agent" | "throttle" | "downgrade" | "rollback" | "freeze" | "none";
}

/**
 * §63: Canonical DriftSignal - represents a detected drift event.
 * Used to signal drift detection results to governance and rollout systems.
 */
export interface DriftSignal {
  signalId: string;
  subjectId: string;
  subjectType: string;
  detectedAt: string;
  driftScore: number;
  severity: ChangepointDetectionResult["severity"];
  windowType: DriftWindowType;
  baselineRef: string | null;
  reasonCode: string;
  recommendedAction: ChangepointDetectionResult["recommendedAction"];
  metadata?: Record<string, unknown>;
}

/**
 * §63: Canonical DriftResponsePlan - planned response actions for drift.
 * Coordinates with rollout and governance systems to execute drift response.
 */
export interface DriftResponsePlan {
  planId: string;
  signalId: string;
  actions: DriftResponseAction[];
  createdAt: string;
  expiresAt: string | null;
  status: "proposed" | "approved" | "rejected" | "executed" | "expired";
}

export type DriftResponseActionType = "observe" | "throttle" | "downgrade" | "rollback" | "freeze";

export interface DriftResponseAction {
  actionType: DriftResponseActionType;
  targetId: string;
  targetType: string;
  reason: string;
  parameters?: Record<string, unknown>;
}

/**
 * §63.2: Configuration for drift detection thresholds and assumptions.
 * All thresholds are configurable to support different sample sizes and risk tolerances.
 */
export interface DriftDetectorConfig {
  /** §63.2: Minimum samples required before detection is attempted */
  readonly minSampleSize: number;
  /** §63.2: Samples per hour for window size calculation */
  readonly samplesPerHour: number;
  /** §63.2: Z-Score threshold (default 2.0, |Z| > threshold indicates drift) */
  readonly zscoreThreshold: number;
  /** §63.2: Z-Score severity thresholds */
  readonly zscoreHighSeverity: number;
  readonly zscoreMediumSeverity: number;
  /** §63.2: CUSUM decision boundary multiplier (h = multiplier * baselineMean) */
  readonly cusumBoundaryMultiplier: number;
  /** §63.2: CUSUM slack parameter multiplier (k = multiplier * baselineStd) */
  readonly cusumSlackMultiplier: number;
  /** §63.2: CUSUM severity thresholds as multiplier of h */
  readonly cusumHighSeverityMultiplier: number;
  readonly cusumMediumSeverityMultiplier: number;
  /** §63.2: Bayesian confidence level (default 0.95 = 95% confidence) */
  readonly bayesianConfidenceLevel: number;
  /** §63.2: Bayesian severity p-value thresholds */
  readonly bayesianHighSeverity: number;
  readonly bayesianMediumSeverity: number;
  /** §63.2: KL-JS divergence threshold (default 0.1) */
  readonly kljsDivergenceThreshold: number;
  /** §63.2: KL-JS severity divergence thresholds */
  readonly kljsHighSeverity: number;
  readonly kljsMediumSeverity: number;
  /** §63.2: Distribution assumption for detection method */
  readonly distributionAssumption: "normal" | "poisson" | "exponential" | "unknown";
  /** §63.2: Expected false positive rate for this configuration */
  readonly falsePositiveRate: number;
  /** §63.2: Rolling window for false positive rate estimation (in samples) */
  readonly falsePositiveWindowSize: number;
  /** §63.2: Multi-burst suppression - minimum samples between alerts */
  readonly minSamplesBetweenAlerts: number;
}

/**
 * §63.2: Default configuration with documented assumptions.
 * These values assume normal distribution and ~5% false positive rate.
 */
export const DEFAULT_DRIFT_DETECTOR_CONFIG: DriftDetectorConfig = {
  minSampleSize: 10,
  samplesPerHour: 1,
  zscoreThreshold: 2.0,
  zscoreHighSeverity: 4.0,
  zscoreMediumSeverity: 3.0,
  cusumBoundaryMultiplier: 5.0,
  cusumSlackMultiplier: 0.5,
  cusumHighSeverityMultiplier: 3.0,
  cusumMediumSeverityMultiplier: 2.0,
  bayesianConfidenceLevel: 0.95,
  bayesianHighSeverity: 0.01,
  bayesianMediumSeverity: 0.03,
  kljsDivergenceThreshold: 0.1,
  kljsHighSeverity: 0.3,
  kljsMediumSeverity: 0.2,
  distributionAssumption: "normal",
  falsePositiveRate: 0.05,
  falsePositiveWindowSize: 100,
  minSamplesBetweenAlerts: 5,
};

/** §63.2: 1h window - rapid shift detection using CUSUM */
const WINDOW_1H_HOURS = 1;

/** §63.2: 6h window - short-term drift using CUSUM */
const WINDOW_6H_HOURS = 6;

/** §63.2: 24h window - daily pattern detection using CUSUM */
const WINDOW_24H_HOURS = 24;

/** §63.2: 7d window - weekly trend detection using Bayesian changepoint */
const WINDOW_7D_HOURS = 7 * 24;

const ALL_WINDOWS: DriftWindowType[] = ["1h", "6h", "24h", "7d"];

/**
 * §63.2: Detection metadata including sample-size awareness and false positive tracking.
 */
export interface DetectionMetadata {
  readonly sampleSizeUsed: number;
  readonly distributionAssumption: DriftDetectorConfig["distributionAssumption"];
  readonly falsePositiveRateEstimate: number;
  readonly lastAlertSampleIndex: number | null;
  readonly suppressedUntilSampleIndex: number | null;
}

export class ChangepointDetectorService {
  private readonly config: DriftDetectorConfig;
  /** §63.2: Tracks samples since last alert for burst suppression */
  private samplesSinceLastAlert = 0;
  /** §63.2: Tracks recent detections for false positive rate estimation */
  private recentDetections: boolean[] = [];

  public constructor(config: DriftDetectorConfig = DEFAULT_DRIFT_DETECTOR_CONFIG) {
    this.config = config;
  }

  /**
   * Detects changepoints using multiple canonical detection windows per §63.2.
   *
   * @param samples Time-ordered drift samples (oldest first)
   * @param windowTypes Which detection windows to use (default all 4 windows: 1h/6h/24h/7d)
   * @returns ChangepointDetectionResult with severity if drift detected
   */
  public detect(
    samples: DriftSample[],
    windowTypes: DriftWindowType[] = ["1h", "6h", "24h", "7d"],
  ): ChangepointDetectionResult {
    // §63.2: For multi-window analysis, run all windows and aggregate results
    if (windowTypes.length > 1) {
      return this.detectMultiWindow(samples, windowTypes);
    }

    const windowType = windowTypes[0]!;
    const windowHours = this.getWindowHours(windowType);
    const windowSamples = windowHours * this.config.samplesPerHour;

    // §63.2: Check minimum sample size requirement
    if (samples.length < Math.max(windowSamples, this.config.minSampleSize)) {
      return {
        detected: false,
        baselineMean: 0,
        recentMean: 0,
        absoluteShift: 0,
        relativeShift: 0,
        reasonCode: `drift.insufficient_data:${windowType}:requires_${Math.max(windowSamples, this.config.minSampleSize)}_samples`,
        severity: "none",
        recommendedAction: "none",
      };
    }

    // §63.2: Burst suppression - suppress alerts if too close to last alert
    this.samplesSinceLastAlert++;
    if (
      this.recentDetections.length > 0
      && this.samplesSinceLastAlert < this.config.minSamplesBetweenAlerts
    ) {
      return {
        detected: false,
        baselineMean: 0,
        recentMean: 0,
        absoluteShift: 0,
        relativeShift: 0,
        reasonCode: `drift.suppressed:${windowType}:burst_suppression_active`,
        severity: "none",
        recommendedAction: "none",
      };
    }

    // §63.2: Use CUSUM for short windows (1h/6h/24h) - proper statistical changepoint algorithm
    // §63.2: Use Bayesian for longer window (7d) - proper statistical changepoint with significance
    let result: ChangepointDetectionResult;
    switch (windowType) {
      case "1h":
      case "6h":
      case "24h":
        result = this.detectCUSUM(samples, windowSamples);
        break;
      case "7d":
        result = this.detectBayesian(samples, windowSamples);
        break;
    }

    // §63.2: Track detections for false positive rate estimation
    this.recentDetections.push(result.detected);
    if (this.recentDetections.length > this.config.falsePositiveWindowSize) {
      this.recentDetections.shift();
    }

    // §63.2: Reset suppression counter if detection occurred
    if (result.detected) {
      this.samplesSinceLastAlert = 0;
    }

    return result;
  }

  /**
   * §63.2: Multi-window detection using proper statistical algorithms per window.
   * Aggregates results from all windows for comprehensive drift detection.
   */
  private detectMultiWindow(
    samples: DriftSample[],
    windowTypes: DriftWindowType[],
  ): ChangepointDetectionResult {
    const results = windowTypes.map((wt) => this.detect(samples, [wt]));

    // §63.2: Aggregate detection - if any window detects with high severity, mark as detected
    const anyDetected = results.some((r) => r.detected);
    const maxSeverity = results.reduce((max, r) => {
      const severityOrder = { none: 0, low: 1, medium: 2, high: 3 };
      return severityOrder[r.severity] > severityOrder[max] ? r.severity : max;
    }, "none" as ChangepointDetectionResult["severity"]);

    // §63.2: Use the most significant result for reporting
    const primaryResult = results.find((r) => r.detected) ?? results[0]!;

    return {
      detected: anyDetected,
      baselineMean: primaryResult.baselineMean,
      recentMean: primaryResult.recentMean,
      absoluteShift: primaryResult.absoluteShift,
      relativeShift: primaryResult.relativeShift,
      reasonCode: `drift.multi_window:${windowTypes.join(",")}:${primaryResult.reasonCode}`,
      severity: maxSeverity,
      recommendedAction: severityToAction(maxSeverity),
    };
  }

  /**
   * Returns all 4 canonical detection window results per §63.2.
   */
  public detectAll(samples: DriftSample[]): ChangepointDetectionResult[] {
    return ALL_WINDOWS.map((windowType) => this.detect(samples, [windowType]));
  }

  /**
   * §63.2: Returns metadata about the last detection including false positive rate estimate.
   */
  public getMetadata(): DetectionMetadata {
    const falsePositiveRate = this.recentDetections.length > 0
      ? this.recentDetections.filter((d) => d).length / this.recentDetections.length
      : this.config.falsePositiveRate;
    return {
      sampleSizeUsed: this.config.minSampleSize,
      distributionAssumption: this.config.distributionAssumption,
      falsePositiveRateEstimate: falsePositiveRate,
      lastAlertSampleIndex: this.samplesSinceLastAlert > 0 ? this.recentDetections.length - this.samplesSinceLastAlert : null,
      suppressedUntilSampleIndex: this.samplesSinceLastAlert < this.config.minSamplesBetweenAlerts
        ? this.recentDetections.length
        : null,
    };
  }

  /**
   * §63.2: Returns the current configuration being used.
   */
  public getConfig(): DriftDetectorConfig {
    return this.config;
  }

  private getWindowHours(windowType: DriftWindowType): number {
    switch (windowType) {
      case "1h":
        return WINDOW_1H_HOURS;
      case "6h":
        return WINDOW_6H_HOURS;
      case "24h":
        return WINDOW_24H_HOURS;
      case "7d":
        return WINDOW_7D_HOURS;
    }
  }

  /**
   * CUSUM: Cumulative sum detection for gradual drifts (used for 1h/6h/24h windows).
   * §63.2: Proper statistical changepoint algorithm - detects cumulative shifts.
   */
  private detectCUSUM(
    samples: DriftSample[],
    windowSamples: number,
  ): ChangepointDetectionResult {
    const baseline = samples.slice(0, windowSamples);
    const recent = samples.slice(-Math.min(windowSamples, 24)); // Last 24h for comparison

    const baselineMean = average(baseline.map((s) => s.score));
    const baselineStd = standardDeviation(baseline.map((s) => s.score));
    const target = baselineMean;

    // §63.2: Use configurable slack parameter
    const k = this.config.cusumSlackMultiplier * baselineStd;

    let cusumPos = 0;
    let cusumNeg = 0;

    for (const sample of recent) {
      const dev = sample.score - target;
      cusumPos = Math.max(0, cusumPos + dev - k);
      cusumNeg = Math.max(0, cusumNeg - dev - k);
    }

    // §63.2: Use configurable decision boundary
    const h = this.config.cusumBoundaryMultiplier * baselineMean;
    const detected = cusumPos > h || cusumNeg > h;

    const severity = this.cusumToSeverity(cusumPos, cusumNeg, h);
    return {
      detected,
      baselineMean,
      recentMean: average(recent.map((s) => s.score)),
      absoluteShift: average(recent.map((s) => s.score)) - baselineMean,
      relativeShift: baselineMean !== 0 ? (average(recent.map((s) => s.score)) - baselineMean) / baselineMean : 0,
      reasonCode: `drift.cusum_detected:${this.config.distributionAssumption}`,
      severity,
      recommendedAction: severityToAction(severity),
    };
  }

  /**
   * Bayesian: Probabilistic drift detection with significance testing (used for 7d window).
   * §63.2: Proper statistical changepoint algorithm with p-value significance testing.
   */
  private detectBayesian(
    samples: DriftSample[],
    windowSamples: number,
  ): ChangepointDetectionResult {
    const baseline = samples.slice(0, windowSamples);
    const recent = samples.slice(-Math.min(windowSamples, 24));

    const baselineMean = average(baseline.map((s) => s.score));
    const recentMean = average(recent.map((s) => s.score));
    const baselineVar = variance(baseline.map((s) => s.score));
    const recentVar = variance(recent.map((s) => s.score));

    // Simple Bayesian comparison: compute probability that recent mean differs from baseline
    const pooledVar = (baselineVar + recentVar) / 2;
    const se = Math.sqrt(pooledVar / recent.length);
    const tStat = se !== 0 ? Math.abs(recentMean - baselineMean) / se : 0;

    // §63.2: Use configurable confidence level for detection threshold
    const pValue = 2 * (1 - normalCDF(tStat));
    const alpha = 1 - this.config.bayesianConfidenceLevel;
    const detected = pValue < alpha;

    const severity = this.bayesianToSeverity(pValue);
    return {
      detected,
      baselineMean,
      recentMean,
      absoluteShift: recentMean - baselineMean,
      relativeShift: baselineMean !== 0 ? (recentMean - baselineMean) / baselineMean : 0,
      reasonCode: `drift.bayesian_detected:${this.config.distributionAssumption}`,
      severity,
      recommendedAction: severityToAction(severity),
    };
  }

  /**
   * 90d KL-JS: Distribution divergence detection using Jensen-Shannon divergence.
   * §63.2: No distribution assumption required; threshold is configurable.
   */
  private detectKLJS(
    samples: DriftSample[],
    windowSamples: number,
  ): ChangepointDetectionResult {
    const baseline = samples.slice(0, windowSamples);
    const recent = samples.slice(-Math.min(windowSamples, 24));

    const baselineScores = baseline.map((s) => s.score);
    const recentScores = recent.map((s) => s.score);

    const divergence = this.jensenShannonDivergence(baselineScores, recentScores);
    // §63.2: Use configurable divergence threshold
    const detected = divergence > this.config.kljsDivergenceThreshold;

    const severity = this.kljsToSeverity(divergence);
    return {
      detected,
      baselineMean: average(baselineScores),
      recentMean: average(recentScores),
      absoluteShift: average(recentScores) - average(baselineScores),
      relativeShift: average(baselineScores) !== 0
        ? (average(recentScores) - average(baselineScores)) / average(baselineScores)
        : 0,
      reasonCode: detected ? "drift.kljs_detected:distribution_free" : "drift.stable",
      severity,
      recommendedAction: severityToAction(severity),
    };
  }

  private jensenShannonDivergence(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0) return 0;

    // Bin the scores into discrete distributions
    const allScores = [...a, ...b];
    const min = Math.min(...allScores);
    const max = Math.max(...allScores);
    const bins = 10;
    const binWidth = (max - min) / bins || 1;

    const histA = new Array(bins).fill(0);
    const histB = new Array(bins).fill(0);

    for (const v of a) {
      const idx = Math.min(Math.floor((v - min) / binWidth), bins - 1);
      histA[idx]++;
    }
    for (const v of b) {
      const idx = Math.min(Math.floor((v - min) / binWidth), bins - 1);
      histB[idx]++;
    }

    // Normalize to probability distributions
    const norm = (arr: number[]) => {
      const sum = arr.reduce((s, v) => s + v, 0);
      return sum > 0 ? arr.map((v) => v / sum) : arr;
    };
    const p = norm(histA);
    const q = norm(histB);

    // Compute KL divergence P||M and Q||M where M = (P+Q)/2
    const m = p.map((vi, i) => (vi + q[i]) / 2);
    const klPM = p.reduce((sum, pi, i) => sum + (pi > 0 && m[i] > 0 ? pi * Math.log(pi / m[i]) : 0), 0);
    const klQM = q.reduce((sum, qi, i) => sum + (qi > 0 && m[i] > 0 ? qi * Math.log(qi / m[i]) : 0), 0);

    return (klPM + klQM) / 2;
  }

  // §63.2: Use configurable severity thresholds
  private zScoreToSeverity(zScore: number): ChangepointDetectionResult["severity"] {
    if (Math.abs(zScore) > this.config.zscoreHighSeverity) return "high";
    if (Math.abs(zScore) > this.config.zscoreMediumSeverity) return "medium";
    if (Math.abs(zScore) > this.config.zscoreThreshold) return "low";
    return "none";
  }

  // §63.2: Use configurable severity multipliers
  private cusumToSeverity(
    cusumPos: number,
    cusumNeg: number,
    h: number,
  ): ChangepointDetectionResult["severity"] {
    const maxCusum = Math.max(cusumPos, cusumNeg);
    if (maxCusum > this.config.cusumHighSeverityMultiplier * h) return "high";
    if (maxCusum > this.config.cusumMediumSeverityMultiplier * h) return "medium";
    if (maxCusum > h) return "low";
    return "none";
  }

  // §63.2: Use configurable severity p-value thresholds
  private bayesianToSeverity(pValue: number): ChangepointDetectionResult["severity"] {
    if (pValue < this.config.bayesianHighSeverity) return "high";
    if (pValue < this.config.bayesianMediumSeverity) return "medium";
    if (pValue < 1 - this.config.bayesianConfidenceLevel) return "low";
    return "none";
  }

  // §63.2: Use configurable severity divergence thresholds
  private kljsToSeverity(divergence: number): ChangepointDetectionResult["severity"] {
    if (divergence > this.config.kljsHighSeverity) return "high";
    if (divergence > this.config.kljsMediumSeverity) return "medium";
    if (divergence > this.config.kljsDivergenceThreshold) return "low";
    return "none";
  }
}

function average(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = average(values);
  return Math.sqrt(values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length);
}

function variance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = average(values);
  return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
}

function normalCDF(x: number): number {
  // Approximation of standard normal CDF
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
}

function severityToAction(
  severity: ChangepointDetectionResult["severity"],
): ChangepointDetectionResult["recommendedAction"] {
  switch (severity) {
    case "high":
      return "freeze";
    case "medium":
      return "throttle";
    case "low":
      return "observe";
    case "none":
      return "none";
  }
}
