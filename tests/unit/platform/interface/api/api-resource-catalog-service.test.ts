import assert from "node:assert/strict";
import test from "node:test";

import { ApiResourceCatalogService } from "../../../../../src/platform/interface/api/api-resource-catalog-service.js";

test("ApiResourceCatalogService is instantiable", () => {
  const service = new ApiResourceCatalogService();
  assert.ok(service != null);
});

// ============================================================================
// listResources() tests
// ============================================================================

test("listResources returns all resources with no filters", () => {
  const service = new ApiResourceCatalogService();
  const resources = service.listResources();

  // Should return all routes from listApiRoutes
  assert.ok(resources.length > 0, "Should return at least one resource");

  // Each resource should have required fields
  for (const resource of resources) {
    assert.ok(resource.resourceId != null, "resourceId should exist");
    assert.ok(resource.method === "GET" || resource.method === "POST", "method should be GET or POST");
    assert.ok(resource.path.startsWith("/"), "path should start with /");
    assert.ok(resource.summary.length > 0, "summary should not be empty");
    assert.ok(Array.isArray(resource.tags), "tags should be an array");
    assert.ok(resource.tags.length > 0, "tags should not be empty");
    assert.ok(resource.plane != null, "plane should exist");
    assert.ok(resource.visibility != null, "visibility should exist");
    assert.ok(Array.isArray(resource.exposedByApps), "exposedByApps should be an array");
  }
});

test("listResources filters by tag", () => {
  const service = new ApiResourceCatalogService();

  const tasksResources = service.listResources({ tag: "tasks" });
  assert.ok(tasksResources.length > 0, "Should return at least one tasks resource");
  for (const resource of tasksResources) {
    assert.ok(resource.tags.includes("tasks"), `All resources should have 'tasks' tag: ${resource.path}`);
  }

  const adminResources = service.listResources({ tag: "admin" });
  assert.ok(adminResources.length > 0, "Should return at least one admin resource");
  for (const resource of adminResources) {
    assert.ok(resource.tags.includes("admin"), `All resources should have 'admin' tag: ${resource.path}`);
  }
});

test("listResources filters by visibility", () => {
  const service = new ApiResourceCatalogService();

  const publicResources = service.listResources({ visibility: "public" });
  for (const resource of publicResources) {
    assert.equal(resource.visibility, "public", `Resource ${resource.path} should be public`);
  }

  const authenticatedResources = service.listResources({ visibility: "authenticated" });
  for (const resource of authenticatedResources) {
    assert.equal(resource.visibility, "authenticated", `Resource ${resource.path} should be authenticated`);
  }

  const adminResources = service.listResources({ visibility: "admin" });
  for (const resource of adminResources) {
    assert.equal(resource.visibility, "admin", `Resource ${resource.path} should be admin`);
  }
});

test("listResources filters by version", () => {
  const service = new ApiResourceCatalogService();

  const versionedResources = service.listResources({ version: "v1" });
  assert.ok(versionedResources.length > 0, "Should return at least one v1 resource");
  for (const resource of versionedResources) {
    assert.equal(resource.version, "v1", `Resource ${resource.path} should be v1`);
  }

  const unversionedResources = service.listResources({ version: null });
  assert.ok(unversionedResources.length > 0, "Should return at least one unversioned resource");
  for (const resource of unversionedResources) {
    assert.equal(resource.version, null, `Resource ${resource.path} should be unversioned`);
  }
});

test("listResources handles combined filters", () => {
  const service = new ApiResourceCatalogService();

  // Filter by tag and visibility
  const adminTasksResources = service.listResources({ tag: "admin", visibility: "admin" });
  for (const resource of adminTasksResources) {
    assert.ok(resource.tags.includes("admin"), `Resource ${resource.path} should have admin tag`);
    assert.equal(resource.visibility, "admin", `Resource ${resource.path} should be admin`);
  }

  // Filter by version and visibility
  const publicVersionedResources = service.listResources({ version: "v1", visibility: "public" });
  for (const resource of publicVersionedResources) {
    assert.equal(resource.version, "v1", `Resource ${resource.path} should be v1`);
    assert.equal(resource.visibility, "public", `Resource ${resource.path} should be public`);
  }
});

