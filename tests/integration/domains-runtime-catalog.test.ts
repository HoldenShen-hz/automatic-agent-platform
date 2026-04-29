/**
 * Integration Test: Domains Runtime Catalog
 *
 * Tests DomainsRuntimeCatalog with actual ServiceRegistry integration,
 * including full bootstrap chain and phase service dependencies.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";
import {
  DOMAINS_RUNTIME_CATALOG_SERVICE_ID,
  buildDomainsRuntimeCatalog,
  registerDomainsRuntimeCatalog,
  type DomainsRuntimeCatalog,
} from "../../src/domains-runtime-catalog.js";
import {
  DOMAINS_BOOTSTRAP_SERVICE_ID,
  DOMAINS_CATALOG_SERVICE_ID,
  DOMAIN_RING_BOOTSTRAP_SERVICE_IDS,
  DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS,
  registerDomainsBootstrap,
} from "../../src/domains/domains-bootstrap.js";
import {
  listVerticalDomainBaselines,
  listVerticalDomainBaselinesByPhase,
} from "../../src/domains/domain-baseline-catalog.js";

test.beforeEach(async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
});

test.afterEach(async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
});

test("integration: buildDomainsRuntimeCatalog returns catalog with all three readiness rings", async () => {
  const catalog = buildDomainsRuntimeCatalog();

  assert.ok(catalog.ring1 != null, "ring1 should exist");
  assert.ok(catalog.ring2 != null, "ring2 should exist");
  assert.ok(catalog.ring3 != null, "ring3 should exist");
});

test("integration: buildDomainsRuntimeCatalog ring domains have correct phase mapping", async () => {
  const catalog = buildDomainsRuntimeCatalog();

  // ring1 contains phases 9a and 9b
  for (const baseline of catalog.ring1) {
    assert.ok(
      ["9a", "9b"].includes(baseline.phase),
      `${baseline.domainId} in ring1 should have phase 9a or 9b, got ${baseline.phase}`,
    );
  }

  // ring2 contains phases 9c and 9d
  for (const baseline of catalog.ring2) {
    assert.ok(
      ["9c", "9d"].includes(baseline.phase),
      `${baseline.domainId} in ring2 should have phase 9c or 9d, got ${baseline.phase}`,
    );
  }

  // ring3 contains phases 9e and 9f
  for (const baseline of catalog.ring3) {
    assert.ok(
      ["9e", "9f"].includes(baseline.phase),
      `${baseline.domainId} in ring3 should have phase 9e or 9f, got ${baseline.phase}`,
    );
  }
});

test("integration: buildDomainsRuntimeCatalog ring counts match expected baseline counts", async () => {
  const catalog = buildDomainsRuntimeCatalog();

  assert.equal(catalog.ring1.length, 8, "ring1 should have 8 baselines");
  assert.equal(catalog.ring2.length, 11, "ring2 should have 11 baselines");
  assert.equal(catalog.ring3.length, 12, "ring3 should have 12 baselines");
});

test("integration: buildDomainsRuntimeCatalog contains all expected domain baseline references", async () => {
  const catalog = buildDomainsRuntimeCatalog();

  // Verify specific domains exist in expected rings
  assert.ok(catalog.ring1.some((b) => b.domainId === "coding"), "coding should be in ring1");
  assert.ok(catalog.ring1.some((b) => b.domainId === "quant-trading"), "quant-trading should be in ring1");
  assert.ok(catalog.ring1.some((b) => b.domainId === "data-engineering"), "data-engineering should be in ring1");
  assert.ok(catalog.ring2.some((b) => b.domainId === "legal"), "legal should be in ring2");
  assert.ok(catalog.ring2.some((b) => b.domainId === "it-operations"), "it-operations should be in ring2");
  assert.ok(catalog.ring3.some((b) => b.domainId === "healthcare"), "healthcare should be in ring3");
  assert.ok(catalog.ring3.some((b) => b.domainId === "marketing"), "marketing should be in ring3");
});

test("integration: buildDomainsRuntimeCatalog all baselines have required properties", async () => {
  const catalog = buildDomainsRuntimeCatalog();
  const allBaselines = [...catalog.ring1, ...catalog.ring2, ...catalog.ring3];

  for (const baseline of allBaselines) {
    assert.ok("domainId" in baseline, "baseline should have domainId");
    assert.ok("phase" in baseline, "baseline should have phase");
    assert.ok("displayName" in baseline, "baseline should have displayName");
    assert.ok("definition" in baseline, "baseline should have definition");
    assert.ok("riskProfile" in baseline, "baseline should have riskProfile");
    assert.ok("knowledgeSchema" in baseline, "baseline should have knowledgeSchema");
    assert.ok("evalFramework" in baseline, "baseline should have evalFramework");
    assert.ok("promptLibrary" in baseline, "baseline should have promptLibrary");
    assert.ok("recipes" in baseline, "baseline should have recipes");
    assert.ok("interactionRules" in baseline, "baseline should have interactionRules");
    assert.ok("governancePolicy" in baseline, "baseline should have governancePolicy");
  }
});

test("integration: registerDomainsRuntimeCatalog registers service in registry", async () => {
  const registry = ServiceRegistry.getInstance();

  const catalog = registerDomainsRuntimeCatalog(registry);

  assert.equal(registry.isInitialized(DOMAINS_RUNTIME_CATALOG_SERVICE_ID), true);
  assert.ok(catalog != null, "returned catalog should not be null");
});

test("integration: registerDomainsRuntimeCatalog returns same instance on multiple calls", async () => {
  const registry = ServiceRegistry.getInstance();

  const catalog1 = registerDomainsRuntimeCatalog(registry);
  const catalog2 = registerDomainsRuntimeCatalog(registry);

  assert.strictEqual(catalog1, catalog2, "should return same catalog instance");
});

test("integration: registerDomainsRuntimeCatalog catalog contains expected domains", async () => {
  const registry = ServiceRegistry.getInstance();

  const catalog = registerDomainsRuntimeCatalog(registry);

  assert.equal(catalog.ring1.some((item) => item.domainId === "coding"), true);
  assert.equal(catalog.ring1.some((item) => item.domainId === "quant-trading"), true);
  assert.equal(catalog.ring3.some((item) => item.domainId === "marketing"), true);
});

test("integration: registerDomainsBootstrap enables registerDomainsRuntimeCatalog to work", async () => {
  const registry = ServiceRegistry.getInstance();

  // First register bootstrap (which registers phase services)
  registerDomainsBootstrap(registry);

  // Then register runtime catalog
  const catalog = registerDomainsRuntimeCatalog(registry);

  // Verify catalog is properly initialized with phase data
  assert.ok(catalog.ring1.length > 0, "ring1 should have baselines after bootstrap");
  assert.ok(catalog.ring2.length > 0, "ring2 should have baselines after bootstrap");
  assert.ok(catalog.ring3.length > 0, "ring3 should have baselines after bootstrap");
});

test("integration: DomainsRuntimeCatalog rings contain correct number of baselines", async () => {
  const registry = ServiceRegistry.getInstance();

  const catalog = registerDomainsRuntimeCatalog(registry);

  assert.equal(catalog.ring1.length, 8, "ring1 should have 8 baselines");
  assert.equal(catalog.ring2.length, 11, "ring2 should have 11 baselines");
  assert.equal(catalog.ring3.length, 12, "ring3 should have 12 baselines");
});

test("integration: catalog matches direct bootstrap data", async () => {
  const catalog = buildDomainsRuntimeCatalog();

  // Verify ring1 matches 9a + 9b phases
  const ring1Expected = [
    ...listVerticalDomainBaselinesByPhase("9a"),
    ...listVerticalDomainBaselinesByPhase("9b"),
  ];
  assert.equal(catalog.ring1.length, ring1Expected.length);
  for (const baseline of ring1Expected) {
    assert.ok(catalog.ring1.some((b) => b.domainId === baseline.domainId));
  }

  // Verify ring2 matches 9c + 9d phases
  const ring2Expected = [
    ...listVerticalDomainBaselinesByPhase("9c"),
    ...listVerticalDomainBaselinesByPhase("9d"),
  ];
  assert.equal(catalog.ring2.length, ring2Expected.length);
  for (const baseline of ring2Expected) {
    assert.ok(catalog.ring2.some((b) => b.domainId === baseline.domainId));
  }

  // Verify ring3 matches 9e + 9f phases
  const ring3Expected = [
    ...listVerticalDomainBaselinesByPhase("9e"),
    ...listVerticalDomainBaselinesByPhase("9f"),
  ];
  assert.equal(catalog.ring3.length, ring3Expected.length);
  for (const baseline of ring3Expected) {
    assert.ok(catalog.ring3.some((b) => b.domainId === baseline.domainId));
  }
});


test("integration: registerDomainsRuntimeCatalog depends on correct services", async () => {
  const registry = ServiceRegistry.getInstance();

  registerDomainsRuntimeCatalog(registry);

  // The catalog service depends on bootstrap and all phase services
  const catalogService = registry.services.get(DOMAINS_RUNTIME_CATALOG_SERVICE_ID);
  assert.ok(catalogService, "catalog service should be registered");
  assert.ok(catalogService?.dependsOn?.includes(DOMAINS_BOOTSTRAP_SERVICE_ID), "should depend on bootstrap");
  assert.ok(catalogService?.dependsOn?.includes(DOMAIN_RING_BOOTSTRAP_SERVICE_IDS.ring1), "should depend on ring1 bootstrap");
  assert.ok(catalogService?.dependsOn?.includes(DOMAIN_RING_BOOTSTRAP_SERVICE_IDS.ring2), "should depend on ring2 bootstrap");
  assert.ok(catalogService?.dependsOn?.includes(DOMAIN_RING_BOOTSTRAP_SERVICE_IDS.ring3), "should depend on ring3 bootstrap");
});

test("integration: total baseline count matches all domains", async () => {
  const catalog = buildDomainsRuntimeCatalog();
  const allBaselines = listVerticalDomainBaselines();

  const catalogTotal = catalog.ring1.length + catalog.ring2.length + catalog.ring3.length;
  assert.equal(catalogTotal, allBaselines.length, "sum of ring baselines should equal total baselines");
});
