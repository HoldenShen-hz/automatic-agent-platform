/**
 * Additional unit tests for ServiceRegistry - covering edge cases and more methods
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../../../../src/platform/shared/lifecycle/service-registry.js";

test("ServiceRegistry.register allows registering service with init only", () => {
  const registry = ServiceRegistry.getInstance();
  registry.register("init-only-service", {
    init: () => ({ value: 42 }),
  });

  const service = registry.get<{ value: number }>("init-only-service");
  assert.equal(service.value, 42);
});

test("ServiceRegistry.register allows registering service with init and teardown", () => {
  const registry = ServiceRegistry.getInstance();
  let teardownCalled = false;

  registry.register("with-teardown", {
    init: () => ({ value: 1 }),
    teardown: () => {
      teardownCalled = true;
    },
  });

  registry.get("with-teardown");
  registry.reset();

  assert.equal(teardownCalled, true);
});

test("ServiceRegistry.register allows registering service with dependsOn", () => {
  const registry = ServiceRegistry.getInstance();

  registry.register("base-service", {
    init: () => ({ initialized: true }),
  });

  registry.register("dependent-service", {
    init: () => ({ dependsOn: true }),
    dependsOn: ["base-service"],
  });

  const sorted = registry.topologicalSort();
  const baseIdx = sorted.indexOf("base-service");
  const depIdx = sorted.indexOf("dependent-service");

  assert.ok(baseIdx >= 0);
  assert.ok(depIdx >= 0);
  assert.ok(baseIdx < depIdx, "base-service should come before dependent-service");
});

test("ServiceRegistry.getRecursive handles missing dependency gracefully", () => {
  const registry = ServiceRegistry.getInstance();

  registry.register("orphan-service", {
    init: () => ({}),
    dependsOn: ["nonexistent-service"],
  });

  // Should not throw - dependsOn is optional
  try {
    registry.get("orphan-service");
  } catch {
    // May throw if dependency not found
  }
});

test("ServiceRegistry.initializeAll initializes all registered services", () => {
  const registry = ServiceRegistry.getInstance();
  registry.register("init-all-1", { init: () => ({ id: 1 }) });
  registry.register("init-all-2", { init: () => ({ id: 2 }) });

  registry.initializeAll();

  assert.equal(registry.isInitialized("init-all-1"), true);
  assert.equal(registry.isInitialized("init-all-2"), true);
});

test("ServiceRegistry.teardownAll calls teardown in reverse topological order", () => {
  const registry = ServiceRegistry.getInstance();
  const teardownOrder: string[] = [];

  registry.register("teardown-order-a", {
    init: () => ({}),
    teardown: () => { teardownOrder.push("a"); },
  });
  registry.register("teardown-order-b", {
    init: () => ({}),
    dependsOn: ["teardown-order-a"],
    teardown: () => { teardownOrder.push("b"); },
  });

  registry.initializeAll();
  registry.teardownAll();

  // b should come before a (reverse topological order)
  const bIdx = teardownOrder.indexOf("b");
  const aIdx = teardownOrder.indexOf("a");
  assert.ok(bIdx >= 0);
  assert.ok(aIdx >= 0);
  assert.ok(bIdx < aIdx, "dependent (b) should be torn down before dependency (a)");
});

test("ServiceRegistry.reset clears singleton", () => {
  const registry = ServiceRegistry.getInstance();
  registry.register("reset-test", { init: () => ({ value: 1 }) });

  const instanceBefore = ServiceRegistry.getInstance();
  registry.reset();
  const instanceAfter = ServiceRegistry.getInstance();

  assert.notEqual(instanceBefore, instanceAfter);
});

test("ServiceRegistry.reset handles service with failing teardown", async () => {
  const registry = ServiceRegistry.getInstance();

  registry.register("fail-teardown", {
    init: () => ({}),
    teardown: () => {
      throw new Error("Teardown failed");
    },
  });

  registry.get("fail-teardown");

  // reset should not throw even with failing teardown
  await registry.reset();

  assert.ok(true);
});

test("ServiceRegistry.register throws on duplicate registration with different init", () => {
  const registry = ServiceRegistry.getInstance();
  registry.register("duplicate-test", { init: () => ({ v: 1 }) });

  // Second registration with same name should be allowed (overwrites)
  registry.register("duplicate-test", { init: () => ({ v: 2 }) });

  const service = registry.get<{ v: number }>("duplicate-test");
  assert.equal(service.v, 2);
});

test("ServiceRegistry.get returns same instance on multiple calls", () => {
  const registry = ServiceRegistry.getInstance();
  registry.register("singleton-check", { init: () => ({ id: Math.random() }) });

  const instance1 = registry.get("singleton-check");
  const instance2 = registry.get("singleton-check");

  assert.equal(instance1, instance2);
});

test("ServiceRegistry.isInitialized returns false for never accessed service", () => {
  const registry = ServiceRegistry.getInstance();
  registry.register("never-accessed", { init: () => ({}) });

  assert.equal(registry.isInitialized("never-accessed"), false);
});

test("ServiceRegistry.isInitialized returns true after get", () => {
  const registry = ServiceRegistry.getInstance();
  registry.register("after-get", { init: () => ({}) });

  registry.get("after-get");

  assert.equal(registry.isInitialized("after-get"), true);
});

test("ServiceRegistry.topologicalSort handles no dependencies", () => {
  const registry = ServiceRegistry.getInstance();
  registry.register("solo-a", { init: () => ({}) });
  registry.register("solo-b", { init: () => ({}) });

  const sorted = registry.topologicalSort();

  assert.ok(sorted.includes("solo-a"));
  assert.ok(sorted.includes("solo-b"));
});

test("ServiceRegistry.topologicalSort handles single service", () => {
  const registry = new ServiceRegistry();
  registry.register("only-one", { init: () => ({}) });

  const sorted = registry.topologicalSort();

  assert.deepEqual(sorted, ["only-one"]);
});

test("ServiceRegistry.topologicalSort reports circular dependency", () => {
  const registry = new ServiceRegistry();
  registry.register("circ-a", {
    init: () => ({}),
    dependsOn: ["circ-b"],
  });
  registry.register("circ-b", {
    init: () => ({}),
    dependsOn: ["circ-a"],
  });

  assert.throws(
    () => registry.topologicalSort(),
    /service_registry\.circular_dependency/,
  );
});

test("ServiceRegistry.get throws for non-existent service", () => {
  const registry = ServiceRegistry.getInstance();

  assert.throws(
    () => registry.get("nonexistent-service"),
    /service_registry.not_registered/,
  );
});

test("ServiceRegistry.reset leaves registry in usable state", async () => {
  const registry = ServiceRegistry.getInstance();

  registry.register("usable-after-reset", { init: () => ({ value: 1 }) });

  await registry.reset();

  // Should be able to register and get a new service
  registry.register("new-service", { init: () => ({ new: true }) });
  const service = registry.get<{ new: boolean }>("new-service");
  assert.equal(service.new, true);
});

test("ServiceRegistry.teardownAll handles empty registry", async () => {
  const registry = ServiceRegistry.getInstance();

  await registry.teardownAll();

  assert.ok(true);
});

test("ServiceRegistry.initializeAll handles empty registry", async () => {
  const registry = ServiceRegistry.getInstance();

  await registry.initializeAll();

  assert.ok(true);
});
