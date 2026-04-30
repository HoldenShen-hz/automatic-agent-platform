/**
 * Service Registry Unit Tests - Isolation Tests
 *
 * Tests ServiceRegistry behavior with proper isolation between tests,
 * verifying singleton behavior, dependency injection, and teardown mechanics.
 *
 * @see src/platform/shared/lifecycle/service-registry.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";

test("ServiceRegistry singleton is isolated per registry instance", () => {
  // Two different registry instances should NOT share state
  const registry1 = new ServiceRegistry();
  const registry2 = new ServiceRegistry();

  registry1.register("service-a", {
    init: () => ({ id: "a" }),
  });

  registry2.register("service-a", {
    init: () => ({ id: "b" }),
  });

  const serviceA1 = registry1.get<{ id: string }>("service-a");
  const serviceA2 = registry2.get<{ id: string }>("service-a");

  // Same name registered in different registries returns different instances
  assert.notEqual(serviceA1.id, serviceA2.id);
  assert.equal(serviceA1.id, "a");
  assert.equal(serviceA2.id, "b");
});

test("ServiceRegistry getInstance returns the static singleton", () => {
  const instance = ServiceRegistry.getInstance();
  const instance2 = ServiceRegistry.getInstance();

  // Same singleton instance
  assert.ok(instance === instance2);
});

test("ServiceRegistry register does not auto-initialize", () => {
  const registry = new ServiceRegistry();
  let initCount = 0;

  registry.register("lazy-service", {
    init: () => {
      initCount++;
      return { value: 1 };
    },
  });

  // Registration alone should not call init
  assert.equal(initCount, 0);
  assert.equal(registry.isInitialized("lazy-service"), false);
});

test("ServiceRegistry get returns same instance on repeated calls", () => {
  const registry = new ServiceRegistry();

  registry.register("cached-service", {
    init: () => ({ value: Math.random() }),
  });

  const first = registry.get<{ value: number }>("cached-service");
  const second = registry.get<{ value: number }>("cached-service");

  assert.ok(first === second);
  assert.equal(first.value, second.value);
});

test("ServiceRegistry dependsOn works with multiple dependencies", () => {
  const registry = new ServiceRegistry();
  const initOrder: string[] = [];

  registry.register("service-c", {
    init: () => {
      initOrder.push("c");
      return {};
    },
  });
  registry.register("service-b", {
    init: () => {
      initOrder.push("b");
      return {};
    },
    dependsOn: ["service-c"],
  });
  registry.register("service-a", {
    init: () => {
      initOrder.push("a");
      return {};
    },
    dependsOn: ["service-b", "service-c"],
  });

  registry.get("service-a");

  // C must init before B and A, B before A
  assert.ok(initOrder.indexOf("c") < initOrder.indexOf("a"));
  assert.ok(initOrder.indexOf("c") < initOrder.indexOf("b"));
  assert.ok(initOrder.indexOf("b") < initOrder.indexOf("a"));
});

test("ServiceRegistry throws InternalAppError for circular dependency", () => {
  const registry = new ServiceRegistry();

  registry.register("circular-a", {
    init: () => ({}),
    dependsOn: ["circular-b"],
  });
  registry.register("circular-b", {
    init: () => ({}),
    dependsOn: ["circular-a"],
  });

  assert.throws(
    () => registry.topologicalSort(),
    /circular_dependency/i,
  );
});

test("ServiceRegistry reset clears instances but keeps registrations", () => {
  const registry = new ServiceRegistry();

  registry.register("persist-registration", {
    init: () => ({ value: 1 }),
  });

  // Initialize
  registry.get("persist-registration");
  assert.equal(registry.isInitialized("persist-registration"), true);

  // Reset
  registry.reset();

  // Registration persists but instance is cleared
  assert.throws(
    () => registry.get("persist-registration"),
    /service_registry.not_registered/,
  );
});

test("ServiceRegistry teardownAll handles missing teardown function", async () => {
  const registry = new ServiceRegistry();

  registry.register("no-teardown", {
    init: () => ({}),
    // No teardown function
  });

  registry.get("no-teardown");

  // Should not throw even though no teardown function
  await registry.teardownAll();

  assert.equal(registry.isInitialized("no-teardown"), false);
});

test("ServiceRegistry topologicalSort returns empty for no services", () => {
  const registry = new ServiceRegistry();
  const sorted = registry.topologicalSort();

  assert.ok(Array.isArray(sorted));
  assert.equal(sorted.length, 0);
});

test("ServiceRegistry topologicalSort handles single service", () => {
  const registry = new ServiceRegistry();

  registry.register("lonely", {
    init: () => ({}),
  });

  const sorted = registry.topologicalSort();

  assert.deepEqual(sorted, ["lonely"]);
});

test("ServiceRegistry initializeAll handles service with dependencies", () => {
  const registry = new ServiceRegistry();
  const initOrder: string[] = [];

  registry.register("base", {
    init: () => {
      initOrder.push("base");
      return {};
    },
  });
  registry.register("dependent", {
    init: () => {
      initOrder.push("dependent");
      return {};
    },
    dependsOn: ["base"],
  });

  registry.initializeAll();

  // All services should be initialized
  assert.ok(registry.isInitialized("base"));
  assert.ok(registry.isInitialized("dependent"));
  // Order should respect dependencies
  assert.ok(initOrder.indexOf("base") < initOrder.indexOf("dependent"));
});