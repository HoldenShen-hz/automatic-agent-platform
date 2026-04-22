/**
 * Golden Test: API Response Structure Snapshots
 *
 * Verifies API response structures match expected patterns for
 * health endpoints, dashboard snapshots, and other API responses.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { buildOpenApiDocument, listApiRoutes } from "../../src/platform/interface/api/openapi-document.js";
import { assertGolden } from "../helpers/golden.js";
import { HealthService } from "../../src/platform/shared/observability/health-service.js";
import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { newId } from "../../src/platform/contracts/types/ids.js";
import { seedTaskAndExecution } from "../helpers/seed.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";

test("golden: health report has expected structure", () => {
  const workspace = createTempWorkspace("aa-golden-health-");

  const dbPath = `${workspace}/health.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  const healthService = new HealthService(db, store);
  const health = healthService.getReport();

  // Verify health report structure
  assert.ok(health, "Health report should exist");
  assert.ok(typeof health.status === "string", "Should have status");
  assert.ok(["ok", "degraded", "overloaded", "unhealthy"].includes(health.status), "Status should be valid");
  assert.ok(typeof health.uptimeSeconds === "number", "Should have uptimeSeconds");
  assert.ok(Array.isArray(health.findings), "Should have findings array");

  assertGolden("api-health-report", {
    status: health.status,
    uptimeSeconds: health.uptimeSeconds,
    findingCount: health.findings.length,
    dbWritable: health.dbWritable,
    providerHealth: health.providerHealth,
    activeExecutions: health.activeExecutions,
    queuedTasks: health.queuedTasks,
    degradationMode: health.degradationMode,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: OpenAPI document top-level structure matches snapshot", () => {
  const document = buildOpenApiDocument() as {
    openapi: string;
    info: { title: string; version: string };
    paths: Record<string, unknown>;
  };

  assertGolden("api-openapi-document-structure", {
    openapi: document.openapi,
    info: {
      title: document.info.title,
      version: document.info.version,
    },
    pathCount: Object.keys(document.paths).length,
    pathKeys: Object.keys(document.paths).sort(),
  });
});

test("golden: API routes list structure matches snapshot", () => {
  const routes = listApiRoutes();

  // Verify routes structure
  assert.ok(routes.length > 0, "Should have routes");
  assert.ok(routes.every((r) => r.method && r.path && r.summary && Array.isArray(r.tags)));

  const routeMethods = routes.map((r) => `${r.method}:${r.path}`).sort();

  assertGolden("api-routes-list", {
    totalRoutes: routes.length,
    routes: routeMethods.slice(0, 20), // First 20 routes
  });
});

test("golden: health check endpoint response structure", () => {
  const workspace = createTempWorkspace("aa-golden-health-check-");

  const dbPath = `${workspace}/health-check.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  // Create a task so there's some data
  const taskId = newId("task");
  const executionId = newId("exec");
  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "health-trace" });

  const healthService = new HealthService(db, store);
  const health = healthService.getReport();

  // Verify health endpoint response has required fields
  assert.ok(health.status, "Should have status field");
  assert.ok(typeof health.uptimeSeconds === "number", "Should have uptimeSeconds");

  // Response should be JSON-serializable
  const jsonOutput = JSON.stringify(health);
  assert.ok(jsonOutput.length > 0, "Should be JSON serializable");

  assertGolden("api-health-check-response", {
    isValid: true,
    hasStatus: "status" in health,
    hasUptimeSeconds: "uptimeSeconds" in health,
    statusValue: health.status,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: API routes have valid method and path structure", () => {
  const routes = listApiRoutes();

  // Verify all routes have valid methods
  const validMethods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
  for (const route of routes) {
    assert.ok(
      validMethods.includes(route.method),
      `Route ${route.path} should have valid HTTP method`,
    );
    assert.ok(
      route.path.startsWith("/"),
      `Route path ${route.path} should start with /`,
    );
    assert.ok(
      route.summary.length > 0,
      `Route ${route.path} should have a summary`,
    );
  }

  const routePaths = routes.map((r) => r.path).sort();
  assertGolden("api-routes-valid-structure", {
    totalRoutes: routes.length,
    uniquePaths: [...new Set(routePaths)].length,
  });
});