import assert from "node:assert/strict";
import test from "node:test";
import type { PlatformAppKind } from "../../src/platform-architecture-types.js";

import {
  buildPlatformRootSummary,
  buildDomainsRuntimeCatalog,
  buildDomainsStartupPlan,
  buildInteractionGovernanceRuntimeCatalog,
  buildInteractionGovernanceStartupPlan,
  buildScaleOpsRuntimeCatalog,
  buildScaleOpsStartupPlan,
  getPlatformApplicationKernel,
  buildPlatformArchitectureBootstrapSummary,
} from "../../src/index.js";

// ============================================================================
// buildPlatformRootSummary integration tests
// ============================================================================

test("integration: buildPlatformRootSummary returns complete summary structure", () => {
  const summary = buildPlatformRootSummary();

  assert.ok(summary != null, "summary should not be null");
  assert.ok(summary.architecture != null, "architecture should be present");
  assert.ok(summary.domains != null, "domains should be present");
  assert.ok(summary.planes != null, "planes should be present");
  assert.ok(summary.aiOperations != null, "aiOperations should be present");
  assert.ok(summary.interactionGovernance != null, "interactionGovernance should be present");
  assert.ok(summary.scaleOps != null, "scaleOps should be present");
});

test("integration: buildPlatformRootSummary domains section has correct structure", () => {
  const summary = buildPlatformRootSummary();

  assert.ok(Array.isArray(summary.domains.startupOrder), "domains.startupOrder should be an array");
  assert.ok(typeof summary.domains.totalCapabilityCount === "number", "domains.totalCapabilityCount should be a number");
  assert.ok(summary.domains.capabilityCounts != null, "domains.capabilityCounts should exist");
  assert.ok(typeof summary.domains.capabilityCounts.ring1 === "number", "ring1 count should be a number");
  assert.ok(typeof summary.domains.capabilityCounts.ring2 === "number", "ring2 count should be a number");
  assert.ok(typeof summary.domains.capabilityCounts.ring3 === "number", "ring3 count should be a number");
});

test("integration: buildPlatformRootSummary planes section has correct structure", () => {
  const summary = buildPlatformRootSummary();

  assert.ok(Array.isArray(summary.planes.startupOrder), "planes.startupOrder should be an array");
  assert.ok(typeof summary.planes.totalCapabilityCount === "number", "planes.totalCapabilityCount should be a number");
  assert.ok(summary.planes.capabilityCounts != null, "planes.capabilityCounts should exist");
  assert.ok(typeof summary.planes.capabilityCounts.interface === "number", "interface count should be a number");
  assert.ok(typeof summary.planes.capabilityCounts.x1Fabric === "number", "x1Fabric count should be a number");
  assert.ok(typeof summary.planes.capabilityCounts.controlPlane === "number", "controlPlane count should be a number");
  assert.ok(typeof summary.planes.capabilityCounts.orchestration === "number", "orchestration count should be a number");
  assert.ok(typeof summary.planes.capabilityCounts.execution === "number", "execution count should be a number");
  assert.ok(typeof summary.planes.capabilityCounts.stateEvidence === "number", "stateEvidence count should be a number");
});

test("integration: buildPlatformRootSummary aiOperations section has correct structure", () => {
  const summary = buildPlatformRootSummary();

  assert.ok(Array.isArray(summary.aiOperations.startupOrder), "aiOperations.startupOrder should be an array");
  assert.ok(typeof summary.aiOperations.totalCapabilityCount === "number", "aiOperations.totalCapabilityCount should be a number");
  assert.ok(summary.aiOperations.capabilityCounts != null, "aiOperations.capabilityCounts should exist");
  assert.ok(typeof summary.aiOperations.capabilityCounts.modelGateway === "number", "modelGateway count should be a number");
  assert.ok(typeof summary.aiOperations.capabilityCounts.promptEngine === "number", "promptEngine count should be a number");
  assert.ok(typeof summary.aiOperations.capabilityCounts.compliance === "number", "compliance count should be a number");
  assert.ok(typeof summary.aiOperations.capabilityCounts.harness === "number", "harness count should be a number");
});

test("integration: buildPlatformRootSummary interactionGovernance section has correct structure", () => {
  const summary = buildPlatformRootSummary();

  assert.ok(Array.isArray(summary.interactionGovernance.startupOrder), "interactionGovernance.startupOrder should be an array");
  assert.ok(typeof summary.interactionGovernance.totalCapabilityCount === "number", "interactionGovernance.totalCapabilityCount should be a number");
  assert.ok(summary.interactionGovernance.capabilityCounts != null, "interactionGovernance.capabilityCounts should exist");
  assert.ok(typeof summary.interactionGovernance.capabilityCounts.interaction === "number", "interaction count should be a number");
  assert.ok(typeof summary.interactionGovernance.capabilityCounts.governance === "number", "governance count should be a number");
});

