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
} from "../../src/index.js";

import type {
  PlatformAppKind,
  PlatformStartupTargetKind,
  PlatformRootEntryMode,
  PlatformRootSummary,
} from "../../src/index.js";

type RootEntrySummaryTypeExports = [
  PlatformAppKind,
  PlatformStartupTargetKind,
  PlatformRootEntryMode,
  PlatformRootSummary,
];
void (null as unknown as RootEntrySummaryTypeExports);

// ============================================================================
// Named export presence and type tests
// ============================================================================

test("buildDomainsRuntimeCatalog is a function", () => {
  assert.equal(typeof buildDomainsRuntimeCatalog, "function", "should be a function");
});

test("buildDomainsStartupPlan is a function", () => {
  assert.equal(typeof buildDomainsStartupPlan, "function", "should be a function");
});

test("buildInteractionGovernanceRuntimeCatalog is a function", () => {
  assert.equal(typeof buildInteractionGovernanceRuntimeCatalog, "function", "should be a function");
});

test("buildInteractionGovernanceStartupPlan is a function", () => {
  assert.equal(typeof buildInteractionGovernanceStartupPlan, "function", "should be a function");
});

test("buildScaleOpsRuntimeCatalog is a function", () => {
  assert.equal(typeof buildScaleOpsRuntimeCatalog, "function", "should be a function");
});

test("buildScaleOpsStartupPlan is a function", () => {
  assert.equal(typeof buildScaleOpsStartupPlan, "function", "should be a function");
});

test("buildPlatformArchitectureBootstrapSummary is a function", () => {
  assert.equal(typeof buildPlatformArchitectureBootstrapSummary, "function", "should be a function");
});

test("getPlatformApplicationKernel is a function", () => {
  assert.equal(typeof getPlatformApplicationKernel, "function", "should be a function");
});

test("buildPlatformRootSummary is a function", () => {
  assert.equal(typeof buildPlatformRootSummary, "function", "should be a function");
});

// ============================================================================
// PlatformRootSummary interface structure
// ============================================================================

test("buildPlatformRootSummary returns an object with architecture property", () => {
  const summary = buildPlatformRootSummary();
  assert.ok("architecture" in summary, "should have architecture property");
  assert.ok(summary.architecture != null, "architecture should not be null");
});

test("buildPlatformRootSummary returns an object with domains property", () => {
  const summary = buildPlatformRootSummary();
  assert.ok("domains" in summary, "should have domains property");
});

test("buildPlatformRootSummary returns an object with planes property", () => {
  const summary = buildPlatformRootSummary();
  assert.ok("planes" in summary, "should have planes property");
});

test("buildPlatformRootSummary returns an object with aiOperations property", () => {
  const summary = buildPlatformRootSummary();
  assert.ok("aiOperations" in summary, "should have aiOperations property");
});

test("buildPlatformRootSummary returns an object with interactionGovernance property", () => {
  const summary = buildPlatformRootSummary();
  assert.ok("interactionGovernance" in summary, "should have interactionGovernance property");
});

test("buildPlatformRootSummary returns an object with scaleOps property", () => {
  const summary = buildPlatformRootSummary();
  assert.ok("scaleOps" in summary, "should have scaleOps property");
});

// ============================================================================
// PlatformRootSummary domains structure
// ============================================================================

test("buildPlatformRootSummary domains has startupOrder array", () => {
  const summary = buildPlatformRootSummary();
  assert.ok(Array.isArray(summary.domains.startupOrder), "startupOrder should be an array");
});

test("buildPlatformRootSummary domains has totalCapabilityCount number", () => {
  const summary = buildPlatformRootSummary();
  assert.equal(typeof summary.domains.totalCapabilityCount, "number", "totalCapabilityCount should be a number");
});

test("buildPlatformRootSummary domains has capabilityCounts with ring1, ring2, ring3", () => {
  const summary = buildPlatformRootSummary();
  assert.equal(typeof summary.domains.capabilityCounts.ring1, "number", "ring1 should be a number");
  assert.equal(typeof summary.domains.capabilityCounts.ring2, "number", "ring2 should be a number");
  assert.equal(typeof summary.domains.capabilityCounts.ring3, "number", "ring3 should be a number");
});

test("buildPlatformRootSummary domains capabilityCounts are non-negative", () => {
  const summary = buildPlatformRootSummary();
  assert.ok(summary.domains.capabilityCounts.ring1 >= 0, "ring1 should be non-negative");
  assert.ok(summary.domains.capabilityCounts.ring2 >= 0, "ring2 should be non-negative");
  assert.ok(summary.domains.capabilityCounts.ring3 >= 0, "ring3 should be non-negative");
});

// ============================================================================
// PlatformRootSummary planes structure
// ============================================================================

test("buildPlatformRootSummary planes has startupOrder array", () => {
  const summary = buildPlatformRootSummary();
  assert.ok(Array.isArray(summary.planes.startupOrder), "planes.startupOrder should be an array");
});

