export type AnomalySeverity = "info" | "warning" | "critical" | "emergency";
export type AnomalyCategory = "spike" | "dip" | "trend_change" | "level_shift" | "seasonal_violation" | "rate_of_change" | "static" | "pattern_break";
export interface TimeSeriesPoint {
    timestamp: string;
    value: number;
}
export interface AnomalyRecord {
    id: string;
    metricName: string;
    timestamp: string;
    severity: AnomalySeverity;
    category: AnomalyCategory;
    score: number;
    expectedValue: number;
    observedValue: number;
    deviation: number;
    deviationPercent: number;
    context: Record<string, unknown>;
    resolved: boolean;
    resolvedAt: string | null;
}
export interface AnomalyDetectionConfig {
    algorithm: "zscore" | "iqr" | "ewma" | "gradient";
    sensitivity: number;
    windowSize: number;
    minDataPoints: number;
    seasonalPeriod?: number;
}
export interface AdaptiveThreshold {
    upper: number;
    lower: number;
    baseline: number;
    algorithm: string;
    lastUpdated: string;
}
export interface AnomalySignature {
    id: string;
    name: string;
    pattern: RegExp;
    category: AnomalyCategory;
    severity: AnomalySeverity;
    description: string;
}
export interface AnomalyDetectionResult {
    isAnomaly: boolean;
    score: number;
    severity: AnomalySeverity;
    category: AnomalyCategory;
    expectedValue: number;
    deviation: number;
    deviationPercent: number;
    explanation: string;
}
export interface AnomalyDetectorOptions {
    config?: Partial<AnomalyDetectionConfig>;
    signatures?: AnomalySignature[];
}
