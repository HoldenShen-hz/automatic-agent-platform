import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";
import {
  PlatformApplicationKernel,
  registerPlatformApplicationKernel,
  getPlatformApplicationKernel,
} from "../../../../src/platform-application-kernel.js";

test("PlatformApplicationKernel.listLayers returns 9 layers", async () => {
  const kernel = new PlatformApplicationKernel();
  const layers = kernel.listLayers();

  assert.ok(Array.isArray(layers));
  assert.equal(layers.length, 9);
});

test("PlatformApplicationKernel.listApps returns platform apps", async () => {
  const kernel = new PlatformApplicationKernel();
  const apps = kernel.listApps();

  assert.ok(Array.isArray(apps));
  assert.ok(apps.length > 0);

  for (const app of apps) {
    assert.ok(typeof app.appId === "string");
    assert.ok(typeof app.kind === "string");
    assert.ok(["api", "console", "worker"].includes(app.kind));
  }
});

test("PlatformApplicationKernel.listStartupTargets returns startup targets", async () => {
  const kernel = new PlatformApplicationKernel();
  const targets = kernel.listStartupTargets();

  assert.ok(Array.isArray(targets));
  assert.ok(targets.length >= 3); // summary, demo, and app targets

  const targetKinds = targets.map((t) => t.targetKind);
  assert.ok(targetKinds.includes("summary"));
  assert.ok(targetKinds.includes("demo"));
});

test("PlatformApplicationKernel.getApp returns app manifest for valid kind", async () => {
  const kernel = new PlatformApplicationKernel();

  const apiApp = kernel.getApp("api");
  assert.equal(apiApp.kind, "api");

  const consoleApp = kernel.getApp("console");
  assert.equal(consoleApp.kind, "console");

  const workerApp = kernel.getApp("worker");
  assert.equal(workerApp.kind, "worker");
});

test("PlatformApplicationKernel.getApp throws for unknown kind", async () => {
  const kernel = new PlatformApplicationKernel();

  assert.throws(
    () => kernel.getApp("unknown" as any),
    (err: any) => err.message.includes("Unknown platform app kind"),
  );
});

test("PlatformApplicationKernel.buildStartupPlan for summary target", async () => {
  const kernel = new PlatformApplicationKernel();
  const plan = kernel.buildStartupPlan("summary");

  assert.equal(plan.target.targetKind, "summary");
  assert.equal(plan.startupEntryModule, "src/index.ts");
  assert.equal(plan.selectedApp, null);
  assert.ok(Array.isArray(plan.requiredLayerManifests));
});

test("PlatformApplicationKernel.buildStartupPlan for api target", async () => {
  const kernel = new PlatformApplicationKernel();
  const plan = kernel.buildStartupPlan("api");

  assert.equal(plan.target.targetKind, "api");
  assert.ok(plan.selectedApp !== null);
  assert.equal(plan.selectedApp.kind, "api");

  // API requires many layers
  assert.ok(plan.requiredLayerManifests.length > 0);
});

test("PlatformApplicationKernel.buildStartupPlan includes domains startup plan when required", async () => {
  const kernel = new PlatformApplicationKernel();

  // api target requires domains layer
  const apiPlan = kernel.buildStartupPlan("api");
  assert.ok(apiPlan.domainsStartupPlan !== null);

  // summary target requires no layers
  const summaryPlan = kernel.buildStartupPlan("summary");
  assert.equal(summaryPlan.domainsStartupPlan, null);
});

test("PlatformApplicationKernel.buildStartupPlan includes planeStartupPlan when platform layer required", async () => {
  const kernel = new PlatformApplicationKernel();

  // demo target requires platform layer
  const demoPlan = kernel.buildStartupPlan("demo");
  assert.ok(demoPlan.planeStartupPlan !== null);
  assert.ok(demoPlan.aiOperationsStartupPlan !== null);
});

test("PlatformApplicationKernel.buildStartupPlan includes interactionGovernance plans when interaction layer required", async () => {
  const kernel = new PlatformApplicationKernel();

  const apiPlan = kernel.buildStartupPlan("api");
  assert.ok(apiPlan.interactionGovernanceStartupPlan !== null);
  assert.ok(apiPlan.interactionGovernanceRuntimeCatalog !== null);
});

test("PlatformApplicationKernel.buildStartupPlan includes scaleOps plans when scale-ecosystem layer required", async () => {
  const kernel = new PlatformApplicationKernel();

  // api target requires scale-ecosystem
  const apiPlan = kernel.buildStartupPlan("api");
  assert.ok(apiPlan.scaleOpsStartupPlan !== null);
  assert.ok(apiPlan.scaleOpsRuntimeCatalog !== null);
});

test("PlatformApplicationKernel.buildSnapshot returns snapshot with metadata", async () => {
  const kernel = new PlatformApplicationKernel();
  const snapshot = kernel.buildSnapshot();

  assert.ok(typeof snapshot.generatedAt === "string");
  assert.equal(snapshot.layerCount, 9);
  assert.ok(snapshot.appCount >= 0);
  assert.ok(snapshot.startupTargetCount >= 0);
  assert.ok(Array.isArray(snapshot.apps));
  assert.ok(Array.isArray(snapshot.startupTargets));
});

test("PlatformApplicationKernel.buildSnapshot generatedAt is ISO format", async () => {
  const kernel = new PlatformApplicationKernel();
  const snapshot = kernel.buildSnapshot();
  const date = new Date(snapshot.generatedAt);

  assert.ok(!isNaN(date.getTime()));
  assert.ok(snapshot.generatedAt.includes("T"));
});

test("registerPlatformApplicationKernel registers application kernel service", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const kernel = registerPlatformApplicationKernel(registry);

  assert.ok(kernel instanceof PlatformApplicationKernel);
  assert.equal(registry.isInitialized("architecture.application-kernel"), true);
});

test("getPlatformApplicationKernel returns same instance", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const kernel1 = getPlatformApplicationKernel(registry);
  const kernel2 = getPlatformApplicationKernel(registry);

  assert.equal(kernel1, kernel2);
});

test("getPlatformApplicationKernel initializes on first call", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  // Should not be initialized yet
  assert.equal(registry.isInitialized("architecture.application-kernel"), false);

  const kernel = getPlatformApplicationKernel(registry);

  // Now should be initialized
  assert.ok(kernel instanceof PlatformApplicationKernel);
  assert.equal(registry.isInitialized("architecture.application-kernel"), true);
});

test("PlatformApplicationKernel methods return consistent results", async () => {
  const kernel = new PlatformApplicationKernel();

  const layers1 = kernel.listLayers();
  const layers2 = kernel.listLayers();
  assert.equal(layers1.length, layers2.length);

  const apps1 = kernel.listApps();
  const apps2 = kernel.listApps();
  assert.equal(apps1.length, apps2.length);

  const targets1 = kernel.listStartupTargets();
  const targets2 = kernel.listStartupTargets();
  assert.equal(targets1.length, targets2.length);
});
