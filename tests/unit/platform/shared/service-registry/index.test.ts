/**
 * Service Registry Core Functionality Tests
 *
 * Tests the core functionality of ServiceRegistry including:
 * - Singleton pattern
 * - Service registration and retrieval
 * - Lazy initialization
 * - Instance caching
 *
 * @source src/platform/shared/lifecycle/service-registry.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../../../../src/platform/shared/lifecycle/service-registry.js";

test("ServiceRegistry.getInstance returns singleton", () => {
  const instance1 = ServiceRegistry.getInstance();
  const instance2 = ServiceRegistry.getInstance();
  assert.strictEqual(instance1, instance2, "getInstance should return the same instance");
});

test("ServiceRegistry.createScoped creates isolated instance", () => {
  const scoped = ServiceRegistry.createScoped();
  assert.ok(scoped instanceof ServiceRegistry, "createScoped should return a ServiceRegistry instance");

  // Scoped instances should be different from global singleton
  const global = ServiceRegistry.getInstance();
  assert.notStrictEqual(scoped, global, "scoped instance should differ from global singleton");
});

test("ServiceRegistry.register stores service registration", () => {
  const registry = new ServiceRegistry();

  registry.register("test-service", {
    init: () => ({ value: 42 }),
  });

  assert.ok(registry.has("test-service"), "registered service should be found via has()");
});

test("ServiceRegistry.register and get retrieves initialized service", () => {
  const registry = new ServiceRegistry();
  let initCalled = false;

  registry.register("lazy-service", {
    init: () => {
      initCalled = true;
      return { value: 42 };
    },
  });

  // Service should not be initialized until get() is called
  assert.equal(initCalled, false, "init should not be called before get()");

  const service = registry.get<{ value: number }>("lazy-service");

  assert.equal(initCalled, true, "init should be called after get()");
  assert.equal(service.value, 42, "service should return correct value");
});

test("ServiceRegistry.get returns same instance on repeated calls", () => {
  const registry = new ServiceRegistry();
  let initCount = 0;

  registry.register("singleton-service", {
    init: () => {
      initCount++;
      return { id: initCount };
    },
  });

  const instance1 = registry.get<{ id: number }>("singleton-service");
  const instance2 = registry.get<{ id: number }>("singleton-service");

  assert.equal(initCount, 1, "init should only be called once");
  assert.strictEqual(instance1, instance2, "repeated get() should return same instance");
});

test("ServiceRegistry.get throws for unregistered service", () => {
  const registry = new ServiceRegistry();

  assert.throws(
    () => registry.get("nonexistent"),
    (err: any) => err.code === "service_registry.not_registered",
    "get() should throw for unregistered service"
  );
});

test("ServiceRegistry.has returns true for registered service", () => {
  const registry = new ServiceRegistry();

  registry.register("exists", {
    init: () => ({}),
  });

  assert.equal(registry.has("exists"), true, "has() should return true for registered service");
  assert.equal(registry.has("not-exists"), false, "has() should return false for unregistered service");
});

test("ServiceRegistry.isInitialized returns correct state", () => {
  const registry = new ServiceRegistry();

  registry.register("never-init", {
    init: () => ({}),
  });

  assert.equal(registry.isInitialized("never-init"), false, "should not be initialized before get()");

  registry.get("never-init");

  assert.equal(registry.isInitialized("never-init"), true, "should be initialized after get()");
});

test("ServiceRegistry.register allows re-registration of existing service", () => {
  const registry = new ServiceRegistry();

  registry.register("replaceable", {
    init: () => ({ version: 1 }),
  });

  const first = registry.get<{ version: number }>("replaceable");
  assert.equal(first.version, 1);

  // Re-register with different init
  registry.register("replaceable", {
    init: () => ({ version: 2 }),
  });

  const second = registry.get<{ version: number }>("replaceable");
  assert.equal(second.version, 2, "re-registered service should use new init");
  assert.notStrictEqual(first, second, "re-registration should create new instance");
});

test("ServiceRegistry.register clears previous instance on re-registration", () => {
  const registry = new ServiceRegistry();

  registry.register("cache-test", {
    init: () => ({ value: 1 }),
  });

  const first = registry.get<{ value: number }>("cache-test");
  assert.equal(first.value, 1);

  // Re-register - should clear cached instance
  registry.register("cache-test", {
    init: () => ({ value: 2 }),
  });

  const second = registry.get<{ value: number }>("cache-test");
  assert.equal(second.value, 2, "re-registered service should return new instance");
});

test("ServiceRegistry.get works with no dependencies", () => {
  const registry = new ServiceRegistry();

  registry.register("standalone", {
    init: () => ({ data: "standalone" }),
  });

  const service = registry.get<{ data: string }>("standalone");
  assert.equal(service.data, "standalone");
});

test("ServiceRegistry.initializeAll initializes all registered services", () => {
  const registry = new ServiceRegistry();
  const initOrder: string[] = [];

  registry.register("service-a", {
    init: () => { initOrder.push("a"); return {}; },
  });
  registry.register("service-b", {
    init: () => { initOrder.push("b"); return {}; },
  });

  registry.initializeAll();

  assert.equal(registry.isInitialized("service-a"), true);
  assert.equal(registry.isInitialized("service-b"), true);
  assert.equal(initOrder.length, 2);
});

test("ServiceRegistry.initializeAll handles empty registry", () => {
  const registry = new ServiceRegistry();

  // Should not throw
  registry.initializeAll();

  assert.ok(true, "initializeAll on empty registry should not throw");
});

test("ServiceRegistry.reset clears singleton and returns new instance", async () => {
  const registry = ServiceRegistry.getInstance();
  const oldInstance = registry;

  registry.register("reset-test", {
    init: () => ({ value: 1 }),
  });

  await registry.reset();

  const newInstance = ServiceRegistry.getInstance();
  assert.notStrictEqual(oldInstance, newInstance, "reset should return new singleton instance");
});

test("ServiceRegistry.reset marks registry as unusable for new registrations", async () => {
  const registry = new ServiceRegistry();

  registry.register("before-reset", {
    init: () => ({}),
  });

  // Start an async teardown
  let resolveTeardown: () => void;
  const blockedTeardown = new Promise<void>((resolve) => {
    resolveTeardown = resolve;
  });

  registry.register("blocking", {
    init: () => ({}),
    teardown: async () => blockedTeardown,
  });

  registry.get("blocking");

  const resetPromise = registry.reset();

  // During reset, registration should be blocked
  assert.throws(
    () => registry.register("during-reset", { init: () => ({}) }),
    /service_registry.reset_in_progress/,
    "registration should be blocked during reset"
  );

  resolveTeardown!();
  await resetPromise;
});