import assert from "node:assert/strict";
import test from "node:test";

import {
  buildPlatformArchitectureBootstrapSummary,
  getPlatformArchitectureServices,
  listPlatformAppsByKind,
  listPlatformLayerManifests,
  registerPlatformArchitectureServices,
  PLATFORM_LAYER_MANIFESTS,
  PLATFORM_PLANE_MANIFESTS,
} from "../../src/platform-architecture-bootstrap.js";
import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";
import { ArchitectureInvariantRegistry, NonOverridableInvariantRegistry } from "../../src/platform/architecture/invariant-registry.js";

test("integration: full bootstrap flow with fresh service registry", async () => {
  const registry = new ServiceRegistry();

  try {
    // Register architecture services
    const services = registerPlatformArchitectureServices(registry);

    // Registration should stay lazy until services are explicitly resolved.
    assert.equal(registry.isInitialized("architecture.layer-catalog"), false);
    assert.equal(registry.isInitialized("architecture.plane-catalog"), false);
    assert.equal(registry.isInitialized("architecture.app-catalog"), false);
    assert.equal(registry.isInitialized("architecture.startup-targets"), false);
    assert.equal(registry.isInitialized("architecture.bootstrap-summary"), false);

    // Verify service data integrity
    assert.equal(services.layers.length, 9);
    assert.equal(services.planes.length, 6);
    assert.equal(services.apps.length, 3);
    assert.equal(services.startupTargets.length, 5);

    // Verify summary matches individual services
    assert.equal(services.summary.layerCount, services.layers.length);
    assert.equal(services.summary.planeCount, services.planes.length);
    assert.equal(services.summary.appCount, services.apps.length);
    assert.equal(services.summary.startupTargetCount, services.startupTargets.length);
  } finally {
    await registry.reset();
  }
});

test("integration: architecture invariants are properly registered", () => {
  const invariantRegistry = new ArchitectureInvariantRegistry();
  const invariants = invariantRegistry.list();

  // MVP phase invariants must be present
  const mvpInvariantIds = ["INV-STATE-001", "INV-RUN-001", "INV-GRAPH-001", "INV-BUDGET-001", "INV-REPLAY-001", "INV-SIDEEFFECT-001", "INV-POLICY-001"];
  for (const invariantId of mvpInvariantIds) {
    const invariant = invariants.find((inv) => inv.invariantId === invariantId);
    assert.ok(invariant, `MVP invariant ${invariantId} must be registered`);
    assert.equal(invariant!.phase, "MVP");
  }
});

test("integration: non-overridable invariants cannot be overridden", () => {
  const nonOverridableRegistry = new NonOverridableInvariantRegistry();

  // These invariants are marked nonOverridable: true
  const nonOverridableIds = ["INV-STATE-001", "INV-RUN-001", "INV-GRAPH-001", "INV-BUDGET-001", "INV-REPLAY-001", "INV-SIDEEFFECT-001", "INV-POLICY-001", "INV-RISK-001"];
  for (const invariantId of nonOverridableIds) {
    assert.ok(
      !nonOverridableRegistry.canOverride(invariantId),
      `Invariant ${invariantId} should not be overridable`,
    );
  }
});

test("integration: release gate readiness check passes", () => {
  const invariantRegistry = new ArchitectureInvariantRegistry();
  assert.doesNotThrow(() => invariantRegistry.assertReleaseGateReady());
});

test("integration: layer manifests include all required architecture sections", () => {
  const layers = listPlatformLayerManifests();

  // Platform layer should reference §5, §6, §24, §29
  const platformLayer = layers.find((l) => l.layerId === "platform");
  assert.ok(platformLayer);
  assert.ok(platformLayer!.architectureSections.includes("§5"));
  assert.ok(platformLayer!.architectureSections.includes("§6"));
  assert.ok(platformLayer!.architectureSections.includes("§24"));
  assert.ok(platformLayer!.architectureSections.includes("§29"));

  // Domains layer should reference §37, §38
  const domainsLayer = layers.find((l) => l.layerId === "domains");
  assert.ok(domainsLayer);
  assert.ok(domainsLayer!.architectureSections.includes("§37"));
  assert.ok(domainsLayer!.architectureSections.includes("§38"));
});

