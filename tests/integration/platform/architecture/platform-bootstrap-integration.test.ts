import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";
import {
  registerPlatformSurfaceCatalog,
  listPlatformSurfaceManifests,
  listArchitectureReadinessRings,
  PLATFORM_SURFACE_MANIFESTS,
  ARCHITECTURE_READINESS_RINGS,
} from "../../../../src/platform/platform-module-catalog.js";
import {
  registerFivePlaneRuntimeCatalog,
  buildFivePlaneRuntimeCatalog,
} from "../../../../src/platform/five-plane-runtime-bootstrap.js";
import {
  buildFivePlaneStartupPlan,
  registerFivePlaneStartupPlan,
} from "../../../../src/platform/five-plane-startup-plan.js";
import {
  FivePlaneRuntimeOrchestrator,
  registerFivePlaneRuntimeOrchestrator,
} from "../../../../src/platform/five-plane-runtime-orchestrator.js";

test("integration: registerPlatformSurfaceCatalog registers all 11 surfaces", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const manifests = registerPlatformSurfaceCatalog(registry);

    assert.ok(registry.isInitialized("platform.surface-catalog"));
    assert.equal(manifests.length, 11);
    assert.deepEqual(
      manifests.map((m) => m.surfaceId),
      ["contracts", "interface", "x1-fabric", "control-plane", "orchestration", "execution", "state-evidence", "model-gateway", "prompt-engine", "shared", "compliance"],
    );
  } finally {
    await registry.reset();
  }
});

test("integration: five-plane catalog and module catalog can be registered together", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerPlatformSurfaceCatalog(registry);
    registerFivePlaneRuntimeCatalog(registry);

    const surfaces = listPlatformSurfaceManifests();
    const catalog = buildFivePlaneRuntimeCatalog();

    assert.ok(surfaces.length > 0);
    assert.ok(catalog.interfacePlane.length > 0);
  } finally {
    await registry.reset();
  }
});

test("integration: startup plan is consistent with runtime catalog", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerFivePlaneRuntimeCatalog(registry);
    const plan = registerFivePlaneStartupPlan(registry);

    // The startup plan should cover all planes from the runtime catalog
    const planeStepIds = plan.steps.map((s) => s.stepId);
    assert.ok(planeStepIds.includes("interface"));
    assert.ok(planeStepIds.includes("x1-fabric"));
    assert.ok(planeStepIds.includes("control-plane"));
    assert.ok(planeStepIds.includes("orchestration"));
    assert.ok(planeStepIds.includes("execution"));
    assert.ok(planeStepIds.includes("state-evidence"));
  } finally {
    await registry.reset();
  }
});

test("integration: full platform bootstrap sequence", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    // Step 1: Register surface catalog
    registerPlatformSurfaceCatalog(registry);
    assert.ok(registry.isInitialized("platform.surface-catalog"));

    // Step 2: Register five-plane runtime catalog
    const catalog = registerFivePlaneRuntimeCatalog(registry);
    assert.ok(registry.isInitialized("plane.runtime.catalog"));

    // Step 3: Register startup plan
    const plan = registerFivePlaneStartupPlan(registry);
    assert.ok(registry.isInitialized("plane.runtime.startup-plan"));

    // Step 4: Register orchestrator
    const orchestrator = registerFivePlaneRuntimeOrchestrator(registry);
    assert.ok(registry.isInitialized("plane.runtime.orchestrator"));

    // Verify everything is wired correctly
    const result = orchestrator.startup();
    assert.equal(result.ready, true);
    assert.equal(result.runtimeCatalog.interfacePlane.length, catalog.interfacePlane.length);
    assert.equal(result.startupOrder.length, 6);
  } finally {
    await registry.reset();
  }
});

test("integration: architecture rings are accessible", () => {
  const rings = listArchitectureReadinessRings();
  assert.equal(rings.length, 4);
  assert.ok(rings.some((r) => r.ringId === "contract-freeze"));
  assert.ok(rings.some((r) => r.ringId === "hardening"));
  assert.ok(rings.some((r) => r.ringId === "usability"));
  assert.ok(rings.some((r) => r.ringId === "expansion"));
});

test("integration: PLATFORM_SURFACE_MANIFESTS frozen array is consistent", () => {
  assert.ok(Object.isFrozen(PLATFORM_SURFACE_MANIFESTS));
  assert.equal(PLATFORM_SURFACE_MANIFESTS.length, 11);
});

test("integration: ARCHITECTURE_READINESS_RINGS frozen array is consistent", () => {
  assert.ok(Object.isFrozen(ARCHITECTURE_READINESS_RINGS));
  assert.equal(ARCHITECTURE_READINESS_RINGS.length, 4);
});

test("integration: FivePlaneRuntimeOrchestrator coordinates bootstrap sequence", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new FivePlaneRuntimeOrchestrator(registry);

    const { startupPlan, runtimeCatalog } = orchestrator.prepare();

    // After prepare, both should be available
    assert.ok(startupPlan);
    assert.ok(runtimeCatalog);
    assert.equal(startupPlan.steps.length, 6);
    assert.equal(runtimeCatalog.interfacePlane.length, 6);

    // Startup should succeed
    const result = orchestrator.startup();
    assert.equal(result.ready, true);
    assert.equal(result.steps.length, 6);

    // All planes should be initialized
    for (const step of result.steps) {
      assert.equal(step.initialized, true, `${step.stepId} should be initialized`);
    }
  } finally {
    await registry.reset();
  }
});

test("integration: service registry tracks initialization state", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerFivePlaneRuntimeOrchestrator(registry);

    // Before startup, some services may not be initialized yet
    const beforeSnapshot = orchestrator.snapshotReadiness();

    // After startup, all should be initialized
    orchestrator.startup();
    const afterSnapshot = orchestrator.snapshotReadiness();

    assert.equal(afterSnapshot.runtimeCatalogInitialized, true);
    assert.equal(afterSnapshot.startupPlanInitialized, true);
    assert.equal(afterSnapshot.orchestratorInitialized, true);
  } finally {
    await registry.reset();
  }
});
