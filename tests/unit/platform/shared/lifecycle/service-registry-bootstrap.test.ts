import assert from "node:assert/strict";
import test from "node:test";

// The bootstrap module registers services at import time.
// We test that the module can be imported without error and that
// ServiceRegistry has the expected services registered.

test("service-registry-bootstrap module imports without error", async () => {
  // Re-import to verify the module loads correctly
  // This tests that all dependencies are available
  const mod = await import("../../../../../src/platform/shared/lifecycle/service-registry-bootstrap.js");
  assert.ok(mod !== undefined);
});

test("ServiceRegistry has expected services registered after bootstrap", async () => {
  // Import the bootstrap to register services
  await import("../../../../../src/platform/shared/lifecycle/service-registry-bootstrap.js");

  const { ServiceRegistry } = await import("../../../../../src/platform/shared/lifecycle/service-registry.js");

  const registry = ServiceRegistry.getInstance();

  // Check that key services are registered
  // The bootstrap registers these services:
  // - network-egress-audit
  // - network-egress-policy (depends on network-egress-audit)
  // - output-continuation
  // - delegation-audit
  // - delegation-governance

  // Verify each expected service is registered
  const expectedServices = [
    "network-egress-audit",
    "network-egress-policy",
    "output-continuation",
    "delegation-audit",
    "delegation-governance",
  ];

  for (const serviceName of expectedServices) {
    // Verify the service exists in the registry (even if not yet initialized)
    const sorted = registry.topologicalSort();
    assert.ok(
      sorted.includes(serviceName),
      `Expected service "${serviceName}" should be registered after bootstrap`
    );
  }
});

test("ServiceRegistry is singleton", async () => {
  await import("../../../../../src/platform/shared/lifecycle/service-registry-bootstrap.js");

  const { ServiceRegistry } = await import("../../../../../src/platform/shared/lifecycle/service-registry.js");

  const instance1 = ServiceRegistry.getInstance();
  const instance2 = ServiceRegistry.getInstance();

  assert.strictEqual(instance1, instance2);
});

test("ServiceRegistry reset clears registered services", async () => {
  await import("../../../../../src/platform/shared/lifecycle/service-registry-bootstrap.js");

  const { ServiceRegistry } = await import("../../../../../src/platform/shared/lifecycle/service-registry.js");

  const registry = ServiceRegistry.getInstance();

  // Reset should clear all registered services
  await registry.reset();

  // After reset, getInstance returns a fresh instance
  const freshInstance = ServiceRegistry.getInstance();
  assert.notStrictEqual(freshInstance, registry);
});

test("ServiceRegistry topologicalSort returns array", async () => {
  await import("../../../../../src/platform/shared/lifecycle/service-registry-bootstrap.js");

  const { ServiceRegistry } = await import("../../../../../src/platform/shared/lifecycle/service-registry.js");

  const registry = ServiceRegistry.getInstance();
  const sorted = registry.topologicalSort();

  assert.ok(Array.isArray(sorted));
});
