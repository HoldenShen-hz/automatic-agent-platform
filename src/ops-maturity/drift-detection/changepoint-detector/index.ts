/**
 * Changepoint detector supporting the canonical architecture windows:
 * 1h Z-Score, 7d CUSUM, 30d Bayesian-style confidence, 90d KL/JS divergence.
 *
 * Legacy 6h/24h relative-threshold windows remain supported for compatibility.
 */

export interface CanonicalDriftMetricSnapshot {
  successRate: number;
  overrideRate: number;
  averageCostUsd: number;
  toolUsageShift: number;
  incidentCount: number;
}

export interface DriftSample {
  observedAt: string;
  score: number;
  metrics?: Partial<CanonicalDriftMetricSnapshot>;
}

export type CanonicalDriftDimension =
  | "success_rate_drop"
  | "override_rate_spike"
  | "cost_spike"
  | "tool_usage_shift"
  | "incident_count";

export type DriftWindowType = "1h" | "6h" | "24h" | "7d" | "30d" | "90d";
export type DriftDetectionAlgorithm =
  | "z_score"
  | "cusum"
  | "bayesian_online"
  | "kl_js_divergence"
  | "relative_threshold";
export type DriftResponseActionType =
  | "observe"
  | "require_review"
  | "pause_agent"
  | "throttle"
  | "downgrade"
  | "rollback"
  | "freeze"
  | "none";

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
  windowType: DriftWindowType;
  algorithm: DriftDetectionAlgorithm;
  algorithmScore: number;
  evaluatedDimensions: Record<CanonicalDriftDimension, number>;
}

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