test("integration: plane manifests cover all five planes plus X1", () => {
  const planes = PLATFORM_PLANE_MANIFESTS;

  // Verify P5 is state-evidence plane
  const p5 = planes.find((p) => p.planeId === "P5");
  assert.ok(p5);
  assert.ok(p5!.surfaceIds.includes("state-evidence"));

  // Verify X1 cross-cutting fabric
  const x1 = planes.find((p) => p.planeId === "X1");
  assert.ok(x1);
  assert.ok(x1!.surfaceIds.includes("x1-fabric"));
  assert.ok(x1!.surfaceIds.includes("model-gateway"));
  assert.ok(x1!.surfaceIds.includes("prompt-engine"));
  assert.ok(x1!.surfaceIds.includes("compliance"));

  // Verify P2 is control plane
  const p2 = planes.find((p) => p.planeId === "P2");
  assert.ok(p2);
  assert.ok(p2!.surfaceIds.includes("control-plane"));

  // Verify P3 is orchestration plane
  const p3 = planes.find((p) => p.planeId === "P3");
  assert.ok(p3);
  assert.ok(p3!.surfaceIds.includes("orchestration"));

  // Verify P4 is execution plane
  const p4 = planes.find((p) => p.planeId === "P4");
  assert.ok(p4);
  assert.ok(p4!.surfaceIds.includes("execution"));

  // Verify P1 is interface plane
  const p1 = planes.find((p) => p.planeId === "P1");
  assert.ok(p1);
  assert.ok(p1!.surfaceIds.includes("interface"));
});

test("integration: startup targets include summary, demo, and all app kinds", () => {
  const summary = buildPlatformArchitectureBootstrapSummary();
  const targetKinds = summary.startupTargets.map((t) => t.targetKind);

  assert.ok(targetKinds.includes("summary"));
  assert.ok(targetKinds.includes("demo"));
  assert.ok(targetKinds.includes("api"));
  assert.ok(targetKinds.includes("console"));
  assert.ok(targetKinds.includes("worker"));
});

test("integration: app manifests have required capabilities and layers", () => {
  const summary = buildPlatformArchitectureBootstrapSummary();

  for (const app of summary.apps) {
    assert.ok(app.appId, "appId must be defined");
    assert.ok(app.kind, "kind must be defined");
    assert.ok(app.entryModule, "entryModule must be defined");
    assert.ok(app.startupCommand, "startupCommand must be defined");
    assert.ok(Array.isArray(app.capabilities));
    assert.ok(Array.isArray(app.requiredLayers));
    assert.ok(app.requiredLayers.length > 0, "Each app must require at least one layer");
  }
});

test("integration: getPlatformArchitectureServices can be called multiple times", async () => {
  const registry = new ServiceRegistry();

  try {
    const services1 = getPlatformArchitectureServices(registry);
    const services2 = getPlatformArchitectureServices(registry);

    // Should return equivalent services
    assert.equal(services1.layers.length, services2.layers.length);
    assert.equal(services1.planes.length, services2.planes.length);
    assert.equal(services1.apps.length, services2.apps.length);
    assert.equal(services1.startupTargets.length, services2.startupTargets.length);
  } finally {
    await registry.reset();
  }
});

test("integration: service registry properly initializes all architecture services", async () => {
  const registry = new ServiceRegistry();

  try {
    // Register all services
    registerPlatformArchitectureServices(registry);

    // Eagerly initialize all
    await registry.initializeAll();

    // Verify all are initialized
    assert.ok(registry.isInitialized("architecture.layer-catalog"));
    assert.ok(registry.isInitialized("architecture.plane-catalog"));
    assert.ok(registry.isInitialized("architecture.app-catalog"));
    assert.ok(registry.isInitialized("architecture.startup-targets"));
    assert.ok(registry.isInitialized("architecture.bootstrap-summary"));

    // Get services through registry directly
    const layers = registry.get("architecture.layer-catalog");
    const planes = registry.get("architecture.plane-catalog");
    const apps = registry.get("architecture.app-catalog");
    const targets = registry.get("architecture.startup-targets");
    const summary = registry.get("architecture.bootstrap-summary");

    assert.ok(Array.isArray(layers));
    assert.ok(Array.isArray(planes));
    assert.ok(Array.isArray(apps));
    assert.ok(Array.isArray(targets));
    assert.ok(summary != null);
  } finally {
    await registry.reset();
  }
});

test("integration: teardown clears architecture service instances", async () => {
  const registry = new ServiceRegistry();

  // Register and initialize
  getPlatformArchitectureServices(registry);

  // Verify initialized
  assert.ok(registry.isInitialized("architecture.layer-catalog"));

  // Teardown
  await registry.teardownAll();

  // After teardown, instances are cleared but registrations remain
  // Calling get should re-initialize
  const layers = registry.get("architecture.layer-catalog");
  assert.ok(Array.isArray(layers));

  await registry.reset();
});

test("integration: bootstrap summary contains valid architecture documentation references", () => {
  const summary = buildPlatformArchitectureBootstrapSummary();

  // All layer architecture sections should reference actual paragraphs
  for (const layer of summary.layers) {
    for (const section of layer.architectureSections) {
      assert.ok(section.startsWith("§"), `Layer ${layer.layerId} section ${section} should start with §`);
      const numStr = section.slice(1);
      const num = parseInt(numStr, 10);
      assert.ok(!isNaN(num) && num > 0, `Section ${section} should be a valid paragraph number`);
    }
  }

  // All plane architecture sections should reference actual paragraphs
  for (const plane of summary.planes) {
    for (const section of plane.architectureSections) {
      assert.ok(section.startsWith("§"), `Plane ${plane.planeId} section ${section} should start with §`);
    }
  }
});
