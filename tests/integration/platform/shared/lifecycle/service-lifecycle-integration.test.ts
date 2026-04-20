/**
 * Lifecycle Integration Test: Service Registry Lifecycle
 *
 * Verifies ServiceRegistry lifecycle behavior per Section 6.0a.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../../../../src/platform/shared/lifecycle/service-registry.js";

test("lifecycle: ServiceRegistry properly resets between tests", async () => {
  const registry1 = ServiceRegistry.getInstance();
  await registry1.reset(); // Reset first for test isolation

  // Register a service
  registry1.register<string>("test-service", {
    init: () => "initialized",
  });

  // Access to trigger initialization
  registry1.get<string>("test-service");

  // Verify it's initialized
  assert.ok(registry1.isInitialized("test-service"));

  // Reset
  await registry1.reset();

  // Should be cleared
  assert.ok(!registry1.isInitialized("test-service"));
});

test("lifecycle: ServiceRegistry topological sort handles dependency chains", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset(); // Reset first for test isolation

  const initOrder: string[] = [];

  // A -> B -> C (C depends on B, B depends on A)
  registry.register<string>("service-a", {
    init: () => { initOrder.push("a-init"); return "a"; },
  });

  registry.register<string>("service-b", {
    init: () => { initOrder.push("b-init"); return "b"; },
    dependsOn: ["service-a"],
  });

  registry.register<string>("service-c", {
    init: () => { initOrder.push("c-init"); return "c"; },
    dependsOn: ["service-b"],
  });

  // Access to trigger initialization
  registry.get<string>("service-c");

  // Teardown
  await registry.teardownAll();

  // Init order should be a, b, c (dependencies first)
  assert.ok(initOrder.includes("a-init"));
  assert.ok(initOrder.includes("b-init"));
  assert.ok(initOrder.includes("c-init"));
  const aIndex = initOrder.indexOf("a-init");
  const bIndex = initOrder.indexOf("b-init");
  const cIndex = initOrder.indexOf("c-init");
  assert.ok(aIndex < bIndex, "A should init before B");
  assert.ok(bIndex < cIndex, "B should init before C");
});

test("lifecycle: ServiceRegistry handles missing dependencies gracefully", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset(); // Reset first for test isolation

  // Register service with non-existent dependency
  registry.register<string>("orphan-service", {
    init: () => "orphan",
    dependsOn: ["nonexistent-service"],
  });

  // Topological sort should handle missing dependencies gracefully
  // (the missing dependency is simply skipped)
  const sorted = registry.topologicalSort();

  // Orphan service should be included (missing deps are ignored)
  assert.ok(sorted.includes("orphan-service"), "Orphan service should be included");

  // Getting the service should work despite missing dependency
  const instance = registry.get<string>("orphan-service");
  assert.strictEqual(instance, "orphan");

  await registry.reset();
});

test("lifecycle: ServiceRegistry teardown completes even with errors", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset(); // Reset first for test isolation

  const teardownOrder: string[] = [];

  registry.register<string>("svc-1", {
    init: () => "svc1",
    teardown: () => { teardownOrder.push("svc1-teardown"); },
  });

  registry.register<string>("svc-2", {
    init: () => "svc2",
    teardown: () => { teardownOrder.push("svc2-teardown"); throw new Error("teardown error"); },
  });

  registry.register<string>("svc-3", {
    init: () => "svc3",
    teardown: () => { teardownOrder.push("svc3-teardown"); },
  });

  // Trigger init
  registry.get<string>("svc-1");
  registry.get<string>("svc-2");
  registry.get<string>("svc-3");

  // Teardown should not throw even with error
  await registry.teardownAll();

  // All services should be torn down
  assert.ok(teardownOrder.includes("svc1-teardown"));
  assert.ok(teardownOrder.includes("svc2-teardown"));
  assert.ok(teardownOrder.includes("svc3-teardown"));
});

test("lifecycle: ServiceRegistry double reset is safe", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset(); // Reset first for test isolation

  registry.register<string>("safe-service", {
    init: () => "safe",
  });

  registry.get<string>("safe-service");

  // First reset
  await registry.reset();

  // Second reset should not throw
  await registry.reset();

  // Should still work after double reset
  registry.register<string>("new-service", {
    init: () => "new",
  });
  registry.get<string>("new-service");
  assert.ok(registry.isInitialized("new-service"));

  await registry.reset();
});
