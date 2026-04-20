import assert from "node:assert/strict";
import test from "node:test";

import { renderMetricsPayload } from "../../../../../src/platform/shared/observability/metrics-server.js";
import type { PrometheusMetricsExporter } from "../../../../../src/platform/shared/observability/prometheus-metrics-exporter.js";

test("renderMetricsPayload returns exporter output for GET /metrics", () => {
  const payload = renderMetricsPayload(
    { export: () => "aa_requests_total 1\n" } as unknown as PrometheusMetricsExporter,
    "GET",
    "/metrics",
  );
  assert.equal(payload.statusCode, 200);
  assert.match(payload.headers["content-type"] ?? "", /text\/plain/);
  assert.match(payload.body, /aa_requests_total 1/);
});

test("renderMetricsPayload rejects unsupported methods", () => {
  const payload = renderMetricsPayload(null, "POST", "/metrics");
  assert.equal(payload.statusCode, 405);
  assert.equal(payload.headers.allow, "GET");
});

test("renderMetricsPayload returns 404 outside metrics path", () => {
  const payload = renderMetricsPayload(null, "GET", "/healthz");
  assert.equal(payload.statusCode, 404);
});
