import assert from "node:assert/strict";
import test from "node:test";

import type {
  PlatformArchitectureLayer,
  PlatformAppKind,
  PlatformAppManifest,
  PlatformStartupTargetKind,
  PlatformStartupTarget,
} from "../../../../../../src/platform-architecture-types.js";

test("PlatformArchitectureLayer is a union of 9 string literals", async () => {
  const layers: PlatformArchitectureLayer[] = [
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

  for (const layer of layers) {
    assert.ok(typeof layer === "string");
  }
});

test("PlatformAppKind is a union of api, console, worker", async () => {
  const kinds: PlatformAppKind[] = ["api", "console", "worker"];

  for (const kind of kinds) {
    assert.ok(typeof kind === "string");
  }
});

test("PlatformAppManifest has required structure", async () => {
  const manifest: PlatformAppManifest = {
    appId: "test-app",
    kind: "api",
    entryModule: "src/test/index.ts",
    defaultPort: 8004,
    healthEndpoint: "/health",
    capabilities: ["http_api"],
    requiredLayers: ["platform"],
    startupCommand: "npm run start",
    startupMode: "daemon",
  };

  assert.equal(manifest.appId, "test-app");
  assert.equal(manifest.kind, "api");
  assert.equal(manifest.entryModule, "src/test/index.ts");
  assert.equal(manifest.defaultPort, 8004);
  assert.equal(manifest.healthEndpoint, "/health");
  assert.deepEqual(manifest.capabilities, ["http_api"]);
  assert.deepEqual(manifest.requiredLayers, ["platform"]);
  assert.equal(manifest.startupCommand, "npm run start");
  assert.equal(manifest.startupMode, "daemon");
});

test("PlatformAppManifest can have null defaultPort and healthEndpoint", async () => {
  const manifest: PlatformAppManifest = {
    appId: "test-app",
    kind: "worker",
    entryModule: "src/test/index.ts",
    defaultPort: null,
    healthEndpoint: null,
    capabilities: [],
    requiredLayers: [],
    startupCommand: "npm run worker",
    startupMode: "job",
  };

  assert.equal(manifest.defaultPort, null);
  assert.equal(manifest.healthEndpoint, null);
});

test("PlatformStartupTargetKind is summary | demo | PlatformAppKind", async () => {
  const targetKinds: PlatformStartupTargetKind[] = ["summary", "demo", "api", "console", "worker"];

  for (const kind of targetKinds) {
    assert.ok(typeof kind === "string");
  }
});

test("PlatformStartupTarget has required structure", async () => {
  const target: PlatformStartupTarget = {
    targetKind: "summary",
    rootEntryModule: "src/index.ts",
    description: "Test target",
    requiredLayers: ["platform"],
    startupCommand: "npm run start",
    appManifest: null,
  };

  assert.equal(target.targetKind, "summary");
  assert.equal(target.rootEntryModule, "src/index.ts");
  assert.equal(target.description, "Test target");
  assert.deepEqual(target.requiredLayers, ["platform"]);
  assert.equal(target.startupCommand, "npm run start");
  assert.equal(target.appManifest, null);
});

test("PlatformStartupTarget appManifest can be PlatformAppManifest", async () => {
  const appManifest: PlatformAppManifest = {
    appId: "test-app",
    kind: "api",
    entryModule: "src/test/index.ts",
    defaultPort: 8004,
    healthEndpoint: "/health",
    capabilities: ["http_api"],
    requiredLayers: ["platform"],
    startupCommand: "npm run start",
    startupMode: "daemon",
  };

  const target: PlatformStartupTarget = {
    targetKind: "api",
    rootEntryModule: "src/index.ts",
    description: "Test target with app",
    requiredLayers: ["platform"],
    startupCommand: "npm run start",
    appManifest,
  };

  assert.ok(target.appManifest !== null);
  assert.equal(target.appManifest.appId, "test-app");
});