/**
 * @fileoverview Anomaly Detection Service
 *
 * Provides:
 * - Statistical anomaly detection based on SLO thresholds
 * - Multi-dimensional metric analysis
 * - Alert severity classification
 * - Root cause direction hints
 *
 * §66 监控增强 - 异常检测（基于 SLO 阈值的统计方法）
 */
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
    expectedRange: {
        low: number;
        high: number;
    };
    deviationPercent: number;
    rootCauseHints: readonly string[];
}
export interface SloThreshold {
    metricName: string;
    warningThreshold: number;
    criticalThreshold: number;
    windowSizeMinutes: number;
}
export declare class AnomalyDetectionService {
    private readonly thresholds;
    private readonly metricBuffer;
    constructor(thresholds?: readonly SloThreshold[]);
    ingestMetric(name: string, value: number, timestamp?: string): void;
    detectAnomalies(metricName: string): readonly AnomalyAlert[];
    detectAllAnomalies(): readonly AnomalyAlert[];
    getMetricStats(metricName: string, windowMinutes?: number): SlidingWindowStats | null;
    private getRecentWindow;
    private computeStats;
    private createAlert;
    private createStatisticalAlert;
    private generateRootCauseHints;
}
