/**
 * Anomaly Detection Service
 *
 * Provides time series anomaly detection with multiple statistical algorithms.
 * Supports z-score, IQR (Interquartile Range), EWMA (Exponentially Weighted Moving Average),
 * and gradient-based detection methods for identifying abnormal patterns in metrics.
 *
 * The service maintains a rolling history of metric values and adaptive thresholds
 * that adjust based on observed baseline behavior. It supports pattern signatures
 * for recognizing known anomaly types and provides severity scoring for alerting.
 *
 * Key features:
 * - Multiple detection algorithms: zscore, IQR, EWMA, gradient
 * - Adaptive thresholds that learn from baseline data
 * - Pattern signatures for known anomaly types (error spikes, latency degradation, etc.)
 * - Configurable sensitivity levels
 * - Trend analysis and seasonality detection
 *
 * @see {@link https://github.com/automatic-agent/automatic-agent-platform/blob/main/docs_zh/contracts/observability_contract.md | Observability Contract}
 */

import { BoundedCache } from "../utils/bounded-cache.js";
import {
  type ClassifiedAnomalyEvent,
  classifyAnomalyEvent,
  newId,
  nowIso,
} from "../../contracts/types/index.js";
import {
  DEFAULT_CONFIG,
} from "./anomaly-detection/constants.js";
import type {
  AdaptiveThreshold,
  AnomalyCategory,
  AnomalyDetectionConfig,
  AnomalyDetectionResult,
  AnomalyDetectorOptions,
  AnomalyRecord,
  AnomalySeverity,
  AnomalySignature,
  TimeSeriesPoint,
} from "./anomaly-detection/types.js";

export type {
  AdaptiveThreshold,
  AnomalyCategory,
  AnomalyDetectionConfig,
  AnomalyDetectionResult,
  AnomalyDetectorOptions,
  AnomalyRecord,
  AnomalySeverity,
  AnomalySignature,
  TimeSeriesPoint,
} from "./anomaly-detection/types.js";

/**
 * AnomalyDetectionService provides time series anomaly detection capabilities.
 * It ingests metric data points, maintains rolling history, and detects anomalies
 * using configurable statistical algorithms.
 *
 * The service supports:
 * - Multiple detection algorithms (zscore, IQR, EWMA, gradient)
 * - Adaptive threshold computation based on baseline data
 * - Pattern signatures for known anomaly types
 * - Trend analysis
 */
export class AnomalyDetectionService {
  private readonly config: AnomalyDetectionConfig;
  private readonly history: BoundedCache<string, TimeSeriesPoint[]> = new BoundedCache(100);
  private readonly thresholds: BoundedCache<string, AdaptiveThreshold> = new BoundedCache(100);
  private readonly anomalies: BoundedCache<string, AnomalyRecord[]> = new BoundedCache(100);
  private readonly signatures: BoundedCache<string, AnomalySignature> = new BoundedCache(50);

  constructor(options?: AnomalyDetectorOptions) {
    this.config = { ...DEFAULT_CONFIG, ...options?.config };
    for (const sig of options?.signatures ?? []) {
      this.signatures.set(sig.id, sig);
    }
    this.initDefaultSignatures();
  }

  /**
   * Registers default anomaly signatures for common problem patterns.
   * These patterns help identify known issue types like error spikes and latency degradation.
   */
  private initDefaultSignatures(): void {
    // Pre-built anomaly signatures for common patterns
    this.registerSignature({
      id: "sig_error_rate_spike",
      name: "Error Rate Spike",
      pattern: /error.*rate.*spike|flood|surge|突增|错误率飙升/i,
      category: "spike",
      severity: "critical",
      description: "Detected error rate spike pattern",
    });
    this.registerSignature({
      id: "sig_latency_degradation",
      name: "Latency Degradation",
      pattern: /latency.*increas|slow.*response|超时|延迟增加/i,
      category: "trend_change",
      severity: "warning",
      description: "Detected latency increase trend",
    });
    this.registerSignature({
      id: "sig_memory_leak",
      name: "Memory Leak Indicator",
      pattern: /memory.*leak|heap.*grow|memory.*increas|内存泄漏/i,
      category: "trend_change",
      severity: "critical",
      description: "Detected continuous memory growth pattern",
    });
    this.registerSignature({
      id: "sig_provider_outage",
      name: "Provider Outage",
      pattern: /provider.*down|service.*unavailable|503|502|provider.*error|提供商.*宕机/i,
      category: "level_shift",
      severity: "emergency",
      description: "Detected provider/service outage pattern",
    });
    this.registerSignature({
      id: "sig_quota_exhaustion",
      name: "Quota Exhaustion",
      pattern: /quota.*exhaust|rate.*limit|throttl|配额.*耗尽|限流/i,
      category: "level_shift",
      severity: "warning",
      description: "Detected quota or rate limit pattern",
    });
  }

