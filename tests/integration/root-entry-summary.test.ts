import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDomainsRuntimeCatalog,
  buildDomainsStartupPlan,
  buildInteractionGovernanceRuntimeCatalog,
  buildInteractionGovernanceStartupPlan,
  buildScaleOpsRuntimeCatalog,
  buildScaleOpsStartupPlan,
  buildPlatformArchitectureBootstrapSummary,
  getPlatformApplicationKernel,
  buildPlatformRootSummary,
  runPlatformStartupPlan,
} from "../../src/index.js";

// ============================================================================
// Integration: buildPlatformRootSummary cross-component consistency
// ============================================================================

test("integration: buildPlatformRootSummary domains counts match buildDomainsRuntimeCatalog", () => {
  const summary = buildPlatformRootSummary();
  const catalog = buildDomainsRuntimeCatalog();

  assert.equal(
    summary.domains.capabilityCounts.ring1,
    catalog.ring1.length,
    "ring1 count should match catalog",
  );
  assert.equal(
    summary.domains.capabilityCounts.ring2,
    catalog.ring2.length,
    "ring2 count should match catalog",
  );
  assert.equal(
    summary.domains.capabilityCounts.ring3,
    catalog.ring3.length,
    "ring3 count should match catalog",
  );
});

test("integration: buildPlatformRootSummary domains totalCapabilityCount equals sum of rings", () => {
  const summary = buildPlatformRootSummary();
  const catalog = buildDomainsRuntimeCatalog();

  const total = catalog.ring1.length + catalog.ring2.length + catalog.ring3.length;
  assert.equal(
    summary.domains.totalCapabilityCount,
    total,
    "totalCapabilityCount should equal sum of all rings",
  );
});

test("integration: buildPlatformRootSummary domains startupOrder matches buildDomainsStartupPlan", () => {
  const summary = buildPlatformRootSummary();
  const plan = buildDomainsStartupPlan();

  assert.deepStrictEqual(summary.domains.startupOrder, plan.startupOrder, "startupOrder should match plan");
});

