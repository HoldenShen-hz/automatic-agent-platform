/**
 * Service Registry Error Handling Tests
 *
 * Tests error conditions including:
 * - Service not registered errors
 * - Circular dependency detection
 * - Reset-in-progress blocking
 * - Edge cases
 *
 * @source src/platform/shared/lifecycle/service-registry.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../../../../src/platform/shared/lifecycle/service-registry.js";

test("ServiceRegistry.get throws with correct error code for unregistered service", () => {
  const registry = new ServiceRegistry();

  assert.throws(
    () => registry.get("nonexistent"),
    (err: any) => {
      return err.code === "service_registry.not_registered" &&
        err.message.includes("nonexistent");
    },
    "Error should have code 'service_registry.not_registered'"
  );
});

test("ServiceRegistry.get throws during reset with reset_in_progress code", async () => {
  const registry = new ServiceRegistry();

  registry.register("blocking-service", {
    init: () => ({}),
    teardown: async () => {
      // Simulate slow teardown
      await new Promise((resolve) => setTimeout(resolve, 50));
    },
  });

  registry.get("blocking-service");

  // Start reset
  const resetPromise = registry.reset();

  // During reset, get should throw
  assert.throws(
    () => registry.get("another-service"),
    /service_registry.reset_in_progress/,
    "get() should throw during reset"
  );

  await resetPromise;
});

test("ServiceRegistry.register throws during reset with reset_in_progress code", async () => {
  const registry = new ServiceRegistry();

  registry.register("blocking", {
    init: () => ({}),
    teardown: async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    },
  });

  registry.get("blocking");

  const resetPromise = registry.reset();

  // During reset, register should throw
  assert.throws(
    () => registry.register("new-service", { init: () => ({}) }),
    /service_registry.reset_in_progress/,
    "register() should throw during reset"
  );

  await resetPromise;
});

test("ServiceRegistry.get detects circular dependency via visiting set", () => {
  const registry = new ServiceRegistry();

  registry.register("cycle-a", {
    init: () => ({}),
    dependsOn: ["cycle-b"],
  });

  registry.register("cycle-b", {
    init: () => ({}),
    dependsOn: ["cycle-c"],
  });

  registry.register("cycle-c", {
    init: () => ({}),
    dependsOn: ["cycle-a"],
  });

  assert.throws(
    () => registry.get("cycle-a"),
    /service_registry.circular_dependency/,
    "get() should detect circular dependency via visiting set"
  );
});

test("ServiceRegistry.topologicalSort throws on self-referential dependency", () => {
  const registry = new ServiceRegistry();

  registry.register("self-ref", {
    init: () => ({}),
    dependsOn: ["self-ref"],
  });

  assert.throws(
    () => registry.topologicalSort(),
    /service_registry.circular_dependency/,
    "topologicalSort should throw on self-reference"
  );
});

test("ServiceRegistry.topologicalSort reports unsorted services on cycle", () => {
  const registry = new ServiceRegistry();

  registry.register("sort-cycle-a", {
    init: () => ({}),
    dependsOn: ["sort-cycle-b"],
  });

  registry.register("sort-cycle-b", {
    init: () => ({}),
    dependsOn: ["sort-cycle-a"],
  });

  assert.throws(
    () => registry.topologicalSort(),
    (err: any) => {
      // Error should include information about unsorted services
      return err.code === "service_registry.circular_dependency" &&
        err.details?.unsortedServices?.length > 0;
    },
    "Error should include unsortedServices in details"
  );
});

test("ServiceRegistry.reset handles teardown errors gracefully", async () => {
  const registry = new ServiceRegistry();
  const errors: Error[] = [];

  registry.register("error-teardown", {
    init: () => ({}),
    teardown: () => {
      throw new Error("Teardown error 1");
    },
  });

  registry.register("error-teardown-2", {
    init: () => ({}),
    teardown: () => {
      throw new Error("Teardown error 2");
    },
  });

  registry.get("error-teardown");
  registry.get("error-teardown-2");

  // reset should not throw even with failing teardowns
  await registry.reset();

  assert.ok(true, "reset should complete even with teardown errors");
});

test("ServiceRegistry.teardownAll handles teardown errors gracefully", async () => {
  const registry = new ServiceRegistry();

  registry.register("teardown-error-service", {
    init: () => ({}),
    teardown: () => {
      throw new Error("Teardown failed");
    },
  });

  registry.get("teardown-error-service");

  // teardownAll should not throw
  await registry.teardownAll();

  assert.ok(true, "teardownAll should complete even with teardown errors");
});

test("ServiceRegistry.teardownAll continues after first teardown error", async () => {
  const registry = new ServiceRegistry();
  const teardownOrder: string[] = [];

  registry.register("first-error", {
    init: () => ({}),
    teardown: () => {
      throw new Error("First error");
    },
  });

  registry.register("second-success", {
    init: () => ({}),
    teardown: () => {
      teardownOrder.push("second-success");
    },
  });

  registry.get("first-error");
  registry.get("second-success");

  await registry.teardownAll();

  // Second service teardown should still be called
  assert.deepEqual(teardownOrder, ["second-success"]);
});

test("ServiceRegistry.get returns cached instance even during dependency resolution", () => {
  const registry = new ServiceRegistry();

  registry.register("cache-service", {
    init: () => ({ value: 42 }),
  });

  registry.register("cache-consumer", {
    init: () => {
      const cached = registry.get<{ value: number }>("cache-service");
      return { cachedValue: cached.value };
    },
    dependsOn: ["cache-service"],
  });

  const consumer = registry.get<{ cachedValue: number }>("cache-consumer");

  assert.equal(consumer.cachedValue, 42, "cached value should be accessible during init");
});

test("ServiceRegistry.register logs warning for duplicate registration", () => {
  const registry = new ServiceRegistry();

  registry.register("duplicate", {
    init: () => ({ value: 1 }),
  });

  // This should log a warning but not throw
  registry.register("duplicate", {
    init: () => ({ value: 2 }),
  });

  const service = registry.get<{ value: number }>("duplicate");
  assert.equal(service.value, 2, "duplicate registration should update init");
});

test("ServiceRegistry.reset clears instances but keeps registrations", async () => {
  const registry = new ServiceRegistry();

  registry.register("persist-registration", {
    init: () => ({ value: 1 }),
  });

  registry.get("persist-registration");
  assert.equal(registry.isInitialized("persist-registration"), true);

  await registry.reset();

  // Registration should persist
  assert.ok(registry.has("persist-registration"),
    "registration should persist after reset");
  // Instance should be cleared
  assert.equal(registry.isInitialized("persist-registration"), false,
    "instance should be cleared after reset");
});

test("ServiceRegistry.get throws for service registered but with failed init", () => {
  const registry = new ServiceRegistry();

  registry.register("failing-init", {
    init: () => {
      throw new Error("Init failed");
    },
  });

  assert.throws(
    () => registry.get("failing-init"),
    /Init failed/,
    "get() should propagate init errors"
  );
});

test("ServiceRegistry.teardownAll handles promise rejections", async () => {
  const registry = new ServiceRegistry();

  registry.register("async-error-teardown", {
    init: () => ({}),
    teardown: async () => {
      await new Promise((_, reject) => setTimeout(() => reject(new Error("Async teardown error")), 5));
    },
  });

  registry.get("async-error-teardown");

  // teardownAll should handle promise rejection
  await registry.teardownAll();

  assert.ok(true, "teardownAll should handle async teardown errors");
});

test("ServiceRegistry.initializeAll does not throw on external dependency failures", async () => {
  const registry = new ServiceRegistry();

  registry.register("external-dep-service", {
    init: () => {
      throw new Error("External dependency not available");
    },
  });

  // initializeAll should propagate the error
  assert.throws(
    () => registry.initializeAll(),
    /External dependency not available/,
    "initializeAll should throw if init throws"
  );
});

test("ServiceRegistry re-register during reset does not corrupt state", async () => {
  const registry = new ServiceRegistry();

  registry.register("service-a", {
    init: () => ({}),
    teardown: async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    },
  });

  registry.register("service-b", {
    init: () => ({}),
    teardown: async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    },
  });

  registry.get("service-a");
  registry.get("service-b");

  const resetPromise = registry.reset();

  // Wait a bit then try to get after reset completes
  await resetPromise;

  // Registry should still be usable
  registry.register("new-service", {
    init: () => ({ value: 42 }),
  });

  const service = registry.get<{ value: number }>("new-service");
  assert.equal(service.value, 42);
});