  // ── Data Ingestion ──────────────────────────────────────────────────

  /**
   * Ingests a single metric data point.
   * Updates the rolling history and adaptive threshold for the metric.
   */
  ingest(metricName: string, value: number, timestamp?: string): void {
    const ts = timestamp ?? nowIso();
    const point: TimeSeriesPoint = { timestamp: ts, value };

    let series = this.history.get(metricName);
    if (!series) {
      series = [];
      this.history.set(metricName, series);
    }

    series.push(point);

    // Keep history bounded to prevent memory issues
    const maxHistory = this.config.windowSize * 10;
    if (series.length > maxHistory) {
      series.splice(0, series.length - maxHistory);
    }

    // Update adaptive threshold after ingesting new point
    this.updateThreshold(metricName);
  }

  /**
   * Ingests multiple data points at once.
   */
  ingestBatch(metricName: string, points: TimeSeriesPoint[]): void {
    for (const p of points) {
      this.ingest(metricName, p.value, p.timestamp);
    }
  }

  // ── Detection ───────────────────────────────────────────────────────

  /**
   * Detects anomalies for a metric value using the configured algorithm.
   * Returns a detection result with severity, category, and explanation.
   */
  detect(metricName: string, value: number, timestamp?: string): AnomalyDetectionResult {
    const ts = timestamp ?? nowIso();
    const series = this.history.get(metricName) ?? [];

    // Need minimum data points for reliable detection
    if (series.length < this.config.minDataPoints) {
      const classified = classifyAnomalyEvent({
        metricName,
        legacySeverity: "info",
        context: { reason: "insufficient_data" },
      });
      return {
        isAnomaly: false,
        score: 0,
        severity: "info",
        unifiedSeverity: classified.unifiedSeverity,
        category: "static",
        anomalyEventClass: classified.anomalyEventClass,
        expectedValue: value,
        deviation: 0,
        deviationPercent: 0,
        explanation: `Insufficient data for anomaly detection (${series.length}/${this.config.minDataPoints} points)`,
      };
    }

    // Check signature patterns first - these override statistical detection
    const signatureMatch = this.checkSignatures(metricName, value, ts);
    if (signatureMatch) {
      return signatureMatch;
    }

    // Use configured algorithm for statistical detection
    switch (this.config.algorithm) {
      case "zscore":
        return this.detectZScore(metricName, value, ts);
      case "iqr":
        return this.detectIQR(metricName, value, ts);
      case "ewma":
        return this.detectEWMA(metricName, value, ts);
      case "gradient":
        return this.detectGradient(metricName, value, ts);
      default:
        return this.detectZScore(metricName, value, ts);
    }
  }

  /**
   * Checks if a metric/value matches any registered anomaly signature.
   */
  private checkSignatures(
    metricName: string,
    value: number,
    timestamp: string,
  ): AnomalyDetectionResult | null {
    const combined = `${metricName} ${value} ${timestamp}`;

    for (const sig of this.signatures.values()) {
      if (sig.pattern.test(combined)) {
        const record = this.createAnomalyRecord(
          metricName,
          timestamp,
          sig.category,
          sig.severity,
          1.0,
          value,
          value,
          { signatureId: sig.id, signatureName: sig.name },
        );
        this.addAnomalyRecord(metricName, record);

        return {
          isAnomaly: true,
          score: 1.0,
          severity: sig.severity,
          unifiedSeverity: record.unifiedSeverity ?? "SEV4",
          category: sig.category,
          anomalyEventClass: record.anomalyEventClass ?? "E1_BUSINESS",
          expectedValue: value,
          deviation: 0,
          deviationPercent: 0,
          explanation: `Matched anomaly signature: ${sig.name} (${sig.description})`,
        };
      }
    }

    return null;
  }

