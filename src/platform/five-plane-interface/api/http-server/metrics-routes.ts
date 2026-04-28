import type { RouteDefinition } from "./types.js";
import { buildTextResponse } from "./utils.js";
import type { PrometheusMetricsExporter } from "../../../shared/observability/prometheus-metrics-exporter.js";
import { AppError } from "../../../contracts/errors.js";

class ApiError extends AppError {
  public constructor(statusCode: number, code: string, message: string) {
    super(code, message, {
      statusCode,
      category: statusCode >= 500 ? "internal" : statusCode >= 400 ? "validation" : "external",
      source: "runtime",
      retryable: statusCode >= 500 || statusCode === 429,
    });
    this.name = "ApiError";
  }
}

export interface MetricsRouteDeps {
  prometheusMetricsExporter: PrometheusMetricsExporter | null;
}

function buildMetricsHandler(exporter: PrometheusMetricsExporter | null): RouteDefinition["handler"] {
  return async () => {
    if (exporter == null) {
      throw new ApiError(503, "api.metrics_unavailable", "Prometheus metrics exporter is not configured.");
    }
    return buildTextResponse(exporter.export());
  };
}

export function createMetricsRoutes(deps: MetricsRouteDeps): RouteDefinition[] {
  const handler = buildMetricsHandler(deps.prometheusMetricsExporter);
  return [
    { method: "GET", pathname: "/metrics", handler },
    { method: "GET", pathname: "/v1/metrics", handler },
    { method: "GET", pathname: "/prometheus", handler },
  ];
}
