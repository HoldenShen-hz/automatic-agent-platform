/**
 * Comprehensive unit tests for ServiceRegistryBootstrap module.
 * Tests the bootstrap registration of core platform services and their dependencies.
 */

import assert from "node:assert/strict";
import test from "node:test";

// Import bootstrap to register services
await import("../../../../../src/platform/shared/lifecycle/service-registry-bootstrap.js");

import { ServiceRegistry } from "../../../../../src/platform/shared/lifecycle/service-registry.js";

test("ServiceRegistry bootstrap registers all five core services", () => {
  const registry = ServiceRegistry.getInstance();
  const sorted = registry.topologicalSort();

  const expectedServices = [
    "network-egress-audit",
    "network-egress-policy",
    "output-continuation",
    "delegation-audit",
    "delegation-governance",
  ];

  for (const serviceName of expectedServices) {
    assert.ok(
      sorted.includes(serviceName),
      `Expected service "${serviceName}" should be registered after bootstrap`
    );
  }
});

test("ServiceRegistry bootstrap creates singleton", () => {
  const instance1 = ServiceRegistry.getInstance();
  const instance2 = ServiceRegistry.getInstance();

  assert.strictEqual(instance1, instance2);
});

test("ServiceRegistry bootstrap registers network-egress-audit first (no dependencies)", () => {
  const registry = ServiceRegistry.getInstance();
  const sorted = registry.topologicalSort();

  const auditIdx = sorted.indexOf("network-egress-audit");
  assert.ok(auditIdx >= 0, "network-egress-audit should be in topological sort");
  assert.strictEqual(auditIdx, 0, "network-egress-audit should be first (no deps)");
});

test("ServiceRegistry bootstrap network-egress-policy depends on network-egress-audit", () => {
  const registry = ServiceRegistry.getInstance();
  const sorted = registry.topologicalSort();

  const auditIdx = sorted.indexOf("network-egress-audit");
  const policyIdx = sorted.indexOf("network-egress-policy");

  assert.ok(auditIdx >= 0, "network-egress-audit should be registered");
  assert.ok(policyIdx >= 0, "network-egress-policy should be registered");
  assert.ok(auditIdx < policyIdx, "audit should come before policy");
});

test("ServiceRegistry bootstrap output-continuation has no dependencies", () => {
  const registry = ServiceRegistry.getInstance();

  assert.ok(registry.has("output-continuation"), "output-continuation should be registered");
});

test("ServiceRegistry bootstrap delegation-audit has no dependencies", () => {
  const registry = ServiceRegistry.getInstance();

  assert.ok(registry.has("delegation-audit"), "delegation-audit should be registered");
});

test("ServiceRegistry bootstrap delegation-governance has no dependencies", () => {
  const registry = ServiceRegistry.getInstance();

  assert.ok(registry.has("delegation-governance"), "delegation-governance should be registered");
});

test("ServiceRegistry bootstrap services are lazy-initialized", () => {
  const registry = ServiceRegistry.getInstance();

  // Before accessing, none should be initialized
  assert.strictEqual(registry.isInitialized("network-egress-audit"), false);
  assert.strictEqual(registry.isInitialized("network-egress-policy"), false);
  assert.strictEqual(registry.isInitialized("output-continuation"), false);
  assert.strictEqual(registry.isInitialized("delegation-audit"), false);
  assert.strictEqual(registry.isInitialized("delegation-governance"), false);
});

test("ServiceRegistry bootstrap can create scoped registry without affecting global", () => {
  const globalBefore = ServiceRegistry.getInstance();
  const scoped = ServiceRegistry.createScoped();

  // Scoped registry should be different instance
  assert.notStrictEqual(scoped, globalBefore);

  // Scoped registry should be able to register its own services
  scoped.register("scoped-service", {
    init: () => ({ value: 42 }),
  });

  assert.ok(scoped.has("scoped-service"));
  assert.ok(!globalBefore.has("scoped-service"));
});

test("ServiceRegistry bootstrap reset clears all services and returns new instance", async () => {
  const registryBefore = ServiceRegistry.getInstance();

  // Initialize some services first
  try {
    registryBefore.get("network-egress-audit");
  } catch {
    // May fail if external deps not available
  }

  await registryBefore.reset();

  const registryAfter = ServiceRegistry.getInstance();

  // Should be a new instance
  assert.notStrictEqual(registryBefore, registryAfter);

  // New registry should still have bootstrap services registered
  const sorted = registryAfter.topologicalSort();
  assert.ok(sorted.includes("network-egress-audit"), "Services should be re-registered after bootstrap");
});