  /**
   * Z-score based anomaly detection.
   * Computes standard deviation from baseline and flags values beyond threshold.
   */
  private detectZScore(
    metricName: string,
    value: number,
    timestamp: string,
  ): AnomalyDetectionResult {
    const series = this.history.get(metricName) ?? [];
    const baseline = series.slice(-this.config.windowSize);

    // Calculate mean and standard deviation
    const mean = baseline.reduce((s, p) => s + p.value, 0) / baseline.length;
    const variance = baseline.reduce((s, p) => s + Math.pow(p.value - mean, 2), 0) / baseline.length;
    const stdDev = Math.sqrt(variance);

    // Handle zero stdDev: if value differs from constant baseline, it's a severe anomaly
    const deviation = Math.abs(value - mean);
    const zScore = stdDev > 0 ? deviation / stdDev : (deviation > 0 ? 100 : 0);

    // Threshold adjusts with sensitivity (lower sensitivity = higher threshold)
    const sensitivityFactor = 1 - this.config.sensitivity;
    const threshold = 2.5 + sensitivityFactor * 1.5; // 2.5 to 4.0 range

    const isAnomaly = zScore > threshold;
    const score = stdDev > 0 ? Math.min(1, zScore / (threshold * 2)) : (deviation > 0 ? 1 : 0);
    const deviationPercent = mean !== 0 ? (deviation / Math.abs(mean)) * 100 : 0;

    const severity = this.scoreToSeverity(score);
    const category = this.classifyAnomalyCategory(value, mean, series);
    const classified = this.classifyDetection(metricName, severity, {
      algorithm: "zscore",
      score,
      category,
      zScore,
      stdDev,
      threshold,
    });

    if (isAnomaly) {
      const record = this.createAnomalyRecord(
        metricName,
        timestamp,
        category,
        severity,
        score,
        mean,
        value,
        { algorithm: "zscore", zScore, stdDev, threshold },
      );
      this.addAnomalyRecord(metricName, record);
    }

    return {
      isAnomaly,
      score,
      severity,
      unifiedSeverity: classified.unifiedSeverity,
      category,
      anomalyEventClass: classified.anomalyEventClass,
      expectedValue: mean,
      deviation,
      deviationPercent,
      explanation: isAnomaly
        ? `Z-score anomaly detected: value=${value}, mean=${mean.toFixed(2)}, z=${zScore.toFixed(2)}, threshold=${threshold.toFixed(2)}`
        : `Normal variation: z=${zScore.toFixed(2)} < threshold=${threshold.toFixed(2)}`,
    };
  }

