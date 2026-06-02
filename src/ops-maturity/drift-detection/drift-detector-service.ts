/**
 * DriftDetectorService Implementation
 *
 * §63: Implements IDriftDetector interface, coordinating changepoint detection,
 * fingerprint comparison, and cross-agent analysis.
 */

import { timingSafeEqual } from "node:crypto";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";

import { BehaviorFingerprintBuilder } from "./fingerprint-builder/index.js";
import { ChangepointDetectorService } from "./changepoint-detector/index.js";
import { CrossAgentAnalyzerService, type CrossAgentDriftAlert } from "./cross-agent-analyzer/index.js";
import {
  CANONICAL_DRIFT_WINDOWS,
  DEFAULT_DRIFT_DETECTOR_CONFIG,
  type CanonicalDriftDimension,
  type DriftDetectorConfig,
  type DriftSample,
  type DriftSignal,
  type DriftWindowType,
} from "./drift-types.js";

import type {
  IDriftDetector,
  DriftDetectionInput,
  DriftDetectorResult,
  DriftAlert,
  DriftDimension,
  CrossAgentMetricInput,
} from "./drift-detector.js";

export interface DriftDetectorServiceOptions {
  readonly changepointConfig?: DriftDetectorConfig;
  readonly fingerprintDriftThresholds?: {
    readonly low: number;
    readonly medium: number;
    readonly high: number;
  };
  readonly analyzedWindows?: readonly DriftWindowType[];
  readonly fingerprintWindowToDriftWindow?: Readonly<Record<string, DriftWindowType>>;
}

const DEFAULT_FINGERPRINT_DRIFT_THRESHOLDS = {
  low: 0.1,
  medium: 0.2,
  high: 0.4,
} as const;

const DEFAULT_FINGERPRINT_WINDOW_TO_DRIFT_WINDOW: Readonly<Record<string, DriftWindowType>> = {
  "1h": "1h",
  "6h": "6h",
  "24h": "24h",
  "7d": "7d",
  "30d": "30d",
  "90d": "90d",
};

/**
 * §63: DriftDetectorService coordinates all drift detection mechanisms.
 * Uses changepoint detection, fingerprint comparison, and cross-agent analysis
 * to produce comprehensive drift alerts.
 */
export class DriftDetectorService implements IDriftDetector {
  private readonly changepointDetector: ChangepointDetectorService;
  private readonly fingerprintBuilder: BehaviorFingerprintBuilder;
  private readonly crossAgentAnalyzer: CrossAgentAnalyzerService;
  private readonly fingerprintDriftThresholds: { readonly low: number; readonly medium: number; readonly high: number };
  private readonly analyzedWindows: readonly DriftWindowType[];
  private readonly fingerprintWindowToDriftWindow: Readonly<Record<string, DriftWindowType>>;

  public constructor(options: DriftDetectorConfig | DriftDetectorServiceOptions = {}) {
    const resolvedOptions = isChangepointConfig(options) ? { changepointConfig: options } : options;
    const config = resolvedOptions.changepointConfig ?? {
      ...DEFAULT_DRIFT_DETECTOR_CONFIG,
      minSampleSize: 10,
    };
    this.changepointDetector = new ChangepointDetectorService(config);
    this.fingerprintBuilder = new BehaviorFingerprintBuilder();
    this.crossAgentAnalyzer = new CrossAgentAnalyzerService();
    this.fingerprintDriftThresholds = resolvedOptions.fingerprintDriftThresholds ?? DEFAULT_FINGERPRINT_DRIFT_THRESHOLDS;
    this.analyzedWindows = resolvedOptions.analyzedWindows ?? [...CANONICAL_DRIFT_WINDOWS];
    this.fingerprintWindowToDriftWindow = resolvedOptions.fingerprintWindowToDriftWindow ?? DEFAULT_FINGERPRINT_WINDOW_TO_DRIFT_WINDOW;
  }