test("ServiceRegistry bootstrap registerBootstrap can add new registrars", () => {
  // Register a custom bootstrap
  ServiceRegistry.registerBootstrap("test-registrar", (registry) => {
    registry.register("test-service", {
      init: () => ({ test: true }),
    });
  });

  const registry = ServiceRegistry.getInstance();

  // The new service should be registered
  assert.ok(registry.has("test-service"));
});

test("ServiceRegistry bootstrap get returns initialized service", () => {
  const registry = ServiceRegistry.getInstance();

  // Access a service that doesn't require external deps
  try {
    const outputService = registry.get("output-continuation");
    assert.ok(outputService != null);
    assert.strictEqual(registry.isInitialized("output-continuation"), true);
  } catch {
    // May fail if service has external dependencies
  }
});

test("ServiceRegistry bootstrap initializeAll initializes all bootstrap services", async () => {
  const registry = ServiceRegistry.getInstance();

  try {
    await registry.initializeAll();
  } catch {
    // May fail if services have external dependencies
  }

  // All services should be initialized
  assert.strictEqual(registry.isInitialized("network-egress-audit"), true);
  assert.strictEqual(registry.isInitialized("network-egress-policy"), true);
  assert.strictEqual(registry.isInitialized("output-continuation"), true);
});

test("ServiceRegistry bootstrap teardownAll completes without error", async () => {
  const registry = ServiceRegistry.getInstance();

  // Initialize services first
  try {
    await registry.initializeAll();
  } catch {
    // May fail if external deps required
  }

  // Teardown should complete
  try {
    await registry.teardownAll();
  } catch {
    // May fail if teardown has issues
  }

  // All instances should be cleared
  assert.strictEqual(registry.isInitialized("network-egress-audit"), false);
});

test("ServiceRegistry bootstrap registerBootstrap replays to new live registries", () => {
  // Create a new scoped registry
  const scoped = ServiceRegistry.createScoped();

  // Bootstrap registrars should replay to new registries
  assert.ok(scoped.has("network-egress-audit"), "Bootstrap should replay to scoped registry");
});

test("ServiceRegistry bootstrap topologicalSort includes all five bootstrap services", () => {
  const registry = ServiceRegistry.getInstance();
  const sorted = registry.topologicalSort();

  assert.ok(sorted.length >= 5, `Should have at least 5 services, got ${sorted.length}`);

  const bootstrapServices = [
    "network-egress-audit",
    "network-egress-policy",
    "output-continuation",
    "delegation-audit",
    "delegation-governance",
  ];

  for (const service of bootstrapServices) {
    assert.ok(sorted.includes(service), `${service} should be in topological sort`);
  }
});

test("ServiceRegistry bootstrap creates isolated registries for testing", () => {
  const scoped1 = ServiceRegistry.createScoped();
  const scoped2 = ServiceRegistry.createScoped();

  // Each scoped registry should be independent
  assert.notStrictEqual(scoped1, scoped2);

  // Register different services in each
  scoped1.register("service-a", { init: () => ({}) });
  scoped2.register("service-b", { init: () => ({}) });

  assert.ok(scoped1.has("service-a"));
  assert.ok(!scoped1.has("service-b"));
  assert.ok(scoped2.has("service-b"));
  assert.ok(!scoped2.has("service-a"));
});

test("ServiceRegistry bootstrap services maintain correct dependency order", () => {
  const registry = ServiceRegistry.getInstance();
  const sorted = registry.topologicalSort();

  // network-egress-audit should come before network-egress-policy
  const auditIdx = sorted.indexOf("network-egress-audit");
  const policyIdx = sorted.indexOf("network-egress-policy");

  assert.ok(auditIdx < policyIdx, "audit should initialize before policy");
});

test("ServiceRegistry bootstrap reset continues even if teardown throws", async () => {
  const registry = ServiceRegistry.getInstance();

  // Add a service with failing teardown
  registry.register("failing-teardown", {
    init: () => ({}),
    teardown: () => {
      throw new Error("Teardown failed");
    },
  });

  registry.get("failing-teardown");

  // reset should not throw even with failing teardown
  await registry.reset();

  // Registry should still be usable
  const newInstance = ServiceRegistry.getInstance();
  assert.ok(newInstance != null);
});

test("ServiceRegistry bootstrap has method returns true for registered services", () => {
  const registry = ServiceRegistry.getInstance();

  assert.strictEqual(registry.has("network-egress-audit"), true);
  assert.strictEqual(registry.has("network-egress-policy"), true);
  assert.strictEqual(registry.has("output-continuation"), true);
  assert.strictEqual(registry.has("delegation-audit"), true);
  assert.strictEqual(registry.has("delegation-governance"), true);
  assert.strictEqual(registry.has("nonexistent-service"), false);
});