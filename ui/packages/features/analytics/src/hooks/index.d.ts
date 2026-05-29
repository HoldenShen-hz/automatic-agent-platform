import type { AnalyticsMetricDTO } from "@aa/shared-types";
export type ChartType = "bar" | "line" | "pie" | "area" | "heatmap";
export type KpiLayer = "overview" | "tasks" | "workflows" | "approvals" | "cost" | "agents";
export type AnalyticsExportFormat = "csv" | "json";
export interface AnalyticsTimeSeriesPoint {
    readonly timestamp: string;
    readonly value: number;
}
export interface AnalyticsBreakdown {
    readonly dimension: "time" | "domain" | "layer";
    readonly groups: readonly {
        label: string;
        value: number;
    }[];
}
export interface KpiBreakdown {
    readonly layer: KpiLayer;
    readonly label: string;
    readonly value: number;
    readonly trend: number;
    readonly changePercent: number;
}
export interface AnalyticsChartConfig {
    readonly chartType: ChartType;
    readonly layer: KpiLayer;
    readonly timeRange: "24h" | "7d" | "30d" | "90d";
}
export interface AnalyticsVm {
    readonly metrics: readonly {
        label: string;
        value: string | number;
    }[];
    readonly trendSummary: readonly number[];
    readonly timeSeriesData: readonly AnalyticsTimeSeriesPoint[];
    readonly dateRange: {
        startDate: string;
        endDate: string;
    };
    readonly breakdowns: readonly AnalyticsBreakdown[];
    readonly layerSummaries: readonly {
        layer: KpiLayer;
        label: string;
        metricCount: number;
        netChangePercent: number;
    }[];
    readonly kpiBreakdowns: readonly KpiBreakdown[];
    readonly selectedLayer: KpiLayer;
    readonly chartConfig: AnalyticsChartConfig;
    readonly availableLayers: readonly KpiLayer[];
    setLayer(layer: KpiLayer): void;
    setChartType(chartType: ChartType): void;
    setTimeRange(timeRange: AnalyticsChartConfig["timeRange"]): void;
    setDateRange(startDate: string, endDate: string): void;
    exportData(format: AnalyticsExportFormat): void;
    getFilteredMetrics(): readonly AnalyticsMetricDTO[];
}
export declare const MAX_ANALYTICS_EXPORT_BYTES: number;
export declare function buildAnalyticsExportPayload(format: AnalyticsExportFormat, metrics: readonly AnalyticsMetricDTO[], timeSeriesData: readonly AnalyticsTimeSeriesPoint[], breakdowns: readonly AnalyticsBreakdown[], dateRange: AnalyticsVm["dateRange"]): string;
export declare function mapAnalyticsToVm(metrics: readonly AnalyticsMetricDTO[]): Pick<AnalyticsVm, "metrics" | "trendSummary" | "layerSummaries">;
export declare function useAnalyticsVm(): AnalyticsVm;
