/**
 * Unit Tests: Interaction Governance Runtime Catalog
 *
 * Tests the InteractionGovernanceRuntimeCatalog building and registration functions
 * without ServiceRegistry integration.
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

test.beforeEach(async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
});

test.afterEach(async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
});

test("buildInteractionGovernanceRuntimeCatalog returns catalog with interaction and governance arrays", async () => {
  const catalog = buildInteractionGovernanceRuntimeCatalog();

  assert.ok("interaction" in catalog, "catalog should have interaction property");
  assert.ok("governance" in catalog, "catalog should have governance property");
});

test("buildInteractionGovernanceRuntimeCatalog interaction array contains InteractionCapabilityBaseline objects", async () => {
  const catalog = buildInteractionGovernanceRuntimeCatalog();

  assert.ok(Array.isArray(catalog.interaction), "interaction should be an array");
  assert.ok(catalog.interaction.length > 0, "interaction should not be empty");

  const baseline = catalog.interaction[0];
  assert.ok("capabilityId" in baseline, "baseline should have capabilityId");
  assert.ok("entryModule" in baseline, "baseline should have entryModule");
  assert.ok("description" in baseline, "baseline should have description");
  assert.ok("architectureSections" in baseline, "baseline should have architectureSections");
  assert.ok("baselineServices" in baseline, "baseline should have baselineServices");
});

test("buildInteractionGovernanceRuntimeCatalog governance array contains GovernanceCapabilityBaseline objects", async () => {
  const catalog = buildInteractionGovernanceRuntimeCatalog();

  assert.ok(Array.isArray(catalog.governance), "governance should be an array");
  assert.ok(catalog.governance.length > 0, "governance should not be empty");

  const baseline = catalog.governance[0];
  assert.ok("capabilityId" in baseline, "baseline should have capabilityId");
  assert.ok("entryModule" in baseline, "baseline should have entryModule");
  assert.ok("description" in baseline, "baseline should have description");
  assert.ok("architectureSections" in baseline, "baseline should have architectureSections");
  assert.ok("baselineServices" in baseline, "baseline should have baselineServices");
});

test("buildInteractionGovernanceRuntimeCatalog interaction contains expected capability IDs", async () => {
  const catalog = buildInteractionGovernanceRuntimeCatalog();

  const capabilityIds = catalog.interaction.map((b) => b.capabilityId);
  assert.ok(capabilityIds.includes("nl-gateway"), "should include nl-gateway");
  assert.ok(capabilityIds.includes("goal-decomposer"), "should include goal-decomposer");
  assert.ok(capabilityIds.includes("proactive-agent"), "should include proactive-agent");
  assert.ok(capabilityIds.includes("autonomy"), "should include autonomy");
  assert.ok(capabilityIds.includes("dashboard"), "should include dashboard");
  assert.ok(capabilityIds.includes("ux"), "should include ux");
});

test("buildInteractionGovernanceRuntimeCatalog governance contains expected capability IDs", async () => {
  const catalog = buildInteractionGovernanceRuntimeCatalog();

  const capabilityIds = catalog.governance.map((b) => b.capabilityId);
  assert.ok(capabilityIds.includes("org-model"), "should include org-model");
  assert.ok(capabilityIds.includes("approval-routing"), "should include approval-routing");
  assert.ok(capabilityIds.includes("sso-scim"), "should include sso-scim");
  assert.ok(capabilityIds.includes("compliance-engine"), "should include compliance-engine");
  assert.ok(capabilityIds.includes("knowledge-boundary"), "should include knowledge-boundary");
  assert.ok(capabilityIds.includes("delegated-governance"), "should include delegated-governance");
});

test("buildInteractionGovernanceRuntimeCatalog governance array is frozen (but not interaction)", async () => {
  const catalog = buildInteractionGovernanceRuntimeCatalog();

  assert.ok(Object.isFrozen(catalog.governance), "catalog.governance should be frozen");
  // Note: catalog itself is NOT frozen, interaction is NOT frozen
});

test("buildInteractionGovernanceRuntimeCatalog interaction baselines have valid architecture sections", async () => {
  const catalog = buildInteractionGovernanceRuntimeCatalog();

  for (const baseline of catalog.interaction) {
    assert.ok(
      baseline.architectureSections.every((s) => s.startsWith("§")),
      `${baseline.capabilityId} should have valid architecture section references`,
    );
  }
});

test("buildInteractionGovernanceRuntimeCatalog governance baselines have valid architecture sections", async () => {
  const catalog = buildInteractionGovernanceRuntimeCatalog();

  for (const baseline of catalog.governance) {
    assert.ok(
      baseline.architectureSections.every((s) => s.startsWith("§")),
      `${baseline.capabilityId} should have valid architecture section references`,
    );
  }
});

test("registerInteractionGovernanceRuntimeCatalog registers service in registry", async () => {
  const registry = ServiceRegistry.getInstance();

  const catalog = registerInteractionGovernanceRuntimeCatalog(registry);

  assert.equal(registry.isInitialized(INTERACTION_GOVERNANCE_RUNTIME_CATALOG_SERVICE_ID), true);
  assert.ok(catalog != null, "returned catalog should not be null");
});

test("registerInteractionGovernanceRuntimeCatalog returns catalog with correct structure", async () => {
  const registry = ServiceRegistry.getInstance();

  const catalog = registerInteractionGovernanceRuntimeCatalog(registry);

  assert.ok(Array.isArray(catalog.interaction), "catalog.interaction should be an array");
  assert.ok(Array.isArray(catalog.governance), "catalog.governance should be an array");
});

test("registerInteractionGovernanceRuntimeCatalog returns same instance on multiple calls", async () => {
  const registry = ServiceRegistry.getInstance();

  const catalog1 = registerInteractionGovernanceRuntimeCatalog(registry);
  const catalog2 = registerInteractionGovernanceRuntimeCatalog(registry);

  assert.strictEqual(catalog1, catalog2, "should return same catalog instance");
});

test("registerInteractionGovernanceRuntimeCatalog depends on interaction and governance bootstrap services", async () => {
  const registry = ServiceRegistry.getInstance();

  registerInteractionGovernanceRuntimeCatalog(registry);

  const retrieved = registry.get<InteractionGovernanceRuntimeCatalog>(INTERACTION_GOVERNANCE_RUNTIME_CATALOG_SERVICE_ID);
  assert.ok(retrieved != null, "catalog should be initialized");
  assert.ok(Array.isArray(retrieved.interaction), "retrieved catalog should have interaction array");
  assert.ok(Array.isArray(retrieved.governance), "retrieved catalog should have governance array");
});

test("registerInteractionGovernanceRuntimeCatalog catalog contains expected interaction capability references", async () => {
  const registry = ServiceRegistry.getInstance();

  const catalog = registerInteractionGovernanceRuntimeCatalog(registry);

  assert.equal(catalog.interaction.some((item) => item.capabilityId === "nl-gateway"), true);
  assert.equal(catalog.interaction.some((item) => item.capabilityId === "goal-decomposer"), true);
  assert.equal(catalog.interaction.some((item) => item.capabilityId === "autonomy"), true);
});

test("registerInteractionGovernanceRuntimeCatalog catalog contains expected governance capability references", async () => {
  const registry = ServiceRegistry.getInstance();

  const catalog = registerInteractionGovernanceRuntimeCatalog(registry);

  assert.equal(catalog.governance.some((item) => item.capabilityId === "org-model"), true);
  assert.equal(catalog.governance.some((item) => item.capabilityId === "approval-routing"), true);
  assert.equal(catalog.governance.some((item) => item.capabilityId === "delegated-governance"), true);
});

test("registerInteractionGovernanceRuntimeCatalog interaction and governance arrays are non-empty", async () => {
  const registry = ServiceRegistry.getInstance();

  const catalog = registerInteractionGovernanceRuntimeCatalog(registry);

  assert.ok(catalog.interaction.length > 0, "interaction array should not be empty");
  assert.ok(catalog.governance.length > 0, "governance array should not be empty");
});

test("registerInteractionGovernanceRuntimeCatalog interaction capability baselines are not frozen (only governance)", async () => {
  const registry = ServiceRegistry.getInstance();

  const catalog = registerInteractionGovernanceRuntimeCatalog(registry);

  // Note: interaction baselines are NOT frozen, governance baselines are frozen
  for (const baseline of catalog.interaction) {
    assert.ok(!Object.isFrozen(baseline), `${baseline.capabilityId} baseline should NOT be frozen`);
  }
});

test("registerInteractionGovernanceRuntimeCatalog governance capability baselines are frozen", async () => {
  const registry = ServiceRegistry.getInstance();

  const catalog = registerInteractionGovernanceRuntimeCatalog(registry);

  for (const baseline of catalog.governance) {
    assert.ok(Object.isFrozen(baseline), `${baseline.capabilityId} baseline should be frozen`);
  }
});
