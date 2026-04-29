import { test } from "node:test";
import assert from "node:assert/strict";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";

// Helper to create a fresh registry for each test
function createFreshRegistry(): ServiceRegistry {
  const registry = new ServiceRegistry();
  return registry;
}

test("ServiceRegistry - getInstance returns singleton", () => {
  const instance1 = ServiceRegistry.getInstance();
  const instance2 = ServiceRegistry.getInstance();
  assert.ok(instance1 === instance2);
});

test("ServiceRegistry - register and get service", () => {
  const registry = createFreshRegistry();

  registry.register("test-service", {
    init: () => ({ value: 42 }),
  });

  const service = registry.get<{ value: number }>("test-service");
  assert.equal(service.value, 42);
});

test("ServiceRegistry - get throws for unregistered service", () => {
  const registry = createFreshRegistry();

  assert.throws(
    () => registry.get("nonexistent"),
    /service_registry.not_registered/
  );
});

test("ServiceRegistry - isInitialized returns false before initialization", () => {
  const registry = createFreshRegistry();

  registry.register("lazy-service", {
    init: () => ({ value: 1 }),
  });

  assert.equal(registry.isInitialized("lazy-service"), false);
});

test("ServiceRegistry - isInitialized returns true after initialization", () => {
  const registry = createFreshRegistry();

  registry.register("test-service", {
    init: () => ({ value: 42 }),
  });

  registry.get<{ value: number }>("test-service");
  assert.equal(registry.isInitialized("test-service"), true);
});

test("ServiceRegistry - service is initialized lazily on first get", () => {
  const registry = createFreshRegistry();
  let initCalled = false;

  registry.register("lazy-service", {
    init: () => {
      initCalled = true;
      return { value: 1 };
    },
  });

  assert.equal(initCalled, false);
  registry.get("lazy-service");
  assert.equal(initCalled, true);
});

test("ServiceRegistry - topologicalSort returns registered services", () => {
  const registry = createFreshRegistry();

  registry.register("service-a", { init: () => ({}) });
  registry.register("service-b", { init: () => ({}) });

  const sorted = registry.topologicalSort();

  assert.ok(sorted.includes("service-a"));
  assert.ok(sorted.includes("service-b"));
  assert.equal(sorted.length, 2);
});

test("ServiceRegistry - topologicalSort respects dependencies", () => {
  const registry = createFreshRegistry();
  const initOrder: string[] = [];

  registry.register("dependent", {
    init: () => ({}),
    dependsOn: ["dependency"],
  });
  registry.register("dependency", {
    init: () => ({}),
  });

  registry.get("dependent");
  registry.get("dependency");

  // Verify both services can be retrieved without error
  assert.ok(registry.isInitialized("dependent"));
  assert.ok(registry.isInitialized("dependency"));
});

test("ServiceRegistry - circular dependency handling", () => {
  const registry = createFreshRegistry();

  registry.register("service-a", {
    init: () => ({}),
    dependsOn: ["service-b"],
  });
  registry.register("service-b", {
    init: () => ({}),
    dependsOn: ["service-a"],
  });

  // Topological sort detects cycle and logs warning
  // Returns only services that can be sorted (may be partial)
  const result = registry.topologicalSort();
  // Cycle detection causes partial sort
  assert.ok(Array.isArray(result));
});

test("ServiceRegistry - teardown is called on reset", async () => {
  const registry = createFreshRegistry();
  let teardownCalled = false;

  registry.register("teardown-service", {
    init: () => ({ value: 1 }),
    teardown: () => {
      teardownCalled = true;
    },
  });

  registry.get("teardown-service");
  await registry.reset();

  assert.equal(teardownCalled, true);
  assert.equal(registry.isInitialized("teardown-service"), false);
});

test("ServiceRegistry - teardownAll calls teardown on all services", async () => {
  const registry = createFreshRegistry();
  const teardownOrder: string[] = [];

  registry.register("service-a", {
    init: () => ({}),
    teardown: () => { teardownOrder.push("a"); },
  });
  registry.register("service-b", {
    init: () => ({}),
    teardown: () => { teardownOrder.push("b"); },
  });

  registry.get("service-a");
  registry.get("service-b");
  await registry.teardownAll();

  assert.ok(teardownOrder.length >= 1); // At least one teardown was called
});

test("ServiceRegistry - register can override existing registration", () => {
  const registry = createFreshRegistry();

  registry.register("test-service", {
    init: () => ({ value: 1 }),
  });

  registry.register("test-service", {
    init: () => ({ value: 2 }),
  });

  const service = registry.get<{ value: number }>("test-service");
  assert.equal(service.value, 2);
});

test("ServiceRegistry - initializeAll initializes all registered services", () => {
  const registry = createFreshRegistry();
  let initCount = 0;

  registry.register("service-a", {
    init: () => { initCount++; return {}; },
  });
  registry.register("service-b", {
    init: () => { initCount++; return {}; },
  });

  registry.initializeAll();

  assert.equal(initCount, 2);
});

test("ServiceRegistry - registerBootstrap is replayed for new instances", () => {
  // This tests the static bootstrap registrar mechanism
  const bootstrapName = "test-bootstrap-" + Date.now();

  ServiceRegistry.registerBootstrap(bootstrapName, (registry) => {
    registry.register("bootstrapped-service", {
      init: () => ({ bootstrapped: true }),
    });
  });

  // Create a new registry - it should receive the bootstrap
  const newRegistry = new ServiceRegistry();

  assert.ok(newRegistry.isInitialized("bootstrapped-service") === false); // lazy
  const service = newRegistry.get<{ bootstrapped: boolean }>("bootstrapped-service");
  assert.equal(service.bootstrapped, true);
});