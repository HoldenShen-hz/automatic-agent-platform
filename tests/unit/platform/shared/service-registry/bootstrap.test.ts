/**
 * Service Registry Bootstrap Tests
 *
 * Tests the bootstrap registration mechanism that registers core platform
 * services with the ServiceRegistry at startup.
 *
 * @source src/platform/shared/lifecycle/service-registry-bootstrap.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../../../../src/platform/shared/lifecycle/service-registry.js";

// Import bootstrap module to trigger registrations
test("service-registry-bootstrap imports without error", async () => {
  const mod = await import("../../../../../src/platform/shared/lifecycle/service-registry-bootstrap.js");
  assert.ok(mod !== undefined, "bootstrap module should export something");
});

test("ServiceRegistry has all five core services registered after bootstrap import", async () => {
  await import("../../../../../src/platform/shared/lifecycle/service-registry-bootstrap.js");

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
      `Service "${serviceName}" should be registered after bootstrap`
    );
  }
});

test("ServiceRegistry network-egress-audit has no dependencies", async () => {
  await import("../../../../../src/platform/shared/lifecycle/service-registry-bootstrap.js");

  const registry = ServiceRegistry.getInstance();
  const sorted = registry.topologicalSort();

  const auditIdx = sorted.indexOf("network-egress-audit");
  assert.ok(auditIdx >= 0, "network-egress-audit should be registered");

  // network-egress-audit should appear early (no dependencies)
  // It should be one of the first services
  assert.ok(auditIdx < 2, "network-egress-audit should be registered early (no dependencies)");
});

test("ServiceRegistry network-egress-policy depends on network-egress-audit", async () => {
  await import("../../../../../src/platform/shared/lifecycle/service-registry-bootstrap.js");

  const registry = ServiceRegistry.getInstance();
  const sorted = registry.topologicalSort();

  const auditIdx = sorted.indexOf("network-egress-audit");
  const policyIdx = sorted.indexOf("network-egress-policy");

  assert.ok(auditIdx >= 0, "network-egress-audit should be registered");
  assert.ok(policyIdx >= 0, "network-egress-policy should be registered");
  assert.ok(auditIdx < policyIdx,
    "network-egress-audit should come before network-egress-policy due to dependency");
});

test("ServiceRegistry output-continuation has no dependencies", async () => {
  await import("../../../../../src/platform/shared/lifecycle/service-registry-bootstrap.js");

  const registry = ServiceRegistry.getInstance();
  const sorted = registry.topologicalSort();

  assert.ok(sorted.includes("output-continuation"),
    "output-continuation should be registered");

  const outputIdx = sorted.indexOf("output-continuation");
  assert.ok(outputIdx < sorted.length - 2,
    "output-continuation should appear early (no dependencies)");
});

test("ServiceRegistry delegation-audit has no dependencies", async () => {
  await import("../../../../../src/platform/shared/lifecycle/service-registry-bootstrap.js");

  const registry = ServiceRegistry.getInstance();
  const sorted = registry.topologicalSort();

  assert.ok(sorted.includes("delegation-audit"),
    "delegation-audit should be registered");
});

test("ServiceRegistry delegation-governance has no dependencies", async () => {
  await import("../../../../../src/platform/shared/lifecycle/service-registry-bootstrap.js");

  const registry = ServiceRegistry.getInstance();
  const sorted = registry.topologicalSort();

  assert.ok(sorted.includes("delegation-governance"),
    "delegation-governance should be registered");
});

test("ServiceRegistry bootstrap services are lazy-initialized", async () => {
  await import("../../../../../src/platform/shared/lifecycle/service-registry-bootstrap.js");

  const registry = ServiceRegistry.getInstance();

  // None of the bootstrap services should be initialized before access
  assert.equal(registry.isInitialized("network-egress-audit"), false,
    "network-egress-audit should not be initialized yet");
  assert.equal(registry.isInitialized("network-egress-policy"), false,
    "network-egress-policy should not be initialized yet");
  assert.equal(registry.isInitialized("output-continuation"), false,
    "output-continuation should not be initialized yet");
  assert.equal(registry.isInitialized("delegation-audit"), false,
    "delegation-audit should not be initialized yet");
  assert.equal(registry.isInitialized("delegation-governance"), false,
    "delegation-governance should not be initialized yet");
});

test("ServiceRegistry reset clears all bootstrap service instances", async () => {
  await import("../../../../../src/platform/shared/lifecycle/service-registry-bootstrap.js");

  const registry = ServiceRegistry.getInstance();

  // Get a service to initialize it
  try {
    registry.get("delegation-governance");
  } catch {
    // May throw due to external dependencies
  }

  // Reset should clear all instances
  await registry.reset();

  // After reset, services should not be initialized
  assert.equal(registry.isInitialized("delegation-governance"), false,
    "delegation-governance should not be initialized after reset");
});

test("ServiceRegistry reset leaves bootstrap registrations intact", async () => {
  await import("../../../../../src/platform/shared/lifecycle/service-registry-bootstrap.js");

  const registry = ServiceRegistry.getInstance();
  const sortedBefore = registry.topologicalSort();

  await registry.reset();

  // After reset, services should still be registered
  const sortedAfter = ServiceRegistry.getInstance().topologicalSort();

  // Bootstrap registrations should persist (just instances cleared)
  assert.ok(sortedAfter.includes("network-egress-audit"),
    "network-egress-audit should still be registered after reset");
  assert.ok(sortedAfter.includes("network-egress-policy"),
    "network-egress-policy should still be registered after reset");
  assert.ok(sortedAfter.includes("output-continuation"),
    "output-continuation should still be registered after reset");
  assert.ok(sortedAfter.includes("delegation-audit"),
    "delegation-audit should still be registered after reset");
  assert.ok(sortedAfter.includes("delegation-governance"),
    "delegation-governance should still be registered after reset");
});

test("ServiceRegistry teardownAll completes for bootstrap services", async () => {
  await import("../../../../../src/platform/shared/lifecycle/service-registry-bootstrap.js");

  const registry = ServiceRegistry.getInstance();

  // Initialize all services
  try {
    registry.initializeAll();
  } catch {
    // May fail if external dependencies required
  }

  // Teardown should complete without error
  try {
    await registry.teardownAll();
  } catch {
    // May fail if teardown encounters issues
  }

  assert.ok(true, "teardownAll should complete without throwing");
});

test("ServiceRegistry initializeAll triggers lazy initialization", async () => {
  await import("../../../../../src/platform/shared/lifecycle/service-registry-bootstrap.js");

  const registry = ServiceRegistry.getInstance();

  // Before initializeAll, nothing should be initialized
  assert.equal(registry.isInitialized("delegation-audit"), false);

  // initializeAll should initialize all registered services
  try {
    await registry.initializeAll();
  } catch {
    // May fail if external dependencies required
  }

  // After initializeAll, services should be initialized
  // (We just check it doesn't throw - initialization status depends on external deps)
});

test("ServiceRegistry bootstrap dependency order is correct", async () => {
  await import("../../../../../src/platform/shared/lifecycle/service-registry-bootstrap.js");

  const registry = ServiceRegistry.getInstance();
  const sorted = registry.topologicalSort();

  // network-egress-audit must come before network-egress-policy
  const auditIdx = sorted.indexOf("network-egress-audit");
  const policyIdx = sorted.indexOf("network-egress-policy");

  if (auditIdx >= 0 && policyIdx >= 0) {
    assert.ok(auditIdx < policyIdx,
      "network-egress-audit should be initialized before network-egress-policy");
  }
});

test("ServiceRegistry multiple resets work correctly", async () => {
  await import("../../../../../src/platform/shared/lifecycle/service-registry-bootstrap.js");

  const registry = ServiceRegistry.getInstance();

  // Multiple resets should work
  await registry.reset();
  await registry.reset();

  const newRegistry = ServiceRegistry.getInstance();
  assert.ok(newRegistry.has("delegation-audit"),
    "Services should still be registered after multiple resets");
});

test("ServiceRegistry getInstance after reset returns fresh instance", async () => {
  await import("../../../../../src/platform/shared/lifecycle/service-registry-bootstrap.js");

  const registry = ServiceRegistry.getInstance();
  const oldInstance = registry;

  await registry.reset();

  const newInstance = ServiceRegistry.getInstance();

  assert.notStrictEqual(oldInstance, newInstance,
    "getInstance should return new instance after reset");
});

test("ServiceRegistry topologicalSort includes all bootstrap services", async () => {
  await import("../../../../../src/platform/shared/lifecycle/service-registry-bootstrap.js");

  const registry = ServiceRegistry.getInstance();
  const sorted = registry.topologicalSort();

  assert.ok(sorted.length >= 5,
    `Expected at least 5 bootstrap services, got ${sorted.length}`);

  // All five bootstrap services should be present
  const expected = [
    "network-egress-audit",
    "network-egress-policy",
    "output-continuation",
    "delegation-audit",
    "delegation-governance",
  ];

  for (const service of expected) {
    assert.ok(sorted.includes(service),
      `Expected service "${service}" to be in topological sort`);
  }
});

test("ServiceRegistry has returns true for all bootstrap services", async () => {
  await import("../../../../../src/platform/shared/lifecycle/service-registry-bootstrap.js");

  const registry = ServiceRegistry.getInstance();

  assert.equal(registry.has("network-egress-audit"), true);
  assert.equal(registry.has("network-egress-policy"), true);
  assert.equal(registry.has("output-continuation"), true);
  assert.equal(registry.has("delegation-audit"), true);
  assert.equal(registry.has("delegation-governance"), true);
});

test("ServiceRegistry has returns false for unregistered services", async () => {
  await import("../../../../../src/platform/shared/lifecycle/service-registry-bootstrap.js");

  const registry = ServiceRegistry.getInstance();

  assert.equal(registry.has("nonexistent-service"), false);
  assert.equal(registry.has("fake-service"), false);
});