test("buildPlatformRootSummary planes has capabilityCounts with all plane keys", () => {
  const summary = buildPlatformRootSummary();
  assert.equal(typeof summary.planes.capabilityCounts.interface, "number");
  assert.equal(typeof summary.planes.capabilityCounts.x1Fabric, "number");
  assert.equal(typeof summary.planes.capabilityCounts.controlPlane, "number");
  assert.equal(typeof summary.planes.capabilityCounts.orchestration, "number");
  assert.equal(typeof summary.planes.capabilityCounts.execution, "number");
  assert.equal(typeof summary.planes.capabilityCounts.stateEvidence, "number");
});

test("buildPlatformRootSummary planes capabilityCounts are non-negative", () => {
  const summary = buildPlatformRootSummary();
  const cc = summary.planes.capabilityCounts;
  assert.ok(cc.interface >= 0);
  assert.ok(cc.x1Fabric >= 0);
  assert.ok(cc.controlPlane >= 0);
  assert.ok(cc.orchestration >= 0);
  assert.ok(cc.execution >= 0);
  assert.ok(cc.stateEvidence >= 0);
});

// ============================================================================
// PlatformRootSummary aiOperations structure
// ============================================================================

test("buildPlatformRootSummary aiOperations has correct capabilityCounts keys", () => {
  const summary = buildPlatformRootSummary();
  const cc = summary.aiOperations.capabilityCounts;
  assert.equal(typeof cc.modelGateway, "number");
  assert.equal(typeof cc.promptEngine, "number");
  assert.equal(typeof cc.compliance, "number");
  assert.equal(typeof cc.harness, "number");
});

test("buildPlatformRootSummary aiOperations capabilityCounts are non-negative", () => {
  const summary = buildPlatformRootSummary();
  const cc = summary.aiOperations.capabilityCounts;
  assert.ok(cc.modelGateway >= 0);
  assert.ok(cc.promptEngine >= 0);
  assert.ok(cc.compliance >= 0);
  assert.ok(cc.harness >= 0);
});

// ============================================================================
// PlatformRootSummary interactionGovernance structure
// ============================================================================

test("buildPlatformRootSummary interactionGovernance has correct capabilityCounts keys", () => {
  const summary = buildPlatformRootSummary();
  const cc = summary.interactionGovernance.capabilityCounts;
  assert.equal(typeof cc.interaction, "number");
  assert.equal(typeof cc.governance, "number");
});

test("buildPlatformRootSummary interactionGovernance capabilityCounts are non-negative", () => {
  const summary = buildPlatformRootSummary();
  assert.ok(summary.interactionGovernance.capabilityCounts.interaction >= 0);
  assert.ok(summary.interactionGovernance.capabilityCounts.governance >= 0);
});

// ============================================================================
// PlatformRootSummary scaleOps structure
// ============================================================================

test("buildPlatformRootSummary scaleOps has correct capabilityCounts keys", () => {
  const summary = buildPlatformRootSummary();
  const cc = summary.scaleOps.capabilityCounts;
  assert.equal(typeof cc.scaleEcosystem, "number");
  assert.equal(typeof cc.opsMaturity, "number");
});

test("buildPlatformRootSummary scaleOps capabilityCounts are non-negative", () => {
  const summary = buildPlatformRootSummary();
  assert.ok(summary.scaleOps.capabilityCounts.scaleEcosystem >= 0);
  assert.ok(summary.scaleOps.capabilityCounts.opsMaturity >= 0);
});

// ============================================================================
// buildDomainsRuntimeCatalog unit tests
// ============================================================================

test("buildDomainsRuntimeCatalog returns object with ring1, ring2, ring3", () => {
  const catalog = buildDomainsRuntimeCatalog();
  assert.ok(Array.isArray(catalog.ring1), "ring1 should be an array");
  assert.ok(Array.isArray(catalog.ring2), "ring2 should be an array");
  assert.ok(Array.isArray(catalog.ring3), "ring3 should be an array");
});

test("buildDomainsRuntimeCatalog ring arrays contain domain baseline objects", () => {
  const catalog = buildDomainsRuntimeCatalog();
  for (const ring of [catalog.ring1, catalog.ring2, catalog.ring3]) {
    for (const item of ring) {
      assert.ok("domainId" in item, "item should have domainId");
      assert.ok("phase" in item, "item should have phase");
    }
  }
});

// ============================================================================
// buildDomainsStartupPlan unit tests
// ============================================================================

test("buildDomainsStartupPlan returns object with startupOrder array", () => {
  const plan = buildDomainsStartupPlan();
  assert.ok(Array.isArray(plan.startupOrder), "startupOrder should be an array");
  assert.ok(plan.startupOrder.length > 0, "startupOrder should not be empty");
});

test("buildDomainsStartupPlan returns object with totalCapabilityCount number", () => {
  const plan = buildDomainsStartupPlan();
  assert.equal(typeof plan.totalCapabilityCount, "number", "totalCapabilityCount should be a number");
  assert.ok(plan.totalCapabilityCount > 0, "totalCapabilityCount should be positive");
});

// ============================================================================
// buildInteractionGovernanceRuntimeCatalog unit tests
// ============================================================================