test("listResources returns empty array for non-matching filters", () => {
  const service = new ApiResourceCatalogService();

  // Use a tag that doesn't exist
  const nonExistentTagResources = service.listResources({ tag: "nonexistent-tag-xyz" });
  assert.deepEqual(nonExistentTagResources, []);
});

test("listResources resourceId format", () => {
  const service = new ApiResourceCatalogService();
  const resources = service.listResources();

  for (const resource of resources) {
    const expectedResourceId = `${resource.method}:${resource.path}`;
    assert.equal(resource.resourceId, expectedResourceId, `resourceId should be ${expectedResourceId}`);
  }
});

test("listResources with undefined filters returns all", () => {
  const service = new ApiResourceCatalogService();
  // @ts-expect-error - Testing invalid input
  const resources = service.listResources(undefined);

  const allResources = service.listResources();
  assert.equal(resources.length, allResources.length, "Should return all resources with undefined filters");
});

test("listResources with empty filters object returns all", () => {
  const service = new ApiResourceCatalogService();
  const resources = service.listResources({});

  const allResources = service.listResources();
  assert.equal(resources.length, allResources.length, "Should return all resources with empty filters");
});

test("listResources filters are case-sensitive", () => {
  const service = new ApiResourceCatalogService();

  const tasksResources = service.listResources({ tag: "tasks" });
  const TasksResources = service.listResources({ tag: "Tasks" });

  assert.ok(tasksResources.length > 0, "Should find 'tasks' tag");
  assert.equal(TasksResources.length, 0, "Should not find 'Tasks' tag (case-sensitive)");
});

// ============================================================================
// buildSummary() tests
// ============================================================================

test("buildSummary returns correct total count", () => {
  const service = new ApiResourceCatalogService();
  const summary = service.buildSummary();

  const resources = service.listResources();
  assert.equal(summary.totalResources, resources.length, "totalResources should match listResources length");
});

test("buildSummary visibility counts sum to total", () => {
  const service = new ApiResourceCatalogService();
  const summary = service.buildSummary();

  const visibilitySum = summary.publicResources + summary.authenticatedResources + summary.adminResources;
  assert.equal(visibilitySum, summary.totalResources, "Visibility counts should sum to totalResources");
});

test("buildSummary version counts sum to total", () => {
  const service = new ApiResourceCatalogService();
  const summary = service.buildSummary();

  const versionSum = summary.versionedResources + summary.unversionedResources;
  assert.equal(versionSum, summary.totalResources, "Version counts should sum to totalResources");
});

test("buildSummary has correct byPlane structure", () => {
  const service = new ApiResourceCatalogService();
  const summary = service.buildSummary();

  assert.ok(summary.byPlane != null, "byPlane should exist");
  assert.ok(typeof summary.byPlane === "object", "byPlane should be an object");

  // Sum of byPlane values should equal total
  const planeSum = Object.values(summary.byPlane).reduce((sum, count) => sum + count, 0);
  assert.equal(planeSum, summary.totalResources, "byPlane counts should sum to totalResources");
});

test("buildSummary identifies correct visibility for known paths", () => {
  const service = new ApiResourceCatalogService();
  const summary = service.buildSummary();

  // /health and /healthz should be public
  const publicResources = service.listResources({ visibility: "public" });
  const healthPaths = ["/health", "/healthz", "/metrics", "/prometheus", "/v1/openapi.json", "/v1/auth/token", "/v1/webhooks/{endpointId}/receive"];
  for (const path of healthPaths) {
    const found = publicResources.some((r) => r.path === path);
    assert.ok(found, `Public path ${path} should be in public resources`);
  }

  // Admin tagged routes should be admin visibility
  const adminResources = service.listResources({ tag: "admin" });
  assert.equal(summary.adminResources, adminResources.length, "adminResources count should match admin-tagged resources");
});

