import { useAnalyticsQuery } from "@aa/shared-state";
import type { AnalyticsMetricDTO } from "@aa/shared-types";

export interface AnalyticsVm {
  readonly metrics: readonly { label: string; value: string | number }[];
  readonly trendSummary: readonly number[];
}

export function mapAnalyticsToVm(metrics: readonly AnalyticsMetricDTO[]): AnalyticsVm {
  return {
    metrics: metrics.map((metric) => ({ label: metric.label, value: metric.value })),
    trendSummary: metrics.map((metric) => metric.trend === "up" ? 3 : metric.trend === "flat" ? 2 : 1),
  };
}

export function useAnalyticsVm(): AnalyticsVm {
  return mapAnalyticsToVm(useAnalyticsQuery().data ?? []);
}