  /**
   * IQR (Interquartile Range) based anomaly detection.
   * Uses quartiles to identify outliers beyond the expected range.
   */
  private detectIQR(
    metricName: string,
    value: number,
    timestamp: string,
  ): AnomalyDetectionResult {
    const series = this.history.get(metricName) ?? [];
    const baseline = series.slice(-this.config.windowSize).map((p) => p.value);

    // Sort to calculate quartiles
    baseline.sort((a, b) => a - b);

    const q1 = baseline[Math.floor(baseline.length * 0.25)] ?? 0;
    const q3 = baseline[Math.floor(baseline.length * 0.75)] ?? 0;
    const iqr = q3 - q1;

    // K multiplier adjusts with sensitivity
    const sensitivityFactor = 1 - this.config.sensitivity;
    const k = 1.5 + sensitivityFactor; // 2.5 to 3.5 range
    const upper = q3 + k * iqr;
    const lower = q1 - k * iqr;

    const isAnomaly = value > upper || value < lower;
    const deviation = Math.abs(value - (q1 + q3) / 2);
    const mid = (q1 + q3) / 2;
    const deviationPercent = mid !== 0 ? (deviation / Math.abs(mid)) * 100 : 0;
    const score = isAnomaly ? Math.min(1, Math.abs(value - (value > upper ? upper : lower)) / (iqr * 2) + 0.5) : 0;

    const severity = this.scoreToSeverity(score);
    const category = value > upper ? "spike" : value < lower ? "dip" : "static";
    const classified = this.classifyDetection(metricName, severity, {
      algorithm: "iqr",
      score,
      category,
      q1,
      q3,
      iqr,
      upper,
      lower,
    });

    if (isAnomaly) {
      const record = this.createAnomalyRecord(
        metricName,
        timestamp,
        category,
        severity,
        score,
        mid,
        value,
        { algorithm: "iqr", q1, q3, iqr, upper, lower },
      );
      this.addAnomalyRecord(metricName, record);
    }

    return {
      isAnomaly,
      score,
      severity,
      unifiedSeverity: classified.unifiedSeverity,
      category,
      anomalyEventClass: classified.anomalyEventClass,
      expectedValue: mid,
      deviation,
      deviationPercent,
      explanation: isAnomaly
        ? `IQR anomaly: value=${value}, bounds=[${lower.toFixed(2)}, ${upper.toFixed(2)}]`
        : `Within IQR bounds: value=${value}, bounds=[${lower.toFixed(2)}, ${upper.toFixed(2)}]`,
    };
  }

  /**
   * EWMA (Exponentially Weighted Moving Average) based detection.
   * Gives more weight to recent observations while maintaining a running average.
   */
  private detectEWMA(
    metricName: string,
    value: number,
    timestamp: string,
  ): AnomalyDetectionResult {
    const series = this.history.get(metricName) ?? [];
    const baseline = series.slice(-this.config.windowSize);

    // EWMA with adaptive smoothing - alpha adjusts with sensitivity
    const alpha = 0.1 + this.config.sensitivity * 0.2; // 0.1 to 0.3
    let ewma = baseline[0]?.value ?? value;
    let ewmaVar = 0;

    // Compute EWMA and variance
    for (const p of baseline) {
      const diff = p.value - ewma;
      ewma += alpha * diff;
      ewmaVar = (1 - alpha) * (ewmaVar + alpha * diff * diff);
    }

    const ewmaStd = Math.sqrt(ewmaVar);
    const zScore = ewmaStd > 0 ? Math.abs(value - ewma) / ewmaStd : 0;
    const sensitivityFactor = 1 - this.config.sensitivity;
    const threshold = 2.5 + sensitivityFactor * 1.5;

    const isAnomaly = zScore > threshold;
    const score = Math.min(1, zScore / (threshold * 2));
    const deviation = Math.abs(value - ewma);
    const deviationPercent = ewma !== 0 ? (deviation / Math.abs(ewma)) * 100 : 0;

    const severity = this.scoreToSeverity(score);
    const category = this.classifyAnomalyCategory(value, ewma, series);
    const classified = this.classifyDetection(metricName, severity, {
      algorithm: "ewma",
      score,
      category,
      alpha,
      ewmaStd,
      threshold,
    });

    if (isAnomaly) {
      const record = this.createAnomalyRecord(
        metricName,
        timestamp,
        category,
        severity,
        score,
        ewma,
        value,
        { algorithm: "ewma", alpha, ewmaStd, threshold },
      );
      this.addAnomalyRecord(metricName, record);
    }

    return {
      isAnomaly,
      score,
      severity,
      unifiedSeverity: classified.unifiedSeverity,
      category,
      anomalyEventClass: classified.anomalyEventClass,
      expectedValue: ewma,
      deviation,
      deviationPercent,
      explanation: isAnomaly
        ? `EWMA anomaly: value=${value}, ewma=${ewma.toFixed(2)}, z=${zScore.toFixed(2)}`
        : `Normal EWMA variation: z=${zScore.toFixed(2)}`,
    };
  }