  /**
   * §63: Primary detect method - coordinates all drift detection mechanisms.
   */
  public detect(input: DriftDetectionInput): DriftDetectorResult {
    const detectionId = newId("drift_det");
    const detectedAt = nowIso();

    // 1. Run changepoint detection on drift samples
    const windowResults = this.changepointDetector.detectAll(input.driftSamples, [...this.analyzedWindows]);
    const fingerprintSignal = this.detectFingerprintDriftAgainstBaselines(input.currentFingerprint, input.baselineFingerprints);
    const windowPrimarySignal = this.buildPrimarySignal(windowResults, input.currentFingerprint.fingerprintId);
    const primarySignal = this.selectPrimarySignal(windowPrimarySignal, fingerprintSignal);

    // 2. Cross-agent analysis if metrics provided
    let crossAgentAlerts: readonly CrossAgentDriftAlert[] = [];
    if (input.agentMetrics && input.agentMetrics.length > 0) {
      const crossAgentResult = this.crossAgentAnalyzer.analyze(
        input.agentMetrics.map((m) => ({
          agentId: m.agentId,
          domainId: m.domain,
          successRate: m.successRate,
          averageCostUsd: m.averageCostUsd,
          averageLatencyMs: m.averageLatencyMs,
        })),
      );
      crossAgentAlerts = crossAgentResult.alerts;
    }

    // 3. Determine overall severity
    const windowSeverity = this.getMaxSeverity(windowResults);
    const crossAgentSeverity = this.getMaxCrossAgentSeverity(crossAgentAlerts);
    const overallSeverity = this.worseSeverity(
      this.worseSeverity(windowSeverity, crossAgentSeverity),
      fingerprintSignal?.severity ?? "none",
    );

    // 4. Check if any detection threshold met
    const driftDetected = overallSeverity !== "none";

    const windowsAnalyzed = this.getAnalyzedWindows(windowResults);

    return {
      driftDetected,
      overallSeverity,
      primarySignal,
      crossAgentAlerts,
      windowResults,
      metadata: {
        detectionId,
        detectedAt,
        windowsAnalyzed,
        baselineWindowDays: this.estimateBaselineWindowDays(input.baselineFingerprints),
        sampleSize: input.driftSamples.length,
        crossAgentAnalysisPerformed: input.agentMetrics != null && input.agentMetrics.length > 0,
      },
    };
  }

  /**
   * §63: Quick detection for single fingerprint comparison with baseline.
   */
  public detectFingerprintDrift(
    current: import("./fingerprint-builder/index.js").BehaviorFingerprint,
    baseline: import("./fingerprint-builder/index.js").BehaviorFingerprint,
  ): DriftSignal | null {
    // Compare fingerprint hashes directly
    if (safeHashEquals(current.hash, baseline.hash)) {
      return null; // No drift detected
    }
    if (current.normalizedFeatures.length === 0 || baseline.normalizedFeatures.length === 0) {
      return {
        signalId: newId("drift_sig"),
        subjectId: resolveFingerprintSubject(current),
        subjectType: current.subjectType,
        detectedAt: nowIso(),
        driftScore: 1,
        severity: "high",
        windowType: this.mapFingerprintWindowToDriftWindow(current.window),
        baselineRef: baseline.fingerprintId,
        reasonCode: "drift.fingerprint_features_missing",
        recommendedAction: "require_review",
        metadata: { dimension: "behavioral_drift" },
      };
    }

    // Analyze behavioral feature differences
    const driftScore = this.computeFeatureDifference(current.normalizedFeatures, baseline.normalizedFeatures);

    // Determine severity based on drift score
    const severity: DriftSignal["severity"] =
      driftScore >= this.fingerprintDriftThresholds.high ? "high"
        : driftScore >= this.fingerprintDriftThresholds.medium ? "medium"
          : driftScore >= this.fingerprintDriftThresholds.low ? "low"
            : "none";

    if (severity === "none") {
      return null;
    }

    return {
      signalId: newId("drift_sig"),
      subjectId: resolveFingerprintSubject(current),
      subjectType: current.subjectType,
      detectedAt: nowIso(),
      driftScore,
      severity,
      windowType: this.mapFingerprintWindowToDriftWindow(current.window),
      baselineRef: baseline.fingerprintId,
      reasonCode: "drift.fingerprint_mismatch",
      recommendedAction: this.severityToAction(severity),
      metadata: { dimension: "behavioral_drift" },
    };
  }

  private detectFingerprintDriftAgainstBaselines(
    current: import("./fingerprint-builder/index.js").BehaviorFingerprint,
    baselines: readonly import("./fingerprint-builder/index.js").BehaviorFingerprint[],
  ): DriftSignal | null {
    if (baselines.length === 0) {
      return null;
    }
    let bestSignal: DriftSignal | null = null;
    for (const baseline of baselines) {
      const signal = this.detectFingerprintDrift(current, baseline);
      if (signal == null) {
        return null;
      }
      if (bestSignal == null || signal.driftScore < bestSignal.driftScore) {
        bestSignal = signal;
      }
    }
    return bestSignal;
  }

  /**
   * §63: Batch detection across multiple agents for cross-agent anomalies.
   */
  public detectCrossAgentDrift(
    metrics: CrossAgentMetricInput[],
    domainPeerGroups: Readonly<Record<string, readonly string[]>>,
  ): readonly CrossAgentDriftAlert[] {
    const result = this.crossAgentAnalyzer.analyze(
      metrics.map((m) => ({
        agentId: m.agentId,
        domainId: m.domain,
        successRate: m.successRate,
        averageCostUsd: m.averageCostUsd,
        averageLatencyMs: m.averageLatencyMs,
      })),
    );
    return result.alerts;
  }

