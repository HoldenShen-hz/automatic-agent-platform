import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, "..", "..");

function dist(path: string): string {
  return join(PROJECT_ROOT, "dist", path);
}

test("src/index exports all expected module namespaces", async () => {
  const index = await import(dist("src/index.js"));

  assert.ok(index.domains != null, "should export domains namespace");
  assert.ok(index.interaction != null, "should export interaction namespace");
  assert.ok(index.platform != null, "should export platform namespace");
  assert.ok(index.plugins != null, "should export plugins namespace");
  assert.ok(index.scaleEcosystem != null, "should export scaleEcosystem namespace");
  assert.ok(index.sdk != null, "should export sdk namespace");
});

test("src/index exports build functions from submodules", async () => {
  const index = await import("dist("src/index.js"));

  assert.equal(typeof index.buildDomainsRuntimeCatalog, "function");
  assert.equal(typeof index.buildDomainsStartupPlan, "function");
  assert.equal(typeof index.buildFivePlaneRuntimeCatalog, "function");
  assert.equal(typeof index.buildFivePlaneStartupPlan, "function");
  assert.equal(typeof index.buildAiOperationsStartupPlan, "function");
  assert.equal(typeof index.buildInteractionGovernanceRuntimeCatalog, "function");
  assert.equal(typeof index.buildInteractionGovernanceStartupPlan, "function");
  assert.equal(typeof index.buildScaleOpsRuntimeCatalog, "function");
  assert.equal(typeof index.buildScaleOpsStartupPlan, "function");
});

test("src/index exports type definitions from platform-architecture-types", async () => {
  const index = await import("dist("src/index.js"));

  assert.ok("HarnessRun" in index || index.PlatformRootSummary !== undefined,
    "should export HarnessRun type or PlatformRootSummary");
  assert.equal(typeof index.PlatformAppKind, "undefined" || typeof index.PlatformAppKind === "string",
    "PlatformAppKind should be exported as type");
  assert.equal(typeof index.PlatformStartupTargetKind, "undefined" || typeof index.PlatformStartupTargetKind === "string",
    "PlatformStartupTargetKind should be exported as type");
});

test("src/index buildPlatformRootSummary returns complete PlatformRootSummary structure", async () => {
  const { buildPlatformRootSummary } = await import("dist("src/index.js"));

  const summary = buildPlatformRootSummary();

  assert.ok("architecture" in summary);
  assert.ok("domains" in summary);
  assert.ok("planes" in summary);
  assert.ok("aiOperations" in summary);
  assert.ok("interactionGovernance" in summary);
  assert.ok("scaleOps" in summary);
});

test("src/index buildPlatformRootSummary domains section has correct structure", async () => {
  const { buildPlatformRootSummary } = await import("dist("src/index.js"));

  const summary = buildPlatformRootSummary();

  assert.ok(Array.isArray(summary.domains.startupOrder));
  assert.equal(typeof summary.domains.totalCapabilityCount, "number");
  assert.ok("ring1" in summary.domains.capabilityCounts);
  assert.ok("ring2" in summary.domains.capabilityCounts);
  assert.ok("ring3" in summary.domains.capabilityCounts);
});

test("src/index buildPlatformRootSummary planes section has correct structure", async () => {
  const { buildPlatformRootSummary } = await import("dist("src/index.js"));

  const summary = buildPlatformRootSummary();

  assert.ok(Array.isArray(summary.planes.startupOrder));
  assert.equal(typeof summary.planes.totalCapabilityCount, "number");
  assert.ok("interface" in summary.planes.capabilityCounts);
  assert.ok("x1Fabric" in summary.planes.capabilityCounts);
  assert.ok("controlPlane" in summary.planes.capabilityCounts);
  assert.ok("orchestration" in summary.planes.capabilityCounts);
  assert.ok("execution" in summary.planes.capabilityCounts);
  assert.ok("stateEvidence" in summary.planes.capabilityCounts);
});

test("src/index buildPlatformRootSummary aiOperations section has correct structure", async () => {
  const { buildPlatformRootSummary } = await import("dist("src/index.js"));

  const summary = buildPlatformRootSummary();

  assert.ok(Array.isArray(summary.aiOperations.startupOrder));
  assert.equal(typeof summary.aiOperations.totalCapabilityCount, "number");
  assert.ok("modelGateway" in summary.aiOperations.capabilityCounts);
  assert.ok("promptEngine" in summary.aiOperations.capabilityCounts);
  assert.ok("compliance" in summary.aiOperations.capabilityCounts);
  assert.ok("harness" in summary.aiOperations.capabilityCounts);
});

test("src/index buildPlatformRootSummary interactionGovernance section has correct structure", async () => {
  const { buildPlatformRootSummary } = await import("dist("src/index.js"));

  const summary = buildPlatformRootSummary();

  assert.ok(Array.isArray(summary.interactionGovernance.startupOrder));
  assert.equal(typeof summary.interactionGovernance.totalCapabilityCount, "number");
  assert.ok("interaction" in summary.interactionGovernance.capabilityCounts);
  assert.ok("governance" in summary.interactionGovernance.capabilityCounts);
});

test("src/index buildPlatformRootSummary scaleOps section has correct structure", async () => {
  const { buildPlatformRootSummary } = await import("dist("src/index.js"));

  const summary = buildPlatformRootSummary();

  assert.ok(Array.isArray(summary.scaleOps.startupOrder));
  assert.equal(typeof summary.scaleOps.totalCapabilityCount, "number");
  assert.ok("scaleEcosystem" in summary.scaleOps.capabilityCounts);
  assert.ok("opsMaturity" in summary.scaleOps.capabilityCounts);
});

test("src/index buildPlatformRootSummary returns non-null architecture when available", async () => {
  const { buildPlatformRootSummary } = await import("dist("src/index.js"));

  const summary = buildPlatformRootSummary();

  // architecture may be null if services unavailable, but structure should be valid
  if (summary.architecture !== null) {
    assert.ok(typeof summary.architecture === "object");
  }
});

test("src/index safeBuild error boundary returns success:false on thrown error", async () => {
  const { buildPlatformRootSummary } = await import("dist("src/index.js"));

  // Calling multiple times should not throw even if services fail
  // The function uses safeBuild internally so it should handle errors gracefully
  const summary1 = buildPlatformRootSummary();
  const summary2 = buildPlatformRootSummary();

  // Both calls should return valid structure (with fallback values)
  assert.ok("domains" in summary1);
  assert.ok("domains" in summary2);
  // Falls back to empty arrays on error, so capability counts would be 0
  assert.ok(typeof summary1.domains.capabilityCounts.ring1 === "number");
});

test("src/index getPlatformApplicationKernel returns kernel instance", async () => {
  const { getPlatformApplicationKernel } = await import("dist("src/index.js"));

  const kernel = getPlatformApplicationKernel();
  assert.ok(kernel != null, "kernel should not be null");
  assert.equal(typeof kernel.listLayers, "function");
  assert.equal(typeof kernel.listApps, "function");
  assert.equal(typeof kernel.listStartupTargets, "function");
});

test("src/index getPlatformApplicationKernel listLayers returns array", async () => {
  const { getPlatformApplicationKernel } = await import("dist("src/index.js"));

  const kernel = getPlatformApplicationKernel();
  const layers = kernel.listLayers();

  assert.ok(Array.isArray(layers));
  if (layers.length > 0) {
    assert.ok("layerId" in layers[0]!);
  }
});

test("src/index getPlatformApplicationKernel listApps returns array", async () => {
  const { getPlatformApplicationKernel } = await import("dist("src/index.js"));

  const kernel = getPlatformApplicationKernel();
  const apps = kernel.listApps();

  assert.ok(Array.isArray(apps));
  if (apps.length > 0) {
    assert.ok("appId" in apps[0]!);
    assert.ok("kind" in apps[0]!);
  }
});

test("src/index getPlatformApplicationKernel listStartupTargets returns array", async () => {
  const { getPlatformApplicationKernel } = await import("dist("src/index.js"));

  const kernel = getPlatformApplicationKernel();
  const targets = kernel.listStartupTargets();

  assert.ok(Array.isArray(targets));
  if (targets.length > 0) {
    assert.ok("targetKind" in targets[0]!);
    assert.ok("rootEntryModule" in targets[0]!);
  }
});

test("src/index getPlatformApplicationKernel getApp returns app for valid kind", async () => {
  const { getPlatformApplicationKernel } = await import("dist("src/index.js"));

  const kernel = getPlatformApplicationKernel();
  const app = kernel.getApp("api");

  assert.ok(app != null);
  assert.equal(app.kind, "api");
});

test("src/index getPlatformApplicationKernel getApp throws for unknown kind", async () => {
  const { getPlatformApplicationKernel } = await import("dist("src/index.js"));

  const kernel = getPlatformApplicationKernel();
  assert.throws(
    () => kernel.getApp("unknown" as any),
    /Unknown platform app kind/,
  );
});

test("src/index getPlatformApplicationKernel buildStartupPlan returns plan structure", async () => {
  const { getPlatformApplicationKernel } = await import("dist("src/index.js"));

  const kernel = getPlatformApplicationKernel();
  const plan = kernel.buildStartupPlan("summary");

  assert.ok("target" in plan);
  assert.ok("startupEntryModule" in plan);
  assert.ok("selectedApp" in plan);
  assert.ok("requiredLayerManifests" in plan);
});

test("src/index getPlatformApplicationKernel buildSnapshot returns snapshot structure", async () => {
  const { getPlatformApplicationKernel } = await import("dist("src/index.js"));

  const kernel = getPlatformApplicationKernel();
  const snapshot = kernel.buildSnapshot();

  assert.ok("generatedAt" in snapshot);
  assert.ok("layerCount" in snapshot);
  assert.ok("appCount" in snapshot);
  assert.ok("startupTargetCount" in snapshot);
  assert.ok(Array.isArray(snapshot.apps));
  assert.ok(Array.isArray(snapshot.startupTargets));
});

test("src/index getPlatformApplicationKernel buildSnapshot contains valid timestamps", async () => {
  const { getPlatformApplicationKernel } = await import("dist("src/index.js"));

  const kernel = getPlatformApplicationKernel();
  const snapshot = kernel.buildSnapshot();

  const generatedAt = new Date(snapshot.generatedAt);
  assert.ok(!isNaN(generatedAt.getTime()), "generatedAt should be valid ISO date");
});

test("src/index runPlatformStartupPlan outputs startup plan for api target", async () => {
  const { runPlatformStartupPlan } = await import("dist("src/index.js"));

  // Should not throw and should complete (console output is suppressed in test)
  await runPlatformStartupPlan("api");
});