test("integration: buildPlatformRootSummary interactionGovernance counts match catalog", () => {
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

test("integration: buildPlatformRootSummary interactionGovernance startupOrder matches plan", () => {
  const summary = buildPlatformRootSummary();
  const plan = buildInteractionGovernanceStartupPlan();

  assert.deepStrictEqual(
    summary.interactionGovernance.startupOrder,
    plan.startupOrder,
    "startupOrder should match plan",
  );
});

test("integration: buildPlatformRootSummary scaleOps counts match catalog", () => {
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

test("integration: buildPlatformRootSummary scaleOps startupOrder matches plan", () => {
  const summary = buildPlatformRootSummary();
  const plan = buildScaleOpsStartupPlan();

  assert.deepStrictEqual(summary.scaleOps.startupOrder, plan.startupOrder, "startupOrder should match plan");
});

// ============================================================================
// Integration: getPlatformApplicationKernel cross-component consistency
// ============================================================================

test("integration: getPlatformApplicationKernel listApps returns apps matching known kinds", () => {
  const kernel = getPlatformApplicationKernel();
  const apps = kernel.listApps();

  assert.ok(Array.isArray(apps), "apps should be an array");
  assert.ok(apps.length > 0, "should have at least one app");

  const appKinds = apps.map((a) => a.kind);
  assert.ok(appKinds.includes("api"), "should include api app");
  assert.ok(appKinds.includes("console"), "should include console app");
  assert.ok(appKinds.includes("worker"), "should include worker app");
});

test("integration: getPlatformApplicationKernel getApp returns app with correct kind", () => {
  const kernel = getPlatformApplicationKernel();
  const app = kernel.getApp("api");

  assert.ok(app != null, "app should not be null");
  assert.equal(app.kind, "api", "kind should match");
  assert.ok(typeof app.appId === "string", "appId should be a string");
});

test("integration: getPlatformApplicationKernel getApp throws for unknown kind", () => {
  const kernel = getPlatformApplicationKernel();

  assert.throws(
    () => kernel.getApp("nonexistent" as any),
    /Unknown platform app kind/,
  );
});

test("integration: getPlatformApplicationKernel buildStartupPlan returns plan for api", () => {
  const kernel = getPlatformApplicationKernel();
  const plan = kernel.buildStartupPlan("api");

  assert.ok(plan != null, "plan should not be null");
  assert.ok(plan.target != null, "plan.target should be present");
  assert.equal(plan.target.targetKind, "api", "targetKind should match");
  assert.ok(plan.startupEntryModule != null, "startupEntryModule should be present");
  assert.ok(Array.isArray(plan.requiredLayerManifests), "requiredLayerManifests should be an array");
  assert.ok(plan.planeStartupPlan != null, "planeStartupPlan should be present for api target");
  assert.ok(plan.domainsStartupPlan != null, "domainsStartupPlan should be present for api target");
});

test("integration: getPlatformApplicationKernel buildStartupPlan returns null domains for summary", () => {
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

// ============================================================================
// Integration: buildPlatformArchitectureBootstrapSummary cross-component
// ============================================================================

test("integration: buildPlatformArchitectureBootstrapSummary layers have required fields", () => {
  const arch = buildPlatformArchitectureBootstrapSummary();

  assert.ok(Array.isArray(arch.layers), "layers should be an array");
  assert.ok(arch.layers.length > 0, "should have at least one layer");

  for (const layer of arch.layers) {
    assert.ok(typeof layer.layerId === "string", "layerId should be a string");
    assert.ok(typeof layer.description === "string", "description should be a string");
  }
});

test("integration: buildPlatformArchitectureBootstrapSummary planes have required fields", () => {
  const arch = buildPlatformArchitectureBootstrapSummary();

  assert.ok(Array.isArray(arch.planes), "planes should be an array");
  assert.ok(arch.planes.length > 0, "should have at least one plane");

  for (const plane of arch.planes) {
    assert.ok(typeof plane.planeId === "string", "planeId should be a string");
    assert.ok(typeof plane.description === "string", "description should be a string");
  }
});

// ============================================================================
// Integration: runPlatformStartupPlan execution
// ============================================================================

test("integration: runPlatformStartupPlan completes for api target", async () => {
  await runPlatformStartupPlan("api");
  assert.ok(true, "runPlatformStartupPlan should complete without error for api");
});

test("integration: runPlatformStartupPlan completes for console target", async () => {
  await runPlatformStartupPlan("console");
  assert.ok(true, "runPlatformStartupPlan should complete without error for console");
});

test("integration: runPlatformStartupPlan completes for worker target", async () => {
  await runPlatformStartupPlan("worker");
  assert.ok(true, "runPlatformStartupPlan should complete without error for worker");
});

// ============================================================================
// Integration: determinism
// ============================================================================

test("integration: buildPlatformRootSummary is deterministic across calls", () => {
  const summary1 = buildPlatformRootSummary();
  const summary2 = buildPlatformRootSummary();

  assert.deepStrictEqual(
    summary1.domains.capabilityCounts,
    summary2.domains.capabilityCounts,
    "domains counts should be deterministic",
  );
  assert.deepStrictEqual(
    summary1.planes.capabilityCounts,
    summary2.planes.capabilityCounts,
    "planes counts should be deterministic",
  );
  assert.deepStrictEqual(
    summary1.aiOperations.capabilityCounts,
    summary2.aiOperations.capabilityCounts,
    "aiOperations counts should be deterministic",
  );
  assert.deepStrictEqual(
    summary1.interactionGovernance.capabilityCounts,
    summary2.interactionGovernance.capabilityCounts,
    "interactionGovernance counts should be deterministic",
  );
  assert.deepStrictEqual(
    summary1.scaleOps.capabilityCounts,
    summary2.scaleOps.capabilityCounts,
    "scaleOps counts should be deterministic",
  );
});

test("integration: getPlatformApplicationKernel returns same kernel instance", () => {
  const kernel1 = getPlatformApplicationKernel();
  const kernel2 = getPlatformApplicationKernel();

  assert.strictEqual(kernel1, kernel2, "kernel should be a singleton");
});

// ============================================================================
// Integration: buildDomainsStartupPlan structure validation
// ============================================================================

test("integration: buildDomainsStartupPlan has steps with required fields", () => {
  const plan = buildDomainsStartupPlan();

  assert.ok(Array.isArray(plan.steps), "steps should be an array");
  assert.ok(plan.steps.length > 0, "steps should not be empty");

  for (const step of plan.steps) {
    assert.ok(typeof step.stepId === "string", "stepId should be a string");
    assert.ok(typeof step.capabilityCount === "number", "capabilityCount should be a number");
    assert.ok(step.capabilityCount >= 0, "capabilityCount should be non-negative");
  }
});

// ============================================================================
// Integration: architecture summary included in root summary
// ============================================================================

test("integration: buildPlatformRootSummary architecture is from buildPlatformArchitectureBootstrapSummary", () => {
  const summary = buildPlatformRootSummary();
  const arch = buildPlatformArchitectureBootstrapSummary();

  assert.ok(summary.architecture != null, "architecture should not be null");
  assert.deepStrictEqual(summary.architecture.layers, arch.layers, "layers should match");
  assert.deepStrictEqual(summary.architecture.planes, arch.planes, "planes should match");
});