test("buildInteractionGovernanceRuntimeCatalog returns object with interaction and governance arrays", () => {
  const catalog = buildInteractionGovernanceRuntimeCatalog();
  assert.ok(Array.isArray(catalog.interaction), "interaction should be an array");
  assert.ok(Array.isArray(catalog.governance), "governance should be an array");
});

// ============================================================================
// buildInteractionGovernanceStartupPlan unit tests
// ============================================================================

test("buildInteractionGovernanceStartupPlan returns object with startupOrder array", () => {
  const plan = buildInteractionGovernanceStartupPlan();
  assert.ok(Array.isArray(plan.startupOrder), "startupOrder should be an array");
});

test("buildInteractionGovernanceStartupPlan returns object with totalCapabilityCount", () => {
  const plan = buildInteractionGovernanceStartupPlan();
  assert.equal(typeof plan.totalCapabilityCount, "number", "totalCapabilityCount should be a number");
});

// ============================================================================
// buildScaleOpsRuntimeCatalog unit tests
// ============================================================================

test("buildScaleOpsRuntimeCatalog returns object with scaleEcosystem and opsMaturity arrays", () => {
  const catalog = buildScaleOpsRuntimeCatalog();
  assert.ok(Array.isArray(catalog.scaleEcosystem), "scaleEcosystem should be an array");
  assert.ok(Array.isArray(catalog.opsMaturity), "opsMaturity should be an array");
});

// ============================================================================
// buildScaleOpsStartupPlan unit tests
// ============================================================================

test("buildScaleOpsStartupPlan returns object with startupOrder array", () => {
  const plan = buildScaleOpsStartupPlan();
  assert.ok(Array.isArray(plan.startupOrder), "startupOrder should be an array");
});

test("buildScaleOpsStartupPlan returns object with totalCapabilityCount", () => {
  const plan = buildScaleOpsStartupPlan();
  assert.equal(typeof plan.totalCapabilityCount, "number", "totalCapabilityCount should be a number");
});

// ============================================================================
// buildPlatformArchitectureBootstrapSummary unit tests
// ============================================================================

test("buildPlatformArchitectureBootstrapSummary returns object with layers array", () => {
  const arch = buildPlatformArchitectureBootstrapSummary();
  assert.ok(Array.isArray(arch.layers), "layers should be an array");
  assert.ok(arch.layers.length > 0, "layers should not be empty");
});

test("buildPlatformArchitectureBootstrapSummary returns object with planes array", () => {
  const arch = buildPlatformArchitectureBootstrapSummary();
  assert.ok(Array.isArray(arch.planes), "planes should be an array");
  assert.ok(arch.planes.length > 0, "planes should not be empty");
});

test("buildPlatformArchitectureBootstrapSummary returns object with applicationBindings array", () => {
  const arch = buildPlatformArchitectureBootstrapSummary();
  assert.ok(Array.isArray(arch.applicationBindings), "applicationBindings should be an array");
});

// ============================================================================
// getPlatformApplicationKernel unit tests
// ============================================================================

test("getPlatformApplicationKernel returns an object", () => {
  const kernel = getPlatformApplicationKernel();
  assert.equal(typeof kernel, "object", "kernel should be an object");
  assert.ok(kernel !== null, "kernel should not be null");
});

test("getPlatformApplicationKernel returns kernel with listLayers function", () => {
  const kernel = getPlatformApplicationKernel();
  assert.equal(typeof kernel.listLayers, "function", "listLayers should be a function");
});

test("getPlatformApplicationKernel returns kernel with listApps function", () => {
  const kernel = getPlatformApplicationKernel();
  assert.equal(typeof kernel.listApps, "function", "listApps should be a function");
});

test("getPlatformApplicationKernel returns kernel with buildStartupPlan function", () => {
  const kernel = getPlatformApplicationKernel();
  assert.equal(typeof kernel.buildStartupPlan, "function", "buildStartupPlan should be a function");
});

test("getPlatformApplicationKernel returns kernel with buildSnapshot function", () => {
  const kernel = getPlatformApplicationKernel();
  assert.equal(typeof kernel.buildSnapshot, "function", "buildSnapshot should be a function");
});

test("getPlatformApplicationKernel returns kernel with getApp function", () => {
  const kernel = getPlatformApplicationKernel();
  assert.equal(typeof kernel.getApp, "function", "getApp should be a function");
});

// ============================================================================
// Type exports exist
// ============================================================================

test("PlatformAppKind is exported as a type", () => {
  const _kind: PlatformAppKind = "api";
  assert.ok(_kind != null, "PlatformAppKind type should be usable");
});

test("PlatformStartupTargetKind is exported as a type", () => {
  const _target: PlatformStartupTargetKind = "api";
  assert.ok(_target != null, "PlatformStartupTargetKind type should be usable");
});

test("PlatformRootSummary is exported as a type", () => {
  const _summary: PlatformRootSummary = buildPlatformRootSummary();
  assert.ok(_summary != null, "PlatformRootSummary type should be usable");
});
