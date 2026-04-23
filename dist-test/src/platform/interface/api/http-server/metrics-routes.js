import { buildTextResponse } from "./utils.js";
import { AppError } from "../../../contracts/errors.js";
class ApiError extends AppError {
    constructor(statusCode, code, message) {
        super(code, message, {
            statusCode,
            category: statusCode >= 500 ? "internal" : statusCode >= 400 ? "validation" : "external",
            source: "runtime",
            retryable: statusCode >= 500 || statusCode === 429,
        });
        this.name = "ApiError";
    }
}
function buildMetricsHandler(exporter) {
    return async () => {
        if (exporter == null) {
            throw new ApiError(503, "api.metrics_unavailable", "Prometheus metrics exporter is not configured.");
        }
        return buildTextResponse(exporter.export());
    };
}
export function createMetricsRoutes(deps) {
    const handler = buildMetricsHandler(deps.prometheusMetricsExporter);
    return [
        { method: "GET", pathname: "/metrics", handler },
        { method: "GET", pathname: "/v1/metrics", handler },
        { method: "GET", pathname: "/prometheus", handler },
    ];
}
//# sourceMappingURL=metrics-routes.js.map