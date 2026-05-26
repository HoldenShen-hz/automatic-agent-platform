/**
 * @fileoverview Anomaly Detection Service
 *
 * Provides:
 * - Statistical anomaly detection based on SLO thresholds
 * - Multi-dimensional metric analysis
 * - Alert severity classification
 * - Root cause direction hints
 *
 * §66 Monitoring Enhancement - Anomaly Detection (SLO threshold-based statistical method)
 */

import { nowIso } from "../../platform/contracts/types/ids.js";

export interface MetricDatapoint {
  timestamp: string;
  value: number;
}

export interface SlidingWindowStats {
  mean: number;
  stdDev: number;
  min: number;
  max: number;
  count: number;
}

export interface AnomalyAlert {
  alertId: string;
  metricName: string;
  severity: "warning" | "critical";
  detectedAt: string;
  reason: string;
  currentValue: number;
  expectedRange: { low: number; high: number };
  deviationPercent: number;
  rootCauseHints: readonly string[];
}

export interface SloThreshold {
  metricName: string;
  warningThreshold: number;
  criticalThreshold: number;
  windowSizeMinutes: number;
}

const DEFAULT_SLO_THRESHOLDS: SloThreshold[] = [
  { metricName: "error_rate", warningThreshold: 0.01, criticalThreshold: 0.05, windowSizeMinutes: 5 },
  { metricName: "latency_p99_ms", warningThreshold: 1000, criticalThreshold: 5000, windowSizeMinutes: 5 },
  { metricName: "availability", warningThreshold: 0.995, criticalThreshold: 0.99, windowSizeMinutes: 60 },
  { metricName: "saturation", warningThreshold: 0.8, criticalThreshold: 0.95, windowSizeMinutes: 5 },
];

export class AnomalyDetectionService {
  private readonly thresholds: readonly SloThreshold[];
  private readonly metricBuffer = new Map<string, MetricDatapoint[]>();
  private readonly maxBufferEntries = 500;
  private readonly maxPointsPerMetric = 120;
  private cleanupAt = 0;

  public constructor(thresholds?: readonly SloThreshold[]) {
    this.thresholds = thresholds ?? DEFAULT_SLO_THRESHOLDS;
  }

  public ingestMetric(name: string, value: number, timestamp?: string): void {
    const key = name;
    const datapoint = { timestamp: timestamp ?? nowIso(), value };
    const existing = this.metricBuffer.get(key) ?? [];
    const next = [...existing, datapoint];
    if (next.length > this.maxPointsPerMetric) {
      next.splice(0, next.length - this.maxPointsPerMetric);
    }
    this.metricBuffer.set(key, next);
    this.evictExpired();
  }

  private evictExpired(): void {
    const now = Date.now();
    if (now - this.cleanupAt < 30000) return;
    this.cleanupAt = now;
    for (const [metricName, buffer] of this.metricBuffer) {
      const threshold = this.thresholds.find((item) => item.metricName === metricName);
      const retentionMinutes = threshold?.windowSizeMinutes ?? 60;
      const trimmed = this.getRecentWindow(buffer, retentionMinutes * 2);
      if (trimmed.length === 0) {
        this.metricBuffer.delete(metricName);
        continue;
      }
      if (trimmed.length !== buffer.length) {
        this.metricBuffer.set(metricName, trimmed.slice(-this.maxPointsPerMetric));
      }
    }
    if (this.metricBuffer.size <= this.maxBufferEntries) return;
    const keys = Array.from(this.metricBuffer.keys());
    const toRemove = keys.slice(0, Math.floor(this.maxBufferEntries * 0.2));
    for (const k of toRemove) this.metricBuffer.delete(k);
  }

  public detectAnomalies(metricName: string): readonly AnomalyAlert[] {
    const threshold = this.thresholds.find((t) => t.metricName === metricName);
    if (!threshold) return [];

    const buffer = this.metricBuffer.get(metricName) ?? [];
    if (buffer.length < 5) return [];

    const window = this.getRecentWindow(buffer, threshold.windowSizeMinutes);
    if (window.length === 0) return [];

    const latest = window[window.length - 1]!;
    const baseline = window.length > 1 ? window.slice(0, -1) : window;
    const stats = this.computeStats(baseline);
    const alerts: AnomalyAlert[] = [];

    const thresholdSeverity = this.evaluateThresholdSeverity(metricName, latest.value, threshold);
    if (thresholdSeverity != null) {
      alerts.push(this.createAlert(metricName, latest, stats, thresholdSeverity, threshold));
    }

    // Statistical anomaly: value > mean + 3*stdDev
    const zScore = stats.stdDev > 0 ? (latest.value - stats.mean) / stats.stdDev : 0;
    if (zScore > 3) {
      alerts.push(this.createStatisticalAlert(metricName, latest, stats, zScore));
    }

    return alerts;
  }

