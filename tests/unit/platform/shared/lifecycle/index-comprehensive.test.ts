/**
 * Unit tests for lifecycle/index.ts barrel export.
 * Tests that all exports from the lifecycle module are properly re-exported.
 */

import assert from "node:assert/strict";
import test from "node:test";

// Re-export test - import from barrel
import { ServiceRegistry } from "../../../../../src/platform/shared/lifecycle/index.js";

test("index exports ServiceRegistry", () => {
  assert.ok(ServiceRegistry != null);
  assert.ok(typeof ServiceRegistry === "function");
});

test("ServiceRegistry from index is the same as direct import", () => {
  const { ServiceRegistry: DirectServiceRegistry } = await import("../../../../../src/platform/shared/lifecycle/service-registry.js");

  assert.strictEqual(ServiceRegistry, DirectServiceRegistry);
});

test("ServiceRegistry.getInstance returns singleton from barrel import", () => {
  const instance1 = ServiceRegistry.getInstance();
  const instance2 = ServiceRegistry.getInstance();

  assert.strictEqual(instance1, instance2);
});

test("ServiceRegistry.createScoped creates independent registry from barrel import", () => {
  const scoped = ServiceRegistry.createScoped();

  assert.ok(scoped != null);
  assert.notStrictEqual(scoped, ServiceRegistry.getInstance());

  scoped.register("barrel-test-service", {
    init: () => ({ value: 1 }),
  });

  assert.ok(scoped.has("barrel-test-service"));
});

test("ServiceRegistry.registerBootstrap exists and works from barrel import", () => {
  ServiceRegistry.registerBootstrap("barrel-test-bootstrap", (registry) => {
    registry.register("barrel-bootstrap-service", {
      init: () => ({ bootstrap: true }),
    });
  });

  const registry = ServiceRegistry.getInstance();
  assert.ok(registry.has("barrel-bootstrap-service"));
});

test("ServiceRegistry.prototype methods exist on imported class", () => {
  const registry = ServiceRegistry.getInstance();

  assert.ok(typeof registry.register === "function");
  assert.ok(typeof registry.get === "function");
  assert.ok(typeof registry.has === "function");
  assert.ok(typeof registry.isInitialized === "function");
  assert.ok(typeof registry.reset === "function");
  assert.ok(typeof registry.initializeAll === "function");
  assert.ok(typeof registry.teardownAll === "function");
  assert.ok(typeof registry.topologicalSort === "function");
});

test("ServiceRegistry from barrel can register and retrieve service", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  registry.register("barrel-integration-test", {
    init: () => ({ testValue: 123 }),
  });

  const service = registry.get<{ testValue: number }>("barrel-integration-test");

  assert.strictEqual(service.testValue, 123);
});

test("ServiceRegistry has method works correctly from barrel import", () => {
  const registry = ServiceRegistry.getInstance();

  registry.register("barrel-has-test", {
    init: () => ({}),
  });

  assert.strictEqual(registry.has("barrel-has-test"), true);
  assert.strictEqual(registry.has("nonexistent-barrel-test"), false);
});

test("ServiceRegistry isInitialized method works from barrel import", () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  registry.register("barrel-init-test", {
    init: () => ({}),
  });

  assert.strictEqual(registry.isInitialized("barrel-init-test"), false);

  registry.get("barrel-init-test");

  assert.strictEqual(registry.isInitialized("barrel-init-test"), true);
});

test("ServiceRegistry topologicalSort works from barrel import", () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  registry.register("barrel-sort-a", { init: () => ({}) });
  registry.register("barrel-sort-b", { init: () => ({}) });

  const sorted = registry.topologicalSort();

  assert.ok(Array.isArray(sorted));
  assert.ok(sorted.includes("barrel-sort-a"));
  assert.ok(sorted.includes("barrel-sort-b"));
});

test("ServiceRegistry reset works from barrel import", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  registry.register("barrel-reset-test", {
    init: () => ({ reset: true }),
  });

  registry.get("barrel-reset-test");
  assert.strictEqual(registry.isInitialized("barrel-reset-test"), true);

  await registry.reset();

  assert.strictEqual(registry.isInitialized("barrel-reset-test"), false);
});

test("Barrel import provides working singleton pattern", () => {
  const registry1 = ServiceRegistry.getInstance();
  const registry2 = ServiceRegistry.getInstance();

  assert.strictEqual(registry1, registry2);

  // After reset, should get new instance
  const registry3 = ServiceRegistry.getInstance();
  assert.strictEqual(registry1, registry3);
});

test("ServiceRegistry constructor creates new instance not singleton", () => {
  const instance1 = new ServiceRegistry();
  const instance2 = new ServiceRegistry();

  assert.notStrictEqual(instance1, instance2);
});

test("ServiceRegistry createScoped returns independent instance from barrel", () => {
  const global = ServiceRegistry.getInstance();
  const scoped = ServiceRegistry.createScoped();

  assert.notStrictEqual(global, scoped);

  // Scoped can register services not visible to global
  scoped.register("scoped-only", { init: () => ({}) });
  assert.ok(scoped.has("scoped-only"));
  assert.ok(!global.has("scoped-only"));
});

test("ServiceRegistry registerBootstrap replays to all live registries from barrel", () => {
  // Register a new bootstrap
  ServiceRegistry.registerBootstrap("barrel-replay-test", (registry) => {
    registry.register("replay-service", { init: () => ({}) });
  });

  // Existing singleton should have the service
  const singleton = ServiceRegistry.getInstance();
  assert.ok(singleton.has("replay-service"));
});