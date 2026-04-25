import assert from "node:assert/strict";
import test from "node:test";

import {
  getPlatformApplicationKernel,
  PlatformApplicationKernel,
  registerPlatformApplicationKernel,
} from "../../src/platform-application-kernel.js";
import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";

test("platform application kernel builds startup plans for app targets", () => {
  const kernel = getPlatformApplicationKernel();
  const apiPlan = kernel.buildStartupPlan("api");
  assert.equal(apiPlan.target.targetKind, "api");
  assert.equal(apiPlan.selectedApp?.startupCommand, "npm run api");
  assert.ok(apiPlan.requiredLayerManifests.some((layer) => layer.layerId === "platform"));
  assert.ok(apiPlan.requiredLayerManifests.some((layer) => layer.layerId === "apps"));
  assert.deepEqual(apiPlan.domainsStartupPlan?.startupOrder, ["9a", "9b", "9c", "9d", "9e", "9f"]);
  assert.deepEqual(
    {
      phase9a: apiPlan.domainsRuntimeCatalog?.phase9a.length,
      phase9b: apiPlan.domainsRuntimeCatalog?.phase9b.length,
      phase9c: apiPlan.domainsRuntimeCatalog?.phase9c.length,
      phase9d: apiPlan.domainsRuntimeCatalog?.phase9d.length,
      phase9e: apiPlan.domainsRuntimeCatalog?.phase9e.length,
      phase9f: apiPlan.domainsRuntimeCatalog?.phase9f.length,
    },
    {
      phase9a: 4,
      phase9b: 4,
      phase9c: 6,
      phase9d: 5,
      phase9e: 6,
      phase9f: 6,
    },
  );
  assert.deepEqual(apiPlan.planeStartupPlan?.startupOrder, [
    "interface",
    "control-plane",
    "orchestration",
    "execution",
    "state-evidence",
  ]);
  assert.deepEqual(apiPlan.aiOperationsStartupPlan?.startupOrder, [
    "model-gateway",
    "prompt-engine",
    "compliance",
    "harness",
  ]);
  assert.deepEqual(
    {
      modelGateway: apiPlan.aiOperationsRuntimeCatalog?.modelGateway.length,
      promptEngine: apiPlan.aiOperationsRuntimeCatalog?.promptEngine.length,
      compliance: apiPlan.aiOperationsRuntimeCatalog?.compliance.length,
      harness: apiPlan.aiOperationsRuntimeCatalog?.harness.length,
    },
    {
      modelGateway: 6,
      promptEngine: 5,
      compliance: 5,
      harness: 4,
    },
  );
  assert.deepEqual(apiPlan.interactionGovernanceStartupPlan?.startupOrder, ["interaction", "org-governance"]);
  assert.deepEqual(
    {
      interaction: apiPlan.interactionGovernanceRuntimeCatalog?.interaction.length,
      governance: apiPlan.interactionGovernanceRuntimeCatalog?.governance.length,
    },
    {
      interaction: 6,
      governance: 6,
    },
  );
  assert.deepEqual(apiPlan.scaleOpsStartupPlan?.startupOrder, ["scale-ecosystem", "ops-maturity"]);
  assert.deepEqual(
    {
      scaleEcosystem: apiPlan.scaleOpsRuntimeCatalog?.scaleEcosystem.length,
      opsMaturity: apiPlan.scaleOpsRuntimeCatalog?.opsMaturity.length,
    },
    {
      scaleEcosystem: 11,
      opsMaturity: 12,
    },
  );
});

test("platform application kernel exposes summary and demo startup targets", () => {
  const kernel = getPlatformApplicationKernel();
  const targets = kernel.listStartupTargets();
  assert.deepEqual(targets.map((target) => target.targetKind), ["summary", "demo", "api", "console", "worker"]);
});

test("platform application kernel registers itself in the service registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const kernel = registerPlatformApplicationKernel(registry);
    const snapshot = kernel.buildSnapshot();
    assert.equal(snapshot.appCount, 3);
    assert.equal(snapshot.startupTargetCount, 5);
    assert.equal(registry.isInitialized("architecture.application-kernel"), true);
  } finally {
    await registry.reset();
  }
});

test("PlatformApplicationKernel listLayers returns all layer manifests", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const kernel = new PlatformApplicationKernel();
  const layers = kernel.listLayers();

  assert.ok(Array.isArray(layers));
  assert.ok(layers.length > 0);
  for (const layer of layers) {
    assert.ok("layerId" in layer);
    assert.ok("entryModule" in layer);
    assert.ok("description" in layer);
  }
});

test("PlatformApplicationKernel listApps returns all app manifests", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const kernel = new PlatformApplicationKernel();
  const apps = kernel.listApps();

  assert.ok(Array.isArray(apps));
  assert.ok(apps.length > 0);
  for (const app of apps) {
    assert.ok("appId" in app);
    assert.ok("kind" in app);
    assert.ok("entryModule" in app);
  }
});

test("PlatformApplicationKernel listStartupTargets returns all startup targets", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const kernel = new PlatformApplicationKernel();
  const targets = kernel.listStartupTargets();

  assert.ok(Array.isArray(targets));
  assert.ok(targets.length > 0);
  for (const target of targets) {
    assert.ok("targetKind" in target);
    assert.ok("rootEntryModule" in target);
    assert.ok("requiredLayers" in target);
  }
});

test("PlatformApplicationKernel getApp returns app for valid kind", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const kernel = new PlatformApplicationKernel();
  const apiApp = kernel.getApp("api");

  assert.equal(apiApp.kind, "api");
  assert.ok(apiApp.entryModule.length > 0);
});

