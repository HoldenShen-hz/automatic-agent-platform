import assert from "node:assert/strict";
import test from "node:test";
test("PlatformArchitectureLayer accepts valid values", () => {
    const layers = [
        "platform",
        "domains",
        "interaction",
        "org-governance",
        "scale-ecosystem",
        "ops-maturity",
        "plugins",
        "sdk",
        "apps",
    ];
    assert.equal(layers.length, 9);
});
test("PlatformAppKind accepts valid values", () => {
    const kinds = ["api", "console", "worker"];
    assert.equal(kinds.length, 3);
});
test("PlatformStartupTargetKind accepts valid values", () => {
    const kinds = ["summary", "demo", "api", "console", "worker"];
    assert.equal(kinds.length, 5);
});
test("PlatformAppManifest accepts valid structure", () => {
    const manifest = {
        appId: "test-app",
        kind: "api",
        entryModule: "/path/to/module.js",
        defaultPort: 8080,
        healthEndpoint: "/health",
        capabilities: ["execution", "monitoring"],
        requiredLayers: ["platform"],
        startupCommand: "npm start",
        startupMode: "daemon",
    };
    assert.equal(manifest.appId, "test-app");
    assert.equal(manifest.kind, "api");
    assert.equal(manifest.defaultPort, 8080);
    assert.equal(manifest.capabilities.length, 2);
    assert.equal(manifest.requiredLayers.length, 1);
    assert.equal(manifest.startupMode, "daemon");
});
test("PlatformAppManifest accepts null optional fields", () => {
    const manifest = {
        appId: "minimal-app",
        kind: "worker",
        entryModule: "./entry.js",
        defaultPort: null,
        healthEndpoint: null,
        capabilities: [],
        requiredLayers: [],
        startupCommand: "node worker.js",
        startupMode: "job",
    };
    assert.equal(manifest.defaultPort, null);
    assert.equal(manifest.healthEndpoint, null);
});
test("PlatformStartupTarget accepts valid structure", () => {
    const target = {
        targetKind: "api",
        rootEntryModule: "/app/main.js",
        description: "API server",
        requiredLayers: ["platform", "domains"],
        startupCommand: "npm run api",
        appManifest: null,
    };
    assert.equal(target.targetKind, "api");
    assert.equal(target.description, "API server");
    assert.equal(target.requiredLayers.length, 2);
    assert.equal(target.appManifest, null);
});
test("PlatformStartupTarget accepts appManifest", () => {
    const appManifest = {
        appId: "console-app",
        kind: "console",
        entryModule: "/console/main.js",
        defaultPort: 3000,
        healthEndpoint: "/health",
        capabilities: ["ui"],
        requiredLayers: ["platform"],
        startupCommand: "npm run console",
        startupMode: "daemon",
    };
    const target = {
        targetKind: "console",
        rootEntryModule: "/console/main.js",
        description: "Console UI",
        requiredLayers: ["platform"],
        startupCommand: null,
        appManifest,
    };
    assert.notEqual(target.appManifest, null);
    assert.equal(target.appManifest.appId, "console-app");
});
//# sourceMappingURL=platform-architecture-types.test.js.map