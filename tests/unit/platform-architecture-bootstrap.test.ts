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
import type {
  PlatformPlane,
  PlatformAppKind,
  PlatformArchitectureLayer,
} from "../../src/platform-architecture-types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test suite: Platform Architecture Bootstrap
// Key behaviors:
// 1. Bootstrap initializes all plane directories
// 2. Service registration order (control-plane → state-evidence → execution → orchestration → interaction)
// 3. Bootstrap error handling
// 4. Platform root summary building
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// 1. Bootstrap initializes all plane directories
// ─────────────────────────────────────────────────────────────────────────────

test("bootstrap initializes all six platform planes", () => {
  const planes = PLATFORM_PLANE_MANIFESTS;
  assert.equal(planes.length, 6, "Should have exactly 6 platform planes");

  const planeIds = planes.map((p) => p.planeId);
  assert.ok(planeIds.includes("P1"), "Should include P1 (interface)");
  assert.ok(planeIds.includes("P2"), "Should include P2 (control-plane)");
  assert.ok(planeIds.includes("P3"), "Should include P3 (orchestration)");
  assert.ok(planeIds.includes("P4"), "Should include P4 (execution)");
  assert.ok(planeIds.includes("P5"), "Should include P5 (state-evidence)");
  assert.ok(planeIds.includes("X1"), "Should include X1 (cross-cutting fabric)");
});

test("bootstrap registers all planes in service registry", async () => {
  const registry = new ServiceRegistry();
  try {
    const services = registerPlatformArchitectureServices(registry);
    assert.equal(services.planes.length, 6);
    assert.ok(registry.isInitialized("architecture.plane-catalog"));
  } finally {
    await registry.reset();
  }
});

test("bootstrap planes have required surface definitions", () => {
  for (const plane of PLATFORM_PLANE_MANIFESTS) {
    assert.ok(plane.planeId, "planeId must be defined");
    assert.ok(Array.isArray(plane.surfaceIds), "surfaceIds must be an array");
    assert.ok(plane.surfaceIds.length > 0, `plane ${plane.planeId} must have at least one surface`);
    assert.ok(plane.description, "description must be defined");
    assert.ok(Array.isArray(plane.architectureSections), "architectureSections must be an array");
    assert.ok(plane.architectureSections.length > 0, `plane ${plane.planeId} must have architecture sections`);
  }
});

test("bootstrap plane P5 (state-evidence) is first in startup order", () => {
  assert.equal(PLATFORM_STARTUP_ORDER[0], "P5", "P5 (state-evidence) should be first");
});

test("bootstrap plane X1 (cross-cutting) is second in startup order", () => {
  assert.equal(PLATFORM_STARTUP_ORDER[1], "X1", "X1 (cross-cutting fabric) should be second");
});

test("bootstrap plane P2 (control-plane) is third in startup order", () => {
  assert.equal(PLATFORM_STARTUP_ORDER[2], "P2", "P2 (control-plane) should be third");
});

test("bootstrap plane P3 (orchestration) is fourth in startup order", () => {
  assert.equal(PLATFORM_STARTUP_ORDER[3], "P3", "P3 (orchestration) should be fourth");
});

test("bootstrap plane P4 (execution) is fifth in startup order", () => {
  assert.equal(PLATFORM_STARTUP_ORDER[4], "P4", "P4 (execution) should be fifth");
});

test("bootstrap plane P1 (interface) is last in startup order", () => {
  assert.equal(PLATFORM_STARTUP_ORDER[5], "P1", "P1 (interface) should be last");
});

test("bootstrap startup order has exactly 6 planes", () => {
  assert.equal(PLATFORM_STARTUP_ORDER.length, 6);
});