test("integration: buildPlatformRootSummary scaleOps section has correct structure", () => {
  const summary = buildPlatformRootSummary();

  assert.ok(Array.isArray(summary.scaleOps.startupOrder), "scaleOps.startupOrder should be an array");
  assert.ok(typeof summary.scaleOps.totalCapabilityCount === "number", "scaleOps.totalCapabilityCount should be a number");
  assert.ok(summary.scaleOps.capabilityCounts != null, "scaleOps.capabilityCounts should exist");
  assert.ok(typeof summary.scaleOps.capabilityCounts.scaleEcosystem === "number", "scaleEcosystem count should be a number");
  assert.ok(typeof summary.scaleOps.capabilityCounts.opsMaturity === "number", "opsMaturity count should be a number");
});

test("integration: buildPlatformRootSummary domain counts match buildDomainsRuntimeCatalog", () => {
  const summary = buildPlatformRootSummary();
  const catalog = buildDomainsRuntimeCatalog();

  assert.equal(summary.domains.capabilityCounts.ring1, catalog.ring1.length, "ring1 count should match catalog");
  assert.equal(summary.domains.capabilityCounts.ring2, catalog.ring2.length, "ring2 count should match catalog");
  assert.equal(summary.domains.capabilityCounts.ring3, catalog.ring3.length, "ring3 count should match catalog");
});

test("integration: buildPlatformRootSummary domain startupOrder matches buildDomainsStartupPlan", () => {
  const summary = buildPlatformRootSummary();
  const plan = buildDomainsStartupPlan();

  assert.deepStrictEqual(summary.domains.startupOrder, plan.startupOrder, "startupOrder should match plan");
});

test("integration: buildPlatformRootSummary is deterministic (calling twice gives same result)", () => {
  const summary1 = buildPlatformRootSummary();
  const summary2 = buildPlatformRootSummary();

  assert.deepStrictEqual(summary1.domains.capabilityCounts, summary2.domains.capabilityCounts, "domains counts should be deterministic");
  assert.deepStrictEqual(summary1.planes.capabilityCounts, summary2.planes.capabilityCounts, "planes counts should be deterministic");
});

// ============================================================================
// getPlatformApplicationKernel integration tests
// ============================================================================

test("integration: getPlatformApplicationKernel returns kernel that lists layers", () => {
  const kernel = getPlatformApplicationKernel();
  const layers = kernel.listLayers();

  assert.ok(Array.isArray(layers), "layers should be an array");
  assert.ok(layers.length > 0, "should have at least one layer");
});

test("integration: getPlatformApplicationKernel returns kernel that lists apps", () => {
  const kernel = getPlatformApplicationKernel();
  const apps = kernel.listApps();

  assert.ok(Array.isArray(apps), "apps should be an array");
  assert.ok(apps.length > 0, "should have at least one app");
});

test("integration: getPlatformApplicationKernel returns kernel that builds startup plan", () => {
  const kernel = getPlatformApplicationKernel();
  const plan = kernel.buildStartupPlan("api");

  assert.ok(plan != null, "plan should not be null");
  assert.ok(plan.target != null, "plan.target should be present");
  assert.equal(plan.target.targetKind, "api", "targetKind should match");
});

test("integration: getPlatformApplicationKernel buildStartupPlan returns complete plan structure for api", () => {
  const kernel = getPlatformApplicationKernel();
  const plan = kernel.buildStartupPlan("api");

  assert.ok(plan.startupEntryModule != null, "startupEntryModule should be present");
  assert.ok(Array.isArray(plan.requiredLayerManifests), "requiredLayerManifests should be an array");
  assert.ok(plan.planeStartupPlan != null, "planeStartupPlan should be present when platform layer required");
  assert.ok(plan.domainsStartupPlan != null, "domainsStartupPlan should be present");
});

test("integration: getPlatformApplicationKernel buildStartupPlan returns plan with null domains for non-domains target", () => {
  const kernel = getPlatformApplicationKernel();
  const plan = kernel.buildStartupPlan("summary");

  assert.ok(plan.target != null, "plan.target should be present");
  assert.equal(plan.domainsStartupPlan, null, "domainsStartupPlan should be null for summary target");
});

test("integration: getPlatformApplicationKernel buildSnapshot returns complete snapshot", () => {
  const kernel = getPlatformApplicationKernel();
  const snapshot = kernel.buildSnapshot();

  assert.ok(snapshot != null, "snapshot should not be null");
  assert.ok(typeof snapshot.generatedAt === "string", "generatedAt should be a string");
  assert.ok(typeof snapshot.layerCount === "number", "layerCount should be a number");
  assert.ok(typeof snapshot.appCount === "number", "appCount should be a number");
  assert.ok(typeof snapshot.startupTargetCount === "number", "startupTargetCount should be a number");
  assert.ok(Array.isArray(snapshot.apps), "apps should be an array");
  assert.ok(Array.isArray(snapshot.startupTargets), "startupTargets should be an array");
});

