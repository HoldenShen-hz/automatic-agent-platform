import { createMobileFeatureCard } from "@aa/ui-mobile";
export function createAnalyticsMobileCards(metrics) {
    return metrics.slice(0, 3).map((metric) => createMobileFeatureCard(metric.label, String(metric.value), metric.trend));
}
