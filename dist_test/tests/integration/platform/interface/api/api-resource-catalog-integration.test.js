import assert from "node:assert/strict";
import test from "node:test";
import { ApiResourceCatalogService } from "../../../../../src/platform/interface/api/api-resource-catalog-service.js";
import { buildOpenApiDocument, listApiRoutes } from "../../../../../src/platform/interface/api/openapi-document.js";
test("integration: api resource catalog stays aligned with openapi paths and methods", () => {
    const service = new ApiResourceCatalogService();
    const document = buildOpenApiDocument();
    const resources = service.listResources();
    const routes = listApiRoutes();
    assert.equal(resources.length, routes.length);
    for (const resource of resources) {
        assert.ok(document.paths[resource.path]);
        assert.ok(document.paths[resource.path][resource.method.toLowerCase()]);
    }
});
//# sourceMappingURL=api-resource-catalog-integration.test.js.map