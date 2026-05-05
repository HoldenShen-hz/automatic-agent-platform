/**
 * DriftDetector Interface
 *
 * §63: Primary drift detection interface that coordinates changepoint detection,
 * fingerprint comparison, and cross-agent analysis to produce DriftAlert signals.
 */

import type { BehaviorFingerprint } from "./fingerprint-builder/index.js";
import type { DriftSignal, DriftSample, ChangepointDetectionResult, DriftWindowType, DriftResponseActionType } from "./changepoint-detector/index.js";
import type { CrossAgentDriftAlert } from "./cross-agent-analyzer/index.js";

/**
 * §63: Drift detection input - requires behavior fingerprint + metrics + baseline
 */
export interface DriftDetectionInput {
  /** Current behavior fingerprint */
  currentFingerprint: BehaviorFingerprint;
  /** Historical fingerprints for baseline comparison */
  baselineFingerprints: readonly BehaviorFingerprint[];
  /** Time-ordered drift samples for statistical detection */
  driftSamples: DriftSample[];
  /** Agent metrics for cross-agent analysis */
  agentMetrics?: CrossAgentMetricInput[];
}

export interface CrossAgentMetricInput {
  agentId: string;
  domain: string;
  successRate: number;
  averageCostUsd: number;
  averageLatencyMs: number;
}

/**
 * §63: DriftDetector result containing detection outcome and alerts.
 * The detect() method returns this structure with all drift signals.
 */
export interface DriftDetectorResult {
  /** Whether drift was detected in any dimension */
  driftDetected: boolean;
  /** Overall severity across all detection dimensions */
  overallSeverity: "none" | "low" | "medium" | "high";
  /** Primary drift signal if drift detected */
  primarySignal: DriftSignal | null;
  /** Cross-agent drift alerts (when agent peer group comparison reveals anomalies) */
  crossAgentAlerts: readonly CrossAgentDriftAlert[];
  /** Window-specific detection results for detailed analysis */
  windowResults: readonly ChangepointDetectionResult[];
  /** Metadata about the detection run */
  metadata: DriftDetectionMetadata;
}

/**
 * §63: Detection metadata for auditing and debugging
 */
export interface DriftDetectionMetadata {
  detectionId: string;
  detectedAt: string;
  windowsAnalyzed: readonly DriftWindowType[];
  baselineWindowDays: number;
  sampleSize: number;
  crossAgentAnalysisPerformed: boolean;
}

/**
 * §63: Canonical DriftAlert interface.
 *
 * §63.3 specifies:
 * - severity=low → record to §43 dashboard, mark "drift_warning"
 * - severity=medium → require_review + throttle/suggested pattern, default no direct downgrade
 * - severity=high → pause Agent(§61 paused) + trigger Incident(§12) + require human review
 */
export interface DriftAlert {
  readonly alertId: string;
  readonly agentId: string;
  readonly dimension: DriftDimension;
  readonly severity: "low" | "medium" | "high";
  readonly driftScore: number;
  readonly detectedAt: string;
  readonly baselineRef: string | null;
  readonly reasonCode: string;
  readonly recommendedAction: DriftResponseActionType;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

/**
 * §63: Dimensions on which drift can be detected
 */
export type DriftDimension =
  | "input_drift"     // Input distribution change
  | "output_drift"    // Output distribution change
  | "behavioral_drift" // Behavior pattern change
  | "quality_drift";   // Quality metric degradation

/**
 * §63: DriftMitigationAction - planned response action for drift mitigation
 */
export interface DriftMitigationAction {
  readonly actionType: DriftResponseActionType;
  readonly targetId: string;
  readonly targetType: "agent" | "workflow" | "domain";
  readonly reason: string;
  readonly alertId: string;
  readonly parameters?: Readonly<Record<string, unknown>>;
  readonly createdAt: string;
  readonly expiresAt: string | null;
}

// Re-export DriftResponseActionType from changepoint-detector for convenience
export type { DriftResponseActionType } from "./changepoint-detector/index.js";

/**
 * §63: DriftDetector interface - primary entry point for drift detection.
 *
 * Implementations should coordinate:
 * 1. Changepoint detection using statistical methods (CUSUM, Bayesian, KL-JS)
 * 2. Fingerprint comparison for behavior drift
 * 3. Cross-agent analysis for peer group anomalies
 */
export interface IDriftDetector {
  /**
   * §63: Primary detect method - analyzes fingerprints, samples, and metrics
   * to produce drift detection result with alerts.
   */
  detect(input: DriftDetectionInput): DriftDetectorResult;

  /**
   * §63: Quick detection for single fingerprint comparison with baseline.
   * Returns DriftSignal if drift detected, null otherwise.
   */
  detectFingerprintDrift(
    current: BehaviorFingerprint,
    baseline: BehaviorFingerprint,
  ): DriftSignal | null;

  /**
   * §63: Batch detection across multiple agents for cross-agent anomalies.
   */
  detectCrossAgentDrift(
    metrics: CrossAgentMetricInput[],
    domainPeerGroups: Readonly<Record<string, readonly string[]>>,
  ): readonly CrossAgentDriftAlert[];
}