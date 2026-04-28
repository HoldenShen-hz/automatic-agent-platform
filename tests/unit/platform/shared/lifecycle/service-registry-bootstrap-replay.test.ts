/**
 * Unit tests for ServiceRegistry bootstrap registrar replay behavior.
 *
 * Tests that bootstrap registrars are replayed when a fresh registry
 * instance is created after reset.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../../../../src/platform/shared/lifecycle/service-registry.js";

test("ServiceRegistry.registerBootstrap registers a registrar", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  let registrarCalled = false;

  ServiceRegistry.registerBootstrap("test-registrar", (reg) => {
    registrarCalled = true;
    reg.register("bootstrap-test-service", {
      init: () => ({ value: 1 }),
    });
  });

  assert.equal(registrarCalled, true, "Registrar should be called during registration");
});

test("ServiceRegistry.registerBootstrap replays on fresh instance", async () => {
  // Get original registry with bootstrap
  const originalRegistry = ServiceRegistry.getInstance();
  await originalRegistry.reset();

  ServiceRegistry.registerBootstrap("replay-test", (reg) => {
    reg.register("replay-service", {
      init: () => ({ replayed: true }),
    });
  });

  // Get registry and verify service is registered
  const registry1 = ServiceRegistry.getInstance();
  const sorted1 = registry1.topologicalSort();
  assert.ok(sorted1.includes("replay-service"), "Service should be registered after bootstrap");

  // Reset
  await registry1.reset();

  // Get fresh instance - bootstrap should be replayed
  const registry2 = ServiceRegistry.getInstance();
  const sorted2 = registry2.topologicalSort();
  assert.ok(sorted2.includes("replay-service"), "Service should be registered after reset and fresh getInstance");
});

test("ServiceRegistry multiple bootstraps can be registered", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  ServiceRegistry.registerBootstrap("multi-bootstrap-1", (reg) => {
    reg.register("multi-service-1", { init: () => ({}) });
  });

  ServiceRegistry.registerBootstrap("multi-bootstrap-2", (reg) => {
    reg.register("multi-service-2", { init: () => ({}) });
  });

  const sorted = ServiceRegistry.getInstance().topologicalSort();
  assert.ok(sorted.includes("multi-service-1"), "First bootstrap service should be registered");
  assert.ok(sorted.includes("multi-service-2"), "Second bootstrap service should be registered");
});

test("ServiceRegistry bootstrap registrar can register multiple services", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  ServiceRegistry.registerBootstrap("multi-service-registrar", (reg) => {
    reg.register("batch-service-1", { init: () => ({}) });
    reg.register("batch-service-2", { init: () => ({}) });
    reg.register("batch-service-3", { init: () => ({}) });
  });

  const sorted = ServiceRegistry.getInstance().topologicalSort();
  assert.ok(sorted.includes("batch-service-1"));
  assert.ok(sorted.includes("batch-service-2"));
  assert.ok(sorted.includes("batch-service-3"));
});

test("ServiceRegistry bootstrap registrar can register services with dependencies", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  ServiceRegistry.registerBootstrap("dep-bootstrap", (reg) => {
    reg.register("base-service", { init: () => ({}) });
    reg.register("dependent-service", {
      init: () => ({}),
      dependsOn: ["base-service"],
    });
  });

  const sorted = ServiceRegistry.getInstance().topologicalSort();
  const baseIdx = sorted.indexOf("base-service");
  const depIdx = sorted.indexOf("dependent-service");

  assert.ok(baseIdx >= 0, "base-service should be registered");
  assert.ok(depIdx >= 0, "dependent-service should be registered");
  assert.ok(baseIdx < depIdx, "base-service should come before dependent-service");
});

test("ServiceRegistry bootstrap registrar with teardown is supported", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  let teardownCalled = false;

  ServiceRegistry.registerBootstrap("teardown-bootstrap", (reg) => {
    reg.register("teardown-bootstrap-service", {
      init: () => ({}),
      teardown: () => { teardownCalled = true; },
    });
  });

  const activeRegistry = ServiceRegistry.getInstance();
  activeRegistry.get("teardown-bootstrap-service");
  await activeRegistry.reset();

  assert.equal(teardownCalled, true, "Teardown should be called on reset");
});

test("ServiceRegistry getInstance before registerBootstrap still gets bootstraps", async () => {
  // This test verifies that if bootstrap is registered after first getInstance,
  // the bootstrap is still applied to that instance
  const registry1 = ServiceRegistry.getInstance();

  // Register bootstrap after registry was already used
  ServiceRegistry.registerBootstrap("late-bootstrap", (reg) => {
    reg.register("late-service", { init: () => ({}) });
  });

  // The late bootstrap should have been applied to the existing instance too
  const sorted = registry1.topologicalSort();
  assert.ok(sorted.includes("late-service"), "Late bootstrap should be applied");
});

test("ServiceRegistry bootstrap services can depend on runtime-registered services", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  // Register a service at runtime
  const activeRegistry = ServiceRegistry.getInstance();
  activeRegistry.register("runtime-service", { init: () => ({ value: 1 }) });

  // Bootstrap depends on runtime service
  ServiceRegistry.registerBootstrap("runtime-dep-bootstrap", (reg) => {
    reg.register("bootstrap-with-runtime-dep", {
      init: () => ({}),
      dependsOn: ["runtime-service"],
    });
  });

  const sorted = activeRegistry.topologicalSort();
  const runtimeIdx = sorted.indexOf("runtime-service");
  const depIdx = sorted.indexOf("bootstrap-with-runtime-dep");

  assert.ok(runtimeIdx >= 0, "runtime-service should be registered");
  assert.ok(depIdx >= 0, "bootstrap-with-runtime-dep should be registered");
  assert.ok(runtimeIdx < depIdx, "runtime-service should come before bootstrap-with-runtime-dep");
});
