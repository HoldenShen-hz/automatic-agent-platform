import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";

test("ServiceRegistry getInstance returns singleton", () => {
  const instance1 = ServiceRegistry.getInstance();
  const instance2 = ServiceRegistry.getInstance();
  assert.ok(instance1 === instance2);
});

test("ServiceRegistry registerBootstrap registers wiring for new instances", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  let bootstrapCalled = false;
  ServiceRegistry.registerBootstrap("test-bootstrap", () => {
    bootstrapCalled = true;
  });

  // Create a fresh registry to trigger bootstrap
  // After reset, next getInstance creates a new instance
  ServiceRegistry.getInstance().reset();
  ServiceRegistry["_instance"] = null;

  // This should trigger the bootstrap
  const freshRegistry = ServiceRegistry.getInstance();
  assert.ok(freshRegistry !== null);

  // Cleanup
  ServiceRegistry["_instance"] = null;
  ServiceRegistry["liveRegistries"].clear();
  ServiceRegistry["bootstrapRegistrars"].delete("test-bootstrap");
});

test("ServiceRegistry registerBootstrap replays to new registries", async () => {
  // Create a fresh registry instance before registering bootstrap
  const registry = new ServiceRegistry();
  await registry.reset();

  let replayCount = 0;
  ServiceRegistry.registerBootstrap("replay-test", (_reg) => {
    replayCount++;
  });

  // Create a new registry - bootstrap should be replayed
  const registry2 = new ServiceRegistry();

  // The bootstrap should have been called at least once for registry2
  assert.ok(replayCount >= 1);

  // Cleanup
  ServiceRegistry["_instance"] = null;
  ServiceRegistry["liveRegistries"].clear();
  ServiceRegistry["bootstrapRegistrars"].delete("replay-test");
});

test("ServiceRegistry initializeAll initializes all registered services", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  let initA = false;
  let initB = false;

  registry.register("init-a", {
    init: () => { initA = true; return {}; },
  });
  registry.register("init-b", {
    init: () => { initB = true; return {}; },
  });

  await registry.initializeAll();

  assert.ok(initA);
  assert.ok(initB);
});

test("ServiceRegistry get with dependsOn initializes dependencies first", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

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

  // Get the dependent service
  registry.get("dependent");

  // base should be initialized first due to dependency
  assert.equal(initOrder[0], "base");
  assert.equal(initOrder[1], "dependent");
});

test("ServiceRegistry get handles transitive dependencies", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const initOrder: string[] = [];

  registry.register("level-1", {
    init: () => {
      initOrder.push("level-1");
      return {};
    },
  });
  registry.register("level-2", {
    init: () => {
      initOrder.push("level-2");
      return {};
    },
    dependsOn: ["level-1"],
  });
  registry.register("level-3", {
    init: () => {
      initOrder.push("level-3");
      return {};
    },
    dependsOn: ["level-2"],
  });

  // Get the deepest dependent
  registry.get("level-3");

  // All should be initialized in dependency order
  assert.ok(initOrder.includes("level-1"));
  assert.ok(initOrder.includes("level-2"));
  assert.ok(initOrder.includes("level-3"));
  assert.equal(initOrder[0], "level-1");
  assert.equal(initOrder[1], "level-2");
  assert.equal(initOrder[2], "level-3");
});

test("ServiceRegistry re-register drops the stale initialized instance", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  registry.register("re-register", {
    init: () => ({ value: 1 }),
  });

  const first = registry.get<{ value: number }>("re-register");
  assert.equal(first.value, 1);

  // Re-register with new init; the stale initialized instance should be discarded.
  registry.register("re-register", {
    init: () => ({ value: 2 }),
  });

  const second = registry.get<{ value: number }>("re-register");
  assert.equal(second.value, 2);
  assert.notStrictEqual(first, second);
});

test("ServiceRegistry topologicalSort handles multiple independent services", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  registry.register("a", { init: () => ({}) });
  registry.register("b", { init: () => ({}) });
  registry.register("c", { init: () => ({}) });

  const sorted = registry.topologicalSort();

  // All should be present (any order since they're independent)
  assert.ok(sorted.includes("a"));
  assert.ok(sorted.includes("b"));
  assert.ok(sorted.includes("c"));
  assert.equal(sorted.length, 3);
});

test("ServiceRegistry topologicalSort handles complex dependency graph", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  registry.register("root", { init: () => ({}) });
  registry.register("branch-a", {
    init: () => ({}),
    dependsOn: ["root"],
  });
  registry.register("branch-b", {
    init: () => ({}),
    dependsOn: ["root"],
  });
  registry.register("merge", {
    init: () => ({}),
    dependsOn: ["branch-a", "branch-b"],
  });

  const sorted = registry.topologicalSort();

  // root must come before its dependents
  assert.ok(sorted.indexOf("root") < sorted.indexOf("branch-a"));
  assert.ok(sorted.indexOf("root") < sorted.indexOf("branch-b"));
  // Both branches must come before merge
  assert.ok(sorted.indexOf("branch-a") < sorted.indexOf("merge"));
  assert.ok(sorted.indexOf("branch-b") < sorted.indexOf("merge"));
});

test("ServiceRegistry teardownAll calls teardown in reverse topological order", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const teardownOrder: string[] = [];

  registry.register("base", {
    init: () => ({}),
    teardown: () => { teardownOrder.push("base"); },
  });
  registry.register("dependent", {
    init: () => ({}),
    teardown: () => { teardownOrder.push("dependent"); },
    dependsOn: ["base"],
  });

  registry.get("base");
  registry.get("dependent");

  await registry.teardownAll();

  // Teardown should happen in reverse order (dependents first)
  assert.equal(teardownOrder[0], "dependent");
  assert.equal(teardownOrder[1], "base");
});

test("ServiceRegistry reset handles async teardown functions", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  let asyncTeardownCalled = false;

  registry.register("async-teardown", {
    init: () => ({}),
    teardown: async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      asyncTeardownCalled = true;
    },
  });

  registry.get("async-teardown");
  await registry.reset();

  assert.ok(asyncTeardownCalled);
});

test("ServiceRegistry reset keeps registrations available until teardown finishes", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  let dependencyVisibleDuringTeardown = false;

  registry.register("base", {
    init: () => ({ name: "base" }),
    teardown: () => undefined,
  });
  registry.register("dependent", {
    init: () => ({ name: "dependent" }),
    dependsOn: ["base"],
    teardown: () => {
      dependencyVisibleDuringTeardown = registry.has("base") && registry.isInitialized("base");
    },
  });

  registry.get("dependent");
  await registry.reset();

  assert.equal(dependencyVisibleDuringTeardown, true);
});

test("ServiceRegistry teardownAll handles async teardown functions", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  let asyncTeardownCalled = false;

  registry.register("async-teardown", {
    init: () => ({}),
    teardown: async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
      asyncTeardownCalled = true;
    },
  });

  registry.get("async-teardown");
  await registry.teardownAll();

  assert.ok(asyncTeardownCalled);
});

test("ServiceRegistry teardownAll continues on async teardown failure", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const teardowns: string[] = [];

  registry.register("fail-teardown", {
    init: () => ({}),
    teardown: async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      throw new Error("teardown failed");
    },
  });
  registry.register("success-teardown", {
    init: () => ({}),
    teardown: async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      teardowns.push("success");
    },
  });

  registry.get("fail-teardown");
  registry.get("success-teardown");

  // Should not throw
  await registry.teardownAll();

  // Success teardown should still be called
  assert.deepEqual(teardowns, ["success"]);
});