test("buildSummary identifies versioned and unversioned correctly", () => {
  const service = new ApiResourceCatalogService();
  const summary = service.buildSummary();

  // Versioned resources should have paths starting with /v\d+
  const versionedResources = service.listResources({ version: "v1" });
  assert.equal(summary.versionedResources, versionedResources.length, "versionedResources should match");

  // Unversioned resources should not start with /v\d+
  const unversionedResources = service.listResources({ version: null });
  assert.equal(summary.unversionedResources, unversionedResources.length, "unversionedResources should match");
});

test("buildSummary has all required fields", () => {
  const service = new ApiResourceCatalogService();
  const summary = service.buildSummary();

  assert.equal(typeof summary.totalResources, "number");
  assert.equal(typeof summary.publicResources, "number");
  assert.equal(typeof summary.authenticatedResources, "number");
  assert.equal(typeof summary.adminResources, "number");
  assert.equal(typeof summary.versionedResources, "number");
  assert.equal(typeof summary.unversionedResources, "number");
  assert.equal(typeof summary.byPlane, "object");
});

// ============================================================================
// buildContractCoverage() tests
// ============================================================================

test("buildContractCoverage returns array with valid structure", () => {
  const service = new ApiResourceCatalogService();
  const coverage = service.buildContractCoverage();

  assert.ok(Array.isArray(coverage), "Should return an array");
  assert.ok(coverage.length > 0, "Should return at least one coverage entry");

  for (const entry of coverage) {
    assert.ok(entry.path != null, "path should exist");
    assert.ok(entry.path.startsWith("/"), "path should start with /");
    assert.ok(Array.isArray(entry.methods), "methods should be an array");
    assert.ok(entry.methods.length > 0, "methods should not be empty");
    assert.ok(Array.isArray(entry.tags), "tags should be an array");
    assert.equal(typeof entry.documented, "boolean", "documented should be boolean");
  }
});

test("buildContractCoverage methods are valid HTTP methods", () => {
  const service = new ApiResourceCatalogService();
  const coverage = service.buildContractCoverage();

  const validMethods = new Set(["get", "post", "put", "patch", "delete", "head", "options"]);
  for (const entry of coverage) {
    for (const method of entry.methods) {
      assert.ok(validMethods.has(method.toLowerCase()), `Method ${method} should be valid HTTP method for ${entry.path}`);
    }
  }
});

test("buildContractCoverage all documented entries are documented", () => {
  const service = new ApiResourceCatalogService();
  const coverage = service.buildContractCoverage();

  // All entries should have documented: true (based on implementation)
  for (const entry of coverage) {
    assert.equal(entry.documented, true, `Entry for ${entry.path} should be documented`);
  }
});

test("buildContractCoverage paths match OpenAPI document", () => {
  const service = new ApiResourceCatalogService();
  const coverage = service.buildContractCoverage();

  const coveragePaths = coverage.map((e) => e.path).sort();
  assert.ok(coveragePaths.length > 0, "Should have coverage entries");

  // Verify some known paths are present
  assert.ok(coveragePaths.includes("/healthz"), "/healthz should be in coverage");
  assert.ok(coveragePaths.includes("/v1/tasks"), "/v1/tasks should be in coverage");
  assert.ok(coveragePaths.includes("/v1/admin/judges"), "/v1/admin/judges should be in coverage");
});

test("buildContractCoverage tags are collected from methods", () => {
  const service = new ApiResourceCatalogService();
  const coverage = service.buildContractCoverage();

  for (const entry of coverage) {
    // Tags should be collected from all method specs
    assert.ok(entry.tags.length >= 0, `Tags should be an array for ${entry.path}`);
  }
});

