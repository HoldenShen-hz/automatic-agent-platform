import assert from "node:assert/strict";
import test from "node:test";

import { buildOpenApiDocument, listApiRoutes, type ApiRouteSpec } from "../../../../../src/platform/five-plane-interface/api/openapi-document.js";

test("buildOpenApiDocument returns valid OpenAPI 3.1 document", () => {
  const doc = buildOpenApiDocument();

  assert.equal(doc.openapi, "3.1.0");
  assert.ok(doc.info);
  assert.equal(doc.info.title, "Automatic Agent API");
  assert.equal(doc.info.version, "0.1.0");
  assert.ok(doc.paths);
});

test("buildOpenApiDocument includes health endpoints", () => {
  const doc = buildOpenApiDocument();

  assert.ok(doc.paths["/healthz"]);
  assert.ok(doc.paths["/health"]);
  assert.ok(doc.paths["/healthz"].get);
  assert.equal(doc.paths["/healthz"].get.summary, "Healthz alias-free health check");
});

test("buildOpenApiDocument includes metrics endpoints", () => {
  const doc = buildOpenApiDocument();

  assert.ok(doc.paths["/metrics"]);
  assert.ok(doc.paths["/v1/metrics"]);
  assert.ok(doc.paths["/prometheus"]);
});

test("buildOpenApiDocument includes task endpoints with query parameters", () => {
  const doc = buildOpenApiDocument();

  assert.ok(doc.paths["/v1/tasks"]);
  const getTask = doc.paths["/v1/tasks"].get;
  assert.ok(getTask.parameters);
  assert.ok(getTask.parameters.length > 0);
  const limitParam = getTask.parameters.find((p: any) => p.name === "limit");
  assert.ok(limitParam);
  assert.equal(limitParam.in, "query");
});

test("buildOpenApiDocument includes domain endpoints", () => {
  const doc = buildOpenApiDocument();

  assert.ok(doc.paths["/v1/domains"]);
  assert.ok(doc.paths["/v1/domains/{domainId}"]);
});

test("buildOpenApiDocument includes plugin endpoints", () => {
  const doc = buildOpenApiDocument();

  assert.ok(doc.paths["/v1/plugins"]);
  assert.ok(doc.paths["/v1/domains/{domainId}/plugins"]);
});

test("buildOpenApiDocument includes artifact endpoints", () => {
  const doc = buildOpenApiDocument();

  assert.ok(doc.paths["/v1/artifacts/publishes"]);
  assert.ok(doc.paths["/v1/artifacts/bundles/preview"]);
  assert.ok(doc.paths["/v1/artifacts/bundles/publish"]);
});

test("buildOpenApiDocument includes approval endpoints", () => {
  const doc = buildOpenApiDocument();

  assert.ok(doc.paths["/v1/approvals"]);
  assert.ok(doc.paths["/v1/approvals/{approvalId}/decision"]);
  const decisionEndpoint = doc.paths["/v1/approvals/{approvalId}/decision"].post;
  assert.equal(decisionEndpoint.summary, "Submit approval decision");
});

test("buildOpenApiDocument includes admin endpoints", () => {
  const doc = buildOpenApiDocument();

  assert.ok(doc.paths["/v1/admin/control-plane/load-balancing"]);
  assert.ok(doc.paths["/v1/admin/inventories/benchmarks"]);
  assert.ok(doc.paths["/v1/admin/inventories/deployments"]);
  assert.ok(doc.paths["/v1/admin/governance/leadership-claims"]);
  assert.ok(doc.paths["/v1/admin/governance/leadership-claims/review-requests"]);
});

test("buildOpenApiDocument includes knowledge endpoints", () => {
  const doc = buildOpenApiDocument();

  assert.ok(doc.paths["/v1/knowledge/namespaces"]);
  assert.ok(doc.paths["/v1/knowledge/query"]);
  assert.ok(doc.paths["/v1/knowledge/graph"]);
});

test("listApiRoutes returns array of ApiRouteSpec", () => {
  const routes = listApiRoutes();

  assert.ok(Array.isArray(routes));
  assert.ok(routes.length > 0);

  const first = routes[0];
  assert.ok("method" in first);
  assert.ok("path" in first);
  assert.ok("summary" in first);
  assert.ok("tags" in first);
});

test("listApiRoutes includes GET and POST methods", () => {
  const routes = listApiRoutes();

  const methods = new Set(routes.map((r) => r.method));
  assert.ok(methods.has("GET"));
  assert.ok(methods.has("POST"));
});

test("listApiRoutes routes have valid tags", () => {
  const routes = listApiRoutes();

  for (const route of routes) {
    assert.ok(Array.isArray(route.tags));
    assert.ok(route.tags.length > 0);
    for (const tag of route.tags) {
      assert.equal(typeof tag, "string");
    }
  }
});

test("listApiRoutes returns distinct routes", () => {
  const routes = listApiRoutes();
  const routeKeys = routes.map((r) => `${r.method} ${r.path}`);
  const uniqueRouteKeys = new Set(routeKeys);
  assert.equal(routeKeys.length, uniqueRouteKeys.size);
});

test("buildOpenApiDocument responses have 200 status", () => {
  const doc = buildOpenApiDocument();

  for (const [path, methods] of Object.entries(doc.paths)) {
    const methodObj = methods as Record<string, unknown>;
    for (const [method, spec] of Object.entries(methodObj)) {
      if (method === "get" || method === "post" || method === "put" || method === "delete") {
        const responses = (spec as any).responses;
        assert.ok(responses["200"], `Missing 200 response for ${method.toUpperCase()} ${path}`);
      }
    }
  }
});