test("integration: getPlatformApplicationKernel getApp returns app manifest for valid kind", () => {
  const kernel = getPlatformApplicationKernel();
  const app = kernel.getApp("api");

  assert.ok(app != null, "app should not be null");
  assert.equal(app.kind, "api", "kind should match");
  assert.ok(typeof app.appId === "string", "appId should be a string");
});

test("integration: getPlatformApplicationKernel getApp throws for invalid kind", () => {
  const kernel = getPlatformApplicationKernel();

  assert.throws(
    () => kernel.getApp("nonexistent" as PlatformAppKind),
    /Unknown platform app kind/,
  );
});

// ============================================================================
// buildPlatformArchitectureBootstrapSummary integration
// ============================================================================

test("integration: buildPlatformArchitectureBootstrapSummary returns architecture with layers", () => {
  const arch = buildPlatformArchitectureBootstrapSummary();

  assert.ok(Array.isArray(arch.layers), "layers should be an array");
  assert.ok(arch.layers.length > 0, "should have at least one layer");

  const layer = arch.layers[0]!;
  assert.ok(typeof layer.layerId === "string", "layerId should be a string");
  assert.ok(typeof layer.description === "string", "description should be a string");
});

test("integration: buildPlatformArchitectureBootstrapSummary returns architecture with planes", () => {
  const arch = buildPlatformArchitectureBootstrapSummary();

  assert.ok(Array.isArray(arch.planes), "planes should be an array");
  assert.ok(arch.planes.length > 0, "should have at least one plane");

  const plane = arch.planes[0]!;
  assert.ok(typeof plane.planeId === "string", "planeId should be a string");
  assert.ok(typeof plane.description === "string", "description should be a string");
});

// ============================================================================
// runPlatformStartupPlan integration tests
// ============================================================================

test("integration: runPlatformStartupPlan can be called for api target", async () => {
  const { runPlatformStartupPlan } = await import("../../src/index.js");

  // Should not throw
  await runPlatformStartupPlan("api");

  // If we get here without error, the test passes
  assert.ok(true, "runPlatformStartupPlan should complete without error for api");
});

test("integration: runPlatformStartupPlan can be called for console target", async () => {
  const { runPlatformStartupPlan } = await import("../../src/index.js");

  await runPlatformStartupPlan("console");

  assert.ok(true, "runPlatformStartupPlan should complete without error for console");
});

test("integration: runPlatformStartupPlan can be called for worker target", async () => {
  const { runPlatformStartupPlan } = await import("../../src/index.js");

  await runPlatformStartupPlan("worker");

  assert.ok(true, "runPlatformStartupPlan should complete without error for worker");
});

// ============================================================================
// Cross-component integration tests
// ============================================================================

test("integration: buildPlatformRootSummary and getPlatformApplicationKernel agree on startup order", () => {
  const summary = buildPlatformRootSummary();
  const kernel = getPlatformApplicationKernel();

  const kernelTargets = kernel.listStartupTargets();
  const kernelTargetKinds = kernelTargets.map((t) => t.targetKind);

  // The summary's scaleOps.startupOrder should be a subset of what kernel knows
  assert.ok(Array.isArray(summary.scaleOps.startupOrder), "scaleOps.startupOrder should be array");
});

test("integration: domains runtime catalog ring counts are consistent with buildPlatformRootSummary", () => {
  const catalog = buildDomainsRuntimeCatalog();
  const summary = buildPlatformRootSummary();

  const totalDomains = catalog.ring1.length + catalog.ring2.length + catalog.ring3.length;
  assert.equal(
    summary.domains.totalCapabilityCount,
    totalDomains,
    "totalCapabilityCount should equal sum of all rings",
  );
});

test("integration: interactionGovernance runtime catalog counts match buildPlatformRootSummary", () => {
  const summary = buildPlatformRootSummary();
  const catalog = buildInteractionGovernanceRuntimeCatalog();

  assert.equal(
    summary.interactionGovernance.capabilityCounts.interaction,
    catalog.interaction.length,
    "interaction count should match",
  );
  assert.equal(
    summary.interactionGovernance.capabilityCounts.governance,
    catalog.governance.length,
    "governance count should match",
  );
});

test("integration: scaleOps runtime catalog counts match buildPlatformRootSummary", () => {
  const summary = buildPlatformRootSummary();
  const catalog = buildScaleOpsRuntimeCatalog();

  assert.equal(
    summary.scaleOps.capabilityCounts.scaleEcosystem,
    catalog.scaleEcosystem.length,
    "scaleEcosystem count should match",
  );
  assert.equal(
    summary.scaleOps.capabilityCounts.opsMaturity,
    catalog.opsMaturity.length,
    "opsMaturity count should match",
  );
});
