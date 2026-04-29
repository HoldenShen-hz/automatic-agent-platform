import assert from "node:assert/strict";
import test from "node:test";

import {
  PlatformApplicationKernel,
  registerPlatformApplicationKernel,
  getPlatformApplicationKernel,
} from "../../src/platform-application-kernel.js";
import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";

test("integration: registerPlatformApplicationKernel integrates with service registry lifecycle", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  try {
    const kernel = registerPlatformApplicationKernel(registry);

    // Verify kernel is properly registered and retrievable
    assert.ok(registry.isInitialized("architecture.application-kernel"));
    const retrieved = registry.get<PlatformApplicationKernel>("architecture.application-kernel");
    assert.strictEqual(retrieved, kernel);
  } finally {
    await registry.reset();
  }
});

test("integration: getPlatformApplicationKernel integrates with existing architecture services", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  try {
    // Get kernel which auto-registers
    const kernel = getPlatformApplicationKernel(registry);

    // Verify kernel can access architecture services
    const layers = kernel.listLayers();
    const apps = kernel.listApps();
    const targets = kernel.listStartupTargets();

    assert.ok(layers.length > 0, "should have layers from architecture bootstrap");
    assert.ok(apps.length > 0, "should have apps from architecture bootstrap");
    assert.ok(targets.length > 0, "should have startup targets from architecture bootstrap");

    // Verify kernel snapshot integrates all services
    const snapshot = kernel.buildSnapshot();
    assert.equal(snapshot.layerCount, layers.length);
    assert.equal(snapshot.appCount, apps.length);
    assert.equal(snapshot.startupTargetCount, targets.length);
  } finally {
    await registry.reset();
  }
});

test("integration: buildStartupPlan integrates with all startup plan builders", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  try {
    const kernel = getPlatformApplicationKernel(registry);

    // Valid target kinds are: summary, demo, api, console, worker
    const targetKinds = ["summary", "demo", "api", "console", "worker"] as const;

    for (const targetKind of targetKinds) {
      const plan = kernel.buildStartupPlan(targetKind);
      assert.ok(plan != null, `plan should be created for ${targetKind}`);
      assert.ok(plan.target != null, `plan target should exist for ${targetKind}`);
      assert.equal(plan.target.targetKind, targetKind, `plan targetKind should match for ${targetKind}`);
    }
  } finally {
    await registry.reset();
  }
});

test("integration: kernel operates correctly across multiple operations", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  try {
    const kernel = getPlatformApplicationKernel(registry);

    // Perform multiple operations and verify consistency
    const layers1 = kernel.listLayers();
    const apps1 = kernel.listApps();
    const targets1 = kernel.listStartupTargets();
    const snapshot1 = kernel.buildSnapshot();

    // Repeat operations
    const layers2 = kernel.listLayers();
    const apps2 = kernel.listApps();
    const targets2 = kernel.listStartupTargets();
    const snapshot2 = kernel.buildSnapshot();

    // Verify results are consistent (same content, may be different object references)
    assert.deepStrictEqual(layers1, layers2);
    assert.deepStrictEqual(apps1, apps2);
    assert.deepStrictEqual(targets1, targets2);
    assert.equal(snapshot1.layerCount, snapshot2.layerCount);
    assert.equal(snapshot1.appCount, snapshot2.appCount);
    assert.equal(snapshot1.startupTargetCount, snapshot2.startupTargetCount);
  } finally {
    await registry.reset();
  }
});

test("integration: kernel works with fresh registry after reset", async () => {
  const registry = ServiceRegistry.getInstance();

  // First instance
  await registry.reset();
  const kernel1 = getPlatformApplicationKernel(registry);
  const snapshot1 = kernel1.buildSnapshot();

  // Reset and get new instance
  await registry.reset();
  const kernel2 = getPlatformApplicationKernel(registry);
  const snapshot2 = kernel2.buildSnapshot();

  // Both should work independently
  assert.ok(snapshot1.layerCount > 0);
  assert.ok(snapshot2.layerCount > 0);

  // Snapshots should have same structure but different generatedAt
  assert.equal(snapshot1.layerCount, snapshot2.layerCount);
  assert.equal(snapshot1.appCount, snapshot2.appCount);
  // Note: generatedAt may be the same if tests run within same second - that's acceptable
  assert.ok(snapshot1.generatedAt != null);
  assert.ok(snapshot2.generatedAt != null);

  await registry.reset();
});

test("integration: buildStartupPlan correctly aggregates required layers from target and app", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  try {
    const kernel = getPlatformApplicationKernel(registry);

    // Get demo target which requires ["platform", "apps"]
    const plan = kernel.buildStartupPlan("demo");

    // Should have platform layer (from requiredLayers) and apps layer (from appManifest.requiredLayers)
    assert.ok(plan.requiredLayerManifests.length >= 2, "should have at least platform and apps layers");
    const layerIds = plan.requiredLayerManifests.map((l) => l.layerId);
    assert.ok(layerIds.includes("platform"), "should include platform layer");
    assert.ok(layerIds.includes("apps"), "should include apps layer");
  } finally {
    await registry.reset();
  }
});

test("integration: kernel correctly handles all target kinds without throwing", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  try {
    const kernel = getPlatformApplicationKernel(registry);
    const targets = kernel.listStartupTargets();

    for (const target of targets) {
      const plan = kernel.buildStartupPlan(target.targetKind);
      assert.ok(plan != null, `plan should be created for ${target.targetKind}`);
      assert.ok(plan.requiredLayerManifests != null, `requiredLayerManifests should exist for ${target.targetKind}`);
    }
  } finally {
    await registry.reset();
  }
});
