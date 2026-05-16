/**
 * Lifecycle Integration Tests
 *
 * Integration tests for lifecycle management (ServiceRegistry, GracefulShutdown)
 * Tests real-world scenarios with multiple services and dependencies.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";
import { createGracefulShutdown } from "../../../../src/platform/five-plane-execution/startup/graceful-shutdown.js";

test("lifecycle-integration: ServiceRegistry handles realistic service graph", async () => {
  const registry = new ServiceRegistry();
  const initOrder: string[] = [];
  const teardownOrder: string[] = [];

  // Simulate realistic service dependencies
  registry.register("database", {
    init: () => {
      initOrder.push("database");
      return { query: () => "result" };
    },
    teardown: () => { teardownOrder.push("database"); },
  });

  registry.register("cache", {
    init: () => {
      initOrder.push("cache");
      return { get: () => null };
    },
    dependsOn: ["database"],
    teardown: () => { teardownOrder.push("cache"); },
  });

  registry.register("api-client", {
    init: () => {
      initOrder.push("api-client");
      return { call: () => "response" };
    },
    dependsOn: ["cache"],
    teardown: () => { teardownOrder.push("api-client"); },
  });

  registry.register("service-layer", {
    init: () => {
      initOrder.push("service-layer");
      return { process: () => "processed" };
    },
    dependsOn: ["api-client"],
    teardown: () => { teardownOrder.push("service-layer"); },
  });

  // Initialize deepest dependent
  registry.get("service-layer");

  // Verify initialization order
  assert.equal(initOrder[0], "database");
  assert.equal(initOrder[1], "cache");
  assert.equal(initOrder[2], "api-client");
  assert.equal(initOrder[3], "service-layer");

  // Verify all services initialized
  assert.ok(registry.isInitialized("database"));
  assert.ok(registry.isInitialized("cache"));
  assert.ok(registry.isInitialized("api-client"));
  assert.ok(registry.isInitialized("service-layer"));

  // Teardown
  await registry.teardownAll();

  // Verify teardown order (reverse of init)
  assert.equal(teardownOrder[0], "service-layer");
  assert.equal(teardownOrder[1], "api-client");
  assert.equal(teardownOrder[2], "cache");
  assert.equal(teardownOrder[3], "database");

  await registry.reset();
});

test("lifecycle-integration: GracefulShutdown coordinates with ServiceRegistry", async () => {
  const registry = new ServiceRegistry();

  let dbConnected = false;
  let cacheConnected = false;

  registry.register("db", {
    init: () => {
      dbConnected = true;
      return { connected: true };
    },
    teardown: () => {
      dbConnected = false;
    },
  });

  registry.register("cache", {
    init: () => {
      cacheConnected = true;
      return { connected: true };
    },
    dependsOn: ["db"],
    teardown: () => {
      cacheConnected = false;
    },
  });

  // Initialize services
  registry.get("db");
  registry.get("cache");
  assert.ok(dbConnected);
  assert.ok(cacheConnected);

  // Create graceful shutdown with registry teardown as handler
  const shutdown = createGracefulShutdown({
    timeoutMs: 5000,
    forceKillAfterTimeout: false,
  });

  shutdown.addHandler({
    name: "teardown-services",
    handler: async () => {
      await registry.teardownAll();
    },
  });

  const result = await shutdown.shutdown();

  assert.equal(result.success, true);
  assert.ok(!dbConnected, "DB should be disconnected");
  assert.ok(!cacheConnected, "Cache should be disconnected");

  await registry.reset();
});

test("lifecycle-integration: GracefulShutdown handles partial handler failures", async () => {
  const shutdown = createGracefulShutdown({
    timeoutMs: 5000,
    forceKillAfterTimeout: false,
  });

  const executedHandlers: string[] = [];

  shutdown.addHandler({
    name: "failing-handler",
    handler: async () => {
      executedHandlers.push("failing-handler");
      throw new Error("Intentional failure");
    },
  });

  shutdown.addHandler({
    name: "successful-handler",
    handler: async () => {
      executedHandlers.push("successful-handler");
    },
  });

  shutdown.addHandler({
    name: "another-successful",
    handler: async () => {
      executedHandlers.push("another-successful");
    },
  });

  const result = await shutdown.shutdown();

  // All handlers should have been attempted despite failure
  assert.equal(executedHandlers.length, 3);
  assert.equal(result.handlersFailed, 1);
  assert.equal(result.handlersRun, 3);
  assert.equal(result.success, false);
});

test("lifecycle-integration: ServiceRegistry bootstrap mechanism", async () => {
  const bootstrapName = "integration-bootstrap-" + Date.now();

  ServiceRegistry.registerBootstrap(bootstrapName, (registry) => {
    registry.register("bootstrap-service", {
      init: () => ({ bootstrapped: true }),
      teardown: () => {},
    });
  });

  // New registry should receive bootstrap
  const registry1 = new ServiceRegistry();
  const service1 = registry1.get<{ bootstrapped: boolean }>("bootstrap-service");
  assert.equal(service1.bootstrapped, true);

  // Another new registry should also receive bootstrap
  const registry2 = new ServiceRegistry();
  const service2 = registry2.get<{ bootstrapped: boolean }>("bootstrap-service");
  assert.equal(service2.bootstrapped, true);

  // Clean up
  await registry1.reset();
  await registry2.reset();
  ServiceRegistry["bootstrapRegistrars"].delete(bootstrapName);
});

test("lifecycle-integration: GracefulShutdown shutdown sequence timing", async () => {
  const shutdown = createGracefulShutdown({
    timeoutMs: 1000,
    forceKillAfterTimeout: false,
  });

  const executionTimes: { name: string; start: number; end: number }[] = [];

  shutdown.addHandler({
    name: "slow-handler",
    handler: async () => {
      const start = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 20));
      executionTimes.push({ name: "slow-handler", start, end: Date.now() });
    },
  });

  shutdown.addHandler({
    name: "fast-handler",
    handler: async () => {
      const start = Date.now();
      await new Promise((resolve) => setTimeout(resolve, 5));
      executionTimes.push({ name: "fast-handler", start, end: Date.now() });
    },
  });

  const startTime = Date.now();
  const result = await shutdown.shutdown();
  const totalTime = Date.now() - startTime;

  // fast-handler should execute first (reverse registration order)
  assert.equal(executionTimes.length, 2);
  assert.equal(executionTimes[0]!.name, "fast-handler");
  assert.equal(executionTimes[1]!.name, "slow-handler");

  // Total time should be at least the sum of both handlers (they run sequentially)
  assert.ok(totalTime >= 25, `Expected at least 25ms, got ${totalTime}ms`);

  assert.equal(result.handlersRun, 2);
});

test("lifecycle-integration: ServiceRegistry handles many services", async () => {
  const registry = new ServiceRegistry();
  const count = 50;

  // Register many independent services
  for (let i = 0; i < count; i++) {
    registry.register(`service-${i}`, {
      init: () => ({ id: i }),
      teardown: () => {},
    });
  }

  // Initialize all
  await registry.initializeAll();

  // Verify all initialized
  for (let i = 0; i < count; i++) {
    assert.ok(registry.isInitialized(`service-${i}`));
  }

  // Teardown all
  await registry.teardownAll();

  // teardownAll clears initialized instance state while keeping registrations
  for (let i = 0; i < count; i++) {
    assert.ok(!registry.isInitialized(`service-${i}`));
  }

  await registry.reset();
});

test("lifecycle-integration: GracefulShutdown with zero handlers", async () => {
  const shutdown = createGracefulShutdown();

  const result = await shutdown.shutdown();

  assert.equal(result.handlersRun, 0);
  assert.equal(result.handlersFailed, 0);
  assert.equal(result.success, true);
  assert.equal(result.errors.length, 0);
});

test("lifecycle-integration: ServiceRegistry transitive dependency chain", async () => {
  const registry = new ServiceRegistry();
  const initOrder: string[] = [];

  // Create a chain: a -> b -> c -> d -> e
  for (let i = 0; i < 5; i++) {
    const name = `chain-${String.fromCharCode(97 + i)}`; // a, b, c, d, e
    const dependsOn = i > 0 ? [`chain-${String.fromCharCode(96 + i)}`] : [];

    registry.register(name, {
      init: () => {
        initOrder.push(name);
        return {};
      },
      dependsOn,
    });
  }

  // Get the deepest dependency
  registry.get("chain-e");

  // Verify all were initialized in order
  assert.equal(initOrder.length, 5);
  assert.equal(initOrder[0], "chain-a");
  assert.equal(initOrder[4], "chain-e");

  await registry.reset();
});
