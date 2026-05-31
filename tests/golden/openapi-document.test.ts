/**
 * Golden Test: OpenAPI Document Output
 *
 * Verifies OpenAPI document generation produces expected structure
 * and all required routes are exposed.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { buildOpenApiDocument, listApiRoutes } from "../../src/platform/five-plane-interface/api/openapi-document.js";
import { assertGolden } from "../helpers/golden.js";

test("golden: OpenAPI document has correct top-level structure", () => {
  const document = buildOpenApiDocument() as {
    openapi: string;
    info: { title: string; version: string };
    paths: Record<string, Record<string, unknown>>;
  };

  // Verify top-level structure
  assert.equal(document.openapi, "3.1.0", "OpenAPI version should be 3.1.0");
  assert.equal(document.info.title, "Automatic Agent API", "API title should be set");
  assert.equal(document.info.version, "0.1.0", "API version should be 0.1.0");
  assert.ok(document.paths, "Paths object should exist");
  assert.ok(Object.keys(document.paths).length > 0, "Should have at least one path");
  assertGolden("openapi-document-top-level", {
    openapi: document.openapi,
    info: document.info,
    pathKeys: Object.keys(document.paths).sort(),
  });
});

test("golden: OpenAPI document has health check endpoints", () => {
  const document = buildOpenApiDocument() as { paths: Record<string, Record<string, unknown>> };

  // Verify health endpoints exist
  assert.ok(document.paths["/healthz"], "/healthz endpoint should exist");
  assert.ok(document.paths["/health"], "/health endpoint should exist");
  assert.ok(document.paths["/healthz"].get, "/healthz should support GET");
  assert.ok(document.paths["/health"].get, "/health should support GET");
});

test("golden: OpenAPI document has API meta endpoint", () => {
  const document = buildOpenApiDocument() as { paths: Record<string, Record<string, unknown>> };

  assert.ok(document.paths["/v1/openapi.json"], "/v1/openapi.json endpoint should exist");
  assert.ok(document.paths["/v1/openapi.json"].get, "/v1/openapi.json should support GET");
});

test("golden: OpenAPI document has auth endpoints", () => {
  const document = buildOpenApiDocument() as { paths: Record<string, Record<string, unknown>> };

  assert.ok(document.paths["/v1/auth/token"], "/v1/auth/token endpoint should exist");
  assert.ok(document.paths["/v1/auth/token"].post, "/v1/auth/token should support POST");
});

test("golden: OpenAPI document has task endpoints", () => {
  const document = buildOpenApiDocument() as { paths: Record<string, Record<string, { parameters?: Array<{ name: string }> }>> };

  // Verify task endpoints exist
  assert.ok(document.paths["/v1/tasks"], "/v1/tasks endpoint should exist");
  assert.ok(document.paths["/v1/tasks"].get, "/v1/tasks should support GET");
  assert.deepEqual(
    document.paths["/v1/tasks"].get.parameters?.map((parameter) => parameter.name),
    ["limit", "cursor"],
  );

  assert.ok(document.paths["/v1/tasks/{taskId}"], "/v1/tasks/{taskId} endpoint should exist");
  assert.ok(document.paths["/v1/tasks/{taskId}"].get, "/v1/tasks/{taskId} should support GET");

  assert.ok(document.paths["/v1/tasks/{taskId}/events"], "/v1/tasks/{taskId}/events endpoint should exist");
  assert.ok(document.paths["/v1/tasks/{taskId}/inspect"], "/v1/tasks/{taskId}/inspect endpoint should exist");
  assert.ok(document.paths["/v1/workflows"], "/v1/workflows endpoint should exist");
  assert.deepEqual(
    document.paths["/v1/workflows"]?.get?.parameters?.map((parameter) => parameter.name),
    ["limit", "cursor"],
  );
});

test("golden: OpenAPI document has approval endpoints", () => {
  const document = buildOpenApiDocument() as { paths: Record<string, Record<string, unknown>> };

  assert.ok(document.paths["/v1/approvals"], "/v1/approvals endpoint should exist");
  assert.ok(document.paths["/v1/approvals"].get, "/v1/approvals should support GET");

  assert.ok(document.paths["/v1/approvals/{approvalId}/decision"], "/v1/approvals/{approvalId}/decision should exist");
  assert.ok(document.paths["/v1/approvals/{approvalId}/decision"].post, "Approval decision should be POST");
});

test("golden: OpenAPI document has gateway endpoints", () => {
  const document = buildOpenApiDocument() as { paths: Record<string, Record<string, unknown>> };

  assert.ok(document.paths["/v1/gateway/targets"], "/v1/gateway/targets should exist");
  assert.ok(document.paths["/v1/gateway/targets"].get, "/v1/gateway/targets should be GET");

  assert.ok(document.paths["/v1/gateway/targets/resolve"], "/v1/gateway/targets/resolve should exist");
  assert.ok(document.paths["/v1/gateway/targets/resolve"].get, "/v1/gateway/targets/resolve should be GET");

  assert.ok(document.paths["/v1/gateway/messages/send"], "/v1/gateway/messages/send should exist");
  assert.ok(document.paths["/v1/gateway/messages/send"].post, "/v1/gateway/messages/send should be POST");
});

test("golden: OpenAPI document has division endpoints", () => {
  const document = buildOpenApiDocument() as { paths: Record<string, Record<string, unknown>> };

  assert.ok(document.paths["/v1/divisions"], "/v1/divisions endpoint should exist");
  assert.ok(document.paths["/v1/divisions"].get, "/v1/divisions should support GET");
});

test("golden: OpenAPI document has dashboard endpoint", () => {
  const document = buildOpenApiDocument() as { paths: Record<string, Record<string, unknown>> };

  assert.ok(document.paths["/v1/dashboard/snapshot"], "/v1/dashboard/snapshot should exist");
  assert.ok(document.paths["/v1/dashboard/snapshot"].get, "/v1/dashboard/snapshot should be GET");
  assert.ok(document.paths["/v1/workbench/snapshot"], "/v1/workbench/snapshot should exist");
  assert.ok(document.paths["/v1/workbench/snapshot"].get, "/v1/workbench/snapshot should be GET");
  assert.ok(document.paths["/v1/webhooks/{endpointId}/receive"], "/v1/webhooks/{endpointId}/receive should exist");
  assert.ok(document.paths["/v1/webhooks/{endpointId}/receive"].post, "/v1/webhooks/{endpointId}/receive should be POST");
});

test("golden: OpenAPI document has artifact ledger endpoint", () => {
  const document = buildOpenApiDocument() as { paths: Record<string, Record<string, unknown>> };

  assert.ok(document.paths["/v1/artifacts/publishes"], "/v1/artifacts/publishes should exist");
  assert.ok(document.paths["/v1/artifacts/publishes"].get, "/v1/artifacts/publishes should be GET");
});

test("golden: OpenAPI document has knowledge graph endpoint", () => {
  const document = buildOpenApiDocument() as { paths: Record<string, Record<string, unknown>> };

  assert.ok(document.paths["/v1/knowledge/graph"], "/v1/knowledge/graph should exist");
  assert.ok(document.paths["/v1/knowledge/graph"].get, "/v1/knowledge/graph should be GET");
  assert.ok(document.paths["/v1/knowledge/semantic/inspect"], "/v1/knowledge/semantic/inspect should exist");
  assert.ok(document.paths["/v1/knowledge/semantic/inspect"].get, "/v1/knowledge/semantic/inspect should be GET");
});

test("golden: OpenAPI document has admin control plane endpoints", () => {
  const document = buildOpenApiDocument() as { paths: Record<string, Record<string, unknown>> };

  assert.ok(document.paths["/v1/admin/control-plane/load-balancing"], "Admin load-balancing endpoint should exist");
  assert.ok(document.paths["/v1/admin/control-plane/load-balancing"].get, "Should be GET");

  assert.ok(document.paths["/v1/admin/control-plane/load-balancing/select"], "Admin select endpoint should exist");
  assert.ok(document.paths["/v1/admin/control-plane/load-balancing/select"].post, "Should be POST");
  assert.ok(document.paths["/v1/admin/inventories/benchmarks"], "Benchmark inventory endpoint should exist");
  assert.ok(document.paths["/v1/admin/inventories/projections"], "Projection inventory endpoint should exist");
  assert.ok(document.paths["/v1/admin/inventories/deployments"], "Deployment inventory endpoint should exist");
  assert.ok(document.paths["/v1/admin/inventories/schema"], "Schema inventory endpoint should exist");
  assert.ok(document.paths["/v1/admin/judges"], "Judge registry endpoint should exist");
  assert.ok(document.paths["/v1/admin/compliance/program-templates"], "Compliance template endpoint should exist");
});

test("golden: listApiRoutes returns all routes", () => {
  const routes = listApiRoutes();

  // Should have all the routes we expect
  assert.ok(routes.length >= 40, "Should have at least 40 routes defined");
  assertGolden("openapi-route-list", routes);

  const pathMethods = routes.map((r) => `${r.method}:${r.path}`);

  // Verify key routes are present
  assert.ok(pathMethods.includes("GET:/healthz"), "Should have GET /healthz");
  assert.ok(pathMethods.includes("GET:/v1/openapi.json"), "Should have GET /v1/openapi.json");
  assert.ok(pathMethods.includes("POST:/v1/auth/token"), "Should have POST /v1/auth/token");
  assert.ok(pathMethods.includes("POST:/v1/webhooks/{endpointId}/receive"), "Should have POST webhook receive");
  assert.ok(pathMethods.includes("GET:/v1/tasks"), "Should have GET /v1/tasks");
  assert.ok(pathMethods.includes("GET:/v1/tasks/{taskId}"), "Should have GET /v1/tasks/{taskId}");
  assert.ok(pathMethods.includes("POST:/v1/approvals/{approvalId}/decision"), "Should have POST approval decision");
  assert.ok(pathMethods.includes("GET:/v1/workbench/snapshot"), "Should have GET /v1/workbench/snapshot");
  assert.ok(pathMethods.includes("GET:/v1/admin/judges"), "Should have GET /v1/admin/judges");
});

test("golden: all routes have required fields", () => {
  const routes = listApiRoutes();

  for (const route of routes) {
    assert.ok(
      route.method === "GET" || route.method === "POST" || route.method === "PATCH" || route.method === "DELETE",
      `Route ${route.path} should have valid method`,
    );
    assert.ok(route.path.startsWith("/"), `Route path should start with /`);
    assert.ok(route.summary.length > 0, `Route ${route.path} should have a summary`);
    assert.ok(Array.isArray(route.tags), `Route ${route.path} should have tags array`);
    assert.ok(route.tags.length > 0, `Route ${route.path} should have at least one tag`);
  }
});

test("golden: route tags are from allowed set", () => {
  const routes = listApiRoutes();
  const allowedTags = new Set([
    "health",
    "meta",
    "metrics",
    "auth",
    "dashboard",
    "divisions",
    "gateway",
    "tasks",
    "approvals",
    "admin",
    "knowledge",
    "domains",
    "plugins",
    "artifacts",
    "webhooks",
    "missions",
    "yono",
    "packs",
    "explainability",
  ]);

  for (const route of routes) {
    for (const tag of route.tags) {
      assert.ok(allowedTags.has(tag), `Route ${route.path} has unexpected tag: ${tag}`);
    }
  }
});

test("golden: each path in document has valid response structure", () => {
  const document = buildOpenApiDocument() as {
    paths: Record<string, Record<string, { responses?: Record<string, unknown> }>>;
  };

  for (const [path, methods] of Object.entries(document.paths)) {
    for (const [method, spec] of Object.entries(methods)) {
      assert.ok(spec.responses, `${method.toUpperCase()} ${path} should have responses`);
      assert.ok(spec.responses["200"], `${method.toUpperCase()} ${path} should have 200 response defined`);
    }
  }
});
