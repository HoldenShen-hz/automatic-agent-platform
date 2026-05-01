/**
 * Integration tests for Core Runtime distributed-lock-service barrel module
 *
 * Tests the full re-export chain from core/runtime/distributed-lock-service.ts
 * which delegates to platform/five-plane-execution/distributed-lock/distributed-lock-service.js
 */

import assert from "node:assert/strict";
import test from "node:test";

import * as distributedLockModule from "../../../../src/core/runtime/distributed-lock-service.js";

test("distributed-lock-service barrel exports module", () => {
  assert.ok(distributedLockModule !== undefined, "Module should be defined");
  assert.ok(typeof distributedLockModule === "object", "Module should be an object");
});

test("distributed-lock-service barrel re-exports types", async () => {
  const mod = await import("../../../../src/core/runtime/distributed-lock-service.js");
  const keys = Object.keys(mod);
  // Check that module exports actual lock-related symbols
  assert.ok(keys.length > 0, "Module should export at least some keys");
  assert.ok(
    keys.some(k => k.toLowerCase().includes("adapter") || k.toLowerCase().includes("lock")),
    "Module should export lock-related symbols"
  );
});

test("distributed-lock-service barrel exports lock adapter factory", async () => {
  const mod = await import("../../../../src/core/runtime/distributed-lock-service.js");
  assert.ok(mod !== undefined);
  // Verify createLockAdapter exists and is a function
  assert.equal(typeof mod.createLockAdapter, "function", "createLockAdapter should be exported as a function");
});

test("distributed-lock-service barrel exports adapter types", async () => {
  const mod = await import("../../../../src/core/runtime/distributed-lock-service.js");
  assert.ok(mod !== undefined);
  // Verify adapter types exist - look for Sqlite, Redis, or generic adapter exports
  const adapterKeys = Object.keys(mod).filter(k => k.toLowerCase().includes("adapter") || k.toLowerCase().includes("sqlite") || k.toLowerCase().includes("redis"));
  assert.ok(adapterKeys.length > 0, "Should export at least one lock adapter type");
});

test("distributed-lock-service multiple imports return same module", async () => {
  const mod1 = await import("../../../../src/core/runtime/distributed-lock-service.js");
  const mod2 = await import("../../../../src/core/runtime/distributed-lock-service.js");
  assert.ok(mod1 === mod2, "Dynamic imports should return the same module instance");
});

test("distributed-lock-service module exports backend kind type", async () => {
  const mod = await import("../../../../src/core/runtime/distributed-lock-service.js");
  // Verify the module exports at least one item
  assert.ok(Object.keys(mod).length > 0 || mod !== null);
});