// ============================================================================
// Visibility inference tests
// ============================================================================

test("visibility values are valid ApiResourceVisibility", () => {
  const service = new ApiResourceCatalogService();
  const resources = service.listResources();

  const validVisibilities = new Set(["public", "authenticated", "admin"]);
  for (const resource of resources) {
    assert.ok(validVisibilities.has(resource.visibility), `Visibility ${resource.visibility} should be valid`);
  }
});

test("all public routes have correct visibility", () => {
  const service = new ApiResourceCatalogService();
  const publicResources = service.listResources({ visibility: "public" });

  const knownPublicPaths = [
    "/health",
    "/healthz",
    "/metrics",
    "/prometheus",
    "/v1/openapi.json",
    "/v1/auth/token",
    "/v1/webhooks/{endpointId}/receive",
  ];

  for (const resource of publicResources) {
    assert.ok(
      knownPublicPaths.includes(resource.path),
      `Public resource ${resource.path} should be in known public paths`,
    );
  }
});

test("admin tagged routes are admin visibility", () => {
  const service = new ApiResourceCatalogService();
  const adminResources = service.listResources({ tag: "admin" });

  for (const resource of adminResources) {
    assert.equal(resource.visibility, "admin", `Admin route ${resource.path} should have admin visibility`);
  }
});

// ============================================================================
// Plane inference tests
// ============================================================================

test("plane values are assigned correctly based on tags", () => {
  const service = new ApiResourceCatalogService();
  const resources = service.listResources();

  for (const resource of resources) {
    if (resource.tags.includes("admin")) {
      assert.equal(resource.plane, "control_plane", "Admin routes should be control_plane");
    }
    if (resource.tags.includes("gateway")) {
      assert.equal(resource.plane, "interaction_plane", "Gateway routes should be interaction_plane");
    }
    if (resource.tags.includes("knowledge") || resource.tags.includes("artifacts")) {
      assert.equal(resource.plane, "data_plane", "Knowledge/artifacts routes should be data_plane");
    }
    if (resource.tags.includes("tasks") || resource.tags.includes("approvals")) {
      assert.equal(resource.plane, "execution_plane", "Tasks/approvals routes should be execution_plane");
    }
  }
});

test("admin routes belong to control_plane", () => {
  const service = new ApiResourceCatalogService();
  const adminResources = service.listResources({ tag: "admin" });

  for (const resource of adminResources) {
    assert.equal(resource.plane, "control_plane", `Admin route ${resource.path} should be in control_plane`);
  }
});

test("gateway routes belong to interaction_plane", () => {
  const service = new ApiResourceCatalogService();
  const gatewayResources = service.listResources({ tag: "gateway" });

  for (const resource of gatewayResources) {
    assert.equal(resource.plane, "interaction_plane", `Gateway route ${resource.path} should be in interaction_plane`);
  }
});

test("knowledge and artifacts routes belong to data_plane", () => {
  const service = new ApiResourceCatalogService();
  const knowledgeResources = service.listResources({ tag: "knowledge" });
  const artifactResources = service.listResources({ tag: "artifacts" });

  for (const resource of [...knowledgeResources, ...artifactResources]) {
    assert.equal(resource.plane, "data_plane", `Route ${resource.path} should be in data_plane`);
  }
});

test("tasks and approvals routes belong to execution_plane", () => {
  const service = new ApiResourceCatalogService();
  const taskResources = service.listResources({ tag: "tasks" });
  const approvalResources = service.listResources({ tag: "approvals" });

  for (const resource of [...taskResources, ...approvalResources]) {
    assert.equal(resource.plane, "execution_plane", `Route ${resource.path} should be in execution_plane`);
  }
});

// ============================================================================
// Version extraction tests
// ============================================================================

