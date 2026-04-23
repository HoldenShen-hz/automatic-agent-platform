import { type Server } from "node:http";
import type { PrometheusMetricsExporter } from "./prometheus-metrics-exporter.js";
export interface MetricsResponsePayload {
    statusCode: number;
    headers: Record<string, string>;
    body: string;
}
export declare function renderMetricsPayload(exporter: PrometheusMetricsExporter | null, method: string | undefined, path: string | undefined): MetricsResponsePayload;
export declare function createMetricsServer(exporter: PrometheusMetricsExporter | null): Server;