export const DEFAULT_DRIFT_DETECTOR_CONFIG: DriftDetectorConfig = {
  minSampleSize: 1,
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

const LEGACY_BASELINE_WINDOW_HOURS = 24;
const LEGACY_RECENT_WINDOW_HOURS = 3;
const LEGACY_DRIFT_THRESHOLD_RELATIVE = -0.10;
const EPSILON = 1e-9;

export const DRIFT_DETECTION_WINDOWS: Record<
  DriftWindowType,
  {
    baselineHours: number;
    recentHours: number;
    defaultThreshold: number;
    severityThresholds: { low: number; medium: number; high: number };
    algorithm: DriftDetectionAlgorithm;
  }
> = {
  "1h": {
    baselineHours: 1,
    recentHours: 0.25,
    defaultThreshold: -0.05,
    severityThresholds: { low: -0.05, medium: -0.1, high: -0.2 },
    algorithm: "z_score",
  },
  "6h": {
    baselineHours: 6,
    recentHours: 1,
    defaultThreshold: -0.08,
    severityThresholds: { low: -0.08, medium: -0.15, high: -0.25 },
    algorithm: "relative_threshold",
  },
  "24h": {
    baselineHours: 24,
    recentHours: 3,
    defaultThreshold: LEGACY_DRIFT_THRESHOLD_RELATIVE,
    severityThresholds: { low: -0.1, medium: -0.15, high: -0.25 },
    algorithm: "relative_threshold",
  },
  "7d": {
    baselineHours: 24 * 7,
    recentHours: 24,
    defaultThreshold: -0.12,
    severityThresholds: { low: -0.12, medium: -0.2, high: -0.3 },
    algorithm: "cusum",
  },
  "30d": {
    baselineHours: 24 * 30,
    recentHours: 24 * 3,
    defaultThreshold: -0.15,
    severityThresholds: { low: -0.15, medium: -0.22, high: -0.3 },
    algorithm: "bayesian_online",
  },
  "90d": {
    baselineHours: 24 * 90,
    recentHours: 24 * 7,
    defaultThreshold: -0.18,
    severityThresholds: { low: -0.18, medium: -0.25, high: -0.35 },
    algorithm: "kl_js_divergence",
  },
};

export class ChangepointDetectorService {
  private readonly config: DriftDetectorConfig;
  private lastAlertSampleIndex: number | null = null;

  public constructor(config: Partial<DriftDetectorConfig> = {}) {
    this.config = {
      ...DEFAULT_DRIFT_DETECTOR_CONFIG,
      ...config,
    };
  }

  public getConfig(): DriftDetectorConfig {
    return { ...this.config };
  }

  public getMetadata(): { distributionAssumption: DriftDetectorConfig["distributionAssumption"]; falsePositiveRateEstimate: number } {
    return {
      distributionAssumption: this.config.distributionAssumption,
      falsePositiveRateEstimate: this.config.falsePositiveRate,
    };
  }

  public detectAll(
    samples: DriftSample[],
    windowTypes: DriftWindowType[] = ["1h", "7d", "30d", "90d"],
  ): readonly ChangepointDetectionResult[] {
    return windowTypes.map((windowType) => {
      const windowConfig = DRIFT_DETECTION_WINDOWS[windowType];
      const baselineSamples = hoursToSamples(windowConfig.baselineHours, this.config.samplesPerHour);
      const recentSamples = hoursToSamples(windowConfig.recentHours, this.config.samplesPerHour);
      return this.detect(samples, baselineSamples, recentSamples, windowType, windowConfig.defaultThreshold);
    });
  }

  public detect(
    samples: DriftSample[],
    baselineWindowOrWindows: number | readonly DriftWindowType[] = LEGACY_BASELINE_WINDOW_HOURS,
    recentWindow: number = LEGACY_RECENT_WINDOW_HOURS,
    windowType: DriftWindowType = "24h",
    threshold: number = LEGACY_DRIFT_THRESHOLD_RELATIVE,
  ): ChangepointDetectionResult {
    if (Array.isArray(baselineWindowOrWindows)) {
      return this.aggregateResults(this.detectAll(samples, [...baselineWindowOrWindows]));
    }

    const effectiveBaselineWindow = Math.min(
      Math.max(1, Math.floor(baselineWindowOrWindows)),
      Math.max(samples.length - Math.max(1, recentWindow), 0),
    );
    const effectiveRecentWindow = Math.max(1, Math.floor(recentWindow));
    const baseline = samples.slice(0, effectiveBaselineWindow);
    const recent = samples.slice(-effectiveRecentWindow);
    const metrics = this.buildSharedMetrics(samples, baseline, recent, windowType);

    if (baseline.length === 0 || recent.length === 0) {
      return this.buildUndetectedResult(metrics, "drift.insufficient_data");
    }

    if (
      baseline.length < effectiveRecentWindow
      || samples.length < Math.max(this.config.minSampleSize, effectiveRecentWindow + 1)
    ) {
      return this.buildUndetectedResult(metrics, "drift.insufficient_data");
    }

    const algorithmEvaluation = this.evaluateWindowAlgorithm(windowType, baseline, recent, threshold, metrics);
    const suppressedByWindow = algorithmEvaluation.detected
      && this.lastAlertSampleIndex != null
      && (samples.length - this.lastAlertSampleIndex) < this.config.minSamplesBetweenAlerts;
    const finalDetected = algorithmEvaluation.detected && !suppressedByWindow;
    if (finalDetected) {
      this.lastAlertSampleIndex = samples.length;
    }

    return {
      detected: finalDetected,
      baselineMean: metrics.baselineMean,
      recentMean: metrics.recentMean,
      absoluteShift: metrics.absoluteShift,
      relativeShift: metrics.relativeShift,
      reasonCode: suppressedByWindow
        ? "drift.false_positive_suppressed"
        : finalDetected
          ? "drift.changepoint_detected"
          : "drift.stable",
      severity: finalDetected ? algorithmEvaluation.severity : "none",
      recommendedAction: finalDetected ? severityToAction(algorithmEvaluation.severity) : "none",
      sampleSize: samples.length,
      minSampleSize: this.config.minSampleSize,
      distributionAssumption: this.config.distributionAssumption,
      falsePositiveRate: this.config.falsePositiveRate,
      windowType,
      algorithm: DRIFT_DETECTION_WINDOWS[windowType].algorithm,
      algorithmScore: algorithmEvaluation.algorithmScore,
      evaluatedDimensions: metrics.evaluatedDimensions,
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
        `window:${input.result.windowType}`,
        `algorithm:${input.result.algorithm}`,
        `reason:${input.result.reasonCode}`,
        `severity:${input.result.severity}`,
        `sample_size:${input.result.sampleSize}`,
      ],
    };
  }

  private aggregateResults(results: readonly ChangepointDetectionResult[]): ChangepointDetectionResult {
    if (results.length === 0) {
      return this.buildUndetectedResult(
        {
          baselineMean: 0,
          recentMean: 0,
          absoluteShift: 0,
          relativeShift: 0,
          sampleSize: 0,
          evaluatedDimensions: emptyDimensions(),
        },
        "drift.insufficient_data",
        "24h",
      );
    }
    const ranked = [...results].sort((left, right) => severityRank(right.severity) - severityRank(left.severity));
    const selected = ranked[0]!;
    return {
      ...selected,
      reasonCode: selected.detected ? "drift.multi_window_aggregate_detected" : "drift.multi_window_aggregate_stable",
    };
  }

  private buildUndetectedResult(
    metrics: {
      baselineMean: number;
      recentMean: number;
      absoluteShift: number;
      relativeShift: number;
      sampleSize: number;
      evaluatedDimensions: Record<CanonicalDriftDimension, number>;
    },
    reasonCode: string,
    windowType: DriftWindowType = "24h",
  ): ChangepointDetectionResult {
    return {
      detected: false,
      baselineMean: metrics.baselineMean,
      recentMean: metrics.recentMean,
      absoluteShift: metrics.absoluteShift,
      relativeShift: metrics.relativeShift,
      reasonCode,
      severity: "none",
      recommendedAction: "none",
      sampleSize: metrics.sampleSize,
      minSampleSize: this.config.minSampleSize,
      distributionAssumption: this.config.distributionAssumption,
      falsePositiveRate: this.config.falsePositiveRate,
      windowType,
      algorithm: DRIFT_DETECTION_WINDOWS[windowType].algorithm,
      algorithmScore: 0,
      evaluatedDimensions: metrics.evaluatedDimensions,
    };
  }

  private buildSharedMetrics(
    samples: readonly DriftSample[],
    baseline: readonly DriftSample[],
    recent: readonly DriftSample[],
    windowType: DriftWindowType,
  ): {
    baselineMean: number;
    recentMean: number;
    absoluteShift: number;
    relativeShift: number;
    sampleSize: number;
    evaluatedDimensions: Record<CanonicalDriftDimension, number>;
    windowType: DriftWindowType;
  } {
    const baselineMean = average(baseline.map((sample) => sample.score));
    const recentMean = average(recent.map((sample) => sample.score));
    const absoluteShift = recentMean - baselineMean;
    const relativeShift = baselineMean !== 0 ? absoluteShift / baselineMean : 0;
    return {
      baselineMean,
      recentMean,
      absoluteShift,
      relativeShift,
      sampleSize: samples.length,
      evaluatedDimensions: evaluateCanonicalDimensions(baseline, recent, relativeShift),
      windowType,
    };
  }

  private evaluateWindowAlgorithm(
    windowType: DriftWindowType,
    baseline: readonly DriftSample[],
    recent: readonly DriftSample[],
    threshold: number,
    metrics: {
      baselineMean: number;
      recentMean: number;
      absoluteShift: number;
      relativeShift: number;
    },
  ): { detected: boolean; severity: ChangepointDetectionResult["severity"]; algorithmScore: number } {
    const baselineScores = baseline.map((sample) => sample.score);
    const recentScores = recent.map((sample) => sample.score);
    const baselineStdDev = standardDeviation(baselineScores);
    const windowConfig = DRIFT_DETECTION_WINDOWS[windowType];

    switch (windowConfig.algorithm) {
      case "z_score": {
        const zScore = baselineStdDev > EPSILON ? Math.abs(metrics.recentMean - metrics.baselineMean) / baselineStdDev : 0;
        const detected = metrics.recentMean < metrics.baselineMean && zScore >= this.config.zscoreThreshold;
        return {
          detected,
          severity: detected
            ? zScore >= this.config.zscoreHighSeverity
              ? "high"
              : zScore >= this.config.zscoreMediumSeverity
                ? "medium"
                : "low"
            : "none",
          algorithmScore: Number(zScore.toFixed(4)),
        };
      }
      case "cusum": {
        const slack = Math.max(EPSILON, baselineStdDev * this.config.cusumSlackMultiplier);
        const cusum = recentScores.reduce((sum, score) =>
          Math.max(0, sum + (metrics.baselineMean - score - slack)),
        0);
        const boundary = Math.max(EPSILON, baselineStdDev * this.config.cusumBoundaryMultiplier);
        const detected = metrics.recentMean < metrics.baselineMean && cusum >= boundary;
        return {
          detected,
          severity: detected
            ? cusum >= boundary * this.config.cusumHighSeverityMultiplier
              ? "high"
              : cusum >= boundary * this.config.cusumMediumSeverityMultiplier
                ? "medium"
                : "low"
            : "none",
          algorithmScore: Number(cusum.toFixed(4)),
        };
      }
      case "bayesian_online": {
        const posteriorChangeProbability = 1 - Math.exp(-Math.abs(metrics.absoluteShift) / Math.max(EPSILON, baselineStdDev + Math.abs(metrics.baselineMean) * 0.05));
        const noChangeProbability = 1 - posteriorChangeProbability;
        const detected = metrics.recentMean < metrics.baselineMean && posteriorChangeProbability >= this.config.bayesianConfidenceLevel;
        return {
          detected,
          severity: detected
            ? noChangeProbability <= this.config.bayesianHighSeverity
              ? "high"
              : noChangeProbability <= this.config.bayesianMediumSeverity
                ? "medium"
                : "low"
            : "none",
          algorithmScore: Number(posteriorChangeProbability.toFixed(4)),
        };
      }
      case "kl_js_divergence": {
        const divergence = jensenShannonDivergence(baselineScores, recentScores);
        const detected = metrics.recentMean < metrics.baselineMean && divergence >= this.config.kljsDivergenceThreshold;
        return {
          detected,
          severity: detected
            ? divergence >= this.config.kljsHighSeverity
              ? "high"
              : divergence >= this.config.kljsMediumSeverity
                ? "medium"
                : "low"
            : "none",
          algorithmScore: Number(divergence.toFixed(4)),
        };
      }
      case "relative_threshold":
      default: {
        const detected = metrics.relativeShift <= (threshold ?? windowConfig.defaultThreshold) + EPSILON;
        return {
          detected,
          severity: detected
            ? metrics.relativeShift <= windowConfig.severityThresholds.high
              ? "high"
              : metrics.relativeShift <= windowConfig.severityThresholds.medium
                ? "medium"
                : "low"
            : "none",
          algorithmScore: Number(Math.abs(metrics.relativeShift).toFixed(4)),
        };
      }
    }
  }
}

