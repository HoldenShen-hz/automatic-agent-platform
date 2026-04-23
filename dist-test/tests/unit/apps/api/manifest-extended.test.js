import assert from "node:assert/strict";
import test from "node:test";
import { API_APP_MANIFEST } from "../../../../src/apps/api/index.js";
test("API_APP_MANIFEST entryModule points to http-api-server", () => {
    assert.equal(API_APP_MANIFEST.entryModule, "src/platform/interface/api/http-api-server.ts");
});
test("API_APP_MANIFEST defaultPort is 8004", () => {
    assert.equal(API_APP_MANIFEST.defaultPort, 8004);
});
test("API_APP_MANIFEST healthEndpoint is /health", () => {
    assert.equal(API_APP_MANIFEST.healthEndpoint, "/health");
});
test("API_APP_MANIFEST capabilities include all expected values", () => {
    assert.ok(API_APP_MANIFEST.capabilities.includes("http_api"));
    assert.ok(API_APP_MANIFEST.capabilities.includes("approval_queue"));
    assert.ok(API_APP_MANIFEST.capabilities.includes("inspect"));
    assert.ok(API_APP_MANIFEST.capabilities.includes("dashboard"));
});
test("API_APP_MANIFEST startupMode is daemon", () => {
    assert.equal(API_APP_MANIFEST.startupMode, "daemon");
});
test("API_APP_MANIFEST requiredLayers includes platform and domains", () => {
    assert.ok(API_APP_MANIFEST.requiredLayers.includes("platform"));
    assert.ok(API_APP_MANIFEST.requiredLayers.includes("domains"));
    assert.ok(API_APP_MANIFEST.requiredLayers.includes("interaction"));
    assert.ok(API_APP_MANIFEST.requiredLayers.includes("org-governance"));
    assert.ok(API_APP_MANIFEST.requiredLayers.includes("scale-ecosystem"));
    assert.ok(API_APP_MANIFEST.requiredLayers.includes("ops-maturity"));
    assert.ok(API_APP_MANIFEST.requiredLayers.includes("plugins"));
    assert.ok(API_APP_MANIFEST.requiredLayers.includes("sdk"));
    assert.ok(API_APP_MANIFEST.requiredLayers.includes("apps"));
});
test("API_APP_MANIFEST has all required properties per PlatformAppManifest", () => {
    assert.ok(typeof API_APP_MANIFEST.appId === "string");
    assert.ok(typeof API_APP_MANIFEST.kind === "string");
    assert.ok(typeof API_APP_MANIFEST.entryModule === "string");
    assert.ok(typeof API_APP_MANIFEST.defaultPort === "number");
    assert.ok(typeof API_APP_MANIFEST.healthEndpoint === "string");
    assert.ok(Array.isArray(API_APP_MANIFEST.capabilities));
    assert.ok(Array.isArray(API_APP_MANIFEST.requiredLayers));
    assert.ok(typeof API_APP_MANIFEST.startupCommand === "string");
    assert.ok(API_APP_MANIFEST.startupMode === "daemon" || API_APP_MANIFEST.startupMode === "job");
});
//# sourceMappingURL=manifest-extended.test.js.map