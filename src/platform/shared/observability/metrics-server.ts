import { createServer, type Server } from "node:http";

import type { PrometheusMetricsExporter } from "./prometheus-metrics-exporter.js";

const METRICS_SECURITY_HEADERS = Object.freeze({
  "cache-control": "no-store, max-age=0",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "x-metrics-endpoint-origin": "standalone",
});

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
      headers: { ...METRICS_SECURITY_HEADERS, allow: "GET", "content-type": "text/plain; charset=utf-8" },
      body: "Method Not Allowed",
    };
  }
  if (path !== "/metrics") {
    return {
      statusCode: 404,
      headers: { ...METRICS_SECURITY_HEADERS, "content-type": "text/plain; charset=utf-8" },
      body: "Not Found",
    };
  }
  if (exporter == null) {
    return {
      statusCode: 503,
      headers: { ...METRICS_SECURITY_HEADERS, "content-type": "text/plain; charset=utf-8" },
      body: "metrics exporter unavailable",
    };
  }
  return {
    statusCode: 200,
    headers: {
      ...METRICS_SECURITY_HEADERS,
      "content-type": "text/plain; version=0.0.4; charset=utf-8",
    },
    body: exporter.export(),
  };
}

export function createMetricsServer(exporter: PrometheusMetricsExporter | null): Server {
  return createServer((request, response) => {
    const remoteAddress = request.socket.remoteAddress ?? "";
    if (!isLoopbackAddress(remoteAddress)) {
      response.writeHead(403, {
        ...METRICS_SECURITY_HEADERS,
        "content-type": "text/plain; charset=utf-8",
      });
      response.end("Forbidden");
      return;
    }
    const payload = renderMetricsPayload(exporter, request.method, request.url);
    response.writeHead(payload.statusCode, payload.headers);
    response.end(payload.body);
  });
}

function isLoopbackAddress(address: string): boolean {
  return address === "127.0.0.1"
    || address === "::1"
    || address === "::ffff:127.0.0.1"
    || address.startsWith("::ffff:127.");
}
