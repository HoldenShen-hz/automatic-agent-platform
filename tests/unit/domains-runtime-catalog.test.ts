import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";
import {
  DOMAINS_RUNTIME_CATALOG_SERVICE_ID,
  buildDomainsRuntimeCatalog,
  registerDomainsRuntimeCatalog,
  type DomainsRuntimeCatalog,
} from "../../src/domains-runtime-catalog.js";

test("buildDomainsRuntimeCatalog returns catalog with all six phases", async () => {
  const catalog = buildDomainsRuntimeCatalog();

  assert.ok(catalog.phase9a != null, "phase9a should exist");
  assert.ok(catalog.phase9b != null, "phase9b should exist");
  assert.ok(catalog.phase9c != null, "phase9c should exist");
  assert.ok(catalog.phase9d != null, "phase9d should exist");
  assert.ok(catalog.phase9e != null, "phase9e should exist");
  assert.ok(catalog.phase9f != null, "phase9f should exist");
});

test("buildDomainsRuntimeCatalog phases contain DomainBaseline objects", async () => {
  const catalog = buildDomainsRuntimeCatalog();

  for (const phase of ["phase9a", "phase9b", "phase9c", "phase9d", "phase9e", "phase9f"] as const) {
    const baselines = catalog[phase];
    assert.ok(Array.isArray(baselines), `${phase} should be an array`);
    if (baselines.length > 0) {
      const baseline = baselines[0]!;
      assert.ok("domainId" in baseline, `${phase} baseline should have domainId`);
      assert.ok("phase" in baseline, `${phase} baseline should have phase`);
    }
  }
});

test("buildDomainsRuntimeCatalog phase counts match expected baseline counts", async () => {
  const catalog = buildDomainsRuntimeCatalog();

  assert.equal(catalog.phase9a.length, 4);
  assert.equal(catalog.phase9b.length, 4);
  assert.equal(catalog.phase9c.length, 6);
  assert.equal(catalog.phase9d.length, 5);
  assert.equal(catalog.phase9e.length, 6);
  assert.equal(catalog.phase9f.length, 6);
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

test("registerDomainsRuntimeCatalog returns catalog with all six phases", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const catalog = registerDomainsRuntimeCatalog(registry);

  assert.ok(Array.isArray(catalog.phase9a));
  assert.ok(Array.isArray(catalog.phase9b));
  assert.ok(Array.isArray(catalog.phase9c));
  assert.ok(Array.isArray(catalog.phase9d));
  assert.ok(Array.isArray(catalog.phase9e));
  assert.ok(Array.isArray(catalog.phase9f));
});

test("registerDomainsRuntimeCatalog contains expected domain baseline references", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const catalog = registerDomainsRuntimeCatalog(registry);

  assert.equal(catalog.phase9a.some((item) => item.domainId === "coding"), true);
  assert.equal(catalog.phase9b.some((item) => item.domainId === "quant-trading"), true);
  assert.equal(catalog.phase9f.some((item) => item.domainId === "marketing"), true);
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
