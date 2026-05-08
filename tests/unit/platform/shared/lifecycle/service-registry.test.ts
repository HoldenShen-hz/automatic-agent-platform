import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../../../../src/platform/shared/lifecycle/service-registry.js";

// Helper to get a fresh registry instance for isolated testing
function createIsolatedRegistry(): ServiceRegistry {
  // Create a new instance by resetting and getting fresh singleton
  const registry = ServiceRegistry.getInstance();
  return registry;
}

test("ServiceRegistry registers and retrieves service", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
  let initialized = false;
  
  registry.register("test-service", {
    init: () => { initialized = true; return { value: 42 }; },
  });
  
  const service = registry.get<{ value: number }>("test-service");
  
  assert.equal(initialized, true);
  assert.equal(service.value, 42);
});

test("ServiceRegistry returns same instance on multiple gets", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
  let initCount = 0;
  
  registry.register("singleton-service", {
    init: () => { initCount++; return { id: initCount }; },
  });
  
  const instance1 = registry.get<{ id: number }>("singleton-service");
  const instance2 = registry.get<{ id: number }>("singleton-service");
  
  assert.equal(initCount, 1);
  assert.equal(instance1.id, instance2.id);
});

test("ServiceRegistry throws for unregistered service", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
  
  assert.throws(
    () => registry.get("nonexistent"),
    (error: any) => error.code === "service_registry.not_registered"
  );
});

test("ServiceRegistry isInitialized returns false before init", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
  
  registry.register("uninit-service", {
    init: () => ({ value: 1 }),
  });
  
  assert.equal(registry.isInitialized("uninit-service"), false);
});

test("ServiceRegistry isInitialized returns true after get", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
  
  registry.register("init-check-service", {
    init: () => ({ value: 1 }),
  });
  
  registry.get("init-check-service");
  
  assert.equal(registry.isInitialized("init-check-service"), true);
});

test("ServiceRegistry topologicalSort returns services in dependency order", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
  
  registry.register("service-a", {
    init: () => ({}),
    dependsOn: [],
  });
  registry.register("service-b", {
    init: () => ({}),
    dependsOn: ["service-a"],
  });
  registry.register("service-c", {
    init: () => ({}),
    dependsOn: ["service-b"],
  });
  
  const sorted = registry.topologicalSort();
  
  // service-a should come before service-b, service-b before service-c
  assert.ok(sorted.indexOf("service-a") < sorted.indexOf("service-b"));
  assert.ok(sorted.indexOf("service-b") < sorted.indexOf("service-c"));
});

test("ServiceRegistry topologicalSort handles no dependencies", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
  
  registry.register("alone-1", { init: () => ({}) });
  registry.register("alone-2", { init: () => ({}) });
  
  const sorted = registry.topologicalSort();
  
  assert.ok(sorted.includes("alone-1"));
  assert.ok(sorted.includes("alone-2"));
});

test("ServiceRegistry topologicalSort handles single service", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
  
  registry.register("solo", { init: () => ({}) });
  
  const sorted = registry.topologicalSort();
  
  assert.deepEqual(sorted, ["solo"]);
});

test("ServiceRegistry topologicalSort detects circular dependency warning", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
  
  registry.register("circular-a", {
    init: () => ({}),
    dependsOn: ["circular-b"],
  });
  registry.register("circular-b", {
    init: () => ({}),
    dependsOn: ["circular-a"],
  });
  
  const sorted = registry.topologicalSort();
  
  // Circular deps result in partial sort - not all services included
  assert.ok(sorted.length < 2);
});

test("ServiceRegistry reset clears all services and instances", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
  let teardownCalled = false;

  registry.register("teardown-service", {
    init: () => ({ value: 1 }),
    teardown: () => { teardownCalled = true; },
  });

  registry.get("teardown-service");
  assert.equal(registry.isInitialized("teardown-service"), true);

  await registry.reset();

  assert.equal(teardownCalled, true);
  assert.equal(registry.isInitialized("teardown-service"), false);
});

test("ServiceRegistry reset continues even when teardown throws", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
  const teardowns: string[] = [];

  registry.register("reset-fail", {
    init: () => ({}),
    teardown: () => { throw new Error("reset teardown failed"); },
  });
  registry.register("reset-ok", {
    init: () => ({}),
    teardown: () => { teardowns.push("reset-ok"); },
  });

  registry.get("reset-fail");
  registry.get("reset-ok");

  // reset should not throw even when one teardown fails
  await registry.reset();

  // The second service should still have its teardown called
  assert.deepEqual(teardowns, ["reset-ok"]);
});

test("ServiceRegistry teardownAll calls teardown on all services", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
  const teardowns: string[] = [];

  registry.register("teardown-1", {
    init: () => ({}),
    teardown: () => { teardowns.push("teardown-1"); },
  });
  registry.register("teardown-2", {
    init: () => ({}),
    teardown: () => { teardowns.push("teardown-2"); },
  });

  registry.get("teardown-1");
  registry.get("teardown-2");

  await registry.teardownAll();

  assert.deepEqual(teardowns, ["teardown-2", "teardown-1"]); // Reverse order
});

test("ServiceRegistry teardownAll continues even when one teardown throws", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
  const teardowns: string[] = [];

  registry.register("teardown-fail", {
    init: () => ({}),
    teardown: () => { throw new Error("teardown failed"); },
  });
  registry.register("teardown-ok", {
    init: () => ({}),
    teardown: () => { teardowns.push("teardown-ok"); },
  });

  registry.get("teardown-fail");
  registry.get("teardown-ok");

  // teardownAll should not throw even when one teardown fails
  await registry.teardownAll();

  // The second service should still have its teardown called
  assert.deepEqual(teardowns, ["teardown-ok"]);
});