test("PlatformApplicationKernel getApp throws for unknown kind", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const kernel = new PlatformApplicationKernel();
  assert.throws(
    () => kernel.getApp("unknown" as any),
    (err: any) => err.message.includes("Unknown platform app kind"),
  );
});

test("PlatformApplicationKernel buildStartupPlan for summary target", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const kernel = new PlatformApplicationKernel();
  const plan = kernel.buildStartupPlan("summary");

  assert.ok(plan.target != null);
  assert.equal(plan.target.targetKind, "summary");
  assert.equal(plan.startupEntryModule, plan.target.rootEntryModule);
  assert.equal(plan.selectedApp, null);
  assert.ok(Array.isArray(plan.requiredLayerManifests));
  // summary target has no required layers
  assert.equal(plan.domainsStartupPlan, null);
  assert.equal(plan.domainsRuntimeCatalog, null);
  assert.equal(plan.planeStartupPlan, null);
  assert.equal(plan.aiOperationsStartupPlan, null);
  assert.equal(plan.aiOperationsRuntimeCatalog, null);
  assert.equal(plan.interactionGovernanceStartupPlan, null);
  assert.equal(plan.interactionGovernanceRuntimeCatalog, null);
  assert.equal(plan.scaleOpsStartupPlan, null);
  assert.equal(plan.scaleOpsRuntimeCatalog, null);
});

test("PlatformApplicationKernel buildStartupPlan for demo target includes platform and apps layers", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const kernel = new PlatformApplicationKernel();
  const plan = kernel.buildStartupPlan("demo");

  assert.ok(plan.target != null);
  assert.equal(plan.target.targetKind, "demo");
  // demo requires platform and apps layers
  assert.ok(plan.planeStartupPlan != null);
  assert.ok(plan.aiOperationsStartupPlan != null);
  assert.ok(plan.aiOperationsRuntimeCatalog != null);
  assert.ok(plan.requiredLayerManifests.length > 0);
});

test("PlatformApplicationKernel buildStartupPlan throws for unknown target kind", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const kernel = new PlatformApplicationKernel();
  assert.throws(
    () => kernel.buildStartupPlan("unknown" as any),
    (err: any) => err.message.includes("Unknown platform startup target"),
  );
});

test("PlatformApplicationKernel buildSnapshot returns valid snapshot", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const kernel = new PlatformApplicationKernel();
  const snapshot = kernel.buildSnapshot();

  assert.ok("generatedAt" in snapshot);
  assert.ok("layerCount" in snapshot);
  assert.ok("appCount" in snapshot);
  assert.ok("startupTargetCount" in snapshot);
  assert.ok("apps" in snapshot);
  assert.ok("startupTargets" in snapshot);

  assert.ok(snapshot.layerCount > 0);
  assert.ok(snapshot.appCount > 0);
  assert.ok(snapshot.startupTargetCount > 0);
  assert.equal(snapshot.apps.length, snapshot.appCount);
  assert.equal(snapshot.startupTargets.length, snapshot.startupTargetCount);

  // generatedAt should be a valid ISO date string
  const date = new Date(snapshot.generatedAt);
  assert.ok(!isNaN(date.getTime()));
});

test("PlatformApplicationKernel buildSnapshot contains apps and startupTargets", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const kernel = new PlatformApplicationKernel();
  const snapshot = kernel.buildSnapshot();

  // Apps should be PlatformAppManifest objects
  for (const app of snapshot.apps) {
    assert.ok("kind" in app);
    assert.ok("appId" in app);
    assert.ok("entryModule" in app);
  }

  // Startup targets should be PlatformStartupTarget objects
  for (const target of snapshot.startupTargets) {
    assert.ok("targetKind" in target);
    assert.ok("rootEntryModule" in target);
    assert.ok("requiredLayers" in target);
  }
});

test("PlatformApplicationKernel instance is reusable after registry reset", async () => {
  const registry = ServiceRegistry.getInstance();

  // First usage
  await registry.reset();
  const kernel1 = new PlatformApplicationKernel();
  const apps1 = kernel1.listApps();

  // After reset
  await registry.reset();
  const kernel2 = new PlatformApplicationKernel();
  const apps2 = kernel2.listApps();

  assert.equal(apps1.length, apps2.length);
});

test("PlatformApplicationKernel startupPlan requiredLayerManifests filtering works", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const kernel = new PlatformApplicationKernel();
  const plan = kernel.buildStartupPlan("api");

  // Verify requiredLayerManifests contains only layers that are in requiredLayers
  const requiredLayerIds = new Set(plan.target.requiredLayers);
  for (const manifest of plan.requiredLayerManifests) {
    assert.ok(requiredLayerIds.has(manifest.layerId));
  }
});

test("PlatformApplicationKernel snapshot has deterministic layer count", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const kernel = new PlatformApplicationKernel();
  const snapshot1 = kernel.buildSnapshot();
  const snapshot2 = kernel.buildSnapshot();

  // Layer count should be consistent
  assert.equal(snapshot1.layerCount, snapshot2.layerCount);
  assert.equal(snapshot1.layerCount, kernel.listLayers().length);
});

test("getPlatformApplicationKernel registers if not initialized", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const kernel = getPlatformApplicationKernel(registry);

  assert.ok(kernel != null);
  assert.equal(registry.isInitialized("architecture.application-kernel"), true);
});

test("getPlatformApplicationKernel returns same instance on multiple calls", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const kernel1 = getPlatformApplicationKernel(registry);
  const kernel2 = getPlatformApplicationKernel(registry);

  assert.equal(kernel1, kernel2);
});
