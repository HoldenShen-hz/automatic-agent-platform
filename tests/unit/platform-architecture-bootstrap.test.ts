import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPlatformArchitectureBootstrapSummary,
  getPlatformArchitectureServices,
  listPlatformAppsByKind,
  listPlatformLayerManifests,
  PLATFORM_LAYER_MANIFESTS,
  PLATFORM_PLANE_MANIFESTS,
  PLATFORM_STARTUP_ORDER,
  validateStartupOrder,
  assertStartupOrderEnforced,
  registerPlatformArchitectureServices,
} from "../../src/platform-architecture-bootstrap.js";
import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";
import type { PlatformPlane } from "../../src/platform-architecture-types.js";

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

test("PLATFORM_STARTUP_ORDER has correct sequence P5 -> X1 -> P2 -> P3 -> P4 -> P1", () => {
  assert.deepEqual(PLATFORM_STARTUP_ORDER, ["P5", "X1", "P2", "P3", "P4", "P1"]);
});

test("PLATFORM_STARTUP_ORDER is frozen", () => {
  assert.ok(Object.isFrozen(PLATFORM_STARTUP_ORDER));
});

test("validateStartupOrder returns null for correct order", () => {
  const actualOrder: PlatformPlane[] = ["P5", "X1", "P2", "P3", "P4", "P1"];
  const result = validateStartupOrder(actualOrder);
  assert.equal(result, null);
});

test("validateStartupOrder returns violation for incorrect first element", () => {
  const actualOrder: PlatformPlane[] = ["P1", "X1", "P2", "P3", "P4", "P5"];
  const result = validateStartupOrder(actualOrder);
  assert.notEqual(result, null);
  assert.equal(result!.violatedPosition, 0);
  assert.equal(result!.requiredOrder[0], "P5");
  assert.equal(result!.actualOrder[0], "P1");
});

test("validateStartupOrder returns violation for wrong second element", () => {
  const actualOrder: PlatformPlane[] = ["P5", "P2", "P3", "P4", "P1", "X1"];
  const result = validateStartupOrder(actualOrder);
  assert.notEqual(result, null);
  assert.equal(result!.violatedPosition, 1);
  assert.equal(result!.requiredOrder[1], "X1");
  assert.equal(result!.actualOrder[1], "P2");
});

test("validateStartupOrder returns violation at middle position", () => {
  const actualOrder: PlatformPlane[] = ["P5", "X1", "P3", "P2", "P4", "P1"];
  const result = validateStartupOrder(actualOrder);
  assert.notEqual(result, null);
  assert.equal(result!.violatedPosition, 2);
  assert.equal(result!.requiredOrder[2], "P2");
  assert.equal(result!.actualOrder[2], "P3");
});

test("validateStartupOrder returns violation for empty order", () => {
  const result = validateStartupOrder([]);
  assert.notEqual(result, null);
  assert.equal(result!.violatedPosition, 0);
  assert.deepEqual(result!.actualOrder, ["not_started"]);
});

test("validateStartupOrder returns violation for partial order", () => {
  const actualOrder: PlatformPlane[] = ["P5", "X1", "P2"];
  const result = validateStartupOrder(actualOrder);
  assert.notEqual(result, null);
  assert.equal(result!.violatedPosition, 3);
});

test("assertStartupOrderEnforced does not throw when invariants are properly registered", () => {
  assert.doesNotThrow(() => assertStartupOrderEnforced());
});

test("PLATFORM_LAYER_MANIFESTS has exactly 9 layers", () => {
  assert.equal(PLATFORM_LAYER_MANIFESTS.length, 9);
});

test("PLATFORM_LAYER_MANIFESTS all entries have required fields", () => {
  for (const layer of PLATFORM_LAYER_MANIFESTS) {
    assert.ok(layer.layerId, "layerId must be defined");
    assert.ok(layer.entryModule, "entryModule must be defined");
    assert.ok(layer.description, "description must be defined");
    assert.ok(Array.isArray(layer.architectureSections), "architectureSections must be array");
    assert.ok(Array.isArray(layer.canonicalSubdomains), "canonicalSubdomains must be array");
    assert.ok(layer.architectureSections.length > 0, "architectureSections must have entries");
    assert.ok(layer.canonicalSubdomains.length > 0, "canonicalSubdomains must have entries");
  }
});

