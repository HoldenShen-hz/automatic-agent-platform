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
const DEFAULT_SLO_THRESHOLDS = [
    { metricName: "error_rate", warningThreshold: 0.01, criticalThreshold: 0.05, windowSizeMinutes: 5 },
    { metricName: "latency_p99_ms", warningThreshold: 1000, criticalThreshold: 5000, windowSizeMinutes: 5 },
    { metricName: "availability", warningThreshold: 0.995, criticalThreshold: 0.99, windowSizeMinutes: 60 },
    { metricName: "saturation", warningThreshold: 0.8, criticalThreshold: 0.95, windowSizeMinutes: 5 },
];
export class AnomalyDetectionService {
    thresholds;
    metricBuffer = new Map();
    maxBufferEntries = 500;
    cleanupAt = 0;
    constructor(thresholds) {
        this.thresholds = thresholds ?? DEFAULT_SLO_THRESHOLDS;
    }
    ingestMetric(name, value, timestamp) {
        const key = name;
        const existing = this.metricBuffer.get(key) ?? [];
        this.metricBuffer.set(key, [...existing, { timestamp: timestamp ?? nowIso(), value }]);
        this.evictExpired();
    }
    evictExpired() {
        const now = Date.now();
        if (now - this.cleanupAt < 30000)
            return;
        this.cleanupAt = now;
        if (this.metricBuffer.size <= this.maxBufferEntries)
            return;
        const keys = Array.from(this.metricBuffer.keys());
        const toRemove = keys.slice(0, Math.floor(this.maxBufferEntries * 0.2));
        for (const k of toRemove)
            this.metricBuffer.delete(k);
    }
    detectAnomalies(metricName) {
        const threshold = this.thresholds.find((t) => t.metricName === metricName);
        if (!threshold)
            return [];
        const buffer = this.metricBuffer.get(metricName) ?? [];
        if (buffer.length < 5)
            return [];
        const window = this.getRecentWindow(buffer, threshold.windowSizeMinutes);
        if (window.length === 0)
            return [];
        const stats = this.computeStats(window);
        const latest = window[window.length - 1];
        const alerts = [];
        if (latest.value >= threshold.criticalThreshold) {
            alerts.push(this.createAlert(metricName, latest, stats, "critical", threshold));
        }
        else if (latest.value >= threshold.warningThreshold) {
            alerts.push(this.createAlert(metricName, latest, stats, "warning", threshold));
        }
        // Statistical anomaly: value > mean + 3*stdDev
        const zScore = stats.stdDev > 0 ? (latest.value - stats.mean) / stats.stdDev : 0;
        if (zScore > 3) {
            alerts.push(this.createStatisticalAlert(metricName, latest, stats, zScore));
        }
        return alerts;
    }
    detectAllAnomalies() {
        const allAlerts = [];
        for (const threshold of this.thresholds) {
            allAlerts.push(...this.detectAnomalies(threshold.metricName));
        }
        return allAlerts;
    }
    getMetricStats(metricName, windowMinutes = 60) {
        const buffer = this.metricBuffer.get(metricName) ?? [];
        const window = this.getRecentWindow(buffer, windowMinutes);
        if (window.length === 0)
            return null;
        return this.computeStats(window);
    }
    getRecentWindow(buffer, windowMinutes) {
        const cutoff = Date.now() - windowMinutes * 60 * 1000;
        return buffer.filter((d) => new Date(d.timestamp).getTime() >= cutoff);
    }
    computeStats(data) {
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
    createAlert(metricName, latest, stats, severity, threshold) {
        const deviationPercent = stats.mean > 0
            ? ((latest.value - stats.mean) / stats.mean) * 100
            : 0;
        return {
            alertId: `alert_${Date.now()}_${metricName}`,
            metricName,
            severity,
            detectedAt: latest.timestamp,
            reason: `${metricName}=${latest.value.toFixed(2)} ${severity === "critical" ? "exceeds" : "exceeds"} ${severity} threshold`,
            currentValue: latest.value,
            expectedRange: { low: stats.mean - 2 * stats.stdDev, high: stats.mean + 2 * stats.stdDev },
            deviationPercent,
            rootCauseHints: this.generateRootCauseHints(metricName, latest.value, stats),
        };
    }
    createStatisticalAlert(metricName, latest, stats, zScore) {
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
    generateRootCauseHints(metricName, value, stats) {
        const hints = [];
        if (metricName === "error_rate") {
            hints.push("Check recent deployments for regression");
            hints.push("Review error logs for spike patterns");
        }
        else if (metricName === "latency_p99_ms") {
            hints.push("Investigate slow database queries");
            hints.push("Check for increased request queue depth");
        }
        else if (metricName === "availability") {
            hints.push("Check service health endpoints");
            hints.push("Review recent incident reports");
        }
        else if (metricName === "saturation") {
            hints.push("Check resource utilization trends");
            hints.push("Review capacity planning forecasts");
        }
        return hints;
    }
}
//# sourceMappingURL=anomaly-detection-service.js.map