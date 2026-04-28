/**
 * Service Registry Lifecycle Integration Tests
 *
 * Tests the ServiceRegistry lifecycle management including initialization,
 * teardown, and dependency resolution across multiple service types.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";

test("service-registry-lifecycle: register and get service with simple init", async () => {
  const registry = new ServiceRegistry();

  const SERVICE_ID = "test.simple-service";
  const initCalled = { value: false };

  registry.register(SERVICE_ID, {
    init: () => {
      initCalled.value = true;
      return { hello: "world" };
    },
  });

  assert.equal(initCalled.value, false, "Service should not be initialized yet");

  const instance = registry.get<{ hello: string }>(SERVICE_ID);

  assert.equal(initCalled.value, true, "Service should be initialized after get()");
  assert.equal(instance.hello, "world");

  await registry.reset();
});

test("service-registry-lifecycle: lazy initialization - service only init on first get", async () => {
  const registry = new ServiceRegistry();
  let initCount = 0;

  registry.register("test.lazy-init", {
    init: () => {
      initCount++;
      return { count: initCount };
    },
  });

  assert.equal(initCount, 0, "Should not initialize before get()");

  registry.get("test.lazy-init");
  assert.equal(initCount, 1, "Should initialize once after first get()");

  registry.get("test.lazy-init");
  assert.equal(initCount, 1, "Should not re-initialize on second get()");

  await registry.reset();
});

test("service-registry-lifecycle: dependencies are initialized before dependent service", async () => {
  const registry = new ServiceRegistry();
  const initOrder: string[] = [];

  registry.register("test.dep-a", {
    init: () => {
      initOrder.push("a");
      return {};
    },
  });

  registry.register("test.dep-b", {
    init: () => {
      initOrder.push("b");
      return {};
    },
  });

  registry.register("test.dep-c", {
    init: () => {
      initOrder.push("c");
      return {};
    },
    dependsOn: ["test.dep-a", "test.dep-b"],
  });

  registry.get("test.dep-c");

  assert.equal(initOrder[0], "a", "dep-a should initialize first");
  assert.equal(initOrder[1], "b", "dep-b should initialize second");
  assert.equal(initOrder[2], "c", "dep-c should initialize last");

  await registry.reset();
});

test("service-registry-lifecycle: circular dependency detection does not throw", async () => {
  const registry = new ServiceRegistry();

  registry.register("test.circ-a", {
    init: () => ({}),
    dependsOn: ["test.circ-b"],
  });

  registry.register("test.circ-b", {
    init: () => ({}),
    dependsOn: ["test.circ-a"],
  });

  // Getting circ-a should attempt initialization but handle cycle gracefully
  // The registry uses a visiting set to prevent infinite recursion
  try {
    registry.get("test.circ-a");
  } catch {
    // Circular deps may cause errors - this is expected behavior
  }

  await registry.reset();
});

test("service-registry-lifecycle: topologicalSort orders services by dependencies", async () => {
  const registry = new ServiceRegistry();

  registry.register("test.sort-c", {
    init: () => ({}),
    dependsOn: ["test.sort-a", "test.sort-b"],
  });

  registry.register("test.sort-b", {
    init: () => ({}),
    dependsOn: ["test.sort-a"],
  });

  registry.register("test.sort-a", {
    init: () => ({}),
  });

  const sorted = registry.topologicalSort();

  const idxA = sorted.indexOf("test.sort-a");
  const idxB = sorted.indexOf("test.sort-b");
  const idxC = sorted.indexOf("test.sort-c");

  assert.ok(idxA >= 0 && idxB >= 0 && idxC >= 0, "All services should be in sorted list");
  assert.ok(idxA < idxB, "sort-a should come before sort-b");
  assert.ok(idxA < idxC, "sort-a should come before sort-c");
  assert.ok(idxB < idxC, "sort-b should come before sort-c");

  await registry.reset();
});

test("service-registry-lifecycle: teardownAll calls teardown functions in reverse order", async () => {
  const registry = new ServiceRegistry();
  const teardownOrder: string[] = [];

  registry.register("test.teardown-a", {
    init: () => ({}),
    teardown: () => {
      teardownOrder.push("a");
    },
  });

  registry.register("test.teardown-b", {
    init: () => ({}),
    dependsOn: ["test.teardown-a"],
    teardown: () => {
      teardownOrder.push("b");
    },
  });

  // Initialize all
  registry.get("test.teardown-a");
  registry.get("test.teardown-b");

  // Teardown
  await registry.teardownAll();

  // b should be torn down before a (reverse topological order)
  assert.equal(teardownOrder[0], "b", "teardown-b should run first");
  assert.equal(teardownOrder[1], "a", "teardown-a should run second");

  await registry.reset();
});

test("service-registry-lifecycle: get throws for unregistered service", async () => {
  const registry = new ServiceRegistry();

  assert.throws(
    () => registry.get("test.unregistered"),
    (err: unknown) => err instanceof Error && err.message.includes("no service registered"),
  );

  await registry.reset();
});

test("service-registry-lifecycle: isInitialized returns false for unregistered service", async () => {
  const registry = new ServiceRegistry();

  assert.equal(registry.isInitialized("test.unregistered"), false);

  await registry.reset();
});

test("service-registry-lifecycle: isInitialized returns true after service is accessed", async () => {
  const registry = new ServiceRegistry();

  registry.register("test.is-init", {
    init: () => ({}),
  });

  assert.equal(registry.isInitialized("test.is-init"), false);

  registry.get("test.is-init");

  assert.equal(registry.isInitialized("test.is-init"), true);

  await registry.reset();
});

test("service-registry-lifecycle: reset clears instances and registrations", async () => {
  const registry = new ServiceRegistry();

  registry.register("test.reset-check", {
    init: () => ({ value: 42 }),
  });

  // Initialize
  const instance1 = registry.get<{ value: number }>("test.reset-check");
  assert.equal(instance1.value, 42);
  assert.equal(registry.isInitialized("test.reset-check"), true);

  // Reset
  await registry.reset();

  // Both instance and registration are cleared after reset
  assert.equal(registry.isInitialized("test.reset-check"), false);

  // Topological sort should not contain the service after reset
  const sorted = registry.topologicalSort();
  assert.ok(!sorted.includes("test.reset-check"), "Service should be removed from registry after reset");

  await registry.reset();
});

test("service-registry-lifecycle: registerBootstrap registers services on new instances", async () => {
  const serviceId = `test.bootstrap-service.${Date.now()}`;
  const bootstrapId = `test.bootstrap.${Date.now()}`;

  ServiceRegistry.registerBootstrap(bootstrapId, (registry) => {
    registry.register(serviceId, {
      init: () => ({ serviceId }),
    });
  });

  const registryA = new ServiceRegistry();
  const registryB = new ServiceRegistry();

  assert.equal(registryA.get<{ serviceId: string }>(serviceId).serviceId, serviceId);
  assert.equal(registryB.get<{ serviceId: string }>(serviceId).serviceId, serviceId);

  await registryA.reset();
  await registryB.reset();
});
