/**
 * Unit tests for ServiceRegistry circular dependency detection during get().
 *
 * Tests that circular dependencies are detected and prevented when
 * accessing services, not just during topological sort.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../../../../src/platform/shared/lifecycle/service-registry.js";

test("ServiceRegistry get detects direct circular dependency", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  registry.register("circular-self", {
    init: () => ({}),
    dependsOn: ["circular-self"],
  });

  assert.throws(
    () => registry.get("circular-self"),
    /service_registry\.circular_dependency/,
  );
});

test("ServiceRegistry get handles indirect circular dependency", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  registry.register("cycle-a", {
    init: () => ({}),
    dependsOn: ["cycle-b"],
  });

  registry.register("cycle-b", {
    init: () => ({}),
    dependsOn: ["cycle-a"],
  });

  assert.throws(
    () => registry.get("cycle-a"),
    /service_registry\.circular_dependency/,
  );
});

test("ServiceRegistry visiting set prevents infinite recursion on triple cycle", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  registry.register("triple-cycle-a", {
    init: () => ({}),
    dependsOn: ["triple-cycle-b"],
  });

  registry.register("triple-cycle-b", {
    init: () => ({}),
    dependsOn: ["triple-cycle-c"],
  });

  registry.register("triple-cycle-c", {
    init: () => ({}),
    dependsOn: ["triple-cycle-a"],
  });

  assert.throws(
    () => registry.get("triple-cycle-a"),
    /service_registry\.circular_dependency/,
  );
});

test("ServiceRegistry get returns cached instance during circular dependency resolution", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  registry.register("cached-service", {
    init: () => ({ value: 42 }),
  });

  registry.register("cache-checker", {
    init: () => {
      const cached = registry.get<{ value: number }>("cached-service");
      return { cachedValue: cached.value };
    },
    dependsOn: ["cached-service"],
  });

  const result = registry.get<{ cachedValue: number }>("cache-checker");
  assert.equal(result.cachedValue, 42);
});

test("ServiceRegistry topologicalSort throws on circular dependencies", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  registry.register("sort-cycle-a", {
    init: () => ({}),
    dependsOn: ["sort-cycle-b"],
  });

  registry.register("sort-cycle-b", {
    init: () => ({}),
    dependsOn: ["sort-cycle-a"],
  });

  assert.throws(() => registry.topologicalSort(), /circular dependency detected in topological sort/);
});

test("ServiceRegistry getInstance reuses the same singleton during bootstrap reentry", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  let reentered: ServiceRegistry | null = null;
  ServiceRegistry.registerBootstrap("test.reentrant-singleton", () => {
    reentered = ServiceRegistry.getInstance();
  });

  const created = ServiceRegistry.getInstance();
  assert.equal(reentered, created);

  await created.reset();
});
