import { createServer, type Server } from "node:http";

import type { PrometheusMetricsExporter } from "./prometheus-metrics-exporter.js";

export interface MetricsResponsePayload {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export function renderMetricsPayload(
  exporter: PrometheusMetricsExporter | null,
  method: string | undefined,
  path: string | undefined,
): MetricsResponsePayload {
  if ((method ?? "GET") !== "GET") {
    return {
      statusCode: 405,
      headers: { allow: "GET", "content-type": "text/plain; charset=utf-8" },
      body: "Method Not Allowed",
    };
  }
  if (path !== "/metrics") {
    return {
      statusCode: 404,
      headers: { "content-type": "text/plain; charset=utf-8" },
      body: "Not Found",
    };
  }
  if (exporter == null) {
    return {
      statusCode: 503,
      headers: { "content-type": "text/plain; charset=utf-8" },
      body: "metrics exporter unavailable",
    };
  }
  return {
    statusCode: 200,
    headers: { "content-type": "text/plain; version=0.0.4; charset=utf-8" },
    body: exporter.export(),
  };
}

export function createMetricsServer(exporter: PrometheusMetricsExporter | null): Server {
  return createServer((request, response) => {
    const payload = renderMetricsPayload(exporter, request.method, request.url);
    response.writeHead(payload.statusCode, payload.headers);
    response.end(payload.body);
  });
}