  /**
   * Gradient-based anomaly detection.
   * Detects anomalies based on sudden changes in the rate of change (gradient).
   */
  private detectGradient(
    metricName: string,
    value: number,
    timestamp: string,
  ): AnomalyDetectionResult {
    const series = this.history.get(metricName) ?? [];
    const baseline = series.slice(-this.config.windowSize);

    if (baseline.length < 3) {
      const classified = classifyAnomalyEvent({
        metricName,
        legacySeverity: "info",
        context: { reason: "gradient_insufficient_data" },
      });
      return {
        isAnomaly: false,
        score: 0,
        severity: "info",
        unifiedSeverity: classified.unifiedSeverity,
        category: "static",
        anomalyEventClass: classified.anomalyEventClass,
        expectedValue: value,
        deviation: 0,
        deviationPercent: 0,
        explanation: "Insufficient data for gradient detection",
      };
    }

    // Calculate recent gradient (rate of change)
    const recentWindow = baseline.slice(-5);
    const last = recentWindow[recentWindow.length - 1]!;
    const first = recentWindow[0]!;
    const recentGradient =
      (last.value - first.value) /
      Math.max(1, recentWindow.length - 1);

    // Calculate expected value based on linear extrapolation from baseline
    const n = baseline.length;
    const xMean = (n - 1) / 2;
    const yMean = baseline.reduce((s, p) => s + p.value, 0) / n;

    // Compute slope and intercept via linear regression
    let xyCov = 0;
    let xVar = 0;
    for (let i = 0; i < n; i++) {
      const point = baseline[i]!;
      xyCov += (i - xMean) * (point.value - yMean);
      xVar += (i - xMean) * (i - xMean);
    }

    const slope = xVar !== 0 ? xyCov / xVar : 0;
    const intercept = yMean - slope * xMean;
    const expectedValue = intercept + slope * n; // extrapolate one step ahead

    const deviation = Math.abs(value - expectedValue);
    const avgMagnitude = baseline.reduce((s, p) => s + Math.abs(p.value), 0) / n;
    const deviationPercent = avgMagnitude !== 0 ? (deviation / avgMagnitude) * 100 : 0;

    // Score based on gradient deviation
    const gradientDeviation = Math.abs(recentGradient - slope);
    const sensitivityFactor = 1 - this.config.sensitivity;
    const threshold = avgMagnitude * 0.2 * sensitivityFactor; // 10-20% of average

    const isAnomaly = gradientDeviation > threshold && deviation > avgMagnitude * 0.5;
    const score = isAnomaly
      ? Math.min(1, gradientDeviation / (threshold * 2) * (deviation / avgMagnitude))
      : 0;

    const severity = this.scoreToSeverity(score);
    const category: AnomalyCategory =
      recentGradient > slope * 1.5 ? "spike" : recentGradient < slope * 0.5 ? "dip" : "trend_change";
    const classified = this.classifyDetection(metricName, severity, {
      algorithm: "gradient",
      score,
      category,
      slope,
      recentGradient,
      deviation,
    });

    if (isAnomaly) {
      const record = this.createAnomalyRecord(
        metricName,
        timestamp,
        category,
        severity,
        score,
        expectedValue,
        value,
        { algorithm: "gradient", slope, recentGradient, deviation },
      );
      this.addAnomalyRecord(metricName, record);
    }

    return {
      isAnomaly,
      score,
      severity,
      unifiedSeverity: classified.unifiedSeverity,
      category,
      anomalyEventClass: classified.anomalyEventClass,
      expectedValue,
      deviation,
      deviationPercent,
      explanation: isAnomaly
        ? `Gradient anomaly: value=${value}, expected=${expectedValue.toFixed(2)}, gradient=${recentGradient.toFixed(3)}`
        : `Normal gradient: ${recentGradient.toFixed(3)}`,
    };
  }

  // ── Adaptive Threshold ─────────────────────────────────────────────

