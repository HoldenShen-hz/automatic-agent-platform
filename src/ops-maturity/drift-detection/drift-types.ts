export interface CanonicalDriftMetricSnapshot {
  successRate: number;
  overrideRate: number;
  averageCostUsd: number;
  toolUsageShift: number;
  incidentCount: number;
}

export type DriftTrendDirection = "decrease" | "increase";

export interface DriftSample {
  observedAt: string;
  score: number;
  metrics?: Partial<CanonicalDriftMetricSnapshot>;
  degradationDirection?: DriftTrendDirection;
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

export const CANONICAL_DRIFT_WINDOWS: readonly DriftWindowType[] = ["1h", "6h", "24h", "7d", "30d", "90d"];
