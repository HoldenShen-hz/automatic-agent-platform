import type { RouteDefinition } from "./types.js";
import type { PrometheusMetricsExporter } from "../../../shared/observability/prometheus-metrics-exporter.js";
export interface MetricsRouteDeps {
    prometheusMetricsExporter: PrometheusMetricsExporter | null;
}
export declare function createMetricsRoutes(deps: MetricsRouteDeps): RouteDefinition[];
