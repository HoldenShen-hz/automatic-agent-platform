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
import type { AdaptiveThreshold, AnomalyDetectionResult, AnomalyDetectorOptions, AnomalyRecord, AnomalySeverity, AnomalySignature, TimeSeriesPoint } from "./anomaly-detection/types.js";
export type { AdaptiveThreshold, AnomalyCategory, AnomalyDetectionConfig, AnomalyDetectionResult, AnomalyDetectorOptions, AnomalyRecord, AnomalySeverity, AnomalySignature, TimeSeriesPoint, } from "./anomaly-detection/types.js";
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
export declare class AnomalyDetectionService {
    private readonly config;
    private readonly history;
    private readonly thresholds;
    private readonly anomalies;
    private readonly signatures;
    constructor(options?: AnomalyDetectorOptions);
    /**
     * Registers default anomaly signatures for common problem patterns.
     * These patterns help identify known issue types like error spikes and latency degradation.
     */
    private initDefaultSignatures;
    /**
     * Ingests a single metric data point.
     * Updates the rolling history and adaptive threshold for the metric.
     */
    ingest(metricName: string, value: number, timestamp?: string): void;
    /**
     * Ingests multiple data points at once.
     */
    ingestBatch(metricName: string, points: TimeSeriesPoint[]): void;
    /**
     * Detects anomalies for a metric value using the configured algorithm.
     * Returns a detection result with severity, category, and explanation.
     */
    detect(metricName: string, value: number, timestamp?: string): AnomalyDetectionResult;
    /**
     * Checks if a metric/value matches any registered anomaly signature.
     */
    private checkSignatures;
    /**
     * Z-score based anomaly detection.
     * Computes standard deviation from baseline and flags values beyond threshold.
     */
    private detectZScore;
    /**
     * IQR (Interquartile Range) based anomaly detection.
     * Uses quartiles to identify outliers beyond the expected range.
     */
    private detectIQR;
    /**
     * EWMA (Exponentially Weighted Moving Average) based detection.
     * Gives more weight to recent observations while maintaining a running average.
     */
    private detectEWMA;
    /**
     * Gradient-based anomaly detection.
     * Detects anomalies based on sudden changes in the rate of change (gradient).
     */
    private detectGradient;
    /**
     * Updates the adaptive threshold for a metric based on current baseline data.
     */
    private updateThreshold;
    /**
     * Gets the current adaptive threshold for a metric.
     */
    getThreshold(metricName: string): AdaptiveThreshold | null;
    /**
     * Creates an anomaly record with computed deviation metrics.
     */
    private createAnomalyRecord;
    /**
     * Adds an anomaly record to the history.
     */
    private addAnomalyRecord;
    /**
     * Marks an anomaly as resolved.
     */
    resolveAnomaly(anomalyId: string): boolean;
    /**
     * Retrieves anomaly records with optional filtering.
     */
    getAnomalies(metricName?: string, options?: {
        unresolvedOnly?: boolean;
        since?: string;
        minSeverity?: AnomalySeverity;
    }): AnomalyRecord[];
    /**
     * Registers a new anomaly signature for pattern matching.
     */
    registerSignature(signature: AnomalySignature): void;
    /**
     * Unregisters an anomaly signature.
     */
    unregisterSignature(signatureId: string): boolean;
    /**
     * Returns all registered signatures.
     */
    getSignatures(): AnomalySignature[];
    /**
     * Returns the time series history for a metric.
     */
    getHistory(metricName: string, limit?: number): TimeSeriesPoint[];
    /**
     * Clears history (and associated thresholds/anomalies) for a metric or all metrics.
     */
    clearHistory(metricName?: string): void;
    /**
     * Converts a detection score (0-1) to a severity level.
     */
    private scoreToSeverity;
    /**
     * Classifies the category of an anomaly based on the value pattern.
     */
    private classifyAnomalyCategory;
    /**
     * Analyzes the trend direction of a metric.
     * Returns the direction, slope, and confidence level.
     */
    analyzeTrend(metricName: string): {
        direction: "increasing" | "decreasing" | "stable";
        slope: number;
        confidence: number;
    };
}
