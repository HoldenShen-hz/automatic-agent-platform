/**
 * DriftDetectorService Implementation
 *
 * §63: Implements IDriftDetector interface, coordinating changepoint detection,
 * fingerprint comparison, and cross-agent analysis.
 */

import { newId, nowIso } from "../../platform/contracts/types/ids.js";

import { BehaviorFingerprintBuilder } from "./fingerprint-builder/index.js";
import { ChangepointDetectorService, type DriftDetectorConfig, type DriftSample, type DriftSignal } from "./changepoint-detector/index.js";
import { CrossAgentAnalyzerService, type CrossAgentDriftAlert } from "./cross-agent-analyzer/index.js";

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
  readonly analyzedWindows?: readonly import("./changepoint-detector/index.js").DriftWindowType[];
  readonly fingerprintWindowToDriftWindow?: Readonly<Record<string, import("./changepoint-detector/index.js").DriftWindowType>>;
}

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
  private readonly analyzedWindows: readonly import("./changepoint-detector/index.js").DriftWindowType[];
  private readonly fingerprintWindowToDriftWindow: Readonly<Record<string, import("./changepoint-detector/index.js").DriftWindowType>>;

  public constructor(options: DriftDetectorConfig | DriftDetectorServiceOptions = {}) {
    const resolvedOptions = isChangepointConfig(options) ? { changepointConfig: options } : options;
    const config = resolvedOptions.changepointConfig ?? {
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
      distributionAssumption: "normal" as const,
      falsePositiveRate: 0.05,
      falsePositiveWindowSize: 100,
      minSamplesBetweenAlerts: 5,
    };
    this.changepointDetector = new ChangepointDetectorService(config);
    this.fingerprintBuilder = new BehaviorFingerprintBuilder();
    this.crossAgentAnalyzer = new CrossAgentAnalyzerService();
    this.fingerprintDriftThresholds = resolvedOptions.fingerprintDriftThresholds ?? {
      low: 0.1,
      medium: 0.2,
      high: 0.4,
    };
    this.analyzedWindows = resolvedOptions.analyzedWindows ?? ["1h", "6h", "24h", "7d"];
    this.fingerprintWindowToDriftWindow = resolvedOptions.fingerprintWindowToDriftWindow ?? {
      "1h": "1h",
      "6h": "6h",
      "24h": "24h",
      "7d": "7d",
      "30d": "7d",
      "90d": "7d",
    };
  }

  /**
   * §63: Primary detect method - coordinates all drift detection mechanisms.
   */
  public detect(input: DriftDetectionInput): DriftDetectorResult {
    const detectionId = newId("drift_det");
    const detectedAt = nowIso();

    // 1. Run changepoint detection on drift samples
    const windowResults = this.changepointDetector.detectAll(input.driftSamples);
    const fingerprintSignal = input.baselineFingerprints[0] == null
      ? null
      : this.detectFingerprintDrift(input.currentFingerprint, input.baselineFingerprints[0]!);
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
    if (current.hash === baseline.hash) {
      return null; // No drift detected
    }
    if (current.normalizedFeatures.length === 0 || baseline.normalizedFeatures.length === 0) {
      return {
        signalId: newId("drift_sig"),
        subjectId: current.fingerprintId.split(":")[2] ?? current.fingerprintId,
        subjectType: current.subjectType,
        detectedAt: nowIso(),
        driftScore: 1,
        severity: "high",
        windowType: this.mapFingerprintWindowToDriftWindow(current.window),
        baselineRef: baseline.fingerprintId,
        reasonCode: "drift.fingerprint_features_missing",
        recommendedAction: "require_review",
      };
    }

    // Analyze behavioral feature differences
    const featureDiff = this.computeFeatureDifference(current.normalizedFeatures, baseline.normalizedFeatures);
    const driftScore = Math.min(1.0, featureDiff / 10.0); // Normalize to 0-1

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
      subjectId: current.fingerprintId.split(":")[2] ?? current.fingerprintId,
      subjectType: current.subjectType,
      detectedAt: nowIso(),
      driftScore,
      severity,
      windowType: this.mapFingerprintWindowToDriftWindow(current.window),
      baselineRef: baseline.fingerprintId,
      reasonCode: "drift.fingerprint_mismatch",
      recommendedAction: this.severityToAction(severity),
    };
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
      subjectId: fingerprintId.split(":")[1] ?? fingerprintId,
      subjectType: "agent",
      detectedAt: nowIso(),
      driftScore: Math.abs(primary.relativeShift),
      severity: primary.severity,
      windowType: this.inferWindowType(primary),
      baselineRef: null,
      reasonCode: primary.reasonCode,
      recommendedAction: primary.recommendedAction,
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

  private inferWindowType(result: import("./changepoint-detector/index.js").ChangepointDetectionResult): import("./changepoint-detector/index.js").DriftWindowType {
    if (result.reasonCode.includes("cusum")) return "1h";
    if (result.reasonCode.includes("bayesian")) return "7d";
    return "24h";
  }

  /**
   * Maps FingerprintWindowSize ("1h" | "7d" | "30d" | "90d") to DriftWindowType ("1h" | "6h" | "24h" | "7d").
   * Fingerprint windows are longer-term for historical comparison, while DriftWindowTypes are used
   * for real-time changepoint detection.
   */
  private mapFingerprintWindowToDriftWindow(
    window: import("./fingerprint-builder/index.js").BehaviorFingerprint["window"],
  ): import("./changepoint-detector/index.js").DriftWindowType {
    if (window == null) {
      return "24h";
    }
    return this.fingerprintWindowToDriftWindow[window] ?? "24h";
  }

  private inferDimension(signal: DriftSignal): DriftDimension {
    if (signal.reasonCode.includes("input")) return "input_drift";
    if (signal.reasonCode.includes("output")) return "output_drift";
    if (signal.reasonCode.includes("quality")) return "quality_drift";
    return "behavioral_drift";
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
    let differences = 0;
    for (const f of set1) {
      if (!set2.has(f)) differences++;
    }
    for (const f of set2) {
      if (!set1.has(f)) differences++;
    }
    return differences;
  }

  private getAnalyzedWindows(results: readonly import("./changepoint-detector/index.js").ChangepointDetectionResult[]): readonly import("./changepoint-detector/index.js").DriftWindowType[] {
    const inferredWindows = results.map((result) => this.inferWindowType(result));
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
}

function isChangepointConfig(value: DriftDetectorConfig | DriftDetectorServiceOptions): value is DriftDetectorConfig {
  return "minSampleSize" in value;
}
