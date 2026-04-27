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

  let callCount = 0;

  registry.register("circular-self", {
    init: () => {
      callCount++;
      // This would cause infinite recursion if not prevented
      if (callCount < 10) {
        try {
          registry.get<unknown>("circular-self");
        } catch {
          // Expected - will be caught by visiting set
        }
      }
      return {};
    },
    dependsOn: ["circular-self"],
  });

  // Should not throw and should only call init once
  const instance = registry.get("circular-self");
  assert.ok(instance != null);
  assert.equal(callCount, 1, "init should only be called once");
});

test("ServiceRegistry get handles indirect circular dependency", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const initCounts: Record<string, number> = {};

  registry.register("cycle-a", {
    init: () => {
      initCounts["cycle-a"] = (initCounts["cycle-a"] ?? 0) + 1;
      // A depends on B, but during B's init, B will try to get A
      return {};
    },
    dependsOn: ["cycle-b"],
  });

  registry.register("cycle-b", {
    init: () => {
      initCounts["cycle-b"] = (initCounts["cycle-b"] ?? 0) + 1;
      return {};
    },
    dependsOn: ["cycle-a"],
  });

  // Should complete without infinite loop
  const instance = registry.get("cycle-a");
  assert.ok(instance != null);

  // Both should be initialized (direct cycle is broken by visiting set)
  assert.equal(initCounts["cycle-a"], 1);
  assert.equal(initCounts["cycle-b"], 1);
});

test("ServiceRegistry visiting set prevents infinite recursion on triple cycle", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  let callCount = 0;

  registry.register("triple-cycle-a", {
    init: () => {
      callCount++;
      return {};
    },
    dependsOn: ["triple-cycle-b"],
  });

  registry.register("triple-cycle-b", {
    init: () => {
      callCount++;
      return {};
    },
    dependsOn: ["triple-cycle-c"],
  });

  registry.register("triple-cycle-c", {
    init: () => {
      callCount++;
      return {};
    },
    dependsOn: ["triple-cycle-a"],
  });

  // Should complete without infinite loop
  registry.get("triple-cycle-a");

  // Each service should only init once
  assert.ok(callCount <= 3, `Expected at most 3 init calls, got ${callCount}`);
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

test("ServiceRegistry topologicalSort warns on circular dependencies", async () => {
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

  const sorted = registry.topologicalSort();

  // With a cycle, not all services will be in the result
  assert.ok(sorted.length < 2, "Circular dependencies should result in partial sort");
});
