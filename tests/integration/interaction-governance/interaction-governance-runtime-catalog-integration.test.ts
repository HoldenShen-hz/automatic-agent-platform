/**
 * Integration Test: Interaction Governance Runtime Catalog
 *
 * Tests the InteractionGovernanceRuntimeCatalog building and registration with
 * actual ServiceRegistry integration and bootstrap services.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";
import {
  INTERACTION_GOVERNANCE_RUNTIME_CATALOG_SERVICE_ID,
  buildInteractionGovernanceRuntimeCatalog,
  registerInteractionGovernanceRuntimeCatalog,
  type InteractionGovernanceRuntimeCatalog,
} from "../../../src/interaction-governance-runtime-catalog.js";
import {
  INTERACTION_BOOTSTRAP_SERVICE_ID,
  INTERACTION_CATALOG_SERVICE_ID,
  registerInteractionBootstrap,
} from "../../../src/interaction/interaction-bootstrap.js";
import {
  GOVERNANCE_BOOTSTRAP_SERVICE_ID,
  GOVERNANCE_CATALOG_SERVICE_ID,
  registerGovernanceBootstrap,
} from "../../../src/org-governance/governance-bootstrap.js";

test.beforeEach(async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
});

test.afterEach(async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
});

test("integration: buildInteractionGovernanceRuntimeCatalog returns catalog with interaction and governance arrays", async () => {
  const catalog = buildInteractionGovernanceRuntimeCatalog();

  assert.ok(catalog.interaction != null, "interaction should exist");
  assert.ok(catalog.governance != null, "governance should exist");
});

test("integration: buildInteractionGovernanceRuntimeCatalog interaction has correct count of capability baselines", async () => {
  const catalog = buildInteractionGovernanceRuntimeCatalog();

  assert.equal(catalog.interaction.length, 6, "interaction should have 6 capability baselines");
  assert.ok(catalog.interaction.some((b) => b.capabilityId === "nl-gateway"));
  assert.ok(catalog.interaction.some((b) => b.capabilityId === "goal-decomposer"));
  assert.ok(catalog.interaction.some((b) => b.capabilityId === "proactive-agent"));
  assert.ok(catalog.interaction.some((b) => b.capabilityId === "autonomy"));
  assert.ok(catalog.interaction.some((b) => b.capabilityId === "dashboard"));
  assert.ok(catalog.interaction.some((b) => b.capabilityId === "ux"));
});

test("integration: buildInteractionGovernanceRuntimeCatalog governance has correct count of capability baselines", async () => {
  const catalog = buildInteractionGovernanceRuntimeCatalog();

  assert.equal(catalog.governance.length, 6, "governance should have 6 capability baselines");
  assert.ok(catalog.governance.some((b) => b.capabilityId === "org-model"));
  assert.ok(catalog.governance.some((b) => b.capabilityId === "approval-routing"));
  assert.ok(catalog.governance.some((b) => b.capabilityId === "sso-scim"));
  assert.ok(catalog.governance.some((b) => b.capabilityId === "compliance-engine"));
  assert.ok(catalog.governance.some((b) => b.capabilityId === "knowledge-boundary"));
  assert.ok(catalog.governance.some((b) => b.capabilityId === "delegated-governance"));
});

test("integration: buildInteractionGovernanceRuntimeCatalog interaction baselines have required properties", async () => {
  const catalog = buildInteractionGovernanceRuntimeCatalog();

  for (const baseline of catalog.interaction) {
    assert.ok("capabilityId" in baseline, `${baseline.capabilityId} should have capabilityId`);
    assert.ok("entryModule" in baseline, `${baseline.capabilityId} should have entryModule`);
    assert.ok("description" in baseline, `${baseline.capabilityId} should have description`);
    assert.ok("architectureSections" in baseline, `${baseline.capabilityId} should have architectureSections`);
    assert.ok("baselineServices" in baseline, `${baseline.capabilityId} should have baselineServices`);
    assert.ok(Array.isArray(baseline.architectureSections), `${baseline.capabilityId}.architectureSections should be array`);
    assert.ok(Array.isArray(baseline.baselineServices), `${baseline.capabilityId}.baselineServices should be array`);
  }
});

test("integration: buildInteractionGovernanceRuntimeCatalog governance baselines have required properties", async () => {
  const catalog = buildInteractionGovernanceRuntimeCatalog();

  for (const baseline of catalog.governance) {
    assert.ok("capabilityId" in baseline, `${baseline.capabilityId} should have capabilityId`);
    assert.ok("entryModule" in baseline, `${baseline.capabilityId} should have entryModule`);
    assert.ok("description" in baseline, `${baseline.capabilityId} should have description`);
    assert.ok("architectureSections" in baseline, `${baseline.capabilityId} should have architectureSections`);
    assert.ok("baselineServices" in baseline, `${baseline.capabilityId} should have baselineServices`);
    assert.ok(Array.isArray(baseline.architectureSections), `${baseline.capabilityId}.architectureSections should be array`);
    assert.ok(Array.isArray(baseline.baselineServices), `${baseline.capabilityId}.baselineServices should be array`);
  }
});

test("integration: buildInteractionGovernanceRuntimeCatalog interaction baselines reference correct modules", async () => {
  const catalog = buildInteractionGovernanceRuntimeCatalog();

  const nlGateway = catalog.interaction.find((b) => b.capabilityId === "nl-gateway");
  assert.equal(nlGateway?.entryModule, "src/interaction/nl-gateway/index.ts");

  const goalDecomposer = catalog.interaction.find((b) => b.capabilityId === "goal-decomposer");
  assert.equal(goalDecomposer?.entryModule, "src/interaction/goal-decomposer/index.ts");
});

test("integration: buildInteractionGovernanceRuntimeCatalog governance baselines reference correct modules", async () => {
  const catalog = buildInteractionGovernanceRuntimeCatalog();

  const orgModel = catalog.governance.find((b) => b.capabilityId === "org-model");
  assert.equal(orgModel?.entryModule, "src/org-governance/org-model/index.ts");

  const approvalRouting = catalog.governance.find((b) => b.capabilityId === "approval-routing");
  assert.equal(approvalRouting?.entryModule, "src/org-governance/approval-routing/index.ts");
});

test("integration: registerInteractionGovernanceRuntimeCatalog registers service in registry", async () => {
  const registry = ServiceRegistry.getInstance();

  const catalog = registerInteractionGovernanceRuntimeCatalog(registry);

  assert.equal(registry.isInitialized(INTERACTION_GOVERNANCE_RUNTIME_CATALOG_SERVICE_ID), true);
  assert.ok(catalog != null, "returned catalog should not be null");
});

test("integration: registerInteractionGovernanceRuntimeCatalog returns same instance on multiple calls", async () => {
  const registry = ServiceRegistry.getInstance();

  const catalog1 = registerInteractionGovernanceRuntimeCatalog(registry);
  const catalog2 = registerInteractionGovernanceRuntimeCatalog(registry);

  assert.strictEqual(catalog1, catalog2, "should return same catalog instance");
});

test("integration: registerInteractionGovernanceRuntimeCatalog depends on bootstrap and catalog services", async () => {
  const registry = ServiceRegistry.getInstance();

  const catalog = registerInteractionGovernanceRuntimeCatalog(registry);

  const retrieved = registry.get<InteractionGovernanceRuntimeCatalog>(INTERACTION_GOVERNANCE_RUNTIME_CATALOG_SERVICE_ID);
  assert.ok(retrieved != null, "catalog should be initialized");
  assert.equal(retrieved.interaction.length, catalog.interaction.length);
  assert.equal(retrieved.governance.length, catalog.governance.length);
});

test("integration: registerInteractionBootstrap enables registerInteractionGovernanceRuntimeCatalog to work", async () => {
  const registry = ServiceRegistry.getInstance();

  registerInteractionBootstrap(registry);

  const catalog = registerInteractionGovernanceRuntimeCatalog(registry);

  assert.ok(catalog.interaction.length > 0, "catalog should have interaction capabilities");
});

test("integration: registerGovernanceBootstrap enables registerInteractionGovernanceRuntimeCatalog to work", async () => {
  const registry = ServiceRegistry.getInstance();

  registerGovernanceBootstrap(registry);

  const catalog = registerInteractionGovernanceRuntimeCatalog(registry);

  assert.ok(catalog.governance.length > 0, "catalog should have governance capabilities");
});

test("integration: registerInteractionGovernanceRuntimeCatalog with both bootstraps produces full catalog", async () => {
  const registry = ServiceRegistry.getInstance();

  registerInteractionBootstrap(registry);
  registerGovernanceBootstrap(registry);
  const catalog = registerInteractionGovernanceRuntimeCatalog(registry);

  assert.equal(catalog.interaction.length, 6, "should have all 6 interaction capabilities");
  assert.equal(catalog.governance.length, 6, "should have all 6 governance capabilities");
});

test("integration: InteractionGovernanceRuntimeCatalog service ID is correctly defined", async () => {
  assert.equal(INTERACTION_GOVERNANCE_RUNTIME_CATALOG_SERVICE_ID, "w3.runtime.catalog");
});

test("integration: registerInteractionGovernanceRuntimeCatalog registers catalog and catalog services", async () => {
  const registry = ServiceRegistry.getInstance();

  registerInteractionGovernanceRuntimeCatalog(registry);

  assert.equal(registry.isInitialized(INTERACTION_CATALOG_SERVICE_ID), true);
  assert.equal(registry.isInitialized(GOVERNANCE_CATALOG_SERVICE_ID), true);
  assert.equal(registry.isInitialized(INTERACTION_BOOTSTRAP_SERVICE_ID), true);
  assert.equal(registry.isInitialized(GOVERNANCE_BOOTSTRAP_SERVICE_ID), true);
});

test("integration: registerInteractionGovernanceRuntimeCatalog governance is frozen but not catalog or interaction", async () => {
  const registry = ServiceRegistry.getInstance();

  const catalog = registerInteractionGovernanceRuntimeCatalog(registry);

  assert.ok(Object.isFrozen(catalog.governance), "catalog.governance should be frozen");

  // Note: catalog itself is NOT frozen, interaction is NOT frozen
  for (const baseline of catalog.interaction) {
    assert.ok(!Object.isFrozen(baseline), `${baseline.capabilityId} baseline should NOT be frozen`);
  }

  for (const baseline of catalog.governance) {
    assert.ok(Object.isFrozen(baseline), `${baseline.capabilityId} baseline should be frozen`);
  }
});
