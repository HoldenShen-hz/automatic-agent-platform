import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPlatformArchitectureBootstrapSummary,
  getPlatformArchitectureServices,
  listPlatformAppsByKind,
  listPlatformLayerManifests,
} from "../../src/platform-architecture-bootstrap.js";
import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";

test("platform architecture bootstrap exposes the canonical seven-layer system plus cross-layer surfaces", () => {
  const layers = listPlatformLayerManifests();
  assert.deepEqual(
    layers.map((layer) => layer.layerId),
    ["platform", "domains", "interaction", "org-governance", "scale-ecosystem", "ops-maturity", "plugins", "sdk", "apps"],
  );
  assert.equal(layers[0]?.entryModule, "src/platform/index.ts");
  assert.ok(layers[0]?.canonicalSubdomains.includes("prompt-engine"));
  assert.ok(layers[0]?.canonicalSubdomains.includes("model-gateway"));
  assert.ok(layers[0]?.canonicalSubdomains.includes("compliance"));
  assert.ok(layers.find((layer) => layer.layerId === "domains")?.canonicalSubdomains.includes("business-pack"));
  assert.ok(layers.find((layer) => layer.layerId === "ops-maturity")?.canonicalSubdomains.includes("chaos"));
  assert.ok(layers.find((layer) => layer.layerId === "ops-maturity")?.canonicalSubdomains.includes("monitoring"));
});

test("platform architecture bootstrap summary exposes root startup entry and app manifests", () => {
  const summary = buildPlatformArchitectureBootstrapSummary();
  assert.equal(summary.startupEntryModule, "src/index.ts");
  assert.equal(summary.architectureDocPath, "docs_zh/architecture/00-platform-architecture.md");
  assert.equal(summary.layerCount, 9);
  assert.equal(summary.planeCount, 6);
  assert.equal(summary.appCount, 3);
  assert.equal(summary.startupTargetCount, 5);
  assert.ok(summary.planes.some((plane) => plane.planeId === "X1"));
  assert.deepEqual(summary.apps.map((app) => app.kind), ["api", "console", "worker"]);
  assert.deepEqual(summary.startupTargets.map((target) => target.targetKind), ["summary", "demo", "api", "console", "worker"]);
});

test("platform architecture bootstrap registers catalogs in the service registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const services = getPlatformArchitectureServices(registry);
    assert.equal(services.layers.length, 9);
    assert.equal(services.planes.length, 6);
    assert.equal(services.apps.length, 3);
    assert.equal(services.startupTargets.length, 5);
    assert.equal(services.summary.startupEntryModule, "src/index.ts");
    assert.equal(registry.isInitialized("architecture.layer-catalog"), true);
    assert.equal(registry.isInitialized("architecture.plane-catalog"), true);
    assert.equal(registry.isInitialized("architecture.app-catalog"), true);
    assert.equal(registry.isInitialized("architecture.startup-targets"), true);
    assert.equal(registry.isInitialized("architecture.bootstrap-summary"), true);
  } finally {
    await registry.reset();
  }
});

test("platform architecture bootstrap filters app manifests by kind", () => {
  assert.equal(listPlatformAppsByKind("api").length, 1);
  assert.equal(listPlatformAppsByKind("console").length, 1);
  assert.equal(listPlatformAppsByKind("worker").length, 1);
});