test("PLATFORM_LAYER_MANIFESTS platform layer includes execution and state-evidence", () => {
  const platform = PLATFORM_LAYER_MANIFESTS.find((l) => l.layerId === "platform");
  assert.ok(platform);
  assert.ok(platform!.canonicalSubdomains.includes("execution"));
  assert.ok(platform!.canonicalSubdomains.includes("state-evidence"));
});

test("PLATFORM_LAYER_MANIFESTS is frozen", () => {
  assert.ok(Object.isFrozen(PLATFORM_LAYER_MANIFESTS));
});

test("PLATFORM_PLANE_MANIFESTS has exactly 6 planes", () => {
  assert.equal(PLATFORM_PLANE_MANIFESTS.length, 6);
});

test("PLATFORM_PLANE_MANIFESTS includes all required plane IDs", () => {
  const planeIds = PLATFORM_PLANE_MANIFESTS.map((p) => p.planeId);
  assert.ok(planeIds.includes("P1"));
  assert.ok(planeIds.includes("P2"));
  assert.ok(planeIds.includes("P3"));
  assert.ok(planeIds.includes("P4"));
  assert.ok(planeIds.includes("P5"));
  assert.ok(planeIds.includes("X1"));
});

test("PLATFORM_PLANE_MANIFESTS all entries have required fields", () => {
  for (const plane of PLATFORM_PLANE_MANIFESTS) {
    assert.ok(plane.planeId, "planeId must be defined");
    assert.ok(Array.isArray(plane.surfaceIds), "surfaceIds must be array");
    assert.ok(plane.description, "description must be defined");
    assert.ok(Array.isArray(plane.architectureSections), "architectureSections must be array");
    assert.ok(plane.surfaceIds.length > 0, "surfaceIds must have entries");
    assert.ok(plane.architectureSections.length > 0, "architectureSections must have entries");
  }
});

test("PLATFORM_PLANE_MANIFESTS X1 plane has cross-cutting surfaces", () => {
  const x1 = PLATFORM_PLANE_MANIFESTS.find((p) => p.planeId === "X1");
  assert.ok(x1);
  assert.ok(x1!.surfaceIds.includes("x1-fabric"));
  assert.ok(x1!.surfaceIds.includes("shared"));
  assert.ok(x1!.surfaceIds.includes("model-gateway"));
  assert.ok(x1!.surfaceIds.includes("prompt-engine"));
});

test("PLATFORM_PLANE_MANIFESTS is frozen", () => {
  assert.ok(Object.isFrozen(PLATFORM_PLANE_MANIFESTS));
});

test("buildPlatformArchitectureBootstrapSummary generates valid ISO timestamp", () => {
  const summary = buildPlatformArchitectureBootstrapSummary();
  const date = new Date(summary.generatedAt);
  assert.ok(!isNaN(date.getTime()), "generatedAt must be valid ISO date");
});

test("buildPlatformArchitectureBootstrapSummary counts match array lengths", () => {
  const summary = buildPlatformArchitectureBootstrapSummary();
  assert.equal(summary.layerCount, summary.layers.length);
  assert.equal(summary.planeCount, summary.planes.length);
  assert.equal(summary.appCount, summary.apps.length);
  assert.equal(summary.startupTargetCount, summary.startupTargets.length);
});

test("registerPlatformArchitectureServices with fresh registry returns all services", async () => {
  const registry = new ServiceRegistry();
  try {
    const services = registerPlatformArchitectureServices(registry);
    assert.equal(services.layers.length, 9);
    assert.equal(services.planes.length, 6);
    assert.ok(services.apps.length > 0);
    assert.ok(services.startupTargets.length > 0);
    assert.ok(services.summary);
  } finally {
    await registry.reset();
  }
});

test("registerPlatformArchitectureServices summary has correct values", async () => {
  const registry = new ServiceRegistry();
  try {
    const services = registerPlatformArchitectureServices(registry);
    assert.equal(services.summary.layerCount, 9);
    assert.equal(services.summary.planeCount, 6);
    assert.equal(services.summary.appCount, 3);
    assert.equal(services.summary.startupTargetCount, 5);
  } finally {
    await registry.reset();
  }
});

test("listPlatformAppsByKind returns only apps of specified kind", () => {
  const apiApps = listPlatformAppsByKind("api");
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

test("listPlatformLayerManifests returns frozen array", () => {
  const manifests = listPlatformLayerManifests();
  assert.ok(Object.isFrozen(manifests));
});

test("listPlatformLayerManifests matches PLATFORM_LAYER_MANIFESTS", () => {
  const manifests = listPlatformLayerManifests();
  assert.deepEqual(manifests, PLATFORM_LAYER_MANIFESTS);
});
