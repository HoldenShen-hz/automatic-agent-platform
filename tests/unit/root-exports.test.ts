import assert from "node:assert/strict";
import test from "node:test";

import {
  getPlatformApplicationKernel,
  registerPlatformApplicationKernel,
} from "../../src/platform-application-kernel.js";
import {
  buildPlatformArchitectureBootstrapSummary,
  assertStartupOrderEnforced,
} from "../../src/platform-architecture-bootstrap.js";
import * as apps from "../../src/apps/index.js";

// ============================================================================
// apps module exports - verified directly from apps/index.js
// ============================================================================

test("apps.listPlatformApps is a function", () => {
  assert.ok(typeof apps.listPlatformApps === "function", "listPlatformApps should be a function");
});

test("apps.listPlatformAppKinds is a function", () => {
  assert.ok(typeof apps.listPlatformAppKinds === "function", "listPlatformAppKinds should be a function");
});

test("apps.listPlatformApps returns array with expected app kinds", () => {
  const platformApps = apps.listPlatformApps();
  const kinds = platformApps.map((app) => app.kind);
  assert.ok(kinds.includes("api"), "should include api app");
  assert.ok(kinds.includes("console"), "should include console app");
  assert.ok(kinds.includes("worker"), "should include worker app");
});

test("apps.buildPlatformStartupTargets returns array with summary and demo targets", () => {
  const targets = apps.buildPlatformStartupTargets();
  assert.ok(targets.some((t) => t.targetKind === "summary"), "should include summary target");
  assert.ok(targets.some((t) => t.targetKind === "demo"), "should include demo target");
});

test("apps.resolvePlatformAppManifest returns null for unknown selector", () => {
  const result = apps.resolvePlatformAppManifest("nonexistent");
  assert.equal(result, null, "should return null for unknown selector");
});

test("apps.getPlatformAppManifestByKind throws for unknown kind", () => {
  assert.throws(
    () => apps.getPlatformAppManifestByKind("unknown" as any),
    /Unknown platform app kind/,
  );
});

test("apps.buildPlatformStartupTargets returns array with all platform app kinds", () => {
  const targets = apps.buildPlatformStartupTargets();
  const targetKinds = targets.map((t) => t.targetKind);
  assert.ok(targetKinds.includes("api"), "should include api target");
  assert.ok(targetKinds.includes("console"), "should include console target");
  assert.ok(targetKinds.includes("worker"), "should include worker target");
});

// ============================================================================
// getPlatformApplicationKernel returns kernel with expected methods
// ============================================================================

test("getPlatformApplicationKernel returns object with listLayers method", () => {
  const kernel = getPlatformApplicationKernel();
  assert.ok(kernel != null, "kernel should not be null");
  assert.ok(typeof kernel.listLayers === "function", "listLayers should be a function");
});

test("getPlatformApplicationKernel returns object with listApps method", () => {
  const kernel = getPlatformApplicationKernel();
  assert.ok(typeof kernel.listApps === "function", "listApps should be a function");
});

test("getPlatformApplicationKernel returns object with buildStartupPlan method", () => {
  const kernel = getPlatformApplicationKernel();
  assert.ok(typeof kernel.buildStartupPlan === "function", "buildStartupPlan should be a function");
});

test("getPlatformApplicationKernel returns object with buildSnapshot method", () => {
  const kernel = getPlatformApplicationKernel();
  assert.ok(typeof kernel.buildSnapshot === "function", "buildSnapshot should be a function");
});

test("getPlatformApplicationKernel listLayers returns array", () => {
  const kernel = getPlatformApplicationKernel();
  const layers = kernel.listLayers();
  assert.ok(Array.isArray(layers), "layers should be an array");
  assert.ok(layers.length > 0, "should have at least one layer");
});

test("getPlatformApplicationKernel listApps returns array", () => {
  const kernel = getPlatformApplicationKernel();
  const appsList = kernel.listApps();
  assert.ok(Array.isArray(appsList), "apps should be an array");
  assert.ok(appsList.length > 0, "should have at least one app");
});

test("getPlatformApplicationKernel getApp returns app by kind", () => {
  const kernel = getPlatformApplicationKernel();
  const app = kernel.getApp("api");
  assert.equal(app.kind, "api", "app kind should be api");
});

test("getPlatformApplicationKernel getApp throws for unknown kind", () => {
  const kernel = getPlatformApplicationKernel();
  assert.throws(
    () => kernel.getApp("nonexistent" as any),
    /Unknown platform app kind/,
  );
});

// ============================================================================
// buildPlatformArchitectureBootstrapSummary returns expected structure
// ============================================================================

test("buildPlatformArchitectureBootstrapSummary returns object with layers array", () => {
  const summary = buildPlatformArchitectureBootstrapSummary();
  assert.ok(summary != null, "summary should not be null");
  assert.ok(Array.isArray(summary.layers), "layers should be an array");
});

test("buildPlatformArchitectureBootstrapSummary returns object with planes array", () => {
  const summary = buildPlatformArchitectureBootstrapSummary();
  assert.ok(Array.isArray(summary.planes), "planes should be an array");
});

test("buildPlatformArchitectureBootstrapSummary returns object with startupTargets array", () => {
  const summary = buildPlatformArchitectureBootstrapSummary();
  assert.ok(Array.isArray(summary.startupTargets), "startupTargets should be an array");
});

test("buildPlatformArchitectureBootstrapSummary has expected count properties", () => {
  const summary = buildPlatformArchitectureBootstrapSummary();
  assert.equal(summary.layerCount, summary.layers.length, "layerCount should match layers.length");
  assert.equal(summary.planeCount, summary.planes.length, "planeCount should match planes.length");
  assert.equal(summary.appCount, summary.apps.length, "appCount should match apps.length");
  assert.equal(summary.startupTargetCount, summary.startupTargets.length, "startupTargetCount should match startupTargets.length");
});

test("buildPlatformArchitectureBootstrapSummary layers have expected structure", () => {
  const summary = buildPlatformArchitectureBootstrapSummary();
  const layer = summary.layers[0]!;
  assert.ok(typeof layer.layerId === "string", "layerId should be a string");
  assert.ok(typeof layer.description === "string", "description should be a string");
});

test("buildPlatformArchitectureBootstrapSummary planes have expected structure", () => {
  const summary = buildPlatformArchitectureBootstrapSummary();
  const plane = summary.planes[0]!;
  assert.ok(typeof plane.planeId === "string", "planeId should be a string");
  assert.ok(typeof plane.description === "string", "description should be a string");
});

// ============================================================================
// assertStartupOrderEnforced behavior
// ============================================================================

test("assertStartupOrderEnforced is a callable function", () => {
  assert.ok(typeof assertStartupOrderEnforced === "function", "assertStartupOrderEnforced should be a function");
});

// ============================================================================
// registerPlatformApplicationKernel behavior
// ============================================================================

test("registerPlatformApplicationKernel is a callable function", () => {
  assert.ok(typeof registerPlatformApplicationKernel === "function", "registerPlatformApplicationKernel should be a function");
});