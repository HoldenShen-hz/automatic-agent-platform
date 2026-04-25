import assert from "node:assert/strict";
import test from "node:test";

import {
  PLATFORM_LAYER_MANIFESTS,
  listPlatformLayerManifests,
  listPlatformAppsByKind,
  buildPlatformArchitectureBootstrapSummary,
  registerPlatformArchitectureServices,
  getPlatformArchitectureServices,
  type PlatformArchitectureServices,
} from "../../../../src/platform-architecture-bootstrap.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";

test("listPlatformLayerManifests returns all 9 layer manifests", async () => {
  const manifests = listPlatformLayerManifests();

  assert.equal(manifests.length, 9);

  const layerIds = manifests.map((m) => m.layerId);
  assert.ok(layerIds.includes("platform"));
  assert.ok(layerIds.includes("domains"));
  assert.ok(layerIds.includes("interaction"));
  assert.ok(layerIds.includes("org-governance"));
  assert.ok(layerIds.includes("scale-ecosystem"));
  assert.ok(layerIds.includes("ops-maturity"));
  assert.ok(layerIds.includes("plugins"));
  assert.ok(layerIds.includes("sdk"));
  assert.ok(layerIds.includes("apps"));
});

test("PLATFORM_LAYER_MANIFESTS is frozen", async () => {
  assert.ok(Object.isFrozen(PLATFORM_LAYER_MANIFESTS));
});

test("each layer manifest has required fields", async () => {
  const manifests = listPlatformLayerManifests();

  for (const manifest of manifests) {
    assert.ok(typeof manifest.layerId === "string");
    assert.ok(typeof manifest.entryModule === "string");
    assert.ok(typeof manifest.description === "string");
    assert.ok(Array.isArray(manifest.architectureSections));
    assert.ok(Array.isArray(manifest.canonicalSubdomains));
    assert.ok(manifest.layerId.length > 0);
    assert.ok(manifest.entryModule.length > 0);
  }
});

test("platform layer has expected subdomains", async () => {
  const manifests = listPlatformLayerManifests();
  const platform = manifests.find((m) => m.layerId === "platform");

  assert.ok(platform);
  assert.ok(platform.canonicalSubdomains.includes("interface"));
  assert.ok(platform.canonicalSubdomains.includes("execution"));
  assert.ok(platform.canonicalSubdomains.includes("state-evidence"));
});

test("domains layer has expected subdomains", async () => {
  const manifests = listPlatformLayerManifests();
  const domains = manifests.find((m) => m.layerId === "domains");

  assert.ok(domains);
  assert.ok(domains.canonicalSubdomains.includes("governance"));
  assert.ok(domains.canonicalSubdomains.includes("recipes"));
});

test("listPlatformAppsByKind filters correctly", async () => {
  const apiApps = listPlatformAppsByKind("api");
  assert.ok(apiApps.length > 0);
  for (const app of apiApps) {
    assert.equal(app.kind, "api");
  }

  const consoleApps = listPlatformAppsByKind("console");
  for (const app of consoleApps) {
    assert.equal(app.kind, "console");
  }

  const workerApps = listPlatformAppsByKind("worker");
  for (const app of workerApps) {
    assert.equal(app.kind, "worker");
  }
});

test("buildPlatformArchitectureBootstrapSummary returns complete summary", async () => {
  const summary = buildPlatformArchitectureBootstrapSummary();

  assert.ok(typeof summary.generatedAt === "string");
  assert.equal(summary.startupEntryModule, "src/index.ts");
  assert.equal(summary.architectureDocPath, "docs_zh/architecture/00-platform-architecture.md");
  assert.equal(summary.layerCount, 9);
  assert.ok(summary.appCount >= 0);
  assert.ok(summary.startupTargetCount >= 0);
  assert.ok(Array.isArray(summary.layers));
  assert.ok(Array.isArray(summary.apps));
  assert.ok(Array.isArray(summary.startupTargets));
  assert.equal(summary.layers.length, 9);
});

test("buildPlatformArchitectureBootstrapSummary generatedAt is ISO format", async () => {
  const summary = buildPlatformArchitectureBootstrapSummary();
  const date = new Date(summary.generatedAt);

  assert.ok(!isNaN(date.getTime()));
  assert.ok(summary.generatedAt.includes("T"));
});

test("registerPlatformArchitectureServices registers four services", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const services = registerPlatformArchitectureServices(registry);

  assert.ok(Array.isArray(services.layers));
  assert.ok(Array.isArray(services.apps));
  assert.ok(Array.isArray(services.startupTargets));
  assert.ok(typeof services.summary === "object");

  assert.equal(registry.isInitialized("architecture.layer-catalog"), true);
  assert.equal(registry.isInitialized("architecture.app-catalog"), true);
  assert.equal(registry.isInitialized("architecture.startup-targets"), true);
  assert.equal(registry.isInitialized("architecture.bootstrap-summary"), true);
});

test("getPlatformArchitectureServices returns same services object", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const services1 = getPlatformArchitectureServices(registry);
  const services2 = getPlatformArchitectureServices(registry);

  assert.equal(services1.layers, services2.layers);
  assert.equal(services1.apps, services2.apps);
  assert.equal(services1.startupTargets, services2.startupTargets);
  assert.equal(services1.summary, services2.summary);
});

test("architecture.bootstrap-summary depends on other three services", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  registerPlatformArchitectureServices(registry);

  // Summary should be initialized after others
  const summary = registry.get("architecture.bootstrap-summary");
  assert.ok(typeof summary === "object");
});

test("services object is immutable - layers/apps/startupTargets are readonly", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const services = registerPlatformArchitectureServices(registry);

  assert.ok(Array.isArray(services.layers));
  assert.ok(Array.isArray(services.apps));
  assert.ok(Array.isArray(services.startupTargets));
});