  /**
   * Updates the adaptive threshold for a metric based on current baseline data.
   */
  private updateThreshold(metricName: string): void {
    const series = this.history.get(metricName);
    if (!series || series.length < this.config.minDataPoints) return;

    const baseline = series.slice(-this.config.windowSize);
    const values = baseline.map((p) => p.value);

    // Calculate mean and standard deviation
    const mean = values.reduce((s, v) => s + v, 0) / values.length;
    const stdDev =
      Math.sqrt(values.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / values.length) ||
      mean * 0.01;

    // K multiplier adjusts with sensitivity
    const sensitivityFactor = 1 - this.config.sensitivity;
    const k = 2 + sensitivityFactor * 1.5;

    this.thresholds.set(metricName, {
      upper: mean + k * stdDev,
      lower: Math.max(0, mean - k * stdDev),
      baseline: mean,
      algorithm: this.config.algorithm,
      lastUpdated: nowIso(),
    });
  }

  /**
   * Gets the current adaptive threshold for a metric.
   */
  getThreshold(metricName: string): AdaptiveThreshold | null {
    return this.thresholds.get(metricName) ?? null;
  }

  // ── Anomaly Records ────────────────────────────────────────────────

  /**
   * Creates an anomaly record with computed deviation metrics.
   */
  private createAnomalyRecord(
    metricName: string,
    timestamp: string,
    category: AnomalyCategory,
    severity: AnomalySeverity,
    score: number,
    expectedValue: number,
    observedValue: number,
    context: Record<string, unknown>,
  ): AnomalyRecord {
    const classified = this.classifyDetection(metricName, severity, context);
    return {
      id: newId("anomaly"),
      metricName,
      timestamp,
      severity,
      unifiedSeverity: classified.unifiedSeverity,
      category,
      anomalyEventClass: classified.anomalyEventClass,
      score,
      expectedValue,
      observedValue,
      deviation: Math.abs(observedValue - expectedValue),
      deviationPercent:
        expectedValue !== 0 ? (Math.abs(observedValue - expectedValue) / Math.abs(expectedValue)) * 100 : 0,
      context,
      resolved: false,
      resolvedAt: null,
    };
  }

  private classifyDetection(
    metricName: string,
    severity: AnomalySeverity,
    context: Record<string, unknown>,
  ): ClassifiedAnomalyEvent {
    return classifyAnomalyEvent({
      metricName,
      legacySeverity: severity,
      context,
    });
  }

  /**
   * Adds an anomaly record to the history.
   */
  private addAnomalyRecord(metricName: string, record: AnomalyRecord): void {
    let records = this.anomalies.get(metricName);
    if (!records) {
      records = [];
      this.anomalies.set(metricName, records);
    }
    records.push(record);

    // Keep bounded to prevent memory issues
    if (records.length > 1000) {
      records.splice(0, records.length - 1000);
    }
  }

  /**
   * Marks an anomaly as resolved.
   */
  resolveAnomaly(anomalyId: string): boolean {
    for (const records of this.anomalies.values()) {
      const record = records.find((r) => r.id === anomalyId);
      if (record) {
        record.resolved = true;
        record.resolvedAt = nowIso();
        return true;
      }
    }
    return false;
  }

  /**
   * Retrieves anomaly records with optional filtering.
   */
  getAnomalies(
    metricName?: string,
    options?: { unresolvedOnly?: boolean; since?: string; minSeverity?: AnomalySeverity },
  ): AnomalyRecord[] {
    const allRecords = metricName ? this.anomalies.get(metricName) ?? [] : [...this.anomalies.values()].flat();

    return allRecords.filter((r) => {
      if (options?.unresolvedOnly && r.resolved) return false;
      if (options?.since && r.timestamp < options.since) return false;
      if (options?.minSeverity) {
        const severityOrder: Record<AnomalySeverity, number> = { info: 0, warning: 1, critical: 2, emergency: 3 };
        if (severityOrder[r.severity] < severityOrder[options.minSeverity]) return false;
      }
      return true;
    });
  }

  // ── Signature Management ────────────────────────────────────────────

  /**
   * Registers a new anomaly signature for pattern matching.
   */
  registerSignature(signature: AnomalySignature): void {
    this.signatures.set(signature.id, signature);
  }

