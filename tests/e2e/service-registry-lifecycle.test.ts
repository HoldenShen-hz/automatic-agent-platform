/**
 * E2E Service Registry Lifecycle Tests
 *
 * Tests service registration, initialization, retrieval, and teardown
 * through the ServiceRegistry.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";

test("E2E: ServiceRegistry registers and initializes service", () => {
  const registry = ServiceRegistry.getInstance();

  interface TestService {
    name: string;
    initialized: boolean;
    dispose(): void;
  }

  let disposeCalled = false;

  registry.register<TestService>("test-service-1", {
    init: () => ({
      name: "test-service",
      initialized: true,
      dispose() {
        disposeCalled = true;
      },
    }),
    teardown: (instance) => instance.dispose(),
  });

  const service = registry.get<TestService>("test-service-1");

  assert.ok(service, "Service should be retrievable");
  assert.equal(service.name, "test-service", "Service name should match");
  assert.ok(service.initialized, "Service should be initialized");
});

test("E2E: ServiceRegistry initializes service lazily", () => {
  const registry = ServiceRegistry.getInstance();
  let initCalled = false;

  registry.register<{ value: number }>("test-lazy-service", {
    init: () => {
      initCalled = true;
      return { value: 42 };
    },
  });

  assert.ok(!initCalled, "Init should not be called before get()");

  const service = registry.get<{ value: number }>("test-lazy-service");

  assert.ok(initCalled, "Init should be called after get()");
  assert.equal(service.value, 42, "Service value should be correct");
});

test("E2E: ServiceRegistry returns same instance on multiple gets", () => {
  const registry = ServiceRegistry.getInstance();

  registry.register<{ id: string }>("test-singleton-service", {
    init: () => ({ id: "singleton-instance" }),
  });

  const instance1 = registry.get<{ id: string }>("test-singleton-service");
  const instance2 = registry.get<{ id: string }>("test-singleton-service");

  assert.strictEqual(instance1, instance2, "Multiple gets should return same instance");
});

test("E2E: ServiceRegistry teardown is called on reset", async () => {
  const registry = ServiceRegistry.getInstance();
  let teardownCalled = false;

  registry.register<{ dispose(): void }>("test-teardown-service", {
    init: () => ({
      dispose() {
        teardownCalled = true;
      },
    }),
    teardown: (instance) => instance.dispose(),
  });

  // Initialize the service
  registry.get<{ dispose(): void }>("test-teardown-service");

  assert.ok(!teardownCalled, "Teardown should not be called before reset");

  await registry.reset();

  assert.ok(teardownCalled, "Teardown should be called after reset");
});

test("E2E: ServiceRegistry throws for unregistered service", () => {
  const registry = ServiceRegistry.getInstance();

  assert.throws(
    () => registry.get("non-existent-service"),
    /no service registered/i,
    "Should throw for unregistered service",
  );
});

test("E2E: ServiceRegistry supports service with dependencies", () => {
  const registry = ServiceRegistry.getInstance();

  registry.register<{ value: number }>("test-dependency-service", {
    init: () => ({ value: 100 }),
  });

  registry.register<{ depValue: number; computed: number }>("test-dependent-service", {
    init: () => {
      const dep = registry.get<{ value: number }>("test-dependency-service");
      return { depValue: dep.value, computed: dep.value * 2 };
    },
    dependsOn: ["test-dependency-service"],
  });

  const dependent = registry.get<{ depValue: number; computed: number }>("test-dependent-service");

  assert.equal(dependent.depValue, 100, "Dependency value should be correct");
  assert.equal(dependent.computed, 200, "Computed value should reflect dependency");
});

test("E2E: ServiceRegistry can register multiple services", () => {
  const registry = ServiceRegistry.getInstance();

  registry.register<{ id: number }>("multi-service-1", {
    init: () => ({ id: 1 }),
  });
  registry.register<{ id: number }>("multi-service-2", {
    init: () => ({ id: 2 }),
  });
  registry.register<{ id: number }>("multi-service-3", {
    init: () => ({ id: 3 }),
  });

  const service1 = registry.get<{ id: number }>("multi-service-1");
  const service2 = registry.get<{ id: number }>("multi-service-2");
  const service3 = registry.get<{ id: number }>("multi-service-3");

  assert.equal(service1.id, 1, "Service 1 should have correct ID");
  assert.equal(service2.id, 2, "Service 2 should have correct ID");
  assert.equal(service3.id, 3, "Service 3 should have correct ID");
});
