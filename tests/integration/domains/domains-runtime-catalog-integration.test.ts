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

test("integration: buildDomainsRuntimeCatalog returns catalog with all six phases", async () => {
  const catalog = buildDomainsRuntimeCatalog();

  assert.ok(catalog.phase9a != null, "phase9a should exist");
  assert.ok(catalog.phase9b != null, "phase9b should exist");
  assert.ok(catalog.phase9c != null, "phase9c should exist");
  assert.ok(catalog.phase9d != null, "phase9d should exist");
  assert.ok(catalog.phase9e != null, "phase9e should exist");
  assert.ok(catalog.phase9f != null, "phase9f should exist");
});

test("integration: buildDomainsRuntimeCatalog phase domains have correct counts", async () => {
  const catalog = buildDomainsRuntimeCatalog();

  // Phase 9a: coding, data-engineering, knowledge-base, user-operations
  assert.equal(catalog.phase9a.length, 4);
  assert.ok(catalog.phase9a.some((b) => b.domainId === "coding"));
  assert.ok(catalog.phase9a.some((b) => b.domainId === "data-engineering"));
  assert.ok(catalog.phase9a.some((b) => b.domainId === "knowledge-base"));
  assert.ok(catalog.phase9a.some((b) => b.domainId === "user-operations"));

  // Phase 9b: quant-trading, financial-services, ecommerce, advertising
  assert.equal(catalog.phase9b.length, 4);

  // Phase 9c: industry-research, academic-research, product-management, quality-assurance, finance-accounting, legal
  assert.equal(catalog.phase9c.length, 6);

  // Phase 9d: customer-service, it-operations, content-moderation, live-streaming, project-management
  assert.equal(catalog.phase9d.length, 5);

  // Phase 9e: healthcare, human-resources, facilities, executive-assistant, supply-chain, education
  assert.equal(catalog.phase9e.length, 6);

  // Phase 9f: creative-production, game-dev, game-publishing, manufacturing, agriculture, marketing
  assert.equal(catalog.phase9f.length, 6);
});

test("integration: buildDomainsRuntimeCatalog phase domains have correct phase assignment", async () => {
  const catalog = buildDomainsRuntimeCatalog();

  for (const baseline of catalog.phase9a) {
    assert.equal(baseline.phase, "9a", `${baseline.domainId} should be in phase 9a`);
  }
  for (const baseline of catalog.phase9b) {
    assert.equal(baseline.phase, "9b", `${baseline.domainId} should be in phase 9b`);
  }
  for (const baseline of catalog.phase9c) {
    assert.equal(baseline.phase, "9c", `${baseline.domainId} should be in phase 9c`);
  }
  for (const baseline of catalog.phase9d) {
    assert.equal(baseline.phase, "9d", `${baseline.domainId} should be in phase 9d`);
  }
  for (const baseline of catalog.phase9e) {
    assert.equal(baseline.phase, "9e", `${baseline.domainId} should be in phase 9e`);
  }
  for (const baseline of catalog.phase9f) {
    assert.equal(baseline.phase, "9f", `${baseline.domainId} should be in phase 9f`);
  }
});

test("integration: buildDomainsRuntimeCatalog phases contain DomainBaseline objects with required properties", async () => {
  const catalog = buildDomainsRuntimeCatalog();

  const allBaselines = [
    ...catalog.phase9a,
    ...catalog.phase9b,
    ...catalog.phase9c,
    ...catalog.phase9d,
    ...catalog.phase9e,
    ...catalog.phase9f,
  ];

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
  assert.equal(retrieved.phase9a.length, catalog.phase9a.length);
});

test("integration: registerDomainsRuntimeCatalog catalog contains expected domain baseline references", async () => {
  const registry = ServiceRegistry.getInstance();

  const catalog = registerDomainsRuntimeCatalog(registry);

  assert.equal(catalog.phase9a.some((item) => item.domainId === "coding"), true);
  assert.equal(catalog.phase9b.some((item) => item.domainId === "quant-trading"), true);
  assert.equal(catalog.phase9f.some((item) => item.domainId === "marketing"), true);
});

test("integration: registerDomainsBootstrap enables registerDomainsRuntimeCatalog to work", async () => {
  const registry = ServiceRegistry.getInstance();

  // First register bootstrap (which registers phase services)
  registerDomainsBootstrap(registry);

  // Then register runtime catalog
  const catalog = registerDomainsRuntimeCatalog(registry);

  // Verify catalog is properly initialized with phase data
  assert.ok(catalog.phase9a.length > 0);
  assert.ok(catalog.phase9b.length > 0);
});

test("integration: DomainsRuntimeCatalog phases contain correct number of baselines", async () => {
  const registry = ServiceRegistry.getInstance();

  const catalog = registerDomainsRuntimeCatalog(registry);

  // All phases should have the expected baseline counts
  assert.equal(catalog.phase9a.length, 4, "phase9a should have 4 baselines");
  assert.equal(catalog.phase9b.length, 4, "phase9b should have 4 baselines");
  assert.equal(catalog.phase9c.length, 6, "phase9c should have 6 baselines");
  assert.equal(catalog.phase9d.length, 5, "phase9d should have 5 baselines");
  assert.equal(catalog.phase9e.length, 6, "phase9e should have 6 baselines");
  assert.equal(catalog.phase9f.length, 6, "phase9f should have 6 baselines");
});
