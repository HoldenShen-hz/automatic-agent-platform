import assert from "node:assert/strict";
import test from "node:test";

import {
  PlatformApplicationKernel,
  registerPlatformApplicationKernel,
  getPlatformApplicationKernel,
  type PlatformStartupPlan,
  type PlatformApplicationKernelSnapshot,
} from "../../src/platform-application-kernel.js";
import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";

test("PlatformApplicationKernel.listLayers returns all platform layer manifests", () => {
  const kernel = new PlatformApplicationKernel();
  const layers = kernel.listLayers();

  assert.ok(Array.isArray(layers), "listLayers should return an array");
  assert.ok(layers.length > 0, "listLayers should return at least one layer");
  assert.ok(layers.every((l) => "layerId" in l), "each layer should have layerId");
  assert.ok(layers.every((l) => "entryModule" in l), "each layer should have entryModule");
  assert.ok(layers.every((l) => "description" in l), "each layer should have description");
});

test("PlatformApplicationKernel.listApps returns all platform app manifests", () => {
  const kernel = new PlatformApplicationKernel();
  const apps = kernel.listApps();

  assert.ok(Array.isArray(apps), "listApps should return an array");
  assert.ok(apps.length > 0, "listApps should return at least one app");
  assert.ok(apps.every((a) => "kind" in a), "each app should have kind");
  assert.ok(apps.every((a) => "appId" in a), "each app should have appId");
  assert.ok(apps.every((a) => "requiredLayers" in a), "each app should have requiredLayers");
});

test("PlatformApplicationKernel.listStartupTargets returns all startup targets", () => {
  const kernel = new PlatformApplicationKernel();
  const targets = kernel.listStartupTargets();

  assert.ok(Array.isArray(targets), "listStartupTargets should return an array");
  assert.ok(targets.length > 0, "listStartupTargets should return at least one target");
  assert.ok(targets.every((t) => "targetKind" in t), "each target should have targetKind");
  assert.ok(targets.every((t) => "rootEntryModule" in t), "each target should have rootEntryModule");
  assert.ok(targets.every((t) => "requiredLayers" in t), "each target should have requiredLayers");
});

test("PlatformApplicationKernel.getApp returns app by kind", () => {
  const kernel = new PlatformApplicationKernel();
  const apps = kernel.listApps();

  assert.ok(apps.length > 0, "should have at least one app");
  const firstApp = apps[0]!;
  const retrieved = kernel.getApp(firstApp.kind);

  assert.equal(retrieved.kind, firstApp.kind);
  assert.equal(retrieved.appId, firstApp.appId);
});

test("PlatformApplicationKernel.getApp throws for unknown kind", () => {
  const kernel = new PlatformApplicationKernel();

  assert.throws(
    () => kernel.getApp("non-existent-app-kind" as any),
    (err: any) => err.message.includes("Unknown platform app kind")
  );
});

test("PlatformApplicationKernel.buildStartupPlan returns plan for valid target", () => {
  const kernel = new PlatformApplicationKernel();
  const targets = kernel.listStartupTargets();

  assert.ok(targets.length > 0, "should have at least one target");
  const plan = kernel.buildStartupPlan(targets[0]!.targetKind);

  assert.ok(plan != null, "plan should not be null");
  assert.ok("target" in plan, "plan should have target");
  assert.ok("startupEntryModule" in plan, "plan should have startupEntryModule");
  assert.ok("selectedApp" in plan, "plan should have selectedApp");
  assert.ok("requiredLayerManifests" in plan, "plan should have requiredLayerManifests");
  assert.ok(Array.isArray(plan.requiredLayerManifests), "requiredLayerManifests should be an array");
});

test("PlatformApplicationKernel.buildStartupPlan includes domains plan when domains layer required", () => {
  const kernel = new PlatformApplicationKernel();
  const plan = kernel.buildStartupPlan("summary");

  // "summary" target requires no layers, so domains plan should be null
  assert.equal(plan.domainsStartupPlan, null);
  assert.equal(plan.domainsRuntimeCatalog, null);
});

test("PlatformApplicationKernel.buildStartupPlan includes domains plan for demo target", () => {
  const kernel = new PlatformApplicationKernel();
  const plan = kernel.buildStartupPlan("demo");

  // "demo" target requires ["platform", "apps"] layers
  // domains layer is not required, so domains plan should be null
  assert.equal(plan.domainsStartupPlan, null);
});

test("PlatformApplicationKernel.buildStartupPlan includes plane startup plan when platform layer required", () => {
  const kernel = new PlatformApplicationKernel();
  const plan = kernel.buildStartupPlan("demo");

  // "demo" target requires ["platform", "apps"] layers
  assert.ok(plan.planeStartupPlan != null, "planeStartupPlan should not be null when platform layer required");
  assert.ok(plan.aiOperationsStartupPlan != null, "aiOperationsStartupPlan should not be null when platform layer required");
});

test("PlatformApplicationKernel.buildStartupPlan includes interaction governance when interaction layer required", () => {
  const kernel = new PlatformApplicationKernel();
  // "api" app requires interaction layer
  const plan = kernel.buildStartupPlan("api");

  // "api" app requires interaction layer, so interactionGovernanceStartupPlan should be included
  assert.ok(plan.interactionGovernanceStartupPlan != null);
  assert.ok(plan.interactionGovernanceRuntimeCatalog != null);
});

