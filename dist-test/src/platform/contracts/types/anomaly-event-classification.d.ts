import { type ObservabilitySeverity, type UnifiedSeverity } from "./unified-severity.js";
export declare const ANOMALY_EVENT_CLASSES: readonly ["E1_BUSINESS", "E2_EXECUTION", "E3_EXTERNAL_DEPENDENCY", "E4_SECURITY", "E5_DATA", "E6_GOVERNANCE"];
export type AnomalyEventClass = (typeof ANOMALY_EVENT_CLASSES)[number];
export interface ClassifiedAnomalyEvent {
    metricName: string;
    anomalyEventClass: AnomalyEventClass;
    unifiedSeverity: UnifiedSeverity;
    legacySeverity: ObservabilitySeverity;
    reason: string;
}
export interface ClassifyAnomalyEventInput {
    metricName: string;
    legacySeverity: ObservabilitySeverity;
    context?: Record<string, unknown> | null;
}
export declare function classifyAnomalyEvent(input: ClassifyAnomalyEventInput): ClassifiedAnomalyEvent;