  /**
   * Converts DriftSignal to DriftAlert format per §63.3.
   * Only converts signals with detected drift (severity != "none").
   */
  public signalToAlert(signal: DriftSignal): DriftAlert | null {
    // Don't create alerts for non-detected signals
    if (signal.severity === "none") {
      return null;
    }
    // Map recommendedAction to valid DriftResponseActionType
    const action = signal.recommendedAction === "pause_agent"
      || signal.recommendedAction === "freeze"
      || signal.recommendedAction === "rollback"
      ? "pause_agent"
      : signal.recommendedAction === "require_review"
        || signal.recommendedAction === "throttle"
        || signal.recommendedAction === "downgrade"
        ? "require_review"
        : "observe";
    return {
      alertId: newId("drift_alert"),
      agentId: signal.subjectId,
      dimension: this.inferDimension(signal),
      severity: signal.severity,
      driftScore: signal.driftScore,
      detectedAt: signal.detectedAt,
      baselineRef: signal.baselineRef,
      reasonCode: signal.reasonCode,
      recommendedAction: action,
      ...(signal.metadata != null && { metadata: signal.metadata }),
    };
  }

  private buildPrimarySignal(
    windowResults: readonly import("./changepoint-detector/index.js").ChangepointDetectionResult[],
    fingerprintId: string,
  ): DriftSignal | null {
    const detectedResults = windowResults.filter((r) => r.detected);
    if (detectedResults.length === 0) {
      return null;
    }

    // Use the most severe result
    const primary = detectedResults.reduce((max, r) => {
      const severityOrder: Record<"none" | "low" | "medium" | "high", number> = { none: 0, low: 1, medium: 2, high: 3 };
      return severityOrder[r.severity] > severityOrder[max.severity] ? r : max;
    }, detectedResults[0]!);

    return {
      signalId: newId("drift_sig"),
      subjectId: parseFingerprintIdentity(fingerprintId).subjectId,
      subjectType: "agent",
      detectedAt: nowIso(),
      driftScore: Math.abs(primary.relativeShift),
      severity: primary.severity,
      windowType: primary.windowType,
      baselineRef: null,
      reasonCode: primary.reasonCode,
      recommendedAction: primary.recommendedAction,
      metadata: {
        canonicalDimension: this.selectDominantCanonicalDimension(primary.evaluatedDimensions),
        dimension: this.mapCanonicalDimensionToAlertDimension(this.selectDominantCanonicalDimension(primary.evaluatedDimensions)),
      },
    };
  }

  private selectPrimarySignal(
    left: DriftSignal | null,
    right: DriftSignal | null,
  ): DriftSignal | null {
    if (left == null) {
      return right;
    }
    if (right == null) {
      return left;
    }
    return this.worseSeverity(left.severity, right.severity) === right.severity ? right : left;
  }

  /**
   * Maps FingerprintWindowSize to the closest drift-analysis window used for alert routing.
   */
  private mapFingerprintWindowToDriftWindow(
    window: import("./fingerprint-builder/index.js").BehaviorFingerprint["window"],
  ): DriftWindowType {
    if (window == null) {
      return "24h";
    }
    return this.fingerprintWindowToDriftWindow[window] ?? "24h";
  }

  private inferDimension(signal: DriftSignal): DriftDimension {
    const explicit = signal.metadata?.["dimension"];
    if (explicit === "input_drift" || explicit === "output_drift" || explicit === "quality_drift" || explicit === "behavioral_drift") {
      return explicit;
    }
    const canonicalDimension = signal.metadata?.["canonicalDimension"];
    if (
      canonicalDimension === "success_rate_drop"
      || canonicalDimension === "override_rate_spike"
      || canonicalDimension === "cost_spike"
      || canonicalDimension === "tool_usage_shift"
      || canonicalDimension === "incident_count"
    ) {
      return this.mapCanonicalDimensionToAlertDimension(canonicalDimension);
    }
    return signal.reasonCode === "drift.fingerprint_mismatch" ? "behavioral_drift" : "quality_drift";
  }

  private severityToAction(severity: DriftSignal["severity"]): DriftSignal["recommendedAction"] {
    switch (severity) {
      case "high":
        return "rollback";
      case "medium":
        return "downgrade";
      case "low":
        return "observe";
      default:
        return "observe";
    }
  }

  private getMaxSeverity(results: readonly import("./changepoint-detector/index.js").ChangepointDetectionResult[]): "none" | "low" | "medium" | "high" {
    let max: "none" | "low" | "medium" | "high" = "none";
    for (const result of results) {
      if (result.detected && this.worseSeverity(max, result.severity) === result.severity) {
        max = result.severity;
      }
    }
    return max;
  }

