/**
 * Contract Test: API OpenAPI Contract
 *
 * Verifies the API surface matches the OpenAPI specification contract.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { buildOpenApiDocument, listApiRoutes } from "../../../../src/platform/five-plane-interface/api/openapi-document.js";

test("contract: OpenAPI document has required version field", () => {
  const document = buildOpenApiDocument() as Record<string, unknown>;

  assert.ok(document.openapi, "Document should have openapi field");
  assert.equal(document.openapi, "3.1.0", "OpenAPI version should be 3.1.0");
});

test("contract: OpenAPI document has info object with title and version", () => {
  const document = buildOpenApiDocument() as { info: { title: string; version: string } };

  assert.ok(document.info, "Document should have info object");
  assert.ok(document.info.title.length > 0, "API title should not be empty");
  assert.ok(document.info.version.length > 0, "API version should not be empty");
});

test("contract: OpenAPI document has paths object", () => {
  const document = buildOpenApiDocument() as { paths: Record<string, unknown> };

  assert.ok(document.paths, "Document should have paths object");
  assert.ok(Object.keys(document.paths).length > 0, "Paths should not be empty");
});

test("contract: all listed routes exist in OpenAPI document", () => {
  const routes = listApiRoutes();
  const document = buildOpenApiDocument() as { paths: Record<string, Record<string, unknown>> };

  for (const route of routes) {
    assert.ok(
      document.paths[route.path],
      `Route ${route.path} should exist in OpenAPI document`,
    );
    assert.ok(
      document.paths[route.path]![route.method.toLowerCase()],
      `Method ${route.method} for ${route.path} should exist`,
    );
  }
});

test("contract: each path has at least one valid HTTP method", () => {
  const document = buildOpenApiDocument() as { paths: Record<string, Record<string, unknown>> };

  for (const [path, methods] of Object.entries(document.paths)) {
    const methodKeys = Object.keys(methods).filter((k) => k !== "parameters");
    assert.ok(methodKeys.length > 0, `Path ${path} should have at least one HTTP method`);
    for (const method of methodKeys) {
      assert.ok(
        ["get", "post", "put", "delete", "patch"].includes(method.toLowerCase()),
        `Method ${method} for ${path} should be a valid HTTP method`,
      );
    }
  }
});

test("contract: each method has a summary", () => {
  const document = buildOpenApiDocument() as { paths: Record<string, Record<string, { summary?: string }>> };

  for (const [path, methods] of Object.entries(document.paths)) {
    for (const [method, spec] of Object.entries(methods)) {
      if (["get", "post", "put", "delete", "patch"].includes(method.toLowerCase())) {
        assert.ok(
          spec.summary && spec.summary.length > 0,
          `Method ${method} for ${path} should have a summary`,
        );
      }
    }
  }
});

test("contract: each method has response definitions", () => {
  const document = buildOpenApiDocument() as { paths: Record<string, Record<string, { responses?: Record<string, unknown> }>> };

  for (const [path, methods] of Object.entries(document.paths)) {
    for (const [method, spec] of Object.entries(methods)) {
      if (["get", "post", "put", "delete", "patch"].includes(method.toLowerCase())) {
        assert.ok(
          spec.responses,
          `Method ${method} for ${path} should have responses`,
        );
        assert.ok(
          spec.responses["200"],
          `Method ${method} for ${path} should have 200 response defined`,
        );
      }
    }
  }
});

test("contract: routes list matches paths in document", () => {
  const routes = listApiRoutes();
  const document = buildOpenApiDocument() as { paths: Record<string, unknown> };

  const routePaths = new Set(routes.map((r) => r.path));
  const documentPaths = new Set(Object.keys(document.paths));

  // Every route should exist in document
  for (const routePath of routePaths) {
    assert.ok(
      documentPaths.has(routePath),
      `Route path ${routePath} should exist in document`,
    );
  }

  // Every document path should have at least one route
  for (const docPath of documentPaths) {
    assert.ok(
      routePaths.has(docPath),
      `Document path ${docPath} should have a corresponding route`,
    );
  }
});

test("contract: listApiRoutes returns unique routes", () => {
  const routes = listApiRoutes();
  const seen = new Set<string>();

  for (const route of routes) {
    const key = `${route.method}:${route.path}`;
    assert.ok(
      !seen.has(key),
      `Duplicate route found: ${key}`,
    );
    seen.add(key);
  }
});

test("contract: all routes have required fields", () => {
  const routes = listApiRoutes();

  for (const route of routes) {
    assert.ok(
      ["GET", "POST", "PATCH", "DELETE"].includes(route.method),
      `Route ${route.path} should have a supported HTTP method`,
    );
    assert.ok(
      route.path.startsWith("/"),
      `Route path ${route.path} should start with /`,
    );
    assert.ok(
      route.summary.length > 0,
      `Route ${route.path} should have a summary`,
    );
    assert.ok(
      Array.isArray(route.tags) && route.tags.length > 0,
      `Route ${route.path} should have at least one tag`,
    );
  }
});
