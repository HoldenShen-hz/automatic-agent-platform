import assert from "node:assert/strict";
import test from "node:test";

import { createMetricsRoutes } from "../../../../../../src/platform/five-plane-interface/api/http-server/metrics-routes.js";
import type { PrometheusMetricsExporter } from "../../../../../../src/platform/shared/observability/prometheus-metrics-exporter.js";
import type { RouteContext } from "../../../../../../src/platform/five-plane-interface/api/http-server/types.js";

function createMockMetricsExporter(metrics = "# HELP test\nexport_test 1\n"): PrometheusMetricsExporter {
  return {
    export: () => metrics,
  } as unknown as PrometheusMetricsExporter;
}

function createMockContext(): RouteContext {
  return {
    requestId: "req-metrics",
    request: {} as never,
    route: { pathname: "/", segments: [] },
    principal: null,
  };
}

test("createMetricsRoutes returns versioned metrics and prometheus endpoints", () => {
  const routes = createMetricsRoutes({ prometheusMetricsExporter: createMockMetricsExporter() });
  assert.deepEqual(routes.map((route) => route.pathname), ["/v1/metrics", "/prometheus"]);
});

test("GET /prometheus returns metrics when exporter is configured", async () => {
  const routes = createMetricsRoutes({
    prometheusMetricsExporter: createMockMetricsExporter("# HELP api_requests_total api requests\napi_requests_total 100\n"),
  });
  const route = routes.find((candidate) => candidate.pathname === "/prometheus");
  assert.ok(route);
  const response = await route.handler(createMockContext());
  if (!response) {
    throw new Error("expected response");
  }
  assert.equal(response.statusCode, 200);
  assert.match(response.body, /api_requests_total 100/);
});

test("metrics routes fail closed without exporter", async () => {
  const routes = createMetricsRoutes({ prometheusMetricsExporter: null });
  const route = routes.find((candidate) => candidate.pathname === "/v1/metrics");
  assert.ok(route);
  await assert.rejects(async () => {
    await route.handler(createMockContext());
  }, /Prometheus metrics exporter is not configured/);
});