  public detectAllAnomalies(): readonly AnomalyAlert[] {
    const allAlerts: AnomalyAlert[] = [];
    for (const threshold of this.thresholds) {
      allAlerts.push(...this.detectAnomalies(threshold.metricName));
    }
    return allAlerts;
  }

  public getMetricStats(metricName: string, windowMinutes: number = 60): SlidingWindowStats | null {
    const buffer = this.metricBuffer.get(metricName) ?? [];
    const window = this.getRecentWindow(buffer, windowMinutes);
    if (window.length === 0) return null;
    return this.computeStats(window);
  }

  private getRecentWindow(buffer: MetricDatapoint[], windowMinutes: number): MetricDatapoint[] {
    const cutoff = Date.now() - windowMinutes * 60 * 1000;
    return buffer.filter((d) => new Date(d.timestamp).getTime() >= cutoff);
  }

  private computeStats(data: MetricDatapoint[]): SlidingWindowStats {
    if (data.length === 0) {
      return { mean: 0, stdDev: 0, min: 0, max: 0, count: 0 };
    }

    const values = data.map((d) => d.value);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    return {
      mean,
      stdDev,
      min: Math.min(...values),
      max: Math.max(...values),
      count: values.length,
    };
  }

  private createAlert(
    metricName: string,
    latest: MetricDatapoint,
    stats: SlidingWindowStats,
    severity: "warning" | "critical",
    threshold: SloThreshold,
  ): AnomalyAlert {
    const deviationPercent = stats.mean > 0
      ? ((latest.value - stats.mean) / stats.mean) * 100
      : 0;

    return {
      alertId: `alert_${Date.now()}_${metricName}`,
      metricName,
      severity,
      detectedAt: latest.timestamp,
      reason: `${metricName}=${latest.value.toFixed(2)} ${this.describeThresholdBreach(metricName, severity)} ${severity} threshold`,
      currentValue: latest.value,
      expectedRange: { low: stats.mean - 2 * stats.stdDev, high: stats.mean + 2 * stats.stdDev },
      deviationPercent,
      rootCauseHints: this.generateRootCauseHints(metricName, latest.value, stats),
    };
  }

  private evaluateThresholdSeverity(
    metricName: string,
    value: number,
    threshold: SloThreshold,
  ): "warning" | "critical" | null {
    if (this.isLowerValueWorse(metricName)) {
      if (value <= threshold.criticalThreshold) {
        return "critical";
      }
      if (value <= threshold.warningThreshold) {
        return "warning";
      }
      return null;
    }

    if (value >= threshold.criticalThreshold) {
      return "critical";
    }
    if (value >= threshold.warningThreshold) {
      return "warning";
    }
    return null;
  }

  private isLowerValueWorse(metricName: string): boolean {
    return metricName === "availability";
  }

  private describeThresholdBreach(metricName: string, severity: "warning" | "critical"): string {
    return this.isLowerValueWorse(metricName) ? "falls below" : "exceeds";
  }

  private createStatisticalAlert(
    metricName: string,
    latest: MetricDatapoint,
    stats: SlidingWindowStats,
    zScore: number,
  ): AnomalyAlert {
    return {
      alertId: `alert_stat_${Date.now()}_${metricName}`,
      metricName,
      severity: "warning",
      detectedAt: latest.timestamp,
      reason: `Statistical anomaly detected: z-score=${zScore.toFixed(2)} (threshold=3)`,
      currentValue: latest.value,
      expectedRange: { low: stats.mean - 3 * stats.stdDev, high: stats.mean + 3 * stats.stdDev },
      deviationPercent: zScore * stats.stdDev / (stats.mean || 1) * 100,
      rootCauseHints: this.generateRootCauseHints(metricName, latest.value, stats),
    };
  }

  private generateRootCauseHints(metricName: string, value: number, stats: SlidingWindowStats): readonly string[] {
    const hints: string[] = [];

    if (metricName === "error_rate") {
      hints.push("Check recent deployments for regression");
      hints.push("Review error logs for spike patterns");
    } else if (metricName === "latency_p99_ms") {
      hints.push("Investigate slow database queries");
      hints.push("Check for increased request queue depth");
    } else if (metricName === "availability") {
      hints.push("Check service health endpoints");
      hints.push("Review recent incident reports");
    } else if (metricName === "saturation") {
      hints.push("Check resource utilization trends");
      hints.push("Review capacity planning forecasts");
    }

    return hints;
  }
}