  private getMaxCrossAgentSeverity(alerts: readonly CrossAgentDriftAlert[]): "none" | "low" | "medium" | "high" {
    let max: "none" | "low" | "medium" | "high" = "none";
    for (const alert of alerts) {
      if (this.worseSeverity(max, alert.severity) === alert.severity) {
        max = alert.severity;
      }
    }
    return max;
  }

  private worseSeverity(a: "none" | "low" | "medium" | "high", b: "none" | "low" | "medium" | "high"): "none" | "low" | "medium" | "high" {
    const order: Record<"none" | "low" | "medium" | "high", number> = { none: 0, low: 1, medium: 2, high: 3 };
    return order[a] >= order[b] ? a : b;
  }

  private computeFeatureDifference(features1: string[], features2: string[]): number {
    const set1 = new Set(features1);
    const set2 = new Set(features2);
    const union = new Set([...set1, ...set2]);
    if (union.size === 0) {
      return 0;
    }
    let weightedUnion = 0;
    let weightedDifference = 0;
    for (const feature of union) {
      const weight = featureWeight(feature);
      weightedUnion += weight;
      if (!(set1.has(feature) && set2.has(feature))) {
        weightedDifference += weight;
      }
    }
    return weightedUnion <= 0 ? 0 : weightedDifference / weightedUnion;
  }

  private getAnalyzedWindows(results: readonly import("./changepoint-detector/index.js").ChangepointDetectionResult[]): readonly import("./changepoint-detector/index.js").DriftWindowType[] {
    const inferredWindows = results.map((result) => result.windowType);
    return inferredWindows.length > 0 ? [...new Set(inferredWindows)] : [...this.analyzedWindows];
  }

  private estimateBaselineWindowDays(fingerprints: readonly import("./fingerprint-builder/index.js").BehaviorFingerprint[]): number {
    if (fingerprints.length === 0) return 0;
    const durations = fingerprints
      .map((fingerprint) => {
        if (fingerprint.windowStart == null || fingerprint.windowEnd == null) {
          return 0;
        }
        return Math.max(0, Math.round((Date.parse(fingerprint.windowEnd) - Date.parse(fingerprint.windowStart)) / (24 * 60 * 60 * 1000)));
      })
      .filter((value) => value > 0);
    return durations.length > 0 ? Math.max(...durations) : 0;
  }

  private selectDominantCanonicalDimension(
    evaluatedDimensions: Record<CanonicalDriftDimension, number>,
  ): CanonicalDriftDimension {
    const ordered: readonly CanonicalDriftDimension[] = [
      "success_rate_drop",
      "override_rate_spike",
      "cost_spike",
      "tool_usage_shift",
      "incident_count",
    ];
    const initial = ordered[0]!;
    return ordered.reduce((best, candidate) =>
      evaluatedDimensions[candidate] > evaluatedDimensions[best] ? candidate : best, initial);
  }

  private mapCanonicalDimensionToAlertDimension(dimension: CanonicalDriftDimension): DriftDimension {
    switch (dimension) {
      case "tool_usage_shift":
        return "behavioral_drift";
      case "success_rate_drop":
      case "override_rate_spike":
      case "cost_spike":
      case "incident_count":
      default:
        return "quality_drift";
    }
  }
}

function safeHashEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }
  return timingSafeEqual(leftBuffer, rightBuffer);
}

function isChangepointConfig(value: DriftDetectorConfig | DriftDetectorServiceOptions): value is DriftDetectorConfig {
  return "minSampleSize" in value;
}

function featureWeight(feature: string): number {
  if (feature.startsWith("tool_usage:") || feature.startsWith("risk_distribution:")) {
    return 2;
  }
  if (feature.startsWith("latency_bucket:") || feature.startsWith("cost_bucket:") || feature.startsWith("success_rate:")) {
    return 1.5;
  }
  return 1;
}

function parseFingerprintIdentity(fingerprintId: string): {
  subjectType: string;
  subjectId: string;
  baselineRef: string | null;
  window: string | null;
} {
  const parts = fingerprintId.split(":");
  if (parts.length < 5 || parts[0] !== "fingerprint") {
    return {
      subjectType: "agent",
      subjectId: fingerprintId,
      baselineRef: null,
      window: null,
    };
  }
  return {
    subjectType: parts[1] ?? "agent",
    subjectId: parts[2] ?? fingerprintId,
    baselineRef: parts[3] != null && parts[3] !== "none" ? parts[3] : null,
    window: parts[4] != null && parts[4] !== "none" ? parts[4] : null,
  };
}

function resolveFingerprintSubject(
  fingerprint: import("./fingerprint-builder/index.js").BehaviorFingerprint & { subjectId?: string },
): string {
  return fingerprint.subjectId ?? parseFingerprintIdentity(fingerprint.fingerprintId).subjectId;
}