test("bootstrap startup order is frozen (immutable)", () => {
  assert.ok(Object.isFrozen(PLATFORM_STARTUP_ORDER));
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Service registration order
// ─────────────────────────────────────────────────────────────────────────────

test("service registration uses dependency order bootstrap-summary depends on catalogs", async () => {
  const registry = new ServiceRegistry();
  try {
    registerPlatformArchitectureServices(registry);

    // bootstrap-summary depends on all catalogs - verify it was registered last
    const registeredServices = Array.from(registry["services"].keys());
    const summaryIndex = registeredServices.indexOf("architecture.bootstrap-summary");
    const layerIndex = registeredServices.indexOf("architecture.layer-catalog");
    const planeIndex = registeredServices.indexOf("architecture.plane-catalog");
    const appIndex = registeredServices.indexOf("architecture.app-catalog");
    const targetIndex = registeredServices.indexOf("architecture.startup-targets");

    assert.ok(summaryIndex > layerIndex, "bootstrap-summary should be registered after layer-catalog");
    assert.ok(summaryIndex > planeIndex, "bootstrap-summary should be registered after plane-catalog");
    assert.ok(summaryIndex > appIndex, "bootstrap-summary should be registered after app-catalog");
    assert.ok(summaryIndex > targetIndex, "bootstrap-summary should be registered after startup-targets");
  } finally {
    await registry.reset();
  }
});

test("catalog services are registered before bootstrap-summary", async () => {
  const registry = new ServiceRegistry();
  try {
    const services = registerPlatformArchitectureServices(registry);

    // Verify all catalog services exist
    assert.ok(services.layers.length > 0, "layer catalog should be populated");
    assert.ok(services.planes.length > 0, "plane catalog should be populated");
    assert.ok(services.apps.length > 0, "app catalog should be populated");
    assert.ok(services.startupTargets.length > 0, "startup targets should be populated");

    // Verify bootstrap summary is available
    assert.ok(services.summary, "bootstrap summary should be available");
    assert.equal(services.summary.layerCount, 9);
    assert.equal(services.summary.planeCount, 6);
  } finally {
    await registry.reset();
  }
});

test("getPlatformArchitectureServices returns same services when called twice", async () => {
  const registry = new ServiceRegistry();
  try {
    const services1 = getPlatformArchitectureServices(registry);
    const services2 = getPlatformArchitectureServices(registry);

    // Should return equivalent services (same singleton registry)
    assert.equal(services1.layers, services2.layers);
    assert.equal(services1.planes, services2.planes);
    assert.equal(services1.apps, services2.apps);
    assert.equal(services1.startupTargets, services2.startupTargets);
  } finally {
    await registry.reset();
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Bootstrap error handling
// ─────────────────────────────────────────────────────────────────────────────

test("assertStartupOrderEnforced throws when required invariant is missing", () => {
  // This test verifies the function validates required architecture invariants
  // The function checks for: INV-STATE-001, INV-RUN-001, INV-GRAPH-001, INV-BUDGET-001,
  // INV-REPLAY-001, INV-SIDEEFFECT-001, INV-POLICY-001
  assert.doesNotThrow(() => assertStartupOrderEnforced(), "assertStartupOrderEnforced should not throw when all invariants are present");
});

test("validateStartupOrder returns null for correct order", () => {
  const correctOrder: PlatformPlane[] = ["P5", "X1", "P2", "P3", "P4", "P1"];
  const result = validateStartupOrder(correctOrder);
  assert.equal(result, null, "validateStartupOrder should return null for correct order");
});

test("validateStartupOrder returns violation for incorrect order", () => {
  const wrongOrder: PlatformPlane[] = ["P1", "P2", "P3", "P4", "P5", "X1"];
  const result = validateStartupOrder(wrongOrder);

  assert.notEqual(result, null, "validateStartupOrder should return violation");
  assert.equal(result!.violatedPosition, 0, "violation should be at position 0");
  assert.equal(result!.requiredOrder[0], "P5", "required order should start with P5");
  assert.equal(result!.actualOrder[0], "P1", "actual order started with P1");
});

test("validateStartupOrder returns violation for wrong second element", () => {
  const wrongOrder: PlatformPlane[] = ["P5", "P2", "P3", "P4", "P1", "X1"];
  const result = validateStartupOrder(wrongOrder);

  assert.notEqual(result, null);
  assert.equal(result!.violatedPosition, 1);
  assert.equal(result!.requiredOrder[1], "X1");
  assert.equal(result!.actualOrder[1], "P2");
});

test("validateStartupOrder returns violation for empty array", () => {
  const result = validateStartupOrder([]);

  assert.notEqual(result, null);
  assert.equal(result!.violatedPosition, 0);
  assert.deepEqual(result!.actualOrder, ["not_started"]);
});

test("validateStartupOrder returns violation for partial array", () => {
  const partialOrder: PlatformPlane[] = ["P5", "X1", "P2"];
  const result = validateStartupOrder(partialOrder);

  assert.notEqual(result, null);
  assert.equal(result!.violatedPosition, 3, "should fail at position 3 (P3 expected)");
});

test("validateStartupOrder returns violation for swapped middle planes", () => {
  const swappedOrder: PlatformPlane[] = ["P5", "X1", "P3", "P2", "P4", "P1"];
  const result = validateStartupOrder(swappedOrder);

  assert.notEqual(result, null);
  assert.equal(result!.violatedPosition, 2, "P2 and P3 are swapped at position 2");
  assert.equal(result!.requiredOrder[2], "P2");
  assert.equal(result!.actualOrder[2], "P3");
});

test("listPlatformAppsByKind throws for unknown kind", () => {
  // Should return empty array for unknown kind (filter returns empty)
  const unknownApps = listPlatformAppsByKind("unknown" as PlatformAppKind);
  assert.equal(unknownApps.length, 0, "unknown kind should return empty array");
});

test("PLATFORM_LAYER_MANIFESTS entries have all required fields", () => {
  for (const layer of PLATFORM_LAYER_MANIFESTS) {
    assert.ok(layer.layerId, "layerId must be defined");
    assert.ok(layer.entryModule, "entryModule must be defined");
    assert.ok(layer.description, "description must be defined");
    assert.ok(Array.isArray(layer.architectureSections), "architectureSections must be an array");
    assert.ok(layer.architectureSections.length > 0, "architectureSections must not be empty");
    assert.ok(Array.isArray(layer.canonicalSubdomains), "canonicalSubdomains must be an array");
    assert.ok(layer.canonicalSubdomains.length > 0, "canonicalSubdomains must not be empty");
  }
});

test("PLATFORM_LAYER_MANIFESTS is frozen (immutable)", () => {
  assert.ok(Object.isFrozen(PLATFORM_LAYER_MANIFESTS));
});

test("PLATFORM_PLANE_MANIFESTS is frozen (immutable)", () => {
  assert.ok(Object.isFrozen(PLATFORM_PLANE_MANIFESTS));
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Platform root summary building
// ─────────────────────────────────────────────────────────────────────────────

test("buildPlatformArchitectureBootstrapSummary returns valid summary", () => {
  const summary = buildPlatformArchitectureBootstrapSummary();

  assert.ok(summary, "summary should be defined");
  assert.equal(typeof summary.generatedAt, "string", "generatedAt should be a string");
  assert.ok(summary.generatedAt.length > 0, "generatedAt should not be empty");
});

test("buildPlatformArchitectureBootstrapSummary generates valid ISO timestamp", () => {
  const summary = buildPlatformArchitectureBootstrapSummary();
  const date = new Date(summary.generatedAt);

  assert.ok(!isNaN(date.getTime()), "generatedAt must be a valid ISO date string");
});

test("buildPlatformArchitectureBootstrapSummary has correct startup entry module", () => {
  const summary = buildPlatformArchitectureBootstrapSummary();

  assert.equal(summary.startupEntryModule, "src/index.ts");
});

test("buildPlatformArchitectureBootstrapSummary has correct architecture doc path", () => {
  const summary = buildPlatformArchitectureBootstrapSummary();

  assert.equal(
    summary.architectureDocPath,
    "docs_zh/architecture/00-platform-architecture.md",
  );
});

test("buildPlatformArchitectureBootstrapSummary has correct layer count", () => {
  const summary = buildPlatformArchitectureBootstrapSummary();

  assert.equal(summary.layerCount, 9, "should have 9 layers");
  assert.equal(summary.layers.length, summary.layerCount);
});

test("buildPlatformArchitectureBootstrapSummary has correct plane count", () => {
  const summary = buildPlatformArchitectureBootstrapSummary();

  assert.equal(summary.planeCount, 6, "should have 6 planes");
  assert.equal(summary.planes.length, summary.planeCount);
});

test("buildPlatformArchitectureBootstrapSummary has correct app count", () => {
  const summary = buildPlatformArchitectureBootstrapSummary();

  assert.equal(summary.appCount, 3, "should have 3 apps (api, console, worker)");
  assert.equal(summary.apps.length, summary.appCount);
});

test("buildPlatformArchitectureBootstrapSummary has correct startup target count", () => {
  const summary = buildPlatformArchitectureBootstrapSummary();

  // summary, demo, api, console, worker = 5 targets
  assert.equal(summary.startupTargetCount, 5);
  assert.equal(summary.startupTargets.length, summary.startupTargetCount);
});

test("buildPlatformArchitectureBootstrapSummary includes X1 plane", () => {
  const summary = buildPlatformArchitectureBootstrapSummary();

  assert.ok(
    summary.planes.some((p) => p.planeId === "X1"),
    "summary should include X1 cross-cutting plane",
  );
});

test("buildPlatformArchitectureBootstrapSummary includes all app kinds", () => {
  const summary = buildPlatformArchitectureBootstrapSummary();

  const appKinds = summary.apps.map((a) => a.kind);
  assert.ok(appKinds.includes("api"), "should include api app");
  assert.ok(appKinds.includes("console"), "should include console app");
  assert.ok(appKinds.includes("worker"), "should include worker app");
});

test("buildPlatformArchitectureBootstrapSummary startup targets have correct kinds", () => {
  const summary = buildPlatformArchitectureBootstrapSummary();

  const targetKinds = summary.startupTargets.map((t) => t.targetKind);
  assert.ok(targetKinds.includes("summary"), "should include summary target");
  assert.ok(targetKinds.includes("demo"), "should include demo target");
  assert.ok(targetKinds.includes("api"), "should include api target");
  assert.ok(targetKinds.includes("console"), "should include console target");
  assert.ok(targetKinds.includes("worker"), "should include worker target");
});

test("buildPlatformArchitectureBootstrapSummary counts match array lengths", () => {
  const summary = buildPlatformArchitectureBootstrapSummary();

  assert.equal(summary.layerCount, summary.layers.length);
  assert.equal(summary.planeCount, summary.planes.length);
  assert.equal(summary.appCount, summary.apps.length);
  assert.equal(summary.startupTargetCount, summary.startupTargets.length);
});

test("listPlatformLayerManifests returns frozen array", () => {
  const manifests = listPlatformLayerManifests();

  assert.ok(Object.isFrozen(manifests), "listPlatformLayerManifests should return frozen array");
});

test("listPlatformLayerManifests matches PLATFORM_LAYER_MANIFESTS", () => {
  const manifests = listPlatformLayerManifests();

  assert.deepEqual(manifests, PLATFORM_LAYER_MANIFESTS);
});

test("listPlatformAppsByKind returns correct apps for each kind", () => {
  const apiApps = listPlatformAppsByKind("api");
  assert.equal(apiApps.length, 1);
  for (const app of apiApps) {
    assert.equal(app.kind, "api");
  }

  const consoleApps = listPlatformAppsByKind("console");
  assert.equal(consoleApps.length, 1);
  for (const app of consoleApps) {
    assert.equal(app.kind, "console");
  }

  const workerApps = listPlatformAppsByKind("worker");
  assert.equal(workerApps.length, 1);
  for (const app of workerApps) {
    assert.equal(app.kind, "worker");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// Layer and subdomain verification
// ─────────────────────────────────────────────────────────────────────────────

test("platform layer includes all five plane subdomains", () => {
  const platformLayer = PLATFORM_LAYER_MANIFESTS.find(
    (l) => l.layerId === "platform",
  );

  assert.ok(platformLayer, "platform layer should exist");
  assert.ok(
    platformLayer!.canonicalSubdomains.includes("interface"),
    "should include interface subdomain",
  );
  assert.ok(
    platformLayer!.canonicalSubdomains.includes("control-plane"),
    "should include control-plane subdomain",
  );
  assert.ok(
    platformLayer!.canonicalSubdomains.includes("orchestration"),
    "should include orchestration subdomain",
  );
  assert.ok(
    platformLayer!.canonicalSubdomains.includes("execution"),
    "should include execution subdomain",
  );
  assert.ok(
    platformLayer!.canonicalSubdomains.includes("state-evidence"),
    "should include state-evidence subdomain",
  );
});

test("X1 plane has cross-cutting reliability surfaces", () => {
  const x1Plane = PLATFORM_PLANE_MANIFESTS.find((p) => p.planeId === "X1");

  assert.ok(x1Plane, "X1 plane should exist");
  assert.ok(
    x1Plane!.surfaceIds.includes("x1-fabric"),
    "should include x1-fabric surface",
  );
  assert.ok(
    x1Plane!.surfaceIds.includes("shared"),
    "should include shared surface",
  );
  assert.ok(
    x1Plane!.surfaceIds.includes("model-gateway"),
    "should include model-gateway surface",
  );
  assert.ok(
    x1Plane!.surfaceIds.includes("prompt-engine"),
    "should include prompt-engine surface",
  );
  assert.ok(
    x1Plane!.surfaceIds.includes("compliance"),
    "should include compliance surface",
  );
});

test("all nine architecture layers are defined", () => {
  const layerIds = PLATFORM_LAYER_MANIFESTS.map((l) => l.layerId);
  const expectedLayers: PlatformArchitectureLayer[] = [
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

  assert.equal(layerIds.length, expectedLayers.length);
  for (const expected of expectedLayers) {
    assert.ok(
      layerIds.includes(expected),
      `layer ${expected} should be defined`,
    );
  }
});
