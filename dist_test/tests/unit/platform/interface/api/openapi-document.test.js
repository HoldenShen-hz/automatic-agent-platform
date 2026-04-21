import assert from "node:assert/strict";
import test from "node:test";
import { buildOpenApiDocument, listApiRoutes } from "../../../../../src/platform/interface/api/openapi-document.js";
test("buildOpenApiDocument returns valid OpenAPI structure", () => {
    const doc = buildOpenApiDocument();
    assert.equal(doc.openapi, "3.1.0");
    assert.ok(doc.info);
    assert.equal(doc.info.title, "Automatic Agent API");
    assert.equal(doc.info.version, "0.1.0");
    assert.ok(doc.paths);
});
test("buildOpenApiDocument includes health routes", () => {
    const doc = buildOpenApiDocument();
    assert.ok(doc.paths["/healthz"]);
    assert.ok(doc.paths["/health"]);
});
test("buildOpenApiDocument includes auth routes", () => {
    const doc = buildOpenApiDocument();
    assert.ok(doc.paths["/v1/auth/token"]);
    const route = doc.paths["/v1/auth/token"];
    assert.ok(route.post);
});
test("buildOpenApiDocument includes task routes", () => {
    const doc = buildOpenApiDocument();
    assert.ok(doc.paths["/v1/tasks"]);
    assert.ok(doc.paths["/v1/tasks/{taskId}"]);
    assert.ok(doc.paths["/v1/tasks/{taskId}/events"]);
});
test("buildOpenApiDocument route has correct method structure", () => {
    const doc = buildOpenApiDocument();
    const healthz = doc.paths["/healthz"];
    const get = healthz.get;
    assert.equal(get.summary, "Healthz alias-free health check");
    assert.deepEqual(get.tags, ["health"]);
    assert.ok(get.responses);
});
test("listApiRoutes returns array of routes", () => {
    const routes = listApiRoutes();
    assert.ok(Array.isArray(routes));
    assert.ok(routes.length > 0);
});
test("listApiRoutes returns copy of internal array", () => {
    const routes1 = listApiRoutes();
    const routes2 = listApiRoutes();
    assert.notStrictEqual(routes1, routes2);
});
test("listApiRoutes all routes have required fields", () => {
    const routes = listApiRoutes();
    for (const route of routes) {
        assert.ok(route.method === "GET" || route.method === "POST");
        assert.ok(typeof route.path === "string");
        assert.ok(typeof route.summary === "string");
        assert.ok(Array.isArray(route.tags));
        assert.ok(route.tags.length > 0);
    }
});
test("listApiRoutes includes all documented routes", () => {
    const routes = listApiRoutes();
    const paths = routes.map(r => r.path);
    assert.ok(paths.includes("/healthz"));
    assert.ok(paths.includes("/v1/tasks"));
    assert.ok(paths.includes("/v1/divisions"));
    assert.ok(paths.includes("/v1/knowledge/semantic/inspect"));
    assert.ok(paths.includes("/v1/approvals"));
});
test("buildOpenApiDocument paths have both GET and POST where expected", () => {
    const doc = buildOpenApiDocument();
    const tasks = doc.paths["/v1/tasks"];
    assert.ok(tasks.get);
    const authToken = doc.paths["/v1/auth/token"];
    assert.ok(authToken.post);
});
test("ApiRouteSpec type accepts valid values", () => {
    const route = {
        method: "GET",
        path: "/test",
        summary: "Test route",
        tags: ["test"],
    };
    assert.equal(route.method, "GET");
    assert.equal(route.path, "/test");
});
//# sourceMappingURL=openapi-document.test.js.map