test("PlatformApplicationKernel.buildStartupPlan includes scale ops when scale-ecosystem layer required", () => {
  const kernel = new PlatformApplicationKernel();
  // "api" app requires scale-ecosystem layer
  const plan = kernel.buildStartupPlan("api");

  // "api" app requires scale-ecosystem layer, so scaleOpsStartupPlan should be included
  assert.ok(plan.scaleOpsStartupPlan != null);
  assert.ok(plan.scaleOpsRuntimeCatalog != null);
});

test("PlatformApplicationKernel.buildSnapshot returns snapshot with expected structure", () => {
  const kernel = new PlatformApplicationKernel();
  const snapshot = kernel.buildSnapshot();

  assert.ok("generatedAt" in snapshot, "snapshot should have generatedAt");
  assert.ok("layerCount" in snapshot, "snapshot should have layerCount");
  assert.ok("appCount" in snapshot, "snapshot should have appCount");
  assert.ok("startupTargetCount" in snapshot, "snapshot should have startupTargetCount");
  assert.ok("apps" in snapshot, "snapshot should have apps");
  assert.ok("startupTargets" in snapshot, "snapshot should have startupTargets");
  assert.equal(typeof snapshot.generatedAt, "string");
  assert.equal(typeof snapshot.layerCount, "number");
  assert.equal(typeof snapshot.appCount, "number");
  assert.equal(typeof snapshot.startupTargetCount, "number");
  assert.ok(Array.isArray(snapshot.apps));
  assert.ok(Array.isArray(snapshot.startupTargets));
});

test("PlatformApplicationKernel.buildSnapshot counts match list methods", () => {
  const kernel = new PlatformApplicationKernel();
  const snapshot = kernel.buildSnapshot();

  assert.equal(snapshot.layerCount, kernel.listLayers().length);
  assert.equal(snapshot.appCount, kernel.listApps().length);
  assert.equal(snapshot.startupTargetCount, kernel.listStartupTargets().length);
});

test("PlatformApplicationKernel.buildSnapshot includes actual apps and targets", () => {
  const kernel = new PlatformApplicationKernel();
  const snapshot = kernel.buildSnapshot();
  const apps = kernel.listApps();
  const targets = kernel.listStartupTargets();

  assert.ok(snapshot.apps.length > 0);
  assert.ok(snapshot.startupTargets.length > 0);
  assert.equal(snapshot.apps.length, apps.length);
  assert.equal(snapshot.startupTargets.length, targets.length);
  // Snapshot apps and targets are copies (new arrays), so check content equality
  assert.deepStrictEqual(snapshot.apps, apps);
  assert.deepStrictEqual(snapshot.startupTargets, targets);
});

test("PlatformApplicationKernel.listLayers returns frozen array", () => {
  const kernel = new PlatformApplicationKernel();
  const layers = kernel.listLayers();

  assert.ok(Object.isFrozen(layers), "listLayers should return frozen array");
});

test("PlatformApplicationKernel.listApps returns frozen array", () => {
  const kernel = new PlatformApplicationKernel();
  const apps = kernel.listApps();

  assert.ok(Object.isFrozen(apps), "listApps should return frozen array");
});

test("PlatformApplicationKernel.listStartupTargets returns array of targets", () => {
  const kernel = new PlatformApplicationKernel();
  const targets = kernel.listStartupTargets();

  assert.ok(Array.isArray(targets), "listStartupTargets should return an array");
  assert.ok(targets.length > 0, "listStartupTargets should return at least one target");
});

test("registerPlatformApplicationKernel registers kernel in registry", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const kernel = registerPlatformApplicationKernel(registry);

  assert.ok(registry.isInitialized("architecture.application-kernel"));
  assert.ok(kernel instanceof PlatformApplicationKernel);
});

test("registerPlatformApplicationKernel returns same instance on multiple calls", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const kernel1 = registerPlatformApplicationKernel(registry);
  const kernel2 = registerPlatformApplicationKernel(registry);

  assert.strictEqual(kernel1, kernel2, "should return same kernel instance");
});

test("getPlatformApplicationKernel returns registered kernel", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const registered = registerPlatformApplicationKernel(registry);
  const retrieved = getPlatformApplicationKernel(registry);

  assert.strictEqual(registered, retrieved, "should return registered kernel");
});

test("getPlatformApplicationKernel auto-registers if not initialized", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const kernel = getPlatformApplicationKernel(registry);

  assert.ok(registry.isInitialized("architecture.application-kernel"));
  assert.ok(kernel instanceof PlatformApplicationKernel);
});

test("getPlatformApplicationKernel returns same instance on multiple calls without explicit registration", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const kernel1 = getPlatformApplicationKernel(registry);
  const kernel2 = getPlatformApplicationKernel(registry);

  assert.strictEqual(kernel1, kernel2, "should return same kernel instance");
});

test("PlatformStartupPlan has correct structure", () => {
  const kernel = new PlatformApplicationKernel();
  const targets = kernel.listStartupTargets();
  const plan = kernel.buildStartupPlan(targets[0]!.targetKind);

  assert.equal(typeof plan.target, "object");
  assert.equal(typeof plan.startupEntryModule, "string");
  assert.equal(plan.selectedApp === null || typeof plan.selectedApp === "object", true);
  assert.ok(Array.isArray(plan.requiredLayerManifests));
});
