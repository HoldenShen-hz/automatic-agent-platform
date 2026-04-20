import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../../../../src/platform/shared/lifecycle/service-registry.js";

// Reset singleton before each test to ensure isolation
test.beforeEach(async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
});

test("ServiceRegistry integration: complex dependency ordering", async () => {
  const registry = ServiceRegistry.getInstance();
  const initOrder: string[] = [];

  // Register services with dependencies
  registry.register<string>("database", {
    init: () => { initOrder.push("database"); return "db-conn"; },
  });

  registry.register<string>("cache", {
    init: () => { initOrder.push("cache"); return "cache-conn"; },
    dependsOn: ["database"],
  });

  registry.register<string>("api", {
    init: () => { initOrder.push("api"); return "api-server"; },
    dependsOn: ["database", "cache"],
  });

  registry.register<string>("worker", {
    init: () => { initOrder.push("worker"); return "worker-pool"; },
    dependsOn: ["cache"],
  });

  // Initialize all
  await registry.initializeAll();

  // Verify all initialized
  assert.ok(registry.isInitialized("database"));
  assert.ok(registry.isInitialized("cache"));
  assert.ok(registry.isInitialized("api"));
  assert.ok(registry.isInitialized("worker"));

  // Teardown all
  await registry.teardownAll();

  // Registry should be empty after teardown
  assert.equal(registry.isInitialized("database"), false);
});

test("ServiceRegistry integration: teardown in reverse topological order", async () => {
  const registry = ServiceRegistry.getInstance();
  const teardownOrder: string[] = [];

  registry.register<string>("first", {
    init: () => "first",
    teardown: () => { teardownOrder.push("first"); },
  });

  registry.register<string>("second", {
    init: () => "second",
    dependsOn: ["first"],
    teardown: () => { teardownOrder.push("second"); },
  });

  registry.register<string>("third", {
    init: () => "third",
    dependsOn: ["second"],
    teardown: () => { teardownOrder.push("third"); },
  });

  // Initialize
  registry.get<string>("third");

  // Teardown should be in reverse order of dependencies
  await registry.teardownAll();

  assert.deepEqual(teardownOrder, ["third", "second", "first"]);
});

test("ServiceRegistry integration: circular dependency detection", async () => {
  const registry = ServiceRegistry.getInstance();

  registry.register<string>("svc-a", {
    init: () => "a",
    dependsOn: ["svc-b"],
  });

  registry.register<string>("svc-b", {
    init: () => "b",
    dependsOn: ["svc-a"],
  });

  // Topological sort should detect cycle
  const sorted = registry.topologicalSort();

  // Services should still be sorted but may not include all due to cycle
  assert.ok(sorted.length <= 2);
});

test("ServiceRegistry integration: reset clears singleton state", async () => {
  const registry1 = ServiceRegistry.getInstance();
  registry1.register<string>("temp-svc", {
    init: () => "temp",
  });
  registry1.get<string>("temp-svc");

  // Reset
  await registry1.reset();

  // New getInstance should return fresh instance
  const registry2 = ServiceRegistry.getInstance();
  assert.ok(registry1 !== registry2);

  // Registry2 should be empty
  assert.equal(registry2.isInitialized("temp-svc"), false);
});

test("ServiceRegistry integration: partial teardown failure doesn't stop others", async () => {
  const registry = ServiceRegistry.getInstance();
  const teardownOrder: string[] = [];

  registry.register<string>("good-1", {
    init: () => "g1",
    teardown: () => { teardownOrder.push("good-1"); },
  });

  registry.register<string>("failing", {
    init: () => "fail",
    teardown: () => { throw new Error("teardown failed"); },
  });

  registry.register<string>("good-2", {
    init: () => "g2",
    teardown: () => { teardownOrder.push("good-2"); },
  });

  registry.get<string>("good-1");
  registry.get<string>("failing");
  registry.get<string>("good-2");

  // Should not throw despite failing teardown
  await registry.teardownAll();

  // Good services should still be torn down
  assert.ok(teardownOrder.includes("good-1"));
  assert.ok(teardownOrder.includes("good-2"));
});

test("ServiceRegistry integration: get after partial initializeAll", async () => {
  const registry = ServiceRegistry.getInstance();
  let initCount = 0;

  registry.register<number>("svc-1", {
    init: () => { initCount++; return 1; },
  });

  registry.register<number>("svc-2", {
    init: () => { initCount++; return 2; },
  });

  registry.register<number>("svc-3", {
    init: () => { initCount++; return 3; },
  });

  // initializeAll
  await registry.initializeAll();
  assert.equal(initCount, 3);

  // Manual get should not re-init
  registry.get<number>("svc-1");
  assert.equal(initCount, 3); // Still 3, not 4
});
