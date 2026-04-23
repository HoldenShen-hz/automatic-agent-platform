import assert from "node:assert/strict";
import test from "node:test";
import { ApiResourceCatalogService } from "../../../../../src/platform/interface/api/api-resource-catalog-service.js";
test("ApiResourceCatalogService classifies public, authenticated, and admin resources", () => {
    const service = new ApiResourceCatalogService();
    const summary = service.buildSummary();
    const adminResources = service.listResources({ visibility: "admin" });
    const publicResources = service.listResources({ visibility: "public" });
    assert.ok(summary.totalResources > 0);
    assert.ok(summary.publicResources > 0);
    assert.ok(summary.adminResources > 0);
    assert.ok(adminResources.every((resource) => resource.visibility === "admin"));
    assert.ok(publicResources.some((resource) => resource.path === "/v1/openapi.json"));
});
test("ApiResourceCatalogService exposes version coverage and plane grouping", () => {
    const service = new ApiResourceCatalogService();
    const versioned = service.listResources({ version: "v1" });
    const summary = service.buildSummary();
    const executionPlaneResources = summary.byPlane.execution_plane ?? 0;
    assert.ok(versioned.length > 0);
    assert.ok(executionPlaneResources > 0);
    assert.ok(summary.versionedResources > summary.unversionedResources);
});
//# sourceMappingURL=api-resource-catalog-service.test.js.map