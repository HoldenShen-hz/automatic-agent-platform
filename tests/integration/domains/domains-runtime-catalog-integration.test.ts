/**
 * Integration Test: Domains Runtime Catalog
 *
 * Tests the DomainsRuntimeCatalog building and registration with
 * actual ServiceRegistry integration and phase bootstrap.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";
import {
  DOMAINS_RUNTIME_CATALOG_SERVICE_ID,
  buildDomainsRuntimeCatalog,
  registerDomainsRuntimeCatalog,
  type DomainsRuntimeCatalog,
} from "../../../src/domains-runtime-catalog.js";
import {
  DOMAINS_BOOTSTRAP_SERVICE_ID,
  DOMAINS_CATALOG_SERVICE_ID,
  DOMAIN_PHASE_BOOTSTRAP_SERVICE_IDS,
  registerDomainsBootstrap,
} from "../../../src/domains/domains-bootstrap.js";

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

test("integration: buildDomainsRuntimeCatalog ring domains have correct counts", async () => {
  const catalog = buildDomainsRuntimeCatalog();

  assert.equal(catalog.ring1.length, 8);
  assert.ok(catalog.ring1.some((b) => b.domainId === "coding"));
  assert.ok(catalog.ring1.some((b) => b.domainId === "quant-trading"));
  assert.equal(catalog.ring2.length, 11);
  assert.ok(catalog.ring2.some((b) => b.domainId === "legal"));
  assert.ok(catalog.ring2.some((b) => b.domainId === "it-operations"));
  assert.equal(catalog.ring3.length, 12);
  assert.ok(catalog.ring3.some((b) => b.domainId === "healthcare"));
  assert.ok(catalog.ring3.some((b) => b.domainId === "marketing"));
});

test("integration: buildDomainsRuntimeCatalog ring domains retain historical batch metadata", async () => {
  const catalog = buildDomainsRuntimeCatalog();

  for (const baseline of catalog.ring1) {
    assert.ok(["9a", "9b"].includes(baseline.phase), `${baseline.domainId} should map into ring1`);
  }
  for (const baseline of catalog.ring2) {
    assert.ok(["9c", "9d"].includes(baseline.phase), `${baseline.domainId} should map into ring2`);
  }
  for (const baseline of catalog.ring3) {
    assert.ok(["9e", "9f"].includes(baseline.phase), `${baseline.domainId} should map into ring3`);
  }
});

test("integration: buildDomainsRuntimeCatalog phases contain DomainBaseline objects with required properties", async () => {
  const catalog = buildDomainsRuntimeCatalog();

  const allBaselines = [...catalog.ring1, ...catalog.ring2, ...catalog.ring3];

  for (const baseline of allBaselines) {
    assert.ok("domainId" in baseline, "baseline should have domainId");
    assert.ok("phase" in baseline, "baseline should have phase");
    assert.ok("definition" in baseline, "baseline should have definition");
    assert.ok("riskProfile" in baseline, "baseline should have riskProfile");
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

test("integration: registerDomainsRuntimeCatalog depends on bootstrap and phase services", async () => {
  const registry = ServiceRegistry.getInstance();

  // Register the catalog
  const catalog = registerDomainsRuntimeCatalog(registry);

  // Getting the catalog should initialize its dependencies via getRecursive
  const retrieved = registry.get<DomainsRuntimeCatalog>(DOMAINS_RUNTIME_CATALOG_SERVICE_ID);
  assert.ok(retrieved != null, "catalog should be initialized");

  // Verify catalog has same data
  assert.equal(retrieved.ring1.length, catalog.ring1.length);
});

test("integration: registerDomainsRuntimeCatalog catalog contains expected domain baseline references", async () => {
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
  assert.ok(catalog.ring1.length > 0);
  assert.ok(catalog.ring2.length > 0);
});

test("integration: DomainsRuntimeCatalog rings contain correct number of baselines", async () => {
  const registry = ServiceRegistry.getInstance();

  const catalog = registerDomainsRuntimeCatalog(registry);

  // All phases should have the expected baseline counts
  assert.equal(catalog.ring1.length, 8, "ring1 should have 8 baselines");
  assert.equal(catalog.ring2.length, 11, "ring2 should have 11 baselines");
  assert.equal(catalog.ring3.length, 12, "ring3 should have 12 baselines");
});
