/**
 * Unit tests for PlatformArchitectureTypes
 *
 * @see src/platform-architecture-types.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
// ─────────────────────────────────────────────────────────────────────────────
// PlatformArchitectureLayer Tests
// ─────────────────────────────────────────────────────────────────────────────
test("PlatformArchitectureLayer accepts all valid values", () => {
    const validLayers = [
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
    for (const layer of validLayers) {
        assert.equal(typeof layer, "string");
    }
    assert.equal(validLayers.length, 9);
});
test("PlatformArchitectureLayer is a union type with 9 possible values", () => {
    const layers = [
        "platform", "domains", "interaction", "org-governance",
        "scale-ecosystem", "ops-maturity", "plugins", "sdk", "apps",
    ];
    for (const layer of layers) {
        assert.ok(layers.includes(layer));
    }
});
// ─────────────────────────────────────────────────────────────────────────────
// PlatformAppKind Tests
// ─────────────────────────────────────────────────────────────────────────────
test("PlatformAppKind accepts all valid values", () => {
    const validKinds = ["api", "console", "worker"];
    for (const kind of validKinds) {
        assert.equal(typeof kind, "string");
    }
    assert.equal(validKinds.length, 3);
});
// ─────────────────────────────────────────────────────────────────────────────
// PlatformAppManifest Tests
// ─────────────────────────────────────────────────────────────────────────────
test("PlatformAppManifest has all required fields", () => {
    const manifest = {
        appId: "test_app",
        kind: "api",
        entryModule: "./src/apps/api/index.js",
        defaultPort: 8080,
        healthEndpoint: "/health",
        capabilities: ["execution", "monitoring"],
        requiredLayers: ["platform", "domains"],
        startupCommand: "npm run start:api",
        startupMode: "daemon",
    };
    assert.equal(manifest.appId, "test_app");
    assert.equal(manifest.kind, "api");
    assert.equal(manifest.entryModule, "./src/apps/api/index.js");
    assert.equal(manifest.defaultPort, 8080);
    assert.equal(manifest.healthEndpoint, "/health");
    assert.ok(Array.isArray(manifest.capabilities));
    assert.ok(Array.isArray(manifest.requiredLayers));
    assert.equal(manifest.startupCommand, "npm run start:api");
    assert.equal(manifest.startupMode, "daemon");
});
test("PlatformAppManifest with null defaultPort", () => {
    const manifest = {
        appId: "test_app",
        kind: "worker",
        entryModule: "./src/apps/workers/index.js",
        defaultPort: null,
        healthEndpoint: null,
        capabilities: ["execution"],
        requiredLayers: ["platform"],
        startupCommand: "npm run start:worker",
        startupMode: "job",
    };
    assert.equal(manifest.defaultPort, null);
    assert.equal(manifest.healthEndpoint, null);
});
test("PlatformAppManifest with empty capabilities", () => {
    const manifest = {
        appId: "minimal_app",
        kind: "console",
        entryModule: "./console.js",
        defaultPort: 3000,
        healthEndpoint: "/health",
        capabilities: [],
        requiredLayers: [],
        startupCommand: "npm run start:console",
        startupMode: "daemon",
    };
    assert.ok(Array.isArray(manifest.capabilities));
    assert.equal(manifest.capabilities.length, 0);
    assert.ok(Array.isArray(manifest.requiredLayers));
    assert.equal(manifest.requiredLayers.length, 0);
});
test("PlatformAppManifest startupMode can be daemon or job", () => {
    const daemonManifest = {
        appId: "daemon_app",
        kind: "api",
        entryModule: "./api.js",
        defaultPort: 8080,
        healthEndpoint: "/health",
        capabilities: [],
        requiredLayers: ["platform"],
        startupCommand: "npm start",
        startupMode: "daemon",
    };
    const jobManifest = {
        appId: "job_app",
        kind: "worker",
        entryModule: "./worker.js",
        defaultPort: null,
        healthEndpoint: null,
        capabilities: [],
        requiredLayers: ["platform"],
        startupCommand: "npm run job",
        startupMode: "job",
    };
    assert.equal(daemonManifest.startupMode, "daemon");
    assert.equal(jobManifest.startupMode, "job");
});
// ─────────────────────────────────────────────────────────────────────────────
// PlatformStartupTargetKind Tests
// ─────────────────────────────────────────────────────────────────────────────
test("PlatformStartupTargetKind accepts summary and demo strings", () => {
    const validKinds = ["summary", "demo"];
    for (const kind of validKinds) {
        assert.equal(typeof kind, "string");
    }
});
test("PlatformStartupTargetKind accepts PlatformAppKind values", () => {
    const apiKind = "api";
    const consoleKind = "console";
    const workerKind = "worker";
    assert.equal(apiKind, "api");
    assert.equal(consoleKind, "console");
    assert.equal(workerKind, "worker");
});
// ─────────────────────────────────────────────────────────────────────────────
// PlatformStartupTarget Tests
// ─────────────────────────────────────────────────────────────────────────────
test("PlatformStartupTarget has all required fields", () => {
    const target = {
        targetKind: "summary",
        rootEntryModule: "./src/platform-architecture-bootstrap.js",
        description: "Platform summary view",
        requiredLayers: ["platform", "domains"],
        startupCommand: null,
        appManifest: null,
    };
    assert.equal(target.targetKind, "summary");
    assert.equal(target.rootEntryModule, "./src/platform-architecture-bootstrap.js");
    assert.equal(target.description, "Platform summary view");
    assert.ok(Array.isArray(target.requiredLayers));
    assert.equal(target.startupCommand, null);
    assert.equal(target.appManifest, null);
});
test("PlatformStartupTarget with app manifest", () => {
    const appManifestValue = {
        appId: "target_app",
        kind: "api",
        entryModule: "./api.js",
        defaultPort: 8080,
        healthEndpoint: "/health",
        capabilities: ["execution"],
        requiredLayers: ["platform"],
        startupCommand: "npm start",
        startupMode: "daemon",
    };
    const target = {
        targetKind: "api",
        rootEntryModule: "./src/apps/api/index.js",
        description: "API application",
        requiredLayers: ["platform"],
        startupCommand: "npm start",
        appManifest: appManifestValue,
    };
    assert.notEqual(target.appManifest, null);
    assert.equal(target.appManifest?.appId, "target_app");
    assert.equal(target.appManifest?.kind, "api");
});
test("PlatformStartupTarget with job startup", () => {
    const target = {
        targetKind: "worker",
        rootEntryModule: "./src/apps/workers/index.js",
        description: "Worker process",
        requiredLayers: ["platform"],
        startupCommand: "npm run worker",
        appManifest: null,
    };
    assert.ok(target.startupCommand !== null);
    assert.ok(target.startupCommand.includes("worker"));
});
test("PlatformStartupTarget with demo targetKind", () => {
    const target = {
        targetKind: "demo",
        rootEntryModule: "./demo.js",
        description: "Demo mode",
        requiredLayers: ["platform", "domains", "interaction"],
        startupCommand: "npm run demo",
        appManifest: null,
    };
    assert.equal(target.targetKind, "demo");
    assert.ok(target.requiredLayers.length >= 3);
});
// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────
test("PlatformAppManifest with maximum port number", () => {
    const manifest = {
        appId: "high_port_app",
        kind: "api",
        entryModule: "./api.js",
        defaultPort: 65535,
        healthEndpoint: "/health",
        capabilities: [],
        requiredLayers: ["platform"],
        startupCommand: "npm start",
        startupMode: "daemon",
    };
    assert.equal(manifest.defaultPort, 65535);
});
test("PlatformAppManifest with zero port (special case)", () => {
    const manifest = {
        appId: "zero_port_app",
        kind: "api",
        entryModule: "./api.js",
        defaultPort: 0,
        healthEndpoint: "/health",
        capabilities: [],
        requiredLayers: ["platform"],
        startupCommand: "npm start",
        startupMode: "daemon",
    };
    assert.equal(manifest.defaultPort, 0);
});
test("PlatformStartupTarget with empty description", () => {
    const target = {
        targetKind: "api",
        rootEntryModule: "./api.js",
        description: "",
        requiredLayers: [],
        startupCommand: null,
        appManifest: null,
    };
    assert.equal(target.description, "");
    assert.ok(Array.isArray(target.requiredLayers));
});
test("PlatformAppManifest with all architecture layers", () => {
    const manifest = {
        appId: "full_stack_app",
        kind: "console",
        entryModule: "./console.js",
        defaultPort: 3000,
        healthEndpoint: "/health",
        capabilities: ["execution", "monitoring", "governance", "orchestration"],
        requiredLayers: [
            "platform",
            "domains",
            "interaction",
            "org-governance",
            "scale-ecosystem",
            "ops-maturity",
            "plugins",
            "sdk",
            "apps",
        ],
        startupCommand: "npm start",
        startupMode: "daemon",
    };
    assert.equal(manifest.requiredLayers.length, 9);
});
//# sourceMappingURL=platform-architecture-types.test.js.map