  /**
   * Unregisters an anomaly signature.
   */
  unregisterSignature(signatureId: string): boolean {
    return this.signatures.delete(signatureId);
  }

  /**
   * Returns all registered signatures.
   */
  getSignatures(): AnomalySignature[] {
    return [...this.signatures.values()];
  }

  // ── Metric History ────────────────────────────────────────────────

  /**
   * Returns the time series history for a metric.
   */
  getHistory(metricName: string, limit?: number): TimeSeriesPoint[] {
    const series = this.history.get(metricName) ?? [];
    return limit ? series.slice(-limit) : [...series];
  }

  /**
   * Clears history (and associated thresholds/anomalies) for a metric or all metrics.
   */
  clearHistory(metricName?: string): void {
    if (metricName) {
      this.history.delete(metricName);
      this.thresholds.delete(metricName);
      this.anomalies.delete(metricName);
    } else {
      this.history.clear();
      this.thresholds.clear();
      this.anomalies.clear();
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────

  /**
   * Converts a detection score (0-1) to a severity level.
   */
  private scoreToSeverity(score: number): AnomalySeverity {
    if (score >= 0.9) return "emergency";
    if (score >= 0.7) return "critical";
    if (score >= 0.4) return "warning";
    return "info";
  }

  /**
   * Classifies the category of an anomaly based on the value pattern.
   */
  private classifyAnomalyCategory(
    value: number,
    baseline: number,
    history: TimeSeriesPoint[],
  ): AnomalyCategory {
    const prevValue = history.length >= 2 ? history[history.length - 2]!.value : 0;
    const changeRatio = history.length >= 2
      ? Math.abs(value - prevValue) / Math.max(1, Math.abs(prevValue))
      : 0;

    // Classify based on change characteristics
    if (changeRatio > 2.0) return "spike";
    if (value > baseline * 1.5) return "spike";
    if (value < baseline * 0.5) return "dip";

    // Check for level shift by comparing recent mean to older mean
    if (history.length >= 10) {
      const recentMean =
        history.slice(-5).reduce((s, p) => s + p.value, 0) / 5;
      const olderMean =
        history.slice(-10, -5).reduce((s, p) => s + p.value, 0) / Math.max(1, 5);
      if (olderMean > 0 && Math.abs(recentMean - olderMean) / olderMean > 0.5) {
        return "level_shift";
      }
    }

    return "trend_change";
  }

  // ── Trend Analysis ─────────────────────────────────────────────────

  /**
   * Analyzes the trend direction of a metric.
   * Returns the direction, slope, and confidence level.
   */
  analyzeTrend(metricName: string): {
    direction: "increasing" | "decreasing" | "stable";
    slope: number;
    confidence: number; // 0-1
  } {
    const series = this.history.get(metricName) ?? [];
    if (series.length < 3) {
      return { direction: "stable", slope: 0, confidence: 0 };
    }

    const n = series.length;
    const xMean = (n - 1) / 2;
    const yMean = series.reduce((s, p) => s + p.value, 0) / n;

    // Linear regression to find slope
    let xyCov = 0;
    let xVar = 0;
    for (let i = 0; i < n; i++) {
      const point = series[i]!;
      xyCov += (i - xMean) * (point.value - yMean);
      xVar += (i - xMean) * (i - xMean);
    }

    const slope = xVar !== 0 ? xyCov / xVar : 0;
    const avgValue = yMean;

    // Confidence based on consistency of direction
    let positiveCount = 0;
    let negativeCount = 0;
    for (let i = 1; i < n; i++) {
      const curr = series[i]!;
      const prev = series[i - 1]!;
      if (curr.value > prev.value) positiveCount++;
      else if (curr.value < prev.value) negativeCount++;
    }
    const consistency = Math.max(positiveCount, negativeCount) / Math.max(1, n - 1);
    const confidence = Math.min(1, consistency);

    const direction =
      Math.abs(slope) < avgValue * 0.01 ? "stable" : slope > 0 ? "increasing" : "decreasing";

    return { direction, slope, confidence };
  }
}
