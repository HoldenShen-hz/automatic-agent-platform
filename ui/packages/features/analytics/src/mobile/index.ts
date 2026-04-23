import { createMobileFeatureCard } from "@aa/ui-mobile";
import type { AnalyticsMetricDTO } from "@aa/shared-types";

export function createAnalyticsMobileCards(metrics: readonly AnalyticsMetricDTO[]) {
  return metrics.slice(0, 3).map((metric) => createMobileFeatureCard(
    metric.label,
    metric.value,
    metric.trend,
  ));
}
