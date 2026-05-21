/**
 * Service Registry Dependency Tests
 *
 * Tests the dependency resolution, topological sort, and dependency
 * ordering features of ServiceRegistry.
 *
 * @source src/platform/shared/lifecycle/service-registry.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../../../../src/platform/shared/lifecycle/service-registry.js";

test("ServiceRegistry dependsOn initializes dependency first", () => {
  const registry = new ServiceRegistry();
  const initOrder: string[] = [];

  registry.register("dependency-a", {
    init: () => {
      initOrder.push("dependency-a");
      return {};
    },
  });

  registry.register("dependent-service", {
    init: () => {
      initOrder.push("dependent-service");
      return {};
    },
    dependsOn: ["dependency-a"],
  });

  registry.get("dependent-service");

  assert.ok(initOrder.indexOf("dependency-a") < initOrder.indexOf("dependent-service"),
    "dependency should be initialized before dependent");
});

test("ServiceRegistry dependsOn handles multiple dependencies", () => {
  const registry = new ServiceRegistry();
  const initOrder: string[] = [];

  registry.register("multi-dep-a", {
    init: () => { initOrder.push("a"); return {}; },
  });

  registry.register("multi-dep-b", {
    init: () => { initOrder.push("b"); return {}; },
  });

  registry.register("multi-dep-c", {
    init: () => { initOrder.push("c"); return {}; },
  });

  registry.register("multi-dep-consumer", {
    init: () => { initOrder.push("consumer"); return {}; },
    dependsOn: ["multi-dep-a", "multi-dep-b", "multi-dep-c"],
  });

  registry.get("multi-dep-consumer");

  // All three should come before consumer
  assert.ok(initOrder.indexOf("a") < initOrder.indexOf("consumer"));
  assert.ok(initOrder.indexOf("b") < initOrder.indexOf("consumer"));
  assert.ok(initOrder.indexOf("c") < initOrder.indexOf("consumer"));
  assert.equal(initOrder.indexOf("consumer"), 3);
});

test("ServiceRegistry dependsOn handles transitive dependencies", () => {
  const registry = new ServiceRegistry();
  const initOrder: string[] = [];

  registry.register("transitive-level-1", {
    init: () => { initOrder.push("l1"); return {}; },
  });

  registry.register("transitive-level-2", {
    init: () => { initOrder.push("l2"); return {}; },
    dependsOn: ["transitive-level-1"],
  });

  registry.register("transitive-level-3", {
    init: () => { initOrder.push("l3"); return {}; },
    dependsOn: ["transitive-level-2"],
  });

  registry.get("transitive-level-3");

  assert.ok(initOrder.indexOf("l1") < initOrder.indexOf("l2"),
    "l1 should come before l2");
  assert.ok(initOrder.indexOf("l2") < initOrder.indexOf("l3"),
    "l2 should come before l3");
});

test("ServiceRegistry dependsOn skips non-existent dependencies", () => {
  const registry = new ServiceRegistry();

  registry.register("orphan-service", {
    init: () => ({}),
    dependsOn: ["nonexistent-dep"],
  });

  // Should not throw - dependsOn only initializes if dependency is registered
  const service = registry.get("orphan-service");
  assert.ok(service != null, "service should be created even with missing dependency");
});

test("ServiceRegistry topologicalSort returns services in dependency order", () => {
  const registry = new ServiceRegistry();

  registry.register("sort-a", { init: () => ({}) });
  registry.register("sort-b", {
    init: () => ({}),
    dependsOn: ["sort-a"],
  });
  registry.register("sort-c", {
    init: () => ({}),
    dependsOn: ["sort-b"],
  });

  const sorted = registry.topologicalSort();

  assert.ok(sorted.indexOf("sort-a") < sorted.indexOf("sort-b"),
    "sort-a should come before sort-b");
  assert.ok(sorted.indexOf("sort-b") < sorted.indexOf("sort-c"),
    "sort-b should come before sort-c");
});

test("ServiceRegistry topologicalSort handles independent services", () => {
  const registry = new ServiceRegistry();

  registry.register("independent-a", { init: () => ({}) });
  registry.register("independent-b", { init: () => ({}) });
  registry.register("independent-c", { init: () => ({}) });

  const sorted = registry.topologicalSort();

  assert.equal(sorted.length, 3);
  assert.ok(sorted.includes("independent-a"));
  assert.ok(sorted.includes("independent-b"));
  assert.ok(sorted.includes("independent-c"));
});

test("ServiceRegistry topologicalSort handles diamond dependency", () => {
  const registry = new ServiceRegistry();

  registry.register("diamond-top", { init: () => ({}) });

  registry.register("diamond-left", {
    init: () => ({}),
    dependsOn: ["diamond-top"],
  });

  registry.register("diamond-right", {
    init: () => ({}),
    dependsOn: ["diamond-top"],
  });

  registry.register("diamond-bottom", {
    init: () => ({}),
    dependsOn: ["diamond-left", "diamond-right"],
  });

  const sorted = registry.topologicalSort();

  // Top should come before both left and right
  assert.ok(sorted.indexOf("diamond-top") < sorted.indexOf("diamond-left"));
  assert.ok(sorted.indexOf("diamond-top") < sorted.indexOf("diamond-right"));
  // Both left and right should come before bottom
  assert.ok(sorted.indexOf("diamond-left") < sorted.indexOf("diamond-bottom"));
  assert.ok(sorted.indexOf("diamond-right") < sorted.indexOf("diamond-bottom"));
});

test("ServiceRegistry topologicalSort throws on circular dependency", () => {
  const registry = new ServiceRegistry();

  registry.register("circular-x", {
    init: () => ({}),
    dependsOn: ["circular-y"],
  });

  registry.register("circular-y", {
    init: () => ({}),
    dependsOn: ["circular-x"],
  });

  assert.throws(
    () => registry.topologicalSort(),
    /service_registry.circular_dependency/,
    "topologicalSort should throw on circular dependency"
  );
});

test("ServiceRegistry topologicalSort returns empty for empty registry", () => {
  const registry = new ServiceRegistry();

  const sorted = registry.topologicalSort();

  assert.ok(Array.isArray(sorted));
  assert.equal(sorted.length, 0);
});

test("ServiceRegistry topologicalSort returns single service", () => {
  const registry = new ServiceRegistry();

  registry.register("lone-service", { init: () => ({}) });

  const sorted = registry.topologicalSort();

  assert.deepEqual(sorted, ["lone-service"]);
});

test("ServiceRegistry get detects self-referential dependency", () => {
  const registry = new ServiceRegistry();

  registry.register("self-ref", {
    init: () => ({}),
    dependsOn: ["self-ref"],
  });

  // Should throw during get due to circular dependency detection
  assert.throws(
    () => registry.get("self-ref"),
    /service_registry.circular_dependency/,
    "get() should detect self-referential dependency"
  );
});

test("ServiceRegistry get handles indirect circular dependency via visiting set", () => {
  const registry = new ServiceRegistry();

  registry.register("cycle-a", {
    init: () => ({}),
    dependsOn: ["cycle-b"],
  });

  registry.register("cycle-b", {
    init: () => ({}),
    dependsOn: ["cycle-a"],
  });

  // get() with circular detection should throw
  assert.throws(
    () => registry.get("cycle-a"),
    /service_registry.circular_dependency/,
    "get() should detect indirect circular dependency"
  );
});

test("ServiceRegistry teardownAll tears down in reverse topological order", () => {
  const registry = new ServiceRegistry();
  const teardownOrder: string[] = [];

  registry.register("teardown-base", {
    init: () => ({}),
    teardown: () => { teardownOrder.push("base"); },
  });

  registry.register("teardown-dependent", {
    init: () => ({}),
    teardown: () => { teardownOrder.push("dependent"); },
    dependsOn: ["teardown-base"],
  });

  // Initialize both
  registry.get("teardown-base");
  registry.get("teardown-dependent");

  registry.teardownAll();

  // Dependent should be torn down before base (reverse order)
  const dependentIdx = teardownOrder.indexOf("dependent");
  const baseIdx = teardownOrder.indexOf("base");

  assert.ok(dependentIdx >= 0, "dependent should have teardown called");
  assert.ok(baseIdx >= 0, "base should have teardown called");
  assert.ok(dependentIdx < baseIdx,
    "dependent should be torn down before base in reverse topological order");
});

test("ServiceRegistry teardownAll handles missing teardown function", async () => {
  const registry = new ServiceRegistry();

  registry.register("no-teardown-service", {
    init: () => ({}),
    // No teardown function provided
  });

  registry.get("no-teardown-service");

  // Should not throw even though no teardown function
  await registry.teardownAll();

  assert.equal(registry.isInitialized("no-teardown-service"), false);
});

test("ServiceRegistry teardownAll continues on teardown error", async () => {
  const registry = new ServiceRegistry();
  const teardownOrder: string[] = [];

  registry.register("teardown-fail", {
    init: () => ({}),
    teardown: () => {
      throw new Error("teardown failed");
    },
  });

  registry.register("teardown-success", {
    init: () => ({}),
    teardown: () => { teardownOrder.push("success"); },
  });

  registry.get("teardown-fail");
  registry.get("teardown-success");

  // teardownAll should not throw
  await registry.teardownAll();

  // Success teardown should still be called
  assert.deepEqual(teardownOrder, ["success"]);
});

test("ServiceRegistry reset handles async teardown", async () => {
  const registry = new ServiceRegistry();
  let asyncTeardownCalled = false;

  registry.register("async-teardown-service", {
    init: () => ({}),
    teardown: async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      asyncTeardownCalled = true;
    },
  });

  registry.get("async-teardown-service");
  await registry.reset();

  assert.equal(asyncTeardownCalled, true, "async teardown should be called and awaited");
});

test("ServiceRegistry topologicalSort handles complex DAG", () => {
  const registry = new ServiceRegistry();

  // Create a complex DAG:
  //   a
  //  / \
  // b   c
  //  \ /
  //   d
  //   |
  //   e

  registry.register("dag-a", { init: () => ({}) });
  registry.register("dag-b", {
    init: () => ({}),
    dependsOn: ["dag-a"],
  });
  registry.register("dag-c", {
    init: () => ({}),
    dependsOn: ["dag-a"],
  });
  registry.register("dag-d", {
    init: () => ({}),
    dependsOn: ["dag-b", "dag-c"],
  });
  registry.register("dag-e", {
    init: () => ({}),
    dependsOn: ["dag-d"],
  });

  const sorted = registry.topologicalSort();

  // Verify constraints
  assert.ok(sorted.indexOf("dag-a") < sorted.indexOf("dag-b"),
    "a before b");
  assert.ok(sorted.indexOf("dag-a") < sorted.indexOf("dag-c"),
    "a before c");
  assert.ok(sorted.indexOf("dag-b") < sorted.indexOf("dag-d"),
    "b before d");
  assert.ok(sorted.indexOf("dag-c") < sorted.indexOf("dag-d"),
    "c before d");
  assert.ok(sorted.indexOf("dag-d") < sorted.indexOf("dag-e"),
    "d before e");
});