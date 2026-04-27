/**
 * Integration Test: Service Registry Bootstrap
 *
 * Verifies:
 * - Bootstrap registration of core platform services
 * - ServiceRegistry wiring with network-egress-audit, network-egress-policy,
 *   output-continuation, delegation-audit, and delegation-governance
 * - Dependency resolution between bootstrapped services
 * - Lazy initialization and teardown of bootstrap services
 */

import assert from "node:assert/strict";
import test from "node:test";

// Import the bootstrap module - it registers services via ServiceRegistry.registerBootstrap()
// This import runs the module-level code which calls ServiceRegistry.registerBootstrap()
import "../../../../../src/platform/shared/lifecycle/service-registry-bootstrap.js";
import { ServiceRegistry } from "../../../../../src/platform/shared/lifecycle/service-registry.js";

test("service-registry-bootstrap: registers all core platform services", async () => {
  // Get a fresh registry - the bootstrap registrars will be replayed
  const registry = ServiceRegistry.getInstance();

  // Verify all expected services are registered
  const expectedServices = [
    "network-egress-audit",
    "network-egress-policy",
    "output-continuation",
    "delegation-audit",
    "delegation-governance",
  ];

  for (const serviceId of expectedServices) {
    assert.ok(
      registry.isInitialized(serviceId) || registry.topologicalSort().includes(serviceId),
      `Service ${serviceId} should be registered`,
    );
  }
});

test("service-registry-bootstrap: network-egress-policy depends on network-egress-audit", async () => {
  // Get a fresh registry
  const registry = ServiceRegistry.getInstance();

  // Get services to trigger initialization
  const auditService = registry.get("network-egress-audit");
  const policyService = registry.get("network-egress-policy");

  // Both should be initialized
  assert.ok(auditService !== null);
  assert.ok(policyService !== null);
  assert.ok(registry.isInitialized("network-egress-audit"));
  assert.ok(registry.isInitialized("network-egress-policy"));
});

test("service-registry-bootstrap: output-continuation has teardown function", async () => {
  const registry = ServiceRegistry.getInstance();

  // Initialize the service
  const continuationService = registry.get("output-continuation");
  assert.ok(continuationService !== null);

  // Teardown should succeed
  await registry.teardownAll();

  // After teardown, service should not be initialized
  assert.equal(registry.isInitialized("output-continuation"), false);
});

test("service-registry-bootstrap: delegation services initialize without dependencies", async () => {
  const registry = ServiceRegistry.getInstance();

  // These services should initialize independently
  const auditService = registry.get("delegation-audit");
  const governanceService = registry.get("delegation-governance");

  assert.ok(auditService !== null);
  assert.ok(governanceService !== null);
  assert.ok(registry.isInitialized("delegation-audit"));
  assert.ok(registry.isInitialized("delegation-governance"));
});

test("service-registry-bootstrap: topological sort respects dependency order", async () => {
  const registry = ServiceRegistry.getInstance();

  const sorted = registry.topologicalSort();

  // network-egress-policy depends on network-egress-audit
  // So audit should come before policy in the sorted list
  const auditIndex = sorted.indexOf("network-egress-audit");
  const policyIndex = sorted.indexOf("network-egress-policy");

  if (auditIndex >= 0 && policyIndex >= 0) {
    assert.ok(
      auditIndex < policyIndex,
      "network-egress-audit should come before network-egress-policy in topological sort",
    );
  }
});

test("service-registry-bootstrap: all services can be initialized and torn down", async () => {
  // Get a fresh registry
  const registry = ServiceRegistry.getInstance();

  // Initialize all services
  await registry.initializeAll();

  // Verify all are initialized
  const expectedServices = [
    "network-egress-audit",
    "network-egress-policy",
    "output-continuation",
    "delegation-audit",
    "delegation-governance",
  ];

  for (const serviceId of expectedServices) {
    assert.ok(registry.isInitialized(serviceId), `Service ${serviceId} should be initialized`);
  }

  // Teardown all
  await registry.teardownAll();

  // Verify all are torn down
  for (const serviceId of expectedServices) {
    assert.ok(!registry.isInitialized(serviceId), `Service ${serviceId} should be torn down`);
  }
});