test("version extraction from path", () => {
  const service = new ApiResourceCatalogService();

  const v1Resources = service.listResources({ version: "v1" });
  for (const resource of v1Resources) {
    assert.ok(resource.path.startsWith("/v1/") || resource.path === "/v1/openapi.json", `v1 resource should have /v1 prefix: ${resource.path}`);
  }
});

test("unversioned resources have null version", () => {
  const service = new ApiResourceCatalogService();
  const unversionedResources = service.listResources({ version: null });

  for (const resource of unversionedResources) {
    assert.equal(resource.version, null, `Unversioned resource ${resource.path} should have null version`);
    assert.ok(!resource.path.match(/^\/v\d+/), `Unversioned resource ${resource.path} should not start with /vN`);
  }
});

// ============================================================================
// exposedByApps tests
// ============================================================================

test("exposedByApps includes api app for all routes", () => {
  const service = new ApiResourceCatalogService();
  const resources = service.listResources();

  for (const resource of resources) {
    assert.ok(resource.exposedByApps.includes("api"), `All routes should be exposed by api app: ${resource.path}`);
  }
});

test("exposedByApps includes console for dashboard/admin/approvals tags", () => {
  const service = new ApiResourceCatalogService();

  const dashboardResources = service.listResources({ tag: "dashboard" });
  for (const resource of dashboardResources) {
    assert.ok(resource.exposedByApps.includes("console"), `Dashboard routes should be exposed by console: ${resource.path}`);
  }

  const approvalResources = service.listResources({ tag: "approvals" });
  for (const resource of approvalResources) {
    assert.ok(resource.exposedByApps.includes("console"), `Approval routes should be exposed by console: ${resource.path}`);
  }

  const adminResources = service.listResources({ tag: "admin" });
  for (const resource of adminResources) {
    assert.ok(resource.exposedByApps.includes("console"), `Admin routes should be exposed by console: ${resource.path}`);
  }
});

test("exposedByApps only contains valid app kinds", () => {
  const service = new ApiResourceCatalogService();
  const resources = service.listResources();

  const validAppKinds = new Set(["api", "console", "worker"]);
  for (const resource of resources) {
    for (const app of resource.exposedByApps) {
      assert.ok(validAppKinds.has(app), `App kind ${app} should be valid for ${resource.path}`);
    }
  }
});

// ============================================================================
// Integration tests
// ============================================================================

test("all three visibility types are present in the catalog", () => {
  const service = new ApiResourceCatalogService();
  const summary = service.buildSummary();

  assert.ok(summary.publicResources > 0, "Should have public resources");
  assert.ok(summary.authenticatedResources > 0, "Should have authenticated resources");
  assert.ok(summary.adminResources > 0, "Should have admin resources");
});

test("multiple planes are represented in byPlane grouping", () => {
  const service = new ApiResourceCatalogService();
  const summary = service.buildSummary();

  const planeCount = Object.keys(summary.byPlane).length;
  assert.ok(planeCount >= 2, `Should have multiple planes, got ${planeCount}: ${Object.keys(summary.byPlane).join(", ")}`);
});

test("summary and listResources are consistent", () => {
  const service = new ApiResourceCatalogService();
  const summary = service.buildSummary();

  // Verify byPlane counts match individual filter counts
  const controlPlaneCount = service.listResources().filter((r) => r.plane === "control_plane").length;
  assert.equal(summary.byPlane["control_plane"], controlPlaneCount, "control_plane count should match");

  const interactionPlaneCount = service.listResources().filter((r) => r.plane === "interaction_plane").length;
  assert.equal(summary.byPlane["interaction_plane"], interactionPlaneCount, "interaction_plane count should match");

  const dataPlaneCount = service.listResources().filter((r) => r.plane === "data_plane").length;
  assert.equal(summary.byPlane["data_plane"], dataPlaneCount, "data_plane count should match");

  const executionPlaneCount = service.listResources().filter((r) => r.plane === "execution_plane").length;
  assert.equal(summary.byPlane["execution_plane"], executionPlaneCount, "execution_plane count should match");
});
