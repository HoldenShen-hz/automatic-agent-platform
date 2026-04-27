/**
 * Golden Test: API Dashboard Snapshot Structure
 *
 * Verifies dashboard snapshot API produces consistent response structure
 * for workbench snapshots and related endpoints.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { buildOpenApiDocument } from "../../src/platform/interface/api/openapi-document.js";

test("golden: API dashboard snapshot endpoint structure", () => {
  const document = buildOpenApiDocument() as { paths: Record<string, Record<string, unknown>> };

  // Verify dashboard snapshot endpoints exist
  assert.ok(document.paths["/v1/dashboard/snapshot"], "/v1/dashboard/snapshot should exist");
  assert.ok(document.paths["/v1/workbench/snapshot"], "/v1/workbench/snapshot should exist");

  const dashSnapshot = document.paths["/v1/dashboard/snapshot"];
  const workbenchSnapshot = document.paths["/v1/workbench/snapshot"];

  assert.ok(dashSnapshot.get, "Dashboard snapshot should be GET");
  assert.ok(workbenchSnapshot.get, "Workbench snapshot should be GET");

  // Both should have 200 responses
  assert.ok(dashSnapshot.get.responses?.["200"], "Dashboard should have 200 response");
  assert.ok(workbenchSnapshot.get.responses?.["200"], "Workbench should have 200 response");
});

test("golden: API dashboard snapshot response content type", () => {
  const document = buildOpenApiDocument() as {
    paths: Record<string, Record<string, { responses?: Record<string, { content?: Record<string, unknown> }> }>>;
  };

  const dashSnapshot = document.paths["/v1/dashboard/snapshot"];
  const responses = dashSnapshot.get.responses;
  const response200 = responses?.["200"];

  assert.ok(response200, "Should have 200 response");
  assert.ok(response200.content, "Should have content");
  assert.ok(response200.content["application/json"], "Should have JSON content type");
});

test("golden: API routes have consistent response structure", () => {
  const document = buildOpenApiDocument() as {
    paths: Record<string, Record<string, { responses?: Record<string, unknown> }>>;
  };

  // All paths should have responses
  for (const [path, methods] of Object.entries(document.paths)) {
    for (const [method, spec] of Object.entries(methods)) {
      assert.ok(
        spec.responses,
        `${method.toUpperCase()} ${path} should have responses defined`,
      );
    }
  }
});

test("golden: API OpenAPI document info section", () => {
  const document = buildOpenApiDocument() as {
    openapi: string;
    info: { title: string; version: string; description?: string };
  };

  assert.equal(document.openapi, "3.1.0", "OpenAPI version should be 3.1.0");
  assert.ok(document.info.title.length > 0, "Title should not be empty");
  assert.ok(document.info.version.length > 0, "Version should not be empty");
});

test("golden: API routes have valid tags", () => {
  const document = buildOpenApiDocument() as {
    paths: Record<string, Record<string, { tags?: string[] }>>;
  };

  const allowedTags = new Set([
    "health", "meta", "metrics", "auth", "dashboard", "divisions",
    "gateway", "tasks", "approvals", "admin", "knowledge", "domains",
    "plugins", "artifacts", "webhooks",
  ]);

  for (const [path, methods] of Object.entries(document.paths)) {
    for (const [method, spec] of Object.entries(methods)) {
      if (spec.tags) {
        for (const tag of spec.tags) {
          assert.ok(
            allowedTags.has(tag),
            `Route ${method.toUpperCase()} ${path} has invalid tag: ${tag}`,
          );
        }
      }
    }
  }
});
