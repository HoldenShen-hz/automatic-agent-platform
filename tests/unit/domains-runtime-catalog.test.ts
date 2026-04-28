import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";
import {
  DOMAINS_RUNTIME_CATALOG_SERVICE_ID,
  buildDomainsRuntimeCatalog,
  registerDomainsRuntimeCatalog,
  type DomainsRuntimeCatalog,
} from "../../src/domains-runtime-catalog.js";

test("buildDomainsRuntimeCatalog returns catalog with all three readiness rings", async () => {
  const catalog = buildDomainsRuntimeCatalog();

  assert.ok(catalog.ring1 != null, "ring1 should exist");
  assert.ok(catalog.ring2 != null, "ring2 should exist");
  assert.ok(catalog.ring3 != null, "ring3 should exist");
});

test("buildDomainsRuntimeCatalog rings contain DomainBaseline objects", async () => {
  const catalog = buildDomainsRuntimeCatalog();

  for (const ring of ["ring1", "ring2", "ring3"] as const) {
    const baselines = catalog[ring];
    assert.ok(Array.isArray(baselines), `${ring} should be an array`);
    if (baselines.length > 0) {
      const baseline = baselines[0]!;
      assert.ok("domainId" in baseline, `${ring} baseline should have domainId`);
      assert.ok("phase" in baseline, `${ring} baseline should have phase`);
    }
  }
});

test("buildDomainsRuntimeCatalog ring counts match expected baseline counts", async () => {
  const catalog = buildDomainsRuntimeCatalog();

  assert.equal(catalog.ring1.length, 8);
  assert.equal(catalog.ring2.length, 11);
  assert.equal(catalog.ring3.length, 12);
});

test("registerDomainsRuntimeCatalog registers service in registry", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const catalog = registerDomainsRuntimeCatalog(registry);

  assert.equal(registry.isInitialized(DOMAINS_RUNTIME_CATALOG_SERVICE_ID), true);
  assert.ok(catalog != null, "returned catalog should not be null");
});

test("registerDomainsRuntimeCatalog returns same instance on multiple calls", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const catalog1 = registerDomainsRuntimeCatalog(registry);
  const catalog2 = registerDomainsRuntimeCatalog(registry);

  assert.strictEqual(catalog1, catalog2, "should return same catalog instance");
});

test("registerDomainsRuntimeCatalog returns catalog with all three readiness rings", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const catalog = registerDomainsRuntimeCatalog(registry);

  assert.ok(Array.isArray(catalog.ring1));
  assert.ok(Array.isArray(catalog.ring2));
  assert.ok(Array.isArray(catalog.ring3));
});

test("registerDomainsRuntimeCatalog contains expected domain baseline references", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const catalog = registerDomainsRuntimeCatalog(registry);

  assert.equal(catalog.ring1.some((item) => item.domainId === "coding"), true);
  assert.equal(catalog.ring1.some((item) => item.domainId === "quant-trading"), true);
  assert.equal(catalog.ring3.some((item) => item.domainId === "marketing"), true);
});

test("registerDomainsRuntimeCatalog depends on bootstrap and phase services", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  // Should throw because dependsOn services not registered yet
  assert.throws(
    () => registry.get(DOMAINS_RUNTIME_CATALOG_SERVICE_ID),
    (err: any) => err.code === "service_registry.not_registered"
  );

  // Register the catalog
  registerDomainsRuntimeCatalog(registry);

  // Getting the catalog should initialize its dependencies via getRecursive
  const catalog = registry.get<DomainsRuntimeCatalog>(DOMAINS_RUNTIME_CATALOG_SERVICE_ID);
  assert.ok(catalog != null, "catalog should be initialized");
});
