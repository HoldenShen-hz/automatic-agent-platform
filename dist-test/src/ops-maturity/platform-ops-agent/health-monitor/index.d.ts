export interface OpsHealthProbe {
    readonly component: string;
    readonly status: "healthy" | "degraded" | "failed";
    readonly latencyMs?: number;
    readonly timestamp?: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
}
export interface OpsHealthMetrics {
    readonly totalComponents: number;
    readonly healthyCount: number;
    readonly degradedCount: number;
    readonly failedCount: number;
    readonly healthScore: number;
    readonly averageLatencyMs: number | null;
    readonly slowestComponent: string | null;
    readonly mostRecentCheck: string | null;
}
export interface OpsHealthAlert {
    readonly component: string;
    readonly severity: "warning" | "critical";
    readonly reasonCode: string;
}
export interface OpsHealthSnapshot {
    readonly status: "healthy" | "degraded" | "failed";
    readonly metrics: OpsHealthMetrics;
    readonly alerts: readonly OpsHealthAlert[];
}
export declare function summarizeOpsHealth(probes: readonly OpsHealthProbe[]): "healthy" | "degraded" | "failed";
export declare function findUnhealthyComponents(probes: readonly OpsHealthProbe[]): string[];
export declare function calculateHealthMetrics(probes: readonly OpsHealthProbe[]): OpsHealthMetrics;
export declare function groupProbesByStatus(probes: readonly OpsHealthProbe[]): {
    healthy: readonly OpsHealthProbe[];
    degraded: readonly OpsHealthProbe[];
    failed: readonly OpsHealthProbe[];
};
export declare function analyzeLatencyTrends(probes: readonly OpsHealthProbe[]): {
    component: string;
    latencyMs: number;
}[];
export declare function hasLatencyAnomalies(probes: readonly OpsHealthProbe[], thresholdMs: number): boolean;
export declare function generateHealthSummary(probes: readonly OpsHealthProbe[]): string;
export declare class OpsHealthMonitorService {
    evaluate(probes: readonly OpsHealthProbe[], options?: {
        readonly latencyThresholdMs?: number;
    }): OpsHealthSnapshot;
}