function hoursToSamples(hours: number, samplesPerHour: number): number {
  return Math.max(1, Math.round(hours * samplesPerHour));
}

function average(values: readonly number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }
  const mean = average(values);
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  return Math.sqrt(variance);
}

function severityRank(severity: ChangepointDetectionResult["severity"]): number {
  switch (severity) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
    case "none":
    default:
      return 0;
  }
}

function severityToAction(severity: ChangepointDetectionResult["severity"]): DriftResponseActionType {
  switch (severity) {
    case "high":
      return "freeze";
    case "medium":
      return "downgrade";
    case "low":
      return "observe";
    case "none":
    default:
      return "none";
  }
}

function emptyDimensions(): Record<CanonicalDriftDimension, number> {
  return {
    success_rate_drop: 0,
    override_rate_spike: 0,
    cost_spike: 0,
    tool_usage_shift: 0,
    incident_count: 0,
  };
}

function evaluateCanonicalDimensions(
  baseline: readonly DriftSample[],
  recent: readonly DriftSample[],
  fallbackRelativeShift: number,
): Record<CanonicalDriftDimension, number> {
  const baselineMetrics = baseline.map((sample) => sample.metrics ?? {});
  const recentMetrics = recent.map((sample) => sample.metrics ?? {});

  return {
    success_rate_drop: evaluateDirectionalMetricShift(
      baselineMetrics,
      recentMetrics,
      "successRate",
      "decrease",
      Math.max(0, -fallbackRelativeShift),
    ),
    override_rate_spike: evaluateDirectionalMetricShift(baselineMetrics, recentMetrics, "overrideRate", "increase"),
    cost_spike: evaluateDirectionalMetricShift(baselineMetrics, recentMetrics, "averageCostUsd", "increase"),
    tool_usage_shift: evaluateDirectionalMetricShift(baselineMetrics, recentMetrics, "toolUsageShift", "increase"),
    incident_count: evaluateDirectionalMetricShift(baselineMetrics, recentMetrics, "incidentCount", "increase"),
  };
}

