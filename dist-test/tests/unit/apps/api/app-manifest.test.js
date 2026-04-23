import assert from "node:assert/strict";
import test from "node:test";
import { API_APP_MANIFEST } from "../../../../src/apps/api/index.js";
test("API_APP_MANIFEST has correct structure and defaults", () => {
    const manifest = API_APP_MANIFEST;
    assert.equal(manifest.appId, "automatic-agent-api");
    assert.equal(manifest.kind, "api");
    assert.equal(manifest.defaultPort, 8004);
    assert.equal(manifest.healthEndpoint, "/health");
    assert.ok(Array.isArray(manifest.capabilities));
    assert.ok(manifest.capabilities.includes("http_api"));
    assert.ok(manifest.capabilities.includes("approval_queue"));
    assert.equal(manifest.startupMode, "daemon");
    assert.equal(manifest.startupCommand, "npm run api");
});
test("API_APP_MANIFEST includes all required platform layers", () => {
    const requiredLayers = API_APP_MANIFEST.requiredLayers;
    assert.ok(requiredLayers.includes("platform"));
    assert.ok(requiredLayers.includes("domains"));
    assert.ok(requiredLayers.includes("apps"));
    assert.ok(requiredLayers.length > 5);
});
//# sourceMappingURL=app-manifest.test.js.map