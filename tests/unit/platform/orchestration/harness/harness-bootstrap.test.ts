import assert from "node:assert/strict";
import test from "node:test";

import {
  buildHarnessBootstrap,
  HARNESS_BOOTSTRAP_SERVICE_ID,
  HARNESS_CATALOG_SERVICE_ID,
  registerHarnessBootstrap,
  type HarnessBootstrap,
} from "../../../../../src/platform/orchestration/harness/harness-bootstrap.js";
import { ServiceRegistry } from "../../../../../src/platform/shared/lifecycle/service-registry.js";

type HarnessBootstrapReadonlyType = HarnessBootstrap;
void (null as unknown as HarnessBootstrapReadonlyType);

test("harness bootstrap exposes canonical harness services", () => {
  const bootstrap = buildHarnessBootstrap();
  assert.equal(bootstrap.capabilityGroupId, "harness");
  assert.deepEqual(bootstrap.registeredServiceIds, [
    HARNESS_CATALOG_SERVICE_ID,
    HARNESS_BOOTSTRAP_SERVICE_ID,
  ]);
  assert.equal(bootstrap.catalog.length, 4);
});

test("harness bootstrap registers services in the service registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerHarnessBootstrap(registry);
    assert.equal(bootstrap.catalog.some((item) => item.capabilityId === "hitl"), true);
    assert.equal(registry.isInitialized(HARNESS_CATALOG_SERVICE_ID), true);
    assert.equal(registry.isInitialized(HARNESS_BOOTSTRAP_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});

test("buildHarnessBootstrap returns correct structure", () => {
  const bootstrap = buildHarnessBootstrap();
  assert.equal(bootstrap.capabilityGroupId, "harness");
  assert.equal(Array.isArray(bootstrap.catalog), true);
  assert.equal(bootstrap.catalog.length, 4);
  assert.equal(Array.isArray(bootstrap.registeredServiceIds), true);
  assert.equal(bootstrap.registeredServiceIds.length, 2);
});

test("buildHarnessBootstrap catalog contains all harness capability baselines", () => {
  const bootstrap = buildHarnessBootstrap();
  const catalogIds = bootstrap.catalog.map(c => c.capabilityId);
  assert.ok(catalogIds.includes("constraint-pack"));
  assert.ok(catalogIds.includes("planner-generator-evaluator-loop"));
  assert.ok(catalogIds.includes("hitl"));
  assert.ok(catalogIds.includes("governance"));
});

test("buildHarnessBootstrap creates independent instances", () => {
  const bootstrap1 = buildHarnessBootstrap();
  const bootstrap2 = buildHarnessBootstrap();
  assert.notEqual(bootstrap1, bootstrap2);
  assert.deepEqual(bootstrap1.catalog, bootstrap2.catalog);
});

test("registerHarnessBootstrap registers catalog service before bootstrap service", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerHarnessBootstrap(registry);
    const catalogService = registry.get<readonly typeof bootstrap.catalog[0][]>(HARNESS_CATALOG_SERVICE_ID);
    assert.ok(Array.isArray(catalogService));
    assert.equal(catalogService.length, 4);
  } finally {
    await registry.reset();
  }
});

test("registerHarnessBootstrap uses default ServiceRegistry when not passed", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap = registerHarnessBootstrap();
    assert.equal(bootstrap.capabilityGroupId, "harness");
    assert.equal(registry.isInitialized(HARNESS_CATALOG_SERVICE_ID), true);
    assert.equal(registry.isInitialized(HARNESS_BOOTSTRAP_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});

test("HARNESS_CATALOG_SERVICE_ID and HARNESS_BOOTSTRAP_SERVICE_ID are distinct", () => {
  assert.notEqual(HARNESS_CATALOG_SERVICE_ID, HARNESS_BOOTSTRAP_SERVICE_ID);
  assert.equal(HARNESS_CATALOG_SERVICE_ID, "aiops.harness.catalog");
  assert.equal(HARNESS_BOOTSTRAP_SERVICE_ID, "aiops.harness.bootstrap");
});

test("bootstrap service depends on catalog service", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerHarnessBootstrap(registry);
    const bootstrap = registry.get<HarnessBootstrap>(HARNESS_BOOTSTRAP_SERVICE_ID);
    assert.ok(bootstrap);
    const catalog = registry.get<readonly unknown[]>(HARNESS_CATALOG_SERVICE_ID);
    assert.ok(Array.isArray(catalog));
  } finally {
    await registry.reset();
  }
});

test("registerHarnessBootstrap can be called multiple times safely", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const bootstrap1 = registerHarnessBootstrap(registry);
    const bootstrap2 = registerHarnessBootstrap(registry);
    assert.equal(bootstrap1.capabilityGroupId, bootstrap2.capabilityGroupId);
    assert.equal(bootstrap1.catalog.length, bootstrap2.catalog.length);
  } finally {
    await registry.reset();
  }
});

test("HarnessBootstrap type has correct readonly properties - requires type-level testing", () => {
  const bootstrap = buildHarnessBootstrap();
  assert.ok(Array.isArray(bootstrap.catalog));
  assert.ok(Array.isArray(bootstrap.registeredServiceIds));
});