function evaluateDirectionalMetricShift(
  baselineMetrics: readonly Partial<CanonicalDriftMetricSnapshot>[],
  recentMetrics: readonly Partial<CanonicalDriftMetricSnapshot>[],
  metricKey: keyof CanonicalDriftMetricSnapshot,
  direction: "increase" | "decrease",
  fallback = 0,
): number {
  const baselineValues = baselineMetrics
    .map((metric) => metric[metricKey])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  const recentValues = recentMetrics
    .map((metric) => metric[metricKey])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));
  if (baselineValues.length === 0 || recentValues.length === 0) {
    return Number(fallback.toFixed(4));
  }
  const baselineMean = average(baselineValues);
  const recentMean = average(recentValues);
  if (Math.abs(baselineMean) <= EPSILON) {
    return Number(Math.max(0, recentMean).toFixed(4));
  }
  const relativeShift = (recentMean - baselineMean) / baselineMean;
  const directionalShift = direction === "increase" ? relativeShift : -relativeShift;
  return Number(Math.max(0, directionalShift).toFixed(4));
}

function bucketize(values: readonly number[], bucketCount = 10): number[] {
  if (values.length === 0) {
    return Array.from({ length: bucketCount }, () => 0);
  }
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (Math.abs(max - min) <= EPSILON) {
    const histogram = Array.from({ length: bucketCount }, () => 0);
    histogram[0] = 1;
    return histogram;
  }
  const counts = Array.from({ length: bucketCount }, () => 0);
  for (const value of values) {
    const position = Math.min(
      bucketCount - 1,
      Math.floor(((value - min) / (max - min + EPSILON)) * bucketCount),
    );
    counts[position] += 1;
  }
  return counts.map((count) => count / values.length);
}

function klDivergence(p: readonly number[], q: readonly number[]): number {
  return p.reduce((sum, value, index) => {
    const qValue = q[index] ?? EPSILON;
    if (value <= EPSILON) {
      return sum;
    }
    return sum + value * Math.log2(value / Math.max(EPSILON, qValue));
  }, 0);
}

function jensenShannonDivergence(baselineValues: readonly number[], recentValues: readonly number[]): number {
  const baselineDistribution = bucketize(baselineValues);
  const recentDistribution = bucketize(recentValues);
  const midpoint = baselineDistribution.map((value, index) => (value + (recentDistribution[index] ?? 0)) / 2);
  return (klDivergence(baselineDistribution, midpoint) + klDivergence(recentDistribution, midpoint)) / 2;
}
